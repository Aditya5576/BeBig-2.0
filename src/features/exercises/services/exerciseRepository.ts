import { Exercise, ExerciseCategory, CreateCustomExerciseInput, UpdateCustomExerciseInput } from '../types';
import { ExerciseFilterOptions, ExerciseListResult, IExerciseProvider } from '../providers/types';
import { WgerExerciseProvider } from '../providers/wger/WgerExerciseProvider';
import {
  customExerciseStorage,
  registerExerciseMemoryCacheCleaner,
  resolveExerciseScopeNamespace,
} from '../storage/customExerciseStorage';
import { exerciseCacheStorage, SEED_EXERCISES } from '../storage/exerciseCacheStorage';
import { exercisePhotoStorage } from '../storage/exercisePhotoStorage';
import { exercisePhotoCloudService } from './exercisePhotoCloudService';
import { normalizeCategory } from '../providers/wger/wgerMapper';
import { getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { syncMetadataStore, syncLifecycleManager } from '../../../services/sync';
import { filterAndRankExercises } from '../utils/exerciseSearch';
import { filterCatalogueForIndianGym } from '../data/gymEquipmentFilter';
import {
  globalExerciseCatalogService,
  GLOBAL_EXERCISE_ID_PREFIX,
} from './globalExerciseCatalogService';

async function withTimeout<T>(promise: Promise<T>, ms: number = 4000): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Network request timed out')), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export const STANDARD_CATEGORIES: { id: ExerciseCategory; name: string }[] = [
  { id: 'chest', name: 'Chest' },
  { id: 'back', name: 'Back' },
  { id: 'legs', name: 'Legs' },
  { id: 'arms', name: 'Arms' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'abs', name: 'Abs' },
  { id: 'calves', name: 'Calves' },
  { id: 'cardio', name: 'Cardio' },
];

export const STANDARD_EQUIPMENT: string[] = [
  'Barbell',
  'Dumbbell',
  'Cable machine',
  'Machine',
  'Kettlebell',
  'Bench',
  'Incline bench',
  'Pull-up bar',
  'Resistance band',
  'Bodyweight',
  'Other',
];

export function inferCategoryFromQuery(query: string): ExerciseCategory | undefined {
  const q = query.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  if (
    /\b(lat|lats|pulldown|pull down|pulley|row|rows|rowing|deadlift|pull up|pullup|chin up|chinup|shrug|back)\b/.test(
      q,
    )
  ) {
    return 'back';
  }
  if (/\b(bench|chest|fly|flye|pec|pushup|push up|dip|dips)\b/.test(q)) {
    return 'chest';
  }
  if (
    /\b(squat|squats|leg|legs|lunge|lunges|press|calf|calves|quad|hamstring|adductor|abductor)\b/.test(
      q,
    )
  ) {
    return 'legs';
  }
  if (/\b(curl|curls|bicep|biceps|tricep|triceps|extension|skull|hammer)\b/.test(q)) {
    return 'arms';
  }
  if (
    /\b(shoulder|shoulders|overhead|ohp|lateral|deltoid|delt|arnold|military)\b/.test(q)
  ) {
    return 'shoulders';
  }
  if (/\b(abs|ab|crunch|crunches|plank|oblique|situp)\b/.test(q)) {
    return 'abs';
  }
  return undefined;
}

export class ExerciseRepository {
  private provider: IExerciseProvider;
  private candidateCache = new Map<string, Exercise[]>();
  private customExerciseMemoryByScope = new Map<string, Map<string, Exercise>>();
  private customExercisesVersion = 0;
  private searchSequence = 0;
  private lastFilteredCacheRef: Exercise[] | null = null;
  private lastFilteredOptionsKey: string = '';
  private lastFilteredScopeKey: string = '';
  private lastFilteredResult: Exercise[] = [];

  constructor(provider?: IExerciseProvider) {
    this.provider = provider || new WgerExerciseProvider();
  }

  private getScopeMemoryMap(scope?: UserScope | null, create: boolean = false): Map<string, Exercise> | undefined {
    const namespace = resolveExerciseScopeNamespace(scope);
    let scopeMap = this.customExerciseMemoryByScope.get(namespace);
    if (!scopeMap && create) {
      scopeMap = new Map<string, Exercise>();
      this.customExerciseMemoryByScope.set(namespace, scopeMap);
    }
    return scopeMap;
  }

