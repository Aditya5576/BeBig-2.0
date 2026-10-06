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
    await expect(promiseB).resolves.toBeUndefined();

    expect(executionOrder).toEqual(['A', 'B']);
  });
});
