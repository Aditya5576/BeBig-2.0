import { SyncEngine } from '../src/services/sync/syncEngine';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
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

describe('Milestone 10 — Critical Account-Switch Sync Race Tests', () => {
  const userA: UserScope = { ownerId: 'usr_alpha_111', ownerType: 'authenticated' };
  const userB: UserScope = { ownerId: 'usr_beta_222', ownerType: 'authenticated' };
  const guestUser: UserScope = { ownerId: 'guest_999', ownerType: 'guest' };

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

    // Instantiate REAL cloud services backed by mockSupabase client
    workoutCloud = new WorkoutCloudService(mockSupabase);
    templateCloud = new TemplateCloudService(mockSupabase);
    customExerciseCloud = new CustomExerciseCloudService(mockSupabase);

    engine = new SyncEngine(workoutCloud, templateCloud, customExerciseCloud);

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

  it('1. normal User A sync succeeds with session matching expected user', async () => {
    const session: WorkoutSession = {
      id: 'w_normal_1',
      name: 'Normal Push Workout',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.markPendingUpload('workout', 'w_normal_1', '2026-09-01T08:00:00Z', userA);

    const result = await engine.sync(userA);

    expect(result.status).toBe('success');
    expect(result.pushResult.pushedCount).toBe(1);

    // Verify row was sent with User A's ID
    expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'w_normal_1',
          user_id: userA.ownerId,
        }),
      ]),
      { onConflict: 'id' },
    );

    const meta = await syncMetadataStore.getRecord('workout', 'w_normal_1', userA);
    expect(meta?.syncStatus).toBe('synced');
  });

  it('2. User A session disappears before cloud request: halts sync and preserves pending metadata', async () => {
    const session: WorkoutSession = {
      id: 'w_logged_out_1',
      name: 'Session Dropped Workout',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.markPendingUpload('workout', 'w_logged_out_1', '2026-09-01T08:00:00Z', userA);

    // Simulate session disappearing before cloud mutation
    activeSessionUser = null;

    const result = await engine.sync(userA);

    expect(result.status).toBe('error');
    expect(result.errors[0].kind).toBe('auth');
    expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();

    // Pending metadata is strictly preserved for later retry
    const meta = await syncMetadataStore.getRecord('workout', 'w_logged_out_1', userA);
    expect(meta?.syncStatus).toBe('pending_upload');
  });

  it('3. User A changes to User B before cloud request: sync stops, User A payload NOT uploaded under User B', async () => {
    const session: WorkoutSession = {
      id: 'w_stolen_attempt_1',
      name: 'Alpha Secret Workout',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.markPendingUpload('workout', 'w_stolen_attempt_1', '2026-09-01T08:00:00Z', userA);

    // Simulate User B logging into active Supabase session
    activeSessionUser = { id: userB.ownerId, email: 'beta@bebig.app' };

    const result = await engine.sync(userA);

    expect(result.status).toBe('error');
    expect(result.errors[0].kind).toBe('auth');
    expect(result.errors[0].message).toContain('does not match expected sync user');

    // CRITICAL: Database upsert must NEVER have been called with User B
    expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();

    // User A's metadata remains pending under User A's scope
    const metaA = await syncMetadataStore.getRecord('workout', 'w_stolen_attempt_1', userA);
    expect(metaA?.syncStatus).toBe('pending_upload');

    // User B's scope has zero knowledge of User A's workout
    const metaB = await syncMetadataStore.getRecord('workout', 'w_stolen_attempt_1', userB);
    expect(metaB).toBeNull();
  });

  it('4. multi-batch sync: batch 1 succeeds, account switches, batch 2 must NOT upload under User B', async () => {
    // Create 52 pending workouts (Batch 1 has 50, Batch 2 has 2)
    for (let i = 1; i <= 52; i++) {
      const w: WorkoutSession = {
        id: `w_multi_${i}`,
        name: `Workout ${i}`,
        startedAt: '2026-09-01T08:00:00Z',
        finishedAt: '2026-09-01T09:00:00Z',
        status: 'completed',
        exercises: [],
        ownerId: userA.ownerId,
        ownerType: 'authenticated',
      };
      await workoutStorage.saveCompletedWorkout(w, userA);
      await syncMetadataStore.markPendingUpload('workout', w.id, '2026-09-01T08:00:00Z', userA);
    }

    let batchCount = 0;
    mockSupabase.auth.getSession.mockImplementation(async () => {
      batchCount++;
      // First batch (calls during batch 1: scanner + upsertBatch) uses User A
      // Switch to User B before batch 2
      if (batchCount > 1) {
        return {
          data: {
            session: {
              user: { id: userB.ownerId, email: 'beta@bebig.app' },
              access_token: 'beta_jwt',
            },
          },
          error: null,
        };
      }
      return {
        data: {
          session: {
            user: { id: userA.ownerId, email: 'alpha@bebig.app' },
            access_token: 'alpha_jwt',
          },
        },
        error: null,
      };
    });

    const result = await engine.sync(userA);

    // Batch 1 (50 items) succeeded, Batch 2 halted safely with auth mismatch
    expect(result.pushResult.status).toBe('partial');
    expect(result.status).toBe('error');
    expect(result.pushResult.pushedCount).toBe(50);
    expect(result.errors.some((e) => e.kind === 'auth')).toBe(true);

    // Total 1 upsert call (Batch 1). Batch 2 was rejected BEFORE sending to Supabase!
    expect(mockQueryBuilder.upsert).toHaveBeenCalledTimes(1);

    // Batch 2 items remain pending under User A
    const meta51 = await syncMetadataStore.getRecord('workout', 'w_multi_51', userA);
    const meta52 = await syncMetadataStore.getRecord('workout', 'w_multi_52', userA);
    expect(meta51?.syncStatus).toBe('pending_upload');
    expect(meta52?.syncStatus).toBe('pending_upload');

    // Neither item 51 nor 52 was uploaded under User B
    expect(mockQueryBuilder.upsert).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'w_multi_51' })]),
      expect.anything(),
    );
  });

  it('5. template and custom exercise syncs are equally protected against account switch', async () => {
    // 5A: Template
    const template: WorkoutTemplate = {
      id: 't_alpha_1',
      name: 'Alpha Routine',
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          order: 0,
          sets: 3,
          targetReps: '10',
          restTime: 60,
        },
      ],
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await templateStorage.saveTemplate(template, userA);
    await syncMetadataStore.markPendingUpload('template', 't_alpha_1', '2026-09-01T08:00:00Z', userA);

    // 5B: Custom Exercise
    const exercise: Exercise = {
      id: 'custom_alpha_1',
      name: 'Alpha Curl',
      description: 'Strict bicep curl',
      category: 'arms',
      categoryName: 'Arms',
      primaryMuscles: [{ id: 'biceps', name: 'Biceps' }],
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
    await syncMetadataStore.markPendingUpload('custom_exercise', 'custom_alpha_1', '2026-09-01T08:00:00Z', userA);

    // Switch to User B
    activeSessionUser = { id: userB.ownerId, email: 'beta@bebig.app' };

    const result = await engine.sync(userA);

    expect(result.status).toBe('error');
    expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();

    // Both remain pending under User A
    const metaT = await syncMetadataStore.getRecord('template', 't_alpha_1', userA);
    const metaE = await syncMetadataStore.getRecord('custom_exercise', 'custom_alpha_1', userA);
    expect(metaT?.syncStatus).toBe('pending_upload');
    expect(metaE?.syncStatus).toBe('pending_upload');
  });

  it('6. same-user session refresh continues normally and does not reject sync', async () => {
    const session: WorkoutSession = {
      id: 'w_refresh_1',
      name: 'Token Refreshed Session',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.markPendingUpload('workout', 'w_refresh_1', '2026-09-01T08:00:00Z', userA);

    // Session token refreshed, but user ID is STILL User A
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: userA.ownerId, email: 'alpha@bebig.app' },
          access_token: 'newly_refreshed_jwt_token_for_alpha',
        },
      },
      error: null,
    });

    const result = await engine.sync(userA);

    expect(result.status).toBe('success');
    expect(result.pushResult.pushedCount).toBe(1);
    expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ user_id: userA.ownerId })]),
      expect.anything(),
    );
  });

  it('7. repeated sync after returning to User A can safely retry pending data', async () => {
    const session: WorkoutSession = {
      id: 'w_retry_1',
      name: 'Retryable Session',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.markPendingUpload('workout', 'w_retry_1', '2026-09-01T08:00:00Z', userA);

    // Step 1: User B is logged in -> User A sync is rejected
    activeSessionUser = { id: userB.ownerId, email: 'beta@bebig.app' };
    const failResult = await engine.sync(userA);
    expect(failResult.status).toBe('error');

    // Step 2: User A logs back in -> User A sync retries and succeeds
    activeSessionUser = { id: userA.ownerId, email: 'alpha@bebig.app' };
    const retryResult = await engine.sync(userA);
    expect(retryResult.status).toBe('success');
    expect(retryResult.pushResult.pushedCount).toBe(1);

    const meta = await syncMetadataStore.getRecord('workout', 'w_retry_1', userA);
    expect(meta?.syncStatus).toBe('synced');
  });

  it('8. guest and unauthenticated callers are still strictly skipped with zero cloud calls', async () => {
    const guestResult = await engine.sync(guestUser);
    expect(guestResult.status).toBe('skipped_guest_or_unauthenticated');
    expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
    expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();

    const unauthResult = await engine.sync(null);
    expect(unauthResult.status).toBe('skipped_guest_or_unauthenticated');
    expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
  });

  it('9. in-flight paused cloud request: pausing inside getSession, switching user, then releasing stops safely without upload', async () => {
    const session: WorkoutSession = {
      id: 'w_in_flight_race',
      name: 'In-Flight Race Workout',
      startedAt: '2026-09-01T08:00:00Z',
      finishedAt: '2026-09-01T09:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(session, userA);
    await syncMetadataStore.markPendingUpload('workout', 'w_in_flight_race', '2026-09-01T08:00:00Z', userA);

    let releaseSessionPromise: () => void;
    const sessionGate = new Promise<void>((resolve) => {
      releaseSessionPromise = resolve;
    });

    // Pause getSession in-flight
    mockSupabase.auth.getSession.mockImplementation(async () => {
      await sessionGate;
      return {
        data: {
          session: {
            user: activeSessionUser,
            access_token: 'current_token',
          },
        },
        error: null,
      };
    });

    // 1. Start sync for User A (it pauses inside getSession)
    const syncPromise = engine.sync(userA);

    // 2. While paused, User A signs out and User B logs in
    activeSessionUser = { id: userB.ownerId, email: 'beta@bebig.app' };

    // 3. Release the in-flight pause
    releaseSessionPromise!();

    // 4. Await sync result
    const result = await syncPromise;

    // 5. Verify User A sync was aborted and no payload sent as User B
    expect(result.status).toBe('error');
    expect(result.errors[0].kind).toBe('auth');
    expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();

    // User A's pending record is safely preserved
    const meta = await syncMetadataStore.getRecord('workout', 'w_in_flight_race', userA);
    expect(meta?.syncStatus).toBe('pending_upload');
  });
});
