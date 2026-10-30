/**
 * BeBig 2.0 — Production-Ready What's New Popup Test Suite (v2.2.0)
 *
 * Verifies all 10 Acceptance Criteria:
 * 1. Existing user who acknowledged 2.1.1 sees the 2.2.0 announcement.
 * 2. Fresh user completing onboarding sees 2.2.0 after arriving on Home.
 * 3. Guest users see the announcement and can dismiss it offline.
 * 4. Authenticated users see the announcement and can dismiss it.
 * 5. Previously dismissed 2.2.0 does not reappear on subsequent renders or app restarts.
 * 6. Splash screen routes (index / empty) do not show the popup.
 * 7. Onboarding screens (welcome / goal / preferences) do not show the popup.
 * 8. Active workout in progress (workout/active) does not show the popup.
 * 9. Navigating to a safe screen after onboarding triggers the pending announcement.
 * 10. App restart preserves acknowledgement and release notes dictionary is valid.
 */

import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react-native';
import {
  releaseNotesService,
  RELEASE_NOTES_STORAGE_KEY,
} from '../src/lib/releaseNotes/releaseNotesService';
import { platformStorage } from '../src/lib/storage/platformStorage';
import { ReleaseNotesModal } from '../src/components/ui/ReleaseNotesModal';
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

let mockSegments: string[] = ['home'];

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

