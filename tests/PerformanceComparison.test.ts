/**
 * BeBig 2.0 — Comparable Performance Engine Unit Tests (PERF-5B)
 *
 * Tests comparable-session selection, raw metrics calculations, decimal precision,
 * edge cases (zero values, malformed inputs), and exercise isolation.
 */

import {
  normalizeExercisePerformance,
  findPreviousPerformance,
  comparePerformances,
  compareExercisePerformance,
} from '../src/features/performance';

describe('BeBig 2.0 — Comparable Performance Engine (PERF-5B)', () => {
  const chestPressId = 'ex_chest_press_001';
  const inclinePressId = 'ex_incline_press_002';

  const baseDate = '2026-03-01T10:00:00.000Z';
  const previousDate = '2026-02-20T10:00:00.000Z';
  const earlierDate = '2026-02-10T10:00:00.000Z';

  test('1. No previous performance returns hasPreviousPerformance: false and null metric changes', () => {
    const current = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        exerciseName: 'Chest Press',
        actualSets: [{ weight: 55, reps: 10, completed: true }],
      },
      { id: 'sess_curr', finishedAt: baseDate },
    )!;

    const result = compareExercisePerformance(current, []);

    expect(result.hasPreviousPerformance).toBe(false);
    expect(result.previousSnapshot).toBeNull();
    expect(result.weightChange).toBeNull();
    expect(result.weightChangePercent).toBeNull();
    expect(result.repChange).toBeNull();
    expect(result.repChangePercent).toBeNull();
    expect(result.volumeChange).toBeNull();
    expect(result.volumeChangePercent).toBeNull();
    expect(result.topWeightChange).toBeNull();
    expect(result.topWeightChangePercent).toBeNull();
    expect(result.topWeightRepChange).toBeNull();
  });

  test('2. Product Example: 50 kg × 15 → 55 kg × 10 produces exact raw metrics (+5kg, +10%, -5 reps, -33.33%, -200kg, -26.67%)', () => {
    const previous = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        exerciseName: 'Chest Press',
        actualSets: [{ weight: 50, reps: 15, completed: true }],
      },
      { id: 'sess_prev', finishedAt: previousDate },
    )!;

    const current = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        exerciseName: 'Chest Press',
        actualSets: [{ weight: 55, reps: 10, completed: true }],
      },
      { id: 'sess_curr', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);

    expect(result.hasPreviousPerformance).toBe(true);
    expect(result.weightChange).toBe(5);
    expect(result.weightChangePercent).toBe(10);
    expect(result.repChange).toBe(-5);
    expect(result.repChangePercent).toBe(-33.33);
    expect(result.volumeChange).toBe(-200);
    expect(result.volumeChangePercent).toBe(-26.67);

    expect(result.topWeightChange).toBe(5);
    expect(result.topWeightChangePercent).toBe(10);
    expect(result.topWeightRepChange).toBe(-5);
  });

  test('3. Same exercise comparison matches by stable exerciseId', () => {
    const previous = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        exerciseName: 'Chest Press',
        actualSets: [{ weight: 50, reps: 10, completed: true }],
      },
      { id: 'sess_prev', finishedAt: previousDate },
    )!;

    const current = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        exerciseName: 'Chest Press',
        actualSets: [{ weight: 55, reps: 10, completed: true }],
      },
      { id: 'sess_curr', finishedAt: baseDate },
    )!;

    const found = findPreviousPerformance(current, [previous]);
    expect(found).not.toBeNull();
    expect(found?.sessionId).toBe('sess_prev');
  });

  test('4. Different exercise isolation never matches unrelated exercises', () => {
    const differentExercise = normalizeExercisePerformance(
      {
        exerciseId: inclinePressId,
        exerciseName: 'Incline Press',
        actualSets: [{ weight: 50, reps: 10, completed: true }],
      },
      { id: 'sess_prev', finishedAt: previousDate },
    )!;

    const current = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        exerciseName: 'Chest Press',
        actualSets: [{ weight: 55, reps: 10, completed: true }],
      },
      { id: 'sess_curr', finishedAt: baseDate },
    )!;

    const found = findPreviousPerformance(current, [differentExercise]);
    expect(found).toBeNull();

    const comparison = compareExercisePerformance(current, [differentExercise]);
    expect(comparison.hasPreviousPerformance).toBe(false);
  });

  test('5. Weight increase calculation', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 100, reps: 5, completed: true }] },
      { id: 's1', finishedAt: previousDate },
    )!;
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 110, reps: 5, completed: true }] },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.weightChange).toBe(10);
    expect(result.weightChangePercent).toBe(10);
  });

  test('6. Weight decrease calculation', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 100, reps: 5, completed: true }] },
      { id: 's1', finishedAt: previousDate },
    )!;
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 90, reps: 5, completed: true }] },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.weightChange).toBe(-10);
    expect(result.weightChangePercent).toBe(-10);
  });

  test('7. Same weight calculation produces 0 change and 0% change', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 80, reps: 8, completed: true }] },
      { id: 's1', finishedAt: previousDate },
    )!;
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 80, reps: 8, completed: true }] },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.weightChange).toBe(0);
    expect(result.weightChangePercent).toBe(0);
  });

  test('8. Rep increase calculation', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: previousDate },
    )!;
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 12, completed: true }] },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.repChange).toBe(2);
    expect(result.repChangePercent).toBe(20);
  });

  test('9. Rep decrease calculation', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: previousDate },
    )!;
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 8, completed: true }] },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.repChange).toBe(-2);
    expect(result.repChangePercent).toBe(-20);
  });

  test('10. Volume increase calculation', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] }, // 500kg
      { id: 's1', finishedAt: previousDate },
    )!;
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 12, completed: true }] }, // 600kg
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.volumeChange).toBe(100);
    expect(result.volumeChangePercent).toBe(20);
  });

  test('11. Volume decrease calculation', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] }, // 500kg
      { id: 's1', finishedAt: previousDate },
    )!;
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 40, reps: 10, completed: true }] }, // 400kg
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.volumeChange).toBe(-100);
    expect(result.volumeChangePercent).toBe(-20);
  });

  test('12. Top-weight change exposes raw top-set fields', () => {
    const previous = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        actualSets: [
          { weight: 60, reps: 8, completed: true },
          { weight: 70, reps: 5, completed: true },
        ],
      },
      { id: 's1', finishedAt: previousDate },
    )!;

    const current = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        actualSets: [
          { weight: 60, reps: 10, completed: true },
          { weight: 75, reps: 6, completed: true },
        ],
      },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.topWeightChange).toBe(5); // 75 - 70
    expect(result.topWeightRepChange).toBe(1); // 6 - 5
  });

  test('13. Decimal weights (52.5 kg → 55 kg) precision without floating point artifacts', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 52.5, reps: 10, completed: true }] },
      { id: 's1', finishedAt: previousDate },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.weightChange).toBe(2.5); // exact 2.5, not 2.4999999997
    expect(result.weightChangePercent).toBe(4.76); // 2.5 / 52.5 * 100 = 4.7619... -> 4.76
  });

  test('14. Zero previous weight handles safely without NaN or Infinity', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 0, reps: 10, completed: true }] },
      { id: 's1', finishedAt: previousDate },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.weightChange).toBe(50);
    expect(result.weightChangePercent).toBeNull();
  });

  test('15. Zero previous reps handles safely without NaN or Infinity', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 0, completed: true }] },
      { id: 's1', finishedAt: previousDate },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect(result.repChange).toBe(10);
    expect(result.repChangePercent).toBeNull();
  });

  test('16. Chronological previous-session selection picks the most recent earlier session', () => {
    const earliest = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 40, reps: 10, completed: true }] },
      { id: 's_earliest', finishedAt: earlierDate }, // 2026-02-10
    )!;

    const mostRecentPrev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's_most_recent', finishedAt: previousDate }, // 2026-02-20
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's_current', finishedAt: baseDate }, // 2026-03-01
    )!;

    const found = findPreviousPerformance(current, [earliest, mostRecentPrev]);
    expect(found?.sessionId).toBe('s_most_recent');
    expect(found?.topWeight).toBe(50);
  });

  test('17. Current session is excluded from previous-session candidates', () => {
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's_same', finishedAt: baseDate },
    )!;

    const found = findPreviousPerformance(current, [current]);
    expect(found).toBeNull();
  });

  test('18. Malformed snapshot handling without throwing exceptions', () => {
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's_current', finishedAt: baseDate },
    )!;

    const malformed = { invalid: true } as any;

    const found = findPreviousPerformance(current, [malformed]);
    expect(found).toBeNull();

    const comparison = comparePerformances(current, null);
    expect(comparison.hasPreviousPerformance).toBe(false);
  });

  test('19. RIR is strictly ignored in comparison output model', () => {
    const previous = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, rir: 2, completed: true }] },
      { id: 's1', finishedAt: previousDate },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, rir: 1, completed: true }] },
      { id: 's2', finishedAt: baseDate },
    )!;

    const result = comparePerformances(current, previous);
    expect((result as any).rirChange).toBeUndefined();
    expect((result as any).rir).toBeUndefined();
  });
});
