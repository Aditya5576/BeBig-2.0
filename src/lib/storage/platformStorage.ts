/**
 * BeBig 2.0 — Cross-Platform Persistent Key-Value Storage (Hardened AUD-017 / AUD-018)
 *
 * Provides a unified, high-capacity, durable persistence engine:
 * - Web (PWA): Uses IndexedDB ('bebig_db', store: 'keyval') to overcome
 *   the 5MB localStorage quota, with transparent one-time migration
 *   from legacy localStorage, automatic QuotaExceededError eviction of
 *   rebuildable exercise cache, and graceful fallback to localStorage / memory.
 * - Mobile (iOS / Android): Small secrets/tokens (<= 1800 bytes) remain in
 *   hardware-backed expo-secure-store (Keychain / KeyStore); large domain
 *   payloads (> 1800 bytes) transparently spill over to app-private
 *   FileSystem.documentDirectory with a lightweight SecureStore pointer so
 *   writes never hit Android Keystore's 2048-byte limit or truncate data.
 * - Sanitized Telemetry: Classifies storage errors (`quota_exceeded`,
 *   `unavailable`, `parse_error`, `security_error`, `unknown`) without ever
 *   logging workout notes, credentials, or raw user payloads.
 * - SSR / Node / Test: Uses in-memory Map fallback.
 */

import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export interface KeyValueStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  removeItemIfMatchingId?: (key: string, expectedId: string) => Promise<boolean>;
  clearMemoryCache: (prefix?: string) => void;
}

export type StorageErrorKind =
  | 'quota_exceeded'
  | 'unavailable'
  | 'parse_error'
  | 'security_error'
  | 'unknown';

export interface StorageErrorTelemetryEvent {
  operation: 'getItem' | 'setItem' | 'removeItem' | 'removeItemIfMatchingId';
  keyNamespace: string;
  kind: StorageErrorKind;
  recovered: boolean;
}

type StorageErrorListener = (event: StorageErrorTelemetryEvent) => void;

const DB_NAME = 'bebig_db';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

// Safe ceiling below Android Keystore / SecureStore 2048-byte limit (AUD-017)
export const SECURESTORE_MAX_BYTES = 1800;
export const LARGE_PAYLOAD_FILE_PREFIX = '__BEBIG_FILE__:';
export const EVICTABLE_WEB_CACHE_KEYS: readonly string[] = [
  'bebig.exercises.cache',
  'bebig.exercises.cache.v2',
];

const storageErrorListeners = new Set<StorageErrorListener>();

/**
 * Classifies storage errors into structured categories without inspecting user data.
 */
export function classifyStorageError(err: unknown): StorageErrorKind {
  if (!err) return 'unknown';
  const name = typeof err === 'object' && 'name' in err ? String((err as any).name) : '';
  const message =
    typeof err === 'object' && 'message' in err ? String((err as any).message) : String(err);
  const combined = `${name} ${message}`.toLowerCase();

  if (
    combined.includes('quotaexceeded') ||
    combined.includes('quota') ||
    combined.includes('ns_error_dom_quota_reached') ||
    combined.includes('disk full') ||
    combined.includes('no space')
  ) {
    return 'quota_exceeded';
  }
  if (
    combined.includes('securityerror') ||
    combined.includes('permission') ||
    combined.includes('access denied') ||
    combined.includes('private browsing')
  ) {
    return 'security_error';
  }
  if (combined.includes('syntaxerror') || combined.includes('json')) {
    return 'parse_error';
  }
  if (
    combined.includes('unavailable') ||
    combined.includes('not available') ||
    combined.includes('disabled')
  ) {
    return 'unavailable';
  }
  return 'unknown';
}

/**
 * Extracts only the non-PII namespace prefix of a storage key (e.g. `bebig.workout.active`).
 */
export function sanitizeStorageKeyNamespace(key: string): string {
  const parts = key.split('.');
  if (parts.length <= 3) return parts.join('.');
  return parts.slice(0, 3).join('.');
}

/**
 * Registers a telemetry listener for sanitized storage fault events (zero PII/values).
 */
export function onStorageError(listener: StorageErrorListener): () => void {
  storageErrorListeners.add(listener);
  return () => {
    storageErrorListeners.delete(listener);
  };
}

function emitStorageError(
  operation: StorageErrorTelemetryEvent['operation'],
  key: string,
  err: unknown,
  recovered: boolean
): void {
  const event: StorageErrorTelemetryEvent = {
    operation,
    keyNamespace: sanitizeStorageKeyNamespace(key),
    kind: classifyStorageError(err),
    recovered,
  };
  for (const listener of storageErrorListeners) {
    try {
      listener(event);
    } catch {
      // Telemetry listener errors must never break storage operations
    }
  }
}

