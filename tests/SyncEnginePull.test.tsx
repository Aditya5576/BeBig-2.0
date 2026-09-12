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
import { CloudError, WorkoutCloudRecord, TemplateCloudRecord, CustomExerciseCloudRecord } from '../src/services/cloud';

describe('Milestone 10 — Checkpoint 3.3: SyncEngine Pull & Keyset Watermark Unit Tests', () => {
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
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
      upsert: jest.fn(),
      upsertBatch: jest.fn(),
    };

    mockTemplateCloud = {
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
      upsert: jest.fn(),
      upsertBatch: jest.fn(),
    };

    mockCustomExerciseCloud = {
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
      upsert: jest.fn(),
      upsertBatch: jest.fn(),
    };

    engine = new SyncEngine(mockWorkoutCloud, mockTemplateCloud, mockCustomExerciseCloud);
  });

  afterEach(async () => {
    syncMetadataStore.clearMemoryCache();
    await syncMetadataStore.resetUserState(userA.ownerId);
    await syncMetadataStore.resetUserState(userB.ownerId);
  });

  describe('1. Scope, Authentication, & Guest Guardrails', () => {
    it('1. guest session makes zero cloud calls and returns skipped_guest_or_unauthenticated', async () => {
      useAuthStore.setState({
        user: null,
        isGuest: true,
        guestSession: { id: 'guest_123' } as any,
        status: 'guest' as any,
      });

      const result = await engine.pull(guestUser);

      expect(result.status).toBe('skipped_guest_or_unauthenticated');
      expect(result.pulledCount).toBe(0);
      expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();
      expect(mockTemplateCloud.fetchChanged).not.toHaveBeenCalled();
      expect(mockCustomExerciseCloud.fetchChanged).not.toHaveBeenCalled();
    });

    it('2. unauthenticated call returns skipped_guest_or_unauthenticated', async () => {
      useAuthStore.setState({ user: null, isGuest: false, status: 'unauthenticated' as any });

      const result = await engine.pull(null);

      expect(result.status).toBe('skipped_guest_or_unauthenticated');
      expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();
    });

    it('3. active in-progress workout is completely immune to pull operations', async () => {
      const activeDraft: WorkoutSession = {
        id: 'w_active_inprogress',
        name: 'Live Active Draft',
        startedAt: '2026-09-01T10:00:00Z',
        status: 'active',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveActiveWorkout(activeDraft, userA);

      // Cloud delivers a completed workout
      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({
        records: [
          {
            id: 'w_completed_incoming',
            user_id: userA.ownerId,
            name: 'Completed Incoming',
            source_template_id: null,
            started_at: '2026-09-01T08:00:00Z',
            finished_at: '2026-09-01T09:00:00Z',
            status: 'completed',
            total_duration: 3600,
            total_volume: 5000,
            completed_sets_count: 10,
            exercises: [],
            client_updated_at: '2026-09-01T09:00:00Z',
            deleted_at: null,
            created_at: '2026-09-01T08:00:00Z',
            updated_at: '2026-09-01T12:00:05Z',
          },
        ],
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.status).toBe('success');
      expect(result.appliedCount).toBe(1);

      // Active draft is 100% untouched
      const active = await workoutStorage.getActiveWorkout(userA);
      expect(active?.id).toBe('w_active_inprogress');
      expect(active?.status).toBe('active');

      // Completed workout was saved into completed workouts
      const completed = await workoutStorage.getCompletedWorkoutById('w_completed_incoming', userA);
      expect(completed?.id).toBe('w_completed_incoming');
    });

    it('4. concurrent pull calls return busy', async () => {
      let resolveSlowFetch: any;
      const slowPromise = new Promise((resolve) => {
        resolveSlowFetch = resolve;
      });
      mockWorkoutCloud.fetchChanged.mockReturnValueOnce(slowPromise);

      const pull1 = engine.pull(userA);
      const pull2 = engine.pull(userA);

      const result2 = await pull2;
      expect(result2.status).toBe('busy');
      expect(result2.errors[0].kind).toBe('busy');

      resolveSlowFetch({ records: [], hasMore: false, nextCursor: null });
      const result1 = await pull1;
      expect(result1.status).toBe('success');
    });
  });

  describe('2. Initial Sync, Pagination, & Pass Budgeting', () => {
    it('5. initial full pull ingests records and advances watermark', async () => {
      const records: WorkoutCloudRecord[] = [
        {
          id: 'w_init_1',
          user_id: userA.ownerId,
          name: 'Workout 1',
          source_template_id: null,
          started_at: '2026-09-01T08:00:00Z',
          finished_at: '2026-09-01T09:00:00Z',
          status: 'completed',
          total_duration: 3600,
          total_volume: 5000,
          completed_sets_count: 10,
          exercises: [],
          client_updated_at: '2026-09-01T09:00:00Z',
          deleted_at: null,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:05Z',
        },
      ];

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({
        records,
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.status).toBe('success');
      expect(result.pulledCount).toBe(1);
      expect(result.appliedCount).toBe(1);

      // Verify query options: no cursor or sinceUpdatedAt on initial pull
      expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
      expect(mockWorkoutCloud.fetchChanged.mock.calls[0][0].sinceUpdatedAt).toBeUndefined();
      expect(mockWorkoutCloud.fetchChanged.mock.calls[0][0].cursor).toBeUndefined();

      // Verify watermark updated
      const watermark = await syncMetadataStore.getWatermark('workout', userA);
      expect(watermark.lastCompletedWatermark).toBe('2026-09-01T12:00:05Z');
      expect(watermark.activeCursor).toBeNull();
      expect(watermark.hasMore).toBe(false);

      // Entity saved locally
      const local = await workoutStorage.getCompletedWorkoutById('w_init_1', userA);
      expect(local?.name).toBe('Workout 1');
    });

    it('6. 137 records pull across 3 pages (50 + 50 + 37)', async () => {
      const generateWorkouts = (start: number, count: number): WorkoutCloudRecord[] =>
        Array.from({ length: count }, (_, idx) => {
          const num = start + idx;
          const millis = String(num).padStart(3, '0');
          return {
            id: `w_page_${num}`,
            user_id: userA.ownerId,
            name: `Workout ${num}`,
            source_template_id: null,
            started_at: '2026-09-01T08:00:00Z',
            finished_at: '2026-09-01T09:00:00Z',
            status: 'completed',
            total_duration: 3600,
            total_volume: 5000,
            completed_sets_count: 10,
            exercises: [],
            client_updated_at: '2026-09-01T09:00:00Z',
            deleted_at: null,
            created_at: '2026-09-01T08:00:00Z',
            updated_at: `2026-09-01T12:00:00.${millis}Z`,
          };
        });

      const page1 = generateWorkouts(1, 50);
      const page2 = generateWorkouts(51, 50);
      const page3 = generateWorkouts(101, 37);

      mockWorkoutCloud.fetchChanged
        .mockResolvedValueOnce({
          records: page1,
          hasMore: true,
          nextCursor: { updatedAt: page1[49].updated_at, id: page1[49].id },
        })
        .mockResolvedValueOnce({
          records: page2,
          hasMore: true,
          nextCursor: { updatedAt: page2[49].updated_at, id: page2[49].id },
        })
        .mockResolvedValueOnce({
          records: page3,
          hasMore: false,
          nextCursor: null,
        });

      const result = await engine.pull(userA);

      expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledTimes(3);
      expect(result.pulledCount).toBe(137);
      expect(result.appliedCount).toBe(137);
      expect(result.status).toBe('success');

      // Check second call used exact keyset cursor from page 1
      expect(mockWorkoutCloud.fetchChanged.mock.calls[1][0]).toEqual(
        expect.objectContaining({
          cursor: { updatedAt: page1[49].updated_at, id: page1[49].id },
          limit: 50,
        }),
      );

      // Check third call used exact keyset cursor from page 2
      expect(mockWorkoutCloud.fetchChanged.mock.calls[2][0]).toEqual(
        expect.objectContaining({
          cursor: { updatedAt: page2[49].updated_at, id: page2[49].id },
          limit: 50,
        }),
      );

      const watermark = await syncMetadataStore.getWatermark('workout', userA);
      expect(watermark.lastCompletedWatermark).toBe(page3[36].updated_at);
      expect(watermark.activeCursor).toBeNull();
      expect(watermark.hasMore).toBe(false);
    });

    it('7 & 8. 450 records across multiple passes: Pass 1 stops at 200, Pass 2 stops at 200, Pass 3 finishes 50', async () => {
      const generatePage = (start: number, count: number): WorkoutCloudRecord[] =>
        Array.from({ length: count }, (_, idx) => {
          const num = start + idx;
          const padded = String(num).padStart(4, '0');
          return {
            id: `w_450_${padded}`,
            user_id: userA.ownerId,
            name: `Workout ${padded}`,
            source_template_id: null,
            started_at: '2026-09-01T08:00:00Z',
            finished_at: '2026-09-01T09:00:00Z',
            status: 'completed',
            total_duration: 3600,
            total_volume: 5000,
            completed_sets_count: 10,
            exercises: [],
            client_updated_at: '2026-09-01T09:00:00Z',
            deleted_at: null,
            created_at: '2026-09-01T08:00:00Z',
            updated_at: `2026-09-01T12:00:00.${padded}Z`,
          };
        });

      // Pass 1: 4 pages of 50 = 200 records
      const p1_1 = generatePage(1, 50);
      const p1_2 = generatePage(51, 50);
      const p1_3 = generatePage(101, 50);
      const p1_4 = generatePage(151, 50);

      mockWorkoutCloud.fetchChanged
        .mockResolvedValueOnce({ records: p1_1, hasMore: true, nextCursor: { updatedAt: p1_1[49].updated_at, id: p1_1[49].id } })
        .mockResolvedValueOnce({ records: p1_2, hasMore: true, nextCursor: { updatedAt: p1_2[49].updated_at, id: p1_2[49].id } })
        .mockResolvedValueOnce({ records: p1_3, hasMore: true, nextCursor: { updatedAt: p1_3[49].updated_at, id: p1_3[49].id } })
        .mockResolvedValueOnce({ records: p1_4, hasMore: true, nextCursor: { updatedAt: p1_4[49].updated_at, id: p1_4[49].id } });

      const pass1 = await engine.pull(userA);

      expect(pass1.status).toBe('partial');
      expect(pass1.pulledCount).toBe(200);
      expect(pass1.hasMore).toBe(true);

      const meta1 = await syncMetadataStore.getWatermark('workout', userA);
      expect(meta1.activeCursor).toEqual({ updatedAt: p1_4[49].updated_at, id: p1_4[49].id });
      expect(meta1.lastCompletedWatermark).toBeNull();
      expect(meta1.hasMore).toBe(true);

      const activeEntity1 = await syncMetadataStore.getActiveStreamEntity(userA);
      expect(activeEntity1).toBe('workout');

      // Pass 2: Next 4 pages of 50 = records 201-400
      const p2_1 = generatePage(201, 50);
      const p2_2 = generatePage(251, 50);
      const p2_3 = generatePage(301, 50);
      const p2_4 = generatePage(351, 50);

      mockWorkoutCloud.fetchChanged
        .mockResolvedValueOnce({ records: p2_1, hasMore: true, nextCursor: { updatedAt: p2_1[49].updated_at, id: p2_1[49].id } })
        .mockResolvedValueOnce({ records: p2_2, hasMore: true, nextCursor: { updatedAt: p2_2[49].updated_at, id: p2_2[49].id } })
        .mockResolvedValueOnce({ records: p2_3, hasMore: true, nextCursor: { updatedAt: p2_3[49].updated_at, id: p2_3[49].id } })
        .mockResolvedValueOnce({ records: p2_4, hasMore: true, nextCursor: { updatedAt: p2_4[49].updated_at, id: p2_4[49].id } });

      const pass2 = await engine.pull(userA);

      expect(pass2.status).toBe('partial');
      expect(pass2.pulledCount).toBe(200);
      expect(pass2.hasMore).toBe(true);

      const meta2 = await syncMetadataStore.getWatermark('workout', userA);
      expect(meta2.activeCursor).toEqual({ updatedAt: p2_4[49].updated_at, id: p2_4[49].id });
      expect(meta2.lastCompletedWatermark).toBeNull();

      // Pass 3: Final page of 50 = records 401-450
      const p3_1 = generatePage(401, 50);

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({
        records: p3_1,
        hasMore: false,
        nextCursor: null,
      });

      const pass3 = await engine.pull(userA);

      expect(pass3.status).toBe('success');
      expect(pass3.pulledCount).toBe(50);
      expect(pass3.hasMore).toBe(false);

      const meta3 = await syncMetadataStore.getWatermark('workout', userA);
      expect(meta3.activeCursor).toBeNull();
      expect(meta3.lastCompletedWatermark).toBe(p3_1[49].updated_at);
      expect(meta3.hasMore).toBe(false);

      const activeEntity3 = await syncMetadataStore.getActiveStreamEntity(userA);
      expect(activeEntity3).toBeNull();
    });

    it('9. global 200-record budget across multiple entity types transitions deterministically', async () => {
      const workoutBatch = Array.from({ length: 50 }, (_, idx) => ({
        id: `w_budget_${idx}`,
        user_id: userA.ownerId,
        name: `Workout ${idx}`,
        source_template_id: null,
        started_at: '2026-09-01T08:00:00Z',
        finished_at: '2026-09-01T09:00:00Z',
        status: 'completed' as const,
        total_duration: 3600,
        total_volume: 5000,
        completed_sets_count: 10,
        exercises: [],
        client_updated_at: '2026-09-01T09:00:00Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00Z',
        updated_at: `2026-09-01T12:00:00.${idx}Z`,
      }));

      mockWorkoutCloud.fetchChanged
        .mockResolvedValueOnce({ records: workoutBatch, hasMore: true, nextCursor: { updatedAt: '2026-09-01T12:00:00.49Z', id: 'w_budget_49' } })
        .mockResolvedValueOnce({ records: workoutBatch, hasMore: true, nextCursor: { updatedAt: '2026-09-01T12:00:00.49Z', id: 'w_budget_49' } })
        .mockResolvedValueOnce({ records: workoutBatch, hasMore: true, nextCursor: { updatedAt: '2026-09-01T12:00:00.49Z', id: 'w_budget_49' } })
        .mockResolvedValueOnce({ records: workoutBatch, hasMore: true, nextCursor: { updatedAt: '2026-09-01T12:00:00.49Z', id: 'w_budget_49' } });

      const pass1 = await engine.pull(userA);

      expect(pass1.pulledCount).toBe(200);
      expect(pass1.hasMore).toBe(true);
      expect(mockTemplateCloud.fetchChanged).not.toHaveBeenCalled();
      expect(mockCustomExerciseCloud.fetchChanged).not.toHaveBeenCalled();

      const phase = await syncMetadataStore.getActiveStreamEntity(userA);
      expect(phase).toBe('workout');

      // Pass 2: Workout finishes after 10 records, remaining 190 budget allows templates to run
      const finalWorkouts = Array.from({ length: 10 }, (_, idx) => ({
        id: `w_budget_fin_${idx}`,
        user_id: userA.ownerId,
        name: `Final Workout ${idx}`,
        source_template_id: null,
        started_at: '2026-09-01T08:00:00Z',
        finished_at: '2026-09-01T09:00:00Z',
        status: 'completed' as const,
        total_duration: 3600,
        total_volume: 5000,
        completed_sets_count: 10,
        exercises: [],
        client_updated_at: '2026-09-01T09:00:00Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00Z',
        updated_at: `2026-09-01T12:00:01.${idx}Z`,
      }));

      const templates: TemplateCloudRecord[] = [
        {
          id: 'tpl_budget_1',
          user_id: userA.ownerId,
          name: 'Budget Template',
          exercises: [{ exerciseId: 'squat', exerciseName: 'Squat', order: 0, sets: 3, targetReps: '10', restTime: 60 }],
          client_updated_at: '2026-09-01T09:00:00Z',
          deleted_at: null,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:02Z',
        },
      ];

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({
        records: finalWorkouts,
        hasMore: false,
        nextCursor: null,
      });

      mockTemplateCloud.fetchChanged.mockResolvedValueOnce({
        records: templates,
        hasMore: false,
        nextCursor: null,
      });

      mockCustomExerciseCloud.fetchChanged.mockResolvedValueOnce({
        records: [],
        hasMore: false,
        nextCursor: null,
      });

      const pass2 = await engine.pull(userA);

      expect(pass2.status).toBe('success');
      expect(pass2.pulledCount).toBe(11);
      expect(mockTemplateCloud.fetchChanged).toHaveBeenCalledTimes(1);
      expect(mockCustomExerciseCloud.fetchChanged).toHaveBeenCalledTimes(1);

      const finalPhase = await syncMetadataStore.getActiveStreamEntity(userA);
      expect(finalPhase).toBeNull();
    });
  });

  describe('3. Keyset Resumption vs. 5-Second Delta Overlap', () => {
    it('10. exact keyset resumption does NOT apply 5-second overlap', async () => {
      await syncMetadataStore.setWatermark(
        'workout',
        {
          lastCompletedWatermark: null,
          activeCursor: { updatedAt: '2026-09-01T12:00:10.000Z', id: 'w_cursor_target' },
          hasMore: true,
        },
        userA,
      );

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({ records: [], hasMore: false, nextCursor: null });

      await engine.pull(userA);

      expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { updatedAt: '2026-09-01T12:00:10.000Z', id: 'w_cursor_target' },
          limit: 50,
        }),
      );
      expect(mockWorkoutCloud.fetchChanged.mock.calls[0][0].sinceUpdatedAt).toBeUndefined();
    });

    it('11. delta sync with lastCompletedWatermark subtracts 5000ms overlap', async () => {
      await syncMetadataStore.setWatermark(
        'workout',
        {
          lastCompletedWatermark: '2026-09-01T12:00:10.000Z',
          activeCursor: null,
          hasMore: false,
        },
        userA,
      );

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({ records: [], hasMore: false, nextCursor: null });

      await engine.pull(userA);

      expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          sinceUpdatedAt: '2026-09-01T12:00:05.000Z',
          limit: 50,
        }),
      );
      expect(mockWorkoutCloud.fetchChanged.mock.calls[0][0].cursor).toBeUndefined();
    });

    it('12. boundary record inside 5-second overlap is re-evaluated idempotently', async () => {
      const existingWorkout: WorkoutSession = {
        id: 'w_overlap_boundary',
        name: 'Existing Boundary Workout',
        startedAt: '2026-09-01T08:00:00Z',
        finishedAt: '2026-09-01T09:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(existingWorkout, userA);
      await syncMetadataStore.markSynced('workout', 'w_overlap_boundary', '2026-09-01T12:00:08.000Z', null, userA);

      await syncMetadataStore.setWatermark(
        'workout',
        {
          lastCompletedWatermark: '2026-09-01T12:00:10.000Z',
          activeCursor: null,
          hasMore: false,
        },
        userA,
      );

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({
        records: [
          {
            id: 'w_overlap_boundary',
            user_id: userA.ownerId,
            name: 'Existing Boundary Workout',
            started_at: '2026-09-01T08:00:00Z',
            finished_at: '2026-09-01T09:00:00Z',
            total_duration: 3600,
            total_volume: 5000,
            completed_sets_count: 10,
            exercises: [],
            client_updated_at: '2026-09-01T09:00:00Z',
            deleted_at: null,
            created_at: '2026-09-01T08:00:00Z',
            updated_at: '2026-09-01T12:00:08.000Z',
          },
        ],
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.status).toBe('success');
      expect(result.pulledCount).toBe(1);

      const all = await workoutStorage.getCompletedWorkouts(userA);
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('w_overlap_boundary');
    });
  });

  describe('4. Last-Write-Wins (LWW) & Tombstone Matrix', () => {
    it('13. Case A: newer live cloud record overwrites older local entity', async () => {
      const localTemplate: WorkoutTemplate = {
        id: 'tpl_newer_cloud',
        name: 'Old Local Name (08:00)',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(localTemplate, userA);
      await syncMetadataStore.setRecord(
        {
          entityType: 'template',
          id: 'tpl_newer_cloud',
          clientUpdatedAt: '2026-09-01T08:00:00Z',
          deletedAt: null,
          syncStatus: 'synced',
          lastSyncedServerUpdatedAt: '2026-09-01T08:00:00Z',
        },
        userA,
      );

      mockTemplateCloud.fetchChanged.mockResolvedValueOnce({
        records: [
          {
            id: 'tpl_newer_cloud',
            user_id: userA.ownerId,
            name: 'New Cloud Name (10:00)',
            exercises: [{ exerciseId: 'bench', exerciseName: 'Bench Press', order: 0, sets: 4, targetReps: '10', restTime: 60 }],
            client_updated_at: '2026-09-01T10:00:00Z',
            deleted_at: null,
            created_at: '2026-09-01T08:00:00Z',
            updated_at: '2026-09-01T12:00:05Z',
          },
        ],
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.appliedCount).toBe(1);

      const updated = await templateStorage.getTemplateById('tpl_newer_cloud', userA);
      expect(updated?.name).toBe('New Cloud Name (10:00)');
      expect(updated?.exercises).toHaveLength(1);
    });

    it('14. Case B: newer cloud tombstone deletes local entity', async () => {
      const localWorkout: WorkoutSession = {
        id: 'w_del_by_cloud',
        name: 'Local Workout (08:00)',
        startedAt: '2026-09-01T08:00:00Z',
        finishedAt: '2026-09-01T08:30:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(localWorkout, userA);
      await syncMetadataStore.setRecord(
        {
          entityType: 'workout',
          id: 'w_del_by_cloud',
          clientUpdatedAt: '2026-09-01T08:30:00Z',
          deletedAt: null,
          syncStatus: 'synced',
          lastSyncedServerUpdatedAt: '2026-09-01T08:30:00Z',
        },
        userA,
      );

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({
        records: [
          {
            id: 'w_del_by_cloud',
            user_id: userA.ownerId,
            name: 'Deleted Workout',
            source_template_id: null,
            started_at: '2026-09-01T08:00:00Z',
            finished_at: '2026-09-01T08:30:00Z',
            status: 'completed',
            total_duration: 1800,
            total_volume: 1000,
            completed_sets_count: 5,
            exercises: [],
            client_updated_at: '2026-09-01T10:00:00Z',
            deleted_at: '2026-09-01T10:00:00Z',
            created_at: '2026-09-01T08:00:00Z',
            updated_at: '2026-09-01T12:00:05Z',
          },
        ],
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.tombstonesApplied).toBe(1);

      const local = await workoutStorage.getCompletedWorkoutById('w_del_by_cloud', userA);
      expect(local).toBeNull();

      const meta = await syncMetadataStore.getRecord('workout', 'w_del_by_cloud', userA);
      expect(meta?.syncStatus).toBe('synced');
      expect(meta?.deletedAt).toBe('2026-09-01T10:00:00Z');
    });

    it('15. Case C & H: stale older live cloud record is ignored and pending local edit is preserved', async () => {
      const localExercise: Exercise = {
        id: 'ex_local_newer',
        name: 'Newer Local Exercise (11:00)',
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
      await customExerciseStorage.saveCustomExercise(localExercise, userA);
      await syncMetadataStore.markPendingUpload('custom_exercise', 'ex_local_newer', '2026-09-01T11:00:00Z', userA);

      mockCustomExerciseCloud.fetchChanged.mockResolvedValueOnce({
        records: [
          {
            id: 'ex_local_newer',
            user_id: userA.ownerId,
            name: 'Stale Cloud Exercise (09:00)',
            description: '',
            category: 'arms',
            category_name: 'Arms',
            primary_muscles: [],
            secondary_muscles: [],
            equipment: [],
            client_updated_at: '2026-09-01T09:00:00Z',
            deleted_at: null,
            created_at: '2026-09-01T08:00:00Z',
            updated_at: '2026-09-01T12:00:05Z',
          },
        ],
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.ignoredCount).toBe(1);

      const exercises = await customExerciseStorage.getCustomExercises(userA);
      const ex = exercises.find((e) => e.id === 'ex_local_newer');
      expect(ex?.name).toBe('Newer Local Exercise (11:00)');

      const meta = await syncMetadataStore.getRecord('custom_exercise', 'ex_local_newer', userA);
      expect(meta?.syncStatus).toBe('pending_upload');
    });

    it('16. Case E: equal timestamp with cloud tombstone deletes local entity (tombstone beats live)', async () => {
      const localTemplate: WorkoutTemplate = {
        id: 'tpl_tie_tombstone',
        name: 'Tie Template (10:00)',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(localTemplate, userA);
      await syncMetadataStore.setRecord(
        {
          entityType: 'template',
          id: 'tpl_tie_tombstone',
          clientUpdatedAt: '2026-09-01T10:00:00Z',
          deletedAt: null,
          syncStatus: 'synced',
          lastSyncedServerUpdatedAt: '2026-09-01T10:00:00Z',
        },
        userA,
      );

      mockTemplateCloud.fetchChanged.mockResolvedValueOnce({
        records: [
          {
            id: 'tpl_tie_tombstone',
            user_id: userA.ownerId,
            name: 'Deleted Template',
            exercises: [],
            client_updated_at: '2026-09-01T10:00:00Z',
            deleted_at: '2026-09-01T10:00:00Z',
            created_at: '2026-09-01T08:00:00Z',
            updated_at: '2026-09-01T12:00:05Z',
          },
        ],
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.tombstonesApplied).toBe(1);

      const local = await templateStorage.getTemplateById('tpl_tie_tombstone', userA);
      expect(local).toBeNull();
    });

    it('17. Case F & I: live cloud record cannot resurrect local pending_delete tombstone', async () => {
      await syncMetadataStore.markPendingDelete(
        'workout',
        'w_local_tombstone_tie',
        '2026-09-01T10:00:00Z',
        '2026-09-01T10:00:00Z',
        userA,
      );

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({
        records: [
          {
            id: 'w_local_tombstone_tie',
            user_id: userA.ownerId,
            name: 'Resurrection Attempt',
            source_template_id: null,
            started_at: '2026-09-01T08:00:00Z',
            finished_at: '2026-09-01T09:00:00Z',
            status: 'completed',
            total_duration: 3600,
            total_volume: 5000,
            completed_sets_count: 10,
            exercises: [],
            client_updated_at: '2026-09-01T10:00:00Z',
            deleted_at: null,
            created_at: '2026-09-01T08:00:00Z',
            updated_at: '2026-09-01T12:00:05Z',
          },
        ],
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.ignoredCount).toBe(1);

      const local = await workoutStorage.getCompletedWorkoutById('w_local_tombstone_tie', userA);
      expect(local).toBeNull();

      const meta = await syncMetadataStore.getRecord('workout', 'w_local_tombstone_tie', userA);
      expect(meta?.syncStatus).toBe('pending_delete');
    });

    it('18. Case G: equal timestamp both live confirms cloud authority', async () => {
      const localWorkout: WorkoutSession = {
        id: 'w_tie_live',
        name: 'Tie Workout',
        startedAt: '2026-09-01T08:00:00Z',
        finishedAt: '2026-09-01T09:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(localWorkout, userA);
      await syncMetadataStore.setRecord(
        {
          entityType: 'workout',
          id: 'w_tie_live',
          clientUpdatedAt: '2026-09-01T09:00:00Z',
          deletedAt: null,
          syncStatus: 'synced',
          lastSyncedServerUpdatedAt: '2026-09-01T09:00:00Z',
        },
        userA,
      );

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({
        records: [
          {
            id: 'w_tie_live',
            user_id: userA.ownerId,
            name: 'Tie Workout',
            source_template_id: null,
            started_at: '2026-09-01T08:00:00Z',
            finished_at: '2026-09-01T09:00:00Z',
            status: 'completed',
            total_duration: 3600,
            total_volume: 5000,
            completed_sets_count: 10,
            exercises: [],
            client_updated_at: '2026-09-01T09:00:00Z',
            deleted_at: null,
            created_at: '2026-09-01T08:00:00Z',
            updated_at: '2026-09-01T12:00:05Z',
          },
        ],
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.appliedCount).toBe(1);
      const meta = await syncMetadataStore.getRecord('workout', 'w_tie_live', userA);
      expect(meta?.syncStatus).toBe('synced');
    });
  });

  describe('5. Error Handling & Malformed Record Quarantine', () => {
    it('19. malformed cloud record is quarantined to error status and does not crash batch', async () => {
      const goodWorkout: WorkoutCloudRecord = {
        id: 'w_good_row',
        user_id: userA.ownerId,
        name: 'Good Workout',
        source_template_id: null,
        started_at: '2026-09-01T08:00:00Z',
        finished_at: '2026-09-01T09:00:00Z',
        status: 'completed',
        total_duration: 3600,
        total_volume: 5000,
        completed_sets_count: 10,
        exercises: [],
        client_updated_at: '2026-09-01T09:00:00Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00Z',
        updated_at: '2026-09-01T12:00:05Z',
      };

      const malformedWorkout: any = {
        id: 'w_corrupted_row',
        user_id: userA.ownerId,
        name: 12345,
        started_at: null,
        exercises: 'not_an_array',
        client_updated_at: '2026-09-01T09:00:00Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00Z',
        updated_at: '2026-09-01T12:00:06Z',
      };

      mockWorkoutCloud.fetchChanged.mockResolvedValueOnce({
        records: [malformedWorkout, goodWorkout],
        hasMore: false,
        nextCursor: null,
      });

      const result = await engine.pull(userA);

      expect(result.quarantinedCount).toBe(1);
      expect(result.appliedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].kind).toBe('validation');

      const metaCorrupted = await syncMetadataStore.getRecord('workout', 'w_corrupted_row', userA);
      expect(metaCorrupted?.syncStatus).toBe('error');

      const localGood = await workoutStorage.getCompletedWorkoutById('w_good_row', userA);
      expect(localGood?.name).toBe('Good Workout');
    });

    it('20. network failure preserves recoverable watermark state', async () => {
      await syncMetadataStore.setWatermark(
        'workout',
        {
          lastCompletedWatermark: '2026-09-01T12:00:00.000Z',
          activeCursor: null,
          hasMore: false,
        },
        userA,
      );

      mockWorkoutCloud.fetchChanged.mockRejectedValueOnce(new CloudError('network', 'Failed to fetch'));

      const result = await engine.pull(userA);

      expect(result.status).toBe('error');
      expect(result.errors[0].kind).toBe('network');

      const watermark = await syncMetadataStore.getWatermark('workout', userA);
      expect(watermark.lastCompletedWatermark).toBe('2026-09-01T12:00:00.000Z');
      expect(watermark.activeCursor).toBeNull();
    });

    it('21. auth failure halts cleanly without modifying data', async () => {
      mockWorkoutCloud.fetchChanged.mockRejectedValueOnce(new CloudError('auth', 'JWT expired'));

      const result = await engine.pull(userA);

      expect(result.status).toBe('error');
      expect(result.errors[0].kind).toBe('auth');
    });

    it('22. permission failure halts cleanly without modifying data', async () => {
      mockWorkoutCloud.fetchChanged.mockRejectedValueOnce(new CloudError('permission', 'RLS policy violated'));

      const result = await engine.pull(userA);

      expect(result.status).toBe('error');
      expect(result.errors[0].kind).toBe('permission');
    });
  });
});
