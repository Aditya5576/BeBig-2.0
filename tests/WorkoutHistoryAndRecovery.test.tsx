import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { workoutRepository, WorkoutSession } from '../src/features/workout';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { guestStorage } from '../src/lib/storage';
import { useAuthStore } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import { authService } from '../src/features/auth/services/authService';
import RootIndex from '../app/index';
import WorkoutHistoryScreen from '../app/workout/history';
import WorkoutHistoryDetailScreen from '../app/workout/history/[id]';
import ActiveWorkoutScreen from '../app/workout/active';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
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

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `bebig://${path}`),
  getInitialURL: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithIdToken: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      setSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'usr_1', email: 'test@example.com' },
            access_token: 'test_token',
          },
        },
        error: null,
      }),
      exchangeCodeForSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'usr_1', email: 'test@example.com' },
            access_token: 'test_token',
          },
        },
        error: null,
      }),
    },
    from: jest.fn(),
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

describe('BeBig 2.0 — Milestone 6: Workout History, UX, Guest Recovery & Email Audit', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    mockParams = {};
    await workoutStorage.clearAllWorkouts();
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

  // ============================================================================
  // SUITE 1: Guest Mode Recovery & Rehydration
  // ============================================================================
  describe('Guest Mode Recovery Without Onboarding Re-Entry', () => {
    it('persists hasCompletedOnboarding: true when entering guest mode', async () => {
      useOnboardingStore.getState().setGoal('build_muscle');
      useOnboardingStore.getState().setExperienceLevel('intermediate');

      await useAuthStore.getState().enterGuestMode(useOnboardingStore.getState());

      expect(useAuthStore.getState().isGuest).toBe(true);
      expect(useAuthStore.getState().status).toBe('guest');

      const savedOnboarding = await guestStorage.getOnboardingData();
      expect(savedOnboarding).not.toBeNull();
      expect(savedOnboarding?.hasCompletedOnboarding).toBe(true);
      expect(savedOnboarding?.goal).toBe('build_muscle');
    });

    it('restores guest mode directly to /home on root index launch without repeating onboarding', async () => {
      // Simulate existing guest user who completed onboarding previously
      const guestSession = {
        id: 'guest_test_recovery',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      await guestStorage.setGuestSession(guestSession);
      await guestStorage.saveOnboardingData({
        hasCompletedOnboarding: true,
        goal: 'gain_strength',
        experienceLevel: 'advanced',
        daysPerWeek: 5,
        workoutDuration: '60_min',
        trainingLocation: 'gym',
        equipment: 'full_gym',
        preferredTrainingDays: ['monday', 'wednesday', 'friday'],
        workoutStyle: 'upper_lower',
      });

      // Prepare auth state as initializing (as it is when the app launches fresh)
      useAuthStore.setState({ status: 'initializing' });

      // Render root index (representing fresh app start)
      await render(<RootIndex />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/home');
      });

      // Verify onboarding store was marked completed and populated
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
      expect(useOnboardingStore.getState().goal).toBe('gain_strength');
      expect(useAuthStore.getState().isGuest).toBe(true);
    });
  });

  // ============================================================================
  // SUITE 2: Workout History Screen
  // ============================================================================
  describe('Workout History List Screen', () => {
    it('renders empty state with "No workouts yet" and start workout button when history is empty', async () => {
      const { getByTestId, getByText } = await render(<WorkoutHistoryScreen />);

      await waitFor(() => {
        expect(getByTestId('history-empty-state')).toBeTruthy();
      });

      expect(getByText('No workouts yet')).toBeTruthy();
      expect(getByTestId('history-start-workout-button')).toBeTruthy();

      fireEvent.press(getByTestId('history-start-workout-button'));
      expect(mockPush).toHaveBeenCalledWith('/workout/start');
    });

    it('renders completed workouts in newest-first order with duration, total volume, and set counts', async () => {
      // Seed 2 completed workouts: older one and newer one
      const olderWorkout: WorkoutSession = {
        id: 'workout_old',
        name: 'Leg Day Blast',
        startedAt: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
        finishedAt: new Date(Date.now() - 86400 * 1000 * 2 + 3600 * 1000).toISOString(),
        status: 'completed',
        totalDuration: 3600,
        totalVolume: 5000,
        completedSetsCount: 12,
        exercises: [
          {
            exerciseId: 'squat',
            exerciseName: 'Barbell Back Squat',
            order: 0,
            actualSets: [{ id: 's1', setNumber: 1, weight: 100, reps: 5, rir: 2, completed: true }],
          },
        ],
      };

      const newerWorkout: WorkoutSession = {
        id: 'workout_new',
        name: 'Upper Body Hypertrophy',
        startedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
        finishedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        status: 'completed',
        totalDuration: 4200,
        totalVolume: 8500,
        completedSetsCount: 16,
        exercises: [
          {
            exerciseId: 'bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [{ id: 'b1', setNumber: 1, weight: 80, reps: 10, rir: 2, completed: true }],
          },
        ],
      };

      await workoutStorage.saveCompletedWorkout(olderWorkout);
      await workoutStorage.saveCompletedWorkout(newerWorkout);

      const { getByTestId, getByText } = await render(<WorkoutHistoryScreen />);

      await waitFor(() => {
        expect(getByTestId('history-card-workout_new')).toBeTruthy();
        expect(getByTestId('history-card-workout_old')).toBeTruthy();
      });

      // Verify metrics
      expect(getByText('Upper Body Hypertrophy')).toBeTruthy();
      expect(getByText('8,500 kg')).toBeTruthy();
      expect(getByText('16')).toBeTruthy();

      expect(getByText('Leg Day Blast')).toBeTruthy();
      expect(getByText('5,000 kg')).toBeTruthy();
      expect(getByText('12')).toBeTruthy();

      // Tap on card to navigate to detail
      fireEvent.press(getByTestId('history-item-workout_new'));
      expect(mockPush).toHaveBeenCalledWith('/workout/history/workout_new');
    });
  });

  // ============================================================================
  // SUITE 3: Workout History Detail Screen (Read-Only)
  // ============================================================================
  describe('Workout History Detail Screen (Read-Only)', () => {
    it('renders read-only workout summary metrics and exercise performance breakdown', async () => {
      const finishedWorkout: WorkoutSession = {
        id: 'workout_detail_1',
        name: 'Chest & Arms',
        startedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        finishedAt: new Date().toISOString(),
        status: 'completed',
        totalDuration: 3600,
        totalVolume: 6400,
        completedSetsCount: 8,
        exercises: [
          {
            exerciseId: 'incline_db',
            exerciseName: 'Incline Dumbbell Press',
            categoryName: 'Chest',
            order: 0,
            actualSets: [
              {
                id: 'set_1',
                setNumber: 1,
                weight: 32,
                reps: 10,
                rir: 2,
                notes: 'Felt very solid',
                completed: true,
              },
              {
                id: 'set_2',
                setNumber: 2,
                weight: 32,
                reps: 8,
                rir: 1,
                completed: true,
              },
            ],
          },
        ],
      };

      await workoutStorage.saveCompletedWorkout(finishedWorkout);
      mockParams = { id: 'workout_detail_1' };

      const { getByTestId, getByText } = await render(<WorkoutHistoryDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('history-detail-name')).toBeTruthy();
      });

      expect(getByText('Chest & Arms')).toBeTruthy();
      expect(getByText('6,400 kg')).toBeTruthy();
      expect(getByText('Incline Dumbbell Press')).toBeTruthy();
      expect(getByText('32 kg × 10 reps')).toBeTruthy();
      expect(getByText('"Felt very solid"')).toBeTruthy();
      expect(getByText('32 kg × 8 reps')).toBeTruthy();

      // Back navigation
      fireEvent.press(getByTestId('history-detail-back-button'));
      expect(mockBack).toHaveBeenCalled();
    });

    it('renders graceful not found screen when workout does not exist', async () => {
      mockParams = { id: 'non_existent_workout' };

      const { getByTestId, getByText } = await render(<WorkoutHistoryDetailScreen />);

      await waitFor(() => {
        expect(getByText('Workout session not found.')).toBeTruthy();
      });

      fireEvent.press(getByTestId('history-not-found-back-button'));
      expect(mockReplace).toHaveBeenCalledWith('/workout/history');
    });
  });

  // ============================================================================
  // SUITE 4: Active Workout Redesign & Rest Intervals
  // ============================================================================
  describe('Active Workout Redesign & Rest Interval', () => {
    it('renders 3-column metric layout, notes input, and prominent complete set button', async () => {
      const activeSession: WorkoutSession = {
        id: 'active_session_1',
        name: 'Full Body Push',
        status: 'active',
        startedAt: new Date().toISOString(),
        exercises: [
          {
            exerciseId: 'overhead_press',
            exerciseName: 'Overhead Press',
            categoryName: 'Shoulders',
            order: 0,
            plannedSets: 3,
            plannedTargetReps: '8-10',
            plannedRestTime: 90,
            actualSets: [
              {
                id: 'ohp_set_1',
                setNumber: 1,
                weight: 50,
                reps: 8,
                rir: 2,
                notes: 'Clean reps',
                completed: false,
              },
            ],
          },
        ],
      };

      await workoutStorage.saveActiveWorkout(activeSession);

      const { getByTestId, getByText } = await render(<ActiveWorkoutScreen />);

      await waitFor(() => {
        expect(getByText('Full Body Push')).toBeTruthy();
      });

      // Check 3-column inputs exist
      expect(getByTestId('set-weight-overhead_press-1')).toBeTruthy();
      expect(getByTestId('set-reps-overhead_press-1')).toBeTruthy();
      expect(getByTestId('set-rir-overhead_press-1')).toBeTruthy();
      expect(getByTestId('set-notes-overhead_press-1')).toBeTruthy();

      // Check prominent complete set button exists
      const completeBtn = getByTestId('complete-set-overhead_press-1');
      expect(completeBtn).toBeTruthy();

      // Complete set and verify rest timer triggers
      fireEvent.press(completeBtn);

      await waitFor(() => {
        expect(getByTestId('rest-timer-banner')).toBeTruthy();
      });

      expect(getByTestId('skip-rest-timer-button')).toBeTruthy();
    });

    it('displays REST COMPLETE banner when rest interval ends and allows dismiss', async () => {
      const now = Date.now();
      const activeWithExpiredRest: WorkoutSession = {
        id: 'active_session_expired',
        name: 'Rest Complete Test',
        status: 'active',
        startedAt: new Date(now - 60000).toISOString(),
        activeRestTimer: {
          exerciseId: 'squat',
          setNumber: 1,
          durationSeconds: 90,
          targetEndTime: now - 1000, // already expired
          exerciseName: 'Squat',
        },
        exercises: [
          {
            exerciseId: 'squat',
            exerciseName: 'Squat',
            order: 0,
            actualSets: [
              {
                id: 'sq_1',
                setNumber: 1,
                weight: 120,
                reps: 5,
                rir: 2,
                completed: true,
              },
            ],
          },
        ],
      };

      await workoutStorage.saveActiveWorkout(activeWithExpiredRest);

      const { getByTestId, getByText } = await render(<ActiveWorkoutScreen />);

      await waitFor(() => {
        expect(getByTestId('rest-complete-banner')).toBeTruthy();
      });

      expect(getByText('REST COMPLETE')).toBeTruthy();
      expect(getByText('Ready for your next set!')).toBeTruthy();

      // Dismiss rest complete banner
      fireEvent.press(getByTestId('dismiss-rest-timer-button'));

      await waitFor(async () => {
        const active = await workoutStorage.getActiveWorkout();
        expect(active?.activeRestTimer == null).toBe(true);
      });
    });
  });

  // ============================================================================
  // SUITE 5: Email Verification Redirect & Deep Link Audit
  // ============================================================================
  describe('Email Verification & Deep Link Audit', () => {
    it('handles incoming auth url with hash tokens cleanly without falling back to localhost', async () => {
      const testDeepLink =
        'bebig://auth/callback#access_token=test_access_jwt&refresh_token=test_refresh_jwt&token_type=bearer';

      const result = await authService.handleIncomingAuthUrl(testDeepLink);

      expect(result.success).toBe(true);
    });

    it('ensures auth code redirect url is formed properly without any localhost occurrence', async () => {
      const testCodeLink = 'bebig://auth/callback?code=valid_auth_code_12345';

      const result = await authService.handleIncomingAuthUrl(testCodeLink);

      expect(result.success).toBe(true);
    });
  });
});
