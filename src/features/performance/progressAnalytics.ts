/**
 * BeBig 2.0 — Professional Workout Progress Analytics 2.0
 *
 * Comprehensive, pure, deterministic calculation engine powering
 * multi-period progress tracking, dynamic workout-focus intelligence,
 * exercise-level progressions, and training consistency benchmarks.
 *
 * Zero hallucinated metrics, zero arbitrary rankings, zero percentage fabrications.
 */

import { WorkoutSession } from '../workout/types';
import { extractExercisePerformances, ExercisePerformanceSnapshot } from './index';

export type AnalyticsPeriod = 'week' | 'month' | 'all_time';

export interface PeriodDateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface PeriodOverviewMetrics {
  period: AnalyticsPeriod;
  currentRange: PeriodDateRange;
  previousRange: PeriodDateRange | null;
  workoutCount: number;
  completedSetsCount: number;
  totalVolumeKg: number;
  activeDaysCount: number;
  prCount: number;

  comparison: {
    workoutDelta: number;
    setDelta: number;
    volumeDeltaKg: number;
    volumePercentDelta: number | null; // e.g. +14.5%
    hasPriorData: boolean;
  } | null;
}

export interface ExerciseSparkPoint {
  date: string;
  weight: number;
  reps: number;
  volume: number;
}

export interface FocusExerciseItem {
  exerciseId: string;
  exerciseName: string;
  categoryName?: string;
  sessionCount: number;
  status: 'improved' | 'maintained' | 'declining' | 'first_time';
  latestWeight: number;
  latestReps: number;
  previousWeight: number | null;
  previousReps: number | null;
  weightDelta: number;
  repDelta: number;
  isBodyweight: boolean;
  sparkline: ExerciseSparkPoint[];
  lastSessionDate: string;
}

export interface FocusSessionItem {
  id: string;
  name: string;
  date: string;
  volume: number;
  sets: number;
  durationSeconds?: number;
}

export interface WorkoutFocusSummary {
  id: string;
  name: string;
  workoutCount: number;
  completedSets: number;
  totalVolume: number;
  lastSessionDate: string;
  firstSessionDate: string;
  exercises: FocusExerciseItem[];
  improvedCount: number;
  maintainedCount: number;
  decliningCount: number;
  recentSessions: FocusSessionItem[];
}

export interface ProgressAnalyticsData {
  overview: PeriodOverviewMetrics;
  focuses: WorkoutFocusSummary[];
  allExercises: FocusExerciseItem[];
  hasAnyWorkouts: boolean;
  hasPeriodWorkouts: boolean;
}

/**
 * Computes calendar date ranges for Week, Month, and All Time.
 */
export function getPeriodDateRange(
  period: AnalyticsPeriod,
  referenceDate: Date = new Date(),
  offset = 0
): PeriodDateRange {
  const d = new Date(referenceDate);

  if (period === 'week') {
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMonday = (day === 0 ? -6 : 1 - day) + offset * 7;

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
      startMonth === endMonth
        ? `${startMonth} ${startDay} – ${endDay}`
        : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;

    return { start, end, label };
  }

  if (period === 'month') {
    const targetMonth = d.getMonth() + offset;
    const start = new Date(d.getFullYear(), targetMonth, 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), targetMonth + 1, 0, 23, 59, 59, 999);

    const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { start, end, label };
  }

  // All Time
  const start = new Date(0); // Epoch start
  const end = new Date(referenceDate.getTime() + 86400000 * 365); // Far future
  return { start, end, label: 'All-Time Training' };
}

/**
 * Filter workouts that fall inside a specific date range.
 */
export function filterWorkoutsInDateRange(
  workouts: WorkoutSession[],
  range: PeriodDateRange
): WorkoutSession[] {
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  return workouts.filter((w) => {
    if (!w) return false;
    const dateStr = w.finishedAt || w.startedAt;
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    return !isNaN(t) && t >= startMs && t <= endMs;
  });
}

/**
 * Discovers and normalizes focus category names from workout sessions.
 */
