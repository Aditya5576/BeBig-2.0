/**
 * BeBig 2.0 — UI Milestone 1 Verification Suite
 *
 * Verifies:
 * 1. Floating Collapsible Rest-Timer Pill (`RestTimerOverlay`):
 *    - Lightweight react-native-svg circular countdown ring (0 KB bitmap memory)
 *    - `-15s`, `+15s`, `PAUSE`/`RESUME`, and `SKIP` controls
 *    - Expand / collapse pill toggle with preserved countdown ring and quick `SKIP`
 *    - Non-blocking `pointerEvents="box-none"` overlay preserving underlying workout interactivity
 * 2. Inline Progressive-Overload Nudges (`previousPerformanceService` + `ActiveExerciseCard`):
 *    - Deterministic newest-session top working-set calculation (ignoring warmups when working sets exist)
 *    - Renders compact `Last: 80 kg × 8` badge for matching `exerciseId`
 *    - Stays hidden when no historical performance exists
 */

import React from 'react';
import { View, Pressable, Text as RNText } from 'react-native';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native';
import { RestTimerOverlay } from '../src/features/workout/components/RestTimerOverlay';
import { ActiveExerciseCard } from '../src/features/workout/components/ActiveExerciseCard';
import {
  buildProgressiveOverloadMap,
  computeBestLastSetNudge,
} from '../src/features/workout/services/previousPerformanceService';
import { ActiveRestTimer, WorkoutExercise, WorkoutSession } from '../src/features/workout/types';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const createMockRestTimer = (overrides?: Partial<ActiveRestTimer>): ActiveRestTimer => ({
  exerciseId: 'ex_bench',
  exerciseName: 'Barbell Bench Press',
  setNumber: 2,
  targetEndTime: Date.now() + 90_000,
  durationSeconds: 90,
  isPaused: false,
  ...overrides,
});

const createMockWorkoutExercise = (overrides?: Partial<WorkoutExercise>): WorkoutExercise => ({
  exerciseId: 'ex_bench',
  exerciseName: 'Barbell Bench Press',
  categoryName: 'Chest',
  order: 0,
  actualSets: [
    {
      id: 'set_1',
      setNumber: 1,
      weight: 80,
      reps: 8,
      completed: false,
      setType: 'normal',
    },
  ],
  ...overrides,
});

const createCompletedWorkout = (
  id: string,
  finishedAt: string,
  exercises: WorkoutExercise[],
): WorkoutSession => ({
  id,
  name: 'Push Day',
  status: 'completed',
  startedAt: finishedAt,
  finishedAt,
  exercises,
});

