import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { platformStorage } from '../src/lib/storage';

jest.mock('expo-secure-store', () => {
  let store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (key: string) => store[key] || null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete store[key];
    }),
    __clearStore: () => { store = {}; }
  };
});

const testScope = { ownerId: 'test', ownerType: 'authenticated' as const };

describe('Workout Storage Validation & Legacy Persistence', () => {
  beforeEach(() => {
    platformStorage.clearMemoryCache();
    require('expo-secure-store').__clearStore();
    jest.clearAllMocks();
  });

  it('preserves legacy completed sets missing RIR and returns the entire workout', async () => {
    const legacyWorkout = {
      id: 'legacy_1',
      name: 'Legacy Workout',
      startedAt: '2023-01-01T10:00:00Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex1',
          exerciseName: 'Bench Press',
          order: 0,
          actualSets: [
            {
              id: 'set1',
              setNumber: 1,
              weight: 100,
              reps: 10,
              completed: true,
            },
          ],
        },
      ],
    };

    await workoutStorage.saveCompletedWorkout(legacyWorkout as any, testScope);

    const retrieved = await workoutStorage.getCompletedWorkouts(testScope);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe('legacy_1');
    expect(retrieved[0].exercises[0].actualSets[0].weight).toBe(100);
    expect(retrieved[0].exercises[0].actualSets[0].rir).toBeUndefined();
  });

  it('preserves valid RIR values', async () => {
    const modernWorkout = {
      id: 'modern_1',
      name: 'Modern Workout',
      startedAt: '2023-01-01T10:00:00Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex1',
          exerciseName: 'Squat',
          order: 0,
          actualSets: [
            {
              id: 'set1',
              setNumber: 1,
              weight: 140,
              reps: 5,
              rir: 2,
              completed: true,
            },
          ],
        },
      ],
    };

    await workoutStorage.saveCompletedWorkout(modernWorkout as any, testScope);

    const retrieved = await workoutStorage.getCompletedWorkouts(testScope);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].exercises[0].actualSets[0].rir).toBe(2);
  });

  it('does not discard the entire workout if RIR is invalid, instead purges the invalid RIR', async () => {
    const invalidRirWorkout = {
      id: 'invalid_rir_1',
      name: 'Invalid RIR Workout',
      startedAt: '2023-01-01T10:00:00Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex1',
          exerciseName: 'Deadlift',
          order: 0,
          actualSets: [
            {
              id: 'set1',
              setNumber: 1,
              weight: 180,
              reps: 3,
              rir: 15,
              completed: true,
            },
            {
              id: 'set2',
              setNumber: 2,
              weight: 180,
              reps: 3,
              rir: 'foo',
              completed: true,
            }
          ],
        },
      ],
    };

    await workoutStorage.saveCompletedWorkout(invalidRirWorkout as any, testScope);

    const retrieved = await workoutStorage.getCompletedWorkouts(testScope);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe('invalid_rir_1');
    expect(retrieved[0].exercises[0].actualSets[0].weight).toBe(180);
    expect(retrieved[0].exercises[0].actualSets[0].rir).toBeUndefined();
    expect(retrieved[0].exercises[0].actualSets[1].rir).toBeUndefined();
  });

  it('rejects genuinely malformed sessions (e.g. negative weight)', async () => {
    const malformedWorkout = {
      id: 'malformed_1',
      name: 'Malformed Workout',
      startedAt: '2023-01-01T10:00:00Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex1',
          exerciseName: 'Overhead Press',
          order: 0,
          actualSets: [
            {
              id: 'set1',
              setNumber: 1,
              weight: -50,
              reps: 5,
              rir: 2,
              completed: true,
            },
          ],
        },
      ],
    };

    // Simulate saving the invalid structure bypassing validation
    await require('expo-secure-store').setItemAsync('bebig.workout.completed_test', JSON.stringify([malformedWorkout]));

    const retrieved = await workoutStorage.getCompletedWorkouts(testScope);
    expect(retrieved.length).toBe(0);
  });
});
