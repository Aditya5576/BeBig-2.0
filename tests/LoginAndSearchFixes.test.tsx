import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import { authService, useAuthStore } from '../src/features/auth';
import { ExerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import {
  calculateExerciseMatchScore,
  filterAndRankExercises,
} from '../src/features/exercises/utils/exerciseSearch';
import { Exercise } from '../src/features/exercises/types';
import { useOnboardingStore } from '../src/features/onboarding';
import AuthScreen from '../app/onboarding/auth';
import WelcomeScreen from '../app/onboarding/welcome';
declare const require: any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, any> = { mode: 'sign_in' };

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
  resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
};

const mockFrom = jest.fn((table?: string) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

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
      resetPasswordForEmail: (...args: any[]) => mockAuth.resetPasswordForEmail(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

describe('Surgical Fix: Login UX + Tolerant Exercise Search', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    mockSearchParams = { mode: 'sign_in' };
    mockAuth.signOut.mockResolvedValue({ error: null });
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    await customExerciseStorage.clearCustomExercises();
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

  // ==========================================
  // 1. LOGIN UX VERIFICATION
  // ==========================================
  describe('1. Login UX — Non-Existing Account vs Generic Errors', () => {
    it('LOGIN: existing successful login remains successful', async () => {
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            user: { id: 'athlete-1', email: 'existing@bebig.app', app_metadata: { provider: 'email' } },
          },
          user: { id: 'athlete-1', email: 'existing@bebig.app' },
        },
        error: null,
      });

      const result = await authService.signInWithEmail('existing@bebig.app', 'correctPassword123');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.user.email).toBe('existing@bebig.app');
      expect(result.isNonExistentUser).toBeFalsy();
    });

    it('LOGIN: clearly non-existing-account case returns isNonExistentUser and shows signup guidance', async () => {
      // 1. Service verification: Supabase "User not found" error
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: {
          name: 'AuthApiError',
          message: 'User not found',
          status: 404,
          code: 'user_not_found',
        },
      });

      const serviceResult = await authService.signInWithEmail('unknown@bebig.app', 'secretPassword');
      expect(serviceResult.success).toBe(false);
      expect(serviceResult.isNonExistentUser).toBe(true);
      expect(serviceResult.message).toBe(
        "We couldn't find an account with this email. Create an account to get started."
      );

      // 2. UI verification: AuthScreen displays non-existent user banner and Create Account action
      let currentEmailMode = 'sign_in';
      const { getByTestId, getByText, queryByTestId } = await render(
        <AuthScreen
          initialMode="sign_in"
          initialEmail="unknown@bebig.app"
          initialStatusMessage={{
            title: 'No account found',
            text: "We couldn't find an account with this email. Create an account to get started.",
            type: 'error',
            action: {
              label: 'Create Account',
              onPress: () => {
                currentEmailMode = 'sign_up';
              },
            },
          }}
        />
      );

      expect(getByTestId('auth-status-banner-title')).toBeTruthy();
      expect(getByText('No account found')).toBeTruthy();
      expect(
        getByText("We couldn't find an account with this email. Create an account to get started.")
      ).toBeTruthy();

      // Obvious action button exists
      const createAccountButton = getByTestId('auth-status-action-button');
      expect(createAccountButton).toBeTruthy();
      expect(within(createAccountButton).getByText('Create Account')).toBeTruthy();

      // Pressing Create Account triggers signup transition with email preserved
      fireEvent.press(createAccountButton);
      expect(currentEmailMode).toBe('sign_up');

      // Email input in form retains typed email
      expect(getByTestId('auth-email-input').props.value).toBe('unknown@bebig.app');
    });

    it('LOGIN: Supabase "Invalid login credentials" (status 400) provides friendly signup guidance and Create Account action', async () => {
      // 1. Service verification: Supabase 400 "Invalid login credentials"
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: {
          name: 'AuthApiError',
          message: 'Invalid login credentials',
          status: 400,
          code: 'invalid_credentials',
        },
      });

      const serviceResult = await authService.signInWithEmail('newlifter@bebig.app', 'password123');
      expect(serviceResult.success).toBe(false);
      expect(serviceResult.isInvalidCredentials).toBe(true);

      // 2. UI verification: AuthScreen displays No account found guidance and Create Account action
      const screen = await render(<AuthScreen initialMode="sign_in" />);
      await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'newlifter@bebig.app');
      await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'password123');

      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: {
          name: 'AuthApiError',
          message: 'Invalid login credentials',
          status: 400,
          code: 'invalid_credentials',
        },
      });

      await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status-banner-title')).toBeTruthy();
        expect(screen.getByText('No account found')).toBeTruthy();
        expect(
          screen.getByText("We couldn't find an account with this email. Create an account to get started.")
        ).toBeTruthy();
      });

      // Tapping Create Account switches to Sign Up mode with email preserved
      const createAccountButton = screen.getByTestId('auth-status-action-button');
      expect(createAccountButton).toBeTruthy();
      fireEvent.press(createAccountButton);

      await waitFor(() => {
        expect(screen.getByText('Create Your Account')).toBeTruthy();
        expect(screen.getByTestId('auth-email-input').props.value).toBe('newlifter@bebig.app');
      });
    });

    it('LOGIN: network or rate-limit error does NOT show "No account found" or Create Account action', async () => {
      // 1. Service verification: Network error
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: {
          name: 'AuthRetryableFetchError',
          message: 'fetch failed',
          status: 0,
        },
      });

      const serviceResult = await authService.signInWithEmail('athlete@bebig.app', 'password123');
      expect(serviceResult.success).toBe(false);
      expect(serviceResult.isNonExistentUser).toBe(false);
      expect(serviceResult.isInvalidCredentials).toBe(false);
      expect(serviceResult.message).toContain('Unable to reach authentication service');

      // 2. UI verification: displays generic connection error without "No account found"
      const screen = await render(<AuthScreen initialMode="sign_in" />);
      await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'athlete@bebig.app');
      await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'password123');

      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: { session: null, user: null },
        error: {
          name: 'AuthRetryableFetchError',
          message: 'fetch failed',
          status: 0,
        },
      });

      await fireEvent.press(screen.getByTestId('auth-email-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status-banner')).toBeTruthy();
        expect(screen.queryByTestId('auth-status-banner-title')).toBeNull();
        expect(screen.queryByTestId('auth-status-action-button')).toBeNull();
      });
    });
  });

  // ==========================================
  // 2. EXERCISE SEARCH VERIFICATION
  // ==========================================
  describe('2. Tolerant Exercise Search Matching & Normalization', () => {
    const latPulldown = 'Lat Pulldown';

    it('SEARCH: exact exercise match has highest match score', () => {
      const score = calculateExerciseMatchScore(latPulldown, 'Lat Pulldown');
      expect(score).toBe(100);
    });

    it('SEARCH: capitalization and spacing normalization works for all requested examples', () => {
      // "lat pulldown"
      expect(calculateExerciseMatchScore(latPulldown, 'lat pulldown')).toBeGreaterThan(70);

      // "LAT PULLDOWN"
      expect(calculateExerciseMatchScore(latPulldown, 'LAT PULLDOWN')).toBeGreaterThan(70);

      // "lat pull down"
      expect(calculateExerciseMatchScore(latPulldown, 'lat pull down')).toBeGreaterThan(50);

      // Extra spaces: "lat   pulldown"
      expect(calculateExerciseMatchScore(latPulldown, 'lat   pulldown')).toBeGreaterThan(70);

      // Punctuation differences: "pull-up" vs "pull up"
      expect(calculateExerciseMatchScore('Pull-Up', 'pull up')).toBeGreaterThan(70);
      expect(calculateExerciseMatchScore('T-Bar Row', 't bar row')).toBeGreaterThan(70);
    });

    it('SEARCH: representative typos such as "lat pulldwon" and "lat pul down" match intended exercise', () => {
      // Transposition typo: "lat pulldwon"
      const transpositionScore = calculateExerciseMatchScore(latPulldown, 'lat pulldwon');
      expect(transpositionScore).toBeGreaterThan(0);

      // Missing character + space typo: "lat pul down"
      const typoScore = calculateExerciseMatchScore(latPulldown, 'lat pul down');
      expect(typoScore).toBeGreaterThan(0);

      // Common typos in other exercises
      expect(calculateExerciseMatchScore('Barbell Bench Press', 'bench pres')).toBeGreaterThan(0);
      expect(calculateExerciseMatchScore('Dumbbell Curl', 'dumbell crul')).toBeGreaterThan(0);
    });

    it('SEARCH: unrelated exercises are NOT incorrectly matched', () => {
      expect(calculateExerciseMatchScore(latPulldown, 'bench press')).toBe(0);
      expect(calculateExerciseMatchScore(latPulldown, 'squat')).toBe(0);
      expect(calculateExerciseMatchScore(latPulldown, 'bicep curl')).toBe(0);
      expect(calculateExerciseMatchScore('Barbell Bench Press', 'deadlift')).toBe(0);
    });

    it('SEARCH: custom exercise matching still works with typo/formatting tolerance', async () => {
      const sampleExercises: Exercise[] = [
        {
          id: 'custom_lat_1',
          name: 'Lat Pulldown',
          category: 'back',
          categoryName: 'Back',
          primaryMuscles: [{ id: 'm1', name: 'Lats' }],
          secondaryMuscles: [],
          equipment: [{ id: 'eq1', name: 'Cable machine' }],
          description: '',
          images: [],
          isCustom: true,
          sourceProvider: 'custom',
        },
        {
          id: 'custom_bench_1',
          name: 'Barbell Bench Press',
          category: 'chest',
          categoryName: 'Chest',
          primaryMuscles: [{ id: 'm2', name: 'Chest' }],
          secondaryMuscles: [],
          equipment: [{ id: 'eq2', name: 'Barbell' }],
          description: '',
          images: [],
          isCustom: true,
          sourceProvider: 'custom',
        },
        {
          id: 'custom_squat_1',
          name: 'Barbell Squat',
          category: 'legs',
          categoryName: 'Legs',
          primaryMuscles: [{ id: 'm3', name: 'Quads' }],
          secondaryMuscles: [],
          equipment: [{ id: 'eq2', name: 'Barbell' }],
          description: '',
          images: [],
          isCustom: true,
          sourceProvider: 'custom',
        },
      ];

      // Match "lat pull down"
      const matches1 = filterAndRankExercises(sampleExercises, 'lat pull down');
      expect(matches1).toHaveLength(1);
      expect(matches1[0].name).toBe('Lat Pulldown');

      // Match "lat pulldwon"
      const matches2 = filterAndRankExercises(sampleExercises, 'lat pulldwon');
      expect(matches2).toHaveLength(1);
      expect(matches2[0].name).toBe('Lat Pulldown');

      // Match "lat pul down"
      const matches3 = filterAndRankExercises(sampleExercises, 'lat pul down');
      expect(matches3).toHaveLength(1);
      expect(matches3[0].name).toBe('Lat Pulldown');
    });

    it('SEARCH: ExerciseRepository integrates tolerant search with provider and custom exercises', async () => {
      const mockProvider = {
        providerId: 'mock-wger',
        listExercises: jest.fn().mockImplementation(async (options: any) => {
          const allWger: Exercise[] = [
            {
              id: 'wger_100',
              name: 'Lat Pulldown',
              category: 'back',
              categoryName: 'Back',
              primaryMuscles: [{ id: 'm1', name: 'Lats' }],
              secondaryMuscles: [],
              equipment: [],
              description: '',
              images: [],
              isCustom: false,
              sourceProvider: 'wger',
            },
            {
              id: 'wger_101',
              name: 'Lateral Raise',
              category: 'shoulders',
              categoryName: 'Shoulders',
              primaryMuscles: [{ id: 'm4', name: 'Deltoids' }],
              secondaryMuscles: [],
              equipment: [],
              description: '',
              images: [],
              isCustom: false,
              sourceProvider: 'wger',
            },
          ];

          // If query has exact match in provider:
          if (options.query === 'Lat Pulldown') {
            return { exercises: [allWger[0]], totalCount: 1, hasMore: false };
          }
          // If query is partial token "lat", return all matching candidates
          if (options.query === 'lat') {
            return { exercises: allWger, totalCount: 2, hasMore: false };
          }
          // Strict search returns empty on typos (simulating Wger SQL backend)
          return { exercises: [], totalCount: 0, hasMore: false };
        }),
        getExerciseById: jest.fn().mockResolvedValue(null),
        searchExercises: jest.fn().mockResolvedValue({ exercises: [], totalCount: 0, hasMore: false }),
      };

      const repo = new ExerciseRepository(mockProvider as any);

      // 1. Exact search
      const resExact = await repo.getExercises({ query: 'Lat Pulldown' });
      expect(resExact.exercises).toHaveLength(1);
      expect(resExact.exercises[0].name).toBe('Lat Pulldown');

      // 2. Typo search: "lat pulldwon" triggers fallback candidate retrieval and ranks Lat Pulldown
      const resTypo = await repo.getExercises({ query: 'lat pulldwon' });
      expect(resTypo.exercises).toHaveLength(1);
      expect(resTypo.exercises[0].name).toBe('Lat Pulldown');

      // 3. Spacing search: "lat pull down"
      const resSpacing = await repo.getExercises({ query: 'lat pull down' });
      expect(resSpacing.exercises).toHaveLength(1);
      expect(resSpacing.exercises[0].name).toBe('Lat Pulldown');

      // 4. Unrelated search: "bench press" returns 0
      const resUnrelated = await repo.getExercises({ query: 'bench press' });
      expect(resUnrelated.exercises).toHaveLength(0);
    });
  });

  // ==========================================
  // 3. GUEST FLOW — NO QUESTIONS VERIFICATION
  // ==========================================
  describe('3. Guest Flow — Direct to /home Without Questions', () => {
    it('GUEST: Continue as Guest on Welcome bypasses onboarding questionnaire and goes directly to /home', async () => {
      const screen = await render(<WelcomeScreen />);
      const guestButton = screen.getByTestId('welcome-guest-button');
      expect(guestButton).toBeTruthy();

      await fireEvent.press(guestButton);

      await waitFor(() => {
        expect(useAuthStore.getState().isGuest).toBe(true);
        expect(useAuthStore.getState().status).toBe('guest');
        expect(mockReplace).toHaveBeenCalledWith('/home');
        // Must NOT have navigated to onboarding questionnaire
        expect(mockPush).not.toHaveBeenCalledWith('/onboarding/goal');
        expect(mockPush).not.toHaveBeenCalledWith('/onboarding/experience');
        expect(mockPush).not.toHaveBeenCalledWith('/onboarding/preferences');
      });
    });

    it('SIGNUP: New user Sign Up on Welcome routes to Auth screen and preserves onboarding questions', async () => {
      const screen = await render(<WelcomeScreen />);
      const signupButton = screen.getByTestId('welcome-get-started-button');
      expect(signupButton).toBeTruthy();

      await fireEvent.press(signupButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/onboarding/auth?mode=sign_up');
      });
    });
  });

  // ==========================================
  // 4. MOBILE WEB PINCH-TO-ZOOM SAFETY
  // ==========================================
  describe('4. Mobile Web Pinch-to-Zoom Prevention', () => {
    it('HTML: app/+html.tsx specifies fixed-scale viewport and web gesture prevention', () => {
      const htmlPath = path.resolve(__dirname, '../app/+html.tsx');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');

      // Viewport meta enforces non-scalable, fixed scale, and viewport-fit=cover
      expect(htmlContent).toContain('user-scalable=no');
      expect(htmlContent).toContain('maximum-scale=1');
      expect(htmlContent).toContain('viewport-fit=cover');

      // Styles enforce touch-action: pan-x pan-y to block pinch zoom while allowing normal panning
      expect(htmlContent).toContain('touch-action: pan-x pan-y');

      // Inputs have font-size: 16px to prevent iOS auto-zoom on focus
      expect(htmlContent).toContain('font-size: 16px !important');

      // Safari gesturestart prevention listener is present
      expect(htmlContent).toContain('gesturestart');
    });
  });
});
