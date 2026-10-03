/**
 * BeBig 2.0 — PR Detection Engine Unit Tests (PERF-5C)
 *
 * Tests Weight PR, Rep PR, Volume PR detection against all historical maximums,
 * exercise isolation, current session exclusion, decimal weights, and edge cases.
 */

import {
  normalizeExercisePerformance,
  detectExercisePRs,
} from '../src/features/performance';

describe('BeBig 2.0 — PR Detection Engine (PERF-5C)', () => {
  const chestPressId = 'ex_chest_press_001';
  const inclinePressId = 'ex_incline_press_002';

  const date1 = '2026-02-01T10:00:00.000Z'; // Week 1
  const date2 = '2026-02-08T10:00:00.000Z'; // Week 2
  const date3 = '2026-02-15T10:00:00.000Z'; // Week 3
  const currentDate = '2026-02-22T10:00:00.000Z'; // Week 4

  test('1. First recorded performance (no history) sets isWeightPR, isRepPR, isVolumePR to true when values > 0', () => {
    const current = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        exerciseName: 'Chest Press',
        actualSets: [{ weight: 50, reps: 10, completed: true }],
      },
      { id: 'sess_first', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, []);

    expect(result.hasHistory).toBe(false);
    expect(result.previousBestTopWeight).toBeNull();
    expect(result.weightIncrease).toBeNull();
    expect(result.isWeightPR).toBe(true);

    expect(result.previousBestReps).toBeNull();
    expect(result.repIncrease).toBeNull();
    expect(result.isRepPR).toBe(true);

    expect(result.previousBestVolume).toBeNull();
    expect(result.volumeIncrease).toBeNull();
    expect(result.isVolumePR).toBe(true);

    expect(result.hasAnyPR).toBe(true);
  });

  test('2. Weight PR: current top weight (57.5 kg) > historical max (55 kg)', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 57.5, reps: 10, completed: true }] },
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isWeightPR).toBe(true);
    expect(result.previousBestTopWeight).toBe(55);
    expect(result.weightIncrease).toBe(2.5);
  });

  test('3. No weight PR when current top weight is equal to historical max', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isWeightPR).toBe(false);
    expect(result.weightIncrease).toBe(0);
  });

  test('4. No weight PR when current top weight is lower than historical max', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 60, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isWeightPR).toBe(false);
    expect(result.weightIncrease).toBe(-5);
  });

  test('5. Rep PR: current max reps (12) > historical max reps (10)', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 12, completed: true }] },
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isRepPR).toBe(true);
    expect(result.previousBestReps).toBe(10);
    expect(result.repIncrease).toBe(2);
  });

  test('6. No rep PR when current max reps is equal to historical max reps', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isRepPR).toBe(false);
    expect(result.repIncrease).toBe(0);
  });

  test('7. No rep PR when current max reps is lower than historical max reps', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 12, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isRepPR).toBe(false);
    expect(result.repIncrease).toBe(-2);
  });

  test('8. Volume PR: current volume (600 kg) > historical max volume (500 kg)', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] }, // 500kg
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 12, completed: true }] }, // 600kg
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isVolumePR).toBe(true);
    expect(result.previousBestVolume).toBe(500);
    expect(result.volumeIncrease).toBe(100);
  });

  test('9. No volume PR when current volume is equal to historical max volume', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] }, // 500kg
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] }, // 500kg
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isVolumePR).toBe(false);
    expect(result.volumeIncrease).toBe(0);
  });

  test('10. No volume PR when current volume is lower than historical max volume', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] }, // 500kg
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 40, reps: 10, completed: true }] }, // 400kg
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isVolumePR).toBe(false);
    expect(result.volumeIncrease).toBe(-100);
  });

  test('11. Historical maximum rule: compares against overall historical max (Week 2 55kg), not just immediate previous (Week 3 52.5kg)', () => {
    const week1 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's_w1', finishedAt: date1 },
    )!;

    const week2 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] }, // Historical Max = 55kg
      { id: 's_w2', finishedAt: date2 },
    )!;

    const week3 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 52.5, reps: 10, completed: true }] }, // De-loaded
      { id: 's_w3', finishedAt: date3 },
    )!;

    const week4 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 57.5, reps: 10, completed: true }] },
      { id: 's_w4', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(week4, [week1, week2, week3]);

    expect(result.previousBestTopWeight).toBe(55);
    expect(result.isWeightPR).toBe(true);
    expect(result.weightIncrease).toBe(2.5);
  });

  test('12. Same exercise isolation: ignores history for different exerciseId', () => {
    const differentExercise = normalizeExercisePerformance(
      { exerciseId: inclinePressId, actualSets: [{ weight: 100, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [differentExercise]);

    expect(result.hasHistory).toBe(false);
    expect(result.isWeightPR).toBe(true); // first performance for chest press
  });

  test('13. Current session exclusion: current session ID in history array is excluded', () => {
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's_same', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [current]);

    expect(result.hasHistory).toBe(false);
  });

  test('14. Decimal weights (52.5 kg → 55 kg) precision without floating point artifacts', () => {
    const hist = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 52.5, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [hist]);

    expect(result.isWeightPR).toBe(true);
    expect(result.weightIncrease).toBe(2.5); // clean 2.5, not 2.4999999997
  });

  test('15. Empty history returns hasHistory: false and null previous values', () => {
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, []);

    expect(result.hasHistory).toBe(false);
    expect(result.previousBestTopWeight).toBeNull();
    expect(result.previousBestReps).toBeNull();
    expect(result.previousBestVolume).toBeNull();
  });

  test('16. Malformed history objects are safely ignored', () => {
    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: currentDate },
    )!;

    const malformed = [{ invalid: true }] as any;

    const result = detectExercisePRs(current, malformed);

    expect(result.hasHistory).toBe(false);
    expect(result.isWeightPR).toBe(true);
  });

  test('17. Multiple historical sessions correctly evaluate global max across all sessions', () => {
    const sess1 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 40, reps: 15, completed: true }] }, // Volume = 600kg, Reps = 15
      { id: 's1', finishedAt: date1 },
    )!;

    const sess2 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 60, reps: 8, completed: true }] }, // Top Weight = 60kg, Volume = 480kg
      { id: 's2', finishedAt: date2 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 65, reps: 10, completed: true }] }, // Top Weight = 65kg, Volume = 650kg
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [sess1, sess2]);

    expect(result.previousBestTopWeight).toBe(60);
    expect(result.previousBestReps).toBe(15);
    expect(result.previousBestVolume).toBe(600);

    expect(result.isWeightPR).toBe(true); // 65 > 60
    expect(result.isRepPR).toBe(false); // 10 < 15
    expect(result.isVolumePR).toBe(true); // 650 > 600
  });

  test('18. Product Exact Example: History (50kg×15, 55kg×10), Current (57.5kg×8) → Weight PR=true, Rep PR=false, Volume PR=false', () => {
    const histSet1 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 15, completed: true }] }, // Vol = 750kg, Reps = 15
      { id: 's_h1', finishedAt: date1 },
    )!;

    const histSet2 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] }, // Top Weight = 55kg, Vol = 550kg
      { id: 's_h2', finishedAt: date2 },
    )!;

    const current = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 57.5, reps: 8, completed: true }] }, // Top Weight = 57.5kg, Vol = 460kg, Reps = 8
      { id: 's_curr', finishedAt: currentDate },
    )!;

    const result = detectExercisePRs(current, [histSet1, histSet2]);

    expect(result.isWeightPR).toBe(true); // 57.5 > 55
    expect(result.weightIncrease).toBe(2.5);

    expect(result.isRepPR).toBe(false); // 8 < 15
    expect(result.previousBestReps).toBe(15);

    expect(result.isVolumePR).toBe(false); // 460 < 750
    expect(result.previousBestVolume).toBe(750);
  });
});
