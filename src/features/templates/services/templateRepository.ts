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
import { getCurrentUserScope } from '../../auth/utils/userScope';

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

  async getTemplates(): Promise<WorkoutTemplate[]> {
    return templateStorage.getTemplates();
  }

  async getTemplateById(id: string): Promise<WorkoutTemplate | null> {
    return templateStorage.getTemplateById(id);
  }

  async createTemplate(input: CreateTemplateInput): Promise<WorkoutTemplate> {
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

    const scope = getCurrentUserScope();

    const template: WorkoutTemplate = {
      id,
      ownerId: scope?.ownerId,
      ownerType: scope?.ownerType,
      name: input.name.trim(),
      exercises: normalizedExercises,
      createdAt: now,
      updatedAt: now,
    };

    await templateStorage.saveTemplate(template, scope);
    return template;
  }

  async updateTemplate(input: UpdateTemplateInput): Promise<WorkoutTemplate> {
    const existing = await templateStorage.getTemplateById(input.id);
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

    const scope = getCurrentUserScope();

    const updated: WorkoutTemplate = {
      ...existing,
      ownerId: existing.ownerId || scope?.ownerId,
      ownerType: existing.ownerType || scope?.ownerType,
      name: updatedName.trim(),
      exercises: normalizedExercises,
      updatedAt: new Date().toISOString(),
    };

    await templateStorage.saveTemplate(updated, scope);
    return updated;
  }

  async deleteTemplate(id: string): Promise<void> {
    await templateStorage.deleteTemplate(id);
  }

  /**
   * Invalidates volatile in-memory storage cache on logout/user switch.
   */
  clearInMemoryState(): void {
    templateStorage.clearMemoryCache();
  }
}

export const templateRepository = new TemplateRepository();
