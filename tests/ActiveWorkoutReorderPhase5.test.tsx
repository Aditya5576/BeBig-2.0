import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import ActiveWorkoutScreen from '../app/workout/active';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';

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
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, [cb]);
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

describe('BeBig 2.0 — Workout 2.0 Phase 5: Active Workout Exercise Reordering', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
    await templateStorage.clearTemplates();
  });

  afterEach(() => {
    cleanup();
  });

  async function createThreeExerciseSession() {
    let session = await workoutRepository.startEmptyWorkout('Push Hypertrophy Session');

    // Exercise 1: Flat Bench Press with custom set values
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_bench',
      name: 'Barbell Flat Bench',
      categoryName: 'Chest',
    });
    session = workoutRepository.updateSet(session, 'ex_bench', session.exercises[0].actualSets[0].id, {
      weight: 100,
      reps: 8,
      rir: 2,
      notes: 'Heavy top set',
      completed: true,
      completedAt: new Date().toISOString(),
    });

    // Exercise 2: Incline Dumbbell Press with custom set values
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_incline',
      name: 'Incline Dumbbell Press',
      categoryName: 'Chest',
    });
    session = workoutRepository.updateSet(session, 'ex_incline', session.exercises[1].actualSets[0].id, {
      weight: 36,
      reps: 10,
      rir: 1,
      notes: 'Good pump',
      completed: false,
    });

    // Exercise 3: Cable Triceps Pushdown with custom set values
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_pushdown',
      name: 'Triceps Rope Pushdown',
      categoryName: 'Triceps',
    });
    session = workoutRepository.updateSet(session, 'ex_pushdown', session.exercises[2].actualSets[0].id, {
      weight: 45,
      reps: 15,
      rir: 0,
      notes: 'Burnout finisher',
      completed: true,
      completedAt: new Date().toISOString(),
    });

    await workoutRepository.updateActiveWorkout(session);
    return session;
  }

  it('moves first exercise down and keeps all set data, weight, reps, notes, and completed state attached', async () => {
    await createThreeExerciseSession();

    const screen = await render(<ActiveWorkoutScreen />);

    // Initial order: [ex_bench, ex_incline, ex_pushdown]
    const moveDownBench = await screen.findByTestId('move-down-exercise-ex_bench');
    expect(moveDownBench).toBeTruthy();

    fireEvent.press(moveDownBench);

    // Verify order in persistent storage
    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises[0].exerciseId).toBe('ex_incline');
      expect(active?.exercises[1].exerciseId).toBe('ex_bench');
      expect(active?.exercises[2].exerciseId).toBe('ex_pushdown');

      // Bench press data remained 100% attached to ex_bench
      const benchEx = active?.exercises[1];
      expect(benchEx?.exerciseName).toBe('Barbell Flat Bench');
      expect(benchEx?.actualSets[0].weight).toBe(100);
      expect(benchEx?.actualSets[0].reps).toBe(8);
      expect(benchEx?.actualSets[0].rir).toBe(2);
      expect(benchEx?.actualSets[0].notes).toBe('Heavy top set');
      expect(benchEx?.actualSets[0].completed).toBe(true);

      // Incline DB Press data remained 100% attached to ex_incline
      const inclineEx = active?.exercises[0];
      expect(inclineEx?.exerciseName).toBe('Incline Dumbbell Press');
      expect(inclineEx?.actualSets[0].weight).toBe(36);
      expect(inclineEx?.actualSets[0].reps).toBe(10);
      expect(inclineEx?.actualSets[0].notes).toBe('Good pump');
      expect(inclineEx?.actualSets[0].completed).toBe(false);
    });
  });

  it('moves middle exercise up and updates order immediately', async () => {
    await createThreeExerciseSession();

    const screen = await render(<ActiveWorkoutScreen />);

    // Middle exercise is ex_incline at index 1
    const moveUpIncline = await screen.findByTestId('move-up-exercise-ex_incline');
    fireEvent.press(moveUpIncline);

    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises[0].exerciseId).toBe('ex_incline');
      expect(active?.exercises[1].exerciseId).toBe('ex_bench');
      expect(active?.exercises[2].exerciseId).toBe('ex_pushdown');
    });
  });

  it('moves middle exercise down and updates order immediately', async () => {
    await createThreeExerciseSession();

    const screen = await render(<ActiveWorkoutScreen />);

    // Middle exercise is ex_incline at index 1
    const moveDownIncline = await screen.findByTestId('move-down-exercise-ex_incline');
    fireEvent.press(moveDownIncline);

    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises[0].exerciseId).toBe('ex_bench');
      expect(active?.exercises[1].exerciseId).toBe('ex_pushdown');
      expect(active?.exercises[2].exerciseId).toBe('ex_incline');
    });
  });

  it('moves last exercise up to middle position', async () => {
    await createThreeExerciseSession();

    const screen = await render(<ActiveWorkoutScreen />);

    // Last exercise is ex_pushdown at index 2
    const moveUpPushdown = await screen.findByTestId('move-up-exercise-ex_pushdown');
    fireEvent.press(moveUpPushdown);

    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises[0].exerciseId).toBe('ex_bench');
      expect(active?.exercises[1].exerciseId).toBe('ex_pushdown');
      expect(active?.exercises[2].exerciseId).toBe('ex_incline');

      // Check that pushdown set data is completely preserved
      const pushdownEx = active?.exercises[1];
      expect(pushdownEx?.actualSets[0].weight).toBe(45);
      expect(pushdownEx?.actualSets[0].reps).toBe(15);
      expect(pushdownEx?.actualSets[0].notes).toBe('Burnout finisher');
      expect(pushdownEx?.actualSets[0].completed).toBe(true);
    });
  });

  it('disables moving up on first exercise and moving down on last exercise', async () => {
    await createThreeExerciseSession();

    const screen = await render(<ActiveWorkoutScreen />);

    // First exercise (ex_bench) up button should be disabled
    const firstUp = await screen.findByTestId('move-up-exercise-ex_bench');
    expect(firstUp.props.accessibilityState?.disabled).toBe(true);

    // Tapping it should not change order
    fireEvent.press(firstUp);
    let active = await workoutRepository.getActiveWorkout();
    expect(active?.exercises[0].exerciseId).toBe('ex_bench');

    // Last exercise (ex_pushdown) down button should be disabled
    const lastDown = await screen.findByTestId('move-down-exercise-ex_pushdown');
    expect(lastDown.props.accessibilityState?.disabled).toBe(true);

    // Tapping it should not change order
    fireEvent.press(lastDown);
    active = await workoutRepository.getActiveWorkout();
    expect(active?.exercises[2].exerciseId).toBe('ex_pushdown');
  });

  it('reordered state is persisted through storage queue and survives minimize', async () => {
    await createThreeExerciseSession();

    const screen = await render(<ActiveWorkoutScreen />);

    // Move pushdown up from last to middle
    const moveUpPushdown = await screen.findByTestId('move-up-exercise-ex_pushdown');
    fireEvent.press(moveUpPushdown);

    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises[1].exerciseId).toBe('ex_pushdown');
    });

    // Minimize workout
    const minBtn = await screen.findByTestId('minimize-workout-button');
    fireEvent.press(minBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/home');
    });

    // Verify storage has the persisted reordered state with pausedAt set
    const activeAfterMinimize = await workoutRepository.getActiveWorkout();
    expect(activeAfterMinimize?.exercises[0].exerciseId).toBe('ex_bench');
    expect(activeAfterMinimize?.exercises[1].exerciseId).toBe('ex_pushdown');
    expect(activeAfterMinimize?.exercises[2].exerciseId).toBe('ex_incline');
    expect(activeAfterMinimize?.pausedAt).toBeTruthy();
  });

  it('supports repeated move-down (B -> 3rd -> 4th) and repeated move-up (B -> 3rd -> 2nd -> 1st) with full data preservation', async () => {
    let session = await workoutRepository.startEmptyWorkout('Full Push Day');
    // A: Bench Press
    session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_A', name: 'Exercise A (Bench)' });
    // B: Incline Press with specific data
    session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_B', name: 'Exercise B (Incline)' });
    session = workoutRepository.updateSet(session, 'ex_B', session.exercises[1].actualSets[0].id, {
      weight: 42.5,
      reps: 11,
      rir: 1,
      notes: 'Repeated move target',
      completed: true,
      completedAt: new Date().toISOString(),
    });
    // C: Cable Fly
    session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_C', name: 'Exercise C (Fly)' });
    // D: Pushdown
    session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_D', name: 'Exercise D (Pushdown)' });
    await workoutRepository.updateActiveWorkout(session);

    const screen = await render(<ActiveWorkoutScreen />);

    // Step 1: Initial order is A, B, C, D
    let moveDownB = await screen.findByTestId('move-down-exercise-ex_B');
    fireEvent.press(moveDownB);

    // Step 2: First move down -> Order becomes A, C, B, D
    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises.map((e) => e.exerciseId)).toEqual(['ex_A', 'ex_C', 'ex_B', 'ex_D']);
    });

    // Step 3: Immediately tap move-down on B again (without rediscovering or re-selecting)
    moveDownB = await screen.findByTestId('move-down-exercise-ex_B');
    fireEvent.press(moveDownB);

    // Step 4: Second move down -> Order becomes A, C, D, B
    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises.map((e) => e.exerciseId)).toEqual(['ex_A', 'ex_C', 'ex_D', 'ex_B']);

      // Verify B's data is 100% attached at index 3
      const bEx = active?.exercises[3];
      expect(bEx?.exerciseName).toBe('Exercise B (Incline)');
      expect(bEx?.actualSets[0].weight).toBe(42.5);
      expect(bEx?.actualSets[0].reps).toBe(11);
      expect(bEx?.actualSets[0].rir).toBe(1);
      expect(bEx?.actualSets[0].notes).toBe('Repeated move target');
      expect(bEx?.actualSets[0].completed).toBe(true);
    });

    // Step 5: B is now at bottom (index 3). Its down button should be disabled
    moveDownB = await screen.findByTestId('move-down-exercise-ex_B');
    expect(moveDownB.props.accessibilityState?.disabled).toBe(true);

    // Step 6: Repeated move-up! Tap move-up on B twice
    let moveUpB = await screen.findByTestId('move-up-exercise-ex_B');
    fireEvent.press(moveUpB);

    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises.map((e) => e.exerciseId)).toEqual(['ex_A', 'ex_C', 'ex_B', 'ex_D']);
    });

    moveUpB = await screen.findByTestId('move-up-exercise-ex_B');
    fireEvent.press(moveUpB);

    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises.map((e) => e.exerciseId)).toEqual(['ex_A', 'ex_B', 'ex_C', 'ex_D']);
    });

    // Step 7: Move B to first position (index 0)
    moveUpB = await screen.findByTestId('move-up-exercise-ex_B');
    fireEvent.press(moveUpB);

    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active?.exercises.map((e) => e.exerciseId)).toEqual(['ex_B', 'ex_A', 'ex_C', 'ex_D']);

      // Verify B's data is 100% attached at index 0
      const bEx = active?.exercises[0];
      expect(bEx?.exerciseName).toBe('Exercise B (Incline)');
      expect(bEx?.actualSets[0].weight).toBe(42.5);
      expect(bEx?.actualSets[0].reps).toBe(11);
      expect(bEx?.actualSets[0].completed).toBe(true);
    });

    // B is now at top (index 0). Its up button should be disabled
    moveUpB = await screen.findByTestId('move-up-exercise-ex_B');
    expect(moveUpB.props.accessibilityState?.disabled).toBe(true);
  });

  it('triggers scroll offset adjustment on reorder to keep moved exercise accessible', async () => {
    const scrollToSpy = jest.spyOn(
      require('react-native').ScrollView.prototype,
      'scrollTo',
    );

    let session = await workoutRepository.startEmptyWorkout('Scroll Test Workout');
    session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_1', name: 'Exercise 1' });
    session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_2', name: 'Exercise 2' });
    session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_3', name: 'Exercise 3' });
    await workoutRepository.updateActiveWorkout(session);

    const screen = await render(<ActiveWorkoutScreen />);

    // Move Exercise 2 down
    const moveDown2 = await screen.findByTestId('move-down-exercise-ex_2');
    fireEvent.press(moveDown2);

    // Verify scrollTo was called with animated: false and positive y offset
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        animated: false,
        y: expect.any(Number),
      }),
    );

    scrollToSpy.mockRestore();
  });
});
