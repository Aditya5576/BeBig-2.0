/**
 * BeBig 2.0 — Tier 2 High-ROI Upgrade Verification Suite
 *
 * Verifies:
 * 1. Strict exact canonical open license allowlist gating (rejecting substring tricks & missing licenses).
 * 2. Server catalog record mapping to provider-agnostic domain Exercise model.
 * 3. WgerExerciseProvider server-catalog queries with graceful fallback to direct fetch.
 * 4. ExerciseThumbnail rendering with expo-image (disk cache, transition, recyclingKey, onError fallback).
 * 5. iOS Safari WebKit crash guard: FlatList row thumbnail suppression via hideThumbnail={true}.
 * 6. Functional onError image fallbacks on exercise detail screen.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { isLicenseAllowed } from '../src/features/exercises/providers/wger/wgerLicense';
import {
  mapWgerCatalogRecordToExercise,
  WgerCatalogRecord,
} from '../src/features/exercises/providers/wger/wgerMapper';
import { WgerExerciseProvider } from '../src/features/exercises/providers/wger/WgerExerciseProvider';
import { ExerciseThumbnail } from '../src/features/exercises/components/ExerciseThumbnail';
import { ExerciseCard } from '../src/features/exercises/components/ExerciseCard';
import { Exercise } from '../src/features/exercises/types';
import ExerciseDetailScreen from '../app/exercises/[id]';

const mockSupabaseFrom = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockSupabaseFrom(table),
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'seed-bench-press' }),
  usePathname: () => '/exercises/seed-bench-press',
  Link: ({ children }: any) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: any) => children, { Screen: () => null }),
}));

describe('Tier 2 High-ROI Upgrades — Server Catalog & expo-image', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('1. License & IP Allowlist Gating', () => {
    it('approves legitimate open licenses (CC-BY-SA, CC-BY, CC0, Public Domain)', () => {
      expect(isLicenseAllowed('Creative Commons Attribution Share Alike 4.0')).toBe(true);
      expect(isLicenseAllowed('CC-BY-SA-4.0')).toBe(true);
      expect(isLicenseAllowed('cc-by-3.0')).toBe(true);
      expect(isLicenseAllowed('CC0')).toBe(true);
      expect(isLicenseAllowed('Public Domain')).toBe(true);
      expect(isLicenseAllowed('pd')).toBe(true);
    });

    it('rejects proprietary, unlicensed, or unrecognized license strings', () => {
      expect(isLicenseAllowed('All Rights Reserved')).toBe(false);
      expect(isLicenseAllowed('Proprietary / Commercial')).toBe(false);
      expect(isLicenseAllowed('GPLv3')).toBe(false);
      expect(isLicenseAllowed('MIT')).toBe(false);
      expect(isLicenseAllowed('AGPL')).toBe(false);
      expect(isLicenseAllowed('')).toBe(false);
      expect(isLicenseAllowed(null)).toBe(false);
      expect(isLicenseAllowed(undefined)).toBe(false);
    });

    it('rejects substring tricks that contain allowed substrings inside proprietary/negated licenses', () => {
      expect(isLicenseAllowed('Not CC-BY-SA')).toBe(false);
      expect(isLicenseAllowed('Proprietary - CC-BY')).toBe(false);
      expect(isLicenseAllowed('Fake CC0 License')).toBe(false);
      expect(isLicenseAllowed('Modified Public Domain Not Open')).toBe(false);
    });

    it('rejects records with missing/null license even when license_author is present', () => {
      const mockItemWithAuthorOnly: any = {
        id: 999,
        name: 'Unlicensed Exercise',
        license_author: 'Jane Doe',
        license_object: null,
        license: null,
      };

      const rawLicenseName =
        (typeof mockItemWithAuthorOnly.license_object?.full_name === 'string' &&
          mockItemWithAuthorOnly.license_object.full_name.trim()) ||
        (typeof mockItemWithAuthorOnly.license_object?.short_name === 'string' &&
          mockItemWithAuthorOnly.license_object.short_name.trim()) ||
        (typeof (mockItemWithAuthorOnly as any).license?.full_name === 'string' &&
          (mockItemWithAuthorOnly as any).license.full_name.trim()) ||
        (typeof (mockItemWithAuthorOnly as any).license?.short_name === 'string' &&
          (mockItemWithAuthorOnly as any).license.short_name.trim()) ||
        null;

      expect(rawLicenseName).toBeNull();
      expect(isLicenseAllowed(rawLicenseName)).toBe(false);
    });
  });

  describe('2. Server Catalog Record Domain Mapping', () => {
    const sampleRecord: WgerCatalogRecord = {
      id: 'cat-uuid-001',
      wger_id: 192,
      name: 'Overhead Barbell Press',
      description: 'Press bar overhead with strict lockout.',
      category: 'shoulders',
      primary_muscles: ['Anterior Deltoid', 'Triceps'],
      secondary_muscles: ['Lateral Deltoid', 'Trapezius'],
      equipment: ['Barbell', 'Rack'],
      image_url: 'https://wger.de/media/exercises/ohp.png',
      license_name: 'CC-BY-SA 4.0',
      license_author: 'BeBig Editorial',
      attribution_text: 'Exercise data provided by Wger.de under CC-BY-SA 4.0.',
      is_active: true,
      synced_at: '2026-11-19T10:00:00Z',
    };

    it('maps server catalog record cleanly into domain Exercise structure', () => {
      const exercise = mapWgerCatalogRecordToExercise(sampleRecord);
      expect(exercise).not.toBeNull();
      expect(exercise?.id).toBe('wger_192');
      expect(exercise?.name).toBe('Overhead Barbell Press');
      expect(exercise?.category).toBe('shoulders');
      expect(exercise?.categoryName).toBe('Shoulders');
      expect(exercise?.sourceProvider).toBe('wger');
      expect(exercise?.sourceExerciseId).toBe('192');
      expect(exercise?.isCustom).toBe(false);
      expect(exercise?.primaryMuscles).toHaveLength(2);
      expect(exercise?.equipment[0].name).toBe('Barbell');
      expect(exercise?.images[0].url).toBe('https://wger.de/media/exercises/ohp.png');
    });

    it('returns null if record has missing essential identifiers', () => {
      expect(mapWgerCatalogRecordToExercise({ name: 'Incomplete' } as any)).toBeNull();
      expect(mapWgerCatalogRecordToExercise({ wger_id: 123 } as any)).toBeNull();
      expect(mapWgerCatalogRecordToExercise(null as any)).toBeNull();
    });
  });

  describe('3. WgerExerciseProvider — Server Catalog First & Fallback', () => {
    it('returns server catalog results when Supabase returns cached records', async () => {
      const mockCatalogRows = [
        {
          id: 'row-1',
          wger_id: 101,
          name: 'Bench Press',
          description: 'Flat barbell bench press',
          category: 'chest',
          primary_muscles: ['Chest'],
          secondary_muscles: ['Triceps'],
          equipment: ['Barbell', 'Bench'],
          image_url: 'https://wger.de/media/bench.png',
          license_name: 'CC-BY-SA 4.0',
          license_author: 'Wger',
          attribution_text: 'CC-BY-SA 4.0',
          is_active: true,
        },
      ];

      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockCatalogRows,
          count: 1,
          error: null,
        }),
      });

      mockSupabaseFrom.mockReturnValue({
        select: selectMock,
      });

      const mockFetch = jest.fn();
      globalThis.fetch = mockFetch;

      const provider = new WgerExerciseProvider();
      const result = await provider.listExercises({ category: 'chest', limit: 10, offset: 0 });

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].id).toBe('wger_101');
      expect(result.exercises[0].name).toBe('Bench Press');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('falls back cleanly to direct Wger fetch when server catalog is empty', async () => {
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          count: 0,
          error: null,
        }),
      });

      mockSupabaseFrom.mockReturnValue({
        select: selectMock,
      });

      const directWgerResponse = {
        count: 1,
        next: null,
        results: [
          {
            id: 202,
            name: 'Direct Incline Dumbbell Press',
            category: { id: 11, name: 'Chest' },
            muscles: [{ id: 1, name: 'Chest' }],
            equipment: [{ id: 1, name: 'Dumbbells' }],
            images: [],
          },
        ],
      };

      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => directWgerResponse,
      } as any);

      const provider = new WgerExerciseProvider();
      const result = await provider.listExercises({ limit: 10, offset: 0 });

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].id).toBe('wger_202');
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('getExerciseById queries Supabase by wger_id first and returns mapped exercise', async () => {
      const singleMock = jest.fn().mockResolvedValue({
        data: {
          id: 'row-303',
          wger_id: 303,
          name: 'Barbell Squat',
          category: 'legs',
          primary_muscles: ['Quadriceps'],
          secondary_muscles: ['Glutes'],
          equipment: ['Barbell'],
          image_url: 'https://wger.de/media/squat.png',
          license_name: 'CC-BY 4.0',
          license_author: 'Wger',
          attribution_text: 'CC-BY 4.0',
          is_active: true,
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: singleMock,
          }),
        }),
      });

      const provider = new WgerExerciseProvider();
      const exercise = await provider.getExerciseById('wger_303');

      expect(exercise).not.toBeNull();
      expect(exercise?.id).toBe('wger_303');
      expect(exercise?.name).toBe('Barbell Squat');
      expect(exercise?.category).toBe('legs');
    });
  });

  describe('4. ExerciseThumbnail with expo-image', () => {
    const mockExerciseWithImage: Exercise = {
      id: 'wger_404',
      name: 'Romanian Deadlift',
      description: 'Hinge at the hips.',
      category: 'back',
      categoryName: 'Back',
      primaryMuscles: [{ id: '1', name: 'Hamstrings' }],
      secondaryMuscles: [{ id: '2', name: 'Glutes' }],
      equipment: [{ id: '1', name: 'Barbell' }],
      images: [
        {
          id: 'img-1',
          url: 'https://wger.de/media/rdl.png',
          thumbnailUrl: 'https://wger.de/media/rdl-thumb.png',
          isMain: true,
        },
      ],
      sourceProvider: 'wger',
      sourceExerciseId: '404',
      isCustom: false,
    };

    const mockExerciseNoImage: Exercise = {
      ...mockExerciseWithImage,
      id: 'wger_405',
      images: [],
    };

    it('renders expo-image with contentFit cover, disk caching, and recyclingKey in detail view', async () => {
      const { getByTestId } = await render(
        <ExerciseThumbnail exercise={mockExerciseWithImage} size={64} isDetailView={true} testID="test-thumb" />
      );

      const imageElement = getByTestId('test-thumb-image');
      expect(imageElement).toBeTruthy();
      expect(imageElement.props.source).toEqual([{ uri: 'https://wger.de/media/rdl-thumb.png' }]);
      expect(imageElement.props.contentFit).toBe('cover');
      expect(imageElement.props.cachePolicy).toBe('disk');
      expect(imageElement.props.transition).toEqual({ duration: 150 });
      expect(imageElement.props.recyclingKey).toBe('https://wger.de/media/rdl-thumb.png');
    });

    it('falls back to neutral icon when expo-image triggers onError', async () => {
      const { getByTestId, queryByTestId } = await render(
        <ExerciseThumbnail exercise={mockExerciseWithImage} size={64} isDetailView={true} testID="test-thumb-err" />
      );

      const imageElement = getByTestId('test-thumb-err-image');
      expect(imageElement).toBeTruthy();

      await act(async () => {
        imageElement.props.onError({ nativeEvent: { error: 'Failed to load' } });
      });

      await waitFor(() => {
        expect(queryByTestId('test-thumb-err-image')).toBeNull();
        expect(getByTestId('test-thumb-err-fallback')).toBeTruthy();
      });
    });

    it('renders neutral fallback icon when no media is present', async () => {
      const { getByTestId, queryByTestId } = await render(
        <ExerciseThumbnail exercise={mockExerciseNoImage} size={44} testID="test-thumb-no-img" />
      );

      expect(queryByTestId('test-thumb-no-img-image')).toBeNull();
      expect(getByTestId('test-thumb-no-img-fallback')).toBeTruthy();
    });
  });

  describe('5. iOS Safari WebKit Memory Guard — Row Thumbnail Suppression', () => {
    const mockRowExercise: Exercise = {
      id: 'wger_505',
      name: 'Dumbbell Hammer Curl',
      description: '',
      category: 'arms',
      categoryName: 'Arms',
      primaryMuscles: [{ id: '1', name: 'Biceps' }],
      secondaryMuscles: [],
      equipment: [{ id: '1', name: 'Dumbbell' }],
      images: [
        {
          id: 'img-505',
          url: 'https://wger.de/media/curl.png',
          thumbnailUrl: 'https://wger.de/media/curl.png',
          isMain: true,
        },
      ],
      sourceProvider: 'wger',
      isCustom: false,
    };

    it('suppresses expo-image thumbnail and renders initial badge when hideThumbnail={true}', async () => {
      const { queryByTestId, getByTestId, getByText } = await render(
        <ExerciseCard
          exercise={mockRowExercise}
          hideThumbnail={true}
          onPress={jest.fn()}
          testID="exercise-row-505"
        />
      );

      expect(queryByTestId('exercise-row-505-thumbnail-image')).toBeNull();
      expect(getByTestId('exercise-row-505-badge')).toBeTruthy();
      expect(getByText('Dumbbell Hammer Curl')).toBeTruthy();
    });
  });

  describe('6. Exercise Detail Screen — onError Placeholder Fallback', () => {
    it('degrades to clean placeholder card when detail image triggers onError', async () => {
      const screen = await render(<ExerciseDetailScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('exercise-detail-image')).toBeTruthy();
      });

      const image = screen.getByTestId('exercise-detail-image');
      await act(async () => {
        image.props.onError({ nativeEvent: { error: 'Image failed to load' } });
      });

      await waitFor(() => {
        expect(screen.queryByTestId('exercise-detail-image')).toBeNull();
        expect(screen.getByTestId('exercise-detail-placeholder')).toBeTruthy();
      });
    });
  });
});
