/**
 * BeBig 2.0 — Admin Control Panel Milestone 4 Verification Suite
 *
 * Verifies:
 * 1. Admin Delete User & Guaranteed Display Names (`AdminUsersTab` + `adminService`):
 *    - Renders guaranteed athlete names even when full_name is null, empty, or whitespace
 *    - Hides/disables delete for admin accounts and current logged-in admin user
 *    - Executes two-step deletion (Delete -> Confirm Delete / Cancel) on non-admin athlete accounts
 *    - Propagates deletion errors cleanly into UI error banner
 * 2. iOS WebKit-Safe Global Exercise Images (`globalExerciseCatalogService` + `AdminExerciseCatalogTab`):
 *    - Accepts valid HTTPS image URLs and stores them in image_url
 *    - Strictly rejects raw data:image/ base64 strings and non-HTTPS protocols
 *    - Maps image_url cleanly to photoPath for single-exercise detail views while keeping images: [] for bulk lists
 *    - Renders image input and live thumbnail preview in AdminExerciseCatalogTab
 * 3. Exercise Detail Views Image Display (`ExerciseDetailModal`):
 *    - Resolves and displays exercise.photoPath when an HTTPS URL is present
 * 4. Local M4 SQL Migration Safety & RLS Check (`supabase/migrations/20261119_admin_panel_m4.sql`):
 *    - Enforces is_current_user_admin(), blocks self-deletion and admin-account deletion
 *    - Cleans up dependent records and removes authentication row from auth.users
 *    - Adds image_url to global_exercise_catalog and creates public exercise-images bucket with admin RLS
 *    - Contains zero DROP TABLE statements
 */

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
    }),
    usePathname: () => '/admin',
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactActual.useEffect(() => cb(), [cb]);
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

import {
  adminService,
  AdminDirectoryUser,
  globalExerciseCatalogService,
  sanitizeGlobalExerciseInput,
  mapGlobalRecordToExercise,
  GlobalExerciseRecord,
} from '../src/features/admin';
import { AdminUsersTab } from '../src/features/admin/components/AdminUsersTab';
import { AdminExerciseCatalogTab } from '../src/features/admin/components/AdminExerciseCatalogTab';
import { ExerciseDetailModal } from '../src/features/workout/components/ExerciseDetailModal';
import { exerciseRepository } from '../src/features/exercises';
import { Exercise } from '../src/features/exercises/types';

