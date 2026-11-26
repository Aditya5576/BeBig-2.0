/**
 * BeBig 2.0 — Recently Used Exercises Service
 *
 * Derives and sorts recently logged exercises from the authenticated
 * user's completed workout history within a rolling 14-day window,
 * with strict identity deduplication, offline resilience, and zero blocking network calls.
 */

import { WorkoutSession } from '../types';
import { Exercise, ExerciseCategory } from '../../exercises/types';
import {
  ExerciseTrackingMode,
  resolveExerciseTrackingMode,
  TREADMILL_EXERCISE_ID,
} from '../../exercises/exerciseTracking';
import { exerciseRepository } from '../../exercises/services/exerciseRepository';
import { workoutRepository } from './workoutRepository';
import { getWorkoutTimestampMs, hasValidExerciseId } from './previousPerformanceService';
import { normalizeCategory } from '../../exercises/providers/wger/wgerMapper';
import { customExerciseStorage } from '../../exercises/storage/customExerciseStorage';
import { exerciseCacheStorage } from '../../exercises/storage/exerciseCacheStorage';
import { exerciseNameOverrideStorage } from '../../exercises/storage/exerciseNameOverrideStorage';
import { UserScope } from '../../auth/utils/userScope';

export const RECENT_EXERCISE_WINDOW_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RecentExerciseReference {
  exerciseId: string;
  exerciseName: string;
  categoryName: string;
  lastUsedAt: string;
  trackingMode?: ExerciseTrackingMode;
}

export interface RecentExerciseEntry {
  exercise: Exercise;
  lastUsedAt: string;
}

export function formatRelativeRecentLabel(
  lastUsedAt: string,
  nowMs: number = Date.now(),
): string {
  const ts = Date.parse(lastUsedAt);
  if (!Number.isFinite(ts)) return 'Recently';
  const diffMs = Math.max(0, nowMs - ts);
  const diffDays = Math.floor(diffMs / MS_PER_DAY);
  if (diffDays <= 0) return 'Today';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 14) return 'Last week';
  return '2w ago';
}

/**
 * Extracts unique exercise references from completed workout history within a rolling
 * 14-day window, sorted chronologically descending by workout completion date.
 *
 * Requires:
 * - `workout.status === 'completed'`
 * - >= 1 completed set on the exercise (`actualSets.some(s => s.completed)`)
 * - Strict deduplication by stable exercise identity (newest first)
 */
export function extractRecentExerciseReferences(
  completedWorkouts: WorkoutSession[],
  limit: number = 10,
  options: { nowMs?: number; windowDays?: number } = {},
): RecentExerciseReference[] {
  if (!completedWorkouts || completedWorkouts.length === 0) {
    return [];
  }

  const nowMs = options.nowMs ?? Date.now();
  const windowDays = options.windowDays ?? RECENT_EXERCISE_WINDOW_DAYS;
  const cutoffMs = nowMs - windowDays * MS_PER_DAY;

  const sorted = [...completedWorkouts]
    .filter((w) => {
      if (w.status !== 'completed') return false;
      const ts = getWorkoutTimestampMs(w);
      return ts >= cutoffMs && ts <= nowMs + 60_000; // tolerate slight clock skew
    })
    .sort((a, b) => getWorkoutTimestampMs(b) - getWorkoutTimestampMs(a));

  const seenKeys = new Set<string>();
  const results: RecentExerciseReference[] = [];

  for (const workout of sorted) {
    if (!workout.exercises || workout.exercises.length === 0) continue;
    const workoutIso =
      workout.finishedAt ||
      workout.startedAt ||
      new Date(getWorkoutTimestampMs(workout)).toISOString();

    for (const ex of workout.exercises) {
      const hasCompletedSet =
        Array.isArray(ex.actualSets) && ex.actualSets.some((s) => s.completed === true);
      if (!hasCompletedSet) continue;

      const hasId = hasValidExerciseId(ex.exerciseId);
      const name = ex.exerciseName?.trim() || '';
      if (!hasId && !name) continue;

      const stableId = hasId ? ex.exerciseId.trim() : `name_${name.toLowerCase()}`;
      if (seenKeys.has(stableId)) continue;

      seenKeys.add(stableId);
      results.push({
        exerciseId: stableId,
        exerciseName: name || 'Exercise',
        categoryName: ex.categoryName || 'Other',
        lastUsedAt: workoutIso,
        trackingMode: resolveExerciseTrackingMode({
          id: stableId,
          name,
          trackingMode: ex.trackingMode,
        }),
      });

      if (results.length >= limit) {
        return results;
      }
    }
  }

  return results;
}

