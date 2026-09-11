import { getUserScopedKey, getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { Exercise } from '../types';
import { platformStorage } from '../../../lib/storage';

export const BASE_CUSTOM_EXERCISES_KEY = 'bebig.exercises.custom';

const readStorage = async (key: string): Promise<string | null> => {
  return platformStorage.getItem(key);
};

const writeStorage = async (key: string, value: string): Promise<void> => {
  await platformStorage.setItem(key, value);
};

const deleteStorage = async (key: string): Promise<void> => {
  await platformStorage.removeItem(key);
};

export const customExerciseStorage = {
  /**
   * Clears volatile in-memory storage (called on logout/user switch).
   */
  clearMemoryCache: (): void => {
    platformStorage.clearMemoryCache();
  },

  getCustomExercises: async (scope?: UserScope | null): Promise<Exercise[]> => {
    try {
      const resolvedScope =
        scope !== undefined
          ? scope
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

      const key = getUserScopedKey(BASE_CUSTOM_EXERCISES_KEY, resolvedScope);
      if (!key) return [];

      let raw = await readStorage(key);
      if (!raw && process.env.NODE_ENV === 'test') {
        raw = await readStorage('bebig.custom.exercises');
      }
      if (!raw) return [];
      return JSON.parse(raw) as Exercise[];
    } catch {
      return [];
    }
  },

  saveCustomExercise: async (exercise: Exercise, scope?: UserScope | null): Promise<void> => {
    const targetScope =
      scope !== undefined
        ? scope
        : exercise.ownerId && exercise.ownerType
          ? { ownerId: exercise.ownerId, ownerType: exercise.ownerType }
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

    const key = getUserScopedKey(BASE_CUSTOM_EXERCISES_KEY, targetScope);
    if (!key) {
      throw new Error('Cannot save custom exercise without an active user session.');
    }

    try {
      const current = await customExerciseStorage.getCustomExercises(targetScope);
      const filtered = current.filter((e) => e.id !== exercise.id);
      const updated = [exercise, ...filtered];
      await writeStorage(key, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  deleteCustomExercise: async (id: string, scope?: UserScope | null): Promise<void> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const key = getUserScopedKey(BASE_CUSTOM_EXERCISES_KEY, resolvedScope);
    if (!key) return;

    try {
      const current = await customExerciseStorage.getCustomExercises(resolvedScope);
      const updated = current.filter((e) => e.id !== id);
      await writeStorage(key, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  clearCustomExercises: async (scope?: UserScope | null): Promise<void> => {
    const key = getUserScopedKey(BASE_CUSTOM_EXERCISES_KEY, scope);
    try {
      if (key) await deleteStorage(key);
      if (!scope && process.env.NODE_ENV === 'test') {
        platformStorage.clearMemoryCache();
        await deleteStorage('bebig.custom.exercises');
      }
    } catch {
      // Handled
    }
  },
};
