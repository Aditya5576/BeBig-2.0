/**
 * BeBig 2.0 — Workout Template Repository
 *
 * Central service layer for managing workout templates.
 * Enforces business logic validation, unique exercise rules,
 * order normalization, and persistence via templateStorage.
 */

import {
  WorkoutTemplate,
  TemplateExercise,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '../types';
import { templateStorage } from '../storage/templateStorage';
import { getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { syncMetadataStore, syncLifecycleManager } from '../../../services/sync';

export class TemplateRepository {
  private validateTemplateData(name: string, exercises: Omit<TemplateExercise, 'order'>[]): void {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Template name is required.');
    }

    if (!exercises || exercises.length === 0) {
      throw new Error('Template requires at least one exercise.');
    }

    const seenExerciseIds = new Set<string>();
    for (const ex of exercises) {
      if (!ex.exerciseId || !ex.exerciseId.trim()) {
        throw new Error('Exercise ID is required for all exercises.');
      }

      if (seenExerciseIds.has(ex.exerciseId)) {
        throw new Error(`Duplicate exercise "${ex.exerciseName}" is not allowed in a template.`);
      }
      seenExerciseIds.add(ex.exerciseId);

      if (typeof ex.sets !== 'number' || !Number.isInteger(ex.sets) || ex.sets < 1) {
        throw new Error('Sets must be an integer of at least 1.');
      }

      if (!ex.targetReps || typeof ex.targetReps !== 'string' || !ex.targetReps.trim()) {
        throw new Error('Target reps are required for all exercises.');
      }

      if (typeof ex.restTime !== 'number' || isNaN(ex.restTime) || ex.restTime < 0) {
        throw new Error('Rest time cannot be negative.');
      }

      if (ex.targetWeight !== undefined) {
        if (typeof ex.targetWeight !== 'number' || isNaN(ex.targetWeight) || ex.targetWeight < 0) {
          throw new Error('Target weight cannot be negative.');
        }
      }
    }
  }

  async getTemplates(scope?: UserScope | null): Promise<WorkoutTemplate[]> {
    return templateStorage.getTemplates(scope);
  }

  async getTemplateById(id: string, scope?: UserScope | null): Promise<WorkoutTemplate | null> {
    return templateStorage.getTemplateById(id, scope);
  }

  async createTemplate(
    input: CreateTemplateInput,
    scope?: UserScope | null,
  ): Promise<WorkoutTemplate> {
    this.validateTemplateData(input.name, input.exercises);

    const id = `template_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const normalizedExercises: TemplateExercise[] = input.exercises.map((ex, index) => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      categoryName: ex.categoryName,
      order: index,
      sets: ex.sets,
      targetReps: ex.targetReps.trim(),
      restTime: ex.restTime,
      targetWeight: ex.targetWeight,
    }));

    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();

    const template: WorkoutTemplate = {
      id,
      ownerId: resolvedScope?.ownerId,
      ownerType: resolvedScope?.ownerType,
      name: input.name.trim(),
      exercises: normalizedExercises,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Local durable save first (Source of Truth)
    await templateStorage.saveTemplate(template, resolvedScope);

    // 2. Mark pending upload in sync metadata (authenticated only)
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
      try {
        await syncMetadataStore.markPendingUpload(
          'template',
          template.id,
          template.updatedAt,
          resolvedScope,
        );
      } catch {
        // Durability: Local save succeeded. Crash recovery scanner will reconstruct missing metadata.
      }

      // 3. Fire-and-forget sync trigger (asynchronous, non-blocking)
      void syncLifecycleManager.triggerSync({ reason: 'template_saved', scope: resolvedScope }).catch(() => {
        // Silently caught; sync failure cannot throw or affect caller
      });
    }

    return template;
  }

  async updateTemplate(
    input: UpdateTemplateInput,
    scope?: UserScope | null,
  ): Promise<WorkoutTemplate> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const existing = await templateStorage.getTemplateById(input.id, resolvedScope);
    if (!existing) {
      throw new Error(`Template with id "${input.id}" not found.`);
    }

    const updatedName = input.name !== undefined ? input.name : existing.name;
    const rawExercises = input.exercises !== undefined ? input.exercises : existing.exercises;

    this.validateTemplateData(updatedName, rawExercises);

    const normalizedExercises: TemplateExercise[] = rawExercises.map((ex, index) => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      categoryName: ex.categoryName,
      order: index,
      sets: ex.sets,
      targetReps: ex.targetReps.trim(),
      restTime: ex.restTime,
      targetWeight: ex.targetWeight,
    }));

    const now = new Date().toISOString();

    const updated: WorkoutTemplate = {
      ...existing,
      ownerId: existing.ownerId || resolvedScope?.ownerId,
      ownerType: existing.ownerType || resolvedScope?.ownerType,
      name: updatedName.trim(),
      exercises: normalizedExercises,
      updatedAt: now,
    };

    // 1. Local durable save first (Source of Truth)
    await templateStorage.saveTemplate(updated, resolvedScope);

    // 2. Mark pending upload in sync metadata (authenticated only)
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
      try {
        await syncMetadataStore.markPendingUpload(
          'template',
          updated.id,
          updated.updatedAt,
          resolvedScope,
        );
      } catch {
        // Durability: Local save succeeded. Crash recovery scanner will reconstruct missing metadata.
      }

      // 3. Fire-and-forget sync trigger (asynchronous, non-blocking)
      void syncLifecycleManager.triggerSync({ reason: 'template_saved', scope: resolvedScope }).catch(() => {
        // Silently caught; sync failure cannot throw or affect caller
      });
    }

    return updated;
  }

  /**
   * Deletes a specific workout template.
   * Produces a durable pending_delete tombstone if authenticated and previously synced.
   * Safely cleans up local-only unsynced creations without sending unnecessary cloud tombstones.
   */
  async deleteTemplate(id: string, scope?: UserScope | null): Promise<void> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
      const existingMeta = await syncMetadataStore.getRecord('template', id, resolvedScope);
      const isUnsyncedLocalCreate =
        (!existingMeta || existingMeta.syncStatus === 'pending_upload') &&
        !existingMeta?.lastSyncedServerUpdatedAt;

      if (isUnsyncedLocalCreate) {
        // Unsynced local create -> delete: remove local entity and clear pending upload record
        await templateStorage.deleteTemplate(id, resolvedScope);
        if (existingMeta) {
          await syncMetadataStore.removeRecord('template', id, resolvedScope);
        }
        return;
      }

      // Durable tombstone first to prevent ID/sync loss on crash
      const now = new Date().toISOString();
      await syncMetadataStore.markPendingDelete('template', id, now, now, resolvedScope);
      await templateStorage.deleteTemplate(id, resolvedScope);

      // Fire-and-forget sync trigger (asynchronous, non-blocking)
      void syncLifecycleManager.triggerSync({ reason: 'local_delete', scope: resolvedScope }).catch(() => {
        // Silently caught; sync failure cannot throw or affect caller
      });
    } else {
      // Guest or unauthenticated: strictly local-only delete
      await templateStorage.deleteTemplate(id, resolvedScope);
    }
  }

  /**
   * Invalidates volatile in-memory storage cache on logout/user switch.
   */
  clearInMemoryState(): void {
    templateStorage.clearMemoryCache();
  }
}

export const templateRepository = new TemplateRepository();
