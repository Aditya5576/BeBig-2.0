/**
 * BeBig 2.0 — Weekly Performance Summary Engine (PERF-5G)
 *
 * Pure, deterministic factual calculation engine comparing the current calendar week's
 * exercise performances against their previous occurrences.
 *
 * Pure mathematics and factual aggregation only. Zero 1RM, zero estimated scores,
 * zero percentage scores, zero AI analysis, zero RIR scoring, zero arbitrary rankings.
 */

import { WorkoutSession } from '../workout';
import {
  ExercisePerformanceSnapshot,
  SetComparisonItem,
  extractExercisePerformances,
  findPreviousPerformance,
  compareExerciseSets,
} from './index';

export interface CalendarWeekInfo {
  start: Date;
  end: Date;
  label: string;
}

export interface WeeklyActivityStats {
  workouts: number;
  exercises: number;
  sets: number;
}

export interface WeeklySetChangesAggregation {
  weightIncreased: number;
  weightDecreased: number;
  repsIncreased: number;
  repsDecreased: number;
  newSets: number;
  removedSets: number;
}

export interface WeeklyExerciseChange {
  exerciseId: string;
  exerciseName: string;
  status: 'progressed' | 'maintained' | 'decreased' | 'mixed' | 'first_time';
  comparisons: SetComparisonItem[];
  previousSessionDate?: string;
  currentSessionDate?: string;
}

export interface WeeklyPerformanceSummary {
  currentWeek: CalendarWeekInfo;
  previousWeek: CalendarWeekInfo;
  activity: {
    current: WeeklyActivityStats;
    previous: WeeklyActivityStats | null;
  };
  summary: {
    progressed: number;
    maintained: number;
    decreased: number;
    mixed: number;
    firstTime: number;
    totalCompared: number;
  };
  setChanges: WeeklySetChangesAggregation;
  exerciseChanges: WeeklyExerciseChange[];
  hasCurrentWeekWorkouts: boolean;
  hasPreviousWeekWorkouts: boolean;
  hasHistoricalComparison: boolean;
}

/**
 * Returns Monday 00:00:00.000 -> Sunday 23:59:59.999 for a calendar week.
 */
export function getCalendarWeekRange(referenceDate: Date = new Date(), offsetWeeks = 0): CalendarWeekInfo {
  const d = new Date(referenceDate);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = (day === 0 ? -6 : 1 - day) + offsetWeeks * 7;

  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const endDay = end.getDate();

  const label =
    startMonth === endMonth ? `${startMonth} ${startDay} – ${endDay}` : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;

  return { start, end, label };
}

/**
 * Calculates factual weekly performance progression across calendar weeks.
 */
