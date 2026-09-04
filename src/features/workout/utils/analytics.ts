/**
 * BeBig 2.0 — Workout Analytics Engine
 *
 * Pure, deterministic calculation utilities for aggregating live workout data:
 * - Workouts this week (Monday 00:00:00 to Sunday 23:59:59)
 * - Workouts this month (1st of month 00:00:00 to end of month)
 * - Weekly & all-time volume (tonnage in kg)
 * - Active day streak calculation with yesterday grace period
 * - Personal Record (PR) tracking per exercise
 * - Weekly workout goal progress
 * - Smart template rotation for Today's Workout
 * - Time-aware athletic greeting
 */

import { WorkoutSession } from '../types';
import { WorkoutTemplate } from '../../templates/types';

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  reps: number;
  achievedAt?: string;
}

export interface DashboardAnalytics {
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  weeklyVolume: number;
  allTimeVolume: number;
  currentStreakDays: number;
  totalPRsCount: number;
  topPRs: PersonalRecord[];
  targetDaysPerWeek: number;
  weeklyGoalPercent: number;
  suggestedTemplate: WorkoutTemplate | null;
}

/**
 * Returns Monday 00:00:00.000 of the week for the given date in local time.
 */
export function getStartOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = (day + 6) % 7; // Monday = 0, Tuesday = 1... Sunday = 6
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the 1st day 00:00:00.000 of the month for the given date in local time.
 */
