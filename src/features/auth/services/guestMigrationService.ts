import { UserScope, AuthUser } from '../types';
import { guestStorage } from '../../../lib/storage';
import { workoutStorage } from '../../workout/storage/workoutStorage';
import { templateStorage } from '../../templates/storage/templateStorage';
import { customExerciseStorage } from '../../exercises/storage/customExerciseStorage';
import { syncMetadataStore } from '../../../services/sync/syncMetadataStore';
import { WorkoutSession } from '../../workout/types';
import { WorkoutTemplate } from '../../templates/types';
import { Exercise } from '../../exercises/types';

export const guestMigrationService = {
  /**
   * Evaluates if a guest session exists on disk and executes a safe migration to the authenticated user.
   * If partial failure occurs, the guest session is retained on disk allowing a safe retry on next launch.
   */
  async runMigrationIfPending(authUser: AuthUser): Promise<boolean> {
    const guestSession = await guestStorage.getGuestSession();
    if (!guestSession) {
      return false; // Nothing to migrate
    }

    const guestScope: UserScope = { ownerType: 'guest', ownerId: guestSession.id };
    const authScope: UserScope = { ownerType: 'authenticated', ownerId: authUser.id };

    // Atomically execute migration; throws on failure
    await this.migrateGuestDataToUser(guestScope, authScope);

    // Only cleared after all migration stages succeed
    await guestStorage.clearGuestSession();
    return true;
  },

  /**
   * Safely migrates all guest-scoped data to the authenticated user's scope.
   * Preserves stable IDs and creates `pending_upload` sync metadata so the background
   * sync engine pushes the local guest data to the cloud automatically.
   */
  async migrateGuestDataToUser(guestScope: UserScope, authScope: UserScope): Promise<void> {
    if (guestScope.ownerType !== 'guest' || authScope.ownerType !== 'authenticated') {
      return;
    }

    try {
      // 1. Completed Workouts
      const completedWorkouts = await workoutStorage.getCompletedWorkouts(guestScope);
      const authWorkouts = await workoutStorage.getCompletedWorkouts(authScope);
      const authWorkoutIds = new Set(authWorkouts.map(w => w.id));

      for (const workout of completedWorkouts) {
        if (!authWorkoutIds.has(workout.id)) {
          const updatedWorkout = { ...workout, ownerId: authScope.ownerId, ownerType: authScope.ownerType };
          await workoutStorage.saveCompletedWorkout(updatedWorkout, authScope);
          
          await syncMetadataStore.markPendingUpload(
            'workout',
            workout.id,
            workout.finishedAt || workout.startedAt || new Date().toISOString(),
            authScope
          );
        }
      }

      // 2. Templates
      const templates = await templateStorage.getTemplates(guestScope);
      const authTemplates = await templateStorage.getTemplates(authScope);
      const authTemplateIds = new Set(authTemplates.map(t => t.id));

      for (const template of templates) {
        if (!authTemplateIds.has(template.id)) {
          const updatedTemplate = { ...template, ownerId: authScope.ownerId, ownerType: authScope.ownerType };
          await templateStorage.saveTemplate(updatedTemplate, authScope);

          await syncMetadataStore.markPendingUpload(
            'template',
            template.id,
            template.updatedAt || template.createdAt || new Date().toISOString(),
            authScope
          );
        }
      }

      // 3. Custom Exercises
      const exercises = await customExerciseStorage.getCustomExercises(guestScope);
      const authExercises = await customExerciseStorage.getCustomExercises(authScope);
      const authExerciseIds = new Set(authExercises.map(e => e.id));

      for (const exercise of exercises) {
        if (!authExerciseIds.has(exercise.id)) {
          const updatedExercise = { ...exercise, ownerId: authScope.ownerId, ownerType: authScope.ownerType };
          await customExerciseStorage.saveCustomExercise(updatedExercise, authScope);

          await syncMetadataStore.markPendingUpload(
            'custom_exercise',
            exercise.id,
            exercise.updatedAt || exercise.createdAt || new Date().toISOString(),
            authScope
          );
        }
      }

      // 4. Active Workout (Local continuity only, intentionally not synced)
      const guestActiveWorkout = await workoutStorage.getActiveWorkout(guestScope);
      if (guestActiveWorkout) {
        const authActiveWorkout = await workoutStorage.getActiveWorkout(authScope);
        if (!authActiveWorkout) {
          const updatedActive = { ...guestActiveWorkout, ownerId: authScope.ownerId, ownerType: authScope.ownerType };
          await workoutStorage.saveActiveWorkout(updatedActive, authScope);
        }
      }

      // 5. Clean up the source guest storage keys so data is not orphaned
      await workoutStorage.clearAllWorkouts(guestScope);
      await templateStorage.clearTemplates(guestScope);
      await customExerciseStorage.clearCustomExercises(guestScope);

    } catch (error) {
      console.error('[GuestMigrationService] Migration failed:', error);
      throw error;
    }
  }
};
