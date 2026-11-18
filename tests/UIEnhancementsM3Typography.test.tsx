/**
 * BeBig 2.0 — UI Milestone 3 Typography System Verification Suite
 *
 * Verifies:
 * 1. `FONT_FAMILIES`, `NUMERIC_TABULAR_STYLE`, and `typography` presets expose the expected
 *    `PlusJakartaSans` / `Inter` font family tokens and `tabular-nums` numeric style.
 * 2. `app/_layout.tsx` renders children cleanly without blocking when `useFonts` returns
 *    `[false, new Error('offline')]` (non-blocking offline fallback), and loads only the 7
 *    static TTF weights.
 * 3. `RestTimerOverlay` countdown text (expanded & collapsed) and `ActiveWorkoutTimer` apply
 *    `fontVariant: ['tabular-nums']`.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { render, cleanup, fireEvent, act } from '@testing-library/react-native';
import {
  FONT_FAMILIES,
  NUMERIC_TABULAR_STYLE,
  typography,
} from '../src/theme/typography';
import {
  FONT_FAMILIES as themeFontFamilies,
  NUMERIC_TABULAR_STYLE as themeTabularStyle,
  typography as themeTypography,
} from '../src/constants/theme';
import { RestTimerOverlay } from '../src/features/workout/components/RestTimerOverlay';
import { ActiveWorkoutTimer } from '../src/features/workout/components/ActiveWorkoutTimer';
import { useThemeStore } from '../src/features/theme';
import { ActiveRestTimer } from '../src/features/workout/types';

const mockUseFonts = jest.fn(() => [false, new Error('offline')] as [boolean, Error | null]);

jest.mock('expo-font', () => ({
  useFonts: (...args: unknown[]) => mockUseFonts(...(args as [])),
}));

jest.mock('@expo-google-fonts/plus-jakarta-sans/600SemiBold', () => ({
  PlusJakartaSans_600SemiBold: 101,
}));
jest.mock('@expo-google-fonts/plus-jakarta-sans/700Bold', () => ({
  PlusJakartaSans_700Bold: 102,
}));
jest.mock('@expo-google-fonts/plus-jakarta-sans/800ExtraBold', () => ({
  PlusJakartaSans_800ExtraBold: 103,
}));
jest.mock('@expo-google-fonts/inter/400Regular', () => ({
  Inter_400Regular: 201,
}));
jest.mock('@expo-google-fonts/inter/500Medium', () => ({
  Inter_500Medium: 202,
}));
jest.mock('@expo-google-fonts/inter/600SemiBold', () => ({
  Inter_600SemiBold: 203,
}));
jest.mock('@expo-google-fonts/inter/700Bold', () => ({
  Inter_700Bold: 204,
}));

jest.mock('expo-router', () => {
  const ReactRef = require('react');
  const { View: RNView } = require('react-native');
  const MockStack = ({ children }: { children?: React.ReactNode }) =>
    ReactRef.createElement(RNView, { testID: 'mock-root-stack' }, children);
  MockStack.Screen = () => null;
  return {
    Stack: MockStack,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useSegments: () => ['home'],
    useRootNavigationState: () => ({ key: 'root-nav-ready' }),
  };
});

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../src/services/sync', () => ({
  useSyncLifecycle: jest.fn(),
}));

jest.mock('../src/services/monitoring/errorMonitoring', () => ({
  initErrorMonitoring: jest.fn(),
  wrapRootLayout: <T,>(comp: T): T => comp,
  setUserContext: jest.fn(),
}));

jest.mock('../src/components/navigation', () => ({
  BottomNavBar: () => null,
}));

jest.mock('../src/features/workout/services/workoutNotificationService', () => ({
  workoutNotificationService: {
    ensureNotificationChannel: jest.fn(async () => {}),
  },
}));

jest.mock('../src/components/ui/WebAlertModal', () => ({
  WebAlertModal: () => null,
}));

jest.mock('../src/components/ui/ReleaseNotesModal', () => ({
  ReleaseNotesModal: () => null,
}));

jest.mock('../src/components/ui/StartupSplash', () => {
  const ReactRef = require('react');
  const { View: RNView } = require('react-native');
  return {
    StartupSplash: () => ReactRef.createElement(RNView, { testID: 'mock-startup-splash' }),
  };
});

// Require RootLayout after mocks are registered
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RootLayout = require('../app/_layout').default;

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const createMockRestTimer = (overrides?: Partial<ActiveRestTimer>): ActiveRestTimer => ({
  exerciseId: 'ex_bench',
  exerciseName: 'Barbell Bench Press',
  setNumber: 1,
  targetEndTime: Date.now() + 90_000,
  durationSeconds: 90,
  isPaused: false,
  ...overrides,
});

describe('UI Milestone 3 — Professional Athletic Typography System', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'setInterval').mockImplementation((() => 456) as unknown as typeof setInterval);
    jest.clearAllMocks();
    mockUseFonts.mockReturnValue([false, new Error('offline')]);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  describe('1. Centralized Typography Tokens (`src/theme/typography.ts` & `src/constants/theme.ts`)', () => {
    it('exposes PlusJakartaSans / Inter font families, tabular-nums style, and semantic presets', () => {
      // Display & Headings -> Plus Jakarta Sans
      expect(FONT_FAMILIES.display).toContain('PlusJakartaSans_700Bold');
      expect(FONT_FAMILIES.displayExtraBold).toContain('PlusJakartaSans_800ExtraBold');
      expect(FONT_FAMILIES.heading).toContain('PlusJakartaSans_600SemiBold');

      // Body & UI -> Inter
      expect(FONT_FAMILIES.body).toContain('Inter_400Regular');
      expect(FONT_FAMILIES.bodyMedium).toContain('Inter_500Medium');
      expect(FONT_FAMILIES.bodySemiBold).toContain('Inter_600SemiBold');
      expect(FONT_FAMILIES.bodyBold).toContain('Inter_700Bold');

      // Tabular numerals style
      expect(NUMERIC_TABULAR_STYLE).toEqual({ fontVariant: ['tabular-nums'] });

      // Presets map cleanly to semantic families
      expect(typography.display.fontFamily).toBe(FONT_FAMILIES.displayExtraBold);
      expect(typography.h1.fontFamily).toBe(FONT_FAMILIES.display);
      expect(typography.h2.fontFamily).toBe(FONT_FAMILIES.display);
      expect(typography.h3.fontFamily).toBe(FONT_FAMILIES.heading);
      expect(typography.body.fontFamily).toBe(FONT_FAMILIES.body);
      expect(typography.label.fontFamily).toBe(FONT_FAMILIES.bodyBold);
      expect(typography.caption.fontFamily).toBe(FONT_FAMILIES.body);
      expect(typography.numeric.fontVariant).toEqual(['tabular-nums']);
      expect(typography.numericHero.fontVariant).toEqual(['tabular-nums']);

      // Re-exported cleanly from src/constants/theme.ts
      expect(themeFontFamilies).toBe(FONT_FAMILIES);
      expect(themeTabularStyle).toBe(NUMERIC_TABULAR_STYLE);
      expect(themeTypography).toBe(typography);
    });
  });

  describe('2. Non-Blocking Offline Font Fallback (`app/_layout.tsx`)', () => {
    it('renders root navigation cleanly when useFonts returns [false, Error(offline)] and registers only 7 static weights', async () => {
      useThemeStore.setState({ mode: 'dark', isHydrated: true });
      mockUseFonts.mockReturnValue([false, new Error('offline')]);

      const { findByTestId, queryByTestId } = await render(<RootLayout />);

      // App renders navigation stack cleanly instead of blocking on StartupSplash
      expect(await findByTestId('mock-root-stack')).toBeTruthy();
      expect(queryByTestId('mock-startup-splash')).toBeNull();

      // Strictly 7 static font weights requested (no variable fonts)
      expect(mockUseFonts).toHaveBeenCalled();
      const requestedMap = (mockUseFonts.mock.calls[0] as unknown as [Record<string, unknown>])[0];
      expect(Object.keys(requestedMap).sort()).toEqual([
        'Inter_400Regular',
        'Inter_500Medium',
        'Inter_600SemiBold',
        'Inter_700Bold',
        'PlusJakartaSans_600SemiBold',
        'PlusJakartaSans_700Bold',
        'PlusJakartaSans_800ExtraBold',
      ]);
    });
  });

  describe('3. Tabular Numerals on Timers', () => {
    it('applies tabular-nums and PlusJakartaSans display family on RestTimerOverlay countdown (expanded & collapsed)', async () => {
      const { findByTestId } = await render(
        <RestTimerOverlay
          activeRestTimer={createMockRestTimer()}
          onExtend={jest.fn()}
          onClear={jest.fn()}
          onTogglePause={jest.fn()}
        />,
      );

      const expandedCountdown = await findByTestId('rest-countdown-text');
      const expandedStyle = StyleSheet.flatten(expandedCountdown.props.style);
      expect(expandedStyle.fontVariant).toEqual(['tabular-nums']);
      expect(expandedStyle.fontFamily).toBe(FONT_FAMILIES.display);

      // Collapse pill and verify tabular-nums persists
      await act(async () => {
        fireEvent.press(await findByTestId('rest-timer-collapse-toggle'));
      });

      const collapsedCountdown = await findByTestId('rest-countdown-text');
      const collapsedStyle = StyleSheet.flatten(collapsedCountdown.props.style);
      expect(collapsedStyle.fontVariant).toEqual(['tabular-nums']);
      expect(collapsedStyle.fontFamily).toBe(FONT_FAMILIES.display);
    });

    it('applies tabular-nums on ActiveWorkoutTimer elapsed readout', async () => {
      const { findByTestId } = await render(
        <View>
          <ActiveWorkoutTimer startedAt={new Date(Date.now() - 65_000).toISOString()} />
        </View>,
      );

      const badge = await findByTestId('active-workout-timer');
      const textChild = badge.props.children;
      expect(textChild.props.tabularNums).toBe(true);
      const timerStyle = StyleSheet.flatten(textChild.props.style);
      expect(timerStyle.fontVariant).toEqual(['tabular-nums']);
      expect(timerStyle.fontFamily).toBe(FONT_FAMILIES.bodySemiBold);
    });
  });
});
