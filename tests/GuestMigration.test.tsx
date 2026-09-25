import { guestMigrationService } from '../src/features/auth/services/guestMigrationService';
import { UserScope } from '../src/features/auth/types';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';

import { guestStorage } from '../src/lib/storage';

// Mock dependencies
jest.mock('../src/features/workout/storage/workoutStorage');
jest.mock('../src/features/templates/storage/templateStorage');
jest.mock('../src/features/exercises/storage/customExerciseStorage');
jest.mock('../src/services/sync/syncMetadataStore');
jest.mock('../src/lib/storage', () => ({
  guestStorage: {
    getGuestSession: jest.fn(),
    clearGuestSession: jest.fn(),
  }
}));

describe('GuestMigrationService', () => {
  const guestScope: UserScope = { ownerType: 'guest', ownerId: 'guest_123' };
  const authScope: UserScope = { ownerType: 'authenticated', ownerId: 'user_456' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('migrates completed workouts to authenticated scope and sets pending_upload', async () => {
    const mockWorkout = { id: 'w1', name: 'Workout 1' };
    
    (workoutStorage.getCompletedWorkouts as jest.Mock).mockImplementation(async (scope: UserScope) => {
      if (scope.ownerType === 'guest') return [mockWorkout];
      return [];
    });
    
    (workoutStorage.getActiveWorkout as jest.Mock).mockResolvedValue(null);
    (templateStorage.getTemplates as jest.Mock).mockResolvedValue([]);
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);

    await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);

    expect(workoutStorage.saveCompletedWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w1' }),
      authScope
    );
    expect(syncMetadataStore.markPendingUpload).toHaveBeenCalledWith(
      'workout',
      'w1',
      expect.any(String),
      authScope
    );

    // Verify cleanup
    expect(workoutStorage.clearAllWorkouts).toHaveBeenCalledWith(guestScope);
    expect(templateStorage.clearTemplates).toHaveBeenCalledWith(guestScope);
    expect(customExerciseStorage.clearCustomExercises).toHaveBeenCalledWith(guestScope);
  });

  it('preserves stable IDs during migration', async () => {
    const mockTemplate = { id: 't1', name: 'Template 1' };
    
    (templateStorage.getTemplates as jest.Mock).mockImplementation(async (scope: UserScope) => {
      if (scope.ownerType === 'guest') return [mockTemplate];
      return [];
    });
    
    (workoutStorage.getCompletedWorkouts as jest.Mock).mockResolvedValue([]);
    (workoutStorage.getActiveWorkout as jest.Mock).mockResolvedValue(null);
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);

    await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);

    expect(templateStorage.saveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1' }),
      authScope
    );
    expect(syncMetadataStore.markPendingUpload).toHaveBeenCalledWith(
      'template',
      't1',
      expect.any(String),
      authScope
    );
  });

  it('migrates active workout locally without setting pending_upload', async () => {
    const mockActive = { id: 'a1', status: 'in_progress' };
    
    (workoutStorage.getActiveWorkout as jest.Mock).mockImplementation(async (scope: UserScope) => {
      if (scope.ownerType === 'guest') return mockActive;
      return null;
    });

    (workoutStorage.getCompletedWorkouts as jest.Mock).mockResolvedValue([]);
    (templateStorage.getTemplates as jest.Mock).mockResolvedValue([]);
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);

    await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);

    expect(workoutStorage.saveActiveWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1' }),
      authScope
    );
    // Ensure active workout does NOT get marked for sync
    expect(syncMetadataStore.markPendingUpload).not.toHaveBeenCalled();
  });

  it('is idempotent and does not overwrite or duplicate existing authenticated data', async () => {
    const mockTemplate = { id: 't1', name: 'Guest Template' };
    const authTemplate = { id: 't1', name: 'Already Migrated Template' };
    
    (templateStorage.getTemplates as jest.Mock).mockImplementation(async (scope: UserScope) => {
      if (scope.ownerType === 'guest') return [mockTemplate];
      if (scope.ownerType === 'authenticated') return [authTemplate];
      return [];
    });

    (workoutStorage.getCompletedWorkouts as jest.Mock).mockResolvedValue([]);
    (workoutStorage.getActiveWorkout as jest.Mock).mockResolvedValue(null);
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);

    await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);

    // It should not save because the ID already exists in auth scope
    expect(templateStorage.saveTemplate).not.toHaveBeenCalled();
    expect(syncMetadataStore.markPendingUpload).not.toHaveBeenCalled();
  });

  describe('Partial Failure and Retry Behavior', () => {
    it('does not clear guest data if migration fails (TEST 5)', async () => {
      const authUser = { id: 'user_456', email: 'test@test.com' };
      (guestStorage.getGuestSession as jest.Mock).mockResolvedValue({ id: 'guest_123' });
      
      (workoutStorage.getCompletedWorkouts as jest.Mock).mockRejectedValue(new Error('Storage failure'));

      await expect(guestMigrationService.runMigrationIfPending(authUser)).rejects.toThrow('Storage failure');

      expect(workoutStorage.clearAllWorkouts).not.toHaveBeenCalled();
      expect(guestStorage.clearGuestSession).not.toHaveBeenCalled();
    });

    it('returns false and does nothing if no guest session exists (TEST 10)', async () => {
      const authUser = { id: 'user_456', email: 'test@test.com' };
      (guestStorage.getGuestSession as jest.Mock).mockResolvedValue(null);
      
      const result = await guestMigrationService.runMigrationIfPending(authUser);
      
      expect(result).toBe(false);
      expect(workoutStorage.getCompletedWorkouts).not.toHaveBeenCalled();
      expect(guestStorage.clearGuestSession).not.toHaveBeenCalled();
    });

    it('retries successfully and skips already migrated data (TEST 7 & 8)', async () => {
      const authUser = { id: 'user_456', email: 'test@test.com' };
      (guestStorage.getGuestSession as jest.Mock).mockResolvedValue({ id: 'guest_123' });
      
      const mockWorkout = { id: 'w1', name: 'Workout 1' }; // Already migrated
      const mockTemplate = { id: 't1', name: 'Template 1' }; // Not migrated yet
      
      // Setup partial state: workout already in auth, template still in guest only
      (workoutStorage.getCompletedWorkouts as jest.Mock).mockImplementation(async (scope: UserScope) => {
        if (scope.ownerType === 'guest') return [mockWorkout];
        if (scope.ownerType === 'authenticated') return [mockWorkout]; // Exists
        return [];
      });
      (templateStorage.getTemplates as jest.Mock).mockImplementation(async (scope: UserScope) => {
        if (scope.ownerType === 'guest') return [mockTemplate];
        return []; // Missing from auth
      });
      (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);
      (workoutStorage.getActiveWorkout as jest.Mock).mockResolvedValue(null);

      const result = await guestMigrationService.runMigrationIfPending(authUser);

      expect(result).toBe(true);

      // Workout should NOT be saved again
      expect(workoutStorage.saveCompletedWorkout).not.toHaveBeenCalled();
      
      // Template SHOULD be saved
      expect(templateStorage.saveTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1' }),
        authScope
      );

      // Cleanup MUST run
      expect(workoutStorage.clearAllWorkouts).toHaveBeenCalledWith(guestScope);
      expect(guestStorage.clearGuestSession).toHaveBeenCalled();
    });
  });
});