  setProvider(provider: IExerciseProvider): void {
    this.provider = provider;
  }

  getProvider(): IExerciseProvider {
    return this.provider;
  }

  getCategories(): { id: ExerciseCategory; name: string }[] {
    return STANDARD_CATEGORIES;
  }

  getEquipmentList(): string[] {
    return STANDARD_EQUIPMENT;
  }

  async getExercises(
    options: ExerciseFilterOptions = {},
    scope?: UserScope | null,
  ): Promise<ExerciseListResult> {
    const isFirstPage = !options.offset || options.offset === 0;
    const rawQuery = options.query?.trim();
    const hasQuery = Boolean(rawQuery && rawQuery.length > 0);

    // If source is strictly 'global', return only active global catalog exercises
    if (options.source === 'global') {
      try {
        const activeGlobal = await globalExerciseCatalogService.getActiveGlobalExercises();
        let matches: Exercise[] = [];
        if (hasQuery) {
          matches = filterAndRankExercises(activeGlobal, rawQuery, options.category);
        } else {
          matches = activeGlobal.filter((ex) => {
            if (options.category && options.category !== 'all' && ex.category !== options.category) {
              return false;
            }
            return true;
          });
        }
        return {
          exercises: matches,
          totalCount: matches.length,
          hasMore: false,
        };
      } catch {
        return {
          exercises: [],
          totalCount: 0,
          hasMore: false,
        };
      }
    }

    // 1. Retrieve local custom exercises (strictly isolated under active/provided user namespace)
    let customMatches: Exercise[] = [];
    if (isFirstPage && (!options.source || options.source === 'all' || options.source === 'custom')) {
      const allCustom = await customExerciseStorage.getCustomExercises(scope);
      const scopeMap = this.getScopeMemoryMap(scope, true)!;
      scopeMap.clear();
      allCustom.forEach((c) => scopeMap.set(c.id, c));
      exerciseCacheStorage.setCustomExercises(allCustom, scope);
      if (hasQuery) {
        customMatches = filterAndRankExercises(allCustom, rawQuery, options.category);
      } else {
        customMatches = allCustom.filter((ex) => {
          if (options.category && options.category !== 'all' && ex.category !== options.category) {
            return false;
          }
          return true;
        });
      }
    }

    // 2. Fetch provider exercises
    let providerExercises: Exercise[] = [];
    let totalCount = 0;
    let hasMore = false;
    let nextOffset: number | undefined = undefined;

    if (!options.source || options.source === 'all' || options.source === 'external') {
      if (!hasQuery) {
      // Standard browsing / pagination with local-first cache update
      try {
        const providerResult = await withTimeout(this.provider.listExercises(options), 4000);
        providerExercises = providerResult.exercises;
        totalCount = providerResult.totalCount;
        hasMore = providerResult.hasMore;
        nextOffset = providerResult.nextOffset;

        if (providerExercises.length > 0) {
          void exerciseCacheStorage.saveToCatalog(providerExercises);
        }

        // Cache by category if filtered
        if (options.category && options.category !== 'all') {
          const existing = this.candidateCache.get(options.category) || [];
          const mergedMap = new Map<string, Exercise>();
          existing.forEach((e) => mergedMap.set(e.id, e));
          providerExercises.forEach((e) => mergedMap.set(e.id, e));
          this.candidateCache.set(options.category, Array.from(mergedMap.values()));
        }
      } catch {
        // Fallback to local exercise cache on network error or timeout
        const cached = exerciseCacheStorage.searchCached({
          category: options.category,
          limit: options.limit,
        });
        providerExercises = cached;
        totalCount = cached.length;
        hasMore = false;
        nextOffset = undefined;
      }
    } else {
      // Query search flow: seeded with local-first cache
      const currentSeq = ++this.searchSequence;
      const targetCategory =
        options.category && options.category !== 'all'
          ? (options.category as ExerciseCategory)
          : inferCategoryFromQuery(rawQuery!);

      // Gather existing cached candidates from local storage and memory
      let candidatePool: Exercise[] = exerciseCacheStorage.searchCached({
        category: targetCategory || options.category,
      });
      if (targetCategory && this.candidateCache.has(targetCategory)) {
        this.candidateCache.get(targetCategory)!.forEach((e) => {
          if (!candidatePool.some((c) => c.id === e.id)) candidatePool.push(e);
        });
      }

      // Query provider with timeout
      let primarySearchFailed = false;
      try {
        const providerResult = await withTimeout(
          this.provider.listExercises({
            ...options,
            category: targetCategory || options.category,
            limit: targetCategory ? 60 : (options.limit || 30),
          }),
          3500,
        );

        if (this.searchSequence === currentSeq && providerResult.exercises.length > 0) {
          void exerciseCacheStorage.saveToCatalog(providerResult.exercises);
        }

        // Merge into candidate pool
        const poolMap = new Map<string, Exercise>();
        candidatePool.forEach((e) => poolMap.set(e.id, e));
        providerResult.exercises.forEach((e) => poolMap.set(e.id, e));
        candidatePool = Array.from(poolMap.values());

        if (targetCategory && this.searchSequence === currentSeq) {
          this.candidateCache.set(targetCategory, candidatePool);
        }
      } catch {
        primarySearchFailed = true;
        // Continue with cached candidate pool
      }

      // Rank candidate pool
      let ranked = filterAndRankExercises(candidatePool, rawQuery, options.category);

      // If ranked is empty and network is healthy, attempt concurrent fallback candidate retrieval
      if (ranked.length === 0 && !primarySearchFailed) {
        const qTokens = rawQuery!.split(/\s+/).filter((t) => t.length >= 3);
        const searchTokens = Array.from(new Set([...qTokens, rawQuery!.replace(/\s+/g, '')])).slice(0, 2);

        const fallbackPromises = searchTokens.map((token) =>
          withTimeout(
            this.provider.listExercises({
              ...options,
              query: token,
              limit: 50,
            }),
            2000,
          ),
        );

        try {
          const results = await Promise.allSettled(fallbackPromises);
          const newlyFetched: Exercise[] = [];

          for (const res of results) {
            if (res.status === 'fulfilled' && res.value.exercises.length > 0) {
              newlyFetched.push(...res.value.exercises);
            }
          }

          if (newlyFetched.length > 0) {
            void exerciseCacheStorage.saveToCatalog(newlyFetched);
            const newlyRanked = filterAndRankExercises(
              newlyFetched,
              rawQuery,
              options.category,
            );
            if (newlyRanked.length > 0) {
              ranked = newlyRanked;
            }
          }
        } catch {
          // Ignore fallback errors
        }
      }

      providerExercises = ranked;
      totalCount = ranked.length;
      hasMore = false;
      nextOffset = undefined;
    }
    }

    // 2b. Fetch active curated global exercises (text-only metadata, never overwrites custom exercises)
    let globalCatalogMatches: Exercise[] = [];
    if (isFirstPage && options.source !== 'custom' && options.source !== 'external') {
      try {
        const activeGlobal = await globalExerciseCatalogService.getActiveGlobalExercises();
        if (hasQuery) {
          globalCatalogMatches = filterAndRankExercises(activeGlobal, rawQuery, options.category);
        } else {
          globalCatalogMatches = activeGlobal.filter((ex) => {
            if (options.category && options.category !== 'all' && ex.category !== options.category) {
              return false;
            }
            return true;
          });
        }
      } catch {
        globalCatalogMatches = [];
      }
    }

    // 3. Merge custom, curated global, foundational seed exercises, and provider exercises
    const isUnfilteredFirstPage =
      isFirstPage &&
      !hasQuery &&
      (!options.category || options.category === 'all') &&
      options.source !== 'custom';

    const combinedMap = new Map<string, Exercise>();
    const customNamesLower = new Set<string>();
    if (isFirstPage) {
      customMatches.forEach((e) => {
        combinedMap.set(e.id, e);
        customNamesLower.add(e.name.trim().toLowerCase());
      });
      globalCatalogMatches.forEach((e) => {
        // Strictly never overwrite a user's custom exercise by ID or exact name
        if (!combinedMap.has(e.id) && !customNamesLower.has(e.name.trim().toLowerCase())) {
          combinedMap.set(e.id, e);
        }
      });
    }
    if (isUnfilteredFirstPage) {
      SEED_EXERCISES.forEach((seed) => {
        if (!combinedMap.has(seed.id)) {
          combinedMap.set(seed.id, seed);
        }
      });
    }
    providerExercises.forEach((e) => {
      if (!combinedMap.has(e.id)) {
        combinedMap.set(e.id, e);
      }
    });
    const combined = Array.from(combinedMap.values());

    const rankedExercises = hasQuery && isFirstPage
      ? filterAndRankExercises(combined, rawQuery, options.category)
      : combined;

    const finalExercises = filterCatalogueForIndianGym(rankedExercises, {
      includeNonStandardEquipment: options.equipment === 'all' || options.equipment === 'non-standard',
      allowDuplicates: false,
      isSearchActive: hasQuery,
    }).filtered;

    // Ensure active curated global exercises are never dropped by regional equipment filters
    const finalIds = new Set(finalExercises.map((e) => e.id));
    for (const gEx of globalCatalogMatches) {
      if (
        !finalIds.has(gEx.id) &&
        !customNamesLower.has(gEx.name.trim().toLowerCase())
      ) {
        finalExercises.push(gEx);
        finalIds.add(gEx.id);
      }
    }

    const seedCount = isUnfilteredFirstPage ? SEED_EXERCISES.length : 0;

    return {
      exercises: finalExercises,
      totalCount: hasQuery
        ? finalExercises.length
        : totalCount + customMatches.length + globalCatalogMatches.length + seedCount,
      hasMore,
      nextOffset,
    };
  }

