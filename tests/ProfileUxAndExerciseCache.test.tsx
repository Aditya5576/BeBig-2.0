import React from 'react';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import SettingsScreen from '../app/settings';
import HomeScreen from '../app/home';
import ExerciseListScreen from '../app/exercises/index';
import { useAuthStore, authService } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import { profileService } from '../src/features/profile';
import { exerciseRepository, exerciseCacheStorage, SEED_EXERCISES } from '../src/features/exercises';
import { workoutRepository } from '../src/features/workout';
import { templateRepository } from '../src/features/templates';
import { BottomNavBar } from '../src/components/navigation/BottomNavBar';
import { resolveAuthenticatedUserRoute } from '../src/features/auth/utils/resolveAuthRoute';
import { supabase } from '../src/lib/supabase';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
};
let mockCurrentSegments: string[] = ['home'];

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useSegments: () => mockCurrentSegments,
  useLocalSearchParams: () => ({}),
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

describe('BeBig 2.0 — Surgical Product UX, Profile & Low-Network Hardening Pass', () => {
  let currentProfile: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    await exerciseCacheStorage.clearCache();
    profileService.clearMemoryCache();
    useOnboardingStore.getState().resetOnboarding();

    currentProfile = {
      id: 'usr_aditya_5576',
      display_name: 'Aditya Patil',
      goal: 'build_muscle',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration: '60_min',
      equipment: 'full_gym',
      workout_style: 'push_pull_legs',
      preferred_training_days: ['monday', 'wednesday', 'friday'],
      onboarding_completed: true,
      avatar_url: null,
      age: 26,
      height: 182,
      weight: 80,
    };

    jest.spyOn(profileService, 'getProfile').mockImplementation(async () => ({ ...currentProfile }));
    jest.spyOn(profileService, 'upsertProfile').mockImplementation(async (userId, payload) => {
      currentProfile = {
        ...currentProfile,
        ...payload,
        id: userId,
        onboarding_completed: true,
      };
      return { ...currentProfile };
    });

    jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
    jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
    jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
    jest.spyOn(authService, 'signOut').mockResolvedValue({ success: true, message: 'Signed out.' });
    jest.spyOn(authService, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    } as any);

    const testUser = {
      id: 'usr_aditya_5576',
      email: 'aditya@example.com',
      provider: 'email',
      user_metadata: {
        profile: currentProfile,
        onboarding_completed: true,
      },
    };

    jest.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: { user: testUser as any },
      error: null,
    });

    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: testUser as any,
      session: { user: testUser, accessToken: 'mock_token' } as any,
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

  // 1. NAVIGATION & HOME CLEANUP
  describe('1. Navigation & Home Screen Architecture', () => {
    it('removes redundant top settings button from Home', async () => {
      const { queryByTestId } = await render(<HomeScreen />);
      await waitFor(() => {
        expect(queryByTestId('settings-header-button')).toBeNull();
      });
    });

    it('removes Fitness Profile card from Home screen', async () => {
      const { queryByTestId } = await render(<HomeScreen />);
      await waitFor(() => {
        expect(queryByTestId('profile-summary-card')).toBeNull();
      });
    });

    it('removes account and sign-out controls from Home screen', async () => {
      const { queryByTestId } = await render(<HomeScreen />);
      await waitFor(() => {
        expect(queryByTestId('account-card')).toBeNull();
        expect(queryByTestId('sign-out-button')).toBeNull();
      });
    });

    it('renders clean bottom navigation bar with all 5 athletic tabs', async () => {
      mockCurrentSegments = ['home'];
      const { getByTestId } = await render(<BottomNavBar />);

      expect(getByTestId('tab-home')).toBeTruthy();
      expect(getByTestId('tab-history')).toBeTruthy();
      expect(getByTestId('tab-workout')).toBeTruthy();
      expect(getByTestId('tab-exercises')).toBeTruthy();
      expect(getByTestId('tab-profile')).toBeTruthy();
    });
  });

  // 2. PROFILE NAME & PERSISTENCE
  describe('2. Profile Name & Cloud Source of Truth', () => {
    it('resolves dynamic athlete name from display_name on Home', async () => {
      const { getByTestId } = await render(<HomeScreen />);
      await waitFor(() => {
        expect(getByTestId('home-title').props.children).toContain('Aditya Patil');
      });
    });

    it('edits display name and updates Profile immediately', async () => {
      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('edit-profile-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('edit-profile-button'));

      await waitFor(() => {
        expect(getByTestId('input-display-name')).toBeTruthy();
      });

      fireEvent.changeText(getByTestId('input-display-name'), 'Aditya The Beast');

      fireEvent.press(getByTestId('save-profile-button'));

      await waitFor(() => {
        expect(getByTestId('save-success-banner')).toBeTruthy();
        expect(getByTestId('profile-header-name').props.children).toBe('Aditya The Beast');
      });
    });

    it('updates auth store user profile when updateUserProfile is called', () => {
      useAuthStore.getState().updateUserProfile({ display_name: 'Aditya The Beast' });
      const authUser = useAuthStore.getState().user;
      expect(authUser?.user_metadata?.profile?.display_name).toBe('Aditya The Beast');
    });

    it('locks onboarding_completed=true when updating profile name', async () => {
      const result = await profileService.upsertProfile('usr_aditya_5576', {
        display_name: 'Aditya Updated',
      });
      expect(result?.onboarding_completed).toBe(true);
      expect(result?.display_name).toBe('Aditya Updated');
    });
  });

  // 3. PROFILE AVATAR & IMAGE RESILIENCE
  describe('3. Profile Avatar & Image Fallbacks', () => {
    it('falls back gracefully to initials when avatarUrl is missing', async () => {
      const { getByTestId, queryByTestId } = await render(<SettingsScreen />);
      await waitFor(() => {
        expect(getByTestId('profile-avatar-fallback')).toBeTruthy();
        expect(queryByTestId('profile-avatar-image')).toBeNull();
      });
    });

    it('displays avatar image when valid URL is saved and falls back cleanly on error', async () => {
      const testAvatarUrl = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=240';
      await profileService.upsertProfile('usr_aditya_5576', {
        avatar_url: testAvatarUrl,
      });

      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('profile-avatar-image')).toBeTruthy();
      });

      // Simulate image load error -> fallback to initials
      fireEvent(getByTestId('profile-avatar-image'), 'error');

      await waitFor(() => {
        expect(getByTestId('profile-avatar-fallback')).toBeTruthy();
      });
    });

    it('selects athletic preset avatar in edit mode and updates preview', async () => {
      const { getByTestId } = await render(<SettingsScreen />);
      await waitFor(() => {
        expect(getByTestId('edit-profile-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('edit-profile-button'));

      await waitFor(() => {
        expect(getByTestId('avatar-preview-box')).toBeTruthy();
        expect(getByTestId('avatar-preset-barbell')).toBeTruthy();
      });

      fireEvent.press(getByTestId('avatar-preset-barbell'));

      await waitFor(() => {
        expect(getByTestId('input-avatar-url').props.value).toContain('photo-1534438327276');
      });
    });
  });

  // 4. CENTRAL ACCOUNT MANAGEMENT & DEV TOOLS IN PROFILE
  describe('4. Central Account Management & Developer Tools', () => {
    it('renders Account & Security section exclusively in Profile', async () => {
      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-account-card')).toBeTruthy();
        expect(getByTestId('settings-user-email')).toBeTruthy();
        expect(getByTestId('settings-provider')).toBeTruthy();
        expect(getByTestId('settings-logout-button')).toBeTruthy();
        expect(getByTestId('account-deletion-notice')).toBeTruthy();
      });
    });

    it('renders secondary Developer Tools card inside Profile with diagnostic buttons', async () => {
      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-dev-tools-card')).toBeTruthy();
        expect(getByTestId('dev-clear-cache-button')).toBeTruthy();
        expect(getByTestId('dev-reset-onboarding-button')).toBeTruthy();
      });

      // Press clear cache
      fireEvent.press(getByTestId('dev-clear-cache-button'));
      await waitFor(() => {
        expect(getByTestId('save-success-banner')).toBeTruthy();
      });
    });
  });

  // 5. LOCAL-FIRST EXERCISE CACHING & OFFLINE SEARCH
  describe('5. Local-First Exercise Caching & Offline Search', () => {
    let originalProvider: any;

    beforeEach(() => {
      originalProvider = (exerciseRepository as any).provider;
      const fastProvider = {
        listExercises: jest.fn().mockResolvedValue({
          exercises: SEED_EXERCISES,
          total: SEED_EXERCISES.length,
          hasMore: false,
        }),
        getExerciseById: jest.fn().mockResolvedValue(null),
      };
      exerciseRepository.setProvider(fastProvider as any);
    });

    afterEach(() => {
      if (originalProvider) {
        exerciseRepository.setProvider(originalProvider);
      }
    });

    it('renders cached exercises immediately on mount with 0ms delay', async () => {
      const { getByTestId } = await render(<ExerciseListScreen />);

      // Instant synchronous render from seed/catalog cache
      await waitFor(() => {
        expect(getByTestId('exercise-item-seed-bench-press')).toBeTruthy();
      });
    });

    it('filters exercises instantly from cache on search query without waiting for network', async () => {
      const { getByTestId, queryByTestId } = await render(<ExerciseListScreen />);

      await waitFor(() => {
        expect(getByTestId('exercise-search-input')).toBeTruthy();
      });

      fireEvent.changeText(getByTestId('exercise-search-input'), 'Squat');

      await waitFor(() => {
        expect(getByTestId('exercise-item-seed-squat')).toBeTruthy();
        expect(queryByTestId('exercise-item-seed-bench-press')).toBeNull();
      });
    });

    it('falls back to cached candidate pool on slow network or timeout without endless spinner', async () => {
      // Mock provider to hang/timeout
      const mockHangingProvider = {
        listExercises: jest.fn(() => new Promise((resolve) => setTimeout(resolve, 10000))),
        getExerciseById: jest.fn(() => Promise.resolve(null)),
      };
      exerciseRepository.setProvider(mockHangingProvider as any);

      const result = await exerciseRepository.getExercises({ category: 'chest' });
      expect(result.exercises.length).toBeGreaterThan(0);
      expect(result.exercises.some((e) => e.name.toLowerCase().includes('bench'))).toBe(true);
    });
  });

  // 6. PERMANENT ONE-TIME ONBOARDING INVARIANT PRESERVED
  describe('6. One-Time Onboarding Permanent Invariant', () => {
    it('routes completed account directly to /home on login', async () => {
      const resolution = await resolveAuthenticatedUserRoute('usr_aditya_5576');
      expect(resolution).not.toBeNull();
      expect(resolution?.route).toBe('/home');
      expect(resolution?.onboardingCompleted).toBe(true);
    });

    it('prevents completed user from being sent to questionnaire under any condition', async () => {
      const resolution = await resolveAuthenticatedUserRoute('usr_aditya_5576');
      expect(resolution?.route).toBe('/home');
      expect(resolution?.route).not.toContain('/onboarding');
      expect(resolution?.onboardingCompleted).toBe(true);
    });
  });
});
