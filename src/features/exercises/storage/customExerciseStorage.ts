import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Exercise } from '../types';

const STORAGE_KEY = 'bebig.custom.exercises';

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
  getCustomExercises: async (): Promise<Exercise[]> => {
    try {
      const raw = await readStorage(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as Exercise[];
    } catch {
      return [];
    }
  },

  saveCustomExercise: async (exercise: Exercise): Promise<void> => {
    try {
      const current = await customExerciseStorage.getCustomExercises();
      const filtered = current.filter((e) => e.id !== exercise.id);
      const updated = [exercise, ...filtered];
      await writeStorage(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  deleteCustomExercise: async (id: string): Promise<void> => {
    try {
      const current = await customExerciseStorage.getCustomExercises();
      const updated = current.filter((e) => e.id !== id);
      await writeStorage(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  clearCustomExercises: async (): Promise<void> => {
    try {
      await deleteStorage(STORAGE_KEY);
    } catch {
      // Handled
    }
  },
};
