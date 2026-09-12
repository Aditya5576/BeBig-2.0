/**
 * BeBig 2.0 — Milestone 10 Checkpoint 3.4 Unit & Integration Tests
 *
 * Validates the full sync lifecycle integration:
 * - App startup sync
 * - AppState foreground transition sync
 * - Network recovery transition sync
 * - Workout completion durability & sync trigger
 * - Guest & unauthenticated zero-network isolation
 * - Authoritative SyncEngine mutex & trailing edge collapse
 * - Crash recovery of untracked completed workouts
 * - Active workout immunity
 */

import { AppState, AppStateStatus } from 'react-native';
import { SyncEngine, SyncLifecycleManager, syncLifecycleManager, NetworkMonitor, syncMetadataStore } from '../src/services/sync';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { useAuthStore } from '../src/features/auth';
import { UserScope } from '../src/features/auth/types';
import { WorkoutSession } from '../src/features/workout/types';
import { CloudError } from '../src/services/cloud';

class MockNetworkMonitor implements NetworkMonitor {
  private online = true;
  private listeners: ((isOnline: boolean) => void)[] = [];

  async isOnline(): Promise<boolean> {
    return this.online;
  }

  subscribe(onStatusChange: (isOnline: boolean) => void): () => void {
    this.listeners.push(onStatusChange);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== onStatusChange);
    };
  }

  setOnline(online: boolean): void {
    this.online = online;
    for (const listener of this.listeners) {
      listener(online);
    }
  }
}

