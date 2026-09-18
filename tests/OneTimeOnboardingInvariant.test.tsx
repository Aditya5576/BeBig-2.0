import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import SettingsScreen from '../app/settings';
import HomeScreen from '../app/home';
import GoalScreen from '../app/onboarding/goal';
import ExperienceScreen from '../app/onboarding/experience';
import PreferencesScreen from '../app/onboarding/preferences';
import { useAuthStore, authService } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import { profileService, UserProfile } from '../src/features/profile';
import { resolveAuthenticatedUserRoute } from '../src/features/auth/utils/resolveAuthRoute';
import { supabase } from '../src/lib/supabase';
import { workoutRepository } from '../src/features/workout';
import { templateRepository } from '../src/features/templates';
import { guestStorage } from '../src/lib/storage';
import { BottomNavBar } from '../src/components/navigation/BottomNavBar';

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
  Redirect: ({ href }: { href: string }) => {
    mockReplace(href);
    return null;
  },
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

describe('BeBig 2.0 — Permanent Product Invariant: Onboarding is One-Time Only', () => {
  const userAId = 'usr_athlete_alpha';
  const userAEmail = 'alpha@bebig.app';

  const userBId = 'usr_athlete_beta';
  const userBEmail = 'beta@bebig.app';

  const completedProfileA: UserProfile = {
    id: userAId,
    display_name: 'Athlete Alpha',
    age: 27,
    height: 180,
    weight: 82,
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

  const userAWithMetadata = {
    id: userAId,
    email: userAEmail,
    provider: 'email' as const,
    app_metadata: { provider: 'email' },
    user_metadata: {
      onboarding_completed: true,
      profile: completedProfileA,
    },
  };

  const completedProfileB: UserProfile = {
    id: userBId,
    display_name: 'Athlete Beta',
    age: 30,
    height: 175,
    weight: 75,
    avatar_url: null,
    goal: 'gain_strength',
    experience_level: 'intermediate',
    days_per_week: 4,
    workout_duration: '45_min',
    training_location: 'gym',
    equipment: 'full_gym',
    preferred_training_days: ['tuesday', 'thursday', 'saturday'],
    workout_style: 'upper_lower',
    onboarding_completed: true,
  };

  const userBWithMetadata = {
    id: userBId,
    email: userBEmail,
    provider: 'email' as const,
    app_metadata: { provider: 'email' },
    user_metadata: {
      onboarding_completed: true,
      profile: completedProfileB,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentSegments = ['home'];

    if (jest.isMockFunction(profileService.upsertProfile)) {
      (profileService.upsertProfile as jest.Mock).mockRestore();
    }
    if (jest.isMockFunction(profileService.getProfile)) {
      (profileService.getProfile as jest.Mock).mockRestore();
    }

    profileService.clearMemoryCache();
    useOnboardingStore.getState().resetOnboarding();

    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
    jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
    jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
    jest.spyOn(authService, 'signOut').mockResolvedValue({ success: true, message: 'Signed out.' });
  });

  afterEach(() => {
    cleanup();
  });

  // A. Brand-new account -> onboarding
  it('A: brand-new unprofiled account routes to /onboarding/goal', async () => {
    const newUserId = 'usr_brand_new_123';
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: {
        id: newUserId,
        email: 'newbie@bebig.app',
        user_metadata: {},
      },
    });

    jest.spyOn(profileService, 'getProfile').mockResolvedValue(null);

    const resolution = await resolveAuthenticatedUserRoute(newUserId);
    expect(resolution).not.toBeNull();
    expect(resolution?.route).toBe('/onboarding/goal');
    expect(resolution?.onboardingCompleted).toBe(false);
  });

  // B. Completed account -> Home
  it('B: completed account routes directly to /home and never to onboarding', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    jest.spyOn(profileService, 'getProfile').mockResolvedValue(completedProfileA);

    const resolution = await resolveAuthenticatedUserRoute(userAId);
    expect(resolution).not.toBeNull();
    expect(resolution?.route).toBe('/home');
    expect(resolution?.onboardingCompleted).toBe(true);
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  // C. Completed account -> Navigate to Profile -> no questionnaire
  it('C: navigating to Profile via bottom nav navigates to /settings and never launches onboarding', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    const store = useOnboardingStore.getState();
    store.setGoal('build_muscle');
    store.setExperienceLevel('advanced');
    store.completeOnboarding();

    const { getByTestId } = await render(<BottomNavBar />);
    await waitFor(() => expect(getByTestId('tab-profile')).toBeTruthy());

    await fireEvent.press(getByTestId('tab-profile'));

    expect(mockPush).toHaveBeenCalledWith('/settings');
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/onboarding'));
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('/onboarding'));
  });

  // D. Change Goal -> remains Profile/Home
  it('D: changing Goal in Settings preserves screen state and does not trigger questionnaire', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    const upsertSpy = jest.spyOn(profileService, 'upsertProfile').mockResolvedValue({
      ...completedProfileA,
      goal: 'lose_fat',
      onboarding_completed: true,
    });

    const { getByTestId } = await render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());

    await fireEvent.press(getByTestId('edit-profile-button'));
    await waitFor(() => expect(getByTestId('goal-lose_fat')).toBeTruthy());

    await fireEvent.press(getByTestId('goal-lose_fat'));
    await fireEvent.press(getByTestId('save-profile-button'));

    await waitFor(() => expect(getByTestId('save-success-banner')).toBeTruthy());
    expect(upsertSpy).toHaveBeenCalledWith(
      userAId,
      expect.objectContaining({
        goal: 'lose_fat',
        onboarding_completed: true,
      }),
    );
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/onboarding'));
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining('/onboarding'));
    upsertSpy.mockRestore();
  });

  // E. Change Experience -> remains Profile/Home
  it('E: changing Experience in Settings preserves screen state and does not trigger questionnaire', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    const upsertSpy = jest.spyOn(profileService, 'upsertProfile').mockResolvedValue({
      ...completedProfileA,
      experience_level: 'intermediate',
      onboarding_completed: true,
    });

    const { getByTestId } = await render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());

    await fireEvent.press(getByTestId('edit-profile-button'));
    await waitFor(() => expect(getByTestId('experience-intermediate')).toBeTruthy());

    await fireEvent.press(getByTestId('experience-intermediate'));
    await fireEvent.press(getByTestId('save-profile-button'));

    await waitFor(() => expect(getByTestId('save-success-banner')).toBeTruthy());
    expect(upsertSpy).toHaveBeenCalledWith(
      userAId,
      expect.objectContaining({
        experience_level: 'intermediate',
        onboarding_completed: true,
      }),
    );
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/onboarding'));
    upsertSpy.mockRestore();
  });

  // F. Change Preferences -> remains Profile/Home
  it('F: changing Preferences in Settings updates preferences and stays on Settings', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    const upsertSpy = jest.spyOn(profileService, 'upsertProfile').mockResolvedValue({
      ...completedProfileA,
      days_per_week: 4,
      workout_duration: '45_min',
      onboarding_completed: true,
    });

    const { getByTestId } = await render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());

    await fireEvent.press(getByTestId('edit-profile-button'));
    await waitFor(() => expect(getByTestId('days-4')).toBeTruthy());

    await fireEvent.press(getByTestId('days-4'));
    await fireEvent.press(getByTestId('duration-45_min'));
    await fireEvent.press(getByTestId('save-profile-button'));

    await waitFor(() => expect(getByTestId('save-success-banner')).toBeTruthy());
    expect(upsertSpy).toHaveBeenCalledWith(
      userAId,
      expect.objectContaining({
        days_per_week: 4,
        workout_duration: '45_min',
        onboarding_completed: true,
      }),
    );
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/onboarding'));
    upsertSpy.mockRestore();
  });

  // G. Change Name/Age/Height/Weight -> remains Profile/Home
  it('G: changing personal details updates profile and stays on Settings', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    const upsertSpy = jest.spyOn(profileService, 'upsertProfile').mockResolvedValue({
      ...completedProfileA,
      display_name: 'Aditya Champion',
      age: 28,
      height: 183,
      weight: 84,
      onboarding_completed: true,
    });

    const { getByTestId } = await render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());

    await fireEvent.press(getByTestId('edit-profile-button'));
    await waitFor(() => expect(getByTestId('input-display-name')).toBeTruthy());

    await fireEvent.changeText(getByTestId('input-display-name'), 'Aditya Champion');
    await fireEvent.changeText(getByTestId('input-age'), '28');
    await fireEvent.changeText(getByTestId('input-height'), '183');
    await fireEvent.changeText(getByTestId('input-weight'), '84');
    await fireEvent.press(getByTestId('save-profile-button'));

    await waitFor(() => expect(getByTestId('save-success-banner')).toBeTruthy());
    expect(upsertSpy).toHaveBeenCalledWith(
      userAId,
      expect.objectContaining({
        display_name: 'Aditya Champion',
        age: 28,
        height: 183,
        weight: 84,
        onboarding_completed: true,
      }),
    );
    upsertSpy.mockRestore();
  });

  // H. Profile edit preserves onboarding_completed=true in service layer
  it('H: profileService.upsertProfile strictly preserves onboarding_completed=true', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    jest.spyOn(supabase, 'from').mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { ...completedProfileA, goal: 'lose_fat', onboarding_completed: true },
            error: null,
          }),
        }),
      }),
    } as any);

    const updateUserSpy = jest.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: { user: userAWithMetadata as any },
      error: null,
    });

    // Even if an update payload omits onboarding_completed or attempts false:
    const result = await profileService.upsertProfile(userAId, {
      goal: 'lose_fat',
      onboarding_completed: false as any, // Attacking invariant
    });

    expect(result).not.toBeNull();
    expect(result?.onboarding_completed).toBe(true);

    expect(updateUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_completed: true,
        }),
      }),
    );

    updateUserSpy.mockRestore();
  });

  // I. Logout/login completed account -> Home
  it('I: logout followed by login of completed account routes directly to /home', async () => {
    // 1. Log out
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);

    // 2. Log back in as completed User A
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    jest.spyOn(profileService, 'getProfile').mockResolvedValue(completedProfileA);

    const resolution = await resolveAuthenticatedUserRoute(userAId);
    expect(resolution?.route).toBe('/home');
    expect(resolution?.onboardingCompleted).toBe(true);
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  // J. Same completed account on another device/browser -> Home
  it('J: completed account on secondary device with empty local storage rehydrates from cloud to /home', async () => {
    // Simulate secondary device: localStorage empty, DB table PGRST205 missing
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    profileService.clearMemoryCache();

    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: userAWithMetadata as any },
      error: null,
    });

    jest.spyOn(supabase, 'from').mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST205', message: "Could not find the 'profiles' relation" },
          }),
        }),
      }),
    } as any);

    const resolution = await resolveAuthenticatedUserRoute(userAId);
    expect(resolution?.route).toBe('/home');
    expect(resolution?.onboardingCompleted).toBe(true);
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  // K. Stale local onboarding state cannot force questionnaire
  it('K: stale local onboarding state cannot force completed cloud account into questionnaire', async () => {
    // Stale local state has hasCompletedOnboarding: false
    const store = useOnboardingStore.getState();
    store.resetOnboarding();
    expect(store.hasCompletedOnboarding).toBe(false);

    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    jest.spyOn(profileService, 'getProfile').mockResolvedValue(completedProfileA);

    const resolution = await resolveAuthenticatedUserRoute(userAId);
    expect(resolution?.route).toBe('/home');
    expect(resolution?.onboardingCompleted).toBe(true);
    // Cloud overrides stale local state
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  // L. Account switch completed A -> completed B -> Home
  it('L: account switch completed User A -> completed User B routes directly to /home without cross-contamination', async () => {
    // User A active
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });
    let resA = await resolveAuthenticatedUserRoute(userAId);
    expect(resA?.route).toBe('/home');
    expect(resA?.profile?.display_name).toBe('Athlete Alpha');

    // Switch to User B
    await useAuthStore.getState().signOut();
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userBWithMetadata as any,
    });

    jest.spyOn(profileService, 'getProfile').mockResolvedValue(completedProfileB);

    let resB = await resolveAuthenticatedUserRoute(userBId);
    expect(resB?.route).toBe('/home');
    expect(resB?.profile?.display_name).toBe('Athlete Beta');
    expect(resB?.profile?.goal).toBe('gain_strength');
    expect(useOnboardingStore.getState().goal).toBe('gain_strength');
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  // M. Guest -> Home without questionnaire
  it('M: guest enters /home without questionnaire and survives reloads', async () => {
    useOnboardingStore.getState().completeOnboarding();
    await useAuthStore.getState().enterGuestMode(useOnboardingStore.getState());

    expect(useAuthStore.getState().status).toBe('guest');
    expect(useAuthStore.getState().isGuest).toBe(true);
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);

    const savedGuest = await guestStorage.getOnboardingData();
    expect(savedGuest?.hasCompletedOnboarding).toBe(true);
  });

  // N1. No "Starting Questions" / "Retake Onboarding" action exists for completed users in Settings / Profile
  it('N1: no Starting Questions or Retake Onboarding actions exist for completed users in Profile / Settings', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    // Verify in Settings / Profile
    const settings = await render(<SettingsScreen />);
    await waitFor(() => expect(settings.getByTestId('settings-profile-header-card')).toBeTruthy());

    expect(settings.queryByText(/Starting Questions/i)).toBeNull();
    expect(settings.queryByText(/Retake Questions/i)).toBeNull();
    expect(settings.queryByText(/Redo Onboarding/i)).toBeNull();
    expect(settings.queryByText(/Training Purpose/i)).toBeNull();
    expect(settings.queryByTestId('retake-onboarding-button')).toBeNull();
    expect(settings.queryByTestId('reset-onboarding-button')).toBeNull();

    await settings.unmount();
  });

  // N2. No "Starting Questions" / "Retake Onboarding" action exists for completed users in Home
  it('N2: no Starting Questions or Retake Onboarding actions exist for completed users in Home', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });

    // Verify in Home
    const home = await render(<HomeScreen />);
    await waitFor(
      () => {
        expect(home.getByTestId('home-title')).toBeTruthy();
        expect(home.getByTestId('metric-weekly-goal-card')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    expect(home.queryByText(/Starting Questions/i)).toBeNull();
    expect(home.queryByText(/Retake Questions/i)).toBeNull();
    expect(home.queryByText(/Redo Onboarding/i)).toBeNull();
    expect(home.queryByTestId('retake-onboarding-button')).toBeNull();
    expect(home.queryByTestId('reset-onboarding-button')).toBeNull();
    await home.unmount();
  });

  // Guard 1: Direct navigation to /onboarding/goal redirects completed user to /home
  it('Guard 1: direct navigation to /onboarding/goal redirects completed user to /home', async () => {
    mockReplace.mockClear();
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });
    useOnboardingStore.getState().completeOnboarding();

    const screen = await render(<GoalScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
    await screen.unmount();
  });

  // Guard 2: Direct navigation to /onboarding/experience redirects completed user to /home
  it('Guard 2: direct navigation to /onboarding/experience redirects completed user to /home', async () => {
    mockReplace.mockClear();
    useAuthStore.setState({
      status: 'authenticated',
      isGuest: false,
      user: userAWithMetadata as any,
    });
    useOnboardingStore.getState().completeOnboarding();

    const screen = await render(<ExperienceScreen />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
    await screen.unmount();
  });
});
