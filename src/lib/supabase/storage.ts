import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { idbStorage } from '../storage/platformStorage';

/**
 * In-memory fallback for environments where SecureStore is unavailable
 * (e.g., SSR, Jest without native mocks, or headless web).
 */
const memoryStorage = new Map<string, string>();

/**
 * Custom storage adapter for Supabase Auth.
 * - Mobile (iOS / Android): SecureStore encrypts values using the Keychain on iOS and KeyStore on Android.
 * - Web / Installed PWA: Dual-write to window.localStorage AND IndexedDB ('bebig_db').
 *   On iOS standalone WebClips, localStorage can be evicted, partitioned, or delayed on cold start.
 *   IndexedDB provides durable ACID persistence so sessions survive app restarts, swipes, and cold launches.
 */
export const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        // 1. Check synchronous / fast localStorage first
        let localVal: string | null = null;
        if (typeof localStorage !== 'undefined') {
          try {
            localVal = localStorage.getItem(key);
          } catch {
            // LocalStorage access error
          }
        }

        if (localVal !== null && localVal !== undefined && localVal !== '') {
          // Mirror back to IndexedDB asynchronously to ensure it remains populated
          if (idbStorage.isAvailable()) {
            idbStorage.set(key, localVal).catch(() => {});
          }
          return localVal;
        }

        // 2. Fallback to durable IndexedDB (e.g. iOS WebKit standalone PWA cold launch after process reap)
        if (idbStorage.isAvailable()) {
          try {
            const idbVal = await idbStorage.get(key);
            if (idbVal !== null && idbVal !== undefined && idbVal !== '') {
              // Rehydrate localStorage so subsequent synchronous lookups succeed immediately
              if (typeof localStorage !== 'undefined') {
                try {
                  localStorage.setItem(key, idbVal);
                } catch {}
              }
              return idbVal;
            }
          } catch {
            // IDB read error
          }
        }

        return memoryStorage.get(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        memoryStorage.set(key, value);

        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(key, value);
          } catch {
            // LocalStorage quota or access error
          }
        }

        if (idbStorage.isAvailable()) {
          try {
            await idbStorage.set(key, value);
          } catch {
            // IDB write error
          }
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        memoryStorage.delete(key);

        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.removeItem(key);
          } catch {}
        }

        if (idbStorage.isAvailable()) {
          try {
            await idbStorage.remove(key);
          } catch {}
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      memoryStorage.delete(key);
    }
  },
};
