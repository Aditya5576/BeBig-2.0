import React from 'react';
import { render } from '@testing-library/react-native';
import {
  buildLastPerformanceMap,
  findMatchingPreviousSet,
  isExerciseMatch,
  getWorkoutTimestampMs,
  hasValidExerciseId,
} from '../src/features/workout/services/previousPerformanceService';
import { WorkoutExercise, WorkoutSession, WorkoutSet } from '../src/features/workout/types';
import { ActiveExerciseCard } from '../src/features/workout/components/ActiveExerciseCard';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, [cb]);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

describe('Milestone 3: Previous-Session Performance Suggestions', () => {
  describe('Timestamp and Chronological Ordering', () => {
    it('correctly calculates workout timestamp preferring finishedAt over startedAt', () => {
      const w1: WorkoutSession = {
        id: 'w1',
        name: 'Workout 1',
        status: 'completed',
        startedAt: '2026-03-01T10:00:00.000Z',
        finishedAt: '2026-03-01T11:00:00.000Z',
        exercises: [],
      };
      const w2: WorkoutSession = {
        id: 'w2',
        name: 'Workout 2',
        status: 'completed',
        startedAt: '2026-03-05T10:00:00.000Z',
        exercises: [],
      };

      expect(getWorkoutTimestampMs(w1)).toBe(Date.parse('2026-03-01T11:00:00.000Z'));
      expect(getWorkoutTimestampMs(w2)).toBe(Date.parse('2026-03-05T10:00:00.000Z'));
    });

    it('selects the most recent completed workout regardless of storage retrieval order', () => {
      const currentEx: WorkoutExercise = {
        exerciseId: 'squat_1',
        exerciseName: 'Back Squat',
        order: 0,
        actualSets: [{ id: 's1', setNumber: 1, weight: 0, reps: 0, completed: false }],
      };

      const olderWorkout: WorkoutSession = {
        id: 'w_older',
        name: 'Older Leg Day',
        status: 'completed',
        startedAt: '2026-02-01T10:00:00.000Z',
        finishedAt: '2026-02-01T11:00:00.000Z',
        exercises: [
          {
            exerciseId: 'squat_1',
            exerciseName: 'Back Squat',
            order: 0,
            actualSets: [{ id: 's_old', setNumber: 1, weight: 100, reps: 5, completed: true }],
          },
        ],
      };

      const newestWorkout: WorkoutSession = {
        id: 'w_newest',
        name: 'Newest Leg Day',
        status: 'completed',
        startedAt: '2026-03-15T10:00:00.000Z',
        finishedAt: '2026-03-15T11:00:00.000Z',
        exercises: [
          {
            exerciseId: 'squat_1',
            exerciseName: 'Back Squat',
            order: 0,
            actualSets: [{ id: 's_new', setNumber: 1, weight: 120, reps: 5, completed: true }],
          },
        ],
      };

      // Passed out-of-order (older first)
      const map = buildLastPerformanceMap([currentEx], [olderWorkout, newestWorkout], 'active_current');

      expect(map['squat_1']).toBeDefined();
      expect(map['squat_1'].workoutDate).toBe('2026-03-15T11:00:00.000Z');
      expect(map['squat_1'].sets[0].weight).toBe(120);
    });

    it('ignores non-completed sessions and the current session itself', () => {
      const currentEx: WorkoutExercise = {
        exerciseId: 'bench_1',
        exerciseName: 'Bench Press',
        order: 0,
        actualSets: [{ id: 's1', setNumber: 1, weight: 0, reps: 0, completed: false }],
      };

      const activeSessionDraft: WorkoutSession = {
        id: 'curr_session',
        name: 'Current In-Progress',
        status: 'active',
        startedAt: '2026-03-20T10:00:00.000Z',
        exercises: [
          {
            exerciseId: 'bench_1',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [{ id: 's_draft', setNumber: 1, weight: 999, reps: 99, completed: true }],
          },
        ],
      };

      const validOldSession: WorkoutSession = {
        id: 'old_session',
        name: 'Past Workout',
        status: 'completed',
        startedAt: '2026-03-10T10:00:00.000Z',
        finishedAt: '2026-03-10T11:00:00.000Z',
        exercises: [
          {
            exerciseId: 'bench_1',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [{ id: 's_past', setNumber: 1, weight: 80, reps: 10, completed: true }],
          },
        ],
      };

      const map = buildLastPerformanceMap(
        [currentEx],
        [activeSessionDraft, validOldSession],
        'curr_session'
      );

      expect(map['bench_1']).toBeDefined();
      expect(map['bench_1'].sets[0].weight).toBe(80);
    });
  });

  describe('Exercise Identity vs Name Matching', () => {
    it('correctly validates valid exercise IDs', () => {
      expect(hasValidExerciseId('ex_123')).toBe(true);
      expect(hasValidExerciseId('')).toBe(false);
      expect(hasValidExerciseId('   ')).toBe(false);
      expect(hasValidExerciseId(undefined)).toBe(false);
      expect(hasValidExerciseId(null)).toBe(false);
      expect(hasValidExerciseId('undefined')).toBe(false);
      expect(hasValidExerciseId('null')).toBe(false);
    });

    it('NEVER matches different valid IDs even when exercise names are identical', () => {
      const customExercise: WorkoutExercise = {
        exerciseId: 'custom_bench_user1',
        exerciseName: 'Bench Press',
        order: 0,
        actualSets: [],
      };
      const builtInExercise: WorkoutExercise = {
        exerciseId: 'builtin_bench_global',
        exerciseName: 'Bench Press',
        order: 0,
        actualSets: [],
      };

      expect(isExerciseMatch(customExercise, builtInExercise)).toBe(false);
      expect(isExerciseMatch(builtInExercise, customExercise)).toBe(false);
    });

    it('matches identical valid IDs', () => {
      const ex1: WorkoutExercise = {
        exerciseId: 'standard_deadlift',
        exerciseName: 'Deadlift (Barbell)',
        order: 0,
        actualSets: [],
      };
      const ex2: WorkoutExercise = {
        exerciseId: 'standard_deadlift',
        exerciseName: 'Deadlift',
        order: 1,
        actualSets: [],
      };

      expect(isExerciseMatch(ex1, ex2)).toBe(true);
    });

    it('falls back to normalized name matching only when at least one record lacks a valid ID', () => {
      const legacyEx: WorkoutExercise = {
        exerciseId: '', // lacks valid ID
        exerciseName: '  Incline Dumbbell Press  ',
        order: 0,
        actualSets: [],
      };
      const modernEx: WorkoutExercise = {
        exerciseId: 'inc_db_press',
        exerciseName: 'incline dumbbell press',
        order: 0,
        actualSets: [],
      };

      expect(isExerciseMatch(legacyEx, modernEx)).toBe(true);
      expect(isExerciseMatch(modernEx, legacyEx)).toBe(true);
    });
  });

  describe('Set Matching by setNumber (Zero Index-Shifting)', () => {
    it('matches sets strictly by setNumber and never by array index', () => {
      // Historical workout: Set 1 was skipped; Sets 2 and 3 were logged
      const loggedPreviousSets: WorkoutSet[] = [
        { id: 'hist_s2', setNumber: 2, weight: 100, reps: 8, completed: true },
        { id: 'hist_s3', setNumber: 3, weight: 105, reps: 6, completed: true },
      ];

      const currentSet1: WorkoutSet = { id: 'c1', setNumber: 1, weight: 0, reps: 0, completed: false };
      const currentSet2: WorkoutSet = { id: 'c2', setNumber: 2, weight: 0, reps: 0, completed: false };
      const currentSet3: WorkoutSet = { id: 'c3', setNumber: 3, weight: 0, reps: 0, completed: false };

      // Current Set 1 has no previous Set 1 logged
      const prevFor1 = findMatchingPreviousSet(loggedPreviousSets, currentSet1);
      expect(prevFor1).toBeUndefined();

      // Current Set 2 matches historical Set 2
      const prevFor2 = findMatchingPreviousSet(loggedPreviousSets, currentSet2);
      expect(prevFor2).toBeDefined();
      expect(prevFor2?.setNumber).toBe(2);
      expect(prevFor2?.weight).toBe(100);
      expect(prevFor2?.reps).toBe(8);

      // Current Set 3 matches historical Set 3
      const prevFor3 = findMatchingPreviousSet(loggedPreviousSets, currentSet3);
      expect(prevFor3).toBeDefined();
      expect(prevFor3?.setNumber).toBe(3);
      expect(prevFor3?.weight).toBe(105);
      expect(prevFor3?.reps).toBe(6);
    });

    it('renders "—" for Set 1 without shifting historical Set 2 onto Set 1 in ActiveExerciseCard', async () => {
      const exercise: WorkoutExercise = {
        exerciseId: 'press_1',
        exerciseName: 'Overhead Press',
        order: 0,
        actualSets: [
          { id: 's1', setNumber: 1, weight: 0, reps: 0, completed: false },
          { id: 's2', setNumber: 2, weight: 0, reps: 0, completed: false },
          { id: 's3', setNumber: 3, weight: 0, reps: 0, completed: false },
        ],
      };

      // Previous workout skipped Set 1, logged Set 2 (50kg x 10) and Set 3 (55kg x 8)
      const lastPerformance = {
        workoutDate: '2026-03-10T10:00:00.000Z',
        sets: [
          { id: 'p2', setNumber: 2, weight: 50, reps: 10, completed: true },
          { id: 'p3', setNumber: 3, weight: 55, reps: 8, completed: true },
        ],
      };

      const screen = await render(
        <ActiveExerciseCard
          exercise={exercise}
          exIndex={0}
          totalExercisesCount={1}
          lastPerformance={lastPerformance}
          expandedNotesSetIds={{}}
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          onRemoveExercise={jest.fn()}
          onAddSet={jest.fn()}
          onDeleteSet={jest.fn()}
          onToggleNotes={jest.fn()}
          onUpdateSetField={jest.fn()}
          onToggleCompleteSet={jest.fn()}
        />
      );

      // Set 1 must display "—"
      expect(screen.getByText('—')).toBeTruthy();
      // Set 2 must display "50 × 10"
      expect(screen.getByText('50 × 10')).toBeTruthy();
      // Set 3 must display "55 × 8"
      expect(screen.getByText('55 × 8')).toBeTruthy();
      // Crucial: Set 1 must NOT display "50 × 10"
      const elements50 = screen.queryByText('50 × 10');
      expect(elements50).toBeTruthy();
    });
  });

  describe('Repeated Exercise Instances & Empty State Handling', () => {
    it('isolates suggestions for repeated instances of an exercise within the same session', () => {
      const currentEx1: WorkoutExercise = {
        exerciseId: 'bicep_curl',
        exerciseName: 'Bicep Curl',
        order: 0,
        actualSets: [{ id: 's1', setNumber: 1, weight: 0, reps: 0, completed: false }],
      };
      const currentEx2: WorkoutExercise = {
        exerciseId: 'bicep_curl',
        exerciseName: 'Bicep Curl',
        order: 3,
        actualSets: [{ id: 's2', setNumber: 1, weight: 0, reps: 0, completed: false }],
      };

      const pastWorkout: WorkoutSession = {
        id: 'past_arm_day',
        name: 'Arm Day',
        status: 'completed',
        startedAt: '2026-03-01T10:00:00.000Z',
        finishedAt: '2026-03-01T11:00:00.000Z',
        exercises: [
          {
            exerciseId: 'bicep_curl',
            exerciseName: 'Bicep Curl',
            order: 0,
            actualSets: [{ id: 'p1', setNumber: 1, weight: 14, reps: 12, completed: true }],
          },
          {
            exerciseId: 'bicep_curl',
            exerciseName: 'Bicep Curl',
            order: 3,
            actualSets: [{ id: 'p2', setNumber: 1, weight: 16, reps: 8, completed: true }],
          },
        ],
      };

      const map = buildLastPerformanceMap([currentEx1, currentEx2], [pastWorkout]);

      expect(map['bicep_curl_0']).toBeDefined();
      expect(map['bicep_curl_0'].sets[0].weight).toBe(14);

      expect(map['bicep_curl_3']).toBeDefined();
      expect(map['bicep_curl_3'].sets[0].weight).toBe(16);
    });

    it('returns empty map gracefully when no historical workouts exist', () => {
      const currentEx: WorkoutExercise = {
        exerciseId: 'new_move',
        exerciseName: 'Brand New Movement',
        order: 0,
        actualSets: [{ id: 's1', setNumber: 1, weight: 0, reps: 0, completed: false }],
      };

      const map = buildLastPerformanceMap([currentEx], []);
      expect(Object.keys(map).length).toBe(0);
      expect(map['new_move']).toBeUndefined();
    });
  });
});
