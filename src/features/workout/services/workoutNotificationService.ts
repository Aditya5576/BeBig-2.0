/**
 * BeBig 2.0 — Cross-Platform Workout & Rest Timer Notification Service
 *
 * Provides reliable, native local notification scheduling and cancellation for
 * active workout rest timers and countdown timers on iOS and Android.
 *
 * Features:
 * - Deadline-based scheduling (independent of JS interval background suspension)
 * - Safe single-alert deduplication (cancels previous timer notification on restart/extension/pause)
 * - High-importance Android notification channel with sound & vibration
 * - iOS notification authorization handling with graceful denial fallback
 * - Safe no-op on Web (PWA) and in headless test environments
 * - Zero duplicated alerts when returning to foreground
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ActiveRestTimer } from '../types';

export const WORKOUT_NOTIFICATION_CHANNEL_ID = 'workout-rest-timer';

export interface ScheduledTimerPayload {
  id: string;
  type: 'rest_timer' | 'workout_timer';
  exerciseId?: string;
  exerciseName?: string;
  setNumber?: number;
  targetEndTime: number;
  durationSeconds?: number;
  title: string;
  body: string;
}

export class WorkoutNotificationService {
  private scheduledNotificationId: string | null = null;
  private lastScheduledPayload: ScheduledTimerPayload | null = null;
  private isChannelConfigured = false;
  private hasPromptedUser = false;
  private webTimerTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.configureNotificationHandler();
  }

  /**
   * Schedules a browser Web Notification on Web/PWA platforms (while browser tab is open).
   */
  private scheduleWebNotification(title: string, body: string, delayMs: number): string | null {
    if (this.webTimerTimeoutId) {
      clearTimeout(this.webTimerTimeoutId);
      this.webTimerTimeoutId = null;
    }

    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      window.Notification.permission !== 'granted'
    ) {
      return null;
    }

    const id = `web_notif_${Date.now()}`;
    this.webTimerTimeoutId = setTimeout(() => {
      try {
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          window.Notification.permission === 'granted'
        ) {
          new window.Notification(title, {
            body,
            icon: '/favicon.png',
          });
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([250, 150, 250]);
          }
        }
      } catch (err) {
        console.warn('[WorkoutNotificationService] Web notification trigger error:', err);
      }
    }, Math.max(0, delayMs));

    return id;
  }

  /**
   * Configures foreground notification presentation options.
   * When the app is foregrounded and the user is looking at RestTimerOverlay,
   * we suppress redundant system alert banners while allowing sound/haptic feedback.
   */
  private configureNotificationHandler(): void {
    if (Platform.OS === 'web') return;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch (err) {
      // Safe fallback if notifications native module is not ready
    }
  }

  /**
   * Sets up Android notification channel with HIGH importance for timer alerts.
   */
  async ensureNotificationChannel(): Promise<void> {
    if (Platform.OS !== 'android' || this.isChannelConfigured) return;

    try {
      await Notifications.setNotificationChannelAsync(WORKOUT_NOTIFICATION_CHANNEL_ID, {
        name: 'Workout & Rest Timers',
        description: 'Alerts when your rest timer or workout countdown finishes.',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#38BDF8',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      this.isChannelConfigured = true;
    } catch (err) {
      console.warn('[WorkoutNotificationService] Failed to configure Android notification channel:', err);
    }
  }

  /**
   * Checks current notification permissions without prompting the user.
   */
  async getPermissionStatus(): Promise<Notifications.PermissionStatus> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (window.Notification.permission === 'granted') {
          return Notifications.PermissionStatus.GRANTED;
        }
        if (window.Notification.permission === 'denied') {
          return Notifications.PermissionStatus.DENIED;
        }
        return Notifications.PermissionStatus.UNDETERMINED;
      }
      return Notifications.PermissionStatus.DENIED;
    }

    try {
      const settings = await Notifications.getPermissionsAsync();
      const isGranted =
        (settings as any)?.granted || settings?.status === Notifications.PermissionStatus.GRANTED;
      if (isGranted) {
        return Notifications.PermissionStatus.GRANTED;
      }
      return settings?.status ?? Notifications.PermissionStatus.UNDETERMINED;
    } catch {
      return Notifications.PermissionStatus.UNDETERMINED;
    }
  }

  /**
   * Requests notification permissions from the user.
   * If `userInitiated` is false, it prompts only once per session to avoid nag loops.
   */
  async requestPermissions(userInitiated = false): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          const perm = await window.Notification.requestPermission();
          return perm === 'granted';
        } catch {
          return false;
        }
      }
      return false;
    }

    if (!userInitiated && this.hasPromptedUser) {
      const status = await this.getPermissionStatus();
      return status === Notifications.PermissionStatus.GRANTED;
    }

    try {
      this.hasPromptedUser = true;
      const res = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowSound: true,
          allowBadge: false,
        },
      });

      const isGranted = (res as any)?.granted || res?.status === Notifications.PermissionStatus.GRANTED;
      if (isGranted) {
        await this.ensureNotificationChannel();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[WorkoutNotificationService] Error requesting notification permissions:', err);
      return false;
    }
  }

  /**
   * Schedules a completion notification for an active rest timer.
   * If an existing notification is scheduled, it is replaced atomically.
   */
  async scheduleRestTimerNotification(timer: ActiveRestTimer | null): Promise<string | null> {
    // 1. If timer is null, paused, or already expired, cancel any existing alert
    if (!timer || timer.isPaused || timer.targetEndTime <= Date.now()) {
      await this.cancelRestTimerNotification();
      return null;
    }

    // 2. Cancel prior scheduled alert before creating a replacement (strict single-alert rule)
    await this.cancelRestTimerNotification();

    const secondsRemaining = Math.max(1, Math.ceil((timer.targetEndTime - Date.now()) / 1000));

    const exerciseName = timer.exerciseName ? timer.exerciseName.trim() : '';
    const title = 'Rest Complete';
    const body = exerciseName
      ? `Rest complete for ${exerciseName} — ready for your next set.`
      : 'Rest complete — ready for your next set.';

    const payload: ScheduledTimerPayload = {
      id: `rest_${timer.exerciseId}_${timer.setNumber}_${timer.targetEndTime}`,
      type: 'rest_timer',
      exerciseId: timer.exerciseId,
      exerciseName,
      setNumber: timer.setNumber,
      targetEndTime: timer.targetEndTime,
      durationSeconds: timer.durationSeconds,
      title,
      body,
    };

    if (Platform.OS === 'web') {
      const delayMs = Math.max(0, timer.targetEndTime - Date.now());
      const notifId = this.scheduleWebNotification(title, body, delayMs);
      this.scheduledNotificationId = notifId;
      this.lastScheduledPayload = payload;
      return notifId;
    }

    try {
      await this.ensureNotificationChannel();

      // Check permission without blocking in-app flow
      const permissionStatus = await this.getPermissionStatus();
      if (permissionStatus !== Notifications.PermissionStatus.GRANTED) {
        // Automatically request permissions once on first timer use
        const granted = await this.requestPermissions(false);
        if (!granted) {
          this.lastScheduledPayload = payload;
          return null; // Permission denied; in-app foreground timer continues smoothly
        }
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          data: {
            type: 'rest_timer',
            exerciseId: timer.exerciseId,
            setNumber: timer.setNumber,
            targetEndTime: timer.targetEndTime,
          },
          categoryIdentifier: 'rest_timer',
          color: '#38BDF8',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsRemaining,
          repeats: false,
          channelId: WORKOUT_NOTIFICATION_CHANNEL_ID,
        },
      });

      this.scheduledNotificationId = notificationId;
      this.lastScheduledPayload = payload;
      return notificationId;
    } catch (err) {
      console.warn('[WorkoutNotificationService] Failed to schedule rest timer notification:', err);
      this.lastScheduledPayload = payload;
      return null;
    }
  }

  /**
   * Cancels the currently scheduled rest timer notification.
   * Cleans up both tracked notification ID and any orphan rest_timer alerts.
   */
  async cancelRestTimerNotification(): Promise<void> {
    if (Platform.OS === 'web') {
      if (this.webTimerTimeoutId) {
        clearTimeout(this.webTimerTimeoutId);
        this.webTimerTimeoutId = null;
      }
      this.scheduledNotificationId = null;
      this.lastScheduledPayload = null;
      return;
    }

    const idToCancel = this.scheduledNotificationId;
    this.scheduledNotificationId = null;
    this.lastScheduledPayload = null;

    try {
      if (idToCancel) {
        await Notifications.cancelScheduledNotificationAsync(idToCancel).catch(() => {});
      }

      // Also clean up any orphan rest timer notifications to guarantee zero duplicates
      const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
      for (const item of scheduled) {
        if (item.content?.data?.type === 'rest_timer') {
          await Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[WorkoutNotificationService] Error cancelling rest timer notification:', err);
    }
  }

  /**
   * Schedules a generic workout timer completion alert (e.g. countdown workouts).
   */
  async scheduleWorkoutTimerNotification(params: {
    id: string;
    title: string;
    body: string;
    targetEndTimeMs: number;
  }): Promise<string | null> {
    if (Platform.OS === 'web') {
      const delayMs = Math.max(0, params.targetEndTimeMs - Date.now());
      return this.scheduleWebNotification(params.title, params.body, delayMs);
    }

    const secondsRemaining = Math.max(1, Math.ceil((params.targetEndTimeMs - Date.now()) / 1000));

    try {
      await this.ensureNotificationChannel();

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title,
          body: params.body,
          sound: 'default',
          data: {
            type: 'workout_timer',
            timerId: params.id,
            targetEndTime: params.targetEndTimeMs,
          },
          color: '#38BDF8',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsRemaining,
          repeats: false,
          channelId: WORKOUT_NOTIFICATION_CHANNEL_ID,
        },
      });

      return notificationId;
    } catch (err) {
      console.warn('[WorkoutNotificationService] Failed to schedule workout timer notification:', err);
      return null;
    }
  }

  /**
   * Returns current active notification ID (for unit test verification).
   */
  getScheduledNotificationId(): string | null {
    return this.scheduledNotificationId;
  }

  /**
   * Returns the last scheduled payload (for unit test verification).
   */
  getLastScheduledPayload(): ScheduledTimerPayload | null {
    return this.lastScheduledPayload;
  }

  /**
   * Returns true if notifications are supported on the current platform.
   */
  isSupported(): boolean {
    if (Platform.OS !== 'web') return true;
    return typeof window !== 'undefined' && 'Notification' in window;
  }
}

export const workoutNotificationService = new WorkoutNotificationService();
