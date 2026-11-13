/**
 * BeBig 2.0 — Exercise Picker & Web Memory Safety Regression Test Suite
 *
 * Verifies P0 fixes for iOS Safari WebKit memory limits and Jetsam crash prevention:
 * 1. ExerciseThumbnail suppresses multi-frame animated GIFs in compact list/picker mode (isDetailView = false).
 * 2. ExerciseThumbnail falls back to static alternative images if present, or clean neutral fallback icons.
 * 3. ExerciseThumbnail allows full animated demonstration only when isDetailView = true (e.g. Exercise Detail screen).
 * 4. ExerciseThumbnail includes loading="lazy" and decoding="async" attributes on Web.
 * 5. ExercisePickerModal purges exercises state when visible = false to reclaim memory during active workouts.
 * 6. ExercisePickerModal applies Web-safe FlatList virtualization (windowSize=5, initialNumToRender=8, maxToRenderPerBatch=6).
 */

import React from 'react';
import { Platform } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { ExerciseThumbnail } from '../src/features/exercises/components/ExerciseThumbnail';
import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';
import { Exercise } from '../src/features/exercises/types';
import { CuratedMediaCatalog } from '../src/features/exercises/data/curatedMediaCatalog';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: any) => {
    require('react').useEffect(cb, []);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

const mockGifExercise: Exercise = {
  id: 'wger_1225',
  name: 'Barbell Squat',
  description: 'Squat movement',
  category: 'legs',
  categoryName: 'Legs',
  primaryMuscles: [{ id: 'quads', name: 'Quadriceps' }],
  secondaryMuscles: [],
  equipment: [{ id: 'barbell', name: 'Barbell' }],
  sourceProvider: 'wger',
  isCustom: false,
  images: [
    {
      id: 'img_gif',
      url: 'https://wger.de/media/exercise-images/1225/Squat-1.gif',
      thumbnailUrl: 'https://wger.de/media/exercise-images/1225/Squat-1.gif',
      isMain: true,
    },
  ],
};

const mockGifWithStaticExercise: Exercise = {
  id: 'wger_bench_hybrid',
  name: 'Hybrid Bench Press',
  description: 'Bench press movement',
  category: 'chest',
  categoryName: 'Chest',
  primaryMuscles: [{ id: 'chest', name: 'Chest' }],
  secondaryMuscles: [],
  equipment: [{ id: 'barbell', name: 'Barbell' }],
  sourceProvider: 'wger',
  isCustom: false,
  images: [
    {
      id: 'img_gif',
      url: 'https://wger.de/media/exercise-images/999/Bench.gif',
      thumbnailUrl: 'https://wger.de/media/exercise-images/999/Bench.gif',
      isMain: true,
    },
    {
      id: 'img_static',
      url: 'https://wger.de/media/exercise-images/999/Bench_static.jpg',
      thumbnailUrl: 'https://wger.de/media/exercise-images/999/Bench_static_thumb.jpg',
      isMain: false,
    },
  ],
};

const testCatalog: CuratedMediaCatalog = {
  wger_1225: {
    exerciseId: 'wger_1225',
    mediaType: 'animation',
    thumbnailUri: 'https://wger.de/media/exercise-images/1225/Squat-1.gif',
    demonstrationUri: 'https://wger.de/media/exercise-images/1225/Squat-1.gif',
    license: {
      type: 'CC-BY-SA-4.0',
      author: 'Wger Contributor',
      sourceUrl: 'https://wger.de/exercise/1225',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attributionNotes: 'Squat animation by Wger Contributor',
    },
    isApproved: true,
  },
};

describe('ExercisePicker & Web Memory Safety', () => {
  describe('ExerciseThumbnail GIF Prevention in List Mode', () => {
    it('1. suppresses animated GIF in compact mode (isDetailView=false) and renders neutral fallback', async () => {
      const { queryByTestId, getByTestId } = await render(
        <ExerciseThumbnail
          exercise={mockGifExercise}
          catalog={testCatalog}
          testID="test-thumb-gif"
          isDetailView={false}
        />
      );

      // Should NOT render an Image element with GIF
      expect(queryByTestId('test-thumb-gif-image')).toBeNull();
      // Should render the fallback container with neutral icon
      expect(getByTestId('test-thumb-gif-fallback')).toBeTruthy();
    });

    it('2. falls back to non-GIF static image if available when demonstration is a GIF', async () => {
      const { getByTestId } = await render(
        <ExerciseThumbnail
          exercise={mockGifWithStaticExercise}
          testID="test-thumb-hybrid"
          isDetailView={false}
        />
      );

      const image = getByTestId('test-thumb-hybrid-image');
      expect(image).toBeTruthy();
      expect(image.props.source.uri).toBe('https://wger.de/media/exercise-images/999/Bench_static_thumb.jpg');
    });

    it('3. allows animated GIF demonstration when isDetailView is true', async () => {
      const { getByTestId } = await render(
        <ExerciseThumbnail
          exercise={mockGifExercise}
          catalog={testCatalog}
          testID="test-thumb-detail"
          isDetailView={true}
        />
      );

      const image = getByTestId('test-thumb-detail-image');
      expect(image).toBeTruthy();
      expect(image.props.source.uri).toBe('https://wger.de/media/exercise-images/1225/Squat-1.gif');
    });

    it('4. passes lazy loading and async decoding on Web platform', async () => {
      const originalPlatform = Platform.OS;
      try {
        (Platform as any).OS = 'web';
        const { getByTestId } = await render(
          <ExerciseThumbnail
            exercise={mockGifWithStaticExercise}
            testID="test-thumb-web"
            isDetailView={false}
          />
        );

        const image = getByTestId('test-thumb-web-image');
        expect(image.props.loading).toBe('lazy');
        expect(image.props.decoding).toBe('async');
      } finally {
        (Platform as any).OS = originalPlatform;
      }
    });
  });

  describe('ExercisePickerModal Virtualization and Memory Cleanup', () => {
    it('5. renders with web-optimized virtualization parameters', async () => {
      const originalPlatform = Platform.OS;
      try {
        (Platform as any).OS = 'web';
        const { getByTestId } = await render(
          <ExercisePickerModal
            visible={true}
            onClose={jest.fn()}
            onSelectExercise={jest.fn()}
            selectedExerciseIds={[]}
          />
        );

        const list = getByTestId('picker-exercise-list');
        expect(list.props.initialNumToRender).toBe(8);
        expect(list.props.maxToRenderPerBatch).toBe(6);
        expect(list.props.windowSize).toBe(5);
      } finally {
        (Platform as any).OS = originalPlatform;
      }
    });

    it('6. unloads exercises and unmounts list tree when visible becomes false, then re-mounts when reopened', async () => {
      const { getByTestId, queryByTestId, rerender } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          onSelectExercise={jest.fn()}
          selectedExerciseIds={[]}
        />
      );

      // Initially visible, list is mounted
      expect(getByTestId('picker-exercise-list')).toBeTruthy();

      // Now close modal (visible = false)
      await act(async () => {
        await rerender(
          <ExercisePickerModal
            visible={false}
            onClose={jest.fn()}
            onSelectExercise={jest.fn()}
            selectedExerciseIds={[]}
          />
        );
      });

      // When visible = false, the entire picker list is unmounted from the UI tree, freeing memory
      expect(queryByTestId('picker-exercise-list')).toBeNull();

      // Reopen modal (visible = true)
      await act(async () => {
        await rerender(
          <ExercisePickerModal
            visible={true}
            onClose={jest.fn()}
            onSelectExercise={jest.fn()}
            selectedExerciseIds={[]}
          />
        );
      });

      // List re-mounts cleanly
      expect(getByTestId('picker-exercise-list')).toBeTruthy();
    });
  });
});