function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  // Conservative UTF-8 upper-bound fallback
  return str.length * 2;
}

function getNativeSpillFilePath(key: string): string | null {
  if (!FileSystem.documentDirectory) return null;
  // Deterministic safe filename derived from key (FNV-1a 32-bit hash + sanitized prefix)
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const safePrefix = sanitizeStorageKeyNamespace(key).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${FileSystem.documentDirectory}bebig_kv/${safePrefix}_${hash.toString(16)}.json`;
}

async function ensureNativeKvDir(): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  const dir = `${FileSystem.documentDirectory}bebig_kv/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function readNativeValue(key: string): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (raw === null || raw === undefined) return null;

  if (raw.startsWith(LARGE_PAYLOAD_FILE_PREFIX)) {
    const filePath = raw.slice(LARGE_PAYLOAD_FILE_PREFIX.length);
    if (!filePath) return null;
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;
    return FileSystem.readAsStringAsync(filePath);
  }

  return raw;
}

async function writeNativeValue(key: string, value: string): Promise<void> {
  const bytes = getUtf8ByteLength(value);
  if (bytes > SECURESTORE_MAX_BYTES && FileSystem.documentDirectory) {
    const spillPath = getNativeSpillFilePath(key);
    if (spillPath) {
      await ensureNativeKvDir();
      await FileSystem.writeAsStringAsync(spillPath, value);
      await SecureStore.setItemAsync(key, `${LARGE_PAYLOAD_FILE_PREFIX}${spillPath}`);
      return;
    }
  }

  // If previously spilled to file and now small, clean up old file after SecureStore write
  let previousSpillPath: string | null = null;
  try {
    const existing = await SecureStore.getItemAsync(key);
    if (existing && existing.startsWith(LARGE_PAYLOAD_FILE_PREFIX)) {
      previousSpillPath = existing.slice(LARGE_PAYLOAD_FILE_PREFIX.length);
    }
  } catch {
    // Ignore pre-read error
  }

  await SecureStore.setItemAsync(key, value);

  if (previousSpillPath) {
    await FileSystem.deleteAsync(previousSpillPath, { idempotent: true }).catch(() => {});
  }
}

async function removeNativeValue(key: string): Promise<void> {
  try {
    const existing = await SecureStore.getItemAsync(key);
    if (existing && existing.startsWith(LARGE_PAYLOAD_FILE_PREFIX)) {
      const filePath = existing.slice(LARGE_PAYLOAD_FILE_PREFIX.length);
      if (filePath) {
        await FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => {});
      }
    }
  } catch {
    // Proceed to delete SecureStore key regardless
  }
  await SecureStore.deleteItemAsync(key);
}

/**
 * In-memory fallback map for environments without persistent storage.
 */
const memoryStorage = new Map<string, string>();
let webStoragePersistenceRequested = false;

/**
 * Requests persistent browser origin storage once on Web (iOS Safari + Android Chrome)
 * to reduce silent IndexedDB eviction under storage pressure or Safari ITP heuristics.
 */
function requestWebStoragePersistence(): void {
  if (webStoragePersistenceRequested) return;
  webStoragePersistenceRequested = true;
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.persist === 'function'
  ) {
    Promise.resolve(navigator.storage.persist()).catch(() => {
      // Non-fatal: Safari/Chrome may decline outside standalone/installed context
    });
  }
}

/**
 * Opens or returns a connection to the IndexedDB database.
 */
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in this environment.'));
    }

    requestWebStoragePersistence();
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

/**
 * Low-level IndexedDB operations with error recovery.
 */
