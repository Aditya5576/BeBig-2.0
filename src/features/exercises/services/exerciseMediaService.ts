/**
 * BeBig 2.0 — Exercise Demonstration Media Resolution Service
 *
 * Deterministically resolves demonstration media from the curated media catalog
 * using strictly canonical exercise IDs. Enforces copyright, licensing, and attribution
 * safety before any asset is cleared for display.
 *
 * KEY GUARANTEES:
 * 1. Exact ID Matching: Never resolves media by exercise name or fuzzy similarity.
 * 2. Strict License Verification: Unapproved assets, unverified licenses, or missing
 *    author/source attributions are rejected deterministically.
 * 3. Zero Mutation: Never mutates supplied Exercise objects or changes exercise IDs.
 * 4. Zero Network/Storage Side-Effects: Pure in-memory resolution without I/O.
 * 5. Custom Photo Isolation: Custom exercise photos remain separate from system demonstrations.
 */

import {
  Exercise,
  ExerciseDemonstration,
  ExerciseMediaResolution,
  ExerciseMediaResolutionStatus,
} from '../types';
import {
  CURATED_EXERCISE_MEDIA_CATALOG,
  CuratedMediaCatalog,
} from '../data/curatedMediaCatalog';

/**
 * Validates whether an exercise demonstration asset meets strict licensing and attribution standards.
 */
function validateDemonstrationAsset(
  demo: ExerciseDemonstration,
  expectedExerciseId: string
): ExerciseMediaResolutionStatus {
  // Exact ID verification within the asset record
  if (!demo || demo.exerciseId !== expectedExerciseId) {
    return 'not_found';
  }

  // Must be explicitly marked approved by an auditor
  if (demo.isApproved !== true) {
    return 'unapproved';
  }

  // Asset URIs must be populated
  if (!demo.thumbnailUri?.trim() || !demo.demonstrationUri?.trim()) {
    return 'unapproved';
  }

  // License metadata validation
  const license = demo.license;
  if (!license || !license.type || license.type === 'UNVERIFIED') {
    return 'missing_license';
  }

  // Attribution validation: source URL is mandatory for all licensed or public-domain assets
  if (!license.sourceUrl || license.sourceUrl.trim().length === 0) {
    return 'missing_attribution';
  }

  // Attribution validation: author is mandatory for CC-BY attribution licenses
  if (license.type === 'CC-BY-3.0' || license.type === 'CC-BY-4.0') {
    if (!license.author || license.author.trim().length === 0) {
      return 'missing_attribution';
    }
  }

  return 'approved';
}

/**
 * Resolves demonstration media for an exercise strictly by its canonical ID.
 *
 * @param exerciseOrId An Exercise object or canonical exercise ID string.
 * @param catalog Optional catalog override (defaults to CURATED_EXERCISE_MEDIA_CATALOG).
 * @returns An immutable ExerciseMediaResolution result.
 */
export function resolveExerciseDemonstration(
  exerciseOrId: Exercise | string | null | undefined,
  catalog: CuratedMediaCatalog = CURATED_EXERCISE_MEDIA_CATALOG
): ExerciseMediaResolution {
  if (!exerciseOrId) {
    return Object.freeze({ status: 'not_found' });
  }

  const exerciseId = typeof exerciseOrId === 'string' ? exerciseOrId.trim() : exerciseOrId.id?.trim();
  if (!exerciseId) {
    return Object.freeze({ status: 'not_found' });
  }

  const candidate = catalog[exerciseId];
  if (!candidate) {
    return Object.freeze({ status: 'not_found' });
  }

  const validationStatus = validateDemonstrationAsset(candidate, exerciseId);
  if (validationStatus !== 'approved') {
    return Object.freeze({ status: validationStatus });
  }

  return Object.freeze({
    status: 'approved',
    demonstration: candidate,
  });
}

/**
 * Checks whether an exercise possesses a user-owned custom photo.
 * Keeps user-owned uploads isolated from library demonstration media.
 */
export function hasCustomPhoto(exercise: Exercise | null | undefined): boolean {
  if (!exercise || exercise.isCustom !== true) {
    return false;
  }
  const photo = exercise.photoPath;
  return typeof photo === 'string' && photo.trim().length > 0;
}

/**
 * Retrieves the custom photo path or URI for an exercise if present.
 * Does not mutate or convert the photo path into a demonstration asset.
 */
export function getCustomPhotoUri(exercise: Exercise | null | undefined): string | null {
  if (!hasCustomPhoto(exercise)) {
    return null;
  }
  return exercise?.photoPath?.trim() || null;
}
