/**
 * BeBig 2.0 — Performance Intelligence Pure Calculations (PERF-5A Data Foundation)
 *
 * Deterministic, side-effect-free math functions for set/exercise performance.
 * RIR is intentionally excluded. Handles decimals, zero values, and edge cases cleanly.
 */

import { SetPerformance } from './types';

/**
 * Calculates volume for a single set: weight × reps.
 * Returns 0 if weight or reps are negative, NaN, or non-finite.
 */
export function calculateSetVolume(weight: number, reps: number): number {
  if (
    typeof weight !== 'number' ||
    typeof reps !== 'number' ||
    isNaN(weight) ||
    isNaN(reps) ||
    !isFinite(weight) ||
    !isFinite(reps) ||
    weight < 0 ||
    reps < 0
  ) {
    return 0;
  }

  const volume = weight * reps;
  // Round to 2 decimal places to handle floating point precision (e.g. 62.5 * 3)
  return Math.round(volume * 100) / 100;
}

/**
 * Calculates total volume across all completed sets.
 */
export function calculateTotalVolume(sets: SetPerformance[]): number {
  if (!Array.isArray(sets) || sets.length === 0) {
    return 0;
  }

  const total = sets.reduce((sum, s) => {
    if (!s || !s.completed) return sum;
    const vol = calculateSetVolume(s.weight, s.reps);
    return sum + vol;
  }, 0);

  return Math.round(total * 100) / 100;
}

/**
 * Calculates total reps across all completed sets.
 */
export function calculateTotalReps(sets: SetPerformance[]): number {
  if (!Array.isArray(sets) || sets.length === 0) {
    return 0;
  }

  return sets.reduce((sum, s) => {
    if (!s || !s.completed) return sum;
    const reps = typeof s.reps === 'number' && !isNaN(s.reps) && s.reps > 0 ? Math.floor(s.reps) : 0;
    return sum + reps;
  }, 0);
}

/**
 * Determines the highest weight achieved among valid completed sets with reps > 0.
 * Returns 0 if no valid sets exist.
 */
export function calculateTopWeight(sets: SetPerformance[]): number {
  if (!Array.isArray(sets) || sets.length === 0) {
    return 0;
  }

  let maxWeight = 0;
  for (const s of sets) {
    if (s && s.completed && typeof s.weight === 'number' && !isNaN(s.weight) && s.weight > 0 && s.reps > 0) {
      if (s.weight > maxWeight) {
        maxWeight = s.weight;
      }
    }
  }

  return maxWeight;
}

/**
 * Determines reps performed on the set with the highest weight.
 * If multiple sets share the top weight, returns the maximum reps achieved at that top weight.
 * Returns 0 if no valid sets exist.
 */
export function calculateTopWeightReps(sets: SetPerformance[]): number {
  if (!Array.isArray(sets) || sets.length === 0) {
    return 0;
  }

  const topWeight = calculateTopWeight(sets);
  if (topWeight <= 0) {
    return 0;
  }

  let maxRepsAtTopWeight = 0;
  for (const s of sets) {
    if (s && s.completed && s.weight === topWeight && typeof s.reps === 'number' && !isNaN(s.reps) && s.reps > 0) {
      if (s.reps > maxRepsAtTopWeight) {
        maxRepsAtTopWeight = s.reps;
      }
    }
  }

  return maxRepsAtTopWeight;
}

/**
 * Determines the "best set" (highest set volume: weight × reps).
 * Tie-breaker rule: higher weight, then higher reps, then earliest set number.
 * Returns null if no valid completed sets exist.
 */
export function calculateBestSet(sets: SetPerformance[]): SetPerformance | null {
  if (!Array.isArray(sets) || sets.length === 0) {
    return null;
  }

  const completedSets = sets.filter(
    (s) => s && s.completed && typeof s.weight === 'number' && s.weight >= 0 && typeof s.reps === 'number' && s.reps > 0,
  );

  if (completedSets.length === 0) {
    return null;
  }

  let best = completedSets[0];

  for (let i = 1; i < completedSets.length; i++) {
    const current = completedSets[i];
    const bestVol = calculateSetVolume(best.weight, best.reps);
    const currVol = calculateSetVolume(current.weight, current.reps);

    if (currVol > bestVol) {
      best = current;
    } else if (currVol === bestVol) {
      // Tie-breaker 1: Higher weight
      if (current.weight > best.weight) {
        best = current;
      } else if (current.weight === best.weight && current.reps > best.reps) {
        // Tie-breaker 2: Higher reps
        best = current;
      }
    }
  }

  return best;
}
