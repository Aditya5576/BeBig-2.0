/**
 * BeBig 2.0 — Focused Cross-Platform Rest Timer Test Suite
 *
 * Verifies absolute timestamp countdown calculations, pause/resume behavior,
 * +15/-15 adjustments, background state invariance, native sync payloads,
 * and safe web fallback.
 */

import { Platform } from 'react-native';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { nativeRestTimerService } from '../src/features/workout/services/nativeRestTimerService';
import { WorkoutSession } from '../src/features/workout/types';

const mockWorkoutSession: WorkoutSession = {
  id: 'workout_test_123',
  name: 'Push Day',
  startedAt: new Date().toISOString(),
  status: 'active',
  exercises: [
    {
      exerciseId: 'ex_bench',
      exerciseName: 'Bench Press',
      order: 0,
      actualSets: [
        { id: 'set_1', setNumber: 1, weight: 100, reps: 5, completed: true },
      ],
    },
  ],
  activeRestTimer: null,
};

describe('BE BIG 2.0 — Cross-Platform Rest Timer Engine & Native Surface Sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. Rest start calculates targetEndTime correctly', () => {
    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    const updated = workoutRepository.startRestTimer(
      mockWorkoutSession,
      'ex_bench',
      1,
      90,
      'Bench Press',
    );

    expect(updated.activeRestTimer).not.toBeNull();
    expect(updated.activeRestTimer?.durationSeconds).toBe(90);
    expect(updated.activeRestTimer?.targetEndTime).toBe(startTimeMs + 90 * 1000);
    expect(updated.activeRestTimer?.isPaused).toBe(false);
  });

  it('2. Remaining time derives from targetEndTime', () => {
    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    const sessionWithRest = workoutRepository.startRestTimer(
      mockWorkoutSession,
      'ex_bench',
      1,
      90,
      'Bench Press',
    );

    // Fast-forward 30 seconds
    const elapsed30s = startTimeMs + 30 * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(elapsed30s);

    const remainingSec = Math.ceil((sessionWithRest.activeRestTimer!.targetEndTime - Date.now()) / 1000);
    expect(remainingSec).toBe(60);
  });

  it('3. Pause preserves correct remaining duration', () => {
    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    const sessionWithRest = workoutRepository.startRestTimer(
      mockWorkoutSession,
      'ex_bench',
      1,
      90,
      'Bench Press',
    );

    // Fast-forward 20 seconds, remaining = 70s
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs + 20 * 1000);

    const pausedSession = workoutRepository.pauseRestTimer(sessionWithRest);
    expect(pausedSession.activeRestTimer?.isPaused).toBe(true);
    expect(pausedSession.activeRestTimer?.pausedRemainingSeconds).toBe(70);
  });

  it('4. Resume calculates a new correct targetEndTime', () => {
    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    const sessionWithRest = workoutRepository.startRestTimer(
      mockWorkoutSession,
      'ex_bench',
      1,
      90,
      'Bench Press',
    );

    // Pause at 20s (70s remaining)
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs + 20 * 1000);
    const pausedSession = workoutRepository.pauseRestTimer(sessionWithRest);

    // Spend 300 seconds (5 mins) paused while phone is locked
    const resumeTimeMs = startTimeMs + 320 * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(resumeTimeMs);

    const resumedSession = workoutRepository.resumeRestTimer(pausedSession);
    expect(resumedSession.activeRestTimer?.isPaused).toBe(false);
    expect(resumedSession.activeRestTimer?.targetEndTime).toBe(resumeTimeMs + 70 * 1000);

    const remainingAfterResume = Math.ceil((resumedSession.activeRestTimer!.targetEndTime - Date.now()) / 1000);
    expect(remainingAfterResume).toBe(70);
  });

  it('5. +15 updates targetEndTime correctly', () => {
    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    const sessionWithRest = workoutRepository.startRestTimer(
      mockWorkoutSession,
      'ex_bench',
      1,
      90,
      'Bench Press',
    );

    const extendedSession = workoutRepository.extendRestTimer(sessionWithRest, 15);
    expect(extendedSession.activeRestTimer?.durationSeconds).toBe(105);
    expect(extendedSession.activeRestTimer?.targetEndTime).toBe(startTimeMs + 105 * 1000);
  });

  it('6. -15 updates targetEndTime correctly', () => {
    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    const sessionWithRest = workoutRepository.startRestTimer(
      mockWorkoutSession,
      'ex_bench',
      1,
      90,
      'Bench Press',
    );

    const reducedSession = workoutRepository.extendRestTimer(sessionWithRest, -15);
    expect(reducedSession.activeRestTimer?.durationSeconds).toBe(75);
    expect(reducedSession.activeRestTimer?.targetEndTime).toBe(startTimeMs + 75 * 1000);
  });

  it('7. Skip clears the rest timer', () => {
    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    const sessionWithRest = workoutRepository.startRestTimer(
      mockWorkoutSession,
      'ex_bench',
      1,
      90,
      'Bench Press',
    );

    const clearedSession = workoutRepository.clearRestTimer(sessionWithRest);
    expect(clearedSession.activeRestTimer).toBeNull();
    expect(nativeRestTimerService.getLastSyncedState()).toBeNull();
  });

  it('8. Background/foreground does not reset the timer', () => {
    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    const sessionWithRest = workoutRepository.startRestTimer(
      mockWorkoutSession,
      'ex_bench',
      1,
      90,
      'Bench Press',
    );

    // App goes to background for 45 seconds while phone is locked
    const backgroundReturnMs = startTimeMs + 45 * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(backgroundReturnMs);

    // Derived remaining time after background return
    const remainingOnReturn = Math.ceil((sessionWithRest.activeRestTimer!.targetEndTime - Date.now()) / 1000);
    expect(remainingOnReturn).toBe(45);
    expect(sessionWithRest.activeRestTimer?.targetEndTime).toBe(startTimeMs + 90 * 1000);
  });

  it('9. Native integration receives correct timer state', async () => {
    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    workoutRepository.startRestTimer(
      mockWorkoutSession,
      'ex_bench',
      2,
      60,
      'Bench Press',
    );

    const syncedState = nativeRestTimerService.getLastSyncedState();
    expect(syncedState).not.toBeNull();
    expect(syncedState?.exerciseId).toBe('ex_bench');
    expect(syncedState?.exerciseName).toBe('Bench Press');
    expect(syncedState?.setNumber).toBe(2);
    expect(syncedState?.durationSeconds).toBe(60);
    expect(syncedState?.targetEndTimeMs).toBe(startTimeMs + 60 * 1000);
    expect(syncedState?.isPaused).toBe(false);
  });

  it('10. No native integration is attempted on web', async () => {
    await nativeRestTimerService.cancelRestTimer();
    expect(nativeRestTimerService.getLastSyncedState()).toBeNull();

    const originalOS = Platform.OS;
    Platform.OS = 'web';

    const startTimeMs = 1700000000000;
    jest.spyOn(Date, 'now').mockReturnValue(startTimeMs);

    await nativeRestTimerService.syncRestTimer({
      exerciseId: 'ex_bench',
      exerciseName: 'Bench Press',
      setNumber: 1,
      targetEndTime: startTimeMs + 90000,
      durationSeconds: 90,
    });

    // Web should safely return without setting native synced state
    expect(nativeRestTimerService.getLastSyncedState()).toBeNull();

    Platform.OS = originalOS;
  });
});
