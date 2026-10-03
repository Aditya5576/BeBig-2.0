/**
 * BeBig 2.0 — Performance Intelligence Foundation Unit Tests (PERF-5A)
 *
 * Verifies deterministic calculation functions, normalization logic,
 * malformed data handling, decimal precision, and exercise isolation.
 */

import {
  calculateSetVolume,
  calculateTotalVolume,
  calculateTotalReps,
  calculateTopWeight,
  calculateTopWeightReps,
  calculateBestSet,
  normalizeSetPerformance,
  normalizeExercisePerformance,
  extractExercisePerformances,
  SetPerformance,
} from '../src/features/performance';

describe('BeBig 2.0 — Performance Intelligence Data Foundation (PERF-5A)', () => {
  describe('Deterministic Pure Calculations', () => {
    it('1. Single set volume calculation (standard and decimal weights)', () => {
      // 50 kg × 10 reps = 500 kg
      expect(calculateSetVolume(50, 10)).toBe(500);

      // Decimal weight: 62.5 kg × 10 reps = 625 kg
      expect(calculateSetVolume(62.5, 10)).toBe(625);

      // Decimal weight: 52.5 kg × 8 reps = 420 kg
      expect(calculateSetVolume(52.5, 8)).toBe(420);

      // Zero reps or zero weight = 0
      expect(calculateSetVolume(0, 10)).toBe(0);
      expect(calculateSetVolume(50, 0)).toBe(0);
    });

    it('2. Multiple set volume calculation', () => {
      const sets: SetPerformance[] = [
        { setNumber: 1, weight: 60, reps: 10, volume: 600, completed: true },
        { setNumber: 2, weight: 65, reps: 8, volume: 520, completed: true },
        { setNumber: 3, weight: 70, reps: 6, volume: 420, completed: true },
        { setNumber: 4, weight: 80, reps: 0, volume: 0, completed: false }, // Uncompleted set excluded
      ];

      // 600 + 520 + 420 = 1540
      expect(calculateTotalVolume(sets)).toBe(1540);
    });

    it('3. Total reps calculation across completed sets', () => {
      const sets: SetPerformance[] = [
        { setNumber: 1, weight: 50, reps: 12, volume: 600, completed: true },
        { setNumber: 2, weight: 50, reps: 10, volume: 500, completed: true },
        { setNumber: 3, weight: 50, reps: 8, volume: 400, completed: true },
        { setNumber: 4, weight: 50, reps: 10, volume: 0, completed: false }, // Uncompleted set excluded
      ];

      // 12 + 10 + 8 = 30
      expect(calculateTotalReps(sets)).toBe(30);
    });

    it('4. Top weight calculation', () => {
      const sets: SetPerformance[] = [
        { setNumber: 1, weight: 60, reps: 10, volume: 600, completed: true },
        { setNumber: 2, weight: 85.5, reps: 5, volume: 427.5, completed: true },
        { setNumber: 3, weight: 80, reps: 6, volume: 480, completed: true },
      ];

      expect(calculateTopWeight(sets)).toBe(85.5);
    });

    it('5. Top-weight reps calculation (including tie-breaker for top weight)', () => {
      const sets: SetPerformance[] = [
        { setNumber: 1, weight: 100, reps: 3, volume: 300, completed: true },
        { setNumber: 2, weight: 100, reps: 5, volume: 500, completed: true }, // Same top weight 100kg, 5 reps
        { setNumber: 3, weight: 90, reps: 8, volume: 720, completed: true },
      ];

      // Top weight is 100 kg, maximum reps at 100 kg is 5
      expect(calculateTopWeightReps(sets)).toBe(5);
    });

    it('6. Best set determination (highest volume with weight/rep tie-breakers)', () => {
      const sets: SetPerformance[] = [
        { setNumber: 1, weight: 60, reps: 10, volume: 600, completed: true },
        { setNumber: 2, weight: 100, reps: 8, volume: 800, completed: true }, // Highest volume (800 kg)
        { setNumber: 3, weight: 90, reps: 8, volume: 720, completed: true },
      ];

      const best = calculateBestSet(sets);
      expect(best).not.toBeNull();
      expect(best?.setNumber).toBe(2);
      expect(best?.weight).toBe(100);
      expect(best?.reps).toBe(8);
      expect(best?.volume).toBe(800);
    });

    it('7. Empty sets handling', () => {
      expect(calculateTotalVolume([])).toBe(0);
      expect(calculateTotalReps([])).toBe(0);
      expect(calculateTopWeight([])).toBe(0);
      expect(calculateTopWeightReps([])).toBe(0);
      expect(calculateBestSet([])).toBeNull();
    });

    it('8. Invalid / malformed values handling without crashing', () => {
      // NaN, Negative numbers, Infinities
      expect(calculateSetVolume(NaN, 10)).toBe(0);
      expect(calculateSetVolume(50, -5)).toBe(0);
      expect(calculateSetVolume(Infinity, 10)).toBe(0);

      const malformedSets = [
        { setNumber: 1, weight: -50, reps: 10, volume: 0, completed: true },
        { setNumber: 2, weight: NaN, reps: 5, volume: 0, completed: true },
        { setNumber: 3, weight: 40, reps: 10, volume: 400, completed: true },
      ] as any;

      expect(calculateTotalVolume(malformedSets)).toBe(400);
      expect(calculateTopWeight(malformedSets)).toBe(40);
    });

    it('9. Decimal weights such as 62.5 kg precision', () => {
      const setNorm = normalizeSetPerformance({ setNumber: 1, weight: '62.5', reps: '10', completed: true });
      expect(setNorm).not.toBeNull();
      expect(setNorm?.weight).toBe(62.5);
      expect(setNorm?.reps).toBe(10);
      expect(setNorm?.volume).toBe(625);
    });
  });

  describe('Normalizer & Data Isolation', () => {
    it('10. Multiple exercises within a session remain strictly isolated', () => {
      const mockRawSession = {
        id: 'sess_123',
        name: 'Upper Body Blast',
        finishedAt: '2026-10-01T18:00:00.000Z',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            actualSets: [
              { id: 's1', setNumber: 1, weight: 100, reps: 5, completed: true },
              { id: 's2', setNumber: 2, weight: 100, reps: 5, completed: true },
            ],
          },
          {
            exerciseId: 'ex_row',
            exerciseName: 'Barbell Row',
            actualSets: [
              { id: 's3', setNumber: 1, weight: 80, reps: 10, completed: true },
              { id: 's4', setNumber: 2, weight: 80, reps: 8, completed: true },
            ],
          },
        ],
      };

      const snapshots = extractExercisePerformances(mockRawSession);
      expect(snapshots.length).toBe(2);

      const bench = snapshots.find((s) => s.exerciseId === 'ex_bench');
      const row = snapshots.find((s) => s.exerciseId === 'ex_row');

      expect(bench).toBeDefined();
      expect(row).toBeDefined();

      // Bench metrics isolated
      expect(bench?.exerciseName).toBe('Bench Press');
      expect(bench?.totalSets).toBe(2);
      expect(bench?.totalReps).toBe(10);
      expect(bench?.totalVolume).toBe(1000);
      expect(bench?.topWeight).toBe(100);

      // Row metrics isolated
      expect(row?.exerciseName).toBe('Barbell Row');
      expect(row?.totalSets).toBe(2);
      expect(row?.totalReps).toBe(18);
      expect(row?.totalVolume).toBe(1440);
      expect(row?.topWeight).toBe(80);
    });

    it('11. RIR is strictly excluded from normalized set and snapshot models', () => {
      const rawSetWithRIR = {
        id: 's1',
        setNumber: 1,
        weight: 100,
        reps: 10,
        rir: 2, // Included in raw WorkoutSet
        completed: true,
      };

      const normalized = normalizeSetPerformance(rawSetWithRIR);
      expect(normalized).not.toBeNull();
      expect((normalized as any).rir).toBeUndefined();

      const snapshot = normalizeExercisePerformance(
        {
          exerciseId: 'ex_1',
          exerciseName: 'Squat',
          actualSets: [rawSetWithRIR],
        },
        { id: 'sess_1', name: 'Leg Day' },
      );

      expect(snapshot?.sets[0]).not.toHaveProperty('rir');
    });

    it('12. Handles malformed session / missing exercise IDs gracefully without throwing', () => {
      expect(normalizeExercisePerformance(null, null)).toBeNull();
      expect(normalizeExercisePerformance({}, {})).toBeNull(); // Missing exerciseId -> null
      expect(extractExercisePerformances(null)).toEqual([]);
      expect(extractExercisePerformances({ exercises: ['not an object'] })).toEqual([]);
    });
  });
});
