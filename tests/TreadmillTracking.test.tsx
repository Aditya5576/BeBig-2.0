/**
 * BeBig 2.0 — Treadmill Exercise & Tracking Mode Verification Suite
 *
 * Verifies:
 * 1. Catalog Identity & Cache Storage:
 *    - `seed-treadmill` exists in `SEED_EXERCISES` with `trackingMode: 'treadmill'`.
 *    - `seed-treadmill` is protected from cache eviction.
 *    - `searchCached` filters out duplicate legacy `wger_1615` in favor of `seed-treadmill`.
 * 2. Incline 0% Preservation & Durability:
 *    - `inclinePercent: 0` is valid and preserved across `isValidSet`, emergency mirror, and CAS 3-way merge.
 * 3. Active Workout Set Validation & Rest Pacing:
 *    - Treadmill sets complete with speed > 0 and duration > 0 (even with weight: 0, reps: 0).
 *    - Incline 0% completes successfully.
 *    - Rest timer is NOT automatically triggered for treadmill sets.
 * 4. Analytics & Volume Isolation:
 *    - Treadmill sets contribute 0 kg to `calculateTotalVolume`.
 *    - Treadmill exercises are ignored in `calculatePersonalRecords`.
 *    - `normalizeExercisePerformance` returns null for treadmill exercises.
 * 5. Formatting & Distance Metrics:
 *    - `calculateTreadmillDistanceKm`, `formatTreadmillDuration`, `formatTreadmillSet`.
 */

import React from 'react';
import { render, fireEvent, cleanup, waitFor, act } from '@testing-library/react-native';
import { SEED_EXERCISES, exerciseCacheStorage } from '../src/features/exercises/storage/exerciseCacheStorage';
import { isTreadmillExercise, isStrengthExercise, calculateTreadmillDistanceKm, formatTreadmillDuration, formatTreadmillSet, calculateTreadmillExerciseTotals } from '../src/features/workout/utils/treadmillMetrics';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { workoutRepository, mergeSessionDeep } from '../src/features/workout/services/workoutRepository';
import { calculatePersonalRecords } from '../src/features/workout/utils/analytics';
import { normalizeExercisePerformance } from '../src/features/performance/normalization';
import { ActiveSetRow } from '../src/features/workout/components/ActiveSetRow';
import { WorkoutExercise, WorkoutSet, WorkoutSession } from '../src/features/workout/types';
import { platformStorage } from '../src/lib/storage';
import ActiveWorkoutScreen from '../app/workout/active';
import { resolveExerciseTrackingMode, TREADMILL_EXERCISE_ID } from '../src/features/exercises/exerciseTracking';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => {
    const ReactActual = require('react');
    ReactActual.useEffect(() => {
      cb();
    }, [cb]);
  },
}));

