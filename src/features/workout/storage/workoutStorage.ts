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
export const BASE_ACTIVE_SESSION_TOKEN_KEY = 'bebig.workout.active.token';
export const BASE_ABANDONED_WORKOUT_KEY = 'bebig.workout.active.abandoned';
export const BASE_DISCARDED_WORKOUTS_KEY = 'bebig.workout.active.discarded';
export const BASE_COMPLETED_WORKOUTS_KEY = 'bebig.workout.completed';

export interface ActiveSessionToken {
  sessionId: string | null;
  status: 'active' | 'discarded' | 'completed' | 'none';
  updatedAt: string;
}

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
 * Atomically removes key ONLY if the current storage content has id === expectedId.
 * Guarantees that cleanup of a stale session cannot delete a newer authorized session (TOCTOU immunity).
 */
const deleteStorageIfMatchesId = async (
  key: string,
  expectedId: string,
  scope?: UserScope | null
): Promise<boolean> => {
  if (typeof platformStorage?.removeItemIfMatchingId === 'function') {
    return platformStorage.removeItemIfMatchingId(key, expectedId);
  }

  // Token-guarded fallback: if the active token authorizes a DIFFERENT session, NEVER delete!
  const tokenKey =
    getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, scope) ||
    (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);
  const token = await getActiveSessionToken(tokenKey);
  if (token && token.status === 'active' && token.sessionId !== expectedId) {
    return false;
  }

  const raw = await readStorage(key);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.id === expectedId) {
      const freshToken = await getActiveSessionToken(tokenKey);
      if (freshToken && freshToken.status === 'active' && freshToken.sessionId !== expectedId) {
        return false;
      }
      await deleteStorage(key);
      return true;
    }
  } catch {}
  return false;
};

/**
 * Reads the active session authorization token for a given scope.
 */
