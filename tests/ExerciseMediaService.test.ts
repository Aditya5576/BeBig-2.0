/**
 * BeBig 2.0 — Exercise Media Foundation Unit Tests
 *
 * Verifies exact-ID resolution, strict license and attribution enforcement,
 * immutability guarantees, and isolation from user-owned custom exercise photos.
 */

import {
  Exercise,
  ExerciseDemonstration,
  ExerciseMediaLicense,
} from '../src/features/exercises/types';
import {
  CuratedMediaCatalog,
  CURATED_EXERCISE_MEDIA_CATALOG,
} from '../src/features/exercises/data/curatedMediaCatalog';
import {
  resolveExerciseDemonstration,
  hasCustomPhoto,
  getCustomPhotoUri,
} from '../src/features/exercises/services/exerciseMediaService';

describe('ExerciseMediaService', () => {
  // Synthetic test fixtures
  const validLicense: ExerciseMediaLicense = {
    type: 'CC-BY-4.0',
    author: 'Coach Alice',
    sourceUrl: 'https://example.com/exercises/bench-press',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  };

  const validPublicDomainLicense: ExerciseMediaLicense = {
    type: 'CC0',
    author: 'Public Domain Archive',
    sourceUrl: 'https://example.com/exercises/squat-cc0',
  };

  const approvedBenchDemo: ExerciseDemonstration = {
    exerciseId: 'seed-bench-press',
    mediaType: 'animation',
    thumbnailUri: 'https://cdn.example.com/thumbs/seed-bench-press.webp',
    demonstrationUri: 'https://cdn.example.com/demos/seed-bench-press.webp',
    license: validLicense,
    isApproved: true,
  };

  const approvedSquatDemo: ExerciseDemonstration = {
    exerciseId: 'seed-squat',
    mediaType: 'animation',
    thumbnailUri: 'https://cdn.example.com/thumbs/seed-squat.webp',
    demonstrationUri: 'https://cdn.example.com/demos/seed-squat.webp',
    license: validPublicDomainLicense,
    isApproved: true,
  };

  const mockCatalog: CuratedMediaCatalog = Object.freeze({
    'seed-bench-press': approvedBenchDemo,
    'seed-squat': approvedSquatDemo,
  });

  const baseExercise: Exercise = {
    id: 'seed-bench-press',
    name: 'Barbell Bench Press',
    description: 'Chest pressing movement',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 'm-chest', name: 'Chest', isFront: true }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq-barbell', name: 'Barbell' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  };

  describe('Exact ID Resolution', () => {
    it('1. resolves an approved test asset for its exact stable exercise ID string', () => {
      const result = resolveExerciseDemonstration('seed-bench-press', mockCatalog);
      expect(result.status).toBe('approved');
      expect(result.demonstration).toEqual(approvedBenchDemo);
    });

    it('1b. resolves an approved test asset when passed an Exercise domain object', () => {
      const result = resolveExerciseDemonstration(baseExercise, mockCatalog);
      expect(result.status).toBe('approved');
      expect(result.demonstration?.exerciseId).toBe('seed-bench-press');
    });

    it('2. does not resolve to an asset if the exercise ID is different', () => {
      const result = resolveExerciseDemonstration('seed-deadlift', mockCatalog);
      expect(result.status).toBe('not_found');
      expect(result.demonstration).toBeUndefined();
    });

    it('3. returns not_found for unknown, null, or empty IDs', () => {
      expect(resolveExerciseDemonstration(null, mockCatalog).status).toBe('not_found');
      expect(resolveExerciseDemonstration(undefined, mockCatalog).status).toBe('not_found');
      expect(resolveExerciseDemonstration('', mockCatalog).status).toBe('not_found');
      expect(resolveExerciseDemonstration('   ', mockCatalog).status).toBe('not_found');
      expect(resolveExerciseDemonstration('unknown-id-999', mockCatalog).status).toBe('not_found');
    });

    it('7. does not match based on display-name similarity', () => {
      // Create an exercise with the same name as Bench Press but a different ID
      const differentExerciseSameName: Exercise = {
        ...baseExercise,
        id: 'wger_custom_bench_copy',
        name: 'Barbell Bench Press',
      };

      const result = resolveExerciseDemonstration(differentExerciseSameName, mockCatalog);
      expect(result.status).toBe('not_found');
      expect(result.demonstration).toBeUndefined();
    });
  });

  describe('License & Attribution Verification', () => {
    it('4. rejects assets with missing or UNVERIFIED license metadata', () => {
      const unverifiedLicenseDemo: ExerciseDemonstration = {
        ...approvedBenchDemo,
        license: {
          type: 'UNVERIFIED',
          author: 'Unknown',
          sourceUrl: 'https://example.com/unverified',
        },
      };

      const catalogWithUnverified: CuratedMediaCatalog = {
        'seed-bench-press': unverifiedLicenseDemo,
      };

      const result = resolveExerciseDemonstration('seed-bench-press', catalogWithUnverified);
      expect(result.status).toBe('missing_license');
      expect(result.demonstration).toBeUndefined();
    });

    it('5. rejects assets that are not marked as approved', () => {
      const unapprovedDemo: ExerciseDemonstration = {
        ...approvedBenchDemo,
        isApproved: false,
      };

      const catalogWithUnapproved: CuratedMediaCatalog = {
        'seed-bench-press': unapprovedDemo,
      };

      const result = resolveExerciseDemonstration('seed-bench-press', catalogWithUnapproved);
      expect(result.status).toBe('unapproved');
      expect(result.demonstration).toBeUndefined();
    });

    it('6. rejects CC-BY assets that lack required author attribution', () => {
      const missingAuthorDemo: ExerciseDemonstration = {
        ...approvedBenchDemo,
        license: {
          type: 'CC-BY-4.0',
          author: '', // Missing required author!
          sourceUrl: 'https://example.com/valid-url',
        },
      };

      const catalogMissingAuthor: CuratedMediaCatalog = {
        'seed-bench-press': missingAuthorDemo,
      };

      const result = resolveExerciseDemonstration('seed-bench-press', catalogMissingAuthor);
      expect(result.status).toBe('missing_attribution');
      expect(result.demonstration).toBeUndefined();
    });

    it('6a. supports CC-BY-SA-3.0 and CC-BY-SA-4.0 with required author attribution', () => {
      const validSaDemo: ExerciseDemonstration = {
        ...approvedBenchDemo,
        license: {
          type: 'CC-BY-SA-3.0',
          author: 'Everkinetic',
          sourceUrl: 'https://wger.de/en/exercise/73/view/',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
        },
      };
      const result = resolveExerciseDemonstration('seed-bench-press', {
        'seed-bench-press': validSaDemo,
      });
      expect(result.status).toBe('approved');
      expect(result.demonstration?.license.type).toBe('CC-BY-SA-3.0');

      // Rejects CC-BY-SA without author
      const missingSaAuthor: ExerciseDemonstration = {
        ...validSaDemo,
        license: {
          ...validSaDemo.license,
          author: '   ',
        },
      };
      const resultMissing = resolveExerciseDemonstration('seed-bench-press', {
        'seed-bench-press': missingSaAuthor,
      });
      expect(resultMissing.status).toBe('missing_attribution');
    });

    it('6b. rejects assets that lack required source URL attribution', () => {
      const missingSourceUrlDemo: ExerciseDemonstration = {
        ...approvedBenchDemo,
        license: {
          type: 'CC0',
          author: 'Archive',
          sourceUrl: '', // Missing source URL!
        },
      };

      const catalogMissingSource: CuratedMediaCatalog = {
        'seed-bench-press': missingSourceUrlDemo,
      };

      const result = resolveExerciseDemonstration('seed-bench-press', catalogMissingSource);
      expect(result.status).toBe('missing_attribution');
      expect(result.demonstration).toBeUndefined();
    });

    it('6c. rejects assets with empty thumbnail or demonstration URIs', () => {
      const missingUrisDemo: ExerciseDemonstration = {
        ...approvedBenchDemo,
        thumbnailUri: '  ',
        demonstrationUri: '',
      };

      const catalogMissingUris: CuratedMediaCatalog = {
        'seed-bench-press': missingUrisDemo,
      };

      const result = resolveExerciseDemonstration('seed-bench-press', catalogMissingUris);
      expect(result.status).toBe('unapproved');
      expect(result.demonstration).toBeUndefined();
    });
  });

  describe('Immutability & Safety', () => {
    it('8. does not mutate the supplied Exercise object or change its properties', () => {
      const originalExercise: Exercise = {
        ...baseExercise,
        description: 'Original immutable description',
      };
      const snapshot = JSON.stringify(originalExercise);

      const result = resolveExerciseDemonstration(originalExercise, mockCatalog);
      expect(result.status).toBe('approved');

      // Exercise object must remain completely untouched
      expect(JSON.stringify(originalExercise)).toBe(snapshot);
      expect(originalExercise.id).toBe('seed-bench-press');
    });

    it('9. does not overwrite, modify, or conflate existing custom-photo data', () => {
      const customExerciseWithPhoto: Exercise = {
        id: 'custom_1729000000000_abc123',
        name: 'My Special Cable Press',
        description: 'A personal variation',
        category: 'chest',
        categoryName: 'Chest',
        primaryMuscles: [{ id: 'm-chest', name: 'Chest', isFront: true }],
        secondaryMuscles: [],
        equipment: [],
        images: [],
        sourceProvider: 'custom',
        isCustom: true,
        photoPath: 'file:///data/user/photos/custom_1729000000000_abc123.jpg',
      };

      // Custom photo helpers
      expect(hasCustomPhoto(customExerciseWithPhoto)).toBe(true);
      expect(getCustomPhotoUri(customExerciseWithPhoto)).toBe(
        'file:///data/user/photos/custom_1729000000000_abc123.jpg'
      );

      // Demonstrations do not automatically resolve for custom exercises unless in catalog
      const result = resolveExerciseDemonstration(customExerciseWithPhoto, mockCatalog);
      expect(result.status).toBe('not_found');

      // Non-custom exercise returns false for hasCustomPhoto even if photoPath were maliciously set
      const systemExerciseWithAccidentalPhoto: Exercise = {
        ...baseExercise,
        isCustom: false,
        photoPath: 'file:///some/leaked/photo.jpg',
      };
      expect(hasCustomPhoto(systemExerciseWithAccidentalPhoto)).toBe(false);
      expect(getCustomPhotoUri(systemExerciseWithAccidentalPhoto)).toBeNull();
    });

    it('10. safely handles an empty or frozen production catalogue', () => {
      const emptyCatalog: CuratedMediaCatalog = Object.freeze({});

      const result = resolveExerciseDemonstration('seed-bench-press', emptyCatalog);
      expect(result.status).toBe('not_found');
      expect(result.demonstration).toBeUndefined();
    });
  });

  describe('Curated Media Catalog — Verified 10-Batch', () => {
    const verifiedBatchExerciseIds = [
      'wger_73', // Bench Press
      'wger_75', // Benchpress Dumbbells
      'wger_538', // Incline Bench Press - Barbell
      'wger_257', // Front Squats
      'wger_91', // Biceps Curls With Barbell
      'wger_272', // Hammer Curls
      'wger_566', // Shoulder Press, Barbell
      'wger_348', // Lateral Raises
      'wger_197', // Dips Between Two Benches
      'wger_84', // Bent Over Rowing Reverse
      'seed-bench-press', // Barbell Bench Press (seed)
      'seed-lateral-raise', // Dumbbell Lateral Raise (seed)
    ];

    it.each(verifiedBatchExerciseIds)(
      'resolves verified, approved demonstration for %s from production catalog',
      (exerciseId) => {
        const result = resolveExerciseDemonstration(exerciseId, CURATED_EXERCISE_MEDIA_CATALOG);
        expect(result.status).toBe('approved');
        expect(result.demonstration).toBeDefined();
        expect(result.demonstration?.exerciseId).toBe(exerciseId);
        expect(result.demonstration?.isApproved).toBe(true);
        expect(result.demonstration?.thumbnailUri).toMatch(/^https?:\/\//);
        expect(result.demonstration?.demonstrationUri).toMatch(/^https?:\/\//);
        expect(result.demonstration?.license.type).toMatch(/^CC/);
        expect(result.demonstration?.license.author.trim().length).toBeGreaterThan(0);
        expect(result.demonstration?.license.sourceUrl.trim().length).toBeGreaterThan(0);
      }
    );
  });
});
