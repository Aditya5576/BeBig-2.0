/**
 * BeBig 2.0 — Custom Exercises Cloud Data Access Layer
 *
 * Dedicated Supabase data access service for user-created custom exercises.
 * Preserves stable client-generated IDs, manages delta synchronization queries,
 * and enforces user ownership via authenticated Supabase sessions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  CloudPullOptions,
  CloudPullResult,
  CustomExerciseCloudRecord,
  CustomExerciseCloudInput,
  classifySupabaseError,
  CloudError,
} from './types';
import { normalizeUtcTimestamp } from './timestamp';

export class CustomExerciseCloudService {
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

  async fetchChanged(
    options?: CloudPullOptions,
    expectedUserId?: string,
  ): Promise<CloudPullResult<CustomExerciseCloudRecord>> {
    const targetUserId = expectedUserId || options?.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);
    const limit = options?.limit && options.limit > 0 ? options.limit : 100;

    try {
      let query = this.client
        .from('custom_exercises')
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

      const records = (data || []) as CustomExerciseCloudRecord[];
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

  async getById(id: string, expectedUserId?: string): Promise<CustomExerciseCloudRecord | null> {
    const authUserId = await this.getAuthenticatedUserId(expectedUserId);
    try {
      const { data, error } = await this.client
        .from('custom_exercises')
        .select('*')
        .eq('id', id)
        .eq('user_id', authUserId)
        .maybeSingle();

      if (error) throw classifySupabaseError(error);
      return (data as CustomExerciseCloudRecord) || null;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  async upsert(
    exercise: CustomExerciseCloudInput,
    expectedUserId?: string,
  ): Promise<CustomExerciseCloudRecord> {
    if (!exercise.id || !exercise.id.trim()) {
      throw new CloudError('validation', 'Custom exercise ID cannot be empty.');
    }
    const targetUserId = expectedUserId || exercise.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);

    const row = {
      id: exercise.id,
      user_id: authUserId,
      name: exercise.name,
      description: exercise.description || '',
      category: exercise.category,
      category_name: exercise.categoryName,
      primary_muscles: exercise.primaryMuscles || [],
      secondary_muscles: exercise.secondaryMuscles || [],
      equipment: exercise.equipment || [],
      client_updated_at: exercise.clientUpdatedAt || new Date().toISOString(),
      deleted_at: exercise.deletedAt || null,
    };

    try {
      const { data, error } = await this.client
        .from('custom_exercises')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw classifySupabaseError(error);
      return data as CustomExerciseCloudRecord;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  async upsertBatch(
    exercises: CustomExerciseCloudInput[],
    expectedUserId?: string,
  ): Promise<CustomExerciseCloudRecord[]> {
    if (!exercises || exercises.length === 0) return [];
    const targetUserId = expectedUserId || exercises[0]?.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);

    const rows = exercises.map((e) => {
      if (!e.id || !e.id.trim()) {
        throw new CloudError('validation', 'Custom exercise ID cannot be empty in batch.');
      }
      return {
        id: e.id,
        user_id: authUserId,
        name: e.name,
        description: e.description || '',
        category: e.category,
        category_name: e.categoryName,
        primary_muscles: e.primaryMuscles || [],
        secondary_muscles: e.secondaryMuscles || [],
        equipment: e.equipment || [],
        client_updated_at: e.clientUpdatedAt || new Date().toISOString(),
        deleted_at: e.deletedAt || null,
      };
    });

    try {
      const { data, error } = await this.client
        .from('custom_exercises')
        .upsert(rows, { onConflict: 'id' })
        .select();

      if (error) throw classifySupabaseError(error);
      return (data || []) as CustomExerciseCloudRecord[];
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  async softDelete(
    id: string,
    clientUpdatedAt?: string,
    expectedUserId?: string,
  ): Promise<CustomExerciseCloudRecord> {
    const authUserId = await this.getAuthenticatedUserId(expectedUserId);
    const now = new Date().toISOString();

    try {
      const { data, error } = await this.client
        .from('custom_exercises')
        .update({
          deleted_at: now,
          client_updated_at: clientUpdatedAt || now,
        })
        .eq('id', id)
        .eq('user_id', authUserId)
        .select()
        .single();

      if (error) throw classifySupabaseError(error);
      return data as CustomExerciseCloudRecord;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }
}

export const customExerciseCloudService = new CustomExerciseCloudService();
