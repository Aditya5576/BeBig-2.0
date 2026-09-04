/**
 * BeBig 2.0 — Workout Template Domain Models
 *
 * Strongly-typed definitions for planning workout templates and exercises.
 * Template target values are planning values only; future execution logging
 * will record actual sets/reps/weight independently.
 */

import { OwnerType } from '../auth';

export interface TemplateExercise {
  exerciseId: string;
  exerciseName: string;
  categoryName?: string;
  order: number;
  sets: number;
  targetReps: string; // e.g. "8", "8-10", "10-12"
  restTime: number; // rest interval in seconds, e.g. 90, 120
  targetWeight?: number; // planning target weight in kg, e.g. 62.5
}

export interface WorkoutTemplate {
  id: string;
  ownerId?: string;
  ownerType?: OwnerType;
  name: string;
  exercises: TemplateExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  exercises: Omit<TemplateExercise, 'order'>[];
}

export interface UpdateTemplateInput {
  id: string;
  name?: string;
  exercises?: Omit<TemplateExercise, 'order'>[];
}
