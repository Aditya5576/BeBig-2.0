import React from 'react';
import { render, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react-native';
import PersonalRecordsScreen from '../app/workout/progress/prs';
import { workoutRepository, WorkoutSession } from '../src/features/workout';
import { useAuthStore } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
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

describe('Milestone 9 — Checkpoint 2: Personal Records Screen Unit Tests', () => {
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
            { id: 's1', setNumber: 1, weight: 80, reps: 10, rir: 2, completed: true },
            { id: 's2', setNumber: 2, weight: 85, reps: 8, rir: 1, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w2',
      name: 'Push Strength',
      startedAt: '2026-09-03T10:00:00.000Z',
      finishedAt: '2026-09-03T11:15:00.000Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_bench',
          exerciseName: 'Barbell Bench Press',
          order: 0,
          actualSets: [
            { id: 's3', setNumber: 1, weight: 95, reps: 3, rir: 0, completed: true },
          ],
        },
        {
          exerciseId: 'ex_ohp',
          exerciseName: 'Overhead Press',
          order: 1,
          actualSets: [
            { id: 's4', setNumber: 1, weight: 55, reps: 6, rir: 1, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w3',
      name: 'Legs Day',
      startedAt: '2026-08-20T10:00:00.000Z',
      finishedAt: '2026-08-20T11:00:00.000Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_squat',
          exerciseName: 'Barbell Squat',
          order: 0,
          actualSets: [
            { id: 's5', setNumber: 1, weight: 130, reps: 5, rir: 2, completed: true },
          ],
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_prs_test', email: 'prs@test.com' } as any,
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

  it('renders empty state when there are no completed workouts', async () => {
    getCompletedWorkoutsSpy.mockResolvedValueOnce([]);

    const { getByTestId, getByText } = await render(<PersonalRecordsScreen />);

    await waitFor(
      () => {
        expect(getByTestId('prs-empty-state')).toBeTruthy();
        expect(getByText('No Personal Records Yet')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    await act(async () => {
      fireEvent.press(getByTestId('prs-start-workout-button'));
    });
    expect(mockPush).toHaveBeenCalledWith('/workout/start');
  });

  it('renders populated PRs list with summary metrics and navigates to exercise progression', async () => {
    const { getByTestId } = await render(<PersonalRecordsScreen />);

    await waitFor(
      () => {
        expect(getByTestId('prs-list')).toBeTruthy();
        expect(getByTestId('pr-card-ex_squat')).toBeTruthy();
        expect(getByTestId('pr-card-ex_bench')).toBeTruthy();
        expect(getByTestId('pr-card-ex_ohp')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // Summary highlights
    expect(within(getByTestId('prs-summary-total')).getByText('🏆 3')).toBeTruthy();
    expect(within(getByTestId('prs-summary-heaviest')).getByText('130 kg')).toBeTruthy();

    // Max weights per exercise card
    expect(within(getByTestId('pr-card-ex_squat')).getByText('130 kg')).toBeTruthy();
    expect(within(getByTestId('pr-card-ex_bench')).getByText('95 kg')).toBeTruthy();
    expect(within(getByTestId('pr-card-ex_ohp')).getByText('55 kg')).toBeTruthy();

    // Tap on an exercise PR row to navigate to progression screen
    await act(async () => {
      fireEvent.press(getByTestId('pr-item-ex_bench'));
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/workout/progress/exercise/[id]',
      params: { id: 'ex_bench', name: 'Barbell Bench Press' },
    });

    // Tap back button
    await act(async () => {
      fireEvent.press(getByTestId('prs-back-button'));
    });
    expect(mockBack).toHaveBeenCalled();
  });
});
