/**
 * BeBig 2.0 — Workout Execution Domain Models
 *
 * Strongly-typed definitions for live workout sessions, exercises, sets,
 * rest countdown timers, and completed workout records.
 * Actual performance is decoupled from template planning targets.
 */

import { OwnerType } from '../auth';

export interface WorkoutSet {
  id: string;
  setNumber: number;
  weight: number; // kg, supports decimals (e.g. 62.5)
  reps: number; // positive whole integer (e.g. 8)
  rir?: number; // Reps In Reserve (0 to 10)
  notes?: string; // optional user notes
  completed: boolean;
  completedAt?: string; // ISO 8601 timestamp
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  categoryName?: string;
  order: number;
  // Preserved snapshot of planned targets from template (if any)
  plannedSets?: number;
  plannedTargetReps?: string;
  plannedRestTime?: number;
  plannedTargetWeight?: number;
  // Actual sets logged during the active workout session
  actualSets: WorkoutSet[];
}

export interface ActiveRestTimer {
  exerciseId: string;
  exerciseName?: string;
  setNumber: number;
  targetEndTime: number; // Epoch milliseconds (Date.now() + restSeconds * 1000)
  durationSeconds: number;
}

export interface WorkoutSession {
  id: string;
  ownerId?: string;
  ownerType?: OwnerType;
  name: string;
  sourceTemplateId?: string;
  startedAt: string; // ISO 8601
  finishedAt?: string; // ISO 8601
  status: 'active' | 'completed';
  exercises: WorkoutExercise[];
  totalDuration?: number; // Total duration in seconds
  totalVolume?: number; // Total volume in kg (sum of weight * reps for completed sets)
  completedSetsCount?: number;
  activeRestTimer?: ActiveRestTimer | null;
}
