import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { authService, useAuthStore, resolveAuthenticatedUserRoute } from '../src/features/auth';
import { profileService, UserProfile } from '../src/features/profile';
import { useOnboardingStore } from '../src/features/onboarding';
import { guestStorage } from '../src/lib/storage';
import RootIndex from '../app/index';
import AuthScreen from '../app/onboarding/auth';
import AuthCallbackScreen from '../app/auth/callback';
import OnboardingLayout from '../app/onboarding/_layout';

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
  useSegments: () => ['onboarding'],
  useRootNavigationState: () => ({ key: 'ready' }),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: ({ href }: { href: string }) => {
    mockReplace(href);
    return null;
  },
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `bebig://${path}`),
  getInitialURL: jest.fn().mockResolvedValue(null),
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
          single: async () => {
            const profile = mockProfilesDb.get(id);
            return { data: profile ?? null, error: null };
          },
        }),
      }),
      upsert: (payload: any) => ({
        select: () => ({
          single: async () => {
            mockProfilesDb.set(payload.id, payload);
            return { data: payload, error: null };
          },
        }),
      }),
    }),
  },
  isSupabaseConfigured: () => true,
}));

describe('Authoritative Authentication & Routing Invariants', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockProfilesDb.clear();
    mockSearchParams = {};
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
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

  // 1. Existing completed user logs in from a fresh web/PWA startup → HOME.
  it('Scenario 1: Existing completed user logs in from a fresh web/PWA startup -> HOME', async () => {
    mockProfilesDb.set('user-completed-1', {
      id: 'user-completed-1',
      goal: 'build_muscle',
      experience_level: 'advanced',
      days_per_week: 5,
      workout_duration: '60_min',
      equipment: 'full_gym',
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    });

    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-1',
          refresh_token: 'ref-1',
          user: { id: 'user-completed-1', email: 'athlete1@bebig.app' },
        },
      },
      error: null,
    });

    const screen = await render(<AuthScreen initialMode="sign_in" />);
    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'athlete1@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('athlete1@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/experience');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/preferences');
    });

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
    expect(useOnboardingStore.getState().goal).toBe('build_muscle');
  });

  // 2. Existing completed user logs in after previous incomplete user's local onboarding state exists → HOME.
  it('Scenario 2: Existing completed user logs in after previous incomplete user state exists -> HOME', async () => {
    // Stale local onboarding state from a previous session
    const store = useOnboardingStore.getState();
    store.setGoal('lose_fat');
    store.setExperienceLevel('beginner');
    expect(store.hasCompletedOnboarding).toBe(false);

    mockProfilesDb.set('user-completed-2', {
      id: 'user-completed-2',
      goal: 'gain_strength',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration: '45_min',
      equipment: 'limited_equipment',
      workout_style: 'upper_lower',
      onboarding_completed: true,
    });

    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-2',
          refresh_token: 'ref-2',
          user: { id: 'user-completed-2', email: 'athlete2@bebig.app' },
        },
      },
      error: null,
    });

    const screen = await render(<AuthScreen initialMode="sign_in" />);
    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'athlete2@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('athlete2@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
    });

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
    expect(useOnboardingStore.getState().goal).toBe('gain_strength');
  });

  // 3. Existing completed user logs in after guest state exists → HOME.
  it('Scenario 3: Existing completed user logs in after guest state exists -> HOME', async () => {
    await guestStorage.setGuestSession({
      id: 'guest-prior',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });
    await guestStorage.saveOnboardingData({
      goal: 'lose_fat',
      experienceLevel: 'beginner',
      daysPerWeek: 3,
      workoutDuration: '30_min',
      trainingLocation: 'gym',
      equipment: 'limited_equipment',
      preferredTrainingDays: [],
      workoutStyle: 'full_body',
      hasCompletedOnboarding: false,
    });

    mockProfilesDb.set('user-completed-3', {
      id: 'user-completed-3',
      goal: 'build_muscle',
      experience_level: 'advanced',
      days_per_week: 6,
      workout_duration: '90_plus_min',
      equipment: 'full_gym',
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    });

    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-3',
          refresh_token: 'ref-3',
          user: { id: 'user-completed-3', email: 'athlete3@bebig.app' },
        },
      },
      error: null,
    });

    const screen = await render(<AuthScreen initialMode="sign_in" />);
    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'athlete3@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('athlete3@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
    });

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
    expect(useOnboardingStore.getState().goal).toBe('build_muscle');
  });

  // 4. Existing completed user logs in while stale previous profile promise resolves late → HOME.
  it('Scenario 4: Account isolation discards late-resolving stale profile promise -> HOME', async () => {
    // User A is an incomplete account
    mockProfilesDb.set('user-A', {
      id: 'user-A',
      goal: null,
      experience_level: null,
      days_per_week: null,
      workout_duration: null,
      equipment: null,
      workout_style: null,
      onboarding_completed: false,
    });

    // User B is a completed account
    mockProfilesDb.set('user-B', {
      id: 'user-B',
      goal: 'build_muscle',
      experience_level: 'advanced',
      days_per_week: 5,
      workout_duration: '60_min',
      equipment: 'full_gym',
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    });

    // Simulate User A started async resolution
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'user-A', email: 'userA@bebig.app' },
    });

    const stalePromiseForUserA = resolveAuthenticatedUserRoute('user-A');

    // Meanwhile, User B signs in
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'user-B', email: 'userB@bebig.app' },
    });

    const userBResolution = await resolveAuthenticatedUserRoute('user-B');
    expect(userBResolution?.route).toBe('/home');
    expect(userBResolution?.onboardingCompleted).toBe(true);

    // Stale promise for User A completes late: must be discarded (returns null)
    const staleResult = await stalePromiseForUserA;
    expect(staleResult).toBeNull();
  });

  // 5. Existing completed user logs in with auth mode/sign-up state previously selected → HOME.
  it('Scenario 5: Existing completed user in sign_up mode routes to HOME, not questionnaire', async () => {
    mockProfilesDb.set('user-completed-5', {
      id: 'user-completed-5',
      goal: 'build_muscle',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration: '60_min',
      equipment: 'full_gym',
      workout_style: 'upper_lower',
      onboarding_completed: true,
    });

    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-5',
          refresh_token: 'ref-5',
          user: { id: 'user-completed-5', email: 'athlete5@bebig.app' },
        },
      },
      error: null,
    });

    // Started on sign_up mode tab
    const screen = await render(<AuthScreen initialMode="sign_up" />);

    // Switches to sign_in tab
    await fireEvent.press(screen.getByTestId('toggle-signin'));

    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'athlete5@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('athlete5@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
    });
  });

  // 6. Existing completed user through Google callback → HOME.
  it('Scenario 6: Existing completed user through Google callback -> HOME', async () => {
    mockProfilesDb.set('user-google-completed', {
      id: 'user-google-completed',
      goal: 'build_muscle',
      experience_level: 'advanced',
      days_per_week: 5,
      workout_duration: '60_min',
      equipment: 'full_gym',
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    });

    jest.spyOn(authService, 'handleIncomingAuthUrl').mockResolvedValueOnce({
      success: true,
      message: 'Authenticated successfully.',
      session: {
        accessToken: 'mock-google-access',
        refreshToken: 'mock-google-refresh',
        user: { id: 'user-google-completed', email: 'googleuser@bebig.app' },
      },
    });

    mockSearchParams = { access_token: 'mock-google-access' };
    await render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
    });
  });

  // 7. Existing completed user through Apple callback → HOME.
  it('Scenario 7: Existing completed user through Apple callback -> HOME', async () => {
    mockProfilesDb.set('user-apple-completed', {
      id: 'user-apple-completed',
      goal: 'gain_strength',
      experience_level: 'advanced',
      days_per_week: 4,
      workout_duration: '60_min',
      equipment: 'full_gym',
      workout_style: 'full_body',
      onboarding_completed: true,
    });

    jest.spyOn(authService, 'handleIncomingAuthUrl').mockResolvedValueOnce({
      success: true,
      message: 'Authenticated successfully.',
      session: {
        accessToken: 'mock-apple-access',
        refreshToken: 'mock-apple-refresh',
        user: { id: 'user-apple-completed', email: 'appleuser@bebig.app' },
      },
    });

    mockSearchParams = { access_token: 'mock-apple-access' };
    await render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
    });
  });

  // 8. Existing incomplete user → exact incomplete onboarding step.
  it('Scenario 8: Existing incomplete user routes to exact incomplete step', async () => {
    mockProfilesDb.set('user-incomplete-8', {
      id: 'user-incomplete-8',
      goal: 'build_muscle',
      experience_level: null,
      days_per_week: null,
      workout_duration: null,
      equipment: null,
      workout_style: null,
      onboarding_completed: false,
    });

    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-8',
          refresh_token: 'ref-8',
          user: { id: 'user-incomplete-8', email: 'incomplete8@bebig.app' },
        },
      },
      error: null,
    });

    const screen = await render(<AuthScreen initialMode="sign_in" />);
    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'incomplete8@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('incomplete8@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/experience');
      expect(mockReplace).not.toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
    });
  });

  // 9. New signup → questionnaire.
  it('Scenario 9: New unprofiled signup routes to /onboarding/goal', async () => {
    mockAuth.signUp.mockResolvedValueOnce({
      data: {
        user: { id: 'new-user-9', email: 'new9@bebig.app', identities: [{ id: 'new-user-9' }] },
        session: {
          access_token: 'tok-new-9',
          refresh_token: 'ref-new-9',
          user: { id: 'new-user-9', email: 'new9@bebig.app' },
        },
      },
      error: null,
    });

    const screen = await render(<AuthScreen initialMode="sign_up" />);
    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'new9@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'pass1234');
    await fireEvent.changeText(screen.getByTestId('auth-confirm-password-input'), 'pass1234');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('new9@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('pass1234');
      expect(screen.getByTestId('auth-confirm-password-input').props.value).toBe('pass1234');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockAuth.signUp).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/goal');
      expect(mockReplace).not.toHaveBeenCalledWith('/home');
    });
  });

  // 10. Guest → HOME.
  it('Scenario 10: Guest session routes to /home', async () => {
    const screen = await render(<AuthScreen initialMode="sign_in" />);
    await fireEvent.press(screen.getByTestId('continue-as-guest-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
    });

    expect(useAuthStore.getState().isGuest).toBe(true);
  });

  // 11. Account switch from incomplete user → completed user → HOME.
  it('Scenario 11: Account switch from incomplete user to completed user -> HOME', async () => {
    // 1. Incomplete user was active
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'incomplete-user-prev', email: 'prev@bebig.app' },
    });
    useOnboardingStore.getState().setGoal('lose_fat');

    // 2. Completed user signs in
    mockProfilesDb.set('completed-user-next', {
      id: 'completed-user-next',
      goal: 'gain_strength',
      experience_level: 'advanced',
      days_per_week: 5,
      workout_duration: '60_min',
      equipment: 'full_gym',
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    });

    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-next',
          refresh_token: 'ref-next',
          user: { id: 'completed-user-next', email: 'next@bebig.app' },
        },
      },
      error: null,
    });

    const screen = await render(<AuthScreen initialMode="sign_in" />);
    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'next@bebig.app');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'secret123');

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input').props.value).toBe('next@bebig.app');
      expect(screen.getByTestId('auth-password-input').props.value).toBe('secret123');
    });

    await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
    expect(useOnboardingStore.getState().goal).toBe('gain_strength');
  });

  // 12. Service-worker/PWA cold-start timing cannot redirect completed user to onboarding.
  it('Scenario 12: PWA cold start with pre-authenticated completed session routes to /home', async () => {
    mockProfilesDb.set('cold-start-completed-user', {
      id: 'cold-start-completed-user',
      goal: 'build_muscle',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration: '60_min',
      equipment: 'full_gym',
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    });

    mockAuth.getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'tok-cold-start',
          refresh_token: 'ref-cold-start',
          user: { id: 'cold-start-completed-user', email: 'coldstart@bebig.app' },
        },
      },
    });

    useAuthStore.setState({ status: 'initializing' });

    // Render RootIndex with 0ms delay to simulate completion of startup gate
    await render(<RootIndex splashDurationMs={0} />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/welcome');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
    });
  });

  // 13. No onboarding route can override a completed authenticated profile.
  it('Scenario 13: OnboardingLayout immediately routes completed authenticated user to /home', async () => {
    mockProfilesDb.set('already-completed-user', {
      id: 'already-completed-user',
      goal: 'build_muscle',
      experience_level: 'advanced',
      days_per_week: 5,
      workout_duration: '60_min',
      equipment: 'full_gym',
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    });

    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'already-completed-user', email: 'completed@bebig.app' },
    });

    await render(<OnboardingLayout />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/goal');
      expect(mockReplace).not.toHaveBeenCalledWith('/onboarding/welcome');
    });
  });
});
