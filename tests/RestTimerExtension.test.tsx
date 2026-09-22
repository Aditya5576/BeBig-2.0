import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ActiveWorkoutScreen from '../app/workout/active';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { WorkoutSession } from '../src/features/workout/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
  Redirect: () => null,
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

describe('Issue #6 — Active Rest Timer: +10 / +20 Seconds', () => {
  const originalDateNow = Date.now;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('Repository Unit Logic', () => {
    it('1. +10 adds exactly 10 seconds to active rest timer targetEndTime and durationSeconds', () => {
      const now = 1000000;
      Date.now = jest.fn(() => now);

      let session: WorkoutSession = {
        id: 'w_test_1',
        name: 'Bench Press Session',
        startedAt: new Date(now).toISOString(),
        status: 'active',
        exercises: [],
      };

      // Start 90s rest timer -> targetEndTime = now + 90,000
      session = workoutRepository.startRestTimer(session, 'ex_bench', 1, 90, 'Bench Press');
      expect(session.activeRestTimer?.durationSeconds).toBe(90);
      expect(session.activeRestTimer?.targetEndTime).toBe(now + 90000);

      // Extend by 10s
      session = workoutRepository.extendRestTimer(session, 10);
      expect(session.activeRestTimer?.durationSeconds).toBe(100);
      expect(session.activeRestTimer?.targetEndTime).toBe(now + 100000);
    });

    it('2. +20 adds exactly 20 seconds to active rest timer', () => {
      const now = 1000000;
      Date.now = jest.fn(() => now);

      let session: WorkoutSession = {
        id: 'w_test_2',
        name: 'Squats',
        startedAt: new Date(now).toISOString(),
        status: 'active',
        exercises: [],
      };

      session = workoutRepository.startRestTimer(session, 'ex_squat', 1, 60, 'Squat');
      session = workoutRepository.extendRestTimer(session, 20);
      expect(session.activeRestTimer?.durationSeconds).toBe(80);
      expect(session.activeRestTimer?.targetEndTime).toBe(now + 80000);
    });

    it('3. Multiple presses (+10, +10, +20) accumulate correctly from effective remaining time', () => {
      const now = 1000000;
      Date.now = jest.fn(() => now);

      let session: WorkoutSession = {
        id: 'w_test_3',
        name: 'Deadlifts',
        startedAt: new Date(now).toISOString(),
        status: 'active',
        exercises: [],
      };

      // Start 30s rest timer
      session = workoutRepository.startRestTimer(session, 'ex_deadlift', 1, 30, 'Deadlift');

      // Tap +10, +10, +20 -> +40s total
      session = workoutRepository.extendRestTimer(session, 10);
      session = workoutRepository.extendRestTimer(session, 10);
      session = workoutRepository.extendRestTimer(session, 20);

      expect(session.activeRestTimer?.durationSeconds).toBe(70);
      expect(session.activeRestTimer?.targetEndTime).toBe(now + 70000);
    });

    it('4. Extension uses current effective timer state after time has elapsed', () => {
      const startMs = 1000000;
      Date.now = jest.fn(() => startMs);

      let session: WorkoutSession = {
        id: 'w_test_4',
        name: 'Overhead Press',
        startedAt: new Date(startMs).toISOString(),
        status: 'active',
        exercises: [],
      };

      // Start 90s rest timer
      session = workoutRepository.startRestTimer(session, 'ex_ohp', 1, 90, 'OHP');

      // Fast forward 50 seconds (40s remaining)
      const nowMs = startMs + 50000;
      Date.now = jest.fn(() => nowMs);

      const remainingBefore = Math.ceil((session.activeRestTimer!.targetEndTime - Date.now()) / 1000);
      expect(remainingBefore).toBe(40);

      // Tap +10s -> remaining must be 50s from current effective time
      session = workoutRepository.extendRestTimer(session, 10);
      const remainingAfter = Math.ceil((session.activeRestTimer!.targetEndTime - Date.now()) / 1000);
      expect(remainingAfter).toBe(50);
    });

    it('5. Expired timer is not resurrected when targetEndTime has passed', () => {
      const startMs = 1000000;
      Date.now = jest.fn(() => startMs);

      let session: WorkoutSession = {
        id: 'w_test_5',
        name: 'Leg Extension',
        startedAt: new Date(startMs).toISOString(),
        status: 'active',
        exercises: [],
      };

      // Start 30s rest timer
      session = workoutRepository.startRestTimer(session, 'ex_leg_ext', 1, 30, 'Leg Extension');

      // Fast forward 35 seconds (timer expired)
      Date.now = jest.fn(() => startMs + 35000);

      // Attempt extension
      const updated = workoutRepository.extendRestTimer(session, 10);

      // Must not modify targetEndTime
      expect(updated.activeRestTimer?.targetEndTime).toBe(session.activeRestTimer?.targetEndTime);
    });

    it('6 & 7. Existing active workout state and timer completion behavior remain intact', () => {
      let session: WorkoutSession = {
        id: 'w_test_6',
        name: 'Pullups',
        startedAt: new Date().toISOString(),
        status: 'active',
        exercises: [
          {
            exerciseId: 'ex_pullup',
            exerciseName: 'Pull Up',
            order: 1,
            actualSets: [
              { id: 'set_1', setNumber: 1, reps: 10, weight: 0, completed: true },
            ],
          },
        ],
      };

      session = workoutRepository.startRestTimer(session, 'ex_pullup', 1, 60, 'Pull Up');
      const extended = workoutRepository.extendRestTimer(session, 10);

      // Workout set logging and details unchanged
      expect(extended.exercises[0].actualSets[0].reps).toBe(10);
      expect(extended.exercises[0].actualSets[0].completed).toBe(true);

      // Skip timer still clears activeRestTimer
      const cleared = workoutRepository.clearRestTimer(extended);
      expect(cleared.activeRestTimer).toBeNull();
    });
  });

  describe('UI Component Integration & Theme Rendering', () => {
    it('8. Renders +10s and +20s controls and extends rest timer on press', async () => {
      const now = Date.now();
      const initialSession: WorkoutSession = {
        id: 'w_active_ui',
        name: 'Active UI Session',
        startedAt: new Date(now).toISOString(),
        status: 'active',
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Bench Press',
            order: 1,
            actualSets: [
              { id: 's1', setNumber: 1, reps: 8, weight: 80, completed: true },
            ],
          },
        ],
        activeRestTimer: {
          exerciseId: 'ex_bench',
          exerciseName: 'Bench Press',
          setNumber: 1,
          targetEndTime: now + 60000, // 60 seconds
          durationSeconds: 60,
        },
      };

      await workoutStorage.saveActiveWorkout(initialSession);

      const { getByTestId } = await render(<ActiveWorkoutScreen />);

      await waitFor(() => {
        expect(getByTestId('rest-timer-banner')).toBeTruthy();
        expect(getByTestId('extend-rest-10-button')).toBeTruthy();
        expect(getByTestId('extend-rest-20-button')).toBeTruthy();
      });

      // Tap +10s
      fireEvent.press(getByTestId('extend-rest-10-button'));

      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.activeRestTimer?.durationSeconds).toBe(70);
      });

      // Tap +20s
      fireEvent.press(getByTestId('extend-rest-20-button'));

      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.activeRestTimer?.durationSeconds).toBe(90);
      });
    });
  });
});
