/**
 * BeBig 2.0 — Cloud Data Access Layer Types
 *
 * Strongly-typed database record models and operation inputs for Supabase sync tables.
 */

import { WorkoutExercise } from '../../features/workout/types';
import { TemplateExercise } from '../../features/templates/types';
import { ExerciseCategory, ExerciseMuscle, ExerciseEquipment } from '../../features/exercises/types';

export * from './cloudErrors';

export interface CloudPullOptions {
  /**
   * ISO 8601 UTC server watermark. Fetches rows where updated_at >= sinceUpdatedAt.
   */
  sinceUpdatedAt?: string;

  /**
   * Keyset pagination cursor (updated_at, id) for deterministic streaming.
   */
  cursor?: {
    updatedAt: string;
    id: string;
  };

  /**
   * Maximum records to fetch per batch. Defaults to 100.
   */
  limit?: number;

  /**
   * Optional expected authenticated user ID to bind and verify against active session.
   */
  expectedUserId?: string;
}

export interface CloudPullResult<T> {
  records: T[];
  nextCursor: {
    updatedAt: string;
    id: string;
  } | null;
  hasMore: boolean;
}

export interface WorkoutCloudRecord {
  id: string;
  user_id: string;
  name: string;
  source_template_id: string | null;
  started_at: string;
  finished_at: string;
  status: 'completed';
  total_duration: number;
  total_volume: number;
  completed_sets_count: number;
  exercises: WorkoutExercise[];
  client_updated_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutCloudInput {
  id: string;
  name: string;
  sourceTemplateId?: string | null;
  startedAt: string;
  finishedAt?: string;
  totalDuration?: number;
  totalVolume?: number;
  completedSetsCount?: number;
  exercises: WorkoutExercise[];
  clientUpdatedAt?: string;
  deletedAt?: string | null;
  expectedUserId?: string;
}

export interface TemplateCloudRecord {
  id: string;
  user_id: string;
  name: string;
  exercises: TemplateExercise[];
  client_updated_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateCloudInput {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  clientUpdatedAt?: string;
  deletedAt?: string | null;
  expectedUserId?: string;
}

export interface CustomExerciseCloudRecord {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  category_name: string;
  primary_muscles: ExerciseMuscle[];
  secondary_muscles: ExerciseMuscle[];
  equipment: ExerciseEquipment[];
  client_updated_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomExerciseCloudInput {
  id: string;
  name: string;
  description?: string;
  category: ExerciseCategory;
  categoryName: string;
  primaryMuscles: ExerciseMuscle[];
  secondaryMuscles?: ExerciseMuscle[];
  equipment?: ExerciseEquipment[];
  clientUpdatedAt?: string;
  deletedAt?: string | null;
  expectedUserId?: string;
}
