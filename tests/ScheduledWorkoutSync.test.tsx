import { syncEngine } from '../src/services/sync/syncEngine';
import { scheduledWorkoutStorage } from '../src/features/scheduling/storage/scheduledWorkoutStorage';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { scheduledWorkoutCloudService } from '../src/services/cloud/scheduledWorkoutCloudService';
import { workoutCloudService } from '../src/services/cloud/workoutCloudService';
import { templateCloudService } from '../src/services/cloud/templateCloudService';
import { customExerciseCloudService } from '../src/services/cloud/customExerciseCloudService';
import { ScheduledWorkout } from '../src/features/scheduling/types';
import { UserScope } from '../src/features/auth/utils/userScope';

jest.mock('../src/features/scheduling/storage/scheduledWorkoutStorage');
jest.mock('../src/services/sync/syncMetadataStore');
jest.mock('../src/services/cloud/scheduledWorkoutCloudService');
jest.mock('../src/services/cloud/workoutCloudService');
jest.mock('../src/services/cloud/templateCloudService');
jest.mock('../src/services/cloud/customExerciseCloudService');

describe('SCHED-2: Scheduled Workout Sync Engine Integration', () => {
  const mockScope: UserScope = { ownerType: 'authenticated', ownerId: 'user-1' };
  const emptyCloudResult = { records: [], hasMore: false, nextCursor: null };

  beforeEach(() => {
    jest.clearAllMocks();
    (syncMetadataStore.getActiveStreamEntity as jest.Mock).mockResolvedValue('scheduled_workout');
    (syncMetadataStore.getWatermark as jest.Mock).mockResolvedValue({
      lastCompletedWatermark: null,
      activeCursor: null,
      hasMore: false,
    });
    (workoutCloudService.fetchChanged as jest.Mock).mockResolvedValue(emptyCloudResult);
    (templateCloudService.fetchChanged as jest.Mock).mockResolvedValue(emptyCloudResult);
    (customExerciseCloudService.fetchChanged as jest.Mock).mockResolvedValue(emptyCloudResult);
    (workoutCloudService.upsertBatch as jest.Mock).mockResolvedValue([]);
    (templateCloudService.upsertBatch as jest.Mock).mockResolvedValue([]);
    (customExerciseCloudService.upsertBatch as jest.Mock).mockResolvedValue([]);
  });

  it('1. should PUSH locally created pending scheduled workouts', async () => {
    const localWorkout: ScheduledWorkout = {
      id: 'sched-1',
      name: 'Push Day',
      scheduledDate: '2026-10-10',
      status: 'scheduled',
      clientUpdatedAt: '2026-10-01T12:00:00Z',
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-01T12:00:00Z',
    };

    (syncMetadataStore.getPendingRecords as jest.Mock).mockImplementation(async (entity) => {
      if (entity === 'scheduled_workout') return [{ id: 'sched-1', syncStatus: 'pending_upload', clientUpdatedAt: '2026-10-01T12:00:00Z' }];
      return [];
    });
    
    (scheduledWorkoutStorage.getScheduledWorkoutById as jest.Mock).mockResolvedValue(localWorkout);
    (scheduledWorkoutCloudService.upsertBatch as jest.Mock).mockResolvedValue([
      { ...localWorkout, updated_at: '2026-10-01T12:00:01Z', client_updated_at: '2026-10-01T12:00:00Z', deleted_at: null },
    ]);

    const result = await syncEngine.push(mockScope);
    
    expect(scheduledWorkoutCloudService.upsertBatch).toHaveBeenCalled();
    expect(syncMetadataStore.markSynced).toHaveBeenCalledWith('scheduled_workout', 'sched-1', '2026-10-01T12:00:01Z', null, mockScope);
  });

  it('2. should PULL cloud-created scheduled workouts', async () => {
    (scheduledWorkoutCloudService.fetchChanged as jest.Mock).mockResolvedValue({
      records: [
        {
          id: 'sched-2',
          user_id: 'user-1',
          name: 'Leg Day',
          scheduled_date: '2026-10-11',
          status: 'scheduled',
          client_updated_at: '2026-10-02T12:00:00Z',
          updated_at: '2026-10-02T12:00:00Z',
          deleted_at: null,
          created_at: '2026-10-02T12:00:00Z',
        }
      ],
      hasMore: false,
      nextCursor: null,
    });
    
    (scheduledWorkoutStorage.getScheduledWorkouts as jest.Mock).mockResolvedValue([]); // No local items

    const result = await syncEngine.pull(mockScope);

    expect(scheduledWorkoutCloudService.fetchChanged).toHaveBeenCalled();
    
    expect(scheduledWorkoutStorage.saveScheduledWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sched-2', name: 'Leg Day', scheduledDate: '2026-10-11' }),
      mockScope
    );
    
    expect(result.appliedCount).toBeGreaterThan(0);
  });

  it('3. should handle PULL tombstones (Cloud deletion wins)', async () => {
    (scheduledWorkoutCloudService.fetchChanged as jest.Mock).mockResolvedValue({
      records: [
        {
          id: 'sched-3',
          user_id: 'user-1',
          name: 'Deleted Day',
          scheduled_date: '2026-10-12',
          status: 'scheduled',
          client_updated_at: '2026-10-03T12:00:00Z',
          updated_at: '2026-10-03T12:00:00Z',
          deleted_at: '2026-10-03T12:00:00Z', // Tombstone
          created_at: '2026-10-03T12:00:00Z',
        }
      ],
      hasMore: false,
      nextCursor: null,
    });
    
    const localWorkout: ScheduledWorkout = {
      id: 'sched-3',
      name: 'Deleted Day',
      scheduledDate: '2026-10-12',
      status: 'scheduled',
      clientUpdatedAt: '2026-10-02T12:00:00Z',
      createdAt: '2026-10-02T12:00:00Z',
      updatedAt: '2026-10-02T12:00:00Z',
    };

    (scheduledWorkoutStorage.getScheduledWorkouts as jest.Mock).mockResolvedValue([localWorkout]);

    const result = await syncEngine.pull(mockScope);

    expect(scheduledWorkoutStorage.tombstoneScheduledWorkout).toHaveBeenCalledWith('sched-3', mockScope);
    expect(result.tombstonesApplied).toBe(1);
  });

});
