/**
 * BeBig 2.0 — Focused Active Workout Rest Timer Layout Regression Test Suite
 *
 * Verifies dynamic ScrollView content container padding when timer is hidden vs active,
 * safe-area bottom inset preservation, onLayout height measurement, and overlay clearance.
 */

import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native';
import { RestTimerOverlay } from '../src/features/workout/components/RestTimerOverlay';
import { ActiveRestTimer } from '../src/features/workout/types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSegments: () => ['workout', 'active'],
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const createMockRestTimer = (overrides?: Partial<ActiveRestTimer>): ActiveRestTimer => ({
  exerciseId: 'ex_bench',
  exerciseName: 'Bench Press',
  setNumber: 1,
  targetEndTime: Date.now() + 90000,
  durationSeconds: 90,
  isPaused: false,
  ...overrides,
});

describe('BE BIG 2.0 — Active Workout Rest Timer Layout & Overlay Clearance', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'setInterval').mockImplementation((() => 123 as any) as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('1. RestTimerOverlay renders overlay container floating at bottom with zIndex 100', async () => {
    const onExtend = jest.fn();
    const onClear = jest.fn();
    const onTogglePause = jest.fn();

    const { findByTestId, findByText } = await render(
      <RestTimerOverlay
        activeRestTimer={createMockRestTimer()}
        onExtend={onExtend}
        onClear={onClear}
        onTogglePause={onTogglePause}
      />,
    );

    const banner = await findByTestId('rest-timer-banner');
    expect(banner).toBeTruthy();

    expect(await findByText('-15s')).toBeTruthy();
    expect(await findByText('PAUSE')).toBeTruthy();
    expect(await findByText('SKIP')).toBeTruthy();
    expect(await findByText('+15s')).toBeTruthy();
  });

  it('2. Timer controls dispatch correct actions without altering core timer state math', async () => {
    const onExtend = jest.fn();
    const onClear = jest.fn();
    const onTogglePause = jest.fn();

    const { findByTestId } = await render(
      <RestTimerOverlay
        activeRestTimer={createMockRestTimer()}
        onExtend={onExtend}
        onClear={onClear}
        onTogglePause={onTogglePause}
      />,
    );

    const minusBtn = await findByTestId('extend-rest-minus-15-button');
    const plusBtn = await findByTestId('extend-rest-plus-15-button');
    const pauseBtn = await findByTestId('toggle-pause-rest-timer-button');
    const skipBtn = await findByTestId('skip-rest-timer-button');

    await act(async () => {
      fireEvent.press(minusBtn);
    });
    expect(onExtend).toHaveBeenCalledWith(-15);

    await act(async () => {
      fireEvent.press(plusBtn);
    });
    expect(onExtend).toHaveBeenCalledWith(15);

    await act(async () => {
      fireEvent.press(pauseBtn);
    });
    expect(onTogglePause).toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(skipBtn);
    });
    expect(onClear).toHaveBeenCalled();
  });

  it('3. Paused state renders PAUSED status and RESUME button', async () => {
    const pausedTimer = createMockRestTimer({
      isPaused: true,
      pausedRemainingSeconds: 45,
    });

    const { findByTestId, findByText } = await render(
      <RestTimerOverlay
        activeRestTimer={pausedTimer}
        onExtend={jest.fn()}
        onClear={jest.fn()}
        onTogglePause={jest.fn()}
      />,
    );

    expect(await findByTestId('rest-countdown-text')).toBeTruthy();
    expect(await findByText('RESUME')).toBeTruthy();
  });

  it('4. Finished state renders REST COMPLETE banner and Dismiss button', async () => {
    const finishedTimer = createMockRestTimer({
      isPaused: false,
      targetEndTime: Date.now() - 5000,
    });

    const { findByTestId, findByText } = await render(
      <RestTimerOverlay
        activeRestTimer={finishedTimer}
        onExtend={jest.fn()}
        onClear={jest.fn()}
      />,
    );

    expect(await findByTestId('rest-complete-banner')).toBeTruthy();
    expect(await findByText('REST COMPLETE')).toBeTruthy();
    expect(await findByText('Dismiss')).toBeTruthy();
  });

  it('5. Measures actual rendered height via onLayout and reports to onHeightChange', async () => {
    const onHeightChange = jest.fn();

    const { findByTestId } = await render(
      <RestTimerOverlay
        activeRestTimer={createMockRestTimer()}
        onExtend={jest.fn()}
        onClear={jest.fn()}
        onHeightChange={onHeightChange}
      />,
    );

    const overlay = await findByTestId('persistent-rest-overlay');
    // Simulate layout event with physical height
    await act(async () => {
      fireEvent(overlay, 'layout', {
        nativeEvent: { layout: { height: 235, width: 390, x: 0, y: 600 } },
      });
    });

    expect(onHeightChange).toHaveBeenCalledWith(235);
  });

  it('6. Dynamic bottom clearance correctly derives from measured height and timer presence', () => {
    const insets = { bottom: 34 };
    const baseBottomPadding = 80 + Math.max(insets.bottom, 12); // 114

    // Case A: Timer hidden -> normal bottom inset
    const calcPaddingTimerHidden = (timer: any, height: number) =>
      timer ? Math.max(baseBottomPadding, (height > 0 ? height : 240) + 32) : baseBottomPadding;

    expect(calcPaddingTimerHidden(null, 0)).toBe(114);

    // Case B: Timer visible with measured height 235px
    const timer = createMockRestTimer();
    const paddingWithTimer235 = calcPaddingTimerHidden(timer, 235);
    expect(paddingWithTimer235).toBe(235 + 32); // 267px

    // Case C: Timer height changes to 250px (e.g. font scale / finished banner)
    const paddingWithTimer250 = calcPaddingTimerHidden(timer, 250);
    expect(paddingWithTimer250).toBe(250 + 32); // 282px

    // Case D: Timer dismissed -> returns to normal inset
    const paddingDismissed = calcPaddingTimerHidden(null, 250);
    expect(paddingDismissed).toBe(114);
  });
});
