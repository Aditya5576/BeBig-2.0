/**
 * BeBig 2.0 — PR Detection Engine (PERF-5C)
 *
 * Deterministic personal record detection comparing an exercise performance against
 * all historical maximum performances for the exact same exercise.
 *
 * Pure mathematics only. Strictly decoupled from UI, AI, and RIR.
 */

import { ExercisePerformanceSnapshot, PerformancePRResult } from './types';

/**
 * Extracts the maximum reps achieved across any completed set for an exercise snapshot.
 */
export function getSnapshotMaxReps(snapshot: ExercisePerformanceSnapshot): number {
  if (!snapshot || !Array.isArray(snapshot.sets) || snapshot.sets.length === 0) {
    return 0;
  }

  let maxReps = 0;
  for (const set of snapshot.sets) {
    if (set && set.completed && typeof set.reps === 'number' && !isNaN(set.reps) && set.reps > 0) {
      if (set.reps > maxReps) {
        maxReps = set.reps;
      }
    }
  }

  return maxReps;
}

/**
 * Detects Weight PR, Rep PR, and Volume PR by evaluating current exercise performance against
 * all valid historical maximums for the exact same exercise.
 */
export function detectExercisePRs(
  currentSnapshot: ExercisePerformanceSnapshot,
  historicalSnapshots: ExercisePerformanceSnapshot[],
): PerformancePRResult {
  const fallbackExerciseId = currentSnapshot?.exerciseId || '';
  const fallbackExerciseName = currentSnapshot?.exerciseName || 'Unnamed Exercise';

  // Defensive fallback if current snapshot is invalid
  if (!currentSnapshot || typeof currentSnapshot !== 'object' || !Array.isArray(currentSnapshot.sets)) {
    return {
      exerciseId: fallbackExerciseId,
      exerciseName: fallbackExerciseName,
      currentSnapshot: currentSnapshot || ({} as ExercisePerformanceSnapshot),
      hasHistory: false,

      currentTopWeight: 0,
      previousBestTopWeight: null,
      weightIncrease: null,
      isWeightPR: false,

      currentBestReps: 0,
      previousBestReps: null,
      repIncrease: null,
      isRepPR: false,

      currentTotalVolume: 0,
      previousBestVolume: null,
      volumeIncrease: null,
      isVolumePR: false,

      hasAnyPR: false,
    };
  }

  const currentTopWeight =
    typeof currentSnapshot.topWeight === 'number' && !isNaN(currentSnapshot.topWeight) && currentSnapshot.topWeight > 0
      ? currentSnapshot.topWeight
      : 0;
  const currentBestReps = getSnapshotMaxReps(currentSnapshot);
  const currentTotalVolume =
    typeof currentSnapshot.totalVolume === 'number' &&
    !isNaN(currentSnapshot.totalVolume) &&
    currentSnapshot.totalVolume > 0
      ? currentSnapshot.totalVolume
      : 0;

  // Filter historical candidates: same exerciseId, exclude current session, chronologically earlier, valid structure
  const currentSessionDate = new Date(currentSnapshot.sessionDate).getTime();

  const validHistory = Array.isArray(historicalSnapshots)
    ? historicalSnapshots.filter((cand) => {
        if (!cand || typeof cand !== 'object' || !Array.isArray(cand.sets)) return false;
        if (cand.exerciseId !== currentSnapshot.exerciseId) return false;
        if (cand.sessionId === currentSnapshot.sessionId) return false;

        // Chronologically earlier validation
        const candDate = new Date(cand.sessionDate).getTime();
        if (!isNaN(candDate) && !isNaN(currentSessionDate) && candDate >= currentSessionDate) return false;

        return true;
      })
    : [];

  if (validHistory.length === 0) {
    const isWeightPR = currentTopWeight > 0;
    const isRepPR = currentBestReps > 0;
    const isVolumePR = currentTotalVolume > 0;

    return {
      exerciseId: fallbackExerciseId,
      exerciseName: fallbackExerciseName,
      currentSnapshot,
      hasHistory: false,

      currentTopWeight,
      previousBestTopWeight: null,
      weightIncrease: null,
      isWeightPR,

      currentBestReps,
      previousBestReps: null,
      repIncrease: null,
      isRepPR,

      currentTotalVolume,
      previousBestVolume: null,
      volumeIncrease: null,
      isVolumePR,

      hasAnyPR: isWeightPR || isRepPR || isVolumePR,
    };
  }

  // Determine historical maximums across ALL valid historical performances
  let previousBestTopWeight = 0;
  let previousBestReps = 0;
  let previousBestVolume = 0;

  for (const hist of validHistory) {
    if (typeof hist.topWeight === 'number' && hist.topWeight > previousBestTopWeight) {
      previousBestTopWeight = hist.topWeight;
    }

    const histMaxReps = getSnapshotMaxReps(hist);
    if (histMaxReps > previousBestReps) {
      previousBestReps = histMaxReps;
    }

    if (typeof hist.totalVolume === 'number' && hist.totalVolume > previousBestVolume) {
      previousBestVolume = hist.totalVolume;
    }
  }

  // Weight PR detection
  const isWeightPR = currentTopWeight > previousBestTopWeight;
  const weightIncrease = Math.round((currentTopWeight - previousBestTopWeight) * 100) / 100;

  // Rep PR detection
  const isRepPR = currentBestReps > previousBestReps;
  const repIncrease = currentBestReps - previousBestReps;

  // Volume PR detection
  const isVolumePR = currentTotalVolume > previousBestVolume;
  const volumeIncrease = Math.round((currentTotalVolume - previousBestVolume) * 100) / 100;

  const hasAnyPR = isWeightPR || isRepPR || isVolumePR;

  return {
    exerciseId: fallbackExerciseId,
    exerciseName: fallbackExerciseName,
    currentSnapshot,
    hasHistory: true,

    currentTopWeight,
    previousBestTopWeight,
    weightIncrease,
    isWeightPR,

    currentBestReps,
    previousBestReps,
    repIncrease,
    isRepPR,

    currentTotalVolume,
    previousBestVolume,
    volumeIncrease,
    isVolumePR,

    hasAnyPR,
  };
}
