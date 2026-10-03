/**
 * BeBig 2.0 — Performance Classification Engine (PERF-5D)
 *
 * Deterministic engine converting raw performance measurements (PERF-5B/5C) into
 * explainable descriptive classifications (weight_progression, rep_progression,
 * combined_progression, volume_progression, maintained, recent_drop, possible_plateau).
 *
 * Strictly no arbitrary scores (e.g. 87/100), no AI text generation, no speculative reasons, and no RIR.
 */

import {
  ExercisePerformanceSnapshot,
  PerformanceComparison,
  PerformanceClassification,
  PerformanceClassificationType,
} from './types';

import { comparePerformances, findPreviousPerformance } from './comparison';

export const THRESHOLDS = {
  WEIGHT_MIN_KG: 0.1, // Minimum change in kg to treat load as increased/decreased (avoids floating point noise)
  REP_MIN: 1, // Minimum change in reps to treat reps as increased/decreased
  VOLUME_MIN_KG: 0.5, // Minimum change in total volume to treat volume as increased/decreased
  PLATEAU_MIN_SESSIONS: 3, // Minimum consecutive sessions with no progression required to infer a possible plateau
};

/**
 * Deterministically classifies an exercise performance against historical data.
 */
export function classifyPerformance(
  currentSnapshot: ExercisePerformanceSnapshot,
  historicalSnapshots: ExercisePerformanceSnapshot[] = [],
): PerformanceClassification {
  const previousSnapshot = findPreviousPerformance(currentSnapshot, historicalSnapshots);
  const comparison = comparePerformances(currentSnapshot, previousSnapshot);

  return classifyComparison(currentSnapshot, previousSnapshot, comparison, historicalSnapshots);
}

/**
 * Classifies an evaluated comparison against historical context.
 */
