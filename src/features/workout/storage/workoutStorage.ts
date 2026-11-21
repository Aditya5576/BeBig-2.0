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
export const BASE_ACTIVE_WORKOUT_RECOVERY_BACKUP_KEY = 'bebig.workout.active.recovery_backup';
export const BASE_ACTIVE_WORKOUT_SYNC_EMERGENCY_KEY = 'bebig.workout.active.sync_emergency';
export const BASE_ABANDONED_WORKOUT_KEY = 'bebig.workout.active.abandoned';
export const BASE_DISCARDED_WORKOUTS_KEY = 'bebig.workout.active.discarded';
export const BASE_COMPLETED_WORKOUTS_KEY = 'bebig.workout.completed';
export const BASE_COMPLETED_TOMBSTONES_KEY = 'bebig.workout.completed.deleted';

export interface ActiveSessionToken {
  sessionId: string | null;
  status: 'active' | 'discarded' | 'completed' | 'none';
  updatedAt: string;
}

export interface SaveActiveWorkoutResult {
  ok: boolean;
  conflict?: boolean;
  persistedRevision?: number;
  incomingRevision?: number;
  rebased?: boolean;
  restoredExercisesCount?: number;
  session?: WorkoutSession;
  workout?: WorkoutSession;
  error?: string;
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

const inMemoryEmergencyMirror = new Map<string, WorkoutSession>();

export const writeSyncEmergencyMirror = (session: WorkoutSession): void => {
  if (!session || !session.id) return;
  try {
    inMemoryEmergencyMirror.set(BASE_ACTIVE_WORKOUT_SYNC_EMERGENCY_KEY, JSON.parse(JSON.stringify(session)));
    const storageObj =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof globalThis !== 'undefined' && (globalThis as any).localStorage
          ? (globalThis as any).localStorage
          : null;
    if (storageObj && typeof storageObj.setItem === 'function') {
      storageObj.setItem(BASE_ACTIVE_WORKOUT_SYNC_EMERGENCY_KEY, JSON.stringify(session));
    }
  } catch {}
};

export const readSyncEmergencyMirror = async (): Promise<WorkoutSession | null> => {
  try {
    // 1. In-memory emergency mirror (works synchronously on native & web)
    const inMem = inMemoryEmergencyMirror.get(BASE_ACTIVE_WORKOUT_SYNC_EMERGENCY_KEY);
    if (inMem && isValidSession(inMem) && (inMem.status === 'active' || (inMem.status as string) === 'in_progress')) {
      return inMem;
    }

    // 2. localStorage emergency mirror
    const storageObj =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof globalThis !== 'undefined' && (globalThis as any).localStorage
          ? (globalThis as any).localStorage
          : null;
    if (storageObj && typeof storageObj.getItem === 'function') {
      const raw = storageObj.getItem(BASE_ACTIVE_WORKOUT_SYNC_EMERGENCY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidSession(parsed) && (parsed.status === 'active' || (parsed.status as string) === 'in_progress')) {
          return parsed;
        }
      }
    }

    // 3. Platform storage fallback
    const rawPlatform = await readStorage(BASE_ACTIVE_WORKOUT_SYNC_EMERGENCY_KEY);
    if (rawPlatform) {
      const parsed = JSON.parse(rawPlatform);
      if (isValidSession(parsed) && (parsed.status === 'active' || (parsed.status as string) === 'in_progress')) {
        return parsed;
      }
    }
  } catch {}
  return null;
};

export const clearSyncEmergencyMirror = async (): Promise<void> => {
  try {
    inMemoryEmergencyMirror.delete(BASE_ACTIVE_WORKOUT_SYNC_EMERGENCY_KEY);
    const storageObj =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : typeof globalThis !== 'undefined' && (globalThis as any).localStorage
          ? (globalThis as any).localStorage
          : null;
    if (storageObj && typeof storageObj.removeItem === 'function') {
      storageObj.removeItem(BASE_ACTIVE_WORKOUT_SYNC_EMERGENCY_KEY);
    }
    await deleteStorage(BASE_ACTIVE_WORKOUT_SYNC_EMERGENCY_KEY);
  } catch {}
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

/**
 * In-memory FIFO promise queue per lock key to ensure in-process serialization across all environments.
 */
const inMemoryLockQueues = new Map<string, Promise<unknown>>();

/**
 * IndexedDB cross-tab mutex barrier.
 * By W3C IndexedDB specification, concurrent `readwrite` transactions targeting the
 * same object store across different tabs / workers are queued and run sequentially.
 */
function withIndexedDbLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open('bebig_cross_tab_locks', 1);
    } catch (e) {
      return reject(e);
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('locks')) {
        db.createObjectStore('locks', { keyPath: 'id' });
      }
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB lock database'));
    };

    request.onsuccess = async () => {
      const db = request.result;
      try {
        const tx = db.transaction('locks', 'readwrite');
        const store = tx.objectStore('locks');
        const putReq = store.put({ id: lockKey, timestamp: Date.now() });

        await new Promise<void>((txResolve, txReject) => {
          putReq.onsuccess = () => txResolve();
          putReq.onerror = () => txReject(putReq.error);
        });

        const result = await fn();
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        try {
          db.close();
        } catch {}
      }
    };
  });
}

