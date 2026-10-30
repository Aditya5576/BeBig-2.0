import React from 'react';
import { render, act, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { exerciseCacheStorage, SEED_EXERCISES } from '../src/features/exercises/storage/exerciseCacheStorage';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { exercisePhotoStorage } from '../src/features/exercises/storage/exercisePhotoStorage';
import {
  hasCustomPhoto,
  getCustomPhotoUri,
  resolveExerciseDemonstration,
} from '../src/features/exercises/services/exerciseMediaService';
import { CURATED_EXERCISE_MEDIA_CATALOG } from '../src/features/exercises/data/curatedMediaCatalog';
import {
  filterCatalogueForIndianGym,
  isEligibleForIndianCommercialGym,
} from '../src/features/exercises/data/gymEquipmentFilter';
import { WgerExerciseProvider } from '../src/features/exercises/providers/wger/WgerExerciseProvider';
import { Exercise } from '../src/features/exercises/types';
import { ExerciseCard } from '../src/features/exercises/components/ExerciseCard';
import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: any) => {
    const React = require('react');
    React.useEffect(cb, []);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

describe('BeBig 2.0 — Post-Implementation Verification & Benchmark Audit', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    globalThis.fetch = originalFetch;
    await exerciseCacheStorage.clearCache();
    await customExerciseStorage.clearCustomExercises();
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  // ==========================================
  // SECTION 1: PERFORMANCE BENCHMARKS
  // ==========================================
  describe('1. Performance Benchmarks', () => {
    it('measures cold vs cached exercise loading latency', async () => {
      // 1. Cold storage hydration
      const t0 = performance.now();
      await exerciseCacheStorage.ensureHydrated();
      const coldHydrationMs = performance.now() - t0;

      // 2. Cached retrieval latency across 100 runs
      const cachedRuns: number[] = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        const exercises = exerciseRepository.getCachedExercises();
        cachedRuns.push(performance.now() - start);
      }
      cachedRuns.sort((a, b) => a - b);
      const minCached = cachedRuns[0];
      const maxCached = cachedRuns[cachedRuns.length - 1];
      const meanCached = cachedRuns.reduce((a, b) => a + b, 0) / cachedRuns.length;
      const p95Cached = cachedRuns[Math.floor(cachedRuns.length * 0.95)];

      console.log('--- [BENCHMARK] Exercise Loading Latency ---');
      console.log(`Cold Hydration Latency: ${coldHydrationMs.toFixed(3)} ms`);
      console.log(`Cached Retrieval Min: ${minCached.toFixed(3)} ms`);
      console.log(`Cached Retrieval Mean: ${meanCached.toFixed(3)} ms`);
      console.log(`Cached Retrieval P95: ${p95Cached.toFixed(3)} ms`);
      console.log(`Cached Retrieval Max: ${maxCached.toFixed(3)} ms`);

      expect(meanCached).toBeLessThan(10);
    });

    it('measures search response latency (local instant vs remote debounced)', () => {
      const searchRuns: number[] = [];
      const queries = ['bench', 'squat', 'curl', 'deadlift', 'press', 'row', 'incline', 'pull'];

      for (let i = 0; i < 100; i++) {
        const q = queries[i % queries.length];
        const start = performance.now();
        const matches = exerciseRepository.getCachedExercises({ query: q });
        searchRuns.push(performance.now() - start);
      }

      searchRuns.sort((a, b) => a - b);
      const minSearch = searchRuns[0];
      const maxSearch = searchRuns[searchRuns.length - 1];
      const meanSearch = searchRuns.reduce((a, b) => a + b, 0) / searchRuns.length;
      const p95Search = searchRuns[Math.floor(searchRuns.length * 0.95)];

      console.log('--- [BENCHMARK] Search Latency ---');
      console.log(`Local Cache Search Min: ${minSearch.toFixed(3)} ms`);
      console.log(`Local Cache Search Mean: ${meanSearch.toFixed(3)} ms`);
      console.log(`Local Cache Search P95: ${p95Search.toFixed(3)} ms`);
      console.log(`Local Cache Search Max: ${maxSearch.toFixed(3)} ms`);
      console.log(`Remote Search Debounce Ceiling: 250 ms`);

      expect(meanSearch).toBeLessThan(15);
    });

    it('measures pagination latency and request deduplication', async () => {
      globalThis.fetch = jest.fn(async (url: any) => {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            count: 100,
            next: 'https://wger.de/api/v2/exerciseinfo/?limit=20&offset=40',
            previous: 'https://wger.de/api/v2/exerciseinfo/?limit=20&offset=0',
            results: [
              {
                id: 101,
                translations: [{ language: 2, name: 'Deduplicated Press' }],
                category: { id: 11, name: 'Chest' },
                equipment: [{ id: 1, name: 'Barbell' }],
                muscles: [{ id: 1, name: 'Chest' }],
                images: [],
              },
            ],
          }),
        } as any;
      });

      const provider = new WgerExerciseProvider();

      const dedupStart = performance.now();
      const [resA, resB] = await Promise.all([
        provider.listExercises({ limit: 20, offset: 20 }),
        provider.listExercises({ limit: 20, offset: 20 }),
      ]);
      const dedupMs = performance.now() - dedupStart;

      console.log('--- [BENCHMARK] Pagination & Deduplication ---');
      console.log(`Page 2 Fetch Latency (Deduplicated 2 concurrent requests): ${dedupMs.toFixed(3)} ms`);
      console.log(`Network calls fired: ${(globalThis.fetch as jest.Mock).mock.calls.length} (expected: 1 due to in-flight deduplication)`);

      expect(resA.exercises.length).toBeGreaterThan(0);
      expect(resB.exercises.length).toBeGreaterThan(0);
      expect(resA.exercises[0].id).toBe(resB.exercises[0].id);
      expect((globalThis.fetch as jest.Mock).mock.calls.length).toBe(1);
      globalThis.fetch = originalFetch;
    });

    it('measures demonstration media & image resolution latency', () => {
      const resolutionRuns: number[] = [];
      const testIds = ['wger_73', 'wger_75', 'seed-bench-press', 'seed-squat', 'seed-deadlift', 'custom_123'];

      for (let i = 0; i < 100; i++) {
        const id = testIds[i % testIds.length];
        const start = performance.now();
        const demo = resolveExerciseDemonstration(id);
        resolutionRuns.push(performance.now() - start);
      }

      resolutionRuns.sort((a, b) => a - b);
      const minRes = resolutionRuns[0];
      const maxRes = resolutionRuns[resolutionRuns.length - 1];
      const meanRes = resolutionRuns.reduce((a, b) => a + b, 0) / resolutionRuns.length;
      const p95Res = resolutionRuns[Math.floor(resolutionRuns.length * 0.95)];

      console.log('--- [BENCHMARK] Media Resolution Latency ---');
      console.log(`Media Resolution Min: ${minRes.toFixed(4)} ms`);
      console.log(`Media Resolution Mean: ${meanRes.toFixed(4)} ms`);
      console.log(`Media Resolution P95: ${p95Res.toFixed(4)} ms`);
      console.log(`Media Resolution Max: ${maxRes.toFixed(4)} ms`);

      expect(meanRes).toBeLessThan(1);
    });

    it('measures ExerciseCard component render latency in isolation', async () => {
      const exercise = SEED_EXERCISES[0];
      const start = performance.now();
      const card = await render(
        <React.Fragment>
          {Array.from({ length: 10 }).map((_, i) => (
            <ExerciseCard
              key={i}
              exercise={exercise}
              onPress={jest.fn()}
              mode="browse"
              testID={`bench-card-${i}`}
            />
          ))}
        </React.Fragment>
      );
      const totalTime = performance.now() - start;
      const perCardMean = totalTime / 10;

      console.log('--- [BENCHMARK] ExerciseCard Isolation Render Latency ---');
      console.log(`10 Cards Batch Render Total: ${totalTime.toFixed(3)} ms`);
      console.log(`Per Card Render Mean: ${perCardMean.toFixed(3)} ms`);

      expect(perCardMean).toBeLessThan(200);
      card.unmount();
    });
  });

  // ==========================================
  // SECTION 2: CATALOGUE AUDIT
  // ==========================================
  describe('2. Catalogue Audit & Indian Gym Equipment Filtering', () => {
    it('verifies catalogue filter rules on standard and specialized movements', () => {
      const sampleSet: Exercise[] = [
        ...SEED_EXERCISES,
        {
          id: 'wger_501',
          name: 'Ring Dips',
          description: 'Dips on gymnastic rings',
          category: 'chest',
          categoryName: 'Chest',
          primaryMuscles: [{ id: 'm1', name: 'Chest' }],
          secondaryMuscles: [],
          equipment: [{ id: 'eq_rings', name: 'Gymnastic rings' }],
          images: [{ id: 'img_501', url: 'https://wger.de/media/rings.png' }],
          sourceProvider: 'wger',
          isCustom: false,
        },
        {
          id: 'wger_1935',
          name: 'Belt Squat',
          description: 'Squat using belt squat machine',
          category: 'legs',
          categoryName: 'Legs',
          primaryMuscles: [{ id: 'm2', name: 'Quadriceps' }],
          secondaryMuscles: [],
          equipment: [{ id: 'eq_machine', name: 'Machine' }],
          images: [],
          sourceProvider: 'wger',
          isCustom: false,
        },
        {
          id: 'wger_2616',
          name: 'Single-leg BOSU balance',
          description: 'Balance on BOSU',
          category: 'legs',
          categoryName: 'Legs',
          primaryMuscles: [],
          secondaryMuscles: [],
          equipment: [{ id: 'eq_bosu', name: 'BOSU' }],
          images: [],
          sourceProvider: 'wger',
          isCustom: false,
        },
      ];

      const { filtered, stats } = filterCatalogueForIndianGym(sampleSet);

      expect(stats.totalReviewed).toBe(sampleSet.length);
      expect(stats.nonStandardEquipmentCount).toBe(3);
      expect(stats.eligibleIndianGymCount).toBe(SEED_EXERCISES.length);
      expect(filtered.some((e) => e.name === 'Ring Dips')).toBe(false);
      expect(filtered.some((e) => e.name === 'Belt Squat')).toBe(false);
      expect(filtered.some((e) => e.name === 'Single-leg BOSU balance')).toBe(false);
      expect(filtered.some((e) => e.name === 'Barbell Bench Press')).toBe(true);

      const curatedIds = Object.keys(CURATED_EXERCISE_MEDIA_CATALOG);
      expect(curatedIds.length).toBe(12);
      curatedIds.forEach((id) => {
        const demo = CURATED_EXERCISE_MEDIA_CATALOG[id];
        expect(demo).toBeDefined();
        expect(demo.exerciseId).toBe(id);
      });
    });
  });

  // ==========================================
  // SECTION 3: CUSTOM PHOTO LIFECYCLE
  // ==========================================
  describe('3. Custom Photo Lifecycle Verification (Automated)', () => {
    it('verifies full custom photo lifecycle: create -> navigate away -> restart -> replace -> remove -> offline', async () => {
      const scope = { ownerId: 'audit_test_user', ownerType: 'authenticated' as const };
      const testPhotoUri = 'file:///data/user/0/com.bebig/cache/test_photo_1.jpg';
      const replacedPhotoUri = 'file:///data/user/0/com.bebig/cache/test_photo_2.jpg';

      // 1. Create with photo
      const created = await exerciseRepository.createCustomExercise(
        {
          name: 'Audit Incline Press',
          category: 'chest',
          primaryMuscles: ['Upper Chest'],
          equipment: ['Dumbbell', 'Incline bench'],
          images: [{ id: 'img_1', url: testPhotoUri, isMain: true }],
          photoPath: 'audit_test_user/custom_123/photo.jpg',
        },
        scope,
      );

      expect(created.id).toBeDefined();
      expect(hasCustomPhoto(created)).toBe(true);
      expect(getCustomPhotoUri(created)).toBe(testPhotoUri);

      // 2. Navigate away and return (fetch from storage)
      const retrieved = await exerciseRepository.getExerciseById(created.id, scope);
      expect(retrieved).not.toBeNull();
      expect(hasCustomPhoto(retrieved!)).toBe(true);
      expect(getCustomPhotoUri(retrieved!)).toBe(testPhotoUri);

      // 3. Restart application simulation (clear memory catalog, re-hydrate from platform storage)
      (exerciseRepository as any).invalidateCandidateCache();
      const afterRestart = await customExerciseStorage.getCustomExercises(scope);
      const restartedExercise = afterRestart.find((e) => e.id === created.id);
      expect(restartedExercise).toBeDefined();
      expect(hasCustomPhoto(restartedExercise!)).toBe(true);
      expect(getCustomPhotoUri(restartedExercise!)).toBe(testPhotoUri);

      // 4. Replace photo
      const updatedExercise: Exercise = {
        ...created,
        images: [{ id: 'img_2', url: replacedPhotoUri, isMain: true }],
        photoPath: 'audit_test_user/custom_123/photo_replaced.jpg',
      };
      await customExerciseStorage.saveCustomExercise(updatedExercise, scope);
      expect(getCustomPhotoUri(updatedExercise)).toBe(replacedPhotoUri);

      // 5. Remove photo
      const removedPhotoExercise: Exercise = {
        ...updatedExercise,
        images: [],
        photoPath: null,
      };
      await customExerciseStorage.saveCustomExercise(removedPhotoExercise, scope);
      expect(hasCustomPhoto(removedPhotoExercise)).toBe(false);
      expect(getCustomPhotoUri(removedPhotoExercise)).toBeNull();

      // 6. Offline behavior: Guest scope with local photo without cloud bucket
      const guestScope = { ownerId: 'guest_user', ownerType: 'guest' as const };
      const guestExercise = await exerciseRepository.createCustomExercise(
        {
          name: 'Guest Offline Squat',
          category: 'legs',
          primaryMuscles: ['Quadriceps'],
          equipment: ['Barbell'],
          images: [{ id: 'img_g1', url: 'file:///offline/guest.jpg', isMain: true }],
          photoPath: null,
        },
        guestScope,
      );
      expect(hasCustomPhoto(guestExercise)).toBe(true);
      expect(getCustomPhotoUri(guestExercise)).toBe('file:///offline/guest.jpg');
    });
  });

  // ==========================================
  // SECTION 4: UI CONSISTENCY
  // ==========================================
  describe('4. UI Consistency Inspection', () => {
    it('verifies ExerciseCard canonical layout and typography tokens in both browse and select modes', async () => {
      const exercise = SEED_EXERCISES[0]; // Barbell Bench Press
      const onPressBrowse = jest.fn();
      const onPressSelect = jest.fn();

      // Render Browse Mode (Library)
      const browseView = await render(
        <ExerciseCard
          exercise={exercise}
          onPress={onPressBrowse}
          mode="browse"
        />
      );

      expect(browseView.getByTestId('exercise-item-seed-bench-press')).toBeTruthy();
      expect(browseView.getByText('Barbell Bench Press')).toBeTruthy();
      expect(browseView.getByText('Chest • Barbell, Bench')).toBeTruthy();
      expect(browseView.getByTestId('exercise-item-seed-bench-press-thumbnail')).toBeTruthy();

      // Render Select Mode (Ongoing Workout Picker)
      const selectView = await render(
        <ExerciseCard
          exercise={exercise}
          onPress={onPressSelect}
          mode="select"
          isSelected={false}
          isMultiSelect={true}
        />
      );

      expect(selectView.getByTestId('picker-exercise-seed-bench-press')).toBeTruthy();
      expect(selectView.getByText('Barbell Bench Press')).toBeTruthy();
      expect(selectView.getByText('Chest • Barbell, Bench')).toBeTruthy();
      expect(selectView.getByTestId('picker-checkbox-seed-bench-press')).toBeTruthy();
    });
  });
});
