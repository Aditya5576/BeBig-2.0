import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { workoutRepository, WorkoutSession } from '../src/features/workout';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
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

jest.mock('../src/features/auth', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { id: 'usr_test', email: 'test@example.com' },
      isGuest: false,
    }),
}));

describe('BeBig 2.0 — Last Time Performance in Active Workout', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
  });

  it('shows "No previous performance" when exercise has no completed history', async () => {
    const activeSession: WorkoutSession = {
      id: 'active_w1',
      name: 'Leg Day',
      status: 'active',
      startedAt: new Date().toISOString(),
      exercises: [
        {
          exerciseId: 'squat',
          exerciseName: 'Barbell Back Squat',
          categoryName: 'Legs',
          order: 0,
          actualSets: [
            {
              id: 'set_1',
              setNumber: 1,
              weight: 0,
              reps: 10,
              rir: 2,
              completed: false,
            },
          ],
        },
      ],
    };

    await workoutStorage.saveActiveWorkout(activeSession);

    const { getByTestId, getByText } = await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(getByTestId('last-time-empty-squat')).toBeTruthy();
      expect(getByText('No previous performance')).toBeTruthy();
    });
  });

  it('renders "LAST TIME" banner with previous sets (weight, reps, RIR) excluding current active session', async () => {
    const completedSession: WorkoutSession = {
      id: 'completed_w1',
      name: 'Leg Day Previous',
      status: 'completed',
      startedAt: '2026-09-10T10:00:00.000Z',
      finishedAt: '2026-09-10T11:00:00.000Z',
      totalDuration: 3600,
      totalVolume: 5000,
      completedSetsCount: 2,
      exercises: [
        {
          exerciseId: 'squat',
          exerciseName: 'Barbell Back Squat',
          categoryName: 'Legs',
          order: 0,
          actualSets: [
            { id: 'cs_1', setNumber: 1, weight: 100, reps: 5, rir: 2, completed: true },
            { id: 'cs_2', setNumber: 2, weight: 105, reps: 5, rir: 1, completed: true },
          ],
        },
      ],
    };

    const activeSession: WorkoutSession = {
      id: 'active_w2',
      name: 'Leg Day Today',
      status: 'active',
      startedAt: new Date().toISOString(),
      exercises: [
        {
          exerciseId: 'squat',
          exerciseName: 'Barbell Back Squat',
          categoryName: 'Legs',
          order: 0,
          actualSets: [
            {
              id: 'today_set_1',
              setNumber: 1,
              weight: 0,
              reps: 10,
              rir: 2,
              completed: false,
            },
          ],
        },
      ],
    };

    await workoutStorage.saveCompletedWorkout(completedSession);
    await workoutStorage.saveActiveWorkout(activeSession);

    const { getByTestId, getByText } = await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(getByTestId('last-time-performance-squat')).toBeTruthy();
    });

    expect(getByText(/100kg × 5 @ RIR 2/i)).toBeTruthy();
    expect(getByText(/105kg × 5 @ RIR 1/i)).toBeTruthy();

    // Verify today's workout set remains independent (weight 0, incomplete)
    const active = await workoutRepository.getActiveWorkout();
    expect(active?.exercises[0].actualSets[0].weight).toBe(0);
    expect(active?.exercises[0].actualSets[0].completed).toBe(false);
  });

  it('safely matches previous performance when exercise IDs differ between template and catalog but exercise names match', async () => {
    // Completed workout from custom template where exerciseId is 'ex_bench'
    const completedSession: WorkoutSession = {
      id: 'completed_tpl_w1',
      name: 'Chest Day Template',
      status: 'completed',
      startedAt: '2026-09-12T10:00:00.000Z',
      finishedAt: '2026-09-12T11:00:00.000Z',
      totalDuration: 3600,
      totalVolume: 4000,
      completedSetsCount: 2,
      exercises: [
        {
          exerciseId: 'ex_bench', // Custom template ID
          exerciseName: 'Barbell Bench Press',
          categoryName: 'Chest',
          order: 0,
          actualSets: [
            { id: 'ts_1', setNumber: 1, weight: 80, reps: 8, rir: 2, completed: true },
            { id: 'ts_2', setNumber: 2, weight: 80, reps: 8, rir: 1, completed: true },
          ],
        },
      ],
    };

    // Active workout where exercise was added from picker with 'seed-bench-press' ID
    const activeSession: WorkoutSession = {
      id: 'active_w3',
      name: 'Chest Today',
      status: 'active',
      startedAt: new Date().toISOString(),
      exercises: [
        {
          exerciseId: 'seed-bench-press', // Seed catalog ID
          exerciseName: 'Barbell Bench Press', // Same name
          categoryName: 'Chest',
          order: 0,
          actualSets: [
            {
              id: 'today_set_2',
              setNumber: 1,
              weight: 0,
              reps: 10,
              rir: 2,
              completed: false,
            },
          ],
        },
      ],
    };

    await workoutStorage.saveCompletedWorkout(completedSession);
    await workoutStorage.saveActiveWorkout(activeSession);

    const { getByTestId, getAllByText } = await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(getByTestId('last-time-performance-seed-bench-press')).toBeTruthy();
    });

    expect(getAllByText(/80kg × 8 @ RIR 2/i).length).toBeGreaterThan(0);
  });
});
