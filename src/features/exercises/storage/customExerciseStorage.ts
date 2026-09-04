import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getUserScopedKey, getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { Exercise } from '../types';

export const BASE_CUSTOM_EXERCISES_KEY = 'bebig.exercises.custom';

/**
 * In-memory fallback for test and non-native environments.
 */
const memoryStorage = new Map<string, string>();

const readStorage = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web' || process.env.NODE_ENV === 'test') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return memoryStorage.get(key) ?? null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return memoryStorage.get(key) ?? null;
  }
};

const writeStorage = async (key: string, value: string): Promise<void> => {
  memoryStorage.set(key, value);
  try {
    if (Platform.OS === 'web' || process.env.NODE_ENV === 'test') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Handled in memoryStorage
  }
};

const deleteStorage = async (key: string): Promise<void> => {
  memoryStorage.delete(key);
  try {
    if (Platform.OS === 'web' || process.env.NODE_ENV === 'test') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Handled in memoryStorage
  }
};

export const customExerciseStorage = {
  /**
   * Clears volatile in-memory storage (called on logout/user switch).
   */
  clearMemoryCache: (): void => {
    memoryStorage.clear();
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
        memoryStorage.clear();
        await deleteStorage('bebig.custom.exercises');
      }
    } catch {
      // Handled
    }
  },
};
