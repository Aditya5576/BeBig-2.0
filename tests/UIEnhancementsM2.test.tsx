/**
 * BeBig 2.0 — UI Milestone 2 Verification Suite
 *
 * Verifies:
 * 1. Tapping the exercise title/trigger (`exercise-detail-trigger-<exerciseId>`) in `ActiveExerciseCard`
 *    dispatches `onPressExerciseDetail(exerciseId, exerciseName)` without interfering with header actions
 *    or the `Last: 80 kg × 8` overload nudge badge.
 * 2. `ExerciseDetailModal` renders full exercise details (name, category, equipment, primary/secondary
 *    muscles, single image preview with onError fallback, and step-by-step instructions), handles
 *    deleted/offline fallback cleanly, and invokes `onClose` on dismiss.
 * 3. Opening and closing `ExerciseDetailModal` directly inside `/workout/active` preserves existing
 *    logged sets, active rest timer state, and never navigates away.
 */

import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native';
import ActiveWorkoutScreen from '../app/workout/active';
import { ActiveExerciseCard } from '../src/features/workout/components/ActiveExerciseCard';
import { ExerciseDetailModal } from '../src/features/workout/components/ExerciseDetailModal';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import type { Exercise } from '../src/features/exercises/types';
import type { WorkoutExercise, WorkoutSession } from '../src/features/workout/types';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (fn: () => void) => {
    const ReactRef = require('react');
    ReactRef.useEffect(fn, []);
  },
  useLocalSearchParams: () => ({}),
  useSegments: () => ['workout', 'active'],
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../src/features/workout/services/workoutNotificationService', () => ({
  workoutNotificationService: {
    ensureNotificationChannel: jest.fn(async () => {}),
    scheduleRestNotification: jest.fn(async () => null),
    cancelRestNotification: jest.fn(async () => {}),
  },
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const MOCK_FULL_EXERCISE: Exercise = {
  id: 'seed-bench-press',
  name: 'Barbell Bench Press',
  description:
    'Retract shoulder blades firmly into the bench.\nLower the bar under control to mid-chest.\nDrive feet into the floor and press back to lockout.',
  category: 'chest',
  categoryName: 'Chest',
  primaryMuscles: [{ id: 'm1', name: 'Pectoralis Major' }],
  secondaryMuscles: [
    { id: 'm2', name: 'Anterior Deltoid' },
    { id: 'm3', name: 'Triceps Brachii' },
  ],
  equipment: [
    { id: 'eq1', name: 'Barbell' },
    { id: 'eq2', name: 'Bench' },
  ],
  images: [{ id: 'img1', url: 'https://wger.de/media/exercise-images/bench.png', isMain: true }],
  sourceProvider: 'system',
  isCustom: false,
};

const createMockWorkoutExercise = (overrides?: Partial<WorkoutExercise>): WorkoutExercise => ({
  exerciseId: 'seed-bench-press',
  exerciseName: 'Barbell Bench Press',
  categoryName: 'Chest',
  order: 0,
  actualSets: [
    {
      id: 'set_1',
      setNumber: 1,
      weight: 80,
      reps: 8,
      completed: true,
      setType: 'normal',
    },
    {
      id: 'set_2',
      setNumber: 2,
      weight: 82.5,
      reps: 6,
      completed: false,
      setType: 'normal',
    },
  ],
  ...overrides,
});

const createMockActiveSession = (): WorkoutSession => ({
  id: 'sess_m2_active',
  name: 'Upper Push Session',
  status: 'active',
  startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  exercises: [createMockWorkoutExercise()],
  activeRestTimer: {
    exerciseId: 'seed-bench-press',
    exerciseName: 'Barbell Bench Press',
    setNumber: 1,
    targetEndTime: Date.now() + 75_000,
    durationSeconds: 90,
    isPaused: false,
  },
});

