/**
 * BeBig 2.0 — Stale Resume Workout Bug Regression Tests
 *
 * Root cause: The active.tsx component's useEffect cleanup and AppState handler
 * both fire `flushActiveWorkout()` on unmount. When the workout was completed
 * or discarded just before unmount, `sessionRef.current` still held the old
 * active session. The fire-and-forget flush queued a `saveActiveWorkout` AFTER
 * `clearActiveWorkout`, resurrecting the active draft — causing Home to show
 * "Resume Workout" for an already-completed workout.
 *
 * Fix: `workoutCompletedRef` is set to `true` before calling
 * `completeActiveWorkout` / `discardActiveWorkout`. Both `flushActiveWorkout`
 * and `scheduleDebouncedSave` bail out immediately when that flag is set.
 */

import React from 'react';
import { View, AppState, Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import ActiveWorkoutScreen from '../app/workout/active';

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

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children, style }: any) => React.createElement(View, { style }, children),
  };
});

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

jest.mock('../src/features/auth', () => {
  const actual = jest.requireActual('../src/features/auth');
  const mockState = {
    user: { id: 'test_user_stale_resume', email: 'athlete@bebig.app' },
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

// Silence sync-engine side effects that are irrelevant to this unit
jest.mock('../src/services/sync', () => ({
  getRecordKey: (entityType: string, id: string) => `${entityType}:${id}`,
  syncMetadataStore: {
    getState: jest.fn().mockResolvedValue({ records: {} }),
    markPendingUpload: jest.fn().mockResolvedValue(undefined),
    getRecord: jest.fn().mockResolvedValue(null),
    removeRecord: jest.fn().mockResolvedValue(undefined),
    markPendingDelete: jest.fn().mockResolvedValue(undefined),
  },
  syncLifecycleManager: {
    triggerSync: jest.fn().mockResolvedValue(undefined),
  },
}));


jest.mock('../src/features/workout/services/nativeRestTimerService', () => ({
  nativeRestTimerService: {
    syncRestTimer: jest.fn(),
    cancelRestTimer: jest.fn(),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal active workout session with one completed set. */
async function seedActiveWorkoutWithCompletedSet(name = 'Test Workout') {
  let session = await workoutRepository.startEmptyWorkout(name);
  session = workoutRepository.addExerciseToWorkout(session, {
    id: 'ex_bench',
    name: 'Bench Press',
  });
  session = workoutRepository.updateSet(
    session,
    'ex_bench',
    session.exercises[0].actualSets[0].id,
    { weight: 80, reps: 10, rir: 2, notes: 'Good reps', completed: true },
  );
  await workoutRepository.updateActiveWorkout(session);
  return session;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('BeBig 2.0 — Stale Resume Workout Bug Regression', () => {
  let appStateListener: ((state: string) => void) | null = null;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
    appStateListener = null;

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: string, callback: any) => {
      if (event === 'change') {
        appStateListener = callback;
      }
      return { remove: jest.fn() } as any;
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Complete → no active draft → Home has nothing to resume
  // ──────────────────────────────────────────────────────────────────────────
  it('TEST 1 — completing a workout clears the active draft and leaves no resume candidate', async () => {
    const session = await seedActiveWorkoutWithCompletedSet('Upper Body');

    // Verify draft exists before completion
    expect(await workoutRepository.getActiveWorkout()).not.toBeNull();

    // Complete the workout
    const completed = await workoutRepository.completeActiveWorkout(session);
    expect(completed.status).toBe('completed');

    // Active draft must be gone
    const activeDraft = await workoutRepository.getActiveWorkout();
    expect(activeDraft).toBeNull();

    // Home would call getActiveWorkout() — must return null
    const homeQuery = await workoutRepository.getActiveWorkout();
    expect(homeQuery).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: App restoration after successful completion — history intact,
  //         no active draft restored
  // ──────────────────────────────────────────────────────────────────────────
  it('TEST 2 — after completion, simulated app restart sees history but no active draft', async () => {
    const session = await seedActiveWorkoutWithCompletedSet('Leg Day');
    const completed = await workoutRepository.completeActiveWorkout(session);

    // Simulate "app restart" by querying storage fresh (clears any in-memory cache)
    workoutRepository.clearInMemoryState();

    const restoredActive = await workoutRepository.getActiveWorkout();
    expect(restoredActive).toBeNull();

    const history = await workoutRepository.getCompletedWorkouts();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].id).toBe(completed.id);
    expect(history[0].status).toBe('completed');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3A: Component unmount after Finish & Save does NOT resurrect active draft
  //
  // This directly tests the UI-layer race condition:
  // ActiveWorkoutScreen unmount triggers useEffect cleanup `flushActiveWorkout()`.
  // Without the `workoutCompletedRef` guard, that cleanup writes the stale session
  // back to storage, resurrecting the active draft after `completeActiveWorkout`.
  // With the guard, `flushActiveWorkout` exits immediately and active draft remains null.
  // ──────────────────────────────────────────────────────────────────────────
  it('TEST 3A — completing workout in ActiveWorkoutScreen does not resurrect active draft on unmount', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await seedActiveWorkoutWithCompletedSet('Push Day');

    const screen = await render(<ActiveWorkoutScreen />);

    // Wait for the active session to load and UI to render
    await screen.findByTestId('finish-workout-button');

    // Tap Finish Workout button
    await act(async () => {
      fireEvent.press(screen.getByTestId('finish-workout-button'));
    });

    // Alert prompt appears
    const finishAlertCall = alertSpy.mock.calls.find((call) => call[0] === 'Finish Workout');
    expect(finishAlertCall).toBeDefined();

    const finishButton = finishAlertCall?.[2]?.find((b: any) => b.text === 'Finish & Save');
    expect(finishButton).toBeDefined();

    // Confirm completion
    await act(async () => {
      await finishButton?.onPress?.();
    });

    // Unmount component (triggers useEffect cleanup calling flushActiveWorkout)
    await act(async () => {
      screen.unmount();
    });

    // Verify active draft is NOT resurrected
    const activeDraft = await workoutRepository.getActiveWorkout();
    expect(activeDraft).toBeNull();

    // Verify completed workout is preserved in history
    const history = await workoutRepository.getCompletedWorkouts();
    expect(history.length).toBe(1);
    expect(history[0].name).toBe('Push Day');
    expect(history[0].status).toBe('completed');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3B: Component unmount after Discard Workout does NOT resurrect active draft
  // ──────────────────────────────────────────────────────────────────────────
  it('TEST 3B — discarding workout in ActiveWorkoutScreen does not resurrect active draft on unmount', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await seedActiveWorkoutWithCompletedSet('Discard Day');

    const screen = await render(<ActiveWorkoutScreen />);

    await screen.findByTestId('discard-workout-button');

    // Tap Discard Workout button
    await act(async () => {
      fireEvent.press(screen.getByTestId('discard-workout-button'));
    });

    // Alert prompt appears
    const discardAlertCall = alertSpy.mock.calls.find((call) => call[0] === 'Discard Workout');
    expect(discardAlertCall).toBeDefined();

    const discardButton = discardAlertCall?.[2]?.find((b: any) => b.text === 'Discard Workout');
    expect(discardButton).toBeDefined();

    // Confirm discard
    await act(async () => {
      await discardButton?.onPress?.();
    });

    // Unmount component (triggers useEffect cleanup calling flushActiveWorkout)
    await act(async () => {
      screen.unmount();
    });

    // Verify active draft is NOT resurrected
    const activeDraft = await workoutRepository.getActiveWorkout();
    expect(activeDraft).toBeNull();

    // Discarded workout must not exist in completed history
    const history = await workoutRepository.getCompletedWorkouts();
    expect(history.length).toBe(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3C: AppState background transition after completion does NOT resurrect active draft
  // ──────────────────────────────────────────────────────────────────────────
  it('TEST 3C — AppState background event after completion does not resurrect active draft', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await seedActiveWorkoutWithCompletedSet('Backgrounding Test');

    const screen = await render(<ActiveWorkoutScreen />);
    await screen.findByTestId('finish-workout-button');

    await act(async () => {
      fireEvent.press(screen.getByTestId('finish-workout-button'));
    });

    const finishAlertCall = alertSpy.mock.calls.find((call) => call[0] === 'Finish Workout');
    const finishButton = finishAlertCall?.[2]?.find((b: any) => b.text === 'Finish & Save');

    await act(async () => {
      await finishButton?.onPress?.();
    });

    // Simulate OS backgrounding the app before screen is unmounted
    await act(async () => {
      if (appStateListener) {
        appStateListener('background');
      }
    });

    expect(await workoutRepository.getActiveWorkout()).toBeNull();

    screen.unmount();
    expect(await workoutRepository.getActiveWorkout()).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Unfinished workout survives unmount / reopen as resume candidate
  // ──────────────────────────────────────────────────────────────────────────
  it('TEST 4 — unfinished workout survives unmount and restart as resume candidate', async () => {
    const session = await workoutRepository.startEmptyWorkout('Unfinished Arms');
    const withEx = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_curl',
      name: 'Bicep Curl',
    });
    await workoutRepository.updateActiveWorkout(withEx);

    const screen = await render(<ActiveWorkoutScreen />);
    await screen.findByText('Unfinished Arms');

    // Normal exit / unmount without completion or discard
    screen.unmount();

    // Simulate reopen
    workoutRepository.clearInMemoryState();

    const restored = await workoutRepository.getActiveWorkout();
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe(session.id);
    expect(restored?.name).toBe('Unfinished Arms');
    expect(restored?.status).toBe('active');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Completing a workout does NOT create duplicate history entries
  // ──────────────────────────────────────────────────────────────────────────
  it('TEST 5 — completing the same active session twice does not duplicate history', async () => {
    const session = await seedActiveWorkoutWithCompletedSet('Dedup Test');

    const completed = await workoutRepository.completeActiveWorkout(session);
    expect(completed.status).toBe('completed');

    await workoutStorage.saveCompletedWorkout(completed);
    await workoutStorage.saveCompletedWorkout(completed);

    const history = await workoutRepository.getCompletedWorkouts();
    const matches = history.filter((w) => w.id === completed.id);
    expect(matches.length).toBe(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Set notes and completed set data survive the full lifecycle
  // ──────────────────────────────────────────────────────────────────────────
  it('TEST 6 — set notes and completion data survive: active → complete → history', async () => {
    let session = await workoutRepository.startEmptyWorkout('Notes Integrity');
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_press',
      name: 'Overhead Press',
    });
    session = workoutRepository.updateSet(
      session,
      'ex_press',
      session.exercises[0].actualSets[0].id,
      {
        weight: 60,
        reps: 8,
        rir: 1,
        notes: 'Felt strong, bar path clean',
        completed: true,
      },
    );
    await workoutRepository.updateActiveWorkout(session);

    const completed = await workoutRepository.completeActiveWorkout(session);

    const fromHistory = await workoutRepository.getCompletedWorkoutById(completed.id);
    expect(fromHistory).not.toBeNull();
    expect(fromHistory?.status).toBe('completed');

    const set = fromHistory?.exercises[0].actualSets[0];
    expect(set?.weight).toBe(60);
    expect(set?.reps).toBe(8);
    expect(set?.rir).toBe(1);
    expect(set?.notes).toBe('Felt strong, bar path clean');
    expect(set?.completed).toBe(true);

    expect(await workoutRepository.getActiveWorkout()).toBeNull();
  });
});