  async getExerciseById(id: string, scope?: UserScope | null): Promise<Exercise | null> {
    // Check custom exercises first
    if (id.startsWith('custom_')) {
      const customs = await customExerciseStorage.getCustomExercises(scope);
      const scopeMap = this.getScopeMemoryMap(scope, true)!;
      scopeMap.clear();
      customs.forEach((c) => scopeMap.set(c.id, c));
      const found = customs.find((e) => e.id === id);
      if (found) {
        // Self-heal: if images array is empty but photoPath exists and local photo exists on disk, attach it
        if ((!found.images || found.images.length === 0) && found.photoPath) {
          const localPhoto = await exercisePhotoStorage.getLocalPhoto(id);
          if (localPhoto) {
            found.images = [{ id: `photo_${id}`, url: localPhoto, isMain: true }];
            void customExerciseStorage.saveCustomExercise(found, scope);
          }
        }
        scopeMap.set(found.id, found);
        return found;
      }
      return null;
    }

    // Check curated global exercise catalog before external provider
    if (id.startsWith(GLOBAL_EXERCISE_ID_PREFIX)) {
      const globalMatch = await globalExerciseCatalogService.getGlobalExerciseById(id);
      if (globalMatch) {
        return globalMatch;
      }
    }

    // Check local exercise cache first
    const cached = await exerciseCacheStorage.getCachedExerciseById(id, scope);
    if (cached) {
      return cached;
    }

    // Also allow lookup by raw global exercise UUID if not cached
    const globalFallback = await globalExerciseCatalogService.getGlobalExerciseById(id);
    if (globalFallback) {
      return globalFallback;
    }

    // Fall back to external provider with timeout
    try {
      const exercise = await withTimeout(this.provider.getExerciseById(id), 4000);
      if (exercise) {
        void exerciseCacheStorage.saveToCatalog([exercise]);
      }
      return exercise;
    } catch {
      return null;
    }
  }

