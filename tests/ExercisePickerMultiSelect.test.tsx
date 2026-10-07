import React from 'react';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';
import { exerciseRepository, Exercise } from '../src/features/exercises';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import ActiveWorkoutScreen from '../app/workout/active';
import { useAuthStore } from '../src/features/auth';

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

jest.mock('../src/features/auth', () => {
  const actual = jest.requireActual('../src/features/auth');
  const mockState = {
    user: { id: 'usr_picker_multi_test', email: 'athlete@bebig.app' },
    status: 'authenticated',
    isGuest: false,
    signOut: jest.fn(),
    exitGuestMode: jest.fn(),
  };
  const useAuthStore = (selector?: any) =>
    typeof selector === 'function' ? selector(mockState) : mockState;
  useAuthStore.getState = () => mockState;
  useAuthStore.setState = jest.fn();
  return {
    ...actual,
    useAuthStore,
  };
});

describe('BeBig 2.0 — Workout 2.0 Phase 2A: Exercise Picker Multi-Select', () => {
  const mockExercises: Exercise[] = [
    {
      id: 'ex_bench',
      name: 'Barbell Bench Press',
      category: 'chest',
      categoryName: 'Chest',
      description: 'Standard bench press',
      primaryMuscles: [{ id: 'm1', name: 'Pectorals' }],
      secondaryMuscles: [],
      equipment: [{ id: 'e1', name: 'Barbell' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_incline',
      name: 'Incline Dumbbell Press',
      category: 'chest',
      categoryName: 'Chest',
      description: 'Incline dumbbell press',
      primaryMuscles: [{ id: 'm1', name: 'Upper Chest' }],
      secondaryMuscles: [],
      equipment: [{ id: 'e2', name: 'Dumbbell' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_fly',
      name: 'Cable Fly',
      category: 'chest',
      categoryName: 'Chest',
      description: 'Cable fly',
      primaryMuscles: [{ id: 'm1', name: 'Chest' }],
      secondaryMuscles: [],
      equipment: [{ id: 'e3', name: 'Cable' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_pushdown',
      name: 'Triceps Pushdown',
      category: 'arms',
      categoryName: 'Arms',
      description: 'Triceps pushdown',
      primaryMuscles: [{ id: 'm2', name: 'Triceps' }],
      secondaryMuscles: [],
      equipment: [{ id: 'e3', name: 'Cable' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
    {
      id: 'ex_squat',
      name: 'Barbell Back Squat',
      category: 'legs',
      categoryName: 'Legs',
      description: 'Barbell back squat',
      primaryMuscles: [{ id: 'm3', name: 'Quadriceps' }],
      secondaryMuscles: [],
      equipment: [{ id: 'e1', name: 'Barbell' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
    await customExerciseStorage.clearCustomExercises();

    jest.spyOn(exerciseRepository, 'getExercises').mockImplementation(async (options) => {
      let filtered = [...mockExercises];

      if (options?.query) {
        const q = options.query.toLowerCase();
        filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
      }

      if (options?.category && options.category !== 'all') {
        filtered = filtered.filter((e) => e.category === options.category);
      }

      if (options?.source === 'custom') {
        filtered = filtered.filter((e) => e.isCustom);
      } else if (options?.source === 'external') {
        filtered = filtered.filter((e) => !e.isCustom);
      }

      const offset = options?.offset || 0;
      const limit = options?.limit || 30;
      const page = filtered.slice(offset, offset + limit);

      return {
        exercises: page,
        totalCount: filtered.length,
        hasMore: offset + limit < filtered.length,
        nextOffset: offset + limit < filtered.length ? offset + limit : undefined,
      };
    });

    jest.spyOn(exerciseRepository, 'getCachedExercises').mockReturnValue([]);
  });

  afterEach(async () => {
    cleanup();
    jest.restoreAllMocks();
  });

  // 1 & 4: Single exercise selection and selection count update
  it('1 & 4. selects a single exercise and updates selection button count to "ADD 1 EXERCISE"', async () => {
    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    const addBtn = getByTestId('picker-add-exercises-button');
    expect(addBtn.props.accessibilityState?.disabled).toBe(true);

    // Tap Bench Press
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_bench'));
    });

    // Count updates to ADD 1 EXERCISE and button enables
    await waitFor(() => {
      expect(getByText('ADD 1 EXERCISE')).toBeTruthy();
    });
    expect(getByTestId('picker-add-exercises-button').props.accessibilityState?.disabled).toBe(false);
  });

  // 2, 4 & 5: Select multiple exercises and add all at once
  it('2, 4 & 5. selects two exercises and adds them together via "ADD 2 EXERCISES"', async () => {
    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_bench'));
      fireEvent.press(getByTestId('picker-exercise-ex_incline'));
    });

    await waitFor(() => {
      expect(getByText('ADD 2 EXERCISES')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('picker-add-exercises-button'));
    });

    expect(onSelectExercises).toHaveBeenCalledTimes(1);
    const added = onSelectExercises.mock.calls[0][0];
    expect(added).toHaveLength(2);
    expect(added[0].id).toBe('ex_bench');
    expect(added[1].id).toBe('ex_incline');
    expect(onClose).toHaveBeenCalled();
  });

  // 3 & 4: Deselect exercise and selection count decrement
  it('3 & 4. deselects an exercise when tapped again and decrements button count', async () => {
    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    // Select Bench and Incline
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_bench'));
      fireEvent.press(getByTestId('picker-exercise-ex_incline'));
    });
    await waitFor(() => {
      expect(getByText('ADD 2 EXERCISES')).toBeTruthy();
    });

    // Deselect Incline
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_incline'));
    });
    await waitFor(() => {
      expect(getByText('ADD 1 EXERCISE')).toBeTruthy();
    });

    // Deselect Bench
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_bench'));
    });
    await waitFor(() => {
      expect(getByText('SELECT EXERCISES')).toBeTruthy();
    });
    expect(getByTestId('picker-add-exercises-button').props.accessibilityState?.disabled).toBe(true);
  });

  // 6: Preserves exact user selection order
  it('6. preserves exact selection order (e.g. Fly first, then Bench)', async () => {
    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    // Select Cable Fly first, then Bench Press
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_fly'));
      fireEvent.press(getByTestId('picker-exercise-ex_bench'));
    });

    await waitFor(() => {
      expect(getByText('ADD 2 EXERCISES')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(getByTestId('picker-add-exercises-button'));
    });

    expect(onSelectExercises).toHaveBeenCalledTimes(1);
    const added = onSelectExercises.mock.calls[0][0];
    expect(added[0].id).toBe('ex_fly');
    expect(added[1].id).toBe('ex_bench');
  });

  // 7: Search does not clear selection
  it('7. selection survives search queries and search clearing', async () => {
    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    // 1. Select Bench Press
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_bench'));
    });
    await waitFor(() => {
      expect(getByText('ADD 1 EXERCISE')).toBeTruthy();
    });

    // 2. Search for "Triceps"
    await act(async () => {
      fireEvent.changeText(getByTestId('picker-search-input'), 'Triceps');
    });
    await waitFor(() => {
      expect(getByText('Triceps Pushdown')).toBeTruthy();
    });

    // 3. Select Triceps Pushdown
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_pushdown'));
    });
    await waitFor(() => {
      expect(getByText('ADD 2 EXERCISES')).toBeTruthy();
    });

    // 4. Clear search query
    await act(async () => {
      fireEvent.changeText(getByTestId('picker-search-input'), '');
    });
    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    // Both remain selected!
    await waitFor(() => {
      expect(getByText('ADD 2 EXERCISES')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(getByTestId('picker-add-exercises-button'));
    });

    const added = onSelectExercises.mock.calls[0][0];
    expect(added).toHaveLength(2);
    expect(added[0].id).toBe('ex_bench');
    expect(added[1].id).toBe('ex_pushdown');
  });

  // 8 & 9: Filter changes (Category and Source) do not clear selection
  it('8 & 9. selection survives category filter and source filter switching', async () => {
    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    // Select Bench Press
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_bench'));
    });
    await waitFor(() => {
      expect(getByText('ADD 1 EXERCISE')).toBeTruthy();
    });

    // Switch Category to Legs
    await act(async () => {
      fireEvent.press(getByTestId('picker-category-filter-legs'));
    });
    await waitFor(() => {
      expect(getByText('Barbell Back Squat')).toBeTruthy();
    });

    // Select Squat
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_squat'));
    });
    await waitFor(() => {
      expect(getByText('ADD 2 EXERCISES')).toBeTruthy();
    });

    // Switch Source to External
    await act(async () => {
      fireEvent.press(getByTestId('picker-source-filter-external'));
    });
    await waitFor(() => {
      expect(getByText('ADD 2 EXERCISES')).toBeTruthy();
    });

    // Switch back to Category All
    await act(async () => {
      fireEvent.press(getByTestId('picker-category-filter-all'));
    });
    await waitFor(() => {
      expect(getByText('ADD 2 EXERCISES')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('picker-add-exercises-button'));
    });

    const added = onSelectExercises.mock.calls[0][0];
    expect(added).toHaveLength(2);
    expect(added[0].id).toBe('ex_bench');
    expect(added[1].id).toBe('ex_squat');
  });

  // 10 & 11: Pagination across pages preserves selection
  it('10 & 11. pagination onEndReached preserves selection across loaded pages', async () => {
    // Return 2 exercises on page 1, 2 on page 2
    jest.spyOn(exerciseRepository, 'getExercises').mockImplementation(async (options) => {
      const offset = options?.offset || 0;
      if (offset === 0) {
        return {
          exercises: [mockExercises[0], mockExercises[1]],
          totalCount: 4,
          hasMore: true,
          nextOffset: 2,
        };
      }
      return {
        exercises: [mockExercises[2], mockExercises[3]],
        totalCount: 4,
        hasMore: false,
        nextOffset: undefined,
      };
    });

    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    // Select item from Page 1
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_bench'));
    });
    await waitFor(() => {
      expect(getByText('ADD 1 EXERCISE')).toBeTruthy();
    });

    // Scroll to trigger load more
    const list = getByTestId('picker-exercise-list');
    await act(async () => {
      list.props.onEndReached();
    });

    await waitFor(() => {
      expect(getByText('Cable Fly')).toBeTruthy();
    });

    // Select item from Page 2
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_fly'));
    });
    await waitFor(() => {
      expect(getByText('ADD 2 EXERCISES')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('picker-add-exercises-button'));
    });

    const added = onSelectExercises.mock.calls[0][0];
    expect(added).toHaveLength(2);
    expect(added[0].id).toBe('ex_bench');
    expect(added[1].id).toBe('ex_fly');
  });

  // 12: Duplicate protection for exercises already in active workout
  it('12. disables selection for exercises already present in the active workout', async () => {
    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={['ex_bench']} // Bench is already in workout
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    const benchCard = getByTestId('picker-exercise-ex_bench');
    expect(benchCard.props.accessibilityState?.disabled).toBe(true);

    // Tapping disabled exercise does NOT select it
    await act(async () => {
      fireEvent.press(benchCard);
    });
    await waitFor(() => {
      expect(getByText('SELECT EXERCISES')).toBeTruthy();
    });
    expect(getByTestId('picker-add-exercises-button').props.accessibilityState?.disabled).toBe(true);

    // Added badge is visible
    expect(getByTestId('picker-added-badge-ex_bench')).toBeTruthy();
  });

  // 13 & 14: Cancel and close discard temporary selection
  it('13 & 14. closing or canceling the picker discards temporary selection', async () => {
    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText, rerender } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    // Select Bench Press
    await act(async () => {
      fireEvent.press(getByTestId('picker-exercise-ex_bench'));
    });
    await waitFor(() => {
      expect(getByText('ADD 1 EXERCISE')).toBeTruthy();
    });

    // Press Cancel
    await act(async () => {
      fireEvent.press(getByTestId('picker-close-button'));
    });
    expect(onClose).toHaveBeenCalled();
    expect(onSelectExercises).not.toHaveBeenCalled();

    // Reopen modal: verify selection starts empty
    rerender(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('SELECT EXERCISES')).toBeTruthy();
    });
    expect(getByTestId('picker-add-exercises-button').props.accessibilityState?.disabled).toBe(true);
  });

  // 15: Empty selection cannot Add
  it('15. disabled Add button prevents submitting when 0 exercises are selected', async () => {
    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    const addBtn = getByTestId('picker-add-exercises-button');
    expect(addBtn.props.accessibilityState?.disabled).toBe(true);

    await act(async () => {
      fireEvent.press(addBtn);
    });
    expect(onSelectExercises).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // 16: Custom exercise creation works inside picker
  it('16. creating custom exercise directly adds it to the workout session', async () => {
    const customCreated: Exercise = {
      id: 'custom_curls_123',
      name: 'Custom Hammer Curls',
      category: 'arms',
      categoryName: 'Arms',
      description: 'Custom arm curls',
      primaryMuscles: [],
      secondaryMuscles: [],
      equipment: [],
      images: [],
      sourceProvider: 'custom',
      isCustom: true,
    };

    jest.spyOn(exerciseRepository, 'createCustomExercise').mockResolvedValue(customCreated);

    const onSelectExercises = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelectExercises={onSelectExercises}
        selectedExerciseIds={[]}
      />,
    );

    await waitFor(() => {
      expect(getByText('Barbell Bench Press')).toBeTruthy();
    });

    // Open custom exercise form
    await act(async () => {
      fireEvent.press(getByTestId('picker-create-custom-button'));
    });

    await waitFor(() => {
      expect(getByTestId('custom-exercise-name-input')).toBeTruthy();
    });

    // Fill in name
    await act(async () => {
      fireEvent.changeText(getByTestId('custom-exercise-name-input'), 'Custom Hammer Curls');
    });

    // Submit
    await act(async () => {
      fireEvent.press(getByTestId('save-custom-exercise-button'));
    });

    await waitFor(() => {
      expect(onSelectExercises).toHaveBeenCalledWith([customCreated]);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // 17: Multi-exercise integration with ActiveWorkoutScreen
  it('17. ActiveWorkoutScreen adds multiple selected exercises atomically in order', async () => {
    // Start active workout with 1 exercise
    let session = await workoutRepository.startEmptyWorkout('Multi-Select Active Session');
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_squat',
      name: 'Barbell Back Squat',
      categoryName: 'Legs',
    });
    await workoutRepository.updateActiveWorkout(session);

    const screen = await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('add-exercise-to-workout-button')).toBeTruthy();
    });

    // Open exercise picker
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-exercise-to-workout-button'));
    });
    await waitFor(() => {
      expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
    });

    // Barbell Back Squat is already added (disabled)
    expect(screen.getByTestId('picker-exercise-ex_squat').props.accessibilityState?.disabled).toBe(true);

    // Select Incline Press, then Cable Fly
    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-exercise-ex_incline'));
      fireEvent.press(screen.getByTestId('picker-exercise-ex_fly'));
    });

    await waitFor(() => {
      expect(screen.getByText('ADD 2 EXERCISES')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-add-exercises-button'));
    });

    // Both exercises appear in Active Workout Screen in order!
    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises).toHaveLength(3);
      expect(active?.exercises[0].exerciseName).toBe('Barbell Back Squat');
      expect(active?.exercises[1].exerciseName).toBe('Incline Dumbbell Press');
      expect(active?.exercises[2].exerciseName).toBe('Cable Fly');
    });
  });
});
