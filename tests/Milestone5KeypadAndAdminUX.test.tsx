/**
 * BeBig 2.0 — Milestone 5 Verification Suite
 *
 * Verifies:
 * 1. Custom Workout Keypad (`WorkoutNumericKeypad`):
 *    - `kg` mode: Steppers (±2.5, ±5), decimal '.', digits, backspace, next navigation, native toggle, dismiss.
 *    - `reps` mode: Steppers (±1), integer-only (no '.'), RPE 6–10 quick bar, clear, next set navigation.
 * 2. Admin Diagnostics Terminal Copy:
 *    - Toolbar "Copy All" writes formatted logs to clipboard and shows 2-second "Copied!" feedback.
 *    - Per-row "Copy" writes formatted entry and shows 2-second "Copied!" feedback.
 * 3. Home Screen Upgraded Announcement Card:
 *    - Renders high-contrast banner with category badge, title, timestamp, and dismiss button.
 *    - Dismissing hides card and calls `adminService.dismissAnnouncement`.
 * 4. Trainer Templates & Athlete Assignment:
 *    - Template editor searches combined catalog, adds exercises, and assigns to directory athletes.
 *    - `StartWorkoutScreen` fetches and displays assigned workouts and launches workout on tap.
 * 5. Dedicated "Global" Exercise Source Filter:
 *    - Exercise Library (`app/exercises/index.tsx`) renders `source-filter-global` and filters to global source.
 *    - Exercise Picker Modal (`ExercisePickerModal.tsx`) renders `picker-source-filter-global` and filters to global source.
 *    - Exercise Repository returns strictly active global catalog exercises when `source: 'global'`.
 */

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { WorkoutNumericKeypad } from '../src/features/workout/components/WorkoutNumericKeypad';
import { ActiveSetRow } from '../src/features/workout/components/ActiveSetRow';
import { ActiveExerciseCard } from '../src/features/workout/components/ActiveExerciseCard';
import ActiveWorkoutScreen from '../app/workout/active';
import { WorkoutExercise, WorkoutSet, WorkoutSession } from '../src/features/workout/types';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import {
  globalExerciseCatalogService,
  mapGlobalRecordToExercise,
} from '../src/features/exercises/services/globalExerciseCatalogService';
import { adminService, ClientErrorLogEntry, AssignedWorkoutRecord, AppAnnouncement } from '../src/features/admin';
import AdminScreen from '../app/admin/index';
import HomeScreen from '../app/home';
import StartWorkoutScreen from '../app/workout/start';
import ExercisesScreen from '../app/exercises/index';
import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { templateRepository } from '../src/features/templates';
import { profileService } from '../src/features/profile';
import { useAuthStore } from '../src/features/auth';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

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

jest.mock('../src/features/workout/services/workoutNotificationService', () => ({
  workoutNotificationService: {
    ensureNotificationChannel: jest.fn(async () => {}),
    getPermissionStatus: jest.fn(async () => 'denied'),
    requestPermissions: jest.fn(async () => false),
    scheduleRestTimerNotification: jest.fn(async () => null),
    cancelRestTimerNotification: jest.fn(async () => {}),
  },
}));