  /**
   * Synchronously return cached exercise by ID if present in active/provided user namespace or public catalog.
   * Enables immediate 0ms rendering when navigating to Exercise Detail without cross-user leakage.
   */
  getCachedExerciseByIdSync(id: string, scope?: UserScope | null): Exercise | null {
    if (!id) return null;
    const scopeMap = this.getScopeMemoryMap(scope, false);
    if (scopeMap?.has(id)) {
      return scopeMap.get(id) || null;
    }
    const globalSync = globalExerciseCatalogService.getCachedGlobalExerciseByIdSync(id);
    if (globalSync) {
      return globalSync;
    }
    return exerciseCacheStorage.getCachedExerciseByIdSync(id, scope);
  }

  /**
   * Current custom exercises version counter for dirty-checking on screen focus.
   */
  getCustomExercisesVersion(): number {
    return this.customExercisesVersion;
  }

  /**
   * Hydrates exercise cache and custom exercises from storage on cold start for the active/provided scope.
   */
  async hydrate(scope?: UserScope | null, forceRefreshCustom: boolean = true): Promise<void> {
    await exerciseCacheStorage.ensureHydrated(scope, forceRefreshCustom);
    const customs = exerciseCacheStorage.getCustomExercisesSync(scope);
    const scopeMap = this.getScopeMemoryMap(scope, true)!;
    scopeMap.clear();
    customs.forEach((c) => scopeMap.set(c.id, c));
  }

