import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { authService, useAuthStore } from '../src/features/auth';
import { getAuthRedirectUrl } from '../src/features/auth/utils/redirect';
import { profileService } from '../src/features/profile';
import { useOnboardingStore } from '../src/features/onboarding';
import { guestStorage } from '../src/lib/storage';
import RootIndex from '../app/index';
import HomeScreen from '../app/home';
import AuthCallbackScreen from '../app/auth/callback';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, any> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockSearchParams,
  useSegments: () => ['home'],
  useRootNavigationState: () => ({ key: 'root-nav-key' }),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: ({ href }: { href: string }) => {
    mockReplace(href);
    return null;
  },
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

// Mock expo-apple-authentication
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  signInAsync: jest.fn().mockResolvedValue({
    identityToken: 'mock-apple-identity-token',
  }),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn().mockResolvedValue({
    type: 'success',
    url: 'bebig://auth/callback#access_token=mock-google-token&refresh_token=mock-refresh',
  }),
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `bebig://${path}`),
  getInitialURL: jest.fn().mockResolvedValue(null),
}));

// Mock Supabase client
const mockAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signInWithIdToken: jest.fn(),
  signInWithOAuth: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  verifyOtp: jest.fn(),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  getSession: jest.fn(),
  setSession: jest.fn(),
  onAuthStateChange: jest.fn(),
};

