import { platformStorage } from '../../../lib/storage/platformStorage';
import { ScheduledWorkout } from '../types';
import { UserScope, getUserScopedKey } from '../../auth/utils/userScope';

const STORAGE_KEY_BASE = 'bebig.scheduled.workouts';

export const scheduledWorkoutStorage = {
  /**
   * Generates the storage key for scheduled workouts for a specific user.
   */
  getStorageKey(scope?: UserScope): string {
    const key = getUserScopedKey(STORAGE_KEY_BASE, scope);
    if (!key) {
      throw new Error('[scheduledWorkoutStorage] Cannot determine user scope for storage key.');
    }
    return key;
  },

  /**
   * Retrieves all scheduled workouts for the given user scope, excluding tombstones (deletedAt IS NOT NULL)
   * unless includeDeleted is explicitly true.
   */
  async getScheduledWorkouts(scope?: UserScope, includeDeleted = false): Promise<ScheduledWorkout[]> {
    try {
      const key = this.getStorageKey(scope);
      const rawData = await platformStorage.getItem(key);
      if (!rawData) {
        return [];
      }

      const allItems: ScheduledWorkout[] = JSON.parse(rawData);
      
      if (includeDeleted) {
        return allItems;
      }
      
      return allItems.filter(item => !item.deletedAt);
    } catch (error) {
      console.warn('[scheduledWorkoutStorage] Failed to load scheduled workouts:', error);
      return [];
    }
  },

  /**
   * Retrieves a specific scheduled workout by ID.
   */
  async getScheduledWorkoutById(id: string, scope?: UserScope): Promise<ScheduledWorkout | null> {
    const items = await this.getScheduledWorkouts(scope, true); // Check deleted ones too just in case
    return items.find(item => item.id === id) || null;
  },

  /**
   * Retrieves scheduled workouts for a specific calendar date (YYYY-MM-DD).
   */
  async getScheduledWorkoutsByDate(date: string, scope?: UserScope): Promise<ScheduledWorkout[]> {
    const items = await this.getScheduledWorkouts(scope, false);
    return items.filter(item => item.scheduledDate === date);
  },

  /**
   * Creates or updates a scheduled workout.
   */
  async saveScheduledWorkout(workout: ScheduledWorkout, scope?: UserScope): Promise<void> {
    try {
      const key = this.getStorageKey(scope);
      const items = await this.getScheduledWorkouts(scope, true); // Load all including deleted
      
      const index = items.findIndex(item => item.id === workout.id);
      if (index >= 0) {
        items[index] = workout;
      } else {
        items.push(workout);
      }

      await platformStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      console.error('[scheduledWorkoutStorage] Failed to save scheduled workout:', error);
      throw error;
    }
  },

  /**
   * Hard-replaces all scheduled workouts.
   * Primarily used by the sync engine during pull operations to reconcile state.
   */
  async saveAllScheduledWorkouts(workouts: ScheduledWorkout[], scope?: UserScope): Promise<void> {
    try {
      const key = this.getStorageKey(scope);
      await platformStorage.setItem(key, JSON.stringify(workouts));
    } catch (error) {
      console.error('[scheduledWorkoutStorage] Failed to replace scheduled workouts:', error);
      throw error;
    }
  },

  /**
   * Soft-deletes a scheduled workout by setting deletedAt = now().
   */
  async tombstoneScheduledWorkout(id: string, scope?: UserScope): Promise<void> {
    const item = await this.getScheduledWorkoutById(id, scope);
    if (item && !item.deletedAt) {
      item.deletedAt = new Date().toISOString();
      item.clientUpdatedAt = new Date().toISOString();
      await this.saveScheduledWorkout(item, scope);
    }
  }
};