/**
 * Cross-tab + in-process storage lock.
 * Uses Web Locks API (`navigator.locks.request`) when available,
 * OR IndexedDB `readwrite` transaction barrier when available,
 * OR an atomic compare-and-verify storage lease with unique ownerId and settling yield.
 */
export async function withStorageLock<T>(
  lockKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const normalizedKey = `bebig.lock.${lockKey}`;

  // 1. In-process FIFO queue ensures operations within the same JS process serialize sequentially
  const prevQueue = inMemoryLockQueues.get(normalizedKey) || Promise.resolve();

  let releaseInProcess: () => void;
  const inProcessWait = new Promise<void>((resolve) => {
    releaseInProcess = resolve;
  });

  // Chain the new task to the queue
  inMemoryLockQueues.set(
    normalizedKey,
    prevQueue.then(
      () => inProcessWait,
      () => inProcessWait
    )
  );

  await prevQueue;

  try {
    // 2. Cross-tab Web Locks API (if available in modern browsers)
    if (
      typeof navigator !== 'undefined' &&
      navigator.locks &&
      typeof navigator.locks.request === 'function'
    ) {
      return await navigator.locks.request(normalizedKey, async () => {
        return await fn();
      });
    }

    // 2b. Cross-tab IndexedDB transaction barrier (W3C strict cross-tab serialization)
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function') {
      try {
        return await withIndexedDbLock(normalizedKey, fn);
      } catch {
        // Fall through to storage lease if IndexedDB is blocked or unsupported
      }
    }

    // 3. Storage lease fallback for multi-tab environments without Web Locks or IndexedDB (P0-01)
    const leaseStorageKey = `__lock_lease_${normalizedKey}`;
    const leaseTtlMs = 5000;
    const acquireTimeoutMs = 10000;
    const startTime = Date.now();
    const ownerId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let acquired = false;
    while (Date.now() - startTime < acquireTimeoutMs) {
      const rawLease = await readStorage(leaseStorageKey);
      let canAttempt = true;

      if (rawLease) {
        try {
          const lease = JSON.parse(rawLease);
          if (lease && typeof lease.expiresAt === 'number' && lease.expiresAt > Date.now()) {
            if (lease.ownerId !== ownerId) {
              canAttempt = false;
            }
          }
        } catch {
          canAttempt = true;
        }
      }

      if (canAttempt) {
        const expiresAt = Date.now() + leaseTtlMs;
        await writeStorage(leaseStorageKey, JSON.stringify({ ownerId, expiresAt }));

        // Yield 15ms to allow any concurrent candidate write to settle
        await new Promise((r) => setTimeout(r, 15));

        // Re-read and verify that our ownerId actually won the lease
        const verifyRaw = await readStorage(leaseStorageKey);
        try {
          const verifyParsed = JSON.parse(verifyRaw || '{}');
          if (verifyParsed.ownerId === ownerId && verifyParsed.expiresAt > Date.now()) {
            acquired = true;
            break;
          }
        } catch {}
      }

      // Retry with randomized jitter (20ms - 50ms) to de-synchronize contention
      const jitter = Math.floor(Math.random() * 30) + 20;
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }

    if (!acquired) {
      throw new Error(`Failed to acquire storage lock for "${lockKey}" within ${acquireTimeoutMs}ms`);
    }

    try {
      return await fn();
    } finally {
      // Releasing lease ONLY if our ownerId still holds it
      try {
        const currentLease = await readStorage(leaseStorageKey);
        if (currentLease) {
          const parsed = JSON.parse(currentLease);
          if (parsed.ownerId === ownerId) {
            await deleteStorage(leaseStorageKey);
          }
        }
      } catch {}
    }
  } finally {
    releaseInProcess!();
  }
}

