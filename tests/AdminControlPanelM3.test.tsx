/**
 * BeBig 2.0 — Admin Control Panel Milestone 3 Verification Suite
 *
 * Verifies:
 * 1. Tab 6 — Global Exercise Catalog Manager (`app/admin/index.tsx` + `AdminExerciseCatalogTab`):
 *    - Creates, edits, toggles Active/Hidden, and searches/filters curated global exercises
 *    - Rejects/strips base64/bitmap image payloads and emits strictly text/metadata-only objects
 * 2. `exerciseRepository` Merge Safety:
 *    - Merges active curated global exercises into `getExercises`, `getExerciseById`, and `getCachedExerciseByIdSync`
 *    - Never overwrites user custom exercises (by ID or name)
 * 3. Athlete Home Announcement Banner (`app/home.tsx`):
 *    - Displays active admin announcement cleanly without images
 *    - Persists per-announcement dismissal across remounts via `platformStorage`
 *    - Renders zero banner when no active announcement exists
 * 4. Local M3 SQL Migration Integrity (`supabase/migrations/20261118_admin_panel_m3.sql`):
 *    - Strictly text/metadata schema, `is_current_user_admin()` RLS, zero `DROP TABLE`
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

import { useAuthStore } from '../src/features/auth';
import {
  adminService,
  globalExerciseCatalogService,
  sanitizeGlobalExerciseInput,
  mapGlobalRecordToExercise,
  GlobalExerciseRecord,
  AppAnnouncement,
} from '../src/features/admin';
import { exerciseRepository } from '../src/features/exercises';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { workoutRepository } from '../src/features/workout';
import { templateRepository } from '../src/features/templates';
import { platformStorage } from '../src/lib/storage';
import AdminDashboardScreen from '../app/admin/index';
import HomeScreen from '../app/home';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('Admin Control Panel — Milestone 3', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    globalExerciseCatalogService._resetForTests();
    await platformStorage.removeItem('bebig.admin.local_global_exercises');
    await platformStorage.removeItem('bebig.home.dismissed_announcements');
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_admin_m3', email: 'admin@bebig.app', provider: 'email' },
      isGuest: false,
      guestSession: null,
      error: null,
    });
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  describe('1. Admin Exercise Catalog Tab (Tab 6) & Bitmap Stripping', () => {
    it('creates, edits, toggles Active/Hidden, and searches curated global exercises', async () => {
      jest.spyOn(adminService, 'getOverviewMetrics').mockResolvedValue({
        metrics: {
          total_users: 10,
          workouts_today: 1,
          workouts_this_week: 8,
          total_completed_workouts: 50,
          recent_errors_24h: 0,
          generated_at: '2026-11-18T16:00:00.000Z',
        },
        source: 'live',
      });
      jest.spyOn(adminService, 'getPwaHealthSnapshot').mockResolvedValue({
        appVersion: '2.4.4',
        displayVersion: 'v2.4.4 · prod',
        platform: 'web',
        userAgent: 'TestUA',
        serviceWorkerStatus: 'Active',
        isOnline: true,
        checkedAt: '2026-11-18T16:00:00.000Z',
      });
      jest.spyOn(adminService, 'getErrorLogs').mockResolvedValue([]);
      jest.spyOn(adminService, 'getAnnouncements').mockResolvedValue([]);
      jest.spyOn(adminService, 'getUserDirectory').mockResolvedValue({
        users: [],
        source: 'live',
      });
      jest.spyOn(adminService, 'listTrainerTemplates').mockResolvedValue([]);
      jest.spyOn(adminService, 'listAssignedWorkouts').mockResolvedValue([]);

      const initialCatalog: GlobalExerciseRecord[] = [
        {
          id: 'gex_existing_1',
          created_at: '2026-11-18T10:00:00.000Z',
          updated_at: '2026-11-18T10:00:00.000Z',
          created_by: 'usr_admin_m3',
          name: 'Cable Bayesian Curl',
          category: 'arms',
          equipment: 'Cable machine',
          primary_muscles: ['Biceps'],
          secondary_muscles: ['Brachialis'],
          instructions: ['Step forward with elbow behind torso', 'Curl smoothly with full stretch'],
          is_active: true,
          source: 'remote',
        },
      ];
      jest.spyOn(adminService, 'listGlobalExercises').mockResolvedValue(initialCatalog);

      const saveSpy = jest
        .spyOn(adminService, 'saveGlobalExercise')
        .mockImplementation(async (input) => ({
          id: input.id ?? 'gex_new_2',
          created_at: '2026-11-18T16:05:00.000Z',
          updated_at: '2026-11-18T16:05:00.000Z',
          created_by: input.createdBy ?? null,
          name: input.name,
          category: input.category as GlobalExerciseRecord['category'],
          equipment: input.equipment ?? 'Machine',
          primary_muscles: input.primary_muscles,
          secondary_muscles: input.secondary_muscles ?? [],
          instructions: input.instructions ?? [],
          is_active: true,
          source: 'remote',
        }));

      const toggleSpy = jest
        .spyOn(adminService, 'toggleGlobalExerciseActive')
        .mockImplementation(async (id, isActive) => ({
          ...initialCatalog[0],
          id,
          name: 'Pendulum Squat Pro',
          category: 'legs',
          equipment: 'Machine',
          primary_muscles: ['Quadriceps', 'Glutes'],
          is_active: isActive,
        }));

      const { findByTestId, getByTestId, queryByTestId, getByText } = await render(
        <AdminDashboardScreen />,
      );

      // Open Tab 6 — Exercise Catalog
      await fireEvent.press(await findByTestId('admin-tab-catalog'));
      expect(getByTestId('admin-panel-catalog')).toBeTruthy();
      expect(getByTestId('global-ex-row-gex_existing_1')).toBeTruthy();

      // Create new curated global exercise
      await fireEvent.changeText(getByTestId('global-ex-name-input'), 'Pendulum Squat');
      await fireEvent.press(getByTestId('global-ex-cat-legs'));
      await fireEvent.changeText(getByTestId('global-ex-equipment-input'), 'Machine');
      await fireEvent.changeText(getByTestId('global-ex-primary-input'), 'Quadriceps, Glutes');
      await fireEvent.changeText(getByTestId('global-ex-secondary-input'), 'Adductors');
      await fireEvent.changeText(
        getByTestId('global-ex-instructions-input'),
        'Brace core firmly\nControl full knee flexion',
      );
      await fireEvent.press(getByTestId('global-ex-save-button'));

      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalledWith({
          id: undefined,
          name: 'Pendulum Squat',
          category: 'legs',
          equipment: 'Machine',
          primary_muscles: ['Quadriceps', 'Glutes'],
          secondary_muscles: ['Adductors'],
          instructions: ['Brace core firmly', 'Control full knee flexion'],
          createdBy: 'usr_admin_m3',
        });
        expect(getByTestId('global-ex-row-gex_new_2')).toBeTruthy();
      });

      // Edit newly created exercise
      await fireEvent.press(getByTestId('global-ex-edit-gex_new_2'));
      await fireEvent.changeText(getByTestId('global-ex-name-input'), 'Pendulum Squat Pro');
      await fireEvent.press(getByTestId('global-ex-save-button'));

      await waitFor(() => {
        expect(saveSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            id: 'gex_new_2',
            name: 'Pendulum Squat Pro',
          }),
        );
      });

      // Toggle Active -> Hidden
      await fireEvent.press(getByTestId('global-ex-toggle-gex_new_2'));
      await waitFor(() => {
        expect(toggleSpy).toHaveBeenCalledWith('gex_new_2', false);
        expect(getByText('HIDDEN')).toBeTruthy();
      });

      // Search filters catalog cleanly
      await fireEvent.changeText(getByTestId('admin-catalog-search-input'), 'pendulum');
      expect(getByTestId('global-ex-row-gex_new_2')).toBeTruthy();
      expect(queryByTestId('global-ex-row-gex_existing_1')).toBeNull();
    });

    it('rejects base64 bitmap image payloads in names and strips any embedded bitmap payloads in instructions', () => {
      expect(() =>
        sanitizeGlobalExerciseInput({
          name: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
          category: 'chest',
          primary_muscles: ['Chest'],
        }),
      ).toThrow(/Bitmap\/base64 image payloads are not permitted/i);

      const clean = sanitizeGlobalExerciseInput({
        name: 'Chest Supported Row',
        category: 'back',
        equipment: 'Machine',
        primary_muscles: ['Lats', 'Rhomboids'],
        instructions: ['Drive elbows back data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
      });

      expect(clean.instructions[0]).toBe('Drive elbows back');

      const mapped = mapGlobalRecordToExercise({
        id: 'uuid_row_1',
        created_at: '2026-11-18T16:00:00.000Z',
        updated_at: '2026-11-18T16:00:00.000Z',
        created_by: null,
        ...clean,
      });

      expect(mapped.id).toBe('global_uuid_row_1');
      expect(mapped.images).toEqual([]);
      expect(mapped.photoPath).toBeNull();
      expect(mapped.isCustom).toBe(false);
    });
  });

  describe('2. exerciseRepository Non-Overwriting Global Merge', () => {
    it('merges active curated global exercises without overwriting user custom exercises', async () => {
      const userCustomExercise = {
        id: 'custom_user_pendulum',
        name: 'Pendulum Squat',
        description: 'My personal gym setup note',
        category: 'legs' as const,
        categoryName: 'Legs',
        primaryMuscles: [{ id: 'm1', name: 'Quads' }],
        secondaryMuscles: [],
        equipment: [{ id: 'eq1', name: 'Machine' }],
        images: [],
        sourceProvider: 'custom' as const,
        isCustom: true,
      };

      jest
        .spyOn(customExerciseStorage, 'getCustomExercises')
        .mockResolvedValue([userCustomExercise]);

      const activeGlobalMapped = [
        mapGlobalRecordToExercise({
          id: 'gex_collision_name',
          created_at: '2026-11-18T16:00:00.000Z',
          updated_at: '2026-11-18T16:00:00.000Z',
          created_by: null,
          name: 'Pendulum Squat',
          category: 'legs',
          equipment: 'Machine',
          primary_muscles: ['Quadriceps'],
          secondary_muscles: [],
          instructions: ['Global version'],
          is_active: true,
        }),
        mapGlobalRecordToExercise({
          id: 'gex_unique_1',
          created_at: '2026-11-18T16:00:00.000Z',
          updated_at: '2026-11-18T16:00:00.000Z',
          created_by: null,
          name: 'Meadows Row',
          category: 'back',
          equipment: 'Barbell',
          primary_muscles: ['Latissimus Dorsi'],
          secondary_muscles: ['Rear Delts'],
          instructions: ['Stand perpendicular to landmine bar', 'Pull elbow high'],
          is_active: true,
        }),
      ];

      jest
        .spyOn(globalExerciseCatalogService, 'getActiveGlobalExercises')
        .mockResolvedValue(activeGlobalMapped);

      const originalProvider = exerciseRepository.getProvider();
      jest.spyOn(originalProvider, 'listExercises').mockResolvedValue({
        exercises: [],
        totalCount: 0,
        hasMore: false,
      });

      const result = await exerciseRepository.getExercises({ limit: 50 });

      // Unique curated global exercise merged cleanly with zero images
      const meadows = result.exercises.find((e) => e.id === 'global_gex_unique_1');
      expect(meadows).toBeDefined();
      expect(meadows?.name).toBe('Meadows Row');
      expect(meadows?.images).toEqual([]);

      // User's custom "Pendulum Squat" is preserved and NOT overwritten by the global one
      const pendulumEntries = result.exercises.filter(
        (e) => e.name.toLowerCase() === 'pendulum squat',
      );
      expect(pendulumEntries).toHaveLength(1);
      expect(pendulumEntries[0].id).toBe('custom_user_pendulum');
      expect(pendulumEntries[0].isCustom).toBe(true);
      expect(pendulumEntries[0].description).toBe('My personal gym setup note');
    });
  });

  describe('3. Athlete Home Announcement Banner & Persistent Dismissal', () => {
    it('renders active announcement banner and persists dismissal per announcement ID', async () => {
      const liveAnnouncement: AppAnnouncement = {
        id: 'ann_release_245',
        created_at: '2026-11-18T15:00:00.000Z',
        title: 'BeBig v2.4.5 Update',
        body: 'New curated exercises and faster offline sync are live.',
        type: 'release',
        is_active: true,
        created_by: 'usr_admin_m3',
        source: 'remote',
      };

      jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
      jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
      jest
        .spyOn(adminService, 'getActiveAnnouncements')
        .mockResolvedValue([liveAnnouncement]);

      // First render: banner is visible
      const firstMount = await render(<HomeScreen />);
      expect(await firstMount.findByTestId('home-announcement-banner')).toBeTruthy();
      expect(firstMount.getByText('BeBig v2.4.5 Update')).toBeTruthy();
      expect(
        firstMount.getByText('New curated exercises and faster offline sync are live.'),
      ).toBeTruthy();

      // Dismiss persists ID in platformStorage and hides banner immediately
      await fireEvent.press(firstMount.getByTestId('home-announcement-dismiss'));
      await waitFor(() => {
        expect(firstMount.queryByTestId('home-announcement-banner')).toBeNull();
      });

      const persistedDismissed = await adminService.getDismissedAnnouncementIds();
      expect(persistedDismissed).toContain('ann_release_245');

      await cleanup();

      // Second mount: dismissed announcement stays hidden cleanly
      const secondMount = await render(<HomeScreen />);
      expect(await secondMount.findByTestId('home-title')).toBeTruthy();
      expect(secondMount.queryByTestId('home-announcement-banner')).toBeNull();
    });

    it('renders zero banner when no active announcement exists', async () => {
      jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
      jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
      jest.spyOn(adminService, 'getActiveAnnouncements').mockResolvedValue([]);

      const { findByTestId, queryByTestId } = await render(<HomeScreen />);
      expect(await findByTestId('home-title')).toBeTruthy();
      expect(queryByTestId('home-announcement-banner')).toBeNull();
    });
  });

  describe('4. Local M3 SQL Migration Safety Check', () => {
    it('creates strictly text/metadata global_exercise_catalog with RLS and zero DROP TABLE', () => {
      const nodeFs = require('fs') as { readFileSync: (p: string, enc: string) => string };
      const nodePath = require('path') as { resolve: (...parts: string[]) => string };
      const sqlPath = nodePath.resolve(
        process.cwd(),
        'supabase/migrations/20261118_admin_panel_m3.sql',
      );
      const sql = nodeFs.readFileSync(sqlPath, 'utf8');

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.global_exercise_catalog');
      expect(sql).toContain('primary_muscles TEXT[]');
      expect(sql).toContain('secondary_muscles TEXT[]');
      expect(sql).toContain('instructions TEXT[]');
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
      expect(sql).toContain('public.is_current_user_admin()');
      expect(sql).not.toMatch(/DROP TABLE/i);
      expect(sql).not.toMatch(/image_url|photo_url|base64/i);
    });
  });
});
