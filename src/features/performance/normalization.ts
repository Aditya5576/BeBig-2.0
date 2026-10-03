/**
 * BeBig 2.0 — Performance Intelligence Normalization & Validation (PERF-5A Data Foundation)
 *
 * Consumes raw or historical completed workout data safely without modifying workout storage.
 * Handles missing exercise IDs, empty sets, invalid weights/reps, duplicate set numbers, and malformed inputs.
 */

import { SetPerformance, ExercisePerformanceSnapshot } from './types';
import {
  calculateSetVolume,
  calculateTotalVolume,
  calculateTotalReps,
  calculateTopWeight,
  calculateTopWeightReps,
  calculateBestSet,
} from './calculations';

/**
 * Safely normalizes a raw set input into a clean SetPerformance model.
 * Returns null if the set data is malformed (e.g. invalid weight or reps).
 * Ignores RIR completely.
 */
export function normalizeSetPerformance(
  rawSet: unknown,
  fallbackSetNumber: number = 1,
): SetPerformance | null {
  if (!rawSet || typeof rawSet !== 'object') {
    return null;
  }

  const s = rawSet as Record<string, unknown>;

  // Validate weight
  const rawWeight = typeof s.weight === 'number' ? s.weight : typeof s.weight === 'string' ? parseFloat(s.weight) : NaN;
  if (isNaN(rawWeight) || !isFinite(rawWeight) || rawWeight < 0) {
    return null;
  }

  // Validate reps
  const rawReps = typeof s.reps === 'number' ? s.reps : typeof s.reps === 'string' ? parseInt(s.reps, 10) : NaN;
  if (isNaN(rawReps) || !isFinite(rawReps) || rawReps < 0) {
    return null;
  }

  // Set number fallback
  const rawSetNumber =
    typeof s.setNumber === 'number' && !isNaN(s.setNumber) && s.setNumber > 0
      ? Math.floor(s.setNumber)
      : fallbackSetNumber;

  // Completed status (default to true if set is logged in a completed workout with valid reps)
  const completed = typeof s.completed === 'boolean' ? s.completed : true;

  const weight = Math.round(rawWeight * 100) / 100;
  const reps = Math.floor(rawReps);
  const volume = calculateSetVolume(weight, reps);
  const completedAt = typeof s.completedAt === 'string' && s.completedAt.trim() ? s.completedAt : undefined;

  return {
    setNumber: rawSetNumber,
    weight,
    reps,
    volume,
    completed,
    completedAt,
  };
}

/**
 * Safely normalizes an exercise within a completed workout session.
 * Returns null if essential identifiers (exerciseId) are missing or invalid.
 */
export function normalizeExercisePerformance(
  rawExercise: unknown,
  rawSession: unknown,
): ExercisePerformanceSnapshot | null {
  if (!rawExercise || typeof rawExercise !== 'object') {
    return null;
  }

  const ex = rawExercise as Record<string, unknown>;
  const sess = (rawSession && typeof rawSession === 'object' ? rawSession : {}) as Record<string, unknown>;

  // Exercise ID is mandatory
  const exerciseId = typeof ex.exerciseId === 'string' && ex.exerciseId.trim() ? ex.exerciseId.trim() : '';
  if (!exerciseId) {
    return null;
  }

  // Exercise Name
  const exerciseName =
    typeof ex.exerciseName === 'string' && ex.exerciseName.trim()
      ? ex.exerciseName.trim()
      : 'Unnamed Exercise';

  const categoryName =
    typeof ex.categoryName === 'string' && ex.categoryName.trim() ? ex.categoryName.trim() : undefined;

  // Session information
  const sessionId = typeof sess.id === 'string' && sess.id.trim() ? sess.id.trim() : 'session_unknown';
  const sessionName = typeof sess.name === 'string' && sess.name.trim() ? sess.name.trim() : 'Workout Session';
  const sessionDate =
    typeof sess.finishedAt === 'string' && sess.finishedAt.trim()
      ? sess.finishedAt.trim()
      : typeof sess.startedAt === 'string' && sess.startedAt.trim()
      ? sess.startedAt.trim()
      : new Date().toISOString();

  // Normalize sets array
  const rawSets = Array.isArray(ex.actualSets) ? ex.actualSets : Array.isArray(ex.sets) ? ex.sets : [];
  const normalizedSets: SetPerformance[] = [];

  rawSets.forEach((rawSet, index) => {
    const norm = normalizeSetPerformance(rawSet, index + 1);
    if (norm && norm.completed) {
      normalizedSets.push(norm);
    }
  });

  // Re-index setNumbers sequentially to handle duplicate or zero set numbers gracefully
  normalizedSets.forEach((set, index) => {
    set.setNumber = index + 1;
  });

  // Calculate deterministic metrics
  const totalSets = normalizedSets.length;
  const totalReps = calculateTotalReps(normalizedSets);
  const totalVolume = calculateTotalVolume(normalizedSets);
  const topWeight = calculateTopWeight(normalizedSets);
  const topWeightReps = calculateTopWeightReps(normalizedSets);
  const bestSet = calculateBestSet(normalizedSets);

  const sourceTemplateId =
    typeof sess.sourceTemplateId === 'string' && sess.sourceTemplateId.trim()
      ? sess.sourceTemplateId.trim()
      : undefined;

  const sourceScheduledWorkoutId =
    typeof sess.sourceScheduledWorkoutId === 'string' && sess.sourceScheduledWorkoutId.trim()
      ? sess.sourceScheduledWorkoutId.trim()
      : undefined;

  return {
    exerciseId,
    exerciseName,
    categoryName,
    sessionId,
    sessionName,
    sessionDate,
    sets: normalizedSets,
    totalSets,
    totalReps,
    totalVolume,
    topWeight,
    topWeightReps,
    bestSet,
    sourceTemplateId,
    sourceScheduledWorkoutId,
  };
}

/**
 * Normalizes all exercises within a raw WorkoutSession.
 */
export function extractExercisePerformances(rawSession: unknown): ExercisePerformanceSnapshot[] {
  if (!rawSession || typeof rawSession !== 'object') {
    return [];
  }

  const sess = rawSession as Record<string, unknown>;
  const rawExercises = Array.isArray(sess.exercises) ? sess.exercises : [];

  const snapshots: ExercisePerformanceSnapshot[] = [];
  for (const rawEx of rawExercises) {
    const snapshot = normalizeExercisePerformance(rawEx, sess);
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}
