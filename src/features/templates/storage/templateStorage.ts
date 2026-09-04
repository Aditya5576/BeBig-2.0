/**
 * BeBig 2.0 — Workout Template Storage Layer
 *
 * Local hardware-backed persistence for workout templates using expo-secure-store
 * with graceful in-memory and web fallback. Sanitizes and validates data on read
 * so corrupted or malformed data never crashes the app or loses valid templates.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { WorkoutTemplate } from '../types';

const STORAGE_KEY = 'bebig.workout.templates';

const memoryStorage = new Map<string, string>();

const readStorage = async (key: string): Promise<string | null> => {
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val !== null && val !== undefined) return val;
  } catch {
    // fallback to memory
  }
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memoryStorage.get(key) ?? null;
};

const writeStorage = async (key: string, value: string): Promise<void> => {
  memoryStorage.set(key, value);
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Handled in memoryStorage
  }
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

const deleteStorage = async (key: string): Promise<void> => {
  memoryStorage.delete(key);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Handled in memoryStorage
  }
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
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
  getTemplates: async (): Promise<WorkoutTemplate[]> => {
    try {
      const raw = await readStorage(STORAGE_KEY);
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

  getTemplateById: async (id: string): Promise<WorkoutTemplate | null> => {
    const templates = await templateStorage.getTemplates();
    return templates.find((t) => t.id === id) || null;
  },

  saveTemplate: async (template: WorkoutTemplate): Promise<void> => {
    try {
      const current = await templateStorage.getTemplates();
      const filtered = current.filter((t) => t.id !== template.id);
      const updated = [template, ...filtered];
      await writeStorage(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  deleteTemplate: async (id: string): Promise<void> => {
    try {
      const current = await templateStorage.getTemplates();
      const updated = current.filter((t) => t.id !== id);
      await writeStorage(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  clearTemplates: async (): Promise<void> => {
    try {
      await deleteStorage(STORAGE_KEY);
    } catch {
      // Handled
    }
  },
};
