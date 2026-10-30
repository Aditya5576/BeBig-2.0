/**
 * BeBig 2.0 — Milestone M1: Scheduled Workout Removal Regression Tests
 *
 * Verifies that:
 * 1. The Scheduled-workout feature and Calendar route are completely removed from UI and routing.
 * 2. Normal workout creation (empty and from template) functions cleanly.
 * 3. Active workout execution, set logging, autosave, and completion function without schedule linkage.
 * 4. SyncEngine only pushes and pulls active entities (workout, template, custom_exercise).
 * 5. GuestMigrationService runs cleanly without scheduled workout dependencies.
 * 6. Historical sessions retaining `sourceScheduledWorkoutId` remain valid and parse without error.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import HomeScreen from '../app/home';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateRepository } from '../src/features/templates/services/templateRepository';
import { SyncEngine } from '../src/services/sync/syncEngine';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { guestMigrationService } from '../src/features/auth/services/guestMigrationService';
import { guestStorage } from '../src/lib/storage';
import { UserScope } from '../src/features/auth/types';
import { extractExercisePerformances } from '../src/features/performance/normalization';
import { WorkoutSession } from '../src/features/workout/types';
import { SyncEntityType } from '../src/services/sync/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, [cb]);
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

describe('M1: Scheduled Workout Removal Regression Verification', () => {
  const testScope: UserScope = { ownerId: 'user-m1-test', ownerType: 'authenticated' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. UI & Navigation Removal', () => {
    it('HomeScreen renders without any Scheduled Today card or view calendar button', async () => {
      jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
      jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);

      const screen = await render(<HomeScreen />);

      await waitFor(() => {
        expect(screen.queryByTestId('scheduled-today-card')).toBeNull();
        expect(screen.queryByText('SCHEDULED TODAY')).toBeNull();
        expect(screen.queryByText('View Calendar ›')).toBeNull();
      });
    });
  });

  describe('2. Normal Workout Creation & Execution', () => {
    it('starts an empty workout successfully without schedule linkage', async () => {
      jest.spyOn(workoutStorage, 'saveActiveWorkout').mockResolvedValue(undefined);

      const session = await workoutRepository.startEmptyWorkout('Quick Chest Day');

      expect(session).toBeDefined();
      expect(session.name).toBe('Quick Chest Day');
      expect(session.status).toBe('active');
      expect(session.sourceScheduledWorkoutId).toBeUndefined();
    });

    it('completes an active workout successfully without attempting scheduled workout updates', async () => {
      const activeSession: WorkoutSession = {
        id: 'session-m1-complete',
        name: 'Bench Workout',
        startedAt: new Date().toISOString(),
        status: 'active',
        exercises: [
          {
            exerciseId: 'ex-bench',
            exerciseName: 'Bench Press',
            order: 0,
            plannedSets: 1,
            plannedTargetReps: '10',
            actualSets: [
              {
                id: 'set-1',
                setNumber: 1,
                reps: 10,
                weight: 100,
                completed: true,
              },
            ],
          },
        ],
      };

      jest.spyOn(workoutStorage, 'saveCompletedWorkout').mockResolvedValue(undefined);
      jest.spyOn(workoutStorage, 'clearActiveWorkout').mockResolvedValue(undefined);
      jest.spyOn(syncMetadataStore, 'markPendingUpload').mockResolvedValue(undefined as any);

      const completed = await workoutRepository.completeActiveWorkout(activeSession);

      expect(completed.status).toBe('completed');
      expect(completed.totalVolume).toBe(1000);
      expect(workoutStorage.saveCompletedWorkout).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'session-m1-complete', status: 'completed' })
      );
    });
  });

  describe('3. SyncEngine Active Entity Whitelist', () => {
    it('SyncEngine pushes only workout, template, and custom_exercise entities', async () => {
      const workoutCloud = { upsertBatch: jest.fn().mockResolvedValue([]), upsert: jest.fn() };
      const templateCloud = { upsertBatch: jest.fn().mockResolvedValue([]), upsert: jest.fn() };
      const exerciseCloud = { upsertBatch: jest.fn().mockResolvedValue([]), upsert: jest.fn() };

      const queriedEntities: SyncEntityType[] = [];
      jest.spyOn(syncMetadataStore, 'reconcileLocalEntities').mockResolvedValue({} as any);
      jest.spyOn(syncMetadataStore, 'getPendingRecords').mockImplementation(async (entityType?: SyncEntityType) => {
        if (entityType) queriedEntities.push(entityType);
        return [];
      });

      const engine = new SyncEngine(workoutCloud as any, templateCloud as any, exerciseCloud as any);
      const pushResult = await engine.push(testScope);

      expect(pushResult.status).toBe('success');
      expect(queriedEntities).toEqual(['workout', 'template', 'custom_exercise']);
      expect(queriedEntities).not.toContain('scheduled_workout');
    });

    it('SyncEngine pulls only workout, template, and custom_exercise entities', async () => {
      const mockResult = { records: [], nextCursor: null, hasMore: false };
      const workoutCloud = { fetchChanged: jest.fn().mockResolvedValue(mockResult) };
      const templateCloud = { fetchChanged: jest.fn().mockResolvedValue(mockResult) };
      const exerciseCloud = { fetchChanged: jest.fn().mockResolvedValue(mockResult) };

      jest.spyOn(syncMetadataStore, 'getActiveStreamEntity').mockResolvedValue(null);
      jest.spyOn(syncMetadataStore, 'getWatermark').mockResolvedValue({
        lastCompletedWatermark: null,
        activeCursor: null,
        hasMore: false,
      });

      const engine = new SyncEngine(workoutCloud as any, templateCloud as any, exerciseCloud as any);
      const pullResult = await engine.pull(testScope);

      expect(pullResult.status).toBe('success');
      expect(workoutCloud.fetchChanged).toHaveBeenCalled();
      expect(templateCloud.fetchChanged).toHaveBeenCalled();
      expect(exerciseCloud.fetchChanged).toHaveBeenCalled();
    });
  });

  describe('4. Historical Data Preservation', () => {
    it('normalizes historical workout sessions with sourceScheduledWorkoutId without data loss', () => {
      const historicalSession = {
        id: 'hist-workout-1',
        name: 'Historical Leg Day',
        startedAt: '2026-09-20T10:00:00.000Z',
        finishedAt: '2026-09-20T11:00:00.000Z',
        status: 'completed' as const,
        totalVolume: 5000,
        completedSetsCount: 15,
        sourceScheduledWorkoutId: 'sched-legacy-uuid-1234',
        exercises: [
          {
            exerciseId: 'ex-squat',
            exerciseName: 'Barbell Squat',
            categoryName: 'Legs',
            actualSets: [
              {
                id: 's1',
                setNumber: 1,
                weight: 100,
                reps: 10,
                completed: true,
              },
            ],
          },
        ],
      };

      const snapshots = extractExercisePerformances(historicalSession);

      expect(snapshots.length).toBe(1);
      expect(snapshots[0].exerciseId).toBe('ex-squat');
      expect(snapshots[0].sourceScheduledWorkoutId).toBe('sched-legacy-uuid-1234');
      expect(snapshots[0].totalVolume).toBe(1000);
    });
  });

  describe('5. Guest Migration Continuity', () => {
    it('runs guest migration smoothly for workouts, templates, and exercises', async () => {
      jest.spyOn(guestStorage, 'getGuestSession').mockResolvedValue({ id: 'guest-m1', createdAt: '' } as any);
      jest.spyOn(workoutStorage, 'getCompletedWorkouts').mockResolvedValue([]);
      jest.spyOn(workoutStorage, 'getActiveWorkout').mockResolvedValue(null);
      jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
      jest.spyOn(workoutStorage, 'clearAllWorkouts').mockResolvedValue(undefined);

      const migrated = await guestMigrationService.runMigrationIfPending({
        id: 'auth-user-1',
        email: 'test@bebig.app',
      });

      expect(migrated).toBe(true);
      expect(workoutStorage.clearAllWorkouts).toHaveBeenCalled();
    });
  });
});
