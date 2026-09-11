/**
 * BeBig 2.0 — Platform Storage & IndexedDB Modernization Test Suite
 *
 * Tests:
 * 1. Basic Key-Value CRUD (getItem, setItem, removeItem)
 * 2. Web IndexedDB persistence and transparent migration from localStorage
 * 3. User Scope Isolation (User A vs User B vs Guest)
 * 4. Active Workout Persistence & Crash Recovery
 * 5. Completed Workout History Scaling (Large dataset simulation)
 * 6. Template & Custom Exercise persistence
 */

import { Platform } from 'react-native';
import { platformStorage, idbStorage } from '../src/lib/storage/platformStorage';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { guestStorage } from '../src/lib/storage/guestStorage';
import { WorkoutSession } from '../src/features/workout/types';
import { WorkoutTemplate } from '../src/features/templates/types';
import { Exercise } from '../src/features/exercises/types';

const mockLocalStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
})();

// @ts-ignore
global.localStorage = mockLocalStorage;

describe('Platform Storage & IndexedDB Modernization', () => {
  beforeEach(async () => {
    platformStorage.clearMemoryCache();
    mockLocalStorage.clear();
  });

  describe('1. Basic Key-Value CRUD', () => {
    it('stores, retrieves, and deletes values', async () => {
      await platformStorage.setItem('test.key.1', 'hello-bebig');
      const read = await platformStorage.getItem('test.key.1');
      expect(read).toBe('hello-bebig');

      await platformStorage.removeItem('test.key.1');
      const afterDelete = await platformStorage.getItem('test.key.1');
      expect(afterDelete).toBeNull();
    });

    it('returns null for nonexistent keys', async () => {
      const val = await platformStorage.getItem('nonexistent.key');
      expect(val).toBeNull();
    });
  });

  describe('2. IndexedDB Transaction Commit Safety & Verified Migration', () => {
    const originalPlatform = Platform.OS;
    const originalIndexedDB = (globalThis as any).indexedDB;

    beforeAll(() => {
      // @ts-ignore
      Platform.OS = 'web';
    });

    afterAll(() => {
      // @ts-ignore
      Platform.OS = originalPlatform;
      (globalThis as any).indexedDB = originalIndexedDB;
    });

    it('A. idbStorage.set resolves only after transaction.oncomplete and not prematurely from req.onsuccess', async () => {
      const mockTx: any = {
        objectStore: () => ({
          put: () => {
            const req: any = {};
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess();
            }, 5);
            return req;
          },
        }),
        oncomplete: null,
        onerror: null,
        onabort: null,
      };

      (globalThis as any).indexedDB = {
        open: () => {
          const req: any = { result: { transaction: () => mockTx } };
          setTimeout(() => {
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        },
      };

      let isResolved = false;
      const setPromise = idbStorage.set('test_k', 'test_v').then(() => {
        isResolved = true;
      });

      // Allow request.onsuccess to fire
      await new Promise((r) => setTimeout(r, 20));
      // Transaction is NOT complete yet; must NOT resolve early
      expect(isResolved).toBe(false);

      // Now fire transaction oncomplete
      mockTx.oncomplete();
      await setPromise;
      expect(isResolved).toBe(true);
    });

    it('B. idbStorage.set rejects if transaction aborts even after request onsuccess has fired', async () => {
      const mockTx: any = {
        objectStore: () => ({
          put: () => {
            const req: any = {};
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess();
            }, 5);
            return req;
          },
        }),
        oncomplete: null,
        onerror: null,
        onabort: null,
      };

      (globalThis as any).indexedDB = {
        open: () => {
          const req: any = { result: { transaction: () => mockTx } };
          setTimeout(() => {
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        },
      };

      const setPromise = idbStorage.set('test_abort', 'val');

      // Allow request.onsuccess to fire
      await new Promise((r) => setTimeout(r, 20));

      // Trigger transaction onabort
      mockTx.onabort();

      await expect(setPromise).rejects.toThrow('IndexedDB transaction aborted.');
    });

    it('C. Successful migration: localStorage value -> IDB write -> verified read-back -> localStorage key removed', async () => {
      const mockIdbStore = new Map<string, string>();

      jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);
      jest.spyOn(idbStorage, 'get').mockImplementation(async (k: string) => mockIdbStore.get(k) ?? null);
      jest.spyOn(idbStorage, 'set').mockImplementation(async (k: string, v: string) => {
        mockIdbStore.set(k, v);
      });

      const legacyKey = 'bebig.workout.completed:user_c';
      const legacyPayload = JSON.stringify([{ id: 'w-c-1', name: 'Verified Squat Day' }]);

      mockLocalStorage.setItem(legacyKey, legacyPayload);
      expect(mockIdbStore.has(legacyKey)).toBe(false);

      const migrated = await platformStorage.getItem(legacyKey);
      expect(migrated).toBe(legacyPayload);
      expect(mockIdbStore.get(legacyKey)).toBe(legacyPayload);
      expect(mockLocalStorage.getItem(legacyKey)).toBeNull();
    });

    it('D. Migration write failure: if IndexedDB write fails or aborts, localStorage key is NOT removed', async () => {
      jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);
      jest.spyOn(idbStorage, 'get').mockImplementation(async () => null);
      jest.spyOn(idbStorage, 'set').mockRejectedValue(new Error('Disk quota exceeded on commit'));

      const legacyKey = 'bebig.workout.completed:user_d';
      const legacyPayload = JSON.stringify([{ id: 'w-d-1', name: 'Bench Day Safe' }]);

      mockLocalStorage.setItem(legacyKey, legacyPayload);

      // getItem should catch the write error and still return legacy data safely
      const result = await platformStorage.getItem(legacyKey);
      expect(result).toBe(legacyPayload);

      // CRITICAL: legacy localStorage copy must NOT be deleted
      expect(mockLocalStorage.getItem(legacyKey)).toBe(legacyPayload);
    });

    it('E. Migration read-back mismatch: if read-back verification fails, localStorage key is NOT removed', async () => {
      const mockIdbStore = new Map<string, string>();

      jest.spyOn(idbStorage, 'isAvailable').mockReturnValue(true);
      jest.spyOn(idbStorage, 'set').mockImplementation(async (k: string, v: string) => {
        // Simulate corrupted write
        mockIdbStore.set(k, v + '-corrupted');
      });
      jest.spyOn(idbStorage, 'get').mockImplementation(async (k: string) => {
        // Return null on first check (so migration triggers), then corrupted value on read-back
        return mockIdbStore.get(k) ?? null;
      });

      const legacyKey = 'bebig.workout.completed:user_e';
      const legacyPayload = JSON.stringify([{ id: 'w-e-1', name: 'Deadlift Day' }]);

      mockLocalStorage.setItem(legacyKey, legacyPayload);

      const result = await platformStorage.getItem(legacyKey);
      expect(result).toBe(legacyPayload);

      // CRITICAL: read-back did not match, so localStorage key must be preserved
      expect(mockLocalStorage.getItem(legacyKey)).toBe(legacyPayload);
    });
  });

  describe('3. User Scope & Guest Isolation', () => {
    const userAScope = { ownerId: 'user_A', ownerType: 'authenticated' as const };
    const userBScope = { ownerId: 'user_B', ownerType: 'authenticated' as const };
    const guestScope = { ownerId: 'guest', ownerType: 'guest' as const };

    it('strictly partitions completed workouts across users and guests', async () => {
      const workoutA: WorkoutSession = {
        id: 'w-user-a',
        name: 'User A Push Day',
        startedAt: '2026-03-01T10:00:00.000Z',
        finishedAt: '2026-03-01T11:00:00.000Z',
        status: 'completed',
        ownerId: 'user_A',
        ownerType: 'authenticated',
        exercises: [],
      };

      const workoutB: WorkoutSession = {
        id: 'w-user-b',
        name: 'User B Pull Day',
        startedAt: '2026-03-02T10:00:00.000Z',
        finishedAt: '2026-03-02T11:00:00.000Z',
        status: 'completed',
        ownerId: 'user_B',
        ownerType: 'authenticated',
        exercises: [],
      };

      const workoutGuest: WorkoutSession = {
        id: 'w-guest',
        name: 'Guest Full Body',
        startedAt: '2026-03-03T10:00:00.000Z',
        finishedAt: '2026-03-03T11:00:00.000Z',
        status: 'completed',
        ownerId: 'guest',
        ownerType: 'guest',
        exercises: [],
      };

      await workoutStorage.saveCompletedWorkout(workoutA, userAScope);
      await workoutStorage.saveCompletedWorkout(workoutB, userBScope);
      await workoutStorage.saveCompletedWorkout(workoutGuest, guestScope);

      // Verify User A only sees User A's workout
      const userAWorkouts = await workoutStorage.getCompletedWorkouts(userAScope);
      expect(userAWorkouts).toHaveLength(1);
      expect(userAWorkouts[0].id).toBe('w-user-a');

      // Verify User B only sees User B's workout
      const userBWorkouts = await workoutStorage.getCompletedWorkouts(userBScope);
      expect(userBWorkouts).toHaveLength(1);
      expect(userBWorkouts[0].id).toBe('w-user-b');

      // Verify Guest only sees Guest workout
      const guestWorkouts = await workoutStorage.getCompletedWorkouts(guestScope);
      expect(guestWorkouts).toHaveLength(1);
      expect(guestWorkouts[0].id).toBe('w-guest');
    });
  });

  describe('4. Active Workout Persistence & Recovery', () => {
    const userScope = { ownerId: 'athlete_1', ownerType: 'authenticated' as const };

    it('persists, retrieves, and clears active workout sessions with decimal weights and sets', async () => {
      const activeSession: WorkoutSession = {
        id: 'active-session-123',
        name: 'Heavy Bench Day',
        startedAt: '2026-04-10T14:00:00.000Z',
        status: 'active',
        ownerId: 'athlete_1',
        ownerType: 'authenticated',
        exercises: [
          {
            exerciseId: 'bench-press',
            exerciseName: 'Barbell Bench Press',
            order: 0,
            actualSets: [
              { id: 's1', setNumber: 1, weight: 102.5, reps: 5, rir: 2, completed: true },
              { id: 's2', setNumber: 2, weight: 102.5, reps: 5, rir: 1.5, completed: true },
              { id: 's3', setNumber: 3, weight: 105.0, reps: 3, rir: 0, completed: false },
            ],
          },
        ],
      };

      await workoutStorage.saveActiveWorkout(activeSession, userScope);

      const recovered = await workoutStorage.getActiveWorkout(userScope);
      expect(recovered).not.toBeNull();
      expect(recovered?.id).toBe('active-session-123');
      expect(recovered?.exercises[0].actualSets[0].weight).toBe(102.5);
      expect(recovered?.exercises[0].actualSets[1].rir).toBe(1.5);

      await workoutStorage.clearActiveWorkout(userScope);
      const afterClear = await workoutStorage.getActiveWorkout(userScope);
      expect(afterClear).toBeNull();
    });
  });

  describe('5. Large History Scaling Simulation', () => {
    const userScope = { ownerId: 'volume_lifter', ownerType: 'authenticated' as const };

    it('handles 120 completed workouts without degradation or data corruption', async () => {
      const count = 120;
      const baseDate = new Date('2025-01-01T10:00:00.000Z').getTime();

      for (let i = 0; i < count; i++) {
        const workout: WorkoutSession = {
          id: `bulk-workout-${i}`,
          name: `Workout #${i}`,
          startedAt: new Date(baseDate + i * 86400000).toISOString(),
          finishedAt: new Date(baseDate + i * 86400000 + 3600000).toISOString(),
          status: 'completed',
          ownerId: 'volume_lifter',
          ownerType: 'authenticated',
          exercises: [
            {
              exerciseId: 'deadlift',
              exerciseName: 'Deadlift',
              order: 0,
              actualSets: [
                { id: `s-${i}-1`, setNumber: 1, weight: 180 + (i % 20) * 2.5, reps: 5, rir: 2, completed: true },
                { id: `s-${i}-2`, setNumber: 2, weight: 180 + (i % 20) * 2.5, reps: 5, rir: 1, completed: true },
              ],
            },
          ],
        };

        await workoutStorage.saveCompletedWorkout(workout, userScope);
      }

      const all = await workoutStorage.getCompletedWorkouts(userScope);
      expect(all).toHaveLength(count);

      // Verify newest first ordering
      expect(all[0].id).toBe(`bulk-workout-${count - 1}`);
      expect(all[count - 1].id).toBe('bulk-workout-0');

      // Verify individual lookup
      const target = await workoutStorage.getCompletedWorkoutById('bulk-workout-42', userScope);
      expect(target).not.toBeNull();
      expect(target?.id).toBe('bulk-workout-42');
      expect(target?.exercises[0].actualSets[0].weight).toBe(180 + (42 % 20) * 2.5);

      // Delete one and verify
      await workoutStorage.deleteCompletedWorkout('bulk-workout-42', userScope);
      const afterDelete = await workoutStorage.getCompletedWorkouts(userScope);
      expect(afterDelete).toHaveLength(count - 1);
      expect(await workoutStorage.getCompletedWorkoutById('bulk-workout-42', userScope)).toBeNull();
    });
  });

  describe('6. Templates & Custom Exercises Persistence', () => {
    const userScope = { ownerId: 'powerlifter_pro', ownerType: 'authenticated' as const };

    it('persists templates and custom exercises independently', async () => {
      const template: WorkoutTemplate = {
        id: 'tmpl-sheiko-1',
        name: 'Sheiko #29 Prep',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        exercises: [
          {
            exerciseId: 'squat',
            exerciseName: 'Back Squat',
            order: 0,
            sets: 5,
            targetReps: '5',
            restTime: 180,
            targetWeight: 140,
          },
        ],
      };

      const customEx: Exercise = {
        id: 'ex-ssb-squat',
        name: 'Safety Squat Bar Squat',
        description: 'Squat variation with safety bar',
        category: 'legs',
        categoryName: 'Legs',
        primaryMuscles: [{ id: 'quads', name: 'Quadriceps' }],
        secondaryMuscles: [{ id: 'glutes', name: 'Glutes' }],
        equipment: [{ id: 'barbell', name: 'Barbell' }],
        images: [],
        sourceProvider: 'custom',
        isCustom: true,
      };

      await templateStorage.saveTemplate(template, userScope);
      await customExerciseStorage.saveCustomExercise(customEx, userScope);

      const templates = await templateStorage.getTemplates(userScope);
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('tmpl-sheiko-1');

      const customExercises = await customExerciseStorage.getCustomExercises(userScope);
      expect(customExercises).toHaveLength(1);
      expect(customExercises[0].id).toBe('ex-ssb-squat');

      // Cleanup
      await templateStorage.deleteTemplate('tmpl-sheiko-1', userScope);
      await customExerciseStorage.deleteCustomExercise('ex-ssb-squat', userScope);

      expect(await templateStorage.getTemplates(userScope)).toHaveLength(0);
      expect(await customExerciseStorage.getCustomExercises(userScope)).toHaveLength(0);
    });

    it('persists guest onboarding and session in guestStorage', async () => {
      await guestStorage.setGuestSession({
        id: 'guest-session-uuid',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastActiveAt: '2026-01-01T00:00:00.000Z',
      });

      await guestStorage.saveOnboardingData({
        goal: 'gain_strength',
        experienceLevel: 'advanced',
        daysPerWeek: 4,
        workoutDuration: '60_min',
        trainingLocation: 'gym',
        equipment: 'full_gym',
        preferredTrainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
        workoutStyle: 'push_pull_legs',
        hasCompletedOnboarding: true,
      });

      const session = await guestStorage.getGuestSession();
      expect(session?.id).toBe('guest-session-uuid');

      const onboarding = await guestStorage.getOnboardingData();
      expect(onboarding?.goal).toBe('gain_strength');
      expect(onboarding?.hasCompletedOnboarding).toBe(true);

      await guestStorage.wipeAllGuestData();
      expect(await guestStorage.getGuestSession()).toBeNull();
      expect(await guestStorage.getOnboardingData()).toBeNull();
    });
  });
});
