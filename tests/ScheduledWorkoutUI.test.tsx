import React from 'react';
import { scheduledWorkoutRepository } from '../src/features/scheduling/services/scheduledWorkoutRepository';
import { scheduledWorkoutStorage } from '../src/features/scheduling/storage/scheduledWorkoutStorage';
import { ScheduledWorkout } from '../src/features/scheduling/types';
import { getWeekDays, formatIsoDate, parseIsoDate, addDaysToIsoDate } from '../src/features/scheduling/utils/dateUtils';
import { UserScope } from '../src/features/auth/utils/userScope';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';

jest.mock('../src/features/scheduling/storage/scheduledWorkoutStorage');
jest.mock('../src/services/sync/syncMetadataStore');
jest.mock('../src/services/sync/syncLifecycleManager', () => ({
  syncLifecycleManager: {
    triggerSync: jest.fn(),
  },
}));

describe('SCHED-3: Calendar UI & Scheduling UX Foundation', () => {
  const mockAuthScope: UserScope = { ownerType: 'authenticated', ownerId: 'user-789' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Date Utilities & Week Strip Generation', () => {
    it('should correctly format and parse ISO dates', () => {
      const d = new Date(2026, 9, 15); // Oct 15 2026
      const formatted = formatIsoDate(d);
      expect(formatted).toBe('2026-10-15');

      const parsed = parseIsoDate('2026-10-15');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(9);
      expect(parsed.getDate()).toBe(15);
    });

    it('should generate 7 week days containing the anchor date', () => {
      const week = getWeekDays('2026-10-15');
      expect(week).toHaveLength(7);
      expect(week.some(w => w.dateStr === '2026-10-15')).toBe(true);
    });

    it('should accurately add days and calculate future week dates', () => {
      expect(addDaysToIsoDate('2026-10-15', 7)).toBe('2026-10-22');
      expect(addDaysToIsoDate('2026-10-31', 1)).toBe('2026-11-01');
    });
  });

  describe('2. Scheduled Workout Repository CRUD for UI', () => {
    it('should create a scheduled workout and mark pending_upload', async () => {
      (scheduledWorkoutStorage.saveScheduledWorkout as jest.Mock).mockResolvedValue(undefined);
      (syncMetadataStore.markPendingUpload as jest.Mock).mockResolvedValue(undefined);

      const created = await scheduledWorkoutRepository.createScheduledWorkout(
        {
          name: 'Hypertrophy Legs',
          scheduledDate: '2026-10-15',
          templateId: 'tmpl-101',
          notes: 'Focus on quad depth',
        },
        mockAuthScope
      );

      expect(created.name).toBe('Hypertrophy Legs');
      expect(created.scheduledDate).toBe('2026-10-15');
      expect(created.templateId).toBe('tmpl-101');
      expect(created.status).toBe('scheduled');

      expect(scheduledWorkoutStorage.saveScheduledWorkout).toHaveBeenCalledWith(
        expect.objectContaining({ id: created.id, name: 'Hypertrophy Legs' }),
        mockAuthScope
      );

      expect(syncMetadataStore.markPendingUpload).toHaveBeenCalledWith(
        'scheduled_workout',
        created.id,
        expect.any(String),
        mockAuthScope
      );
    });

    it('should edit / reschedule an existing workout', async () => {
      const existing: ScheduledWorkout = {
        id: 'sched-999',
        name: 'Old Chest Day',
        scheduledDate: '2026-10-15',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientUpdatedAt: new Date().toISOString(),
      };

      (scheduledWorkoutStorage.getScheduledWorkoutById as jest.Mock).mockResolvedValue(existing);

      const updated = await scheduledWorkoutRepository.updateScheduledWorkout(
        {
          id: 'sched-999',
          name: 'Heavy Bench & Chest',
          scheduledDate: '2026-10-16', // Rescheduled
        },
        mockAuthScope
      );

      expect(updated.id).toBe('sched-999');
      expect(updated.name).toBe('Heavy Bench & Chest');
      expect(updated.scheduledDate).toBe('2026-10-16');

      expect(scheduledWorkoutStorage.saveScheduledWorkout).toHaveBeenCalled();
      expect(syncMetadataStore.markPendingUpload).toHaveBeenCalledWith(
        'scheduled_workout',
        'sched-999',
        expect.any(String),
        mockAuthScope
      );
    });

    it('should skip a scheduled workout', async () => {
      const existing: ScheduledWorkout = {
        id: 'sched-888',
        name: 'Shoulders & Arms',
        scheduledDate: '2026-10-15',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientUpdatedAt: new Date().toISOString(),
      };

      (scheduledWorkoutStorage.getScheduledWorkoutById as jest.Mock).mockResolvedValue(existing);

      const skipped = await scheduledWorkoutRepository.skipScheduledWorkout('sched-888', mockAuthScope);

      expect(skipped.status).toBe('skipped');
      expect(syncMetadataStore.markPendingUpload).toHaveBeenCalledWith(
        'scheduled_workout',
        'sched-888',
        expect.any(String),
        mockAuthScope
      );
    });

    it('should soft delete (tombstone) a scheduled workout', async () => {
      const existing: ScheduledWorkout = {
        id: 'sched-777',
        name: 'Rest Day Cardio',
        scheduledDate: '2026-10-15',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientUpdatedAt: new Date().toISOString(),
      };

      (scheduledWorkoutStorage.getScheduledWorkoutById as jest.Mock).mockResolvedValue(existing);

      await scheduledWorkoutRepository.deleteScheduledWorkout('sched-777', mockAuthScope);

      expect(scheduledWorkoutStorage.tombstoneScheduledWorkout).toHaveBeenCalledWith('sched-777', mockAuthScope);
      expect(syncMetadataStore.markPendingDelete).toHaveBeenCalledWith(
        'scheduled_workout',
        'sched-777',
        expect.any(String),
        expect.any(String),
        mockAuthScope
      );
    });

    it('should handle multiple schedules on the same date for the selected date UI', async () => {
      const s1: ScheduledWorkout = {
        id: '1',
        name: 'Morning Pull',
        scheduledDate: '2026-10-15',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientUpdatedAt: new Date().toISOString(),
      };
      const s2: ScheduledWorkout = {
        id: '2',
        name: 'Evening Abs',
        scheduledDate: '2026-10-15',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientUpdatedAt: new Date().toISOString(),
      };

      (scheduledWorkoutStorage.getScheduledWorkoutsByDate as jest.Mock).mockResolvedValue([s1, s2]);

      const workouts = await scheduledWorkoutRepository.getScheduledWorkoutsByDate('2026-10-15', mockAuthScope);
      expect(workouts).toHaveLength(2);
      expect(workouts[0].name).toBe('Morning Pull');
      expect(workouts[1].name).toBe('Evening Abs');
    });

    it('should preserve template snapshot metadata on scheduled workouts for View Workout preview', async () => {
      const scheduled: ScheduledWorkout = {
        id: 'sched-555',
        name: 'Upper Power Snapshot',
        scheduledDate: '2026-10-20',
        templateId: 'tmpl-snapshot-123',
        status: 'scheduled',
        notes: 'Bench 225 lbs x 5 reps target',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientUpdatedAt: new Date().toISOString(),
      };

      (scheduledWorkoutStorage.getScheduledWorkoutById as jest.Mock).mockResolvedValue(scheduled);

      const loaded = await scheduledWorkoutRepository.getScheduledWorkoutById('sched-555', mockAuthScope);
      expect(loaded).not.toBeNull();
      expect(loaded?.templateId).toBe('tmpl-snapshot-123');
      expect(loaded?.name).toBe('Upper Power Snapshot');
      expect(loaded?.notes).toContain('Bench 225 lbs');
    });
  });
});
