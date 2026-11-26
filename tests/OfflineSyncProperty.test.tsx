import * as fc from 'fast-check';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { WorkoutSession } from '../src/features/workout/types';
import { SyncEngine } from '../src/services/sync/syncEngine';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { CloudError } from '../src/services/cloud/cloudErrors';
import { UserScope } from '../src/features/auth/utils/userScope';

const mockMemoryStore = new Map<string, string>();

jest.mock('../src/lib/storage/platformStorage', () => ({
  platformStorage: {
    getItem: jest.fn(async (key: string) => mockMemoryStore.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockMemoryStore.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockMemoryStore.delete(key);
    }),
    getAllKeys: jest.fn(async () => Array.from(mockMemoryStore.keys())),
    clearMemoryCache: jest.fn(() => {}),
  },
}));

const SCOPE: UserScope = { ownerId: 'prop_user_1', ownerType: 'authenticated' };
const SEED = 20261126;
const NUM_RUNS = 100;

function makeSession(id: string, revision: number, exerciseCount: number, weight: number): WorkoutSession {
  const exercises = Array.from({ length: exerciseCount }, (_, idx) => ({
    id: `${id}_ex_${idx}`,
    exerciseId: `ex_${idx}`,
    exerciseName: `Exercise ${idx}`,
    categoryName: 'Chest',
    order: idx,
    actualSets: [
      {
        id: `${id}_set_${idx}_0`,
        setNumber: 1,
        weight,
        reps: 10,
        completed: true,
        setType: 'normal' as const,
      },
    ],
  }));

  return {
    id,
    name: `Session ${id}`,
    startedAt: '2026-11-26T10:00:00.000Z',
    status: 'active',
    ownerId: SCOPE.ownerId,
    ownerType: SCOPE.ownerType,
    revision,
    version: revision,
    exercises,
  };
}

