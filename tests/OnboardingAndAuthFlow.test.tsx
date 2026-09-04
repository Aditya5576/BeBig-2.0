import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { authService, useAuthStore } from '../src/features/auth';
import { getAuthRedirectUrl } from '../src/features/auth/utils/redirect';
import { profileService } from '../src/features/profile';
import { useOnboardingStore } from '../src/features/onboarding';
import { guestStorage } from '../src/lib/storage';
import RootIndex from '../app/index';
import WelcomeScreen from '../app/onboarding/welcome';
import PreferencesScreen from '../app/onboarding/preferences';
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

// Mock expo-secure-store
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

// Mock expo-linking
const mockUrlListeners: ((event: { url: string }) => void)[] = [];
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `bebig://${path}`),
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn((event: string, handler: (e: any) => void) => {
    mockUrlListeners.push(handler);
    return {
      remove: jest.fn(() => {
        const idx = mockUrlListeners.indexOf(handler);
        if (idx !== -1) mockUrlListeners.splice(idx, 1);
      }),
    };
  }),
}));

// Mock Supabase
const mockAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signInWithIdToken: jest.fn(),
  signInWithOAuth: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  verifyOtp: jest.fn(),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
  setSession: jest.fn(),
  onAuthStateChange: jest.fn().mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  }),
};

const mockProfilesDb = new Map<string, any>();

const mockFrom = jest.fn((table: string) => {
  if (table === 'profiles') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn((field: string, val: string) => ({
          maybeSingle: jest.fn(async () => {
            const row = mockProfilesDb.get(val);
            return { data: row ?? null, error: null };
          }),
          single: jest.fn(async () => {
            const row = mockProfilesDb.get(val);
            return { data: row ?? null, error: null };
          }),
        })),
      })),
      upsert: jest.fn((payload: any) => {
        mockProfilesDb.set(payload.id, { ...mockProfilesDb.get(payload.id), ...payload });
        return {
          select: jest.fn(() => ({
            single: jest.fn(async () => ({
              data: mockProfilesDb.get(payload.id),
              error: null,
            })),
          })),
        };
      }),
    };
  }
  return {
    select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle: jest.fn() })) })),
  };
});

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
    from: (table: string) => mockFrom(table),
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

