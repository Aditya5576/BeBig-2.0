import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { WorkoutSession } from '../src/features/workout';
import {
  calculateWeeklyPerformance,
  getCalendarWeekRange,
} from '../src/features/performance';
import { WeeklyPerformanceCard } from '../src/features/performance/WeeklyPerformanceCard';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      return callback?.();
    }, []);
  },
}));

describe('BeBig 2.0 — Weekly Performance Engine & UI (PERF-5G)', () => {
  const refDate = new Date('2026-10-03T12:00:00.000Z'); // Saturday in week Sep 28 - Oct 4, 2026

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. Current week workout count', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_curr_1',
        name: 'Upper Body A',
        startedAt: '2026-09-29T10:00:00.000Z',
        finishedAt: '2026-09-29T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [{ id: 's1', setNumber: 1, weight: 60, reps: 10, completed: true }],
          },
        ],
      },
      {
        id: 'w_curr_2',
        name: 'Lower Body A',
        startedAt: '2026-10-01T10:00:00.000Z',
        finishedAt: '2026-10-01T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_squat',
            exerciseName: 'Back Squat',
            order: 0,
            actualSets: [{ id: 's2', setNumber: 1, weight: 80, reps: 8, completed: true }],
          },
        ],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.activity.current.workouts).toBe(2);
  });

  test('2. Previous week workout count', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev_1',
        name: 'Upper Body Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        finishedAt: '2026-09-22T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [{ id: 's1', setNumber: 1, weight: 55, reps: 10, completed: true }],
          },
        ],
      },
      {
        id: 'w_curr_1',
        name: 'Upper Body Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        finishedAt: '2026-09-29T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [{ id: 's2', setNumber: 1, weight: 60, reps: 10, completed: true }],
          },
        ],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.activity.previous?.workouts).toBe(1);
  });

  test('3. Current week exercise count', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_curr_1',
        name: 'Full Body',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [
          { exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 60, reps: 10, completed: true }] },
          { exerciseId: 'ex_squat', exerciseName: 'Squat', order: 1, actualSets: [{ id: 's2', setNumber: 1, weight: 80, reps: 8, completed: true }] },
          { exerciseId: 'ex_row', exerciseName: 'Row', order: 2, actualSets: [{ id: 's3', setNumber: 1, weight: 50, reps: 10, completed: true }] },
        ],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.activity.current.exercises).toBe(3);
  });

  test('4. Current week set count', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_curr_1',
        name: 'Upper Body',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 60, reps: 10, completed: true },
              { id: 's2', setNumber: 2, weight: 60, reps: 8, completed: true },
              { id: 's3', setNumber: 3, weight: 55, reps: 10, completed: true },
            ],
          },
        ],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.activity.current.sets).toBe(3);
  });

  test('5. Progressed exercise count', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 55, reps: 10, completed: true }] }],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.summary.progressed).toBe(1);
    expect(result.summary.decreased).toBe(0);
    expect(result.summary.maintained).toBe(0);
  });

  test('6. Maintained exercise count', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.summary.maintained).toBe(1);
    expect(result.summary.progressed).toBe(0);
  });

  test('7. Decreased exercise count', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 45, reps: 10, completed: true }] }],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.summary.decreased).toBe(1);
    expect(result.summary.progressed).toBe(0);
  });

  test('8. Weight increase aggregation', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true },
              { id: 's2', setNumber: 2, weight: 50, reps: 10, completed: true },
            ],
          },
        ],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [
              { id: 's3', setNumber: 1, weight: 55, reps: 10, completed: true }, // +5 kg
              { id: 's4', setNumber: 2, weight: 52.5, reps: 10, completed: true }, // +2.5 kg
            ],
          },
        ],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.setChanges.weightIncreased).toBe(2);
  });

  test('9. Weight decrease aggregation', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 45, reps: 10, completed: true }] }],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.setChanges.weightDecreased).toBe(1);
  });

  test('10. Rep increase aggregation', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 50, reps: 12, completed: true }] }],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.setChanges.repsIncreased).toBe(1);
  });

  test('11. Rep decrease aggregation', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 50, reps: 7, completed: true }] }],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.setChanges.repsDecreased).toBe(1);
  });

  test('12. New set aggregation', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [
              { id: 's2', setNumber: 1, weight: 50, reps: 10, completed: true },
              { id: 's3', setNumber: 2, weight: 50, reps: 10, completed: true }, // new set
            ],
          },
        ],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.setChanges.newSets).toBe(1);
  });

  test('13. Removed set aggregation', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true },
              { id: 's2', setNumber: 2, weight: 50, reps: 10, completed: true },
            ],
          },
        ],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's3', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
    ];

    const result = calculateWeeklyPerformance(workouts, refDate);
    expect(result.setChanges.removedSets).toBe(1);
  });

  test('14. No current-week workout state', async () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_old',
        name: 'Old Workout',
        startedAt: '2026-09-01T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
    ];

    const summary = calculateWeeklyPerformance(workouts, refDate);
    expect(summary.hasCurrentWeekWorkouts).toBe(false);

    const { getByTestId } = await render(<WeeklyPerformanceCard summary={summary} />);
    expect(getByTestId('weekly-no-workouts-notice')).toBeTruthy();
  });

  test('15. No previous-week state', async () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_curr',
        name: 'First Ever Workout',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
    ];

    const summary = calculateWeeklyPerformance(workouts, refDate);
    expect(summary.hasCurrentWeekWorkouts).toBe(true);
    expect(summary.hasHistoricalComparison).toBe(false);

    const { getByTestId } = await render(<WeeklyPerformanceCard summary={summary} />);
    expect(getByTestId('weekly-no-prev-comparison-notice')).toBeTruthy();
  });

  test('16. Mixed changes state', async () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true },
              { id: 's2', setNumber: 2, weight: 50, reps: 10, completed: true },
            ],
          },
        ],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [
              { id: 's3', setNumber: 1, weight: 55, reps: 10, completed: true }, // Set 1: +5 kg (increase)
              { id: 's4', setNumber: 2, weight: 45, reps: 10, completed: true }, // Set 2: -5 kg (decrease)
            ],
          },
        ],
      },
    ];

    const summary = calculateWeeklyPerformance(workouts, refDate);
    expect(summary.summary.mixed).toBe(1);
    expect(summary.exerciseChanges[0].status).toBe('mixed');

    const { getByTestId } = await render(<WeeklyPerformanceCard summary={summary} />);
    expect(getByTestId('weekly-count-mixed')).toBeTruthy();
  });

  test('17. Exercise progression navigation', async () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w_prev',
        name: 'Prev',
        startedAt: '2026-09-22T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true }] }],
      },
      {
        id: 'w_curr',
        name: 'Curr',
        startedAt: '2026-09-29T10:00:00.000Z',
        status: 'completed',
        exercises: [{ exerciseId: 'ex_bench', exerciseName: 'Bench Press', order: 0, actualSets: [{ id: 's2', setNumber: 1, weight: 55, reps: 10, completed: true }] }],
      },
    ];

    const summary = calculateWeeklyPerformance(workouts, refDate);
    const { getByTestId } = await render(<WeeklyPerformanceCard summary={summary} />);

    const link = getByTestId('weekly-view-progression-ex_bench');
    expect(link).toBeTruthy();
    fireEvent.press(link);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/workout/progress/exercise/[id]',
      params: { id: 'ex_bench', name: 'Bench Press' },
    });
  });

});

