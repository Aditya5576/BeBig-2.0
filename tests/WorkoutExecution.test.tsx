import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateRepository } from '../src/features/templates/services/templateRepository';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import StartWorkoutScreen from '../app/workout/start';
import ActiveWorkoutScreen from '../app/workout/active';
import WorkoutSummaryScreen from '../app/workout/summary';
import HomeScreen from '../app/home';

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

// Mock useAuthStore and useOnboardingStore for HomeScreen
jest.mock('../src/features/auth', () => {
  const actual = jest.requireActual('../src/features/auth');
  const mockState = {
    user: { id: 'test_user_1', email: 'athlete@bebig.app' },
    isGuest: false,
    signOut: jest.fn(),
    exitGuestMode: jest.fn(),
  };
  const useAuthStore = (selector: any) => selector(mockState);
  useAuthStore.getState = () => mockState;
  useAuthStore.setState = jest.fn();
  return {
    ...actual,
    useAuthStore,
  };
});

jest.mock('../src/features/onboarding', () => ({
  useOnboardingStore: (selector: any) =>
    selector({
      goal: 'hypertrophy',
      experienceLevel: 'intermediate',
      daysPerWeek: 4,
      workoutDuration: 60,
      trainingLocation: 'gym',
      equipment: ['barbell', 'dumbbell'],
      preferredTrainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
      workoutStyle: 'bodybuilding',
      resetOnboarding: jest.fn(),
    }),
}));