  /**
   * Returns cached exercises synchronously or locally without network delay.
   * Merges active user's custom exercises into unified cache search index.
   */
  getCachedExercises(options: ExerciseFilterOptions = {}, scope?: UserScope | null): Exercise[] {
    const scopeKey = resolveExerciseScopeNamespace(scope);

    // Trigger background hydration on cold start or user switch if not yet hydrated for this namespace
    if (!exerciseCacheStorage.getIsHydrated(scope)) {
      void this.hydrate(scope, false).catch(() => {});
    }

    // Sync any custom exercises currently held in this namespace's memory map into cache storage if not already there
    const scopeMap = this.getScopeMemoryMap(scope, false);
    if (scopeMap && scopeMap.size > 0 && exerciseCacheStorage.getCustomExercisesSync(scope).length === 0) {
      exerciseCacheStorage.setCustomExercises(Array.from(scopeMap.values()), scope);
    }

    const cached = exerciseCacheStorage.searchCached(
      {
        query: options.query,
        category: options.category,
        limit: options.limit,
        source: options.source,
      },
      scope,
    );

    const optionsKey = `${options.equipment || 'standard'}::${Boolean(options.query && options.query.trim().length > 0)}`;
    if (
      this.lastFilteredCacheRef === cached &&
      this.lastFilteredOptionsKey === optionsKey &&
      this.lastFilteredScopeKey === scopeKey
    ) {
      return this.lastFilteredResult;
    }

    const result = filterCatalogueForIndianGym(cached, {
      includeNonStandardEquipment: options.equipment === 'all' || options.equipment === 'non-standard',
      allowDuplicates: false,
      isSearchActive: Boolean(options.query && options.query.trim().length > 0),
    }).filtered;

    this.lastFilteredCacheRef = cached;
    this.lastFilteredOptionsKey = optionsKey;
    this.lastFilteredScopeKey = scopeKey;
    this.lastFilteredResult = result;

    return result;
  }

  async createCustomExercise(
    input: CreateCustomExerciseInput,
    scope?: UserScope | null,
  ): Promise<Exercise> {
    const trimmedName = input.name ? input.name.trim() : '';
    if (!trimmedName) {
      throw new Error('Please enter an exercise name.');
    }
    if (trimmedName.length > 100) {
      throw new Error('Exercise name cannot exceed 100 characters.');
    }

    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();

    // Check for existing custom exercise duplicate for the user scope (case-insensitive & trimmed)
    const existingCustoms = await customExerciseStorage.getCustomExercises(resolvedScope);
    const normalizedName = trimmedName.toLowerCase();
    const duplicate = existingCustoms.find(
      (e) => e.name.trim().toLowerCase() === normalizedName,
    );
    if (duplicate) {
      throw new Error(`A custom exercise named "${trimmedName}" already exists.`);
    }

    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const { categoryName } = normalizeCategory(input.category);

    const primaryMuscles = (input.primaryMuscles || [])
      .map((name, idx) => ({ id: `cm_${idx}`, name: name.trim() }))
      .filter((m) => m.name.length > 0);

    const secondaryMuscles = (input.secondaryMuscles || [])
      .map((name, idx) => ({ id: `csm_${idx}`, name: name.trim() }))
      .filter((m) => m.name.length > 0);

    const equipment = (input.equipment || [])
      .map((name, idx) => ({ id: `ceq_${idx}`, name: name.trim() }))
      .filter((eq) => eq.name.length > 0);

    const now = new Date().toISOString();

    const newExercise: Exercise = {
      id,
      ownerId: resolvedScope?.ownerId,
      ownerType: resolvedScope?.ownerType,
      name: trimmedName,
      description: input.description?.trim() || '',
      category: input.category,
      categoryName,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      images: input.images || [],
      photoPath: input.photoPath || null,
      sourceProvider: 'custom',
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Local durable save first (Source of Truth)
    await customExerciseStorage.saveCustomExercise(newExercise, resolvedScope);
    const scopeMap = this.getScopeMemoryMap(resolvedScope, true)!;
    scopeMap.set(newExercise.id, newExercise);
    exerciseCacheStorage.saveCustomExercise(newExercise, resolvedScope);

    // Invalidate provider candidate cache so new custom exercise immediately shows up in queries
    this.customExercisesVersion++;
    this.candidateCache.clear();

    // 2. Mark pending upload in sync metadata (authenticated only)
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
      try {
        await syncMetadataStore.markPendingUpload(
          'custom_exercise',
          newExercise.id,
          newExercise.updatedAt || newExercise.createdAt || now,
          resolvedScope,
        );
      } catch {
        // Durability: Local save succeeded. Crash recovery scanner will reconstruct missing metadata.
      }

      // 3. Fire-and-forget sync trigger (asynchronous, non-blocking)
      void syncLifecycleManager.triggerSync({ reason: 'custom_exercise_saved', scope: resolvedScope }).catch(() => {
        // Silently caught; sync failure cannot throw or affect caller
      });
    }

    return newExercise;
  }