describe('BeBig 2.0 — Production What\'s New Popup (v2.2.0 ReleaseNotesModal)', () => {
  beforeEach(() => {
    mockSegments = ['home'];
    jest.clearAllMocks();
    mockStorageMap.clear();
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_test_1', email: 'test@bebig.app' },
      isGuest: false,
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('1. Existing user who acknowledged 2.1.1 sees the 2.2.0 announcement on Home screen', async () => {
    // User previously acknowledged v2.1.1 in production
    mockStorageMap.set(RELEASE_NOTES_STORAGE_KEY, '2.1.1');

    const shouldShow = await releaseNotesService.shouldShowReleaseNotes('2.2.0');
    expect(shouldShow).toBe(true);

    const { findByTestId, findByText } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" />,
    );

    const modal = await findByTestId('release-notes-modal');
    expect(modal).toBeTruthy();

    expect(await findByText("🎉 What's New")).toBeTruthy();
    expect(await findByText('v2.2.0')).toBeTruthy();
    expect(await findByTestId('release-notes-dismiss-button')).toBeTruthy();

    // Verify genuine BeBig 2.2.0 release highlights are shown
    expect(await findByText(/Exercise Demonstration Media/)).toBeTruthy();
    expect(await findByText(/Unified Custom Exercise Creation/)).toBeTruthy();
    expect(await findByText(/Indian Commercial Gym Catalogue/)).toBeTruthy();
    expect(await findByText(/Search & Navigation Responsiveness/)).toBeTruthy();
    expect(await findByText(/Factual Weekly Performance/)).toBeTruthy();
  });

  it('2. Fresh user completing onboarding sees 2.2.0 afterward on Home screen', async () => {
    // Fresh user: no prior version in storage
    expect(await releaseNotesService.getAcknowledgedVersion()).toBeNull();

    // When arriving on Home screen after onboarding, popup triggers
    mockSegments = ['home'];
    const shouldShow = await releaseNotesService.shouldShowReleaseNotes();
    expect(shouldShow).toBe(true);

    const { findByTestId, findByText } = await render(<ReleaseNotesModal />);

    expect(await findByTestId('release-notes-modal')).toBeTruthy();
    expect(await findByText('v2.2.0')).toBeTruthy();
    expect(await findByText(/Exercise Demonstration Media/)).toBeTruthy();
  });

  it('3. Guest users see the announcement and can dismiss it without network', async () => {
    useAuthStore.setState({
      status: 'guest',
      user: null,
      isGuest: true,
    });

    const shouldShow = await releaseNotesService.shouldShowReleaseNotes('2.2.0');
    expect(shouldShow).toBe(true);

    const onDismiss = jest.fn();
    const { findByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" onDismiss={onDismiss} />,
    );

    const dismissBtn = await findByTestId('release-notes-dismiss-button');
    await act(async () => {
      fireEvent.press(dismissBtn);
    });

    expect(onDismiss).toHaveBeenCalled();
    expect(mockStorageMap.get(RELEASE_NOTES_STORAGE_KEY)).toBe('2.2.0');
    expect(await releaseNotesService.shouldShowReleaseNotes('2.2.0')).toBe(false);
  });

  it('4. Authenticated users see the announcement and can dismiss it', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_premium_athlete', email: 'athlete@bebig.app' },
      isGuest: false,
    });

    const shouldShow = await releaseNotesService.shouldShowReleaseNotes('2.2.0');
    expect(shouldShow).toBe(true);

    const onDismiss = jest.fn();
    const { findByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" onDismiss={onDismiss} />,
    );

    const dismissBtn = await findByTestId('release-notes-dismiss-button');
    await act(async () => {
      fireEvent.press(dismissBtn);
    });

    expect(onDismiss).toHaveBeenCalled();
    expect(mockStorageMap.get(RELEASE_NOTES_STORAGE_KEY)).toBe('2.2.0');
    expect(await releaseNotesService.shouldShowReleaseNotes('2.2.0')).toBe(false);
  });

  it('5. Previously dismissed 2.2.0 does not reappear repeatedly', async () => {
    mockStorageMap.set(RELEASE_NOTES_STORAGE_KEY, '2.2.0');

    const shouldShow = await releaseNotesService.shouldShowReleaseNotes('2.2.0');
    expect(shouldShow).toBe(false);

    const { queryByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" />,
    );

    // Modal must NOT be visible
    expect(queryByTestId('release-notes-modal')).toBeNull();
  });

  it('6. Splash screen does not show popup (index / empty segments)', async () => {
    // 6a: Root index route
    mockSegments = ['index'];
    const { queryByTestId: queryIndex } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" />,
    );
    expect(queryIndex('release-notes-modal')).toBeNull();

    // 6b: Empty root route []
    mockSegments = [];
    const { queryByTestId: queryEmpty } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" />,
    );
    expect(queryEmpty('release-notes-modal')).toBeNull();
  });

  it('7. Onboarding screens do not show popup (welcome / goal / preferences)', async () => {
    mockSegments = ['onboarding', 'welcome'];
    const { queryByTestId: queryWelcome } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" />,
    );
    expect(queryWelcome('release-notes-modal')).toBeNull();

    mockSegments = ['onboarding', 'goal'];
    const { queryByTestId: queryGoal } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" />,
    );
    expect(queryGoal('release-notes-modal')).toBeNull();
  });

  it('8. Active workout does not show popup', async () => {
    mockSegments = ['workout', 'active'];
    const { queryByTestId: queryWorkout } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" />,
    );
    expect(queryWorkout('release-notes-modal')).toBeNull();
  });

  it('9. Navigating to a safe screen after onboarding triggers the pending announcement', async () => {
    // User starts on onboarding screen: modal hidden
    mockSegments = ['onboarding', 'preferences'];
    const { queryByTestId, rerender, findByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" />,
    );
    expect(queryByTestId('release-notes-modal')).toBeNull();

    // User finishes onboarding and navigates to /home: modal triggers!
    mockSegments = ['home'];
    await act(async () => {
      rerender(<ReleaseNotesModal forcedVersion="2.2.0" />);
    });

    expect(await findByTestId('release-notes-modal')).toBeTruthy();
  });

  it('10. App restart preserves acknowledgement and release notes dictionary is valid', async () => {
    // Dismissal via backdrop
    const onDismissBackdrop = jest.fn();
    const { findByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.2.0" onDismiss={onDismissBackdrop} />,
    );

    const backdrop = await findByTestId('release-notes-backdrop');
    await act(async () => {
      fireEvent.press(backdrop);
    });

    expect(onDismissBackdrop).toHaveBeenCalledTimes(1);
    expect(mockStorageMap.get(RELEASE_NOTES_STORAGE_KEY)).toBe('2.2.0');

    // Simulate app restart with persisted storage
    const shouldShowAfterRestart = await releaseNotesService.shouldShowReleaseNotes('2.2.0');
    expect(shouldShowAfterRestart).toBe(false);

    // Verify 2.2.0 release notes dictionary
    const notes220 = releaseNotesService.getReleaseNotesForVersion('2.2.0');
    expect(notes220.version).toBe('2.2.0');
    expect(notes220.highlights.length).toBe(5);

    // Verify historical version fallbacks
    const notes211 = releaseNotesService.getReleaseNotesForVersion('2.1.1');
    expect(notes211.version).toBe('2.1.1');

    const notes210 = releaseNotesService.getReleaseNotesForVersion('2.1.0');
    expect(notes210.version).toBe('2.1.0');

    // Verify unknown version graceful fallback
    const fallbackNotes = releaseNotesService.getReleaseNotesForVersion('99.9.9');
    expect(fallbackNotes.version).toBe('99.9.9');
    expect(fallbackNotes.highlights.length).toBeGreaterThan(0);
  });
});
