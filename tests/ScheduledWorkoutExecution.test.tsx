import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { scheduledWorkoutRepository } from '../src/features/scheduling/services/scheduledWorkoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { scheduledWorkoutStorage } from '../src/features/scheduling/storage/scheduledWorkoutStorage';
import { syncMetadataStore } from '../src/services/sync';
import { UserScope } from '../src/features/auth/utils/userScope';
import { WorkoutTemplate } from '../src/features/templates/types';
import { ScheduledWorkout } from '../src/features/scheduling/types';

jest.mock('../src/services/sync/syncMetadataStore', () => ({
  syncMetadataStore: {
    markPendingUpload: jest.fn(),
    markPendingDelete: jest.fn(),
  },
}));

jest.mock('../src/services/sync/syncEngine', () => ({
  syncLifecycleManager: {
    triggerSync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/services/sync', () => ({
  syncMetadataStore: {
    markPendingUpload: jest.fn(),
    markPendingDelete: jest.fn(),
  },
  syncLifecycleManager: {
    triggerSync: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock platform storage to keep it purely in-memory for fast testing
jest.mock('../src/lib/storage/platformStorage', () => {
  const store: Record<string, string> = {};
  return {
    platformStorage: {
      getItem: jest.fn(async (k) => store[k] || null),
      setItem: jest.fn(async (k, v) => { store[k] = v; }),
      removeItem: jest.fn(async (k) => { delete store[k]; }),
      clearMemoryCache: jest.fn(),
    },
  };
});

jest.mock('../src/features/auth/utils/userScope', () => {
  const actual = jest.requireActual('../src/features/auth/utils/userScope');
  return {
    ...actual,
    getCurrentUserScope: jest.fn(() => ({ ownerType: 'authenticated', ownerId: 'user-1' })),
  };
});

describe('SCHED-4: Scheduled Workout Execution & Completion', () => {
  const mockTemplate: WorkoutTemplate = {
    id: 'tpl-1',
    name: 'Push Day',
    ownerId: 'user-1',
    ownerType: 'authenticated',
    exercises: [
      { exerciseId: 'ex-1', exerciseName: 'Bench Press', sets: 3, targetReps: '10', targetWeight: 135, order: 0, restTime: 90 }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockScheduledWorkout: ScheduledWorkout = {
    id: 'sched-1',
    name: 'Push Day',
    templateId: 'tpl-1',
    scheduledDate: '2026-10-10',
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientUpdatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    workoutStorage.clearMemoryCache();
  });

  it('1. should start an active workout carrying the scheduledWorkoutId', async () => {
    const session = await workoutRepository.startWorkoutFromTemplate(mockTemplate, mockScheduledWorkout.name, mockScheduledWorkout.id);
    
    expect(session.sourceScheduledWorkoutId).toBe(mockScheduledWorkout.id);
    expect(session.exercises.length).toBe(1);
    
    // Verify it saved to active draft
    const active = await workoutRepository.getActiveWorkout();
    expect(active?.sourceScheduledWorkoutId).toBe('sched-1');
  });

  it('2. should link scheduled workout to the session upon completion and update status', async () => {
    // Seed scheduled workout storage
    await scheduledWorkoutRepository.createScheduledWorkout({
      name: 'Push Day',
      scheduledDate: '2026-10-10',
      templateId: 'tpl-1'
    });
    
    const schedules = await scheduledWorkoutRepository.getScheduledWorkouts();
    const targetSchedule = schedules[0];

    // Start workout
    const activeSession = await workoutRepository.startWorkoutFromTemplate(mockTemplate, targetSchedule.name, targetSchedule.id);
    
    // Complete at least one set
    const updatedSession = workoutRepository.updateSet(activeSession, 'ex-1', activeSession.exercises[0].actualSets[0].id, { completed: true });
    await workoutRepository.updateActiveWorkout(updatedSession);

    // Finish workout
    const completedSession = await workoutRepository.completeActiveWorkout();

    expect(completedSession.status).toBe('completed');
    expect(completedSession.completedSetsCount).toBe(1);

    // Verify scheduled workout was updated
    const updatedSchedule = await scheduledWorkoutRepository.getScheduledWorkoutById(targetSchedule.id);
    expect(updatedSchedule?.status).toBe('completed');
    expect(updatedSchedule?.completedSessionId).toBe(completedSession.id);
    
    // Verify both are marked for sync
    expect(syncMetadataStore.markPendingUpload).toHaveBeenCalledWith('workout', completedSession.id, expect.any(String), expect.any(Object));
    expect(syncMetadataStore.markPendingUpload).toHaveBeenCalledWith('scheduled_workout', targetSchedule.id, expect.any(String), expect.any(Object));
  });
});
