import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WelcomeScreen from '../app/onboarding/welcome';
import GoalScreen from '../app/onboarding/goal';
import ExperienceScreen from '../app/onboarding/experience';
import PreferencesScreen from '../app/onboarding/preferences';
import AuthScreen from '../app/onboarding/auth';
import HomeScreen from '../app/home';
import RootIndex from '../app/index';
import { useOnboardingStore } from '../src/features/onboarding';
import { useAuthStore } from '../src/features/auth';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: ({ href }: { href: string }) => {
    mockReplace(href);
    return null;
  },
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

// Mock native expo auth modules
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `bebig://${path}`),
}));

// Mock Supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithIdToken: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

describe('Milestone 2 & 3 — Onboarding Flow Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOnboardingStore.getState().resetOnboarding();
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      session: null,
      isConfigured: true,
      error: null,
    });
  });

  // 1 & 2: Welcome Screen
  it('1 & 2: renders Welcome screen and navigates to Goal selection', async () => {
    const { getByText, getByTestId } = await render(<WelcomeScreen />);

    expect(getByText(/Train With Purpose/i)).toBeTruthy();
    expect(getByText(/Smart Set Logging/i)).toBeTruthy();

    const getStartedButton = getByTestId('welcome-get-started-button');
    fireEvent.press(getStartedButton);

    expect(mockPush).toHaveBeenCalledWith('/onboarding/goal');
  });

  // 3: Goal Selection — Blocked State
  it('3: blocks continue until one goal is selected', async () => {
    const { getByTestId } = await render(<GoalScreen />);

    fireEvent.press(getByTestId('goal-continue-button'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  // 4: Goal Selection — Single Choice & Continue
  it('4: enforces single choice selection and continues to experience', async () => {
    const { getByTestId, findByText } = await render(<GoalScreen />);

    // Select "Build Muscle"
    fireEvent.press(getByTestId('goal-option-build_muscle'));
    expect(await findByText('Build Muscle')).toBeTruthy();
    expect(useOnboardingStore.getState().goal).toBe('build_muscle');

    // Select "Gain Strength" -> switches selection (single choice)
    fireEvent.press(getByTestId('goal-option-gain_strength'));
    expect(await findByText('Gain Strength')).toBeTruthy();
    expect(useOnboardingStore.getState().goal).toBe('gain_strength');

    // Continue now works
    fireEvent.press(getByTestId('goal-continue-button'));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/experience');
  });

  // Back Navigation
  it('supports back navigation on goal screen', async () => {
    const { getByTestId } = await render(<GoalScreen />);

    fireEvent.press(getByTestId('onboarding-back-button'));
    expect(mockBack).toHaveBeenCalled();
  });

  // 5: Experience Level Selection
  it('5: allows selecting experience level and proceeds', async () => {
    const { getByTestId, findByText } = await render(<ExperienceScreen />);

    // Blocked before selection
    fireEvent.press(getByTestId('experience-continue-button'));
    expect(mockPush).not.toHaveBeenCalled();

    // Select "Intermediate"
    fireEvent.press(getByTestId('experience-option-intermediate'));
    expect(await findByText('Intermediate')).toBeTruthy();
    expect(useOnboardingStore.getState().experienceLevel).toBe('intermediate');

    // Continue to preferences
    fireEvent.press(getByTestId('experience-continue-button'));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/preferences');
  });

  // 6a: Workout Preferences — Blocked when required selections missing
  it('6a: blocks continue on preferences when required selections are missing', async () => {
    const { getByTestId } = await render(<PreferencesScreen />);

    fireEvent.press(getByTestId('preferences-continue-button'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  // 6b: Workout Preferences — Toggling training day chips
  it('6b: toggles preferred training days chips', async () => {
    const { getByTestId } = await render(<PreferencesScreen />);

    fireEvent.press(getByTestId('chip-monday'));
    expect(useOnboardingStore.getState().preferredTrainingDays).toContain('monday');
  });

  // 6c: Workout Preferences — Navigation to Auth
  it('6c: proceeds to auth when required preferences are satisfied', async () => {
    useOnboardingStore.getState().setDaysPerWeek(4);
    useOnboardingStore.getState().setWorkoutDuration('60_min');
    useOnboardingStore.getState().setEquipment('full_gym');
    useOnboardingStore.getState().setWorkoutStyle('push_pull_legs');

    const { getByTestId } = await render(<PreferencesScreen />);

    fireEvent.press(getByTestId('preferences-continue-button'));
    expect(mockPush).toHaveBeenCalledWith('/onboarding/auth');
  });

  // 9 & 10: Auth Screen Controls & Zero Fake Bypass
  it('9 & 10: renders production Auth screen and removes dev bypass shortcut', async () => {
    const { getByTestId, queryByTestId } = await render(<AuthScreen />);

    expect(getByTestId('auth-apple-button')).toBeTruthy();
    expect(getByTestId('auth-google-button')).toBeTruthy();
    expect(getByTestId('auth-email-input')).toBeTruthy();
    expect(getByTestId('auth-password-input')).toBeTruthy();
    expect(getByTestId('auth-email-submit-button')).toBeTruthy();

    // Dev preview bypass button is removed
    expect(queryByTestId('complete-onboarding-button')).toBeNull();

    // Onboarding completion is false until real authentication
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
  });

  // 11: Home screen and state reset
  it('11: renders configured profile on Home screen and supports reset', async () => {
    // Populate store
    useOnboardingStore.getState().setGoal('build_muscle');
    useOnboardingStore.getState().setExperienceLevel('intermediate');
    useOnboardingStore.getState().setDaysPerWeek(5);
    useOnboardingStore.getState().setWorkoutDuration('60_min');
    useOnboardingStore.getState().setEquipment('full_gym');
    useOnboardingStore.getState().setWorkoutStyle('push_pull_legs');
    useOnboardingStore.getState().completeOnboarding();

    const { getByTestId, getByText } = await render(<HomeScreen />);

    expect(getByTestId('home-title')).toBeTruthy();
    expect(getByText(/Build Muscle/i)).toBeTruthy();
    expect(getByText(/Intermediate/i)).toBeTruthy();
    expect(getByText(/5 days \/ week/i)).toBeTruthy();
    expect(getByText(/Push Pull Legs/i)).toBeTruthy();

    // Reset onboarding
    fireEvent.press(getByTestId('reset-onboarding-button'));
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
    expect(useOnboardingStore.getState().goal).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
  });

  // 12a: Root Gatekeeper redirects un-onboarded user to welcome
  it('12a: redirects un-onboarded users to welcome', async () => {
    useAuthStore.setState({ status: 'unauthenticated' });
    useOnboardingStore.getState().resetOnboarding();

    await render(<RootIndex />);
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
  });

  // 12b: Root Gatekeeper redirects returning user to home
  it('12b: redirects returning users to home', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'ret-1', email: 'ret@bebig.app' },
    });
    useOnboardingStore.getState().completeOnboarding();

    await render(<RootIndex />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });
  });
});
