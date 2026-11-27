import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { platformStorage } from '../src/lib/storage/platformStorage';
import { WorkoutSession } from '../src/features/workout/types';

jest.mock('../src/lib/storage/platformStorage', () => ({
  platformStorage: {
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clearMemoryCache: jest.fn(),
  },
}));

describe('Active Workout Concurrency & Serialization', () => {
  const scope = { ownerId: 'test_user', ownerType: 'authenticated' as const };

  const createMockSession = (id: string, name: string): WorkoutSession => ({
    id,
    name,
    startedAt: new Date().toISOString(),
    status: 'active',
    ownerId: scope.ownerId,
    ownerType: scope.ownerType,
    exercises: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('TEST 1: TWO WRITES - A starts, B waits until A resolves', async () => {
    let resolveA: () => void;
    let AStarted = false;
    let BStarted = false;

    (platformStorage.setItem as jest.Mock).mockImplementation(async (key, value) => {
      const parsed = JSON.parse(value);
      if (parsed.name === 'A') {
        AStarted = true;
        return new Promise<void>((resolve) => {
          resolveA = resolve;
        });
      } else if (parsed.name === 'B') {
        BStarted = true;
        return Promise.resolve();
      }
    });

    const sessionA = createMockSession('s1', 'A');
    const sessionB = createMockSession('s1', 'B');

    const promiseA = workoutStorage.saveActiveWorkout(sessionA, scope);
    const promiseB = workoutStorage.saveActiveWorkout(sessionB, scope);

    // Yield to microtask queue to allow initial execution
    await new Promise((r) => setTimeout(r, 10));

    expect(AStarted).toBe(true);
    expect(BStarted).toBe(false); // B must not start while A is unresolved

    // Resolve A
    resolveA!();
    await promiseA;

    // Yield again
    await new Promise((r) => setTimeout(r, 10));

    expect(BStarted).toBe(true);
    await promiseB;

    // Verify final call was B
    const calls = (platformStorage.setItem as jest.Mock).mock.calls;
    expect(calls.length).toBe(2);
    expect(JSON.parse(calls[1][1]).name).toBe('B');
  });

  it('TEST 2: THREE WRITES - exact execution order A -> B -> C', async () => {
    const executionOrder: string[] = [];

    (platformStorage.setItem as jest.Mock).mockImplementation(async (key, value) => {
      const parsed = JSON.parse(value);
      executionOrder.push(parsed.name);
      return new Promise<void>((resolve) => setTimeout(resolve, 5));
    });

    const promiseA = workoutStorage.saveActiveWorkout(createMockSession('s1', 'A'), scope);
    const promiseB = workoutStorage.saveActiveWorkout(createMockSession('s1', 'B'), scope);
    const promiseC = workoutStorage.saveActiveWorkout(createMockSession('s1', 'C'), scope);

    await Promise.all([promiseA, promiseB, promiseC]);

    expect(executionOrder).toEqual(['A', 'B', 'C']);
  });

  it('TEST 3: FAILURE RECOVERY - if A rejects, B still starts and succeeds', async () => {
    const executionOrder: string[] = [];
    
    (platformStorage.setItem as jest.Mock).mockImplementation(async (key, value) => {
      const parsed = JSON.parse(value);
      executionOrder.push(parsed.name);
      
      if (parsed.name === 'A') {
        return Promise.reject(new Error('Simulated failure for A'));
      }
      return Promise.resolve();
    });

    const promiseA = workoutStorage.saveActiveWorkout(createMockSession('s1', 'A'), scope);
    const promiseB = workoutStorage.saveActiveWorkout(createMockSession('s1', 'B'), scope);

    await expect(promiseA).rejects.toThrow('Simulated failure for A');
    await expect(promiseB).resolves.toMatchObject({
      ok: true,
      workout: expect.objectContaining({ id: 's1', name: 'B' }),
    });

    expect(executionOrder).toEqual(['A', 'B']);
  });

  it('TEST 4: TEMPLATE REMOVAL + BACKGROUND FLUSH - removed template exercises stay deleted after background flush & rehydration', async () => {
    const store = new Map<string, string>();
    (platformStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
      store.set(key, value);
    });
    (platformStorage as any).getItem = jest.fn(async (key: string) => store.get(key) ?? null);
    (platformStorage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
      store.delete(key);
    });

    const templateSession: WorkoutSession = {
      ...createMockSession('tpl_session_1', 'Push Day'),
      sourceTemplateId: 'tpl_push_1',
      revision: 1,
      version: 1,
      exercises: [
        {
          exerciseId: 'ex_bench',
          exerciseName: 'Bench Press',
          order: 0,
          actualSets: [{ id: 's1', setNumber: 1, weight: 80, reps: 8, completed: true }],
        },
        {
          exerciseId: 'ex_fly',
          exerciseName: 'Machine Fly',
          order: 1,
          actualSets: [{ id: 's2', setNumber: 1, weight: 40, reps: 12, completed: false }],
        },
      ],
    };

    await workoutStorage.createActiveWorkout(templateSession, scope, { forceDiscardExisting: true });

    // User removes Machine Fly and adds Incline Dumbbell Press, then locks phone (background flush)
    const mutatedSession: WorkoutSession = {
      ...templateSession,
      revision: 2,
      version: 2,
      exercises: [
        templateSession.exercises[0],
        {
          exerciseId: 'ex_incline_db',
          exerciseName: 'Incline Dumbbell Press',
          order: 1,
          actualSets: [{ id: 's3', setNumber: 1, weight: 30, reps: 10, completed: true }],
        },
      ],
    };

    const saveRes = await workoutStorage.saveActiveWorkout(mutatedSession, scope, {
      allowExerciseRemoval: true,
      allowEmptyOverwrites: false,
    });
    expect(saveRes.ok).toBe(true);

    // Rehydrate on wake/resume
    const rehydrated = await workoutStorage.getActiveWorkout(scope);
    expect(rehydrated).not.toBeNull();
    expect(rehydrated?.exercises.map((e) => e.exerciseId)).toEqual(['ex_bench', 'ex_incline_db']);
    expect(rehydrated?.exercises.some((e) => e.exerciseId === 'ex_fly')).toBe(false);
    expect(rehydrated?.exercises[1].actualSets[0].weight).toBe(30);
  });
});
