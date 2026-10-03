import React from 'react';
import { render, fireEvent, waitFor, act, cleanup, screen } from '@testing-library/react-native';
import ExerciseProgressionScreen from '../app/workout/progress/exercise/[id]';
import WorkoutHistoryDetailScreen from '../app/workout/history/[id]';
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

describe('BeBig 2.0 — Set-by-Set Exercise Progression Experience (PERF-5E)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'ex_bench', name: 'Barbell Bench Press' };
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_perf_ui_test', email: 'perf_ui@test.com' } as any,
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

  test('1. Exercise header renders resolved exercise name', async () => {
    getCompletedWorkoutsSpy.mockResolvedValue([]);

    await act(async () => {
      render(<ExerciseProgressionScreen />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('progression-exercise-name')).toBeTruthy();
    });
    expect(screen.getByTestId('progression-exercise-name').props.children).toBe('Barbell Bench Press');
  });

  test('2. Exact product requirement example: Week 1 (30x15, 35x10) -> Week 2 (35x15, 35x15)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Chest Press Week 1',
        startedAt: '2026-02-20T10:00:00.000Z',
        finishedAt: '2026-02-20T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 30, reps: 15, completed: true },
              { id: 's2', setNumber: 2, weight: 35, reps: 10, completed: true },
            ],
          },
        ],
      },
      {
        id: 'w2',
        name: 'Chest Press Week 2',
        startedAt: '2026-02-27T10:00:00.000Z',
        finishedAt: '2026-02-27T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's3', setNumber: 1, weight: 35, reps: 15, completed: true },
              { id: 's4', setNumber: 2, weight: 35, reps: 15, completed: true },
            ],
          },
        ],
      },
    ];

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-card-comparison')).toBeTruthy();
    });

    // Set 1: 30kg x 15 -> 35kg x 15 => ↑ +5 kg
    expect(screen.getByTestId('progression-set-delta-1')).toBeTruthy();
    expect(screen.getByTestId('progression-set-delta-1').props.children).toContain('↑ +5 kg');

    // Set 2: 35kg x 10 -> 35kg x 15 => ↑ +5 reps
    expect(screen.getByTestId('progression-set-delta-2')).toBeTruthy();
    expect(screen.getByTestId('progression-set-delta-2').props.children).toContain('↑ +5 reps');
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

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-set-delta-1')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-set-delta-1').props.children).toContain('↑ +5 kg');
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

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-set-delta-1')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-set-delta-1').props.children).toContain('↓ -2.5 kg');
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

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-set-delta-1')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-set-delta-1').props.children).toContain('↑ +5 reps');
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

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-set-delta-1')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-set-delta-1').props.children).toContain('↓ -3 reps');
  });

  test('7. Both weight and reps increase delta (+5 kg  ↑ +2 reps)', async () => {
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

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-set-delta-1')).toBeTruthy();
    });

    const deltaText = screen.getByTestId('progression-set-delta-1').props.children;
    expect(deltaText).toContain('↑ +5 kg');
    expect(deltaText).toContain('↑ +2 reps');
  });

  test('8. No change handling (— No change)', async () => {
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

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-set-delta-1')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-set-delta-1').props.children).toContain('— No change');
  });

  test('9. New set handling (NEW SET)', async () => {
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

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-set-delta-2')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-set-delta-2').props.children).toContain('NEW SET');
  });

  test('10. Removed set handling (SET REMOVED)', async () => {
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

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-set-delta-2')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-set-delta-2').props.children).toContain('SET REMOVED');
  });

  test('11. Quick Factual Summary counts (Increased, Decreased, Maintained)', async () => {
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
              { id: 's3', setNumber: 3, weight: 50, reps: 10, completed: true },
            ],
          },
        ],
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
              { id: 's4', setNumber: 1, weight: 55, reps: 10, completed: true }, // Increased
              { id: 's5', setNumber: 2, weight: 45, reps: 10, completed: true }, // Decreased
              { id: 's6', setNumber: 3, weight: 50, reps: 10, completed: true }, // Maintained
            ],
          },
        ],
      },
    ];

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-summary-increased')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-summary-increased')).toBeTruthy();
    expect(screen.getByTestId('progression-summary-decreased')).toBeTruthy();
    expect(screen.getByTestId('progression-summary-maintained')).toBeTruthy();
  });

  test('12. Chronological workout history renders set-by-set breakdowns', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Session 1',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
    ];

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-history-list')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-session-card-w1')).toBeTruthy();

    // Toggle set breakdown view
    fireEvent.press(screen.getByTestId('progression-toggle-sets-w1'));

    await waitFor(() => {
      expect(screen.getByTestId('progression-sets-table-w1')).toBeTruthy();
    });
    expect(screen.getByTestId('progression-set-row-w1-1')).toBeTruthy();
  });

  test('13. Empty history state (0 workouts)', async () => {
    getCompletedWorkoutsSpy.mockResolvedValue([]);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-empty-state')).toBeTruthy();
    });
  });

  test('14. Single workout history state (1 workout)', async () => {
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'First Session',
        startedAt: '2026-02-20T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
    ];

    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<ExerciseProgressionScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('progression-card-latest-summary')).toBeTruthy();
    });

    expect(screen.getByTestId('progression-single-performance-notice')).toBeTruthy();
  });

  test('15. Workout History detail renders SINCE LAST WORKOUT progression comparisons', async () => {
    mockParams = { id: 'w2' };
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Chest Press Week 1',
        startedAt: '2026-02-20T10:00:00.000Z',
        finishedAt: '2026-02-20T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_chest_press',
            exerciseName: 'Chest Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 30, reps: 15, completed: true },
              { id: 's2', setNumber: 2, weight: 35, reps: 10, completed: true },
            ],
          },
        ],
      },
      {
        id: 'w2',
        name: 'Chest Press Week 2',
        startedAt: '2026-02-27T10:00:00.000Z',
        finishedAt: '2026-02-27T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_chest_press',
            exerciseName: 'Chest Press',
            order: 0,
            actualSets: [
              { id: 's3', setNumber: 1, weight: 35, reps: 15, completed: true },
              { id: 's4', setNumber: 2, weight: 35, reps: 15, completed: true },
            ],
          },
        ],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[1]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutHistoryDetailScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('history-progression-ex_chest_press')).toBeTruthy();
    });

    expect(screen.getByTestId('history-comp-delta-ex_chest_press-1').props.children).toContain('↑ +5 kg');
    expect(screen.getByTestId('history-comp-delta-ex_chest_press-2').props.children).toContain('↑ +5 reps');
    expect(screen.getByTestId('history-view-full-progression-ex_chest_press')).toBeTruthy();
  });

  test('16. Workout History detail renders First recorded workout when no prior session exists', async () => {
    mockParams = { id: 'w1' };
    const sampleWorkouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Chest Press Week 1',
        startedAt: '2026-02-20T10:00:00.000Z',
        finishedAt: '2026-02-20T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_chest_press',
            exerciseName: 'Chest Press',
            order: 0,
            actualSets: [{ id: 's1', setNumber: 1, weight: 30, reps: 15, completed: true }],
          },
        ],
      },
    ];

    getCompletedWorkoutByIdSpy.mockResolvedValue(sampleWorkouts[0]);
    getCompletedWorkoutsSpy.mockResolvedValue(sampleWorkouts);

    render(<WorkoutHistoryDetailScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('history-first-record-ex_chest_press')).toBeTruthy();
    });
  });
});
