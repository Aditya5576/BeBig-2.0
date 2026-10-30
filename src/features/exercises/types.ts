/**
 * BeBig 2.0 — Exercise Domain Types
 *
 * Clean, provider-agnostic domain models representing exercises,
 * muscles, equipment, and categories within the BeBig ecosystem.
 */

import { OwnerType } from '../auth';

export type ExerciseCategory =
  'abs' | 'arms' | 'back' | 'calves' | 'cardio' | 'chest' | 'legs' | 'shoulders' | 'other';

export interface ExerciseMuscle {
  id: string;
  name: string;
  isFront?: boolean;
}

export interface ExerciseEquipment {
  id: string;
  name: string;
}

export interface ExerciseImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  isMain?: boolean;
}

export type ExerciseSourceProvider = 'wger' | 'custom' | 'system';

export interface Exercise {
  id: string;
  ownerId?: string;
  ownerType?: OwnerType;
  name: string;
  description: string;
  category: ExerciseCategory;
  categoryName: string;
  primaryMuscles: ExerciseMuscle[];
  secondaryMuscles: ExerciseMuscle[];
  equipment: ExerciseEquipment[];
  images: ExerciseImage[];
  sourceProvider: ExerciseSourceProvider;
  sourceExerciseId?: string;
  isCustom: boolean;
  photoPath?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCustomExerciseInput {
  name: string;
  description?: string;
  category: ExerciseCategory;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  equipment?: string[];
  images?: ExerciseImage[];
  photoPath?: string | null;
}

export interface UpdateCustomExerciseInput {
  id: string;
  name?: string;
  description?: string;
  category?: ExerciseCategory;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipment?: string[];
  images?: ExerciseImage[];
  photoPath?: string | null;
}

/**
 * Exercise Demonstration Media & Licensing Types
 *
 * Provides a type-safe domain foundation for demonstration media,
 * ensuring all media mappings are bound to verified exercise IDs
 * with explicit copyright and attribution metadata.
 */

export type ExerciseMediaType = 'image' | 'animation' | 'video';

export type ExerciseMediaLicenseType =
  | 'CC0'
  | 'CC-BY-3.0'
  | 'CC-BY-4.0'
  | 'CC-BY-SA-3.0'
  | 'CC-BY-SA-4.0'
  | 'PUBLIC_DOMAIN'
  | 'PROPRIETARY'
  | 'UNVERIFIED';

export interface ExerciseMediaLicense {
  readonly type: ExerciseMediaLicenseType;
  readonly author: string;
  readonly sourceUrl: string;
  readonly licenseUrl?: string;
  readonly attributionNotes?: string;
}

export interface ExerciseDemonstration {
  readonly exerciseId: string;
  readonly mediaType: ExerciseMediaType;
  readonly thumbnailUri: string;
  readonly demonstrationUri: string;
  readonly license: ExerciseMediaLicense;
  readonly isApproved: boolean;
}

export type ExerciseMediaResolutionStatus =
  | 'approved'
  | 'unapproved'
  | 'missing_license'
  | 'missing_attribution'
  | 'not_found';

export interface ExerciseMediaResolution {
  readonly status: ExerciseMediaResolutionStatus;
  readonly demonstration?: ExerciseDemonstration;
}

