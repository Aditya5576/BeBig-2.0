import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { authService, useAuthStore, resolveAuthenticatedUserRoute } from '../src/features/auth';
import { profileService } from '../src/features/profile';
import { OnboardingState } from '../src/features/onboarding/types';
import AuthScreen from '../app/onboarding/auth';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({ mode: 'sign_in' }),
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

const mockSecureStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, val: string) => {
    mockSecureStore.set(key, val);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));

const mockAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signInWithOAuth: jest.fn(),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
  setSession: jest.fn(),
  onAuthStateChange: jest.fn().mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  }),
};

const mockProfilesDb = new Map<string, any>();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: any[]) => mockAuth.signUp(...args),
      signInWithPassword: (...args: any[]) => mockAuth.signInWithPassword(...args),
      signInWithOAuth: (...args: any[]) => mockAuth.signInWithOAuth(...args),
      signOut: (...args: any[]) => mockAuth.signOut(...args),
      getSession: (...args: any[]) => mockAuth.getSession(...args),
      setSession: (...args: any[]) => mockAuth.setSession(...args),
      onAuthStateChange: (...args: any[]) => mockAuth.onAuthStateChange(...args),
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_field: string, id: string) => ({
          maybeSingle: async () => {
            const profile = mockProfilesDb.get(id);
            return { data: profile ?? null, error: null };
          },
        }),
      }),
      upsert: (payload: any) => {
        mockProfilesDb.set(payload.id, payload);
        return {
          select: () => ({
            single: async () => ({ data: payload, error: null }),
          }),
        };
      },
    }),
  },
  isSupabaseConfigured: () => true,
}));

describe('BeBig 2.0 — Critical Auth Security & Wrong Password Defense', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    mockProfilesDb.clear();

    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      session: null,
      guestSession: null,
      isGuest: false,
      isConfigured: true,
      error: null,
    });
  });

  it('1 & 5. Correct password authenticates user and resolves to /home for completed account', async () => {
    const mockUser = { id: 'usr_correct_123', email: 'athlete@bebig.app' };
    const mockSession: any = {
      user: mockUser,
      accessToken: 'token_123',
      refreshToken: 'refresh_123',
    };

    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser as any, session: mockSession },
      error: null,
    });

    // Seed local completed profile
    await profileService.upsertProfile('usr_correct_123', {
      onboarding_completed: true,
      display_name: 'Athlete One',
      goal: 'build_muscle',
      experience_level: 'intermediate',
    });

    const signInResult = await authService.signInWithEmail('athlete@bebig.app', 'correctpass123');
    expect(signInResult.success).toBe(true);
    expect(signInResult.session?.user.id).toBe('usr_correct_123');

    if (signInResult.session) {
      useAuthStore.getState().setSession(signInResult.session);
    }

    const resolution = await resolveAuthenticatedUserRoute('usr_correct_123');
    expect(resolution).not.toBeNull();
    expect(resolution?.onboardingCompleted).toBe(true);
    expect(resolution?.route).toBe('/home');
  });

  it('2, 3, 4 & 7. Wrong password fails authentication, surfaces error, and local cached profile alone CANNOT authorize access', async () => {
    // 1. Seed a cached completed profile for the target user ID in storage
    const targetUserId = 'usr_victim_456';
    await profileService.upsertProfile(targetUserId, {
      onboarding_completed: true,
      display_name: 'Victim Athlete',
      goal: 'build_muscle',
    });

    // 2. Mock Supabase returning invalid credentials error for wrong password
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        name: 'AuthApiError',
        message: 'Invalid login credentials',
        status: 400,
        code: 'invalid_credentials',
      } as any,
    });

    // Ensure store is unauthenticated
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      session: null,
      isGuest: false,
    });

    // 3. Attempt login with wrong password
    const signInResult = await authService.signInWithEmail('victim@bebig.app', 'wrongpassword');
    expect(signInResult.success).toBe(false);
    expect(signInResult.isInvalidCredentials).toBe(true);

    // 4. Verify resolveAuthenticatedUserRoute strictly rejects authorization without active session
    const resolution = await resolveAuthenticatedUserRoute(targetUserId);
    expect(resolution).toBeNull();

    // 5. Verify AuthScreen renders error message and NEVER navigates to /home
    const { getByTestId, findByTestId, findByText } = await render(
      <AuthScreen initialMode="sign_in" initialEmail="victim@bebig.app" />,
    );

    const emailInput = getByTestId('auth-email-input');
    const passwordInput = getByTestId('auth-password-input');
    const submitBtn = getByTestId('auth-email-submit-button');

    await act(async () => {
      fireEvent.changeText(emailInput, 'victim@bebig.app');
      fireEvent.changeText(passwordInput, 'wrongpassword');
    });

    await act(async () => {
      fireEvent.press(submitBtn);
    });

    const banner = await findByTestId('auth-status-banner');
    expect(banner).toBeTruthy();
    const title = await findByText('Unable to sign in');
    expect(title).toBeTruthy();

    expect(mockReplace).not.toHaveBeenCalledWith('/home');
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('6. Incomplete account routes to onboarding step after valid authentication', async () => {
    const mockUser = { id: 'usr_newbie_789', email: 'newbie@bebig.app' };
    const mockSession: any = {
      user: mockUser,
      accessToken: 'token_789',
      refreshToken: 'refresh_789',
    };

    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser as any, session: mockSession },
      error: null,
    });

    await profileService.upsertProfile('usr_newbie_789', {
      onboarding_completed: false,
      goal: 'build_muscle',
    });

    const signInResult = await authService.signInWithEmail('newbie@bebig.app', 'correctpass123');
    expect(signInResult.success).toBe(true);

    if (signInResult.session) {
      useAuthStore.getState().setSession(signInResult.session);
    }

    const resolution = await resolveAuthenticatedUserRoute('usr_newbie_789');
    expect(resolution).not.toBeNull();
    expect(resolution?.onboardingCompleted).toBe(false);
    expect(resolution?.route).toBe('/onboarding/experience');
  });

  it('8. Guest mode behavior remains intact', async () => {
    const onboardingData: OnboardingState = {
      goal: 'build_muscle',
      experienceLevel: 'intermediate',
      daysPerWeek: 4,
      workoutDuration: '60_min',
      trainingLocation: 'gym',
      equipment: 'full_gym',
      preferredTrainingDays: ['monday', 'wednesday', 'friday'],
      workoutStyle: 'push_pull_legs',
      hasCompletedOnboarding: true,
    };

    await act(async () => {
      await useAuthStore.getState().enterGuestMode(onboardingData);
    });

    const state = useAuthStore.getState();
    expect(state.status).toBe('guest');
    expect(state.isGuest).toBe(true);
    expect(state.guestSession).not.toBeNull();
  });
});
