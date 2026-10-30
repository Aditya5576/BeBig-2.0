/**
 * BeBig 2.0 — Indian Commercial Gym Equipment & Catalogue Filter
 *
 * Implements intelligent, non-destructive filtering and deduplication
 * tailored for typical Indian commercial gyms (e.g., Cult.fit, Gold's Gym,
 * Anytime Fitness, local neighborhood gyms).
 *
 * Rules:
 * 1. Highlights exercises using equipment commonly available in Indian gyms.
 * 2. Non-standard equipment (e.g. gymnastic rings, ribbons, balance boards,
 *    sledgehammers, atlas stones) are filtered from default browsing but remain
 *    accessible via 'All Equipment' or direct search.
 * 3. Identifies and suppresses true duplicates (identical movement, same category,
 *    same equipment, differing only in casing, contributor id, or minor punctuation).
 * 4. Preserves intentional variations (e.g. Barbell vs Dumbbell, Flat vs Incline vs Decline,
 *    Romanian vs Conventional Deadlift, Close-grip vs Normal Bench Press).
 */

import { Exercise } from '../types';

export const STANDARD_INDIAN_GYM_EQUIPMENT: readonly string[] = Object.freeze([
  'Barbell',
  'Olympic Barbell',
  'EZ-Bar',
  'SZ-Bar',
  'Dumbbell',
  'Dumbbells',
  'Bench',
  'Flat Bench',
  'Incline Bench',
  'Decline Bench',
  'Cable Machine',
  'Cable',
  'Crossover',
  'Pulley',
  'Machine',
  'Smith Machine',
  'Leg Press',
  'Hack Squat',
  'Leg Extension',
  'Leg Curl',
  'Calf Raise Machine',
  'Lat Pulldown',
  'Seated Cable Row',
  'Chest Supported Row',
  'T-Bar Row',
  'Chest Press Machine',
  'Shoulder Press Machine',
  'Pec Fly Machine',
  'Pec Deck',
  'Assisted Pull-up Machine',
  'Dip Station',
  'Pull-up Bar',
  'Parallel Bars',
  'Bodyweight',
  "Captain's Chair",
  'Roman Chair',
  'Hyperextension Bench',
  'Back Extension Bench',
  'Ab Mat',
  'Decline Ab Bench',
  'Resistance Band',
  'Kettlebell',
  'Weight Belt',
  'Lifting Straps',
  'Foam Roller',
]);

