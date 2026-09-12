/**
 * BeBig 2.0 — Milestone 10 Fix #5: PostgREST Timestamp Normalization Tests
 *
 * Validates:
 * 1. UTC Z timestamp produces canonical UTC query value.
 * 2. +00:00 timestamp produces the same canonical value.
 * 3. Positive timezone offset converts correctly to UTC.
 * 4. Negative timezone offset converts correctly to UTC.
 * 5. Equivalent timestamps representing the same instant generate equivalent query filters.
 * 6. Incremental updated_at filtering returns correct boundary behavior.
 * 7. Existing 5-second overlap behavior remains unchanged.
 * 8. Cursor (updated_at, id) ordering remains unchanged.
 * 9. Pagination across equal timestamps remains deterministic.
 * 10. Invalid timestamp input is handled safely and does not silently create an incorrect filter.
 * 11. All 3 cloud services (Workout, Template, CustomExercise) enforce consistent normalization.
 */

import {
  normalizeUtcTimestamp,
  WorkoutCloudService,
  TemplateCloudService,
  CustomExerciseCloudService,
  CloudError,
} from '../src/services/cloud';
import { SyncEngine, WATERMARK_OVERLAP_MS } from '../src/services/sync';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { useAuthStore } from '../src/features/auth';
import { UserScope } from '../src/features/auth/types';

