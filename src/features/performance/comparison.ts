/**
 * BeBig 2.0 — Comparable Performance Engine (PERF-5B)
 *
 * Deterministic engine comparing an exercise's current performance against
 * its most recent chronologically earlier valid historical performance.
 *
 * Pure mathematics only. Strictly decoupled from PR detection (PERF-5C),
 * performance classification (PERF-5D), and UI. RIR is excluded.
 */

import { ExercisePerformanceSnapshot, PerformanceComparison } from './types';

/**
 * Safely computes raw numeric difference and percentage change between two values.
 * Handles floating-point accuracy (rounds to 2 decimal places) and previous = 0 safely without producing NaN/Infinity.
 */

function calculateDiffAndPercent(current: number, previous: number): { change: number; percent: number | null } {
  const safeCurrent = typeof current === 'number' && !isNaN(current) && isFinite(current) ? current : 0;
  const safePrevious = typeof previous === 'number' && !isNaN(previous) && isFinite(previous) ? previous : 0;

  const change = Math.round((safeCurrent - safePrevious) * 100) / 100;

  if (safePrevious <= 0) {
    return { change, percent: null };
  }

  const rawPercent = ((safeCurrent - safePrevious) / safePrevious) * 100;
  const percent = Math.round(rawPercent * 100) / 100;

  return { change, percent };
}

/**
 * Finds the most recent chronologically earlier valid performance snapshot for the exact same exercise.
 * Excludes the current session, ignores different exercises, and handles malformed data safely.
 */
export function findPreviousPerformance(
  currentSnapshot: ExercisePerformanceSnapshot,
  historicalSnapshots: ExercisePerformanceSnapshot[],
): ExercisePerformanceSnapshot | null {
  if (
    !currentSnapshot ||
    typeof currentSnapshot !== 'object' ||
    !currentSnapshot.exerciseId ||
    !Array.isArray(historicalSnapshots) ||
    historicalSnapshots.length === 0
  ) {
    return null;
  }

  const currentSessionDate = new Date(currentSnapshot.sessionDate).getTime();
  if (isNaN(currentSessionDate)) {
    return null;
  }

  const candidates = historicalSnapshots.filter((cand) => {
    if (!cand || typeof cand !== 'object') return false;

    // Must match stable exerciseId
    if (cand.exerciseId !== currentSnapshot.exerciseId) return false;

    // Exclude current session
    if (cand.sessionId === currentSnapshot.sessionId) return false;

    // Must be valid snapshot structure
    if (!Array.isArray(cand.sets)) return false;

    // Must be chronologically earlier
    const candDate = new Date(cand.sessionDate).getTime();
    if (isNaN(candDate) || candDate >= currentSessionDate) return false;

    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Sort descending by session date (most recent first)
  candidates.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());

  return candidates[0];
}

/**
 * Compares two ExercisePerformanceSnapshot models and returns raw measurable changes.
 */
export function comparePerformances(
  currentSnapshot: ExercisePerformanceSnapshot,
  previousSnapshot: ExercisePerformanceSnapshot | null,
): PerformanceComparison {
  const fallbackExerciseId = currentSnapshot?.exerciseId || '';
  const fallbackExerciseName = currentSnapshot?.exerciseName || 'Unnamed Exercise';

  if (!previousSnapshot || typeof previousSnapshot !== 'object' || !Array.isArray(previousSnapshot.sets)) {
    return {
      exerciseId: fallbackExerciseId,
      exerciseName: fallbackExerciseName,
      currentSnapshot,
      previousSnapshot: null,
      hasPreviousPerformance: false,
      weightChange: null,
      weightChangePercent: null,
      repChange: null,
      repChangePercent: null,
      volumeChange: null,
      volumeChangePercent: null,
      topWeightChange: null,
      topWeightChangePercent: null,
      topWeightRepChange: null,
    };
  }

  const weightDiff = calculateDiffAndPercent(currentSnapshot.topWeight, previousSnapshot.topWeight);
  const repDiff = calculateDiffAndPercent(currentSnapshot.topWeightReps, previousSnapshot.topWeightReps);
  const volumeDiff = calculateDiffAndPercent(currentSnapshot.totalVolume, previousSnapshot.totalVolume);

  return {
    exerciseId: fallbackExerciseId,
    exerciseName: fallbackExerciseName,
    currentSnapshot,
    previousSnapshot,
    hasPreviousPerformance: true,

    weightChange: weightDiff.change,
    weightChangePercent: weightDiff.percent,

    repChange: repDiff.change,
    repChangePercent: repDiff.percent,

    volumeChange: volumeDiff.change,
    volumeChangePercent: volumeDiff.percent,

    topWeightChange: weightDiff.change,
    topWeightChangePercent: weightDiff.percent,
    topWeightRepChange: repDiff.change,
  };
}

/**
 * Main entry point: Finds the comparable previous performance from historical snapshots and computes raw changes.
 */
export function compareExercisePerformance(
  currentSnapshot: ExercisePerformanceSnapshot,
  historicalSnapshots: ExercisePerformanceSnapshot[],
): PerformanceComparison {
  const previousSnapshot = findPreviousPerformance(currentSnapshot, historicalSnapshots);
  return comparePerformances(currentSnapshot, previousSnapshot);
}

import { SetPerformance, SetComparisonItem } from './types';

/**
 * Compares current workout sets against previous workout sets on a set-by-set basis (Set 1 -> Set 1, Set 2 -> Set 2).
 */
export function compareExerciseSets(
  currentSets: SetPerformance[],
  previousSets: SetPerformance[],
): SetComparisonItem[] {
  const safeCurr = Array.isArray(currentSets) ? currentSets : [];
  const safePrev = Array.isArray(previousSets) ? previousSets : [];

  const maxSets = Math.max(safeCurr.length, safePrev.length);
  const items: SetComparisonItem[] = [];

  for (let i = 0; i < maxSets; i++) {
    const setNumber = i + 1;
    const curr = safeCurr[i] || null;
    const prev = safePrev[i] || null;

    if (curr && prev) {
      const wDiff = Number((curr.weight - prev.weight).toFixed(2));
      const rDiff = curr.reps - prev.reps;

      let status: SetComparisonItem['status'] = 'no_change';
      const parts: string[] = [];

      if (wDiff > 0) {
        parts.push(`↑ +${wDiff} kg`);
      } else if (wDiff < 0) {
        parts.push(`↓ ${wDiff} kg`);
      }

      if (rDiff > 0) {
        parts.push(`↑ +${rDiff} reps`);
      } else if (rDiff < 0) {
        parts.push(`↓ ${rDiff} reps`);
      }

      if (wDiff > 0 || rDiff > 0) {
        status = 'increased';
      } else if (wDiff < 0 || rDiff < 0) {
        status = 'decreased';
      } else {
        status = 'no_change';
        parts.push('— No change');
      }

      items.push({
        setNumber,
        currentSet: curr,
        previousSet: prev,
        weightChange: wDiff !== 0 ? wDiff : null,
        repChange: rDiff !== 0 ? rDiff : null,
        status,
        displayText: parts.join('  '),
      });
    } else if (curr && !prev) {
      items.push({
        setNumber,
        currentSet: curr,
        previousSet: null,
        weightChange: null,
        repChange: null,
        status: 'new_set',
        displayText: 'NEW SET',
      });
    } else if (!curr && prev) {
      items.push({
        setNumber,
        currentSet: null,
        previousSet: prev,
        weightChange: null,
        repChange: null,
        status: 'removed_set',
        displayText: 'SET REMOVED',
      });
    }
  }

  return items;
}