/**
 * Resolves recently used exercise references (last 14 days) into `{ exercise, lastUsedAt }`
 * entries with scoped display-name projections and preserved `trackingMode`.
 */
export async function getRecentlyUsedExerciseEntries(
  options: {
    limit?: number;
    completedWorkouts?: WorkoutSession[];
    scope?: UserScope | null;
    nowMs?: number;
    windowDays?: number;
  } = {},
): Promise<RecentExerciseEntry[]> {
  const {
    limit = 10,
    completedWorkouts: providedWorkouts,
    scope,
    nowMs,
    windowDays,
  } = options;

  let workouts = providedWorkouts;
  if (!workouts) {
    try {
      workouts = await workoutRepository.getCompletedWorkouts(scope);
    } catch {
      workouts = [];
    }
  }

  const refs = extractRecentExerciseReferences(workouts, limit, { nowMs, windowDays });
  if (refs.length === 0) {
    return [];
  }

  await exerciseNameOverrideStorage.ensureHydrated(scope);

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
    const cached = exerciseRepository.getCachedExercises({}, scope);
    cachedCatalogMap = new Map(cached.map((c) => [c.id, c]));
  } catch {
    // Graceful fallback
  }

  const results: RecentExerciseEntry[] = [];

  for (const ref of refs) {
    let resolved: Exercise | null = null;

    if (customMap.has(ref.exerciseId)) {
      resolved = customMap.get(ref.exerciseId)!;
    } else if (cachedCatalogMap.has(ref.exerciseId)) {
      resolved = cachedCatalogMap.get(ref.exerciseId)!;
    } else {
      try {
        resolved = await exerciseCacheStorage.getCachedExerciseById(ref.exerciseId, scope);
      } catch {
        // Fall through to synthesized model
      }
    }

    if (!resolved) {
      const { category, categoryName } = normalizeCategory(ref.categoryName);
      const isCanonicalTreadmill =
        ref.exerciseId === TREADMILL_EXERCISE_ID || ref.trackingMode === 'treadmill';
      resolved = {
        id: ref.exerciseId,
        name: ref.exerciseName,
        category: (isCanonicalTreadmill ? 'cardio' : category || 'other') as ExerciseCategory,
        categoryName: isCanonicalTreadmill ? 'Cardio' : categoryName || ref.categoryName || 'Other',
        primaryMuscles: [],
        secondaryMuscles: [],
        equipment: [],
        images: [],
        description: '',
        sourceProvider: 'system',
        sourceExerciseId: ref.exerciseId,
        isCustom: ref.exerciseId.startsWith('custom_'),
        trackingMode: ref.trackingMode || (isCanonicalTreadmill ? 'treadmill' : 'strength'),
      };
    }

    const canonicalMode = resolveExerciseTrackingMode({
      ...resolved,
      trackingMode: resolved.trackingMode || ref.trackingMode,
    });
    const projected = exerciseNameOverrideStorage.projectExercise(
      { ...resolved, trackingMode: canonicalMode },
      scope,
    );

    results.push({
      exercise: projected,
      lastUsedAt: ref.lastUsedAt,
    });
  }

  return results;
}

/**
 * Backwards-compatible helper returning resolved recent `Exercise[]` items.
 */
export async function getRecentlyUsedExercises(
  options: {
    limit?: number;
    completedWorkouts?: WorkoutSession[];
    scope?: UserScope | null;
    nowMs?: number;
    windowDays?: number;
  } = {},
): Promise<Exercise[]> {
  const entries = await getRecentlyUsedExerciseEntries(options);
  return entries.map((e) => e.exercise);
}
