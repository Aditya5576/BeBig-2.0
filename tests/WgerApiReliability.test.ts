import { WgerExerciseProvider } from '../src/features/exercises/providers/wger/WgerExerciseProvider';
import { mapWgerToExercise } from '../src/features/exercises/providers/wger/wgerMapper';
import { ExerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { exerciseCacheStorage } from '../src/features/exercises/storage/exerciseCacheStorage';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';

describe('M9 — Wger API Reliability & Resilience', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    await exerciseCacheStorage.clearCache();
    await customExerciseStorage.clearCustomExercises();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  describe('1. Malformed and Partial Response Handling', () => {
    it('handles non-array results gracefully by defaulting to empty array', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          count: 0,
          results: null, // Malformed: results should be an array
        }),
      });

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      const result = await provider.listExercises();

      expect(result.exercises).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('skips individually malformed items without discarding valid items in the batch', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          count: 2,
          results: [
            null, // Corrupted item
            { id: null, translations: 'not-array' }, // Corrupted item
            {
              id: 99,
              translations: [{ language: 2, name: 'Resilient Curl' }],
              category: { id: 8, name: 'Arms' },
              muscles: [{ id: 1, name: 'Biceps' }],
            },
          ],
        }),
      });

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      const result = await provider.listExercises();

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].id).toBe('wger_99');
      expect(result.exercises[0].name).toBe('Resilient Curl');
      expect(result.exercises[0].category).toBe('arms');
    });

    it('maps items with missing translations, category, and muscles without crashing', () => {
      const minimalItem: any = {
        id: 777,
        translations: [],
      };

      const mapped = mapWgerToExercise(minimalItem);

      expect(mapped.id).toBe('wger_777');
      expect(mapped.name).toBe('Exercise #777');
      expect(mapped.category).toBe('other');
      expect(mapped.categoryName).toBe('Other');
      expect(mapped.primaryMuscles).toEqual([]);
      expect(mapped.secondaryMuscles).toEqual([]);
      expect(mapped.equipment).toEqual([]);
      expect(mapped.images).toEqual([]);
      expect(mapped.isCustom).toBe(false);
    });

    it('handles malformed JSON response by throwing clean error', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      });

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      await expect(provider.listExercises()).rejects.toThrow('Malformed Wger response: invalid JSON');
    });
  });

  describe('2. HTTP Failure & Timeout Resilience in ExerciseRepository', () => {
    it('falls back to local cached/seed exercises when Wger returns HTTP 500', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const repo = new ExerciseRepository();
      const result = await repo.getExercises({ limit: 10 });

      // Should not throw; should return cached seed catalog
      expect(result.exercises.length).toBeGreaterThan(0);
      expect(result.exercises.some((e) => e.name === 'Barbell Bench Press')).toBe(true);
      expect(result.hasMore).toBe(false);
    });

    it('falls back to local cached exercises when Wger request times out', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      globalThis.fetch = jest.fn().mockRejectedValue(abortError);

      const repo = new ExerciseRepository();
      const result = await repo.getExercises({ category: 'chest' });

      // Should return chest exercises from local seed catalog
      expect(result.exercises.length).toBeGreaterThan(0);
      expect(result.exercises.every((e) => e.category === 'chest')).toBe(true);
    });

    it('short-circuits cascading fallback token queries when primary query fails', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network connection refused'));
      globalThis.fetch = mockFetch;

      const repo = new ExerciseRepository();
      const result = await repo.getExercises({ query: 'nonexistent multi word query' });

      // Primary search fails, so it should NOT loop through 3+ searchTokens making additional requests
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // Result returns cleanly without hanging or crashing
      expect(Array.isArray(result.exercises)).toBe(true);
    });
  });

  describe('3. Single Exercise Retrieval (getExerciseById)', () => {
    it('returns null on 404 Not Found without throwing', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      const item = await provider.getExerciseById('wger_99999');

      expect(item).toBeNull();
    });

    it('returns null when single exercise payload is malformed or invalid JSON', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Malformed JSON');
        },
      });

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      const item = await provider.getExerciseById('wger_123');

      expect(item).toBeNull();
    });

    it('retrieves from local cache first before calling network', async () => {
      const mockFetch = jest.fn();
      globalThis.fetch = mockFetch;

      const repo = new ExerciseRepository();
      // Seed exercise exists in local cache
      const exercise = await repo.getExerciseById('seed-bench-press');

      expect(exercise).not.toBeNull();
      expect(exercise?.name).toBe('Barbell Bench Press');
      // Zero network calls needed
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('4. Offline Zero-Dependency Guarantee', () => {
    it('custom exercises and seed catalog remain 100% discoverable with zero network', async () => {
      // Mock network completely down
      globalThis.fetch = jest.fn().mockRejectedValue(new Error('Device offline (airplane mode)'));

      const repo = new ExerciseRepository();

      // Create a custom exercise offline
      await repo.createCustomExercise({
        name: 'Offline Bulgarian Split Squat',
        category: 'legs',
        primaryMuscles: ['Quadriceps'],
      });

      // Search offline
      const searchResult = await repo.getExercises({ query: 'Bulgarian' });
      expect(searchResult.exercises).toHaveLength(1);
      expect(searchResult.exercises[0].name).toBe('Offline Bulgarian Split Squat');
      expect(searchResult.exercises[0].isCustom).toBe(true);

      // Browse category offline
      const legsResult = await repo.getExercises({ category: 'legs' });
      expect(legsResult.exercises.some((e) => e.name === 'Barbell Back Squat')).toBe(true);
      expect(legsResult.exercises.some((e) => e.name === 'Offline Bulgarian Split Squat')).toBe(true);
    });
  });
});
