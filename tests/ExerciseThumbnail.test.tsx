/**
 * BeBig 2.0 — Exercise Thumbnail Component Unit Tests
 *
 * Verifies that:
 * 1. Approved test fixtures for exact stable IDs render static thumbnail images.
 * 2. Unknown IDs and empty catalogue entries safely render category fallbacks.
 * 3. Unapproved, unverified, or insufficiently licensed assets are never displayed.
 * 4. Custom exercise photos render if present.
 * 5. Corrupted/failing image URIs gracefully fall back without layout crashing.
 * 6. No video player or autoplay component is present in list rows.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ExerciseThumbnail } from '../src/features/exercises/components/ExerciseThumbnail';
import { Exercise, ExerciseDemonstration } from '../src/features/exercises/types';
import { CuratedMediaCatalog } from '../src/features/exercises/data/curatedMediaCatalog';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

describe('ExerciseThumbnail Component', () => {
  const approvedBenchDemo: ExerciseDemonstration = {
    exerciseId: 'seed-bench-press',
    mediaType: 'image',
    thumbnailUri: 'https://cdn.example.com/thumbnails/bench-press.webp',
    demonstrationUri: 'https://cdn.example.com/demos/bench-press.webp',
    license: {
      type: 'CC-BY-4.0',
      author: 'Coach Alice',
      sourceUrl: 'https://example.com/exercises/bench-press',
    },
    isApproved: true,
  };

  const unapprovedDemo: ExerciseDemonstration = {
    exerciseId: 'seed-squat',
    mediaType: 'image',
    thumbnailUri: 'https://cdn.example.com/thumbnails/squat.webp',
    demonstrationUri: 'https://cdn.example.com/demos/squat.webp',
    license: {
      type: 'UNVERIFIED',
      author: 'Unknown',
      sourceUrl: 'https://example.com/unverified',
    },
    isApproved: false,
  };

  const testCatalog: CuratedMediaCatalog = Object.freeze({
    'seed-bench-press': approvedBenchDemo,
    'seed-squat': unapprovedDemo,
  });

  const baseExercise: Exercise = {
    id: 'seed-bench-press',
    name: 'Barbell Bench Press',
    description: 'Chest press',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 'm1', name: 'Chest' }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq1', name: 'Barbell' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  };

  it('1. renders static thumbnail image for an approved exercise in the catalog', async () => {
    await render(
      <ExerciseThumbnail
        exercise={baseExercise}
        catalog={testCatalog}
        testID="test-thumb"
      />
    );

    const imageElement = screen.getByTestId('test-thumb-image');
    expect(imageElement).toBeTruthy();
    expect(imageElement.props.source).toEqual({
      uri: 'https://cdn.example.com/thumbnails/bench-press.webp',
    });
    expect(imageElement.props.resizeMode).toBe('cover');
  });

  it('2. safely renders neutral fallback without letters when exercise is unknown or catalog is empty', async () => {
    const unknownExercise: Exercise = {
      ...baseExercise,
      id: 'wger_unknown_999',
      category: 'legs',
      categoryName: 'Legs',
    };

    await render(
      <ExerciseThumbnail
        exercise={unknownExercise}
        catalog={testCatalog}
        testID="test-thumb"
      />
    );

    expect(screen.queryByTestId('test-thumb-image')).toBeNull();
    const fallbackElement = screen.getByTestId('test-thumb-fallback');
    expect(fallbackElement).toBeTruthy();
    // Neutral fallback contains no letter initials (e.g. no 'LG', 'BK', 'CH', 'BP')
    expect(screen.queryByText('LG')).toBeNull();
    expect(screen.queryByText('CH')).toBeNull();
    expect(screen.queryByText('BK')).toBeNull();
  });

  it('3. rejects unapproved or unverified assets and falls back to neutral placeholder', async () => {
    const unapprovedExercise: Exercise = {
      ...baseExercise,
      id: 'seed-squat',
      category: 'legs',
      categoryName: 'Legs',
    };

    await render(
      <ExerciseThumbnail
        exercise={unapprovedExercise}
        catalog={testCatalog}
        testID="test-thumb"
      />
    );

    expect(screen.queryByTestId('test-thumb-image')).toBeNull();
    expect(screen.getByTestId('test-thumb-fallback')).toBeTruthy();
    expect(screen.queryByText('LG')).toBeNull();
  });

  it('4. renders custom exercise photo when present on a custom exercise', async () => {
    const customExerciseWithPhoto: Exercise = {
      id: 'custom_1729000000000_abc',
      name: 'Custom Pushup',
      description: 'Home variation',
      category: 'chest',
      categoryName: 'Chest',
      primaryMuscles: [{ id: 'm1', name: 'Chest' }],
      secondaryMuscles: [],
      equipment: [],
      images: [],
      sourceProvider: 'custom',
      isCustom: true,
      photoPath: 'file:///data/user/photos/custom_pushup.jpg',
    };

    await render(
      <ExerciseThumbnail
        exercise={customExerciseWithPhoto}
        catalog={testCatalog}
        testID="test-thumb"
      />
    );

    const imageElement = screen.getByTestId('test-thumb-image');
    expect(imageElement).toBeTruthy();
    expect(imageElement.props.source).toEqual({
      uri: 'file:///data/user/photos/custom_pushup.jpg',
    });
  });

  it('5. falls back to category glyph on image load error without crashing', async () => {
    await render(
      <ExerciseThumbnail
        exercise={baseExercise}
        catalog={testCatalog}
        testID="test-thumb"
      />
    );

    const imageElement = screen.getByTestId('test-thumb-image');
    // Simulate image loading failure
    fireEvent(imageElement, 'error', { nativeEvent: { error: 'Network failure' } });

    await waitFor(() => {
      expect(screen.queryByTestId('test-thumb-image')).toBeNull();
    });
    expect(screen.getByTestId('test-thumb-fallback')).toBeTruthy();
    expect(screen.queryByText('CH')).toBeNull();
  });

  it('6. safely handles null or undefined exercise object', async () => {
    await render(<ExerciseThumbnail exercise={null} testID="test-thumb" />);

    expect(screen.queryByTestId('test-thumb-image')).toBeNull();
    expect(screen.getByTestId('test-thumb-fallback')).toBeTruthy();
    expect(screen.queryByText('EX')).toBeNull();
  });

  it('7. renders nothing when hideWhenEmpty is true and no image is available', async () => {
    await render(
      <ExerciseThumbnail
        exercise={null}
        testID="test-thumb"
        hideWhenEmpty={true}
      />
    );

    expect(screen.queryByTestId('test-thumb')).toBeNull();
  });

  it('8. uses static Image component only and never introduces Video or autoplay', async () => {
    const rendered = await render(
      <ExerciseThumbnail
        exercise={baseExercise}
        catalog={testCatalog}
        testID="test-thumb"
      />
    );

    const tree = JSON.stringify(rendered.toJSON());
    // Confirm no video, media player, or autoplay props
    expect(tree).not.toContain('Video');
    expect(tree).not.toContain('autoplay');
    expect(tree).not.toContain('shouldPlay');
  });
});