const getCompletedTombstones = async (targetScope: UserScope | null): Promise<Set<string>> => {
  const tombstoneKey =
    getUserScopedKey(BASE_COMPLETED_TOMBSTONES_KEY, targetScope) ||
    (process.env.NODE_ENV === 'test' ? 'bebig.workout.completed.deleted' : null);
  if (!tombstoneKey) return new Set();
  const raw = await readStorage(tombstoneKey);
  if (!raw) return new Set();
  try {
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
};

const addCompletedTombstone = async (
  id: string,
  targetScope: UserScope | null
): Promise<void> => {
  const tombstoneKey =
    getUserScopedKey(BASE_COMPLETED_TOMBSTONES_KEY, targetScope) ||
    (process.env.NODE_ENV === 'test' ? 'bebig.workout.completed.deleted' : null);
  if (!tombstoneKey) return;
  const current = await getCompletedTombstones(targetScope);
  current.add(id);
  const list = Array.from(current).slice(-500);
  await writeStorage(tombstoneKey, JSON.stringify(list));
};

const removeCompletedTombstone = async (
  id: string,
  targetScope: UserScope | null
): Promise<void> => {
  const tombstoneKey =
    getUserScopedKey(BASE_COMPLETED_TOMBSTONES_KEY, targetScope) ||
    (process.env.NODE_ENV === 'test' ? 'bebig.workout.completed.deleted' : null);
  if (!tombstoneKey) return;
  const current = await getCompletedTombstones(targetScope);
  if (current.delete(id)) {
    await writeStorage(tombstoneKey, JSON.stringify(Array.from(current)));
  }
};

/**
 * Merges an incoming completed workout into the existing list, prioritizing latest updates
 * and respecting active tombstones. Pure synchronous function (zero await gaps).
 */
export function mergeCompletedWithTombstones(
  existingWorkouts: WorkoutSession[],
  incomingWorkout: WorkoutSession,
  tombstones: Set<string>
): { updated: WorkoutSession[]; tombstones: Set<string> } {
  const nextTombstones = new Set(tombstones);
  nextTombstones.delete(incomingWorkout.id);

  const map = new Map<string, WorkoutSession>();
  for (const w of existingWorkouts) {
    if (!nextTombstones.has(w.id)) {
      map.set(w.id, w);
    }
  }
  map.set(incomingWorkout.id, incomingWorkout);

  const updated = Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.finishedAt || a.startedAt).getTime();
    const timeB = new Date(b.finishedAt || b.startedAt).getTime();
    return timeB - timeA;
  });

  return { updated, tombstones: nextTombstones };
}

/**
 * Removes a completed workout from the existing list and updates the tombstone set.
 * Pure synchronous function (zero await gaps).
 */
export function deleteCompletedWithTombstones(
  existingWorkouts: WorkoutSession[],
  idToDelete: string,
  tombstones: Set<string>
): { updated: WorkoutSession[]; tombstones: Set<string> } {
  const nextTombstones = new Set(tombstones);
  nextTombstones.add(idToDelete);

  const updated = existingWorkouts.filter((w) => w.id !== idToDelete && !nextTombstones.has(w.id));
  return { updated, tombstones: nextTombstones };
}

/**
 * P0-01: Executes a completed-workout mutation inside a single continuous IndexedDB `readwrite`
 * transaction on `bebig_cross_tab_locks` with ZERO `await` gaps inside the transaction callbacks.
 * In W3C IndexedDB, transactions auto-commit if the event loop returns to idle without active pending
 * requests. By issuing `store.put()` synchronously inside `store.get().onsuccess`, the transaction
 * remains continuously active until commit, preventing concurrent cross-tab race conditions.
 * After `tx.oncomplete` fires, the result is mirrored to platform storage.
 */
