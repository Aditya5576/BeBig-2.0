import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { guestMigrationService } from '../src/features/auth/services/guestMigrationService';
import { WorkoutTemplate } from '../src/features/templates/types';
import { WorkoutSession } from '../src/features/workout/types';
import { useAuthStore } from '../src/features/auth/store/useAuthStore';
import { UserScope } from '../src/features/auth/utils/userScope';
import { platformStorage } from '../src/lib/storage';

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

describe('P0 Bugfix: Explicit Discard Tombstones & Lifecycle Hardening', () => {
  const authScope: UserScope = { ownerId: 'usr_test_data_loss', ownerType: 'authenticated' };
  const guestScope: UserScope = { ownerId: 'guest_user', ownerType: 'guest' };
  const userBScope: UserScope = { ownerId: 'usr_user_b', ownerType: 'authenticated' };

  const testTemplate: WorkoutTemplate = {
    id: 'tpl_hypertrophy_push',
    name: 'Hypertrophy Push A',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exercises: [
      {
        exerciseId: 'wger_bench_press',
        exerciseName: 'Barbell Bench Press',
        categoryName: 'Chest',
        order: 0,
        sets: 3,
        targetReps: '8-10',
        restTime: 90,
        targetWeight: 80,
      },
      {
        exerciseId: 'wger_tricep_pushdown',
        exerciseName: 'Triceps Pushdown',
        categoryName: 'Arms',
        order: 1,
        sets: 3,
        targetReps: '10-12',
        restTime: 60,
        targetWeight: 25,
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
    await workoutStorage.clearAllWorkouts(authScope);
    await workoutStorage.clearAllWorkouts(guestScope);
    await workoutStorage.clearAllWorkouts(userBScope);
    await templateStorage.clearTemplates(authScope);
  });

  // Test 1: Create workout -> discard -> read active: null
  it('1. Create workout -> discard -> read active: null', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, {
      scope: authScope,
    });
    const updated = workoutRepository.updateSet(session, 'wger_bench_press', session.exercises[0].actualSets[0].id, {
      weight: 100,
      reps: 8,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(updated);

    // Verify active is set
    const beforeDiscard = await workoutRepository.getActiveWorkout(authScope);
    expect(beforeDiscard).not.toBeNull();
    expect(beforeDiscard?.id).toBe(session.id);

    // Discard active workout
    await workoutRepository.discardActiveWorkout(authScope);

    // Reading active workout immediately returns null
    const afterDiscard = await workoutRepository.getActiveWorkout(authScope);
    expect(afterDiscard).toBeNull();

    // Direct platform storage key is empty
    const rawStorage = await platformStorage.getItem('bebig.workout.active.usr_test_data_loss');
    expect(rawStorage).toBeNull();
  });

  // Test 2: Create workout -> discard -> simulate app refresh / startup hydration: not restored
  it('2. Create workout -> discard -> simulate app refresh / startup hydration: not restored', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, {
      scope: authScope,
    });
    const updated = workoutRepository.updateSet(session, 'wger_bench_press', session.exercises[0].actualSets[0].id, {
      weight: 105,
      reps: 6,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(updated);

    // Discard
    await workoutRepository.discardActiveWorkout(authScope);

    // Simulate page refresh / cold start:
    // 1. Reset FIFO queue
    workoutStorage.resetActiveWorkoutQueue();
    // 2. Clear volatile memory cache
    workoutStorage.clearMemoryCache();
    // 3. Re-hydrate active session from hardware persistence
    const restoredOnRefresh = await workoutRepository.getActiveWorkout(authScope);
    expect(restoredOnRefresh).toBeNull();

    // Verify direct storage
    const rawActive = await platformStorage.getItem('bebig.workout.active.usr_test_data_loss');
    expect(rawActive).toBeNull();
  });

  // Test 3: Create workout -> queue delayed save -> hold at physical storage boundary -> discard -> release write -> refresh: discarded stays discarded
  it('3. Create workout -> queue delayed save -> hold at physical storage boundary -> discard -> release write -> refresh: discarded stays discarded', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, {
      scope: authScope,
    });

    const mutatedSession: WorkoutSession = {
      ...session,
      name: 'Mutated Stale Session',
      version: 99,
    };

    // Hold the delayed write at the physical platformStorage boundary
    let releasePhysicalWrite!: () => void;
    let interceptCount = 0;
    const physicalWriteGate = new Promise<void>((resolve) => {
      releasePhysicalWrite = resolve;
    });

    const originalSetItem = platformStorage.setItem.bind(platformStorage);
    const setItemSpy = jest.spyOn(platformStorage, 'setItem').mockImplementation(async (key: string, value: string) => {
      if (
        key.includes('bebig.workout.active') &&
        !key.includes('token') &&
        !key.includes('discarded') &&
        !key.includes('abandoned') &&
        interceptCount === 0
      ) {
        interceptCount++;
        // Hold inside the physical storage boundary
        await physicalWriteGate;
      }
      return originalSetItem(key, value);
    });

    // 1. Enter the real FIFO queue with an autosave
    const savePromise = workoutStorage.saveActiveWorkout(mutatedSession, authScope);

    // Wait until the autosave has actually entered the physical write boundary
    while (interceptCount === 0) {
      await new Promise((r) => setTimeout(r, 5));
    }

    // 2. Discard workout while the write is physically pending in storage
    const discardPromise = workoutRepository.discardActiveWorkout(authScope);

    // 3. Release the physical storage write gate
    releasePhysicalWrite();

    // 4. Await both operations to complete through the queue
    await Promise.all([savePromise, discardPromise]);

    setItemSpy.mockRestore();

    // 5. Simulate cold app restart / page refresh
    workoutStorage.resetActiveWorkoutQueue();
    workoutStorage.clearMemoryCache();

    // 6. Assertions confirm the session is permanently discarded and cannot return
    const active = await workoutRepository.getActiveWorkout(authScope);
    expect(active).toBeNull();

    const rawActive = await platformStorage.getItem('bebig.workout.active.usr_test_data_loss');
    expect(rawActive).toBeNull();

    const isDiscarded = await workoutRepository.isSessionDiscarded(session.id, authScope);
    expect(isDiscarded).toBe(true);

    const token = await workoutStorage.getActiveSessionToken(authScope);
    expect(token?.status).toBe('discarded');
    expect(token?.sessionId).toBe(session.id);
  });

  // Test 4: Create workout -> discard -> create new workout -> refresh: only new workout is active
  it('4. Create workout -> discard -> create new workout -> refresh: only new workout is active', async () => {
    // 1. Workout A created and logged
    const sessionA = await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, {
      scope: authScope,
    });
    const updatedA = workoutRepository.updateSet(sessionA, 'wger_bench_press', sessionA.exercises[0].actualSets[0].id, {
      weight: 120,
      reps: 5,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(updatedA);

    // 2. User chooses "Discard & Start New"
    await workoutRepository.discardActiveWorkout(authScope);
    const sessionB = await workoutRepository.startEmptyWorkout('Fresh Leg Day', undefined, {
      forceDiscardExisting: true,
      scope: authScope,
    });

    // 3. Simulate unmount flush of Screen A trying to save stale Workout A
    await workoutStorage.saveActiveWorkout(updatedA, authScope);

    // 4. Simulate app refresh (memory cache clear, queue reset)
    workoutStorage.resetActiveWorkoutQueue();
    workoutStorage.clearMemoryCache();

    // 5. Active workout MUST be Workout B only, never resurrected Workout A
    const currentActive = await workoutRepository.getActiveWorkout(authScope);
    expect(currentActive).not.toBeNull();
    expect(currentActive?.id).toBe(sessionB.id);
    expect(currentActive?.name).toBe('Fresh Leg Day');
    expect(currentActive?.id).not.toBe(sessionA.id);
  });

  // Test 5: Discarded session cannot be restored from abandoned-workout recovery
  it('5. Discarded session cannot be restored from abandoned-workout recovery', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, {
      scope: authScope,
    });
    await workoutRepository.discardActiveWorkout(authScope);

    // Verify it is not in abandoned recovery
    const abandoned = await workoutRepository.getAbandonedWorkout(authScope);
    expect(abandoned).toBeNull();

    // Even if an external or malicious process injects the discarded ID into abandoned storage:
    const abandonedKey = 'bebig.workout.active.abandoned.usr_test_data_loss';
    await platformStorage.setItem(abandonedKey, JSON.stringify([session]));

    // Attempting to restore must reject/return null because the session is tombstoned
    const restored = await workoutRepository.restoreAbandonedWorkout(authScope);
    expect(restored).toBeNull();

    // Active remains null
    const active = await workoutRepository.getActiveWorkout(authScope);
    expect(active).toBeNull();
  });

  // Test 6: Guest-to-auth migration cannot restore discarded session
  it('6. Guest-to-auth migration cannot restore discarded session', async () => {
    // 1. Guest creates and discards workout
    useAuthStore.setState({
      user: null,
      isGuest: true,
      status: 'guest',
      guestSession: { id: 'guest_user', createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() },
    });

    const guestSession = await workoutRepository.startEmptyWorkout('Guest Draft', undefined, { scope: guestScope });
    await workoutRepository.discardActiveWorkout(guestScope);

    // 2. User signs in
    useAuthStore.setState({
      user: { id: 'usr_test_data_loss', email: 'athlete@bebig.app' } as any,
      isGuest: false,
      status: 'authenticated',
      guestSession: null,
    });

    // 3. Migrate guest data
    await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);

    // 4. Authenticated active session and abandoned recovery must remain null
    const authActive = await workoutRepository.getActiveWorkout(authScope);
    expect(authActive).toBeNull();

    const authAbandoned = await workoutRepository.getAbandonedWorkout(authScope);
    expect(authAbandoned).toBeNull();
  });

  // Test 7: Unrelated active session or another user's session not affected
  it("7. Unrelated active session or another user's session not affected", async () => {
    // User A starts Workout A
    const sessionA = await workoutRepository.startEmptyWorkout('User A Workout', undefined, { scope: authScope });
    const updatedA = workoutRepository.addExerciseToWorkout(sessionA, { id: 'sq', name: 'User A Squats' });
    await workoutStorage.saveActiveWorkout(updatedA, authScope);

    // User B starts Workout B
    const sessionB = await workoutRepository.startEmptyWorkout('User B Workout', undefined, { scope: userBScope });
    const updatedB = workoutRepository.addExerciseToWorkout(sessionB, { id: 'bp', name: 'User B Bench' });
    await workoutStorage.saveActiveWorkout(updatedB, userBScope);

    // User A discards their workout
    await workoutRepository.discardActiveWorkout(authScope);

    // User A active is null
    const activeA = await workoutRepository.getActiveWorkout(authScope);
    expect(activeA).toBeNull();

    // User B workout is 100% intact and unaffected
    const activeB = await workoutRepository.getActiveWorkout(userBScope);
    expect(activeB).not.toBeNull();
    expect(activeB?.id).toBe(sessionB.id);
    expect(activeB?.name).toBe('User B Workout');
    expect(activeB?.exercises[0].exerciseName).toBe('User B Bench');
  });

  // Test 8: Completed workout history and templates remain intact
  it('8. Completed workout history and templates remain intact', async () => {
    // 1. Pre-existing completed workout in history
    const completedSample: WorkoutSession = {
      id: 'completed_hist_1',
      name: 'Completed Yesterday',
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      finishedAt: new Date(Date.now() - 82800000).toISOString(),
      status: 'completed',
      exercises: [],
      totalDuration: 3600,
      totalVolume: 5000,
    };
    await workoutStorage.saveCompletedWorkout(completedSample, authScope);

    // 2. Pre-existing template
    await templateStorage.saveTemplate(testTemplate, authScope);

    // 3. User starts an active workout from template and discards it
    await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, { scope: authScope });
    await workoutRepository.discardActiveWorkout(authScope);

    // 4. Completed history is untouched
    const completedList = await workoutRepository.getCompletedWorkouts(authScope);
    expect(completedList).toHaveLength(1);
    expect(completedList[0].id).toBe('completed_hist_1');

    // 5. Templates are untouched
    const templates = await templateStorage.getTemplates(authScope);
    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe(testTemplate.id);
  });

  // Test 9: Repeated discard calls are safe and idempotent
  it('9. Repeated discard calls are safe and idempotent', async () => {
    const session = await workoutRepository.startEmptyWorkout('Idempotent Test', undefined, { scope: authScope });
    expect(session.id).toBeDefined();

    // Discard 3 times consecutively
    await expect(workoutRepository.discardActiveWorkout(authScope)).resolves.not.toThrow();
    await expect(workoutRepository.discardActiveWorkout(authScope)).resolves.not.toThrow();
    await expect(workoutRepository.discardActiveWorkout(authScope)).resolves.not.toThrow();

    const active = await workoutRepository.getActiveWorkout(authScope);
    expect(active).toBeNull();
  });

  // Test 10: Existing resume and abandoned recovery still work for sessions not explicitly discarded
  it('10. Existing resume and abandoned recovery still work for sessions not explicitly discarded', async () => {
    // A. Verify normal active workout resume:
    const session = await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, {
      scope: authScope,
    });
    const withSet = workoutRepository.updateSet(session, 'wger_bench_press', session.exercises[0].actualSets[0].id, {
      weight: 90,
      reps: 8,
      completed: true,
    });
    const paused = {
      ...withSet,
      pausedAt: new Date().toISOString(),
      accumulatedPauseSeconds: 120,
    };
    await workoutRepository.updateActiveWorkout(paused);

    // Resume from storage:
    const resumed = await workoutRepository.getActiveWorkout(authScope);
    expect(resumed).not.toBeNull();
    expect(resumed?.id).toBe(session.id);
    expect(resumed?.exercises[0].actualSets[0].weight).toBe(90);
    expect(resumed?.accumulatedPauseSeconds).toBe(120);

    // B. Verify abandoned recovery for non-discarded (genuinely archived) session:
    // Genuinely archive session into abandoned recovery
    await workoutStorage.archiveActiveWorkout(withSet, authScope);
    await workoutStorage.clearActiveWorkout(authScope);

    // It is available in abandoned recovery:
    const abandoned = await workoutRepository.getAbandonedWorkout(authScope);
    expect(abandoned).not.toBeNull();
    expect(abandoned?.id).toBe(session.id);

    // Restoration succeeds:
    const restored = await workoutRepository.restoreAbandonedWorkout(authScope);
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe(session.id);
    expect(restored?.status).toBe('active');

    // Restored session is now active in storage:
    const activeAfterRestore = await workoutRepository.getActiveWorkout(authScope);
    expect(activeAfterRestore?.id).toBe(session.id);
    expect(activeAfterRestore?.exercises[0].actualSets[0].weight).toBe(90);
  });

  // Test 11: Multi-tab web simulation: Tab A holds workout A, Tab B discards A and creates B, Tab A attempts to autosave A, refresh/reload: only B remains active
  it('11. Multi-tab web simulation: Tab A holds workout A, Tab B discards A and creates B, Tab A attempts to autosave A, refresh/reload: only B remains active', async () => {
    // 1. Tab A starts Workout A
    const sessionA = await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, {
      scope: authScope,
    });
    const loggedSessionA = workoutRepository.updateSet(
      sessionA,
      'wger_bench_press',
      sessionA.exercises[0].actualSets[0].id,
      {
        weight: 110,
        reps: 8,
        completed: true,
      }
    );
    await workoutRepository.updateActiveWorkout(loggedSessionA, authScope);

    // 2. Tab B opens in another browser tab (shares platformStorage and authScope)
    // User in Tab B clicks "Discard & Start New", creating Workout B
    await workoutRepository.discardActiveWorkout(authScope, loggedSessionA.id);
    const sessionB = await workoutRepository.startEmptyWorkout('Workout B Leg Day', undefined, {
      scope: authScope,
      forceDiscardExisting: true,
    });
    expect(sessionB.id).not.toBe(sessionA.id);

    // 3. Tab A (still holding stale Workout A in React state) triggers an autosave for Workout A
    const staleMutatedA: WorkoutSession = {
      ...loggedSessionA,
      name: 'Resurrected Tab A Workout',
      version: 999,
    };
    // Tab A attempts to save Workout A — should either reject or safely drop
    await workoutStorage.saveActiveWorkout(staleMutatedA, authScope).catch(() => {});

    // 4. Simulate page refresh / app reload in either tab
    workoutStorage.resetActiveWorkoutQueue();
    workoutStorage.clearMemoryCache();

    // 5. Active session must authoritatively remain Workout B, NEVER stale Workout A
    const currentActive = await workoutRepository.getActiveWorkout(authScope);
    expect(currentActive).not.toBeNull();
    expect(currentActive?.id).toBe(sessionB.id);
    expect(currentActive?.name).toBe('Workout B Leg Day');
    expect(currentActive?.id).not.toBe(sessionA.id);

    // Active session token authoritatively points to Workout B
    const token = await workoutStorage.getActiveSessionToken(authScope);
    expect(token?.status).toBe('active');
    expect(token?.sessionId).toBe(sessionB.id);

    // Workout A remains explicitly discarded
    const isDiscarded = await workoutRepository.isSessionDiscarded(sessionA.id, authScope);
    expect(isDiscarded).toBe(true);
  });

  // Test 12: Tombstone eviction safety: Active Session Token prevents resurrection even if tombstone array evicts session ID
  it('12. Tombstone eviction safety: Active Session Token prevents resurrection even if tombstone array evicts session ID', async () => {
    // 1. Start Workout A and discard it
    const sessionA = await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, {
      scope: authScope,
    });
    await workoutRepository.discardActiveWorkout(authScope, sessionA.id);

    // 2. Simulate 60 other workouts created and discarded to evict Session A from the 50-tombstone list
    const discardedKey = 'bebig.workout.active.discarded.usr_test_data_loss';
    const fakeTombstones = Array.from({ length: 60 }, (_, i) => `eviction_session_${i}`);
    await platformStorage.setItem(discardedKey, JSON.stringify(fakeTombstones));

    // 3. Direct tombstone array no longer contains sessionA.id (it was evicted)
    const rawTombstones = JSON.parse((await platformStorage.getItem(discardedKey)) || '[]');
    expect(rawTombstones.includes(sessionA.id)).toBe(false);

    // 4. But active session token still marks sessionA as discarded!
    const tokenBefore = await workoutStorage.getActiveSessionToken(authScope);
    expect(tokenBefore?.status).toBe('discarded');
    expect(tokenBefore?.sessionId).toBe(sessionA.id);

    // 5. Stale autosave for sessionA attempts to write
    await workoutStorage.saveActiveWorkout(sessionA, authScope).catch(() => {});

    // 6. Refresh / reload
    workoutStorage.resetActiveWorkoutQueue();
    workoutStorage.clearMemoryCache();

    // 7. Active session MUST remain null — token blocks resurrection!
    const active = await workoutRepository.getActiveWorkout(authScope);
    expect(active).toBeNull();

    const rawActive = await platformStorage.getItem('bebig.workout.active.usr_test_data_loss');
    expect(rawActive).toBeNull();
  });

  // Test 13: TOCTOU race immunity: Tab A cleanup deletion attempt cannot delete Tab B's newer Workout B
  it('13. TOCTOU race immunity: Tab A cleanup deletion attempt cannot delete Tab B newer Workout B', async () => {
    // Exact interleaving sequence:
    // 1. Tab A has stale Workout A
    const sessionA = await workoutRepository.startWorkoutFromTemplate(testTemplate, undefined, undefined, {
      scope: authScope,
    });

    // Storage initially contains Workout A
    const rawA = await platformStorage.getItem('bebig.workout.active.usr_test_data_loss');
    expect(JSON.parse(rawA!).id).toBe(sessionA.id);

    // Step 1: Tab A reads stale Workout A during cleanup check
    const tabACheckValue = await platformStorage.getItem('bebig.workout.active.usr_test_data_loss');
    expect(JSON.parse(tabACheckValue!).id).toBe(sessionA.id);

    // Step 2: Tab B writes newer Workout B while Tab A is paused before deletion
    const sessionB = await workoutRepository.startEmptyWorkout('Workout B Newer Session', undefined, {
      scope: authScope,
      forceDiscardExisting: true,
    });
    expect(sessionB.id).not.toBe(sessionA.id);

    // Verify storageKey now holds Workout B
    const rawB = await platformStorage.getItem('bebig.workout.active.usr_test_data_loss');
    expect(JSON.parse(rawB!).id).toBe(sessionB.id);

    // Step 3: Tab A resumes and attempts deletion targeting Session A
    const deleteResult = await workoutStorage.deleteActiveWorkoutIfMatchesId(sessionA.id, authScope);
    // Atomic check detects storage contains Session B, NOT Session A -> deletion safely skipped!
    expect(deleteResult).toBe(false);

    // Step 4: Workout B must remain 100% intact!
    const rawAfterAttempt = await platformStorage.getItem('bebig.workout.active.usr_test_data_loss');
    expect(rawAfterAttempt).not.toBeNull();
    const storedAfter = JSON.parse(rawAfterAttempt!);
    expect(storedAfter.id).toBe(sessionB.id);
    expect(storedAfter.name).toBe('Workout B Newer Session');

    // Cold hydration verify
    workoutStorage.resetActiveWorkoutQueue();
    workoutStorage.clearMemoryCache();
    const currentActive = await workoutRepository.getActiveWorkout(authScope);
    expect(currentActive?.id).toBe(sessionB.id);
    expect(currentActive?.name).toBe('Workout B Newer Session');
  });
});
