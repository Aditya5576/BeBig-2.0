import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { templateRepository } from '../src/features/templates/services/templateRepository';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { SyncEngine } from '../src/services/sync/syncEngine';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { syncLifecycleManager } from '../src/services/sync/syncLifecycleManager';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import {
  WorkoutCloudService,
  TemplateCloudService,
  CustomExerciseCloudService,
  CloudError,
} from '../src/services/cloud';
import { useAuthStore } from '../src/features/auth';
import { UserScope } from '../src/features/auth/types';
import { WorkoutSession } from '../src/features/workout/types';
import { WorkoutTemplate } from '../src/features/templates/types';
import { Exercise } from '../src/features/exercises/types';

describe('Milestone 10 — Critical Delete / Tombstone Resurrection Tests', () => {
  const userA: UserScope = { ownerId: 'usr_alpha_tomb', ownerType: 'authenticated' };
  const userB: UserScope = { ownerId: 'usr_beta_tomb', ownerType: 'authenticated' };
  const guestUser: UserScope = { ownerId: 'guest_tomb', ownerType: 'guest' };

  let mockSupabase: any;
  let mockFrom: jest.Mock;
  let mockQueryBuilder: any;
  let activeSessionUser: { id: string; email: string } | null;

  let workoutCloud: WorkoutCloudService;
  let templateCloud: TemplateCloudService;
  let customExerciseCloud: CustomExerciseCloudService;
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

    activeSessionUser = { id: userA.ownerId, email: 'alpha@bebig.app' };

    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockImplementation((rows: any | any[]) => {
        const isArray = Array.isArray(rows);
        const list = isArray ? rows : [rows];
        const returned = list.map((r: any) => ({
          ...r,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:05Z',
        }));
        return {
          select: jest.fn().mockResolvedValue({
            data: isArray ? returned : returned[0],
            error: null,
          }),
        };
      }),
      update: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };

    mockFrom = jest.fn().mockReturnValue(mockQueryBuilder);

    mockSupabase = {
      auth: {
        getSession: jest.fn(async () => {
          if (!activeSessionUser) {
            return { data: { session: null }, error: null };
          }
          return {
            data: {
              session: {
                user: activeSessionUser,
                access_token: 'fake_jwt_token',
              },
            },
            error: null,
          };
        }),
      },
      from: mockFrom,
    };

    workoutCloud = new WorkoutCloudService(mockSupabase);
    templateCloud = new TemplateCloudService(mockSupabase);
    customExerciseCloud = new CustomExerciseCloudService(mockSupabase);

    engine = new SyncEngine(workoutCloud, templateCloud, customExerciseCloud);
    syncLifecycleManager.setSyncEngine(engine);

    jest.spyOn(syncLifecycleManager, 'triggerSync').mockImplementation(async () => ({} as any));

    exerciseRepository.setProvider({
      providerId: 'mock-provider',
      listExercises: jest.fn().mockResolvedValue({
        exercises: [],
        totalCount: 0,
        hasMore: false,
        nextOffset: null,
      }),
      getExerciseById: jest.fn().mockResolvedValue(null),
      searchExercises: jest.fn().mockResolvedValue({
        exercises: [],
        totalCount: 0,
        hasMore: false,
        nextOffset: null,
      }),
    });

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

  // --------------------------------------------------------------------------
  // 1, 2, 3: ENTITY DELETION CREATES PENDING TOMBSTONE
  // --------------------------------------------------------------------------

  it('1. workout deletion creates pending tombstone', async () => {
    const session: WorkoutSession = {
      id: 'w_synced_1',
      name: 'Synced Push Day',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.setRecord(
      {
        entityType: 'workout',
        id: 'w_synced_1',
        clientUpdatedAt: '2026-09-01T09:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T09:05:00Z',
      },
      userA,
    );

    await workoutRepository.deleteCompletedWorkout('w_synced_1', userA);

    // Entity removed from local entity storage
    const local = await workoutStorage.getCompletedWorkoutById('w_synced_1', userA);
    expect(local).toBeNull();

    // Durable pending_delete tombstone exists
    const meta = await syncMetadataStore.getRecord('workout', 'w_synced_1', userA);
    expect(meta).not.toBeNull();
    expect(meta?.syncStatus).toBe('pending_delete');
    expect(meta?.deletedAt).toBeTruthy();
    expect(meta?.lastSyncedServerUpdatedAt).toBe('2026-09-01T09:05:00Z');
  });

  it('2. template deletion creates pending tombstone', async () => {
    const template: WorkoutTemplate = {
      id: 't_synced_1',
      name: 'Leg Day Routine',
      exercises: [],
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await templateStorage.saveTemplate(template, userA);
    await syncMetadataStore.setRecord(
      {
        entityType: 'template',
        id: 't_synced_1',
        clientUpdatedAt: '2026-09-01T08:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T08:05:00Z',
      },
      userA,
    );

    await templateRepository.deleteTemplate('t_synced_1', userA);

    const local = await templateStorage.getTemplateById('t_synced_1', userA);
    expect(local).toBeNull();

    const meta = await syncMetadataStore.getRecord('template', 't_synced_1', userA);
    expect(meta).not.toBeNull();
    expect(meta?.syncStatus).toBe('pending_delete');
    expect(meta?.deletedAt).toBeTruthy();
    expect(meta?.lastSyncedServerUpdatedAt).toBe('2026-09-01T08:05:00Z');
  });

  it('3. custom exercise deletion creates pending tombstone', async () => {
    const exercise: Exercise = {
      id: 'custom_synced_1',
      name: 'Incline Cable Fly',
      description: 'Upper chest fly',
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
    await customExerciseStorage.saveCustomExercise(exercise, userA);
    await syncMetadataStore.setRecord(
      {
        entityType: 'custom_exercise',
        id: 'custom_synced_1',
        clientUpdatedAt: '2026-09-01T08:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T08:05:00Z',
      },
      userA,
    );

    await exerciseRepository.deleteCustomExercise('custom_synced_1', userA);

    const customs = await customExerciseStorage.getCustomExercises(userA);
    expect(customs.find((c) => c.id === 'custom_synced_1')).toBeUndefined();

    const meta = await syncMetadataStore.getRecord('custom_exercise', 'custom_synced_1', userA);
    expect(meta).not.toBeNull();
    expect(meta?.syncStatus).toBe('pending_delete');
    expect(meta?.deletedAt).toBeTruthy();
    expect(meta?.lastSyncedServerUpdatedAt).toBe('2026-09-01T08:05:00Z');
  });

  // --------------------------------------------------------------------------
  // 4, 14: OFFLINE DELETE & APP RESTART SURVIVAL
  // --------------------------------------------------------------------------

  it('4 & 14. offline delete survives app restart and retains pending_delete', async () => {
    const session: WorkoutSession = {
      id: 'w_offline_del_1',
      name: 'Offline Delete Workout',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.setRecord(
      {
        entityType: 'workout',
        id: 'w_offline_del_1',
        clientUpdatedAt: '2026-09-01T09:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T09:05:00Z',
      },
      userA,
    );

    // User deletes while offline
    await workoutRepository.deleteCompletedWorkout('w_offline_del_1', userA);

    // Simulate app force-close / restart
    syncMetadataStore.clearMemoryCache();
    workoutStorage.clearMemoryCache();

    // Verify state after reload
    const local = await workoutStorage.getCompletedWorkoutById('w_offline_del_1', userA);
    expect(local).toBeNull();

    const meta = await syncMetadataStore.getRecord('workout', 'w_offline_del_1', userA);
    expect(meta?.syncStatus).toBe('pending_delete');
    expect(meta?.deletedAt).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 5: FAILED CLOUD DELETE REMAINS PENDING (NO FALSE SYNC / ERROR CONVERSION)
  // --------------------------------------------------------------------------

  it('5. failed cloud delete remains pending_delete on network/auth failure', async () => {
    await syncMetadataStore.markPendingDelete(
      'workout',
      'w_fail_cloud_1',
      '2026-09-01T10:00:00Z',
      '2026-09-01T10:00:00Z',
      userA,
    );

    // Simulate network transport failure
    mockQueryBuilder.upsert.mockImplementationOnce(() => {
      throw new CloudError('network', 'Failed to connect to Supabase (503 Service Unavailable).');
    });

    const result = await engine.push(userA);

    expect(result.status).toBe('error');
    expect(result.errors[0].kind).toBe('network');

    // Status MUST remain pending_delete so it can retry later
    const meta = await syncMetadataStore.getRecord('workout', 'w_fail_cloud_1', userA);
    expect(meta?.syncStatus).toBe('pending_delete');
    expect(meta?.deletedAt).toBe('2026-09-01T10:00:00Z');
  });

  // --------------------------------------------------------------------------
  // 6: SUCCESSFUL CLOUD TOMBSTONE BECOMES SYNCED
  // --------------------------------------------------------------------------

  it('6. successful cloud tombstone becomes synced', async () => {
    await syncMetadataStore.markPendingDelete(
      'workout',
      'w_push_del_1',
      '2026-09-01T10:00:00Z',
      '2026-09-01T10:00:00Z',
      userA,
    );

    const result = await engine.push(userA);

    expect(result.status).toBe('success');
    expect(result.pushedCount).toBe(1);

    // Verify row sent with soft-delete payload
    expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'w_push_del_1',
          deleted_at: '2026-09-01T10:00:00Z',
        }),
      ]),
      { onConflict: 'id' },
    );

    // Local metadata transitions to synced with deletedAt preserved
    const meta = await syncMetadataStore.getRecord('workout', 'w_push_del_1', userA);
    expect(meta?.syncStatus).toBe('synced');
    expect(meta?.deletedAt).toBeTruthy();
    expect(meta?.lastSyncedServerUpdatedAt).toBeTruthy();
  });

  // --------------------------------------------------------------------------
  // 7, 8: CLOUD TOMBSTONE & LOCAL TOMBSTONE PREVENTS RESURRECTION
  // --------------------------------------------------------------------------

  it('7. cloud tombstone prevents resurrection during pull', async () => {
    // Record is synced tombstone locally
    await syncMetadataStore.setRecord(
      {
        entityType: 'workout',
        id: 'w_no_resurrect',
        clientUpdatedAt: '2026-09-01T10:00:00Z',
        deletedAt: '2026-09-01T10:00:00Z',
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T10:05:00Z',
      },
      userA,
    );

    // Cloud returns tombstone record
    mockQueryBuilder.order.mockReturnThis();
    mockQueryBuilder.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'w_no_resurrect',
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
          updated_at: '2026-09-01T12:00:00Z',
        },
      ],
      error: null,
    });

    const result = await engine.pull(userA);

    expect(result.tombstonesApplied).toBe(1);
    expect(result.appliedCount).toBe(0);

    const local = await workoutStorage.getCompletedWorkoutById('w_no_resurrect', userA);
    expect(local).toBeNull();
  });

  it('8. delete + pull race does not resurrect when cloud is still live with older timestamp', async () => {
    // Device A deleted workout locally at 10:00 (pending_delete)
    await syncMetadataStore.markPendingDelete(
      'workout',
      'w_race_del_1',
      '2026-09-01T10:00:00Z',
      '2026-09-01T10:00:00Z',
      userA,
    );

    // Pull fetches older live cloud record (created at 08:00, updated at 08:30)
    mockQueryBuilder.order.mockReturnThis();
    mockQueryBuilder.limit.mockResolvedValueOnce({
      data: [
        {
          id: 'w_race_del_1',
          user_id: userA.ownerId,
          name: 'Old Live Workout',
          started_at: '2026-09-01T08:00:00Z',
          finished_at: '2026-09-01T08:30:00Z',
          status: 'completed',
          total_duration: 1800,
          total_volume: 2000,
          completed_sets_count: 5,
          exercises: [],
          client_updated_at: '2026-09-01T08:30:00Z',
          deleted_at: null,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T08:30:00Z',
        },
      ],
      error: null,
    });

    const result = await engine.pull(userA);

    // Older live cloud record is ignored because local has newer tombstone (10:00 > 08:30)
    expect(result.ignoredCount).toBe(1);
    expect(result.appliedCount).toBe(0);

    // Workout is NOT resurrected
    const local = await workoutStorage.getCompletedWorkoutById('w_race_del_1', userA);
    expect(local).toBeNull();

    // Local tombstone remains pending_delete
    const meta = await syncMetadataStore.getRecord('workout', 'w_race_del_1', userA);
    expect(meta?.syncStatus).toBe('pending_delete');
  });

  // --------------------------------------------------------------------------
  // 9: DELETE + EDIT FOLLOWS EXISTING LWW RULES
  // --------------------------------------------------------------------------

  describe('9. delete + edit LWW conflict matrix', () => {
    it('9A: newer cloud tombstone beats older local edit', async () => {
      // Local edited at 10:00
      const localTemplate: WorkoutTemplate = {
        id: 't_lww_1',
        name: 'Local Routine (10:00)',
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
          id: 't_lww_1',
          clientUpdatedAt: '2026-09-01T10:00:00Z',
          deletedAt: null,
          syncStatus: 'pending_upload',
          lastSyncedServerUpdatedAt: '2026-09-01T08:05:00Z',
        },
        userA,
      );

      // Cloud pulled has newer tombstone at 11:00
      mockQueryBuilder.order.mockReturnThis();
      // First call is workouts (empty), second call is templates
      mockQueryBuilder.limit
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({
          data: [
            {
              id: 't_lww_1',
              user_id: userA.ownerId,
              name: 'Deleted Routine',
              exercises: [],
              client_updated_at: '2026-09-01T11:00:00Z',
              deleted_at: '2026-09-01T11:00:00Z',
              created_at: '2026-09-01T08:00:00Z',
              updated_at: '2026-09-01T12:00:00Z',
            },
          ],
          error: null,
        });

      const result = await engine.pull(userA);

      expect(result.tombstonesApplied).toBe(1);

      const local = await templateStorage.getTemplateById('t_lww_1', userA);
      expect(local).toBeNull();

      const meta = await syncMetadataStore.getRecord('template', 't_lww_1', userA);
      expect(meta?.syncStatus).toBe('synced');
      expect(meta?.deletedAt).toBe('2026-09-01T11:00:00Z');
    });

    it('9B: newer local live edit beats older cloud tombstone', async () => {
      // Local edited at 12:00
      const localTemplate: WorkoutTemplate = {
        id: 't_lww_2',
        name: 'Resurrected Routine (12:00)',
        exercises: [],
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T12:00:00Z',
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await templateStorage.saveTemplate(localTemplate, userA);
      await syncMetadataStore.setRecord(
        {
          entityType: 'template',
          id: 't_lww_2',
          clientUpdatedAt: '2026-09-01T12:00:00Z',
          deletedAt: null,
          syncStatus: 'pending_upload',
          lastSyncedServerUpdatedAt: '2026-09-01T08:05:00Z',
        },
        userA,
      );

      // Cloud has older tombstone at 10:00
      mockQueryBuilder.order.mockReturnThis();
      mockQueryBuilder.limit
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({
          data: [
            {
              id: 't_lww_2',
              user_id: userA.ownerId,
              name: 'Deleted Routine (10:00)',
              exercises: [],
              client_updated_at: '2026-09-01T10:00:00Z',
              deleted_at: '2026-09-01T10:00:00Z',
              created_at: '2026-09-01T08:00:00Z',
              updated_at: '2026-09-01T10:05:00Z',
            },
          ],
          error: null,
        });

      const result = await engine.pull(userA);

      // Older cloud tombstone is ignored; newer local live edit wins
      expect(result.ignoredCount).toBe(1);

      const local = await templateStorage.getTemplateById('t_lww_2', userA);
      expect(local?.name).toBe('Resurrected Routine (12:00)');

      const meta = await syncMetadataStore.getRecord('template', 't_lww_2', userA);
      expect(meta?.syncStatus).toBe('pending_upload');
    });

    it('9C: once cloud tombstone is established, older edit push cannot resurrect it', async () => {
      // Local attempts to push older edit (09:00) for a workout
      const session: WorkoutSession = {
        id: 'w_lww_3',
        name: 'Stale Edit Workout (09:00)',
        startedAt: '2026-09-01T08:00:00Z',
        finishedAt: '2026-09-01T09:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(session, userA);
      await syncMetadataStore.setRecord(
        {
          entityType: 'workout',
          id: 'w_lww_3',
          clientUpdatedAt: '2026-09-01T09:00:00Z',
          deletedAt: null,
          syncStatus: 'pending_upload',
        },
        userA,
      );

      // Cloud already has a newer tombstone at 11:00
      mockQueryBuilder.upsert.mockImplementationOnce(() => ({
        select: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'w_lww_3',
              user_id: userA.ownerId,
              name: 'Deleted Workout',
              started_at: '2026-09-01T08:00:00Z',
              finished_at: '2026-09-01T09:00:00Z',
              status: 'completed',
              total_duration: 3600,
              total_volume: 0,
              completed_sets_count: 0,
              exercises: [],
              client_updated_at: '2026-09-01T11:00:00Z',
              deleted_at: '2026-09-01T11:00:00Z',
              created_at: '2026-09-01T08:00:00Z',
              updated_at: '2026-09-01T12:00:00Z',
            },
          ],
          error: null,
        }),
      }));

      const result = await engine.push(userA);

      expect(result.status).toBe('success');
      expect(result.reconciledCount).toBe(1);

      // Local storage must now be deleted by cloud tombstone authority
      const local = await workoutStorage.getCompletedWorkoutById('w_lww_3', userA);
      expect(local).toBeNull();

      // Local metadata becomes synced tombstone
      const meta = await syncMetadataStore.getRecord('workout', 'w_lww_3', userA);
      expect(meta?.syncStatus).toBe('synced');
      expect(meta?.deletedAt).toBe('2026-09-01T11:00:00Z');
    });
  });

  // --------------------------------------------------------------------------
  // 10: DOUBLE DELETE IS IDEMPOTENT
  // --------------------------------------------------------------------------

  it('10. double delete is idempotent, does not crash, and does not duplicate tombstones', async () => {
    const session: WorkoutSession = {
      id: 'w_double_del_1',
      name: 'Double Delete Workout',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.setRecord(
      {
        entityType: 'workout',
        id: 'w_double_del_1',
        clientUpdatedAt: '2026-09-01T09:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T09:05:00Z',
      },
      userA,
    );

    // Delete 1
    await workoutRepository.deleteCompletedWorkout('w_double_del_1', userA);
    // Delete 2
    await workoutRepository.deleteCompletedWorkout('w_double_del_1', userA);

    // Restart
    syncMetadataStore.clearMemoryCache();
    workoutStorage.clearMemoryCache();

    // Verify exactly one pending record exists
    const pending = await syncMetadataStore.getPendingRecords('workout', userA);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe('w_double_del_1');

    // Sync
    const result = await engine.push(userA);
    expect(result.status).toBe('success');
    expect(result.pushedCount).toBe(1);
    expect(mockQueryBuilder.upsert).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // 11: CREATE -> DELETE BEFORE FIRST UPLOAD IS SAFE (NO UNNECESSARY TOMBSTONE)
  // --------------------------------------------------------------------------

  it('11. create -> delete before first upload removes pending upload and never sends cloud tombstone', async () => {
    // 1. Create workout locally (never synced to cloud)
    const session: WorkoutSession = {
      id: 'w_unsynced_del_1',
      name: 'Unsynced Local Workout',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.markPendingUpload('workout', 'w_unsynced_del_1', '2026-09-01T09:00:00Z', userA);

    // Verify pending_upload with NO lastSyncedServerUpdatedAt
    const preMeta = await syncMetadataStore.getRecord('workout', 'w_unsynced_del_1', userA);
    expect(preMeta?.syncStatus).toBe('pending_upload');
    expect(preMeta?.lastSyncedServerUpdatedAt).toBeUndefined();

    // 2. Delete before first upload
    await workoutRepository.deleteCompletedWorkout('w_unsynced_del_1', userA);

    // 3. Local entity is gone and metadata record was removed
    const local = await workoutStorage.getCompletedWorkoutById('w_unsynced_del_1', userA);
    expect(local).toBeNull();
    const postMeta = await syncMetadataStore.getRecord('workout', 'w_unsynced_del_1', userA);
    expect(postMeta).toBeNull();

    // 4. App restarts
    syncMetadataStore.clearMemoryCache();
    workoutStorage.clearMemoryCache();

    // 5. Sync runs
    const pushResult = await engine.push(userA);

    expect(pushResult.status).toBe('success');
    expect(pushResult.pushedCount).toBe(0);
    // Zero upsert calls to Supabase!
    expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 12: GUEST DELETION MAKES ZERO CLOUD CALLS
  // --------------------------------------------------------------------------

  it('12. guest deletion makes zero cloud calls and remains strictly local', async () => {
    useAuthStore.setState({
      user: null,
      isGuest: true,
      status: 'authenticated',
    });

    const session: WorkoutSession = {
      id: 'w_guest_1',
      name: 'Guest Workout',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: guestUser.ownerId,
      ownerType: 'guest',
    };
    await workoutStorage.saveCompletedWorkout(session, guestUser);

    await workoutRepository.deleteCompletedWorkout('w_guest_1', guestUser);

    const local = await workoutStorage.getCompletedWorkoutById('w_guest_1', guestUser);
    expect(local).toBeNull();

    // Metadata store is null for guests
    const meta = await syncMetadataStore.getRecord('workout', 'w_guest_1', guestUser);
    expect(meta).toBeNull();

    // Zero cloud calls
    expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
    expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 13: USER ISOLATION
  // --------------------------------------------------------------------------

  it('13. User A deletion cannot affect User B', async () => {
    // User A has a synced workout
    const sessionA: WorkoutSession = {
      id: 'w_shared_id_1',
      name: 'User A Session',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(sessionA, userA);
    await syncMetadataStore.setRecord(
      {
        entityType: 'workout',
        id: 'w_shared_id_1',
        clientUpdatedAt: '2026-09-01T09:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T09:05:00Z',
      },
      userA,
    );

    // User B has a separate workout with different ID
    const sessionB: WorkoutSession = {
      id: 'w_user_b_safe',
      name: 'User B Safe Session',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userB.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(sessionB, userB);
    await syncMetadataStore.setRecord(
      {
        entityType: 'workout',
        id: 'w_user_b_safe',
        clientUpdatedAt: '2026-09-01T09:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T09:05:00Z',
      },
      userB,
    );

    // User A deletes their workout
    await workoutRepository.deleteCompletedWorkout('w_shared_id_1', userA);

    // User B data is completely intact
    const localB = await workoutStorage.getCompletedWorkoutById('w_user_b_safe', userB);
    expect(localB).not.toBeNull();
    expect(localB?.name).toBe('User B Safe Session');

    const metaB = await syncMetadataStore.getRecord('workout', 'w_user_b_safe', userB);
    expect(metaB?.syncStatus).toBe('synced');
    expect(metaB?.deletedAt).toBeNull();

    // User B has zero metadata for User A's deleted workout
    const metaBforA = await syncMetadataStore.getRecord('workout', 'w_shared_id_1', userB);
    expect(metaBforA).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 15: RETRY AFTER NETWORK RECOVERY SUCCEEDS
  // --------------------------------------------------------------------------

  it('15. retry after network recovery succeeds and transitions pending_delete to synced', async () => {
    await syncMetadataStore.markPendingDelete(
      'workout',
      'w_recovery_test_1',
      '2026-09-01T10:00:00Z',
      '2026-09-01T10:00:00Z',
      userA,
    );

    // Pass 1: Offline / Network Error
    mockQueryBuilder.upsert.mockImplementationOnce(() => {
      throw new CloudError('network', 'Connection reset by peer.');
    });
    const pass1Result = await engine.push(userA);
    expect(pass1Result.status).toBe('error');

    let meta = await syncMetadataStore.getRecord('workout', 'w_recovery_test_1', userA);
    expect(meta?.syncStatus).toBe('pending_delete');

    // Pass 2: Online recovery
    mockQueryBuilder.upsert.mockImplementationOnce((rows: any[]) => ({
      select: jest.fn().mockResolvedValue({
        data: rows.map((r) => ({
          ...r,
          created_at: '2026-09-01T08:00:00Z',
          updated_at: '2026-09-01T12:00:00Z',
        })),
        error: null,
      }),
    }));

    const pass2Result = await engine.push(userA);
    expect(pass2Result.status).toBe('success');
    expect(pass2Result.pushedCount).toBe(1);

    meta = await syncMetadataStore.getRecord('workout', 'w_recovery_test_1', userA);
    expect(meta?.syncStatus).toBe('synced');
    expect(meta?.deletedAt).toBe('2026-09-01T10:00:00Z');
  });

  // --------------------------------------------------------------------------
  // 16: DELETED RECORD IS NOT RETURNED TO NORMAL LOCAL UI
  // --------------------------------------------------------------------------

  it('16. deleted records are not returned to normal local UI queries', async () => {
    // 16A: Workout
    const w: WorkoutSession = {
      id: 'w_ui_check_1',
      name: 'UI Test Workout',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(w, userA);
    await syncMetadataStore.setRecord(
      {
        entityType: 'workout',
        id: 'w_ui_check_1',
        clientUpdatedAt: '2026-09-01T09:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T09:05:00Z',
      },
      userA,
    );

    await workoutRepository.deleteCompletedWorkout('w_ui_check_1', userA);
    const workouts = await workoutRepository.getCompletedWorkouts();
    expect(workouts.find((item) => item.id === 'w_ui_check_1')).toBeUndefined();
    const singleW = await workoutRepository.getCompletedWorkoutById('w_ui_check_1');
    expect(singleW).toBeNull();

    // 16B: Template
    const t: WorkoutTemplate = {
      id: 't_ui_check_1',
      name: 'UI Test Template',
      exercises: [],
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await templateStorage.saveTemplate(t, userA);
    await syncMetadataStore.setRecord(
      {
        entityType: 'template',
        id: 't_ui_check_1',
        clientUpdatedAt: '2026-09-01T08:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T08:05:00Z',
      },
      userA,
    );

    await templateRepository.deleteTemplate('t_ui_check_1', userA);
    const templates = await templateRepository.getTemplates();
    expect(templates.find((item) => item.id === 't_ui_check_1')).toBeUndefined();
    const singleT = await templateRepository.getTemplateById('t_ui_check_1');
    expect(singleT).toBeNull();

    // 16C: Custom Exercise
    const e: Exercise = {
      id: 'custom_ui_check_1',
      name: 'UI Test Exercise',
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
    await customExerciseStorage.saveCustomExercise(e, userA);
    await syncMetadataStore.setRecord(
      {
        entityType: 'custom_exercise',
        id: 'custom_ui_check_1',
        clientUpdatedAt: '2026-09-01T08:00:00Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedServerUpdatedAt: '2026-09-01T08:05:00Z',
      },
      userA,
    );

    await exerciseRepository.deleteCustomExercise('custom_ui_check_1', userA);
    const exResult = await exerciseRepository.getExercises();
    expect(exResult.exercises.find((item) => item.id === 'custom_ui_check_1')).toBeUndefined();
    const singleE = await exerciseRepository.getExerciseById('custom_ui_check_1');
    expect(singleE).toBeNull();
  });
});
