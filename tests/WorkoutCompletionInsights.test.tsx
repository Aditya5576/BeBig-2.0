import React from 'react';
import { render, waitFor, act, cleanup, screen } from '@testing-library/react-native';
import WorkoutSummaryScreen from '../app/workout/summary';
import { workoutRepository, WorkoutSession } from '../src/features/workout';
import { useAuthStore } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { id?: string } = { id: 'w2' };

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
    }, []);
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const getCompletedWorkoutsSpy = jest.spyOn(workoutRepository, 'getCompletedWorkouts');
const getCompletedWorkoutByIdSpy = jest.spyOn(workoutRepository, 'getCompletedWorkoutById');

describe('BeBig 2.0 — Workout Completion Insights (PERF-5F)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'w2' };
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_perf_insights_test', email: 'insights@test.com' } as any,
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

  test('1. First workout state (no previous workout to compare)', async () => {
    mockParams = { id: 'w1' };
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'First Chest Workout',
        startedAt: '2026-03-01T10:00:00.000Z',
        finishedAt: '2026-03-01T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }],
          },
        ],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[0]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    await act(async () => {
      render(<WorkoutSummaryScreen />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('workout-insights-section')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-first-workout-notice')).toBeTruthy();
    expect(screen.getByTestId('insights-first-record-ex_bench')).toBeTruthy();
  });

  test('2. Previous workout found comparison', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Chest Session 1',
        startedAt: '2026-02-20T10:00:00.000Z',
        finishedAt: '2026-02-20T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }],
          },
        ],
      },
      {
        id: 'w2',
        name: 'Chest Session 2',
        startedAt: '2026-02-27T10:00:00.000Z',
        finishedAt: '2026-02-27T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [{ id: 's2', setNumber: 1, weight: 55, reps: 10, completed: true }],
          },
        ],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('workout-insights-section')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-exercise-ex_bench')).toBeTruthy();
  });

  test('3. Weight increase delta (+5 kg)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w2',
        name: 'Curr',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 55, reps: 10, completed: true }] }],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-set-delta-ex_bench-1')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-set-delta-ex_bench-1').props.children).toContain('↑ +5 kg');
  });

  test('4. Weight decrease delta (-2.5 kg)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w2',
        name: 'Curr',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 47.5, reps: 10, completed: true }] }],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-set-delta-ex_bench-1')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-set-delta-ex_bench-1').props.children).toContain('↓ -2.5 kg');
  });

  test('5. Rep increase delta (+5 reps)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w2',
        name: 'Curr',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 50, reps: 15, completed: true }] }],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-set-delta-ex_bench-1')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-set-delta-ex_bench-1').props.children).toContain('↑ +5 reps');
  });

  test('6. Rep decrease delta (-3 reps)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w2',
        name: 'Curr',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 50, reps: 7, completed: true }] }],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-set-delta-ex_bench-1')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-set-delta-ex_bench-1').props.children).toContain('↓ -3 reps');
  });

  test('7. Both weight and reps change delta (+5 kg  ↑ +2 reps)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w2',
        name: 'Curr',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 55, reps: 12, completed: true }] }],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-set-delta-ex_bench-1')).toBeTruthy();
    });

    const text = screen.getByTestId('insights-set-delta-ex_bench-1').props.children;
    expect(text).toContain('↑ +5 kg');
    expect(text).toContain('↑ +2 reps');
  });

  test('8. No change delta (— No change)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w2',
        name: 'Curr',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-set-delta-ex_bench-1')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-set-delta-ex_bench-1').props.children).toContain('— No change');
  });

  test('9. New set delta (NEW SET)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w2',
        name: 'Curr',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's2', setNumber: 1, weight: 50, reps: 10, completed: true },
              { id: 's3', setNumber: 2, weight: 50, reps: 8, completed: true },
            ],
          },
        ],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-set-delta-ex_bench-2')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-set-delta-ex_bench-2').props.children).toContain('NEW SET');
  });

  test('10. Removed set delta (SET REMOVED)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true },
              { id: 's2', setNumber: 2, weight: 50, reps: 10, completed: true },
            ],
          },
        ],
      },
      {
        id: 'w2',
        name: 'Curr',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's3', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-set-delta-ex_bench-2')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-set-delta-ex_bench-2').props.children).toContain('SET REMOVED');
  });

  test('11. Multiple exercises summary counts (progressed, maintained, decreased)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev Workout',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [
          { exerciseId: 'ex_ex1', exerciseName: 'Exercise 1', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] },
          { exerciseId: 'ex_ex2', exerciseName: 'Exercise 2', order: 1, actualSets: [{ id: 's2', setNumber: 1, weight: 40, reps: 10, completed: true }] },
          { exerciseId: 'ex_ex3', exerciseName: 'Exercise 3', order: 2, actualSets: [{ id: 's3', setNumber: 1, weight: 30, reps: 10, completed: true }] },
        ],
      },
      {
        id: 'w2',
        name: 'Curr Workout',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [
          { exerciseId: 'ex_ex1', exerciseName: 'Exercise 1', order: 0, actualSets: [{ id: 's4', setNumber: 1, weight: 55, reps: 10, completed: true }] }, // Progressed
          { exerciseId: 'ex_ex2', exerciseName: 'Exercise 2', order: 1, actualSets: [{ id: 's5', setNumber: 1, weight: 40, reps: 10, completed: true }] }, // Maintained
          { exerciseId: 'ex_ex3', exerciseName: 'Exercise 3', order: 2, actualSets: [{ id: 's6', setNumber: 1, weight: 25, reps: 10, completed: true }] }, // Decreased
        ],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-summary-header')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-count-progressed')).toBeTruthy();
    expect(screen.getByTestId('insights-count-maintained')).toBeTruthy();
    expect(screen.getByTestId('insights-count-decreased')).toBeTruthy();
  });

  test('12. View Full Progression navigation link', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Prev Workout',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w2',
        name: 'Curr Workout',
        startedAt: '2026-02-27T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 55, reps: 10, completed: true }] }],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('insights-view-progression-ex_bench')).toBeTruthy();
    });

    expect(screen.getByTestId('insights-view-progression-ex_bench')).toBeTruthy();
  });
});
