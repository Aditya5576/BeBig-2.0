/**
 * BeBig 2.0 — Workout Execution Domain Models
 *
 * Strongly-typed definitions for live workout sessions, exercises, sets,
 * rest countdown timers, and completed workout records.
 * Actual performance is decoupled from template planning targets.
 */

import { OwnerType } from '../auth';
import { ExerciseTrackingMode } from '../exercises/exerciseTracking';
export type { ExerciseTrackingMode };

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  id: string;
  setNumber: number;
  weight: number; // kg, supports decimals (e.g. 62.5, 0 on treadmill)
  reps: number; // positive whole integer (e.g. 8, 0 on treadmill)
  rir?: number; // Reps In Reserve (0 to 10)
  setType?: SetType; // 'normal' | 'warmup' | 'drop' | 'failure' (defaults to 'normal')
  notes?: string; // optional user notes
  inclinePercent?: number; // Incline percentage 0–50% (0 is a valid defined value!)
  speedKph?: number; // Speed in km/h > 0–40 (e.g. 8.5)
  durationSeconds?: number; // Time in seconds 1–86400 (e.g. 750 for 12:30)
  completed: boolean;
  completedAt?: string; // ISO 8601 timestamp
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  categoryName?: string;
  order: number;
  trackingMode?: ExerciseTrackingMode;
  supersetGroupId?: string | null; // null/undefined for standalone; shared string for contiguous Superset (2) or Giant Set (3+)
  // Preserved snapshot of planned targets from template (if any)
  plannedSets?: number;
  plannedTargetReps?: string;
  plannedRestTime?: number;
  plannedTargetWeight?: number;
  plannedTargetInclinePercent?: number;
  plannedTargetSpeedKph?: number;
  plannedTargetDurationSeconds?: number;
  // Actual sets logged during the active workout session
  actualSets: WorkoutSet[];
}

export interface ActiveRestTimer {
  exerciseId: string;
  exerciseName?: string;
  setNumber: number;
  targetEndTime: number; // Epoch milliseconds (Date.now() + restSeconds * 1000)
  durationSeconds: number;
  isPaused?: boolean;
  pausedRemainingSeconds?: number;
}

export interface WorkoutSession {
  id: string;
  ownerId?: string;
  ownerType?: OwnerType;
  name: string;
  sourceTemplateId?: string;
  sourceScheduledWorkoutId?: string;
  startedAt: string; // ISO 8601
  finishedAt?: string; // ISO 8601
  status: 'active' | 'completed';
  exercises: WorkoutExercise[];
  totalDuration?: number; // Total duration in seconds
  totalVolume?: number; // Total volume in kg (sum of weight * reps for completed sets)
  completedSetsCount?: number;
  activeRestTimer?: ActiveRestTimer | null;
  pausedAt?: string | null; // ISO 8601 when the session was minimized/paused
  accumulatedPauseSeconds?: number; // Total seconds spent paused
  updatedAt?: string; // ISO 8601 timestamp of last state change
  version?: number; // Monotonically increasing revision counter for optimistic concurrency guard
  revision?: number; // Monotonically increasing revision counter (alias for optimistic concurrency guard)
}
