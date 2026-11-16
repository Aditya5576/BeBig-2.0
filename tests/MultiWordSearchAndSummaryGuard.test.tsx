import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WorkoutSummaryScreen from '../app/workout/summary';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { exerciseCacheStorage, SEED_EXERCISES } from '../src/features/exercises/storage/exerciseCacheStorage';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { platformStorage } from '../src/lib/storage';
import { filterAndRankExercises, calculateExerciseMatchScore } from '../src/features/exercises/utils/exerciseSearch';
import { WorkoutSession } from '../src/features/workout/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, any> = {};

const mockUser = {
  id: 'usr_summary_guard_test',
  email: 'athlete@bebig.app',
};

let mockAuthState = {
  status: 'authenticated',
  user: mockUser as any,
  guestSession: null as any,
  isGuest: false,
};

jest.mock('../src/features/auth/store/useAuthStore', () => ({
  useAuthStore: Object.assign((selector: any) => selector(mockAuthState), {
    getState: () => mockAuthState,
    setState: (newState: any) => {
      mockAuthState = { ...mockAuthState, ...newState };
    },
  }),
}));

jest.mock('../src/features/auth', () => {
  const actual = jest.requireActual('../src/features/auth');
  return {
    ...actual,
    useAuthStore: Object.assign((selector: any) => selector(mockAuthState), {
      getState: () => mockAuthState,
      setState: (newState: any) => {
        mockAuthState = { ...mockAuthState, ...newState };
      },
    }),
  };
});

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
      return callback?.();
    }, []);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

