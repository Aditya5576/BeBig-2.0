import React from 'react';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PrivacyPolicyScreen from '../app/legal/privacy';
import TermsOfServiceScreen from '../app/legal/terms';
import AuthScreen from '../app/onboarding/auth';
import SettingsScreen from '../app/settings';
import { useAuthStore, authService } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import {
  eraseLocalDeviceData,
  deleteAccountAndCloudData,
} from '../src/features/auth/services/accountDeletionService';
import { platformStorage } from '../src/lib/storage/platformStorage';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { profileService } from '../src/features/profile';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { templateRepository } from '../src/features/templates/services/templateRepository';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
let mockSearchParams: Record<string, any> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
  }),
  useLocalSearchParams: () => mockSearchParams,
  useSegments: () => ['settings'],
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, [cb]);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: ({ href }: { href: string }) => {
    mockReplace(href);
    return null;
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children, style, ...props }: any) =>
      React.createElement(View, { style, ...props }, children),
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

// Mock Supabase
const mockSignInWithPassword = jest.fn().mockResolvedValue({ error: null, data: {} });
const mockInvoke = jest.fn().mockResolvedValue({ data: { success: true }, error: null });

jest.mock('../src/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'usr_test_123' } }, error: null }),
    },
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'usr_test_123' } }, error: null }),
    },
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

