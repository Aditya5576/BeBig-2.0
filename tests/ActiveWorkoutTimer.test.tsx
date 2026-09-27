import React from 'react';
import { View } from 'react-native';
import { render, act } from '@testing-library/react-native';
import {
  ActiveWorkoutTimer,
  formatWorkoutDuration,
} from '../src/features/workout/components/ActiveWorkoutTimer';

// Fake component for Babel JSX initialization
export function FakeComp() {
  return <View />;
}

describe('ActiveWorkoutTimer & formatWorkoutDuration (PERF-1)', () => {
  describe('formatWorkoutDuration helper', () => {
    it('formats seconds into MM:SS correctly', () => {
      expect(formatWorkoutDuration(0)).toBe('00:00');
      expect(formatWorkoutDuration(5)).toBe('00:05');
      expect(formatWorkoutDuration(59)).toBe('00:59');
      expect(formatWorkoutDuration(60)).toBe('01:00');
      expect(formatWorkoutDuration(125)).toBe('02:05');
    });

    it('formats hours into H:MM:SS correctly', () => {
      expect(formatWorkoutDuration(3600)).toBe('1:00:00');
      expect(formatWorkoutDuration(3665)).toBe('1:01:05');
      expect(formatWorkoutDuration(7325)).toBe('2:02:05');
    });

    it('handles negative or invalid values gracefully', () => {
      expect(formatWorkoutDuration(-10)).toBe('00:00');
    });
  });

  describe('ActiveWorkoutTimer Component', () => {
    it('renders initial elapsed time calculated from startedAt', async () => {
      const now = Date.now();
      const sixtyFiveSecsAgo = new Date(now - 65 * 1000).toISOString();

      const { getByTestId, getByText, unmount } = await render(
        <ActiveWorkoutTimer startedAt={sixtyFiveSecsAgo} testID="test-timer" />,
      );

      expect(getByTestId('test-timer')).toBeTruthy();
      expect(getByText('⏱ 01:05')).toBeTruthy();
      await unmount();
    });

    it('accounts for accumulatedPauseSeconds correctly', async () => {
      const now = Date.now();
      // Started 100s ago, but paused for 40s -> net elapsed is 60s (01:00)
      const startedAt = new Date(now - 100 * 1000).toISOString();

      const { getByText, unmount } = await render(
        <ActiveWorkoutTimer
          startedAt={startedAt}
          accumulatedPauseSeconds={40}
        />,
      );

      expect(getByText('⏱ 01:00')).toBeTruthy();
      await unmount();
    });

    it('stops ticking and holds fixed elapsed time when pausedAt is set', async () => {
      const now = Date.now();
      const startedAt = new Date(now - 60 * 1000).toISOString();
      const pausedAt = new Date(now - 30 * 1000).toISOString(); // paused 30s after start (elapsed: 30s)

      const { getByText, unmount } = await render(
        <ActiveWorkoutTimer
          startedAt={startedAt}
          pausedAt={pausedAt}
          status="paused"
        />,
      );

      expect(getByText('⏱ 00:30')).toBeTruthy();
      await unmount();
    });

    it('ticks every second using its own isolated interval', async () => {
      jest.useFakeTimers({ now: 1700000000000, advanceTimers: true });

      const startedAt = new Date(1700000000000).toISOString();
      const { getByText, unmount } = await render(
        <ActiveWorkoutTimer startedAt={startedAt} />,
      );

      // Flush mount effects so interval is registered
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      expect(getByText('⏱ 00:00')).toBeTruthy();

      // Advance by 10 seconds
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      expect(getByText('⏱ 00:10')).toBeTruthy();

      // Advance by another 55 seconds (total 65s -> 01:05)
      await act(async () => {
        jest.advanceTimersByTime(55000);
      });

      expect(getByText('⏱ 01:05')).toBeTruthy();

      await unmount();
      jest.useRealTimers();
    });

    it('cleans up its interval timer on unmount', async () => {
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(globalThis as any, 'clearInterval');
      const startedAt = new Date().toISOString();

      const { unmount } = await render(
        <ActiveWorkoutTimer startedAt={startedAt} />,
      );

      // Flush mount effects so interval is registered
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
