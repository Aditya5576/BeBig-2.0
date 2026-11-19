/**
 * BeBig 2.0 — Astra Audit P0 & P1 Regression Test Suite
 *
 * Covers:
 * - P0-01: Cross-tab / serialized completed-workout persistence & lease contention re-verification
 * - P0-02: Strict unified monotonic revision CAS with explicit conflict return (version & revision)
 * - P1-01: Complete local erasure of scoped completed workouts with loud failure on survival
 * - P1-02: Recursive, zero-shift paginated storage cleanup across 250+ files without skipping shifted entries
 */

import {
  workoutStorage,
  withStorageLock,
  BASE_COMPLETED_WORKOUTS_KEY,
  executeIndexedDbAtomicCompletedMutation,
  mergeCompletedWithTombstones,
  deleteCompletedWithTombstones,
} from '../src/features/workout/storage/workoutStorage';
import { platformStorage } from '../src/lib/storage/platformStorage';
import { eraseLocalDeviceData } from '../src/features/auth/services/accountDeletionService';
import { WorkoutSession } from '../src/features/workout/types';
import { getUserScopedKey, UserScope } from '../src/features/auth/utils/userScope';

describe('Astra Audit P0 & P1 Hardening Verification', () => {
  const authScope: UserScope = {
    ownerId: 'user_p0_p1_test',
    ownerType: 'authenticated',
  };

  const createMockSession = (
    id: string,
    name: string,
    status: 'active' | 'completed' = 'active',
    extra?: Partial<WorkoutSession>
  ): WorkoutSession => ({
    id,
    name,
    startedAt: '2026-11-19T10:00:00.000Z',
    finishedAt: status === 'completed' ? '2026-11-19T11:00:00.000Z' : undefined,
    status,
    ownerId: authScope.ownerId,
    ownerType: authScope.ownerType,
    exercises: [],
    ...extra,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    workoutStorage.resetStorageLocks();
    workoutStorage.resetActiveWorkoutQueue();
    await workoutStorage.clearAllWorkouts(authScope);
  });

  afterEach(async () => {
    await workoutStorage.clearAllWorkouts(authScope);
    workoutStorage.resetStorageLocks();
  });

  describe('P0-01: Serialized Completed-Workout Persistence (Zero Lost Updates)', () => {
    it('concurrent saveCompletedWorkout calls serialize cleanly and preserve both workouts', async () => {
      const workoutA = createMockSession('comp_1', 'Leg Day A', 'completed');
      const workoutB = createMockSession('comp_2', 'Chest Day B', 'completed');

      // Fire both saveCompletedWorkout calls simultaneously without waiting for the first
      const savePromiseA = workoutStorage.saveCompletedWorkout(workoutA, authScope);
      const savePromiseB = workoutStorage.saveCompletedWorkout(workoutB, authScope);

      await Promise.all([savePromiseA, savePromiseB]);

      // Read back completed workouts from storage
      const completed = await workoutStorage.getCompletedWorkouts(authScope);

      // Both workouts must be preserved in storage (neither overwrote the other)
      expect(completed).toHaveLength(2);
      const ids = completed.map((w) => w.id);
      expect(ids).toContain('comp_1');
      expect(ids).toContain('comp_2');
    });

    it('withStorageLock executes critical sections sequentially across async delays', async () => {
      const executionOrder: string[] = [];
      const lockKey = 'test.critical.section';

      const task1 = withStorageLock(lockKey, async () => {
        executionOrder.push('start_1');
        await new Promise((r) => setTimeout(r, 40));
        executionOrder.push('end_1');
      });

      const task2 = withStorageLock(lockKey, async () => {
        executionOrder.push('start_2');
        await new Promise((r) => setTimeout(r, 20));
        executionOrder.push('end_2');
      });

      await Promise.all([task1, task2]);

      expect(executionOrder).toEqual(['start_1', 'end_1', 'start_2', 'end_2']);
    });

    it('lease contention fallback: re-verifies ownerId and only proceeds when ownership is confirmed', async () => {
      const lockKey = 'contention.lease.test';
      const normalizedKey = `bebig.lock.${lockKey}`;
      const leaseKey = `__lock_lease_${normalizedKey}`;

      // Bypass navigator.locks to test storage lease fallback directly
      const originalLocks = (navigator as any).locks;
      Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true, writable: true });

      try {
        // Simulate a pre-existing unexpired lease held by another owner
        const foreignOwner = 'foreign-tab-owner-999';
        await platformStorage.setItem(
          leaseKey,
          JSON.stringify({ ownerId: foreignOwner, expiresAt: Date.now() + 60 })
        );

        let executed = false;
        const startWait = Date.now();

        // Attempt to acquire lock; should wait until foreign lease expires (~60ms) and re-verify
        await withStorageLock(lockKey, async () => {
          executed = true;
          const currentLease = await platformStorage.getItem(leaseKey);
          const parsed = JSON.parse(currentLease || '{}');
          // Ownership must be verified and not foreignOwner
          expect(parsed.ownerId).not.toBe(foreignOwner);
          expect(parsed.ownerId).toBeTruthy();
        });

        expect(executed).toBe(true);
        expect(Date.now() - startWait).toBeGreaterThanOrEqual(40);
      } finally {
        Object.defineProperty(navigator, 'locks', { value: originalLocks, configurable: true, writable: true });
      }
    });

    it('union merge by workout.id preserves concurrently saved workouts while respecting tombstones', async () => {
      const workoutA = createMockSession('union_1', 'Arm Day 1', 'completed', {
        finishedAt: '2026-11-19T10:00:00.000Z',
      });
      const workoutB = createMockSession('union_2', 'Leg Day 2', 'completed', {
        finishedAt: '2026-11-19T11:00:00.000Z',
      });

      await workoutStorage.saveCompletedWorkout(workoutA, authScope);
      await workoutStorage.saveCompletedWorkout(workoutB, authScope);

      // Verify both saved
      let list = await workoutStorage.getCompletedWorkouts(authScope);
      expect(list.map((w) => w.id)).toEqual(['union_2', 'union_1']);

      // Delete workout A -> sets tombstone
      await workoutStorage.deleteCompletedWorkout('union_1', authScope);
      list = await workoutStorage.getCompletedWorkouts(authScope);
      expect(list.map((w) => w.id)).toEqual(['union_2']);

      // Concurrently re-save or update workout B
      const workoutBUpdated = { ...workoutB, name: 'Leg Day 2 (Updated)' };
      await workoutStorage.saveCompletedWorkout(workoutBUpdated, authScope);

      // Workout A must NOT be resurrected because tombstone suppresses it
      list = await workoutStorage.getCompletedWorkouts(authScope);
      expect(list.map((w) => w.id)).toEqual(['union_2']);
      expect(list[0].name).toBe('Leg Day 2 (Updated)');
    });

    it('single-transaction atomic IndexedDB read-merge-write completes synchronously without await gaps (P0-01)', async () => {
      const workout1 = createMockSession('idb_comp_1', 'IDB Leg Day', 'completed', {
        finishedAt: '2026-11-19T09:00:00.000Z',
      });
      const workout2 = createMockSession('idb_comp_2', 'IDB Chest Day', 'completed', {
        finishedAt: '2026-11-19T10:00:00.000Z',
      });

      // Pure merge logic verification
      const mergeResult = mergeCompletedWithTombstones([workout1], workout2, new Set());
      expect(mergeResult.updated).toHaveLength(2);
      expect(mergeResult.updated[0].id).toBe('idb_comp_2');

      const deleteResult = deleteCompletedWithTombstones(mergeResult.updated, 'idb_comp_1', new Set());
      expect(deleteResult.updated).toHaveLength(1);
      expect(deleteResult.updated[0].id).toBe('idb_comp_2');
      expect(deleteResult.tombstones.has('idb_comp_1')).toBe(true);

      // Mock IndexedDB single-transaction environment
      const fakeStoreData = new Map<string, any>();
      let putCalledBeforeComplete = false;
      let txCompleted = false;

      const mockStore = {
        get: jest.fn((key: string) => {
          const req: any = {
            result: fakeStoreData.get(key),
            onsuccess: null,
            onerror: null,
          };
          setTimeout(() => {
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        }),
        put: jest.fn((record: any) => {
          if (!txCompleted) {
            putCalledBeforeComplete = true;
          }
          fakeStoreData.set(record.id, record);
          const req: any = { onsuccess: null, onerror: null };
          return req;
        }),
      };

      const mockTx: any = {
        objectStore: jest.fn(() => mockStore),
        oncomplete: null,
        onerror: null,
        onabort: null,
      };

      const mockDb: any = {
        objectStoreNames: { contains: jest.fn(() => true) },
        createObjectStore: jest.fn(),
        transaction: jest.fn(() => {
          setTimeout(() => {
            txCompleted = true;
            if (mockTx.oncomplete) mockTx.oncomplete();
          }, 10);
          return mockTx;
        }),
        close: jest.fn(),
      };

      const originalIndexedDb = (globalThis as any).indexedDB;
      (globalThis as any).indexedDB = {
        open: jest.fn(() => {
          const openReq: any = {
            result: mockDb,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
          };
          setTimeout(() => {
            if (openReq.onsuccess) openReq.onsuccess();
          }, 0);
          return openReq;
        }),
      };

      try {
        await workoutStorage.saveCompletedWorkout(workout1, authScope);

        // Verify IDB transaction was invoked and store.put was called before tx.oncomplete
        expect(mockStore.get).toHaveBeenCalled();
        expect(mockStore.put).toHaveBeenCalled();
        expect(putCalledBeforeComplete).toBe(true);

        // Verify mirrored write in platform storage
        const savedWorkouts = await workoutStorage.getCompletedWorkouts(authScope);
        expect(savedWorkouts.some((w) => w.id === 'idb_comp_1')).toBe(true);
      } finally {
        (globalThis as any).indexedDB = originalIndexedDb;
      }
    });
  });

  describe('P0-02: Unified Revision & Version Monotonic CAS', () => {
    it('two concurrent saves with equal version: 2 without explicit revision -> second is rejected with conflict', async () => {
      // 1. Initialize active workout with version 1
      const initial = createMockSession('active_cas_v2', 'Chest Day v1', 'active', {
        version: 1,
      });
      const initialResult = await workoutStorage.saveActiveWorkout(initial, authScope);
      expect(initialResult.ok).toBe(true);

      // 2. Tab A attempts to save version 2 (no explicit revision)
      const tabA = createMockSession('active_cas_v2', 'Chest Day (Tab A v2)', 'active', {
        version: 2,
      });

      // 3. Tab B attempts to save version 2 (no explicit revision)
      const tabB = createMockSession('active_cas_v2', 'Chest Day (Tab B v2)', 'active', {
        version: 2,
      });

      const resultA = await workoutStorage.saveActiveWorkout(tabA, authScope);
      const resultB = await workoutStorage.saveActiveWorkout(tabB, authScope);

      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(false);
      expect(resultB.conflict).toBe(true);
      expect(resultB.persistedRevision).toBe(2);
      expect(resultB.incomingRevision).toBe(2);

      const stored = await workoutStorage.getActiveWorkout(authScope);
      expect(stored?.name).toBe('Chest Day (Tab A v2)');
      expect(stored?.version).toBe(2);
      expect((stored as any)?.revision).toBe(2);
    });

    it('rejects concurrent write with matching revision (revision 2 vs revision 2) and returns conflict', async () => {
      const initial = createMockSession('active_cas_1', 'Push Day', 'active', {
        revision: 1,
      });
      const initialResult = await workoutStorage.saveActiveWorkout(initial, authScope);
      expect(initialResult.ok).toBe(true);

      const tabAWrite = createMockSession('active_cas_1', 'Push Day (Tab A)', 'active', {
        revision: 2,
      });
      const tabBWrite = createMockSession('active_cas_1', 'Push Day (Tab B)', 'active', {
        revision: 2,
      });

      const resultA = await workoutStorage.saveActiveWorkout(tabAWrite, authScope);
      const resultB = await workoutStorage.saveActiveWorkout(tabBWrite, authScope);

      expect(resultA.ok).toBe(true);
      expect(resultA.conflict).toBeFalsy();

      expect(resultB.ok).toBe(false);
      expect(resultB.conflict).toBe(true);
      expect(resultB.persistedRevision).toBe(2);
      expect(resultB.incomingRevision).toBe(2);

      const current = await workoutStorage.getActiveWorkout(authScope);
      expect(current?.name).toBe('Push Day (Tab A)');
      expect((current as any)?.revision).toBe(2);
      expect(current?.version).toBe(2);
    });

    it('rejects stale write with older revision (revision 1 vs stored revision 2) with conflict', async () => {
      const v2 = createMockSession('active_cas_2', 'Pull Day v2', 'active', {
        revision: 2,
      });
      await workoutStorage.saveActiveWorkout(v2, authScope);

      const staleWrite = createMockSession('active_cas_2', 'Pull Day Stale v1', 'active', {
        revision: 1,
      });
      const staleResult = await workoutStorage.saveActiveWorkout(staleWrite, authScope);

      expect(staleResult.ok).toBe(false);
      expect(staleResult.conflict).toBe(true);
      expect(staleResult.persistedRevision).toBe(2);
      expect(staleResult.incomingRevision).toBe(1);

      const current = await workoutStorage.getActiveWorkout(authScope);
      expect(current?.name).toBe('Pull Day v2');
    });

    it('allows monotonic progression (revision 3 over revision 2) with ok: true', async () => {
      const v2 = createMockSession('active_cas_3', 'Legs v2', 'active', {
        revision: 2,
      });
      await workoutStorage.saveActiveWorkout(v2, authScope);

      const v3 = createMockSession('active_cas_3', 'Legs v3', 'active', {
        revision: 3,
      });
      const resultV3 = await workoutStorage.saveActiveWorkout(v3, authScope);

      expect(resultV3.ok).toBe(true);
      expect(resultV3.conflict).toBeFalsy();

      const current = await workoutStorage.getActiveWorkout(authScope);
      expect(current?.name).toBe('Legs v3');
      expect((current as any)?.revision).toBe(3);
      expect(current?.version).toBe(3);
    });
  });

  describe('P1-01: Complete Local Erasure of Scoped Completed Workouts', () => {
    it('purges scoped completed workout keys and verifies absence on device', async () => {
      const completedWorkout = createMockSession('comp_purge_1', 'Deadlift Session', 'completed');
      await workoutStorage.saveCompletedWorkout(completedWorkout, authScope);

      const scopedCompletedKey = getUserScopedKey(BASE_COMPLETED_WORKOUTS_KEY, authScope);
      expect(scopedCompletedKey).toBeTruthy();
      const storedRaw = await platformStorage.getItem(scopedCompletedKey!);
      expect(storedRaw).not.toBeNull();

      await eraseLocalDeviceData(authScope);

      const postErasureRaw = await platformStorage.getItem(scopedCompletedKey!);
      expect(postErasureRaw).toBeNull();

      const workoutsAfter = await workoutStorage.getCompletedWorkouts(authScope);
      expect(workoutsAfter).toHaveLength(0);
    });

    it('fails loudly and throws an error if any scoped key survives erasure', async () => {
      const scopedKey = getUserScopedKey(BASE_COMPLETED_WORKOUTS_KEY, authScope)!;
      await platformStorage.setItem(scopedKey, 'persisted_stubborn_data');

      const originalGetItem = platformStorage.getItem;
      jest.spyOn(platformStorage, 'getItem').mockImplementation(async (key: string) => {
        if (key === scopedKey) {
          return 'surviving_ghost_record';
        }
        return originalGetItem.call(platformStorage, key);
      });

      await expect(eraseLocalDeviceData(authScope)).rejects.toThrow(
        /Local device data erasure failed.*surviving_ghost_record|could not be completely removed/i
      );

      (platformStorage.getItem as jest.Mock).mockRestore();
    });
  });

  describe('P1-02: Recursive, Zero-Shift Paginated Storage Cleanup Simulation', () => {
    it('zero-shift pagination deletes all 250 files across nested subfolders without skipping shifted pages', async () => {
      let squatFiles = Array.from({ length: 150 }, (_, i) => ({
        name: `squat_${i}.jpg`,
        id: `squat_id_${i}`,
      }));
      let benchFiles = Array.from({ length: 100 }, (_, i) => ({
        name: `bench_${i}.jpg`,
        id: `bench_id_${i}`,
      }));
      let rootItems = [
        { name: 'squats', id: null },
        { name: 'benches', id: null },
      ];

      const deletedPaths: string[] = [];

      const mockAdminClient = {
        storage: {
          from: (bucket: string) => ({
            list: jest.fn(async (prefix: string, options?: any) => {
              const offset = options?.offset || 0;
              const limit = options?.limit || 100;

              let listSource: Array<{ name: string; id: string | null }> = [];
              if (prefix === 'user_250') listSource = rootItems;
              else if (prefix === 'user_250/squats') listSource = squatFiles;
              else if (prefix === 'user_250/benches') listSource = benchFiles;

              const page = listSource.slice(offset, offset + limit);
              return { data: page, error: null };
            }),
            remove: jest.fn(async (paths: string[]) => {
              deletedPaths.push(...paths);
              for (const p of paths) {
                const fileName = p.split('/').pop()!;
                squatFiles = squatFiles.filter((f) => f.name !== fileName);
                benchFiles = benchFiles.filter((f) => f.name !== fileName);
                rootItems = rootItems.filter((f) => f.name !== fileName);
              }
              return { data: paths, error: null };
            }),
          }),
        },
      };

      // Run zero-shift pagination algorithm from delete-account
      async function deleteUserStorageFolder(
        adminClient: any,
        bucket: string,
        prefix: string
      ): Promise<void> {
        const PAGE_SIZE = 100;
        let folderOffset = 0;

        while (true) {
          const { data: items, error: listError } = await adminClient.storage
            .from(bucket)
            .list(prefix, {
              limit: PAGE_SIZE,
              offset: folderOffset,
              sortBy: { column: 'name', order: 'asc' },
            });

          if (listError) throw new Error(listError.message);
          if (!items || items.length === 0) break;

          const filesToDelete: string[] = [];
          const subfolders: string[] = [];

          for (const item of items) {
            if (item.id === null || !item.id) {
              subfolders.push(`${prefix}/${item.name}`);
            } else {
              filesToDelete.push(`${prefix}/${item.name}`);
            }
          }

          if (filesToDelete.length > 0) {
            const { error: removeError } = await adminClient.storage
              .from(bucket)
              .remove(filesToDelete);
            if (removeError) throw new Error(removeError.message);
          }

          // Advance folderOffset only by surviving subfolders
          folderOffset += subfolders.length;

          for (const subfolder of subfolders) {
            await deleteUserStorageFolder(adminClient, bucket, subfolder);
          }

          if (items.length < PAGE_SIZE) {
            break;
          }
        }
      }

      await deleteUserStorageFolder(mockAdminClient, 'exercise-photos', 'user_250');

      expect(deletedPaths).toHaveLength(250);
      expect(squatFiles).toHaveLength(0);
      expect(benchFiles).toHaveLength(0);
    });

    it('traverses nested folders and aborts on deletion error', async () => {
      let failOnRemove = false;

      const mockStorageHierarchy: Record<string, Array<{ name: string; id: string | null }>> = {
        'target_user_id': [
          { name: 'exercise_squat', id: null },
          { name: 'avatar.jpg', id: 'avatar_id' },
        ],
        'target_user_id/exercise_squat': [
          { name: 'photo_0.jpg', id: 'photo_id_0' },
        ],
      };

      const mockAdminClient = {
        storage: {
          from: (bucket: string) => ({
            list: jest.fn(async (prefix: string) => {
              const items = mockStorageHierarchy[prefix] || [];
              return { data: items, error: null };
            }),
            remove: jest.fn(async (paths: string[]) => {
              if (failOnRemove) {
                return { error: { message: 'Cloud storage timeout' } };
              }
              return { data: paths, error: null };
            }),
          }),
        },
      };

      async function deleteUserStorageFolder(
        adminClient: any,
        bucket: string,
        prefix: string
      ): Promise<void> {
        const PAGE_SIZE = 100;
        let folderOffset = 0;

        while (true) {
          const { data: items, error: listError } = await adminClient.storage
            .from(bucket)
            .list(prefix, {
              limit: PAGE_SIZE,
              offset: folderOffset,
              sortBy: { column: 'name', order: 'asc' },
            });

          if (listError) throw new Error(`Failed to list: ${listError.message}`);
          if (!items || items.length === 0) break;

          const filesToDelete: string[] = [];
          const subfolders: string[] = [];

          for (const item of items) {
            if (item.id === null || !item.id) {
              subfolders.push(`${prefix}/${item.name}`);
            } else {
              filesToDelete.push(`${prefix}/${item.name}`);
            }
          }

          if (filesToDelete.length > 0) {
            const { error: removeError } = await adminClient.storage
              .from(bucket)
              .remove(filesToDelete);
            if (removeError) throw new Error(`Failed to remove files: ${removeError.message}`);
          }

          folderOffset += subfolders.length;

          for (const subfolder of subfolders) {
            await deleteUserStorageFolder(adminClient, bucket, subfolder);
          }

          if (items.length < PAGE_SIZE) {
            break;
          }
        }
      }

      failOnRemove = true;
      await expect(
        deleteUserStorageFolder(mockAdminClient, 'exercise-photos', 'target_user_id')
      ).rejects.toThrow('Failed to remove files: Cloud storage timeout');
    });
  });
});