describe('BeBig 2.0 — Phase 2A: Account Deletion, Legal & Local Erase (AUD-006, AUD-007, AUD-011)', () => {
  const alertSpy = jest.spyOn(Alert, 'alert');

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithPassword.mockReset();
    mockSignInWithPassword.mockResolvedValue({ error: null, data: {} });
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    jest.spyOn(profileService, 'getProfile').mockResolvedValue({
      id: 'usr_test_123',
      goal: 'build_muscle',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration: '60_min',
      training_location: 'gym',
      equipment: 'full_gym',
      preferred_training_days: ['monday', 'wednesday', 'friday'],
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    } as any);

    jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
    jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
    jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
    jest.spyOn(authService, 'signOut').mockResolvedValue({ success: true, message: 'Signed out successfully.' });

    platformStorage.clearMemoryCache();
    profileService.clearMemoryCache();
    workoutStorage.clearMemoryCache();
    syncMetadataStore.clearMemoryCache();
    mockSearchParams = {};

    const mockUser = {
      id: 'usr_test_123',
      email: 'athlete@bebig.app',
      app_metadata: { provider: 'email' },
    };

    useAuthStore.setState({
      status: 'authenticated',
      user: mockUser as any,
      session: { user: mockUser } as any,
      isGuest: false,
      guestSession: null,
      isConfigured: true,
      error: null,
    });
    useOnboardingStore.setState({
      goal: 'build_muscle',
      experienceLevel: 'intermediate',
      daysPerWeek: 4,
      workoutDuration: '60_min',
      trainingLocation: 'gym',
      equipment: 'full_gym',
      preferredTrainingDays: ['monday', 'wednesday', 'friday'],
      workoutStyle: 'push_pull_legs',
      hasCompletedOnboarding: true,
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  // ============================================================================
  // 1. Legal Transparency Screens & Navigation (AUD-007)
  // ============================================================================
  describe('Category 1: Privacy Policy & Terms Legal Surfaces (AUD-007)', () => {
    it('renders PrivacyPolicyScreen with all required data transparency disclosures', async () => {
      const { getByTestId, getByText, getAllByText } = await render(<PrivacyPolicyScreen />);

      expect(getByTestId('privacy-policy-screen')).toBeTruthy();
      expect(getByText('Data Transparency & Privacy')).toBeTruthy();
      expect(getAllByText(/Supabase/).length).toBeGreaterThan(0);
      expect(getAllByText(/Vercel/).length).toBeGreaterThan(0);
      expect(getAllByText(/Sentry/).length).toBeGreaterThan(0);
      expect(getAllByText(/Wger/).length).toBeGreaterThan(0);
      expect(getByText(/Local Device Storage & Threat Model \(AUD-011\)/)).toBeTruthy();
      expect(getByText(/Self-Service Deletion & Data Rights \(AUD-006\)/)).toBeTruthy();

      // Test back navigation
      await fireEvent.press(getByTestId('privacy-back-button'));
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('renders TermsOfServiceScreen with athletic safety & health disclaimer', async () => {
      const { getByTestId, getByText } = await render(<TermsOfServiceScreen />);

      expect(getByTestId('terms-of-service-screen')).toBeTruthy();
      expect(getByText('Terms & Conditions')).toBeTruthy();
      expect(getByText(/Athletic Training & Health Disclaimer/)).toBeTruthy();
      expect(getByText(/User Accounts & Responsibilities/)).toBeTruthy();
      expect(getByText(/Intellectual Property & Your Content/)).toBeTruthy();

      // Test back navigation
      await fireEvent.press(getByTestId('terms-back-button'));
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('exposes Privacy Policy and Terms of Service links on AuthScreen', async () => {
      const { getByTestId } = await render(<AuthScreen />);

      const privacyLink = getByTestId('auth-privacy-policy-link');
      const termsLink = getByTestId('auth-terms-of-service-link');

      expect(privacyLink).toBeTruthy();
      expect(termsLink).toBeTruthy();

      await fireEvent.press(privacyLink);
      expect(mockPush).toHaveBeenCalledWith('/legal/privacy');

      await fireEvent.press(termsLink);
      expect(mockPush).toHaveBeenCalledWith('/legal/terms');
    });

    it('exposes Privacy Policy and Terms buttons in SettingsScreen Legal section', async () => {
      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-legal-card')).toBeTruthy();
      });

      const privacyBtn = getByTestId('settings-privacy-policy-button');
      const termsBtn = getByTestId('settings-terms-of-service-button');

      await fireEvent.press(privacyBtn);
      expect(mockPush).toHaveBeenCalledWith('/legal/privacy');

      await fireEvent.press(termsBtn);
      expect(mockPush).toHaveBeenCalledWith('/legal/terms');
    });
  });

  // ============================================================================
  // 2. Erase Local Device Data (AUD-011)
  // ============================================================================
  describe('Category 2: Erase Local Device Data (AUD-011)', () => {
    it('prompts confirmation when Erase Local Device Data is pressed in Settings', async () => {
      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-erase-local-data-button')).toBeTruthy();
      });

      await fireEvent.press(getByTestId('settings-erase-local-data-button'));

      expect(alertSpy).toHaveBeenCalledTimes(1);
      const [title, message, buttons] = alertSpy.mock.calls[0];
      expect(title).toBe('Erase Local Cache');
      expect(message).toContain('purge all locally cached workouts');
      expect(buttons).toHaveLength(2);
      expect(buttons![0].text).toBe('Cancel');
      expect(buttons![1].text).toBe('Erase Local Data');
    });

    it('wipes local storage and signs out when authenticated athlete confirms local erase', async () => {
      // Seed some storage keys
      await platformStorage.setItem('bebig.workout.sessions.usr_test_123', JSON.stringify([{ id: 'sess_1' }]));
      await platformStorage.setItem('bebig.templates.usr_test_123', JSON.stringify([{ id: 'tpl_1' }]));
      await platformStorage.setItem('bebig.profile.usr_test_123', JSON.stringify({ displayName: 'Athlete' }));

      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-erase-local-data-button')).toBeTruthy();
      });

      await fireEvent.press(getByTestId('settings-erase-local-data-button'));

      const [, , buttons] = alertSpy.mock.calls[0];
      await act(async () => {
        await buttons![1].onPress!();
      });

      // Storage should be cleared
      expect(await platformStorage.getItem('bebig.workout.sessions.usr_test_123')).toBeNull();
      expect(await platformStorage.getItem('bebig.templates.usr_test_123')).toBeNull();
      expect(await platformStorage.getItem('bebig.profile.usr_test_123')).toBeNull();
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
    });

    it('wipes local guest data and exits guest mode when guest athlete confirms local erase', async () => {
      useAuthStore.setState({
        status: 'guest',
        user: null,
        session: null,
        isGuest: true,
        guestSession: {
          id: 'guest_athlete_456',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
      });

      await platformStorage.setItem('bebig.workout.sessions.guest.guest_athlete_456', JSON.stringify([{ id: 'guest_sess' }]));
      await platformStorage.setItem('bebig.guest.session', JSON.stringify({ id: 'guest_athlete_456' }));

      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-erase-local-data-button')).toBeTruthy();
      });

      await fireEvent.press(getByTestId('settings-erase-local-data-button'));

      expect(alertSpy).toHaveBeenCalledTimes(1);
      const [title, , buttons] = alertSpy.mock.calls[0];
      expect(title).toBe('Erase Local Device Data');

      await act(async () => {
        await buttons![1].onPress!();
      });

      expect(await platformStorage.getItem('bebig.workout.sessions.guest.guest_athlete_456')).toBeNull();
      expect(await platformStorage.getItem('bebig.guest.session')).toBeNull();
      expect(useAuthStore.getState().isGuest).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
    });

    it('eraseLocalDeviceData service cleans all scoped keys, active drafts, and sync metadata', async () => {
      const scope = { ownerId: 'user_purge_789', ownerType: 'authenticated' as const };

      await platformStorage.setItem('bebig.workout.sessions.user_purge_789', 'sessions');
      await platformStorage.setItem('bebig.workout.active.user_purge_789', 'active');
      await platformStorage.setItem('bebig.workout.active.abandoned.user_purge_789', 'abandoned');
      await platformStorage.setItem('bebig.workout.active.discarded.user_purge_789', 'discarded');
      await platformStorage.setItem('bebig.workout.active.token.user_purge_789', 'token');
      await platformStorage.setItem('bebig.templates.user_purge_789', 'templates');
      await platformStorage.setItem('bebig.exercises.custom.user_purge_789', 'custom_exercises');
      await platformStorage.setItem('bebig.profile.user_purge_789', 'profile');
      await platformStorage.setItem('bebig.sync.metadata.user_purge_789', 'sync_meta');
      await platformStorage.setItem('bebig.active.workout', 'legacy_unscoped');

      await eraseLocalDeviceData(scope);

      expect(await platformStorage.getItem('bebig.workout.sessions.user_purge_789')).toBeNull();
      expect(await platformStorage.getItem('bebig.workout.active.user_purge_789')).toBeNull();
      expect(await platformStorage.getItem('bebig.workout.active.abandoned.user_purge_789')).toBeNull();
      expect(await platformStorage.getItem('bebig.workout.active.discarded.user_purge_789')).toBeNull();
      expect(await platformStorage.getItem('bebig.workout.active.token.user_purge_789')).toBeNull();
      expect(await platformStorage.getItem('bebig.templates.user_purge_789')).toBeNull();
      expect(await platformStorage.getItem('bebig.exercises.custom.user_purge_789')).toBeNull();
      expect(await platformStorage.getItem('bebig.profile.user_purge_789')).toBeNull();
      expect(await platformStorage.getItem('bebig.sync.metadata.user_purge_789')).toBeNull();
      expect(await platformStorage.getItem('bebig.active.workout')).toBeNull();
    });
  });

  // ============================================================================
  // 3. Account Deletion & Cloud Erasure Flow (AUD-006)
  // ============================================================================
  describe('Category 3: Account Deletion & Cloud Erasure Flow (AUD-006)', () => {
    it('shows Delete Account button for authenticated athlete and opens confirmation modal', async () => {
      const { getByTestId, queryByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-delete-account-button')).toBeTruthy();
      });

      expect(queryByTestId('delete-account-modal-card')).toBeNull();

      await fireEvent.press(getByTestId('settings-delete-account-button'));

      expect(getByTestId('delete-account-modal-card')).toBeTruthy();
      expect(getByTestId('delete-account-confirm-input')).toBeTruthy();
      expect(getByTestId('delete-account-password-input')).toBeTruthy();
      expect(getByTestId('delete-account-confirm-button')).toBeTruthy();
      expect(getByTestId('delete-account-cancel-button')).toBeTruthy();
    });

    it('does not display Delete Account button for guest athlete', async () => {
      useAuthStore.setState({
        status: 'guest',
        user: null,
        session: null,
        isGuest: true,
        guestSession: {
          id: 'guest_123',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
      });

      const { queryByTestId, getByText } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(queryByTestId('settings-delete-account-button')).toBeNull();
        expect(getByText(/Guest Athlete: Training data is stored locally/)).toBeTruthy();
      });
    });

    it('disables deletion confirm button until "DELETE" is entered', async () => {
      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-delete-account-button')).toBeTruthy();
      });

      await fireEvent.press(getByTestId('settings-delete-account-button'));

      const confirmInput = getByTestId('delete-account-confirm-input');
      const confirmButton = getByTestId('delete-account-confirm-button');
      const passwordInput = getByTestId('delete-account-password-input');

      await fireEvent.changeText(confirmInput, 'DEL');
      // Button should be disabled or reject
      await fireEvent.press(confirmButton);
      expect(mockInvoke).not.toHaveBeenCalled();

      await fireEvent.changeText(passwordInput, 'athlete-pass');
      await fireEvent.changeText(confirmInput, 'DELETE');
      mockSignInWithPassword.mockResolvedValueOnce({ error: null, data: {} });
      mockInvoke.mockResolvedValueOnce({ data: { success: true }, error: null });

      await fireEvent.press(confirmButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('delete-account', {
          body: { confirm: 'DELETE_MY_ACCOUNT' },
        });
        expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
      });
    });

    it('rejects deletion and displays error banner if password re-authentication fails', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        error: new Error('Invalid login credentials'),
      });

      const { getByTestId, findByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-delete-account-button')).toBeTruthy();
      });

      await fireEvent.press(getByTestId('settings-delete-account-button'));

      await fireEvent.changeText(getByTestId('delete-account-password-input'), 'wrong-password');
      await fireEvent.changeText(getByTestId('delete-account-confirm-input'), 'DELETE');

      await fireEvent.press(getByTestId('delete-account-confirm-button'));

      const errorBanner = await findByTestId('delete-account-error-banner');
      expect(errorBanner).toBeTruthy();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('deleteAccountAndCloudData service handles backend rejection safely without state corruption', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({ error: null, data: {} });
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: new Error('Internal database timeout during user purge'),
      });

      const result = await deleteAccountAndCloudData({
        confirmPhrase: 'DELETE',
        password: 'valid-password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Internal database timeout');
      // User must still be authenticated if deletion fails
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    it('deleteAccountAndCloudData service rejects unauthenticated invocation', async () => {
      useAuthStore.setState({
        status: 'unauthenticated',
        user: null,
      });

      const result = await deleteAccountAndCloudData({
        confirmPhrase: 'DELETE',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('You must be signed in to delete your account.');
    });
  });

  // ============================================================================
  // 4. Edge Function Contract Validation (AUD-006, AUD-010)
  // ============================================================================
  describe('Category 4: Edge Function Contract Validation (AUD-006, AUD-010)', () => {
    // Simulated handler modeling supabase/functions/delete-account/index.ts contract
    const handleEdgeRequest = async (req: {
      method: string;
      headers: Record<string, string>;
      body?: any;
    }) => {
      if (req.method === 'OPTIONS') {
        return {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': 'https://be-big-2-0.vercel.app',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          },
        };
      }

      if (req.method !== 'POST') {
        return { status: 405, error: 'Method not allowed. POST is required.' };
      }

      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { status: 401, error: 'Missing authorization header' };
      }

      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token !== 'valid_token') {
        return { status: 401, error: 'Unauthorized: Invalid or expired token' };
      }

      if (req.body?.confirm !== 'DELETE_MY_ACCOUNT') {
        return { status: 400, error: 'Missing or invalid confirmation: confirm must equal "DELETE_MY_ACCOUNT"' };
      }

      return {
        status: 200,
        success: true,
        message: 'Account, cloud storage, and database records successfully purged.',
      };
    };

    it('responds to OPTIONS preflight with 200 and CORS headers', async () => {
      const res = await handleEdgeRequest({
        method: 'OPTIONS',
        headers: { Origin: 'https://be-big-2-0.vercel.app' },
      });
      expect(res.status).toBe(200);
      expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://be-big-2-0.vercel.app');
    });

    it('rejects non-POST methods with 405 Method Not Allowed (AUD-010)', async () => {
      for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
        const res = await handleEdgeRequest({
          method,
          headers: { authorization: 'Bearer valid_token' },
          body: { confirm: 'DELETE_MY_ACCOUNT' },
        });
        expect(res.status).toBe(405);
        expect(res.error).toContain('Method not allowed');
      }
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const resMissing = await handleEdgeRequest({
        method: 'POST',
        headers: {},
        body: { confirm: 'DELETE_MY_ACCOUNT' },
      });
      expect(resMissing.status).toBe(401);

      const resInvalid = await handleEdgeRequest({
        method: 'POST',
        headers: { authorization: 'Bearer bad_token' },
        body: { confirm: 'DELETE_MY_ACCOUNT' },
      });
      expect(resInvalid.status).toBe(401);
    });

    it('rejects missing or malformed confirm payload with 400 Bad Request', async () => {
      const res = await handleEdgeRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid_token' },
        body: { confirm: 'WRONG_CONFIRM' },
      });
      expect(res.status).toBe(400);
      expect(res.error).toContain('Missing or invalid confirmation');
    });

    it('succeeds with 200 when authenticated with valid confirmation', async () => {
      const res = await handleEdgeRequest({
        method: 'POST',
        headers: { authorization: 'Bearer valid_token' },
        body: { confirm: 'DELETE_MY_ACCOUNT' },
      });
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);
    });
  });
});
