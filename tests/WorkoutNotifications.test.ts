/**
 * BeBig 2.0 — Workout & Rest Timer Notifications Test Suite
 *
 * Verifies:
 * 1. Rest timer scheduling on native platforms with deadline-based triggers
 * 2. Proper notification content (title, exercise-specific message, channel)
 * 3. Atomic deduplication (old alert cancelled before new alert scheduled)
 * 4. Timer extension cancelling old alert and scheduling replacement with updated seconds
 * 5. Timer pause cancelling scheduled notification
 * 6. Timer resume rescheduling notification for remaining duration
 * 7. Timer clear / skip cancelling scheduled notification
 * 8. Workout finish / discard cancelling scheduled notification
 * 9. Permission denial graceful degradation without crashing workout execution
 * 10. Safe no-op on Web platform
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    DEFAULT: 3,
    HIGH: 4,
    MAX: 5,
  },
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: 'timeInterval',
    DATE: 'date',
  },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue({}),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockImplementation(async () => {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
}));

import {
  workoutNotificationService,
  WORKOUT_NOTIFICATION_CHANNEL_ID,
  WorkoutNotificationService,
} from '../src/features/workout/services/workoutNotificationService';
import { nativeRestTimerService } from '../src/features/workout/services/nativeRestTimerService';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { WorkoutSession } from '../src/features/workout/types';

const createMockSession = (): WorkoutSession => ({
  id: 'workout_notif_test',
  name: 'Chest & Back Hypertrophy',
  startedAt: new Date().toISOString(),
  status: 'active',
  exercises: [
    {
      exerciseId: 'ex_bench',
      exerciseName: 'Barbell Bench Press',
      order: 0,
      actualSets: [
        { id: 'set_1', setNumber: 1, weight: 100, reps: 8, completed: true },
      ],
    },
  ],
  activeRestTimer: null,
});

describe('BE BIG 2.0 — Workout & Rest Timer Completion Notifications', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Notifications.PermissionStatus.GRANTED,
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Notifications.PermissionStatus.GRANTED,
    });
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
    jest.restoreAllMocks();
  });

  describe('1. Rest Timer Scheduling & Payload Structure', () => {
    it('schedules notification with correct title, exercise-specific body, and seconds', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const targetEnd = fixedNow + 90 * 1000;
      const notifId = await workoutNotificationService.scheduleRestTimerNotification({
        exerciseId: 'ex_bench',
        exerciseName: 'Barbell Bench Press',
        setNumber: 1,
        targetEndTime: targetEnd,
        durationSeconds: 90,
      });

      expect(notifId).toBeTruthy();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      const callArgs = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(callArgs.content.title).toBe('Rest Complete');
      expect(callArgs.content.body).toBe(
        'Rest complete for Barbell Bench Press — ready for your next set.'
      );
      expect(callArgs.content.data.type).toBe('rest_timer');
      expect(callArgs.content.data.exerciseId).toBe('ex_bench');
      expect(callArgs.content.data.setNumber).toBe(1);
      expect(callArgs.trigger.type).toBe('timeInterval');
      expect(callArgs.trigger.seconds).toBe(90);
      expect(callArgs.trigger.channelId).toBe(WORKOUT_NOTIFICATION_CHANNEL_ID);
    });

    it('generates a clean generic message when exerciseName is not provided', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      await workoutNotificationService.scheduleRestTimerNotification({
        exerciseId: 'ex_unknown',
        setNumber: 2,
        targetEndTime: fixedNow + 60 * 1000,
        durationSeconds: 60,
      });

      const callArgs = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(callArgs.content.body).toBe('Rest complete — ready for your next set.');
    });

    it('configures Android notification channel with HIGH importance and sound', async () => {
      (Platform as any).OS = 'android';
      const freshService = new WorkoutNotificationService();
      await freshService.ensureNotificationChannel();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        WORKOUT_NOTIFICATION_CHANNEL_ID,
        expect.objectContaining({
          importance: Notifications.AndroidImportance.HIGH,
          name: 'Workout & Rest Timers',
          enableVibrate: true,
          sound: 'default',
        })
      );
    });
  });

  describe('2. Deduplication & Single-Alert Invariant', () => {
    it('cancels previous notification ID before scheduling replacement', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      // First timer start
      const firstId = await workoutNotificationService.scheduleRestTimerNotification({
        exerciseId: 'ex_bench',
        exerciseName: 'Bench Press',
        setNumber: 1,
        targetEndTime: fixedNow + 60 * 1000,
        durationSeconds: 60,
      });

      expect(firstId).toBeTruthy();

      // Second timer start replaces first
      await workoutNotificationService.scheduleRestTimerNotification({
        exerciseId: 'ex_bench',
        exerciseName: 'Bench Press',
        setNumber: 2,
        targetEndTime: fixedNow + 90 * 1000,
        durationSeconds: 90,
      });

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(firstId);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });

    it('sweeps existing scheduled notifications with type rest_timer on cancel', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'orphan_notif_999',
          content: { data: { type: 'rest_timer' } },
        },
        {
          identifier: 'other_notif_123',
          content: { data: { type: 'daily_reminder' } },
        },
      ]);

      await workoutNotificationService.cancelRestTimerNotification();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('orphan_notif_999');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other_notif_123');
    });
  });

  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 30));

  describe('3. Native Timer Service & Workout Lifecycle Integration', () => {
    it('syncRestTimer schedules notification when starting rest timer', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const session = createMockSession();
      const updated = workoutRepository.startRestTimer(
        session,
        'ex_bench',
        1,
        120,
        'Barbell Bench Press'
      );

      expect(updated.activeRestTimer).not.toBeNull();
      await flushPromises();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      const trigger = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].trigger;
      expect(trigger.seconds).toBe(120);
    });

    it('extendRestTimer cancels old notification and reschedules with new deadline', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const session = createMockSession();
      const activeSession = workoutRepository.startRestTimer(session, 'ex_bench', 1, 60, 'Bench');
      await flushPromises();

      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();
      (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();

      // Extend by +30s
      const extended = workoutRepository.extendRestTimer(activeSession, 30);
      expect(extended.activeRestTimer?.durationSeconds).toBe(90);
      await flushPromises();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      const trigger = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].trigger;
      expect(trigger.seconds).toBe(90);
    });

    it('pauseRestTimer cancels the notification alert while timer is paused', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const session = createMockSession();
      const activeSession = workoutRepository.startRestTimer(session, 'ex_bench', 1, 60, 'Bench');
      await flushPromises();

      (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();

      const paused = workoutRepository.pauseRestTimer(activeSession);
      expect(paused.activeRestTimer?.isPaused).toBe(true);
      await flushPromises();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('resumeRestTimer reschedules the notification for remaining seconds', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const session = createMockSession();
      const activeSession = workoutRepository.startRestTimer(session, 'ex_bench', 1, 60, 'Bench');
      await flushPromises();
      const paused = workoutRepository.pauseRestTimer(activeSession);
      await flushPromises();

      (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();

      // 10 seconds later in real life, user hits resume
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow + 10 * 1000);
      const resumed = workoutRepository.resumeRestTimer(paused);
      expect(resumed.activeRestTimer?.isPaused).toBe(false);
      await flushPromises();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const trigger = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0].trigger;
      expect(trigger.seconds).toBe(60); // Resumed with remaining 60s
    });

    it('clearRestTimer cancels the notification immediately', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const session = createMockSession();
      const activeSession = workoutRepository.startRestTimer(session, 'ex_bench', 1, 60, 'Bench');
      await flushPromises();

      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();

      workoutRepository.clearRestTimer(activeSession);
      await flushPromises();
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
    });

    it('completeActiveWorkout cancels active rest timer notification', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const session = createMockSession();
      const activeSession = workoutRepository.startRestTimer(session, 'ex_bench', 1, 60, 'Bench');
      await flushPromises();

      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();

      await workoutRepository.completeActiveWorkout(activeSession);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
    });

    it('discardActiveWorkout cancels active rest timer notification', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const session = createMockSession();
      workoutRepository.startRestTimer(session, 'ex_bench', 1, 60, 'Bench');
      await flushPromises();

      (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockClear();

      await workoutRepository.discardActiveWorkout();
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('4. Permission Handling & Graceful Degradation', () => {
    it('does not throw or disrupt workout flow if permission is denied', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Notifications.PermissionStatus.DENIED,
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Notifications.PermissionStatus.DENIED,
      });

      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const notifId = await workoutNotificationService.scheduleRestTimerNotification({
        exerciseId: 'ex_bench',
        exerciseName: 'Bench Press',
        setNumber: 1,
        targetEndTime: fixedNow + 60 * 1000,
        durationSeconds: 60,
      });

      expect(notifId).toBeNull();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('queries permission status accurately via getPermissionStatus', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Notifications.PermissionStatus.GRANTED,
      });

      const status = await workoutNotificationService.getPermissionStatus();
      expect(status).toBe(Notifications.PermissionStatus.GRANTED);
    });

    it('userInitiated request prompts permissions even if previously prompted', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: Notifications.PermissionStatus.GRANTED,
      });

      const granted = await workoutNotificationService.requestPermissions(true);
      expect(granted).toBe(true);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('5. Generic Workout Timer & Web Fallback', () => {
    it('schedules countdown workout timer alert correctly', async () => {
      const fixedNow = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      const notifId = await workoutNotificationService.scheduleWorkoutTimerNotification({
        id: 'timer_countdown_1',
        title: 'Workout Timer Finished',
        body: '30-minute EMOM completed!',
        targetEndTimeMs: fixedNow + 1800 * 1000,
      });

      expect(notifId).toBeTruthy();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Workout Timer Finished',
            body: '30-minute EMOM completed!',
            data: expect.objectContaining({
              type: 'workout_timer',
              timerId: 'timer_countdown_1',
            }),
          }),
          trigger: expect.objectContaining({
            seconds: 1800,
          }),
        })
      );
    });

    it('safe no-op when running on Web platform', async () => {
      (Platform as any).OS = 'web';

      const res = await workoutNotificationService.scheduleRestTimerNotification({
        exerciseId: 'ex_bench',
        setNumber: 1,
        targetEndTime: Date.now() + 60 * 1000,
        durationSeconds: 60,
      });

      expect(res).toBeNull();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      await workoutNotificationService.cancelRestTimerNotification();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
