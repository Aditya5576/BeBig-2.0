import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import ActiveWorkoutScreen from '../app/workout/active';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { platformStorage } from '../src/lib/storage';

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

describe('Milestone 2 — Active Workout Set-Deletion UI & Invariants', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    platformStorage.clearMemoryCache();
    await workoutStorage.clearAllWorkouts();
  });

  afterEach(() => {
    cleanup();
  });

  async function createMultiSetFixture() {
    let session = await workoutRepository.startEmptyWorkout('Set Deletion Test Session');

    // Add exercise with 3 sets
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_bench',
      name: 'Bench Press',
      categoryName: 'Chest',
    });

    // Set 1: 80kg x 8, RIR 2
    session = workoutRepository.updateSet(session, 'ex_bench', session.exercises[0].actualSets[0].id, {
      weight: 80,
      reps: 8,
      rir: 2,
      notes: 'First set note',
      completed: false,
    });

    // Add Set 2: 85kg x 6, RIR 1
    session = workoutRepository.addSetToExercise(session, 'ex_bench');
    session = workoutRepository.updateSet(session, 'ex_bench', session.exercises[0].actualSets[1].id, {
      weight: 85,
      reps: 6,
      rir: 1,
      notes: 'Second set note',
      completed: false,
    });

    // Add Set 3: 90kg x 4, RIR 0
    session = workoutRepository.addSetToExercise(session, 'ex_bench');
    session = workoutRepository.updateSet(session, 'ex_bench', session.exercises[0].actualSets[2].id, {
      weight: 90,
      reps: 4,
      rir: 0,
      notes: 'Third set note',
      completed: false,
    });

    await workoutRepository.updateActiveWorkout(session);
    return session;
  }

  it('1. renders delete button directly on each eligible uncompleted set row', async () => {
    await createMultiSetFixture();
    const screen = await render(<ActiveWorkoutScreen />);

    // Since there are 3 uncompleted sets, all 3 are eligible for deletion
    expect(await screen.findByTestId('delete-set-ex_bench-1')).toBeTruthy();
    expect(await screen.findByTestId('delete-set-ex_bench-2')).toBeTruthy();
    expect(await screen.findByTestId('delete-set-ex_bench-3')).toBeTruthy();
  });

  it('2. deleting a middle set preserves neighboring values and re-indexes set numbering', async () => {
    await createMultiSetFixture();
    const screen = await render(<ActiveWorkoutScreen />);

    // Tap delete button directly on set 2
    const deleteSet2Button = await screen.findByTestId('delete-set-ex_bench-2');
    fireEvent.press(deleteSet2Button);

    // After deleting set 2, there should now be exactly 2 sets
    await waitFor(async () => {
      const activeSession = await workoutRepository.getActiveWorkout();
      expect(activeSession?.exercises[0].actualSets).toHaveLength(2);
    });

    const active = await workoutRepository.getActiveWorkout();
    const sets = active!.exercises[0].actualSets;

    // Set 1 preserves original values
    expect(sets[0].setNumber).toBe(1);
    expect(sets[0].weight).toBe(80);
    expect(sets[0].reps).toBe(8);
    expect(sets[0].notes).toBe('First set note');

    // Former Set 3 is now Set 2, preserving its original 90kg x 4 values
    expect(sets[1].setNumber).toBe(2);
    expect(sets[1].weight).toBe(90);
    expect(sets[1].reps).toBe(4);
    expect(sets[1].notes).toBe('Third set note');
  });

  it('3. enforces minimum-one-set rule: last remaining set has no delete button', async () => {
    // Start session with single exercise and only 1 set
    let session = await workoutRepository.startEmptyWorkout('Single Set Session');
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_squat',
      name: 'Squat',
    });
    await workoutRepository.updateActiveWorkout(session);

    const screen = await render(<ActiveWorkoutScreen />);

    // Since there is only 1 set, delete button must NOT be rendered
    await screen.findByText('Squat');
    expect(screen.queryByTestId('delete-set-ex_squat-1')).toBeNull();

    // Direct repository guard also refuses deletion
    const attemptDelete = workoutRepository.removeSetFromExercise(
      session,
      'ex_squat',
      session.exercises[0].actualSets[0].id,
    );
    expect(attemptDelete.exercises[0].actualSets).toHaveLength(1);
  });

  it('4. completed set restrictions: completed sets cannot be deleted until uncompleted', async () => {
    await createMultiSetFixture();
    const screen = await render(<ActiveWorkoutScreen />);

    // Mark Set 1 as completed
    const completeSet1Button = await screen.findByTestId('complete-set-ex_bench-1');
    fireEvent.press(completeSet1Button);

    // Set 1 delete button disappears because it is completed
    await waitFor(() => {
      expect(screen.queryByTestId('delete-set-ex_bench-1')).toBeNull();
    });

    // Uncompleted sets (2 and 3) still have delete buttons
    expect(screen.getByTestId('delete-set-ex_bench-2')).toBeTruthy();
    expect(screen.getByTestId('delete-set-ex_bench-3')).toBeTruthy();

    // Direct repository guard also refuses deletion of completed set
    const currentSession = (await workoutRepository.getActiveWorkout())!;
    const attemptCompletedDelete = workoutRepository.removeSetFromExercise(
      currentSession,
      'ex_bench',
      currentSession.exercises[0].actualSets[0].id,
    );
    expect(attemptCompletedDelete.exercises[0].actualSets).toHaveLength(3);

    // Uncomplete Set 1 -> delete button reappears
    fireEvent.press(completeSet1Button);
    await waitFor(() => {
      expect(screen.getByTestId('delete-set-ex_bench-1')).toBeTruthy();
    });
  });

  it('5. immediate autosave persists set deletion to storage', async () => {
    await createMultiSetFixture();
    const screen = await render(<ActiveWorkoutScreen />);

    // Delete Set 3 directly
    const deleteSet3 = await screen.findByTestId('delete-set-ex_bench-3');
    fireEvent.press(deleteSet3);

    // Storage is immediately updated
    await waitFor(async () => {
      const persisted = await workoutRepository.getActiveWorkout();
      expect(persisted?.exercises[0].actualSets).toHaveLength(2);
      expect(persisted?.exercises[0].actualSets.map((s) => s.setNumber)).toEqual([1, 2]);
    });
  });

  it('6. renders DEL and NOTE headers and aligns table columns', async () => {
    await createMultiSetFixture();
    const screen = await render(<ActiveWorkoutScreen />);

    expect(await screen.findByText('DEL')).toBeTruthy();
    expect(await screen.findByText('NOTE')).toBeTruthy();
    expect(await screen.findByText('SET')).toBeTruthy();
    expect(await screen.findByText('PREV')).toBeTruthy();
    expect(await screen.findByText('KG')).toBeTruthy();
    expect(await screen.findByText('REPS')).toBeTruthy();
    expect(await screen.findByText('RIR')).toBeTruthy();
    expect((await screen.findAllByText('✓')).length).toBeGreaterThan(0);
  });
});
