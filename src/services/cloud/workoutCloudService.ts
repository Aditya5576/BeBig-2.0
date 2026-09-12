/**
 * BeBig 2.0 — Workout Sessions Cloud Data Access Layer
 *
 * Dedicated Supabase data access service for completed workout sessions.
 * Preserves stable client-generated IDs, manages delta synchronization queries,
 * and enforces user ownership via authenticated Supabase sessions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  CloudPullOptions,
  CloudPullResult,
  WorkoutCloudRecord,
  WorkoutCloudInput,
  classifySupabaseError,
  CloudError,
} from './types';
import { normalizeUtcTimestamp } from './timestamp';

export class WorkoutCloudService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /**
   * Retrieves authenticated user ID from active session or throws typed CloudError('auth').
   * If expectedUserId is provided, strictly asserts that the active session matches it.
   */
  private async getAuthenticatedUserId(expectedUserId?: string): Promise<string> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw classifySupabaseError(error);
    if (!data?.session?.user?.id) {
      throw new CloudError('auth', 'No active authenticated session found.');
    }
    const currentUserId = data.session.user.id;
    if (expectedUserId && currentUserId !== expectedUserId) {
      throw new CloudError(
        'auth',
        `Active session user (${currentUserId}) does not match expected sync user (${expectedUserId}). Sync halted to prevent cross-account pollution.`,
      );
    }
    return currentUserId;
  }

  /**
   * Fetches records modified since server watermark using deterministic keyset pagination.
   * Ordered by (updated_at ASC, id ASC).
   */
  async fetchChanged(
    options?: CloudPullOptions,
    expectedUserId?: string,
  ): Promise<CloudPullResult<WorkoutCloudRecord>> {
    const targetUserId = expectedUserId || options?.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);
    const limit = options?.limit && options.limit > 0 ? options.limit : 100;

    try {
      let query = this.client
        .from('workout_sessions')
        .select('*')
        .eq('user_id', authUserId)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);

      if (options?.cursor) {
        const normalizedCursorTime = normalizeUtcTimestamp(options.cursor.updatedAt);
        query = query.or(
          `updated_at.gt.${normalizedCursorTime},and(updated_at.eq.${normalizedCursorTime},id.gt.${options.cursor.id})`
        );
      } else if (options?.sinceUpdatedAt) {
        const normalizedSince = normalizeUtcTimestamp(options.sinceUpdatedAt);
        query = query.gte('updated_at', normalizedSince);
      }

      const { data, error } = await query;
      if (error) throw classifySupabaseError(error);

      const records = (data || []) as WorkoutCloudRecord[];
      const hasMore = records.length === limit;
      const lastRecord = hasMore ? records[records.length - 1] : null;
      const nextCursor = lastRecord
        ? { updatedAt: normalizeUtcTimestamp(lastRecord.updated_at), id: lastRecord.id }
        : null;

      return {
        records,
        nextCursor,
        hasMore,
      };
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  /**
   * Fetches a specific cloud workout session by ID.
   */
  async getById(id: string, expectedUserId?: string): Promise<WorkoutCloudRecord | null> {
    const authUserId = await this.getAuthenticatedUserId(expectedUserId);
    try {
      const { data, error } = await this.client
        .from('workout_sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', authUserId)
        .maybeSingle();

      if (error) throw classifySupabaseError(error);
      return (data as WorkoutCloudRecord) || null;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  /**
   * Idempotently upserts a single workout session preserving client ID and tombstones.
   */
  async upsert(workout: WorkoutCloudInput, expectedUserId?: string): Promise<WorkoutCloudRecord> {
    if (!workout.id || !workout.id.trim()) {
      throw new CloudError('validation', 'Workout session ID cannot be empty.');
    }
    const targetUserId = expectedUserId || workout.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);

    const row = {
      id: workout.id,
      user_id: authUserId,
      name: workout.name,
      source_template_id: workout.sourceTemplateId || null,
      started_at: workout.startedAt,
      finished_at: workout.finishedAt || workout.startedAt,
      status: 'completed' as const,
      total_duration: workout.totalDuration ?? 0,
      total_volume: workout.totalVolume ?? 0,
      completed_sets_count: workout.completedSetsCount ?? 0,
      exercises: workout.exercises || [],
      client_updated_at: workout.clientUpdatedAt || new Date().toISOString(),
      deleted_at: workout.deletedAt || null,
    };

    try {
      const { data, error } = await this.client
        .from('workout_sessions')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw classifySupabaseError(error);
      return data as WorkoutCloudRecord;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  /**
   * Idempotently batch-upserts multiple workout sessions in a single network roundtrip.
   */
  async upsertBatch(
    workouts: WorkoutCloudInput[],
    expectedUserId?: string,
  ): Promise<WorkoutCloudRecord[]> {
    if (!workouts || workouts.length === 0) return [];
    const targetUserId = expectedUserId || workouts[0]?.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);

    const rows = workouts.map((w) => {
      if (!w.id || !w.id.trim()) {
        throw new CloudError('validation', 'Workout session ID cannot be empty in batch.');
      }
      return {
        id: w.id,
        user_id: authUserId,
        name: w.name,
        source_template_id: w.sourceTemplateId || null,
        started_at: w.startedAt,
        finished_at: w.finishedAt || w.startedAt,
        status: 'completed' as const,
        total_duration: w.totalDuration ?? 0,
        total_volume: w.totalVolume ?? 0,
        completed_sets_count: w.completedSetsCount ?? 0,
        exercises: w.exercises || [],
        client_updated_at: w.clientUpdatedAt || new Date().toISOString(),
        deleted_at: w.deletedAt || null,
      };
    });

    try {
      const { data, error } = await this.client
        .from('workout_sessions')
        .upsert(rows, { onConflict: 'id' })
        .select();

      if (error) throw classifySupabaseError(error);
      return (data || []) as WorkoutCloudRecord[];
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  /**
   * Soft-deletes a cloud workout session by stamping deleted_at.
   */
  async softDelete(
    id: string,
    clientUpdatedAt?: string,
    expectedUserId?: string,
  ): Promise<WorkoutCloudRecord> {
    const authUserId = await this.getAuthenticatedUserId(expectedUserId);
    const now = new Date().toISOString();

    try {
      const { data, error } = await this.client
        .from('workout_sessions')
        .update({
          deleted_at: now,
          client_updated_at: clientUpdatedAt || now,
        })
        .eq('id', id)
        .eq('user_id', authUserId)
        .select()
        .single();

      if (error) throw classifySupabaseError(error);
      return data as WorkoutCloudRecord;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }
}

export const workoutCloudService = new WorkoutCloudService();