describe('Milestone 10 — Checkpoint 3.4: Sync Lifecycle Integration Unit Tests', () => {
  const userA: UserScope = { ownerId: 'usr_alpha', ownerType: 'authenticated' };
  const userB: UserScope = { ownerId: 'usr_beta', ownerType: 'authenticated' };
  const guestUser: UserScope = { ownerId: 'guest_123', ownerType: 'guest' };

  let mockWorkoutCloud: any;
  let mockTemplateCloud: any;
  let mockCustomExerciseCloud: any;
  let mockNetwork: MockNetworkMonitor;
  let engine: SyncEngine;
  let manager: SyncLifecycleManager;
  let appStateListeners: ((state: AppStateStatus) => void)[] = [];

  beforeEach(async () => {
    syncMetadataStore.clearMemoryCache();
    workoutStorage.clearMemoryCache();

    await syncMetadataStore.resetUserState(userA.ownerId);
    await syncMetadataStore.resetUserState(userB.ownerId);
    await workoutStorage.clearAllWorkouts(userA);
    await workoutStorage.clearAllWorkouts(userB);

    useAuthStore.setState({
      user: { id: userA.ownerId, email: 'alpha@bebig.app' } as any,
      isGuest: false,
      status: 'authenticated',
    });

    mockWorkoutCloud = {
      upsert: jest.fn(async (r: any) => ({
        ...r,
        user_id: userA.ownerId,
        started_at: r.startedAt,
        finished_at: r.finishedAt,
        total_duration: r.totalDuration,
        total_volume: r.totalVolume,
        completed_sets_count: r.completedSetsCount,
        client_updated_at: r.clientUpdatedAt || new Date().toISOString(),
        deleted_at: r.deletedAt || null,
        created_at: '2026-09-01T08:00:00Z',
        updated_at: '2026-09-01T12:00:05Z',
      })),
      upsertBatch: jest.fn(async (records: any[]) =>
        records.map((r) => ({
          ...r,
          user_id: userA.ownerId,
          started_at: r.startedAt,
          finished_at: r.finishedAt,
          total_duration: r.totalDuration,
          total_volume: r.totalVolume,
          completed_sets_count: r.completedSetsCount,
          client_updated_at: r.clientUpdatedAt || new Date().toISOString(),
          deleted_at: r.deletedAt || null,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:05Z',
        })),
      ),
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
    };

    mockTemplateCloud = {
      upsert: jest.fn(),
      upsertBatch: jest.fn(async (records: any[]) =>
        records.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      ),
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
    };

    mockCustomExerciseCloud = {
      upsert: jest.fn(),
      upsertBatch: jest.fn(async (records: any[]) =>
        records.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      ),
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
    };

    engine = new SyncEngine(mockWorkoutCloud, mockTemplateCloud, mockCustomExerciseCloud);
    mockNetwork = new MockNetworkMonitor();
    manager = new SyncLifecycleManager(engine, mockNetwork);

    syncLifecycleManager.setSyncEngine(engine);
    syncLifecycleManager.setNetworkMonitor(mockNetwork);

    // Spy on AppState.addEventListener to simulate foreground transitions
    appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'change') {
        appStateListeners.push(handler);
      }
      return {
        remove: () => {
          appStateListeners = appStateListeners.filter((h) => h !== handler);
        },
      } as any;
    });
  });

  afterEach(() => {
    manager.stopListening();
    jest.restoreAllMocks();
  });

  describe('1. App Lifecycle & Network Recovery Triggers', () => {
    it('1. startup sync triggers sequential push then pull for authenticated user', async () => {
      const result = await manager.triggerSync({ reason: 'app_startup', scope: userA });

      expect(result.status).toBe('success');
      expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledTimes(1);
      expect(mockTemplateCloud.fetchChanged).toHaveBeenCalledTimes(1);
      expect(mockCustomExerciseCloud.fetchChanged).toHaveBeenCalledTimes(1);
    });

    it('2. app returning to foreground triggers sync', async () => {
      manager.startListening();

      expect(appStateListeners.length).toBeGreaterThan(0);

      // Simulate AppState transition: background -> active
      const foregroundHandler = appStateListeners[0];
      foregroundHandler('background');
      foregroundHandler('active');

      // Wait a microtask tick for async fire-and-forget
      await new Promise((r) => setTimeout(r, 50));

      expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalled();
    });

    it('3. network recovery transitions from offline to online and triggers sync', async () => {
      manager.startListening();

      // Go offline
      mockNetwork.setOnline(false);

      // Reconnect online
      mockNetwork.setOnline(true);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalled();
    });
  });

  describe('2. Workout Completion Durability Chain', () => {
    it('4. workout completion saves locally, clears active draft, marks pending metadata, and triggers sync', async () => {
      const activeDraft: WorkoutSession = {
        id: 'w_done_sync',
        name: 'Leg Day',
        startedAt: '2026-09-01T08:00:00Z',
        status: 'active',
        exercises: [
          {
            exerciseId: 'squat',
            exerciseName: 'Squat',
            order: 0,
            plannedSets: 1,
            actualSets: [
              {
                id: 'set_1',
                setNumber: 1,
                weight: 100,
                reps: 5,
                rir: 2,
                completed: true,
              },
            ],
          },
        ],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveActiveWorkout(activeDraft, userA);

      // Trigger completion via repository
      const completed = await workoutRepository.completeActiveWorkout(activeDraft);

      expect(completed.status).toBe('completed');
      expect(completed.id).toBe('w_done_sync');

      // 1. Saved locally
      const local = await workoutStorage.getCompletedWorkoutById('w_done_sync', userA);
      expect(local?.id).toBe('w_done_sync');

      // 2. Active draft cleared
      const active = await workoutStorage.getActiveWorkout(userA);
      expect(active).toBeNull();

      // 3. Fire-and-forget sync trigger ran automatically
      await new Promise((r) => setTimeout(r, 50));
      expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalled();

      // 4. Metadata was marked synced by the completed push
      const meta = await syncMetadataStore.getRecord('workout', 'w_done_sync', userA);
      expect(meta?.syncStatus).toBe('synced');
    });

    it('5. offline workout completion succeeds locally and retains pending_upload for later sync', async () => {
      mockWorkoutCloud.upsertBatch.mockRejectedValueOnce(new CloudError('network', 'Offline'));

      const activeDraft: WorkoutSession = {
        id: 'w_offline_done',
        name: 'Push Day Offline',
        startedAt: '2026-09-01T08:00:00Z',
        status: 'active',
        exercises: [
          {
            exerciseId: 'bench',
            exerciseName: 'Bench Press',
            order: 0,
            plannedSets: 1,
            actualSets: [{ id: 's1', setNumber: 1, weight: 80, reps: 8, rir: 2, completed: true }],
          },
        ],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveActiveWorkout(activeDraft, userA);

      const completed = await workoutRepository.completeActiveWorkout(activeDraft);

      expect(completed.id).toBe('w_offline_done');

      // Completed workout exists in local storage
      const local = await workoutStorage.getCompletedWorkoutById('w_offline_done', userA);
      expect(local?.name).toBe('Push Day Offline');

      // Active draft was cleared
      expect(await workoutStorage.getActiveWorkout(userA)).toBeNull();

      // Wait for background sync trigger to attempt push and encounter network error
      await new Promise((r) => setTimeout(r, 50));
      expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalled();

      // Offline failure cleanly preserves pending_upload metadata for later retry
      const meta = await syncMetadataStore.getRecord('workout', 'w_offline_done', userA);
      expect(meta?.syncStatus).toBe('pending_upload');
    });

    it('6. sync failure never breaks workout completion or throws to caller', async () => {
      // Simulate fatal server error during sync trigger
      mockWorkoutCloud.upsertBatch.mockRejectedValue(new Error('Fatal 500'));

      const activeDraft: WorkoutSession = {
        id: 'w_crash_resilient',
        name: 'Arm Blast',
        startedAt: '2026-09-01T08:00:00Z',
        status: 'active',
        exercises: [
          {
            exerciseId: 'curl',
            exerciseName: 'Bicep Curl',
            order: 0,
            plannedSets: 1,
            actualSets: [{ id: 's1', setNumber: 1, weight: 20, reps: 10, rir: 2, completed: true }],
          },
        ],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveActiveWorkout(activeDraft, userA);

      // Must NOT throw
      await expect(workoutRepository.completeActiveWorkout(activeDraft)).resolves.toBeDefined();

      // Workout safely exists locally
      const local = await workoutStorage.getCompletedWorkoutById('w_crash_resilient', userA);
      expect(local).not.toBeNull();
    });

    it('7. crash recovery: if metadata write was omitted/failed after local save, scanner repairs missing metadata', async () => {
      // 1. Manually simulate completed workout in local storage without metadata (e.g. process died)
      const orphanCompleted: WorkoutSession = {
        id: 'w_untracked_completed',
        name: 'Untracked Session',
        startedAt: '2026-09-01T08:00:00Z',
        finishedAt: '2026-09-01T09:00:00Z',
        status: 'completed',
        totalDuration: 3600,
        totalVolume: 5000,
        completedSetsCount: 5,
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(orphanCompleted, userA);

      // Verify no metadata exists initially
      let meta = await syncMetadataStore.getRecord('workout', 'w_untracked_completed', userA);
      expect(meta).toBeNull();

      // 2. Run sync: Step 1 runs crash-recovery scanner and uploads
      const syncResult = await engine.sync(userA);

      expect(syncResult.pushResult.pushedCount).toBe(1);

      // Metadata was recreated and now marked synced
      meta = await syncMetadataStore.getRecord('workout', 'w_untracked_completed', userA);
      expect(meta?.syncStatus).toBe('synced');
    });
  });

  describe('3. Isolation & Guardrails', () => {
    it('8. guest mode triggers zero cloud calls and returns skipped_guest_or_unauthenticated', async () => {
      useAuthStore.setState({
        user: null,
        isGuest: true,
        guestSession: { id: 'guest_123' } as any,
        status: 'guest' as any,
      });

      const result = await manager.triggerSync({ reason: 'app_startup', scope: guestUser });

      expect(result.status).toBe('skipped_guest_or_unauthenticated');
      expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();
      expect(mockWorkoutCloud.upsertBatch).not.toHaveBeenCalled();
    });

    it('9. unauthenticated state triggers zero cloud calls', async () => {
      useAuthStore.setState({
        user: null,
        isGuest: false,
        status: 'unauthenticated' as any,
      });

      const result = await manager.triggerSync({ reason: 'app_startup', scope: null });

      expect(result.status).toBe('skipped_guest_or_unauthenticated');
      expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();
    });

    it('10. active workout is strictly immune and never uploaded during sync', async () => {
      const activeDraft: WorkoutSession = {
        id: 'w_live_draft_immune',
        name: 'Live Unfinished Workout',
        startedAt: '2026-09-01T10:00:00Z',
        status: 'active',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveActiveWorkout(activeDraft, userA);

      await engine.sync(userA);

      // Zero uploads occurred
      expect(mockWorkoutCloud.upsertBatch).not.toHaveBeenCalled();

      // Active draft remains intact
      const active = await workoutStorage.getActiveWorkout(userA);
      expect(active?.id).toBe('w_live_draft_immune');
      expect(active?.status).toBe('active');
    });
  });

  describe('4. Authoritative Mutex & Trailing Request Coordination', () => {
    it('11. concurrent triggers while busy collapse into exactly one trailing pass with zero overlap', async () => {
      let resolveSlowPush: any;
      const slowPushPromise = new Promise((resolve) => {
        resolveSlowPush = resolve;
      });

      // Pass 1 will hang on push until resolveSlowPush is called
      mockWorkoutCloud.fetchChanged.mockResolvedValue({ records: [], hasMore: false, nextCursor: null });
      mockWorkoutCloud.upsertBatch.mockImplementationOnce(() => slowPushPromise);

      // Create a pending workout to push (must exist locally so not treated as orphan)
      const session1: WorkoutSession = {
        id: 'w_concurrent_1',
        name: 'Workout 1',
        startedAt: '2026-09-01T08:00:00Z',
        finishedAt: '2026-09-01T09:00:00Z',
        status: 'completed',
        totalDuration: 3600,
        totalVolume: 5000,
        completedSetsCount: 5,
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(session1, userA);
      await syncMetadataStore.markPendingUpload('workout', 'w_concurrent_1', '2026-09-01T08:00:00Z', userA);

      // Launch Pass 1
      const syncPromise1 = manager.triggerSync({ reason: 'manual', scope: userA });

      // While Pass 1 is running, launch Trigger 2 and Trigger 3
      const syncPromise2 = manager.triggerSync({ reason: 'manual', scope: userA });
      const syncPromise3 = manager.triggerSync({ reason: 'manual', scope: userA });

      // Calls 2 and 3 return busy and set trailing request
      const res2 = await syncPromise2;
      const res3 = await syncPromise3;
      expect(res2.status).toBe('busy');
      expect(res3.status).toBe('busy');
      expect(manager.hasPendingTrailing()).toBe(true);

      // Add another pending workout before unlocking
      const session2: WorkoutSession = {
        id: 'w_concurrent_2',
        name: 'Workout 2',
        startedAt: '2026-09-01T09:00:00Z',
        finishedAt: '2026-09-01T10:00:00Z',
        status: 'completed',
        totalDuration: 3600,
        totalVolume: 5000,
        completedSetsCount: 5,
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(session2, userA);
      await syncMetadataStore.markPendingUpload('workout', 'w_concurrent_2', '2026-09-01T09:00:00Z', userA);

      // Configure second push response for trailing pass
      mockWorkoutCloud.upsertBatch.mockResolvedValueOnce([
        {
          id: 'w_concurrent_2',
          user_id: userA.ownerId,
          started_at: '2026-09-01T09:00:00Z',
          finished_at: '2026-09-01T10:00:00Z',
          total_duration: 3600,
          total_volume: 5000,
          completed_sets_count: 5,
          exercises: [],
          client_updated_at: '2026-09-01T09:00:00Z',
          deleted_at: null,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:00Z',
        },
      ]);

      // Unlock Pass 1
      resolveSlowPush([
        {
          id: 'w_concurrent_1',
          user_id: userA.ownerId,
          started_at: '2026-09-01T08:00:00Z',
          finished_at: '2026-09-01T09:00:00Z',
          total_duration: 3600,
          total_volume: 5000,
          completed_sets_count: 5,
          exercises: [],
          client_updated_at: '2026-09-01T08:00:00Z',
          deleted_at: null,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:00Z',
        },
      ]);

      // Await Pass 1 (which will automatically execute the trailing pass)
      const res1 = await syncPromise1;

      expect(res1.status).toBe('success');
      // Total 2 upsertBatch calls: Pass 1 + Trailing Pass 2 (not 3 or 4)
      expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalledTimes(2);
      expect(manager.hasPendingTrailing()).toBe(false);
    });

    it('12. account switch resets lifecycle state and prevents data leakage across scopes', async () => {
      await syncMetadataStore.markPendingUpload('workout', 'w_user_a', '2026-09-01T08:00:00Z', userA);

      // Sign out user A
      manager.reset();
      syncMetadataStore.clearMemoryCache();

      // Switch to user B
      useAuthStore.setState({
        user: { id: userB.ownerId, email: 'beta@bebig.app' } as any,
        isGuest: false,
        status: 'authenticated',
      });

      // Run sync for user B
      const resultB = await manager.triggerSync({ reason: 'app_startup', scope: userB });

      expect(resultB.pushResult.pushedCount).toBe(0);
      expect(mockWorkoutCloud.upsertBatch).not.toHaveBeenCalled();

      // User A's pending record is untouched and still pending under User A
      const metaA = await syncMetadataStore.getRecord('workout', 'w_user_a', userA);
      expect(metaA?.syncStatus).toBe('pending_upload');
    });
  });
});
