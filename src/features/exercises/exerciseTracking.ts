/**
 * BeBig 2.0 — Canonical Exercise Tracking Modes
 *
 * Strongly-typed definition for execution and performance tracking modes.
 * - 'strength': Standard weight (kg) x reps x RIR tracking.
 * - 'treadmill': Specialized cardio tracking Incline (%) x Speed (km/h) x Time (seconds).
 *
 * Canonical ID 'seed-treadmill' guarantees instant offline treadmill tracking.
 * Detection must ALWAYS rely on trackingMode (never exercise name strings).
 */

export type ExerciseTrackingMode = 'strength' | 'treadmill';

export const TREADMILL_EXERCISE_ID = 'seed-treadmill';

/**
 * Normalizes an optional tracking mode into a guaranteed ExerciseTrackingMode.
 * Missing, empty, or unclassified tracking modes default strictly to 'strength'.
 */
export function normalizeTrackingMode(
  mode?: ExerciseTrackingMode | string | null
): ExerciseTrackingMode {
  if (mode === 'treadmill') {
    return 'treadmill';
  }
  return 'strength';
}

/**
 * Resolves the canonical tracking mode for any exercise object or partial specification.
 * - Resolves to 'treadmill' if:
 *   1. trackingMode is explicitly 'treadmill'
 *   2. id is TREADMILL_EXERCISE_ID ('seed-treadmill')
 *   3. Built-in system or catalog exercise named 'Treadmill' (case-insensitive) without explicit 'strength' override
 * - Otherwise defaults strictly to 'strength'.
 */
export function resolveExerciseTrackingMode(
  exercise?: {
    id?: string;
    name?: string;
    trackingMode?: ExerciseTrackingMode | string | null;
    sourceProvider?: string;
  } | null
): ExerciseTrackingMode {
  if (!exercise) return 'strength';
  if (exercise.trackingMode === 'treadmill') return 'treadmill';
  if (exercise.trackingMode === 'strength') return 'strength';
  if (exercise.id === TREADMILL_EXERCISE_ID) return 'treadmill';
  const name = (exercise.name || '').trim().toLowerCase();
  if (name === 'treadmill') {
    return 'treadmill';
  }
  return 'strength';
}