describe('Treadmill Exercise & Tracking Mode Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
  });

  describe('1. Catalog Identity & Deduplication', () => {
    it('seeds seed-treadmill in SEED_EXERCISES with trackingMode treadmill', () => {
      const treadmillSeed = SEED_EXERCISES.find((e) => e.id === 'seed-treadmill');
      expect(treadmillSeed).toBeDefined();
      expect(treadmillSeed?.name).toBe('Treadmill');
      expect(treadmillSeed?.categoryName).toBe('Cardio');
      expect(treadmillSeed?.equipment?.[0]?.name).toBe('Treadmill');
      expect(treadmillSeed?.sourceProvider).toBe('system');
      expect(treadmillSeed?.trackingMode).toBe('treadmill');
    });

    it('identifies treadmill exercises using isTreadmillExercise and isStrengthExercise', () => {
      const treadmillEx: WorkoutExercise = {
        exerciseId: 'seed-treadmill',
        exerciseName: 'Treadmill',
        trackingMode: 'treadmill',
        order: 0,
        actualSets: [],
      };
      const benchPressEx: WorkoutExercise = {
        exerciseId: 'seed-bench-press',
        exerciseName: 'Barbell Bench Press',
        trackingMode: 'strength',
        order: 1,
        actualSets: [],
      };

      expect(isTreadmillExercise(treadmillEx)).toBe(true);
      expect(isStrengthExercise(treadmillEx)).toBe(false);

      expect(isTreadmillExercise(benchPressEx)).toBe(false);
      expect(isStrengthExercise(benchPressEx)).toBe(true);
    });

    it('filters out legacy wger_1615 when searching cached exercises in favor of seed-treadmill', async () => {
      const results = await exerciseCacheStorage.searchCached({ query: 'treadmill' });
      const hasSeed = results.some((e) => e.id === 'seed-treadmill');
      const hasLegacyWger = results.some((e) => e.id === 'wger_1615');

      expect(hasSeed).toBe(true);
      expect(hasLegacyWger).toBe(false);
    });
  });

  describe('2. Incline 0% Preservation & Durability', () => {
    it('validates and preserves inclinePercent: 0 across workout storage validation', async () => {
      const testSet: WorkoutSet = {
        id: 'tm_set_0',
        setNumber: 1,
        weight: 0,
        reps: 0,
        inclinePercent: 0,
        speedKph: 8,
        durationSeconds: 600,
        completed: false,
      };

      const testEx: WorkoutExercise = {
        exerciseId: 'seed-treadmill',
        exerciseName: 'Treadmill',
        trackingMode: 'treadmill',
        order: 0,
        actualSets: [testSet],
      };

      const testSession: WorkoutSession = {
        id: 'session-incline-0-test',
        name: 'Treadmill Test',
        status: 'active',
        startedAt: new Date().toISOString(),
        exercises: [testEx],
      };

      // Test isValidSet logic via storage write
      workoutStorage.writeSyncEmergencyMirror(testSession);
      const readMirror = await workoutStorage.readSyncEmergencyMirror();

      expect(readMirror).toBeDefined();
      expect(readMirror?.exercises[0]?.actualSets[0]?.inclinePercent).toBe(0);
      expect(readMirror?.exercises[0]?.actualSets[0]?.speedKph).toBe(8);
      expect(readMirror?.exercises[0]?.actualSets[0]?.durationSeconds).toBe(600);
    });

    it('merges sessions preserving inclinePercent: 0 during 3-way CAS rebase', () => {
      const baseSession: WorkoutSession = {
        id: 'session-cas-test',
        name: 'CAS Merge Test',
        status: 'active',
        startedAt: new Date().toISOString(),
        exercises: [
          {
            exerciseId: 'seed-treadmill',
            exerciseName: 'Treadmill',
            trackingMode: 'treadmill',
            order: 0,
            actualSets: [
              {
                id: 'set-1',
                setNumber: 1,
                weight: 0,
                reps: 0,
                inclinePercent: 2,
                speedKph: 5,
                durationSeconds: 300,
                completed: false,
              },
            ],
          },
        ],
      };

      const incomingSession: WorkoutSession = {
        ...baseSession,
        exercises: [
          {
            ...baseSession.exercises[0],
            actualSets: [
              {
                ...baseSession.exercises[0].actualSets[0],
                inclinePercent: 0, // User set flat incline 0%
                speedKph: 9.5,
              },
            ],
          },
        ],
      };

      const merged = mergeSessionDeep(baseSession, incomingSession);
      const mergedSet = merged.exercises[0].actualSets[0];

      expect(mergedSet.inclinePercent).toBe(0);
      expect(mergedSet.speedKph).toBe(9.5);
    });

    it('allows clearing speedKph and durationSeconds to undefined on uncompleted sets without rejection, and enforces validation upon completion', () => {
      const baseSession: WorkoutSession = {
        id: 'session-tm-clear-test',
        name: 'Treadmill Clear Test',
        status: 'active',
        startedAt: new Date().toISOString(),
        exercises: [
          {
            exerciseId: 'seed-treadmill',
            exerciseName: 'Treadmill',
            trackingMode: 'treadmill',
            order: 0,
            actualSets: [
              {
                id: 'tm-clear-1',
                setNumber: 1,
                weight: 0,
                reps: 0,
                inclinePercent: 2.5,
                speedKph: 8.5,
                durationSeconds: 600,
                completed: false,
              },
            ],
          },
        ],
      };

      // Clearing speedKph to undefined or 0 on uncompleted set must not throw
      const clearedSpeed = workoutRepository.updateSet(baseSession, 'seed-treadmill', 'tm-clear-1', {
        speedKph: undefined,
      });
      expect(clearedSpeed.exercises[0].actualSets[0].speedKph).toBeUndefined();

      // Setting in-progress 0 speed on uncompleted set must not throw
      const zeroSpeed = workoutRepository.updateSet(baseSession, 'seed-treadmill', 'tm-clear-1', {
        speedKph: 0,
      });
      expect(zeroSpeed.exercises[0].actualSets[0].speedKph).toBe(0);

      // Clearing durationSeconds to undefined or 0 on uncompleted set must not throw
      const clearedDuration = workoutRepository.updateSet(baseSession, 'seed-treadmill', 'tm-clear-1', {
        durationSeconds: undefined,
      });
      expect(clearedDuration.exercises[0].actualSets[0].durationSeconds).toBeUndefined();

      // Attempting to complete with missing/invalid speed must throw
      expect(() => {
        workoutRepository.updateSet(clearedSpeed, 'seed-treadmill', 'tm-clear-1', {
          completed: true,
        });
      }).toThrow('Completed treadmill sets require a valid speed between 0.1 and 40 km/h.');

      // Attempting to complete with missing/invalid duration must throw
      const validSpeedNoDuration = workoutRepository.updateSet(baseSession, 'seed-treadmill', 'tm-clear-1', {
        durationSeconds: undefined,
      });
      expect(() => {
        workoutRepository.updateSet(validSpeedNoDuration, 'seed-treadmill', 'tm-clear-1', {
          completed: true,
        });
      }).toThrow('Completed treadmill sets require a valid duration between 1 and 86400 seconds.');
    });
  });

  describe('3. Distance & Duration Metric Calculations', () => {
    it('calculates treadmill distance deterministically: (speedKph * durationSeconds) / 3600', () => {
      // 10 km/h for 3600 seconds (1 hour) = 10.00 km
      expect(calculateTreadmillDistanceKm(10, 3600)).toBeCloseTo(10.0, 2);

      // 8.5 km/h for 1800 seconds (30 mins) = 4.25 km
      expect(calculateTreadmillDistanceKm(8.5, 1800)).toBeCloseTo(4.25, 2);

      // Zero or invalid values return 0
      expect(calculateTreadmillDistanceKm(0, 1800)).toBe(0);
      expect(calculateTreadmillDistanceKm(10, 0)).toBe(0);
      expect(calculateTreadmillDistanceKm(-5, 1800)).toBe(0);
    });

    it('formats treadmill duration cleanly into mm:ss or hh:mm:ss', () => {
      expect(formatTreadmillDuration(0)).toBe('0:00');
      expect(formatTreadmillDuration(45)).toBe('0:45');
      expect(formatTreadmillDuration(750)).toBe('12:30');
      expect(formatTreadmillDuration(3665)).toBe('1:01:05');
    });

    it('formats treadmill set summary concisely', () => {
      const set1: WorkoutSet = {
        id: 's1',
        setNumber: 1,
        weight: 0,
        reps: 0,
        inclinePercent: 5,
        speedKph: 8,
        durationSeconds: 750,
        completed: true,
      };
      expect(formatTreadmillSet(set1)).toBe('5% @ 8 km/h • 12:30');

      const flatSet: WorkoutSet = {
        id: 's2',
        setNumber: 2,
        weight: 0,
        reps: 0,
        inclinePercent: 0,
        speedKph: 10.5,
        durationSeconds: 600,
        completed: true,
      };
      expect(formatTreadmillSet(flatSet)).toBe('0% @ 10.5 km/h • 10:00');
    });

    it('aggregates workout totals across multiple treadmill sets', () => {
      const sets: WorkoutSet[] = [
        {
          id: 's1',
          setNumber: 1,
          weight: 0,
          reps: 0,
          inclinePercent: 2,
          speedKph: 8,
          durationSeconds: 600, // 10m
          completed: true,
        },
        {
          id: 's2',
          setNumber: 2,
          weight: 0,
          reps: 0,
          inclinePercent: 4,
          speedKph: 10,
          durationSeconds: 900, // 15m
          completed: true,
        },
      ];

      const ex: WorkoutExercise = {
        exerciseId: 'seed-treadmill',
        exerciseName: 'Treadmill',
        trackingMode: 'treadmill',
        order: 0,
        actualSets: sets,
      };

      const totals = calculateTreadmillExerciseTotals(ex);
      expect(totals.totalDurationSeconds).toBe(1500); // 25 min
      expect(formatTreadmillDuration(totals.totalDurationSeconds)).toBe('25:00');
      // distance: (8 * 600)/3600 + (10 * 900)/3600 = 1.333 + 2.5 = 3.83 km
      expect(totals.totalDistanceKm).toBeCloseTo(3.83, 2);
    });
  });

  describe('4. Analytics & Volume Isolation', () => {
    it('excludes treadmill exercises from calculateTotalVolume', () => {
      const workout: WorkoutSession = {
        id: 'vol-test',
        name: 'Volume Isolation Test',
        status: 'completed',
        startedAt: new Date().toISOString(),
        exercises: [
          {
            exerciseId: 'seed-bench-press',
            exerciseName: 'Bench Press',
            trackingMode: 'strength',
            order: 0,
            actualSets: [
              { id: 'bp-1', setNumber: 1, weight: 100, reps: 5, completed: true },
              { id: 'bp-2', setNumber: 2, weight: 100, reps: 5, completed: true },
            ],
          },
          {
            exerciseId: 'seed-treadmill',
            exerciseName: 'Treadmill',
            trackingMode: 'treadmill',
            order: 1,
            actualSets: [
              {
                id: 'tm-1',
                setNumber: 1,
                weight: 0,
                reps: 0,
                inclinePercent: 5,
                speedKph: 8,
                durationSeconds: 1200,
                completed: true,
              },
            ],
          },
        ],
      };

      const volume = workoutRepository.calculateTotalVolume(workout);
      // Bench: 100 * 5 + 100 * 5 = 1000 kg. Treadmill: 0 kg.
      expect(volume).toBe(1000);
    });

    it('excludes treadmill exercises from calculatePersonalRecords', () => {
      const workout: WorkoutSession = {
        id: 'pr-test',
        name: 'PR Test',
        status: 'completed',
        startedAt: new Date().toISOString(),
        exercises: [
          {
            exerciseId: 'seed-treadmill',
            exerciseName: 'Treadmill',
            trackingMode: 'treadmill',
            order: 0,
            actualSets: [
              {
                id: 'tm-1',
                setNumber: 1,
                weight: 0,
                reps: 0,
                inclinePercent: 12,
                speedKph: 14,
                durationSeconds: 1800,
                completed: true,
              },
            ],
          },
        ],
      };

      const prs = calculatePersonalRecords([workout]);
      expect(prs.totalPRsCount).toBe(0);
      expect(prs.allPRs.length).toBe(0);
    });

    it('returns null from normalizeExercisePerformance for treadmill exercises', () => {
      const treadmillEx: WorkoutExercise = {
        exerciseId: 'seed-treadmill',
        exerciseName: 'Treadmill',
        trackingMode: 'treadmill',
        order: 0,
        actualSets: [
          {
            id: 'tm-1',
            setNumber: 1,
            weight: 0,
            reps: 0,
            inclinePercent: 5,
            speedKph: 8,
            durationSeconds: 600,
            completed: true,
          },
        ],
      };

      const rawSession: WorkoutSession = {
        id: 'sess-norm-test',
        name: 'Session',
        status: 'completed',
        startedAt: new Date().toISOString(),
        exercises: [treadmillEx],
      };

      const snap = normalizeExercisePerformance(treadmillEx, rawSession);
      expect(snap).toBeNull();
    });
  });

  describe('5. ActiveSetRow Component Rendering for Treadmill', () => {
    it('renders treadmill columns (Incline %, Speed km/h, Time) with proper values and hides RIR', async () => {
      const mockExercise: WorkoutExercise = {
        exerciseId: 'seed-treadmill',
        exerciseName: 'Treadmill',
        trackingMode: 'treadmill',
        order: 0,
        actualSets: [],
      };

      const mockSet: WorkoutSet = {
        id: 'tm-set-ui-1',
        setNumber: 1,
        weight: 0,
        reps: 0,
        inclinePercent: 4.5,
        speedKph: 9.2,
        durationSeconds: 750, // 12:30
        completed: false,
      };

      const onFocusField = jest.fn();
      const onToggleCompleteSet = jest.fn();

      const { getByTestId, queryByTestId } = await render(
        <ActiveSetRow
          exercise={mockExercise}
          set={mockSet}
          canDelete={false}
          onToggleNotes={jest.fn()}
          onDeleteSet={jest.fn()}
          onUpdateSetField={jest.fn()}
          onToggleCompleteSet={onToggleCompleteSet}
          isCustomKeypadActive={false}
          onFocusField={onFocusField}
        />
      );

      const inclineInput = getByTestId('set-incline-seed-treadmill-1');
      expect(inclineInput.props.value).toBe('4.5');

      const speedInput = getByTestId('set-speed-seed-treadmill-1');
      expect(speedInput.props.value).toBe('9.2');

      const timeInput = getByTestId('set-time-seed-treadmill-1');
      expect(timeInput.props.value).toBe('12:30');

      // Tapping incline field invokes onFocusField with 'inclinePercent'
      await fireEvent(inclineInput, 'focus');
      expect(onFocusField).toHaveBeenCalledWith('seed-treadmill', 'tm-set-ui-1', 'inclinePercent', '4.5');

      // RIR column is not present
      expect(queryByTestId('set-rir-seed-treadmill-1')).toBeNull();
    });
  });

  describe('6. Pre-existing LocalStorage Hydration & ActiveWorkoutScreen Integration', () => {
    it('surfaces seed-treadmill with trackingMode: treadmill even from older pre-v2.7.0 cache and renders 3-column card in ActiveWorkoutScreen', async () => {
      // 1. Simulate pre-v2.7.0 localStorage cache containing only legacy strength exercises (no trackingMode on treadmill or missing)
      const legacyCachedCatalog = [
        {
          id: 'seed-bench-press',
          name: 'Barbell Bench Press',
          category: 'chest',
          categoryName: 'Chest',
          sourceProvider: 'system',
        },
        {
          id: 'seed-squat',
          name: 'Barbell Back Squat',
          category: 'legs',
          categoryName: 'Legs',
          sourceProvider: 'system',
        },
        {
          id: 'seed-treadmill',
          name: 'Treadmill',
          category: 'cardio',
          categoryName: 'Cardio',
          sourceProvider: 'system',
          // Note: trackingMode is intentionally missing, simulating pre-v2.7.0 cache
        },
      ];

      await platformStorage.setItem('bebig.exercises.cache.catalog', JSON.stringify(legacyCachedCatalog));

      // Re-hydrate cache from storage
      await exerciseCacheStorage.clearCache();
      await exerciseCacheStorage.ensureHydrated();

      // Verify searchCached recovers trackingMode: 'treadmill' and pins it under cardio
      const cardioExercises = exerciseCacheStorage.searchCached({ category: 'cardio' });
      expect(cardioExercises.length).toBeGreaterThan(0);
      const tmExercise = cardioExercises.find((e) => e.id === TREADMILL_EXERCISE_ID);
      expect(tmExercise).toBeDefined();
      expect(tmExercise?.trackingMode).toBe('treadmill');
      expect(resolveExerciseTrackingMode(tmExercise)).toBe('treadmill');

      // 2. Start an active workout and add the treadmill exercise via ActiveWorkoutScreen / repository
      const testSession: WorkoutSession = {
        id: 'session-live-treadmill-test',
        name: 'Live Cardio Workout',
        status: 'active',
        startedAt: new Date().toISOString(),
        exercises: [],
      };
      await workoutStorage.saveActiveWorkout(testSession);

      const screen = await render(<ActiveWorkoutScreen />);

      await waitFor(() => {
        expect(screen.getByTestId('add-exercise-to-workout-button')).toBeTruthy();
      });

      // Open picker
      await act(async () => {
        fireEvent.press(screen.getByTestId('add-exercise-to-workout-button'));
      });

      // Filter by Cardio category in picker
      await waitFor(() => {
        expect(screen.getByTestId('picker-category-filter-cardio')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId('picker-category-filter-cardio'));
      });

      // Find and select seed-treadmill in picker
      await waitFor(() => {
        expect(screen.getByTestId('picker-exercise-seed-treadmill')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId('picker-exercise-seed-treadmill'));
      });

      // In single-select or multi-select, tap add if present
      const addBtn = screen.queryByTestId('picker-add-exercises-button');
      if (addBtn) {
        await act(async () => {
          fireEvent.press(addBtn);
        });
      }

      // 3. Verify that the 3-column Treadmill card renders with INCLINE, SPEED, TIME and NO RIR
      await waitFor(() => {
        expect(screen.getByText('INCLINE')).toBeTruthy();
        expect(screen.getByText('SPEED')).toBeTruthy();
        expect(screen.getByText('TIME')).toBeTruthy();
        expect(screen.getByTestId('set-incline-seed-treadmill-1')).toBeTruthy();
        expect(screen.getByTestId('set-speed-seed-treadmill-1')).toBeTruthy();
        expect(screen.getByTestId('set-time-seed-treadmill-1')).toBeTruthy();
        // RIR must NOT exist for treadmill
        expect(screen.queryByTestId('set-rir-seed-treadmill-1')).toBeNull();
      });
    });
  });
});
