import {
  WorkoutCloudService,
  TemplateCloudService,
  CustomExerciseCloudService,
  classifySupabaseError,
  CloudError,
} from '../src/services/cloud';

describe('Milestone 10 — Checkpoint 2: Cloud Data Access Layer Unit Tests', () => {
  let mockSupabase: any;
  let mockFrom: jest.Mock;
  let mockQueryBuilder: any;
  const mockUserId = 'usr_cloud_test_123';

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };

    mockFrom = jest.fn().mockReturnValue(mockQueryBuilder);

    mockSupabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: mockUserId, email: 'test@bebig.app' },
              access_token: 'fake_jwt_token',
            },
          },
          error: null,
        }),
      },
      from: mockFrom,
    };
  });

  describe('1. Error Classification & Mapping', () => {
    it('maps network failures to typed "network" CloudError', () => {
      const err = classifySupabaseError(new Error('TypeError: Failed to fetch'));
      expect(err.kind).toBe('network');
      expect(err.message).toContain('Failed to fetch');

      const timeoutErr = classifySupabaseError({ message: 'Request timeout', status: 504 });
      expect(timeoutErr.kind).toBe('network');
    });

    it('maps auth failures to typed "auth" CloudError', () => {
      const jwtErr = classifySupabaseError({ message: 'JWT expired', code: 'PGRST301', status: 401 });
      expect(jwtErr.kind).toBe('auth');

      const unauthErr = classifySupabaseError({ message: 'unauthorized', status: 401 });
      expect(unauthErr.kind).toBe('auth');
    });

    it('maps RLS permission failures to typed "permission" CloudError', () => {
      const rlsErr = classifySupabaseError({ message: 'new row violates row-level security policy', code: '42501', status: 403 });
      expect(rlsErr.kind).toBe('permission');
    });

    it('maps check constraints / validation failures to typed "validation" CloudError', () => {
      const valErr = classifySupabaseError({ message: 'check constraint "workout_sessions_status_check" violated', status: 400 });
      expect(valErr.kind).toBe('validation');
    });

    it('maps unexpected errors to typed "unknown" CloudError', () => {
      const unknownErr = classifySupabaseError({ message: 'Internal server error', status: 500 });
      expect(unknownErr.kind).toBe('unknown');
    });
  });

  describe('2. WorkoutCloudService', () => {
    let service: WorkoutCloudService;

    beforeEach(() => {
      service = new WorkoutCloudService(mockSupabase);
    });

    it('throws typed "auth" error if user has no active session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(service.getById('workout_123')).rejects.toThrow(CloudError);
      await expect(service.getById('workout_123')).rejects.toMatchObject({
        kind: 'auth',
      });
    });

    it('fetches changed records using server updated_at watermark and keyset ordering', async () => {
      const sampleRows = [
        {
          id: 'w1',
          user_id: mockUserId,
          name: 'Push Day',
          started_at: '2026-09-01T10:00:00Z',
          finished_at: '2026-09-01T11:00:00Z',
          status: 'completed',
          total_duration: 3600,
          total_volume: 4500,
          completed_sets_count: 12,
          exercises: [],
          client_updated_at: '2026-09-01T11:00:00Z',
          deleted_at: null,
          created_at: '2026-09-01T11:00:01Z',
          updated_at: '2026-09-01T11:00:01Z',
        },
      ];

      // Simulate PostgREST resolving the query builder promise to data
      mockQueryBuilder.then = (resolve: any) => resolve({ data: sampleRows, error: null });

      const watermark = '2026-09-01T00:00:00Z';
      const result = await service.fetchChanged({ sinceUpdatedAt: watermark, limit: 50 });

      expect(mockFrom).toHaveBeenCalledWith('workout_sessions');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('updated_at', { ascending: true });
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('id', { ascending: true });
      // Verifies canonical UTC ISO-8601 normalization (.000Z)
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('updated_at', '2026-09-01T00:00:00.000Z');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].id).toBe('w1');
      expect(result.hasMore).toBe(false);
    });

    it('supports keyset cursor pagination (updated_at, id)', async () => {
      mockQueryBuilder.then = (resolve: any) => resolve({ data: [], error: null });

      const cursor = { updatedAt: '2026-09-02T10:00:00Z', id: 'w1' };
      await service.fetchChanged({ cursor, limit: 100 });

      // Verifies canonical UTC ISO-8601 normalization (.000Z) in PostgREST .or() keyset query
      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'updated_at.gt.2026-09-02T10:00:00.000Z,and(updated_at.eq.2026-09-02T10:00:00.000Z,id.gt.w1)'
      );
    });

    it('upsert preserves stable client ID and enforces authenticated user_id', async () => {
      const sampleInput = {
        id: 'workout_client_stable_123',
        name: 'Heavy Leg Day',
        startedAt: '2026-09-04T10:00:00Z',
        finishedAt: '2026-09-04T11:00:00Z',
        totalDuration: 3600,
        totalVolume: 8000,
        completedSetsCount: 15,
        exercises: [],
        clientUpdatedAt: '2026-09-04T11:00:00Z',
        deletedAt: null,
      };

      const returnedRow = { ...sampleInput, user_id: mockUserId, status: 'completed', created_at: '...', updated_at: '...' };
      mockQueryBuilder.single.mockResolvedValueOnce({ data: returnedRow, error: null });

      const result = await service.upsert(sampleInput);

      expect(mockFrom).toHaveBeenCalledWith('workout_sessions');
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'workout_client_stable_123',
          user_id: mockUserId,
          name: 'Heavy Leg Day',
          status: 'completed',
        }),
        { onConflict: 'id' }
      );
      expect(result.id).toBe('workout_client_stable_123');
    });

    it('batch upsert preserves stable client IDs for all records', async () => {
      const batchInput = [
        {
          id: 'w_batch_1',
          name: 'Workout 1',
          startedAt: '2026-09-01T10:00:00Z',
          exercises: [],
        },
        {
          id: 'w_batch_2',
          name: 'Workout 2',
          startedAt: '2026-09-02T10:00:00Z',
          exercises: [],
        },
      ];

      mockQueryBuilder.select.mockResolvedValueOnce({
        data: batchInput.map((b) => ({ ...b, user_id: mockUserId })),
        error: null,
      });

      const result = await service.upsertBatch(batchInput);

      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'w_batch_1', user_id: mockUserId }),
          expect.objectContaining({ id: 'w_batch_2', user_id: mockUserId }),
        ]),
        { onConflict: 'id' }
      );
      expect(result).toHaveLength(2);
    });

    it('softDelete updates deleted_at tombstone and preserves client_updated_at', async () => {
      const tombstonedRow = {
        id: 'workout_del_1',
        user_id: mockUserId,
        deleted_at: '2026-09-05T00:00:00Z',
        client_updated_at: '2026-09-05T00:00:00Z',
      };
      mockQueryBuilder.single.mockResolvedValueOnce({ data: tombstonedRow, error: null });

      const result = await service.softDelete('workout_del_1', '2026-09-05T00:00:00Z');

      expect(mockFrom).toHaveBeenCalledWith('workout_sessions');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(String),
          client_updated_at: '2026-09-05T00:00:00Z',
        })
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'workout_del_1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(result.deleted_at).toBeTruthy();
    });
  });

  describe('3. TemplateCloudService & CustomExerciseCloudService', () => {
    it('TemplateCloudService queries public.workout_templates with user_id', async () => {
      const templateService = new TemplateCloudService(mockSupabase);

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 't1', user_id: mockUserId, name: 'PPL Routine', exercises: [] },
        error: null,
      });

      await templateService.upsert({
        id: 't1',
        name: 'PPL Routine',
        exercises: [],
      });

      expect(mockFrom).toHaveBeenCalledWith('workout_templates');
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1', user_id: mockUserId }),
        { onConflict: 'id' }
      );
    });

    it('CustomExerciseCloudService queries public.custom_exercises with user_id', async () => {
      const exerciseService = new CustomExerciseCloudService(mockSupabase);

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'ex_c1', user_id: mockUserId, name: 'Deficit Deadlift', category: 'back' },
        error: null,
      });

      await exerciseService.upsert({
        id: 'ex_c1',
        name: 'Deficit Deadlift',
        category: 'back',
        categoryName: 'Back',
        primaryMuscles: [{ id: 'hamstrings', name: 'Hamstrings' }],
      });

      expect(mockFrom).toHaveBeenCalledWith('custom_exercises');
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ex_c1',
          user_id: mockUserId,
          name: 'Deficit Deadlift',
          category: 'back',
        }),
        { onConflict: 'id' }
      );
    });
  });

  describe('4. Cloud-Side Last-Write-Wins (LWW) & Tombstone Guardrails (Database Trigger Simulation)', () => {
    /**
     * Executes the exact logic defined in public.handle_sync_entity_mutation() PL/pgSQL function:
     * - Clamps client_updated_at to at most now() + 5 minutes
     * - On UPDATE:
     *   - Invariant 0: id, user_id, created_at are immutable
     *   - Invariant 1: Existing cloud tombstone can NEVER be cleared or resurrected
     *   - Invariant 2: Stale client_updated_at < existing client_updated_at returns OLD (rejects overwrite)
     *   - Invariant 3: Equal timestamps resolve deterministically (cloud wins; incoming tombstone beats live)
     *   - Invariant 4: Newer timestamp or newer tombstone updates record and bumps server updated_at
     */
    function simulateDatabaseMutationTrigger(
      oldRecord: any | undefined,
      newRecord: any,
      op: 'INSERT' | 'UPDATE'
    ): any {
      const now = new Date();
      const maxFutureTime = now.getTime() + 5 * 60 * 1000;
      let clientUpdatedAtMs = newRecord.client_updated_at
        ? new Date(newRecord.client_updated_at).getTime()
        : now.getTime();

      if (clientUpdatedAtMs > maxFutureTime) {
        clientUpdatedAtMs = maxFutureTime;
      }
      const clampedClientUpdatedAt = new Date(clientUpdatedAtMs).toISOString();

      if (op === 'INSERT' || !oldRecord) {
        return {
          ...newRecord,
          client_updated_at: clampedClientUpdatedAt,
          created_at: newRecord.created_at || now.toISOString(),
          updated_at: now.toISOString(),
        };
      }

      // TG_OP = 'UPDATE'
      // Invariant 0: Stable identity and creation metadata are immutable
      const proposed = {
        ...newRecord,
        id: oldRecord.id,
        user_id: oldRecord.user_id,
        created_at: oldRecord.created_at,
        client_updated_at: clampedClientUpdatedAt,
      };

      // Invariant 1: Existing cloud tombstone can NEVER be cleared or resurrected
      if (oldRecord.deleted_at != null) {
        return oldRecord;
      }

      const proposedMs = new Date(proposed.client_updated_at).getTime();
      const oldMs = new Date(oldRecord.client_updated_at).getTime();

      // Invariant 2: Last-Write-Wins (LWW) rule against a live cloud record
      if (proposedMs < oldMs) {
        return oldRecord;
      }

      // Invariant 3: Deterministic tie-breaking when client_updated_at timestamps are identical
      // Exception: A valid incoming tombstone beats an older live record
      if (proposedMs === oldMs && proposed.deleted_at == null) {
        return oldRecord;
      }

      // Winning UPDATE
      return {
        ...proposed,
        updated_at: now.toISOString(),
      };
    }

    function createMockSupabaseWithDatabase(initialTables: Record<string, any[]> = {}) {
      const tables: Record<string, Map<string, any>> = {
        workout_sessions: new Map(),
        workout_templates: new Map(),
        custom_exercises: new Map(),
      };

      for (const [tbl, rows] of Object.entries(initialTables)) {
        for (const r of rows) {
          tables[tbl].set(r.id, { ...r });
        }
      }

      const client = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: mockUserId } } },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          const table = tables[tableName] || new Map();
          let currentPendingRows: any[] = [];

          const builder: any = {
            upsert: jest.fn((payload: any | any[]) => {
              const rowArray = Array.isArray(payload) ? payload : [payload];
              currentPendingRows = rowArray.map((incoming) => {
                const existing = table.get(incoming.id);
                const op = existing ? 'UPDATE' : 'INSERT';
                const result = simulateDatabaseMutationTrigger(existing, incoming, op);
                table.set(result.id, result);
                return result;
              });
              return builder;
            }),
            select: jest.fn(() => builder),
            single: jest.fn(async () => ({
              data: currentPendingRows[0] || null,
              error: null,
            })),
            then: (resolve: any) => resolve({ data: currentPendingRows, error: null }),
          };
          return builder;
        }),
      } as any;

      return { tables, client };
    }

    it('proves older client version cannot overwrite newer cloud version (Workout Templates)', async () => {
      const existingCloudRecord = {
        id: 'tpl_lww_1',
        user_id: mockUserId,
        name: 'Newer Cloud Version (10:00)',
        exercises: [],
        client_updated_at: '2026-09-01T10:00:00.000Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T10:00:01.000Z',
      };

      const { tables, client } = createMockSupabaseWithDatabase({
        workout_templates: [existingCloudRecord],
      });
      const templateService = new TemplateCloudService(client);

      // Offline client attempts to push stale version with 09:00 timestamp
      const result = await templateService.upsert({
        id: 'tpl_lww_1',
        name: 'Stale Offline Version (09:00)',
        exercises: [],
        clientUpdatedAt: '2026-09-01T09:00:00.000Z',
      });

      // Assert that the newer cloud record was preserved and NOT overwritten
      expect(result.name).toBe('Newer Cloud Version (10:00)');
      expect(result.client_updated_at).toBe('2026-09-01T10:00:00.000Z');

      const dbRecord = tables.workout_templates.get('tpl_lww_1');
      expect(dbRecord.name).toBe('Newer Cloud Version (10:00)');
      expect(dbRecord.client_updated_at).toBe('2026-09-01T10:00:00.000Z');
    });

    it('proves newer client version can overwrite older cloud version (Workout Templates)', async () => {
      const existingCloudRecord = {
        id: 'tpl_lww_2',
        user_id: mockUserId,
        name: 'Older Cloud Version (10:00)',
        exercises: [],
        client_updated_at: '2026-09-01T10:00:00.000Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T10:00:01.000Z',
      };

      const { tables, client } = createMockSupabaseWithDatabase({
        workout_templates: [existingCloudRecord],
      });
      const templateService = new TemplateCloudService(client);

      // Client pushes newer version with 11:00 timestamp
      const result = await templateService.upsert({
        id: 'tpl_lww_2',
        name: 'Newest Version (11:00)',
        exercises: [],
        clientUpdatedAt: '2026-09-01T11:00:00.000Z',
      });

      expect(result.name).toBe('Newest Version (11:00)');
      expect(result.client_updated_at).toBe('2026-09-01T11:00:00.000Z');

      const dbRecord = tables.workout_templates.get('tpl_lww_2');
      expect(dbRecord.name).toBe('Newest Version (11:00)');
      expect(dbRecord.client_updated_at).toBe('2026-09-01T11:00:00.000Z');
    });

    it('proves equal timestamp follows the deterministic tie rule: cloud record wins', async () => {
      const existingCloudRecord = {
        id: 'tpl_tie_1',
        user_id: mockUserId,
        name: 'Cloud Authority Version (10:00)',
        exercises: [],
        client_updated_at: '2026-09-01T10:00:00.000Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T10:00:01.000Z',
      };

      const { tables, client } = createMockSupabaseWithDatabase({
        workout_templates: [existingCloudRecord],
      });
      const templateService = new TemplateCloudService(client);

      // Conflicting client edit with exact same millisecond timestamp
      const result = await templateService.upsert({
        id: 'tpl_tie_1',
        name: 'Conflicting Client Version (10:00)',
        exercises: [],
        clientUpdatedAt: '2026-09-01T10:00:00.000Z',
      });

      // Cloud record wins deterministically
      expect(result.name).toBe('Cloud Authority Version (10:00)');
      const dbRecord = tables.workout_templates.get('tpl_tie_1');
      expect(dbRecord.name).toBe('Cloud Authority Version (10:00)');
    });

    it('proves existing tombstone cannot be cleared by stale or live upsert (No Resurrection)', async () => {
      const existingTombstone = {
        id: 'tpl_tomb_1',
        user_id: mockUserId,
        name: 'Deleted Routine',
        exercises: [],
        client_updated_at: '2026-09-01T10:00:00.000Z',
        deleted_at: '2026-09-01T10:00:00.000Z',
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T10:00:01.000Z',
      };

      const { tables, client } = createMockSupabaseWithDatabase({
        workout_templates: [existingTombstone],
      });
      const templateService = new TemplateCloudService(client);

      // Stale client tries to upsert a live record with a later timestamp (12:00)
      const result = await templateService.upsert({
        id: 'tpl_tomb_1',
        name: 'Resurrected Routine',
        exercises: [],
        clientUpdatedAt: '2026-09-01T12:00:00.000Z',
        deletedAt: null,
      });

      // Record remains tombstoned and cannot be un-deleted
      expect(result.deleted_at).toBe('2026-09-01T10:00:00.000Z');
      expect(result.name).toBe('Deleted Routine');

      const dbRecord = tables.workout_templates.get('tpl_tomb_1');
      expect(dbRecord.deleted_at).toBe('2026-09-01T10:00:00.000Z');
      expect(dbRecord.name).toBe('Deleted Routine');
    });

    it('proves newer tombstone beats an older live record', async () => {
      const existingLiveRecord = {
        id: 'ex_custom_1',
        user_id: mockUserId,
        name: 'Incline Cable Flye',
        description: '',
        category: 'chest',
        category_name: 'Chest',
        primary_muscles: [],
        secondary_muscles: [],
        equipment: [],
        client_updated_at: '2026-09-01T10:00:00.000Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T10:00:01.000Z',
      };

      const { tables, client } = createMockSupabaseWithDatabase({
        custom_exercises: [existingLiveRecord],
      });
      const exerciseService = new CustomExerciseCloudService(client);

      // Client deleted the exercise at 11:00
      const result = await exerciseService.upsert({
        id: 'ex_custom_1',
        name: 'Incline Cable Flye',
        category: 'chest',
        categoryName: 'Chest',
        primaryMuscles: [],
        clientUpdatedAt: '2026-09-01T11:00:00.000Z',
        deletedAt: '2026-09-01T11:00:00.000Z',
      });

      expect(result.deleted_at).toBe('2026-09-01T11:00:00.000Z');
      const dbRecord = tables.custom_exercises.get('ex_custom_1');
      expect(dbRecord.deleted_at).toBe('2026-09-01T11:00:00.000Z');
    });

    it('proves tombstone beats live record on equal timestamp', async () => {
      const existingLiveRecord = {
        id: 'ws_tie_1',
        user_id: mockUserId,
        name: 'Leg Day Session',
        started_at: '2026-09-01T08:00:00.000Z',
        finished_at: '2026-09-01T09:00:00.000Z',
        status: 'completed',
        total_duration: 3600,
        total_volume: 5000,
        completed_sets_count: 10,
        exercises: [],
        client_updated_at: '2026-09-01T10:00:00.000Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T09:00:01.000Z',
      };

      const { tables, client } = createMockSupabaseWithDatabase({
        workout_sessions: [existingLiveRecord],
      });
      const workoutService = new WorkoutCloudService(client);

      // Delete incoming with same timestamp
      const result = await workoutService.upsert({
        id: 'ws_tie_1',
        name: 'Leg Day Session',
        startedAt: '2026-09-01T08:00:00.000Z',
        finishedAt: '2026-09-01T09:00:00.000Z',
        exercises: [],
        clientUpdatedAt: '2026-09-01T10:00:00.000Z',
        deletedAt: '2026-09-01T10:00:00.000Z',
      });

      expect(result.deleted_at).toBe('2026-09-01T10:00:00.000Z');
      const dbRecord = tables.workout_sessions.get('ws_tie_1');
      expect(dbRecord.deleted_at).toBe('2026-09-01T10:00:00.000Z');
    });

    it('proves stable IDs and creation metadata remain unchanged upon update', async () => {
      const existingRecord = {
        id: 'ws_stable_id',
        user_id: mockUserId,
        name: 'Chest Routine',
        started_at: '2026-09-01T08:00:00.000Z',
        finished_at: '2026-09-01T09:00:00.000Z',
        status: 'completed',
        total_duration: 3600,
        total_volume: 4000,
        completed_sets_count: 10,
        exercises: [],
        client_updated_at: '2026-09-01T10:00:00.000Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T10:00:00.000Z',
      };

      const { tables, client } = createMockSupabaseWithDatabase({
        workout_sessions: [existingRecord],
      });
      const workoutService = new WorkoutCloudService(client);

      const result = await workoutService.upsert({
        id: 'ws_stable_id',
        name: 'Chest Routine Renamed',
        startedAt: '2026-09-01T08:00:00.000Z',
        exercises: [],
        clientUpdatedAt: '2026-09-01T11:00:00.000Z',
      });

      expect(result.id).toBe('ws_stable_id');
      expect(result.user_id).toBe(mockUserId);
      expect(result.created_at).toBe('2026-09-01T08:00:00.000Z');
      expect(result.name).toBe('Chest Routine Renamed');

      const dbRecord = tables.workout_sessions.get('ws_stable_id');
      expect(dbRecord.id).toBe('ws_stable_id');
      expect(dbRecord.user_id).toBe(mockUserId);
      expect(dbRecord.created_at).toBe('2026-09-01T08:00:00.000Z');
    });

    it('proves batch upsert evaluates LWW independently for every record', async () => {
      const cloudRecord1 = {
        id: 'batch_w1',
        user_id: mockUserId,
        name: 'Cloud Workout 1 (Newer: 12:00)',
        started_at: '2026-09-01T08:00:00.000Z',
        finished_at: '2026-09-01T09:00:00.000Z',
        status: 'completed',
        total_duration: 3600,
        total_volume: 4000,
        completed_sets_count: 10,
        exercises: [],
        client_updated_at: '2026-09-01T12:00:00.000Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T12:00:00.000Z',
      };

      const cloudRecord2 = {
        id: 'batch_w2',
        user_id: mockUserId,
        name: 'Cloud Workout 2 (Older: 08:00)',
        started_at: '2026-09-01T08:00:00.000Z',
        finished_at: '2026-09-01T09:00:00.000Z',
        status: 'completed',
        total_duration: 3600,
        total_volume: 4000,
        completed_sets_count: 10,
        exercises: [],
        client_updated_at: '2026-09-01T08:00:00.000Z',
        deleted_at: null,
        created_at: '2026-09-01T08:00:00.000Z',
        updated_at: '2026-09-01T08:00:00.000Z',
      };

      const { tables, client } = createMockSupabaseWithDatabase({
        workout_sessions: [cloudRecord1, cloudRecord2],
      });
      const workoutService = new WorkoutCloudService(client);

      const batchResults = await workoutService.upsertBatch([
        // Record 1: Client has stale 10:00 version -> must NOT overwrite cloud 12:00
        {
          id: 'batch_w1',
          name: 'Stale Client Workout 1 (10:00)',
          startedAt: '2026-09-01T08:00:00.000Z',
          exercises: [],
          clientUpdatedAt: '2026-09-01T10:00:00.000Z',
        },
        // Record 2: Client has newer 11:00 version -> must overwrite cloud 08:00
        {
          id: 'batch_w2',
          name: 'Newer Client Workout 2 (11:00)',
          startedAt: '2026-09-01T08:00:00.000Z',
          exercises: [],
          clientUpdatedAt: '2026-09-01T11:00:00.000Z',
        },
      ]);

      expect(batchResults).toHaveLength(2);
      // batch_w1 retained cloud authority
      expect(batchResults[0].name).toBe('Cloud Workout 1 (Newer: 12:00)');
      // batch_w2 applied client update
      expect(batchResults[1].name).toBe('Newer Client Workout 2 (11:00)');

      const db1 = tables.workout_sessions.get('batch_w1');
      const db2 = tables.workout_sessions.get('batch_w2');
      expect(db1.name).toBe('Cloud Workout 1 (Newer: 12:00)');
      expect(db2.name).toBe('Newer Client Workout 2 (11:00)');
    });
  });
});
