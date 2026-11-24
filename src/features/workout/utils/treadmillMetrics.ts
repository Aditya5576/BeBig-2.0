/**
 * BeBig 2.0 — Treadmill Metrics & Formatting Engine
 *
 * Pure, deterministic calculation utilities for Treadmill cardio exercises:
 * - Identification helpers (isTreadmillExercise, isStrengthExercise)
 * - Duration formatting (seconds -> mm:ss or hh:mm:ss)
 * - Distance calculation: Distance (km) = (Speed * Duration) / 3600
 * - Human-readable set formatting (e.g. "5% @ 8 km/h • 12:30")
 * - Exercise and session level aggregate totals
 */

import { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { normalizeTrackingMode } from '../../exercises/exerciseTracking';

/**
 * Returns true if the exercise is marked with 'treadmill' tracking mode.
 */
export function isTreadmillExercise(
  exercise?: { trackingMode?: string } | null
): boolean {
  return normalizeTrackingMode(exercise?.trackingMode) === 'treadmill';
}

/**
 * Returns true if the exercise is a standard strength exercise.
 */
export function isStrengthExercise(
  exercise?: { trackingMode?: string } | null
): boolean {
  return !isTreadmillExercise(exercise);
}

/**
 * Formats a duration in seconds into 'mm:ss' or 'hh:mm:ss' (e.g. 750 -> "12:30").
 */
export function formatTreadmillDuration(totalSeconds?: number | null): string {
  if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds) || totalSeconds <= 0) {
    return '0:00';
  }
  const s = Math.round(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Calculates distance in km from speed (km/h) and duration (seconds):
 * Distance (km) = (Speed * Duration) / 3600
 */
export function calculateTreadmillDistanceKm(
  speedKph?: number | null,
  durationSeconds?: number | null
): number {
  if (
    typeof speedKph !== 'number' ||
    isNaN(speedKph) ||
    speedKph <= 0 ||
    typeof durationSeconds !== 'number' ||
    isNaN(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return 0;
  }
  const distance = (speedKph * durationSeconds) / 3600;
  return Math.round(distance * 100) / 100;
}

/**
 * Formats a treadmill set as:
 * "{incline}% @ {speed} km/h • {time}" (e.g. "5% @ 8 km/h • 12:30" or "0% @ 6.5 km/h • 10:00")
 */
export function formatTreadmillSet(
  set: Partial<WorkoutSet> | null | undefined,
  compact = false
): string {
  if (!set) return '';
  const incline = set.inclinePercent !== undefined ? `${set.inclinePercent}%` : '0%';
  const speed = set.speedKph !== undefined && set.speedKph > 0 ? `${set.speedKph} km/h` : '0 km/h';
  const time = formatTreadmillDuration(set.durationSeconds);
  if (compact) {
    return `${incline} • ${speed} • ${time}`;
  }
  return `${incline} @ ${speed} • ${time}`;
}

/**
 * Calculates aggregate totals for completed treadmill sets in an exercise.
 */
export function calculateTreadmillExerciseTotals(exercise: WorkoutExercise): {
  totalDurationSeconds: number;
  totalDistanceKm: number;
  completedSetsCount: number;
} {
  if (!exercise || !Array.isArray(exercise.actualSets)) {
    return { totalDurationSeconds: 0, totalDistanceKm: 0, completedSetsCount: 0 };
  }
  let totalDurationSeconds = 0;
  let totalDistanceKm = 0;
  let completedSetsCount = 0;

  for (const set of exercise.actualSets) {
    if (set && set.completed) {
      completedSetsCount++;
      const dur = typeof set.durationSeconds === 'number' && set.durationSeconds > 0 ? set.durationSeconds : 0;
      const spd = typeof set.speedKph === 'number' && set.speedKph > 0 ? set.speedKph : 0;
      totalDurationSeconds += dur;
      totalDistanceKm += calculateTreadmillDistanceKm(spd, dur);
    }
  }

  return {
    totalDurationSeconds,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    completedSetsCount,
  };
}

/**
 * Calculates the total treadmill duration (in seconds) across all completed sets in a workout.
 */
export function calculateWorkoutTreadmillDuration(workout?: WorkoutSession | null): number {
  if (!workout || !Array.isArray(workout.exercises)) return 0;
  let totalSeconds = 0;
  for (const ex of workout.exercises) {
    if (isTreadmillExercise(ex)) {
      for (const set of ex.actualSets || []) {
        if (set && set.completed && typeof set.durationSeconds === 'number' && set.durationSeconds > 0) {
          totalSeconds += set.durationSeconds;
        }
      }
    }
  }
  return totalSeconds;
}
