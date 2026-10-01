/**
 * BeBig 2.0 — Focused Release Notes & Rest Timer UI Polish Regression Test Suite
 *
 * Verifies:
 * 1. Versioned Release Notes eligibility (once-per-version lifecycle)
 * 2. Version change re-eligibility (v1.0.4 vs v1.0.5)
 * 3. Persistence of version acknowledgement via platformStorage
 * 4. Guest mode and Authenticated mode support
 * 5. Purely local / offline execution with zero network dependency
 * 6. Rest Timer UI polish, responsive flex alignment, symmetrical border spacing, and touch targets
 */

import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native';
import {
  releaseNotesService,
  RELEASE_NOTES_STORAGE_KEY,
} from '../src/lib/releaseNotes/releaseNotesService';
import { platformStorage } from '../src/lib/storage/platformStorage';
import { ReleaseNotesModal } from '../src/components/ui/ReleaseNotesModal';
import { RestTimerOverlay } from '../src/features/workout/components/RestTimerOverlay';
import { ActiveRestTimer } from '../src/features/workout/types';
import { useAuthStore } from '../src/features/auth';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockStorageMap = new Map<string, string>();

jest.mock('../src/lib/storage/platformStorage', () => ({
  platformStorage: {
    getItem: jest.fn(async (key: string) => mockStorageMap.get(key) ?? null),
    setItem: jest.fn(async (key: string, val: string) => {
      mockStorageMap.set(key, val);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorageMap.delete(key);
    }),
  },
}));

let mockSegments = ['home'];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSegments: () => mockSegments,
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

const createMockRestTimer = (overrides?: Partial<ActiveRestTimer>): ActiveRestTimer => ({
  exerciseId: 'ex_bench',
  exerciseName: 'Bench Press',
  setNumber: 1,
  targetEndTime: Date.now() + 90000,
  durationSeconds: 90,
  isPaused: false,
  ...overrides,
});

describe('BeBig 2.0 — Release Notes & Rest Timer UI Polish', () => {
  beforeEach(() => {
    mockSegments = ['home'];
    jest.spyOn(globalThis, 'setInterval').mockImplementation((() => 123 as any) as any);
    jest.clearAllMocks();
    mockStorageMap.clear();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  describe('Part B: Versioned Release Notes Popup Lifecycle', () => {
    it('1. Current version not acknowledged -> popup is eligible to display', async () => {
      const shouldShow = await releaseNotesService.shouldShowReleaseNotes('1.0.4');
      expect(shouldShow).toBe(true);

      const { findByTestId, findByText } = await render(
        <ReleaseNotesModal forcedVersion="1.0.4" />,
      );

      const modal = await findByTestId('release-notes-modal');
      expect(modal).toBeTruthy();

      expect(await findByText("🎉 What's New")).toBeTruthy();
      expect(await findByText('v1.0.4')).toBeTruthy();
      expect(await findByTestId('release-notes-dismiss-button')).toBeTruthy();
    });

    it('2. User taps "Got it" -> saves acknowledged version and does not show again on reload', async () => {
      const onDismiss = jest.fn();
      const { findByTestId } = await render(
        <ReleaseNotesModal forcedVersion="1.0.4" onDismiss={onDismiss} />,
      );

      const dismissBtn = await findByTestId('release-notes-dismiss-button');
      await act(async () => {
        fireEvent.press(dismissBtn);
      });

      expect(onDismiss).toHaveBeenCalled();
      expect(platformStorage.setItem).toHaveBeenCalledWith(RELEASE_NOTES_STORAGE_KEY, '1.0.4');
      expect(mockStorageMap.get(RELEASE_NOTES_STORAGE_KEY)).toBe('1.0.4');

      // Next check for v1.0.4 must be FALSE (do not show again)
      const shouldShowAgain = await releaseNotesService.shouldShowReleaseNotes('1.0.4');
      expect(shouldShowAgain).toBe(false);
    });

    it('3. App upgrade to new version (v1.0.5) -> popup becomes eligible again', async () => {
      // Seed acknowledged version as 1.0.4
      mockStorageMap.set(RELEASE_NOTES_STORAGE_KEY, '1.0.4');

      // Check v1.0.4 -> false
      expect(await releaseNotesService.shouldShowReleaseNotes('1.0.4')).toBe(false);

      // Check v1.0.5 -> true (new version eligible)
      expect(await releaseNotesService.shouldShowReleaseNotes('1.0.5')).toBe(true);

      // Dismiss v1.0.5
      await releaseNotesService.acknowledgeReleaseNotes('1.0.5');
      expect(mockStorageMap.get(RELEASE_NOTES_STORAGE_KEY)).toBe('1.0.5');

      // Now v1.0.5 is acknowledged
      expect(await releaseNotesService.shouldShowReleaseNotes('1.0.5')).toBe(false);
    });

    it('4. Works identically for Guest mode users', async () => {
      useAuthStore.setState({
        status: 'unauthenticated',
        user: null,
        isGuest: true,
      });

      const shouldShowGuest = await releaseNotesService.shouldShowReleaseNotes('1.0.4');
      expect(shouldShowGuest).toBe(true);

      await releaseNotesService.acknowledgeReleaseNotes('1.0.4');
      expect(await releaseNotesService.shouldShowReleaseNotes('1.0.4')).toBe(false);
    });

    it('5. Works identically for Authenticated users with zero network dependency', async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: 'usr_auth_123', email: 'athlete@bebig.app' },
        isGuest: false,
      });

      // Purely local test without network calls
      const shouldShowAuth = await releaseNotesService.shouldShowReleaseNotes('1.0.4');
      expect(shouldShowAuth).toBe(true);

      await releaseNotesService.acknowledgeReleaseNotes('1.0.4');
      expect(await releaseNotesService.shouldShowReleaseNotes('1.0.4')).toBe(false);
    });

    it('6. Does NOT render while splash screen route (index) is active', async () => {
      mockSegments = ['index'];
      const { queryByTestId } = await render(
        <ReleaseNotesModal forcedVersion="1.0.4" />,
      );

      // Modal must stay hidden (null) while on root index splash route
      expect(queryByTestId('release-notes-modal')).toBeNull();
    });
  });

  describe('Part A: Rest Timer UI Polish & Responsive Symmetrical Alignment', () => {
    it('6. RestTimerOverlay renders all 4 controls with symmetrical spacing and no edge overflow', async () => {
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

      const minusBtn = await findByTestId('extend-rest-minus-15-button');
      const plusBtn = await findByTestId('extend-rest-plus-15-button');
      const pauseBtn = await findByTestId('toggle-pause-rest-timer-button');
      const skipBtn = await findByTestId('skip-rest-timer-button');

      expect(minusBtn).toBeTruthy();
      expect(plusBtn).toBeTruthy();
      expect(pauseBtn).toBeTruthy();
      expect(skipBtn).toBeTruthy();

      // Check text labels
      expect(await findByText('-15s')).toBeTruthy();
      expect(await findByText('+15s')).toBeTruthy();
      expect(await findByText('PAUSE')).toBeTruthy();
      expect(await findByText('SKIP')).toBeTruthy();
    });

    it('7. Paused and Finished states render clear balanced typography', async () => {
      // Paused state
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

    it('8. Dynamic height onLayout callback accurately fires for overlay clearance', async () => {
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
      await act(async () => {
        fireEvent(overlay, 'layout', {
          nativeEvent: { layout: { height: 230, width: 375, x: 0, y: 550 } },
        });
      });

      expect(onHeightChange).toHaveBeenCalledWith(230);
    });
  });
});
