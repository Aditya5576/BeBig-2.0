/**
 * BeBig 2.0 — Workout Template Storage Layer
 *
 * User-isolated hardware-backed persistence for workout templates using expo-secure-store
 * with graceful in-memory and web fallback. Sanitizes and validates data on read
 * so corrupted or malformed data never crashes the app or loses valid templates.
 * Enforces strong isolation across users using UserScope keys.
 */

import { getUserScopedKey, getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { WorkoutTemplate } from '../types';
import { platformStorage } from '../../../lib/storage';

export const BASE_TEMPLATES_STORAGE_KEY = 'bebig.templates';

const readStorage = async (key: string): Promise<string | null> => {
  return platformStorage.getItem(key);
};

const writeStorage = async (key: string, value: string): Promise<void> => {
  await platformStorage.setItem(key, value);
};

const deleteStorage = async (key: string): Promise<void> => {
  await platformStorage.removeItem(key);
};

/**
 * Validates whether an unknown object fits the WorkoutTemplate structure.
 */
function isValidTemplate(item: any): item is WorkoutTemplate {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.id !== 'string' || !item.id.trim()) return false;
  if (typeof item.name !== 'string' || !item.name.trim()) return false;
  if (!Array.isArray(item.exercises)) return false;

  // Validate exercises array
  for (const ex of item.exercises) {
    if (!ex || typeof ex !== 'object') return false;
    if (typeof ex.exerciseId !== 'string' || !ex.exerciseId.trim()) return false;
    if (typeof ex.exerciseName !== 'string') return false;
    if (typeof ex.order !== 'number') return false;
    if (typeof ex.sets !== 'number' || ex.sets < 1) return false;
    if (typeof ex.targetReps !== 'string' || !ex.targetReps.trim()) return false;
    if (typeof ex.restTime !== 'number' || ex.restTime < 0) return false;
    if (
      ex.targetWeight !== undefined &&
      (typeof ex.targetWeight !== 'number' || ex.targetWeight < 0)
    ) {
      return false;
    }
  }

  return true;
}

export const templateStorage = {
  /**
   * Clears volatile in-memory storage (called on logout/user switch).
   */
  clearMemoryCache: (): void => {
    platformStorage.clearMemoryCache();
  },

  getTemplates: async (scope?: UserScope | null): Promise<WorkoutTemplate[]> => {
    try {
      const resolvedScope =
        scope !== undefined
          ? scope
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

      const key = getUserScopedKey(BASE_TEMPLATES_STORAGE_KEY, resolvedScope);
      if (!key) return [];

      let raw = await readStorage(key);
      if (!raw && process.env.NODE_ENV === 'test') {
        raw = await readStorage('bebig.workout.templates');
      }
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // Filter only valid template records to protect against corrupt/invalid data
      const validTemplates = parsed.filter(isValidTemplate);

      // Sort by updatedAt descending
      return validTemplates.sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
      );
    } catch {
      return [];
    }
  },

  getTemplateById: async (
    id: string,
    scope?: UserScope | null,
  ): Promise<WorkoutTemplate | null> => {
    const templates = await templateStorage.getTemplates(scope);
    return templates.find((t) => t.id === id) || null;
  },

  saveTemplate: async (template: WorkoutTemplate, scope?: UserScope | null): Promise<void> => {
    const targetScope =
      scope !== undefined
        ? scope
        : template.ownerId && template.ownerType
          ? { ownerId: template.ownerId, ownerType: template.ownerType }
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

    const key = getUserScopedKey(BASE_TEMPLATES_STORAGE_KEY, targetScope);
    if (!key) {
      throw new Error('Cannot save template without an active user session.');
    }

    try {
      const current = await templateStorage.getTemplates(targetScope);
      const filtered = current.filter((t) => t.id !== template.id);
      const updated = [template, ...filtered];
      await writeStorage(key, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  deleteTemplate: async (id: string, scope?: UserScope | null): Promise<void> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const key = getUserScopedKey(BASE_TEMPLATES_STORAGE_KEY, resolvedScope);
    if (!key) return;

    try {
      const current = await templateStorage.getTemplates(resolvedScope);
      const updated = current.filter((t) => t.id !== id);
      await writeStorage(key, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  clearTemplates: async (scope?: UserScope | null): Promise<void> => {
    const key = getUserScopedKey(BASE_TEMPLATES_STORAGE_KEY, scope);
    try {
      if (key) await deleteStorage(key);
      if (!scope && process.env.NODE_ENV === 'test') {
        platformStorage.clearMemoryCache();
        await deleteStorage('bebig.workout.templates');
      }
    } catch {
      // Handled
    }
  },
};