describe('Milestone 10 — Fix #5: PostgREST Timestamp Normalization Unit Tests', () => {
  const testUserId = 'usr_timestamp_test';
  const testScope: UserScope = { ownerId: testUserId, ownerType: 'authenticated' };

  let mockSupabase: any;
  let mockQueryBuilder: any;
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: [], error: null }),
    };

    mockFrom = jest.fn().mockReturnValue(mockQueryBuilder);

    mockSupabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: testUserId, email: 'test@bebig.app' },
            },
          },
          error: null,
        }),
      },
      from: mockFrom,
    };
  });

  describe('1. normalizeUtcTimestamp() Instant & Timezone Normalization', () => {
    it('1. UTC "Z" timestamp produces canonical UTC query value (ending in .000Z)', () => {
      const canonical = normalizeUtcTimestamp('2026-09-06T10:00:00Z');
      expect(canonical).toBe('2026-09-06T10:00:00.000Z');
    });

    it('2. "+00:00" timestamp produces the same canonical value', () => {
      const canonical = normalizeUtcTimestamp('2026-09-06T10:00:00+00:00');
      expect(canonical).toBe('2026-09-06T10:00:00.000Z');
    });

    it('3. positive timezone offset converts correctly to UTC instant', () => {
      // 15:30:00 in +05:30 is 10:00:00 UTC
      const canonical = normalizeUtcTimestamp('2026-09-06T15:30:00+05:30');
      expect(canonical).toBe('2026-09-06T10:00:00.000Z');
    });

    it('4. negative timezone offset converts correctly to UTC instant', () => {
      // 06:00:00 in -04:00 is 10:00:00 UTC
      const canonical = normalizeUtcTimestamp('2026-09-06T06:00:00-04:00');
      expect(canonical).toBe('2026-09-06T10:00:00.000Z');
    });

    it('5. equivalent timestamps representing the same instant generate equivalent canonical values', () => {
      const t1 = normalizeUtcTimestamp('2026-09-06T10:00:00Z');
      const t2 = normalizeUtcTimestamp('2026-09-06T10:00:00+00:00');
      const t3 = normalizeUtcTimestamp('2026-09-06T15:30:00+05:30');
      const t4 = normalizeUtcTimestamp('2026-09-06T06:00:00-04:00');
      const t5 = normalizeUtcTimestamp('2026-09-06T10:00:00.000Z');

      expect(t1).toBe('2026-09-06T10:00:00.000Z');
      expect(t2).toBe(t1);
      expect(t3).toBe(t1);
      expect(t4).toBe(t1);
      expect(t5).toBe(t1);
    });

    it('preserves millisecond precision when present', () => {
      const canonical = normalizeUtcTimestamp('2026-09-06T10:00:00.123+00:00');
      expect(canonical).toBe('2026-09-06T10:00:00.123Z');
    });

    it('treats naive ISO datetimes without timezone as UTC (never uses local device timezone)', () => {
      const canonical = normalizeUtcTimestamp('2026-09-06T10:00:00');
      expect(canonical).toBe('2026-09-06T10:00:00.000Z');
    });
  });

  describe('2. Validation & Error Handling (Invalid Timestamps)', () => {
    it('10a. rejects empty or whitespace-only timestamp string with validation error', () => {
      expect(() => normalizeUtcTimestamp('')).toThrow(CloudError);
      expect(() => normalizeUtcTimestamp('   ')).toThrow(CloudError);

      try {
        normalizeUtcTimestamp('');
      } catch (err: any) {
        expect(err.kind).toBe('validation');
      }
    });

    it('10b. rejects non-string types with validation error', () => {
      expect(() => normalizeUtcTimestamp(null)).toThrow(CloudError);
      expect(() => normalizeUtcTimestamp(undefined)).toThrow(CloudError);
      expect(() => normalizeUtcTimestamp(12345)).toThrow(CloudError);
      expect(() => normalizeUtcTimestamp({})).toThrow(CloudError);
    });

    it('10c. rejects non-date garbage strings with validation error', () => {
      expect(() => normalizeUtcTimestamp('invalid-date')).toThrow(CloudError);
      expect(() => normalizeUtcTimestamp('not-a-timestamp')).toThrow(CloudError);
      expect(() => normalizeUtcTimestamp('2026-99-99T99:99:99Z')).toThrow(CloudError);
      expect(() => normalizeUtcTimestamp('yesterday')).toThrow(CloudError);
    });
  });

  describe('3. Cloud Services Query Construction Normalization', () => {
    it('6. WorkoutCloudService normalizes sinceUpdatedAt filter to canonical UTC instant', async () => {
      const service = new WorkoutCloudService(mockSupabase);

      // Pass non-canonical timestamp with timezone offset (+05:30)
      await service.fetchChanged({ sinceUpdatedAt: '2026-09-06T15:30:00+05:30', limit: 50 });

      expect(mockFrom).toHaveBeenCalledWith('workout_sessions');
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('updated_at', '2026-09-06T10:00:00.000Z');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
    });

    it('WorkoutCloudService normalizes cursor.updatedAt filter in keyset .or() expression', async () => {
      const service = new WorkoutCloudService(mockSupabase);

      // Pass cursor with +00:00 offset
      await service.fetchChanged({
        cursor: { updatedAt: '2026-09-06T10:00:00+00:00', id: 'ws_alpha' },
        limit: 100,
      });

      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'updated_at.gt.2026-09-06T10:00:00.000Z,and(updated_at.eq.2026-09-06T10:00:00.000Z,id.gt.ws_alpha)'
      );
    });

    it('WorkoutCloudService normalizes nextCursor.updatedAt returned to caller', async () => {
      const rawDbRow = {
        id: 'ws_beta',
        user_id: testUserId,
        updated_at: '2026-09-06T10:00:00+00:00', // Non-canonical database format
      };
      mockQueryBuilder.then = (resolve: any) => resolve({ data: [rawDbRow], error: null });

      const service = new WorkoutCloudService(mockSupabase);
      const result = await service.fetchChanged({ limit: 1 });

      expect(result.nextCursor).toEqual({
        updatedAt: '2026-09-06T10:00:00.000Z', // Normalized canonical UTC
        id: 'ws_beta',
      });
    });

    it('TemplateCloudService normalizes sinceUpdatedAt and cursor filters', async () => {
      const service = new TemplateCloudService(mockSupabase);

      // 1. sinceUpdatedAt with negative offset (-04:00)
      await service.fetchChanged({ sinceUpdatedAt: '2026-09-06T06:00:00-04:00' });
      expect(mockFrom).toHaveBeenCalledWith('workout_templates');
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('updated_at', '2026-09-06T10:00:00.000Z');

      // 2. cursor with Z offset
      await service.fetchChanged({
        cursor: { updatedAt: '2026-09-06T10:00:00Z', id: 'tpl_alpha' },
      });
      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'updated_at.gt.2026-09-06T10:00:00.000Z,and(updated_at.eq.2026-09-06T10:00:00.000Z,id.gt.tpl_alpha)'
      );
    });

    it('CustomExerciseCloudService normalizes sinceUpdatedAt and cursor filters', async () => {
      const service = new CustomExerciseCloudService(mockSupabase);

      // 1. sinceUpdatedAt with +05:30
      await service.fetchChanged({ sinceUpdatedAt: '2026-09-06T15:30:00+05:30' });
      expect(mockFrom).toHaveBeenCalledWith('custom_exercises');
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('updated_at', '2026-09-06T10:00:00.000Z');

      // 2. cursor with +00:00
      await service.fetchChanged({
        cursor: { updatedAt: '2026-09-06T10:00:00+00:00', id: 'ex_alpha' },
      });
      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'updated_at.gt.2026-09-06T10:00:00.000Z,and(updated_at.eq.2026-09-06T10:00:00.000Z,id.gt.ex_alpha)'
      );
    });

    it('10d. cloud services reject invalid sinceUpdatedAt without executing database queries', async () => {
      const service = new WorkoutCloudService(mockSupabase);

      await expect(service.fetchChanged({ sinceUpdatedAt: 'bad-watermark' })).rejects.toMatchObject({
        kind: 'validation',
      });

      // Database query was never executed
      expect(mockQueryBuilder.gte).not.toHaveBeenCalled();
    });

    it('10e. cloud services reject invalid cursor.updatedAt without executing database queries', async () => {
      const service = new WorkoutCloudService(mockSupabase);

      await expect(
        service.fetchChanged({ cursor: { updatedAt: 'bad-cursor-time', id: 'ws_1' } })
      ).rejects.toMatchObject({
        kind: 'validation',
      });

      expect(mockQueryBuilder.or).not.toHaveBeenCalled();
    });
  });

  describe('4. Incremental Keyset, Overlap, & Ordering Invariants', () => {
    it('7. 5-second overlap behavior produces canonical UTC sinceUpdatedAt for SyncEngine delta query', async () => {
      syncMetadataStore.clearMemoryCache();
      workoutStorage.clearMemoryCache();
      await syncMetadataStore.resetUserState(testUserId);

      useAuthStore.setState({
        user: { id: testUserId, email: 'test@bebig.app' } as any,
        isGuest: false,
        status: 'authenticated',
      });

      // Set completed watermark in metadata
      const watermarkInstant = '2026-09-06T10:00:00.000Z';
      await syncMetadataStore.setWatermark(
        'workout',
        { lastCompletedWatermark: watermarkInstant, activeCursor: null },
        testScope
      );

      let capturedOptions: any;
      const mockWorkoutCloud = {
        fetchChanged: jest.fn(async (opts: any) => {
          capturedOptions = opts;
          return { records: [], hasMore: false, nextCursor: null };
        }),
        upsert: jest.fn(),
        upsertBatch: jest.fn(),
      };
      const mockTemplateCloud = {
        fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
        upsert: jest.fn(),
        upsertBatch: jest.fn(),
      };
      const mockCustomExerciseCloud = {
        fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
        upsert: jest.fn(),
        upsertBatch: jest.fn(),
      };

      const engine = new SyncEngine(
        mockWorkoutCloud as any,
        mockTemplateCloud as any,
        mockCustomExerciseCloud as any
      );
      await engine.pull(testScope);

      // Verify 5-second overlap: 10:00:00 minus 5000ms is 09:59:55.000Z
      expect(capturedOptions?.sinceUpdatedAt).toBe('2026-09-06T09:59:55.000Z');
      expect(WATERMARK_OVERLAP_MS).toBe(5000);
    });

    it('8. keyset cursor ordering enforces (updated_at ASC, id ASC) deterministically', async () => {
      const service = new WorkoutCloudService(mockSupabase);
      await service.fetchChanged({ limit: 10 });

      expect(mockQueryBuilder.order).toHaveBeenNthCalledWith(1, 'updated_at', { ascending: true });
      expect(mockQueryBuilder.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    });

    it('9. keyset cursor pagination with equal updated_at breaks ties using id.gt.cursorId', async () => {
      const service = new WorkoutCloudService(mockSupabase);
      const equalTime = '2026-09-06T10:00:00+00:00';

      await service.fetchChanged({ cursor: { updatedAt: equalTime, id: 'id_record_A' } });

      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'updated_at.gt.2026-09-06T10:00:00.000Z,and(updated_at.eq.2026-09-06T10:00:00.000Z,id.gt.id_record_A)'
      );
    });
  });
});