describe('BeBig 2.0 — Milestone 5: Workout Execution', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    mockParams = {};
    await workoutStorage.clearAllWorkouts();
    await templateStorage.clearTemplates();
  });

  // 1 & 2: Template instantiation & immutability
  describe('WorkoutSession Creation & Template Independence', () => {
    it('creates active workout from template copying planned targets without mutating template', async () => {
      // 1. Create source template
      const template = await templateRepository.createTemplate({
        name: 'Upper Body Power',
        exercises: [
          {
            exerciseId: 'wger_bench',
            exerciseName: 'Bench Press',
            categoryName: 'Chest',
            sets: 3,
            targetReps: '8-10',
            restTime: 120,
            targetWeight: 80,
          },
          {
            exerciseId: 'wger_row',
            exerciseName: 'Barbell Row',
            categoryName: 'Back',
            sets: 2,
            targetReps: '10',
            restTime: 90,
            targetWeight: 60,
          },
        ],
      });

      // 2. Start workout from template
      const session = await workoutRepository.startWorkoutFromTemplate(template);

      expect(session.id).toMatch(/^workout_/);
      expect(session.name).toBe('Upper Body Power');
      expect(session.sourceTemplateId).toBe(template.id);
      expect(session.status).toBe('active');
      expect(session.exercises).toHaveLength(2);

      // Planned targets copied
      expect(session.exercises[0].plannedSets).toBe(3);
      expect(session.exercises[0].plannedTargetReps).toBe('8-10');
      expect(session.exercises[0].plannedRestTime).toBe(120);
      expect(session.exercises[0].plannedTargetWeight).toBe(80);

      // Actual sets preconfigured with target weight and parsed reps
      expect(session.exercises[0].actualSets).toHaveLength(3);
      expect(session.exercises[0].actualSets[0].weight).toBe(80);
      expect(session.exercises[0].actualSets[0].reps).toBe(10);
      expect(session.exercises[0].actualSets[0].completed).toBe(false);

      // 3. Mutate actual sets during active workout
      const updated = workoutRepository.updateSet(
        session,
        'wger_bench',
        session.exercises[0].actualSets[0].id,
        {
          weight: 85,
          reps: 12,
          notes: 'Felt strong, went heavier',
        },
      );
      await workoutRepository.updateActiveWorkout(updated);

      // 4. Verify underlying template was NOT mutated
      const reloadedTemplate = await templateRepository.getTemplateById(template.id);
      expect(reloadedTemplate?.exercises[0].targetWeight).toBe(80);
      expect(reloadedTemplate?.exercises[0].targetReps).toBe('8-10');
    });

    it('creates a blank empty workout session with custom name', async () => {
      const session = await workoutRepository.startEmptyWorkout('Spontaneous Arm Blast');
      expect(session.id).toMatch(/^workout_/);
      expect(session.name).toBe('Spontaneous Arm Blast');
      expect(session.status).toBe('active');
      expect(session.exercises).toHaveLength(0);

      const active = await workoutRepository.getActiveWorkout();
      expect(active?.id).toBe(session.id);
      expect(active?.name).toBe('Spontaneous Arm Blast');
    });
  });

  // 3 & 4: Set Validation (Decimals, Reps, RIR, Notes)
  describe('Set Logging & Numeric Validation', () => {
    it('accepts decimal weights (e.g. 62.5 kg) and rejects negative weights', async () => {
      let session = await workoutRepository.startEmptyWorkout();
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_curl',
        name: 'Bicep Curl',
      });

      const setId = session.exercises[0].actualSets[0].id;

      // Valid decimal weight
      const updated = workoutRepository.updateSet(session, 'ex_curl', setId, {
        weight: 62.5,
      });
      expect(updated.exercises[0].actualSets[0].weight).toBe(62.5);

      // Negative weight throws validation error
      expect(() => {
        workoutRepository.updateSet(session, 'ex_curl', setId, { weight: -5 });
      }).toThrow(/weight cannot be negative/i);
    });

    it('requires positive integer reps (>0) and rejects 0, negative, or decimal reps', async () => {
      let session = await workoutRepository.startEmptyWorkout();
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_squat',
        name: 'Barbell Squat',
      });
      const setId = session.exercises[0].actualSets[0].id;

      // Valid positive whole integer
      const updated = workoutRepository.updateSet(session, 'ex_squat', setId, { reps: 8 });
      expect(updated.exercises[0].actualSets[0].reps).toBe(8);

      // Non-integer reps rejected
      expect(() => {
        workoutRepository.updateSet(session, 'ex_squat', setId, { reps: 8.5 });
      }).toThrow(/reps must be a positive integer/i);

      // Zero reps rejected
      expect(() => {
        workoutRepository.updateSet(session, 'ex_squat', setId, { reps: 0 });
      }).toThrow(/reps must be a positive integer/i);

      // Negative reps rejected
      expect(() => {
        workoutRepository.updateSet(session, 'ex_squat', setId, { reps: -2 });
      }).toThrow(/reps must be a positive integer/i);
    });

    it('requires numeric RIR between 0 and 10 and stores optional notes', async () => {
      let session = await workoutRepository.startEmptyWorkout();
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_press',
        name: 'Overhead Press',
      });
      const setId = session.exercises[0].actualSets[0].id;

      // Valid RIR & notes
      const updated = workoutRepository.updateSet(session, 'ex_press', setId, {
        rir: 1.5,
        notes: 'Great bar path, grind on rep 8',
      });
      expect(updated.exercises[0].actualSets[0].rir).toBe(1.5);
      expect(updated.exercises[0].actualSets[0].notes).toBe('Great bar path, grind on rep 8');

      // RIR > 10 rejected
      expect(() => {
        workoutRepository.updateSet(session, 'ex_press', setId, { rir: 11 });
      }).toThrow(/rir must be a number between 0 and 10/i);

      // RIR < 0 rejected
      expect(() => {
        workoutRepository.updateSet(session, 'ex_press', setId, { rir: -1 });
      }).toThrow(/rir must be a number between 0 and 10/i);
    });
  });

  // 5 & 6: Dynamic Exercise & Set Manipulation
  describe('Dynamic Exercise & Set Manipulation', () => {
    it('adds sets with cloned values, removes sets re-indexing numbers, and removes exercises', async () => {
      let session = await workoutRepository.startEmptyWorkout();
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_bench',
        name: 'Bench Press',
      });

      // Update initial set
      session = workoutRepository.updateSet(
        session,
        'ex_bench',
        session.exercises[0].actualSets[0].id,
        {
          weight: 75,
          reps: 10,
        },
      );

      // Add second set: should clone weight 75 and reps 10 with setNumber 2
      session = workoutRepository.addSetToExercise(session, 'ex_bench');
      expect(session.exercises[0].actualSets).toHaveLength(2);
      expect(session.exercises[0].actualSets[1].setNumber).toBe(2);
      expect(session.exercises[0].actualSets[1].weight).toBe(75);
      expect(session.exercises[0].actualSets[1].reps).toBe(10);
      expect(session.exercises[0].actualSets[1].completed).toBe(false);

      // Add third set
      session = workoutRepository.addSetToExercise(session, 'ex_bench');
      expect(session.exercises[0].actualSets).toHaveLength(3);

      // Remove second set: remaining sets must be re-indexed to 1 and 2
      const secondSetId = session.exercises[0].actualSets[1].id;
      session = workoutRepository.removeSetFromExercise(session, 'ex_bench', secondSetId);
      expect(session.exercises[0].actualSets).toHaveLength(2);
      expect(session.exercises[0].actualSets[0].setNumber).toBe(1);
      expect(session.exercises[0].actualSets[1].setNumber).toBe(2);

      // Add second exercise and remove first: exercises must be re-indexed
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_dips',
        name: 'Tricep Dips',
      });
      expect(session.exercises).toHaveLength(2);
      expect(session.exercises[1].order).toBe(1);

      session = workoutRepository.removeExerciseFromWorkout(session, 'ex_bench');
      expect(session.exercises).toHaveLength(1);
      expect(session.exercises[0].exerciseId).toBe('ex_dips');
      expect(session.exercises[0].order).toBe(0);
    });
  });

  // 7 & 8: Rest Countdown Timer Mechanics
  describe('Timestamp-Driven Rest Interval Timer', () => {
    it('computes targetEndTime accurately and allows skipping rest timer', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      let session: any = {
        id: 'w1',
        name: 'Leg Day',
        status: 'active',
        exercises: [],
      };

      // Start 90-second rest timer
      session = workoutRepository.startRestTimer(session, 'squat', 1, 90, 'Squat');
      expect(session.activeRestTimer).not.toBeNull();
      expect(session.activeRestTimer.durationSeconds).toBe(90);
      expect(session.activeRestTimer.targetEndTime).toBe(now + 90 * 1000);

      // Simulate 30s elapsed: remaining must be 60s
      jest.spyOn(Date, 'now').mockReturnValue(now + 30 * 1000);
      const remaining = Math.ceil((session.activeRestTimer.targetEndTime - Date.now()) / 1000);
      expect(remaining).toBe(60);

      // Clear / Skip timer
      session = workoutRepository.clearRestTimer(session);
      expect(session.activeRestTimer).toBeNull();
    });
  });

  // 9 & 10: Continuous Autosave, Draft Protection, & Discard
  describe('Autosave & Draft Protection', () => {
    it('autosaves active workout and rehydrates draft after restart simulation', async () => {
      const session = await workoutRepository.startEmptyWorkout('Draft Survival Workout');
      const updated = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_lat',
        name: 'Lat Pulldown',
      });
      await workoutRepository.updateActiveWorkout(updated);

      // Simulate app restart by querying fresh from storage
      const draft = await workoutStorage.getActiveWorkout();
      expect(draft).not.toBeNull();
      expect(draft?.id).toBe(session.id);
      expect(draft?.exercises).toHaveLength(1);
      expect(draft?.exercises[0].exerciseName).toBe('Lat Pulldown');
    });

    it('discards active workout clearing draft without polluting completed history', async () => {
      const session = await workoutRepository.startEmptyWorkout('Discarded Workout');
      expect(await workoutRepository.getActiveWorkout()).not.toBeNull();

      await workoutRepository.discardActiveWorkout();
      expect(await workoutRepository.getActiveWorkout()).toBeNull();

      const history = await workoutRepository.getCompletedWorkouts();
      expect(history).toHaveLength(0);
    });
  });

  // 11 & 12: Finishing Workout, Total Volume, and History
  describe('Workout Completion & Volume Calculation', () => {
    it('prevents completion when 0 sets are completed', async () => {
      const session = await workoutRepository.startEmptyWorkout();
      const withEx = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_1',
        name: 'Exercise 1',
      });
      await workoutRepository.updateActiveWorkout(withEx);

      await expect(workoutRepository.completeActiveWorkout(withEx)).rejects.toThrow(
        /at least one set must be completed/i,
      );
    });

    it('calculates total tonnage volume and duration, saves to completed workouts, and clears active draft', async () => {
      const startedAt = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago
      let session = await workoutRepository.startEmptyWorkout('Hypertrophy Volume Test');
      session = { ...session, startedAt };

      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_bench',
        name: 'Barbell Bench Press',
      });
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_incline',
        name: 'Incline Dumbbell Press',
      });

      // Bench: 2 completed sets @ 80kg x 10 reps = 1600kg
      const bSet1 = session.exercises[0].actualSets[0].id;
      session = workoutRepository.updateSet(session, 'ex_bench', bSet1, {
        weight: 80,
        reps: 10,
        completed: true,
      });

      session = workoutRepository.addSetToExercise(session, 'ex_bench');
      const bSet2 = session.exercises[0].actualSets[1].id;
      session = workoutRepository.updateSet(session, 'ex_bench', bSet2, {
        weight: 80,
        reps: 10,
        completed: true,
      });

      // Incline: 1 completed set @ 32.5kg x 12 reps = 390kg, 1 UNCOMPLETED set @ 35kg x 10 (should be excluded)
      const iSet1 = session.exercises[1].actualSets[0].id;
      session = workoutRepository.updateSet(session, 'ex_incline', iSet1, {
        weight: 32.5,
        reps: 12,
        completed: true,
      });

      session = workoutRepository.addSetToExercise(session, 'ex_incline');
      const iSet2 = session.exercises[1].actualSets[1].id;
      session = workoutRepository.updateSet(session, 'ex_incline', iSet2, {
        weight: 35,
        reps: 10,
        completed: false, // NOT completed
      });

      // Expected Volume: 80*10 + 80*10 + 32.5*12 = 800 + 800 + 390 = 1990 kg
      const volume = workoutRepository.calculateTotalVolume(session);
      expect(volume).toBe(1990);

      // Complete workout
      const completed = await workoutRepository.completeActiveWorkout(session);
      expect(completed.status).toBe('completed');
      expect(completed.totalVolume).toBe(1990);
      expect(completed.completedSetsCount).toBe(3);
      expect(completed.totalDuration).toBeGreaterThanOrEqual(3600);

      // Active draft cleared
      expect(await workoutRepository.getActiveWorkout()).toBeNull();

      // Persisted to completed history
      const history = await workoutRepository.getCompletedWorkouts();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(completed.id);
      expect(history[0].totalVolume).toBe(1990);

      // Get by id
      const retrieved = await workoutRepository.getCompletedWorkoutById(completed.id);
      expect(retrieved?.id).toBe(completed.id);
    });
  });

  // 13: UI Integration Screens
  describe('Workout Execution UI Screens', () => {
    it('StartWorkoutScreen renders quick start and saved templates, handles start empty', async () => {
      await templateRepository.createTemplate({
        name: 'Push Hypertrophy',
        exercises: [
          {
            exerciseId: 'wger_bench',
            exerciseName: 'Bench Press',
            sets: 3,
            targetReps: '10',
            restTime: 90,
          },
        ],
      });

      const { getByTestId, findAllByText } = await render(<StartWorkoutScreen />);

      expect(getByTestId('start-workout-title')).toBeTruthy();
      expect(getByTestId('start-empty-workout-button')).toBeTruthy();
      expect((await findAllByText('Push Hypertrophy')).length).toBeGreaterThanOrEqual(1);

      // Press Start Empty Workout
      fireEvent.press(getByTestId('start-empty-workout-button'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/workout/active');
      });
    });

    it('StartWorkoutScreen displays active workout banner when session exists', async () => {
      await workoutRepository.startEmptyWorkout('Unfinished Leg Session');

      const { findByTestId, findByText } = await render(<StartWorkoutScreen />);

      expect(await findByTestId('active-workout-banner')).toBeTruthy();
      expect(await findByText('Unfinished Leg Session')).toBeTruthy();
      expect(await findByTestId('start-resume-workout-button')).toBeTruthy();

      fireEvent.press(await findByTestId('start-resume-workout-button'));
      expect(mockPush).toHaveBeenCalledWith('/workout/active');
    });

    it('ActiveWorkoutScreen renders active session, exercises, and inputs', async () => {
      const session = await workoutRepository.startEmptyWorkout('Chest Day Live');
      const withEx = workoutRepository.addExerciseToWorkout(session, {
        id: 'bench_1',
        name: 'Barbell Flat Bench',
      });
      await workoutRepository.updateActiveWorkout(withEx);

      const { findByText, getByTestId } = await render(<ActiveWorkoutScreen />);

      expect(await findByText('Chest Day Live')).toBeTruthy();
      expect(await findByText('Barbell Flat Bench')).toBeTruthy();
      expect(getByTestId('discard-workout-button')).toBeTruthy();
      expect(getByTestId('finish-workout-button')).toBeTruthy();
      expect(getByTestId('add-exercise-to-workout-button')).toBeTruthy();
    });

    it('WorkoutSummaryScreen renders completed workout volume, duration, and done button', async () => {
      const finishedAt = new Date().toISOString();
      const startedAt = new Date(Date.now() - 1800 * 1000).toISOString(); // 30 mins ago
      const completedWorkout = {
        id: 'summary_test_workout',
        name: 'Saturday Leg Blast',
        startedAt,
        finishedAt,
        status: 'completed' as const,
        totalDuration: 1800,
        totalVolume: 4200,
        completedSetsCount: 6,
        exercises: [
          {
            exerciseId: 'squat_1',
            exerciseName: 'Back Squat',
            order: 0,
            actualSets: [
              {
                id: 's1',
                setNumber: 1,
                weight: 100,
                reps: 10,
                rir: 2,
                notes: 'Clean reps',
                completed: true,
              },
            ],
          },
        ],
      };
      await workoutStorage.saveCompletedWorkout(completedWorkout);
      mockParams = { id: 'summary_test_workout' };

      const { findByTestId, findByText } = await render(<WorkoutSummaryScreen />);

      expect(await findByTestId('workout-summary-title')).toBeTruthy();
      expect(await findByText('Saturday Leg Blast • Completed Today')).toBeTruthy();
      expect(await findByTestId('summary-volume')).toBeTruthy();
      expect(await findByText('4,200 kg')).toBeTruthy();
      expect(await findByText('30 min')).toBeTruthy();

      const doneBtn = await findByTestId('summary-done-button');
      fireEvent.press(doneBtn);
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });

    it('HomeScreen displays Start Workout button and Active Workout banner when workout active', async () => {
      await workoutRepository.startEmptyWorkout('Current Active Session');

      const { findByTestId, findByText } = await render(<HomeScreen />);

      // Start Workout button
      expect(await findByTestId('start-workout-button')).toBeTruthy();

      // Active workout banner
      expect(await findByTestId('home-active-workout-banner')).toBeTruthy();
      expect(await findByText('Current Active Session')).toBeTruthy();
      expect(await findByTestId('home-resume-workout-button')).toBeTruthy();

      // Resume click navigates to active workout
      fireEvent.press(await findByTestId('home-resume-workout-button'));
      expect(mockPush).toHaveBeenCalledWith('/workout/active');
    });
  });
});
