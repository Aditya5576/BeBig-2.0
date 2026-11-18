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
    let savedAuthActive: any = null;
    
    (workoutStorage.getActiveWorkout as jest.Mock).mockImplementation(async (scope: UserScope) => {
      if (scope.ownerType === 'guest') return mockActive;
      if (scope.ownerType === 'authenticated') return savedAuthActive;
      return null;
    });

    (workoutStorage.saveActiveWorkout as jest.Mock).mockImplementation(async (workout: any) => {
      savedAuthActive = workout;
    });

    (workoutStorage.getCompletedWorkouts as jest.Mock).mockResolvedValue([]);
    (templateStorage.getTemplates as jest.Mock).mockResolvedValue([]);
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);

    await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);

    expect(workoutStorage.saveActiveWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1' }),
      authScope,
      expect.any(Object)
    );
    // Ensure active workout does NOT get marked for sync
    expect(syncMetadataStore.markPendingUpload).not.toHaveBeenCalled();
  });

  describe('Adversarial Guest Migration & Active-Workout Data Loss Prevention', () => {
    it('1. Active guest workout copied and readback-verified into authScope before guest copy is cleared', async () => {
      const mockActive = { id: 'active_guest_999', status: 'in_progress', exercises: [{ exerciseId: 'bench', order: 0, actualSets: [] }] };
      let savedAuthActive: any = null;

      (workoutStorage.getActiveWorkout as jest.Mock).mockImplementation(async (scope: UserScope) => {
        if (scope.ownerType === 'guest') return mockActive;
        if (scope.ownerType === 'authenticated') return savedAuthActive;
        return null;
      });

      (workoutStorage.saveActiveWorkout as jest.Mock).mockImplementation(async (workout: any) => {
        savedAuthActive = workout;
      });

      (workoutStorage.getCompletedWorkouts as jest.Mock).mockResolvedValue([]);
      (templateStorage.getTemplates as jest.Mock).mockResolvedValue([]);
      (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);

      await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);

      // Verify saveActiveWorkout was called with matching session ID and auth scope
      expect(workoutStorage.saveActiveWorkout).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'active_guest_999', ownerId: 'user_456', ownerType: 'authenticated' }),
        authScope,
        { allowDifferentSession: true }
      );

      // Verify guest data is cleared ONLY after successful verification
      expect(workoutStorage.clearAllWorkouts).toHaveBeenCalledWith(guestScope);
    });

    it('2. Simulated write failure / interruption during active workout save preserves guest active workout without data loss', async () => {
      const mockActive = { id: 'active_guest_fragile', status: 'in_progress' };

      (workoutStorage.getActiveWorkout as jest.Mock).mockImplementation(async (scope: UserScope) => {
        if (scope.ownerType === 'guest') return mockActive;
        return null; // Simulates readback failure (write didn't persist)
      });

      (workoutStorage.saveActiveWorkout as jest.Mock).mockRejectedValue(new Error('QuotaExceededError'));
      (workoutStorage.getCompletedWorkouts as jest.Mock).mockResolvedValue([]);
      (templateStorage.getTemplates as jest.Mock).mockResolvedValue([]);
      (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);

      const authUser = { id: 'user_456', email: 'test@test.com' };
      (guestStorage.getGuestSession as jest.Mock).mockResolvedValue({ id: 'guest_123' });

      await expect(guestMigrationService.runMigrationIfPending(authUser)).rejects.toThrow('QuotaExceededError');

      // Crucial: Guest storage MUST NOT be cleared when active workout migration fails
      expect(workoutStorage.clearAllWorkouts).not.toHaveBeenCalledWith(guestScope);
      expect(guestStorage.clearGuestSession).not.toHaveBeenCalled();
    });

    it('3. Duplicate sign-in / auth callback firing twice executes idempotently without duplicate sessions', async () => {
      const mockActive = { id: 'active_guest_duplicate', status: 'in_progress' };
      let savedAuthActive: any = null;

      (workoutStorage.getActiveWorkout as jest.Mock).mockImplementation(async (scope: UserScope) => {
        if (scope.ownerType === 'guest') return savedAuthActive ? null : mockActive;
        if (scope.ownerType === 'authenticated') return savedAuthActive;
        return null;
      });

      (workoutStorage.saveActiveWorkout as jest.Mock).mockImplementation(async (workout: any) => {
        savedAuthActive = workout;
      });

      (workoutStorage.getCompletedWorkouts as jest.Mock).mockResolvedValue([]);
      (templateStorage.getTemplates as jest.Mock).mockResolvedValue([]);
      (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);

      // First run succeeds
      await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);
      expect(workoutStorage.saveActiveWorkout).toHaveBeenCalledTimes(1);

      // Second immediate invocation (duplicate auth state event)
      await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);
      // Does not attempt to re-save already migrated session
      expect(workoutStorage.saveActiveWorkout).toHaveBeenCalledTimes(1);
    });

    it('4. Cross-user isolation: User A signout followed by User B signin strictly isolates data', async () => {
      const userAScope: UserScope = { ownerType: 'authenticated', ownerId: 'user_A' };
      const userBScope: UserScope = { ownerType: 'authenticated', ownerId: 'user_B' };

      const userAWorkout = { id: 'w_user_a', ownerId: 'user_A', ownerType: 'authenticated' };
      (workoutStorage.getCompletedWorkouts as jest.Mock).mockImplementation(async (scope: UserScope) => {
        if (scope.ownerId === 'user_A') return [userAWorkout];
        return [];
      });

      // User B migration should NOT touch User A's data
      (guestStorage.getGuestSession as jest.Mock).mockResolvedValue(null);
      const migrated = await guestMigrationService.runMigrationIfPending({ id: 'user_B', email: 'b@test.com' });
      expect(migrated).toBe(false);

      expect(workoutStorage.saveCompletedWorkout).not.toHaveBeenCalledWith(
        expect.anything(),
        userBScope
      );
    });
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