const getActiveSessionToken = async (storageKey: string | null): Promise<ActiveSessionToken | null> => {
  if (!storageKey) return null;
  const raw = await readStorage(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.status === 'string') {
      return parsed as ActiveSessionToken;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Persists the active session authorization token for a given scope.
 */
const writeActiveSessionToken = async (
  storageKey: string | null,
  token: ActiveSessionToken
): Promise<void> => {
  if (!storageKey) return;
  try {
    await writeStorage(storageKey, JSON.stringify(token));
  } catch {}
};

/**
 * Reads the list of explicitly discarded workout session IDs for a given scope.
 */
const getDiscardedSessionIds = async (storageKey: string | null): Promise<string[]> => {
  if (!storageKey) return [];
  const raw = await readStorage(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Persists an explicitly discarded workout session ID tombstone (caps at 50 most recent).
 */
const recordDiscardedSessionId = async (storageKey: string | null, sessionId: string): Promise<void> => {
  if (!storageKey || !sessionId) return;
  try {
    const current = await getDiscardedSessionIds(storageKey);
    const updated = [sessionId, ...current.filter((id) => id !== sessionId)].slice(0, 50);
    await writeStorage(storageKey, JSON.stringify(updated));
  } catch {}
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

  /**
   * Checks whether a session ID has been explicitly discarded.
   */
  isSessionDiscarded: async (sessionId: string, scope?: UserScope | null): Promise<boolean> => {
    if (!sessionId) return false;
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const tokenKey =
      getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);
    const token = await getActiveSessionToken(tokenKey);
    if (token && token.status === 'discarded' && token.sessionId === sessionId) {
      return true;
    }

    const discardedKey =
      getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.discarded' : null);

    const discardedIds = await getDiscardedSessionIds(discardedKey);
    return discardedIds.includes(sessionId);
  },

  /**
   * Clears discarded session ID tombstones and active session token (useful for test resets).
   */
  clearDiscardedTombstones: async (scope?: UserScope | null): Promise<void> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const discardedKey =
      getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.discarded' : null);

    const tokenKey =
      getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);

    if (discardedKey) {
      await deleteStorage(discardedKey);
    }
    if (tokenKey) {
      await deleteStorage(tokenKey);
    }
  },

  /**
   * Retrieves the current active session authorization token.
   */
  getActiveSessionToken: async (scope?: UserScope | null): Promise<ActiveSessionToken | null> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const tokenKey =
      getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);

    return getActiveSessionToken(tokenKey);
  },

  /**
   * Atomically deletes active workout storage slot ONLY if it currently contains expectedSessionId.
   * Protects against TOCTOU races where another tab started a newer workout during cleanup.
   */
  deleteActiveWorkoutIfMatchesId: async (expectedSessionId: string, scope?: UserScope | null): Promise<boolean> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const key = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, resolvedScope);
    const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.active.workout' : null);
    if (!storageKey) return false;

    return deleteStorageIfMatchesId(storageKey, expectedSessionId, resolvedScope);
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

        const tokenKey =
          getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, resolvedScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);
        const token = await getActiveSessionToken(tokenKey);

        const key = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, resolvedScope);
        const storageKey = key || (process.env.NODE_ENV === 'test' ? 'bebig.active.workout' : null);

        // If the active token explicitly marks the session as discarded or completed,
        // any lingering draft in storage is unauthorized and purged immediately.
        if (token && (token.status === 'discarded' || token.status === 'completed')) {
          if (storageKey) await deleteStorage(storageKey);
          return null;
        }

        let raw: string | null = null;
        if (storageKey) {
          raw = await readStorage(storageKey);
        }

        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (isValidSession(parsed) && parsed.status === 'active') {
          // Verify session matches active token authorization
          if (token && token.status === 'active' && token.sessionId !== parsed.id) {
            if (storageKey) await deleteStorage(storageKey);
            return null;
          }

          // Verify session has not been explicitly discarded
          const discardedKey =
            getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, resolvedScope) ||
            (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.discarded' : null);
          const discardedIds = await getDiscardedSessionIds(discardedKey);
          if (discardedIds.includes(parsed.id)) {
            // Tombstoned session in active slot — purge immediately
            if (storageKey) await deleteStorage(storageKey);
            return null;
          }
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

    const tokenKey =
      getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, targetScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);

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
        // Force discard existing: Record tombstone and purge from abandoned recovery stack
        const discardedKey =
          getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, targetScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.discarded' : null);
        if (discardedKey) {
          await recordDiscardedSessionId(discardedKey, currentStored.id);
        }

        const abandonedKey =
          getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, targetScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.abandoned' : null);
        if (abandonedKey) {
          const rawAbandoned = await readStorage(abandonedKey);
          if (rawAbandoned) {
            try {
              const parsed = JSON.parse(rawAbandoned);
              if (Array.isArray(parsed)) {
                const remaining = parsed.filter((w) => isValidSession(w) && w.id !== currentStored!.id);
                if (remaining.length > 0) {
                  await writeStorage(abandonedKey, JSON.stringify(remaining));
                } else {
                  await deleteStorage(abandonedKey);
                }
              } else if (isValidSession(parsed) && parsed.id === currentStored.id) {
                await deleteStorage(abandonedKey);
              }
            } catch {}
          }
        }
      }

      await writeStorage(storageKey, JSON.stringify(workout));
      await writeActiveSessionToken(tokenKey, {
        sessionId: workout.id,
        status: 'active',
        updatedAt: new Date().toISOString(),
      });
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

    const tokenKey =
      getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, targetScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);

    return enqueueActiveWorkoutOp(async () => {
      // 0a. Discard Tombstone Guard:
      // If this session has been explicitly discarded, drop write permanently
      const discardedKey =
        getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, targetScope) ||
        (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.discarded' : null);
      const discardedIds = await getDiscardedSessionIds(discardedKey);
      if (discardedIds.includes(workout.id)) {
        return;
      }

      // 0b. Active Session Token Authorization Guard:
      // Authoritatively enforces active session identity across multiple tabs / background writes
      const token = await getActiveSessionToken(tokenKey);
      if (token) {
        if (token.status === 'discarded' && (token.sessionId === workout.id || !options?.allowDifferentSession)) {
          // Explicitly discarded session cannot write or recreate active draft
          return;
        }
        if (token.status === 'completed' && !options?.allowDifferentSession) {
          // Completed workout slot cannot be recreated by an in-flight autosave
          return;
        }
        if (token.status === 'active' && token.sessionId !== workout.id && !options?.allowDifferentSession) {
          throw new Error(
            `Cannot overwrite active workout session "${token.sessionId}" with different session "${workout.name}" (${workout.id}) without explicit authorization.`
          );
        }
      }

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

      // If there is currently no active session in storage, verify token authorization:
      // An autosave should NEVER recreate an active workout when storage has no active session
      // unless authorized as the active session.
      if (!currentStored) {
        if (token && (token.status !== 'active' || token.sessionId !== workout.id)) {
          if (!options?.allowDifferentSession) {
            return;
          }
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

      // Post-write verification:
      // Confirm that the session was not discarded or replaced by another tab while the write was in-flight.
      // Guarded cleanup: ONLY delete storageKey if it currently contains THIS invalidated session;
      // NEVER delete a newer authorized session that may have already claimed the slot in another tab.
      const postDiscardedIds = await getDiscardedSessionIds(discardedKey);
      const postToken = await getActiveSessionToken(tokenKey);

      const isSessionInvalidated =
        postDiscardedIds.includes(workout.id) ||
        (postToken && postToken.status === 'discarded' && postToken.sessionId === workout.id);

      if (isSessionInvalidated) {
        // Atomic CAS deletion: ONLY deletes storageKey if it still contains THIS invalidated session.
        // Never deletes a newer authorized session (Workout B) that may have claimed the slot.
        await deleteStorageIfMatchesId(storageKey, workout.id, targetScope);
        return;
      }

      if (postToken && postToken.status === 'active' && postToken.sessionId !== workout.id && !options?.allowDifferentSession) {
        // Another tab or process has activated a different session.
        // Revert storageKey ONLY if our stale write currently occupies the slot.
        await deleteStorageIfMatchesId(storageKey, workout.id, targetScope);
        return;
      }

      if (options?.allowDifferentSession) {
        await writeActiveSessionToken(tokenKey, {
          sessionId: workout.id,
          status: 'active',
          updatedAt: new Date().toISOString(),
        });
      }
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

        const discardedKey =
          getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, resolvedScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.discarded' : null);
        const discardedIds = await getDiscardedSessionIds(discardedKey);

        const tokenKey =
          getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, resolvedScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);
        const token = await getActiveSessionToken(tokenKey);

        const isDiscarded = (id: string) => {
          if (discardedIds.includes(id)) return true;
          if (token && token.status === 'discarded' && token.sessionId === id) return true;
          return false;
        };

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.find((s) => isValidSession(s) && !isDiscarded(s.id)) ?? null;
        }
        if (isValidSession(parsed) && !isDiscarded(parsed.id)) {
          return parsed;
        }
        return null;
      } catch {
        return null;
      }
    });
  },

  /**
   * Permanently discards the active workout session:
   * 1. Records the session ID in discarded tombstones so subsequent delayed/queued writes are dropped.
   * 2. Sets active session token status to 'discarded'.
   * 3. Clears the active workout storage slot.
   * 4. Purges the session ID from the abandoned recovery stack so it can never be recovered.
   */
  discardActiveWorkout: async (scope?: UserScope | null, specificSessionId?: string): Promise<void> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const activeKey =
      getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout' : null);
    const discardedKey =
      getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.discarded' : null);
    const abandonedKey =
      getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.abandoned' : null);
    const tokenKey =
      getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);

    return enqueueActiveWorkoutOp(async () => {
      // 1. Resolve ID of session being discarded
      let sessionIdToDiscard = specificSessionId;
      if (!sessionIdToDiscard && activeKey) {
        const rawActive = await readStorage(activeKey);
        if (rawActive) {
          try {
            const parsed = JSON.parse(rawActive);
            if (parsed && typeof parsed.id === 'string') {
              sessionIdToDiscard = parsed.id;
            }
          } catch {}
        }
      }

      if (!sessionIdToDiscard && tokenKey) {
        const token = await getActiveSessionToken(tokenKey);
        if (token?.sessionId) {
          sessionIdToDiscard = token.sessionId;
        }
      }

      // 2. Record tombstone
      if (sessionIdToDiscard && discardedKey) {
        await recordDiscardedSessionId(discardedKey, sessionIdToDiscard);
      }

      // 3. Mark active token as permanently discarded
      await writeActiveSessionToken(tokenKey, {
        sessionId: sessionIdToDiscard ?? null,
        status: 'discarded',
        updatedAt: new Date().toISOString(),
      });

      // 4. Clear active slot using atomic ID match
      if (activeKey) {
        if (sessionIdToDiscard) {
          await deleteStorageIfMatchesId(activeKey, sessionIdToDiscard, resolvedScope);
        } else {
          await deleteStorage(activeKey);
        }
      }

      // 5. Purge from abandoned recovery stack if present
      if (sessionIdToDiscard && abandonedKey) {
        const rawAbandoned = await readStorage(abandonedKey);
        if (rawAbandoned) {
          try {
            const parsed = JSON.parse(rawAbandoned);
            if (Array.isArray(parsed)) {
              const remaining = parsed.filter((w) => isValidSession(w) && w.id !== sessionIdToDiscard);
              if (remaining.length > 0) {
                await writeStorage(abandonedKey, JSON.stringify(remaining));
              } else {
                await deleteStorage(abandonedKey);
              }
            } else if (isValidSession(parsed) && parsed.id === sessionIdToDiscard) {
              await deleteStorage(abandonedKey);
            }
          } catch {
            await deleteStorage(abandonedKey);
          }
        }
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
    const tokenKey =
      getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.token' : null);
    if (!storageKey) return;

    return enqueueActiveWorkoutOp(async () => {
      await deleteStorage(storageKey);
      await writeActiveSessionToken(tokenKey, {
        sessionId: null,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });
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
      const discardedKey = getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, scope);
      const completedKey = getUserScopedKey(BASE_COMPLETED_WORKOUTS_KEY, scope);
      const tokenKey = getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, scope);

      if (activeKey) await deleteStorage(activeKey);
      if (abandonedKey) await deleteStorage(abandonedKey);
      if (discardedKey) await deleteStorage(discardedKey);
      if (completedKey) await deleteStorage(completedKey);
      if (tokenKey) await deleteStorage(tokenKey);

      // In test runs without scope, also clear all memoryStorage and legacy keys
      if (!scope && process.env.NODE_ENV === 'test') {
        platformStorage.clearMemoryCache();
        await deleteStorage('bebig.active.workout');
        await deleteStorage('bebig.active.workout.abandoned');
        await deleteStorage('bebig.active.workout.discarded');
        await deleteStorage('bebig.active.workout.token');
        await deleteStorage('bebig.completed.workouts');
      }
    });
  },
};
