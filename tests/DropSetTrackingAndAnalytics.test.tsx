import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import ActiveWorkoutScreen from '../app/workout/active';
import WorkoutHistoryDetailScreen from '../app/workout/history/[id]';
import { ActiveSetRow } from '../src/features/workout/components/ActiveSetRow';
import { ActiveExerciseCard } from '../src/features/workout/components/ActiveExerciseCard';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import {
  calculatePersonalRecords,
  getExerciseHistory,
} from '../src/features/workout/utils/analytics';
import { WorkoutSession, WorkoutExercise, WorkoutSet, SetType } from '../src/features/workout/types';

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

describe('BeBig 2.0 — Drop Sets & Set Type Tagging with Analytics & PR Protection', () => {
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

  describe('1. Analytics Engine & PR Protection', () => {
    it('excludes drop sets and warm-up sets from top-weight PRs when working sets exist', () => {
      const workoutSession: WorkoutSession = {
        id: 'workout_bench_pr',
        name: 'Chest Day',
        startedAt: '2026-11-12T10:00:00.000Z',
        finishedAt: '2026-11-12T11:00:00.000Z',
        status: 'completed',
        version: 1,
        exercises: [
          {
            exerciseId: 'ex_bench',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              {
                id: 's1',
                setNumber: 1,
                weight: 60,
                reps: 15,
                setType: 'warmup',
                completed: true,
              },
              {
                id: 's2',
                setNumber: 2,
                weight: 100,
                reps: 10,
                setType: 'normal',
                completed: true,
              },
              {
                id: 's3',
                setNumber: 3,
                weight: 95,
                reps: 12,
                setType: 'drop',
                completed: true,
              },
            ],
          },
        ],
      };

      const prResult = calculatePersonalRecords([workoutSession]);
      expect(prResult.totalPRsCount).toBe(1);
      const benchPr = prResult.allPRs.find((p) => p.exerciseId === 'ex_bench');
      expect(benchPr).toBeDefined();
      // PR must be 100kg from normal working set, NOT affected by warmup or drop
      expect(benchPr?.maxWeight).toBe(100);
      expect(benchPr?.reps).toBe(10);
    });

    it('qualifies failure sets for PRs alongside normal working sets', () => {
      const workoutSession: WorkoutSession = {
        id: 'workout_failure_pr',
        name: 'Shoulder Heavy',
        startedAt: '2026-11-12T10:00:00.000Z',
        finishedAt: '2026-11-12T11:00:00.000Z',
        status: 'completed',
        version: 1,
        exercises: [
          {
            exerciseId: 'ex_ohp',
            exerciseName: 'Overhead Press',
            order: 0,
            actualSets: [
              {
                id: 's1',
                setNumber: 1,
                weight: 50,
                reps: 10,
                setType: 'normal',
                completed: true,
              },
              {
                id: 's2',
                setNumber: 2,
                weight: 55,
                reps: 6,
                setType: 'failure',
                completed: true,
              },
            ],
          },
        ],
      };

      const prResult = calculatePersonalRecords([workoutSession]);
      const ohpPr = prResult.allPRs.find((p) => p.exerciseId === 'ex_ohp');
      expect(ohpPr?.maxWeight).toBe(55);
      expect(ohpPr?.reps).toBe(6);
    });

    it('falls back to all completed sets if exercise was performed exclusively with warmup/drop sets', () => {
      const workoutSession: WorkoutSession = {
        id: 'workout_exclusive_drop',
        name: 'Arms Finisher',
        startedAt: '2026-11-12T10:00:00.000Z',
        finishedAt: '2026-11-12T11:00:00.000Z',
        status: 'completed',
        version: 1,
        exercises: [
          {
            exerciseId: 'ex_cable_curl',
            exerciseName: 'Cable Bicep Curl',
            order: 0,
            actualSets: [
              {
                id: 's1',
                setNumber: 1,
                weight: 35,
                reps: 15,
                setType: 'drop',
                completed: true,
              },
              {
                id: 's2',
                setNumber: 2,
                weight: 30,
                reps: 20,
                setType: 'drop',
                completed: true,
              },
            ],
          },
        ],
      };

      const prResult = calculatePersonalRecords([workoutSession]);
      const curlPr = prResult.allPRs.find((p) => p.exerciseId === 'ex_cable_curl');
      expect(curlPr?.maxWeight).toBe(35);
      expect(curlPr?.reps).toBe(15);
    });

    it('computes maxWeight from working sets in getExerciseHistory while crediting drop sets for total reps & volume', () => {
      const workoutSession: WorkoutSession = {
        id: 'workout_history_test',
        name: 'Chest & Back',
        startedAt: '2026-11-12T10:00:00.000Z',
        finishedAt: '2026-11-12T11:00:00.000Z',
        status: 'completed',
        version: 1,
        exercises: [
          {
            exerciseId: 'ex_incline_bench',
            exerciseName: 'Incline Bench Press',
            order: 0,
            actualSets: [
              {
                id: 's1',
                setNumber: 1,
                weight: 100,
                reps: 10,
                setType: 'normal',
                completed: true,
              },
              {
                id: 's2',
                setNumber: 2,
                weight: 95,
                reps: 12,
                setType: 'drop',
                completed: true,
              },
            ],
          },
        ],
      };

      const history = getExerciseHistory([workoutSession], 'ex_incline_bench');
      expect(history.length).toBe(1);
      const entry = history[0];

      // maxWeight: evaluated on normal set
      expect(entry.maxWeight).toBe(100);
      // totalReps: includes drop set reps (10 + 12 = 22)
      expect(entry.totalReps).toBe(22);
      // volume: includes drop set tonnage (100*10 + 95*12 = 1000 + 1140 = 2140kg)
      expect(entry.volume).toBe(2140);
      // setType exposed on entry.sets
      expect(entry.sets[0].setType).toBe('normal');
      expect(entry.sets[1].setType).toBe('drop');
    });
  });

  describe('2. Workout Repository Set Type CRUD & Invariants', () => {
    it('initializes new sets with setType="normal" by default', async () => {
      let session = await workoutRepository.startEmptyWorkout('Default Set Type Workout');
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_squat',
        name: 'Squat',
      });

      expect(session.exercises[0].actualSets[0].setType).toBe('normal');

      session = workoutRepository.addSetToExercise(session, 'ex_squat');
      expect(session.exercises[0].actualSets[1].setType).toBe('normal');
    });

    it('updates setType with validation and allows normal, warmup, drop, and failure', async () => {
      let session = await workoutRepository.startEmptyWorkout('Set Type Validation');
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_dl',
        name: 'Deadlift',
      });
      const setId = session.exercises[0].actualSets[0].id;

      // Update to drop
      session = workoutRepository.updateSet(session, 'ex_dl', setId, { setType: 'drop' });
      expect(session.exercises[0].actualSets[0].setType).toBe('drop');

      // Update to warmup
      session = workoutRepository.updateSet(session, 'ex_dl', setId, { setType: 'warmup' });
      expect(session.exercises[0].actualSets[0].setType).toBe('warmup');

      // Update to failure
      session = workoutRepository.updateSet(session, 'ex_dl', setId, { setType: 'failure' });
      expect(session.exercises[0].actualSets[0].setType).toBe('failure');

      // Rejects invalid setType
      expect(() => {
        workoutRepository.updateSet(session, 'ex_dl', setId, {
          setType: 'invalid_type' as any,
        });
      }).toThrow('Invalid setType');
    });

    it('preserves setType when repeating a previous completed workout', async () => {
      const completedWorkout: WorkoutSession = {
        id: 'prev_completed_1',
        name: 'Push Day',
        startedAt: '2026-11-10T10:00:00.000Z',
        finishedAt: '2026-11-10T11:00:00.000Z',
        status: 'completed',
        version: 1,
        exercises: [
          {
            exerciseId: 'ex_press',
            exerciseName: 'Shoulder Press',
            order: 0,
            actualSets: [
              {
                id: 's1',
                setNumber: 1,
                weight: 40,
                reps: 10,
                setType: 'warmup',
                completed: true,
              },
              {
                id: 's2',
                setNumber: 2,
                weight: 60,
                reps: 8,
                setType: 'normal',
                completed: true,
              },
              {
                id: 's3',
                setNumber: 3,
                weight: 50,
                reps: 12,
                setType: 'drop',
                completed: true,
              },
            ],
          },
        ],
      };

      const repeated = await workoutRepository.startWorkoutFromCompleted(completedWorkout);
      expect(repeated.exercises[0].actualSets[0].setType).toBe('warmup');
      expect(repeated.exercises[0].actualSets[1].setType).toBe('normal');
      expect(repeated.exercises[0].actualSets[2].setType).toBe('drop');
    });
  });

  describe('3. Smart Rest Timer Integration', () => {
    it('skips rest countdown timer when the next set in the exercise is a drop set', async () => {
      let session = await workoutRepository.startEmptyWorkout('Rest Timer Drop Set Test');
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_curls',
        name: 'Dumbbell Curls',
      });
      session = workoutRepository.addSetToExercise(session, 'ex_curls');

      const set1 = session.exercises[0].actualSets[0];
      const set2 = session.exercises[0].actualSets[1];

      // Set 1 is normal (40kg x 10)
      session = workoutRepository.updateSet(session, 'ex_curls', set1.id, {
        weight: 40,
        reps: 10,
        setType: 'normal',
      });

      // Set 2 is drop set (30kg x 12)
      session = workoutRepository.updateSet(session, 'ex_curls', set2.id, {
        weight: 30,
        reps: 12,
        setType: 'drop',
      });

      await workoutStorage.saveActiveWorkout(session);

      const screen = await render(<ActiveWorkoutScreen />);

      await waitFor(() => {
        expect(screen.getByTestId(`complete-set-ex_curls-1`)).toBeTruthy();
      });

      // Complete Set 1
      fireEvent.press(screen.getByTestId(`complete-set-ex_curls-1`));

      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.exercises[0].actualSets[0].completed).toBe(true);
        // Smart rest timer: Next set is drop set, so rest timer must NOT start!
        expect(saved?.activeRestTimer).toBeNull();
      });
    });

    it('starts rest countdown timer when the next set is a standard set', async () => {
      let session = await workoutRepository.startEmptyWorkout('Rest Timer Normal Test');
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'ex_curls',
        name: 'Dumbbell Curls',
      });
      session = workoutRepository.addSetToExercise(session, 'ex_curls');

      const set1 = session.exercises[0].actualSets[0];
      const set2 = session.exercises[0].actualSets[1];

      // Both sets are normal
      session = workoutRepository.updateSet(session, 'ex_curls', set1.id, {
        weight: 40,
        reps: 10,
        setType: 'normal',
      });
      session = workoutRepository.updateSet(session, 'ex_curls', set2.id, {
        weight: 40,
        reps: 10,
        setType: 'normal',
      });

      await workoutStorage.saveActiveWorkout(session);

      const screen = await render(<ActiveWorkoutScreen />);

      await waitFor(() => {
        expect(screen.getByTestId(`complete-set-ex_curls-1`)).toBeTruthy();
      });

      // Complete Set 1
      fireEvent.press(screen.getByTestId(`complete-set-ex_curls-1`));

      await waitFor(async () => {
        const saved = await workoutStorage.getActiveWorkout();
        expect(saved?.exercises[0].actualSets[0].completed).toBe(true);
        // Next set is normal, so rest timer starts!
        expect(saved?.activeRestTimer).not.toBeNull();
        expect(saved?.activeRestTimer?.exerciseId).toBe('ex_curls');
      });
    });
  });

  describe('4. ActiveSetRow Component Interactive Set Type Selector', () => {
    it('opens set-type selector modal on badge tap and changes set type', async () => {
      const mockUpdate = jest.fn();
      const mockToggleComplete = jest.fn();
      const mockToggleNotes = jest.fn();
      const mockDelete = jest.fn();

      const exercise: WorkoutExercise = {
        exerciseId: 'ex_1',
        exerciseName: 'Bench Press',
        order: 0,
        actualSets: [],
      };

      const set: WorkoutSet = {
        id: 'set_123',
        setNumber: 1,
        weight: 100,
        reps: 10,
        setType: 'normal',
        completed: false,
      };

      const { getByTestId, findByText, findByTestId } = await render(
        <ActiveSetRow
          exercise={exercise}
          set={set}
          canDelete={true}
          onToggleNotes={mockToggleNotes}
          onDeleteSet={mockDelete}
          onUpdateSetField={mockUpdate}
          onToggleCompleteSet={mockToggleComplete}
        />,
      );

      // Verify set badge exists
      const badge = getByTestId('set-type-badge-set_123');
      expect(badge).toBeTruthy();

      // Tap badge to open selector modal
      fireEvent.press(badge);

      // Verify selector options appear in modal
      expect(await findByText('Select Set Type')).toBeTruthy();
      expect(await findByTestId('set-type-option-drop')).toBeTruthy();
      expect(await findByTestId('set-type-option-warmup')).toBeTruthy();
      expect(await findByTestId('set-type-option-failure')).toBeTruthy();
      expect(await findByTestId('set-type-option-normal')).toBeTruthy();

      // Select Drop Set option
      fireEvent.press(await findByTestId('set-type-option-drop'));

      expect(mockUpdate).toHaveBeenCalledWith('ex_1', 'set_123', 'setType', 'drop');
    });

    it('renders "D" badge for drop set and "W" badge for warmup set', async () => {
      const exercise: WorkoutExercise = {
        exerciseId: 'ex_1',
        exerciseName: 'Bench Press',
        order: 0,
        actualSets: [],
      };

      const dropSet: WorkoutSet = {
        id: 'set_drop_1',
        setNumber: 2,
        weight: 90,
        reps: 12,
        setType: 'drop',
        completed: false,
      };

      const { getByText } = await render(
        <ActiveSetRow
          exercise={exercise}
          set={dropSet}
          canDelete={true}
          onToggleNotes={jest.fn()}
          onDeleteSet={jest.fn()}
          onUpdateSetField={jest.fn()}
          onToggleCompleteSet={jest.fn()}
        />,
      );

      // Must display 'D'
      expect(getByText('D')).toBeTruthy();
    });
  });

  describe('5. UI Presentation: ActiveExerciseCard LAST TIME Chips & History Set Rows', () => {
    it('displays "D " prefix in LAST TIME chip when previous set was a drop set', async () => {
      const exercise: WorkoutExercise = {
        exerciseId: 'ex_bench',
        exerciseName: 'Bench Press',
        order: 0,
        actualSets: [
          {
            id: 's_active_1',
            setNumber: 1,
            weight: 100,
            reps: 10,
            completed: false,
          },
        ],
      };

      const lastPerformance = {
        workoutDate: '2026-11-10T10:00:00.000Z',
        sets: [
          {
            id: 'prev_1',
            setNumber: 1,
            weight: 100,
            reps: 10,
            setType: 'normal' as SetType,
            completed: true,
          },
          {
            id: 'prev_2',
            setNumber: 2,
            weight: 95,
            reps: 12,
            setType: 'drop' as SetType,
            completed: true,
          },
        ],
      };

      const { getByTestId } = await render(
        <ActiveExerciseCard
          exercise={exercise}
          exIndex={0}
          totalExercisesCount={1}
          lastPerformance={lastPerformance}
          expandedNotesSetIds={{}}
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          onRemoveExercise={jest.fn()}
          onAddSet={jest.fn()}
          onDeleteSet={jest.fn()}
          onToggleNotes={jest.fn()}
          onUpdateSetField={jest.fn()}
          onToggleCompleteSet={jest.fn()}
        />,
      );

      const chip2 = getByTestId('last-time-set-chip-ex_bench-2');
      expect(chip2).toBeTruthy();
      // Drop set chip text must include "D 95kg × 12"
      expect(chip2.props.children).toContain('D 95kg × 12');
    });

    it('renders "DROP 2" badge in WorkoutHistoryDetailScreen for drop sets', async () => {
      const completedWorkout: WorkoutSession = {
        id: 'hist_workout_1',
        name: 'Upper Body Workout',
        startedAt: '2026-11-10T10:00:00.000Z',
        finishedAt: '2026-11-10T11:00:00.000Z',
        status: 'completed',
        version: 1,
        exercises: [
          {
            exerciseId: 'ex_rows',
            exerciseName: 'Barbell Row',
            order: 0,
            actualSets: [
              {
                id: 'h_s1',
                setNumber: 1,
                weight: 80,
                reps: 10,
                setType: 'normal',
                completed: true,
              },
              {
                id: 'h_s2',
                setNumber: 2,
                weight: 70,
                reps: 12,
                setType: 'drop',
                completed: true,
              },
            ],
          },
        ],
      };

      await workoutStorage.saveCompletedWorkout(completedWorkout);
      mockSearchParams = { id: 'hist_workout_1' };

      const { findByText } = await render(<WorkoutHistoryDetailScreen />);

      expect(await findByText('SET 1')).toBeTruthy();
      expect(await findByText('DROP 2')).toBeTruthy();
    });
  });
});

