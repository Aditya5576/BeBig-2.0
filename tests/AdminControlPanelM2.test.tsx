/**
 * BeBig 2.0 — Admin Control Panel Milestone 2 Verification Suite
 *
 * Verifies:
 * 1. User Directory & Support (Tab 4):
 *    - Live search filters users cleanly by name/email and displays workout counts + admin badge
 *    - Quick `Assign Workout` shortcut jumps to Tab 5 with that athlete pre-selected
 * 2. Trainer Template Builder & Client Assignment (Tab 5):
 *    - Creates a multi-exercise template from catalog exercises (zero bitmaps)
 *    - Assigns selected template to multiple athletes with confirmation banner
 *    - Never mutates personal `templateRepository` or `workoutRepository`
 * 3. Safe Athlete-Side `Assigned by Trainer` Inbox (`app/workout/start.tsx`):
 *    - Shows `Assigned by Trainer` when logged-in user has active assignments
 *    - `Start Assigned Workout` starts a standard active workout without touching personal routines
 *    - Strictly hidden (with zero network calls) for guests and users with zero assignments
 * 4. SQL Migration Safety (`supabase/migrations/20261118_admin_panel_m2.sql`):
 *    - Zero `DROP TABLE`, enforces `is_current_user_admin()` RLS and assignee column protection
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
  sanitizeTrainerExercises,
  AdminDirectoryUser,
  TrainerWorkoutTemplate,
  AssignedWorkoutRecord,
} from '../src/features/admin';
import { templateRepository } from '../src/features/templates';
import { workoutRepository } from '../src/features/workout';
import AdminDashboardScreen from '../app/admin/index';
import StartWorkoutScreen from '../app/workout/start';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const DIRECTORY_USERS: AdminDirectoryUser[] = [
  {
    user_id: 'usr_athlete_1',
    email: 'rohan@bebig.app',
    full_name: 'Rohan Sharma',
    is_admin: false,
    created_at: '2026-09-01T10:00:00.000Z',
    total_workouts: 42,
    last_workout_at: '2026-11-17T18:00:00.000Z',
  },
  {
    user_id: 'usr_athlete_2',
    email: 'meera@bebig.app',
    full_name: 'Meera Patel',
    is_admin: false,
    created_at: '2026-10-05T08:00:00.000Z',
    total_workouts: 11,
    last_workout_at: '2026-11-16T07:30:00.000Z',
  },
  {
    user_id: 'usr_admin_1',
    email: 'aditya@bebig.app',
    full_name: 'Aditya Patil',
    is_admin: true,
    created_at: '2026-08-01T08:00:00.000Z',
    total_workouts: 96,
    last_workout_at: '2026-11-18T06:00:00.000Z',
  },
];

const SAMPLE_ASSIGNMENT: AssignedWorkoutRecord = {
  id: 'assign_001',
  created_at: '2026-11-18T12:00:00.000Z',
  template_id: 'tr_tpl_1',
  assigned_by: 'usr_admin_1',
  assignee_user_id: 'usr_athlete_1',
  title: 'Coach Upper Power',
  trainer_note: 'Keep 2 RIR on bench press and control the eccentric.',
  exercises: [
    {
      exerciseId: 'seed-bench-press',
      exerciseName: 'Barbell Bench Press',
      categoryName: 'Chest',
      sets: 4,
      targetReps: '6-8',
      restTime: 120,
    },
    {
      exerciseId: 'seed-incline-db-press',
      exerciseName: 'Incline Dumbbell Press',
      categoryName: 'Chest',
      sets: 3,
      targetReps: '10-12',
      restTime: 90,
    },
  ],
  status: 'assigned',
  completed_at: null,
  source: 'remote',
};

describe('Admin Control Panel — Milestone 2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_admin_1', email: 'aditya@bebig.app', provider: 'email' },
      isGuest: false,
      guestSession: null,
      error: null,
    });
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  describe('1. User Directory (Tab 4) & Trainer Template Builder / Assignment (Tab 5)', () => {
    it('filters users by search query, shows workout counts, builds a multi-exercise template, and assigns safely without touching personal workouts', async () => {
      jest.spyOn(adminService, 'getOverviewMetrics').mockResolvedValue({
        metrics: {
          total_users: 3,
          workouts_today: 2,
          workouts_this_week: 18,
          total_completed_workouts: 149,
          recent_errors_24h: 0,
          generated_at: '2026-11-18T14:00:00.000Z',
        },
        source: 'live',
      });
      jest.spyOn(adminService, 'getPwaHealthSnapshot').mockResolvedValue({
        appVersion: '2.4.4',
        displayVersion: 'v2.4.4 · prod',
        platform: 'web',
        userAgent: 'TestAgent',
        serviceWorkerStatus: 'Active',
        isOnline: true,
        checkedAt: '2026-11-18T14:00:00.000Z',
      });
      jest.spyOn(adminService, 'getErrorLogs').mockResolvedValue([]);
      jest.spyOn(adminService, 'getAnnouncements').mockResolvedValue([]);
      jest.spyOn(adminService, 'getUserDirectory').mockResolvedValue({
        users: DIRECTORY_USERS,
        source: 'live',
      });
      jest.spyOn(adminService, 'listTrainerTemplates').mockResolvedValue([]);
      jest.spyOn(adminService, 'listAssignedWorkouts').mockResolvedValue([]);

      const saveTrainerSpy = jest
        .spyOn(adminService, 'saveTrainerTemplate')
        .mockImplementation(async (input): Promise<TrainerWorkoutTemplate> => ({
          id: 'tr_tpl_new_1',
          created_at: '2026-11-18T14:10:00.000Z',
          updated_at: '2026-11-18T14:10:00.000Z',
          created_by: input.createdBy ?? null,
          title: input.title,
          description: input.description ?? '',
          focus_tag: input.focus_tag ?? 'Upper',
          exercises: input.exercises,
          source: 'remote',
        }));

      const assignSpy = jest
        .spyOn(adminService, 'assignTemplateToUsers')
        .mockImplementation(async (input): Promise<AssignedWorkoutRecord[]> =>
          input.userIds.map((uid, idx) => ({
            id: `assigned_live_${idx}`,
            created_at: '2026-11-18T14:15:00.000Z',
            template_id: input.templateId,
            assigned_by: input.assignedBy ?? null,
            assignee_user_id: uid,
            title: 'Upper Hypertrophy A',
            trainer_note: input.trainerNote ?? '',
            exercises: [
              {
                exerciseId: 'seed-bench-press',
                exerciseName: 'Barbell Bench Press',
                categoryName: 'Chest',
                sets: 4,
                targetReps: '8-10',
                restTime: 90,
              },
              {
                exerciseId: 'seed-incline-db-press',
                exerciseName: 'Incline Dumbbell Press',
                categoryName: 'Chest',
                sets: 3,
                targetReps: '8-12',
                restTime: 90,
              },
            ],
            status: 'assigned',
            completed_at: null,
            source: 'remote',
          })),
        );

      const personalTplSpy = jest.spyOn(templateRepository, 'createTemplate');
      const startWorkoutSpy = jest.spyOn(workoutRepository, 'startWorkoutFromTemplate');

      const { getByTestId, queryByTestId, findByTestId, getByText } = await render(
        <AdminDashboardScreen />,
      );

      // Switch to Tab 4 — Users
      await fireEvent.press(await findByTestId('admin-tab-users'));
      expect(getByTestId('admin-panel-users')).toBeTruthy();
      expect(getByTestId('admin-user-card-usr_athlete_1')).toBeTruthy();
      expect(getByTestId('admin-user-workouts-usr_athlete_1').props.children.join('')).toContain(
        '42',
      );
      expect(getByTestId('admin-user-card-usr_athlete_2')).toBeTruthy();

      // Search filters cleanly by name/email
      await fireEvent.changeText(getByTestId('admin-user-search-input'), 'rohan');
      expect(getByTestId('admin-user-card-usr_athlete_1')).toBeTruthy();
      expect(queryByTestId('admin-user-card-usr_athlete_2')).toBeNull();

      // Quick Assign shortcut jumps straight to Tab 5 with Rohan pre-selected
      await fireEvent.press(getByTestId('admin-user-assign-usr_athlete_1'));
      expect(getByTestId('admin-panel-templates')).toBeTruthy();

      // Build a multi-exercise trainer template
      await fireEvent.changeText(getByTestId('trainer-tpl-title-input'), 'Upper Hypertrophy A');
      await fireEvent.changeText(
        getByTestId('trainer-tpl-description-input'),
        'Progressive overload focus',
      );
      await fireEvent.press(getByTestId('trainer-catalog-add-seed-bench-press'));
      await fireEvent.press(getByTestId('trainer-catalog-add-seed-incline-db-press'));
      await fireEvent.changeText(getByTestId('trainer-sets-seed-bench-press'), '4');
      await fireEvent.changeText(getByTestId('trainer-reps-seed-bench-press'), '8-10');

      await fireEvent.press(getByTestId('trainer-tpl-save-button'));

      await waitFor(() => {
        expect(saveTrainerSpy).toHaveBeenCalledTimes(1);
        expect(getByTestId('trainer-template-card-tr_tpl_new_1')).toBeTruthy();
      });

      const savedPayload = saveTrainerSpy.mock.calls[0][0];
      expect(savedPayload.title).toBe('Upper Hypertrophy A');
      expect(savedPayload.exercises).toHaveLength(2);
      expect(savedPayload.exercises[0].sets).toBe(4);
      expect(savedPayload.exercises[0].targetReps).toBe('8-10');

      // Select Meera in addition to pre-selected Rohan and assign to both athletes
      await fireEvent.press(getByTestId('assign-select-user-usr_athlete_2'));
      await fireEvent.changeText(
        getByTestId('trainer-assign-note-input'),
        'Complete before Friday',
      );
      await fireEvent.press(getByTestId('trainer-assign-submit-button'));

      await waitFor(() => {
        expect(assignSpy).toHaveBeenCalledWith({
          templateId: 'tr_tpl_new_1',
          userIds: ['usr_athlete_1', 'usr_athlete_2'],
          trainerNote: 'Complete before Friday',
          assignedBy: 'usr_admin_1',
        });
        expect(getByTestId('trainer-assign-confirmation')).toBeTruthy();
        expect(getByText(/Assigned "Upper Hypertrophy A" to 2 athletes/)).toBeTruthy();
      });

      // Mandatory safety invariant: personal templates and active workouts untouched
      expect(personalTplSpy).not.toHaveBeenCalled();
      expect(startWorkoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('2. Safe Athlete-Side Assigned by Trainer Inbox (app/workout/start.tsx)', () => {
    it('displays Assigned by Trainer section when assignments exist and starts an active workout without mutating personal routines', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'usr_athlete_1', email: 'rohan@bebig.app', provider: 'email' },
        isGuest: false,
      });

      jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
      jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
      jest.spyOn(adminService, 'getMyAssignedWorkouts').mockResolvedValue([SAMPLE_ASSIGNMENT]);

      const startFromTemplateSpy = jest
        .spyOn(workoutRepository, 'startWorkoutFromTemplate')
        .mockResolvedValue({
          id: 'workout_assigned_live',
          name: SAMPLE_ASSIGNMENT.title,
          startedAt: '2026-11-18T15:00:00.000Z',
          status: 'active',
          exercises: [],
        });
      const markStatusSpy = jest
        .spyOn(adminService, 'markAssignedWorkoutStatus')
        .mockResolvedValue();
      const createPersonalTemplateSpy = jest.spyOn(templateRepository, 'createTemplate');

      const { findByTestId, getByText } = await render(<StartWorkoutScreen />);

      expect(await findByTestId('assigned-by-trainer-section')).toBeTruthy();
      expect(getByText('Coach Upper Power')).toBeTruthy();
      expect(
        getByText('Keep 2 RIR on bench press and control the eccentric.'),
      ).toBeTruthy();

      await fireEvent.press(await findByTestId('start-assigned-workout-assign_001'));

      await waitFor(() => {
        expect(startFromTemplateSpy).toHaveBeenCalledTimes(1);
        expect(markStatusSpy).toHaveBeenCalledWith('assign_001', 'started');
        expect(mockPush).toHaveBeenCalledWith('/workout/active');
      });

      // Ephemeral template passed to startWorkoutFromTemplate; personal templates untouched
      const passedTemplate = startFromTemplateSpy.mock.calls[0][0];
      expect(passedTemplate.name).toBe('Coach Upper Power');
      expect(passedTemplate.exercises).toHaveLength(2);
      expect(createPersonalTemplateSpy).not.toHaveBeenCalled();
    });

    it('hides Assigned by Trainer section and performs zero queries for guest users', async () => {
      useAuthStore.setState({
        status: 'guest',
        user: null,
        isGuest: true,
      });

      jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
      jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
      const getAssignedSpy = jest.spyOn(adminService, 'getMyAssignedWorkouts');

      const { findByTestId, queryByTestId } = await render(<StartWorkoutScreen />);
      expect(await findByTestId('start-empty-workout-button')).toBeTruthy();
      expect(queryByTestId('assigned-by-trainer-section')).toBeNull();
      expect(getAssignedSpy).not.toHaveBeenCalled();
    });

    it('hides Assigned by Trainer section when logged-in athlete has zero assignments', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'usr_athlete_2', email: 'meera@bebig.app', provider: 'email' },
        isGuest: false,
      });

      jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
      jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
      jest.spyOn(adminService, 'getMyAssignedWorkouts').mockResolvedValue([]);

      const { findByTestId, queryByTestId } = await render(<StartWorkoutScreen />);
      expect(await findByTestId('start-empty-workout-button')).toBeTruthy();
      expect(queryByTestId('assigned-by-trainer-section')).toBeNull();
    });
  });

  describe('3. Exercise Sanitizer & Local M2 SQL Migration Integrity', () => {
    it('strips image/base64 payloads and clamps invalid sets/rest values in trainer exercises', () => {
      const cleaned = sanitizeTrainerExercises([
        {
          exerciseId: 'seed-bench-press',
          exerciseName: 'Barbell Bench Press',
          categoryName: 'Chest',
          sets: 99,
          targetReps: '8-10',
          restTime: 5,
          images: ['data:image/jpeg;base64,HUGE_PAYLOAD'],
          thumbnailUrl: 'data:image/png;base64,HUGE',
        },
      ]);

      expect(cleaned).toHaveLength(1);
      expect(cleaned[0]).toEqual({
        exerciseId: 'seed-bench-press',
        exerciseName: 'Barbell Bench Press',
        categoryName: 'Chest',
        sets: 20,
        targetReps: '8-10',
        restTime: 15,
      });
      expect(Object.keys(cleaned[0])).not.toContain('images');
      expect(Object.keys(cleaned[0])).not.toContain('thumbnailUrl');
    });

    it('contains zero DROP TABLE statements and enforces is_current_user_admin() RLS and assignee column protection', () => {
      const nodeFs = require('fs') as { readFileSync: (p: string, enc: string) => string };
      const nodePath = require('path') as { resolve: (...parts: string[]) => string };
      const sqlPath = nodePath.resolve(
        process.cwd(),
        'supabase/migrations/20261118_admin_panel_m2.sql',
      );
      const sql = nodeFs.readFileSync(sqlPath, 'utf8');

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.trainer_workout_templates');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.assigned_workouts');
      expect(sql).toContain('protect_assigned_workout_assignee_columns');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_admin_user_directory');
      expect(sql).toContain('SECURITY DEFINER');
      expect(sql).toContain('public.is_current_user_admin()');
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
      expect(sql).not.toMatch(/DROP TABLE/i);
    });
  });
});