describe('Offline Sync Engine Property-Based Tests (fast-check)', () => {
  beforeEach(() => {
    mockMemoryStore.clear();
    jest.restoreAllMocks();
  });

  it('SYNC-01 / SYNC-02: Offline workout start, edits, close/reopen hydration, and shadow backup recovery', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            exerciseCount: fc.integer({ min: 1, max: 4 }),
            weight: fc.integer({ min: 20, max: 200 }),
            dropPrimary: fc.boolean(),
          }),
          { minLength: 1, maxLength: 6 }
        ),
        async (ops) => {
          mockMemoryStore.clear();
          const sessionId = 'prop_active_1';
          let current = await workoutStorage.createActiveWorkout(
            makeSession(sessionId, 1, ops[0].exerciseCount, ops[0].weight),
            SCOPE,
            { forceDiscardExisting: true }
          );
          let expectedRev = Number((current as WorkoutSession & { revision?: number }).revision ?? 1);

          for (const op of ops) {
            expectedRev += 1;
            const nextCount = Math.max(current.exercises.length, op.exerciseCount);
            const next = makeSession(sessionId, expectedRev, nextCount, op.weight);
            const saveRes = await workoutStorage.saveActiveWorkout(next, SCOPE);
            expect(saveRes.ok).toBe(true);
            current = next;

            if (op.dropPrimary) {
              for (const k of Array.from(mockMemoryStore.keys())) {
                if (k.includes('active') && !k.includes('backup') && !k.includes('token') && !k.includes('discarded')) {
                  mockMemoryStore.delete(k);
                }
              }
            }

            const hydrated = await workoutStorage.getActiveWorkout(SCOPE);
            expect(hydrated).not.toBeNull();
            expect(hydrated?.id).toBe(sessionId);
            expect(hydrated?.exercises.length).toBe(current.exercises.length);
            expectedRev = Math.max(
              expectedRev,
              Number((hydrated as WorkoutSession & { revision?: number })?.revision ?? expectedRev)
            );
          }
        }
      ),
      { seed: SEED, numRuns: NUM_RUNS }
    );
  });

  it('SYNC-03 / SYNC-04: Stale/out-of-order CAS revisions never overwrite newer state and retries are idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            delta: fc.integer({ min: -3, max: 3 }),
            weight: fc.integer({ min: 10, max: 300 }),
          }),
          { minLength: 2, maxLength: 8 }
        ),
        async (steps) => {
          mockMemoryStore.clear();
          const sessionId = 'prop_cas_1';
          const initial = await workoutStorage.createActiveWorkout(makeSession(sessionId, 1, 1, 50), SCOPE, {
            forceDiscardExisting: true,
          });
          let highestCommittedRev = Number((initial as WorkoutSession & { revision?: number }).revision ?? 1);
          let highestCommittedWeight = 50;

          for (const step of steps) {
            const candidateRev = Math.max(0, highestCommittedRev + step.delta);
            const res = await workoutStorage.saveActiveWorkout(
              makeSession(sessionId, candidateRev, 1, step.weight),
              SCOPE
            );

            if (candidateRev <= highestCommittedRev) {
              expect(res.ok).toBe(false);
              expect(res.conflict).toBe(true);
            } else {
              expect(res.ok).toBe(true);
              highestCommittedRev = candidateRev;
              highestCommittedWeight = step.weight;

              // Idempotent retry of the exact same revision must be rejected without mutating state
              const retryRes = await workoutStorage.saveActiveWorkout(
                makeSession(sessionId, candidateRev, 1, step.weight + 99),
                SCOPE
              );
              expect(retryRes.ok).toBe(false);
              expect(retryRes.conflict).toBe(true);
            }

            const stored = await workoutStorage.getActiveWorkout(SCOPE);
            expect(stored?.exercises[0]?.actualSets[0]?.weight).toBe(highestCommittedWeight);
          }
        }
      ),
      { seed: SEED, numRuns: NUM_RUNS }
    );
  });

  it('SYNC-05: 50-item discard tombstone cap retains most recent 50 and cloud pull replay never resurrects tombstoned workouts', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 55, max: 65 }), async (totalDiscards) => {
        mockMemoryStore.clear();
        const ids: string[] = [];
        for (let i = 0; i < totalDiscards; i++) {
          const sid = `prop_discard_${i}`;
          ids.push(sid);
          await workoutStorage.createActiveWorkout(makeSession(sid, 1, 1, 60), SCOPE, {
            forceDiscardExisting: true,
          });
          await workoutStorage.discardActiveWorkout(SCOPE, sid);
        }

        expect(await workoutStorage.getActiveWorkout(SCOPE)).toBeNull();

        // Most recent 50 remain tombstoned; oldest (totalDiscards - 50) are evicted
        const evictedCount = totalDiscards - 50;
        for (let i = 0; i < evictedCount; i++) {
          expect(await workoutStorage.isSessionDiscarded(ids[i], SCOPE)).toBe(false);
        }
        for (let i = evictedCount; i < totalDiscards; i++) {
          expect(await workoutStorage.isSessionDiscarded(ids[i], SCOPE)).toBe(true);
        }

        // Delayed cloud pull replay containing a locally tombstoned (pending_delete) workout must never resurrect it
        const tombstonedId = ids[totalDiscards - 1];
        const workoutService = {
          upsertBatch: jest.fn(),
          upsert: jest.fn(),
          fetchChanged: jest.fn().mockResolvedValue({
            records: [
              {
                id: tombstonedId,
                user_id: SCOPE.ownerId,
                name: 'Zombie Replay',
                started_at: '2026-11-26T10:00:00.000Z',
                finished_at: '2026-11-26T10:30:00.000Z',
                total_duration: 1800,
                exercises: [],
                client_updated_at: '2026-11-26T12:00:00.000Z',
                updated_at: '2026-11-26T12:00:00.000Z',
                deleted_at: null,
              },
            ],
            nextCursor: null,
            hasMore: false,
          }),
        };
        const emptyPull = {
          upsertBatch: jest.fn().mockResolvedValue([]),
          upsert: jest.fn(),
          fetchChanged: jest.fn().mockResolvedValue({ records: [], nextCursor: null, hasMore: false }),
        };
        const engine = new SyncEngine(workoutService as any, emptyPull as any, emptyPull as any);

        jest.spyOn(syncMetadataStore, 'getRecord').mockResolvedValue({
          entityType: 'workout',
          id: tombstonedId,
          syncStatus: 'pending_delete',
          clientUpdatedAt: '2026-11-26T10:30:00.000Z',
          deletedAt: '2026-11-26T10:30:00.000Z',
        });
        jest.spyOn(syncMetadataStore, 'getWatermark').mockResolvedValue({ lastCompletedWatermark: null, activeCursor: null, hasMore: false });
        jest.spyOn(syncMetadataStore, 'setWatermark').mockResolvedValue();
        const saveCompletedSpy = jest.spyOn(workoutStorage, 'saveCompletedWorkout');

        const pullRes = await engine.pull(SCOPE);
        expect(pullRes.status).toBe('success');
        expect(saveCompletedSpy).not.toHaveBeenCalled();
        const history = await workoutStorage.getCompletedWorkouts(SCOPE);
        expect(history.some((w) => w.id === tombstonedId)).toBe(false);
      }),
      { seed: SEED, numRuns: NUM_RUNS }
    );
  });

  it('SYNC-06 / SYNC-07: Network failures and explicit HTTP 401/403 auth errors retain outbox and recover cleanly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          authStatus: fc.constantFrom<401 | 403>(401, 403),
          outcomes: fc.array(fc.constantFrom<'network' | 'authError' | 'ok'>('network', 'authError', 'ok'), {
            minLength: 1,
            maxLength: 4,
          }),
        }),
        async ({ authStatus, outcomes }) => {
          mockMemoryStore.clear();
          const workoutService = {
            upsertBatch: jest.fn(),
            upsert: jest.fn(),
            fetchChanged: jest.fn().mockResolvedValue({ records: [], nextCursor: null, hasMore: false }),
          };
          const templateService = {
            upsertBatch: jest.fn().mockResolvedValue([]),
            upsert: jest.fn(),
            fetchChanged: jest.fn().mockResolvedValue({ records: [], nextCursor: null, hasMore: false }),
          };
          const exerciseService = {
            upsertBatch: jest.fn().mockResolvedValue([]),
            upsert: jest.fn(),
            fetchChanged: jest.fn().mockResolvedValue({ records: [], nextCursor: null, hasMore: false }),
          };
          const engine = new SyncEngine(workoutService as any, templateService as any, exerciseService as any);

          let pendingOutbox = [
            {
              entityType: 'workout' as const,
              id: 'w_outbox_1',
              syncStatus: 'pending_upload' as const,
              clientUpdatedAt: '2026-11-26T10:00:00.000Z',
              deletedAt: null,
            },
          ];
          jest.spyOn(syncMetadataStore, 'getPendingRecords').mockImplementation(async (type) => {
            return type === 'workout' ? pendingOutbox : [];
          });
          jest.spyOn(syncMetadataStore, 'markSynced').mockImplementation(async () => {
            pendingOutbox = [];
            return null;
          });
          jest.spyOn(syncMetadataStore, 'getWatermark').mockResolvedValue({ lastCompletedWatermark: null, activeCursor: null, hasMore: false });
          jest.spyOn(syncMetadataStore, 'setWatermark').mockResolvedValue();
          jest.spyOn(engine as any, 'buildWorkoutPayloads').mockResolvedValue({
            payloads: [{ id: 'w_outbox_1', clientUpdatedAt: '2026-11-26T10:00:00.000Z', deletedAt: null }],
            validMeta: pendingOutbox,
          });

          for (const outcome of outcomes) {
            if (pendingOutbox.length === 0) break;

            if (outcome === 'network') {
              workoutService.upsertBatch.mockRejectedValueOnce(new CloudError('network', 'Offline'));
              const res = await engine.push(SCOPE);
              expect(res.status).toBe('error');
              expect(pendingOutbox.length).toBe(1);
            } else if (outcome === 'authError') {
              if (authStatus === 401) {
                workoutService.upsertBatch.mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });
                const res = await engine.push(SCOPE);
                expect(res.status).toBe('error');
                expect(res.errors[0]?.kind).toBe('auth');
                expect(pendingOutbox.length).toBe(1);
              } else {
                workoutService.fetchChanged.mockRejectedValueOnce({ status: 403, message: 'Forbidden' });
                const pullRes = await engine.pull(SCOPE);
                expect(pullRes.status).toBe('error');
                expect(pullRes.errors[0]?.kind).toBe('permission');
                expect(pendingOutbox.length).toBe(1);
              }
            } else {
              workoutService.upsertBatch.mockResolvedValueOnce([
                {
                  id: 'w_outbox_1',
                  updated_at: '2026-11-26T10:01:00.000Z',
                  client_updated_at: '2026-11-26T10:00:00.000Z',
                  deleted_at: null,
                },
              ]);
              const pushRes = await engine.push(SCOPE);
              expect(pushRes.status).toBe('success');
              expect(pendingOutbox.length).toBe(0);
              const pullRes = await engine.pull(SCOPE);
              expect(pullRes.status).toBe('success');
            }
          }
        }
      ),
      { seed: SEED, numRuns: NUM_RUNS }
    );
  });
});
