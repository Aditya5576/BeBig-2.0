import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import ActiveWorkoutScreen from '../app/workout/active';
import WorkoutHistoryDetailScreen from '../app/workout/history/[id]';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { getSupersetDisplayInfo } from '../src/features/workout/utils/supersetUtils';
import { WorkoutSession, WorkoutExercise } from '../src/features/workout/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.setTimeout(45000);

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockSearchParams,
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, [cb]);
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

describe('BeBig 2.0 — Supersets & Giant Sets with Unified Rest-Timer Pacing', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    mockSearchParams = {};
    await workoutStorage.clearAllWorkouts();
    await templateStorage.clearTemplates();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Superset & Giant Set Domain Logic & Invariants', () => {
    it('links 2 exercises into a Superset (A1 / A2) with emerald accent (#00E599)', async () => {
      let session = await workoutRepository.startEmptyWorkout('Superset Test');
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_bench', name: 'Bench Press' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_flye', name: 'Dumbbell Flye' });

      // Link ex 0 with ex 1
      session = workoutRepository.linkSupersetWithNext(session, 0);

      expect(session.exercises[0].supersetGroupId).toBeTruthy();
      expect(session.exercises[1].supersetGroupId).toBeTruthy();
      expect(session.exercises[0].supersetGroupId).toBe(session.exercises[1].supersetGroupId);

      const info0 = getSupersetDisplayInfo(session.exercises, 'ex_bench');
      const info1 = getSupersetDisplayInfo(session.exercises, 'ex_flye');

      expect(info0.isInGroup).toBe(true);
      expect(info0.groupLabel).toBe('SUPERSET A1');
      expect(info0.groupType).toBe('superset');
      expect(info0.accentColor).toBe('#00E599');
      expect(info0.isFirstInGroup).toBe(true);
      expect(info0.isLastInGroup).toBe(false);

      expect(info1.isInGroup).toBe(true);
      expect(info1.groupLabel).toBe('SUPERSET A2');
      expect(info1.groupType).toBe('superset');
      expect(info1.accentColor).toBe('#00E599');
      expect(info1.isFirstInGroup).toBe(false);
      expect(info1.isLastInGroup).toBe(true);
    });

    it('upgrades 3 contiguous exercises into a Giant Set (A1 / A2 / A3) with cyan accent (#38BDF8)', async () => {
      let session = await workoutRepository.startEmptyWorkout('Giant Set Test');
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_press', name: 'Shoulder Press' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_lateral', name: 'Lateral Raise' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_rear', name: 'Rear Delt Flye' });

      // Link 0 with 1, then link 1 with 2
      session = workoutRepository.linkSupersetWithNext(session, 0);
      session = workoutRepository.linkSupersetWithNext(session, 1);

      expect(session.exercises[0].supersetGroupId).toBe(session.exercises[1].supersetGroupId);
      expect(session.exercises[1].supersetGroupId).toBe(session.exercises[2].supersetGroupId);

      const info0 = getSupersetDisplayInfo(session.exercises, 'ex_press');
      const info1 = getSupersetDisplayInfo(session.exercises, 'ex_lateral');
      const info2 = getSupersetDisplayInfo(session.exercises, 'ex_rear');

      expect(info0.groupLabel).toBe('GIANT SET A1');
      expect(info0.groupType).toBe('giant_set');
      expect(info0.accentColor).toBe('#38BDF8');

      expect(info1.groupLabel).toBe('GIANT SET A2');
      expect(info1.groupType).toBe('giant_set');

      expect(info2.groupLabel).toBe('GIANT SET A3');
      expect(info2.groupType).toBe('giant_set');
      expect(info2.isLastInGroup).toBe(true);
    });

    it('automatically dissolves remaining 1-exercise orphan when unlinking or removing an exercise', async () => {
      let session = await workoutRepository.startEmptyWorkout('Orphan Dissolve Test');
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_curl', name: 'Bicep Curl' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_tricep', name: 'Tricep Extension' });

      session = workoutRepository.linkSupersetWithNext(session, 0);
      expect(session.exercises[0].supersetGroupId).toBeTruthy();

      // Unlink ex 0: ex 1 is now a single-member orphan, so its group must dissolve to null
      session = workoutRepository.unlinkSuperset(session, 0);
      expect(session.exercises[0].supersetGroupId).toBeNull();
      expect(session.exercises[1].supersetGroupId).toBeNull();
    });

    it('dissolves broken groups when reordering separates linked exercises', async () => {
      let session = await workoutRepository.startEmptyWorkout('Reorder Dissolve Test');
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_1', name: 'Ex 1' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_2', name: 'Ex 2' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_3', name: 'Ex 3' });

      // Link ex 0 and ex 1 into superset
      session = workoutRepository.linkSupersetWithNext(session, 0);
      expect(session.exercises[0].supersetGroupId).toBeTruthy();

      // Move Ex 0 down to slot 1, then down to slot 2 -> order becomes [Ex 2, Ex 3, Ex 1]
      // Now Ex 1 and Ex 2 are separated by Ex 3 -> orphan runs of length 1 must dissolve!
      session = workoutRepository.moveExerciseDown(session, 0);
      session = workoutRepository.moveExerciseDown(session, 1);

      expect(session.exercises.find((e) => e.exerciseId === 'ex_1')?.supersetGroupId).toBeNull();
      expect(session.exercises.find((e) => e.exerciseId === 'ex_2')?.supersetGroupId).toBeNull();
    });

    it('preserves supersetGroupId when repeating a completed workout', async () => {
      const completedWorkout: WorkoutSession = {
        id: 'hist_superset_1',
        name: 'Arm Blast',
        startedAt: '2026-11-12T10:00:00.000Z',
        finishedAt: '2026-11-12T11:00:00.000Z',
        status: 'completed',
        version: 1,
        exercises: [
          {
            exerciseId: 'ex_bicep',
            exerciseName: 'Barbell Curl',
            order: 0,
            supersetGroupId: 'ss_arms_1',
            actualSets: [{ id: 's1', setNumber: 1, weight: 40, reps: 10, completed: true }],
          },
          {
            exerciseId: 'ex_skull',
            exerciseName: 'Skull Crusher',
            order: 1,
            supersetGroupId: 'ss_arms_1',
            actualSets: [{ id: 's2', setNumber: 1, weight: 35, reps: 10, completed: true }],
          },
        ],
      };

      const repeated = await workoutRepository.startWorkoutFromCompleted(completedWorkout);
      expect(repeated.exercises[0].supersetGroupId).toBe('ss_arms_1');
      expect(repeated.exercises[1].supersetGroupId).toBe('ss_arms_1');
    });
  });

  describe('2. Unified Rest Timer Pacing (Drop Sets + Supersets & Giant Sets)', () => {
    it('skips rest timer for A1 in a Superset, and starts rest timer for A2 (last in round)', async () => {
      let session = await workoutRepository.startEmptyWorkout('Pacing Test');
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_bench', name: 'Bench Press' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_flye', name: 'Dumbbell Flye' });
      session = workoutRepository.linkSupersetWithNext(session, 0);

      // Set weights and reps for set 1 of both exercises
      const setBench1 = session.exercises[0].actualSets[0];
      const setFlye1 = session.exercises[1].actualSets[0];

      session = workoutRepository.updateSet(session, 'ex_bench', setBench1.id, { weight: 100, reps: 10 });
      session = workoutRepository.updateSet(session, 'ex_flye', setFlye1.id, { weight: 20, reps: 12 });
      await workoutStorage.saveActiveWorkout(session);

      const screen = await render(<ActiveWorkoutScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('complete-set-ex_bench-1')).toBeTruthy();
      });

      // 1. Complete Bench Press Set 1 (A1)
      fireEvent.press(screen.getByTestId('complete-set-ex_bench-1'));

      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.exercises[0].actualSets[0].completed).toBe(true);
        // Superset A1: Lifter moves directly to A2 without full rest countdown!
        expect(saved?.activeRestTimer).toBeNull();
      });

      // 2. Complete Dumbbell Flye Set 1 (A2 - Last in round)
      fireEvent.press(screen.getByTestId('complete-set-ex_flye-1'));

      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.exercises[1].actualSets[0].completed).toBe(true);
        // Superset A2 (last exercise in round): Full rest countdown triggers before round 2!
        expect(saved?.activeRestTimer).not.toBeNull();
        expect(saved?.activeRestTimer?.exerciseId).toBe('ex_flye');
      });
    });

    it('skips rest timer for A1 and A2 in a Giant Set, and starts timer only after A3', async () => {
      let session = await workoutRepository.startEmptyWorkout('Giant Set Pacing');
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_1', name: 'Movement 1' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_2', name: 'Movement 2' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_3', name: 'Movement 3' });
      session = workoutRepository.linkSupersetWithNext(session, 0);
      session = workoutRepository.linkSupersetWithNext(session, 1);

      session = workoutRepository.updateSet(session, 'ex_1', session.exercises[0].actualSets[0].id, { weight: 50, reps: 10 });
      session = workoutRepository.updateSet(session, 'ex_2', session.exercises[1].actualSets[0].id, { weight: 40, reps: 10 });
      session = workoutRepository.updateSet(session, 'ex_3', session.exercises[2].actualSets[0].id, { weight: 30, reps: 10 });
      await workoutStorage.saveActiveWorkout(session);

      const screen = await render(<ActiveWorkoutScreen />);

      // Complete A1 -> No rest timer
      fireEvent.press(screen.getByTestId('complete-set-ex_1-1'));
      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.activeRestTimer).toBeNull();
      });

      // Complete A2 -> No rest timer
      fireEvent.press(screen.getByTestId('complete-set-ex_2-1'));
      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.activeRestTimer).toBeNull();
      });

      // Complete A3 (last in giant set round) -> Full rest timer triggers!
      fireEvent.press(screen.getByTestId('complete-set-ex_3-1'));
      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.activeRestTimer).not.toBeNull();
        expect(saved?.activeRestTimer?.exerciseId).toBe('ex_3');
      });
    });

    it('automatically dismisses running rest timer if a set is changed to "drop" after previous set completes', async () => {
      let session = await workoutRepository.startEmptyWorkout('Late Drop Set Test');
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_lat', name: 'Lat Pulldown' });
      session = workoutRepository.addSetToExercise(session, 'ex_lat');

      const s1 = session.exercises[0].actualSets[0];
      const s2 = session.exercises[0].actualSets[1];

      session = workoutRepository.updateSet(session, 'ex_lat', s1.id, { weight: 70, reps: 10, setType: 'normal' });
      session = workoutRepository.updateSet(session, 'ex_lat', s2.id, { weight: 55, reps: 12, setType: 'normal' });
      await workoutStorage.saveActiveWorkout(session);

      const screen = await render(<ActiveWorkoutScreen />);

      // 1. Complete set 1 -> since set 2 is currently 'normal', rest timer starts
      fireEvent.press(screen.getByTestId('complete-set-ex_lat-1'));

      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.activeRestTimer).not.toBeNull();
      });

      // 2. Lifter taps Set 2 badge and changes it to 'drop'
      const set2Badge = screen.getByTestId(`set-type-badge-${s2.id}`);
      fireEvent.press(set2Badge);

      const dropOption = await screen.findByTestId('set-type-option-drop');
      fireEvent.press(dropOption);

      // Rest timer must be automatically cancelled so it never interrupts the drop set!
      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.exercises[0].actualSets[1].setType).toBe('drop');
        expect(saved?.activeRestTimer).toBeNull();
      });
    });
  });

  describe('3. Active & History UI Presentation', () => {
    it('allows linking and unlinking supersets directly via ActiveExerciseCard action buttons', async () => {
      let session = await workoutRepository.startEmptyWorkout('UI Link Unlink Test');
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_a', name: 'Exercise A' });
      session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_b', name: 'Exercise B' });
      await workoutStorage.saveActiveWorkout(session);

      const screen = await render(<ActiveWorkoutScreen />);

      // Ex A has link button
      const linkBtn = await screen.findByTestId('superset-link-button-ex_a');
      expect(linkBtn).toBeTruthy();

      // Tap link button -> creates Superset
      fireEvent.press(linkBtn);

      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.exercises[0].supersetGroupId).toBeTruthy();
        expect(saved?.exercises[1].supersetGroupId).toBe(saved?.exercises[0].supersetGroupId);
      });

      // Now Ex A displays "Unlink"
      const unlinkBtn = await screen.findByTestId('superset-unlink-button-ex_a');
      expect(unlinkBtn).toBeTruthy();

      // Tap unlink button -> dissolves Superset
      fireEvent.press(unlinkBtn);

      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.exercises[0].supersetGroupId).toBeNull();
        expect(saved?.exercises[1].supersetGroupId).toBeNull();
      });
    });

    it('renders "SUPERSET A1" and "SUPERSET A2" badges in WorkoutHistoryDetailScreen', async () => {
      const completedWorkout: WorkoutSession = {
        id: 'hist_workout_superset',
        name: 'Chest Superset Day',
        startedAt: '2026-11-12T10:00:00.000Z',
        finishedAt: '2026-11-12T11:00:00.000Z',
        status: 'completed',
        version: 1,
        exercises: [
          {
            exerciseId: 'ex_h_bench',
            exerciseName: 'Flat Bench',
            order: 0,
            supersetGroupId: 'ss_chest_1',
            actualSets: [{ id: 's1', setNumber: 1, weight: 100, reps: 10, completed: true }],
          },
          {
            exerciseId: 'ex_h_pushup',
            exerciseName: 'Pushup',
            order: 1,
            supersetGroupId: 'ss_chest_1',
            actualSets: [{ id: 's2', setNumber: 1, weight: 0, reps: 20, completed: true }],
          },
        ],
      };

      await workoutStorage.saveCompletedWorkout(completedWorkout);
      mockSearchParams = { id: 'hist_workout_superset' };

      const { findByText, findByTestId } = await render(<WorkoutHistoryDetailScreen />);

      expect(await findByTestId('history-superset-badge-ex_h_bench')).toBeTruthy();
      expect(await findByText('SUPERSET A1')).toBeTruthy();
      expect(await findByTestId('history-superset-badge-ex_h_pushup')).toBeTruthy();
      expect(await findByText('SUPERSET A2')).toBeTruthy();
    });
  });
});

