import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * In-memory fallback for environments where SecureStore is unavailable
 * (e.g., SSR, Jest without native mocks, or headless web).
 */
const memoryStorage = new Map<string, string>();

/**
 * Custom storage adapter for Supabase Auth using Expo SecureStore.
 * SecureStore encrypts values using the Keychain on iOS and KeyStore on Android.
 */
export const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
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
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
          return;
        }
        memoryStorage.set(key, value);
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
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
          return;
        }
        memoryStorage.delete(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      memoryStorage.delete(key);
    }
  },
};
