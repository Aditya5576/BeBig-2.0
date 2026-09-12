/**
 * BeBig 2.0 — Workout Templates Cloud Data Access Layer
 *
 * Dedicated Supabase data access service for workout templates.
 * Preserves stable client-generated IDs, manages delta synchronization queries,
 * and enforces user ownership via authenticated Supabase sessions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  CloudPullOptions,
  CloudPullResult,
  TemplateCloudRecord,
  TemplateCloudInput,
  classifySupabaseError,
  CloudError,
} from './types';
import { normalizeUtcTimestamp } from './timestamp';

export class TemplateCloudService {
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
  ): Promise<CloudPullResult<TemplateCloudRecord>> {
    const targetUserId = expectedUserId || options?.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);
    const limit = options?.limit && options.limit > 0 ? options.limit : 100;

    try {
      let query = this.client
        .from('workout_templates')
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

      const records = (data || []) as TemplateCloudRecord[];
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

  async getById(id: string, expectedUserId?: string): Promise<TemplateCloudRecord | null> {
    const authUserId = await this.getAuthenticatedUserId(expectedUserId);
    try {
      const { data, error } = await this.client
        .from('workout_templates')
        .select('*')
        .eq('id', id)
        .eq('user_id', authUserId)
        .maybeSingle();

      if (error) throw classifySupabaseError(error);
      return (data as TemplateCloudRecord) || null;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  async upsert(template: TemplateCloudInput, expectedUserId?: string): Promise<TemplateCloudRecord> {
    if (!template.id || !template.id.trim()) {
      throw new CloudError('validation', 'Template ID cannot be empty.');
    }
    const targetUserId = expectedUserId || template.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);

    const row = {
      id: template.id,
      user_id: authUserId,
      name: template.name,
      exercises: template.exercises || [],
      client_updated_at: template.clientUpdatedAt || new Date().toISOString(),
      deleted_at: template.deletedAt || null,
    };

    try {
      const { data, error } = await this.client
        .from('workout_templates')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw classifySupabaseError(error);
      return data as TemplateCloudRecord;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  async upsertBatch(
    templates: TemplateCloudInput[],
    expectedUserId?: string,
  ): Promise<TemplateCloudRecord[]> {
    if (!templates || templates.length === 0) return [];
    const targetUserId = expectedUserId || templates[0]?.expectedUserId;
    const authUserId = await this.getAuthenticatedUserId(targetUserId);

    const rows = templates.map((t) => {
      if (!t.id || !t.id.trim()) {
        throw new CloudError('validation', 'Template ID cannot be empty in batch.');
      }
      return {
        id: t.id,
        user_id: authUserId,
        name: t.name,
        exercises: t.exercises || [],
        client_updated_at: t.clientUpdatedAt || new Date().toISOString(),
        deleted_at: t.deletedAt || null,
      };
    });

    try {
      const { data, error } = await this.client
        .from('workout_templates')
        .upsert(rows, { onConflict: 'id' })
        .select();

      if (error) throw classifySupabaseError(error);
      return (data || []) as TemplateCloudRecord[];
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }

  async softDelete(
    id: string,
    clientUpdatedAt?: string,
    expectedUserId?: string,
  ): Promise<TemplateCloudRecord> {
    const authUserId = await this.getAuthenticatedUserId(expectedUserId);
    const now = new Date().toISOString();

    try {
      const { data, error } = await this.client
        .from('workout_templates')
        .update({
          deleted_at: now,
          client_updated_at: clientUpdatedAt || now,
        })
        .eq('id', id)
        .eq('user_id', authUserId)
        .select()
        .single();

      if (error) throw classifySupabaseError(error);
      return data as TemplateCloudRecord;
    } catch (err) {
      throw classifySupabaseError(err);
    }
  }
}

export const templateCloudService = new TemplateCloudService();