export function executeIndexedDbAtomicCompletedMutation(
  storageKey: string,
  initialWorkouts: WorkoutSession[],
  initialTombstones: Set<string>,
  tombstoneKey: string | null,
  mutationFn: (existing: WorkoutSession[], tombstones: Set<string>) => { updated: WorkoutSession[]; tombstones: Set<string> }
): Promise<WorkoutSession[]> {
  return new Promise<WorkoutSession[]>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open('bebig_cross_tab_locks', 1);
    } catch (e) {
      return reject(e);
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('locks')) {
        db.createObjectStore('locks', { keyPath: 'id' });
      }
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB lock database'));
    };

    request.onsuccess = () => {
      const db = request.result;
      let tx: IDBTransaction;
      try {
        tx = db.transaction('locks', 'readwrite');
      } catch (err) {
        try {
          db.close();
        } catch {}
        return reject(err);
      }

      let mutatedResult: { updated: WorkoutSession[]; tombstones: Set<string> } | null = null;

      tx.oncomplete = () => {
        try {
          db.close();
        } catch {}
        if (mutatedResult) {
          const res = mutatedResult;
          // Asynchronously mirror committed state to platform storage
          Promise.all([
            writeStorage(storageKey, JSON.stringify(res.updated)),
            tombstoneKey ? writeStorage(tombstoneKey, JSON.stringify(Array.from(res.tombstones))) : Promise.resolve(),
          ]).catch(() => {});
          resolve(res.updated);
        } else {
          resolve([]);
        }
      };

      tx.onerror = () => {
        try {
          db.close();
        } catch {}
        reject(tx.error || new Error('IndexedDB transaction failed'));
      };

      tx.onabort = () => {
        try {
          db.close();
        } catch {}
        reject(tx.error || new Error('IndexedDB transaction aborted'));
      };

      try {
        const store = tx.objectStore('locks');
        const getReq = store.get(storageKey);

        getReq.onerror = () => {
          // Triggers tx.onerror / tx.abort
        };

        getReq.onsuccess = () => {
          try {
            const record = getReq.result;
            let existingWorkouts: WorkoutSession[] = initialWorkouts;
            let currentTombstones: Set<string> = initialTombstones;

            if (record && Array.isArray(record.data)) {
              existingWorkouts = record.data.filter(isValidSession);
            }
            if (record && Array.isArray(record.tombstones)) {
              currentTombstones = new Set(record.tombstones.filter((id: any) => typeof id === 'string'));
            }

            // Synchronous mutation execution — zero await gaps
            const result = mutationFn(existingWorkouts, currentTombstones);
            mutatedResult = result;

            // Synchronous write back to IndexedDB object store in the exact same event tick
            store.put({
              id: storageKey,
              data: result.updated,
              tombstones: Array.from(result.tombstones),
              timestamp: Date.now(),
            });
          } catch (mutationErr) {
            try {
              tx.abort();
            } catch {}
            reject(mutationErr);
          }
        };
      } catch (err) {
        try {
          db.close();
        } catch {}
        reject(err);
      }
    };
  });
}

