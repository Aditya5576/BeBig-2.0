/**
 * BeBig 2.0 — Previous-Session Performance Suggestion Service
 *
 * Implements deterministic, chronologically sorted, and identity-safe
 * mapping of previous performance records for active workout exercises and sets.
 */

import { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';

export interface LastPerformanceRecord {
  workoutDate?: string;
  sets: WorkoutSet[];
}

export interface ProgressiveOverloadNudge {
  weight: number;
  reps: number;
  date?: string;
  label: string;
}

/**
 * Validates whether an exercise identifier is non-empty and well-formed.
 */
export const hasValidExerciseId = (id?: string | null): id is string =>
  Boolean(id && typeof id === 'string' && id.trim().length > 0 && id.trim() !== 'undefined' && id.trim() !== 'null');

/**
 * Returns epoch timestamp in milliseconds for a workout session.
 * Prefers finishedAt, falling back to startedAt. Returns 0 if invalid.
 */
export function getWorkoutTimestampMs(w: WorkoutSession): number {
  const tsStr = w.finishedAt || w.startedAt;
  if (!tsStr) return 0;
  const parsed = Date.parse(tsStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Evaluates whether two exercise definitions represent the exact same exercise.
 *
 * Rules:
 * 1. If both records have valid exercise IDs that match, return true.
 * 2. If either record is a custom exercise (ID starting with 'custom_'),
 *    strictly isolate by ID — never match different custom IDs across names.
 * 3. For non-custom catalog/template exercises with different IDs, or when at
 *    least one record lacks a valid ID (legacy data), safely fall back to
 *    normalized (trimmed, lowercased) exercise name matching.
 */
export function isExerciseMatch(target: WorkoutExercise, candidate: WorkoutExercise): boolean {
  const targetHasId = hasValidExerciseId(target.exerciseId);
  const candidateHasId = hasValidExerciseId(candidate.exerciseId);

  if (targetHasId && candidateHasId) {
    if (target.exerciseId.trim() === candidate.exerciseId.trim()) {
      return true;
    }

    // Preserve strict isolation for user custom exercises:
    const isTargetCustom = target.exerciseId.startsWith('custom_');
    const isCandidateCustom = candidate.exerciseId.startsWith('custom_');
    if (isTargetCustom || isCandidateCustom) {
      return false;
    }
  }

  // Fallback to normalized exercise name for non-custom catalog/template or legacy entries
  const normTarget = target.exerciseName?.trim().toLowerCase() || '';
  const normCandidate = candidate.exerciseName?.trim().toLowerCase() || '';
  return Boolean(normTarget && normCandidate && normTarget === normCandidate);
}

/**
 * Matches a current workout set with its corresponding historical set
 * strictly by `setNumber` (never by array index).
 */
export function findMatchingPreviousSet(
  previousSets: WorkoutSet[] | undefined,
  currentSet: WorkoutSet
): WorkoutSet | undefined {
  if (!previousSets || previousSets.length === 0) return undefined;
  return previousSets.find((s) => s.setNumber === currentSet.setNumber);
}

/**
 * Builds a deterministic lookup map of last performance per exercise.
 * Sorts historical workouts descending by completion timestamp so the
 * most recent workout takes precedence.
 *
 * Handles repeated exercise instances within the session by keying on
 * `${exerciseId}_${order}` with fallback to `${exerciseId}`.
 */
export function buildLastPerformanceMap(
  currentExercises: WorkoutExercise[],
  completedWorkouts: WorkoutSession[],
  currentSessionId?: string
): Record<string, LastPerformanceRecord> {
  const map: Record<string, LastPerformanceRecord> = {};
  if (!currentExercises || currentExercises.length === 0) return map;

  // Defensive chronological sort: newest completed workout first
  const sortedCompleted = [...completedWorkouts]
    .filter((w) => w.id !== currentSessionId && (w.status === 'completed' || Boolean(w.finishedAt)))
    .sort((a, b) => getWorkoutTimestampMs(b) - getWorkoutTimestampMs(a));

  // Track occurrence index of each exercise identity in the current session
  const occurrenceCountMap: Record<string, number> = {};

  for (const ex of currentExercises) {
    if (!hasValidExerciseId(ex.exerciseId) && (!ex.exerciseName || !ex.exerciseName.trim())) {
      continue;
    }

    const identityKey = hasValidExerciseId(ex.exerciseId)
      ? ex.exerciseId.trim()
      : ex.exerciseName.trim().toLowerCase();

    const instanceRank = occurrenceCountMap[identityKey] ?? 0;
    occurrenceCountMap[identityKey] = instanceRank + 1;

    for (const w of sortedCompleted) {
      if (!w.exercises || w.exercises.length === 0) continue;

      // Find all matches in this historical workout
      const matchingHistoricalExercises = w.exercises.filter((cand) => isExerciseMatch(ex, cand));
      if (matchingHistoricalExercises.length === 0) continue;

      // Prefer matching the corresponding instance rank (e.g. 2nd bench to 2nd bench), or fallback to 1st
      const candidateMatch =
        matchingHistoricalExercises[instanceRank] ?? matchingHistoricalExercises[0];

      if (candidateMatch && candidateMatch.actualSets && candidateMatch.actualSets.length > 0) {
        const loggedSets = candidateMatch.actualSets.filter(
          (s) => s.completed || (s.weight ?? 0) > 0 || (s.reps ?? 0) > 0
        );

        if (loggedSets.length > 0) {
          const perf: LastPerformanceRecord = {
            workoutDate: w.finishedAt || w.startedAt,
            sets: loggedSets,
          };

          const instanceKey = `${ex.exerciseId}_${ex.order}`;
          map[instanceKey] = perf;

          if (!map[ex.exerciseId]) {
            map[ex.exerciseId] = perf;
          }
          break; // Found the most recent performance for this exercise instance
        }
      }
    }
  }

  return map;
}

/**
 * Selects the representative top working set from an exercise's most recent
 * historical session and formats a compact progressive-overload nudge badge
 * (e.g. "Last: 80 kg × 8" or "Last: BW × 12"). Returns null when no valid set exists.
 */
export function computeBestLastSetNudge(
  lastPerformance?: LastPerformanceRecord | null
): ProgressiveOverloadNudge | null {
  if (!lastPerformance || !Array.isArray(lastPerformance.sets) || lastPerformance.sets.length === 0) {
    return null;
  }

  // Exclude treadmill cardio sets from strength progressive overload nudges
  if (
    lastPerformance.sets.some(
      (s) => s.inclinePercent !== undefined || s.speedKph !== undefined || s.durationSeconds !== undefined
    )
  ) {
    return null;
  }

  const validSets = lastPerformance.sets.filter(
    (s) => (s.weight ?? 0) > 0 || (s.reps ?? 0) > 0
  );
  if (validSets.length === 0) return null;

  const workingSets = validSets.filter((s) => s.setType !== 'warmup');
  const candidates = workingSets.length > 0 ? workingSets : validSets;

  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    const cur = candidates[i];
    const curWeight = cur.weight ?? 0;
    const bestWeight = best.weight ?? 0;
    const curReps = cur.reps ?? 0;
    const bestReps = best.reps ?? 0;

    if (curWeight > bestWeight || (curWeight === bestWeight && curReps > bestReps)) {
      best = cur;
    }
  }

  const weight = best.weight ?? 0;
  const reps = best.reps ?? 0;
  if (weight <= 0 && reps <= 0) return null;

  const label = weight > 0 ? `Best Last: ${weight} kg × ${reps}` : `Best Last: BW × ${reps}`;
  return {
    weight,
    reps,
    date: lastPerformance.workoutDate,
    label,
  };
}

/**
 * Builds a lightweight exerciseId -> ProgressiveOverloadNudge lookup map in one pass
 * over the user's completed workout history (newest completed workout wins per exerciseId).
 */
export function buildProgressiveOverloadMap(
  completedWorkouts: WorkoutSession[],
  currentSessionId?: string
): Record<string, ProgressiveOverloadNudge> {
  const map: Record<string, ProgressiveOverloadNudge> = {};
  if (!Array.isArray(completedWorkouts) || completedWorkouts.length === 0) return map;

  const sortedCompleted = [...completedWorkouts]
    .filter((w) => w.id !== currentSessionId && (w.status === 'completed' || Boolean(w.finishedAt)))
    .sort((a, b) => getWorkoutTimestampMs(b) - getWorkoutTimestampMs(a));

  for (const workout of sortedCompleted) {
    if (!Array.isArray(workout.exercises) || workout.exercises.length === 0) continue;
    const workoutDate = workout.finishedAt || workout.startedAt;

    for (const ex of workout.exercises) {
      if (!hasValidExerciseId(ex.exerciseId) || ex.trackingMode === 'treadmill') continue;
      const exKey = ex.exerciseId.trim();
      if (map[exKey]) continue;

      const loggedSets = (ex.actualSets || []).filter(
        (s) => s.completed || (s.weight ?? 0) > 0 || (s.reps ?? 0) > 0
      );
      if (loggedSets.length === 0) continue;

      const nudge = computeBestLastSetNudge({ workoutDate, sets: loggedSets });
      if (nudge) {
        map[exKey] = nudge;
      }
    }
  }

  return map;
}
