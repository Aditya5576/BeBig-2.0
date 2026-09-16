import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { authService, useAuthStore } from '../src/features/auth';
import { getAuthRedirectUrl } from '../src/features/auth/utils/redirect';
import { profileService } from '../src/features/profile';
import { useOnboardingStore } from '../src/features/onboarding';
import RootIndex from '../app/index';
import HomeScreen from '../app/home';
import AuthScreen from '../app/onboarding/auth';
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
  signOut: jest.fn(),
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

describe('Milestone 3 — Authentication & Supabase Foundation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    profileService.clearMemoryCache();
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      session: null,
      isConfigured: true,
      error: null,
    });
    useOnboardingStore.getState().resetOnboarding();
  });

  // 1 & 4: Session Restoration & Store Initialization
  describe('Session Restoration & Auth Store', () => {
    it('restores authenticated session on app initialization', async () => {
      mockAuth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'valid-token',
            refresh_token: 'valid-refresh',
            user: { id: 'user-123', email: 'athlete@bebig.app', created_at: '2026-09-03' },
          },
        },
      });

      mockAuth.onAuthStateChange.mockReturnValueOnce({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      await useAuthStore.getState().initializeAuth();

      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(useAuthStore.getState().user?.email).toBe('athlete@bebig.app');
      expect(useAuthStore.getState().session?.accessToken).toBe('valid-token');
    });

    it('sets unauthenticated state when no session exists', async () => {
      mockAuth.getSession.mockResolvedValueOnce({
        data: { session: null },
      });

      mockAuth.onAuthStateChange.mockReturnValueOnce({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      await useAuthStore.getState().initializeAuth();

      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // Redirect URL Generation
  describe('Deep-Link Redirect Construction', () => {
    it('constructs correct mobile redirect URL without localhost', () => {
      const url = getAuthRedirectUrl();
      expect(url).toBe('bebig://auth/callback');
      expect(url).not.toContain('localhost');
      expect(url).not.toContain('3000');
    });

    it('supports custom redirect URL override via environment variable', () => {
      const originalEnv = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
      process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL = 'exp://192.168.1.100:8081/--/auth/callback';

      const url = getAuthRedirectUrl();
      expect(url).toBe('exp://192.168.1.100:8081/--/auth/callback');

      if (originalEnv === undefined) {
        delete process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
      } else {
        process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL = originalEnv;
      }
    });
  });

  // 5 & 6: Email Authentication (Sign In & Sign Up)
  describe('Email Authentication Service', () => {
    it('signs in successfully with valid email and password', async () => {
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'test-token',
            user: { id: 'user-456', email: 'test@bebig.app' },
          },
        },
        error: null,
      });

      const result = await authService.signInWithEmail('test@bebig.app', 'password123');

      expect(result.success).toBe(true);
      expect(result.session?.accessToken).toBe('test-token');
      expect(result.user?.id).toBe('user-456');
    });

    it('returns friendly error on invalid login credentials', async () => {
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await authService.signInWithEmail('wrong@bebig.app', 'badpass');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Incorrect email or password');
    });

    it('signs up successfully and passes mobile emailRedirectTo URL to Supabase', async () => {
      mockAuth.signUp.mockResolvedValueOnce({
        data: {
          user: { id: 'new-user', email: 'new@bebig.app', identities: [{ id: '1' }] },
          session: { access_token: 'new-token', user: { id: 'new-user', email: 'new@bebig.app' } },
        },
        error: null,
      });

      const result = await authService.signUpWithEmail('new@bebig.app', 'securepass');

      expect(result.success).toBe(true);
      expect(result.user?.id).toBe('new-user');
      expect(mockAuth.signUp).toHaveBeenCalledWith({
        email: 'new@bebig.app',
        password: 'securepass',
        options: {
          emailRedirectTo: 'bebig://auth/callback',
        },
      });
    });

    it('handles sign up when email confirmation is required', async () => {
      mockAuth.signUp.mockResolvedValueOnce({
        data: {
          user: { id: 'confirm-user', email: 'confirm@bebig.app', identities: [{ id: '1' }] },
          session: null,
        },
        error: null,
      });

      const result = await authService.signUpWithEmail('confirm@bebig.app', 'securepass');

      expect(result.success).toBe(true);
      expect(result.requiresEmailConfirmation).toBe(true);
      expect(result.message).toContain('confirmation link');
      expect(mockAuth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: {
            emailRedirectTo: 'bebig://auth/callback',
          },
        }),
      );
    });

    it('rejects short passwords client-side', async () => {
      const result = await authService.signUpWithEmail('test@bebig.app', '12345');
      expect(result.success).toBe(false);
      expect(result.message).toContain('at least 6 characters');
      expect(mockAuth.signUp).not.toHaveBeenCalled();
    });
  });

  // Deep Link Handling (PKCE Code, OTP Token Hash, and Hash Tokens)
  describe('Incoming Deep-Link Authentication Handling', () => {
    it('exchanges PKCE authorization code (?code=...) for session', async () => {
      mockAuth.exchangeCodeForSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'pkce-access-token',
            user: { id: 'pkce-user', email: 'pkce@bebig.app' },
          },
        },
        error: null,
      });

      const result = await authService.handleIncomingAuthUrl(
        'bebig://auth/callback?code=valid-pkce-code',
      );

      expect(result.success).toBe(true);
      expect(result.session?.accessToken).toBe('pkce-access-token');
      expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('valid-pkce-code');
    });

    it('verifies email confirmation token (?token_hash=...&type=email)', async () => {
      mockAuth.verifyOtp.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'otp-access-token',
            user: { id: 'otp-user', email: 'otp@bebig.app' },
          },
        },
        error: null,
      });

      const result = await authService.handleIncomingAuthUrl(
        'bebig://auth/callback?token_hash=valid-token-hash&type=email',
      );

      expect(result.success).toBe(true);
      expect(result.session?.accessToken).toBe('otp-access-token');
      expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'valid-token-hash',
        type: 'email',
      });
    });

    it('extracts access and refresh tokens from URL fragment (#access_token=...)', async () => {
      mockAuth.setSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'hash-access-token',
            refresh_token: 'hash-refresh-token',
            user: { id: 'hash-user', email: 'hash@bebig.app' },
          },
        },
        error: null,
      });

      const result = await authService.handleIncomingAuthUrl(
        'bebig://auth/callback#access_token=hash-access-token&refresh_token=hash-refresh-token',
      );

      expect(result.success).toBe(true);
      expect(result.session?.accessToken).toBe('hash-access-token');
      expect(mockAuth.setSession).toHaveBeenCalledWith({
        access_token: 'hash-access-token',
        refresh_token: 'hash-refresh-token',
      });
    });

    it('handles error parameters in callback URL gracefully', async () => {
      const result = await authService.handleIncomingAuthUrl(
        'bebig://auth/callback?error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Email link is invalid or has expired');
    });
  });

  // 7: Sign Out
  describe('Sign Out', () => {
    it('signs out and clears session state in store', async () => {
      mockAuth.signOut.mockResolvedValueOnce({ error: null });

      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'user-789', email: 'user@bebig.app' },
        session: { accessToken: 'tok', user: { id: 'user-789', email: 'user@bebig.app' } },
      });

      await useAuthStore.getState().signOut();

      expect(mockAuth.signOut).toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().session).toBeNull();
    });
  });

  // Apple & Google Authentication
  describe('OAuth & Third-Party Authentication', () => {
    it('authenticates with Apple on iOS devices', async () => {
      mockAuth.signInWithIdToken.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'apple-session-token',
            user: { id: 'apple-user', email: 'apple@icloud.com' },
          },
        },
        error: null,
      });

      const result = await authService.signInWithApple();

      expect(result.success).toBe(true);
      expect(result.session?.accessToken).toBe('apple-session-token');
      expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({
        provider: 'apple',
        token: 'mock-apple-identity-token',
      });
    });

    it('authenticates with Google via browser OAuth session', async () => {
      mockAuth.signInWithOAuth.mockResolvedValueOnce({
        data: { url: 'https://auth.supabase.co/oauth/google' },
        error: null,
      });

      mockAuth.setSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'mock-google-token',
            user: { id: 'google-user', email: 'google@gmail.com' },
          },
        },
        error: null,
      });

      const result = await authService.signInWithGoogle();

      expect(result.success).toBe(true);
      expect(result.session?.accessToken).toBe('mock-google-token');
    });
  });

  // 9, 10, 11, 12: Profile Persistence & Cloud Sync
  describe('Profile Service & Cloud Sync', () => {
    it('retrieves user profile from Supabase', async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'user-101',
            goal: 'build_muscle',
            experience_level: 'intermediate',
            days_per_week: 4,
            onboarding_completed: true,
          },
          error: null,
        }),
      });

      const profile = await profileService.getProfile('user-101');

      expect(profile).not.toBeNull();
      expect(profile?.goal).toBe('build_muscle');
      expect(profile?.onboarding_completed).toBe(true);
    });

    it('syncs onboarding profile to Supabase on completion', async () => {
      mockFrom.mockReturnValueOnce({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'user-sync',
            goal: 'gain_strength',
            onboarding_completed: true,
          },
          error: null,
        }),
      });

      const onboardingData = {
        goal: 'gain_strength' as const,
        experienceLevel: 'advanced' as const,
        daysPerWeek: 5,
        workoutDuration: '60_min' as const,
        trainingLocation: 'gym' as const,
        equipment: 'full_gym' as const,
        preferredTrainingDays: ['monday', 'wednesday', 'friday'] as any[],
        workoutStyle: 'push_pull_legs' as const,
        hasCompletedOnboarding: true,
      };

      const result = await profileService.syncOnboardingProfile('user-sync', onboardingData);

      expect(result).not.toBeNull();
      expect(result?.goal).toBe('gain_strength');
      expect(result?.onboarding_completed).toBe(true);
    });
  });

  // 13 & 14: Root Gatekeeper Routing
  describe('Root Index Gatekeeper Routing', () => {
    it('shows loading indicator while initializing auth', async () => {
      useAuthStore.setState({ status: 'initializing' });

      // Mock initializeAuth so it leaves state as initializing
      jest.spyOn(useAuthStore.getState(), 'initializeAuth').mockImplementation(async () => {});

      const { getByTestId } = await render(<RootIndex />);
      expect(getByTestId('auth-loading-indicator')).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('redirects unauthenticated user to welcome screen', async () => {
      useAuthStore.setState({ status: 'unauthenticated' });

      await render(<RootIndex />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
      });
    });

    it('redirects authenticated user with completed onboarding to home', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'authed-1', email: 'authed@bebig.app' },
      });
      useOnboardingStore.getState().completeOnboarding();

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: { id: 'authed-1', onboarding_completed: true },
          error: null,
        }),
      });

      await render(<RootIndex />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/home');
      });
    });

    it('redirects authenticated user with incomplete onboarding to welcome flow', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'authed-2', email: 'authed2@bebig.app' },
      });
      useOnboardingStore.getState().resetOnboarding();

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
      });
    });
  });

  // Auth Callback Screen Component
  describe('AuthCallbackScreen Route', () => {
    it('processes confirmation link, establishes session, and redirects to /home', async () => {
      mockSearchParams = { code: 'confirmed-pkce-code' };

      mockAuth.exchangeCodeForSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'confirmed-access-token',
            user: { id: 'confirmed-user', email: 'confirmed@bebig.app' },
          },
        },
        error: null,
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: {
            id: 'confirmed-user',
            onboarding_completed: true,
          },
          error: null,
        }),
      });

      await render(<AuthCallbackScreen />);

      await waitFor(() => {
        expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('confirmed-pkce-code');
        expect(mockReplace).toHaveBeenCalledWith('/home');
        expect(useAuthStore.getState().status).toBe('authenticated');
      });
    });

    it('renders error card and button back to sign in when callback link has error', async () => {
      mockSearchParams = {
        error: 'access_denied',
        error_description: 'Confirmation link expired',
      };

      const { getByTestId, getByText } = await render(<AuthCallbackScreen />);

      await waitFor(() => {
        expect(getByTestId('callback-error-card')).toBeTruthy();
        expect(getByText(/Confirmation link expired/i)).toBeTruthy();
      });

      fireEvent.press(getByTestId('callback-signin-button'));
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/auth');
    });
  });

  describe('AuthScreen Form Interaction', () => {
    it('renders Apple, Google, and Email sign in controls without dev bypass shortcut', async () => {
      const { getByTestId, queryByTestId, getByText } = await render(<AuthScreen />);

      expect(getByTestId('auth-apple-button')).toBeTruthy();
      expect(getByTestId('auth-google-button')).toBeTruthy();
      expect(getByTestId('auth-email-input')).toBeTruthy();
      expect(getByTestId('auth-password-input')).toBeTruthy();
      expect(getByTestId('auth-email-submit-button')).toBeTruthy();

      // Ensure dev preview bypass button is completely removed
      expect(queryByTestId('complete-onboarding-button')).toBeNull();

      // Switch mode to Create Account
      fireEvent.press(getByTestId('toggle-signup'));
      expect(getByText('Create Account')).toBeTruthy();
    });

    it('submits email sign in and navigates to home on success', async () => {
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'submit-token',
            user: { id: 'user-submit', email: 'submit@bebig.app' },
          },
        },
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: { id: 'user-submit', onboarding_completed: true },
          error: null,
        }),
        single: jest.fn().mockResolvedValueOnce({
          data: { id: 'user-submit', onboarding_completed: true },
          error: null,
        }),
      });

      const { getByTestId } = await render(<AuthScreen />);

      fireEvent.changeText(getByTestId('auth-email-input'), 'submit@bebig.app');
      fireEvent.changeText(getByTestId('auth-password-input'), 'mypassword');

      await waitFor(() => {
        expect(getByTestId('auth-email-input').props.value).toBe('submit@bebig.app');
        expect(getByTestId('auth-password-input').props.value).toBe('mypassword');
      });

      fireEvent.press(getByTestId('auth-email-submit-button'));

      await waitFor(() => {
        expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
          email: 'submit@bebig.app',
          password: 'mypassword',
        });
        expect(mockReplace).toHaveBeenCalledWith('/home');
      });
    });
  });
});
