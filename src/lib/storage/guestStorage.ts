import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { GuestSession } from '../../features/auth/types';
import { OnboardingState } from '../../features/onboarding/types';

const STORAGE_KEYS = {
  GUEST_SESSION: 'bebig.guest.session',
  GUEST_ONBOARDING: 'bebig.guest.onboarding',
} as const;

/**
 * In-memory fallback for environments where native SecureStore is unavailable
 * (e.g. Jest tests, SSR, or headless web).
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
    // memoryStorage already populated
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
    // memoryStorage already cleared
  }
};

/**
 * Clean typed abstraction for local guest session & onboarding persistence.
 * Isolates all local device storage from volatile store memory.
 */
export const guestStorage = {
  getGuestSession: async (): Promise<GuestSession | null> => {
    try {
      const raw = await readStorage(STORAGE_KEYS.GUEST_SESSION);
      if (!raw) return null;
      return JSON.parse(raw) as GuestSession;
    } catch {
      return null;
    }
  },

  setGuestSession: async (session: GuestSession): Promise<void> => {
    try {
      await writeStorage(STORAGE_KEYS.GUEST_SESSION, JSON.stringify(session));
    } catch {
      // Handled in writeStorage
    }
  },

  clearGuestSession: async (): Promise<void> => {
    try {
      await deleteStorage(STORAGE_KEYS.GUEST_SESSION);
    } catch {
      // Silently handled
    }
  },

  getOnboardingData: async (): Promise<OnboardingState | null> => {
    try {
      const raw = await readStorage(STORAGE_KEYS.GUEST_ONBOARDING);
      if (!raw) return null;
      return JSON.parse(raw) as OnboardingState;
    } catch {
      return null;
    }
  },

  saveOnboardingData: async (data: OnboardingState): Promise<void> => {
    try {
      await writeStorage(STORAGE_KEYS.GUEST_ONBOARDING, JSON.stringify(data));
    } catch {
      // Handled in writeStorage
    }
  },

  clearOnboardingData: async (): Promise<void> => {
    try {
      await deleteStorage(STORAGE_KEYS.GUEST_ONBOARDING);
    } catch {
      // Silently handled
    }
  },

  wipeAllGuestData: async (): Promise<void> => {
    await guestStorage.clearGuestSession();
    await guestStorage.clearOnboardingData();
  },
};
