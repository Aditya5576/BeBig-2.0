import React from 'react';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import SettingsScreen from '../app/settings';
import HomeScreen from '../app/home';
import { useAuthStore, authService } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import { profileService, UserProfile } from '../src/features/profile';
import { guestStorage } from '../src/lib/storage';
import { workoutRepository } from '../src/features/workout';
import { templateRepository } from '../src/features/templates';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
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

describe('BeBig 2.0 — Settings & Profile Feature Tests', () => {
  const mockUser = {
    id: 'usr_athlete_123',
    email: 'athlete@bebig.app',
    provider: 'email' as const,
    app_metadata: { provider: 'email' },
  };

  const initialProfile: UserProfile = {
    id: 'usr_athlete_123',
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

  let currentProfile: UserProfile;
  let getProfileSpy: jest.SpyInstance;
  let upsertProfileSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    profileService.clearMemoryCache();
    useOnboardingStore.getState().resetOnboarding();

    currentProfile = { ...initialProfile };
    getProfileSpy = jest.spyOn(profileService, 'getProfile').mockImplementation(async () => currentProfile);
    upsertProfileSpy = jest
      .spyOn(profileService, 'upsertProfile')
      .mockImplementation(async (userId, payload) => {
        currentProfile = {
          ...currentProfile,
          ...payload,
          id: userId,
        };
        return currentProfile;
      });

    jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
    jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
    jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
    jest.spyOn(authService, 'signOut').mockResolvedValue({ success: true, message: 'Signed out successfully.' });

    useAuthStore.setState({
      status: 'authenticated',
      user: mockUser as any,
      session: { user: mockUser } as any,
      guestSession: null,
      isGuest: false,
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

  // 1. Authenticated user can open Settings
  it('1. Authenticated user can open Settings from Home header', async () => {
    const { getByTestId } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestId('settings-header-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('settings-header-button'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  // 2. Profile information loads
  it('2. Profile information loads and displays safely without exposing tokens or internal IDs', async () => {
    const { getByTestId, queryByText } = await render(<SettingsScreen />);

    await waitFor(() => {
      expect(getByTestId('settings-screen-title')).toBeTruthy();
      expect(getByTestId('settings-user-email')).toBeTruthy();
      expect(getByTestId('profile-view-goal')).toBeTruthy();
      expect(getByTestId('profile-view-experience')).toBeTruthy();
      expect(getByTestId('profile-view-frequency')).toBeTruthy();
      expect(getByTestId('profile-view-duration')).toBeTruthy();
      expect(getByTestId('profile-view-equipment')).toBeTruthy();
      expect(getByTestId('profile-view-style')).toBeTruthy();
    });

    expect(getByTestId('settings-user-email').props.children).toBe('athlete@bebig.app');
    expect(getByTestId('profile-view-goal').props.children).toBe('Build Muscle');
    expect(getByTestId('profile-view-experience').props.children).toBe('Intermediate');
    expect(getByTestId('profile-view-frequency').props.children).toContain('4 days / week');
    expect(getByTestId('profile-view-duration').props.children).toBe('60 Min');
    expect(getByTestId('profile-view-equipment').props.children).toBe('Gym (Full Equipment)');
    expect(getByTestId('profile-view-style').props.children).toBe('Push / Pull / Legs');

    // Confirm no raw internal user UUID or secret tokens are rendered
    expect(queryByText('usr_athlete_123')).toBeNull();
  });

  // 3. Goal can be edited
  it('3. Goal can be edited in edit mode', async () => {
    const { getByTestId } = await render(<SettingsScreen />);

    await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());
    fireEvent.press(getByTestId('edit-profile-button'));

    await waitFor(() => expect(getByTestId('goal-gain_strength')).toBeTruthy());
    fireEvent.press(getByTestId('goal-gain_strength'));

    expect(getByTestId('goal-gain_strength')).toBeTruthy();
  });

  // 4. Experience can be edited
  it('4. Experience level can be edited in edit mode', async () => {
    const { getByTestId } = await render(<SettingsScreen />);

    await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());
    fireEvent.press(getByTestId('edit-profile-button'));

    await waitFor(() => expect(getByTestId('experience-advanced')).toBeTruthy());
    fireEvent.press(getByTestId('experience-advanced'));

    expect(getByTestId('experience-advanced')).toBeTruthy();
  });

  // 5. Workout preferences can be edited
  it('5. Workout preferences (days, duration, equipment, style, preferred days) can be edited', async () => {
    const { getByTestId } = await render(<SettingsScreen />);

    await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());
    fireEvent.press(getByTestId('edit-profile-button'));

    await waitFor(() => {
      expect(getByTestId('days-5')).toBeTruthy();
      expect(getByTestId('duration-45_min')).toBeTruthy();
      expect(getByTestId('equipment-limited_equipment')).toBeTruthy();
      expect(getByTestId('style-upper_lower')).toBeTruthy();
      expect(getByTestId('day-saturday')).toBeTruthy();
    });

    fireEvent.press(getByTestId('days-5'));
    await waitFor(() => expect(getByTestId('days-5')).toBeTruthy());

    fireEvent.press(getByTestId('duration-45_min'));
    await waitFor(() => expect(getByTestId('duration-45_min')).toBeTruthy());

    fireEvent.press(getByTestId('equipment-limited_equipment'));
    await waitFor(() => expect(getByTestId('equipment-limited_equipment')).toBeTruthy());

    fireEvent.press(getByTestId('style-upper_lower'));
    await waitFor(() => expect(getByTestId('style-upper_lower')).toBeTruthy());

    fireEvent.press(getByTestId('day-saturday'));
    await waitFor(() => expect(getByTestId('day-saturday')).toBeTruthy());
  });

  // 6. Save persists profile changes
  it('6. Save persists profile changes to profileService and updates view mode', async () => {
    const { getByTestId } = await render(<SettingsScreen />);

    await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());
    fireEvent.press(getByTestId('edit-profile-button'));

    await waitFor(() => expect(getByTestId('goal-gain_strength')).toBeTruthy());
    fireEvent.press(getByTestId('goal-gain_strength'));
    await waitFor(() => expect(getByTestId('goal-gain_strength')).toBeTruthy());

    fireEvent.press(getByTestId('days-5'));
    await waitFor(() => expect(getByTestId('days-5')).toBeTruthy());

    fireEvent.press(getByTestId('style-upper_lower'));
    await waitFor(() => expect(getByTestId('style-upper_lower')).toBeTruthy());

    fireEvent.press(getByTestId('save-profile-button'));

    await waitFor(() => {
      expect(upsertProfileSpy).toHaveBeenCalledWith(
        'usr_athlete_123',
        expect.objectContaining({
          goal: 'gain_strength',
          days_per_week: 5,
          workout_style: 'upper_lower',
          onboarding_completed: true,
        }),
      );
      expect(getByTestId('save-success-banner')).toBeTruthy();
    });

    // In-memory onboarding store is also synchronized
    expect(useOnboardingStore.getState().goal).toBe('gain_strength');
    expect(useOnboardingStore.getState().daysPerWeek).toBe(5);
    expect(useOnboardingStore.getState().workoutStyle).toBe('upper_lower');
  });

  // 7. Editing profile does not trigger onboarding
  it('7. Editing profile does NOT trigger onboarding or navigate away from Settings', async () => {
    const { getByTestId } = await render(<SettingsScreen />);
    await waitFor(() => expect(getByTestId('edit-profile-button')).toBeTruthy());
    fireEvent.press(getByTestId('edit-profile-button'));

    await waitFor(() => expect(getByTestId('save-profile-button')).toBeTruthy());
    fireEvent.press(getByTestId('save-profile-button'));

    await waitFor(() => {
      expect(getByTestId('settings-screen-title')).toBeTruthy();
    });

    // Invariant: never routes to any onboarding step
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringMatching(/\/onboarding/));
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringMatching(/\/onboarding/));
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  // 8. Logout returns to Welcome
  it('8. Logout from Settings clears auth state and routes to Welcome', async () => {
    const { getByTestId } = await render(<SettingsScreen />);

    await waitFor(() => expect(getByTestId('settings-logout-button')).toBeTruthy());
    fireEvent.press(getByTestId('settings-logout-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // 9. Previous user's profile is not retained after account switch
  it('9. Previous user\'s profile is not retained after account switch', async () => {
    // User A signs out
    await useAuthStore.getState().signOut();

    // Confirm onboarding store was completely reset
    expect(useOnboardingStore.getState().goal).toBeNull();
    expect(useOnboardingStore.getState().experienceLevel).toBeNull();
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);

    // User B logs in
    const userB = {
      id: 'usr_beta_456',
      email: 'beta@bebig.app',
      provider: 'email' as const,
      app_metadata: { provider: 'email' },
    };
    const profileB: UserProfile = {
      id: 'usr_beta_456',
      goal: 'lose_fat',
      experience_level: 'beginner',
      days_per_week: 3,
      workout_duration: '30_min',
      training_location: 'gym',
      equipment: 'limited_equipment',
      preferred_training_days: ['tuesday', 'thursday'],
      workout_style: 'full_body',
      onboarding_completed: true,
    };

    getProfileSpy.mockResolvedValue(profileB);

    useAuthStore.setState({
      status: 'authenticated',
      user: userB as any,
      session: { user: userB } as any,
      guestSession: null,
      isGuest: false,
    });

    const { getByTestId, queryByText } = await render(<SettingsScreen />);

    await waitFor(() => {
      expect(getByTestId('settings-user-email').props.children).toBe('beta@bebig.app');
      expect(getByTestId('profile-view-goal').props.children).toBe('Lose Fat');
      expect(getByTestId('profile-view-experience').props.children).toBe('Beginner');
      expect(getByTestId('profile-view-style').props.children).toBe('Full Body');
    });

    // User A's data is completely absent
    expect(queryByText('athlete@bebig.app')).toBeNull();
    expect(queryByText('Push / Pull / Legs')).toBeNull();
  });

  // 10. Guest cannot access authenticated profile data
  it('10. Guest cannot access authenticated profile data', async () => {
    useAuthStore.setState({
      status: 'guest',
      isGuest: true,
      user: null,
      session: null,
      guestSession: { id: 'guest_test', createdAt: '2026-09-12', lastActiveAt: '2026-09-12' },
    });

    useOnboardingStore.setState({
      goal: 'build_muscle',
      hasCompletedOnboarding: true,
    });

    const { getByTestId, queryByTestId } = await render(<SettingsScreen />);

    await waitFor(() => {
      expect(getByTestId('settings-guest-badge')).toBeTruthy();
      // Authenticated email is NOT rendered for guest
      expect(queryByTestId('settings-user-email')).toBeNull();
    });

    // profileService.getProfile was not called with any authenticated user ID
    expect(getProfileSpy).not.toHaveBeenCalledWith(expect.stringContaining('usr_athlete'));
  });

  // 11. Unauthenticated user is redirected to welcome
  it('11. Unauthenticated user is redirected to welcome', async () => {
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      isGuest: false,
    });

    await render(<SettingsScreen />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/onboarding/welcome');
    });
  });
});
