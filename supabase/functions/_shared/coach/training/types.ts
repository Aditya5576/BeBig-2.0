
import { WorkoutSession } from '../../workout/types.ts';
import { PersonalRecord } from '../../workout/analytics.ts';

export interface ExerciseProgression {
  exerciseId: string;
  exerciseName: string;
  previousWeight: number;
  currentWeight: number;
  previousReps: number;
  currentReps: number;
  weightDelta: number; // current - previous
  weightDeltaPercent: number; // (weightDelta / previous) * 100
  repDelta: number; // current - previous
  improved: boolean;
  maintained: boolean;
  declined: boolean;
}

export interface MuscleGroupVolume {
  muscleGroup: string; // e.g. "chest", "biceps"
  totalSets: number;
  totalVolume: number; // kg
}

export interface WeeklySummary {
  workoutsCompleted: number;
  totalSets: number;
  totalVolume: number; // kg
  prCount: number;
  strongestImprovement: ExerciseProgression | null;
}

export interface TrainingContext {
  userId: string;
  profileSummary: { age?: number; weight?: number; height?: number; [key: string]: any };
  recentWorkouts: { id: string; name: string; startedAt: string; volume: number }[];
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  weeklyVolume: number;
  allTimeVolume: number;
  recentProgressions: ExerciseProgression[];
  personalRecords: PersonalRecord[];
  muscleGroupVolumes: MuscleGroupVolume[];
  weeklySummary: WeeklySummary;
}