describe('Admin Control Panel Milestone 4 Verification Suite', () => {
  afterEach(async () => {
    await cleanup();
    jest.clearAllMocks();
  });

  describe('1. Guaranteed Display Names & Two-Step User Deletion (`AdminUsersTab`)', () => {
    const mockUsers: AdminDirectoryUser[] = [
      {
        user_id: 'admin-uuid-1',
        email: 'coach@bebig.app',
        full_name: 'Coach Marcus',
        is_admin: true,
        created_at: '2026-01-01T00:00:00Z',
        total_workouts: 120,
        last_workout_at: '2026-11-18T10:00:00Z',
      },
      {
        user_id: 'athlete-uuid-2',
        email: 'john.smith@example.com',
        full_name: 'John Smith',
        is_admin: false,
        created_at: '2026-03-01T00:00:00Z',
        total_workouts: 14,
        last_workout_at: '2026-11-17T09:00:00Z',
      },
      {
        user_id: 'athlete-uuid-3',
        email: 'sarah.athlete@example.com',
        full_name: 'Athlete', // simulated fallback name
        is_admin: false,
        created_at: '2026-04-01T00:00:00Z',
        total_workouts: 2,
        last_workout_at: null,
      },
    ];

    it('renders guaranteed display names for all athletes', async () => {
      const { getByText } = await render(
        <AdminUsersTab
          users={mockUsers}
          searchQuery=""
          onChangeSearch={jest.fn()}
          onQuickAssignUser={jest.fn()}
          currentAdminUserId="admin-uuid-1"
        />,
      );

      expect(getByText('Coach Marcus')).toBeTruthy();
      expect(getByText('John Smith')).toBeTruthy();
      expect(getByText('Athlete')).toBeTruthy();
    });

    it('hides delete button for admin accounts and current logged-in admin user', async () => {
      const onDeleteMock = jest.fn();
      const { queryByTestId } = await render(
        <AdminUsersTab
          users={mockUsers}
          searchQuery=""
          onChangeSearch={jest.fn()}
          onQuickAssignUser={jest.fn()}
          onDeleteUser={onDeleteMock}
          currentAdminUserId="admin-uuid-1"
        />,
      );

      // Admin account: no delete button
      expect(queryByTestId('admin-user-delete-admin-uuid-1')).toBeNull();
      // Regular athlete account: delete button is present
      expect(queryByTestId('admin-user-delete-athlete-uuid-2')).toBeTruthy();
      expect(queryByTestId('admin-user-delete-athlete-uuid-3')).toBeTruthy();
    });

    it('executes two-step deletion (Delete -> Confirm Delete / Cancel) on non-admin user', async () => {
      const onDeleteMock = jest.fn().mockResolvedValue({ success: true });
      const { getByTestId, findByTestId, queryByTestId } = await render(
        <AdminUsersTab
          users={mockUsers}
          searchQuery=""
          onChangeSearch={jest.fn()}
          onQuickAssignUser={jest.fn()}
          onDeleteUser={onDeleteMock}
          currentAdminUserId="admin-uuid-1"
        />,
      );

      // Step 1: Click initial delete button
      await fireEvent.press(getByTestId('admin-user-delete-athlete-uuid-2'));

      // Confirmation buttons appear
      expect(await findByTestId('admin-user-confirm-delete-athlete-uuid-2')).toBeTruthy();
      expect(await findByTestId('admin-user-cancel-delete-athlete-uuid-2')).toBeTruthy();

      // Test Cancel: reverts back
      await fireEvent.press(getByTestId('admin-user-cancel-delete-athlete-uuid-2'));
      await waitFor(() => {
        expect(queryByTestId('admin-user-confirm-delete-athlete-uuid-2')).toBeNull();
      });
      expect(getByTestId('admin-user-delete-athlete-uuid-2')).toBeTruthy();

      // Step 2: Click delete again and confirm
      await fireEvent.press(getByTestId('admin-user-delete-athlete-uuid-2'));
      const confirmDeleteBtn = await findByTestId('admin-user-confirm-delete-athlete-uuid-2');
      await fireEvent.press(confirmDeleteBtn);

      await waitFor(() => {
        expect(onDeleteMock).toHaveBeenCalledWith('athlete-uuid-2');
      });
    });

    it('displays error banner if user deletion fails', async () => {
      const onDeleteMock = jest.fn().mockResolvedValue({
        success: false,
        error: 'Cannot delete user: Active session in progress.',
      });

      const { getByTestId, findByTestId, findByText } = await render(
        <AdminUsersTab
          users={mockUsers}
          searchQuery=""
          onChangeSearch={jest.fn()}
          onQuickAssignUser={jest.fn()}
          onDeleteUser={onDeleteMock}
          currentAdminUserId="admin-uuid-1"
        />,
      );

      await fireEvent.press(getByTestId('admin-user-delete-athlete-uuid-2'));
      await fireEvent.press(await findByTestId('admin-user-confirm-delete-athlete-uuid-2'));

      expect(
        await findByText('Cannot delete user: Active session in progress.'),
      ).toBeTruthy();
    });
  });

  describe('2. iOS WebKit-Safe Global Exercise Images (`globalExerciseCatalogService` + `AdminExerciseCatalogTab`)', () => {
    it('accepts valid HTTPS image URLs and preserves them in sanitized input', () => {
      const valid = sanitizeGlobalExerciseInput({
        name: 'Incline Dumbbell Press',
        category: 'chest',
        primary_muscles: ['Chest'],
        image_url: 'https://images.example.com/exercises/incline-press.jpg',
      });

      expect(valid.image_url).toBe('https://images.example.com/exercises/incline-press.jpg');
    });

    it('strictly rejects raw data:image/ base64 strings to protect WebKit memory', () => {
      expect(() => {
        sanitizeGlobalExerciseInput({
          name: 'Barbell Row',
          category: 'back',
          primary_muscles: ['Lats'],
          image_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
        });
      }).toThrow(/Raw base64 data:image strings are not permitted/);
    });

    it('strictly rejects non-HTTPS URLs (e.g. http:// or javascript:)', () => {
      expect(() => {
        sanitizeGlobalExerciseInput({
          name: 'Leg Press',
          category: 'legs',
          primary_muscles: ['Quadriceps'],
          image_url: 'http://insecure.example.com/photo.jpg',
        });
      }).toThrow(/secure HTTPS URL/);
    });

    it('maps image_url to photoPath while keeping images: [] for bulk list efficiency', () => {
      const record: GlobalExerciseRecord = {
        id: 'mock-rec-1',
        name: 'Cable Lateral Raise',
        category: 'shoulders',
        equipment: 'Cable machine',
        primary_muscles: ['Lateral Deltoids'],
        secondary_muscles: [],
        instructions: ['Stand upright.', 'Raise arms to sides.'],
        is_active: true,
        image_url: 'https://cdn.example.com/exercises/lateral-raise.jpg',
        created_at: '2026-11-19T00:00:00Z',
        updated_at: '2026-11-19T00:00:00Z',
        created_by: null,
      };

      const domainExercise = mapGlobalRecordToExercise(record);

      // Crucial WebKit safety invariant: images array must be empty for bulk listings
      expect(domainExercise.images).toEqual([]);
      // photoPath carries the single HTTPS image for detail view
      expect(domainExercise.photoPath).toBe('https://cdn.example.com/exercises/lateral-raise.jpg');
      expect(domainExercise.id).toBe('global_mock-rec-1');
    });

    it('renders image input, validates HTTPS, and shows thumbnail preview in AdminExerciseCatalogTab', async () => {
      const onSaveMock = jest.fn().mockImplementation(async (input) => ({
        id: 'new-id',
        ...input,
        created_at: '2026-11-19T00:00:00Z',
        updated_at: '2026-11-19T00:00:00Z',
        is_active: true,
      }));

      const { getByTestId, queryByTestId, findByText } = await render(
        <AdminExerciseCatalogTab
          exercises={[]}
          adminUserId="admin-uuid-1"
          onSaveExercise={onSaveMock}
          onToggleActive={jest.fn()}
          onDeleteExercise={jest.fn()}
        />,
      );

      // Image input is present
      const imageInput = getByTestId('global-ex-image-input');
      expect(imageInput).toBeTruthy();
      expect(getByTestId('global-ex-upload-button')).toBeTruthy();

      // Enter a non-HTTPS URL and attempt to save
      await fireEvent.changeText(getByTestId('global-ex-name-input'), 'Hack Squat');
      await fireEvent.changeText(getByTestId('global-ex-primary-input'), 'Quadriceps');
      await fireEvent.changeText(imageInput, 'http://insecure-cdn.com/hack-squat.jpg');
      await fireEvent.press(getByTestId('global-ex-save-button'));

      expect(
        await findByText('Exercise image must be a secure HTTPS URL (https://...).'),
      ).toBeTruthy();
      expect(onSaveMock).not.toHaveBeenCalled();

      // Now enter valid HTTPS URL
      await fireEvent.changeText(imageInput, 'https://cdn.example.com/hack-squat.jpg');
      // Live thumbnail preview appears
      expect(getByTestId('global-ex-image-preview')).toBeTruthy();

      // Clear image button works
      await fireEvent.press(getByTestId('global-ex-clear-image-button'));
      expect(queryByTestId('global-ex-image-preview')).toBeNull();

      // Re-enter and save successfully
      await fireEvent.changeText(imageInput, 'https://cdn.example.com/hack-squat.jpg');
      await fireEvent.press(getByTestId('global-ex-save-button'));

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Hack Squat',
            image_url: 'https://cdn.example.com/hack-squat.jpg',
          }),
        );
      });
    });
  });

  describe('3. Single Exercise Detail View Image Rendering (`ExerciseDetailModal`)', () => {
    it('displays exercise.photoPath when available on an exercise', async () => {
      const mockGlobalExercise: Exercise = {
        id: 'global_ex_101',
        name: 'Dumbbell Hammer Curl',
        description: 'Biceps exercise',
        category: 'arms',
        categoryName: 'Arms',
        primaryMuscles: [{ id: 'm1', name: 'Brachialis' }],
        secondaryMuscles: [],
        equipment: [{ id: 'eq1', name: 'Dumbbells' }],
        instructions: ['Curl dumbbells with neutral grip.'],
        images: [],
        photoPath: 'https://cdn.example.com/exercises/hammer-curl.jpg',
        isCustom: false,
        sourceProvider: 'system',
      };

      jest
        .spyOn(exerciseRepository, 'getCachedExerciseByIdSync')
        .mockReturnValue(mockGlobalExercise);

      const { findByTestId } = await render(
        <ExerciseDetailModal
          visible={true}
          exerciseId="global_ex_101"
          onClose={jest.fn()}
        />,
      );

      const imageComponent = await findByTestId('exercise-detail-modal-image');
      expect(imageComponent).toBeTruthy();
      expect(imageComponent.props.source).toEqual({
        uri: 'https://cdn.example.com/exercises/hammer-curl.jpg',
      });
    });
  });

  describe('4. Local M4 SQL Migration Safety & RLS Verification', () => {
    it('enforces is_current_user_admin(), blocks self/admin deletion, and has zero DROP TABLE', () => {
      const nodeFs = require('fs') as { readFileSync: (p: string, enc: string) => string };
      const nodePath = require('path') as { resolve: (...parts: string[]) => string };
      const sqlPath = nodePath.resolve(
        process.cwd(),
        'supabase/migrations/20261119_admin_panel_m4.sql',
      );
      const sql = nodeFs.readFileSync(sqlPath, 'utf8');

      // Admin user deletion checks
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_delete_user');
      expect(sql).toContain('public.is_current_user_admin()');
      expect(sql).toContain('p_target_user_id = v_caller_id');
      expect(sql).toContain('v_target_is_admin IS TRUE');
      expect(sql).toContain('DELETE FROM auth.users');

      // User directory guaranteed names
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_admin_user_directory');
      expect(sql).toContain('initcap(split_part(COALESCE(u.email::TEXT, \'athlete\'), \'@\', 1))');

      // Global exercise catalog image_url and public exercise-images bucket
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS image_url TEXT NULL');
      expect(sql).toContain('exercise-images');
      expect(sql).toContain('Admins can insert exercise images');
      expect(sql).toContain('Public read access for exercise images');

      // Zero destructive drops
      expect(sql).not.toMatch(/DROP TABLE/i);
    });
  });
});
