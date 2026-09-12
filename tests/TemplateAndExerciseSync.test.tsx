import { templateRepository } from '../src/features/templates/services/templateRepository';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { SyncEngine } from '../src/services/sync/syncEngine';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { syncLifecycleManager } from '../src/services/sync/syncLifecycleManager';
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

describe('Milestone 10 — Fix #3: Templates & Custom Exercises CRUD Sync Integration', () => {
  const userA: UserScope = { ownerId: 'usr_alpha_crud', ownerType: 'authenticated' };
  const userB: UserScope = { ownerId: 'usr_beta_crud', ownerType: 'authenticated' };
  const guestUser: UserScope = { ownerId: 'guest_crud', ownerType: 'guest' };

  let mockSupabase: any;
  let mockFrom: jest.Mock;
  let mockQueryBuilder: any;
  let activeSessionUser: { id: string; email: string } | null;

  let workoutCloud: WorkoutCloudService;
  let templateCloud: TemplateCloudService;
  let customExerciseCloud: CustomExerciseCloudService;
  let engine: SyncEngine;
  let triggerSyncSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    syncMetadataStore.clearMemoryCache();
    templateStorage.clearMemoryCache();
    customExerciseStorage.clearMemoryCache();

    await syncMetadataStore.resetUserState(userA.ownerId);
    await syncMetadataStore.resetUserState(userB.ownerId);
    await templateStorage.clearTemplates(userA);
    await templateStorage.clearTemplates(userB);
    await templateStorage.clearTemplates(guestUser);
    await customExerciseStorage.clearCustomExercises(userA);
    await customExerciseStorage.clearCustomExercises(userB);
    await customExerciseStorage.clearCustomExercises(guestUser);

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
          created_at: r.created_at || '2026-09-01T08:00:00Z',
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

    triggerSyncSpy = jest.spyOn(syncLifecycleManager, 'triggerSync').mockImplementation(async () => ({} as any));

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
  // 1. AUTHENTICATED TEMPLATE CREATION
  // --------------------------------------------------------------------------
  it('1. authenticated template creation: local save -> pending_upload -> sync trigger', async () => {
    const template = await templateRepository.createTemplate(
      {
        name: 'Upper Body Power',
        exercises: [
          {
            exerciseId: 'bench_press',
            exerciseName: 'Bench Press',
            categoryName: 'Chest',
            sets: 4,
            targetReps: '6-8',
            restTime: 120,
            targetWeight: 80,
          },
        ],
      },
      userA,
    );

    // 1. Local entity is safely saved
    const savedLocal = await templateStorage.getTemplateById(template.id, userA);
    expect(savedLocal).not.toBeNull();
    expect(savedLocal?.name).toBe('Upper Body Power');

    // 2. Sync metadata is stamped pending_upload with template timestamp
    const meta = await syncMetadataStore.getRecord('template', template.id, userA);
    expect(meta).not.toBeNull();
    expect(meta?.syncStatus).toBe('pending_upload');
    expect(meta?.clientUpdatedAt).toBe(template.updatedAt);
    expect(meta?.deletedAt).toBeNull();

    // 3. Fire-and-forget sync trigger called with reason 'template_saved'
    expect(triggerSyncSpy).toHaveBeenCalledWith({
      reason: 'template_saved',
      scope: userA,
    });
  });

  // --------------------------------------------------------------------------
  // 2. AUTHENTICATED TEMPLATE UPDATE
  // --------------------------------------------------------------------------
  it('2. authenticated template update: local update -> pending_upload with latest timestamp -> sync trigger', async () => {
    const created = await templateRepository.createTemplate(
      {
        name: 'Initial Push Day',
        exercises: [
          {
            exerciseId: 'bench_press',
            exerciseName: 'Bench Press',
            categoryName: 'Chest',
            sets: 3,
            targetReps: '10',
            restTime: 90,
          },
        ],
      },
      userA,
    );

    triggerSyncSpy.mockClear();

    // Small delay to ensure timestamp progression
    await new Promise((r) => setTimeout(r, 10));

    const updated = await templateRepository.updateTemplate(
      {
        id: created.id,
        name: 'Updated Push Day Heavy',
      },
      userA,
    );

    // 1. Local entity updated
    const savedLocal = await templateStorage.getTemplateById(created.id, userA);
    expect(savedLocal?.name).toBe('Updated Push Day Heavy');
    expect(savedLocal?.id).toBe(created.id); // Stable ID

    // 2. Sync metadata updated with newest timestamp
    const meta = await syncMetadataStore.getRecord('template', created.id, userA);
    expect(meta?.syncStatus).toBe('pending_upload');
    expect(meta?.clientUpdatedAt).toBe(updated.updatedAt);
    expect(new Date(meta!.clientUpdatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime(),
    );

    // 3. Sync trigger fired with 'template_saved'
    expect(triggerSyncSpy).toHaveBeenCalledWith({
      reason: 'template_saved',
      scope: userA,
    });
  });

  // --------------------------------------------------------------------------
  // 3. AUTHENTICATED CUSTOM EXERCISE CREATION
  // --------------------------------------------------------------------------
  it('3. authenticated custom exercise creation: local save -> pending_upload -> sync trigger', async () => {
    const exercise = await exerciseRepository.createCustomExercise(
      {
        name: 'JM Press',
        description: 'Hybrid tricep press',
        category: 'arms',
        primaryMuscles: ['Triceps'],
        secondaryMuscles: ['Chest'],
        equipment: ['Barbell'],
      },
      userA,
    );

    // 1. Local entity safely saved
    const customs = await customExerciseStorage.getCustomExercises(userA);
    const savedLocal = customs.find((e) => e.id === exercise.id);
    expect(savedLocal).toBeDefined();
    expect(savedLocal?.name).toBe('JM Press');
    expect(savedLocal?.isCustom).toBe(true);

    // 2. Sync metadata stamped pending_upload
    const meta = await syncMetadataStore.getRecord('custom_exercise', exercise.id, userA);
    expect(meta).not.toBeNull();
    expect(meta?.syncStatus).toBe('pending_upload');
    expect(meta?.clientUpdatedAt).toBe(exercise.updatedAt);

    // 3. Sync trigger fired with 'custom_exercise_saved'
    expect(triggerSyncSpy).toHaveBeenCalledWith({
      reason: 'custom_exercise_saved',
      scope: userA,
    });
  });

  // --------------------------------------------------------------------------
  // 4. AUTHENTICATED CUSTOM EXERCISE UPDATE
  // --------------------------------------------------------------------------
  it('4. authenticated custom exercise update: local update -> pending_upload with latest timestamp -> sync trigger', async () => {
    const created = await exerciseRepository.createCustomExercise(
      {
        name: 'Floor Press',
        description: 'Chest press from floor',
        category: 'chest',
        primaryMuscles: ['Chest'],
        equipment: ['Barbell'],
      },
      userA,
    );

    triggerSyncSpy.mockClear();

    await new Promise((r) => setTimeout(r, 10));

    const updated = await exerciseRepository.updateCustomExercise(
      {
        id: created.id,
        name: 'Floor Press (Close Grip)',
        description: 'Tricep emphasis',
        primaryMuscles: ['Triceps', 'Chest'],
      },
      userA,
    );

    // 1. Local entity updated
    const customs = await customExerciseStorage.getCustomExercises(userA);
    const savedLocal = customs.find((e) => e.id === created.id);
    expect(savedLocal?.name).toBe('Floor Press (Close Grip)');
    expect(savedLocal?.description).toBe('Tricep emphasis');
    expect(savedLocal?.primaryMuscles.map((m) => m.name)).toEqual(['Triceps', 'Chest']);

    // 2. Metadata updated with newest mutation timestamp
    const meta = await syncMetadataStore.getRecord('custom_exercise', created.id, userA);
    expect(meta?.syncStatus).toBe('pending_upload');
    expect(meta?.clientUpdatedAt).toBe(updated.updatedAt);

    // 3. Sync trigger fired with 'custom_exercise_saved'
    expect(triggerSyncSpy).toHaveBeenCalledWith({
      reason: 'custom_exercise_saved',
      scope: userA,
    });
  });

  // --------------------------------------------------------------------------
  // 5. GUEST TEMPLATE CREATE/UPDATE: STRICTLY LOCAL
  // --------------------------------------------------------------------------
  it('5. guest template create/update: local-only, zero cloud/sync metadata behavior', async () => {
    useAuthStore.setState({ user: null, isGuest: true, status: 'guest' });

    const created = await templateRepository.createTemplate(
      {
        name: 'Guest Full Body',
        exercises: [
          {
            exerciseId: 'squat',
            exerciseName: 'Squat',
            categoryName: 'Legs',
            sets: 3,
            targetReps: '5',
            restTime: 180,
          },
        ],
      },
      guestUser,
    );

    // Saved locally for guest
    const savedGuest = await templateStorage.getTemplateById(created.id, guestUser);
    expect(savedGuest).not.toBeNull();

    // Zero metadata created
    const meta = await syncMetadataStore.getRecord('template', created.id, guestUser);
    expect(meta).toBeNull();

    // Zero sync triggers
    expect(triggerSyncSpy).not.toHaveBeenCalled();

    // Guest update
    const updated = await templateRepository.updateTemplate(
      {
        id: created.id,
        name: 'Guest Full Body (Edited)',
      },
      guestUser,
    );

    expect(updated.name).toBe('Guest Full Body (Edited)');
    const metaAfterUpdate = await syncMetadataStore.getRecord('template', created.id, guestUser);
    expect(metaAfterUpdate).toBeNull();
    expect(triggerSyncSpy).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 6. GUEST CUSTOM EXERCISE CREATE/UPDATE: STRICTLY LOCAL
  // --------------------------------------------------------------------------
  it('6. guest custom exercise create/update: local-only, zero cloud/sync metadata behavior', async () => {
    useAuthStore.setState({ user: null, isGuest: true, status: 'guest' });

    const created = await exerciseRepository.createCustomExercise(
      {
        name: 'Guest Exercise',
        category: 'arms',
        primaryMuscles: ['Biceps'],
      },
      guestUser,
    );

    const customs = await customExerciseStorage.getCustomExercises(guestUser);
    expect(customs.find((e) => e.id === created.id)).toBeDefined();

    // Zero metadata created
    const meta = await syncMetadataStore.getRecord('custom_exercise', created.id, guestUser);
    expect(meta).toBeNull();
    expect(triggerSyncSpy).not.toHaveBeenCalled();

    // Guest update
    await exerciseRepository.updateCustomExercise(
      {
        id: created.id,
        name: 'Guest Exercise (Renamed)',
      },
      guestUser,
    );

    const updatedCustoms = await customExerciseStorage.getCustomExercises(guestUser);
    expect(updatedCustoms.find((e) => e.id === created.id)?.name).toBe('Guest Exercise (Renamed)');
    const metaAfterUpdate = await syncMetadataStore.getRecord('custom_exercise', created.id, guestUser);
    expect(metaAfterUpdate).toBeNull();
    expect(triggerSyncSpy).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 7. OFFLINE CREATE/UPDATE SURVIVES AND REMAINS PENDING
  // --------------------------------------------------------------------------
  it('7. offline create/update: local mutation survives and remains pending', async () => {
    triggerSyncSpy.mockClear();
    jest.spyOn(templateCloud, 'upsertBatch').mockRejectedValue(new CloudError('network', 'Network unavailable'));
    jest.spyOn(customExerciseCloud, 'upsertBatch').mockRejectedValue(new CloudError('network', 'Network unavailable'));

    const tpl = await templateRepository.createTemplate(
      {
        name: 'Offline Template',
        exercises: [
          {
            exerciseId: 'row',
            exerciseName: 'Barbell Row',
            categoryName: 'Back',
            sets: 3,
            targetReps: '8',
            restTime: 90,
          },
        ],
      },
      userA,
    );

    const ex = await exerciseRepository.createCustomExercise(
      {
        name: 'Offline Exercise',
        category: 'back',
        primaryMuscles: ['Lats'],
      },
      userA,
    );

    // Both local entities exist
    expect(await templateStorage.getTemplateById(tpl.id, userA)).not.toBeNull();
    const customs = await customExerciseStorage.getCustomExercises(userA);
    expect(customs.find((e) => e.id === ex.id)).toBeDefined();

    // Trigger was requested
    expect(triggerSyncSpy).toHaveBeenCalled();

    // Attempt sync
    const pushResult = await engine.push(userA);
    expect(pushResult.status).toBe('error');

    // Both remain pending_upload locally
    const tplMeta = await syncMetadataStore.getRecord('template', tpl.id, userA);
    expect(tplMeta?.syncStatus).toBe('pending_upload');

    const exMeta = await syncMetadataStore.getRecord('custom_exercise', ex.id, userA);
    expect(exMeta?.syncStatus).toBe('pending_upload');
  });

  // --------------------------------------------------------------------------
  // 8. CLOUD FAILURE: PENDING STATE RETAINED FOR RETRY
  // --------------------------------------------------------------------------
  it('8. cloud failure: pending state is retained and retried successfully later', async () => {
    triggerSyncSpy.mockClear();

    // Cloud fails initially with server error
    const upsertSpy = jest
      .spyOn(templateCloud, 'upsertBatch')
      .mockRejectedValueOnce(new CloudError('unknown', 'Internal 500 server error'));

    const tpl = await templateRepository.createTemplate(
      {
        name: 'Retry Template',
        exercises: [
          {
            exerciseId: 'dip',
            exerciseName: 'Dips',
            categoryName: 'Arms',
            sets: 3,
            targetReps: '10',
            restTime: 60,
          },
        ],
      },
      userA,
    );

    // Sync fails
    const failResult = await engine.push(userA);
    expect(failResult.status).toBe('error');

    // Metadata is preserved pending_upload
    let meta = await syncMetadataStore.getRecord('template', tpl.id, userA);
    expect(meta?.syncStatus).toBe('pending_upload');

    // Network / cloud recovers
    upsertSpy.mockImplementation(async (payloads: any[]) => {
      return payloads.map((p) => ({
        id: p.id,
        user_id: userA.ownerId,
        name: p.name,
        exercises: p.exercises,
        client_updated_at: p.clientUpdatedAt,
        created_at: '2026-09-01T08:00:00Z',
        updated_at: '2026-09-01T12:00:10Z',
        deleted_at: null,
      }));
    });

    const successResult = await engine.push(userA);
    expect(successResult.status).toBe('success');
    expect(successResult.pushedCount).toBe(1);

    // Transitions to synced
    meta = await syncMetadataStore.getRecord('template', tpl.id, userA);
    expect(meta?.syncStatus).toBe('synced');
    expect(meta?.lastSyncedServerUpdatedAt).toBe('2026-09-01T12:00:10Z');
  });

  // --------------------------------------------------------------------------
  // 9. METADATA FAILURE AFTER LOCAL SAVE: RECOVERY SCANNER RECONSTRUCTS
  // --------------------------------------------------------------------------
  it('9. metadata failure after successful local save: local entity remains intact and recovery scanning can reconstruct pending upload', async () => {
    // Spy on markPendingUpload to throw an error, simulating storage crash during metadata write
    const metaSpy = jest
      .spyOn(syncMetadataStore, 'markPendingUpload')
      .mockRejectedValueOnce(new Error('AsyncStorage disk full'));

    const tpl = await templateRepository.createTemplate(
      {
        name: 'Crash Resilient Template',
        exercises: [
          {
            exerciseId: 'curl',
            exerciseName: 'Bicep Curl',
            categoryName: 'Arms',
            sets: 3,
            targetReps: '12',
            restTime: 60,
          },
        ],
      },
      userA,
    );

    metaSpy.mockRestore();

    // 1. Local entity is intact despite metadata error
    const savedLocal = await templateStorage.getTemplateById(tpl.id, userA);
    expect(savedLocal).not.toBeNull();
    expect(savedLocal?.name).toBe('Crash Resilient Template');

    // 2. Metadata was NOT written due to the crash
    let meta = await syncMetadataStore.getRecord('template', tpl.id, userA);
    expect(meta).toBeNull();

    // 3. Crash recovery scanner runs (as executed before push or during app startup)
    const scanResult = await syncMetadataStore.reconcileLocalEntities(userA);
    expect(scanResult.repairedMissingMetadata).toBeGreaterThanOrEqual(1);

    // 4. Metadata is restored as pending_upload with the template's timestamp
    meta = await syncMetadataStore.getRecord('template', tpl.id, userA);
    expect(meta).not.toBeNull();
    expect(meta?.syncStatus).toBe('pending_upload');
    expect(meta?.clientUpdatedAt).toBe(tpl.updatedAt);
  });

  // --------------------------------------------------------------------------
  // 10. RAPID CONSECUTIVE UPDATES: STABLE ID, LATEST STATE & TIMESTAMP
  // --------------------------------------------------------------------------
  it('10. rapid consecutive updates: stable ID + newest local state + newest pending mutation timestamp', async () => {
    // Create template
    const tpl = await templateRepository.createTemplate(
      {
        name: 'Version 1',
        exercises: [
          {
            exerciseId: 'pushup',
            exerciseName: 'Pushup',
            categoryName: 'Chest',
            sets: 3,
            targetReps: '15',
            restTime: 60,
          },
        ],
      },
      userA,
    );

    // Rapid update 1
    await new Promise((r) => setTimeout(r, 10));
    await templateRepository.updateTemplate(
      {
        id: tpl.id,
        name: 'Version 2',
      },
      userA,
    );

    // Rapid update 2
    await new Promise((r) => setTimeout(r, 10));
    const v3 = await templateRepository.updateTemplate(
      {
        id: tpl.id,
        name: 'Version 3 (Final)',
      },
      userA,
    );

    // Exactly one template in storage with stable ID and final name
    const allTemplates = await templateStorage.getTemplates(userA);
    const matching = allTemplates.filter((t) => t.id === tpl.id);
    expect(matching).toHaveLength(1);
    expect(matching[0].name).toBe('Version 3 (Final)');

    // Exactly one metadata record with latest timestamp
    const meta = await syncMetadataStore.getRecord('template', tpl.id, userA);
    expect(meta?.syncStatus).toBe('pending_upload');
    expect(meta?.clientUpdatedAt).toBe(v3.updatedAt);

    // Exactly one pending record in getPendingRecords
    const pending = await syncMetadataStore.getPendingRecords('template', userA);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(tpl.id);

    // Repeat for custom exercise
    const ex = await exerciseRepository.createCustomExercise(
      {
        name: 'Ex V1',
        category: 'legs',
        primaryMuscles: ['Quads'],
      },
      userA,
    );

    await new Promise((r) => setTimeout(r, 10));
    await exerciseRepository.updateCustomExercise(
      {
        id: ex.id,
        name: 'Ex V2',
      },
      userA,
    );

    await new Promise((r) => setTimeout(r, 10));
    const exV3 = await exerciseRepository.updateCustomExercise(
      {
        id: ex.id,
        name: 'Ex V3 Final',
      },
      userA,
    );

    const allCustoms = await customExerciseStorage.getCustomExercises(userA);
    const matchingEx = allCustoms.filter((e) => e.id === ex.id);
    expect(matchingEx).toHaveLength(1);
    expect(matchingEx[0].name).toBe('Ex V3 Final');

    const exMeta = await syncMetadataStore.getRecord('custom_exercise', ex.id, userA);
    expect(exMeta?.clientUpdatedAt).toBe(exV3.updatedAt);
  });

  // --------------------------------------------------------------------------
  // 11. USER ISOLATION
  // --------------------------------------------------------------------------
  it('11. user isolation: authenticated User A and User B cannot share pending metadata or local records', async () => {
    // User A creates template and custom exercise
    const tplA = await templateRepository.createTemplate(
      {
        name: "User A's Template",
        exercises: [
          {
            exerciseId: 'squat',
            exerciseName: 'Squat',
            categoryName: 'Legs',
            sets: 5,
            targetReps: '5',
            restTime: 180,
          },
        ],
      },
      userA,
    );

    const exA = await exerciseRepository.createCustomExercise(
      {
        name: "User A's Exercise",
        category: 'legs',
        primaryMuscles: ['Quads'],
      },
      userA,
    );

    // User B must NOT see User A's template or exercise locally
    const tplsB = await templateStorage.getTemplates(userB);
    expect(tplsB.find((t) => t.id === tplA.id)).toBeUndefined();

    const exsB = await customExerciseStorage.getCustomExercises(userB);
    expect(exsB.find((e) => e.id === exA.id)).toBeUndefined();

    // User B must NOT see User A's pending sync metadata
    const metaTplB = await syncMetadataStore.getRecord('template', tplA.id, userB);
    expect(metaTplB).toBeNull();

    const metaExB = await syncMetadataStore.getRecord('custom_exercise', exA.id, userB);
    expect(metaExB).toBeNull();

    // User B's pending records are empty
    const pendingB = await syncMetadataStore.getPendingRecords(undefined, userB);
    expect(pendingB).toHaveLength(0);
  });
});