  async updateCustomExercise(
    input: UpdateCustomExerciseInput,
    scope?: UserScope | null,
  ): Promise<Exercise> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const customs = await customExerciseStorage.getCustomExercises(resolvedScope);
    const existing = customs.find((e) => e.id === input.id);
    if (!existing) {
      throw new Error(`Custom exercise with id "${input.id}" not found.`);
    }

    const trimmedName = input.name !== undefined ? input.name.trim() : existing.name;
    if (!trimmedName) {
      throw new Error('Exercise name is required.');
    }

    const category = input.category ?? existing.category;
    const categoryName = input.category
      ? normalizeCategory(input.category).categoryName
      : existing.categoryName;

    const primaryMuscles =
      input.primaryMuscles !== undefined
        ? input.primaryMuscles
            .map((name, idx) => ({ id: `cm_${idx}`, name: name.trim() }))
            .filter((m) => m.name.length > 0)
        : existing.primaryMuscles;

    const secondaryMuscles =
      input.secondaryMuscles !== undefined
        ? input.secondaryMuscles
            .map((name, idx) => ({ id: `csm_${idx}`, name: name.trim() }))
            .filter((m) => m.name.length > 0)
        : existing.secondaryMuscles;

    const equipment =
      input.equipment !== undefined
        ? input.equipment
            .map((name, idx) => ({ id: `ceq_${idx}`, name: name.trim() }))
            .filter((eq) => eq.name.length > 0)
        : existing.equipment;

    const now = new Date().toISOString();

    const updated: Exercise = {
      ...existing,
      ownerId: existing.ownerId || resolvedScope?.ownerId,
      ownerType: existing.ownerType || resolvedScope?.ownerType,
      name: trimmedName,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      category,
      categoryName,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      images: input.images !== undefined ? input.images : existing.images,
      photoPath: input.photoPath !== undefined ? input.photoPath : existing.photoPath,
      isCustom: true,
      updatedAt: now,
    };

    // 1. Local durable save first (Source of Truth)
    await customExerciseStorage.saveCustomExercise(updated, resolvedScope);
    const scopeMap = this.getScopeMemoryMap(resolvedScope, true)!;
    scopeMap.set(updated.id, updated);
    exerciseCacheStorage.saveCustomExercise(updated, resolvedScope);
    this.customExercisesVersion++;
    this.candidateCache.clear();

    // 2. Mark pending upload in sync metadata (authenticated only)
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
      try {
        await syncMetadataStore.markPendingUpload(
          'custom_exercise',
          updated.id,
          updated.updatedAt,
          resolvedScope,
        );
      } catch {
        // Durability: Local save succeeded. Crash recovery scanner will reconstruct missing metadata.
      }