export function deriveFocusName(workout: WorkoutSession): string {
  const rawName = (workout.name || '').trim();
  if (rawName && rawName !== 'Quick Workout' && rawName !== 'Workout') {
    return rawName;
  }

  // If generic name, infer from predominant exercise category
  if (workout.exercises && workout.exercises.length > 0) {
    const categoryCounts: Record<string, number> = {};
    for (const ex of workout.exercises) {
      const cat = (ex.categoryName || '').trim();
      if (cat) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }
    const categories = Object.keys(categoryCounts).sort(
      (a, b) => categoryCounts[b] - categoryCounts[a]
    );
    if (categories.length > 0) {
      if (categories.length >= 2 && categoryCounts[categories[0]] === categoryCounts[categories[1]]) {
        return `${categories[0]} & ${categories[1]}`;
      }
      return `${categories[0]} Focus`;
    }
  }

  return 'General Training';
}

/**
 * Normalizes focus key for grouping.
 */
function normalizeFocusId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Safely extracts top or best reps from an exercise performance snapshot,
 * handling both weighted and bodyweight exercises.
 */
function getSnapshotReps(snap: ExercisePerformanceSnapshot | null): number {
  if (!snap) return 0;
  if (snap.topWeight > 0 && snap.topWeightReps > 0) return snap.topWeightReps;
  if (snap.bestSet && snap.bestSet.reps > 0) return snap.bestSet.reps;
  if (Array.isArray(snap.sets) && snap.sets.length > 0) {
    const validReps = snap.sets
      .filter((s) => s && s.completed && s.reps > 0)
      .map((s) => s.reps);
    if (validReps.length > 0) return Math.max(...validReps);
  }
  return snap.totalReps || 0;
}

/**
 * Calculates complete Progress Analytics 2.0 data model across periods and focuses.
 */
