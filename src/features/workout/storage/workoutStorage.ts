/**
 * BeBig 2.0 — Workout Storage Layer
 *
 * User-isolated hardware-backed persistence for active workout sessions,
 * abandoned workout recovery drafts, and completed workouts
 * using expo-secure-store with graceful in-memory and web fallback.
 * Strongly isolates data per user using UserScope keys.
 * Sanitizes and validates data on read to protect against corrupt state.
 * Enforces strict FIFO queue serialization across all active session reads, writes, and creation.
 */

import { getUserScopedKey, getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { WorkoutSession, WorkoutExercise, WorkoutSet } from '../types';
import { platformStorage } from '../../../lib/storage';

export const BASE_ACTIVE_WORKOUT_KEY = 'bebig.workout.active';
export const BASE_ABANDONED_WORKOUT_KEY = 'bebig.workout.active.abandoned';
export const BASE_COMPLETED_WORKOUTS_KEY = 'bebig.workout.completed';

const readStorage = async (key: string): Promise<string | null> => {
  if (typeof platformStorage?.getItem !== 'function') {
    return null;
  }
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
  if (!set || typeof set !== 'object') return false;
  if (typeof set.id !== 'string' || !set.id.trim()) return false;
  if (typeof set.setNumber !== 'number') return false;
  if (typeof set.weight !== 'number' || isNaN(set.weight) || set.weight < 0) return false;
  if (typeof set.reps !== 'number' || isNaN(set.reps) || set.reps < 0) return false;

  if (set.rir !== undefined && set.rir !== null) {
    if (typeof set.rir !== 'number' || isNaN(set.rir) || set.rir < 0 || set.rir > 10) {
      delete set.rir;
    }
  }

  if (typeof set.completed !== 'boolean') return false;
  return true;
}

/**
 * Validates whether an unknown object fits the WorkoutExercise structure.
 */
function isValidExercise(ex: any): ex is WorkoutExercise {
  if (!ex || typeof ex !== 'object') return false;
  if (typeof ex.exerciseId !== 'string' || !ex.exerciseId.trim()) return false;
  if (typeof ex.exerciseName !== 'string') return false;
  if (typeof ex.order !== 'number') return false;
  if (!Array.isArray(ex.actualSets)) return false;
  return ex.actualSets.every(isValidSet);
}

/**
 * Validates whether an unknown object fits the WorkoutSession structure.
 */
function isValidSession(item: any): item is WorkoutSession {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.id !== 'string' || !item.id.trim()) return false;
  if (typeof item.name !== 'string') return false;
  if (typeof item.startedAt !== 'string') return false;
  if (item.status !== 'active' && item.status !== 'completed') return false;
  if (!Array.isArray(item.exercises)) return false;
  return item.exercises.every(isValidExercise);
}

let activeWorkoutQueue: Promise<unknown> = Promise.resolve();

const enqueueActiveWorkoutOp = <T>(op: () => Promise<T>): Promise<T> => {
  const task = activeWorkoutQueue.then(
    () => op(),
    () => op()
  );
  activeWorkoutQueue = task.then(
    () => {},
    () => {}
  );
  return task;
};

