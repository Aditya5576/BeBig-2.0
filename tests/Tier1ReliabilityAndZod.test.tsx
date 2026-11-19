/**
 * BeBig 2.0 — Tier 1 Reliability, Zod Boundaries & Narrow Selector Verification Suite
 *
 * Verifies:
 * 1. Zod runtime schema validation for untrusted external Wger API payloads.
 * 2. Zod runtime schema validation for local sync metadata storage hydration.
 * 3. Narrow Zustand selector isolation in useAdminAuth preventing superfluous re-renders.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import {
  mapWgerToExercise,
  wgerItemSchema,
} from '../src/features/exercises/providers/wger/wgerMapper';
import {
  syncMetadataStore,
  syncMetadataStateSchema,
  getSyncMetadataKey,
} from '../src/services/sync/syncMetadataStore';
import { platformStorage } from '../src/lib/storage/platformStorage';
import { useAdminAuth } from '../src/hooks/useAdminAuth';
import { useAuthStore } from '../src/features/auth';
import { UserScope } from '../src/features/auth/utils/userScope';

describe('Tier 1 Reliability & Zod Runtime Boundary Validation', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      status: 'unauthenticated',
      isGuest: false,
    });
    platformStorage.clearMemoryCache();
    syncMetadataStore.clearMemoryCache();
  });

  describe('1. Zod Runtime Schema Validation — Wger External API', () => {
    it('accepts and maps valid Wger exercise items cleanly', () => {
      const validPayload = {
        id: 42,
        translations: [
          {
            language: 2,
            name: 'Incline Dumbbell Press',
            description: '<p>Lower with control <strong>to chest</strong>.</p>',
          },
        ],
        category: { id: 1, name: 'Chest' },
        muscles: [{ id: 1, name: 'Pectoralis Major', is_front: true }],
        muscles_secondary: [],
        equipment: [{ id: 3, name: 'Dumbbells' }],
        images: [
          {
            id: 101,
            image: 'https://wger.de/media/ex1.jpg',
            thumbnails: { medium: 'https://wger.de/media/thumb1.jpg' },
            is_main: true,
          },
        ],
      };

      const parseResult = wgerItemSchema.safeParse(validPayload);
      expect(parseResult.success).toBe(true);

      const exercise = mapWgerToExercise(validPayload);
      expect(exercise.id).toBe('wger_42');
      expect(exercise.name).toBe('Incline Dumbbell Press');
      expect(exercise.description).toBe('Lower with control to chest.');
      expect(exercise.category).toBe('chest');
      expect(exercise.sourceProvider).toBe('wger');
      expect(exercise.primaryMuscles).toHaveLength(1);
      expect(exercise.images).toHaveLength(1);
    });

    it('rejects malformed or empty-id Wger items with descriptive error', () => {
      // Missing id
      const missingId = {
        translations: [{ language: 2, name: 'Mystery Exercise' }],
      };
      expect(wgerItemSchema.safeParse(missingId).success).toBe(false);
      expect(() => mapWgerToExercise(missingId)).toThrow(/Invalid Wger item/);

      // Empty string id
      const emptyId = {
        id: '   ',
        translations: [{ language: 2, name: 'Empty ID' }],
      };
      expect(wgerItemSchema.safeParse(emptyId).success).toBe(false);
      expect(() => mapWgerToExercise(emptyId)).toThrow(/Invalid Wger item/);

      // Null or non-object item
      expect(wgerItemSchema.safeParse(null).success).toBe(false);
      expect(() => mapWgerToExercise(null)).toThrow(/Invalid Wger item/);
      expect(() => mapWgerToExercise('invalid string payload')).toThrow(/Invalid Wger item/);
    });

    it('rejects corrupt translation types safely', () => {
      const corruptTranslations = {
        id: 99,
        translations: 'not-an-array',
      };
      const parseResult = wgerItemSchema.safeParse(corruptTranslations);
      expect(parseResult.success).toBe(false);
    });
  });

  describe('2. Zod Runtime Schema Validation — Sync Metadata Hydration', () => {
    const testScope: UserScope = {
      ownerId: 'user_zod_test_123',
      ownerType: 'authenticated',
    };

    it('validates and accepts compliant sync metadata state', () => {
      const validState = {
        records: {
          'workout:wk_1': {
            entityType: 'workout',
            id: 'wk_1',
            clientUpdatedAt: '2026-11-19T10:00:00.000Z',
            deletedAt: null,
            syncStatus: 'synced',
          },
        },
        watermarks: {
          workout: { lastCompletedWatermark: '2026-11-19T10:00:00.000Z', activeCursor: null, hasMore: false },
          template: { lastCompletedWatermark: null, activeCursor: null, hasMore: false },
          custom_exercise: { lastCompletedWatermark: null, activeCursor: null, hasMore: false },
          scheduled_workout: { lastCompletedWatermark: null, activeCursor: null, hasMore: false },
        },
        activeStreamEntity: null,
      };

      const parseResult = syncMetadataStateSchema.safeParse(validState);
      expect(parseResult.success).toBe(true);
    });

    it('falls back safely to initial watermarks when storage contains corrupted schema', async () => {
      const storageKey = getSyncMetadataKey(testScope)!;
      // Write corrupted/poisoned JSON to storage
      await platformStorage.setItem(
        storageKey,
        JSON.stringify({
          records: 'corrupted-non-object',
          watermarks: 42,
        })
      );

      const state = await syncMetadataStore.getState(testScope);
      expect(state).not.toBeNull();
      // Must have gracefully defaulted to initial empty records and valid watermarks
      expect(state?.records).toEqual({});
      expect(state?.watermarks.workout).toBeDefined();
      expect(state?.watermarks.workout.lastCompletedWatermark).toBeNull();
      expect(state?.watermarks.template).toBeDefined();
    });

    it('safely handles missing watermark entities by filling defaults', async () => {
      syncMetadataStore.clearMemoryCache();
      const storageKey = getSyncMetadataKey(testScope)!;
      await platformStorage.setItem(
        storageKey,
        JSON.stringify({
          records: {},
          watermarks: {
            // missing custom_exercise and scheduled_workout
            workout: { lastCompletedWatermark: '2026-11-19T12:00:00.000Z', activeCursor: null, hasMore: false },
          },
        })
      );

      const state = await syncMetadataStore.getState(testScope);
      expect(state?.watermarks.workout.lastCompletedWatermark).toBe('2026-11-19T12:00:00.000Z');
      expect(state?.watermarks.custom_exercise.lastCompletedWatermark).toBeNull();
      expect(state?.watermarks.scheduled_workout.hasMore).toBe(false);
    });
  });

  describe('3. Narrow Zustand Selector Isolation — useAdminAuth', () => {
    it('returns role: none and isLoading: false for unauthenticated users', async () => {
      useAuthStore.setState({
        user: null,
        status: 'unauthenticated',
      });

      let hookOutput: any = null;
      function TestConsumer() {
        hookOutput = useAdminAuth();
        return null;
      }

      await render(<TestConsumer />);
      expect(hookOutput).not.toBeNull();
      expect(hookOutput.role).toBe('none');
      expect(hookOutput.isLoading).toBe(false);
      expect(hookOutput.hasAdminAccess).toBe(false);
    });

    it('does not trigger re-renders when unrelated auth store properties mutate', async () => {
      useAuthStore.setState({
        user: { id: 'admin_user_stable_1', email: 'admin@bebig.app' } as any,
        status: 'authenticated',
        isGuest: false,
      });

      let renderCount = 0;
      let hookOutput: any = null;
      function TestConsumer() {
        renderCount++;
        hookOutput = useAdminAuth();
        return null;
      }

      await render(<TestConsumer />);
      const initialRenders = renderCount;

      // Mutate an unrelated property in useAuthStore (isGuest flag change)
      await act(async () => {
        useAuthStore.setState({ isGuest: true });
      });

      // Hook output must not trigger extra re-renders because user.id and status remained stable
      expect(renderCount).toBe(initialRenders);
    });
  });
});
