import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from '../../../components/ui/Text';

export interface ActiveWorkoutTimerProps {
  startedAt: string;
  accumulatedPauseSeconds?: number;
  pausedAt?: string | null;
  status?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Format total seconds into MM:SS or H:MM:SS / HH:MM:SS format.
 */
export function formatWorkoutDuration(totalSec: number): string {
  const safeSec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Isolated active workout elapsed timer component.
 *
 * Maintains its own 1-second interval state and calculates elapsed time from the
 * authoritative workout start timestamp against Date.now(), preventing parent
 * ActiveWorkoutScreen re-renders on each second tick.
 */
export function ActiveWorkoutTimer({
  startedAt,
  accumulatedPauseSeconds = 0,
  pausedAt,
  status = 'active',
  style,
  testID = 'active-workout-timer',
}: ActiveWorkoutTimerProps) {
  const calculateElapsed = (): number => {
    if (!startedAt) return 0;
    const startMs = new Date(startedAt).getTime();
    if (isNaN(startMs)) return 0;
    const pausedSecs = accumulatedPauseSeconds || 0;
    const endMs = pausedAt ? new Date(pausedAt).getTime() : Date.now();
    return Math.max(0, Math.floor((endMs - startMs) / 1000) - pausedSecs);
  };

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(calculateElapsed);

  useEffect(() => {
    // If workout is paused or not active, sync once and avoid running interval
    if (status !== 'active' || pausedAt) {
      setElapsedSeconds(calculateElapsed());
      return;
    }

    // Immediate initial sync
    setElapsedSeconds(calculateElapsed());

    // 1-second interval to tick the display
    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, accumulatedPauseSeconds, pausedAt, status]);

  return (
    <View style={[styles.timerBadge, style]} testID={testID}>
      <Text variant="caption" color="accent" style={styles.timerText}>
        {`⏱ ${formatWorkoutDuration(elapsedSeconds)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  timerText: {
    fontWeight: '700',
  },
});
