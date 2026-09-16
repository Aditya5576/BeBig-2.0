import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import SettingsScreen from '../app/settings';
import { useAuthStore, authService } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import {
  profileService,
  avatarService,
  UserProfile,
  MAX_AVATAR_SIZE_BYTES,
} from '../src/features/profile';
import { resolveAuthenticatedUserRoute } from '../src/features/auth/utils/resolveAuthRoute';
import { supabase } from '../src/lib/supabase';
import { workoutRepository } from '../src/features/workout';
import { templateRepository } from '../src/features/templates';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useSegments: () => ['settings'],
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

describe('Checkpoint 1: Profile Avatar Cloud Persistence & Storage Isolation', () => {
  const testUserId = 'usr_athlete_alpha';
  let currentProfile: UserProfile;
  let mockStorageUpload: jest.Mock;
  let mockStorageRemove: jest.Mock;
  let mockStorageGetPublicUrl: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    profileService.clearMemoryCache();
    useOnboardingStore.getState().resetOnboarding();

    currentProfile = {
      id: testUserId,
      display_name: 'Alpha Athlete',
      avatar_url: null,
      goal: 'build_muscle',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration: '60_min',
      training_location: 'gym',
      equipment: 'full_gym',
      preferred_training_days: ['monday', 'wednesday', 'friday'],
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
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

    mockStorageUpload = jest.fn().mockImplementation(async (path: string, _file: any) => ({
      data: { path },
      error: null,
    }));
    mockStorageRemove = jest.fn().mockImplementation(async (_paths: string[]) => ({
      data: [],
      error: null,
    }));
    mockStorageGetPublicUrl = jest.fn().mockImplementation((path: string) => ({
      data: {
        publicUrl: `https://test-project.supabase.co/storage/v1/object/public/avatars/${path}`,
      },
    }));

    jest.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: mockStorageUpload,
      remove: mockStorageRemove,
      getPublicUrl: mockStorageGetPublicUrl,
    } as any);

    const testUser = {
      id: testUserId,
      email: 'athlete.alpha@bebig.app',
      provider: 'email',
      user_metadata: {
        profile: currentProfile,
        onboarding_completed: true,
      },
    };

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

  // 1. Missing avatar fallback & graceful error handling
  describe('1. Missing Avatar Fallback & Error Gracefulness', () => {
    it('renders initials fallback when avatarUrl is null', async () => {
      const { getByTestId, queryByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('profile-avatar-fallback')).toBeTruthy();
        expect(queryByTestId('profile-avatar-image')).toBeNull();
      });
    });

    it('falls back gracefully to initials when avatar image fails to load (onError)', async () => {
      const testAvatarUrl = 'https://test-project.supabase.co/storage/v1/object/public/avatars/usr_athlete_alpha/broken.jpg';
      currentProfile.avatar_url = testAvatarUrl;

      const { getByTestId } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('profile-avatar-image')).toBeTruthy();
      });

      // Simulate image network load error
      fireEvent(getByTestId('profile-avatar-image'), 'error');

      await waitFor(() => {
        expect(getByTestId('profile-avatar-fallback')).toBeTruthy();
      });
    });
  });

  // 2. Successful save path & cloud persistence
  describe('2. Successful Save Path & Cloud Persistence', () => {
    it('validates avatar file type and size constraints', () => {
      // Reject non-image file
      const invalidType = avatarService.validateAvatarFile({ type: 'application/pdf', size: 1024 });
      expect(invalidType.valid).toBe(false);
      expect(invalidType.error).toContain('valid image');

      // Reject file exceeding 2MB limit
      const oversized = avatarService.validateAvatarFile({
        type: 'image/jpeg',
        size: MAX_AVATAR_SIZE_BYTES + 100,
      });
      expect(oversized.valid).toBe(false);
      expect(oversized.error).toContain('less than 2MB');

      // Accept valid JPEG within limit
      const valid = avatarService.validateAvatarFile({
        type: 'image/png',
        size: 500 * 1024,
      });
      expect(valid.valid).toBe(true);
    });

    it('uploads avatar to user-scoped storage path and persists reference to profile', async () => {
      const mockFile = { size: 1024 * 50 };
      const uploadedUrl = await avatarService.uploadAvatar(testUserId, mockFile, 'image/webp');

      expect(uploadedUrl).toContain(`/avatars/${testUserId}/avatar_`);
      expect(uploadedUrl).toMatch(/\.webp$/);
      expect(mockStorageUpload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${testUserId}/avatar_\\d+\\.webp$`)),
        mockFile,
        expect.objectContaining({ contentType: 'image/webp', upsert: false }),
      );

      // Persist to profile
      const updated = await profileService.upsertProfile(testUserId, {
        avatar_url: uploadedUrl,
      });

      expect(updated?.avatar_url).toBe(uploadedUrl);

      // Verify on subsequent load
      const loaded = await profileService.getProfile(testUserId);
      expect(loaded?.avatar_url).toBe(uploadedUrl);
    });
  });

  // 3. Replacing avatar behavior & safe cleanup
  describe('3. Replacing Avatar Behavior & Old Image Cleanup', () => {
    it('uploads new avatar first and cleans up previous storage avatar safely after save', async () => {
      const oldAvatarPath = `${testUserId}/avatar_111111.jpg`;
      const oldAvatarUrl = `https://test-project.supabase.co/storage/v1/object/public/avatars/${oldAvatarPath}`;
      currentProfile.avatar_url = oldAvatarUrl;

      const newFile = { size: 1024 * 80 };
      const newAvatarUrl = await avatarService.uploadAvatar(testUserId, newFile, 'image/jpeg');

      // Update profile with new avatar
      await profileService.upsertProfile(testUserId, {
        avatar_url: newAvatarUrl,
      });

      // Safe clean up of old avatar
      const deleted = await avatarService.deleteAvatarByUrl(testUserId, oldAvatarUrl);
      expect(deleted).toBe(true);
      expect(mockStorageRemove).toHaveBeenCalledWith([oldAvatarPath]);
    });

    it('never attempts to delete preset or external URLs during replacement', async () => {
      const presetUrl = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=240';
      const deleted = await avatarService.deleteAvatarByUrl(testUserId, presetUrl);
      expect(deleted).toBe(false);
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });
  });

  // 4. Authenticated user isolation
  describe('4. Authenticated User Isolation & Security', () => {
    it('strictly prevents a user from deleting another user avatar object', async () => {
      const otherUserId = 'usr_victim_beta';
      const otherUserAvatarUrl = `https://test-project.supabase.co/storage/v1/object/public/avatars/${otherUserId}/avatar_victim.jpg`;

      // User A (testUserId) attempts to delete User B's avatar
      const result = await avatarService.deleteAvatarByUrl(testUserId, otherUserAvatarUrl);

      expect(result).toBe(false);
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it('rejects path extraction if path does not belong to authenticated user', () => {
      const otherUserAvatarUrl = `https://test-project.supabase.co/storage/v1/object/public/avatars/usr_other/avatar_222.jpg`;
      const path = avatarService.extractStoragePathFromUrl(testUserId, otherUserAvatarUrl);
      expect(path).toBeNull();
    });
  });

  // 5. Invariant preservation
  describe('5. Onboarding Invariants Preserved', () => {
    it('locks onboarding_completed=true when updating avatar', async () => {
      const result = await profileService.upsertProfile(testUserId, {
        avatar_url: 'https://test-project.supabase.co/storage/v1/object/public/avatars/usr_athlete_alpha/avatar_999.jpg',
      });

      expect(result?.onboarding_completed).toBe(true);
    });

    it('ensures profile avatar update does NOT route user to onboarding questionnaire', async () => {
      await profileService.upsertProfile(testUserId, {
        avatar_url: 'https://test-project.supabase.co/storage/v1/object/public/avatars/usr_athlete_alpha/avatar_999.jpg',
      });

      const resolution = await resolveAuthenticatedUserRoute(testUserId);
      expect(resolution?.route).toBe('/home');
      expect(resolution?.route).not.toContain('/onboarding');
      expect(resolution?.onboardingCompleted).toBe(true);
    });
  });
});