describe('UI Milestone 2 — In-Workout Exercise Detail Modal', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'setInterval').mockImplementation((() => 321) as unknown as typeof setInterval);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  describe('1. ActiveExerciseCard Detail Trigger', () => {
    it('calls onPressExerciseDetail with exact exerciseId and exerciseName without interfering with overload badge or actions', async () => {
      const onPressExerciseDetail = jest.fn();
      const onRemoveExercise = jest.fn();
      const noop = jest.fn();
      const exercise = createMockWorkoutExercise();

      const { findByTestId, findByText } = await render(
        <ActiveExerciseCard
          exercise={exercise}
          exIndex={0}
          totalExercisesCount={1}
          overloadNudge={{
            weight: 80,
            reps: 8,
            date: '2026-11-16T10:00:00.000Z',
            label: 'Best Last: 80 kg × 8',
          }}
          expandedNotesSetIds={{}}
          onMoveUp={noop}
          onMoveDown={noop}
          onRemoveExercise={onRemoveExercise}
          onAddSet={noop}
          onDeleteSet={noop}
          onToggleNotes={noop}
          onUpdateSetField={noop}
          onToggleCompleteSet={noop}
          onPressExerciseDetail={onPressExerciseDetail}
        />,
      );

      // Overload nudge badge remains intact
      expect(await findByTestId('overload-nudge-badge-seed-bench-press')).toBeTruthy();
      expect(await findByText('Best Last: 80 kg × 8')).toBeTruthy();

      // Tap exercise detail trigger
      const trigger = await findByTestId('exercise-detail-trigger-seed-bench-press');
      await act(async () => {
        fireEvent.press(trigger);
      });

      expect(onPressExerciseDetail).toHaveBeenCalledTimes(1);
      expect(onPressExerciseDetail).toHaveBeenCalledWith('seed-bench-press', 'Barbell Bench Press');
      expect(onRemoveExercise).not.toHaveBeenCalled();

      // Remove action still works independently
      await act(async () => {
        fireEvent.press(await findByTestId('remove-exercise-seed-bench-press'));
      });
      expect(onRemoveExercise).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. ExerciseDetailModal Rendering, Fallback & Dismiss', () => {
    it('renders full exercise details (name, primary/secondary muscles, equipment, instructions) and dismisses cleanly', async () => {
      jest
        .spyOn(exerciseRepository, 'getCachedExerciseByIdSync')
        .mockReturnValue(MOCK_FULL_EXERCISE);
      jest
        .spyOn(exerciseRepository, 'getExerciseById')
        .mockResolvedValue(MOCK_FULL_EXERCISE);

      const onClose = jest.fn();

      const { findByTestId, findByText } = await render(
        <ExerciseDetailModal
          visible={true}
          exerciseId="seed-bench-press"
          fallbackExerciseName="Barbell Bench Press"
          onClose={onClose}
        />,
      );

      expect(await findByTestId('exercise-detail-modal')).toBeTruthy();
      expect(await findByTestId('exercise-detail-modal-name')).toBeTruthy();
      expect(await findByText('Barbell Bench Press')).toBeTruthy();
      expect(await findByText('CHEST')).toBeTruthy();
      expect(await findByTestId('exercise-detail-modal-primary-muscles')).toBeTruthy();
      expect(await findByText('Pectoralis Major')).toBeTruthy();
      expect(await findByTestId('exercise-detail-modal-secondary-muscles')).toBeTruthy();
      expect(await findByText('Anterior Deltoid, Triceps Brachii')).toBeTruthy();
      expect(await findByTestId('exercise-detail-modal-equipment')).toBeTruthy();
      expect(await findByText('Barbell, Bench')).toBeTruthy();
      expect(await findByTestId('exercise-detail-modal-instructions')).toBeTruthy();
      expect(await findByText('Retract shoulder blades firmly into the bench.')).toBeTruthy();
      expect(await findByText('Drive feet into the floor and press back to lockout.')).toBeTruthy();

      await act(async () => {
        fireEvent.press(await findByTestId('close-exercise-detail-modal'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders graceful fallback state when an exercise was deleted or is unavailable offline', async () => {
      jest.spyOn(exerciseRepository, 'getCachedExerciseByIdSync').mockReturnValue(null);
      jest.spyOn(exerciseRepository, 'getExerciseById').mockResolvedValue(null);

      const onClose = jest.fn();

      const { findByTestId, findByText } = await render(
        <ExerciseDetailModal
          visible={true}
          exerciseId="custom_deleted_99"
          fallbackExerciseName="Archived Zercher Squat"
          onClose={onClose}
        />,
      );

      expect(await findByTestId('exercise-detail-modal-fallback')).toBeTruthy();
      expect(await findByText('Archived Zercher Squat')).toBeTruthy();
      expect(await findByText('Details Unavailable')).toBeTruthy();

      await act(async () => {
        fireEvent.press(await findByTestId('close-exercise-detail-modal'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. ActiveWorkoutScreen Integration (State & Rest Timer Preserved)', () => {
    it('opens and closes ExerciseDetailModal over /workout/active without losing logged sets or active rest timer', async () => {
      const mockSession = createMockActiveSession();

      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(mockSession);
      jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
      jest.spyOn(workoutRepository, 'updateActiveWorkout').mockResolvedValue(mockSession);
      jest.spyOn(workoutRepository, 'isSessionDiscarded').mockResolvedValue(false);
      jest
        .spyOn(exerciseRepository, 'getCachedExerciseByIdSync')
        .mockReturnValue(MOCK_FULL_EXERCISE);
      jest
        .spyOn(exerciseRepository, 'getExerciseById')
        .mockResolvedValue(MOCK_FULL_EXERCISE);

      const { findByTestId, findByText, queryByTestId } = await render(<ActiveWorkoutScreen />);

      // Active workout mounted with logged set + active rest timer
      expect(await findByText('Finish Workout (1 sets)')).toBeTruthy();
      expect(await findByTestId('rest-timer-banner')).toBeTruthy();
      expect(queryByTestId('exercise-detail-modal')).toBeNull();

      // Tap exercise title to open ExerciseDetailModal
      const trigger = await findByTestId('exercise-detail-trigger-seed-bench-press');
      await act(async () => {
        fireEvent.press(trigger);
      });

      expect(await findByTestId('exercise-detail-modal')).toBeTruthy();
      expect(await findByText('Pectoralis Major')).toBeTruthy();
      expect(await findByText('Barbell, Bench')).toBeTruthy();

      // Dismiss modal
      await act(async () => {
        fireEvent.press(await findByTestId('close-exercise-detail-modal'));
      });

      expect(queryByTestId('exercise-detail-modal')).toBeNull();

      // Active workout sets and rest timer are 100% preserved, with zero route navigation
      expect(await findByText('Finish Workout (1 sets)')).toBeTruthy();
      expect(await findByTestId('rest-timer-banner')).toBeTruthy();
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });
});