export function calculateWeeklyPerformance(
  allWorkouts: WorkoutSession[],
  referenceDate: Date = new Date(),
): WeeklyPerformanceSummary {
  const currentWeek = getCalendarWeekRange(referenceDate, 0);
  const previousWeek = getCalendarWeekRange(referenceDate, -1);

  const safeWorkouts = Array.isArray(allWorkouts) ? allWorkouts : [];

  // Filter completed workouts in current week and previous week
  const currentWeekWorkouts = safeWorkouts.filter((w) => {
    if (!w) return false;
    const dateStr = w.finishedAt || w.startedAt;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    return t >= currentWeek.start.getTime() && t <= currentWeek.end.getTime();
  });

  const previousWeekWorkouts = safeWorkouts.filter((w) => {
    if (!w) return false;
    const dateStr = w.finishedAt || w.startedAt;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    return t >= previousWeek.start.getTime() && t <= previousWeek.end.getTime();
  });

  // Calculate current week activity
  const currentUniqueExercises = new Set<string>();
  let currentTotalSets = 0;

  for (const w of currentWeekWorkouts) {
    for (const ex of w.exercises || []) {
      const completedSets = (ex.actualSets || []).filter((s) => s.completed);
      if (completedSets.length > 0) {
        currentUniqueExercises.add(ex.exerciseId);
        currentTotalSets += completedSets.length;
      }
    }
  }

  // Calculate previous week activity
  const prevUniqueExercises = new Set<string>();
  let prevTotalSets = 0;

  for (const w of previousWeekWorkouts) {
    for (const ex of w.exercises || []) {
      const completedSets = (ex.actualSets || []).filter((s) => s.completed);
      if (completedSets.length > 0) {
        prevUniqueExercises.add(ex.exerciseId);
        prevTotalSets += completedSets.length;
      }
    }
  }

  const activity = {
    current: {
      workouts: currentWeekWorkouts.length,
      exercises: currentUniqueExercises.size,
      sets: currentTotalSets,
    },
    previous:
      previousWeekWorkouts.length > 0
        ? {
            workouts: previousWeekWorkouts.length,
            exercises: prevUniqueExercises.size,
            sets: prevTotalSets,
          }
        : null,
  };

  // Build snapshot map from all completed workouts
  const snapshotsMap = new Map<string, ExercisePerformanceSnapshot[]>();
  for (const w of safeWorkouts) {
    const snaps = extractExercisePerformances(w);
    for (const s of snaps) {
      const list = snapshotsMap.get(s.exerciseId) || [];
      list.push(s);
      snapshotsMap.set(s.exerciseId, list);
    }
  }

  // Aggregate set-level changes and exercise progression
  const setChanges: WeeklySetChangesAggregation = {
    weightIncreased: 0,
    weightDecreased: 0,
    repsIncreased: 0,
    repsDecreased: 0,
    newSets: 0,
    removedSets: 0,
  };

  const exerciseChanges: WeeklyExerciseChange[] = [];

  let progressed = 0;
  let maintained = 0;
  let decreased = 0;
  let mixed = 0;
  let firstTime = 0;
  let totalCompared = 0;

  // Extract snapshots for current week workouts sorted chronologically
  const currentWeekSnapshots: ExercisePerformanceSnapshot[] = [];
  for (const w of currentWeekWorkouts) {
    currentWeekSnapshots.push(...extractExercisePerformances(w));
  }

  // Deduplicate by exercise (if an exercise was performed multiple times this week, aggregate or process latest)
  // Process each unique exercise performed in the current week
  const processedExerciseIds = new Set<string>();

  for (const currSnap of currentWeekSnapshots) {
    if (processedExerciseIds.has(currSnap.exerciseId)) continue;
    processedExerciseIds.add(currSnap.exerciseId);

    const historySnaps = snapshotsMap.get(currSnap.exerciseId) || [];
    const prevSnap = findPreviousPerformance(currSnap, historySnaps);

    if (!prevSnap) {
      firstTime++;
      exerciseChanges.push({
        exerciseId: currSnap.exerciseId,
        exerciseName: currSnap.exerciseName,
        status: 'first_time',
        comparisons: [],
        currentSessionDate: currSnap.sessionDate,
      });
      continue;
    }

    totalCompared++;
    const comps = compareExerciseSets(currSnap.sets, prevSnap.sets);

    let exHasIncrease = false;
    let exHasDecrease = false;

    for (const comp of comps) {
      if (comp.status === 'new_set') {
        setChanges.newSets++;
        exHasIncrease = true;
      } else if (comp.status === 'removed_set') {
        setChanges.removedSets++;
        exHasDecrease = true;
      } else {
        if (comp.weightChange !== null) {
          if (comp.weightChange > 0) {
            setChanges.weightIncreased++;
            exHasIncrease = true;
          } else if (comp.weightChange < 0) {
            setChanges.weightDecreased++;
            exHasDecrease = true;
          }
        }
        if (comp.repChange !== null) {
          if (comp.repChange > 0) {
            setChanges.repsIncreased++;
            exHasIncrease = true;
          } else if (comp.repChange < 0) {
            setChanges.repsDecreased++;
            exHasDecrease = true;
          }
        }
      }
    }

    let status: WeeklyExerciseChange['status'] = 'maintained';
    if (exHasIncrease && exHasDecrease) {
      status = 'mixed';
      mixed++;
    } else if (exHasIncrease) {
      status = 'progressed';
      progressed++;
    } else if (exHasDecrease) {
      status = 'decreased';
      decreased++;
    } else {
      status = 'maintained';
      maintained++;
    }

    exerciseChanges.push({
      exerciseId: currSnap.exerciseId,
      exerciseName: currSnap.exerciseName,
      status,
      comparisons: comps,
      previousSessionDate: prevSnap.sessionDate,
      currentSessionDate: currSnap.sessionDate,
    });
  }

  return {
    currentWeek,
    previousWeek,
    activity,
    summary: {
      progressed,
      maintained,
      decreased,
      mixed,
      firstTime,
      totalCompared,
    },
    setChanges,
    exerciseChanges,
    hasCurrentWeekWorkouts: currentWeekWorkouts.length > 0,
    hasPreviousWeekWorkouts: previousWeekWorkouts.length > 0,
    hasHistoricalComparison: totalCompared > 0,
  };
}