describe('BeBig 2.0 — Permanent Fixes Verification', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockParams = {};
    await workoutStorage.clearAllWorkouts();
    exerciseRepository.clearInMemoryState();
    await exerciseCacheStorage.clearCache();
    await customExerciseStorage.clearCustomExercises();
  });

  describe('Task 1: Workout Summary 404 & Missing ID Guard', () => {
    it('1. Renders clean fallback state when workout ID does not exist and no completed history exists', async () => {
      mockParams = { id: 'non-existent-expired-id' };
      const screen = await render(<WorkoutSummaryScreen />);

      const fallback = await screen.findByTestId('workout-summary-fallback');
      expect(fallback).toBeTruthy();
      expect(await screen.findByText('Workout summary not found.')).toBeTruthy();

      const doneBtn = await screen.findByTestId('summary-done-button');
      fireEvent.press(doneBtn);
      expect(mockReplace).toHaveBeenCalledWith('/home');
    });

    it('2. Falls back to latest completed workout when given an unknown or expired ID if history exists', async () => {
      await workoutStorage.saveCompletedWorkout({
        id: 'valid_historical_session_1',
        name: 'Upper Body Power',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        finishedAt: new Date().toISOString(),
        status: 'completed',
        totalDuration: 1800,
        totalVolume: 800,
        completedSetsCount: 1,
        exercises: [
          {
            exerciseId: 'wger_73',
            exerciseName: 'Bench Press',
            categoryName: 'Chest',
            order: 0,
            actualSets: [
              { id: 'set_1', setNumber: 1, weight: 100, reps: 8, completed: true },
            ],
          },
        ],
      });

      mockParams = { id: 'some-stale-id-not-in-db' };
      const screen = await render(<WorkoutSummaryScreen />);

      expect(await screen.findByText(/Upper Body Power/)).toBeTruthy();
      expect(await screen.findByTestId('summary-done-button')).toBeTruthy();
    });

    it('3. Safely handles missing workout ID param by showing latest workout', async () => {
      await workoutStorage.saveCompletedWorkout({
        id: 'latest_workout_no_id_param',
        name: 'Full Body Surge',
        startedAt: new Date(Date.now() - 1800000).toISOString(),
        finishedAt: new Date().toISOString(),
        status: 'completed',
        totalDuration: 1200,
        totalVolume: 500,
        completedSetsCount: 1,
        exercises: [
          {
            exerciseId: 'wger_73',
            exerciseName: 'Bench Press',
            categoryName: 'Chest',
            order: 0,
            actualSets: [
              { id: 'set_1', setNumber: 1, weight: 50, reps: 10, completed: true },
            ],
          },
        ],
      });

      mockParams = {}; // No ID passed
      const screen = await render(<WorkoutSummaryScreen />);
      expect(await screen.findByText(/Full Body Surge/)).toBeTruthy();
    });

    it('4. Handles whitespace-only param (?id=%20%20) cleanly without crashing or bad lookups', async () => {
      mockParams = { id: '   ' };
      const screen = await render(<WorkoutSummaryScreen />);

      const fallback = await screen.findByTestId('workout-summary-fallback');
      expect(fallback).toBeTruthy();
    });

    it('5. Handles array-type query params (id: [\"bad_1\", \"bad_2\"]) gracefully', async () => {
      mockParams = { id: ['invalid_first_id', 'invalid_second_id'] };
      const screen = await render(<WorkoutSummaryScreen />);

      const fallback = await screen.findByTestId('workout-summary-fallback');
      expect(fallback).toBeTruthy();
    });

    it('6. Successfully extracts target workout ID when array param contains a valid ID', async () => {
      await workoutStorage.saveCompletedWorkout({
        id: 'array_param_target_session',
        name: 'Target Array Session',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        finishedAt: new Date().toISOString(),
        status: 'completed',
        totalDuration: 2400,
        totalVolume: 1200,
        completedSetsCount: 2,
        exercises: [
          {
            exerciseId: 'wger_73',
            exerciseName: 'Bench Press',
            categoryName: 'Chest',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 80, reps: 10, completed: true },
              { id: 's2', setNumber: 2, weight: 80, reps: 8, completed: true },
            ],
          },
        ],
      });

      mockParams = { id: ['array_param_target_session'] };
      const screen = await render(<WorkoutSummaryScreen />);

      expect(await screen.findByText(/Target Array Session/)).toBeTruthy();
    });

    it('7. Handles corrupt or partially-formed workout sessions (exercises: undefined / missing sets) without throwing', async () => {
      const corruptSession: any = {
        id: 'corrupt_session_payload',
        name: 'Defensive Test Workout',
        startedAt: new Date(Date.now() - 600000).toISOString(),
        finishedAt: new Date().toISOString(),
        status: 'completed',
        totalDuration: 600,
        totalVolume: 0,
        completedSetsCount: 0,
        // Corrupt exercises array with incomplete object / undefined actualSets
        exercises: [
          {
            exerciseId: 'wger_bad',
            exerciseName: 'Broken Exercise Record',
            categoryName: 'Chest',
            order: 0,
            actualSets: undefined,
          },
        ],
      };

      jest.spyOn(workoutRepository, 'getCompletedWorkoutById').mockResolvedValueOnce(corruptSession);

      mockParams = { id: 'corrupt_session_payload' };
      const screen = await render(<WorkoutSummaryScreen />);

      // Should render without throwing, showing 0 completed exercises
      expect(await screen.findByText(/Defensive Test Workout/)).toBeTruthy();
      expect(await screen.findByTestId('summary-duration')).toBeTruthy();
      expect(await screen.findByTestId('summary-volume')).toBeTruthy();
      expect(screen.getByTestId('summary-exercises-count')).toHaveTextContent('0');
      expect(screen.getByTestId('summary-sets-count')).toHaveTextContent('0');
    });
  });

  describe('Task 2: Multi-Word Custom Exercise Search & Tokenization', () => {
    it('1. Keyword tokenization matches multi-word custom exercises regardless of exact word sequence', () => {
      const targetName = 'Smith Machine Inclined Press';

      // Exact match
      expect(calculateExerciseMatchScore(targetName, 'Smith Machine Inclined Press')).toBeGreaterThan(60);

      // Order-independent: "inclined smith press"
      expect(calculateExerciseMatchScore(targetName, 'inclined smith press')).toBeGreaterThanOrEqual(60);

      // Substring & stem variations: "smith incline press"
      expect(calculateExerciseMatchScore(targetName, 'smith incline press')).toBeGreaterThanOrEqual(60);

      // Reordered words: "press smith machine inclined"
      expect(calculateExerciseMatchScore(targetName, 'press smith machine inclined')).toBeGreaterThanOrEqual(60);

      // Partial subset tokens: "smith press"
      expect(calculateExerciseMatchScore(targetName, 'smith press')).toBeGreaterThanOrEqual(60);

      // All caps query
      expect(calculateExerciseMatchScore(targetName, 'SMITH MACHINE INCLINED')).toBeGreaterThanOrEqual(60);
    });

    it('2. Tolerates extra punctuation, leading/trailing whitespace, and consecutive spaces', () => {
      const targetName = 'Smith Machine Inclined Press';

      expect(calculateExerciseMatchScore(targetName, '  smith - machine   inclined!! ')).toBeGreaterThanOrEqual(60);
      expect(calculateExerciseMatchScore(targetName, 'smith, machine: inclined')).toBeGreaterThanOrEqual(60);
      // Whitespace query returns baseline 1 (matches all)
      expect(calculateExerciseMatchScore(targetName, '   ')).toBe(1);
    });

    it('3. Matches partial prefixes and stems while penalizing unrelated queries', () => {
      const targetName = 'Smith Machine Inclined Press';

      // Prefix stems
      expect(calculateExerciseMatchScore(targetName, 'smith mach')).toBeGreaterThanOrEqual(60);
      expect(calculateExerciseMatchScore(targetName, 'inclin smith')).toBeGreaterThanOrEqual(60);

      // Unrelated queries
      expect(calculateExerciseMatchScore(targetName, 'barbell deadlift')).toBe(0);
      expect(calculateExerciseMatchScore(targetName, 'squats')).toBe(0);
    });

    it('4. Custom exercises are indexed and searchable via exerciseRepository.getCachedExercises synchronously (0ms)', async () => {
      const created = await exerciseRepository.createCustomExercise({
        name: 'Smith Machine Inclined Press',
        category: 'chest',
        primaryMuscles: ['Chest'],
        equipment: ['Smith Machine'],
      });

      expect(created.id).toBeTruthy();

      // Instant synchronous cache search with exact query
      const match1 = exerciseRepository.getCachedExercises({ query: 'Smith Machine Inclined Press' });
      expect(match1.some((e) => e.name === 'Smith Machine Inclined Press')).toBe(true);

      // Instant synchronous cache search with reversed/order-independent query
      const match2 = exerciseRepository.getCachedExercises({ query: 'inclined smith press' });
      expect(match2.some((e) => e.name === 'Smith Machine Inclined Press')).toBe(true);

      // Instant synchronous cache search with subset terms
      const match3 = exerciseRepository.getCachedExercises({ query: 'smith press' });
      expect(match3.some((e) => e.name === 'Smith Machine Inclined Press')).toBe(true);

      // Searching with source: 'custom'
      const matchCustom = exerciseRepository.getCachedExercises({
        query: 'smith',
        source: 'custom',
      });
      expect(matchCustom.length).toBeGreaterThan(0);
      expect(matchCustom[0].name).toBe('Smith Machine Inclined Press');
    });

    it('5. Cross-source filtering strictly respects source: \"custom\" | \"external\" | \"all\"', async () => {
      await exerciseRepository.createCustomExercise({
        name: 'Custom Pec Dec Flye',
        category: 'chest',
        primaryMuscles: ['Chest'],
        equipment: ['Machine'],
      });

      // source: 'custom' returns only custom exercises
      const customOnly = exerciseRepository.getCachedExercises({ source: 'custom' });
      expect(customOnly.every((e) => e.isCustom || e.sourceProvider === 'custom')).toBe(true);
      expect(customOnly.some((e) => e.name === 'Custom Pec Dec Flye')).toBe(true);

      // source: 'external' never contains custom exercises
      const externalOnly = exerciseRepository.getCachedExercises({ source: 'external' });
      expect(externalOnly.every((e) => !e.isCustom && e.sourceProvider !== 'custom')).toBe(true);
      expect(externalOnly.some((e) => e.name === 'Custom Pec Dec Flye')).toBe(false);

      // source: 'all' returns custom and system seed exercises
      const allSources = exerciseRepository.getCachedExercises({ source: 'all' });
      expect(allSources.some((e) => e.name === 'Custom Pec Dec Flye')).toBe(true);
      expect(allSources.some((e) => e.id === 'seed-bench-press')).toBe(true);
    });

    it('6. Cold-start reload simulation: hydrates custom exercises into customCatalog for 0ms lookup', async () => {
      // 1. Pre-save a custom exercise directly into persistent storage to simulate a previous session
      const mockSavedCustom = {
        id: 'custom_cold_start_test_1',
        name: 'Cold Start Smith Incline Press',
        description: 'Previously saved custom exercise before app killed',
        category: 'chest' as const,
        categoryName: 'Chest',
        primaryMuscles: [{ id: 'cm_0', name: 'Upper Chest' }],
        secondaryMuscles: [],
        equipment: [{ id: 'eq_smith', name: 'Smith Machine' }],
        images: [],
        sourceProvider: 'custom' as const,
        isCustom: true,
      };

      await customExerciseStorage.saveCustomExercise(mockSavedCustom);

      // 2. Simulate fresh app start: clear in-memory caches
      exerciseRepository.clearInMemoryState();
      await exerciseCacheStorage.clearCache();

      // Before hydration: customCatalog is empty
      expect(exerciseCacheStorage.getCustomExercisesSync().length).toBe(0);

      // 3. Trigger hydration (as done on app launch or screen mount)
      await exerciseCacheStorage.ensureHydrated();

      // After hydration: custom exercise is present in memory synchronously
      const syncCustoms = exerciseCacheStorage.getCustomExercisesSync();
      expect(syncCustoms.some((e) => e.id === 'custom_cold_start_test_1')).toBe(true);

      // 0ms synchronous search finds it
      const cachedMatches = exerciseRepository.getCachedExercises({ query: 'cold start smith' });
      expect(cachedMatches.length).toBeGreaterThan(0);
      expect(cachedMatches[0].name).toBe('Cold Start Smith Incline Press');

      // 0ms sync lookup by ID finds it
      const foundById = exerciseCacheStorage.getCachedExerciseByIdSync('custom_cold_start_test_1');
      expect(foundById).not.toBeNull();
      expect(foundById?.name).toBe('Cold Start Smith Incline Press');
    });

    it('7. filterAndRankExercises surfaces multi-word matches across combined metadata', () => {
      const mockCustomExercise = {
        id: 'cust_smith_1',
        name: 'Smith Machine Inclined Press',
        description: 'Upper chest pressing on the smith machine',
        category: 'chest' as const,
        categoryName: 'Chest',
        primaryMuscles: [{ id: 'm-pecs', name: 'Pectoralis Major', isFront: true }],
        secondaryMuscles: [],
        equipment: [{ id: 'eq-smith', name: 'Smith Machine' }],
        images: [],
        sourceProvider: 'custom' as const,
        isCustom: true,
      };

      const results = filterAndRankExercises([mockCustomExercise], 'inclined smith press');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Smith Machine Inclined Press');
    });
  });
});