describe('Milestone 7 — Login / Onboarding State & Email Verification Hardening', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockProfilesDb.clear();
    mockSearchParams = {};
    mockUrlListeners.length = 0;
    mockSecureStore.clear();

    mockAuth.signOut.mockResolvedValue({ error: null });
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });

    await guestStorage.wipeAllGuestData();
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

  // Scenario 1: Brand-new authenticated account → onboarding
  it('Scenario 1: Brand-new authenticated account routes to onboarding flow', async () => {
    // User signed up, no profile in Supabase
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'new-user-1', email: 'new1@bebig.app' },
      session: {
        accessToken: 'tok-new',
        refreshToken: 'ref-new',
        user: { id: 'new-user-1', email: 'new1@bebig.app' },
      },
    });

    const screen = await render(<RootIndex />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/goal');
    });
  });

  // Scenario 2: Existing authenticated account with completed onboarding → Home
  it('Scenario 2: Existing authenticated account with completed onboarding routes directly to Home', async () => {
    mockProfilesDb.set('existing-user-1', {
      id: 'existing-user-1',
      goal: 'gain_strength',
      experience_level: 'advanced',
      days_per_week: 5,
      workout_duration: '60_min',
      training_location: 'gym',
      equipment: 'full_gym',
      preferred_training_days: ['monday', 'wednesday', 'friday'],
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    });

    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'existing-user-1', email: 'veteran@bebig.app' },
      session: {
        accessToken: 'tok-veteran',
        refreshToken: 'ref-veteran',
        user: { id: 'existing-user-1', email: 'veteran@bebig.app' },
      },
    });

    const screen = await render(<RootIndex />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });

    // Verify preferences were hydrated into store
    const onboarding = useOnboardingStore.getState();
    expect(onboarding.goal).toBe('gain_strength');
    expect(onboarding.hasCompletedOnboarding).toBe(true);
  });

  // Scenario 3: Existing account logs out → logs back in → Home
  it('Scenario 3: Existing account logs out and logs back in directly to Home without questionnaire', async () => {
    // Step 1: User A is existing with completed profile
    mockProfilesDb.set('user-a', {
      id: 'user-a',
      goal: 'build_muscle',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration: '45_min',
      training_location: 'gym',
      equipment: 'full_gym',
      preferred_training_days: ['tuesday', 'thursday'],
      workout_style: 'upper_lower',
      onboarding_completed: true,
    });

    // Step 2: User A logs out
    mockAuth.signOut.mockResolvedValueOnce({ error: null });
    await useAuthStore.getState().signOut();
    useOnboardingStore.getState().resetOnboarding();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);

    // Step 3: User A logs in from AuthScreen
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-user-a',
          refresh_token: 'ref-user-a',
          user: { id: 'user-a', email: 'usera@bebig.app' },
        },
      },
      error: null,
    });

    const screen = await render(<AuthScreen />);
    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'usera@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('usera@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });

    // Check that existing profile was NOT overwritten with empty store values
    const profile = mockProfilesDb.get('user-a');
    expect(profile.goal).toBe('build_muscle');
    expect(profile.workout_style).toBe('upper_lower');
    expect(profile.onboarding_completed).toBe(true);
  });

  // Scenario 4: Existing account with incomplete onboarding → onboarding
  it('Scenario 4: Existing account with incomplete onboarding routes to onboarding questions', async () => {
    mockProfilesDb.set('incomplete-user', {
      id: 'incomplete-user',
      goal: 'lose_fat',
      onboarding_completed: false,
    });

    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-inc',
          refresh_token: 'ref-inc',
          user: { id: 'incomplete-user', email: 'inc@bebig.app' },
        },
      },
      error: null,
    });

    mockSearchParams = { mode: 'sign_in' };
    const screen = await render(<AuthScreen />);
    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'inc@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('inc@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/goal');
    });
  });

  // Scenario 5: User A completed onboarding → User B new account → B gets onboarding
  it('Scenario 5: User A completed onboarding, User B signs up as new account and gets onboarding', async () => {
    // User A profile in db
    mockProfilesDb.set('user-a', {
      id: 'user-a',
      goal: 'gain_strength',
      onboarding_completed: true,
    });

    // User B signs in as a new account without answers
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-b',
          refresh_token: 'ref-b',
          user: { id: 'user-b', email: 'userb@bebig.app' },
        },
      },
      error: null,
    });

    mockSearchParams = { mode: 'sign_in' };
    const screen = await render(<AuthScreen />);
    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'userb@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('userb@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      // User B must get onboarding, NOT home
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/goal');
    });
  });

  // Scenario 6: User A logout → User B login → B's onboarding state is independent
  it('Scenario 6: User A logout and User B login ensures independent onboarding states', async () => {
    mockProfilesDb.set('user-a', {
      id: 'user-a',
      goal: 'gain_strength',
      experience_level: 'advanced',
      onboarding_completed: true,
    });

    mockProfilesDb.set('user-b', {
      id: 'user-b',
      goal: 'lose_fat',
      experience_level: 'beginner',
      onboarding_completed: true,
    });

    // User A logs in
    const profileA = await profileService.getProfile('user-a');
    expect(profileA?.goal).toBe('gain_strength');

    // User A logs out
    await useAuthStore.getState().signOut();
    useOnboardingStore.getState().resetOnboarding();

    // User B logs in
    const profileB = await profileService.getProfile('user-b');
    expect(profileB?.goal).toBe('lose_fat');
    expect(profileB?.experience_level).toBe('beginner');
  });

  // Scenario 7: User B completes onboarding → logout/login → Home
  it('Scenario 7: User B completes onboarding questions, logs out and logs in directly to Home', async () => {
    // Authenticate user B
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'user-b', email: 'userb@bebig.app' },
      session: {
        accessToken: 'tok-b',
        refreshToken: 'ref-b',
        user: { id: 'user-b', email: 'userb@bebig.app' },
      },
    });

    // User B fills out onboarding store
    const store = useOnboardingStore.getState();
    store.setGoal('build_muscle');
    store.setExperienceLevel('intermediate');
    store.setDaysPerWeek(4);
    store.setWorkoutDuration('45_min');
    store.setEquipment('full_gym');
    store.setWorkoutStyle('upper_lower');

    // Completing preferences screen syncs profile
    const screen = await render(<PreferencesScreen />);
    await fireEvent.press(screen.getByTestId('preferences-continue-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });

    // Profile in DB is saved with onboarding_completed = true
    const saved = mockProfilesDb.get('user-b');
    expect(saved?.onboarding_completed).toBe(true);

    // Logout and login again
    await act(async () => {
      await useAuthStore.getState().signOut();
      useOnboardingStore.getState().resetOnboarding();
    });

    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-b2',
          refresh_token: 'ref-b2',
          user: { id: 'user-b', email: 'userb@bebig.app' },
        },
      },
      error: null,
    });

    const authScreen = await render(<AuthScreen />);
    await fireEvent.changeText(authScreen.getByTestId('auth-email-input'), 'userb@bebig.app');
    await fireEvent.changeText(authScreen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(authScreen.getByTestId('auth-email-input').props.value).toBe('userb@bebig.app');
      expect(authScreen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(authScreen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });
  });

  // Scenario 8: Guest first use → onboarding
  it('Scenario 8: Guest first use routes through onboarding questionnaire and enters guest mode', async () => {
    // Unauthenticated initial state
    const welcomeScreen = await render(<WelcomeScreen />);
    await fireEvent.press(welcomeScreen.getByTestId('welcome-guest-button'));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/goal');

    // On AuthScreen, Continue as Guest is pressed
    const authScreen = await render(<AuthScreen />);
    await fireEvent.press(authScreen.getByTestId('continue-as-guest-button'));

    await waitFor(() => {
      expect(useAuthStore.getState().isGuest).toBe(true);
      expect(useAuthStore.getState().status).toBe('guest');
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });
  });

  // Scenario 9: Existing guest session restart → Home
  it('Scenario 9: Existing guest session restart routes directly to Home', async () => {
    await guestStorage.setGuestSession({
      id: 'guest_test_session',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });
    await guestStorage.saveOnboardingData({
      goal: 'build_muscle',
      experienceLevel: 'intermediate',
      daysPerWeek: 3,
      workoutDuration: '45_min',
      trainingLocation: 'gym',
      equipment: 'limited_equipment',
      preferredTrainingDays: ['monday'],
      workoutStyle: 'full_body',
      hasCompletedOnboarding: true,
    });

    await useAuthStore.getState().initializeAuth();
    expect(useAuthStore.getState().status).toBe('guest');

    const screen = await render(<RootIndex />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });
  });

  // Scenario 10: Guest state does not affect authenticated account
  it('Scenario 10: Guest preferences do not affect authenticated account profiles', async () => {
    await guestStorage.saveOnboardingData({
      goal: 'lose_fat',
      experienceLevel: 'beginner',
      daysPerWeek: 2,
      workoutDuration: '30_min',
      trainingLocation: 'gym',
      equipment: 'limited_equipment',
      preferredTrainingDays: ['sunday'],
      workoutStyle: 'full_body',
      hasCompletedOnboarding: true,
    });

    // Authenticated user with distinct profile in db
    mockProfilesDb.set('auth-user-x', {
      id: 'auth-user-x',
      goal: 'gain_strength',
      experience_level: 'advanced',
      onboarding_completed: true,
    });

    const userProfile = await profileService.getProfile('auth-user-x');
    expect(userProfile?.goal).toBe('gain_strength');
    expect(userProfile?.goal).not.toBe('lose_fat');
  });

  // Scenario 11: Authenticated state does not affect guest state
  it('Scenario 11: Authenticated sign out does not overwrite or wipe guest saved preferences', async () => {
    await guestStorage.saveOnboardingData({
      goal: 'build_muscle',
      experienceLevel: 'intermediate',
      daysPerWeek: 4,
      workoutDuration: '60_min',
      trainingLocation: 'gym',
      equipment: 'full_gym',
      preferredTrainingDays: ['monday', 'friday'],
      workoutStyle: 'push_pull_legs',
      hasCompletedOnboarding: true,
    });

    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'auth-user-y', email: 'authy@bebig.app' },
    });

    await useAuthStore.getState().signOut();

    const guestData = await guestStorage.getOnboardingData();
    expect(guestData?.goal).toBe('build_muscle');
    expect(guestData?.workoutStyle).toBe('push_pull_legs');
  });

  // Scenario 12: Profile loading does not cause an incorrect onboarding flash/race
  it('Scenario 12: Profile loading renders startup splash and does not cause premature redirection', async () => {
    let resolveProfile: (val: any) => void;
    const profilePromise = new Promise((resolve) => {
      resolveProfile = resolve;
    });

    jest.spyOn(profileService, 'getProfile').mockImplementationOnce(() => profilePromise as any);

    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'slow-user', email: 'slow@bebig.app' },
      session: {
        accessToken: 'tok-slow',
        refreshToken: 'ref-slow',
        user: { id: 'slow-user', email: 'slow@bebig.app' },
      },
    });

    const screen = await render(<RootIndex />);

    // While loading, StartupSplash is shown
    expect(screen.getByTestId('startup-splash-screen')).toBeTruthy();
    // No redirect happened yet
    expect(mockReplace).not.toHaveBeenCalled();

    // Now resolve profile
    await act(async () => {
      resolveProfile!({
        id: 'slow-user',
        goal: 'gain_strength',
        onboarding_completed: true,
      });
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });
  });

  // Scenario 13: Email callback handles the authenticated user correctly
  it('Scenario 13: Email callback handles authenticated user and routes to Home or Onboarding', async () => {
    // Sub-case A: Completed profile
    mockProfilesDb.set('confirmed-user-1', {
      id: 'confirmed-user-1',
      goal: 'build_muscle',
      onboarding_completed: true,
    });

    mockAuth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-confirmed',
          refresh_token: 'ref-confirmed',
          user: { id: 'confirmed-user-1', email: 'confirmed@bebig.app' },
        },
      },
      error: null,
    });

    mockSearchParams = { code: 'valid-pkce-code' };

    await render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    // Sub-case B: Incomplete profile without questionnaire answers
    mockReplace.mockClear();
    mockProfilesDb.set('confirmed-user-2', {
      id: 'confirmed-user-2',
      onboarding_completed: false,
    });

    mockAuth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-confirmed-2',
          refresh_token: 'ref-confirmed-2',
          user: { id: 'confirmed-user-2', email: 'confirmed2@bebig.app' },
        },
      },
      error: null,
    });

    mockSearchParams = { code: 'valid-pkce-code-2' };

    await render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/goal');
    });
  });

  // Scenario 14: Email callback handles errors correctly
  it('Scenario 14: Email callback handles errors and displays error banner with return button', async () => {
    mockSearchParams = {
      error: 'access_denied',
      error_description: 'Email link is invalid or has expired',
    };

    const screen = await render(<AuthCallbackScreen />);

    expect(await screen.findByText('Email link is invalid or has expired')).toBeTruthy();
    const returnBtn = screen.getByTestId('callback-signin-button');
    await fireEvent.press(returnBtn);

    expect(mockReplace).toHaveBeenCalledWith('/onboarding/auth');
  });

  // Scenario 15: No localhost callback dependency exists
  it('Scenario 15: No localhost or 127.0.0.1 callback dependency exists', () => {
    const redirectUrl = getAuthRedirectUrl();
    expect(redirectUrl).not.toContain('localhost');
    expect(redirectUrl).not.toContain('127.0.0.1');
    expect(redirectUrl).not.toContain('3000');
    expect(redirectUrl).toMatch(/^bebig:\/\/|^exp:\/\//);
  });

  // Scenario 16: Cold launch enforces mandatory startup splash delay before redirecting
  it('Scenario 16: Cold launch enforces mandatory startup splash delay before redirecting', async () => {
    mockProfilesDb.set('splash-test-user', {
      id: 'splash-test-user',
      goal: 'build_muscle',
      onboarding_completed: true,
    });

    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'splash-test-user', email: 'splash@bebig.app' },
      session: {
        accessToken: 'tok-splash',
        refreshToken: 'ref-splash',
        user: { id: 'splash-test-user', email: 'splash@bebig.app' },
      },
    });

    const screen = await render(<RootIndex splashDurationMs={200} />);

    // Immediately on mount, splash screen is displayed and redirect has not fired
    expect(screen.getByTestId('startup-splash-screen')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();

    // After the splash duration expires, redirect to /home takes place
    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith('/home');
      },
      { timeout: 1500 },
    );
  });

  // Scenario 17: New user sign up in sign_up mode always resets stale store and routes to /onboarding/goal
  it('Scenario 17: New user sign up in sign_up mode resets stale store and routes to /onboarding/goal, NOT /home', async () => {
    // Populate store with stale onboarding data from previous session
    const store = useOnboardingStore.getState();
    store.setGoal('lose_fat');
    store.setExperienceLevel('beginner');
    store.setDaysPerWeek(3);
    store.setWorkoutDuration('30_min');
    store.setEquipment('limited_equipment');
    store.setWorkoutStyle('full_body');
    store.completeOnboarding();
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);

    mockAuth.signUp.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-brand-new',
          refresh_token: 'ref-brand-new',
          user: { id: 'brand-new-user', email: 'newbie@bebig.app' },
        },
        user: { id: 'brand-new-user', email: 'newbie@bebig.app' },
      },
      error: null,
    });

    mockSearchParams = { mode: 'sign_up' };
    const screen = await render(<AuthScreen initialMode="sign_up" />);

    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'newbie@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'password123');
    await fireEvent.changeText(screen.getByTestId('auth-confirm-password-input'), 'password123');

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      // Must go to onboarding/goal, NOT home!
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/goal');
      expect(mockReplace).not.toHaveBeenCalledWith('/home');
    });

    // Verify local onboarding state was wiped clean for fresh answers
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
  });

  // Scenario 18: Login screen contains only authentication controls and NO Training Purpose text
  it('Scenario 18: Login screen does not display Training Purpose or Training Purpose Track', async () => {
    mockSearchParams = { mode: 'sign_in' };
    const screen = await render(<AuthScreen initialMode="sign_in" />);

    expect(screen.getByText('Welcome Back')).toBeTruthy();
    expect(screen.getByTestId('auth-email-input')).toBeTruthy();
    expect(screen.getByTestId('auth-password-input')).toBeTruthy();
    expect(screen.getByTestId('auth-email-submit-button')).toBeTruthy();

    // Verify completely clean of Training Purpose text
    expect(screen.queryByText(/training purpose/i)).toBeNull();
    expect(screen.queryByText(/training purpose track/i)).toBeNull();
  });
});
