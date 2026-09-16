import React from 'react';
import { render, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import HomeScreen from '../app/home';
import { useAuthStore } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import { workoutRepository, WorkoutSession } from '../src/features/workout';
import { templateRepository, WorkoutTemplate } from '../src/features/templates';

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

// Spies on external services
const alertSpy = jest.spyOn(Alert, 'alert');
const getCompletedWorkoutsSpy = jest.spyOn(workoutRepository, 'getCompletedWorkouts');
const getActiveWorkoutSpy = jest.spyOn(workoutRepository, 'getActiveWorkout');
const discardActiveWorkoutSpy = jest.spyOn(workoutRepository, 'discardActiveWorkout');
const startWorkoutFromTemplateSpy = jest.spyOn(workoutRepository, 'startWorkoutFromTemplate');
const startEmptyWorkoutSpy = jest.spyOn(workoutRepository, 'startEmptyWorkout');
const getTemplatesSpy = jest.spyOn(templateRepository, 'getTemplates');

describe('Milestone 8 — Home Dashboard Integration Tests', () => {
  const mockTemplates: WorkoutTemplate[] = [
    {
      id: 'tpl-1',
      name: 'Push Day',
      exercises: [
        {
          exerciseId: 'ex-bench',
          exerciseName: 'Barbell Bench Press',
          order: 0,
          sets: 3,
          targetReps: '8-10',
          restTime: 90,
          targetWeight: 80,
        },
        {
          exerciseId: 'ex-overhead',
          exerciseName: 'Overhead Press',
          order: 1,
          sets: 3,
          targetReps: '10-12',
          restTime: 90,
          targetWeight: 45,
        },
      ],
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'tpl-2',
      name: 'Pull Day',
      exercises: [
        {
          exerciseId: 'ex-pullup',
          exerciseName: 'Weighted Pull-Up',
          order: 0,
          sets: 3,
          targetReps: '6-8',
          restTime: 120,
          targetWeight: 20,
        },
      ],
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
  ];

  const mockSignOut = jest.fn().mockResolvedValue(undefined);
  const mockExitGuestMode = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();

    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'test-athlete', email: 'athlete@bebig.app' },
      isGuest: false,
      session: null,
      guestSession: null,
      error: null,
      isConfigured: true,
      signOut: mockSignOut,
      exitGuestMode: mockExitGuestMode,
    });

    useOnboardingStore.setState({
      daysPerWeek: 4,
      hasCompletedOnboarding: true,
    });

    getCompletedWorkoutsSpy.mockResolvedValue([]);
    getActiveWorkoutSpy.mockResolvedValue(null);
    discardActiveWorkoutSpy.mockResolvedValue();
    startWorkoutFromTemplateSpy.mockResolvedValue({} as any);
    startEmptyWorkoutSpy.mockResolvedValue({} as any);
    getTemplatesSpy.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  // Scenario 1: New lifter with zero workouts displays clean empty dashboard
  it('Scenario 1: New user with no workout history displays intentional empty dashboard without fake numbers', async () => {
    const { getByTestId, getByText } = await render(<HomeScreen />);

    // Wait for data load
    await waitFor(
      () => {
        expect(getByTestId('home-title')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // Verify analytics cards show 0, not fake numbers
    expect(getByTestId('metric-weekly-goal-card')).toBeTruthy();
    expect(getByText('0 / 4 Workouts')).toBeTruthy();
    expect(getByText('Start your first workout to begin your streak.')).toBeTruthy();

    expect(getByTestId('metric-streak-card')).toBeTruthy();
    expect(getByText('🔥 0 Days')).toBeTruthy();

    expect(getByTestId('metric-volume-card')).toBeTruthy();
    expect(getByText('0 kg')).toBeTruthy();

    expect(getByTestId('metric-prs-card')).toBeTruthy();
    expect(getByText('🏆 0')).toBeTruthy();

    // Verify empty state for Recent Workouts and Templates
    expect(getByTestId('recent-workouts-empty-state')).toBeTruthy();
    expect(getByTestId('templates-empty-state')).toBeTruthy();
  });

  // Scenario 2: User with completed workouts displays real metrics
  it('Scenario 2: User with completed workouts displays real calculated weekly, volume, and PR data', async () => {
    const now = new Date();
    const completedWorkouts: WorkoutSession[] = [
      {
        id: 'workout-101',
        name: 'Heavy Push',
        startedAt: now.toISOString(),
        finishedAt: now.toISOString(),
        status: 'completed',
        totalVolume: 4800,
        totalDuration: 3000,
        completedSetsCount: 12,
        exercises: [
          {
            exerciseId: 'bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 100, reps: 5, rir: 1, completed: true },
              { id: 's2', setNumber: 2, weight: 100, reps: 5, rir: 1, completed: true },
            ],
          },
        ],
      },
    ];

    getCompletedWorkoutsSpy.mockResolvedValue(completedWorkouts);

    const { getByTestId, getByText } = await render(<HomeScreen />);

    await waitFor(
      () => {
        expect(getByText('1 / 4 Workouts')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    expect(getByText('4,800 kg')).toBeTruthy();
    expect(getByText('🔥 1 Day')).toBeTruthy();
    expect(getByText('🏆 1')).toBeTruthy();
    expect(getByText(/Top: Barbell Bench Press \(100kg\)/)).toBeTruthy();

    // Verify Recent Workouts card rendered
    expect(getByTestId('recent-workout-card-workout-101')).toBeTruthy();
    expect(getByText('Heavy Push')).toBeTruthy();
  });

  // Scenario 3: Active workout in progress banner
  it('Scenario 3: Active workout banner displays when an active workout exists and allows resume and discard', async () => {
    const activeSession: WorkoutSession = {
      id: 'active-session-1',
      name: 'Leg Day Blast',
      startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
      status: 'active',
      exercises: [
        {
          exerciseId: 'squat',
          exerciseName: 'Barbell Squat',
          order: 0,
          actualSets: [],
        },
      ],
    };

    getActiveWorkoutSpy.mockResolvedValue(activeSession);

    const { getByTestId, getByText } = await render(<HomeScreen />);

    // Banner is rendered
    await waitFor(
      () => {
        expect(getByTestId('home-active-workout-banner')).toBeTruthy();
        expect(getByText('Leg Day Blast')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // Resume workout navigates to /workout/active
    const resumeBtn = getByTestId('home-resume-workout-button');
    await act(async () => {
      fireEvent.press(resumeBtn);
    });
    expect(mockPush).toHaveBeenCalledWith('/workout/active');

    // Discard workout triggers confirmation alert
    const discardBtn = getByTestId('home-discard-workout-button');
    await act(async () => {
      fireEvent.press(discardBtn);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Discard Active Workout',
      expect.any(String),
      expect.any(Array),
    );

    // Trigger the Discard action in the alert
    const discardAction = alertSpy.mock.calls[0][2]?.find((btn) => btn.text === 'Discard');
    await act(async () => {
      await discardAction?.onPress?.();
    });

    expect(discardActiveWorkoutSpy).toHaveBeenCalled();
  });

  // Scenario 4: Today's Workout Card starts template directly
  it("Scenario 4: Today's Workout card recommends next template and START WORKOUT launches it", async () => {
    getTemplatesSpy.mockResolvedValue(mockTemplates);

    const { getByTestId } = await render(<HomeScreen />);

    await waitFor(
      () => {
        const todayCard = getByTestId('today-workout-card');
        expect(todayCard).toBeTruthy();
        expect(within(todayCard).getByText('Push Day')).toBeTruthy();
        expect(within(todayCard).getByText(/2 Exercises/)).toBeTruthy();
      },
      { timeout: 3000 },
    );

    const startBtn = getByTestId('start-workout-button');
    await act(async () => {
      fireEvent.press(startBtn);
    });

    expect(startWorkoutFromTemplateSpy).toHaveBeenCalledWith(mockTemplates[0]);
    expect(mockPush).toHaveBeenCalledWith('/workout/active');
  });

  // Scenario 5: Start Empty Workout
  it('Scenario 5: Start Empty Workout launches blank session and navigates to /workout/active', async () => {
    const { getByTestId } = await render(<HomeScreen />);

    await waitFor(
      () => {
        expect(getByTestId('start-empty-workout-button')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    const emptyBtn = getByTestId('start-empty-workout-button');
    await act(async () => {
      fireEvent.press(emptyBtn);
    });

    expect(startEmptyWorkoutSpy).toHaveBeenCalledWith('Quick Workout');
    expect(mockPush).toHaveBeenCalledWith('/workout/active');
  });

  // Scenario 6: Templates section lists templates and launches on start press
  it('Scenario 6: Templates section lists user templates and allows direct start', async () => {
    getTemplatesSpy.mockResolvedValue(mockTemplates);

    const { getByTestId } = await render(<HomeScreen />);

    await waitFor(
      () => {
        expect(getByTestId('template-start-tpl-1')).toBeTruthy();
        expect(getByTestId('template-start-tpl-2')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    await act(async () => {
      fireEvent.press(getByTestId('template-start-tpl-2'));
    });

    expect(startWorkoutFromTemplateSpy).toHaveBeenCalledWith(mockTemplates[1]);
    expect(mockPush).toHaveBeenCalledWith('/workout/active');
  });

  // Scenario 7: Recent workout item navigation to history detail
  it('Scenario 7: Tapping a recent workout opens read-only workout history detail screen', async () => {
    const completedWorkouts: WorkoutSession[] = [
      {
        id: 'workout-detail-test',
        name: 'Legs & Core',
        startedAt: new Date().toISOString(),
        status: 'completed',
        totalVolume: 5200,
        completedSetsCount: 15,
        exercises: [],
      },
    ];

    getCompletedWorkoutsSpy.mockResolvedValue(completedWorkouts);

    const { getByTestId } = await render(<HomeScreen />);

    await waitFor(
      () => {
        expect(getByTestId('recent-workout-card-workout-detail-test')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    const workoutCard = getByTestId('recent-workout-card-workout-detail-test');
    await act(async () => {
      fireEvent.press(workoutCard);
    });

    expect(mockPush).toHaveBeenCalledWith('/workout/history/workout-detail-test');
  });

  // Scenario 9: Backward compatibility with all existing testIDs
  it('Scenario 9: Preserves all existing testIDs for backward compatibility', async () => {
    const { getByTestId, queryByTestId } = await render(<HomeScreen />);

    await waitFor(
      () => {
        expect(getByTestId('home-title')).toBeTruthy();
        expect(getByTestId('start-workout-button')).toBeTruthy();
        expect(getByTestId('workout-history-button')).toBeTruthy();
        expect(getByTestId('my-templates-button')).toBeTruthy();
        expect(getByTestId('browse-exercises-button')).toBeTruthy();
        expect(queryByTestId('reset-onboarding-button')).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  // Scenario 10: Tapping Personal Records card navigates to /workout/progress/prs
  it('Scenario 10: Tapping Personal Records card navigates to /workout/progress/prs', async () => {
    const { getByTestId } = await render(<HomeScreen />);

    await waitFor(
      () => {
        expect(getByTestId('metric-prs-card')).toBeTruthy();
        expect(getByTestId('home-prs-button')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    const prsBtn = getByTestId('home-prs-button');
    await act(async () => {
      fireEvent.press(prsBtn);
    });

    expect(mockPush).toHaveBeenCalledWith('/workout/progress/prs');
  });
});