const mockFrom = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: any[]) => mockAuth.signUp(...args),
      signInWithPassword: (...args: any[]) => mockAuth.signInWithPassword(...args),
      signInWithIdToken: (...args: any[]) => mockAuth.signInWithIdToken(...args),
      signInWithOAuth: (...args: any[]) => mockAuth.signInWithOAuth(...args),
      exchangeCodeForSession: (...args: any[]) => mockAuth.exchangeCodeForSession(...args),
      verifyOtp: (...args: any[]) => mockAuth.verifyOtp(...args),
      signOut: (...args: any[]) => mockAuth.signOut(...args),
      getSession: (...args: any[]) => mockAuth.getSession(...args),
      setSession: (...args: any[]) => mockAuth.setSession(...args),
      onAuthStateChange: (...args: any[]) => mockAuth.onAuthStateChange(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

describe('Checkpoint 3 — Web Auth & Routing Safety Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    profileService.clearMemoryCache();
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      session: null,
      guestSession: null,
      isGuest: false,
      isConfigured: true,
      error: null,
    });
    useOnboardingStore.getState().resetOnboarding();
  });

  // 1. Unauthenticated User Routing
  describe('1. Unauthenticated User Routing', () => {
    it('redirects unauthenticated user to /onboarding/welcome at startup', async () => {
      useAuthStore.setState({ status: 'unauthenticated' });

      await render(<RootIndex />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
      });
    });
  });

  // 2. Authenticated Completed User Routing
  describe('2. Authenticated Completed User Routing', () => {
    it('rehydrates profile into onboarding store and routes directly to /home', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'auth-user-completed', email: 'completed@bebig.app' },
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'auth-user-completed',
            goal: 'build_muscle',
            experience_level: 'intermediate',
            days_per_week: 4,
            workout_duration: '45_min',
            equipment: 'full_gym',
            workout_style: 'push_pull_legs',
            onboarding_completed: true,
          },
          error: null,
        }),
      });

      await render(<RootIndex />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/home');
        expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
        expect(useOnboardingStore.getState().goal).toBe('build_muscle');
        expect(useOnboardingStore.getState().daysPerWeek).toBe(4);
      });
    });
  });

  // 3. Authenticated Incomplete User Routing
  describe('3. Authenticated Incomplete User Routing', () => {
    it('routes authenticated user with incomplete onboarding to /onboarding/goal', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'auth-user-new', email: 'newbie@bebig.app' },
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: null,
          error: null,
        }),
      });

      await render(<RootIndex />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/onboarding/goal');
        expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
      });
    });
  });

  // 4. Guest Route Behavior
  describe('4. Guest Route Behavior', () => {
    it('routes completed guest session directly to /home', async () => {
      await guestStorage.setGuestSession({
        id: 'guest_test_completed',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });
      await guestStorage.saveOnboardingData({
        goal: 'gain_strength',
        experienceLevel: 'advanced',
        daysPerWeek: 5,
        workoutDuration: '60_min',
        trainingLocation: 'gym',
        equipment: 'full_gym',
        preferredTrainingDays: ['monday'],
        workoutStyle: 'upper_lower',
        hasCompletedOnboarding: true,
      });

      useAuthStore.setState({
        status: 'guest',
        isGuest: true,
        guestSession: {
          id: 'guest_test_completed',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
      });

      await render(<RootIndex />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/home');
      });
    });

    it('routes incomplete guest to /onboarding/welcome', async () => {
      await guestStorage.clearGuestSession();
      await guestStorage.clearOnboardingData();

      useAuthStore.setState({
        status: 'guest',
        isGuest: true,
        guestSession: {
          id: 'guest_test_incomplete',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
      });

      await render(<RootIndex />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
      });
    });
  });

  // 5. Premature Redirection Prevention
  describe('5. Auth Initialization & Redirection Timing', () => {
    it('renders startup splash and does not redirect while auth initialization is in flight', async () => {
      useAuthStore.setState({ status: 'initializing' });

      // Stalled initialization
      jest.spyOn(useAuthStore.getState(), 'initializeAuth').mockImplementation(async () => {});

      const screen = await render(<RootIndex />);
      expect(screen.getByTestId('auth-loading-indicator')).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // 6. Sign Out & Cache Clearing
  describe('6. Sign Out & Cache Clearance', () => {
    it('clears authenticated store state and invokes Supabase signOut', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'authed-logout', email: 'logout@bebig.app' },
        session: { accessToken: 'tok-out', user: { id: 'authed-logout', email: 'logout@bebig.app' } },
      });

      await useAuthStore.getState().signOut();

      expect(mockAuth.signOut).toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().session).toBeNull();
    });
  });

  // 7. Account-Switch Race Safety
  describe('7. Account-Switch Race Safety', () => {
    it('prevents stale User A async initialization from overwriting User B session', async () => {
      let resolveUserASession: (val: any) => void;
      const userAPromise = new Promise((resolve) => {
        resolveUserASession = resolve;
      });

      // Mock getSession to return a stalled User A promise
      mockAuth.getSession.mockImplementationOnce(() => userAPromise);
      mockAuth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      // User A initiates initialization
      const initPromise = useAuthStore.getState().initializeAuth();

      // Concurrently, User B logs in before User A resolves
      const userBSession = {
        accessToken: 'user-b-token',
        user: { id: 'user-b-id', email: 'userb@bebig.app' },
      };
      useAuthStore.getState().setSession(userBSession);

      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(useAuthStore.getState().user?.id).toBe('user-b-id');

      // Now User A's slow promise finally resolves with User A's session
      await act(async () => {
        resolveUserASession!({
          data: {
            session: {
              access_token: 'user-a-stale-token',
              user: { id: 'user-a-id', email: 'usera@bebig.app' },
            },
          },
        });
        await initPromise;
      });

      // User B's state must NOT have been overwritten by User A's stale result!
      expect(useAuthStore.getState().user?.id).toBe('user-b-id');
      expect(useAuthStore.getState().user?.email).toBe('userb@bebig.app');
      expect(useAuthStore.getState().session?.accessToken).toBe('user-b-token');
    });
  });

  // 8. Redirect URL Generation
  describe('8. Redirect URL Generation', () => {
    it('derives URL from window.location.origin when Platform.OS is web', () => {
      const originalPlatform = Platform.OS;
      const originalWindow = (globalThis as any).window;

      try {
        (Platform as any).OS = 'web';
        (globalThis as any).window = { location: { origin: 'https://bebig.fitness' } };

        const url = getAuthRedirectUrl();
        expect(url).toBe('https://bebig.fitness/auth/callback');
      } finally {
        (Platform as any).OS = originalPlatform;
        (globalThis as any).window = originalWindow;
      }
    });

    it('returns native deep-link URI on mobile platforms', () => {
      const originalPlatform = Platform.OS;
      try {
        (Platform as any).OS = 'ios';
        const url = getAuthRedirectUrl();
        expect(url).toBe('bebig://auth/callback');
      } finally {
        (Platform as any).OS = originalPlatform;
      }
    });
  });

  // 9. Web OAuth Redirects
  describe('9. Web Google & Apple OAuth Redirection', () => {
    it('performs browser window redirect for Google OAuth on web', async () => {
      const originalPlatform = Platform.OS;
      const originalWindow = (globalThis as any).window;
      const mockAssign = jest.fn();

      try {
        (Platform as any).OS = 'web';
        (globalThis as any).window = {
          location: { origin: 'https://bebig.app', assign: mockAssign },
        };

        mockAuth.signInWithOAuth.mockResolvedValueOnce({
          data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=123' },
          error: null,
        });

        const result = await authService.signInWithGoogle();

        expect(result.success).toBe(true);
        expect(result.message).toContain('Redirecting to Google');
        expect(mockAssign).toHaveBeenCalledWith(
          'https://accounts.google.com/o/oauth2/v2/auth?client_id=123',
        );
      } finally {
        (Platform as any).OS = originalPlatform;
        (globalThis as any).window = originalWindow;
      }
    });

    it('performs browser window redirect for Apple OAuth on web', async () => {
      const originalPlatform = Platform.OS;
      const originalWindow = (globalThis as any).window;
      const mockAssign = jest.fn();

      try {
        (Platform as any).OS = 'web';
        (globalThis as any).window = {
          location: { origin: 'https://bebig.app', assign: mockAssign },
        };

        mockAuth.signInWithOAuth.mockResolvedValueOnce({
          data: { url: 'https://appleid.apple.com/auth/authorize?client_id=apple_bebig' },
          error: null,
        });

        const result = await authService.signInWithApple();

        expect(result.success).toBe(true);
        expect(result.message).toContain('Redirecting to Apple');
        expect(mockAssign).toHaveBeenCalledWith(
          'https://appleid.apple.com/auth/authorize?client_id=apple_bebig',
        );
      } finally {
        (Platform as any).OS = originalPlatform;
        (globalThis as any).window = originalWindow;
      }
    });
  });

  // 10. Auth Callback Screen Handling
  describe('10. Auth Callback Screen Handling', () => {
    it('exchanges code for session and routes completed user to /home', async () => {
      mockSearchParams = { code: 'auth-code-123' };

      mockAuth.exchangeCodeForSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'new-cb-token',
            user: { id: 'cb-user-1', email: 'cb@bebig.app' },
          },
        },
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: { id: 'cb-user-1', onboarding_completed: true, goal: 'build_muscle' },
          error: null,
        }),
      });

      await render(<AuthCallbackScreen />);

      await waitFor(() => {
        expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code-123');
        expect(useAuthStore.getState().status).toBe('authenticated');
        expect(mockReplace).toHaveBeenCalledWith('/home');
      });
    });

    it('displays error card and Return to Sign In button if callback URL contains error', async () => {
      mockSearchParams = {
        error: 'server_error',
        error_description: 'Token has expired',
      };

      const { getByTestId, getByText } = await render(<AuthCallbackScreen />);

      await waitFor(() => {
        expect(getByTestId('callback-error-card')).toBeTruthy();
        expect(getByText(/Token has expired/i)).toBeTruthy();
      });

      fireEvent.press(getByTestId('callback-signin-button'));
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/auth');
    });
  });

  // 11. Direct Navigation & Refresh Rehydration on /home
  describe('11. Direct Navigation & Refresh Profile Rehydration on /home', () => {
    it('rehydrates profile from Supabase on /home mount if onboarding store is empty', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'refresh-user', email: 'refresh@bebig.app' },
      });
      useOnboardingStore.getState().resetOnboarding();
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'refresh-user',
            goal: 'gain_strength',
            experience_level: 'advanced',
            days_per_week: 5,
            onboarding_completed: true,
          },
          error: null,
        }),
      });

      await render(<HomeScreen />);

      await waitFor(() => {
        expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
        expect(useOnboardingStore.getState().goal).toBe('gain_strength');
        expect(useOnboardingStore.getState().daysPerWeek).toBe(5);
      });
    });
  });
});
