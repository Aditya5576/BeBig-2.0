import {
  formatDuration,
  formatVolume,
  formatStreak,
  formatWorkoutDate,
  getMonthGroupKey,
  getMonthGroupLabel,
  calculatePersonalRecords,
  getExerciseHistory,
  getAllExercisesFromHistory,
} from '../src/features/workout/utils/analytics';
import { WorkoutSession } from '../src/features/workout/types';

describe('Milestone 9 — Checkpoint 1: Core Analytics & Formatters Unit Tests', () => {
  // ============================================================================
  // 1. Formatters
  // ============================================================================
  describe('Formatters', () => {
    it('formatDuration handles 0, seconds only, minutes only, and mixed', () => {
      expect(formatDuration(0)).toBe('0 min');
      expect(formatDuration(undefined)).toBe('0 min');
      expect(formatDuration(45)).toBe('45s');
      expect(formatDuration(120)).toBe('2 min');
      expect(formatDuration(125)).toBe('2m 5s');
      expect(formatDuration(3665)).toBe('61m 5s');
    });

    it('formatVolume formats kilogram numbers with locale commas', () => {
      expect(formatVolume(0)).toBe('0 kg');
      expect(formatVolume(undefined)).toBe('0 kg');
      expect(formatVolume(450)).toBe('450 kg');
      expect(formatVolume(12450)).toBe('12,450 kg');
      expect(formatVolume(3500.4)).toBe('3,500 kg');
    });

    it('formatStreak handles 0 days, singular day, and plural days', () => {
      expect(formatStreak(0)).toBe('0 Days');
      expect(formatStreak(1)).toBe('1 Day');
      expect(formatStreak(5)).toBe('5 Days');
    });

    it('formatWorkoutDate formats ISO date strings', () => {
      expect(formatWorkoutDate(undefined)).toBe('Recent');
      expect(formatWorkoutDate('invalid')).toBe('Recent');
      const formatted = formatWorkoutDate('2026-09-01T10:00:00.000Z');
      expect(formatted).toContain('Sep');
      expect(formatted).toContain('2026');
    });

    it('getMonthGroupKey and getMonthGroupLabel return YYYY-MM key and Month Year label', () => {
      const key = getMonthGroupKey('2026-09-01T10:00:00.000Z');
      expect(key).toBe('2026-09');

      const label = getMonthGroupLabel('2026-09-01T10:00:00.000Z');
      expect(label).toContain('September');
      expect(label).toContain('2026');
    });
  });

  // ============================================================================
  // 2. Personal Records Extensions (allPRs)
  // ============================================================================
  describe('calculatePersonalRecords Extensions', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Push Routine',
        startedAt: '2026-09-01T10:00:00.000Z',
        finishedAt: '2026-09-01T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 80, reps: 8, rir: 2, completed: true },
              { id: 's2', setNumber: 2, weight: 100, reps: 5, rir: 1, completed: true },
            ],
          },
          {
            exerciseId: 'incline_db',
            exerciseName: 'Incline DB Press',
            order: 1,
            actualSets: [
              { id: 's3', setNumber: 1, weight: 32, reps: 10, rir: 1, completed: true },
            ],
          },
        ],
      },
      {
        id: 'w2',
        name: 'Push Routine 2',
        startedAt: '2026-09-04T10:00:00.000Z',
        finishedAt: '2026-09-04T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's4', setNumber: 1, weight: 105, reps: 3, rir: 0, completed: true },
            ],
          },
          {
            exerciseId: 'squat',
            exerciseName: 'Barbell Squat',
            order: 1,
            actualSets: [
              { id: 's5', setNumber: 1, weight: 140, reps: 5, rir: 2, completed: true },
            ],
          },
        ],
      },
    ];

    it('returns allPRs sorted descending by maxWeight and deduplicates per exercise', () => {
      const { allPRs, topPRs, totalPRsCount } = calculatePersonalRecords(workouts);

      expect(totalPRsCount).toBe(3); // squat, bench, incline_db
      expect(allPRs).toHaveLength(3);
      expect(topPRs).toHaveLength(3);

      // Heaviest first: Squat (140) > Bench (105) > Incline DB (32)
      expect(allPRs[0].exerciseId).toBe('squat');
      expect(allPRs[0].maxWeight).toBe(140);

      expect(allPRs[1].exerciseId).toBe('bench');
      expect(allPRs[1].maxWeight).toBe(105);

      expect(allPRs[2].exerciseId).toBe('incline_db');
      expect(allPRs[2].maxWeight).toBe(32);
    });

    it('returns empty allPRs when no workouts exist', () => {
      const { allPRs, totalPRsCount, topPRs } = calculatePersonalRecords([]);
      expect(totalPRsCount).toBe(0);
      expect(topPRs).toEqual([]);
      expect(allPRs).toEqual([]);
    });
  });

  // ============================================================================
  // 3. Exercise History Chronology & Aggregation
  // ============================================================================
  describe('getExerciseHistory', () => {
    const workouts: WorkoutSession[] = [
      // Second chronologically, but listed first in storage (newest first)
      {
        id: 'w2',
        name: 'Heavy Bench',
        startedAt: '2026-09-05T10:00:00.000Z',
        finishedAt: '2026-09-05T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's3', setNumber: 1, weight: 90, reps: 5, rir: 1, completed: true },
              { id: 's4', setNumber: 2, weight: 95, reps: 3, rir: 0, completed: true },
            ],
          },
        ],
      },
      // First chronologically
      {
        id: 'w1',
        name: 'Intro Bench',
        startedAt: '2026-09-01T10:00:00.000Z',
        finishedAt: '2026-09-01T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 80, reps: 10, rir: 2, completed: true },
              { id: 's2', setNumber: 2, weight: 85, reps: 8, rir: 1, completed: true },
              { id: 's_unf', setNumber: 3, weight: 90, reps: 0, rir: 0, completed: false }, // uncompleted
            ],
          },
        ],
      },
      // Third workout without bench press
      {
        id: 'w3',
        name: 'Legs Only',
        startedAt: '2026-09-07T10:00:00.000Z',
        finishedAt: '2026-09-07T11:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'squat',
            exerciseName: 'Barbell Squat',
            order: 0,
            actualSets: [
              { id: 's5', setNumber: 1, weight: 120, reps: 5, rir: 2, completed: true },
            ],
          },
        ],
      },
    ];

    it('returns entries sorted chronologically (oldest to newest)', () => {
      const history = getExerciseHistory(workouts, 'bench');
      expect(history).toHaveLength(2);

      // w1 is Sep 1, should be first
      expect(history[0].workoutId).toBe('w1');
      expect(history[0].maxWeight).toBe(85);
      expect(history[0].totalReps).toBe(18); // 10 + 8
      expect(history[0].volume).toBe(80 * 10 + 85 * 8); // 800 + 680 = 1480
      expect(history[0].sets).toHaveLength(2); // uncompleted set ignored

      // w2 is Sep 5, should be second
      expect(history[1].workoutId).toBe('w2');
      expect(history[1].maxWeight).toBe(95);
      expect(history[1].totalReps).toBe(8); // 5 + 3
      expect(history[1].volume).toBe(90 * 5 + 95 * 3); // 450 + 285 = 735
      expect(history[1].sets).toHaveLength(2);
    });

    it('returns empty array when exercise was never performed or workouts is empty', () => {
      expect(getExerciseHistory(workouts, 'deadlift')).toEqual([]);
      expect(getExerciseHistory([], 'bench')).toEqual([]);
    });
  });

  // ============================================================================
  // 4. GetAllExercisesFromHistory Deduplication & Sorting
  // ============================================================================
  describe('getAllExercisesFromHistory', () => {
    const workouts: WorkoutSession[] = [
      {
        id: 'w1',
        name: 'Push',
        startedAt: '2026-09-01T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [{ id: '1', setNumber: 1, weight: 80, reps: 8, rir: 1, completed: true }],
          },
          {
            exerciseId: 'ex_ohp',
            exerciseName: 'Overhead Press',
            order: 1,
            actualSets: [{ id: '2', setNumber: 1, weight: 50, reps: 8, rir: 2, completed: true }],
          },
        ],
      },
      {
        id: 'w2',
        name: 'Full Body',
        startedAt: '2026-09-03T10:00:00.000Z',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'ex_bench', // duplicate exercise across workouts
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [{ id: '3', setNumber: 1, weight: 85, reps: 5, rir: 1, completed: true }],
          },
          {
            exerciseId: 'ex_squat',
            exerciseName: 'Barbell Squat',
            order: 1,
            actualSets: [{ id: '4', setNumber: 1, weight: 120, reps: 5, rir: 2, completed: true }],
          },
        ],
      },
    ];

    it('returns deduplicated list of exercises sorted alphabetically by name', () => {
      const list = getAllExercisesFromHistory(workouts);
      expect(list).toHaveLength(3);

      expect(list[0]).toEqual({ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press' });
      expect(list[1]).toEqual({ exerciseId: 'ex_squat', exerciseName: 'Barbell Squat' });
      expect(list[2]).toEqual({ exerciseId: 'ex_ohp', exerciseName: 'Overhead Press' });
    });

    it('returns empty array when no workouts exist', () => {
      expect(getAllExercisesFromHistory([])).toEqual([]);
    });
  });
});
