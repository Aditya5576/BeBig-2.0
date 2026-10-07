import { WorkoutTemplate } from '../types';

export const WORKOUT_FOCUS_OPTIONS = [
  'Chest & Triceps',
  'Back & Biceps',
  'Shoulders & Legs',
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Arms',
  'Full Body',
  'Other',
];

export interface WorkoutHistoryItem {
  id?: string;
  status?: string;
  exercises?: { categoryName?: string; exerciseName?: string }[];
}

export function normalizeCategoryName(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.includes('chest')) return 'Chest';
  if (trimmed.includes('back')) return 'Back';
  if (trimmed.includes('shoulder')) return 'Shoulders';
  if (trimmed.includes('bicep')) return 'Biceps';
  if (trimmed.includes('tricep')) return 'Triceps';
  if (trimmed.includes('arm')) return 'Arms';
  if (trimmed.includes('leg') || trimmed.includes('calf') || trimmed.includes('calves') || trimmed.includes('quad') || trimmed.includes('hamstring') || trimmed.includes('glute')) return 'Legs';
  if (trimmed.includes('abs') || trimmed.includes('core')) return 'Core';
  return raw.trim();
}

export function deriveWorkoutFocus(exercises?: { categoryName?: string; exerciseName?: string }[] | null): string {
  if (!exercises || !Array.isArray(exercises) || exercises.length === 0) return 'Other';

  const categoryCounts: Record<string, number> = {};
  for (const ex of exercises) {
    const normalized = normalizeCategoryName(ex?.categoryName);
    if (normalized) {
      categoryCounts[normalized] = (categoryCounts[normalized] || 0) + 1;
    }
  }

  const sortedCategories = Object.keys(categoryCounts).sort(
    (a, b) => categoryCounts[b] - categoryCounts[a],
  );

  if (sortedCategories.length === 0) return 'Other';

  const hasChest = (categoryCounts['Chest'] || 0) > 0;
  const hasBack = (categoryCounts['Back'] || 0) > 0;
  const hasShoulders = (categoryCounts['Shoulders'] || 0) > 0;
  const hasLegs = (categoryCounts['Legs'] || 0) > 0;
  const hasBiceps = (categoryCounts['Biceps'] || 0) > 0;
  const hasTriceps = (categoryCounts['Triceps'] || 0) > 0;
  const hasArms = (categoryCounts['Arms'] || 0) > 0;

  const hasBiOrArm = hasBiceps || hasArms;
  const hasTriOrArm = hasTriceps || hasArms;

  if (hasChest && hasTriOrArm && !hasBack && !hasLegs) return 'Chest & Triceps';
  if (hasBack && hasBiOrArm && !hasChest && !hasLegs) return 'Back & Biceps';
  if (hasShoulders && hasLegs && !hasChest && !hasBack) return 'Shoulders & Legs';

  const totalCategorized = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const topCategory = sortedCategories[0];
  const topCount = categoryCounts[topCategory];

  if (topCount / totalCategorized >= 0.6) {
    if (topCategory === 'Chest') return 'Chest';
    if (topCategory === 'Back') return 'Back';
    if (topCategory === 'Shoulders') return 'Shoulders';
    if (topCategory === 'Biceps') return 'Biceps';
    if (topCategory === 'Triceps') return 'Triceps';
    if (topCategory === 'Legs') return 'Legs';
    if (topCategory === 'Arms') return 'Arms';
  }

  if ((hasChest || hasBack || hasShoulders) && hasLegs) return 'Full Body';

  return 'Other';
}

export function getSuggestedSessionNumber(
  completedWorkouts: WorkoutHistoryItem[] | undefined | null,
  focus: string,
): number {
  if (!completedWorkouts || !Array.isArray(completedWorkouts) || completedWorkouts.length === 0) {
    return 1;
  }

  let matchingCount = 0;
  for (const w of completedWorkouts) {
    // Only count COMPLETED workouts
    if (w.status && w.status !== 'completed') {
      continue;
    }

    // Must contain valid exercises
    if (!w.exercises || !Array.isArray(w.exercises) || w.exercises.length === 0) {
      if (focus === 'Other') {
        matchingCount++;
      }
      continue;
    }

    const wFocus = deriveWorkoutFocus(w.exercises);
    if (wFocus === focus) {
      matchingCount++;
    }
  }

  return matchingCount + 1;
}

export function getTemplateFocus(template: WorkoutTemplate): string {
  if (template.workoutFocus) {
    return template.workoutFocus;
  }
  return deriveWorkoutFocus(template.exercises);
}

export function extractSessionNumberFromName(name: string): number | null {
  if (!name || typeof name !== 'string') return null;
  const match = name.match(/Session (\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}
