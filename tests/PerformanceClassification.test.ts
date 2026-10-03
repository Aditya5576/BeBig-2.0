/**
 * BeBig 2.0 — Performance Classification Engine Unit Tests (PERF-5D)
 *
 * Tests deterministic classifications (weight_progression, rep_progression,
 * combined_progression, volume_progression, maintained, recent_drop, possible_plateau),
 * single unchanged workout handling, product examples, and non-speculative reasons.
 */

import {
  normalizeExercisePerformance,
  classifyPerformance,
} from '../src/features/performance';

describe('BeBig 2.0 — Performance Classification Engine (PERF-5D)', () => {
  const chestPressId = 'ex_chest_press_001';
  const inclinePressId = 'ex_incline_press_002';

  const date1 = '2026-02-01T10:00:00.000Z';
  const date2 = '2026-02-08T10:00:00.000Z';
  const date3 = '2026-02-15T10:00:00.000Z';
  const currentDate = '2026-02-22T10:00:00.000Z';

  test('1. Weight progression when top weight increases (50 kg × 10 → 55 kg × 8)', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 8, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('weight_progression');
    expect(result.confidenceReason).toContain('Top weight increased');
  });

  test('2. Rep progression when reps increase at same top weight (50 kg × 10 → 50 kg × 15)', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 15, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('rep_progression');
    expect(result.confidenceReason).toContain('Reps at top weight increased');
  });

  test('3. Combined progression when both load and reps increase (50 kg × 10 → 55 kg × 12)', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 12, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('combined_progression');
  });

  test('4. Volume progression when total volume increases without load/rep progression', () => {
    const prev = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        actualSets: [{ weight: 50, reps: 10, completed: true }], // 500kg
      },
      { id: 's1', finishedAt: date1 },
    )!;

    const curr = normalizeExercisePerformance(
      {
        exerciseId: chestPressId,
        actualSets: [
          { weight: 45, reps: 10, completed: true },
          { weight: 45, reps: 10, completed: true }, // 900kg volume
        ],
      },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('volume_progression');
  });

  test('5. Maintained when performance is materially unchanged (single session)', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('maintained');
  });

  test('6. Recent drop when load, reps, and volume decrease materially', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 60, reps: 12, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 8, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('recent_drop');
  });

  test('7. Possible plateau when 3+ consecutive sessions show no progression', () => {
    const sess1 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const sess2 = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's2', finishedAt: date2 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's3', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [sess1, sess2]);
    expect(result.classification).toBe('possible_plateau');
    expect(result.confidenceReason).toContain('Possible plateau');
  });

  test('8. Single unchanged workout is NOT classified as a plateau (must be maintained)', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).not.toBe('possible_plateau');
    expect(result.classification).toBe('maintained');
  });

  test('9. Product Example 1: 50 kg × 15 → 55 kg × 10 is classified as weight_progression', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 15, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('weight_progression');
    expect(result.classification).not.toBe('volume_progression');
    expect(result.classification).not.toBe('combined_progression');
  });

  test('10. Product Example 2: 50 kg × 10 → 50 kg × 15 is classified as rep_progression', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 15, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('rep_progression');
  });

  test('11. Product Example 3: 50 kg × 10 → 55 kg × 12 is classified as combined_progression', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 12, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('combined_progression');
  });

  test('12. Explanations do not contain speculative subjective guesses (sleep, fatigue, AI fluff)', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 60, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 8, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    const fullText = (result.confidenceReason + ' ' + result.supportingFacts.join(' ')).toLowerCase();

    expect(fullText).not.toContain('sleep');
    expect(fullText).not.toContain('tired');
    expect(fullText).not.toContain('fatigue');
    expect(fullText).not.toContain('overtrain');
    expect(fullText).not.toContain('/100');
  });

  test('13. Decimal weights (52.5 kg → 55 kg) triggers weight_progression', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 52.5, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 55, reps: 10, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('weight_progression');
  });

  test('14. Zero-safe behavior handles 0 weights or 0 reps gracefully', () => {
    const prev = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 10, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [prev]);
    expect(result.classification).toBe('weight_progression');
  });


  test('15. Insufficient history (no previous snapshot) returns maintained initial baseline', () => {
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's1', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, []);
    expect(result.classification).toBe('maintained');
    expect(result.previousSnapshot).toBeNull();
    expect(result.confidenceReason).toContain('Initial recorded performance');
  });

  test('16. Same exercise isolation ignores history from different exerciseId', () => {
    const differentExercise = normalizeExercisePerformance(
      { exerciseId: inclinePressId, actualSets: [{ weight: 100, reps: 10, completed: true }] },
      { id: 's1', finishedAt: date1 },
    )!;
    const curr = normalizeExercisePerformance(
      { exerciseId: chestPressId, actualSets: [{ weight: 50, reps: 10, completed: true }] },
      { id: 's2', finishedAt: currentDate },
    )!;

    const result = classifyPerformance(curr, [differentExercise]);
    expect(result.classification).toBe('maintained');
    expect(result.previousSnapshot).toBeNull();
  });
});