describe('UI Milestone 1 — Floating Collapsible Rest-Timer Pill & Progressive-Overload Nudges', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'setInterval').mockImplementation((() => 123) as unknown as typeof setInterval);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  describe('1. Floating Collapsible Rest-Timer Pill', () => {
    it('renders SVG countdown ring, MM:SS readout, -15s/+15s/SKIP controls, and non-blocking overlay wrapper', async () => {
      const onExtend = jest.fn();
      const onClear = jest.fn();
      const onTogglePause = jest.fn();
      const onLogSetUnderlying = jest.fn();

      const { findByTestId, findByText } = await render(
        <View style={{ flex: 1 }}>
          <Pressable testID="underlying-workout-control" onPress={onLogSetUnderlying}>
            <RNText>Log Set</RNText>
          </Pressable>
          <RestTimerOverlay
            activeRestTimer={createMockRestTimer()}
            onExtend={onExtend}
            onClear={onClear}
            onTogglePause={onTogglePause}
          />
        </View>,
      );

      // Non-blocking overlay wrapper
      const overlay = await findByTestId('persistent-rest-overlay');
      expect(overlay.props.pointerEvents).toBe('box-none');

      // Underlying workout control remains interactive
      const underlyingBtn = await findByTestId('underlying-workout-control');
      await act(async () => {
        fireEvent.press(underlyingBtn);
      });
      expect(onLogSetUnderlying).toHaveBeenCalledTimes(1);

      // SVG countdown ring & controls present
      expect(await findByTestId('rest-timer-progress-ring')).toBeTruthy();
      expect(await findByTestId('rest-countdown-text')).toBeTruthy();
      expect(await findByText('-15s')).toBeTruthy();
      expect(await findByText('+15s')).toBeTruthy();
      expect(await findByText('SKIP')).toBeTruthy();

      await act(async () => {
        fireEvent.press(await findByTestId('extend-rest-minus-15-button'));
        fireEvent.press(await findByTestId('extend-rest-plus-15-button'));
        fireEvent.press(await findByTestId('skip-rest-timer-button'));
      });
      expect(onExtend).toHaveBeenCalledWith(-15);
      expect(onExtend).toHaveBeenCalledWith(15);
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('collapses into compact floating pill and expands back cleanly', async () => {
      const onClear = jest.fn();

      const { findByTestId, queryByTestId } = await render(
        <RestTimerOverlay
          activeRestTimer={createMockRestTimer()}
          onExtend={jest.fn()}
          onClear={onClear}
          onTogglePause={jest.fn()}
        />,
      );

      // Initially expanded
      expect(await findByTestId('rest-timer-banner')).toBeTruthy();
      expect(queryByTestId('rest-timer-collapsed-pill')).toBeNull();

      // Collapse to compact pill
      await act(async () => {
        fireEvent.press(await findByTestId('rest-timer-collapse-toggle'));
      });

      expect(await findByTestId('rest-timer-collapsed-pill')).toBeTruthy();
      expect(queryByTestId('rest-timer-banner')).toBeNull();
      expect(await findByTestId('rest-timer-progress-ring')).toBeTruthy();
      expect(await findByTestId('rest-countdown-text')).toBeTruthy();
      expect(await findByTestId('skip-rest-timer-button')).toBeTruthy();

      // Expand back to full controls
      await act(async () => {
        fireEvent.press(await findByTestId('rest-timer-collapse-toggle'));
      });

      expect(await findByTestId('rest-timer-banner')).toBeTruthy();
      expect(await findByTestId('extend-rest-minus-15-button')).toBeTruthy();
      expect(await findByTestId('extend-rest-plus-15-button')).toBeTruthy();

      // Quick skip works from collapsed state too
      await act(async () => {
        fireEvent.press(await findByTestId('rest-timer-collapse-toggle'));
      });
      await act(async () => {
        fireEvent.press(await findByTestId('skip-rest-timer-button'));
      });
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Inline Progressive-Overload Nudges', () => {
    it('builds exerciseId -> top working set map using newest completed session and ignoring warmups', () => {
      const olderWorkout = createCompletedWorkout('w_old', '2026-11-10T10:00:00.000Z', [
        createMockWorkoutExercise({
          exerciseId: 'ex_bench',
          actualSets: [
            { id: 's_o1', setNumber: 1, weight: 75, reps: 8, completed: true, setType: 'normal' },
          ],
        }),
      ]);

      const newerWorkout = createCompletedWorkout('w_new', '2026-11-16T10:00:00.000Z', [
        createMockWorkoutExercise({
          exerciseId: 'ex_bench',
          actualSets: [
            { id: 's_w1', setNumber: 1, weight: 100, reps: 5, completed: true, setType: 'warmup' },
            { id: 's_n1', setNumber: 2, weight: 80, reps: 8, completed: true, setType: 'normal' },
            { id: 's_n2', setNumber: 3, weight: 80, reps: 6, completed: true, setType: 'normal' },
          ],
        }),
        createMockWorkoutExercise({
          exerciseId: 'ex_pullup',
          exerciseName: 'Pull-Up',
          actualSets: [
            { id: 's_p1', setNumber: 1, weight: 0, reps: 12, completed: true, setType: 'normal' },
          ],
        }),
      ]);

      const map = buildProgressiveOverloadMap([olderWorkout, newerWorkout], 'w_active');

      expect(map.ex_bench).toEqual({
        weight: 80,
        reps: 8,
        date: '2026-11-16T10:00:00.000Z',
        label: 'Best Last: 80 kg × 8',
      });
      expect(map.ex_pullup).toEqual({
        weight: 0,
        reps: 12,
        date: '2026-11-16T10:00:00.000Z',
        label: 'Best Last: BW × 12',
      });
      expect(map.ex_unknown).toBeUndefined();
      expect(computeBestLastSetNudge(null)).toBeNull();
    });

    it('displays Best Last: 80 kg × 8 badge on ActiveExerciseCard when history exists and hides it when absent', async () => {
      const benchEx = createMockWorkoutExercise({ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press' });
      const newEx = createMockWorkoutExercise({ exerciseId: 'ex_new', exerciseName: 'Cable Fly' });

      const noop = jest.fn();

      const { findByTestId, findByText, queryByTestId } = await render(
        <View>
          <ActiveExerciseCard
            exercise={benchEx}
            exIndex={0}
            totalExercisesCount={2}
            overloadNudge={{
              weight: 80,
              reps: 8,
              date: '2026-11-16T10:00:00.000Z',
              label: 'Best Last: 80 kg × 8',
            }}
            expandedNotesSetIds={{}}
            onMoveUp={noop}
            onMoveDown={noop}
            onRemoveExercise={noop}
            onAddSet={noop}
            onDeleteSet={noop}
            onToggleNotes={noop}
            onUpdateSetField={noop}
            onToggleCompleteSet={noop}
          />
          <ActiveExerciseCard
            exercise={newEx}
            exIndex={1}
            totalExercisesCount={2}
            overloadNudge={null}
            expandedNotesSetIds={{}}
            onMoveUp={noop}
            onMoveDown={noop}
            onRemoveExercise={noop}
            onAddSet={noop}
            onDeleteSet={noop}
            onToggleNotes={noop}
            onUpdateSetField={noop}
            onToggleCompleteSet={noop}
          />
        </View>,
      );

      expect(await findByTestId('overload-nudge-badge-ex_bench')).toBeTruthy();
      expect(await findByText('Best Last: 80 kg × 8')).toBeTruthy();
      expect(queryByTestId('overload-nudge-badge-ex_new')).toBeNull();
    });

    it('keeps LAST TIME full breakdown collapsed by default behind toggle-last-session-<exerciseId> and expands on tap', async () => {
      const benchEx = createMockWorkoutExercise({ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press' });
      const noop = jest.fn();

      const { findByTestId, findByText, queryByTestId } = await render(
        <ActiveExerciseCard
          exercise={benchEx}
          exIndex={0}
          totalExercisesCount={1}
          lastPerformance={{
            workoutDate: '2026-11-16T10:00:00.000Z',
            sets: [
              { id: 'p1', setNumber: 1, weight: 80, reps: 8, rir: 1, notes: 'Clean pause', completed: true },
            ],
          }}
          expandedNotesSetIds={{}}
          onMoveUp={noop}
          onMoveDown={noop}
          onRemoveExercise={noop}
          onAddSet={noop}
          onDeleteSet={noop}
          onToggleNotes={noop}
          onUpdateSetField={noop}
          onToggleCompleteSet={noop}
        />,
      );

      // Best Last badge visible immediately; full LAST TIME box collapsed by default
      expect(await findByText('Best Last: 80 kg × 8')).toBeTruthy();
      expect(await findByTestId('toggle-last-session-ex_bench')).toBeTruthy();
      expect(queryByTestId('last-time-performance-ex_bench')).toBeNull();

      // Tap History toggle -> full LAST TIME breakdown expands
      await act(async () => {
        fireEvent.press(await findByTestId('toggle-last-session-ex_bench'));
      });

      expect(await findByTestId('last-time-performance-ex_bench')).toBeTruthy();
      expect(await findByText(/80kg × 8 @ RIR 1 📝/i)).toBeTruthy();

      // Tap again -> collapses back
      await act(async () => {
        fireEvent.press(await findByTestId('toggle-last-session-ex_bench'));
      });
      expect(queryByTestId('last-time-performance-ex_bench')).toBeNull();
    });

    it('one-tap PREV quick-fill populates empty weight/reps without overwriting existing user input', async () => {
      const benchEx = createMockWorkoutExercise({
        exerciseId: 'ex_bench',
        actualSets: [
          // Row 0: empty pending inputs
          { id: 'set_empty', setNumber: 1, weight: 0, reps: 0, completed: false, setType: 'normal' },
          // Row 1: user already entered weight (85) while reps is empty
          { id: 'set_partial', setNumber: 2, weight: 85, reps: 0, completed: false, setType: 'normal' },
        ],
      });
      const onUpdateSetField = jest.fn();
      const noop = jest.fn();

      const { findByTestId } = await render(
        <ActiveExerciseCard
          exercise={benchEx}
          exIndex={0}
          totalExercisesCount={1}
          lastPerformance={{
            workoutDate: '2026-11-16T10:00:00.000Z',
            sets: [
              { id: 'p1', setNumber: 1, weight: 80, reps: 10, completed: true },
              { id: 'p2', setNumber: 2, weight: 80, reps: 8, completed: true },
            ],
          }}
          expandedNotesSetIds={{}}
          onMoveUp={noop}
          onMoveDown={noop}
          onRemoveExercise={noop}
          onAddSet={noop}
          onDeleteSet={noop}
          onToggleNotes={noop}
          onUpdateSetField={onUpdateSetField}
          onToggleCompleteSet={noop}
        />,
      );

      // Row 0: both weight and reps were empty -> both filled from PREV (80 × 10)
      await act(async () => {
        fireEvent.press(await findByTestId('prev-quick-fill-0'));
      });
      expect(onUpdateSetField).toHaveBeenCalledWith('ex_bench', 'set_empty', 'weight', '80');
      expect(onUpdateSetField).toHaveBeenCalledWith('ex_bench', 'set_empty', 'reps', '10');

      onUpdateSetField.mockClear();

      // Row 1: user already typed weight=85 -> must NOT overwrite weight, only fill empty reps=8
      await act(async () => {
        fireEvent.press(await findByTestId('prev-quick-fill-1'));
      });
      expect(onUpdateSetField).not.toHaveBeenCalledWith('ex_bench', 'set_partial', 'weight', expect.anything());
      expect(onUpdateSetField).toHaveBeenCalledWith('ex_bench', 'set_partial', 'reps', '8');
    });
  });
});
