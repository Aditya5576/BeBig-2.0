import { syncMetadataStore, getSyncMetadataKey } from '../src/services/sync';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { useAuthStore } from '../src/features/auth';
import { UserScope } from '../src/features/auth/types';
import { WorkoutSession } from '../src/features/workout/types';
import { WorkoutTemplate } from '../src/features/templates/types';
import { Exercise } from '../src/features/exercises/types';

describe('Milestone 10 — Checkpoint 3.1: SyncMetadataStore & Crash Recovery Unit Tests', () => {
  const userA: UserScope = { ownerId: 'usr_alpha', ownerType: 'authenticated' };
  const userB: UserScope = { ownerId: 'usr_beta', ownerType: 'authenticated' };
  const guestUser: UserScope = { ownerId: 'guest_123', ownerType: 'guest' };

  beforeEach(async () => {
    syncMetadataStore.clearMemoryCache();
    workoutStorage.clearMemoryCache();
    templateStorage.clearMemoryCache();
    customExerciseStorage.clearMemoryCache();

    await syncMetadataStore.resetUserState(userA.ownerId);
    await syncMetadataStore.resetUserState(userB.ownerId);
    await workoutStorage.clearAllWorkouts(userA);
    await workoutStorage.clearAllWorkouts(userB);

    useAuthStore.setState({
      user: { id: userA.ownerId, email: 'alpha@bebig.app' } as any,
      isGuest: false,
      status: 'authenticated',
    });
  });

  afterEach(async () => {
    syncMetadataStore.clearMemoryCache();
    await syncMetadataStore.resetUserState(userA.ownerId);
    await syncMetadataStore.resetUserState(userB.ownerId);
  });

  describe('1. User-Scoped Metadata Storage & Scoping', () => {
    it('1. user-scoped metadata storage generates bebig.sync.metadata.<userId>', () => {
      const keyA = getSyncMetadataKey(userA);
      expect(keyA).toBe('bebig.sync.metadata.usr_alpha');

      const keyB = getSyncMetadataKey(userB);
      expect(keyB).toBe('bebig.sync.metadata.usr_beta');
    });

    it('14. guest scope does not create authenticated sync metadata', async () => {
      const guestKey = getSyncMetadataKey(guestUser);
      expect(guestKey).toBeNull();

      useAuthStore.setState({
        user: null,
        isGuest: true,
        guestSession: { id: 'guest_xyz' } as any,
        status: 'guest' as any,
      });

      const state = await syncMetadataStore.getState();
      expect(state).toBeNull();

      const record = await syncMetadataStore.markPendingUpload('workout', 'w_guest_1');
      expect(record).toBeNull();

      const scanResult = await syncMetadataStore.reconcileLocalEntities();
      expect(scanResult.scannedCount).toBe(0);
      expect(scanResult.repairedMissingMetadata).toBe(0);
    });

    it('15. user A metadata is isolated from user B', async () => {
      await syncMetadataStore.markPendingUpload('template', 'tpl_alpha_1', '2026-09-01T10:00:00Z', userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_beta_1', '2026-09-01T11:00:00Z', userB);

      const recA = await syncMetadataStore.getRecord('template', 'tpl_alpha_1', userA);
      const recBInA = await syncMetadataStore.getRecord('template', 'tpl_beta_1', userA);
      expect(recA).not.toBeNull();
      expect(recA?.id).toBe('tpl_alpha_1');
      expect(recBInA).toBeNull();

      const recB = await syncMetadataStore.getRecord('template', 'tpl_beta_1', userB);
      const recAInB = await syncMetadataStore.getRecord('template', 'tpl_alpha_1', userB);
      expect(recB).not.toBeNull();
      expect(recB?.id).toBe('tpl_beta_1');
      expect(recAInB).toBeNull();
    });

    it('16. clearMemoryCache prevents stale cross-user data', async () => {
      await syncMetadataStore.markPendingUpload('workout', 'w_mem_1', '2026-09-01T10:00:00Z', userA);

      // Verify cached in memory
      const cached = await syncMetadataStore.getRecord('workout', 'w_mem_1', userA);
      expect(cached).not.toBeNull();

      syncMetadataStore.clearMemoryCache();

      // State is reloaded cleanly from persistent storage
      const reloaded = await syncMetadataStore.getRecord('workout', 'w_mem_1', userA);
      expect(reloaded).not.toBeNull();
      expect(reloaded?.id).toBe('w_mem_1');
    });
  });

  describe('2. Metadata CRUD Operations & State Transitions', () => {
    it('2. get/set/remove metadata works predictably', async () => {
      await syncMetadataStore.setRecord(
        {
          entityType: 'template',
          id: 'tpl_crud_1',
          clientUpdatedAt: '2026-09-01T10:00:00Z',
          deletedAt: null,
          syncStatus: 'pending_upload',
        },
        userA,
      );

      const fetched = await syncMetadataStore.getRecord('template', 'tpl_crud_1', userA);
      expect(fetched?.id).toBe('tpl_crud_1');
      expect(fetched?.syncStatus).toBe('pending_upload');

      await syncMetadataStore.removeRecord('template', 'tpl_crud_1', userA);
      const afterRemove = await syncMetadataStore.getRecord('template', 'tpl_crud_1', userA);
      expect(afterRemove).toBeNull();
    });

    it('3. pending_upload transition sets syncStatus and clears deletedAt', async () => {
      const rec = await syncMetadataStore.markPendingUpload(
        'workout',
        'w_upload_1',
        '2026-09-01T10:00:00Z',
        userA,
      );

      expect(rec?.syncStatus).toBe('pending_upload');
      expect(rec?.deletedAt).toBeNull();
      expect(rec?.clientUpdatedAt).toBe('2026-09-01T10:00:00Z');

      const pending = await syncMetadataStore.getPendingRecords('workout', userA);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('w_upload_1');
    });

    it('4. pending_delete transition sets deletedAt and syncStatus', async () => {
      const rec = await syncMetadataStore.markPendingDelete(
        'template',
        'tpl_del_1',
        '2026-09-01T11:00:00Z',
        '2026-09-01T11:00:00Z',
        userA,
      );

      expect(rec?.syncStatus).toBe('pending_delete');
      expect(rec?.deletedAt).toBe('2026-09-01T11:00:00Z');

      const pending = await syncMetadataStore.getPendingRecords('template', userA);
      expect(pending).toHaveLength(1);
      expect(pending[0].syncStatus).toBe('pending_delete');
    });

    it('5. synced transition records serverUpdatedAt and updates status', async () => {
      await syncMetadataStore.markPendingUpload('workout', 'w_sync_1', '2026-09-01T10:00:00Z', userA);

      const synced = await syncMetadataStore.markSynced(
        'workout',
        'w_sync_1',
        '2026-09-01T10:00:05Z',
        null,
        userA,
      );

      expect(synced?.syncStatus).toBe('synced');
      expect(synced?.lastSyncedServerUpdatedAt).toBe('2026-09-01T10:00:05Z');

      const pending = await syncMetadataStore.getPendingRecords('workout', userA);
      expect(pending).toHaveLength(0);
    });

    it('6. error transition marks record as error (poison pill isolation)', async () => {
      await syncMetadataStore.markPendingUpload('custom_exercise', 'ex_err_1', '2026-09-01T10:00:00Z', userA);

      const errored = await syncMetadataStore.markError('custom_exercise', 'ex_err_1', userA);
      expect(errored?.syncStatus).toBe('error');

      const pending = await syncMetadataStore.getPendingRecords('custom_exercise', userA);
      expect(pending).toHaveLength(0);
    });

    it('7. watermark persistence and uninitialized safe defaults', async () => {
      // Uninitialized entity returns safe defaults
      const initial = await syncMetadataStore.getWatermark('workout', userA);
      expect(initial.lastCompletedWatermark).toBeNull();
      expect(initial.activeCursor).toBeNull();
      expect(initial.hasMore).toBe(false);

      // Persist partial watermark update
      await syncMetadataStore.setWatermark(
        'workout',
        {
          lastCompletedWatermark: '2026-09-01T12:00:00Z',
          activeCursor: { updatedAt: '2026-09-01T12:00:00Z', id: 'w_last_1' },
          hasMore: true,
        },
        userA,
      );

      const updated = await syncMetadataStore.getWatermark('workout', userA);
      expect(updated.lastCompletedWatermark).toBe('2026-09-01T12:00:00Z');
      expect(updated.activeCursor?.id).toBe('w_last_1');
      expect(updated.hasMore).toBe(true);
    });
  });

  describe('3. Deterministic Crash Recovery Scanner', () => {
    it('8. recovery: local entity exists + metadata missing -> creates pending_upload', async () => {
      const workout: WorkoutSession = {
        id: 'w_crash_new',
        name: 'Back & Biceps',
        startedAt: '2026-09-01T10:00:00Z',
        finishedAt: '2026-09-01T11:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(workout, userA);

      // App previously crashed before metadata write:
      const beforeMeta = await syncMetadataStore.getRecord('workout', 'w_crash_new', userA);
      expect(beforeMeta).toBeNull();

      const result = await syncMetadataStore.reconcileLocalEntities(userA);
      expect(result.repairedMissingMetadata).toBe(1);

      const afterMeta = await syncMetadataStore.getRecord('workout', 'w_crash_new', userA);
      expect(afterMeta).not.toBeNull();
      expect(afterMeta?.syncStatus).toBe('pending_upload');
      expect(afterMeta?.clientUpdatedAt).toBe('2026-09-01T11:00:00Z');
    });

    it('9. recovery: pending_delete tombstone exists + local entity exists -> removes local entity', async () => {
      const template: WorkoutTemplate = {
        id: 'tpl_del_crash',
        name: 'Shoulder Hypertrophy',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(template, userA);

      // Tombstone was written to metadata, but app crashed before local storage removal:
      await syncMetadataStore.markPendingDelete(
        'template',
        'tpl_del_crash',
        '2026-09-01T12:00:00Z',
        '2026-09-01T12:00:00Z',
        userA,
      );

      const result = await syncMetadataStore.reconcileLocalEntities(userA);
      expect(result.repairedUnflushedDeletions).toBe(1);

      // Local entity is now deleted
      const localTpl = await templateStorage.getTemplateById('tpl_del_crash', userA);
      expect(localTpl).toBeNull();

      // Tombstone is preserved
      const meta = await syncMetadataStore.getRecord('template', 'tpl_del_crash', userA);
      expect(meta?.syncStatus).toBe('pending_delete');
      expect(meta?.deletedAt).toBe('2026-09-01T12:00:00Z');
    });

    it('10. recovery: local entity is newer than metadata -> updates clientUpdatedAt & pending_upload', async () => {
      const exercise: Exercise = {
        id: 'ex_custom_stale_meta',
        name: 'Deficit Romanian Deadlift',
        description: '',
        category: 'legs',
        categoryName: 'Legs',
        primaryMuscles: [],
        secondaryMuscles: [],
        equipment: [],
        images: [],
        sourceProvider: 'custom',
        isCustom: true,
        createdAt: '2026-09-01T08:00:00Z',
      };
      (exercise as any).updatedAt = '2026-09-01T14:00:00Z'; // local edit timestamp
      await customExerciseStorage.saveCustomExercise(exercise, userA);

      // Stale metadata was synced at 10:00
      await syncMetadataStore.setRecord(
        {
          entityType: 'custom_exercise',
          id: 'ex_custom_stale_meta',
          clientUpdatedAt: '2026-09-01T10:00:00Z',
          deletedAt: null,
          syncStatus: 'synced',
        },
        userA,
      );

      const result = await syncMetadataStore.reconcileLocalEntities(userA);
      expect(result.repairedStaleMetadata).toBe(1);

      const meta = await syncMetadataStore.getRecord('custom_exercise', 'ex_custom_stale_meta', userA);
      expect(meta?.syncStatus).toBe('pending_upload');
      expect(meta?.clientUpdatedAt).toBe('2026-09-01T14:00:00Z');
    });

    it('11. recovery: pending_upload but local entity missing -> cleans orphan metadata', async () => {
      await syncMetadataStore.markPendingUpload(
        'workout',
        'w_orphan_1',
        '2026-09-01T10:00:00Z',
        userA,
      );

      const result = await syncMetadataStore.reconcileLocalEntities(userA);
      expect(result.cleanedOrphanPending).toBe(1);

      const meta = await syncMetadataStore.getRecord('workout', 'w_orphan_1', userA);
      expect(meta).toBeNull();
    });

    it('12. recovery: tombstone exists + local entity missing -> preserves tombstone', async () => {
      await syncMetadataStore.setRecord(
        {
          entityType: 'workout',
          id: 'w_tomb_synced',
          clientUpdatedAt: '2026-09-01T10:00:00Z',
          deletedAt: '2026-09-01T10:00:00Z',
          syncStatus: 'synced',
          lastSyncedServerUpdatedAt: '2026-09-01T10:00:05Z',
        },
        userA,
      );

      const result = await syncMetadataStore.reconcileLocalEntities(userA);
      expect(result.cleanedOrphanPending).toBe(0);

      const meta = await syncMetadataStore.getRecord('workout', 'w_tomb_synced', userA);
      expect(meta).not.toBeNull();
      expect(meta?.deletedAt).toBe('2026-09-01T10:00:00Z');
      expect(meta?.syncStatus).toBe('synced');
    });

    it('13. active workout is NEVER scanned or added to sync metadata', async () => {
      const activeWorkout: WorkoutSession = {
        id: 'w_active_in_progress',
        name: 'Chest Live Session',
        startedAt: new Date().toISOString(),
        status: 'active',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveActiveWorkout(activeWorkout, userA);

      const result = await syncMetadataStore.reconcileLocalEntities(userA);
      expect(result.repairedMissingMetadata).toBe(0);

      const meta = await syncMetadataStore.getRecord('workout', 'w_active_in_progress', userA);
      expect(meta).toBeNull();

      const activeAfter = await workoutStorage.getActiveWorkout(userA);
      expect(activeAfter?.id).toBe('w_active_in_progress');
      expect(activeAfter?.status).toBe('active');
    });
  });
});
