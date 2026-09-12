import { SyncEngine } from '../src/services/sync';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { useAuthStore } from '../src/features/auth';
import { UserScope } from '../src/features/auth/types';
import { WorkoutSession } from '../src/features/workout/types';
import { WorkoutTemplate } from '../src/features/templates/types';
import { Exercise } from '../src/features/exercises/types';
import { CloudError } from '../src/services/cloud';

describe('Milestone 10 — Checkpoint 3.2: SyncEngine Push & Stale LWW Reconciliation Unit Tests', () => {
  const userA: UserScope = { ownerId: 'usr_alpha', ownerType: 'authenticated' };
  const userB: UserScope = { ownerId: 'usr_beta', ownerType: 'authenticated' };
  const guestUser: UserScope = { ownerId: 'guest_123', ownerType: 'guest' };

  let mockWorkoutCloud: any;
  let mockTemplateCloud: any;
  let mockCustomExerciseCloud: any;
  let engine: SyncEngine;

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

    mockWorkoutCloud = {
      upsert: jest.fn(),
      upsertBatch: jest.fn(async (rows: any[]) =>
        rows.map((r) => ({
          ...r,
          user_id: userA.ownerId,
          started_at: r.startedAt,
          finished_at: r.finishedAt,
          total_duration: r.totalDuration,
          total_volume: r.totalVolume,
          completed_sets_count: r.completedSetsCount,
          client_updated_at: r.clientUpdatedAt,
          deleted_at: r.deletedAt,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:05Z',
        })),
      ),
    };

    mockTemplateCloud = {
      upsert: jest.fn(),
      upsertBatch: jest.fn(async (rows: any[]) =>
        rows.map((r) => ({
          ...r,
          user_id: userA.ownerId,
          client_updated_at: r.clientUpdatedAt,
          deleted_at: r.deletedAt,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:05Z',
        })),
      ),
    };

    mockCustomExerciseCloud = {
      upsert: jest.fn(),
      upsertBatch: jest.fn(async (rows: any[]) =>
        rows.map((r) => ({
          ...r,
          user_id: userA.ownerId,
          category_name: r.categoryName,
          primary_muscles: r.primaryMuscles,
          secondary_muscles: r.secondaryMuscles,
          client_updated_at: r.clientUpdatedAt,
          deleted_at: r.deletedAt,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:05Z',
        })),
      ),
    };

    engine = new SyncEngine(mockWorkoutCloud, mockTemplateCloud, mockCustomExerciseCloud);
  });

  afterEach(async () => {
    syncMetadataStore.clearMemoryCache();
    await syncMetadataStore.resetUserState(userA.ownerId);
    await syncMetadataStore.resetUserState(userB.ownerId);
  });

  describe('1. Push Scope & Authentication Guardrails', () => {
    it('1. authenticated user can push pending workout', async () => {
      const workout: WorkoutSession = {
        id: 'w_push_1',
        name: 'Upper Body Blast',
        startedAt: '2026-09-01T10:00:00Z',
        finishedAt: '2026-09-01T11:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(workout, userA);
      await syncMetadataStore.markPendingUpload('workout', 'w_push_1', '2026-09-01T11:00:00Z', userA);

      const result = await engine.push(userA);

      expect(result.status).toBe('success');
      expect(result.pushedCount).toBe(1);
      expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalledTimes(1);
      expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'w_push_1',
            name: 'Upper Body Blast',
            clientUpdatedAt: '2026-09-01T11:00:00Z',
          }),
        ]),
      );

      const meta = await syncMetadataStore.getRecord('workout', 'w_push_1', userA);
      expect(meta?.syncStatus).toBe('synced');
      expect(meta?.lastSyncedServerUpdatedAt).toBe('2026-09-01T12:00:05Z');
    });

    it('2. authenticated user can push pending template', async () => {
      const template: WorkoutTemplate = {
        id: 'tpl_push_1',
        name: 'Push Routine A',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(template, userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_push_1', '2026-09-01T09:00:00Z', userA);

      const result = await engine.push(userA);

      expect(result.status).toBe('success');
      expect(mockTemplateCloud.upsertBatch).toHaveBeenCalledTimes(1);
      expect(mockTemplateCloud.upsertBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'tpl_push_1',
            name: 'Push Routine A',
            clientUpdatedAt: '2026-09-01T09:00:00Z',
          }),
        ]),
      );

      const meta = await syncMetadataStore.getRecord('template', 'tpl_push_1', userA);
      expect(meta?.syncStatus).toBe('synced');
    });

    it('3. authenticated user can push pending custom exercise', async () => {
      const exercise: Exercise = {
        id: 'ex_push_1',
        name: 'Hammer Preacher Curl',
        description: '',
        category: 'arms',
        categoryName: 'Arms',
        primaryMuscles: [],
        secondaryMuscles: [],
        equipment: [],
        images: [],
        sourceProvider: 'custom',
        isCustom: true,
        createdAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await customExerciseStorage.saveCustomExercise(exercise, userA);
      await syncMetadataStore.markPendingUpload('custom_exercise', 'ex_push_1', '2026-09-01T08:00:00Z', userA);

      const result = await engine.push(userA);

      expect(result.status).toBe('success');
      expect(mockCustomExerciseCloud.upsertBatch).toHaveBeenCalledTimes(1);
      expect(mockCustomExerciseCloud.upsertBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ex_push_1',
            name: 'Hammer Preacher Curl',
            category: 'arms',
          }),
        ]),
      );

      const meta = await syncMetadataStore.getRecord('custom_exercise', 'ex_push_1', userA);
      expect(meta?.syncStatus).toBe('synced');
    });

    it('4. active workout is never pushed', async () => {
      const activeWorkout: WorkoutSession = {
        id: 'w_active_live',
        name: 'Live Active Draft',
        startedAt: '2026-09-01T10:00:00Z',
        status: 'active',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveActiveWorkout(activeWorkout, userA);

      // Even if manually put into pending metadata:
      await syncMetadataStore.markPendingUpload('workout', 'w_active_live', '2026-09-01T10:00:00Z', userA);

      const result = await engine.push(userA);

      expect(mockWorkoutCloud.upsertBatch).not.toHaveBeenCalled();
      expect(result.pushedCount).toBe(0);

      // Active draft remains intact
      const active = await workoutStorage.getActiveWorkout(userA);
      expect(active?.id).toBe('w_active_live');
      expect(active?.status).toBe('active');
    });

    it('5. guest mode performs zero cloud calls', async () => {
      useAuthStore.setState({
        user: null,
        isGuest: true,
        guestSession: { id: 'guest_456' } as any,
        status: 'guest' as any,
      });

      const result = await engine.push(guestUser);

      expect(result.status).toBe('skipped_guest_or_unauthenticated');
      expect(mockWorkoutCloud.upsertBatch).not.toHaveBeenCalled();
      expect(mockTemplateCloud.upsertBatch).not.toHaveBeenCalled();
      expect(mockCustomExerciseCloud.upsertBatch).not.toHaveBeenCalled();
    });

    it('21. user isolation is preserved', async () => {
      await syncMetadataStore.markPendingUpload('template', 'tpl_b_isolated', '2026-09-01T10:00:00Z', userB);
      const tplB: WorkoutTemplate = {
        id: 'tpl_b_isolated',
        name: 'User B Routine',
        exercises: [],
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
        ownerId: userB.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(tplB, userB);

      // Push for User A
      await engine.push(userA);

      // Mock was not called for User B's template
      expect(mockTemplateCloud.upsertBatch).not.toHaveBeenCalled();

      // User B's record remains pending
      const metaB = await syncMetadataStore.getRecord('template', 'tpl_b_isolated', userB);
      expect(metaB?.syncStatus).toBe('pending_upload');
    });

    it('22. stable IDs never change', async () => {
      const workout: WorkoutSession = {
        id: 'stable_client_id_999',
        name: 'Stable ID Test',
        startedAt: '2026-09-01T10:00:00Z',
        finishedAt: '2026-09-01T11:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(workout, userA);
      await syncMetadataStore.markPendingUpload('workout', 'stable_client_id_999', '2026-09-01T11:00:00Z', userA);

      await engine.push(userA);

      expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'stable_client_id_999' })]),
      );

      const local = await workoutStorage.getCompletedWorkoutById('stable_client_id_999', userA);
      expect(local?.id).toBe('stable_client_id_999');
    });
  });

  describe('2. Batching Architecture (50 Records Limit)', () => {
    it('6. 55 pending records become 2 batches of 50 + 5', async () => {
      for (let i = 1; i <= 55; i++) {
        const id = `w_batch55_${i}`;
        const w: WorkoutSession = {
          id,
          name: `Workout 55-${i}`,
          startedAt: '2026-09-01T10:00:00Z',
          finishedAt: '2026-09-01T11:00:00Z',
          status: 'completed',
          exercises: [],
          ownerId: userA.ownerId,
          ownerType: 'authenticated',
        };
        await workoutStorage.saveCompletedWorkout(w, userA);
        await syncMetadataStore.markPendingUpload('workout', id, '2026-09-01T11:00:00Z', userA);
      }

      const result = await engine.push(userA);

      expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalledTimes(2);
      expect(mockWorkoutCloud.upsertBatch.mock.calls[0][0]).toHaveLength(50);
      expect(mockWorkoutCloud.upsertBatch.mock.calls[1][0]).toHaveLength(5);
      expect(result.pushedCount).toBe(55);
      expect(result.batches).toHaveLength(2);
    });

    it('7. 137 pending records produce exactly batch 1 = 50, batch 2 = 50, batch 3 = 37 (all 137 processed exactly once)', async () => {
      for (let i = 1; i <= 137; i++) {
        const id = `w_bulk_${i}`;
        const w: WorkoutSession = {
          id,
          name: `Bulk Workout ${i}`,
          startedAt: '2026-09-01T10:00:00Z',
          finishedAt: '2026-09-01T11:00:00Z',
          status: 'completed',
          exercises: [],
          ownerId: userA.ownerId,
          ownerType: 'authenticated',
        };
        await workoutStorage.saveCompletedWorkout(w, userA);
        await syncMetadataStore.markPendingUpload('workout', id, '2026-09-01T11:00:00Z', userA);
      }

      const result = await engine.push(userA);

      // Verify exact batch breakdown: 50 + 50 + 37
      expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalledTimes(3);
      expect(mockWorkoutCloud.upsertBatch.mock.calls[0][0]).toHaveLength(50);
      expect(mockWorkoutCloud.upsertBatch.mock.calls[1][0]).toHaveLength(50);
      expect(mockWorkoutCloud.upsertBatch.mock.calls[2][0]).toHaveLength(37);

      // Verify all 137 records are processed exactly once
      const allPushedIds = [
        ...mockWorkoutCloud.upsertBatch.mock.calls[0][0].map((r: any) => r.id),
        ...mockWorkoutCloud.upsertBatch.mock.calls[1][0].map((r: any) => r.id),
        ...mockWorkoutCloud.upsertBatch.mock.calls[2][0].map((r: any) => r.id),
      ];
      expect(allPushedIds).toHaveLength(137);
      expect(new Set(allPushedIds).size).toBe(137);
      for (let i = 1; i <= 137; i++) {
        expect(allPushedIds).toContain(`w_bulk_${i}`);
      }

      expect(result.pushedCount).toBe(137);
      expect(result.batches).toHaveLength(3);

      const pendingLeft = await syncMetadataStore.getPendingRecords('workout', userA);
      expect(pendingLeft).toHaveLength(0);
    });
  });

  describe('3. Tombstones & Deletion Handling', () => {
    it('8. pending_delete sends tombstone without requiring local entity', async () => {
      // Local entity was already removed from templateStorage:
      const beforeLocal = await templateStorage.getTemplateById('tpl_already_removed', userA);
      expect(beforeLocal).toBeNull();

      await syncMetadataStore.markPendingDelete(
        'template',
        'tpl_already_removed',
        '2026-09-01T12:00:00Z',
        '2026-09-01T12:00:00Z',
        userA,
      );

      const result = await engine.push(userA);

      expect(result.status).toBe('success');
      expect(mockTemplateCloud.upsertBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'tpl_already_removed',
            deletedAt: '2026-09-01T12:00:00Z',
            clientUpdatedAt: '2026-09-01T12:00:00Z',
          }),
        ]),
      );

      const meta = await syncMetadataStore.getRecord('template', 'tpl_already_removed', userA);
      expect(meta?.syncStatus).toBe('synced');
      expect(meta?.deletedAt).toBe('2026-09-01T12:00:00Z');
    });

    it('9 & 10. successful push marks metadata synced and records server updated_at', async () => {
      const template: WorkoutTemplate = {
        id: 'tpl_success_sync',
        name: 'Chest & Tri',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(template, userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_success_sync', '2026-09-01T08:00:00Z', userA);

      await engine.push(userA);

      const meta = await syncMetadataStore.getRecord('template', 'tpl_success_sync', userA);
      expect(meta?.syncStatus).toBe('synced');
      expect(meta?.lastSyncedServerUpdatedAt).toBe('2026-09-01T12:00:05Z');
    });
  });

  describe('4. CRITICAL: Stale LWW Reconciliation', () => {
    it('11. stale cloud response with newer LIVE record reconciles local data', async () => {
      // Local device has stale version from 09:00
      const localTemplate: WorkoutTemplate = {
        id: 'tpl_stale_1',
        name: 'Stale Local Version (09:00)',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T09:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(localTemplate, userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_stale_1', '2026-09-01T09:00:00Z', userA);

      // Cloud rejected stale push and returned authoritative newer 10:00 version:
      mockTemplateCloud.upsertBatch.mockResolvedValueOnce([
        {
          id: 'tpl_stale_1',
          user_id: userA.ownerId,
          name: 'Authoritative Cloud Version (10:00)',
          exercises: [
            { exerciseId: 'bench', exerciseName: 'Bench Press', order: 0, sets: 4, targetReps: '8', restTime: 90 },
          ],
          client_updated_at: '2026-09-01T10:00:00Z',
          deleted_at: null,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T10:00:01Z',
        },
      ]);

      const result = await engine.push(userA);

      expect(result.reconciledCount).toBe(1);

      // Local storage MUST be updated to cloud authority:
      const reconciledLocal = await templateStorage.getTemplateById('tpl_stale_1', userA);
      expect(reconciledLocal?.name).toBe('Authoritative Cloud Version (10:00)');
      expect(reconciledLocal?.exercises).toHaveLength(1);
      expect(reconciledLocal?.updatedAt).toBe('2026-09-01T10:00:00Z');

      // Metadata must be marked synced with cloud timestamps:
      const meta = await syncMetadataStore.getRecord('template', 'tpl_stale_1', userA);
      expect(meta?.syncStatus).toBe('synced');
      expect(meta?.clientUpdatedAt).toBe('2026-09-01T10:00:00Z');
      expect(meta?.lastSyncedServerUpdatedAt).toBe('2026-09-01T10:00:01Z');
    });

    it('12. stale cloud response with newer TOMBSTONE removes local data', async () => {
      // Local device was offline and edited an old workout:
      const localWorkout: WorkoutSession = {
        id: 'w_deleted_in_cloud',
        name: 'Stale Local Workout (09:00)',
        startedAt: '2026-09-01T08:00:00Z',
        finishedAt: '2026-09-01T09:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(localWorkout, userA);
      await syncMetadataStore.markPendingUpload('workout', 'w_deleted_in_cloud', '2026-09-01T09:00:00Z', userA);

      // Cloud rejected push because it was deleted at 10:00 on another device:
      mockWorkoutCloud.upsertBatch.mockResolvedValueOnce([
        {
          id: 'w_deleted_in_cloud',
          user_id: userA.ownerId,
          name: 'Deleted Workout',
          started_at: '2026-09-01T08:00:00Z',
          finished_at: '2026-09-01T09:00:00Z',
          status: 'completed',
          total_duration: 3600,
          total_volume: 5000,
          completed_sets_count: 10,
          exercises: [],
          client_updated_at: '2026-09-01T10:00:00Z',
          deleted_at: '2026-09-01T10:00:00Z',
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T10:00:01Z',
        },
      ]);

      const result = await engine.push(userA);

      expect(result.reconciledCount).toBe(1);

      // Local storage MUST have the entity purged:
      const localAfter = await workoutStorage.getCompletedWorkoutById('w_deleted_in_cloud', userA);
      expect(localAfter).toBeNull();

      // Metadata must retain the tombstone as synced:
      const meta = await syncMetadataStore.getRecord('workout', 'w_deleted_in_cloud', userA);
      expect(meta?.syncStatus).toBe('synced');
      expect(meta?.deletedAt).toBe('2026-09-01T10:00:00Z');
      expect(meta?.clientUpdatedAt).toBe('2026-09-01T10:00:00Z');
    });

    it('13. equal timestamp with returned tombstone converges to deletion', async () => {
      const localExercise: Exercise = {
        id: 'ex_equal_tie',
        name: 'Tie Exercise',
        description: '',
        category: 'chest',
        categoryName: 'Chest',
        primaryMuscles: [],
        secondaryMuscles: [],
        equipment: [],
        images: [],
        sourceProvider: 'custom',
        isCustom: true,
        createdAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await customExerciseStorage.saveCustomExercise(localExercise, userA);
      await syncMetadataStore.markPendingUpload('custom_exercise', 'ex_equal_tie', '2026-09-01T10:00:00Z', userA);

      // Cloud returns tombstone with the exact same timestamp (10:00)
      mockCustomExerciseCloud.upsertBatch.mockResolvedValueOnce([
        {
          id: 'ex_equal_tie',
          user_id: userA.ownerId,
          name: 'Tie Exercise',
          description: '',
          category: 'chest',
          category_name: 'Chest',
          primary_muscles: [],
          secondary_muscles: [],
          equipment: [],
          client_updated_at: '2026-09-01T10:00:00Z',
          deleted_at: '2026-09-01T10:00:00Z',
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T10:00:01Z',
        },
      ]);

      const result = await engine.push(userA);

      expect(result.reconciledCount).toBe(1);

      // Entity removed locally; tombstone preserved
      const customExercises = await customExerciseStorage.getCustomExercises(userA);
      expect(customExercises.find((e) => e.id === 'ex_equal_tie')).toBeUndefined();

      const meta = await syncMetadataStore.getRecord('custom_exercise', 'ex_equal_tie', userA);
      expect(meta?.syncStatus).toBe('synced');
      expect(meta?.deletedAt).toBe('2026-09-01T10:00:00Z');
    });

    it('14. older cloud version vs newer local push succeeds normally', async () => {
      const template: WorkoutTemplate = {
        id: 'tpl_newer_push',
        name: 'Newer Edit (11:00)',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T11:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(template, userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_newer_push', '2026-09-01T11:00:00Z', userA);

      // Cloud accepted newer push and returned 11:00
      mockTemplateCloud.upsertBatch.mockResolvedValueOnce([
        {
          id: 'tpl_newer_push',
          user_id: userA.ownerId,
          name: 'Newer Edit (11:00)',
          exercises: [],
          client_updated_at: '2026-09-01T11:00:00Z',
          deleted_at: null,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T11:00:01Z',
        },
      ]);

      const result = await engine.push(userA);

      expect(result.pushedCount).toBe(1);
      expect(result.reconciledCount).toBe(0);

      const meta = await syncMetadataStore.getRecord('template', 'tpl_newer_push', userA);
      expect(meta?.syncStatus).toBe('synced');
    });
  });

  describe('5. Error Handling & Quarantine', () => {
    it('15. network error keeps record pending and stops cleanly', async () => {
      const workout: WorkoutSession = {
        id: 'w_net_err',
        name: 'Net Error Workout',
        startedAt: '2026-09-01T10:00:00Z',
        finishedAt: '2026-09-01T11:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(workout, userA);
      await syncMetadataStore.markPendingUpload('workout', 'w_net_err', '2026-09-01T11:00:00Z', userA);

      mockWorkoutCloud.upsertBatch.mockRejectedValueOnce(new CloudError('network', 'Failed to fetch'));

      const result = await engine.push(userA);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].kind).toBe('network');

      // Record remains pending upload
      const meta = await syncMetadataStore.getRecord('workout', 'w_net_err', userA);
      expect(meta?.syncStatus).toBe('pending_upload');
    });

    it('15b. network error keeps pending_delete record pending without loss or error status', async () => {
      await syncMetadataStore.markPendingDelete(
        'workout',
        'w_net_del_err',
        '2026-09-01T12:00:00Z',
        '2026-09-01T12:00:00Z',
        userA,
      );

      mockWorkoutCloud.upsertBatch.mockRejectedValueOnce(new CloudError('network', 'Connection reset'));

      const result = await engine.push(userA);

      expect(result.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].kind).toBe('network');

      // Record remains pending_delete, not marked error or synced
      const meta = await syncMetadataStore.getRecord('workout', 'w_net_del_err', userA);
      expect(meta?.syncStatus).toBe('pending_delete');
      expect(meta?.deletedAt).toBe('2026-09-01T12:00:00Z');
    });

    it('16. auth error keeps record pending and halts push', async () => {
      const template: WorkoutTemplate = {
        id: 'tpl_auth_err',
        name: 'Auth Err Template',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(template, userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_auth_err', '2026-09-01T08:00:00Z', userA);

      mockTemplateCloud.upsertBatch.mockRejectedValueOnce(new CloudError('auth', 'JWT expired'));

      const result = await engine.push(userA);

      expect(result.status).toBe('error');
      expect(result.errors[0].kind).toBe('auth');

      const meta = await syncMetadataStore.getRecord('template', 'tpl_auth_err', userA);
      expect(meta?.syncStatus).toBe('pending_upload');
    });

    it('17. permission error keeps record pending and halts push', async () => {
      const template: WorkoutTemplate = {
        id: 'tpl_perm_err',
        name: 'Perm Err Template',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(template, userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_perm_err', '2026-09-01T08:00:00Z', userA);

      mockTemplateCloud.upsertBatch.mockRejectedValueOnce(new CloudError('permission', 'RLS violation'));

      const result = await engine.push(userA);

      expect(result.status).toBe('error');
      expect(result.errors[0].kind).toBe('permission');

      const meta = await syncMetadataStore.getRecord('template', 'tpl_perm_err', userA);
      expect(meta?.syncStatus).toBe('pending_upload');
    });

    it('17b. unknown error keeps record pending and halts push cleanly', async () => {
      const template: WorkoutTemplate = {
        id: 'tpl_unknown_err',
        name: 'Unknown Err Template',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(template, userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_unknown_err', '2026-09-01T08:00:00Z', userA);

      mockTemplateCloud.upsertBatch.mockRejectedValueOnce(new CloudError('unknown', 'Internal 500 error'));

      const result = await engine.push(userA);

      expect(result.status).toBe('error');
      expect(result.errors[0].kind).toBe('unknown');

      // Record remains pending_upload, not converted to 'error'
      const meta = await syncMetadataStore.getRecord('template', 'tpl_unknown_err', userA);
      expect(meta?.syncStatus).toBe('pending_upload');
    });

    it('18. validation error quarantines offending record and allows valid records to sync', async () => {
      const templateGood: WorkoutTemplate = {
        id: 'tpl_good',
        name: 'Good Template',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      const templateBad: WorkoutTemplate = {
        id: 'tpl_bad',
        name: 'Bad Template',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(templateGood, userA);
      await templateStorage.saveTemplate(templateBad, userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_good', '2026-09-01T08:00:00Z', userA);
      await syncMetadataStore.markPendingUpload('template', 'tpl_bad', '2026-09-01T08:00:00Z', userA);

      // Batch upsert fails with validation error
      mockTemplateCloud.upsertBatch.mockRejectedValueOnce(new CloudError('validation', 'Check constraint violated'));

      // Individual fallback: good succeeds, bad fails validation
      mockTemplateCloud.upsert.mockImplementation(async (item: any) => {
        if (item.id === 'tpl_bad') {
          throw new CloudError('validation', 'Check constraint violated on tpl_bad');
        }
        return {
          id: item.id,
          user_id: userA.ownerId,
          name: item.name,
          exercises: item.exercises,
          client_updated_at: item.clientUpdatedAt,
          deleted_at: null,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:05Z',
        };
      });

      const result = await engine.push(userA);

      expect(result.quarantinedCount).toBe(1);
      expect(result.pushedCount).toBe(1);

      // Bad template is quarantined with 'error' status
      const metaBad = await syncMetadataStore.getRecord('template', 'tpl_bad', userA);
      expect(metaBad?.syncStatus).toBe('error');

      // Good template is successfully synced
      const metaGood = await syncMetadataStore.getRecord('template', 'tpl_good', userA);
      expect(metaGood?.syncStatus).toBe('synced');
    });
  });

  describe('6. Idempotency & Concurrency Protection', () => {
    it('19. repeated push is idempotent', async () => {
      const workout: WorkoutSession = {
        id: 'w_idempotent',
        name: 'Idempotency Workout',
        startedAt: '2026-09-01T10:00:00Z',
        finishedAt: '2026-09-01T11:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(workout, userA);
      await syncMetadataStore.markPendingUpload('workout', 'w_idempotent', '2026-09-01T11:00:00Z', userA);

      // First push
      const firstResult = await engine.push(userA);
      expect(firstResult.status).toBe('success');
      expect(firstResult.pushedCount).toBe(1);

      // Second push (no changes)
      const secondResult = await engine.push(userA);
      expect(secondResult.status).toBe('success');
      expect(secondResult.pushedCount).toBe(0);
      expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalledTimes(1); // Not called on 2nd pass
    });

    it('20. concurrent push calls are serialized / coalesced', async () => {
      const workout: WorkoutSession = {
        id: 'w_concurrent',
        name: 'Concurrent Workout',
        startedAt: '2026-09-01T10:00:00Z',
        finishedAt: '2026-09-01T11:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(workout, userA);
      await syncMetadataStore.markPendingUpload('workout', 'w_concurrent', '2026-09-01T11:00:00Z', userA);

      // Make first push take some time in upsertBatch
      let resolveFirstPush: any;
      const deferred = new Promise((resolve) => {
        resolveFirstPush = resolve;
      });
      mockWorkoutCloud.upsertBatch.mockReturnValueOnce(deferred);

      const pushPromise1 = engine.push(userA);

      // Tick event loop past reconcileLocalEntities to ensure isPushing is active
      await new Promise((resolve) => setTimeout(resolve, 20));

      const pushPromise2 = engine.push(userA); // Called concurrently while 1 is in-flight
      const result2 = await pushPromise2;
      expect(result2.status).toBe('busy');

      resolveFirstPush([
        {
          id: 'w_concurrent',
          user_id: userA.ownerId,
          name: 'Concurrent Workout',
          started_at: '2026-09-01T10:00:00Z',
          finished_at: '2026-09-01T11:00:00Z',
          status: 'completed',
          total_duration: 3600,
          total_volume: 5000,
          completed_sets_count: 10,
          exercises: [],
          client_updated_at: '2026-09-01T11:00:00Z',
          deleted_at: null,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T12:00:05Z',
        },
      ]);

      const result1 = await pushPromise1;
      expect(result1.status).toBe('success');
      expect(result1.pushedCount).toBe(1);
    });
  });
});
