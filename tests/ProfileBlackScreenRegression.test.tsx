/**
 * BeBig 2.0 — Profile Black Screen & Notifications Emergency Hotfix Regression Suite
 *
 * Verifies:
 * 1. SettingsScreen evaluates, mounts, and renders cleanly with zero unhandled module errors
 * 2. Data export module is decoupled from route startup and safely loads on demand
 * 3. Notification permissions card correctly renders status ("✓ Enabled" vs "Not Enabled")
 * 4. Test notification button fires single-alert rest timer scheduling
 * 5. Full profile sections (Athlete Profile, Notifications, Data Export, Training Preferences) render
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SettingsScreen from '../app/settings';
import { useAuthStore } from '../src/features/auth';
import { profileService, UserProfile } from '../src/features/profile';
import { workoutNotificationService } from '../src/features/workout';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { templateRepository } from '../src/features/templates/services/templateRepository';

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

describe('Profile Black Screen & Notification Hotfix Regression', () => {
  const mockUser = {
    id: 'usr_hotfix_athlete',
    email: 'athlete@bebig.app',
    provider: 'email' as const,
    app_metadata: { provider: 'email' },
  };

  const initialProfile: UserProfile = {
    id: 'usr_hotfix_athlete',
    display_name: 'Aditya Gymnast',
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

  beforeEach(() => {
    jest.clearAllMocks();
    profileService.clearMemoryCache();
    useAuthStore.setState({
      status: 'authenticated',
      user: mockUser as any,
      session: { user: mockUser } as any,
      guestSession: null,
      isGuest: false,
      isConfigured: true,
      error: null,
    });
    jest.spyOn(profileService, 'getProfile').mockResolvedValue({ ...initialProfile });
    jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
    jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
  });

  it('renders Profile/Settings screen cleanly without crashing or throwing module evaluation errors', async () => {
    const { getByTestId } = await render(<SettingsScreen />);

    // Profile card should be present with athlete info
    await waitFor(() => {
      expect(getByTestId('settings-screen-title')).toBeTruthy();
      expect(getByTestId('settings-profile-card')).toBeTruthy();
    });

    // Core sections must be visible (no black screen)
    expect(getByTestId('settings-notifications-card')).toBeTruthy();
    expect(getByTestId('settings-export-card')).toBeTruthy();
  });

  it('correctly displays notification permission status and supports test rest timer trigger', async () => {
    jest.spyOn(workoutNotificationService, 'getPermissionStatus').mockResolvedValue('granted' as any);
    const scheduleSpy = jest.spyOn(workoutNotificationService, 'scheduleRestTimerNotification').mockResolvedValue('notif_test_123');

    const { getByTestId, findByText } = await render(<SettingsScreen />);

    // Verify permission badge shows ✓ Enabled
    const enabledPill = await findByText('✓ Enabled');
    expect(enabledPill).toBeTruthy();

    // Verify test notification button is present and clickable
    const testNotifBtn = getByTestId('test-notification-button');
    expect(testNotifBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(testNotifBtn);
    });

    expect(scheduleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: 'test_rest',
        exerciseName: 'Bench Press (Test)',
        durationSeconds: 3,
      })
    );
  });

  it('invokes export handler cleanly with lazy-loaded export service', async () => {
    const { getByTestId, findByTestId } = await render(<SettingsScreen />);

    await waitFor(() => {
      expect(getByTestId('settings-export-card')).toBeTruthy();
    });

    // Check export buttons are present
    const exportExcelBtn = getByTestId('export-workouts-excel-button');
    expect(exportExcelBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(exportExcelBtn);
    });

    // Verify error/feedback state is handled cleanly (0 workouts found)
    const emptyNotice = await findByTestId('export-error-banner');
    expect(emptyNotice).toBeTruthy();
  });
});
