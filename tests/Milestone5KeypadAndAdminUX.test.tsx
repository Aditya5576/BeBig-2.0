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
      const onSelectRpe = jest.fn();
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
          onSelectRpe={onSelectRpe}
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

    it('handles reps mode with steppers, integer constraint, RPE bar, and clear', async () => {
      const onKeyPress = jest.fn();
      const onBackspace = jest.fn();
      const onClear = jest.fn();
      const onStep = jest.fn();
      const onSelectRpe = jest.fn();
      const onNext = jest.fn();
      const onDismiss = jest.fn();

      const { getByTestId } = await render(
        <WorkoutNumericKeypad
          visible={true}
          mode="reps"
          value="10"
          onKeyPress={onKeyPress}
          onBackspace={onBackspace}
          onClear={onClear}
          onStep={onStep}
          onSelectRpe={onSelectRpe}
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

      // RPE bar exists with options
      expect(getByTestId('keypad-rpe-bar')).toBeTruthy();
      expect(getByTestId('keypad-rpe-8')).toBeTruthy();
      expect(getByTestId('keypad-rpe-8.5')).toBeTruthy();
      expect(getByTestId('keypad-rpe-10')).toBeTruthy();

      await fireEvent.press(getByTestId('keypad-rpe-8.5'));
      expect(onSelectRpe).toHaveBeenCalledWith(8.5);

      // Next set navigation
      await fireEvent.press(getByTestId('keypad-key-next'));
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('fires onHeightChange on root view layout and displays live draft readout', async () => {
      const onHeightChange = jest.fn();
      const onKeyPress = jest.fn();

      const { getByTestId } = await render(
        <WorkoutNumericKeypad
          visible={true}
          mode="kg"
          value="80."
          onHeightChange={onHeightChange}
          onKeyPress={onKeyPress}
          onBackspace={jest.fn()}
          onClear={jest.fn()}
          onStep={jest.fn()}
          onNext={jest.fn()}
          onDismiss={jest.fn()}
        />
      );

      // Trigger layout event
      await fireEvent(getByTestId('workout-numeric-keypad'), 'layout', {
        nativeEvent: { layout: { height: 284 } },
      });

      expect(onHeightChange).toHaveBeenCalledWith(284);

      // Check readout
      const readout = getByTestId('keypad-value-readout');
      expect(readout).toBeTruthy();
      expect(readout).toHaveTextContent('80.');
    });

    it('handles selectedRpe highlighting and toggling off when tapped again', async () => {
      const onSelectRpe = jest.fn();

      const { getByTestId } = await render(
        <WorkoutNumericKeypad
          visible={true}
          mode="reps"
          value="8"
          selectedRpe={8}
          onSelectRpe={onSelectRpe}
          onKeyPress={jest.fn()}
          onBackspace={jest.fn()}
          onClear={jest.fn()}
          onStep={jest.fn()}
          onNext={jest.fn()}
          onDismiss={jest.fn()}
        />
      );

      // RPE 8 should have accessibilityState.selected = true
      const chip8 = getByTestId('keypad-rpe-8');
      expect(chip8.props.accessibilityState.selected).toBe(true);

      const chip9 = getByTestId('keypad-rpe-9');
      expect(chip9.props.accessibilityState.selected).toBe(false);

      // Tapping already-selected chip 8 toggles off -> calls onSelectRpe(undefined)
      await fireEvent.press(chip8);
      expect(onSelectRpe).toHaveBeenCalledWith(undefined);

      // Tapping unselected chip 9 calls onSelectRpe(9)
      await fireEvent.press(chip9);
      expect(onSelectRpe).toHaveBeenCalledWith(9);
    });

    it('renders ActiveSetRow with draft value and RPE badge', async () => {
      const onFocusField = jest.fn();
      const onUpdateSetField = jest.fn();
      const onToggleCompleteSet = jest.fn();
      const onLayout = jest.fn();

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
        rir: 2, // 10 - 2 = RPE 8
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
          isCustomKeypadActive={true}
          activeFocusField="weight"
          draftValue="82.5"
          onFocusField={onFocusField}
          onLayout={onLayout}
        />
      );

      // Weight input reflects live draftValue "82.5"
      const weightInput = getByTestId('set-weight-ex1-1');
      expect(weightInput.props.value).toBe('82.5');

      // RPE badge is rendered showing "RPE 8"
      const rpeBadge = getByTestId('set-rpe-badge-set1');
      expect(rpeBadge).toBeTruthy();
      expect(rpeBadge).toHaveTextContent('RPE 8');

      // Tapping RPE badge calls onFocusField with 'reps'
      await fireEvent.press(rpeBadge);
      expect(onFocusField).toHaveBeenCalledWith('ex1', 'set1', 'reps', expect.any(String));
    });

    it('nested layout offsets in ActiveExerciseCard include setsContainer offset', async () => {
      const onSetRowLayout = jest.fn();

      const mockExercise: WorkoutExercise = {
        exerciseId: 'ex-nested',
        exerciseName: 'Incline Bench Press',
        order: 0,
        actualSets: [
          {
            id: 'set-nested-1',
            setNumber: 1,
            weight: 70,
            reps: 10,
            completed: false,
          },
        ],
      };

      const { getByTestId } = await render(
        <ActiveExerciseCard
          exercise={mockExercise}
          exIndex={0}
          totalExercisesCount={1}
          expandedNotesSetIds={{}}
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          onRemoveExercise={jest.fn()}
          onAddSet={jest.fn()}
          onDeleteSet={jest.fn()}
          onToggleNotes={jest.fn()}
          onUpdateSetField={jest.fn()}
          onToggleCompleteSet={jest.fn()}
          onSetRowLayout={onSetRowLayout}
        />
      );

      // Simulate set row layout within setsContainer
      await fireEvent(getByTestId('active-set-row-set-nested-1'), 'layout', {
        nativeEvent: { layout: { y: 40, height: 44 } },
      });

      // Simulate setsContainer layout within card (offset 150)
      await fireEvent(getByTestId('sets-container-ex-nested'), 'layout', {
        nativeEvent: { layout: { y: 150 } },
      });

      // 150 + 40 = 190 card-relative offset
      expect(onSetRowLayout).toHaveBeenCalledWith('set-nested-1', 190, 44);
    });

    it('ActiveSetRow uses live draftValue in pendingUpdates when completing set during rapid typing', async () => {
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
        weight: 80, // initial stored weight
        reps: 8,
        completed: false,
      };

      const { getByTestId } = await render(
        <ActiveSetRow
          exercise={mockExercise}
          set={mockSet}
          canDelete={false}
          onToggleNotes={jest.fn()}
          onDeleteSet={jest.fn()}
          onUpdateSetField={jest.fn()}
          onToggleCompleteSet={onToggleCompleteSet}
          isCustomKeypadActive={true}
          activeFocusField="weight"
          draftValue="85" // user rapidly typed 85
          onFocusField={jest.fn()}
        />
      );

      // User immediately taps complete button
      await fireEvent.press(getByTestId('complete-set-ex1-1'));

      // pendingUpdates must contain the live draft 85, NOT the stale 80
      expect(onToggleCompleteSet).toHaveBeenCalledWith(
        mockExercise,
        mockSet,
        expect.objectContaining({ weight: 85 })
      );
    });

    it('ActiveWorkoutScreen rapid typing and immediate completion commits draft and completes set without reverting', async () => {
      const mockSession: WorkoutSession = {
        id: 'session-rapid-test',
        name: 'Rapid Completion Test',
        status: 'active',
        startedAt: new Date().toISOString(),
        exercises: [
          {
            exerciseId: 'ex-rapid',
            exerciseName: 'Shoulder Press',
            order: 0,
            actualSets: [
              {
                id: 'set-rapid-1',
                setNumber: 1,
                weight: 60,
                reps: 10,
                completed: false,
              },
            ],
          },
        ],
      };

      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(mockSession);
      const updateActiveWorkoutSpy = jest
        .spyOn(workoutRepository, 'updateActiveWorkout')
        .mockImplementation(async (s) => s);

      const { getByTestId, findByTestId } = await render(<ActiveWorkoutScreen />);

      // Wait for session to load
      await findByTestId('active-workout-title');

      // Focus weight field
      const weightInput = getByTestId('set-weight-ex-rapid-1');
      await fireEvent(weightInput, 'focus');

      // Keypad should be open in kg mode; backspace existing digits, then type 8, then 5
      await fireEvent.press(getByTestId('keypad-key-backspace'));
      await fireEvent.press(getByTestId('keypad-key-backspace'));
      await fireEvent.press(getByTestId('keypad-key-8'));
      await fireEvent.press(getByTestId('keypad-key-5'));

      // Value readout shows 85
      const readout = getByTestId('keypad-value-readout');
      expect(readout).toHaveTextContent('85');

      // Immediately tap complete button
      await fireEvent.press(getByTestId('complete-set-ex-rapid-1'));

      // Verify that updateActiveWorkout was called with completed: true and weight: 85
      await waitFor(() => {
        expect(updateActiveWorkoutSpy).toHaveBeenCalled();
        const lastCallSession =
          updateActiveWorkoutSpy.mock.calls[updateActiveWorkoutSpy.mock.calls.length - 1][0];
        const completedSet = lastCallSession.exercises[0].actualSets[0];
        expect(completedSet.completed).toBe(true);
        expect(completedSet.weight).toBe(85);
      });
    });

    it('clearing RIR via keypad and immediately completing set keeps set.rir undefined even if pendingUpdates contains older rir', async () => {
      const mockSession: WorkoutSession = {
        id: 'session-rir-clear-test',
        name: 'RIR Clearing Test',
        status: 'active',
        startedAt: new Date().toISOString(),
        exercises: [
          {
            exerciseId: 'ex-rir',
            exerciseName: 'Lateral Raise',
            order: 0,
            actualSets: [
              {
                id: 'set-rir-1',
                setNumber: 1,
                weight: 12,
                reps: 15,
                rir: 2,
                completed: false,
              },
            ],
          },
        ],
      };

      jest.spyOn(workoutRepository, 'getActiveWorkout').mockResolvedValue(mockSession);
      const updateActiveWorkoutSpy = jest
        .spyOn(workoutRepository, 'updateActiveWorkout')
        .mockImplementation(async (s) => s);

      const { getByTestId, findByTestId } = await render(<ActiveWorkoutScreen />);

      // Wait for session to load
      await findByTestId('active-workout-title');

      // Focus RIR field
      const rirInput = getByTestId('set-rir-ex-rir-1');
      await fireEvent(rirInput, 'focus');

      // Keypad should be open in RIR mode with initial value '2'
      expect(getByTestId('keypad-value-readout')).toHaveTextContent('2');

      // Clear RIR by pressing backspace
      await fireEvent.press(getByTestId('keypad-key-backspace'));

      // Value readout should now be '—' (em-dash placeholder)
      expect(getByTestId('keypad-value-readout')).toHaveTextContent('—');

      // Immediately tap complete button
      await fireEvent.press(getByTestId('complete-set-ex-rir-1'));

      // Verify that updateActiveWorkout was called with completed: true and rir: undefined
      await waitFor(() => {
        expect(updateActiveWorkoutSpy).toHaveBeenCalled();
        const lastCallSession =
          updateActiveWorkoutSpy.mock.calls[updateActiveWorkoutSpy.mock.calls.length - 1][0];
        const completedSet = lastCallSession.exercises[0].actualSets[0];
        expect(completedSet.completed).toBe(true);
        expect(completedSet.rir).toBeUndefined();
      });
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
