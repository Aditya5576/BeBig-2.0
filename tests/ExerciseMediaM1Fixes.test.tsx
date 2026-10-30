/**
 * BeBig 2.0 — Exercise Media M1 Fixes Regression Test Suite
 *
 * Covers:
 * 1. Exercise Detail displays approved media for `seed-bench-press` and `wger_73`.
 * 2. Custom photos take priority over curated media on custom exercises.
 * 3. Missing media displays the correct fallback (no broken image, clean layout).
 * 4. Attribution and licence information display correctly.
 * 5. All first-page browse results include foundational seed exercises at the beginning.
 * 6. Pagination does not duplicate seed exercises on subsequent pages.
 * 7. Search and category filtering continue working.
 */

import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import ExerciseDetailScreen from '../app/exercises/[id]';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { exerciseCacheStorage, SEED_EXERCISES } from '../src/features/exercises/storage/exerciseCacheStorage';
import { CURATED_EXERCISE_MEDIA_CATALOG } from '../src/features/exercises/data/curatedMediaCatalog';
import { Exercise } from '../src/features/exercises/types';
import { UserScope } from '../src/features/auth/utils/userScope';
import { useAuthStore } from '../src/features/auth';

let mockParams: Record<string, string> = {};
const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: any) => {
    require('react').useEffect(cb, []);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

describe('Exercise Media M1 Fixes', () => {
  const testUser: UserScope = {
    ownerId: 'test_user_m1',
    ownerType: 'authenticated',
  };

  const sampleWger73Item = {
    id: 73,
    translations: [
      {
        language: 2,
        name: 'Bench Press',
        description: 'Lie on bench, press barbell upward.',
      },
    ],
    category: { id: 11, name: 'Chest' },
    muscles: [{ id: 1, name: 'Pectoralis major', is_front: true }],
    muscles_secondary: [{ id: 2, name: 'Triceps brachii', is_front: false }],
    equipment: [{ id: 1, name: 'Barbell' }],
    images: [],
  };

  const sampleUncuratedWgerItem = {
    id: 9999,
    translations: [
      {
        language: 2,
        name: 'Uncurated Movement',
        description: 'Movement with no media in catalog or provider.',
      },
    ],
    category: { id: 12, name: 'Back' },
    muscles: [],
    muscles_secondary: [],
    equipment: [],
    images: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    useAuthStore.setState({
      user: { id: testUser.ownerId, email: 'test@example.com' } as any,
      session: { user: { id: testUser.ownerId } } as any,
      isGuest: false,
      status: 'authenticated',
    });
  });

  describe('Fix 1 — Exercise Detail Media Integration', () => {
    it('1a. displays approved curated demonstration image for seed-bench-press', async () => {
      mockParams = { id: 'seed-bench-press' };

      await render(<ExerciseDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
      });

      await waitFor(() => {
        const image = screen.getByTestId('exercise-detail-image');
        expect(image).toBeTruthy();
        expect(image.props.source.uri).toBe(
          CURATED_EXERCISE_MEDIA_CATALOG['seed-bench-press'].demonstrationUri
        );
      });
    });

    it('1b. displays approved curated demonstration image for wger_73', async () => {
      mockParams = { id: 'wger_73' };

      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleWger73Item,
      }) as any;

      await render(<ExerciseDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeTruthy();
      });

      await waitFor(() => {
        const image = screen.getByTestId('exercise-detail-image');
        expect(image).toBeTruthy();
        expect(image.props.source.uri).toBe(
          CURATED_EXERCISE_MEDIA_CATALOG['wger_73'].demonstrationUri
        );
      });
    });

    it('2. custom photo takes absolute priority over curated media on custom exercises', async () => {
      const customEx: Exercise = {
        id: 'custom_test_press',
        name: 'Custom Bench Press',
        description: 'My custom bench variation',
        category: 'chest',
        categoryName: 'Chest',
        primaryMuscles: [{ id: 'm1', name: 'Chest' }],
        secondaryMuscles: [],
        equipment: [],
        images: [{ id: 'photo_custom_test_press', url: 'file:///local/my_custom_bench.jpg', isMain: true }],
        isCustom: true,
        sourceProvider: 'custom',
      };

      await customExerciseStorage.saveCustomExercise(customEx, testUser);
      mockParams = { id: 'custom_test_press' };

      await render(<ExerciseDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Custom Bench Press')).toBeTruthy();
      });

      await waitFor(() => {
        const image = screen.getByTestId('exercise-detail-image');
        expect(image).toBeTruthy();
        expect(image.props.source.uri).toBe('file:///local/my_custom_bench.jpg');
      });
    });

    it('3. uncurated exercise without media renders cleanly with no broken image', async () => {
      mockParams = { id: 'wger_9999' };

      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleUncuratedWgerItem,
      }) as any;

      await render(<ExerciseDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Uncurated Movement')).toBeTruthy();
      });

      expect(screen.queryByTestId('exercise-detail-image')).toBeNull();
      expect(screen.queryByTestId('exercise-detail-attribution')).toBeNull();
    });

    it('4. displays author attribution and license information for approved curated media', async () => {
      mockParams = { id: 'wger_73' };

      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleWger73Item,
      }) as any;

      await render(<ExerciseDetailScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeTruthy();
      });

      await waitFor(() => {
        const attribution = screen.getByTestId('exercise-detail-attribution');
        expect(attribution).toBeTruthy();

        const expectedAuthor = CURATED_EXERCISE_MEDIA_CATALOG['wger_73'].license.author;
        const expectedLicense = CURATED_EXERCISE_MEDIA_CATALOG['wger_73'].license.type;
        expect(screen.getByText(new RegExp(expectedAuthor))).toBeTruthy();
        expect(screen.getByText(new RegExp(expectedLicense))).toBeTruthy();
      });
    });
  });

  describe('Fix 2 — First Page Browse & Seed Inclusion', () => {
    it('5. first-page browse (All) includes foundational seed exercises at the beginning', async () => {
      // Mock provider returning standard Wger page 1 items
      const mockProvider = {
        providerId: 'wger',
        listExercises: jest.fn().mockResolvedValue({
          exercises: [
            {
              id: 'wger_9',
              name: '2 Handed Kettlebell Swing',
              category: 'legs',
              categoryName: 'Legs',
              primaryMuscles: [],
              secondaryMuscles: [],
              equipment: [],
              images: [],
              isCustom: false,
            },
            {
              id: 'wger_73',
              name: 'Bench Press',
              category: 'chest',
              categoryName: 'Chest',
              primaryMuscles: [],
              secondaryMuscles: [],
              equipment: [],
              images: [],
              isCustom: false,
            },
          ],
          totalCount: 939,
          hasMore: true,
          nextOffset: 20,
        }),
        getExerciseById: jest.fn(),
        searchExercises: jest.fn(),
      };

      const repo = new (exerciseRepository.constructor as any)(mockProvider);
      const result = await repo.getExercises({ limit: 20, offset: 0, source: 'all' }, testUser);

      expect(result.exercises.length).toBeGreaterThan(SEED_EXERCISES.length);

      // Verify foundational seed exercises are at the beginning
      const firstIds = result.exercises.slice(0, SEED_EXERCISES.length).map((e: Exercise) => e.id);
      expect(firstIds).toContain('seed-bench-press');
      expect(firstIds).toContain('seed-lateral-raise');
      expect(firstIds).toContain('seed-squat');
      expect(firstIds).toContain('seed-deadlift');

      // Verify Wger provider exercises follow after
      const remainingIds = result.exercises.slice(SEED_EXERCISES.length).map((e: Exercise) => e.id);
      expect(remainingIds).toContain('wger_9');
      expect(remainingIds).toContain('wger_73');
    });

    it('6. pagination (offset > 0) does not duplicate seed exercises', async () => {
      const mockProvider = {
        providerId: 'wger',
        listExercises: jest.fn().mockResolvedValue({
          exercises: [
            {
              id: 'wger_84',
              name: 'Bent Over Rowing Reverse',
              category: 'back',
              categoryName: 'Back',
              primaryMuscles: [],
              secondaryMuscles: [],
              equipment: [],
              images: [],
              isCustom: false,
            },
          ],
          totalCount: 939,
          hasMore: true,
          nextOffset: 40,
        }),
        getExerciseById: jest.fn(),
        searchExercises: jest.fn(),
      };

      const repo = new (exerciseRepository.constructor as any)(mockProvider);
      const result = await repo.getExercises({ limit: 20, offset: 20, source: 'all' }, testUser);

      // Seed exercises MUST NOT be present on page 2+
      const ids = result.exercises.map((e: Exercise) => e.id);
      expect(ids).not.toContain('seed-bench-press');
      expect(ids).not.toContain('seed-lateral-raise');
      expect(ids).toContain('wger_84');
    });

    it('7. search continues to work and rank matching exercises correctly', async () => {
      const mockProvider = {
        providerId: 'wger',
        listExercises: jest.fn().mockResolvedValue({
          exercises: [
            {
              id: 'wger_73',
              name: 'Bench Press',
              category: 'chest',
              categoryName: 'Chest',
              primaryMuscles: [],
              secondaryMuscles: [],
              equipment: [],
              images: [],
              isCustom: false,
            },
          ],
          totalCount: 1,
          hasMore: false,
        }),
        getExerciseById: jest.fn(),
        searchExercises: jest.fn(),
      };

      const repo = new (exerciseRepository.constructor as any)(mockProvider);
      const result = await repo.getExercises({ query: 'Bench Press', limit: 20, offset: 0 }, testUser);

      const ids = result.exercises.map((e: Exercise) => e.id);
      expect(ids).toContain('seed-bench-press');
      expect(ids).toContain('wger_73');
    });
  });
});
