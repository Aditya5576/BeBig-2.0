import React from 'react';
import { render, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react-native';
import ExerciseProgressionScreen from '../app/workout/progress/exercise/[id]';
import { workoutRepository, WorkoutSession } from '../src/features/workout';
import { useAuthStore } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { id?: string; name?: string } = { id: 'ex_bench', name: 'Barbell Bench Press' };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      return callback?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const getCompletedWorkoutsSpy = jest.spyOn(workoutRepository, 'getCompletedWorkouts');

describe('Milestone 9 — Checkpoint 3: Exercise Progression Screen Unit Tests', () => {
  const sampleWorkouts: WorkoutSession[] = [
    {
      id: 'w1',
      name: 'Push Hypertrophy',
      startedAt: '2026-09-01T10:00:00.000Z',
      finishedAt: '2026-09-01T11:00:00.000Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_bench',
          exerciseName: 'Barbell Bench Press',
          order: 0,
          actualSets: [
            { id: 's1', setNumber: 1, weight: 80, reps: 10, rir: 2, completed: true, notes: 'Felt strong' },
            { id: 's2', setNumber: 2, weight: 85, reps: 8, rir: 1, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w2',
      name: 'Push Deload',
      startedAt: '2026-09-03T10:00:00.000Z',
      finishedAt: '2026-09-03T10:45:00.000Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_bench',
          exerciseName: 'Barbell Bench Press',
          order: 0,
          actualSets: [
            { id: 's3', setNumber: 1, weight: 70, reps: 12, rir: 4, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w3',
      name: 'Push Heavy Day',
      startedAt: '2026-09-05T10:00:00.000Z',
      finishedAt: '2026-09-05T11:15:00.000Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_bench',
          exerciseName: 'Barbell Bench Press',
          order: 0,
          actualSets: [
            { id: 's4', setNumber: 1, weight: 95, reps: 3, rir: 0, completed: true, notes: 'New personal best!' },
          ],
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'ex_bench', name: 'Barbell Bench Press' };
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_progression_test', email: 'progression@test.com' } as any,
      session: { access_token: 'fake' } as any,
      isGuest: false,
    });
    useOnboardingStore.setState({
      daysPerWeek: 4,
      hasCompletedOnboarding: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no history exists for the exercise', async () => {
    mockParams = { id: 'ex_deadlift', name: 'Deadlift' };

    const { getByTestId, getByText } = await render(<ExerciseProgressionScreen />);

    await waitFor(
      () => {
        expect(getByTestId('progression-empty-state')).toBeTruthy();
        expect(getByText('No History Logged Yet')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    await act(async () => {
      fireEvent.press(getByTestId('progression-start-workout-button'));
    });
    expect(mockPush).toHaveBeenCalledWith('/workout/start');
  });

  it('renders populated progression screen with summary metrics, chronological history, and PR badges', async () => {
    const { getByTestId, queryByTestId, getByText } = await render(<ExerciseProgressionScreen />);

    await waitFor(
      () => {
        expect(getByTestId('progression-exercise-name')).toBeTruthy();
        expect(getByTestId('progression-history-list')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // Header exercise title
    expect(getByText('Barbell Bench Press')).toBeTruthy();

    // Summary metrics:
    // Max weight: 95 kg (from w3)
    expect(within(getByTestId('progression-card-max-weight')).getByText('95 kg')).toBeTruthy();
    // Sessions: 3
    expect(within(getByTestId('progression-card-sessions')).getByText('3')).toBeTruthy();
    // Volume: (80*10 + 85*8) + (70*12) + (95*3) = 1480 + 840 + 285 = 2,605 kg
    expect(within(getByTestId('progression-card-volume')).getByText('2,605 kg')).toBeTruthy();

    // Chronological sessions check:
    // Session 1 (w1, max 85kg) -> First session, runningMax was 0, so isPR = true
    expect(getByTestId('progression-session-card-w1')).toBeTruthy();
    expect(getByTestId('progression-pr-badge-w1')).toBeTruthy();

    // Session 2 (w2, max 70kg) -> 70 < 85, so isPR = false
    expect(getByTestId('progression-session-card-w2')).toBeTruthy();
    expect(queryByTestId('progression-pr-badge-w2')).toBeNull();

    // Session 3 (w3, max 95kg) -> 95 > 85, so isPR = true
    expect(getByTestId('progression-session-card-w3')).toBeTruthy();
    expect(getByTestId('progression-pr-badge-w3')).toBeTruthy();

    // Back navigation
    await act(async () => {
      fireEvent.press(getByTestId('progression-back-button'));
    });
    expect(mockBack).toHaveBeenCalled();
  });

  it('expands and collapses set breakdown with reps, weight, RIR, and notes', async () => {
    const { getByTestId, queryByTestId } = await render(<ExerciseProgressionScreen />);

    await waitFor(
      () => {
        expect(getByTestId('progression-session-card-w1')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // Initially collapsed
    expect(queryByTestId('progression-sets-table-w1')).toBeNull();

    // Toggle expand session w1
    await act(async () => {
      fireEvent.press(getByTestId('progression-toggle-sets-w1'));
    });

    expect(getByTestId('progression-sets-table-w1')).toBeTruthy();
    expect(getByTestId('progression-set-row-w1-1')).toBeTruthy();
    expect(getByTestId('progression-set-row-w1-2')).toBeTruthy();

    // Check set 1 notes
    expect(within(getByTestId('progression-set-notes-w1-1')).getByText(/Felt strong/)).toBeTruthy();

    // Toggle collapse
    await act(async () => {
      fireEvent.press(getByTestId('progression-toggle-sets-w1'));
    });
    expect(queryByTestId('progression-sets-table-w1')).toBeNull();
  });

  it('auto-deduces exercise name from workout history if name param is missing', async () => {
    mockParams = { id: 'ex_bench' }; // No name param

    const { getByTestId, getByText } = await render(<ExerciseProgressionScreen />);

    await waitFor(
      () => {
        expect(getByTestId('progression-exercise-name')).toBeTruthy();
        expect(getByText('Barbell Bench Press')).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });
});