export function calculateProgressAnalytics(
  allWorkouts: WorkoutSession[],
  period: AnalyticsPeriod = 'week',
  referenceDate: Date = new Date()
): ProgressAnalyticsData {
  const safeWorkouts = Array.isArray(allWorkouts)
    ? allWorkouts.filter((w) => w && (w.status === 'completed' || w.finishedAt))
    : [];

  const currentRange = getPeriodDateRange(period, referenceDate, 0);
  const previousRange = period !== 'all_time' ? getPeriodDateRange(period, referenceDate, -1) : null;

  const currentWorkouts =
    period === 'all_time'
      ? safeWorkouts
      : filterWorkoutsInDateRange(safeWorkouts, currentRange);

  const previousWorkouts =
    previousRange ? filterWorkoutsInDateRange(safeWorkouts, previousRange) : [];

  // 1. Calculate Period Overview Metrics
  let currentSetsCount = 0;
  let currentVolumeKg = 0;
  const activeDaysSet = new Set<string>();

  for (const w of currentWorkouts) {
    const dateStr = w.finishedAt || w.startedAt;
    if (dateStr) {
      const d = new Date(dateStr);
      activeDaysSet.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    }

    for (const ex of w.exercises || []) {
      for (const set of ex.actualSets || []) {
        if (set.completed && set.reps > 0) {
          currentSetsCount++;
          if (typeof set.weight === 'number' && set.weight > 0) {
            currentVolumeKg += set.weight * set.reps;
          }
        }
      }
    }
  }

  currentVolumeKg = Math.round(currentVolumeKg * 100) / 100;

  // Previous period metrics for comparison
  let previousSetsCount = 0;
  let previousVolumeKg = 0;

  for (const w of previousWorkouts) {
    for (const ex of w.exercises || []) {
      for (const set of ex.actualSets || []) {
        if (set.completed && set.reps > 0) {
          previousSetsCount++;
          if (typeof set.weight === 'number' && set.weight > 0) {
            previousVolumeKg += set.weight * set.reps;
          }
        }
      }
    }
  }

  previousVolumeKg = Math.round(previousVolumeKg * 100) / 100;

  let comparison: PeriodOverviewMetrics['comparison'] = null;
  if (previousRange && previousWorkouts.length > 0) {
    const volumeDelta = Math.round((currentVolumeKg - previousVolumeKg) * 100) / 100;
    const volumePercentDelta =
      previousVolumeKg > 0
        ? Math.round(((currentVolumeKg - previousVolumeKg) / previousVolumeKg) * 1000) / 10
        : null;

    comparison = {
      workoutDelta: currentWorkouts.length - previousWorkouts.length,
      setDelta: currentSetsCount - previousSetsCount,
      volumeDeltaKg: volumeDelta,
      volumePercentDelta,
      hasPriorData: true,
    };
  } else if (previousRange) {
    comparison = {
      workoutDelta: currentWorkouts.length,
      setDelta: currentSetsCount,
      volumeDeltaKg: currentVolumeKg,
      volumePercentDelta: null,
      hasPriorData: false,
    };
  }

  // 2. Build exercise performance map chronologically ascending across ALL workouts
  const snapshotsMap = new Map<string, ExercisePerformanceSnapshot[]>();
  const chronoSortedWorkouts = [...safeWorkouts].sort((a, b) => {
    const ta = new Date(a.finishedAt || a.startedAt).getTime() || 0;
    const tb = new Date(b.finishedAt || b.startedAt).getTime() || 0;
    return ta - tb;
  });

  for (const w of chronoSortedWorkouts) {
    const snaps = extractExercisePerformances(w);
    for (const s of snaps) {
      const list = snapshotsMap.get(s.exerciseId) || [];
      list.push(s);
      snapshotsMap.set(s.exerciseId, list);
    }
  }

  // Calculate Personal Records count across history
  let totalPRsCount = 0;
  for (const [_, snaps] of snapshotsMap.entries()) {
    let bestWeight = 0;
    let bestReps = 0;
    for (const s of snaps) {
      const reps = getSnapshotReps(s);
      if (s.topWeight > bestWeight) {
        bestWeight = s.topWeight;
        bestReps = reps;
        totalPRsCount++;
      } else if (s.topWeight === bestWeight && reps > bestReps) {
        bestReps = reps;
        totalPRsCount++;
      }
    }
  }

  const overview: PeriodOverviewMetrics = {
    period,
    currentRange,
    previousRange,
    workoutCount: currentWorkouts.length,
    completedSetsCount: currentSetsCount,
    totalVolumeKg: currentVolumeKg,
    activeDaysCount: activeDaysSet.size,
    prCount: totalPRsCount,
    comparison,
  };

  // 3. Group workouts by Focus (computed from historical data so filters never wipe out focus library)
  // Workouts to group: if current period has workouts, use current period + history; otherwise all history
  const workoutsForFocus = safeWorkouts;
  const focusMap = new Map<
    string,
    {
      name: string;
      workouts: WorkoutSession[];
    }
  >();

  for (const w of workoutsForFocus) {
    const focusName = deriveFocusName(w);
    const focusId = normalizeFocusId(focusName);
    const existing = focusMap.get(focusId) || { name: focusName, workouts: [] };
    existing.workouts.push(w);
    focusMap.set(focusId, existing);
  }

  const focusSummaries: WorkoutFocusSummary[] = [];

  for (const [id, data] of focusMap.entries()) {
    const focusWorkoutsDesc = [...data.workouts].sort((a, b) => {
      const ta = new Date(a.finishedAt || a.startedAt).getTime() || 0;
      const tb = new Date(b.finishedAt || b.startedAt).getTime() || 0;
      return tb - ta;
    });

    let focusVolume = 0;
    let focusSets = 0;
    const focusExercisesMap = new Map<string, FocusExerciseItem>();

    const recentSessions: FocusSessionItem[] = focusWorkoutsDesc.slice(0, 5).map((w) => {
      let sessVol = 0;
      let sessSets = 0;
      for (const ex of w.exercises || []) {
        for (const s of ex.actualSets || []) {
          if (s.completed && s.reps > 0) {
            sessSets++;
            if (s.weight > 0) sessVol += s.weight * s.reps;
          }
        }
      }
      return {
        id: w.id,
        name: w.name,
        date: w.finishedAt || w.startedAt,
        volume: Math.round(sessVol),
        sets: sessSets,
        durationSeconds: w.totalDuration,
      };
    });

    for (const w of data.workouts) {
      for (const ex of w.exercises || []) {
        let exSets = 0;
        let exVol = 0;
        let topWeight = 0;
        let topWeightReps = 0;

        for (const set of ex.actualSets || []) {
          if (set.completed && set.reps > 0) {
            exSets++;
            focusSets++;
            const wgt = set.weight || 0;
            const vol = wgt * set.reps;
            exVol += vol;
            focusVolume += vol;

            if (wgt > topWeight || (wgt === topWeight && set.reps > topWeightReps)) {
              topWeight = wgt;
              topWeightReps = set.reps;
            }
          }
        }

        if (exSets > 0) {
          const exSnaps = snapshotsMap.get(ex.exerciseId) || [];
          const sparkline: ExerciseSparkPoint[] = exSnaps.slice(-5).map((s) => ({
            date: s.sessionDate,
            weight: s.topWeight,
            reps: getSnapshotReps(s),
            volume: Math.round(s.totalVolume),
          }));

          const latestSnap = exSnaps.length > 0 ? exSnaps[exSnaps.length - 1] : null;
          const prevSnap = exSnaps.length > 1 ? exSnaps[exSnaps.length - 2] : null;

          const isBodyweight = latestSnap ? latestSnap.topWeight === 0 : false;
          let status: FocusExerciseItem['status'] = 'first_time';
          let weightDelta = 0;
          let repDelta = 0;

          const latestReps = latestSnap ? getSnapshotReps(latestSnap) : topWeightReps;
          const prevReps = prevSnap ? getSnapshotReps(prevSnap) : null;

          if (latestSnap && prevSnap) {
            weightDelta = latestSnap.topWeight - prevSnap.topWeight;
            repDelta = latestReps - (prevReps ?? 0);

            if (weightDelta > 0 || (weightDelta === 0 && repDelta > 0)) {
              status = 'improved';
            } else if (weightDelta < 0 || (weightDelta === 0 && repDelta < 0)) {
              status = 'declining';
            } else {
              status = 'maintained';
            }
          }

          focusExercisesMap.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            categoryName: ex.categoryName,
            sessionCount: exSnaps.length,
            status,
            latestWeight: latestSnap ? latestSnap.topWeight : topWeight,
            latestReps,
            previousWeight: prevSnap ? prevSnap.topWeight : null,
            previousReps: prevReps,
            weightDelta,
            repDelta,
            isBodyweight,
            sparkline,
            lastSessionDate: latestSnap ? latestSnap.sessionDate : (w.finishedAt || w.startedAt),
          });
        }
      }
    }

    const exercisesList = Array.from(focusExercisesMap.values()).sort(
      (a, b) => b.sessionCount - a.sessionCount
    );

    let improvedCount = 0;
    let maintainedCount = 0;
    let decliningCount = 0;

    for (const ex of exercisesList) {
      if (ex.status === 'improved') improvedCount++;
      else if (ex.status === 'maintained') maintainedCount++;
      else if (ex.status === 'declining') decliningCount++;
    }

    const lastDate = focusWorkoutsDesc[0]?.finishedAt || focusWorkoutsDesc[0]?.startedAt || '';
    const firstDate =
      focusWorkoutsDesc[focusWorkoutsDesc.length - 1]?.finishedAt ||
      focusWorkoutsDesc[focusWorkoutsDesc.length - 1]?.startedAt ||
      '';

    focusSummaries.push({
      id,
      name: data.name,
      workoutCount: data.workouts.length,
      completedSets: focusSets,
      totalVolume: Math.round(focusVolume),
      lastSessionDate: lastDate,
      firstSessionDate: firstDate,
      exercises: exercisesList,
      improvedCount,
      maintainedCount,
      decliningCount,
      recentSessions,
    });
  }

  // Sort focuses by most recently trained
  focusSummaries.sort((a, b) => {
    const ta = new Date(a.lastSessionDate).getTime() || 0;
    const tb = new Date(b.lastSessionDate).getTime() || 0;
    return tb - ta;
  });

  // Extract all unique exercises
  const allExercisesMap = new Map<string, FocusExerciseItem>();
  for (const focus of focusSummaries) {
    for (const ex of focus.exercises) {
      if (!allExercisesMap.has(ex.exerciseId)) {
        allExercisesMap.set(ex.exerciseId, ex);
      }
    }
  }

  return {
    overview,
    focuses: focusSummaries,
    allExercises: Array.from(allExercisesMap.values()),
    hasAnyWorkouts: safeWorkouts.length > 0,
    hasPeriodWorkouts: currentWorkouts.length > 0,
  };
}
