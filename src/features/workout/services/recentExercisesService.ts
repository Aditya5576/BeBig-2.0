/**
 * BeBig 2.0 — Recently Used Exercises Service
 *
 * Derives and sorts recently logged exercises from the authenticated
 * user's completed workout history, with strict identity deduplication,
 * offline resilience, and zero blocking network calls.
 */

import { WorkoutSession } from '../types';
import { Exercise, ExerciseCategory } from '../../exercises/types';
import { exerciseRepository } from '../../exercises/services/exerciseRepository';
import { workoutRepository } from './workoutRepository';
import { getWorkoutTimestampMs, hasValidExerciseId } from './previousPerformanceService';
import { normalizeCategory } from '../../exercises/providers/wger/wgerMapper';
import { customExerciseStorage } from '../../exercises/storage/customExerciseStorage';
import { exerciseCacheStorage } from '../../exercises/storage/exerciseCacheStorage';
import { UserScope } from '../../auth/utils/userScope';

export interface RecentExerciseReference {
  exerciseId: string;
  exerciseName: string;
  categoryName: string;
}

/**
 * Extracts unique exercise references from completed workout history,
 * sorted chronologically descending by workout completion date.
 *
 * Strict deduplication ensures each stable exercise identity appears
 * at most once, at its most recent occurrence.
 */
export function extractRecentExerciseReferences(
  completedWorkouts: WorkoutSession[],
  limit: number = 10,
): RecentExerciseReference[] {
  if (!completedWorkouts || completedWorkouts.length === 0) {
    return [];
  }

  // Defensive chronological sort: newest completed workout first
  const sorted = [...completedWorkouts]
    .filter((w) => w.status === 'completed' || Boolean(w.finishedAt))
    .sort((a, b) => getWorkoutTimestampMs(b) - getWorkoutTimestampMs(a));

  const seenKeys = new Set<string>();
  const results: RecentExerciseReference[] = [];

  for (const workout of sorted) {
    if (!workout.exercises || workout.exercises.length === 0) continue;

    for (const ex of workout.exercises) {
      const hasId = hasValidExerciseId(ex.exerciseId);
      const name = ex.exerciseName?.trim() || '';
      if (!hasId && !name) continue;

      const identityKey = hasId ? ex.exerciseId.trim() : name.toLowerCase();
      if (seenKeys.has(identityKey)) continue;

      seenKeys.add(identityKey);
      results.push({
        exerciseId: hasId ? ex.exerciseId.trim() : `name_${name.toLowerCase()}`,
        exerciseName: name || 'Exercise',
        categoryName: ex.categoryName || 'Other',
      });

      if (results.length >= limit) {
        return results;
      }
    }
  }

  return results;
}

/**
 * Resolves recently used exercise references into full Exercise objects.
 * Prioritizes local custom exercise storage and local catalog cache to
 * guarantee instant, non-blocking execution with no network overhead.
 */
export async function getRecentlyUsedExercises(
  options: {
    limit?: number;
    completedWorkouts?: WorkoutSession[];
    scope?: UserScope | null;
  } = {},
): Promise<Exercise[]> {
  const { limit = 10, completedWorkouts: providedWorkouts, scope } = options;

  let workouts = providedWorkouts;
  if (!workouts) {
    try {
      workouts = await workoutRepository.getCompletedWorkouts(scope);
    } catch {
      workouts = [];
    }
  }

  const refs = extractRecentExerciseReferences(workouts, limit);
  if (refs.length === 0) {
    return [];
  }

  // Preload custom exercises for the current user scope
  let customMap = new Map<string, Exercise>();
  try {
    const customs = await customExerciseStorage.getCustomExercises(scope);
    customMap = new Map(customs.map((c) => [c.id, c]));
  } catch {
    // Graceful fallback
  }

  // Preload cached catalog exercises
  let cachedCatalogMap = new Map<string, Exercise>();
  try {
    const cached = exerciseRepository.getCachedExercises();
    cachedCatalogMap = new Map(cached.map((c) => [c.id, c]));
  } catch {
    // Graceful fallback
  }

  const results: Exercise[] = [];

  for (const ref of refs) {
    if (customMap.has(ref.exerciseId)) {
      results.push(customMap.get(ref.exerciseId)!);
      continue;
    }

    if (cachedCatalogMap.has(ref.exerciseId)) {
      results.push(cachedCatalogMap.get(ref.exerciseId)!);
      continue;
    }

    // Try exerciseCacheStorage directly if available
    try {
      const fromCacheStorage = await exerciseCacheStorage.getCachedExerciseById(ref.exerciseId);
      if (fromCacheStorage) {
        results.push(fromCacheStorage);
        continue;
      }
    } catch {
      // Fall through to synthesized model
    }

    // Synthesize valid Exercise from historical workout metadata
    const { category, categoryName } = normalizeCategory(ref.categoryName);
    results.push({
      id: ref.exerciseId,
      name: ref.exerciseName,
      category: (category || 'other') as ExerciseCategory,
      categoryName: categoryName || ref.categoryName || 'Other',
      description: '',
      primaryMuscles: [],
      secondaryMuscles: [],
      equipment: [],
      images: [],
      sourceProvider: ref.exerciseId.startsWith('custom_') ? 'custom' : 'wger',
      isCustom: ref.exerciseId.startsWith('custom_'),
    });
  }

  return results;
}
