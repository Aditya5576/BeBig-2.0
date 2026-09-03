import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import { guestStorage } from '../src/lib/storage';
import RootIndex from '../app/index';
import HomeScreen from '../app/home';
import AuthScreen from '../app/onboarding/auth';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
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
  signOut: jest.fn(),
  getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: jest.fn().mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  }),
};

const mockFrom = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: any[]) => mockAuth.signUp(...args),
      signInWithPassword: (...args: any[]) => mockAuth.signInWithPassword(...args),
      signInWithIdToken: (...args: any[]) => mockAuth.signInWithIdToken(...args),
      signInWithOAuth: (...args: any[]) => mockAuth.signInWithOAuth(...args),
      signOut: (...args: any[]) => mockAuth.signOut(...args),
      getSession: (...args: any[]) => mockAuth.getSession(...args),
      onAuthStateChange: (...args: any[]) => mockAuth.onAuthStateChange(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

describe('BeBig 2.0 — Guest Mode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await guestStorage.wipeAllGuestData();
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

  // Requirement 1 & 6: Continue as Guest activates guest state without Supabase auth calls
  describe('Guest Entry Flow', () => {
    it('1 & 6: activates guest state without calling Supabase authentication APIs', async () => {
      useOnboardingStore.getState().setGoal('build_muscle');
      useOnboardingStore.getState().setExperienceLevel('intermediate');
      useOnboardingStore.getState().setDaysPerWeek(4);

      const { getByTestId } = await render(<AuthScreen />);

      const guestButton = getByTestId('continue-as-guest-button');
      expect(guestButton).toBeTruthy();

      fireEvent.press(guestButton);

      await waitFor(() => {
        const authState = useAuthStore.getState();
        expect(authState.status).toBe('guest');
        expect(authState.isGuest).toBe(true);
        expect(authState.user).toBeNull();
        expect(authState.session).toBeNull();
        expect(authState.guestSession).not.toBeNull();
        expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
        expect(mockReplace).toHaveBeenCalledWith('/home');
      });

      // Confirm zero calls to Supabase auth methods
      expect(mockAuth.signUp).not.toHaveBeenCalled();
      expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
      expect(mockAuth.signInWithIdToken).not.toHaveBeenCalled();
      expect(mockAuth.signInWithOAuth).not.toHaveBeenCalled();
    });
  });

  // Requirement 2 & 8: Persistence across app restarts / store rehydration
  describe('Guest Mode Persistence', () => {
    it('2 & 8: persists guest session and onboarding preferences locally', async () => {
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

      await useAuthStore.getState().enterGuestMode(onboardingData);

      // Verify data in local storage abstraction
      const savedSession = await guestStorage.getGuestSession();
      expect(savedSession).not.toBeNull();
      expect(savedSession?.id).toMatch(/^guest_/);

      const savedOnboarding = await guestStorage.getOnboardingData();
      expect(savedOnboarding).not.toBeNull();
      expect(savedOnboarding?.goal).toBe('gain_strength');
      expect(savedOnboarding?.daysPerWeek).toBe(5);

      // Simulate app kill & store reinitialization
      useAuthStore.setState({
        status: 'initializing',
        user: null,
        session: null,
        guestSession: null,
        isGuest: false,
      });

      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null } });

      await useAuthStore.getState().initializeAuth();

      expect(useAuthStore.getState().status).toBe('guest');
      expect(useAuthStore.getState().isGuest).toBe(true);
      expect(useAuthStore.getState().guestSession?.id).toBe(savedSession?.id);
    });
  });

  // Requirement 3, 4, 5: Root Gatekeeper Routing
  describe('Gatekeeper Routing with Guest State', () => {
    it('3: routes guest user with completed onboarding directly to /home', async () => {
      useAuthStore.setState({
        status: 'guest',
        isGuest: true,
        guestSession: { id: 'guest_test', createdAt: '2026-09-03', lastActiveAt: '2026-09-03' },
      });
      useOnboardingStore.getState().completeOnboarding();

      await render(<RootIndex />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/home');
      });
    });

    it('4: routes unauthenticated user to /onboarding/welcome', async () => {
      useAuthStore.setState({
        status: 'unauthenticated',
        isGuest: false,
        user: null,
      });

      await render(<RootIndex />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
      });
    });

    it('5: gives precedence to authenticated Supabase cloud user over guest session', async () => {
      mockAuth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'cloud-token',
            user: { id: 'cloud-user-1', email: 'cloud@bebig.app' },
          },
        },
      });

      // Pre-seed local guest session
      await guestStorage.setGuestSession({
        id: 'old_guest',
        createdAt: '2026-09-01',
        lastActiveAt: '2026-09-01',
      });

      await useAuthStore.getState().initializeAuth();

      expect(useAuthStore.getState().status).toBe('authenticated');
      expect(useAuthStore.getState().isGuest).toBe(false);
      expect(useAuthStore.getState().user?.email).toBe('cloud@bebig.app');
      expect(useAuthStore.getState().session?.accessToken).toBe('cloud-token');
    });
  });

  // Requirement 7: Guest Exit does NOT delete data
  describe('Exit Guest Mode', () => {
    it('7: deactivates guest session but preserves local onboarding data', async () => {
      const onboardingData = {
        goal: 'build_muscle' as const,
        experienceLevel: 'intermediate' as const,
        daysPerWeek: 4,
        workoutDuration: '45_min' as const,
        trainingLocation: 'gym' as const,
        equipment: 'full_gym' as const,
        preferredTrainingDays: [] as any[],
        workoutStyle: 'upper_lower' as const,
        hasCompletedOnboarding: true,
      };

      await useAuthStore.getState().enterGuestMode(onboardingData);

      // Now exit guest mode
      await useAuthStore.getState().exitGuestMode();

      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(useAuthStore.getState().isGuest).toBe(false);
      expect(useAuthStore.getState().guestSession).toBeNull();

      // Verify active guest session was cleared from storage
      const storedSession = await guestStorage.getGuestSession();
      expect(storedSession).toBeNull();

      // Verify onboarding preferences are STILL intact in local storage
      const preservedOnboarding = await guestStorage.getOnboardingData();
      expect(preservedOnboarding).not.toBeNull();
      expect(preservedOnboarding?.goal).toBe('build_muscle');
      expect(preservedOnboarding?.workoutStyle).toBe('upper_lower');
    });
  });

  // HomeScreen UI Adaptations
  describe('HomeScreen in Guest Mode', () => {
    it('renders guest mode badges and Exit Guest Mode action', async () => {
      useAuthStore.setState({
        status: 'guest',
        isGuest: true,
        user: null,
        session: null,
        guestSession: { id: 'guest_ui', createdAt: '2026-09-03', lastActiveAt: '2026-09-03' },
      });

      useOnboardingStore.getState().setGoal('build_muscle');
      useOnboardingStore.getState().completeOnboarding();

      const { getByTestId, getByText } = await render(<HomeScreen />);

      // Verify guest badge and subtitle
      expect(getByText(/Guest Mode — Local Device/i)).toBeTruthy();
      expect(getByText(/Guest Mode — Data stored on this device/i)).toBeTruthy();

      // Verify guest account card
      expect(getByTestId('guest-account-card')).toBeTruthy();
      expect(getByText(/Local Device Athlete/i)).toBeTruthy();

      // Verify Exit Guest Mode button
      const exitButton = getByTestId('exit-guest-button');
      expect(exitButton).toBeTruthy();
      expect(getByText('Exit Guest Mode')).toBeTruthy();

      fireEvent.press(exitButton);

      await waitFor(() => {
        expect(useAuthStore.getState().status).toBe('unauthenticated');
        expect(useAuthStore.getState().isGuest).toBe(false);
        expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
      });
    });
  });
});
