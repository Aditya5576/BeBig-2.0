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
 * 1. If both records have valid exercise IDs, match STRICTLY by exercise ID.
 *    Never match different valid IDs even if their names are identical.
 * 2. If at least one record lacks a valid exercise ID (legacy data), match by
 *    normalized (trimmed, lowercased) exercise name.
 */
export function isExerciseMatch(target: WorkoutExercise, candidate: WorkoutExercise): boolean {
  const targetHasId = hasValidExerciseId(target.exerciseId);
  const candidateHasId = hasValidExerciseId(candidate.exerciseId);

  if (targetHasId && candidateHasId) {
    return target.exerciseId.trim() === candidate.exerciseId.trim();
  }

  // Fallback: only when at least one record lacks a valid ID
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
