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
  createdAt?: string;
}

export interface CreateCustomExerciseInput {
  name: string;
  description?: string;
  category: ExerciseCategory;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  equipment?: string[];
}