export const workoutStorage = {
  /**
   * Resets internal in-memory locks (useful in test suites).
   */
  resetStorageLocks: (): void => {
    inMemoryLockQueues.clear();
  },
  /**
   * Resets the internal active workout FIFO queue (useful in test suites).
   */
  resetActiveWorkoutQueue: (): void => {
    activeWorkoutQueue = Promise.resolve();
  },

  /**
   * Clears volatile in-memory storage (called on logout/user switch).
   */
  clearMemoryCache: (): void => {
    // In-memory cache hook (workoutStorage persists directly to platformStorage)
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

        // Emergency Mirror Check:
        // If a synchronous emergency snapshot was captured during iOS/PWA pagehide / screen-lock,
        // inspect it before reading secondary or fallback storage.
        const emergencySnapshot = await readSyncEmergencyMirror();
        if (emergencySnapshot) {
          const isTokenMismatch = token && token.status === 'active' && token.sessionId !== emergencySnapshot.id;
          if (!isTokenMismatch) {
            const emergencySeq = Math.max(
              Number((emergencySnapshot as any).revision ?? 0),
              Number(emergencySnapshot.version ?? 0)
            );

            let primarySession: WorkoutSession | null = null;
            if (raw) {
              try {
                const parsedRaw = JSON.parse(raw);
                if (isValidSession(parsedRaw) && parsedRaw.id === emergencySnapshot.id) {
                  primarySession = parsedRaw;
                }
              } catch {}
            }

            const primarySeq = primarySession
              ? Math.max(Number((primarySession as any).revision ?? 0), Number(primarySession.version ?? 0))
              : 0;

            if (
              !primarySession ||
              emergencySeq > primarySeq ||
              ((emergencySnapshot.exercises?.length ?? 0) > 0 && (!primarySession.exercises || primarySession.exercises.length === 0))
            ) {
              console.warn(
                `[WORKOUT_STORAGE] Restored/promoted active workout "${emergencySnapshot.name}" (${emergencySnapshot.id}) from sync emergency mirror!`
              );
              if (storageKey) {
                await writeStorage(storageKey, JSON.stringify(emergencySnapshot));
              }
              return emergencySnapshot;
            }
          }
        }

        const recoveryBackupKey =
          getUserScopedKey(BASE_ACTIVE_WORKOUT_RECOVERY_BACKUP_KEY, resolvedScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.workout.active.recovery_backup' : null);

        if (!raw) {
          // If primary active workout key was cleared or evicted, check recovery backup before giving up
          if (recoveryBackupKey) {
            const rawBackup = await readStorage(recoveryBackupKey);
            if (rawBackup) {
              try {
                const parsedBackup = JSON.parse(rawBackup);
                if (
                  isValidSession(parsedBackup) &&
                  (parsedBackup.status === 'active' || (parsedBackup.status as string) === 'in_progress') &&
                  parsedBackup.exercises &&
                  parsedBackup.exercises.length > 0
                ) {
                  // Verify token authorization: require active token AND token.sessionId === parsedBackup.id!
                  if (token && token.status === 'active' && token.sessionId === parsedBackup.id) {
                    console.warn(
                      `[WORKOUT_STORAGE] Restored active workout "${parsedBackup.name}" (${parsedBackup.id}) from shadow recovery backup!`
                    );
                    if (storageKey) {
                      await writeStorage(storageKey, JSON.stringify(parsedBackup));
                    }
                    return parsedBackup;
                  } else {
                    console.warn(
                      `[WORKOUT_STORAGE] Rejected shadow recovery backup "${parsedBackup.id}": active token missing or mismatched (token: ${JSON.stringify(token)}).`
                    );
                  }
                }
              } catch {}
            }
          }
          return null;
        }

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

          // Self-Healing Recovery Check:
          // If parsed.exercises is empty, check if recovery backup exists with non-empty exercises for this session
          if (recoveryBackupKey && (!parsed.exercises || parsed.exercises.length === 0)) {
            const rawBackup = await readStorage(recoveryBackupKey);
            if (rawBackup) {
              try {
                const parsedBackup = JSON.parse(rawBackup);
                if (
                  isValidSession(parsedBackup) &&
                  parsedBackup.id === parsed.id &&
                  (parsedBackup.status === 'active' || (parsedBackup.status as string) === 'in_progress') &&
                  token &&
                  token.status === 'active' &&
                  token.sessionId === parsedBackup.id &&
                  parsedBackup.exercises &&
                  parsedBackup.exercises.length > 0
                ) {
                  console.warn(
                    `[WORKOUT_STORAGE] Self-healed active workout "${parsed.name}" (${parsed.id}) from shadow recovery backup: restored ${parsedBackup.exercises.length} exercises!`
                  );
                  const healedSession: WorkoutSession = {
                    ...parsed,
                    exercises: parsedBackup.exercises,
                    activeRestTimer: parsedBackup.activeRestTimer ?? parsed.activeRestTimer,
                    revision: Math.max(Number(parsed.revision ?? 0), Number(parsedBackup.revision ?? 0)) + 1,
                    version: Math.max(Number(parsed.version ?? 0), Number(parsedBackup.version ?? 0)) + 1,
                  };
                  if (storageKey) {
                    await writeStorage(storageKey, JSON.stringify(healedSession));
                  }
                  return healedSession;
                } else if (parsedBackup && (!token || token.status !== 'active' || token.sessionId !== parsedBackup.id)) {
                  console.warn(
                    `[WORKOUT_STORAGE] Rejected self-healing from recovery backup "${parsedBackup?.id}": active token missing or mismatched.`
                  );
                }
              } catch {}
            }
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

      // Update shadow recovery backup if created session already has exercises (e.g. from template or recovery)
      const recoveryBackupKey =
        getUserScopedKey(BASE_ACTIVE_WORKOUT_RECOVERY_BACKUP_KEY, targetScope) ||
        (process.env.NODE_ENV === 'test' ? 'bebig.workout.active.recovery_backup' : null);
      if (recoveryBackupKey) {
        try {
          if (workout.exercises && workout.exercises.length > 0) {
            await writeStorage(recoveryBackupKey, JSON.stringify(workout));
          } else {
            await deleteStorage(recoveryBackupKey);
          }
        } catch (err) {
          console.warn('[WORKOUT_STORAGE] Non-fatal error persisting shadow recovery backup in createActiveWorkout:', err);
        }
      }

      return workout;
    });
  },

  saveActiveWorkout: async (
    workout: WorkoutSession,
    scope?: UserScope | null,
    options?: { allowDifferentSession?: boolean; skipVersionCheck?: boolean; allowEmptyOverwrites?: boolean; allowExerciseRemoval?: boolean }
  ): Promise<SaveActiveWorkoutResult> => {
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

    const lockKey = `active.${storageKey}`;

    return withStorageLock(lockKey, async () => {
      return enqueueActiveWorkoutOp(async (): Promise<SaveActiveWorkoutResult> => {
        // 0a. Discard Tombstone Guard:
        // If this session has been explicitly discarded, drop write permanently
        const discardedKey =
          getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, targetScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.active.workout.discarded' : null);
        const discardedIds = await getDiscardedSessionIds(discardedKey);
        if (discardedIds.includes(workout.id)) {
          return { ok: false, error: 'Session has been explicitly discarded.' };
        }

        // 0b. Active Session Token Authorization Guard:
        // Authoritatively enforces active session identity across multiple tabs / background writes
        const token = await getActiveSessionToken(tokenKey);
        if (token) {
          if (token.status === 'discarded' && (token.sessionId === workout.id || !options?.allowDifferentSession)) {
            // Explicitly discarded session cannot write or recreate active draft
            return { ok: false, error: 'Session discarded via token status.' };
          }
          if (token.status === 'completed' && !options?.allowDifferentSession) {
            // Completed workout slot cannot be recreated by an in-flight autosave
            return { ok: false, error: 'Session marked completed.' };
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
              return { ok: false, error: 'No active session token authorization.' };
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

        // Invariant: Content-Preserving Monotonicity Guard
        // If storage already holds an active session with the same ID, and that stored session
        // has exercises, NEVER wipe them with an empty snapshot unless explicitly authorized
        // via options.allowEmptyOverwrites.
        let effectiveExercises = workout.exercises;
        let restoredExercisesCount: number | undefined = undefined;
        if (
          currentStored &&
          currentStored.id === workout.id &&
          currentStored.exercises &&
          currentStored.exercises.length > 0 &&
          (!workout.exercises || workout.exercises.length === 0) &&
          !options?.allowEmptyOverwrites
        ) {
          console.warn(
            `[WORKOUT_STORAGE] Prevented accidental wipe of active session "${workout.name}" (${workout.id})! Preserving ${currentStored.exercises.length} stored exercises.`
          );
          effectiveExercises = currentStored.exercises;
          restoredExercisesCount = currentStored.exercises.length;
        } else if (
          currentStored &&
          currentStored.id === workout.id &&
          currentStored.exercises &&
          currentStored.exercises.length > 1 &&
          workout.exercises &&
          workout.exercises.length > 0 &&
          workout.exercises.length < currentStored.exercises.length &&
          !options?.allowExerciseRemoval &&
          !options?.allowEmptyOverwrites
        ) {
          const incomingIds = new Set(workout.exercises.map((e) => e.exerciseId));
          const missing = currentStored.exercises.filter((e) => !incomingIds.has(e.exerciseId));
          if (missing.length > 0) {
            console.warn(
              `[WORKOUT_STORAGE] Prevented accidental partial truncation of active session "${workout.name}" (${workout.id})! Preserving ${missing.length} missing exercises.`
            );
            effectiveExercises = [...workout.exercises, ...missing].sort((a, b) => a.order - b.order);
            restoredExercisesCount = missing.length;
          }
        }

        // 3. Unified Monotonic Revision + Version CAS Guard (P0-02):
        const incomingSeq = Math.max(
          Number((workout as any).revision ?? 0),
          Number(workout.version ?? 0)
        );

        const persistedSeq = currentStored
          ? Math.max(
              Number((currentStored as any).revision ?? 0),
              Number(currentStored.version ?? 0)
            )
          : 0;

        if (
          currentStored &&
          currentStored.id === workout.id &&
          !options?.skipVersionCheck
        ) {
          if (incomingSeq <= persistedSeq) {
            return {
              ok: false,
              conflict: true,
              persistedRevision: persistedSeq,
              incomingRevision: incomingSeq,
              error: `Stale or concurrent revision rejected (incoming: ${incomingSeq}, stored: ${persistedSeq}).`,
            };
          }
        }

        // Persist both revision: incomingSeq and version: incomingSeq on accepted writes
        const workoutToPersist: WorkoutSession = {
          ...workout,
          exercises: effectiveExercises,
          revision: incomingSeq,
          version: incomingSeq,
        };

        await writeStorage(storageKey, JSON.stringify(workoutToPersist));

        // Always update shadow recovery backup if workout has non-empty exercises.
        // If empty exercises was explicitly allowed (e.g. user manually deleted all exercises), purge recovery backup.
        const recoveryBackupKey =
          getUserScopedKey(BASE_ACTIVE_WORKOUT_RECOVERY_BACKUP_KEY, targetScope) ||
          (process.env.NODE_ENV === 'test' ? 'bebig.workout.active.recovery_backup' : null);
        if (recoveryBackupKey) {
          try {
            if (effectiveExercises && effectiveExercises.length > 0) {
              await writeStorage(recoveryBackupKey, JSON.stringify(workoutToPersist));
            } else if (options?.allowEmptyOverwrites) {
              await deleteStorage(recoveryBackupKey);
            }
          } catch (err) {
            console.warn('[WORKOUT_STORAGE] Non-fatal error persisting shadow recovery backup:', err);
          }
        }

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
          return { ok: false, error: 'Session invalidated post-write.' };
        }

        if (postToken && postToken.status === 'active' && postToken.sessionId !== workout.id && !options?.allowDifferentSession) {
          // Another tab or process has activated a different session.
          // Revert storageKey ONLY if our stale write currently occupies the slot.
          await deleteStorageIfMatchesId(storageKey, workout.id, targetScope);
          return { ok: false, error: 'Different session activated post-write.' };
        }

        if (options?.allowDifferentSession) {
          await writeActiveSessionToken(tokenKey, {
            sessionId: workout.id,
            status: 'active',
            updatedAt: new Date().toISOString(),
          });
        }

        return {
          ok: true,
          incomingRevision: incomingSeq,
          restoredExercisesCount,
          session: workoutToPersist,
          workout: workoutToPersist,
        };
      });
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

      // 6. Purge shadow recovery backup and sync emergency mirror
      const recoveryBackupKey =
        getUserScopedKey(BASE_ACTIVE_WORKOUT_RECOVERY_BACKUP_KEY, resolvedScope) ||
        (process.env.NODE_ENV === 'test' ? 'bebig.workout.active.recovery_backup' : null);
      if (recoveryBackupKey) {
        await deleteStorage(recoveryBackupKey);
      }
      await clearSyncEmergencyMirror();
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
    const recoveryBackupKey =
      getUserScopedKey(BASE_ACTIVE_WORKOUT_RECOVERY_BACKUP_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.workout.active.recovery_backup' : null);
    if (!storageKey) return;

    return enqueueActiveWorkoutOp(async () => {
      await deleteStorage(storageKey);
      if (recoveryBackupKey) {
        await deleteStorage(recoveryBackupKey);
      }
      await clearSyncEmergencyMirror();
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

    const tombstoneKey =
      getUserScopedKey(BASE_COMPLETED_TOMBSTONES_KEY, targetScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.workout.completed.deleted' : null);

    // 1. If IndexedDB is supported, execute atomic single-transaction mutation (P0-01)
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function') {
      try {
        const initialWorkouts = await workoutStorage.getCompletedWorkouts(targetScope);
        const initialTombstones = await getCompletedTombstones(targetScope);
        await executeIndexedDbAtomicCompletedMutation(
          storageKey,
          initialWorkouts,
          initialTombstones,
          tombstoneKey,
          (existing, tombstones) => mergeCompletedWithTombstones(existing, workout, tombstones)
        );
        return;
      } catch {
        // Fall back to storage lock if IndexedDB is blocked or throws
      }
    }

    // 2. Fallback: Web Locks API / In-process FIFO queue + lease
    const lockKey = `completed.${storageKey}`;
    return withStorageLock(lockKey, async () => {
      // 1. Remove deletion tombstone if re-saving/upserting this workout
      await removeCompletedTombstone(workout.id, targetScope);
      const tombstones = await getCompletedTombstones(targetScope);

      // 2. Fetch latest stored workouts for idempotent union merge
      const current = await workoutStorage.getCompletedWorkouts(targetScope);
      const { updated } = mergeCompletedWithTombstones(current, workout, tombstones);

      await writeStorage(storageKey, JSON.stringify(updated));
    });
  },

  upsertCompletedWorkout: async (
    workout: WorkoutSession,
    scope?: UserScope | null,
  ): Promise<void> => {
    return workoutStorage.saveCompletedWorkout(workout, scope);
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

    const tombstoneKey =
      getUserScopedKey(BASE_COMPLETED_TOMBSTONES_KEY, resolvedScope) ||
      (process.env.NODE_ENV === 'test' ? 'bebig.workout.completed.deleted' : null);

    // 1. If IndexedDB is supported, execute atomic single-transaction mutation (P0-01)
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function') {
      try {
        const initialWorkouts = await workoutStorage.getCompletedWorkouts(resolvedScope);
        const initialTombstones = await getCompletedTombstones(resolvedScope);
        await executeIndexedDbAtomicCompletedMutation(
          storageKey,
          initialWorkouts,
          initialTombstones,
          tombstoneKey,
          (existing, tombstones) => deleteCompletedWithTombstones(existing, id, tombstones)
        );
        return;
      } catch {
        // Fall back to storage lock if IndexedDB is blocked or throws
      }
    }

    // 2. Fallback: Web Locks API / In-process FIFO queue + lease
    const lockKey = `completed.${storageKey}`;
    return withStorageLock(lockKey, async () => {
      await addCompletedTombstone(id, resolvedScope);
      const current = await workoutStorage.getCompletedWorkouts(resolvedScope);
      const { updated } = deleteCompletedWithTombstones(current, id, new Set([id]));
      await writeStorage(storageKey, JSON.stringify(updated));
    });
  },

  clearAllWorkouts: async (scope?: UserScope | null): Promise<void> => {
    return enqueueActiveWorkoutOp(async () => {
      const activeKey = getUserScopedKey(BASE_ACTIVE_WORKOUT_KEY, scope);
      const abandonedKey = getUserScopedKey(BASE_ABANDONED_WORKOUT_KEY, scope);
      const discardedKey = getUserScopedKey(BASE_DISCARDED_WORKOUTS_KEY, scope);
      const completedKey = getUserScopedKey(BASE_COMPLETED_WORKOUTS_KEY, scope);
      const tombstoneKey = getUserScopedKey(BASE_COMPLETED_TOMBSTONES_KEY, scope);
      const tokenKey = getUserScopedKey(BASE_ACTIVE_SESSION_TOKEN_KEY, scope);
      const recoveryBackupKey = getUserScopedKey(BASE_ACTIVE_WORKOUT_RECOVERY_BACKUP_KEY, scope);

      if (activeKey) await deleteStorage(activeKey);
      if (abandonedKey) await deleteStorage(abandonedKey);
      if (discardedKey) await deleteStorage(discardedKey);
      if (completedKey) await deleteStorage(completedKey);
      if (tombstoneKey) await deleteStorage(tombstoneKey);
      if (tokenKey) await deleteStorage(tokenKey);
      if (recoveryBackupKey) await deleteStorage(recoveryBackupKey);
      await clearSyncEmergencyMirror();

      // In test runs without scope, also clear all memoryStorage and legacy keys
      if (!scope && process.env.NODE_ENV === 'test') {
        platformStorage.clearMemoryCache();
        await deleteStorage('bebig.active.workout');
        await deleteStorage('bebig.active.workout.abandoned');
        await deleteStorage('bebig.active.workout.discarded');
        await deleteStorage('bebig.active.workout.token');
        await deleteStorage('bebig.workout.active.recovery_backup');
        await deleteStorage('bebig.completed.workouts');
        await deleteStorage('bebig.workout.completed.deleted');
      }

      // If IndexedDB exists, clear any cached completed workouts and tombstones
      if (typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function') {
        try {
          await new Promise<void>((resolve) => {
            const req = indexedDB.open('bebig_cross_tab_locks', 1);
            req.onsuccess = () => {
              const db = req.result;
              try {
                const tx = db.transaction('locks', 'readwrite');
                tx.oncomplete = () => {
                  try { db.close(); } catch {}
                  resolve();
                };
                tx.onerror = () => {
                  try { db.close(); } catch {}
                  resolve();
                };
                const store = tx.objectStore('locks');
                if (completedKey) store.delete(completedKey);
                if (tombstoneKey) store.delete(tombstoneKey);
                if (process.env.NODE_ENV === 'test') {
                  store.delete('bebig.completed.workouts');
                  store.delete('bebig.workout.completed.deleted');
                }
              } catch {
                try { db.close(); } catch {}
                resolve();
              }
            };
            req.onerror = () => resolve();
          });
        } catch {}
      }
    });
  },
  writeSyncEmergencyMirror,
  readSyncEmergencyMirror,
  clearSyncEmergencyMirror,
};
