import { Platform } from 'react-native';
import { ExpoSecureStoreAdapter } from '../src/lib/supabase/storage';
import { idbStorage } from '../src/lib/storage/platformStorage';
import { useAuthStore } from '../src/features/auth/store/useAuthStore';
import { authService } from '../src/features/auth/services/authService';

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => {
    storageMap.set(key, String(val));
  },
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => {
    storageMap.clear();
  },
};

(globalThis as any).localStorage = mockLocalStorage;

describe('PWA Auth Persistence & Session Restoration', () => {
  const testKey = 'sb-testproject-auth-token';
  const testSession = JSON.stringify({
    access_token: 'valid_access_token_123',
    refresh_token: 'valid_refresh_token_456',
    user: { id: 'test-user-id', email: 'athlete@bebig.app' },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    Platform.OS = 'web';
  });

  it('1. ExpoSecureStoreAdapter dual-writes to localStorage and idbStorage on Web', async () => {
    const idbSetSpy = jest.spyOn(idbStorage, 'set').mockResolvedValue(undefined);
    jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);

    await ExpoSecureStoreAdapter.setItem(testKey, testSession);

    // Verify localStorage has the token
    expect(localStorage.getItem(testKey)).toBe(testSession);

    // Verify idbStorage was also called for durable storage
    expect(idbSetSpy).toHaveBeenCalledWith(testKey, testSession);
  });

  it('2. When localStorage is cleared (iOS standalone PWA cold launch), token is restored from idbStorage', async () => {
    jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);
    jest.spyOn(idbStorage, 'get').mockResolvedValue(testSession);

    // Ensure localStorage is empty (simulating iOS WebKit clearing or delaying localStorage)
    localStorage.removeItem(testKey);
    expect(localStorage.getItem(testKey)).toBeNull();

    const restoredValue = await ExpoSecureStoreAdapter.getItem(testKey);

    expect(restoredValue).toBe(testSession);
    // Verify localStorage was rehydrated for subsequent fast reads
    expect(localStorage.getItem(testKey)).toBe(testSession);
  });

  it('3. removeItem cleans both localStorage and idbStorage', async () => {
    const idbRemoveSpy = jest.spyOn(idbStorage, 'remove').mockResolvedValue(undefined);
    jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);

    localStorage.setItem(testKey, testSession);
    await ExpoSecureStoreAdapter.removeItem(testKey);

    expect(localStorage.getItem(testKey)).toBeNull();
    expect(idbRemoveSpy).toHaveBeenCalledWith(testKey);
  });

  it('4. useAuthStore handles INITIAL_SESSION event to restore authenticated session', () => {
    let authListener: ((event: string, session: any) => void) | null = null;
    jest.spyOn(authService, 'onAuthStateChange').mockImplementation((cb: any) => {
      authListener = cb;
      return { unsubscribe: jest.fn() };
    });

    // Reset store to unauthenticated
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      session: null,
      isGuest: false,
    });

    const mockSession = {
      user: { id: 'pwa-user-id', email: 'persisted@bebig.app' },
      accessToken: 'token-abc',
      refreshToken: 'refresh-xyz',
    };

    // Trigger auth initialization to attach listener
    void useAuthStore.getState().initializeAuth();

    if (authListener) {
      (authListener as any)('INITIAL_SESSION', mockSession);

      const state = useAuthStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user?.id).toBe('pwa-user-id');
      expect(state.session).toEqual(mockSession);
    }
  });
});
