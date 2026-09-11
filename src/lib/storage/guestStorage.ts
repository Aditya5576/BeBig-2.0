import { GuestSession } from '../../features/auth/types';
import { OnboardingState } from '../../features/onboarding/types';
import { platformStorage } from './platformStorage';

const STORAGE_KEYS = {
  GUEST_SESSION: 'bebig.guest.session',
  GUEST_ONBOARDING: 'bebig.guest.onboarding',
} as const;

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
