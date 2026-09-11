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

export class ExerciseRepository {
  private provider: IExerciseProvider;

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
    const hasQuery = Boolean(options.query && options.query.trim().length > 0);

    // Retrieve local custom exercises
    let customMatches: Exercise[] = [];
    if (isFirstPage) {
      const allCustom = await customExerciseStorage.getCustomExercises(scope);
      if (hasQuery) {
        customMatches = filterAndRankExercises(allCustom, options.query, options.category);
      } else {
        customMatches = allCustom.filter((ex) => {
          if (options.category && ex.category !== options.category) {
            return false;
          }
          return true;
        });
      }
    }

    // Fetch provider exercises
    let providerResult = await this.provider.listExercises(options);

    // If query was provided and provider returned 0 items, attempt tolerant fallback fetch
    // (e.g., when the provider performs strict SQL/like matching that fails on typos or alternative spacing)
    if (hasQuery && providerResult.exercises.length === 0) {
      const qTokens = options.query!.trim().split(/\s+/).filter((t) => t.length >= 3);
      if (qTokens.length > 0) {
        try {
          const fallbackResult = await this.provider.listExercises({
            ...options,
            query: qTokens[0],
            limit: 40,
          });
          if (fallbackResult.exercises.length > 0) {
            const rankedFallback = filterAndRankExercises(
              fallbackResult.exercises,
              options.query,
              options.category,
            );
            if (rankedFallback.length > 0) {
              providerResult = {
                ...fallbackResult,
                exercises: rankedFallback,
              };
            }
          }
        } catch {
          // Ignore fallback errors and preserve empty provider result
        }
      }
    } else if (hasQuery && providerResult.exercises.length > 0) {
      providerResult = {
        ...providerResult,
        exercises: filterAndRankExercises(providerResult.exercises, options.query, options.category),
      };
    }

    // Merge custom exercises on the first page
    const combined = isFirstPage
      ? [...customMatches, ...providerResult.exercises]
      : providerResult.exercises;

    // Rank combined results if querying so strongest matches are at the top
    const finalExercises = hasQuery && isFirstPage
      ? filterAndRankExercises(combined, options.query, options.category)
      : combined;

    return {
      exercises: finalExercises,
      totalCount: hasQuery
        ? finalExercises.length
        : providerResult.totalCount + customMatches.length,
      hasMore: providerResult.hasMore,
      nextOffset: providerResult.nextOffset,
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
    customExerciseStorage.clearMemoryCache();
  }
}

export const exerciseRepository = new ExerciseRepository();
