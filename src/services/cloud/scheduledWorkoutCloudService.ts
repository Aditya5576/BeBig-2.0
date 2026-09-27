/**
 * BeBig 2.0 - Scheduled Workouts Cloud Data Access Layer
 *
 * Dedicated Supabase data access service for scheduled workouts.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  CloudPullOptions,
  CloudPullResult,
  ScheduledWorkoutCloudRecord,
  ScheduledWorkoutCloudInput,
  classifySupabaseError,
  CloudError,
} from './types';
import { normalizeUtcTimestamp } from './timestamp';

export class ScheduledWorkoutCloudService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

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
        `Active session user (${currentUserId}) does not match expected sync user (${expectedUserId}).`
      );
    }
    return currentUserId;
  }

  async fetchChanged(
    options?: CloudPullOptions,
    expectedUserId?: string,
  ): Promise<CloudPullResult<ScheduledWorkoutCloudRecord>> {
    const targetUserId = expectedUserId || options?.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);
    const limit = options?.limit && options.limit > 0 ? options.limit : 100;

    try {
      let query = this.client
        .from('scheduled_workouts')
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

      const records = (data || []) as ScheduledWorkoutCloudRecord[];
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

  async getById(id: string, expectedUserId?: string): Promise<ScheduledWorkoutCloudRecord | null> {
    const authUserId = await this.getAuthenticatedUserId(expectedUserId);
    try {
      const { data, error } = await this.client
        .from('scheduled_workouts')
        .select('*')
        .eq('id', id)
        .eq('user_id', authUserId)
        .maybeSingle();

      if (error) throw classifySupabaseError(error);
      return (data as ScheduledWorkoutCloudRecord) || null;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  async upsert(workout: ScheduledWorkoutCloudInput, expectedUserId?: string): Promise<ScheduledWorkoutCloudRecord> {
    if (!workout.id || !workout.id.trim()) {
      throw new CloudError('validation', 'Scheduled Workout ID cannot be empty.');
    }
    const targetUserId = expectedUserId || workout.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);

    const row = {
      id: workout.id,
      user_id: authUserId,
      template_id: workout.templateId || null,
      name: workout.name,
      scheduled_date: workout.scheduledDate,
      scheduled_time: workout.scheduledTime || null,
      status: workout.status,
      completed_session_id: workout.completedSessionId || null,
      notes: workout.notes || null,
      client_updated_at: workout.clientUpdatedAt || new Date().toISOString(),
      deleted_at: workout.deletedAt || null,
    };

    try {
      const { data, error } = await this.client
        .from('scheduled_workouts')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw classifySupabaseError(error);
      return data as ScheduledWorkoutCloudRecord;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  async upsertBatch(
    workouts: ScheduledWorkoutCloudInput[],
    expectedUserId?: string,
  ): Promise<ScheduledWorkoutCloudRecord[]> {
    if (!workouts || workouts.length === 0) return [];
    const targetUserId = expectedUserId || workouts[0]?.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);

    const rows = workouts.map((w) => {
      if (!w.id || !w.id.trim()) {
        throw new CloudError('validation', 'Scheduled Workout ID cannot be empty in batch.');
      }
      return {
        id: w.id,
        user_id: authUserId,
        template_id: w.templateId || null,
        name: w.name,
        scheduled_date: w.scheduledDate,
        scheduled_time: w.scheduledTime || null,
        status: w.status,
        completed_session_id: w.completedSessionId || null,
        notes: w.notes || null,
        client_updated_at: w.clientUpdatedAt || new Date().toISOString(),
        deleted_at: w.deletedAt || null,
      };
    });

    try {
      const { data, error } = await this.client
        .from('scheduled_workouts')
        .upsert(rows, { onConflict: 'id' })
        .select();

      if (error) throw classifySupabaseError(error);
      return (data || []) as ScheduledWorkoutCloudRecord[];
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }
}

export const scheduledWorkoutCloudService = new ScheduledWorkoutCloudService();