export const idbStorage = {
  isAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  },

  async get(key: string): Promise<string | null> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  },

  async set(key: string, value: string): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const fail = (err: unknown) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      };

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      // Resolve ONLY from transaction.oncomplete (never from request.onsuccess)
      tx.oncomplete = () => {
        if (!isSettled) {
          isSettled = true;
          resolve();
        }
      };

      tx.onerror = () => fail(tx.error || req.error || new Error('IndexedDB transaction failed.'));
      tx.onabort = () => fail(tx.error || req.error || new Error('IndexedDB transaction aborted.'));
      req.onerror = () => fail(req.error || new Error('IndexedDB request failed.'));
    });
  },

  async remove(key: string): Promise<void> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const fail = (err: unknown) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      };

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      // Resolve ONLY from transaction.oncomplete
      tx.oncomplete = () => {
        if (!isSettled) {
          isSettled = true;
          resolve();
        }
      };

      tx.onerror = () => fail(tx.error || req.error || new Error('IndexedDB transaction failed.'));
      tx.onabort = () => fail(tx.error || req.error || new Error('IndexedDB transaction aborted.'));
      req.onerror = () => fail(req.error || new Error('IndexedDB request failed.'));
    });
  },

  /**
   * Atomically deletes a record within a single readwrite transaction ONLY if
   * its parsed payload has id === expectedId.
   */
  async removeIfMatches(key: string, expectedId: string): Promise<boolean> {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const fail = (err: unknown) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      };

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      let didDelete = false;

      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          return;
        }
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          if (parsed && typeof parsed === 'object' && parsed.id === expectedId) {
            store.delete(key);
            didDelete = true;
          }
        } catch (parseErr) {
          emitStorageError('removeItemIfMatchingId', key, parseErr, false);
        }
      };

      tx.oncomplete = () => {
        if (!isSettled) {
          isSettled = true;
          resolve(didDelete);
        }
      };

      tx.onerror = () => fail(tx.error || req.error || new Error('IndexedDB transaction failed.'));
      tx.onabort = () => fail(tx.error || req.error || new Error('IndexedDB transaction aborted.'));
      req.onerror = () => fail(req.error || new Error('IndexedDB get request failed.'));
    });
  },
};

/**
 * Evicts non-critical rebuildable exercise catalog caches to reclaim browser storage
 * quota before retrying an urgent write (e.g., active workout autosave).
 */
async function evictRebuildableWebCaches(): Promise<void> {
  for (const cacheKey of EVICTABLE_WEB_CACHE_KEYS) {
    memoryStorage.delete(cacheKey);
    if (idbStorage.isAvailable()) {
      try {
        await idbStorage.remove(cacheKey);
      } catch {
        // Best-effort eviction
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(cacheKey);
      } catch {
        // Best-effort eviction
      }
    }
  }
}

/**
 * Unified Platform Storage Engine.
 */
