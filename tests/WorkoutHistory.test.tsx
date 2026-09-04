import React from 'react';
import { render, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import WorkoutHistoryScreen from '../app/workout/history';
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
const deleteCompletedWorkoutSpy = jest.spyOn(workoutRepository, 'deleteCompletedWorkout');
const alertSpy = jest.spyOn(Alert, 'alert');

describe('Milestone 9 — Checkpoint 4: Workout History Improvements Unit Tests', () => {
  let sampleWorkouts: WorkoutSession[];

  beforeEach(() => {
    jest.clearAllMocks();

    sampleWorkouts = [
      {
        id: 'w_sep5',
        name: 'Push Heavy Day',
        startedAt: '2026-09-05T10:00:00.000Z',
        finishedAt: '2026-09-05T11:15:00.000Z',
        status: 'completed',
        totalDuration: 4500,
        totalVolume: 5200,
        completedSetsCount: 15,
        exercises: [
          {
            exerciseId: 'bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [{ id: 's1', setNumber: 1, weight: 100, reps: 5, rir: 1, completed: true }],
          },
        ],
      },
      {
        id: 'w_sep3',
        name: 'Push Deload',
        startedAt: '2026-09-03T10:00:00.000Z',
        finishedAt: '2026-09-03T10:45:00.000Z',
        status: 'completed',
        totalDuration: 2700,
        totalVolume: 3100,
        completedSetsCount: 9,
        exercises: [
          {
            exerciseId: 'ohp',
            exerciseName: 'Overhead Press',
            order: 0,
            actualSets: [{ id: 's2', setNumber: 1, weight: 50, reps: 8, rir: 3, completed: true }],
          },
        ],
      },
      {
        id: 'w_sep1',
        name: 'Push Hypertrophy',
        startedAt: '2026-09-01T10:00:00.000Z',
        finishedAt: '2026-09-01T11:00:00.000Z',
        status: 'completed',
        totalDuration: 3600,
        totalVolume: 4800,
        completedSetsCount: 12,
        exercises: [
          {
            exerciseId: 'incline',
            exerciseName: 'Incline Dumbbell Press',
            order: 0,
            actualSets: [{ id: 's3', setNumber: 1, weight: 32, reps: 10, rir: 2, completed: true }],
          },
        ],
      },
      {
        id: 'w_aug28',
        name: 'Legs Heavy',
        startedAt: '2026-08-28T10:00:00.000Z',
        finishedAt: '2026-08-28T11:20:00.000Z',
        status: 'completed',
        totalDuration: 4800,
        totalVolume: 8200,
        completedSetsCount: 16,
        exercises: [
          {
            exerciseId: 'squat',
            exerciseName: 'Barbell Squat',
            order: 0,
            actualSets: [{ id: 's4', setNumber: 1, weight: 140, reps: 5, rir: 1, completed: true }],
          },
        ],
      },
      {
        id: 'w_aug25',
        name: 'Upper Body',
        startedAt: '2026-08-25T10:00:00.000Z',
        finishedAt: '2026-08-25T11:00:00.000Z',
        status: 'completed',
        totalDuration: 3600,
        totalVolume: 4500,
        completedSetsCount: 12,
        exercises: [
          {
            exerciseId: 'row',
            exerciseName: 'Barbell Row',
            order: 0,
            actualSets: [{ id: 's5', setNumber: 1, weight: 70, reps: 10, rir: 2, completed: true }],
          },
        ],
      },
    ];

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);
    deleteCompletedWorkoutSpy.mockResolvedValue();

    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_history_test', email: 'history@test.com' } as any,
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

  it('G. renders empty state when there are no completed workouts', async () => {
    getCompletedWorkoutsSpy.mockResolvedValueOnce([]);

    const { getByTestId, getByText } = await render(<WorkoutHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('history-empty-state')).toBeTruthy();
      expect(getByText('No workouts yet')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('history-start-workout-button'));
    });
    expect(mockPush).toHaveBeenCalledWith('/workout/start');
  });

  it('A & B. groups completed workouts by month and sorts newest -> oldest within each month', async () => {
    const { getByTestId, getByText } = await render(<WorkoutHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('history-grouped-list')).toBeTruthy();
      expect(getByTestId('history-month-section-2026-09')).toBeTruthy();
      expect(getByTestId('history-month-section-2026-08')).toBeTruthy();
    });

    // Month headers
    const sepHeader = getByTestId('history-month-header-2026-09');
    expect(within(sepHeader).getByText('September 2026')).toBeTruthy();
    expect(within(sepHeader).getByText('3 workouts')).toBeTruthy();

    const augHeader = getByTestId('history-month-header-2026-08');
    expect(within(augHeader).getByText('August 2026')).toBeTruthy();
    expect(within(augHeader).getByText('2 workouts')).toBeTruthy();

    // Verify September workouts are present in September section
    const sepSection = getByTestId('history-month-section-2026-09');
    expect(within(sepSection).getByTestId('history-card-w_sep5')).toBeTruthy();
    expect(within(sepSection).getByTestId('history-card-w_sep3')).toBeTruthy();
    expect(within(sepSection).getByTestId('history-card-w_sep1')).toBeTruthy();
    expect(within(sepSection).getByText('Push Heavy Day')).toBeTruthy();
    expect(within(sepSection).getByText('Push Deload')).toBeTruthy();
    expect(within(sepSection).getByText('Push Hypertrophy')).toBeTruthy();

    // Verify August workouts are present in August section
    const augSection = getByTestId('history-month-section-2026-08');
    expect(within(augSection).getByTestId('history-card-w_aug28')).toBeTruthy();
    expect(within(augSection).getByTestId('history-card-w_aug25')).toBeTruthy();
    expect(within(augSection).getByText('Legs Heavy')).toBeTruthy();
    expect(within(augSection).getByText('Upper Body')).toBeTruthy();
  });

  it('C. navigates to workout history detail when tapping a workout card and back button works', async () => {
    const { getByTestId } = await render(<WorkoutHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('history-card-w_sep5')).toBeTruthy();
    });

    // Tap on card content area to view detail
    await act(async () => {
      fireEvent.press(getByTestId('history-item-w_sep5'));
    });
    expect(mockPush).toHaveBeenCalledWith('/workout/history/w_sep5');

    // Tap header back button
    await act(async () => {
      fireEvent.press(getByTestId('workout-history-back-button'));
    });
    expect(mockBack).toHaveBeenCalled();
  });

  it('D & E. shows confirmation alert when delete is pressed and does NOT delete when canceled', async () => {
    const { getByTestId } = await render(<WorkoutHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('delete-workout-w_sep5')).toBeTruthy();
    });

    // Tap delete button for Push Heavy Day
    await act(async () => {
      fireEvent.press(getByTestId('delete-workout-w_sep5'));
    });

    // Verify alert appeared
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Delete Workout');
    expect(message).toContain('Push Heavy Day');
    expect(buttons).toHaveLength(2);

    const cancelButton = buttons?.find((b: any) => b.style === 'cancel');
    expect(cancelButton).toBeTruthy();

    // Simulate user pressing Cancel
    if (cancelButton?.onPress) {
      await act(async () => {
        cancelButton.onPress?.();
      });
    }

    // Deletion should NOT be called
    expect(deleteCompletedWorkoutSpy).not.toHaveBeenCalled();
  });

  it('F. removes ONLY the selected workout when delete is confirmed and refreshes history', async () => {
    let currentWorkouts = [...sampleWorkouts];
    getCompletedWorkoutsSpy.mockImplementation(async () => currentWorkouts);
    deleteCompletedWorkoutSpy.mockImplementation(async (id: string) => {
      currentWorkouts = currentWorkouts.filter((w) => w.id !== id);
    });

    const { getByTestId, queryByTestId } = await render(<WorkoutHistoryScreen />);

    await waitFor(() => {
      expect(getByTestId('delete-workout-w_sep5')).toBeTruthy();
    });

    // Tap delete button for w_sep5
    await act(async () => {
      fireEvent.press(getByTestId('delete-workout-w_sep5'));
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [, , buttons] = alertSpy.mock.calls[0];
    const deleteButton = buttons?.find((b: any) => b.style === 'destructive');
    expect(deleteButton).toBeTruthy();

    // Confirm deletion
    await act(async () => {
      await deleteButton?.onPress?.();
    });

    // Verify repository deletion was called for ONLY w_sep5
    expect(deleteCompletedWorkoutSpy).toHaveBeenCalledWith('w_sep5');
    expect(deleteCompletedWorkoutSpy).toHaveBeenCalledTimes(1);

    // Verify w_sep5 is gone from UI while w_sep3 remains
    await waitFor(() => {
      expect(queryByTestId('history-card-w_sep5')).toBeNull();
      expect(getByTestId('history-card-w_sep3')).toBeTruthy();
      expect(getByTestId('history-card-w_aug28')).toBeTruthy();
    });
  });
});