export function getStartOfMonth(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Converts a Date to YYYY-MM-DD string in local time.
 */
export function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates number of completed workouts during the current week (starting Monday 00:00:00).
 */
export function calculateWeeklyWorkouts(
  workouts: WorkoutSession[],
  now: Date = new Date(),
): number {
  if (!workouts || workouts.length === 0) return 0;
  const startOfWeek = getStartOfWeek(now).getTime();
  return workouts.filter((w) => {
    const timestamp = new Date(w.startedAt).getTime();
    return !isNaN(timestamp) && timestamp >= startOfWeek;
  }).length;
}

/**
 * Calculates number of completed workouts during the current calendar month.
 */
export function calculateMonthlyWorkouts(
  workouts: WorkoutSession[],
  now: Date = new Date(),
): number {
  if (!workouts || workouts.length === 0) return 0;
  const startOfMonth = getStartOfMonth(now).getTime();
  return workouts.filter((w) => {
    const timestamp = new Date(w.startedAt).getTime();
    return !isNaN(timestamp) && timestamp >= startOfMonth;
  }).length;
}

/**
 * Calculates total volume tonnage (kg) logged for completed workouts this week.
 */
export function calculateWeeklyVolume(workouts: WorkoutSession[], now: Date = new Date()): number {
  if (!workouts || workouts.length === 0) return 0;
  const startOfWeek = getStartOfWeek(now).getTime();
  let total = 0;
  for (const w of workouts) {
    const timestamp = new Date(w.startedAt).getTime();
    if (!isNaN(timestamp) && timestamp >= startOfWeek) {
      total += typeof w.totalVolume === 'number' && !isNaN(w.totalVolume) ? w.totalVolume : 0;
    }
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calculates all-time total volume tonnage (kg) logged across all completed workouts.
 */
export function calculateAllTimeVolume(workouts: WorkoutSession[]): number {
  if (!workouts || workouts.length === 0) return 0;
  let total = 0;
  for (const w of workouts) {
    total += typeof w.totalVolume === 'number' && !isNaN(w.totalVolume) ? w.totalVolume : 0;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calculates the current consecutive active workout days streak.
 * - Deduplicates multiple workouts on the same calendar day.
 * - If user worked out today, streak includes today.
 * - If user worked out yesterday (and not yet today), streak remains active.
 * - If neither today nor yesterday has a workout, streak is 0.
 */
export function calculateWorkoutStreak(workouts: WorkoutSession[], now: Date = new Date()): number {
  if (!workouts || workouts.length === 0) return 0;

  // Extract unique calendar dates in local time
  const datesSet = new Set<string>();
  for (const w of workouts) {
    const d = new Date(w.startedAt);
    if (!isNaN(d.getTime())) {
      datesSet.add(toLocalDateString(d));
    }
  }

  if (datesSet.size === 0) return 0;

  const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  const todayStr = toLocalDateString(now);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterdayDate);

  const newestWorkoutDate = sortedDates[0];

  // If newest workout was neither today nor yesterday, streak is broken
  if (newestWorkoutDate !== todayStr && newestWorkoutDate !== yesterdayStr) {
    return 0;
  }

  // Count backwards day by day from newestWorkoutDate
  const currentTracker = new Date(newestWorkoutDate + 'T12:00:00');
  let streak = 0;

  while (true) {
    const checkStr = toLocalDateString(currentTracker);
    if (datesSet.has(checkStr)) {
      streak++;
      currentTracker.setDate(currentTracker.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Computes Personal Records (PRs) across all completed workouts.
 * Finds the max weight lifted for each exercise on any completed set with weight > 0 and reps > 0.
 */
export function calculatePersonalRecords(workouts: WorkoutSession[]): {
  totalPRsCount: number;
  topPRs: PersonalRecord[];
  allPRs: PersonalRecord[];
} {
  if (!workouts || workouts.length === 0) {
    return { totalPRsCount: 0, topPRs: [], allPRs: [] };
  }

  const prMap = new Map<string, PersonalRecord>();

  for (const workout of workouts) {
    if (!workout.exercises) continue;
    for (const ex of workout.exercises) {
      if (!ex.exerciseId || !ex.actualSets) continue;
      for (const set of ex.actualSets) {
        if (set.completed && typeof set.weight === 'number' && set.weight > 0 && set.reps > 0) {
          const existing = prMap.get(ex.exerciseId);
          if (!existing || set.weight > existing.maxWeight) {
            prMap.set(ex.exerciseId, {
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName || 'Exercise',
              maxWeight: set.weight,
              reps: set.reps,
              achievedAt: set.completedAt || workout.finishedAt || workout.startedAt,
            });
          }
        }
      }
    }
  }

  const records = Array.from(prMap.values());
  records.sort((a, b) => b.maxWeight - a.maxWeight);

  return {
    totalPRsCount: records.length,
    topPRs: records.slice(0, 3),
    allPRs: records,
  };
}

/**
 * Computes weekly goal progress percentage.
 */
export function calculateWeeklyGoalProgress(
  workoutsThisWeek: number,
  targetDaysPerWeek: number,
): { targetDays: number; percent: number } {
  const targetDays =
    typeof targetDaysPerWeek === 'number' && targetDaysPerWeek > 0 ? targetDaysPerWeek : 4;
  const percent = Math.min(100, Math.round((workoutsThisWeek / targetDays) * 100));
  return { targetDays, percent };
}

/**
 * Recommends the next workout template based on previous workout history.
 * Cycles to the next template after the most recently completed routine.
 */
export function getSuggestedTodayWorkout(
  templates: WorkoutTemplate[],
  workouts: WorkoutSession[],
): WorkoutTemplate | null {
  if (!templates || templates.length === 0) return null;
  if (!workouts || workouts.length === 0) return templates[0];

  // Find the most recent workout that had a source template
  for (const workout of workouts) {
    if (workout.sourceTemplateId) {
      const idx = templates.findIndex((t) => t.id === workout.sourceTemplateId);
      if (idx !== -1) {
        return templates[(idx + 1) % templates.length];
      }
    }
  }

  return templates[0];
}

/**
 * Returns an athletic, time-aware greeting based on local hour.
 */
export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning 👋';
  if (hour < 17) return 'Good afternoon 👋';
  return 'Good evening 👋';
}

export * from './formatters';

/**
 * Master aggregation function computing all dashboard metrics in a single pass.
 */
export function calculateDashboardAnalytics(
  workouts: WorkoutSession[],
  targetDaysPerWeek: number,
  templates: WorkoutTemplate[],
  now: Date = new Date(),
): DashboardAnalytics {
  const workoutsThisWeek = calculateWeeklyWorkouts(workouts, now);
  const workoutsThisMonth = calculateMonthlyWorkouts(workouts, now);
  const weeklyVolume = calculateWeeklyVolume(workouts, now);
  const allTimeVolume = calculateAllTimeVolume(workouts);
  const currentStreakDays = calculateWorkoutStreak(workouts, now);
  const { totalPRsCount, topPRs } = calculatePersonalRecords(workouts);
  const { targetDays, percent: weeklyGoalPercent } = calculateWeeklyGoalProgress(
    workoutsThisWeek,
    targetDaysPerWeek,
  );
  const suggestedTemplate = getSuggestedTodayWorkout(templates, workouts);

  return {
    workoutsThisWeek,
    workoutsThisMonth,
    weeklyVolume,
    allTimeVolume,
    currentStreakDays,
    totalPRsCount,
    topPRs,
    targetDaysPerWeek: targetDays,
    weeklyGoalPercent,
    suggestedTemplate,
  };
}

/**
 * Represents a single workout session's performance for a specific exercise.
 */
export interface ExerciseHistoryEntry {
  workoutId: string;
  workoutName: string;
  date: string; // ISO 8601 timestamp (startedAt of the session)
  maxWeight: number; // Highest weight in any completed set this session
  totalReps: number; // Total completed reps across all sets this session
  volume: number; // Sum of (weight * reps) for all completed sets this session
  sets: {
    setNumber: number;
    weight: number;
    reps: number;
    rir: number;
  }[];
}

/**
 * Returns a chronological history (oldest-first) of an exercise across completed workouts.
 * Only includes sessions where the exercise was actually performed with completed sets.
 */
export function getExerciseHistory(
  workouts: WorkoutSession[],
  exerciseId: string,
): ExerciseHistoryEntry[] {
  if (!workouts || workouts.length === 0 || !exerciseId) return [];

  const entries: ExerciseHistoryEntry[] = [];

  for (const workout of workouts) {
    if (!workout.exercises) continue;

    const exercise = workout.exercises.find((ex) => ex.exerciseId === exerciseId);
    if (!exercise || !exercise.actualSets) continue;

    const completedSets = exercise.actualSets.filter((s) => s.completed && s.reps > 0);
    if (completedSets.length === 0) continue;

    const maxWeight = completedSets.reduce(
      (max, s) => (s.weight > max ? s.weight : max),
      completedSets[0].weight,
    );
    const totalReps = completedSets.reduce((sum, s) => sum + s.reps, 0);
    const volume = completedSets.reduce(
      (sum, s) => sum + (s.weight > 0 ? s.weight * s.reps : 0),
      0,
    );

    entries.push({
      workoutId: workout.id,
      workoutName: workout.name,
      date: workout.startedAt,
      maxWeight,
      totalReps,
      volume: Math.round(volume * 100) / 100,
      sets: completedSets.map((s) => ({
        setNumber: s.setNumber,
        weight: s.weight,
        reps: s.reps,
        rir: s.rir,
      })),
    });
  }

  // Return oldest-first so progression charts/tables read naturally
  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Returns a deduplicated list of all exercises ever performed across completed workouts.
 * Sorted alphabetically by exercise name.
 */
export function getAllExercisesFromHistory(
  workouts: WorkoutSession[],
): { exerciseId: string; exerciseName: string }[] {
  if (!workouts || workouts.length === 0) return [];

  const map = new Map<string, string>(); // exerciseId -> exerciseName

  for (const workout of workouts) {
    if (!workout.exercises) continue;
    for (const ex of workout.exercises) {
      if (!ex.exerciseId) continue;
      const completedSets = ex.actualSets?.filter((s) => s.completed && s.reps > 0) ?? [];
      if (completedSets.length > 0 && !map.has(ex.exerciseId)) {
        map.set(ex.exerciseId, ex.exerciseName || 'Unknown Exercise');
      }
    }
  }

  return Array.from(map.entries())
    .map(([exerciseId, exerciseName]) => ({ exerciseId, exerciseName }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
