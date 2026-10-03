/**
 * BeBig 2.0 — Performance Intelligence Domain Types (PERF-5A, PERF-5B, PERF-5C, PERF-5D)
 *
 * Normalized representation of exercise performance extracted from completed workouts.
 * Strictly decoupled from template planning targets, live logging state, and RIR.
 */

export interface SetPerformance {
  setNumber: number;
  weight: number; // kg, supports decimals (e.g. 62.5)
  reps: number; // non-negative integer (e.g. 10)
  volume: number; // weight × reps (e.g. 625)
  completed: boolean;
  completedAt?: string; // ISO 8601 timestamp
}

export interface ExercisePerformanceSnapshot {
  exerciseId: string;
  exerciseName: string;
  categoryName?: string;
  sessionId: string;
  sessionName: string;
  sessionDate: string; // ISO 8601 timestamp (workout finishedAt or startedAt)
  sets: SetPerformance[];
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  topWeight: number;
  topWeightReps: number;
  bestSet: SetPerformance | null;
  sourceTemplateId?: string;
  sourceScheduledWorkoutId?: string;
}

export interface SetComparisonItem {
  setNumber: number;
  currentSet: SetPerformance | null;
  previousSet: SetPerformance | null;
  weightChange: number | null;
  repChange: number | null;
  status: 'increased' | 'decreased' | 'no_change' | 'new_set' | 'removed_set';
  displayText: string;
}

export interface PerformanceComparison {
  exerciseId: string;
  exerciseName: string;
  currentSnapshot: ExercisePerformanceSnapshot;
  previousSnapshot: ExercisePerformanceSnapshot | null;
  hasPreviousPerformance: boolean;

  // Weight changes (top weight)
  weightChange: number | null;
  weightChangePercent: number | null;

  // Rep changes (at top weight)
  repChange: number | null;
  repChangePercent: number | null;

  // Total exercise volume changes
  volumeChange: number | null;
  volumeChangePercent: number | null;

  // Explicit top-set context fields (aliases for clarity in downstream engines)
  topWeightChange: number | null;
  topWeightChangePercent: number | null;
  topWeightRepChange: number | null;
}

export interface PerformancePRResult {
  exerciseId: string;
  exerciseName: string;
  currentSnapshot: ExercisePerformanceSnapshot;
  hasHistory: boolean;

  // Weight PR
  currentTopWeight: number;
  previousBestTopWeight: number | null;
  weightIncrease: number | null;
  isWeightPR: boolean;

  // Rep PR
  currentBestReps: number;
  previousBestReps: number | null;
  repIncrease: number | null;
  isRepPR: boolean;

  // Volume PR
  currentTotalVolume: number;
  previousBestVolume: number | null;
  volumeIncrease: number | null;
  isVolumePR: boolean;

  // Aggregate flag
  hasAnyPR: boolean;
}

export type PerformanceClassificationType =
  | 'weight_progression'
  | 'rep_progression'
  | 'combined_progression'
  | 'volume_progression'
  | 'maintained'
  | 'recent_drop'
  | 'possible_plateau';

export interface PerformanceClassification {
  classification: PerformanceClassificationType;
  confidenceReason: string;
  currentSnapshot: ExercisePerformanceSnapshot;
  previousSnapshot: ExercisePerformanceSnapshot | null;
  comparison: PerformanceComparison | null;
  supportingFacts: string[];
}
