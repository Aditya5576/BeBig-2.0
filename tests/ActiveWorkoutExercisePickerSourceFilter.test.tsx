import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { useAuthStore } from '../src/features/auth/store/useAuthStore';
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

describe('ActiveWorkout Exercise Picker Source Filter', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();

    useAuthStore.setState({
      user: { id: 'usr_picker_source_test', email: 'athlete@bebig.app' } as any,
      status: 'authenticated',
      isGuest: false,
    });

    await workoutStorage.clearAllWorkouts();
    await customExerciseStorage.clearCustomExercises();
  });

  it('filters exercises by custom source correctly', async () => {
    // Mock WGER provider listExercises to avoid network timeout delays during tests
    const listExercisesSpy = jest
      .spyOn(exerciseRepository['provider'], 'listExercises')
      .mockImplementation(async (options) => {
        if (options?.source === 'custom') {
          return { exercises: [], totalCount: 0, hasMore: false };
        }
        return {
          exercises: [
            {
              id: 'wger_squat',
              name: 'Barbell Back Squat',
              category: 'legs',
              categoryName: 'Legs',
              primaryMuscles: [{ id: 'm1', name: 'Quadriceps' }],
              secondaryMuscles: [],
              equipment: [{ id: 'e1', name: 'Barbell' }],
              images: [],
              sourceProvider: 'wger',
              isCustom: false,
            } as any,
          ],
          totalCount: 1,
          hasMore: false,
        };
      });

    // 1. Create custom exercise for test user
    const customEx = await exerciseRepository.createCustomExercise({
      name: 'My Special Bicep Curl',
      category: 'arms',
      equipment: ['Dumbbell'],
      primaryMuscles: ['Biceps'],
    });

    // 2. Start an active workout
    let session = await workoutRepository.startEmptyWorkout('Source Filter Workout');
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'wger_bench',
      name: 'Bench Press',
      categoryName: 'Chest',
    });
    session = workoutRepository.updateSet(
      session,
      'wger_bench',
      session.exercises[0].actualSets[0].id,
      {
        weight: 80,
        reps: 10,
        completed: true,
      },
    );
    await workoutRepository.updateActiveWorkout(session);

    // 3. Render Active Workout Screen
    const { getByText, getByTestId, findByTestId, queryByText } = await render(
      <ActiveWorkoutScreen />,
    );

    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy();
    });

    // 4. Open Add Exercise Picker
    const addBtn = getByTestId('add-exercise-to-workout-button');
    await act(async () => {
      fireEvent.press(addBtn);
    });

    // Verify source filter row exists in picker
    const sourceRow = await findByTestId('picker-source-filter-row');
    expect(sourceRow).toBeTruthy();

    const allChip = getByTestId('picker-source-filter-all');
    const customChip = getByTestId('picker-source-filter-custom');
    const externalChip = getByTestId('picker-source-filter-external');

    expect(allChip).toBeTruthy();
    expect(customChip).toBeTruthy();
    expect(externalChip).toBeTruthy();

    // Reset spy call count before pressing filters
    listExercisesSpy.mockClear();

    // 5. Test "Custom" source filter
    await act(async () => {
      fireEvent.press(customChip);
    });

    await waitFor(() => {
      expect(getByText('My Special Bicep Curl')).toBeTruthy();
    });

    // Verify WGER provider listExercises was NOT invoked when Custom filter was selected
    expect(listExercisesSpy).not.toHaveBeenCalled();

    // 6. Test "External" source filter
    await act(async () => {
      fireEvent.press(externalChip);
    });

    await waitFor(() => {
      expect(queryByText('My Special Bicep Curl')).toBeNull();
      expect(getByText('Barbell Back Squat')).toBeTruthy();
    });
    expect(listExercisesSpy).toHaveBeenCalled();

    // 7. Select exercise and verify it is added to the active workout while preserving existing sets
    await act(async () => {
      fireEvent.press(allChip);
    });

    await waitFor(() => {
      expect(getByText('My Special Bicep Curl')).toBeTruthy();
      expect(getByText('Barbell Back Squat')).toBeTruthy();
    });

    const customExCard = getByTestId(`picker-exercise-${customEx.id}`);
    await act(async () => {
      fireEvent.press(customExCard);
    });

    // Verify both exercises exist in active workout and original set state is intact
    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy();
      expect(getByText('My Special Bicep Curl')).toBeTruthy();
    });

    const currentSession = await workoutRepository.getActiveWorkout();
    expect(currentSession?.exercises.length).toBe(2);
    expect(currentSession?.exercises[0].exerciseName).toBe('Bench Press');
    expect(currentSession?.exercises[0].actualSets[0].weight).toBe(80);
    expect(currentSession?.exercises[0].actualSets[0].reps).toBe(10);
    expect(currentSession?.exercises[1].exerciseName).toBe('My Special Bicep Curl');

    listExercisesSpy.mockRestore();
  });
});
