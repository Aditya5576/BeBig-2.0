/**
 * BeBig 2.0 — Superset & Giant Set Utility Helpers
 *
 * Deterministic helper functions for computing group membership, display labels,
 * ordering tags (e.g. "A1", "A2", "B1"), and accent colors for contiguous supersets
 * and giant sets in active workout sessions and history views.
 */

import { WorkoutExercise } from '../types';

export interface SupersetDisplayInfo {
  isInGroup: boolean;
  groupLabel: string; // e.g. "SUPERSET A1", "GIANT SET A2"
  groupTag: string; // e.g. "A1", "A2"
  groupType: 'superset' | 'giant_set';
  accentColor: string; // '#00E599' (emerald for superset) or '#38BDF8' (cyan for giant set)
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  groupSize: number;
}

/**
 * Returns superset display metadata for an exercise within a list of exercises.
 * Groups are labeled with letters (A, B, C...) based on order of appearance.
 * Position within group is 1-indexed (A1, A2, A3...).
 * 2 linked exercises = 'superset' (#00E599 emerald accent).
 * 3+ linked exercises = 'giant_set' (#38BDF8 electric cyan accent).
 */
export function getSupersetDisplayInfo(
  exercises: WorkoutExercise[],
  exerciseId: string,
): SupersetDisplayInfo {
  const standalone: SupersetDisplayInfo = {
    isInGroup: false,
    groupLabel: '',
    groupTag: '',
    groupType: 'superset',
    accentColor: '#00E599',
    isFirstInGroup: false,
    isLastInGroup: false,
    groupSize: 1,
  };

  if (!exercises || exercises.length === 0 || !exerciseId) {
    return standalone;
  }

  const targetEx = exercises.find((e) => e.exerciseId === exerciseId);
  if (!targetEx || !targetEx.supersetGroupId) {
    return standalone;
  }

  // Find all unique groups in order of appearance
  const uniqueGroupIds: string[] = [];
  for (const ex of exercises) {
    if (ex.supersetGroupId && !uniqueGroupIds.includes(ex.supersetGroupId)) {
      uniqueGroupIds.push(ex.supersetGroupId);
    }
  }

  const groupIndex = uniqueGroupIds.indexOf(targetEx.supersetGroupId);
  if (groupIndex === -1) {
    return standalone;
  }

  const groupExercises = exercises.filter(
    (e) => e.supersetGroupId === targetEx.supersetGroupId,
  );
  const groupSize = groupExercises.length;
  if (groupSize < 2) {
    return standalone;
  }

  const exercisePositionInGroup =
    groupExercises.findIndex((e) => e.exerciseId === exerciseId) + 1;

  // Group letters: A, B, C, ...
  const groupLetter = String.fromCharCode(65 + (groupIndex % 26));
  const groupTag = `${groupLetter}${exercisePositionInGroup}`;
  const isGiantSet = groupSize >= 3;
  const groupType: 'superset' | 'giant_set' = isGiantSet ? 'giant_set' : 'superset';
  const groupTitle = isGiantSet ? 'GIANT SET' : 'SUPERSET';
  const groupLabel = `${groupTitle} ${groupTag}`;
  const accentColor = isGiantSet ? '#38BDF8' : '#00E599';

  return {
    isInGroup: true,
    groupLabel,
    groupTag,
    groupType,
    accentColor,
    isFirstInGroup: exercisePositionInGroup === 1,
    isLastInGroup: exercisePositionInGroup === groupSize,
    groupSize,
  };
}