      // 3. Fire-and-forget sync trigger (asynchronous, non-blocking)
      void syncLifecycleManager.triggerSync({ reason: 'custom_exercise_saved', scope: resolvedScope }).catch(() => {
        // Silently caught; sync failure cannot throw or affect caller
      });
    }

    return updated;
  }

  /**
   * Deletes a specific custom exercise.
   * Produces a durable pending_delete tombstone if authenticated and previously synced.
   * Safely cleans up local-only unsynced creations without sending unnecessary cloud tombstones.
   */
  async deleteCustomExercise(id: string, scope?: UserScope | null): Promise<void> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();

    // 1. Capture existing exercise details before local deletion removes it
    const existingList = await customExerciseStorage.getCustomExercises(resolvedScope);
    const existing = existingList.find((e) => e.id === id);
    const cloudPhotoPath = existing?.photoPath;
    const isAuth = Boolean(resolvedScope && resolvedScope.ownerType === 'authenticated' && resolvedScope.ownerId);

    try {
      // 2. If authenticated and has a cloud photo, trigger user-scoped cloud photo cleanup
      if (isAuth && cloudPhotoPath && resolvedScope?.ownerId) {
        try {
          const deleteSuccess = await exercisePhotoCloudService.deletePhoto(resolvedScope.ownerId, cloudPhotoPath);
          if (!deleteSuccess && typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn(`[ExerciseRepository] Cloud photo cleanup did not complete for ${cloudPhotoPath}`);
          }
        } catch (photoErr: any) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn(`[ExerciseRepository] Error during cloud photo cleanup:`, photoErr?.message);
          }
        }
      }

      if (isAuth) {
        const existingMeta = await syncMetadataStore.getRecord('custom_exercise', id, resolvedScope);
        const isUnsyncedLocalCreate =
          (!existingMeta || existingMeta.syncStatus === 'pending_upload') &&
          !existingMeta?.lastSyncedServerUpdatedAt;

        if (isUnsyncedLocalCreate) {
          // Unsynced local create -> delete: remove local entity and clear pending upload record
          await customExerciseStorage.deleteCustomExercise(id, resolvedScope);
          if (existingMeta) {
            await syncMetadataStore.removeRecord('custom_exercise', id, resolvedScope);
          }
          return;
        }

        // Durable tombstone first to prevent ID/sync loss on crash
        const now = new Date().toISOString();
        await syncMetadataStore.markPendingDelete('custom_exercise', id, now, now, resolvedScope);
        await customExerciseStorage.deleteCustomExercise(id, resolvedScope);

        // Fire-and-forget sync trigger (asynchronous, non-blocking)
        void syncLifecycleManager.triggerSync({ reason: 'local_delete', scope: resolvedScope }).catch(() => {
          // Silently caught; sync failure cannot throw or affect caller
        });
      } else {
        // Guest or unauthenticated: strictly local-only delete
        await customExerciseStorage.deleteCustomExercise(id, resolvedScope);
      }
    } finally {
      void exercisePhotoStorage.deleteLocalPhoto(id).catch(() => {});
      this.invalidateCandidateCache(id, resolvedScope);
    }
  }

  private invalidateCandidateCache(id?: string, scope?: UserScope | null): void {
    this.customExercisesVersion++;
    this.lastFilteredCacheRef = null;
    this.lastFilteredOptionsKey = '';
    this.lastFilteredScopeKey = '';
    this.lastFilteredResult = [];
    if (id) {
      const scopeMap = this.getScopeMemoryMap(scope, false);
      scopeMap?.delete(id);
      exerciseCacheStorage.deleteCustomExercise(id, scope);
      this.candidateCache.forEach((list, key) => {
        this.candidateCache.set(
          key,
          list.filter((e) => e.id !== id),
        );
      });
    } else {
      this.candidateCache.clear();
      this.customExerciseMemoryByScope.clear();
      exerciseCacheStorage.clearCustomMemoryCache();
    }
  }

  /**
   * Invalidates volatile in-memory storage cache on logout/user switch.
   */
  clearInMemoryState(): void {
    this.customExercisesVersion++;
    this.candidateCache.clear();
    this.customExerciseMemoryByScope.clear();
    this.lastFilteredCacheRef = null;
    this.lastFilteredOptionsKey = '';
    this.lastFilteredScopeKey = '';
    this.lastFilteredResult = [];
    exerciseCacheStorage.clearCustomMemoryCache();
  }
}

export const exerciseRepository = new ExerciseRepository();
registerExerciseMemoryCacheCleaner(() => exerciseRepository.clearInMemoryState());
