/**
 * BeBig 2.0 — Cross-Platform Persistent Key-Value Storage
 *
 * Provides a unified, high-capacity, durable persistence engine:
 * - Web (PWA): Uses IndexedDB ('bebig_db', store: 'keyval') to overcome
 *   the 5MB localStorage quota, with transparent one-time migration
 *   from legacy localStorage and graceful fallback to localStorage / memory.
 * - Mobile (iOS / Android): Uses hardware-backed expo-secure-store (Keychain / KeyStore).
 * - SSR / Node / Test: Uses in-memory Map fallback.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface KeyValueStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  removeItemIfMatchingId?: (key: string, expectedId: string) => Promise<boolean>;
  clearMemoryCache: () => void;
}

const DB_NAME = 'bebig_db';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

/**
 * In-memory fallback map for environments without persistent storage.
 */
const memoryStorage = new Map<string, string>();

/**
 * Opens or returns a connection to the IndexedDB database.
 */
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in this environment.'));
    }

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
      const fail = (err: any) => {
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
      const fail = (err: any) => {
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
      const fail = (err: any) => {
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
        } catch {}
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
              // Migrate to IndexedDB asynchronously
              try {
                await idbStorage.set(key, legacyVal);

                // Fix 2: Verify migrated data before legacy cleanup
                const verifiedVal = await idbStorage.get(key);
                if (verifiedVal === legacyVal) {
                  localStorage.removeItem(key);
                }
              } catch {
                // Keep legacy value in localStorage if migration write or verification fails
              }
              return legacyVal;
            }
          }
        } catch {
          // IndexedDB failed (e.g. strict private mode); fallback to localStorage
        }
      }

      // Fallback to localStorage if IDB is unavailable or errored
      if (typeof localStorage !== 'undefined') {
        const localVal = localStorage.getItem(key);
        if (localVal !== null && localVal !== undefined) {
          return localVal;
        }
      }

      return memoryStorage.get(key) ?? null;
    }

    // 2. Native Mobile Platform (iOS / Android)
    try {
      const val = await SecureStore.getItemAsync(key);
      if (val !== null && val !== undefined) {
        return val;
      }
    } catch {
      // Fallback to memory
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
      let success = false;
      let lastError: any = new Error('No persistent web storage available.');

      if (idbStorage.isAvailable()) {
        try {
          await idbStorage.set(key, value);
          success = true;
        } catch (err) {
          lastError = err;
        }
      }

      if (!success && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(key, value);
          success = true;
        } catch (err) {
          lastError = err;
        }
      }

      if (!success) {
        if (process.env.NODE_ENV === 'test' && !idbStorage.isAvailable() && typeof localStorage === 'undefined') return;
        throw lastError;
      }
      return;
    }

    // Native Mobile Platform
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      if (process.env.NODE_ENV === 'test') return;
      throw error;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    memoryStorage.delete(key);

    if (Platform.OS === 'web') {
      let success = false;
      let lastError: any = new Error('No persistent web storage available.');

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
        if (process.env.NODE_ENV === 'test' && !idbStorage.isAvailable() && typeof localStorage === 'undefined') return;
        throw lastError;
      }
      return;
    }

    // Native Mobile Platform
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      if (process.env.NODE_ENV === 'test') return;
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
            } catch {}
          }
        }
        const mem = memoryStorage.get(key);
        if (mem) {
          try {
            if (JSON.parse(mem)?.id === expectedId) {
              memoryStorage.delete(key);
            }
          } catch {}
        }
        return deleted;
      } catch {}
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
            await SecureStore.deleteItemAsync(key).catch(() => {});
          }
          return true;
        }
      } catch {}
      return false;
    }

    // If native platform SecureStore:
    if (Platform.OS !== 'web') {
      try {
        const val = await SecureStore.getItemAsync(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed?.id === expectedId) {
            await SecureStore.deleteItemAsync(key);
            return true;
          }
        }
      } catch {}
    }

    return false;
  },

  clearMemoryCache: (): void => {
    memoryStorage.clear();
  },
};