export const workoutStorage = {
  /**
   * Resets the internal active workout FIFO queue (useful in test suites).
   */
  resetActiveWorkoutQueue: (): void => {
    activeWorkoutQueue = Promise.resolve();
  },

  /**
   * Clears the volatile memoryStorage map (called on sign out or user switch).
   */
  clearMemoryCache: (): void => {
    platformStorage.clearMemoryCache();
  },

  getActiveWorkout: async (scope?: UserScope | null): Promise<WorkoutSession | null> => {
    return enqueueActiveWorkoutOp(async () => {
      try {
        const resolvedScope =
          scope !== undefined
            ? scope
            : (getCurrentUserScope() ??
              (process.env.NODE_ENV === 'test'
                ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
                : null));

        const key = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, resolvedScope);
        let raw: string | null = null;
        if (key) {
          raw = await readStorage(key);
        } else if (process.env.NODE_ENV === 'test') {
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
    });
  },

  /**
   * Atomically checks for an existing active workout, handles conflict/archival,
   * and saves the new session in a single non-interruptible queue operation.
   */
  createActiveWorkout: async (
    workout: WorkoutSession,
    scope?: UserScope | null,
    options?: { forceDiscardExisting?: boolean }
  ): Promise<WorkoutSession> => {
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
    const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.active.workout' : null);
    if (!storageKey) {
      throw new Error('Cannot create active workout without an active user session.');
    }

    return enqueueActiveWorkoutOp(async () => {
      const rawCurrent = await readStorage(storageKey);
      let currentStored: WorkoutSession | null = null;
      if (rawCurrent) {
        try {
          const parsed = JSON.parse(rawCurrent);
          if (isValidSession(parsed)) {
            currentStored = parsed;
          }
        } catch {
          currentStored = null;
        }
      }

      if (currentStored && currentStored.status === 'active') {
        if (!options?.forceDiscardExisting) {
          throw new Error(
            `An active workout is already in progress ("${currentStored.name}"). You must resume or explicitly discard it before starting another workout.`
          );
        }
        // Archive superseded session into abandoned recovery stack
        const abandonedKey =
          getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, targetScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.abandoned' : null);
        if (abandonedKey) {
          let abandonedList: WorkoutSession[] = [];
          const rawAbandoned = await readStorage(abandonedKey);
          if (rawAbandoned) {
            try {
              const parsed = JSON.parse(rawAbandoned);
              if (Array.isArray(parsed)) {
                abandonedList = parsed.filter(isValidSession);
              } else if (isValidSession(parsed)) {
                abandonedList = [parsed];
              }
            } catch {}
          }
          const updatedAbandoned = [currentStored, ...abandonedList.filter((w) => w.id !== currentStored.id)].slice(0, 5);
          await writeStorage(abandonedKey, JSON.stringify(updatedAbandoned));
        }
      }

      await writeStorage(storageKey, JSON.stringify(workout));
      return workout;
    });
  },

  saveActiveWorkout: async (
    workout: WorkoutSession,
    scope?: UserScope | null,
    options?: { allowDifferentSession?: boolean; skipVersionCheck?: boolean }
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

    const key = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, targetScope);
    const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.active.workout' : null);
    if (!storageKey) {
      throw new Error('Cannot save active workout without an active user session.');
    }

    return enqueueActiveWorkoutOp(async () => {
      // 1. Inspect currently stored active workout
      const rawCurrent = await readStorage(storageKey);
      let currentStored: WorkoutSession | null = null;
      if (rawCurrent) {
        try {
          const parsed = JSON.parse(rawCurrent);
          if (isValidSession(parsed)) {
            currentStored = parsed;
          }
        } catch {
          currentStored = null;
        }
      }

      // 2. Safe Session Isolation / Overwrite Rejection:
      // If a different active workout session already exists, reject unless explicitly authorized
      if (
        currentStored &&
        currentStored.id !== workout.id &&
        currentStored.status === 'active'
      ) {
        if (!options?.allowDifferentSession) {
          throw new Error(
            `Cannot overwrite active workout session "${currentStored.name}" (${currentStored.id}) with different session "${workout.name}" (${workout.id}) without explicit authorization.`
          );
        }
        const abandonedKey =
          getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, targetScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.abandoned' : null);
        if (abandonedKey) {
          let abandonedList: WorkoutSession[] = [];
          const rawAbandoned = await readStorage(abandonedKey);
          if (rawAbandoned) {
            try {
              const parsed = JSON.parse(rawAbandoned);
              if (Array.isArray(parsed)) {
                abandonedList = parsed.filter(isValidSession);
              } else if (isValidSession(parsed)) {
                abandonedList = [parsed];
              }
            } catch {}
          }
          const updatedAbandoned = [currentStored, ...abandonedList.filter((w) => w.id !== currentStored.id)].slice(0, 5);
          await writeStorage(abandonedKey, JSON.stringify(updatedAbandoned));
        }
      }

      // 3. Optimistic Concurrency Guard:
      // If updating the same session, reject stale write if incoming version is older than stored
      const incomingVersion = typeof workout.version === 'number' ? workout.version : 0;
      if (
        currentStored &&
        currentStored.id === workout.id &&
        typeof currentStored.version === 'number' &&
        incomingVersion < currentStored.version &&
        !options?.skipVersionCheck
      ) {
        // Stale snapshot rejected; preserve newer stored state
        return;
      }

      await writeStorage(storageKey, JSON.stringify(workout));
    });
  },

  archiveActiveWorkout: async (
    workout: WorkoutSession,
    scope?: UserScope | null
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

    const key = getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, targetScope);
    const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.abandoned' : null);
    if (!storageKey) return;

    return enqueueActiveWorkoutOp(async () => {
      let abandonedList: WorkoutSession[] = [];
      const rawAbandoned = await readStorage(storageKey);
      if (rawAbandoned) {
        try {
          const parsed = JSON.parse(rawAbandoned);
          if (Array.isArray(parsed)) {
            abandonedList = parsed.filter(isValidSession);
          } else if (isValidSession(parsed)) {
            abandonedList = [parsed];
          }
        } catch {}
      }
      const updatedAbandoned = [workout, ...abandonedList.filter((w) => w.id !== workout.id)].slice(0, 5);
      await writeStorage(storageKey, JSON.stringify(updatedAbandoned));
    });
  },

  getAbandonedWorkout: async (scope?: UserScope | null): Promise<WorkoutSession | null> => {
    return enqueueActiveWorkoutOp(async () => {
      try {
        const resolvedScope =
          scope !== undefined
            ? scope
            : (getCurrentUserScope() ??
              (process.env.NODE_ENV === 'test'
                ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
                : null));

        const key = getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, resolvedScope);
        let raw: string | null = null;
        if (key) {
          raw = await readStorage(key);
        } else if (process.env.NODE_ENV === 'test') {
          raw = await readStorage('bebig.active.workout.abandoned');
        }

        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.find(isValidSession) ?? null;
        }
        if (isValidSession(parsed)) {
          return parsed;
        }
        return null;
      } catch {
        return null;
      }
    });
  },

  removeAbandonedWorkoutById: async (id: string, scope?: UserScope | null): Promise<void> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const key = getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, resolvedScope);
    const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.abandoned' : null);
    if (!storageKey) return;

    return enqueueActiveWorkoutOp(async () => {
      const raw = await readStorage(storageKey);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter((w) => isValidSession(w) && w.id !== id);
          if (remaining.length > 0) {
            await writeStorage(storageKey, JSON.stringify(remaining));
          } else {
            await deleteStorage(storageKey);
          }
        } else if (isValidSession(parsed) && parsed.id === id) {
          await deleteStorage(storageKey);
        }
      } catch {
        await deleteStorage(storageKey);
      }
    });
  },

  clearAbandonedWorkout: async (scope?: UserScope | null): Promise<void> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const key = getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, resolvedScope);
    const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.abandoned' : null);
    if (!storageKey) return;

    return enqueueActiveWorkoutOp(async () => {
      await deleteStorage(storageKey);
    });
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
    const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.active.workout' : null);
    if (!storageKey) return;

    return enqueueActiveWorkoutOp(async () => {
      await deleteStorage(storageKey);
    });
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
      let raw: string | null = null;
      if (key) {
        raw = await readStorage(key);
      } else if (process.env.NODE_ENV === 'test') {
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
    const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.completed.workouts' : null);
    if (!storageKey) {
      throw new Error('Cannot save completed workout without an active user session.');
    }

    const current = await workoutStorage.getCompletedWorkouts(targetScope);
    const filtered = current.filter((w) => w.id !== workout.id);
    const updated = [workout, ...filtered];
    await writeStorage(storageKey, JSON.stringify(updated));
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
    const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.completed.workouts' : null);
    if (!storageKey) return;

    const current = await workoutStorage.getCompletedWorkouts(resolvedScope);
    const updated = current.filter((w) => w.id !== id);
    await writeStorage(storageKey, JSON.stringify(updated));
  },

  clearAllWorkouts: async (scope?: UserScope | null): Promise<void> => {
    return enqueueActiveWorkoutOp(async () => {
      const activeKey = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, scope);
      const abandonedKey = getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, scope);
      const completedKey = getUserScopedKey(BASE_COMPLETED_WORKOUTS_KEY, scope);

      if (activeKey) await deleteStorage(activeKey);
      if (abandonedKey) await deleteStorage(abandonedKey);
      if (completedKey) await deleteStorage(completedKey);

      // In test runs without scope, also clear all memoryStorage and legacy keys
      if (!scope && process.env.NODE_ENV === 'test') {
        platformStorage.clearMemoryCache();
        await deleteStorage('bebig.active.workout');
        await deleteStorage('bebig.active.workout.abandoned');
        await deleteStorage('bebig.completed.workouts');
      }
    });
  },
};