export function classifyComparison(
  currentSnapshot: ExercisePerformanceSnapshot,
  previousSnapshot: ExercisePerformanceSnapshot | null,
  comparison: PerformanceComparison | null,
  historicalSnapshots: ExercisePerformanceSnapshot[] = [],
): PerformanceClassification {
  const fallbackSnapshot = currentSnapshot || ({} as ExercisePerformanceSnapshot);

  // Baseline case: No previous snapshot to compare against
  if (!previousSnapshot || !comparison || !comparison.hasPreviousPerformance) {
    return {
      classification: 'maintained',
      confidenceReason: 'Initial recorded performance baseline for this exercise.',
      currentSnapshot: fallbackSnapshot,
      previousSnapshot: null,
      comparison: null,
      supportingFacts: [
        `Recorded top weight: ${fallbackSnapshot.topWeight ?? 0} kg`,
        `Recorded reps at top weight: ${fallbackSnapshot.topWeightReps ?? 0}`,
        `Total exercise volume: ${fallbackSnapshot.totalVolume ?? 0} kg`,
      ],
    };
  }

  const weightChange = comparison.weightChange ?? 0;
  const repChange = comparison.repChange ?? 0;
  const volumeChange = comparison.volumeChange ?? 0;

  const isWeightUp = weightChange >= THRESHOLDS.WEIGHT_MIN_KG;
  const isWeightDown = weightChange <= -THRESHOLDS.WEIGHT_MIN_KG;

  const isRepUp = repChange >= THRESHOLDS.REP_MIN;
  const isRepDown = repChange <= -THRESHOLDS.REP_MIN;

  const isVolumeUp = volumeChange >= THRESHOLDS.VOLUME_MIN_KG;
  const isVolumeDown = volumeChange <= -THRESHOLDS.VOLUME_MIN_KG;

  // 1. COMBINED PROGRESSION (Both load and reps increased)
  if (isWeightUp && isRepUp) {
    return {
      classification: 'combined_progression',
      confidenceReason: `Top weight increased by ${weightChange} kg (+${comparison.weightChangePercent}%) and reps increased by ${repChange} reps.`,
      currentSnapshot,
      previousSnapshot,
      comparison,
      supportingFacts: [
        `Top weight increased from ${previousSnapshot.topWeight} kg to ${currentSnapshot.topWeight} kg (+${weightChange} kg)`,
        `Reps at top weight increased from ${previousSnapshot.topWeightReps} to ${currentSnapshot.topWeightReps} (+${repChange} reps)`,
        `Total volume changed from ${previousSnapshot.totalVolume} kg to ${currentSnapshot.totalVolume} kg (${volumeChange >= 0 ? '+' : ''}${volumeChange} kg)`,
      ],
    };
  }

  // 2. WEIGHT PROGRESSION (Load increased)
  if (isWeightUp) {
    const pctStr = comparison.weightChangePercent !== null ? ` (+${comparison.weightChangePercent}%)` : '';
    const repDiffStr = repChange !== 0 ? ` (reps changed by ${repChange > 0 ? '+' : ''}${repChange})` : '';

    return {
      classification: 'weight_progression',
      confidenceReason: `Top weight increased from ${previousSnapshot.topWeight} kg to ${currentSnapshot.topWeight} kg (+${weightChange} kg).`,
      currentSnapshot,
      previousSnapshot,
      comparison,
      supportingFacts: [
        `Top weight increased by ${weightChange} kg${pctStr}`,
        `Reps at top weight changed from ${previousSnapshot.topWeightReps} to ${currentSnapshot.topWeightReps}${repDiffStr}`,
        `Total exercise volume: ${currentSnapshot.totalVolume} kg (${volumeChange >= 0 ? '+' : ''}${volumeChange} kg)`,
      ],
    };
  }

  // 3. REP PROGRESSION (Reps increased while weight was maintained)
  if (!isWeightUp && !isWeightDown && isRepUp) {
    return {
      classification: 'rep_progression',
      confidenceReason: `Reps at top weight increased by +${repChange} reps (${previousSnapshot.topWeightReps} → ${currentSnapshot.topWeightReps}) while load was maintained at ${currentSnapshot.topWeight} kg.`,
      currentSnapshot,
      previousSnapshot,
      comparison,
      supportingFacts: [
        `Top weight maintained at ${currentSnapshot.topWeight} kg`,
        `Reps increased from ${previousSnapshot.topWeightReps} to ${currentSnapshot.topWeightReps} (+${repChange} reps)`,
        `Total volume changed by ${volumeChange >= 0 ? '+' : ''}${volumeChange} kg`,
      ],
    };
  }

  // 4. VOLUME PROGRESSION (Total volume increased without meeting weight/rep progression)
  if (!isWeightUp && !isRepUp && isVolumeUp) {
    return {
      classification: 'volume_progression',
      confidenceReason: `Total exercise volume increased by +${volumeChange} kg without a load or rep increase.`,
      currentSnapshot,
      previousSnapshot,
      comparison,
      supportingFacts: [
        `Total volume increased from ${previousSnapshot.totalVolume} kg to ${currentSnapshot.totalVolume} kg (+${volumeChange} kg)`,
        `Top weight: ${currentSnapshot.topWeight} kg`,
        `Top weight reps: ${currentSnapshot.topWeightReps}`,
      ],
    };
  }

  // 5. RECENT DROP (Performance materially below previous session across key metrics)
  if ((isWeightDown && (isRepDown || isVolumeDown)) || (isRepDown && isVolumeDown) || (isWeightDown && isVolumeDown)) {
    return {
      classification: 'recent_drop',
      confidenceReason: `Performance metrics dropped compared to previous session (load: ${weightChange} kg, reps: ${repChange}, volume: ${volumeChange} kg).`,
      currentSnapshot,
      previousSnapshot,
      comparison,
      supportingFacts: [
        `Top weight changed from ${previousSnapshot.topWeight} kg to ${currentSnapshot.topWeight} kg (${weightChange} kg)`,
        `Reps at top weight changed from ${previousSnapshot.topWeightReps} to ${currentSnapshot.topWeightReps} (${repChange} reps)`,
        `Total volume changed from ${previousSnapshot.totalVolume} kg to ${currentSnapshot.totalVolume} kg (${volumeChange} kg)`,
      ],
    };
  }

  // 6. POSSIBLE PLATEAU vs MAINTAINED
  // Check if 3 or more consecutive recent sessions show no progression
  const consecutiveNoProgression = checkConscutiveNoProgression(currentSnapshot, historicalSnapshots);

  if (consecutiveNoProgression >= THRESHOLDS.PLATEAU_MIN_SESSIONS) {
    return {
      classification: 'possible_plateau',
      confidenceReason: `Possible plateau: No progression detected across ${consecutiveNoProgression} consecutive sessions.`,
      currentSnapshot,
      previousSnapshot,
      comparison,
      supportingFacts: [
        `No load or rep increase across ${consecutiveNoProgression} consecutive workouts`,
        `Top weight maintained near ${currentSnapshot.topWeight} kg`,
        `Total volume maintained near ${currentSnapshot.totalVolume} kg`,
      ],
    };
  }

  // 7. MAINTAINED (Default when performance is unchanged and plateau criteria are not met)
  return {
    classification: 'maintained',
    confidenceReason: `Performance remained materially unchanged compared to previous session.`,
    currentSnapshot,
    previousSnapshot,
    comparison,
    supportingFacts: [
      `Top weight maintained at ${currentSnapshot.topWeight} kg`,
      `Reps maintained at ${currentSnapshot.topWeightReps}`,
      `Total volume: ${currentSnapshot.totalVolume} kg`,
    ],
  };
}

/**
 * Counts how many consecutive recent sessions (including current and previous history)
 * show no progression in top weight, reps, or total volume.
 */
function checkConscutiveNoProgression(
  currentSnapshot: ExercisePerformanceSnapshot,
  historicalSnapshots: ExercisePerformanceSnapshot[],
): number {
  if (!currentSnapshot || !Array.isArray(historicalSnapshots) || historicalSnapshots.length === 0) {
    return 1;
  }

  const validHistory = historicalSnapshots
    .filter((s) => s && s.exerciseId === currentSnapshot.exerciseId && s.sessionId !== currentSnapshot.sessionId)
    .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());

  if (validHistory.length === 0) {
    return 1;
  }

  // Form a timeline: [currentSnapshot, mostRecentPrev, secondMostRecentPrev, ...]
  const timeline = [currentSnapshot, ...validHistory];
  let noProgressionCount = 1;

  for (let i = 0; i < timeline.length - 1; i++) {
    const curr = timeline[i];
    const prev = timeline[i + 1];

    const weightDiff = curr.topWeight - prev.topWeight;
    const repDiff = curr.topWeightReps - prev.topWeightReps;
    const volumeDiff = curr.totalVolume - prev.totalVolume;

    const hasProgressed =
      weightDiff >= THRESHOLDS.WEIGHT_MIN_KG ||
      repDiff >= THRESHOLDS.REP_MIN ||
      volumeDiff >= THRESHOLDS.VOLUME_MIN_KG;

    if (!hasProgressed) {
      noProgressionCount++;
    } else {
      break;
    }
  }

  return noProgressionCount;
}
