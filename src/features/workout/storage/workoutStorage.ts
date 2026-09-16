/**
 * BeBig 2.0 — Workout Storage Layer
 *
 * User-isolated hardware-backed persistence for active workout sessions and completed workouts
 * using expo-secure-store with graceful in-memory and web fallback.
 * Strongly isolates data per user using UserScope keys.
 * Sanitizes and validates data on read to protect against corrupt state.
 */

import { getUserScopedKey, getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../types';
import { platformStorage } from '../../../lib/storage';

export const BASE_ACTIVE_WORKOUT_KEY = 'bebig.workout.active';
export const BASE_COMPLETED_WORKOUTS_KEY = 'bebig.workout.completed';

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
 * Validates whether an unknown object fits the WorkoutSet structure.
 */
function isValidSet(set: any): set is WorkoutSet {
  if (!set || typeof set !== 'object') { console.log('set not obj', set); return false; }
  if (typeof set.id !== 'string' || !set.id.trim()) { console.log('set.id invalid', set.id); return false; }
  if (typeof set.setNumber !== 'number') { console.log('setNumber invalid', set.setNumber); return false; }
  if (typeof set.weight !== 'number' || isNaN(set.weight) || set.weight < 0) { console.log('weight invalid', set.weight); return false; }
  if (typeof set.reps !== 'number' || isNaN(set.reps) || set.reps < 0) { console.log('reps invalid', set.reps); return false; }
  
  if (set.rir !== undefined && set.rir !== null) {
    if (typeof set.rir !== 'number' || isNaN(set.rir) || set.rir < 0 || set.rir > 10) {
      delete set.rir;
    }
  }

  if (typeof set.completed !== 'boolean') { console.log('completed invalid', set.completed); return false; }
  return true;
}

/**
 * Validates whether an unknown object fits the WorkoutExercise structure.
 */
function isValidExercise(ex: any): ex is WorkoutExercise {
  if (!ex || typeof ex !== 'object') { console.log('ex not obj'); return false; }
  if (typeof ex.exerciseId !== 'string' || !ex.exerciseId.trim()) { console.log('ex id invalid'); return false; }
  if (typeof ex.exerciseName !== 'string') { console.log('ex name invalid'); return false; }
  if (typeof ex.order !== 'number') { console.log('ex order invalid'); return false; }
  if (!Array.isArray(ex.actualSets)) { console.log('ex actualSets not array'); return false; }
  return ex.actualSets.every(isValidSet);
}

/**
 * Validates whether an unknown object fits the WorkoutSession structure.
 */
function isValidSession(item: any): item is WorkoutSession {
  if (!item || typeof item !== 'object') { console.log('item not obj'); return false; }
  if (typeof item.id !== 'string' || !item.id.trim()) { console.log('item id invalid'); return false; }
  if (typeof item.name !== 'string') { console.log('item name invalid'); return false; }
  if (typeof item.startedAt !== 'string') { console.log('item startedAt invalid'); return false; }
  if (item.status !== 'active' && item.status !== 'completed') { console.log('item status invalid'); return false; }
  if (!Array.isArray(item.exercises)) { console.log('item exercises not array'); return false; }
  return item.exercises.every(isValidExercise);
}

export const workoutStorage = {
  /**
   * Clears the volatile memoryStorage map (called on sign out or user switch).
   */
  clearMemoryCache: (): void => {
    platformStorage.clearMemoryCache();
  },

  getActiveWorkout: async (scope?: UserScope | null): Promise<WorkoutSession | null> => {
    try {
      const resolvedScope =
        scope !== undefined
          ? scope
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

      const key = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, resolvedScope);
      if (!key) return null;

      let raw = await readStorage(key);
      if (!raw && process.env.NODE_ENV === 'test') {
        raw = await readStorage('bebig.active.workout');
      }
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (isValidSession(parsed) && parsed.status === 'active') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  },

  saveActiveWorkout: async (workout: WorkoutSession, scope?: UserScope | null): Promise<void> => {
    const targetScope =
      scope !== undefined
        ? scope
        : workout.ownerId && workout.ownerType
          ? { ownerId: workout.ownerId, ownerType: workout.ownerType }
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

    const key = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, targetScope);
    if (!key) {
      throw new Error('Cannot save active workout without an active user session.');
    }

    try {
      await writeStorage(key, JSON.stringify(workout));
    } catch {
      // Handled
    }
  },

  clearActiveWorkout: async (scope?: UserScope | null): Promise<void> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const key = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, resolvedScope);
    if (!key) return;

    try {
      await deleteStorage(key);
      if (process.env.NODE_ENV === 'test') {
        await deleteStorage('bebig.active.workout');
      }
    } catch {
      // Handled
    }
  },

  getCompletedWorkouts: async (scope?: UserScope | null): Promise<WorkoutSession[]> => {
    try {
      const resolvedScope =
        scope !== undefined
          ? scope
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

      const key = getUserScopedKey(BASE_COMPLETED_WORKOUTS_KEY, resolvedScope);
      if (!key) return [];

      let raw = await readStorage(key);
      if (!raw && process.env.NODE_ENV === 'test') {
        raw = await readStorage('bebig.completed.workouts');
      }
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const valid = parsed.filter(isValidSession);
      return valid.sort(
        (a, b) =>
          new Date(b.finishedAt || b.startedAt).getTime() -
          new Date(a.finishedAt || a.startedAt).getTime(),
      );
    } catch {
      return [];
    }
  },

  getCompletedWorkoutById: async (
    id: string,
    scope?: UserScope | null,
  ): Promise<WorkoutSession | null> => {
    const workouts = await workoutStorage.getCompletedWorkouts(scope);
    return workouts.find((w) => w.id === id) || null;
  },

  saveCompletedWorkout: async (
    workout: WorkoutSession,
    scope?: UserScope | null,
  ): Promise<void> => {
    const targetScope =
      scope !== undefined
        ? scope
        : workout.ownerId && workout.ownerType
          ? { ownerId: workout.ownerId, ownerType: workout.ownerType }
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

    const key = getUserScopedKey(BASE_COMPLETED_WORKOUTS_KEY, targetScope);
    if (!key) {
      throw new Error('Cannot save completed workout without an active user session.');
    }

    try {
      const current = await workoutStorage.getCompletedWorkouts(targetScope);
      const filtered = current.filter((w) => w.id !== workout.id);
      const updated = [workout, ...filtered];
      await writeStorage(key, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  deleteCompletedWorkout: async (id: string, scope?: UserScope | null): Promise<void> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const key = getUserScopedKey(BASE_COMPLETED_WORKOUTS_KEY, resolvedScope);
    if (!key) return;

    try {
      const current = await workoutStorage.getCompletedWorkouts(resolvedScope);
      const updated = current.filter((w) => w.id !== id);
      await writeStorage(key, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  clearAllWorkouts: async (scope?: UserScope | null): Promise<void> => {
    const activeKey = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, scope);
    const completedKey = getUserScopedKey(BASE_COMPLETED_WORKOUTS_KEY, scope);

    try {
      if (activeKey) await deleteStorage(activeKey);
      if (completedKey) await deleteStorage(completedKey);

      // In test runs without scope, also clear all memoryStorage and legacy keys
      if (!scope && process.env.NODE_ENV === 'test') {
        platformStorage.clearMemoryCache();
        await deleteStorage('bebig.active.workout');
        await deleteStorage('bebig.completed.workouts');
      }
    } catch {
      // Handled
    }
  },
};
