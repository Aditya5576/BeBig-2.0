import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import ActiveWorkoutScreen from '../app/workout/active';

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
    user: { id: 'test_user_active_workout', email: 'athlete@bebig.app' },
    isGuest: false,
    signOut: jest.fn(),
    exitGuestMode: jest.fn(),
  };
  const useAuthStore = (selector: any) => selector(mockState);
  useAuthStore.getState = () => mockState;
  useAuthStore.setState = jest.fn();
  return {
    ...actual,
    useAuthStore,
  };
});

describe('BeBig 2.0 — Issue #9: Custom Exercise During Active Workout', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
    await customExerciseStorage.clearCustomExercises();
  });

  it('creates a custom exercise during active workout without resetting existing workout state', async () => {
    // 1. Create an active workout with logged sets and notes
    let session = await workoutRepository.startEmptyWorkout('Active Session Test');
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'wger_bench',
      name: 'Bench Press',
      categoryName: 'Chest',
    });

    // Update set 1 with completed state, weight, reps, notes
    session = workoutRepository.updateSet(
      session,
      'wger_bench',
      session.exercises[0].actualSets[0].id,
      {
        weight: 100,
        reps: 8,
        rir: 2,
        notes: 'First set felt smooth',
        completed: true,
        completedAt: new Date().toISOString(),
      },
    );

    await workoutRepository.updateActiveWorkout(session);

    // 2. Render Active Workout Screen
    const { getByText, getByTestId, findByTestId } = await render(<ActiveWorkoutScreen />);

    // Verify existing active workout state is rendered
    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy();
      expect(getByText('✓ Set 1 Completed')).toBeTruthy();
    });

    // 3. Open Add Exercise modal
    const addExBtn = getByTestId('add-exercise-to-workout-button');
    fireEvent.press(addExBtn);

    // 4. Tap + Custom button in picker header
    const createCustomBtn = await findByTestId('picker-create-custom-button');
    fireEvent.press(createCustomBtn);

    // 5. Enter Custom Exercise Details
    const nameInput = await findByTestId('custom-exercise-name-input');
    fireEvent.changeText(nameInput, 'Incline Smith Press');

    const catBtn = await findByTestId('category-select-chest');
    fireEvent.press(catBtn);

    // 6. Submit custom exercise creation
    const saveBtn = await findByTestId('save-custom-exercise-button');
    await act(async () => {
      fireEvent.press(saveBtn);
    });

    // 7. Verify newly created custom exercise is added to active workout
    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      expect(active).not.toBeNull();
      expect(active!.exercises).toHaveLength(2);
      expect(active!.exercises[1].exerciseName).toBe('Incline Smith Press');
      expect(active!.exercises[1].exerciseId).toMatch(/^custom_/);

      // Verify existing workout state is 100% intact!
      expect(active!.exercises[0].exerciseName).toBe('Bench Press');
      expect(active!.exercises[0].actualSets[0].weight).toBe(100);
      expect(active!.exercises[0].actualSets[0].reps).toBe(8);
      expect(active!.exercises[0].actualSets[0].notes).toBe('First set felt smooth');
      expect(active!.exercises[0].actualSets[0].completed).toBe(true);
    });

    // 8. Verify custom exercise was persisted with stable ID in storage
    const customList = await customExerciseStorage.getCustomExercises();
    expect(customList).toHaveLength(1);
    expect(customList[0].name).toBe('Incline Smith Press');
    expect(customList[0].isCustom).toBe(true);
    expect(customList[0].id).toMatch(/^custom_/);
  });

  it('handles guest scope custom exercise creation correctly', async () => {
    const guestScope = { ownerId: 'guest_user', ownerType: 'guest' as const };

    const created = await exerciseRepository.createCustomExercise(
      {
        name: 'Guest Cable Fly',
        category: 'chest',
        equipment: ['Cable'],
        primaryMuscles: ['Chest'],
      },
      guestScope,
    );

    expect(created.id).toMatch(/^custom_/);
    expect(created.name).toBe('Guest Cable Fly');
    expect(created.ownerType).toBe('guest');

    const guestCustoms = await customExerciseStorage.getCustomExercises(guestScope);
    expect(guestCustoms).toHaveLength(1);
    expect(guestCustoms[0].id).toBe(created.id);
  });

  it('prevents duplicate custom exercises from single creation action', async () => {
    const scope = { ownerId: 'auth_user_1', ownerType: 'authenticated' as const };

    const ex1 = await exerciseRepository.createCustomExercise(
      {
        name: 'Unique Hammer Curl',
        category: 'arms',
        primaryMuscles: ['Biceps'],
      },
      scope,
    );

    const customs = await customExerciseStorage.getCustomExercises(scope);
    expect(customs).toHaveLength(1);
    expect(customs[0].id).toBe(ex1.id);
  });
});
