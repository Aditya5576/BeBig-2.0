import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../app/home';
import { useAuthStore } from '../src/features/auth';
import { profileService } from '../src/features/profile';
import { guestStorage } from '../src/lib/storage';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Issue #7 — Profile Photo Visible Properly on Home', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    profileService.clearMemoryCache();
  });

  it('1. Profile with valid avatar photo -> Home renders profile avatar image', async () => {
    const userA = { id: 'usr_avatar_1', email: 'alex@bebig.app' };
    useAuthStore.setState({
      status: 'authenticated',
      user: userA as any,
      isGuest: false,
    });

    await profileService.upsertProfile(userA.id, {
      id: userA.id,
      display_name: 'Alex Rivera',
      avatar_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48',
      goal: 'build_muscle',
      experience_level: 'intermediate',
      days_per_week: 4,
      workout_duration: '45_min',
      training_location: 'gym',
      equipment: 'full_gym',
      preferred_training_days: ['monday', 'wednesday', 'friday'],
      workout_style: 'push_pull_legs',
      onboarding_completed: true,
    });

    const { getByTestId, queryByTestId } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestId('home-avatar-image')).toBeTruthy();
      expect(queryByTestId('home-avatar-fallback')).toBeNull();
    });
  });

  it('2. Profile without photo -> Home renders initials fallback', async () => {
    const userB = { id: 'usr_avatar_2', email: 'sam@bebig.app' };
    useAuthStore.setState({
      status: 'authenticated',
      user: userB as any,
      isGuest: false,
    });

    await profileService.upsertProfile(userB.id, {
      id: userB.id,
      display_name: 'Sam Taylor',
      avatar_url: null,
      goal: 'gain_strength',
      experience_level: 'beginner',
      days_per_week: 3,
      workout_duration: '30_min',
      training_location: 'gym',
      equipment: 'full_gym',
      preferred_training_days: [],
      workout_style: 'full_body',
      onboarding_completed: true,
    });

    const { getByTestId, queryByTestId, getByText } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestId('home-avatar-fallback')).toBeTruthy();
      expect(getByText('ST')).toBeTruthy();
      expect(queryByTestId('home-avatar-image')).toBeNull();
    });
  });

  it('3. Guest Mode -> Home renders guest fallback cleanly', async () => {
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      isGuest: true,
    });

    jest.spyOn(guestStorage, 'getOnboardingData').mockResolvedValue({
      hasCompletedOnboarding: true,
      daysPerWeek: 3,
    } as any);

    const { getByTestId, queryByTestId, getByText } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestId('home-avatar-fallback')).toBeTruthy();
      expect(getByText('BB')).toBeTruthy();
      expect(queryByTestId('home-avatar-image')).toBeNull();
    });
  });

  it('4. Account switch -> Previous user photo does not remain', async () => {
    // User A has photo
    const userA = { id: 'usr_switch_A', email: 'usera@bebig.app' };
    await profileService.upsertProfile(userA.id, {
      id: userA.id,
      display_name: 'User A',
      avatar_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48',
      onboarding_completed: true,
      training_location: 'gym',
      preferred_training_days: [],
      goal: null,
      experience_level: null,
      days_per_week: null,
      workout_duration: null,
      equipment: null,
      workout_style: null,
    });

    useAuthStore.setState({ status: 'authenticated', user: userA as any, isGuest: false });

    const { getByTestId, unmount } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestId('home-avatar-image')).toBeTruthy();
    });

    unmount();

    // Switch to User B (no photo)
    const userB = { id: 'usr_switch_B', email: 'userb@bebig.app' };
    await profileService.upsertProfile(userB.id, {
      id: userB.id,
      display_name: 'User B',
      avatar_url: null,
      onboarding_completed: true,
      training_location: 'gym',
      preferred_training_days: [],
      goal: null,
      experience_level: null,
      days_per_week: null,
      workout_duration: null,
      equipment: null,
      workout_style: null,
    });

    useAuthStore.setState({ status: 'authenticated', user: userB as any, isGuest: false });

    const { getByTestId: getByTestIdB, queryByTestId: queryByTestIdB } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestIdB('home-avatar-fallback')).toBeTruthy();
      expect(queryByTestIdB('home-avatar-image')).toBeNull();
    });
  });

  it('5 & 6. Image load error -> Graceful fallback to initials', async () => {
    const userC = { id: 'usr_broken_img', email: 'broken@bebig.app' };
    await profileService.upsertProfile(userC.id, {
      id: userC.id,
      display_name: 'Charlie Brown',
      avatar_url: 'https://invalid-domain-404.app/broken.jpg',
      onboarding_completed: true,
      training_location: 'gym',
      preferred_training_days: [],
      goal: null,
      experience_level: null,
      days_per_week: null,
      workout_duration: null,
      equipment: null,
      workout_style: null,
    });

    useAuthStore.setState({ status: 'authenticated', user: userC as any, isGuest: false });

    const { getByTestId, queryByTestId } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestId('home-avatar-image')).toBeTruthy();
    });

    // Simulate image loading failure
    fireEvent(getByTestId('home-avatar-image'), 'error');

    await waitFor(() => {
      expect(getByTestId('home-avatar-fallback')).toBeTruthy();
      expect(queryByTestId('home-avatar-image')).toBeNull();
    });
  });

  it('7. Tapping home avatar opens Profile & Settings', async () => {
    const userD = { id: 'usr_nav', email: 'nav@bebig.app' };
    await profileService.upsertProfile(userD.id, {
      id: userD.id,
      display_name: 'Nav User',
      avatar_url: null,
      onboarding_completed: true,
      training_location: 'gym',
      preferred_training_days: [],
      goal: null,
      experience_level: null,
      days_per_week: null,
      workout_duration: null,
      equipment: null,
      workout_style: null,
    });

    useAuthStore.setState({ status: 'authenticated', user: userD as any, isGuest: false });

    const { getByTestId } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByTestId('home-profile-button')).toBeTruthy();
    });

    fireEvent.press(getByTestId('home-profile-button'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});
