import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';
import {
  extractRecentExerciseReferences,
  getRecentlyUsedExercises,
} from '../src/features/workout/services/recentExercisesService';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { WorkoutSession } from '../src/features/workout/types';
import { Exercise } from '../src/features/exercises/types';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

const mockSecureStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, val: string) => {
    mockSecureStore.set(key, val);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));

describe('BeBig 2.0 — Recently Used Exercises Feature', () => {
  const benchExercise: Exercise = {
    id: 'ex_bench',
    name: 'Barbell Bench Press',
    category: 'chest',
    categoryName: 'Chest',
    description: 'Flat barbell bench press',
    primaryMuscles: [{ id: 'm1', name: 'Chest' }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq1', name: 'Barbell' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
  };

  const squatExercise: Exercise = {
    id: 'ex_squat',
    name: 'Barbell Back Squat',
    category: 'legs',
    categoryName: 'Legs',
    description: 'Back squat with barbell',
    primaryMuscles: [{ id: 'm2', name: 'Quadriceps' }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq1', name: 'Barbell' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
  };

  const deadliftExercise: Exercise = {
    id: 'ex_deadlift',
    name: 'Conventional Deadlift',
    category: 'back',
    categoryName: 'Back',
    description: 'Conventional deadlift',
    primaryMuscles: [{ id: 'm3', name: 'Back' }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq1', name: 'Barbell' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
  };

  const inclineDumbbellExercise: Exercise = {
    id: 'ex_incline_db',
    name: 'Incline Dumbbell Press',
    category: 'chest',
    categoryName: 'Chest',
    description: 'Incline press with dumbbells',
    primaryMuscles: [{ id: 'm1', name: 'Upper Chest' }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq2', name: 'Dumbbell' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
  };

  const customLateralRaise: Exercise = {
    id: 'custom_lat_raise',
    name: 'Cable Lateral Raise',
    category: 'shoulders',
    categoryName: 'Shoulders',
    description: 'Single arm cable lateral raise',
    primaryMuscles: [{ id: 'm4', name: 'Lateral Deltoid' }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq3', name: 'Cable' }],
    images: [],
    sourceProvider: 'custom',
    isCustom: true,
  };

  const libraryExercises: Exercise[] = [
    benchExercise,
    squatExercise,
    deadliftExercise,
    inclineDumbbellExercise,
    customLateralRaise,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(exerciseRepository, 'getCachedExercises').mockReturnValue(libraryExercises);
    jest.spyOn(exerciseRepository, 'getExercises').mockResolvedValue({
      exercises: libraryExercises,
      totalCount: libraryExercises.length,
      hasMore: false,
    });
    jest.spyOn(customExerciseStorage, 'getCustomExercises').mockResolvedValue([customLateralRaise]);
  });

  afterEach(async () => {
    await cleanup();
  });

  // 1. RECENT EXERCISE EXTRACTION & ORDERING LOGIC
  describe('1. Recent Exercise Extraction & Ordering Logic', () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const pinnedNowMs = Date.UTC(2026, 10, 26, 12, 0, 0);
    const daysAgoIso = (days: number) => new Date(Date.now() - days * dayMs).toISOString();
    const completedSet = (id: string) => [
      { id, setNumber: 1, weight: 60, reps: 10, completed: true },
    ];

    it('returns empty array when history is empty or unavailable', () => {
      expect(extractRecentExerciseReferences([])).toEqual([]);
      expect(extractRecentExerciseReferences(null as any)).toEqual([]);
    });

    it('sorts exercises by newest workout date and deduplicates multiple occurrences', () => {
      // Workout 1: Oldest (9 days ago)
      const workout1: WorkoutSession = {
        id: 'w1',
        name: 'Full Body A',
        status: 'completed',
        startedAt: daysAgoIso(9),
        finishedAt: daysAgoIso(9),
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            categoryName: 'Chest',
            order: 0,
            actualSets: completedSet('s_w1_1'),
          },
          {
            exerciseId: 'ex_squat',
            exerciseName: 'Barbell Back Squat',
            categoryName: 'Legs',
            order: 1,
            actualSets: completedSet('s_w1_2'),
          },
        ],
      };

      // Workout 2: Middle (5 days ago)
      const workout2: WorkoutSession = {
        id: 'w2',
        name: 'Legs & Pull',
        status: 'completed',
        startedAt: daysAgoIso(5),
        finishedAt: daysAgoIso(5),
        exercises: [
          {
            exerciseId: 'ex_deadlift',
            exerciseName: 'Conventional Deadlift',
            categoryName: 'Back',
            order: 0,
            actualSets: completedSet('s_w2_1'),
          },
          {
            exerciseId: 'ex_squat', // Repeated squat, should not override newer 5d position over 9d
            exerciseName: 'Barbell Back Squat',
            categoryName: 'Legs',
            order: 1,
            actualSets: completedSet('s_w2_2'),
          },
        ],
      };

      // Workout 3: Newest (1 day ago)
      const workout3: WorkoutSession = {
        id: 'w3',
        name: 'Upper Hypertrophy',
        status: 'completed',
        startedAt: daysAgoIso(1),
        finishedAt: daysAgoIso(1),
        exercises: [
          {
            exerciseId: 'custom_lat_raise',
            exerciseName: 'Cable Lateral Raise',
            categoryName: 'Shoulders',
            order: 0,
            actualSets: completedSet('s_w3_1'),
          },
          {
            exerciseId: 'ex_bench', // Repeated bench, newest 1d ago
            exerciseName: 'Barbell Bench Press',
            categoryName: 'Chest',
            order: 1,
            actualSets: completedSet('s_w3_2'),
          },
        ],
      };

      // Pass in mixed order to verify chronological sorting
      const refs = extractRecentExerciseReferences([workout1, workout3, workout2]);

      expect(refs.map((r) => r.exerciseId)).toEqual([
        'custom_lat_raise',
        'ex_bench',
        'ex_deadlift',
        'ex_squat',
      ]);
    });

    it('deduplicates intra-workout repetitions of the same exercise', () => {
      const workout: WorkoutSession = {
        id: 'w_repeat',
        name: 'Chest Focus',
        status: 'completed',
        startedAt: daysAgoIso(2),
        finishedAt: daysAgoIso(2),
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            categoryName: 'Chest',
            order: 0,
            actualSets: completedSet('s_rep_1'),
          },
          {
            exerciseId: 'ex_incline_db',
            exerciseName: 'Incline Dumbbell Press',
            categoryName: 'Chest',
            order: 1,
            actualSets: completedSet('s_rep_2'),
          },
          {
            exerciseId: 'ex_bench', // Repeated in same session
            exerciseName: 'Barbell Bench Press',
            categoryName: 'Chest',
            order: 2,
            actualSets: completedSet('s_rep_3'),
          },
        ],
      };

      const refs = extractRecentExerciseReferences([workout]);
      expect(refs.length).toBe(2);
      expect(refs[0].exerciseId).toBe('ex_bench');
      expect(refs[1].exerciseId).toBe('ex_incline_db');
    });

    it('respects the limit option', () => {
      const workout: WorkoutSession = {
        id: 'w_limit',
        name: 'Full Body',
        status: 'completed',
        startedAt: new Date(pinnedNowMs - 2 * dayMs).toISOString(),
        finishedAt: new Date(pinnedNowMs - 2 * dayMs).toISOString(),
        exercises: [
          { exerciseId: 'ex1', exerciseName: 'E1', categoryName: 'Chest', order: 0, actualSets: completedSet('sl1') },
          { exerciseId: 'ex2', exerciseName: 'E2', categoryName: 'Back', order: 1, actualSets: completedSet('sl2') },
          { exerciseId: 'ex3', exerciseName: 'E3', categoryName: 'Legs', order: 2, actualSets: completedSet('sl3') },
        ],
      };

      const refs = extractRecentExerciseReferences([workout], 2, { nowMs: pinnedNowMs });
      expect(refs.length).toBe(2);
      expect(refs.map((r) => r.exerciseId)).toEqual(['ex1', 'ex2']);
    });
  });

  // 2. RECENT EXERCISES SERVICE RESOLUTION
  describe('2. Recent Exercises Service Resolution', () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const recentIso = new Date(Date.now() - 1 * dayMs).toISOString();

    it('resolves full exercise models with custom, cached, and treadmill entries', async () => {
      const workout: WorkoutSession = {
        id: 'w_res',
        name: 'Hybrid Routine',
        status: 'completed',
        startedAt: recentIso,
        finishedAt: recentIso,
        exercises: [
          {
            exerciseId: 'custom_lat_raise',
            exerciseName: 'Cable Lateral Raise',
            categoryName: 'Shoulders',
            order: 0,
            actualSets: [{ id: 'sr1', setNumber: 1, weight: 12, reps: 15, completed: true }],
          },
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            categoryName: 'Chest',
            order: 1,
            actualSets: [{ id: 'sr2', setNumber: 1, weight: 80, reps: 8, completed: true }],
          },
          {
            exerciseId: 'ex_unregistered',
            exerciseName: 'Synthesized Dip',
            categoryName: 'Chest',
            order: 2,
            actualSets: [{ id: 'sr3', setNumber: 1, weight: 0, reps: 12, completed: true }],
          },
        ],
      };

      jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([workout]);

      const exercises = await getRecentlyUsedExercises({ completedWorkouts: [workout] });

      expect(exercises.length).toBe(3);
      expect(exercises[0].id).toBe('custom_lat_raise');
      expect(exercises[0].isCustom).toBe(true);

      expect(exercises[1].id).toBe('ex_bench');
      expect(exercises[1].name).toBe('Barbell Bench Press');

      expect(exercises[2].id).toBe('ex_unregistered');
      expect(exercises[2].name).toBe('Synthesized Dip');
      expect(exercises[2].category).toBe('chest');
    });
  });

  // 3. EXERCISE PICKER MODAL UI INTEGRATION
  describe('3. ExercisePickerModal UI Integration', () => {
    const recentSample: Exercise[] = [benchExercise, customLateralRaise];

    it('renders Recently Used section above library list when history exists', async () => {
      const { getByTestId, queryByTestId } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          recentExercises={recentSample}
          multiSelect={false}
        />,
      );

      await waitFor(() => {
        expect(getByTestId('picker-recent-section')).toBeTruthy();
        expect(getByTestId('picker-recent-exercise-ex_bench')).toBeTruthy();
        expect(getByTestId('picker-recent-exercise-custom_lat_raise')).toBeTruthy();
      });
    });

    it('omits Recently Used section gracefully when recent list is empty', async () => {
      const { queryByTestId } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          recentExercises={[]}
          multiSelect={false}
        />,
      );

      await waitFor(() => {
        expect(queryByTestId('picker-recent-section')).toBeNull();
      });
    });

    it('selects exercise directly in single-select mode when tapping a recent card', async () => {
      const onSelectExerciseMock = jest.fn();
      const onCloseMock = jest.fn();

      const { getByTestId } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={onCloseMock}
          onSelectExercise={onSelectExerciseMock}
          recentExercises={recentSample}
          multiSelect={false}
        />,
      );

      await waitFor(() => {
        expect(getByTestId('picker-recent-exercise-ex_bench')).toBeTruthy();
      });

      fireEvent.press(getByTestId('picker-recent-exercise-ex_bench'));

      expect(onSelectExerciseMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ex_bench', name: 'Barbell Bench Press' }),
      );
      expect(onCloseMock).toHaveBeenCalled();
    });

    it('toggles selection and updates count in multi-select mode from recent section', async () => {
      const onSelectExercisesMock = jest.fn();

      const { getByTestId } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          onSelectExercises={onSelectExercisesMock}
          recentExercises={recentSample}
          multiSelect={true}
        />,
      );

      await waitFor(() => {
        expect(getByTestId('picker-recent-exercise-ex_bench')).toBeTruthy();
      });

      // Initially 0 selected
      expect(getByTestId('picker-add-exercises-button').props.accessibilityState?.disabled).toBe(true);

      // Select bench from recent section
      fireEvent.press(getByTestId('picker-recent-exercise-ex_bench'));

      await waitFor(() => {
        expect(getByTestId('picker-recent-checkbox-ex_bench')).toBeTruthy();
        expect(getByTestId('picker-add-exercises-button').props.accessibilityState?.disabled).toBe(false);
      });

      // Submit selection
      fireEvent.press(getByTestId('picker-add-exercises-button'));

      expect(onSelectExercisesMock).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ex_bench' }),
      ]);
    });

    it('disables already added exercises with ADDED badge in recent section', async () => {
      const { getByTestId } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          selectedExerciseIds={['ex_bench']}
          recentExercises={recentSample}
          multiSelect={true}
        />,
      );

      await waitFor(() => {
        expect(getByTestId('picker-recent-added-badge-ex_bench')).toBeTruthy();
      });
    });

    it('filters recently used exercises interactively when searching', async () => {
      const { getByTestId, queryByTestId } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          recentExercises={recentSample}
          multiSelect={false}
        />,
      );

      await waitFor(() => {
        expect(getByTestId('picker-recent-exercise-ex_bench')).toBeTruthy();
        expect(getByTestId('picker-recent-exercise-custom_lat_raise')).toBeTruthy();
      });

      // Search for "cable"
      fireEvent.changeText(getByTestId('picker-search-input'), 'cable');

      await waitFor(() => {
        expect(getByTestId('picker-recent-exercise-custom_lat_raise')).toBeTruthy();
        expect(queryByTestId('picker-recent-exercise-ex_bench')).toBeNull();
      });

      // Search for query matching no recent items -> recent section cleanly hidden
      fireEvent.changeText(getByTestId('picker-search-input'), 'nonexistent');

      await waitFor(() => {
        expect(queryByTestId('picker-recent-section')).toBeNull();
      });
    });

    it('filters recently used exercises when category filter is selected', async () => {
      const { getByTestId, queryByTestId } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          recentExercises={recentSample}
          multiSelect={false}
        />,
      );

      await waitFor(() => {
        expect(getByTestId('picker-recent-exercise-ex_bench')).toBeTruthy();
        expect(getByTestId('picker-recent-exercise-custom_lat_raise')).toBeTruthy();
      });

      // Select "Chest" category
      fireEvent.press(getByTestId('picker-category-filter-chest'));

      await waitFor(() => {
        expect(getByTestId('picker-recent-exercise-ex_bench')).toBeTruthy();
        expect(queryByTestId('picker-recent-exercise-custom_lat_raise')).toBeNull();
      });
    });
  });
});
