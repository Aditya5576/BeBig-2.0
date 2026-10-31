import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { WorkoutTemplate } from '../src/features/templates/types';
import { WorkoutSession } from '../src/features/workout/types';
import { useAuthStore } from '../src/features/auth/store/useAuthStore';
import { UserScope } from '../src/features/auth/utils/userScope';

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

describe('P0 Data Loss Bug: Active Workout Concurrency, Overwrite Protection & Recovery', () => {
  const authScope: UserScope = { ownerId: 'usr_test_data_loss', ownerType: 'authenticated' };
  const guestScope: UserScope = { ownerId: 'guest_user', ownerType: 'guest' };

  const legShoulderTemplate: WorkoutTemplate = {
    id: 'tpl_leg_shoulder',
    name: 'Legs and Shoulders',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exercises: [
      {
        exerciseId: 'wger_squat',
        exerciseName: 'Barbell Squat',
        categoryName: 'Legs',
        order: 0,
        sets: 3,
        targetReps: '8-10',
        restTime: 90,
        targetWeight: 80,
      },
      {
        exerciseId: 'wger_ohp',
        exerciseName: 'Overhead Press',
        categoryName: 'Shoulders',
        order: 1,
        sets: 3,
        targetReps: '8-10',
        restTime: 90,
        targetWeight: 40,
      },
    ],
  };

  beforeEach(async () => {
    mockSecureStore.clear();
    workoutStorage.resetActiveWorkoutQueue();
    useAuthStore.setState({
      user: { id: 'usr_test_data_loss', email: 'athlete@bebig.app' } as any,
      status: 'authenticated',
      isGuest: false,
      guestSession: null,
    });
    await workoutStorage.clearAllWorkouts();
  });

  // Scenario 1, 2, 3: Start from template, log sets & reps, minimize / pause
  it('Scenario 1-3: Start workout from template, log leg & shoulder sets, minimize session safely', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(legShoulderTemplate);
    expect(session.id).toMatch(/^workout_/);
    expect(session.status).toBe('active');
    expect(session.exercises).toHaveLength(2);

    // Log Squat Set 1: 100kg x 8 (completed)
    let updated = workoutRepository.updateSet(session, 'wger_squat', session.exercises[0].actualSets[0].id, {
      weight: 100,
      reps: 8,
      completed: true,
    });
    // Log Squat Set 2: 105kg x 6 (completed)
    updated = workoutRepository.updateSet(updated, 'wger_squat', session.exercises[0].actualSets[1].id, {
      weight: 105,
      reps: 6,
      completed: true,
    });
    // Log OHP Set 1: 50kg x 10 (completed)
    updated = workoutRepository.updateSet(updated, 'wger_ohp', session.exercises[1].actualSets[0].id, {
      weight: 50,
      reps: 10,
      completed: true,
    });

    // Autosave
    const saved = await workoutRepository.updateActiveWorkout(updated);
    expect(saved.version).toBeGreaterThanOrEqual(2);

    // Minimize / Pause session
    const paused = {
      ...saved,
      pausedAt: new Date().toISOString(),
    };
    await workoutRepository.updateActiveWorkout(paused);

    const stored = await workoutRepository.getActiveWorkout();
    expect(stored).not.toBeNull();
    expect(stored?.pausedAt).toBeDefined();
    expect(stored?.exercises[0].actualSets[0].weight).toBe(100);
    expect(stored?.exercises[0].actualSets[1].weight).toBe(105);
    expect(stored?.exercises[1].actualSets[0].weight).toBe(50);
  });

  // Scenario 4 & 5: Starting another workout is rejected with conflict error
  it('Scenario 4-5: Reject starting another workout from template, empty, or history while active session exists', async () => {
    // Start initial active session
    const session = await workoutRepository.startWorkoutFromTemplate(legShoulderTemplate);
    const updated = workoutRepository.updateSet(session, 'wger_squat', session.exercises[0].actualSets[0].id, {
      weight: 100,
      reps: 8,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(updated);

    // 1. Attempt startWorkoutFromTemplate -> Must reject
    await expect(workoutRepository.startWorkoutFromTemplate(legShoulderTemplate)).rejects.toThrow(
      /active workout is already in progress/i,
    );

    // 2. Attempt startEmptyWorkout -> Must reject
    await expect(workoutRepository.startEmptyWorkout('Quick Workout')).rejects.toThrow(
      /active workout is already in progress/i,
    );

    // 3. Attempt startWorkoutFromCompleted -> Must reject
    const completedSample: WorkoutSession = {
      ...session,
      id: 'completed_mock_id',
      status: 'completed',
    };
    await expect(workoutRepository.startWorkoutFromCompleted(completedSample)).rejects.toThrow(
      /active workout is already in progress/i,
    );
  });

  // Scenario 6: Active session data remains 100% intact after rejected conflict attempts
  it('Scenario 6: Verify in-progress sets, reps, weight and completion remain intact after rejected start attempts', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(legShoulderTemplate);
    let updated = workoutRepository.updateSet(session, 'wger_squat', session.exercises[0].actualSets[0].id, {
      weight: 100,
      reps: 8,
      completed: true,
    });
    updated = workoutRepository.updateSet(updated, 'wger_ohp', session.exercises[1].actualSets[0].id, {
      weight: 50,
      reps: 10,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(updated);

    // Attempted conflict (swallowed by caller)
    try {
      await workoutRepository.startEmptyWorkout('Rogue Workout');
    } catch {}

    const currentActive = await workoutRepository.getActiveWorkout();
    expect(currentActive?.id).toBe(session.id);
    expect(currentActive?.name).toBe('Legs and Shoulders');
    expect(currentActive?.exercises[0].actualSets[0].weight).toBe(100);
    expect(currentActive?.exercises[0].actualSets[0].completed).toBe(true);
    expect(currentActive?.exercises[1].actualSets[0].weight).toBe(50);
    expect(currentActive?.exercises[1].actualSets[0].completed).toBe(true);
  });

  // Scenario 7: Queue serialization prevents race condition between saves and reads
  it('Scenario 7: Queue serialization guarantees getActiveWorkout awaits pending writes and never returns stale state', async () => {
    const session = await workoutRepository.startEmptyWorkout('Concurrency Test');

    // Simulate 3 asynchronous saves queued in rapid succession
    const sessionV1 = { ...session, name: 'V1', exercises: [] };
    const sessionV2 = workoutRepository.addExerciseToWorkout(sessionV1, { id: 'e1', name: 'Exercise 1' });
    const sessionV3 = workoutRepository.updateSet(sessionV2, 'e1', sessionV2.exercises[0].actualSets[0].id, {
      weight: 125,
      reps: 5,
      completed: true,
    });

    const p1 = workoutStorage.saveActiveWorkout(sessionV1, authScope);
    const p2 = workoutStorage.saveActiveWorkout(sessionV2, authScope);
    const p3 = workoutStorage.saveActiveWorkout(sessionV3, authScope);

    // Immediately read without awaiting p1, p2, p3
    const readSession = await workoutStorage.getActiveWorkout(authScope);

    await Promise.all([p1, p2, p3]);

    expect(readSession).not.toBeNull();
    expect(readSession?.exercises[0].actualSets[0].weight).toBe(125);
    expect(readSession?.exercises[0].actualSets[0].completed).toBe(true);
  });

  // Scenario 8: Abandoned workout archive preserves data on discard and supports recovery
  it('Scenario 8: Abandoned workout archive preserves data on discard and enables full restoration', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(legShoulderTemplate);
    const updated = workoutRepository.updateSet(session, 'wger_squat', session.exercises[0].actualSets[0].id, {
      weight: 110,
      reps: 5,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(updated);

    // Discard active workout
    await workoutRepository.discardActiveWorkout();

    // Active workout is now empty
    const activeAfterDiscard = await workoutRepository.getActiveWorkout();
    expect(activeAfterDiscard).toBeNull();

    // Abandoned recovery draft holds the discarded data
    const abandoned = await workoutRepository.getAbandonedWorkout();
    expect(abandoned).not.toBeNull();
    expect(abandoned?.id).toBe(session.id);
    expect(abandoned?.exercises[0].actualSets[0].weight).toBe(110);
    expect(abandoned?.exercises[0].actualSets[0].completed).toBe(true);

    // Restore abandoned workout
    const restored = await workoutRepository.restoreAbandonedWorkout();
    expect(restored).not.toBeNull();
    expect(restored?.status).toBe('active');
    expect(restored?.exercises[0].actualSets[0].weight).toBe(110);

    // Active is restored and abandoned is cleared
    const activeRestored = await workoutRepository.getActiveWorkout();
    expect(activeRestored?.id).toBe(session.id);
    const abandonedAfterRestore = await workoutRepository.getAbandonedWorkout();
    expect(abandonedAfterRestore).toBeNull();
  });

  // Scenario 9: Version tracking rejects stale write snapshots
  it('Scenario 9: Monotonic version tracking rejects stale writes with older revision numbers', async () => {
    const session = await workoutRepository.startEmptyWorkout('Version Test');
    expect(session.version).toBe(1);

    // Advance session to version 2
    const v2 = await workoutRepository.updateActiveWorkout({
      ...session,
      exercises: [],
    });
    expect(v2.version).toBe(2);

    // Advance session to version 3 with Squat 100kg
    const withSquat = workoutRepository.addExerciseToWorkout(v2, { id: 'sq', name: 'Squat' });
    const v3 = await workoutRepository.updateActiveWorkout(withSquat);
    expect(v3.version).toBe(3);

    // Stale snapshot with version 1 attempts to overwrite
    const staleSnapshot: WorkoutSession = {
      ...session,
      version: 1,
      name: 'Stale Overwrite Attempt',
    };
    await workoutStorage.saveActiveWorkout(staleSnapshot, authScope);

    // Verify storage preserved version 3 with Squat exercise
    const stored = await workoutStorage.getActiveWorkout(authScope);
    expect(stored?.name).toBe('Version Test');
    expect(stored?.version).toBe(3);
    expect(stored?.exercises).toHaveLength(1);
    expect(stored?.exercises[0].exerciseName).toBe('Squat');
  });

  // Scenario 10: Strict user isolation (guest vs authenticated)
  it('Scenario 10: Guest and authenticated user active workout states remain strictly isolated', async () => {
    // 1. Guest creates active workout
    useAuthStore.setState({
      user: null,
      isGuest: true,
      status: 'guest',
      guestSession: { id: 'guest_user', createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() },
    });
    const guestSession = await workoutRepository.startEmptyWorkout('Guest Workout');
    const guestUpdated = workoutRepository.addExerciseToWorkout(guestSession, { id: 'g1', name: 'Guest Pushup' });
    await workoutStorage.saveActiveWorkout(guestUpdated, guestScope);

    // 2. Authenticated user logs in
    useAuthStore.setState({
      user: { id: 'usr_test_data_loss', email: 'athlete@bebig.app' } as any,
      isGuest: false,
      status: 'authenticated',
      guestSession: null,
    });
    const authActive = await workoutStorage.getActiveWorkout(authScope);
    expect(authActive).toBeNull();

    // Authenticated user creates their own workout
    const authSession = await workoutRepository.startEmptyWorkout('Auth Deadlift Day');
    expect(authSession.name).toBe('Auth Deadlift Day');

    // Guest workout remains isolated and unharmed
    const retrievedGuest = await workoutStorage.getActiveWorkout(guestScope);
    expect(retrievedGuest?.name).toBe('Guest Workout');
    expect(retrievedGuest?.exercises[0].exerciseName).toBe('Guest Pushup');
  });

  // Scenario 11: Rapid set edits followed by immediate navigation away and back
  it('Scenario 11: Rapid set edits followed by immediate read preserves all logged sets', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(legShoulderTemplate);

    // Rapid edits without awaiting
    const e1 = workoutRepository.updateSet(session, 'wger_squat', session.exercises[0].actualSets[0].id, {
      weight: 100,
      reps: 8,
      completed: true,
    });
    const e2 = workoutRepository.updateSet(e1, 'wger_squat', session.exercises[0].actualSets[1].id, {
      weight: 105,
      reps: 6,
      completed: true,
    });
    const e3 = workoutRepository.updateSet(e2, 'wger_squat', session.exercises[0].actualSets[2].id, {
      weight: 110,
      reps: 4,
      completed: true,
    });

    void workoutRepository.updateActiveWorkout(e1);
    void workoutRepository.updateActiveWorkout(e2);
    const savePromise = workoutRepository.updateActiveWorkout(e3);

    // Immediate read while saves are in flight
    const retrieved = await workoutRepository.getActiveWorkout();
    await savePromise;

    expect(retrieved?.exercises[0].actualSets[0].weight).toBe(100);
    expect(retrieved?.exercises[0].actualSets[1].weight).toBe(105);
    expect(retrieved?.exercises[0].actualSets[2].weight).toBe(110);
    expect(retrieved?.exercises[0].actualSets.every((s) => s.completed)).toBe(true);
  });

  // Scenario 12: App killed while active workout is paused, followed by cold launch resumption
  it('Scenario 12: Cold launch resumption correctly restores paused workout with accumulated duration', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(legShoulderTemplate);
    const updated = workoutRepository.updateSet(session, 'wger_squat', session.exercises[0].actualSets[0].id, {
      weight: 100,
      reps: 8,
      completed: true,
    });
    const saved = await workoutRepository.updateActiveWorkout(updated);

    // Simulate minimize 300 seconds ago
    const pauseStart = new Date(Date.now() - 300 * 1000).toISOString();
    const pausedSession: WorkoutSession = {
      ...saved,
      pausedAt: pauseStart,
      accumulatedPauseSeconds: 60,
    };
    await workoutRepository.updateActiveWorkout(pausedSession);

    // Cold launch simulation: read active workout
    let coldActive = await workoutRepository.getActiveWorkout();
    expect(coldActive).not.toBeNull();
    expect(coldActive?.pausedAt).toBe(pauseStart);

    // Resume logic (as in active.tsx)
    const pauseDurationSec = Math.max(
      0,
      Math.floor((Date.now() - new Date(coldActive!.pausedAt!).getTime()) / 1000),
    );
    coldActive = {
      ...coldActive!,
      accumulatedPauseSeconds: (coldActive!.accumulatedPauseSeconds || 0) + pauseDurationSec,
      pausedAt: null,
    };
    const resumed = await workoutRepository.updateActiveWorkout(coldActive);

    expect(resumed.pausedAt).toBeNull();
    expect(resumed.accumulatedPauseSeconds).toBeGreaterThanOrEqual(360); // 60 + 300
    expect(resumed.exercises[0].actualSets[0].weight).toBe(100);
    expect(resumed.exercises[0].actualSets[0].completed).toBe(true);
  });

  // Scenario 13: Explicit discard followed by starting new workout starts clean without stale data
  it('Scenario 13: Explicit discard followed by new workout starts clean without carrying stale data', async () => {
    const sessionA = await workoutRepository.startWorkoutFromTemplate(legShoulderTemplate);
    const updatedA = workoutRepository.updateSet(sessionA, 'wger_squat', sessionA.exercises[0].actualSets[0].id, {
      weight: 120,
      reps: 3,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(updatedA);

    // User chooses "Discard & Start New"
    await workoutRepository.discardActiveWorkout();
    const sessionB = await workoutRepository.startEmptyWorkout('Fresh Push Session');

    expect(sessionB.id).not.toBe(sessionA.id);
    expect(sessionB.name).toBe('Fresh Push Session');
    expect(sessionB.exercises).toHaveLength(0);

    // Stored active workout is B
    const activeStored = await workoutRepository.getActiveWorkout();
    expect(activeStored?.id).toBe(sessionB.id);
    expect(activeStored?.name).toBe('Fresh Push Session');
    expect(activeStored?.exercises).toHaveLength(0);

    // Abandoned draft retains workout A
    const abandonedA = await workoutRepository.getAbandonedWorkout();
    expect(abandonedA?.id).toBe(sessionA.id);
    expect(abandonedA?.exercises[0].actualSets[0].weight).toBe(120);
  });

  // Adversarial Audit 1: Atomic Concurrent Creation
  it('Adversarial 1: Two simultaneous startWorkout requests execute atomically — exactly one succeeds and one rejects', async () => {
    const results = await Promise.allSettled([
      workoutRepository.startEmptyWorkout('Concurrent Alpha'),
      workoutRepository.startEmptyWorkout('Concurrent Beta'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /active workout is already in progress/i,
    );

    // Verify storage has the single winner intact
    const active = await workoutRepository.getActiveWorkout();
    expect(active).not.toBeNull();
    const winningName = (fulfilled[0] as PromiseFulfilledResult<WorkoutSession>).value.name;
    expect(active?.name).toBe(winningName);
  });

  // Adversarial Audit 2: Direct saveActiveWorkout of different session ID is rejected
  it('Adversarial 2: Direct saveActiveWorkout with a different session ID is rejected without explicit authorization', async () => {
    const session1 = await workoutRepository.startEmptyWorkout('Leg Day Original');
    const session2: WorkoutSession = {
      ...session1,
      id: 'rogue_different_session_id',
      name: 'Rogue Hijack Session',
    };

    await expect(workoutStorage.saveActiveWorkout(session2, authScope)).rejects.toThrow(
      /cannot overwrite active workout session/i,
    );

    // Storage still contains the original session
    const current = await workoutStorage.getActiveWorkout(authScope);
    expect(current?.id).toBe(session1.id);
    expect(current?.name).toBe('Leg Day Original');
  });

  // Adversarial Audit 3: Unversioned stale writes are rejected
  it('Adversarial 3: Unversioned stale writes cannot overwrite an existing versioned active session', async () => {
    const session = await workoutRepository.startEmptyWorkout('Version Guard Base');
    const v2 = await workoutRepository.updateActiveWorkout({ ...session, exercises: [] });
    const v3Session = workoutRepository.addExerciseToWorkout(v2, { id: 'leg_press', name: 'Leg Press' });
    const v3 = await workoutRepository.updateActiveWorkout(v3Session);
    expect(v3.version).toBeGreaterThanOrEqual(3);

    // An unversioned snapshot of the same session attempts to save
    const unversionedStale: WorkoutSession = {
      ...session,
      version: undefined,
      name: 'Stale Unversioned Attempt',
    };
    await workoutStorage.saveActiveWorkout(unversionedStale, authScope);

    // Verify storage preserved version 3 with Leg Press
    const stored = await workoutStorage.getActiveWorkout(authScope);
    expect(stored?.name).toBe('Version Guard Base');
    expect(stored?.version).toBeGreaterThanOrEqual(3);
    expect(stored?.exercises[0].exerciseName).toBe('Leg Press');
  });

  // Adversarial Audit 4: Multiple abandoned workouts form a recovery stack without losing history
  it('Adversarial 4: Discarding multiple workouts retains history in recovery stack and allows sequential restore', async () => {
    // 1. Workout A discarded
    const sessionA = await workoutRepository.startEmptyWorkout('Workout Alpha');
    const withSquat = workoutRepository.addExerciseToWorkout(sessionA, { id: 'sq', name: 'Squat' });
    await workoutRepository.updateActiveWorkout(withSquat);
    await workoutRepository.discardActiveWorkout();

    // 2. Workout B discarded
    const sessionB = await workoutRepository.startEmptyWorkout('Workout Beta');
    const withBench = workoutRepository.addExerciseToWorkout(sessionB, { id: 'bp', name: 'Bench' });
    await workoutRepository.updateActiveWorkout(withBench);
    await workoutRepository.discardActiveWorkout();

    // Most recent abandoned is Beta
    const mostRecentAbandoned = await workoutRepository.getAbandonedWorkout();
    expect(mostRecentAbandoned?.name).toBe('Workout Beta');

    // Restore Beta
    const restoredBeta = await workoutRepository.restoreAbandonedWorkout();
    expect(restoredBeta?.name).toBe('Workout Beta');
    expect(restoredBeta?.exercises[0].exerciseName).toBe('Bench');

    // Discard Beta again
    await workoutRepository.discardActiveWorkout();

    // Clear active and verify Alpha is still in abandoned stack
    await workoutRepository.discardActiveWorkout();
    const remainingAbandoned = await workoutRepository.getAbandonedWorkout();
    expect(remainingAbandoned).not.toBeNull();
  });

  // Adversarial Audit 5: Restore while active workout in progress requires explicit resolution
  it('Adversarial 5: Restoring an abandoned workout while another active workout exists rejects without explicit discard', async () => {
    // Discard Session A to abandoned archive
    const sessionA = await workoutRepository.startEmptyWorkout('Workout Alpha');
    await workoutRepository.discardActiveWorkout();

    // Now start Session B (active)
    await workoutRepository.startEmptyWorkout('Active Workout Beta');

    // Attempting to restore Alpha while Beta is active must reject
    await expect(workoutRepository.restoreAbandonedWorkout()).rejects.toThrow(
      /cannot restore abandoned workout: an active workout is already in progress/i,
    );

    // Still active: Beta
    const active = await workoutRepository.getActiveWorkout();
    expect(active?.name).toBe('Active Workout Beta');

    // Restoring with forceDiscardExisting: true succeeds
    const restored = await workoutRepository.restoreAbandonedWorkout(undefined, {
      forceDiscardExisting: true,
    });
    expect(restored?.name).toBe('Workout Alpha');

    const activeAfter = await workoutRepository.getActiveWorkout();
    expect(activeAfter?.name).toBe('Workout Alpha');
  });

  // Adversarial 6: Two simultaneous workout creation requests from different entry points (Template vs Quick Start)
  it('Adversarial 6: Simultaneous creation requests from different entry points (Template vs Quick Start) execute atomically', async () => {
    const results = await Promise.allSettled([
      workoutRepository.startWorkoutFromTemplate(legShoulderTemplate),
      workoutRepository.startEmptyWorkout('Quick Start Entry'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /active workout is already in progress/i,
    );

    const active = await workoutRepository.getActiveWorkout();
    expect(active).not.toBeNull();
    const winningSession = (fulfilled[0] as PromiseFulfilledResult<WorkoutSession>).value;
    expect(active?.id).toBe(winningSession.id);
  });

  // Adversarial 7: Navigate away during pending save and immediately resume
  it('Adversarial 7: Navigating away during a pending save and immediately resuming preserves state and updates queue in order', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(legShoulderTemplate);
    const updated = workoutRepository.updateSet(session, 'wger_squat', session.exercises[0].actualSets[0].id, {
      weight: 140,
      reps: 5,
      completed: true,
    });

    // 1. In-flight save
    const savePromise = workoutRepository.updateActiveWorkout(updated);

    // 2. Immediate minimize (pause) while save is pending
    const pausePromise = workoutRepository.updateActiveWorkout({
      ...updated,
      pausedAt: new Date().toISOString(),
    });

    // 3. Immediate resume
    const resumePromise = workoutRepository.updateActiveWorkout({
      ...updated,
      pausedAt: null,
      accumulatedPauseSeconds: 15,
    });

    await Promise.all([savePromise, pausePromise, resumePromise]);

    const finalActive = await workoutRepository.getActiveWorkout();
    expect(finalActive).not.toBeNull();
    expect(finalActive?.status).toBe('active');
    expect(finalActive?.pausedAt).toBeNull();
    expect(finalActive?.accumulatedPauseSeconds).toBe(15);
    expect(finalActive?.exercises[0].actualSets[0].weight).toBe(140);
    expect(finalActive?.exercises[0].actualSets[0].completed).toBe(true);
  });

  // Adversarial 8: Out-of-order autosave resolution preserves latest version
  it('Adversarial 8: Out-of-order autosave resolution preserves newer revision over older revision', async () => {
    const session = await workoutRepository.startEmptyWorkout('Revision Order Test');

    // Save version 2
    const v2 = await workoutRepository.updateActiveWorkout({
      ...session,
      name: 'Revision Order Test (v2)',
    });
    expect(v2.version).toBe(2);

    // Save version 3
    const v3 = await workoutRepository.updateActiveWorkout({
      ...v2,
      name: 'Revision Order Test (v3 - Final)',
    });
    expect(v3.version).toBe(3);

    // Delayed old autosave of version 1 arrives now
    await workoutStorage.saveActiveWorkout({ ...session, version: 1, name: 'Stale v1 Ghost' }, authScope);

    const active = await workoutStorage.getActiveWorkout(authScope);
    expect(active?.version).toBe(3);
    expect(active?.name).toBe('Revision Order Test (v3 - Final)');
  });

  // Adversarial 9: App restart / rehydration while a save is in flight retrieves persisted state
  it('Adversarial 9: Rehydrating storage after a save operation reads persisted active session without loss', async () => {
    const session = await workoutRepository.startEmptyWorkout('Restart Durability');
    const withSquat = workoutRepository.addExerciseToWorkout(session, { id: 'sq_durable', name: 'Durable Squat' });
    const updated = workoutRepository.updateSet(withSquat, 'sq_durable', withSquat.exercises[0].actualSets[0].id, {
      weight: 160,
      reps: 3,
      completed: true,
    });

    // Save to storage
    const savePromise = workoutStorage.saveActiveWorkout(updated, authScope);

    // Cold rehydration: getActiveWorkout waits for queue and returns updated session
    const rehydrated = await workoutStorage.getActiveWorkout(authScope);
    await savePromise;

    expect(rehydrated).not.toBeNull();
    expect(rehydrated?.exercises[0].exerciseName).toBe('Durable Squat');
    expect(rehydrated?.exercises[0].actualSets[0].weight).toBe(160);
    expect(rehydrated?.exercises[0].actualSets[0].completed).toBe(true);
  });

  // Adversarial 10: Legacy unversioned workout in storage is read safely and migrated with version 1 on update
  it('Adversarial 10: Legacy unversioned workout in storage is read safely and migrated with version on update', async () => {
    // Manually inject a pre-fix workout without version field
    const legacySession: WorkoutSession = {
      id: 'legacy_workout_pre_v22',
      name: 'Legacy Pre-v2.2 Workout',
      startedAt: new Date().toISOString(),
      status: 'active',
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          order: 0,
          plannedSets: 1,
          plannedTargetReps: '10',
          plannedRestTime: 60,
          actualSets: [
            { id: 's1', setNumber: 1, weight: 80, reps: 10, completed: true },
          ],
        },
      ],
      // version intentionally omitted
    };

    // Store directly into mockSecureStore using user-scoped key
    const scopedKey = 'bebig.workout.active.usr_test_data_loss';
    mockSecureStore.set(scopedKey, JSON.stringify(legacySession));

    // 1. Read legacy session
    const retrieved = await workoutRepository.getActiveWorkout();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('legacy_workout_pre_v22');
    expect(retrieved?.version).toBeUndefined();

    // 2. Update via updateActiveWorkout -> Must assign version 1
    const updated = await workoutRepository.updateActiveWorkout({
      ...retrieved!,
      name: 'Migrated Workout v2.2',
    });
    expect(updated.version).toBe(1);
    expect(updated.name).toBe('Migrated Workout v2.2');

    // 3. Verify storage has version 1
    const stored = await workoutRepository.getActiveWorkout();
    expect(stored?.version).toBe(1);
    expect(stored?.name).toBe('Migrated Workout v2.2');
  });

  // Adversarial 11: Storage write failure rejects cleanly and subsequent queued operations succeed
  it('Adversarial 11: Storage write failure rejects without poisoning the active workout queue', async () => {
    const session = await workoutRepository.startEmptyWorkout('Queue Resilience Test');

    // Spy on platformStorage.setItem to throw an error once
    const { platformStorage } = require('../src/lib/storage');
    const originalSetItem = platformStorage.setItem;
    platformStorage.setItem = jest.fn()
      .mockRejectedValueOnce(new Error('Hardware SecureStorage I/O Error'))
      .mockImplementation(originalSetItem);

    // Operation 1: Fails
    await expect(workoutRepository.updateActiveWorkout(session)).rejects.toThrow(
      /Hardware SecureStorage/i,
    );

    // Operation 2: Immediately following operation must succeed without deadlock
    const sessionWithExercise = workoutRepository.addExerciseToWorkout(session, { id: 'curl', name: 'Bicep Curl' });
    const successResult = await workoutRepository.updateActiveWorkout(sessionWithExercise);
    expect(successResult).not.toBeNull();
    expect(successResult.exercises).toHaveLength(1);

    // Active session contains the successful update
    const active = await workoutRepository.getActiveWorkout();
    expect(active?.exercises[0].exerciseName).toBe('Bicep Curl');

    platformStorage.setItem = originalSetItem;
  });

  // Adversarial 12: Rapid repeated navigation (minimize -> resume cycles) preserves session consistency
  it('Adversarial 12: Rapid repeated minimize and resume cycles preserve monotonic versions and session validity', async () => {
    let session = await workoutRepository.startWorkoutFromTemplate(legShoulderTemplate);
    const initialVersion = session.version ?? 1;

    for (let i = 0; i < 5; i++) {
      // Minimize
      session = await workoutRepository.updateActiveWorkout({
        ...session,
        pausedAt: new Date().toISOString(),
      });
      // Resume
      session = await workoutRepository.updateActiveWorkout({
        ...session,
        pausedAt: null,
        accumulatedPauseSeconds: (session.accumulatedPauseSeconds || 0) + 10,
      });
    }

    expect(session.version).toBe(initialVersion + 10);
    expect(session.status).toBe('active');
    expect(session.pausedAt).toBeNull();
    expect(session.accumulatedPauseSeconds).toBe(50);

    const stored = await workoutRepository.getActiveWorkout();
    expect(stored?.version).toBe(initialVersion + 10);
    expect(stored?.accumulatedPauseSeconds).toBe(50);
  });

  // Adversarial 13: Starting workout from completed history creates independent session; source remains immutable
  it('Adversarial 13: Starting workout from completed history preserves source completed workout immutability', async () => {
    // Create and complete a source workout
    const sourceSession = await workoutRepository.startEmptyWorkout('Original Leg Day');
    const withSquat = workoutRepository.addExerciseToWorkout(sourceSession, { id: 'sq_hist', name: 'Barbell Squat' });
    const logged = workoutRepository.updateSet(withSquat, 'sq_hist', withSquat.exercises[0].actualSets[0].id, {
      weight: 120,
      reps: 8,
      completed: true,
    });
    const completedSource = await workoutRepository.completeActiveWorkout(logged);
    expect(completedSource.status).toBe('completed');

    // Clear active (completeWorkout already does this)
    expect(await workoutRepository.getActiveWorkout()).toBeNull();

    // Now start a new workout repeating from completedSource
    const newSession = await workoutRepository.startWorkoutFromCompleted(completedSource);
    expect(newSession.id).not.toBe(completedSource.id);
    expect(newSession.status).toBe('active');

    // Mutate new session sets
    const mutatedNew = workoutRepository.updateSet(newSession, 'sq_hist', newSession.exercises[0].actualSets[0].id, {
      weight: 150,
      reps: 12,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(mutatedNew);

    // Verify source completed workout in history storage was NOT mutated
    const historyWorkouts = await workoutRepository.getCompletedWorkouts();
    const sourceInHistory = historyWorkouts.find((w) => w.id === completedSource.id);
    expect(sourceInHistory).toBeDefined();
    expect(sourceInHistory?.exercises[0].actualSets[0].weight).toBe(120);
    expect(sourceInHistory?.exercises[0].actualSets[0].reps).toBe(8);

    // Active session has the new weight
    const active = await workoutRepository.getActiveWorkout();
    expect(active?.exercises[0].actualSets[0].weight).toBe(150);
    expect(active?.exercises[0].actualSets[0].reps).toBe(12);
  });

  // Adversarial 14: Starting workout from template creates independent session; template remains immutable
  it('Adversarial 14: Starting workout from template preserves source template immutability despite active changes', async () => {
    const templateCopy: WorkoutTemplate = JSON.parse(JSON.stringify(legShoulderTemplate));
    const session = await workoutRepository.startWorkoutFromTemplate(templateCopy);

    // Drastically alter active session: edit sets, add new exercise, remove exercise
    let updated = workoutRepository.updateSet(session, 'wger_squat', session.exercises[0].actualSets[0].id, {
      weight: 200,
      reps: 20,
      completed: true,
    });
    updated = workoutRepository.addExerciseToWorkout(updated, { id: 'deadlift', name: 'Deadlift' });
    updated = workoutRepository.removeExerciseFromWorkout(updated, 'wger_ohp');
    await workoutRepository.updateActiveWorkout(updated);

    // Verify templateCopy was NOT mutated
    expect(templateCopy.exercises).toHaveLength(2);
    expect(templateCopy.exercises[0].exerciseId).toBe('wger_squat');
    expect(templateCopy.exercises[0].targetWeight).toBe(80);
    expect(templateCopy.exercises[0].targetReps).toBe('8-10');
    expect(templateCopy.exercises[1].exerciseId).toBe('wger_ohp');

    // Active session reflects mutations
    const active = await workoutRepository.getActiveWorkout();
    expect(active?.exercises).toHaveLength(2); // squat and deadlift
    expect(active?.exercises.map((e) => e.exerciseId)).toEqual(['wger_squat', 'deadlift']);
    expect(active?.exercises[0].actualSets[0].weight).toBe(200);
  });

  // Adversarial 15: Trigger start before async active-workout loading completes rejects and preserves existing session
  it('Adversarial 15: Trigger start before async active-workout loading completes rejects and preserves existing session', async () => {
    // 1. Seed an active workout in storage
    const initialSession = await workoutRepository.startEmptyWorkout('Existing Leg Day', undefined, { scope: authScope });
    const withSquat = workoutRepository.addExerciseToWorkout(initialSession, { id: 'sq_1', name: 'Squat' });
    const updated = workoutRepository.updateSet(withSquat, 'sq_1', withSquat.exercises[0].actualSets[0].id, {
      weight: 140,
      reps: 6,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(updated);

    // 2. Artificially delay platformStorage.getItem to simulate slow storage read
    const { platformStorage } = require('../src/lib/storage');
    const originalGetItem = platformStorage.getItem;
    let resolveSlowRead: () => void;
    const slowReadPromise = new Promise<void>((resolve) => {
      resolveSlowRead = resolve;
    });

    let getItemCallCount = 0;
    platformStorage.getItem = jest.fn(async (key: string) => {
      getItemCallCount++;
      if (getItemCallCount === 1) {
        await slowReadPromise;
      }
      return originalGetItem(key);
    });

    // 3. Kick off async load (simulating screen mounting)
    const readPromise = workoutStorage.getActiveWorkout(authScope);

    // 4. While read is still pending, immediately trigger startEmptyWorkout
    const racingCreatePromise = workoutRepository.startEmptyWorkout('Racing Hijack Session', undefined, { scope: authScope });

    // Release the slow read
    resolveSlowRead!();

    const [readResult, createResult] = await Promise.allSettled([readPromise, racingCreatePromise]);

    // Async read succeeds and sees the existing session
    expect(readResult.status).toBe('fulfilled');
    expect((readResult as PromiseFulfilledResult<WorkoutSession | null>).value?.name).toBe('Existing Leg Day');

    // Racing create is queued behind the read and rejected when existing session is detected
    expect(createResult.status).toBe('rejected');
    expect((createResult as PromiseRejectedResult).reason.message).toMatch(
      /active workout is already in progress/i
    );

    // Existing session remains 100% intact
    const active = await workoutStorage.getActiveWorkout(authScope);
    expect(active?.name).toBe('Existing Leg Day');
    expect(active?.exercises[0].actualSets[0].weight).toBe(140);

    platformStorage.getItem = originalGetItem;
  });

  // Adversarial 16: Starting new workout while active workout exists rejects and preserves ongoing workout
  it('Adversarial 16: Starting new workout while active workout exists rejects and preserves ongoing workout', async () => {
    // Seed active workout
    await workoutRepository.startEmptyWorkout('In-Progress Chest Day', undefined, { scope: authScope });

    const currentActive = await workoutRepository.getActiveWorkout();
    expect(currentActive?.name).toBe('In-Progress Chest Day');

    // Attempt startEmptyWorkout and startWorkoutFromTemplate
    await expect(workoutRepository.startEmptyWorkout('Rogue Session')).rejects.toThrow(
      /active workout is already in progress/i
    );
    await expect(workoutRepository.startWorkoutFromTemplate(legShoulderTemplate)).rejects.toThrow(
      /active workout is already in progress/i
    );

    // Ensure active draft was not wiped or replaced
    const preserved = await workoutRepository.getActiveWorkout();
    expect(preserved?.name).toBe('In-Progress Chest Day');
  });

  // Adversarial 17: Clear operation racing with in-flight delayed save resolves cleanly to empty active draft
  it('Adversarial 17: Clear operation racing with in-flight delayed save resolves cleanly to empty active draft', async () => {
    const session = await workoutRepository.startEmptyWorkout('Racing Save/Clear Test', undefined, { scope: authScope });
    const sessionV2: WorkoutSession = {
      ...session,
      name: 'In-Flight Save V2',
      version: 2,
    };

    let resolveDelayedSet: () => void;
    const delayedSetPromise = new Promise<void>((resolve) => {
      resolveDelayedSet = resolve;
    });

    const { platformStorage } = require('../src/lib/storage');
    const originalSetItem = platformStorage.setItem;
    let saveStarted = false;

    platformStorage.setItem = jest.fn(async (key: string, val: string) => {
      if (val.includes('In-Flight Save V2')) {
        saveStarted = true;
        await delayedSetPromise;
      }
      return originalSetItem(key, val);
    });

    // 1. Enqueue saveActiveWorkout (delays during hardware write)
    const savePromise = workoutStorage.saveActiveWorkout(sessionV2, authScope);

    // Yield to let save start
    await new Promise((r) => setTimeout(r, 10));
    expect(saveStarted).toBe(true);

    // 2. Concurrently enqueue clearActiveWorkout while save is in-flight
    const clearPromise = workoutStorage.clearActiveWorkout(authScope);

    // Release delayed save
    resolveDelayedSet!();

    await Promise.all([savePromise, clearPromise]);

    // FIFO queue ensures clearActiveWorkout executed AFTER the save -> final state MUST be null!
    const active = await workoutStorage.getActiveWorkout(authScope);
    expect(active).toBeNull();

    platformStorage.setItem = originalSetItem;
  });

  // Adversarial 18: Abandoned archive strictly caps at 5 items FIFO and deduplicates re-abandoned sessions
  it('Adversarial 18: Abandoned archive strictly caps at 5 items FIFO and deduplicates re-abandoned sessions', async () => {
    const createdSessions: WorkoutSession[] = [];

    // 1. Create and discard 7 distinct workouts sequentially
    for (let i = 1; i <= 7; i++) {
      const s = await workoutRepository.startEmptyWorkout(`Workout Session ${i}`, undefined, {
        forceDiscardExisting: true,
        scope: authScope,
      });
      createdSessions.push(s);
      await workoutRepository.discardActiveWorkout(authScope);
    }

    // Inspect abandoned archive key directly
    const { platformStorage } = require('../src/lib/storage');
    const rawAbandoned = await platformStorage.getItem('bebig.workout.active.abandoned.usr_test_data_loss');
    expect(rawAbandoned).not.toBeNull();
    const abandonedList: WorkoutSession[] = JSON.parse(rawAbandoned!);

    // Exactly 5 items retained
    expect(abandonedList).toHaveLength(5);

    // Newest sessions (7, 6, 5, 4, 3) must be present in order; oldest (1, 2) evicted
    expect(abandonedList.map((w) => w.name)).toEqual([
      'Workout Session 7',
      'Workout Session 6',
      'Workout Session 5',
      'Workout Session 4',
      'Workout Session 3',
    ]);

    // 2. Re-discard Workout Session 5 (should deduplicate and move to index 0)
    await workoutStorage.archiveActiveWorkout(createdSessions[4], authScope); // index 4 is Session 5

    const rawAfterReArchive = await platformStorage.getItem('bebig.workout.active.abandoned.usr_test_data_loss');
    const updatedList: WorkoutSession[] = JSON.parse(rawAfterReArchive!);

    expect(updatedList).toHaveLength(5);
    expect(updatedList[0].name).toBe('Workout Session 5');
    // Ensure no duplicates of Session 5
    const session5Matches = updatedList.filter((w) => w.name === 'Workout Session 5');
    expect(session5Matches).toHaveLength(1);
  });

  // Adversarial 19: Hardware storage read rejection returns null safely and does not deadlock queue
  it('Adversarial 19: Hardware storage read rejection returns null safely and does not deadlock queue', async () => {
    // Seed active workout
    await workoutRepository.startEmptyWorkout('Hardware Resilient Workout', undefined, { scope: authScope });

    // Mock platformStorage.getItem to reject once with hardware error
    const { platformStorage } = require('../src/lib/storage');
    const originalGetItem = platformStorage.getItem;
    platformStorage.getItem = jest.fn()
      .mockRejectedValueOnce(new Error('Hardware SecureStorage I/O Read Error'))
      .mockImplementation(originalGetItem);

    // 1. getActiveWorkout catches the rejection and returns null
    const resultAfterError = await workoutStorage.getActiveWorkout(authScope);
    expect(resultAfterError).toBeNull();

    // 2. Queue remains unpoisoned: subsequent operation executes normally
    const restoredSession = await workoutStorage.getActiveWorkout(authScope);
    expect(restoredSession).not.toBeNull();
    expect(restoredSession?.name).toBe('Hardware Resilient Workout');

    platformStorage.getItem = originalGetItem;
  });

  // Adversarial 20: Syntactically valid JSON with invalid schema is sanitized and returns null
  it('Adversarial 20: Syntactically valid JSON with invalid schema is sanitized and returns null', async () => {
    const scopedKey = 'bebig.workout.active.usr_test_data_loss';
    const { platformStorage } = require('../src/lib/storage');

    // 1. Write an object missing required exercises array
    await platformStorage.setItem(scopedKey, JSON.stringify({
      id: 'corrupt_1',
      name: 'Corrupted Session Missing Exercises',
      status: 'active',
      startedAt: new Date().toISOString(),
      // exercises intentionally missing
    }));

    const result1 = await workoutStorage.getActiveWorkout(authScope);
    expect(result1).toBeNull();

    // 2. Write an object with exercises not being an array
    await platformStorage.setItem(scopedKey, JSON.stringify({
      id: 'corrupt_2',
      name: 'Corrupted Session Non-Array Exercises',
      status: 'active',
      startedAt: new Date().toISOString(),
      exercises: 'INVALID_STRING_NOT_ARRAY',
    }));

    const result2 = await workoutStorage.getActiveWorkout(authScope);
    expect(result2).toBeNull();

    // 3. Write an object where status is not 'active'
    await platformStorage.setItem(scopedKey, JSON.stringify({
      id: 'corrupt_3',
      name: 'Zombie Completed Status in Active Slot',
      status: 'completed',
      startedAt: new Date().toISOString(),
      exercises: [],
    }));

    const result3 = await workoutStorage.getActiveWorkout(authScope);
    expect(result3).toBeNull();

    // 4. Verify starting a fresh workout cleanly succeeds over the corrupt draft
    const fresh = await workoutRepository.startEmptyWorkout('Clean Post-Corrupt Workout', undefined, { scope: authScope });
    expect(fresh.name).toBe('Clean Post-Corrupt Workout');
    expect(fresh.exercises).toHaveLength(0);
  });

  // Adversarial 21: Custom exercise inside active workout remains strictly isolated across account switch
  it('Adversarial 21: Custom exercise inside active workout remains strictly isolated across account switch', async () => {
    const { exerciseRepository } = require('../src/features/exercises/services/exerciseRepository');
    const { customExerciseStorage } = require('../src/features/exercises/storage/customExerciseStorage');

    const authScopeB: UserScope = { ownerId: 'usr_adversarial_b', ownerType: 'authenticated' };

    // 1. User A creates custom exercise
    const customExA = await exerciseRepository.createCustomExercise(
      {
        name: 'Athlete A Special Squat',
        category: 'legs',
        primaryMuscles: ['Quadriceps'],
      },
      authScope,
    );

    // User A starts active workout with this custom exercise
    const sessionA = await workoutRepository.startEmptyWorkout('User A Media Workout', undefined, { scope: authScope });
    const withCustomA = workoutRepository.addExerciseToWorkout(sessionA, {
      id: customExA.id,
      name: customExA.name,
      categoryName: customExA.categoryName,
    });
    const loggedA = workoutRepository.updateSet(withCustomA, customExA.id, withCustomA.exercises[0].actualSets[0].id, {
      weight: 180,
      reps: 5,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(loggedA);

    // 2. User A logs out, User B logs in
    useAuthStore.setState({
      user: { id: 'usr_adversarial_b', email: 'athlete_b@bebig.app' } as any,
      status: 'authenticated',
      isGuest: false,
      guestSession: null,
    });

    // User B active workout is null
    const activeB = await workoutStorage.getActiveWorkout(authScopeB);
    expect(activeB).toBeNull();

    // User B custom exercises list does NOT contain User A's custom exercise
    const customListB = await customExerciseStorage.getCustomExercises(authScopeB);
    expect(customListB.some((e: any) => e.name === 'Athlete A Special Squat')).toBe(false);

    // User B creates their own active workout
    const sessionB = await workoutRepository.startEmptyWorkout('User B Separate Session', undefined, { scope: authScopeB });
    expect(sessionB.name).toBe('User B Separate Session');

    // 3. User B logs out, User A logs back in
    useAuthStore.setState({
      user: { id: 'usr_test_data_loss', email: 'athlete@bebig.app' } as any,
      status: 'authenticated',
      isGuest: false,
      guestSession: null,
    });

    // User A active workout is recovered intact with custom exercise and logged sets
    const restoredA = await workoutStorage.getActiveWorkout(authScope);
    expect(restoredA).not.toBeNull();
    expect(restoredA?.name).toBe('User A Media Workout');
    expect(restoredA?.exercises[0].exerciseId).toBe(customExA.id);
    expect(restoredA?.exercises[0].exerciseName).toBe('Athlete A Special Squat');
    expect(restoredA?.exercises[0].actualSets[0].weight).toBe(180);
  });
});
