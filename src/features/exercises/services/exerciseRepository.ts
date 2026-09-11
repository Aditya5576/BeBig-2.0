import { Exercise, ExerciseCategory, CreateCustomExerciseInput, UpdateCustomExerciseInput } from '../types';
import { ExerciseFilterOptions, ExerciseListResult, IExerciseProvider } from '../providers/types';
import { WgerExerciseProvider } from '../providers/wger/WgerExerciseProvider';
import { customExerciseStorage } from '../storage/customExerciseStorage';
import { normalizeCategory } from '../providers/wger/wgerMapper';
import { getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { syncMetadataStore, syncLifecycleManager } from '../../../services/sync';
import { filterAndRankExercises } from '../utils/exerciseSearch';

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

  constructor(provider?: IExerciseProvider) {
    this.provider = provider || new WgerExerciseProvider();
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

    // 1. Retrieve local custom exercises
    let customMatches: Exercise[] = [];
    if (isFirstPage) {
      const allCustom = await customExerciseStorage.getCustomExercises(scope);
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

    if (!hasQuery) {
      // Standard browsing / pagination
      const providerResult = await this.provider.listExercises(options);
      providerExercises = providerResult.exercises;
      totalCount = providerResult.totalCount;
      hasMore = providerResult.hasMore;
      nextOffset = providerResult.nextOffset;

      // Cache by category if filtered
      if (options.category && options.category !== 'all') {
        const existing = this.candidateCache.get(options.category) || [];
        const mergedMap = new Map<string, Exercise>();
        existing.forEach((e) => mergedMap.set(e.id, e));
        providerExercises.forEach((e) => mergedMap.set(e.id, e));
        this.candidateCache.set(options.category, Array.from(mergedMap.values()));
      }
    } else {
      // Query search flow
      const targetCategory =
        options.category && options.category !== 'all'
          ? (options.category as ExerciseCategory)
          : inferCategoryFromQuery(rawQuery!);

      // Gather existing cached candidates
      let candidatePool: Exercise[] = [];
      if (targetCategory && this.candidateCache.has(targetCategory)) {
        candidatePool = [...this.candidateCache.get(targetCategory)!];
      }

      // Initial provider query
      try {
        const providerResult = await this.provider.listExercises({
          ...options,
          category: targetCategory || options.category,
          limit: targetCategory ? 60 : (options.limit || 30),
        });

        // Merge into candidate pool
        const poolMap = new Map<string, Exercise>();
        candidatePool.forEach((e) => poolMap.set(e.id, e));
        providerResult.exercises.forEach((e) => poolMap.set(e.id, e));
        candidatePool = Array.from(poolMap.values());

        if (targetCategory) {
          this.candidateCache.set(targetCategory, candidatePool);
        }
      } catch {
        // Continue with cached candidate pool
      }

      // Rank candidate pool
      let ranked = filterAndRankExercises(candidatePool, rawQuery, options.category);

      // If ranked is empty, attempt fallback candidate retrieval (e.g. token splitting or query variants)
      if (ranked.length === 0) {
        const qTokens = rawQuery!.split(/\s+/).filter((t) => t.length >= 3);
        const searchTokens = [...qTokens, rawQuery!.replace(/\s+/g, '')];

        for (const token of searchTokens) {
          try {
            const fallbackResult = await this.provider.listExercises({
              ...options,
              query: token,
              limit: 50,
            });
            if (fallbackResult.exercises.length > 0) {
              const newlyRanked = filterAndRankExercises(
                fallbackResult.exercises,
                rawQuery,
                options.category,
              );
              if (newlyRanked.length > 0) {
                ranked = newlyRanked;
                break;
              }
            }
          } catch {
            // Ignore fallback errors
          }
        }
      }

      providerExercises = ranked;
      totalCount = ranked.length;
      hasMore = false;
      nextOffset = undefined;
    }

    // 3. Merge custom and provider exercises (exact & strongest matches ranked to top)
    const combined = isFirstPage
      ? [...customMatches, ...providerExercises]
      : providerExercises;

    const finalExercises = hasQuery && isFirstPage
      ? filterAndRankExercises(combined, rawQuery, options.category)
      : combined;

    return {
      exercises: finalExercises,
      totalCount: hasQuery
        ? finalExercises.length
        : totalCount + customMatches.length,
      hasMore,
      nextOffset,
    };
  }

  async getExerciseById(id: string, scope?: UserScope | null): Promise<Exercise | null> {
    // Check custom exercises first
    if (id.startsWith('custom_')) {
      const customs = await customExerciseStorage.getCustomExercises(scope);
      return customs.find((e) => e.id === id) || null;
    }

    // Fall back to external provider
    return this.provider.getExerciseById(id);
  }

  async createCustomExercise(
    input: CreateCustomExerciseInput,
    scope?: UserScope | null,
  ): Promise<Exercise> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Exercise name is required.');
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

    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
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
      images: [],
      sourceProvider: 'custom',
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Local durable save first (Source of Truth)
    await customExerciseStorage.saveCustomExercise(newExercise, resolvedScope);

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
      isCustom: true,
      updatedAt: now,
    };

    // 1. Local durable save first (Source of Truth)
    await customExerciseStorage.saveCustomExercise(updated, resolvedScope);

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
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
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
  }

  /**
   * Invalidates volatile in-memory storage cache on logout/user switch.
   */
  clearInMemoryState(): void {
    this.candidateCache.clear();
    customExerciseStorage.clearMemoryCache();
  }
}

export const exerciseRepository = new ExerciseRepository();
