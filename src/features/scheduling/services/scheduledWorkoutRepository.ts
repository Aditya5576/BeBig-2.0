/**
 * BeBig 2.0 — Scheduled Workout Repository
 *
 * Central service layer for managing workout schedules.
 * Provides creation, modification, status updates (skip), soft-deletes (tombstones),
 * and sync metadata registration.
 */

import { ScheduledWorkout, ScheduledWorkoutStatus } from '../types';
import { scheduledWorkoutStorage } from '../storage/scheduledWorkoutStorage';
import { getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { syncMetadataStore, syncLifecycleManager } from '../../../services/sync';

export interface CreateScheduledWorkoutInput {
  name: string;
  scheduledDate: string; // YYYY-MM-DD
  templateId?: string | null;
  scheduledTime?: string | null;
  notes?: string | null;
}

export interface UpdateScheduledWorkoutInput {
  id: string;
  name?: string;
  scheduledDate?: string;
  scheduledTime?: string | null;
  status?: ScheduledWorkoutStatus;
  completedSessionId?: string | null;
  notes?: string | null;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class ScheduledWorkoutRepository {
  private getResolvedScope(scope?: UserScope): UserScope | undefined {
    if (scope !== undefined) return scope;
    const current = getCurrentUserScope();
    return current || undefined;
  }

  async getScheduledWorkouts(scope?: UserScope): Promise<ScheduledWorkout[]> {
    const resolvedScope = this.getResolvedScope(scope);
    return scheduledWorkoutStorage.getScheduledWorkouts(resolvedScope);
  }

  async getScheduledWorkoutsByDate(date: string, scope?: UserScope): Promise<ScheduledWorkout[]> {
    const resolvedScope = this.getResolvedScope(scope);
    return scheduledWorkoutStorage.getScheduledWorkoutsByDate(date, resolvedScope);
  }

  async getTodayScheduledWorkouts(scope?: UserScope): Promise<ScheduledWorkout[]> {
    const today = getTodayIsoDate();
    return this.getScheduledWorkoutsByDate(today, scope);
  }

  async getScheduledWorkoutById(id: string, scope?: UserScope): Promise<ScheduledWorkout | null> {
    const resolvedScope = this.getResolvedScope(scope);
    return scheduledWorkoutStorage.getScheduledWorkoutById(id, resolvedScope);
  }

  async createScheduledWorkout(
    input: CreateScheduledWorkoutInput,
    scope?: UserScope
  ): Promise<ScheduledWorkout> {
    const resolvedScope = this.getResolvedScope(scope);

    if (!input.name || !input.name.trim()) {
      throw new Error('Schedule name is required.');
    }
    if (!input.scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate)) {
      throw new Error('Valid scheduled date (YYYY-MM-DD) is required.');
    }

    const nowIso = new Date().toISOString();
    const id = generateId();

    const newWorkout: ScheduledWorkout = {
      id,
      name: input.name.trim(),
      scheduledDate: input.scheduledDate,
      templateId: input.templateId || null,
      scheduledTime: input.scheduledTime || null,
      status: 'scheduled',
      notes: input.notes?.trim() || null,
      ownerId: resolvedScope?.ownerId,
      ownerType: resolvedScope?.ownerType,
      createdAt: nowIso,
      updatedAt: nowIso,
      clientUpdatedAt: nowIso,
    };

    await scheduledWorkoutStorage.saveScheduledWorkout(newWorkout, resolvedScope);
    await syncMetadataStore.markPendingUpload('scheduled_workout', id, nowIso, resolvedScope);
    void syncLifecycleManager.triggerSync({ reason: 'manual' });

    return newWorkout;
  }

  async updateScheduledWorkout(
    input: UpdateScheduledWorkoutInput,
    scope?: UserScope
  ): Promise<ScheduledWorkout> {
    const resolvedScope = this.getResolvedScope(scope);
    const existing = await scheduledWorkoutStorage.getScheduledWorkoutById(input.id, resolvedScope);

    if (!existing || existing.deletedAt) {
      throw new Error(`Scheduled workout not found: ${input.id}`);
    }

    const nowIso = new Date().toISOString();
    const updated: ScheduledWorkout = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      scheduledDate: input.scheduledDate !== undefined ? input.scheduledDate : existing.scheduledDate,
      scheduledTime: input.scheduledTime !== undefined ? input.scheduledTime : existing.scheduledTime,
      status: input.status !== undefined ? input.status : existing.status,
      completedSessionId: input.completedSessionId !== undefined ? input.completedSessionId : existing.completedSessionId,
      notes: input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : existing.notes,
      updatedAt: nowIso,
      clientUpdatedAt: nowIso,
    };

    await scheduledWorkoutStorage.saveScheduledWorkout(updated, resolvedScope);
    await syncMetadataStore.markPendingUpload('scheduled_workout', updated.id, nowIso, resolvedScope);
    void syncLifecycleManager.triggerSync({ reason: 'manual' });

    return updated;
  }

  async skipScheduledWorkout(id: string, scope?: UserScope): Promise<ScheduledWorkout> {
    return this.updateScheduledWorkout({ id, status: 'skipped' }, scope);
  }

  async deleteScheduledWorkout(id: string, scope?: UserScope): Promise<void> {
    const resolvedScope = this.getResolvedScope(scope);
    const existing = await scheduledWorkoutStorage.getScheduledWorkoutById(id, resolvedScope);
    if (!existing || existing.deletedAt) return;

    const nowIso = new Date().toISOString();
    await scheduledWorkoutStorage.tombstoneScheduledWorkout(id, resolvedScope);
    await syncMetadataStore.markPendingDelete('scheduled_workout', id, nowIso, nowIso, resolvedScope);
    void syncLifecycleManager.triggerSync({ reason: 'manual' });
  }
}

export const scheduledWorkoutRepository = new ScheduledWorkoutRepository();
