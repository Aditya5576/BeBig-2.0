import {
  filterCatalogueForIndianGym,
  isEligibleForIndianCommercialGym,
  normalizeExerciseMovementKey,
} from '../src/features/exercises/data/gymEquipmentFilter';
import { Exercise } from '../src/features/exercises/types';

describe('Indian Commercial Gym Catalogue Filter & Audit', () => {
  const sampleExercises: Exercise[] = [
    {
      id: 'ex_1',
      name: 'Barbell Bench Press',
      description: 'Standard flat bench press with barbell.',
      category: 'chest',
      categoryName: 'Chest',
      primaryMuscles: [{ id: 'm1', name: 'Chest' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq1', name: 'Barbell' }, { id: 'eq2', name: 'Bench' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_2',
      name: 'Incline Barbell Bench Press',
      description: 'Incline press for upper chest.',
      category: 'chest',
      categoryName: 'Chest',
      primaryMuscles: [{ id: 'm1', name: 'Chest' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq1', name: 'Barbell' }, { id: 'eq3', name: 'Incline bench' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_3',
      name: 'Dumbbell Bench Press',
      description: 'Flat press using dumbbells.',
      category: 'chest',
      categoryName: 'Chest',
      primaryMuscles: [{ id: 'm1', name: 'Chest' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq4', name: 'Dumbbell' }, { id: 'eq2', name: 'Bench' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_4_dup',
      name: 'Barbell Bench Press', // True duplicate of ex_1 from different contributor
      description: 'Duplicate submission of flat barbell bench.',
      category: 'chest',
      categoryName: 'Chest',
      primaryMuscles: [{ id: 'm1', name: 'Chest' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq1', name: 'Barbell' }, { id: 'eq2', name: 'Bench' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_5_rings',
      name: 'Ring Dips',
      description: 'Dips performed on suspended gymnastic rings.',
      category: 'chest',
      categoryName: 'Chest',
      primaryMuscles: [{ id: 'm1', name: 'Chest' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq_rings', name: 'Gymnastic rings' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_6_sledge',
      name: 'Sledgehammer Tire Slams',
      description: 'Conditioning with sledgehammer and tractor tire.',
      category: 'cardio',
      categoryName: 'Cardio',
      primaryMuscles: [{ id: 'm_core', name: 'Abs' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq_sledge', name: 'Sledgehammer' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_7_balance',
      name: 'Balance Board Squat',
      description: 'Squats on a wobble balance board.',
      category: 'legs',
      categoryName: 'Legs',
      primaryMuscles: [{ id: 'm_quads', name: 'Quadriceps' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq_board', name: 'Balance board' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_8_rdl',
      name: 'Romanian Deadlift',
      description: 'Posterior chain hip hinge targeting hamstrings.',
      category: 'legs',
      categoryName: 'Legs',
      primaryMuscles: [{ id: 'm_hams', name: 'Hamstrings' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq1', name: 'Barbell' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_9_deadlift',
      name: 'Conventional Deadlift',
      description: 'Full-body barbell pull.',
      category: 'back',
      categoryName: 'Back',
      primaryMuscles: [{ id: 'm_back', name: 'Lower Back' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq1', name: 'Barbell' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_10_closegrip',
      name: 'Close-Grip Barbell Bench Press',
      description: 'Tricep-focused barbell bench press variation.',
      category: 'arms',
      categoryName: 'Arms',
      primaryMuscles: [{ id: 'm_triceps', name: 'Triceps' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq1', name: 'Barbell' }, { id: 'eq2', name: 'Bench' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
  ];

  it('1. Correctly classifies standard vs non-standard gym equipment', () => {
    expect(isEligibleForIndianCommercialGym(sampleExercises[0]).isEligible).toBe(true);
    expect(isEligibleForIndianCommercialGym(sampleExercises[4]).isEligible).toBe(false); // Ring dips
    expect(isEligibleForIndianCommercialGym(sampleExercises[5]).isEligible).toBe(false); // Sledgehammer
    expect(isEligibleForIndianCommercialGym(sampleExercises[6]).isEligible).toBe(false); // Balance board
  });

  it('2. Suppresses true duplicates during default browsing', () => {
    const { filtered, stats } = filterCatalogueForIndianGym(sampleExercises);

    // ex_4_dup should be suppressed
    expect(filtered.some((e) => e.id === 'ex_4_dup')).toBe(false);
    expect(stats.trueDuplicatesCount).toBe(1);
    expect(stats.trueDuplicates[0].name).toBe('Barbell Bench Press');
  });

  it('3. Preserves intentional variations (Flat vs Incline vs DB, RDL vs Deadlift, Close-grip)', () => {
    const { filtered, stats } = filterCatalogueForIndianGym(sampleExercises);

    // Keep Flat, Incline, and Dumbbell Bench Press
    expect(filtered.some((e) => e.name === 'Barbell Bench Press')).toBe(true);
    expect(filtered.some((e) => e.name === 'Incline Barbell Bench Press')).toBe(true);
    expect(filtered.some((e) => e.name === 'Dumbbell Bench Press')).toBe(true);

    // Keep Romanian Deadlift and Conventional Deadlift
    expect(filtered.some((e) => e.name === 'Romanian Deadlift')).toBe(true);
    expect(filtered.some((e) => e.name === 'Conventional Deadlift')).toBe(true);

    // Keep Close-Grip Barbell Bench Press
    expect(filtered.some((e) => e.name === 'Close-Grip Barbell Bench Press')).toBe(true);

    expect(stats.validVariationsCount).toBeGreaterThan(0);
  });

  it('4. Excludes non-standard equipment from default browsing but keeps available when requested', () => {
    const defaultResult = filterCatalogueForIndianGym(sampleExercises, {
      includeNonStandardEquipment: false,
    });
    expect(defaultResult.filtered.some((e) => e.name === 'Ring Dips')).toBe(false);
    expect(defaultResult.filtered.some((e) => e.name === 'Sledgehammer Tire Slams')).toBe(false);

    // When searching or explicitly requested
    const allResult = filterCatalogueForIndianGym(sampleExercises, {
      includeNonStandardEquipment: true,
    });
    expect(allResult.filtered.some((e) => e.name === 'Ring Dips')).toBe(true);
    expect(allResult.filtered.some((e) => e.name === 'Sledgehammer Tire Slams')).toBe(true);
  });

  it('5. Allows direct search matches for non-standard equipment if user specifically queries them', () => {
    const searchResult = filterCatalogueForIndianGym(sampleExercises, {
      isSearchActive: true,
    });
    // Direct search shouldn't hide the matched item even if non-standard equipment
    expect(searchResult.filtered.some((e) => e.name === 'Ring Dips')).toBe(true);
  });
});