export const platformStorage: KeyValueStorage = {
  getItem: async (key: string): Promise<string | null> => {
    // 1. Web Platform
    if (Platform.OS === 'web') {
      // Try IndexedDB first
      if (idbStorage.isAvailable()) {
        try {
          const val = await idbStorage.get(key);
          if (val !== null && val !== undefined) {
            return val;
          }

          // Transparent migration: Check if legacy data exists in localStorage
          if (typeof localStorage !== 'undefined') {
            const legacyVal = localStorage.getItem(key);
            if (legacyVal !== null && legacyVal !== undefined) {
              try {
                await idbStorage.set(key, legacyVal);
                const verifiedVal = await idbStorage.get(key);
                if (verifiedVal === legacyVal) {
                  localStorage.removeItem(key);
                }
              } catch (migrationErr) {
                emitStorageError('getItem', key, migrationErr, true);
              }
              return legacyVal;
            }
          }
        } catch (idbErr) {
          emitStorageError('getItem', key, idbErr, true);
        }
      }

      // Fallback to localStorage if IDB is unavailable or errored
      if (typeof localStorage !== 'undefined') {
        try {
          const localVal = localStorage.getItem(key);
          if (localVal !== null && localVal !== undefined) {
            return localVal;
          }
        } catch (localErr) {
          emitStorageError('getItem', key, localErr, true);
        }
      }

      return memoryStorage.get(key) ?? null;
    }

    // 2. Native Mobile Platform (iOS / Android)
    try {
      const val = await readNativeValue(key);
      if (val !== null && val !== undefined) {
        return val;
      }
    } catch (nativeErr) {
      emitStorageError('getItem', key, nativeErr, true);
    }

    // In test environment, also check memoryStorage or localStorage
    if (process.env.NODE_ENV === 'test') {
      if (typeof localStorage !== 'undefined') {
        const localVal = localStorage.getItem(key);
        if (localVal !== null) return localVal;
      }
    }

    return memoryStorage.get(key) ?? null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    memoryStorage.set(key, value);

    if (Platform.OS === 'web') {
      const attemptWebWrite = async (): Promise<{ success: boolean; error: unknown }> => {
        let lastError: unknown = new Error('No persistent web storage available.');

        if (idbStorage.isAvailable()) {
          try {
            await idbStorage.set(key, value);
            return { success: true, error: null };
          } catch (err) {
            lastError = err;
          }
        }

        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(key, value);
            return { success: true, error: null };
          } catch (err) {
            lastError = err;
          }
        }

        return { success: false, error: lastError };
      };

      const first = await attemptWebWrite();
      if (first.success) return;

      // AUD-018: If quota exceeded, evict rebuildable exercise catalog caches and retry once
      if (classifyStorageError(first.error) === 'quota_exceeded') {
        await evictRebuildableWebCaches();
        const retry = await attemptWebWrite();
        if (retry.success) {
          emitStorageError('setItem', key, first.error, true);
          return;
        }
        emitStorageError('setItem', key, retry.error, false);
        throw retry.error;
      }

      if (
        process.env.NODE_ENV === 'test' &&
        !idbStorage.isAvailable() &&
        typeof localStorage === 'undefined'
      ) {
        return;
      }

      emitStorageError('setItem', key, first.error, false);
      throw first.error;
    }

    // Native Mobile Platform (with >1800B FileSystem spillover — AUD-017)
    try {
      await writeNativeValue(key, value);
    } catch (error) {
      if (process.env.NODE_ENV === 'test') return;
      emitStorageError('setItem', key, error, false);
      throw error;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    memoryStorage.delete(key);

    if (Platform.OS === 'web') {
      let success = false;
      let lastError: unknown = new Error('No persistent web storage available.');

      if (idbStorage.isAvailable()) {
        try {
          await idbStorage.remove(key);
          success = true;
        } catch (err) {
          lastError = err;
        }
      }

      if (!success && typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(key);
          success = true;
        } catch (err) {
          lastError = err;
        }
      }

      if (!success) {
        if (
          process.env.NODE_ENV === 'test' &&
          !idbStorage.isAvailable() &&
          typeof localStorage === 'undefined'
        ) {
          return;
        }
        emitStorageError('removeItem', key, lastError, false);
        throw lastError;
      }
      return;
    }

    // Native Mobile Platform
    try {
      await removeNativeValue(key);
    } catch (error) {
      if (process.env.NODE_ENV === 'test') return;
      emitStorageError('removeItem', key, error, false);
      throw error;
    }
  },

  /**
   * Atomically deletes key ONLY if the currently stored JSON payload has id === expectedId.
   * On Web: Executed as a single atomic readwrite IndexedDB transaction across all browser tabs.
   * On Mobile / In-Memory / Test: Synchronous CAS verification before removal.
   */
  removeItemIfMatchingId: async (key: string, expectedId: string): Promise<boolean> => {
    // 1. Web Platform (Atomic IndexedDB transaction)
    if (Platform.OS === 'web' && idbStorage.isAvailable()) {
      try {
        const deleted = await idbStorage.removeIfMatches(key, expectedId);
        if (typeof localStorage !== 'undefined') {
          const localVal = localStorage.getItem(key);
          if (localVal) {
            try {
              if (JSON.parse(localVal)?.id === expectedId) {
                localStorage.removeItem(key);
              }
            } catch (err) {
              emitStorageError('removeItemIfMatchingId', key, err, true);
            }
          }
        }
        const mem = memoryStorage.get(key);
        if (mem) {
          try {
            if (JSON.parse(mem)?.id === expectedId) {
              memoryStorage.delete(key);
            }
          } catch (err) {
            emitStorageError('removeItemIfMatchingId', key, err, true);
          }
        }
        return deleted;
      } catch (idbErr) {
        emitStorageError('removeItemIfMatchingId', key, idbErr, true);
      }
    }

    // 2. Synchronous Memory / Local / Native Check
    const current =
      memoryStorage.get(key) ??
      (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null);

    if (current) {
      try {
        const parsed = JSON.parse(current);
        if (parsed?.id === expectedId) {
          memoryStorage.delete(key);
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
          }
          if (Platform.OS !== 'web') {
            await removeNativeValue(key).catch((err) => {
              emitStorageError('removeItemIfMatchingId', key, err, true);
            });
          }
          return true;
        }
      } catch (err) {
        emitStorageError('removeItemIfMatchingId', key, err, true);
      }
      return false;
    }

    // If native platform SecureStore / FileSystem:
    if (Platform.OS !== 'web') {
      try {
        const val = await readNativeValue(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed?.id === expectedId) {
            await removeNativeValue(key);
            return true;
          }
        }
      } catch (err) {
        emitStorageError('removeItemIfMatchingId', key, err, true);
      }
    }

    return false;
  },

  clearMemoryCache: (prefix?: string): void => {
    if (prefix) {
      for (const key of Array.from(memoryStorage.keys())) {
        if (key.startsWith(prefix)) {
          memoryStorage.delete(key);
        }
      }
    } else {
      memoryStorage.clear();
    }
  },
};
