import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WorkoutSession } from '../src/features/workout/types';
import {
  calculateProgressAnalytics,
  getPeriodDateRange,
  deriveFocusName,
  filterWorkoutsInDateRange,
} from '../src/features/performance/progressAnalytics';
import { ProgressOverviewCard } from '../src/features/performance/components/ProgressOverviewCard';
import { FocusProgressSection } from '../src/features/performance/components/FocusProgressSection';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

describe('BeBig 2.0 — Progress Analytics 2.0 Engine & UI', () => {
  const refDate = new Date('2026-10-14T12:00:00.000Z'); // Wednesday in week Oct 12 – 18, 2026

  const createWorkout = (
    id: string,
    name: string,
    startedAt: string,
    exercises: any[]
  ): WorkoutSession => ({
    id,
    name,
    startedAt,
    finishedAt: startedAt,
    status: 'completed',
    exercises,
    totalVolume: exercises.reduce(
      (sum, ex) =>
        sum +
        (ex.actualSets || []).reduce(
          (s: number, set: any) => s + (set.completed && set.weight > 0 ? set.weight * set.reps : 0),
          0
        ),
      0
    ),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Date Range & Period Engine', () => {
    test('computes calendar week range starting on Monday and ending on Sunday', () => {
      const week = getPeriodDateRange('week', refDate, 0);
      expect(week.start.getDay()).toBe(1); // Monday
      expect(week.end.getDay()).toBe(0); // Sunday
      expect(week.label).toBe('Oct 12 – 18');
    });

    test('computes calendar month range correctly', () => {
      const month = getPeriodDateRange('month', refDate, 0);
      expect(month.start.getDate()).toBe(1);
      expect(month.label).toContain('October');
      expect(month.label).toContain('2026');
    });

    test('filters workouts strictly within calendar week bounds without dropping records', () => {
      const workouts: WorkoutSession[] = [
        createWorkout('w_past', 'Legs', '2026-10-08T10:00:00.000Z', []), // Prior week
        createWorkout('w_curr', 'Chest', '2026-10-13T10:00:00.000Z', []), // Current week
      ];

      const weekRange = getPeriodDateRange('week', refDate, 0);
      const filtered = filterWorkoutsInDateRange(workouts, weekRange);

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('w_curr');
    });
  });

  describe('2. Multi-Period Overview Calculations', () => {
    test('calculates accurate volume, sets, active days, and period-over-period deltas', () => {
      const prevWorkout = createWorkout('w_prev', 'Push', '2026-10-06T10:00:00.000Z', [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          actualSets: [
            { id: 's1', setNumber: 1, weight: 100, reps: 5, completed: true },
            { id: 's2', setNumber: 2, weight: 100, reps: 5, completed: true },
          ],
        },
      ]); // 1000 kg, 2 sets

      const currWorkout = createWorkout('w_curr', 'Push', '2026-10-13T10:00:00.000Z', [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          actualSets: [
            { id: 's3', setNumber: 1, weight: 105, reps: 5, completed: true },
            { id: 's4', setNumber: 2, weight: 105, reps: 5, completed: true },
          ],
        },
      ]); // 1050 kg, 2 sets

      const analytics = calculateProgressAnalytics([prevWorkout, currWorkout], 'week', refDate);

      expect(analytics.overview.workoutCount).toBe(1);
      expect(analytics.overview.completedSetsCount).toBe(2);
      expect(analytics.overview.totalVolumeKg).toBe(1050);
      expect(analytics.overview.activeDaysCount).toBe(1);
      expect(analytics.overview.comparison).toBeDefined();
      expect(analytics.overview.comparison?.volumeDeltaKg).toBe(50);
      expect(analytics.overview.comparison?.volumePercentDelta).toBe(5); // +5%
    });

    test('truthfully handles empty current week without erasing historical data', () => {
      const historicalWorkout = createWorkout('w_hist', 'Legs', '2026-10-05T10:00:00.000Z', [
        {
          exerciseId: 'squat',
          exerciseName: 'Squat',
          actualSets: [{ id: 's1', setNumber: 1, weight: 120, reps: 5, completed: true }],
        },
      ]);

      const analytics = calculateProgressAnalytics([historicalWorkout], 'week', refDate);

      expect(analytics.hasAnyWorkouts).toBe(true);
      expect(analytics.hasPeriodWorkouts).toBe(false);
      expect(analytics.overview.workoutCount).toBe(0);
      expect(analytics.overview.totalVolumeKg).toBe(0);
      expect(analytics.focuses.length).toBeGreaterThan(0); // Focus library remains accessible!
    });
  });

  describe('3. Dynamic Workout Focus Discovery', () => {
    test('dynamically derives focus names from session title and exercise categories', () => {
      const workoutNamed = createWorkout('w1', 'Chest & Triceps Hypertrophy', '2026-10-12T10:00:00.000Z', []);
      expect(deriveFocusName(workoutNamed)).toBe('Chest & Triceps Hypertrophy');

      const genericWorkout = createWorkout('w2', 'Quick Workout', '2026-10-12T10:00:00.000Z', [
        { exerciseId: 'lat_pulldown', exerciseName: 'Lat Pulldown', categoryName: 'Back', actualSets: [] },
      ]);
      expect(deriveFocusName(genericWorkout)).toBe('Back Focus');
    });

    test('groups exercises, calculates status (improved/maintained/declining), and builds sparklines', () => {
      const session1 = createWorkout('s1', 'Upper Body', '2026-10-01T10:00:00.000Z', [
        {
          exerciseId: 'overhead_press',
          exerciseName: 'Overhead Press',
          actualSets: [{ id: 'oh1', setNumber: 1, weight: 50, reps: 6, completed: true }],
        },
        {
          exerciseId: 'pullups',
          exerciseName: 'Pull-ups',
          actualSets: [{ id: 'pu1', setNumber: 1, weight: 0, reps: 8, completed: true }], // Bodyweight
        },
      ]);

      const session2 = createWorkout('s2', 'Upper Body', '2026-10-08T10:00:00.000Z', [
        {
          exerciseId: 'overhead_press',
          exerciseName: 'Overhead Press',
          actualSets: [{ id: 'oh2', setNumber: 1, weight: 52.5, reps: 6, completed: true }], // +2.5 kg improved
        },
        {
          exerciseId: 'pullups',
          exerciseName: 'Pull-ups',
          actualSets: [{ id: 'pu2', setNumber: 1, weight: 0, reps: 10, completed: true }], // +2 reps improved
        },
      ]);

      const analytics = calculateProgressAnalytics([session1, session2], 'all_time', refDate);
      const upperFocus = analytics.focuses.find((f) => f.name === 'Upper Body');

      expect(upperFocus).toBeDefined();
      expect(upperFocus?.workoutCount).toBe(2);
      expect(upperFocus?.improvedCount).toBe(2);

      const ohp = upperFocus?.exercises.find((e) => e.exerciseId === 'overhead_press');
      expect(ohp?.status).toBe('improved');
      expect(ohp?.weightDelta).toBe(2.5);
      expect(ohp?.sparkline.length).toBe(2);

      const pullups = upperFocus?.exercises.find((e) => e.exerciseId === 'pullups');
      expect(pullups?.isBodyweight).toBe(true);
      expect(pullups?.status).toBe('improved');
      expect(pullups?.repDelta).toBe(2);
    });
  });

  describe('4. UI Component Rendering & Interactions', () => {
    test('renders ProgressOverviewCard and handles period changes', async () => {
      const analytics = calculateProgressAnalytics([], 'week', refDate);
      const onSelectMock = jest.fn();

      const { getByTestId } = await render(
        <ProgressOverviewCard
          overview={analytics.overview}
          selectedPeriod="week"
          onSelectPeriod={onSelectMock}
        />
      );

      expect(getByTestId('progress-overview-card')).toBeTruthy();
      expect(getByTestId('analytics-period-selector')).toBeTruthy();
      expect(getByTestId('analytics-metrics-grid')).toBeTruthy();

      fireEvent.press(getByTestId('analytics-period-month'));
      expect(onSelectMock).toHaveBeenCalledWith('month');
    });

    test('renders FocusProgressSection with focus tabs and drilldown navigation', async () => {
      const session = createWorkout('s1', 'Leg Day', '2026-10-12T10:00:00.000Z', [
        {
          exerciseId: 'leg_press',
          exerciseName: 'Leg Press',
          categoryName: 'Legs',
          actualSets: [{ id: 'lp1', setNumber: 1, weight: 200, reps: 10, completed: true }],
        },
      ]);

      const analytics = calculateProgressAnalytics([session], 'all_time', refDate);

      const { getByTestId } = await render(
        <FocusProgressSection
          focuses={analytics.focuses}
          allExercises={analytics.allExercises}
        />
      );

      expect(getByTestId('focus-progress-section')).toBeTruthy();
      expect(getByTestId('focus-section-title')).toBeTruthy();
      expect(getByTestId('focus-pills-scroll')).toBeTruthy();
      expect(getByTestId('focus-summary-strip')).toBeTruthy();
      expect(getByTestId('focus-exercise-card-leg_press')).toBeTruthy();

      const drilldownButton = getByTestId('focus-drilldown-leg_press');
      fireEvent.press(drilldownButton);

      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/workout/progress/exercise/[id]',
        params: { id: 'leg_press', name: 'Leg Press' },
      });
    });

    test('renders FocusProgressSection empty state when no focuses exist', async () => {
      const { getByTestId, getByText } = await render(
        <FocusProgressSection focuses={[]} allExercises={[]} />
      );

      expect(getByTestId('focus-progress-section')).toBeTruthy();
      expect(getByText('No Workout Focuses Yet')).toBeTruthy();
    });

    test('renders selected focus metrics and recent sessions timeline', async () => {
      const s1 = createWorkout('s1', 'Chest & Triceps', '2026-10-01T10:00:00.000Z', [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          actualSets: [{ id: 'b1', setNumber: 1, weight: 80, reps: 8, completed: true }],
        },
      ]);
      const s2 = createWorkout('s2', 'Chest & Triceps', '2026-10-08T10:00:00.000Z', [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          actualSets: [{ id: 'b2', setNumber: 1, weight: 82.5, reps: 8, completed: true }],
        },
      ]);

      const analytics = calculateProgressAnalytics([s1, s2], 'all_time', refDate);
      const chestFocus = analytics.focuses.find((f) => f.name === 'Chest & Triceps');
      expect(chestFocus).toBeDefined();

      const { getByTestId, getByText } = await render(
        <FocusProgressSection
          focuses={analytics.focuses}
          allExercises={analytics.allExercises}
          initialFocusId={chestFocus?.id}
        />
      );

      expect(getByTestId('focus-count-improved')).toBeTruthy();
      expect(getByTestId('focus-timeline-section')).toBeTruthy();
      expect(getByTestId('focus-session-s2')).toBeTruthy();
      expect(getByText('Latest')).toBeTruthy();
      expect(getByText('Previous')).toBeTruthy();
    });
  });
});