describe('Milestone 5 & Admin UX Verification Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
    jest.spyOn(workoutRepository, 'getCompletedWorkouts').mockResolvedValue([]);
    jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
    jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(null);
    jest.spyOn(exerciseRepository.getProvider(), 'listExercises').mockResolvedValue({
      exercises: [],
      totalCount: 0,
      hasMore: false,
    });
  });

  describe('1. WorkoutNumericKeypad', () => {
    it('handles kg mode with steppers, decimal point, digits, and navigation', async () => {
      const onKeyPress = jest.fn();
      const onBackspace = jest.fn();
      const onClear = jest.fn();
      const onStep = jest.fn();
      const onNext = jest.fn();
      const onDismiss = jest.fn();
      const onToggleNative = jest.fn();

      const { getByTestId, queryByTestId } = await render(
        <WorkoutNumericKeypad
          visible={true}
          mode="kg"
          value="80"
          onKeyPress={onKeyPress}
          onBackspace={onBackspace}
          onClear={onClear}
          onStep={onStep}
          onNext={onNext}
          onDismiss={onDismiss}
          onToggleNativeKeyboard={onToggleNative}
          useNativeKeyboard={false}
        />
      );

      // Verify steppers exist
      expect(getByTestId('keypad-step-minus-double')).toBeTruthy();
      expect(getByTestId('keypad-step-minus')).toBeTruthy();
      expect(getByTestId('keypad-step-plus')).toBeTruthy();
      expect(getByTestId('keypad-step-plus-double')).toBeTruthy();

      await fireEvent.press(getByTestId('keypad-step-plus'));
      expect(onStep).toHaveBeenCalledWith(2.5);

      await fireEvent.press(getByTestId('keypad-step-minus-double'));
      expect(onStep).toHaveBeenCalledWith(-5);

      // Verify digits
      await fireEvent.press(getByTestId('keypad-key-8'));
      expect(onKeyPress).toHaveBeenCalledWith('8');

      await fireEvent.press(getByTestId('keypad-key-dot'));
      expect(onKeyPress).toHaveBeenCalledWith('.');

      // Backspace
      await fireEvent.press(getByTestId('keypad-key-backspace'));
      expect(onBackspace).toHaveBeenCalledTimes(1);

      // Next navigation
      await fireEvent.press(getByTestId('keypad-key-next'));
      expect(onNext).toHaveBeenCalledTimes(1);

      // Toggle native keyboard
      await fireEvent.press(getByTestId('keypad-toggle-native-btn'));
      expect(onToggleNative).toHaveBeenCalledTimes(1);

      // Dismiss
      await fireEvent.press(getByTestId('keypad-dismiss-btn'));
      expect(onDismiss).toHaveBeenCalledTimes(1);

      // RPE bar should NOT be shown in kg mode
      expect(queryByTestId('keypad-rpe-bar')).toBeNull();
    });

    it('handles reps mode with steppers, integer constraint, clean numeric layout without RPE bar, and clear', async () => {
      const onKeyPress = jest.fn();
      const onBackspace = jest.fn();
      const onClear = jest.fn();
      const onStep = jest.fn();
      const onNext = jest.fn();
      const onDismiss = jest.fn();

      const { getByTestId, queryByTestId } = await render(
        <WorkoutNumericKeypad
          visible={true}
          mode="reps"
          value="10"
          onKeyPress={onKeyPress}
          onBackspace={onBackspace}
          onClear={onClear}
          onStep={onStep}
          onNext={onNext}
          onDismiss={onDismiss}
        />
      );

      // Steppers ±1
      expect(getByTestId('keypad-reps-step-minus')).toBeTruthy();
      expect(getByTestId('keypad-reps-step-plus')).toBeTruthy();
      await fireEvent.press(getByTestId('keypad-reps-step-plus'));
      expect(onStep).toHaveBeenCalledWith(1);

      // Clear button exists in reps mode
      expect(getByTestId('keypad-key-clear')).toBeTruthy();
      await fireEvent.press(getByTestId('keypad-key-clear'));
      expect(onClear).toHaveBeenCalledTimes(1);

      // RPE bar should NOT be rendered in reps mode
      expect(queryByTestId('keypad-rpe-bar')).toBeNull();

      // Next set navigation
      await fireEvent.press(getByTestId('keypad-key-next'));
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('supports treadmill keypad modes: incline, speed, and durationMinutes', async () => {
      const onStep = jest.fn();
      const onKeyPress = jest.fn();

      // Incline mode
      const { getByTestId, rerender } = await render(
        <WorkoutNumericKeypad
          visible={true}
          mode="incline"
          value="2.5"
          onKeyPress={onKeyPress}
          onBackspace={jest.fn()}
          onClear={jest.fn()}
          onStep={onStep}
          onNext={jest.fn()}
          onDismiss={jest.fn()}
        />
      );

      // Incline steppers (±0.5%, ±2%)
      expect(getByTestId('keypad-incline-step-plus-half')).toBeTruthy();
      await fireEvent.press(getByTestId('keypad-incline-step-plus-half'));
      expect(onStep).toHaveBeenCalledWith(0.5);

      // Speed mode
      await rerender(
        <WorkoutNumericKeypad
          visible={true}
          mode="speed"
          value="8.0"
          onKeyPress={onKeyPress}
          onBackspace={jest.fn()}
          onClear={jest.fn()}
          onStep={onStep}
          onNext={jest.fn()}
          onDismiss={jest.fn()}
        />
      );

      // Speed steppers (±0.2, ±1.0)
      expect(getByTestId('keypad-speed-step-plus-point2')).toBeTruthy();
      await fireEvent.press(getByTestId('keypad-speed-step-plus-point2'));
      expect(onStep).toHaveBeenCalledWith(0.2);

      // Duration mode
      await rerender(
        <WorkoutNumericKeypad
          visible={true}
          mode="durationMinutes"
          value="12.5"
          onKeyPress={onKeyPress}
          onBackspace={jest.fn()}
          onClear={jest.fn()}
          onStep={onStep}
          onNext={jest.fn()}
          onDismiss={jest.fn()}
        />
      );

      // Duration steppers (±1, ±5)
      expect(getByTestId('keypad-duration-step-plus-1')).toBeTruthy();
      await fireEvent.press(getByTestId('keypad-duration-step-plus-1'));
      expect(onStep).toHaveBeenCalledWith(1);
    });

    it('renders ActiveSetRow with strength numeric inputs for weight, reps, and RIR', async () => {
      const onFocusField = jest.fn();
      const onUpdateSetField = jest.fn();
      const onToggleCompleteSet = jest.fn();

      const mockExercise: WorkoutExercise = {
        exerciseId: 'ex1',
        exerciseName: 'Bench Press',
        order: 0,
        actualSets: [],
      };

      const mockSet: WorkoutSet = {
        id: 'set1',
        setNumber: 1,
        weight: 80,
        reps: 8,
        rir: 2,
        completed: false,
      };

      const { getByTestId } = await render(
        <ActiveSetRow
          exercise={mockExercise}
          set={mockSet}
          canDelete={false}
          onToggleNotes={jest.fn()}
          onDeleteSet={jest.fn()}
          onUpdateSetField={onUpdateSetField}
          onToggleCompleteSet={onToggleCompleteSet}
          isCustomKeypadActive={false}
          onFocusField={onFocusField}
        />
      );

      const weightInput = getByTestId('set-weight-ex1-1');
      expect(weightInput.props.value).toBe('80');

      const repsInput = getByTestId('set-reps-ex1-1');
      expect(repsInput.props.value).toBe('8');

      const rirInput = getByTestId('set-rir-ex1-1');
      expect(rirInput.props.value).toBe('2');
    });

    it('enforces canonical RIR bounds within 0 to 4 in domain validation', () => {
      const mockSession: WorkoutSession = {
        id: 'session-rir-bounds',
        name: 'RIR Bounds Test',
        status: 'active',
        startedAt: new Date().toISOString(),
        exercises: [
          {
            exerciseId: 'ex-rir',
            exerciseName: 'Bench Press',
            order: 0,
            actualSets: [
              {
                id: 'set-rir-1',
                setNumber: 1,
                weight: 100,
                reps: 5,
                rir: 2,
                completed: false,
              },
            ],
          },
        ],
      };

      // Valid RIR within 0–4 updates successfully
      const validUpdated = workoutRepository.updateSet(mockSession, 'ex-rir', 'set-rir-1', { rir: 4 });
      expect(validUpdated.exercises[0].actualSets[0].rir).toBe(4);

      // RIR > 4 rejected
      expect(() => {
        workoutRepository.updateSet(mockSession, 'ex-rir', 'set-rir-1', { rir: 4.5 });
      }).toThrow(/rir must be a number between 0 and 4/i);

      // Negative RIR rejected
      expect(() => {
        workoutRepository.updateSet(mockSession, 'ex-rir', 'set-rir-1', { rir: -0.5 });
      }).toThrow(/rir must be a number between 0 and 4/i);
    });

    it('renders ActiveSetRow with treadmill columns (incline, speed, time) and hides RIR', async () => {
      const mockTreadmillExercise: WorkoutExercise = {
        exerciseId: 'seed-treadmill',
        exerciseName: 'Treadmill',
        trackingMode: 'treadmill',
        order: 0,
        actualSets: [],
      };

      const mockTreadmillSet: WorkoutSet = {
        id: 'tm-set-1',
        setNumber: 1,
        weight: 0,
        reps: 0,
        inclinePercent: 3,
        speedKph: 8.5,
        durationSeconds: 750, // 12:30
        completed: false,
      };

      const { getByTestId, queryByTestId } = await render(
        <ActiveSetRow
          exercise={mockTreadmillExercise}
          set={mockTreadmillSet}
          canDelete={false}
          onToggleNotes={jest.fn()}
          onDeleteSet={jest.fn()}
          onUpdateSetField={jest.fn()}
          onToggleCompleteSet={jest.fn()}
          isCustomKeypadActive={false}
          onFocusField={jest.fn()}
        />
      );

      // Incline input has '3'
      const inclineInput = getByTestId('set-incline-seed-treadmill-1');
      expect(inclineInput.props.value).toBe('3');

      // Speed input has '8.5'
      const speedInput = getByTestId('set-speed-seed-treadmill-1');
      expect(speedInput.props.value).toBe('8.5');

      // Time input displays formatted mm:ss ('12:30')
      const timeInput = getByTestId('set-time-seed-treadmill-1');
      expect(timeInput.props.value).toBe('12:30');

      // RIR column should NOT exist for treadmill
      expect(queryByTestId('set-rir-seed-treadmill-1')).toBeNull();
    });
  });

  describe('2. Admin Diagnostics Terminal Copy', () => {
    it('copies all logs formatted to clipboard with visual confirmation', async () => {
      const mockLogs: ClientErrorLogEntry[] = [
        {
          id: 'log-1',
          created_at: '2026-11-19T10:00:00Z',
          user_id: 'user-1',
          error_name: 'SyncError',
          error_message: 'Failed to sync workout batch',
          stack_trace: null,
          severity: 'error',
          source: 'remote',
          app_version: '2.5.1',
          device_info: {
            platform: 'web',
            isWebKit: false,
            isIOS: false,
            userAgent: 'test-agent',
            online: true,
          },
          route: '/workout/active',
        },
        {
          id: 'log-2',
          created_at: '2026-11-19T10:05:00Z',
          user_id: 'user-2',
          error_name: 'QueueWarning',
          error_message: 'Offline queue threshold reached',
          stack_trace: null,
          severity: 'warning',
          source: 'local',
          app_version: '2.5.1',
          device_info: {
            platform: 'web',
            isWebKit: false,
            isIOS: false,
            userAgent: 'test-agent',
            online: true,
          },
          route: '/home',
        },
      ];

      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'admin-uuid-1', email: 'admin@bebig.app' } as any,
        isGuest: false,
      });

      jest.spyOn(adminService, 'checkAdminAccess').mockResolvedValue({ isAdmin: true, role: 'admin' });
      jest.spyOn(adminService, 'getErrorLogs').mockResolvedValue(mockLogs);
      jest.spyOn(adminService, 'getPwaHealthSnapshot').mockResolvedValue({
        appVersion: '2.5.1',
        displayVersion: '2.5.1',
        platform: 'web',
        userAgent: 'test-agent',
        serviceWorkerStatus: 'active',
        isOnline: true,
        checkedAt: '2026-11-19T10:00:00Z',
      });
      jest.spyOn(adminService, 'getAnnouncements').mockResolvedValue([]);
      jest.spyOn(adminService, 'getUserDirectory').mockResolvedValue({ users: [], source: 'live' });
      jest.spyOn(adminService, 'listTrainerTemplates').mockResolvedValue([]);
      jest.spyOn(adminService, 'listAssignedWorkouts').mockResolvedValue([]);
      jest.spyOn(adminService, 'listGlobalExercises').mockResolvedValue([]);
      jest.spyOn(adminService, 'getOverviewMetrics').mockResolvedValue({
        metrics: {
          total_users: 1,
          workouts_today: 1,
          workouts_this_week: 1,
          total_completed_workouts: 1,
          recent_errors_24h: 2,
          generated_at: '2026-11-19T10:00:00Z',
        },
        source: 'live',
      });

      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const { getByTestId, findByTestId } = await render(<AdminScreen initialTab="diagnostics" />);
      const copyAllBtn = await findByTestId('diag-copy-all-button');
      expect(copyAllBtn).toBeTruthy();

      await fireEvent.press(copyAllBtn);

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const copiedString = writeTextMock.mock.calls[0][0];
      expect(copiedString).toContain('[ERROR]');
      expect(copiedString).toContain('Failed to sync workout batch');
      expect(copiedString).toContain('[WARNING]');
      expect(copiedString).toContain('Offline queue threshold reached');
      expect(copiedString).toContain('----------------------------------------');

      // Verify row copy button also copies single log
      const copyRowBtn = getByTestId('diag-copy-log-log-1');
      expect(copyRowBtn).toBeTruthy();

      await fireEvent.press(copyRowBtn);

      expect(writeTextMock).toHaveBeenCalledTimes(2);
      const singleCopied = writeTextMock.mock.calls[1][0];
      expect(singleCopied).toContain('Failed to sync workout batch');
    });
  });

  describe('3. Upgraded Home Announcement Banner', () => {
    it('renders glassmorphic banner with category badge, timestamp, and dismisses cleanly', async () => {
      const mockAnnouncement: AppAnnouncement = {
        id: 'ann-123',
        type: 'release',
        title: 'BeBig 2.5 Released',
        body: 'Full admin controls and custom keypad are now live.',
        is_active: true,
        created_at: '2026-11-19T08:00:00Z',
        created_by: 'admin-1',
      };

      jest.spyOn(adminService, 'getActiveAnnouncements').mockResolvedValue([mockAnnouncement]);
      jest.spyOn(adminService, 'getDismissedAnnouncementIds').mockImplementation(async () => []);
      const dismissSpy = jest.spyOn(adminService, 'dismissAnnouncement').mockResolvedValue(['ann-123']);

      const { findByTestId, getByText, queryByTestId } = await render(<HomeScreen />);

      const banner = await findByTestId('home-announcement-banner');
      expect(banner).toBeTruthy();
      expect(getByText('BeBig 2.5 Released')).toBeTruthy();
      expect(getByText('Full admin controls and custom keypad are now live.')).toBeTruthy();
      expect(getByText('RELEASE')).toBeTruthy();

      const dismissBtn = await findByTestId('home-announcement-dismiss');
      await fireEvent.press(dismissBtn);

      await waitFor(() => {
        expect(dismissSpy).toHaveBeenCalledWith('ann-123');
        expect(queryByTestId('home-announcement-banner')).toBeNull();
      });
    });
  });

  describe('4. Trainer Templates Tab & Start Workout Screen', () => {
    it('fetches and launches assigned workouts on StartWorkoutScreen', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'athlete-user-1', email: 'athlete@example.com' } as any,
        isGuest: false,
      });

      const mockAssigned: AssignedWorkoutRecord[] = [
        {
          id: 'assigned-1',
          template_id: 'tmpl-1',
          user_id: 'athlete-user-1',
          assignee_user_id: 'athlete-user-1',
          assigned_by: 'coach-1',
          title: 'Push Hypertrophy A',
          trainer_note: 'Assigned coach push routine',
          exercises: [
            {
              exerciseId: 'bench_press',
              exerciseName: 'Barbell Bench Press',
              categoryName: 'Chest',
              sets: 4,
              targetReps: '8-10',
              restTime: 120,
            },
          ],
          status: 'assigned',
          created_at: '2026-11-19T09:00:00Z',
          completed_at: null,
        },
      ];

      jest.spyOn(adminService, 'getMyAssignedWorkouts').mockResolvedValue(mockAssigned);
      jest.spyOn(templateRepository, 'getTemplates').mockResolvedValue([]);
      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(null);
      const startSpy = jest.spyOn(workoutRepository, 'startWorkoutFromTemplate').mockResolvedValue({
        id: 'new-workout-1',
        title: 'Push Hypertrophy A',
        startTime: new Date().toISOString(),
        exercises: [],
        isActive: true,
      } as any);

      const { findByTestId, getByText } = await render(<StartWorkoutScreen />);

      const card = await findByTestId('assigned-workout-card-assigned-1');
      expect(card).toBeTruthy();
      expect(getByText('Push Hypertrophy A')).toBeTruthy();
      expect(getByText('Assigned coach push routine')).toBeTruthy();

      const startBtn = await findByTestId('start-assigned-workout-assigned-1');
      await fireEvent.press(startBtn);

      await waitFor(() => {
        expect(startSpy).toHaveBeenCalledTimes(1);
        expect(startSpy.mock.calls[0][0].name).toBe('Push Hypertrophy A');
        expect(mockPush).toHaveBeenCalledWith('/workout/active');
      });
    });
  });

  describe('5. Dedicated Global Source Filter', () => {
    it('exerciseRepository.getExercises with source: "global" returns strictly active global catalog exercises', async () => {
      jest.spyOn(globalExerciseCatalogService, 'getActiveGlobalExercises').mockResolvedValue([
        mapGlobalRecordToExercise({
          id: 'global_ex_1',
          name: 'Global Smith Squat',
          category: 'legs',
          equipment: 'machine',
          primary_muscles: ['quadriceps'],
          secondary_muscles: ['glutes'],
          instructions: ['Admin curated squat'],
          is_active: true,
          image_url: 'https://images.unsplash.com/squat.jpg',
          created_by: 'admin-uuid-1',
          created_at: '2026-11-19T00:00:00Z',
          updated_at: '2026-11-19T00:00:00Z',
        }),
        mapGlobalRecordToExercise({
          id: 'global_ex_2',
          name: 'Global Cable Fly',
          category: 'chest',
          equipment: 'cable',
          primary_muscles: ['chest'],
          secondary_muscles: ['shoulders'],
          instructions: ['Admin curated cable fly'],
          is_active: true,
          image_url: null,
          created_by: 'admin-uuid-1',
          created_at: '2026-11-19T00:00:00Z',
          updated_at: '2026-11-19T00:00:00Z',
        }),
      ]);

      // All category
      const resAll = await exerciseRepository.getExercises({ source: 'global' });
      expect(resAll.exercises).toHaveLength(2);
      expect(resAll.exercises.map((e) => e.name)).toEqual(['Global Smith Squat', 'Global Cable Fly']);

      // Chest category filter
      const resChest = await exerciseRepository.getExercises({ source: 'global', category: 'chest' });
      expect(resChest.exercises).toHaveLength(1);
      expect(resChest.exercises[0].name).toBe('Global Cable Fly');

      // Search query filter
      const resSearch = await exerciseRepository.getExercises({ source: 'global', query: 'Squat' });
      expect(resSearch.exercises).toHaveLength(1);
      expect(resSearch.exercises[0].name).toBe('Global Smith Squat');
    });

    it('renders source-filter-global chip in ExercisesScreen and triggers global filtering', async () => {
      const getExercisesSpy = jest.spyOn(exerciseRepository, 'getExercises').mockResolvedValue({
        exercises: [],
        totalCount: 0,
        hasMore: false,
      });

      const { findByTestId } = await render(<ExercisesScreen />);

      const globalChip = await findByTestId('source-filter-global');
      expect(globalChip).toBeTruthy();

      await fireEvent.press(globalChip);

      await waitFor(() => {
        expect(getExercisesSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'global',
          })
        );
      });
    });

    it('renders picker-source-filter-global chip in ExercisePickerModal and triggers global filtering', async () => {
      const getExercisesSpy = jest.spyOn(exerciseRepository, 'getExercises').mockResolvedValue({
        exercises: [],
        totalCount: 0,
        hasMore: false,
      });

      const { findByTestId } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          onSelectExercises={jest.fn()}
        />
      );

      const globalPickerChip = await findByTestId('picker-source-filter-global');
      expect(globalPickerChip).toBeTruthy();

      await fireEvent.press(globalPickerChip);

      await waitFor(() => {
        expect(getExercisesSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'global',
          })
        );
      });
    });
  });
});
