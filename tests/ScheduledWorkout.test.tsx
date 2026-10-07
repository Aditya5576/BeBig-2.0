import { scheduledWorkoutStorage } from '../src/features/scheduling/storage/scheduledWorkoutStorage';
import { ScheduledWorkout } from '../src/features/scheduling/types';
import { guestMigrationService } from '../src/features/auth/services/guestMigrationService';
import { platformStorage } from '../src/lib/storage/platformStorage';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { UserScope } from '../src/features/auth/utils/userScope';
import { guestStorage } from '../src/lib/storage';

jest.mock('../src/lib/storage/platformStorage', () => ({
  platformStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clearMemoryCache: jest.fn(),
  },
}));

jest.mock('../src/lib/storage', () => {
  const { platformStorage } = require('../src/lib/storage/platformStorage');
  return {
    platformStorage,
    guestStorage: {
      getGuestSession: jest.fn(),
      clearGuestSession: jest.fn(),
    },
  };
});

jest.mock('../src/services/sync/syncMetadataStore', () => ({
  syncMetadataStore: {
    markPendingUpload: jest.fn(),
  },
}));

describe('SCHED-1: Scheduled Workout Repository', () => {
  const guestScope: UserScope = { ownerType: 'guest', ownerId: 'guest-123' };
  const authScope: UserScope = { ownerType: 'authenticated', ownerId: 'user-456' };
  
  const mockWorkout: ScheduledWorkout = {
    id: 'sched-1',
    name: 'Leg Day',
    scheduledDate: '2026-10-15',
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientUpdatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. should resolve scoped storage keys properly', () => {
    expect(scheduledWorkoutStorage.getStorageKey(guestScope)).toBe('bebig.scheduled.workouts.guest.guest-123');
    expect(scheduledWorkoutStorage.getStorageKey(authScope)).toBe('bebig.scheduled.workouts.user-456');
  });

  it('2. should save and retrieve scheduled workouts locally', async () => {
    (platformStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await scheduledWorkoutStorage.saveScheduledWorkout(mockWorkout, authScope);
    
    expect(platformStorage.setItem).toHaveBeenCalledWith(
      'bebig.scheduled.workouts.user-456',
      expect.stringContaining('sched-1')
    );
  });

  it('3. should list workouts and filter out tombstones', async () => {
    const active = { ...mockWorkout, id: '1' };
    const deleted = { ...mockWorkout, id: '2', deletedAt: new Date().toISOString() };
    
    (platformStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([active, deleted]));
    
    const results = await scheduledWorkoutStorage.getScheduledWorkouts(authScope);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('4. should retrieve workouts by specific date', async () => {
    const d1 = { ...mockWorkout, id: '1', scheduledDate: '2026-10-10' };
    const d2 = { ...mockWorkout, id: '2', scheduledDate: '2026-10-11' };
    
    (platformStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([d1, d2]));
    
    const results = await scheduledWorkoutStorage.getScheduledWorkoutsByDate('2026-10-11', authScope);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });

  it('5. should softly tombstone a scheduled workout', async () => {
    (platformStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([mockWorkout]));
    
    await scheduledWorkoutStorage.tombstoneScheduledWorkout('sched-1', authScope);
    
    const setItemCall = (platformStorage.setItem as jest.Mock).mock.calls[0][1];
    const savedItems = JSON.parse(setItemCall);
    expect(savedItems[0].deletedAt).toBeDefined();
  });

  it('6. should allow multiple scheduled workouts on the same date (No Unique Constraint)', async () => {
    // Verifying the local storage behavior naturally supports arrays with same scheduledDate
    const w1 = { ...mockWorkout, id: 'w1', templateId: 't1' };
    const w2 = { ...mockWorkout, id: 'w2', templateId: 't1' }; // Same template, same day
    
    (platformStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([w1, w2]));
    const results = await scheduledWorkoutStorage.getScheduledWorkoutsByDate('2026-10-15', authScope);
    
    expect(results).toHaveLength(2); // Application-level duplicate scheduling allowed
  });

  it('7. should clear scheduled workouts for a specific user scope', async () => {
    await scheduledWorkoutStorage.clearScheduledWorkouts(guestScope);
    expect(platformStorage.removeItem).toHaveBeenCalledWith('bebig.scheduled.workouts.guest.guest-123');
  });
});

describe('SCHED-1: Guest Migration for Scheduled Workouts', () => {
  const guestScope: UserScope = { ownerType: 'guest', ownerId: 'guest-123' };
  const authScope: UserScope = { ownerType: 'authenticated', ownerId: 'user-456' };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should migrate scheduled workouts and set pending_upload', async () => {
    const guestWorkout = {
      id: 'sched-guest',
      name: 'Guest Pull Day',
      scheduledDate: '2026-10-20',
      status: 'scheduled',
      ownerId: 'guest-123',
      ownerType: 'guest',
      clientUpdatedAt: '2026-09-20T00:00:00.000Z'
    };

    // Mock platformStorage logic for migration
    (platformStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key.includes('guest.guest-123') && key.includes('scheduled')) {
        return Promise.resolve(JSON.stringify([guestWorkout]));
      }
      return Promise.resolve(JSON.stringify([]));
    });

    await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);

    // Verify it was saved to the authenticated scope
    expect(platformStorage.setItem).toHaveBeenCalledWith(
      'bebig.scheduled.workouts.user-456',
      expect.stringContaining('Guest Pull Day')
    );

    // Verify it changed ownership
    const setItemCall = (platformStorage.setItem as jest.Mock).mock.calls.find(c => c[0] === 'bebig.scheduled.workouts.user-456')[1];
    const savedData = JSON.parse(setItemCall);
    expect(savedData[0].ownerId).toBe('user-456');

    // Verify sync engine was notified
    expect(syncMetadataStore.markPendingUpload).toHaveBeenCalledWith(
      'scheduled_workout',
      'sched-guest',
      '2026-09-20T00:00:00.000Z',
      authScope
    );

    // Verify guest scheduled workout key was purged
    expect(platformStorage.removeItem).toHaveBeenCalledWith('bebig.scheduled.workouts.guest.guest-123');
  });
});
