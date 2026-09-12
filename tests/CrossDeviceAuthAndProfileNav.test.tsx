import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import SettingsScreen from '../app/settings';
import HomeScreen from '../app/home';
import { BottomNavBar } from '../src/components/navigation/BottomNavBar';
import { useAuthStore, authService } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import { profileService, UserProfile } from '../src/features/profile';
import { resolveAuthenticatedUserRoute } from '../src/features/auth/utils/resolveAuthRoute';
import { supabase } from '../src/lib/supabase';
import { workoutRepository } from '../src/features/workout';
import { templateRepository } from '../src/features/templates';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockCurrentSegments: string[] = ['home'];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useSegments: () => mockCurrentSegments,
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    isSupabaseConfigured: () => true,
  };
});

describe('BeBig 2.0 — Cross-Device Auth, Profile Revamp & Bottom Nav Tests', () => {
  const mockUserId = 'usr_cross_device_456';
  const mockUserEmail = 'aditya@bebig.app';

  const initialCloudProfile: UserProfile = {
    id: mockUserId,
    display_name: 'Aditya Patil',
    age: 26,
    height: 182,
    weight: 80,
    avatar_url: null,
    goal: 'build_muscle',
    experience_level: 'advanced',
    days_per_week: 5,
    workout_duration: '60_min',
    training_location: 'gym',
    equipment: 'full_gym',
    preferred_training_days: ['monday', 'wednesday', 'friday'],
    workout_style: 'push_pull_legs',
    onboarding_completed: true,
  };

  const mockUserWithMetadata = {
    id: mockUserId,
    email: mockUserEmail,
    provider: 'email' as const,
    app_metadata: { provider: 'email' },
    user_metadata: {
      onboarding_completed: true,
      profile: initialCloudProfile,
    },
  };

  let currentProfile: UserProfile;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentSegments = ['home'];
    currentProfile = { ...initialCloudProfile };

    profileService.clearMemoryCache();

    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
    jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
    jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
    jest.spyOn(authService, 'signOut').mockResolvedValue({ success: true, message: 'Signed out.' });
    jest.spyOn(authService, 'getCurrentSession').mockResolvedValue({
      user: mockUserWithMetadata as any,
      accessToken: 'mock_jwt_token',
    });

    jest.spyOn(profileService, 'getProfile').mockImplementation(async () => ({ ...currentProfile }));
    jest.spyOn(profileService, 'upsertProfile').mockImplementation(async (userId, payload) => {
      currentProfile = {
        ...currentProfile,
        ...payload,
        id: userId,
      };
      return currentProfile;
    });

    useAuthStore.setState({
      status: 'authenticated',
      user: mockUserWithMetadata as any,
      session: { user: mockUserWithMetadata, accessToken: 'mock_jwt_token' } as any,
      guestSession: null,
      isGuest: false,
      isConfigured: true,
      error: null,
    });

    useOnboardingStore.setState({
      goal: 'build_muscle',
      experienceLevel: 'advanced',
      daysPerWeek: 5,
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

  // 1. Cross-Device Onboarding Restoration (P0)
  describe('1. Cross-Device Cloud Onboarding Restoration (P0)', () => {
    it('restores profile from user_metadata when Supabase profiles table is missing and local storage is empty', async () => {
      const fromSpy = jest.spyOn(supabase, 'from').mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "Could not find the table 'public.profiles'", code: 'PGRST205' },
            }),
          }),
        }),
      } as any);

      const getUserSpy = jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: mockUserWithMetadata as any },
        error: null,
      });

      profileService.clearMemoryCache();

      // Use actual implementation directly
      const { profileService: realService } = jest.requireActual(
        '../src/features/profile/services/profileService',
      );
      const retrieved = await realService.getProfile(mockUserId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.onboarding_completed).toBe(true);
      expect(retrieved?.display_name).toBe('Aditya Patil');
      expect(retrieved?.goal).toBe('build_muscle');
      expect(retrieved?.experience_level).toBe('advanced');

      fromSpy.mockRestore();
      getUserSpy.mockRestore();
    });

    it('resolveAuthenticatedUserRoute directs existing cloud-profiled user directly to /home and never to /onboarding', async () => {
      jest.spyOn(profileService, 'getProfile').mockResolvedValueOnce(null);

      const routeResult = await resolveAuthenticatedUserRoute(mockUserId);

      expect(routeResult).not.toBeNull();
      expect(routeResult?.route).toBe('/home');
      expect(routeResult?.onboardingCompleted).toBe(true);
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
    });

    it('upsertProfile synchronizes changes to supabase.auth.updateUser', async () => {
      const fromSpy = jest.spyOn(supabase, 'from').mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: mockUserId,
                display_name: 'Aditya Updated',
                age: 27,
                height: 183,
                weight: 81,
                onboarding_completed: true,
              },
              error: null,
            }),
          }),
        }),
      } as any);

      const updateUserSpy = jest.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
        data: { user: mockUserWithMetadata as any },
        error: null,
      });

      (profileService.upsertProfile as jest.Mock).mockRestore();

      await profileService.upsertProfile(mockUserId, {
        display_name: 'Aditya Updated',
        age: 27,
        height: 183,
        weight: 81,
        onboarding_completed: true,
      });

      expect(updateUserSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            onboarding_completed: true,
            profile: expect.objectContaining({
              display_name: 'Aditya Updated',
              age: 27,
              height: 183,
              weight: 81,
            }),
          }),
        }),
      );

      updateUserSpy.mockRestore();
      fromSpy.mockRestore();
    });
  });

  // 2. Revamped Settings & Profile Experience
  describe('2. Revamped Settings & Profile Experience', () => {
    it('renders all 5 cards: Profile Header, Personal Info, Training Profile, Account, and App Info', async () => {
      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-profile-header-card')).toBeTruthy();
        expect(getByTestId('settings-personal-info-card')).toBeTruthy();
        expect(getByTestId('settings-profile-card')).toBeTruthy();
        expect(getByTestId('settings-account-card')).toBeTruthy();
        expect(getByTestId('settings-app-info-card')).toBeTruthy();
      });

      // Verify Personal Info displays correctly
      expect(getByTestId('profile-view-name').props.children).toBe('Aditya Patil');
      expect(getByTestId('profile-view-age').props.children).toBe('26 yrs');
      expect(getByTestId('profile-view-height').props.children).toBe('182 cm');
      expect(getByTestId('profile-view-weight').props.children).toBe('80 kg');

      // Verify Profile Header
      expect(getByTestId('profile-header-name').props.children).toBe('Aditya Patil');
      expect(getByTestId('profile-header-email').props.children).toBe('aditya@bebig.app');
    });

    it('validates personal info in edit mode and shows error banner on invalid input', async () => {
      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());
      await fireEvent.press(getByTestId('edit-profile-button'));

      await waitFor(() => expect(getByTestId('input-age')).toBeTruthy());

      // Enter invalid age
      await fireEvent.changeText(getByTestId('input-age'), '150');
      await fireEvent.press(getByTestId('save-profile-button'));

      await waitFor(() => {
        expect(getByTestId('profile-error-banner')).toBeTruthy();
      });
    });

    it('saves valid personal information and training profile successfully', async () => {
      const { getByTestId, queryByTestId } = await render(<SettingsScreen />);

      await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());
      await fireEvent.press(getByTestId('edit-profile-button'));

      await waitFor(() => expect(getByTestId('input-display-name')).toBeTruthy());

      await fireEvent.changeText(getByTestId('input-display-name'), 'Aditya P');
      await fireEvent.changeText(getByTestId('input-age'), '27');
      await fireEvent.changeText(getByTestId('input-height'), '183');
      await fireEvent.changeText(getByTestId('input-weight'), '82');

      await fireEvent.press(getByTestId('save-profile-button'));

      await waitFor(() => {
        expect(getByTestId('save-success-banner')).toBeTruthy();
        expect(getByTestId('profile-view-name').props.children).toBe('Aditya P');
        expect(getByTestId('profile-view-age').props.children).toBe('27 yrs');
      });

      expect(queryByTestId('profile-error-banner')).toBeNull();
    });
  });

  // 3. Home Screen Single Clean Edit Action
  describe('3. Home Screen Edit Profile Action', () => {
    it('renders single Edit Profile link on Fitness Profile card without duplicates', async () => {
      const { getByTestId } = await render(<HomeScreen />);

      await waitFor(() => {
        expect(getByTestId('profile-summary-card')).toBeTruthy();
        expect(getByTestId('edit-profile-link')).toBeTruthy();
      });

      await fireEvent.press(getByTestId('edit-profile-link'));
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });
  });

  // 4. Global Mobile Bottom Navigation Bar Tests
  describe('4. Global Mobile Bottom Navigation', () => {
    it('renders 5 tabs when on authenticated /home screen', async () => {
      mockCurrentSegments = ['home'];
      const { getByTestId } = await render(<BottomNavBar />);

      await waitFor(() => {
        expect(getByTestId('bottom-nav-bar')).toBeTruthy();
        expect(getByTestId('tab-home')).toBeTruthy();
        expect(getByTestId('tab-history')).toBeTruthy();
        expect(getByTestId('tab-workout')).toBeTruthy();
        expect(getByTestId('tab-exercises')).toBeTruthy();
        expect(getByTestId('tab-profile')).toBeTruthy();
      });
    });

    it('navigates to corresponding routes when tabs are pressed', async () => {
      mockCurrentSegments = ['home'];
      const { getByTestId } = await render(<BottomNavBar />);

      await waitFor(() => expect(getByTestId('bottom-nav-bar')).toBeTruthy());

      await fireEvent.press(getByTestId('tab-history'));
      expect(mockPush).toHaveBeenCalledWith('/workout/history');

      await fireEvent.press(getByTestId('tab-workout'));
      expect(mockPush).toHaveBeenCalledWith('/workout/start');

      await fireEvent.press(getByTestId('tab-exercises'));
      expect(mockPush).toHaveBeenCalledWith('/exercises');

      await fireEvent.press(getByTestId('tab-profile'));
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });

    it('is hidden when on active workout screen', async () => {
      mockCurrentSegments = ['workout', 'active'];
      const { queryByTestId } = await render(<BottomNavBar />);

      expect(queryByTestId('bottom-nav-bar')).toBeNull();
    });

    it('is hidden when on onboarding screens', async () => {
      mockCurrentSegments = ['onboarding', 'goal'];
      const { queryByTestId } = await render(<BottomNavBar />);

      expect(queryByTestId('bottom-nav-bar')).toBeNull();
    });
  });
});