export const NON_STANDARD_EQUIPMENT_KEYWORDS: readonly RegExp[] = Object.freeze([
  /\b(gymnastic\s*rings?|gym\s*rings?|rings?)\b/i,
  /\b(ribbons?|aerial\s*silks?|suspended\s*ribbons?)\b/i,
  /\b(balance\s*board|wobble\s*board)\b/i,
  /\b(bosu\s*ball|bosu)\b/i,
  /\b(sledge\s*hammer|sledgehammer)\b/i,
  /\b(tractor\s*tire|tire\s*flip)\b/i,
  /\b(chains?)\b/i,
  /\b(safety\s*squat\s*bar|ssb)\b/i,
  /\b(swiss\s*bar|football\s*bar)\b/i,
  /\b(atlas\s*stone|log\s*press|yoke|farmer'?s?\s*walk(\s*handles?)?)\b/i,
  /\b(reverse\s*hyper|belt\s*squat(\s*machine)?|glute\s*ham\s*developer|ghd)\b/i,
]);

export interface CatalogueFilterStats {
  totalReviewed: number;
  trueDuplicatesCount: number;
  validVariationsCount: number;
  eligibleIndianGymCount: number;
  nonStandardEquipmentCount: number;
  trueDuplicates: Array<{ id: string; name: string; duplicateOf: string }>;
  nonStandardExamples: Array<{ id: string; name: string; reason: string }>;
  validVariationExamples: Array<{ name: string; reason: string }>;
}

/**
 * Checks whether an exercise requires equipment not standard in Indian commercial gyms.
 */
export function isEligibleForIndianCommercialGym(exercise: Exercise): {
  isEligible: boolean;
  reason?: string;
} {
  // 1. Inspect equipment objects
  if (exercise.equipment && exercise.equipment.length > 0) {
    for (const eq of exercise.equipment) {
      const eqName = eq.name.trim();
      for (const pattern of NON_STANDARD_EQUIPMENT_KEYWORDS) {
        if (pattern.test(eqName)) {
          return {
            isEligible: false,
            reason: `Requires non-standard equipment: ${eqName}`,
          };
        }
      }
    }
  }

  // 2. Inspect exercise name for explicit non-standard equipment mentions
  for (const pattern of NON_STANDARD_EQUIPMENT_KEYWORDS) {
    if (pattern.test(exercise.name)) {
      return {
        isEligible: false,
        reason: `Movement requires non-standard equipment: ${exercise.name}`,
      };
    }
  }

  return { isEligible: true };
}

/**
 * Normalizes an exercise name to identify identical movements submitted by different contributors.
 */
export function normalizeExerciseMovementKey(exercise: Exercise): string {
  const normName = exercise.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const eqKey = (exercise.equipment || [])
    .map((e) => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').trim())
    .sort()
    .join('_');

  const catKey = exercise.category || 'other';

  return `${normName}::${catKey}::${eqKey}`;
}

/**
 * Filter catalogue for Indian Commercial Gyms.
 * Suppresses true duplicates and non-standard equipment from default browsing while retaining
 * full access for search or when 'All Equipment' is requested.
 */
export function filterCatalogueForIndianGym(
  exercises: Exercise[],
  options: {
    includeNonStandardEquipment?: boolean;
    allowDuplicates?: boolean;
    isSearchActive?: boolean;
  } = {},
): {
  filtered: Exercise[];
  stats: CatalogueFilterStats;
} {
  const {
    includeNonStandardEquipment = false,
    allowDuplicates = false,
    isSearchActive = false,
  } = options;

  const seenKeys = new Map<string, Exercise>();
  const filtered: Exercise[] = [];
  const trueDuplicates: Array<{ id: string; name: string; duplicateOf: string }> = [];
  const nonStandardExamples: Array<{ id: string; name: string; reason: string }> = [];
  const validVariationExamples: Array<{ name: string; reason: string }> = [];

  let nonStandardEquipmentCount = 0;
  let trueDuplicatesCount = 0;
  let validVariationsCount = 0;
  let eligibleIndianGymCount = 0;

  for (const exercise of exercises) {
    const { isEligible, reason } = isEligibleForIndianCommercialGym(exercise);

    if (isEligible) {
      eligibleIndianGymCount++;
    } else {
      nonStandardEquipmentCount++;
      if (nonStandardExamples.length < 10) {
        nonStandardExamples.push({
          id: exercise.id,
          name: exercise.name,
          reason: reason || 'Non-standard commercial equipment',
        });
      }
    }

    // Check true duplicate
    const key = normalizeExerciseMovementKey(exercise);
    const existing = seenKeys.get(key);

    if (existing) {
      trueDuplicatesCount++;
      if (trueDuplicates.length < 10) {
        trueDuplicates.push({
          id: exercise.id,
          name: exercise.name,
          duplicateOf: `${existing.name} (${existing.id})`,
        });
      }
      if (!allowDuplicates && !isSearchActive) {
        continue;
      }
    } else {
      seenKeys.set(key, exercise);
      // Check if this exercise represents an intentional variation
      if (
        /incline|decline|dumbbell|barbell|close\s*grip|wide\s*grip|sumo|romanian|deficit/i.test(
          exercise.name,
        )
      ) {
        validVariationsCount++;
        if (validVariationExamples.length < 10) {
          validVariationExamples.push({
            name: exercise.name,
            reason: 'Intentional grip, angle, or implement variation',
          });
        }
      }
    }

    // If searching, always include matches regardless of gym equipment (user specifically searched for it)
    if (isSearchActive) {
      filtered.push(exercise);
      continue;
    }

    // Default browsing: filter out non-standard equipment unless explicitly included
    if (!isEligible && !includeNonStandardEquipment) {
      continue;
    }

    filtered.push(exercise);
  }

  return {
    filtered,
    stats: {
      totalReviewed: exercises.length,
      trueDuplicatesCount,
      validVariationsCount,
      eligibleIndianGymCount,
      nonStandardEquipmentCount,
      trueDuplicates,
      nonStandardExamples,
      validVariationExamples,
    },
  };
}
