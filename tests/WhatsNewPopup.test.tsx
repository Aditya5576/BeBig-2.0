/**
 * BeBig 2.0 — Production-Ready What's New Popup Test Suite
 *
 * Verifies all 10 Acceptance Criteria:
 * 1. Popup appears for an eligible new release.
 * 2. Popup does not appear repeatedly for an acknowledged version.
 * 3. Popup appears again for a different eligible release.
 * 4. First-time onboarding is not interrupted.
 * 5. Guest users can use the popup.
 * 6. Authenticated users can use the popup.
 * 7. Missing or invalid stored version values are handled safely.
 * 8. Dismissal is persisted correctly.
 * 9. Startup/navigation initialization remains stable (splash & active workout protection).
 * 10. Existing behavior and genuine BeBig 2.0 release features are accurately presented.
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

describe('BeBig 2.0 — Production What\'s New Popup (ReleaseNotesModal)', () => {
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

  it('1. Popup appears for an eligible new release on Home screen', async () => {
    // No prior version acknowledged in storage
    const shouldShow = await releaseNotesService.shouldShowReleaseNotes('2.1.1');
    expect(shouldShow).toBe(true);

    const { findByTestId, findByText } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" />,
    );

    const modal = await findByTestId('release-notes-modal');
    expect(modal).toBeTruthy();

    expect(await findByText("🎉 What's New")).toBeTruthy();
    expect(await findByText('v2.1.1')).toBeTruthy();
    expect(await findByTestId('release-notes-dismiss-button')).toBeTruthy();

    // Verify genuine BeBig 2.0 release highlights are shown
    expect(await findByText(/Automatic Session Numbering/)).toBeTruthy();
    expect(await findByText(/Recently Used Exercises/)).toBeTruthy();
    expect(await findByText(/Data Export/)).toBeTruthy();
    expect(await findByText(/Profile Photo Persistence/)).toBeTruthy();
    expect(await findByText(/Progress Analytics 2.0/)).toBeTruthy();
    expect(await findByText(/Workout & Rest Timer Notifications/)).toBeTruthy();
  });

  it('2. Popup does not appear repeatedly for an already acknowledged version', async () => {
    // Seed acknowledged version as 2.1.1
    mockStorageMap.set(RELEASE_NOTES_STORAGE_KEY, '2.1.1');

    const shouldShow = await releaseNotesService.shouldShowReleaseNotes('2.1.1');
    expect(shouldShow).toBe(false);

    const { queryByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" />,
    );

    // Modal must NOT be visible
    expect(queryByTestId('release-notes-modal')).toBeNull();
  });

  it('3. Popup appears again when a different eligible release is introduced', async () => {
    // Previously acknowledged version 2.1.0
    mockStorageMap.set(RELEASE_NOTES_STORAGE_KEY, '2.1.0');

    // Querying for older version 2.1.0 -> already seen
    expect(await releaseNotesService.shouldShowReleaseNotes('2.1.0')).toBe(false);

    // Querying for new version 2.1.1 -> eligible to display!
    expect(await releaseNotesService.shouldShowReleaseNotes('2.1.1')).toBe(true);

    const { findByTestId, findByText } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" />,
    );

    expect(await findByTestId('release-notes-modal')).toBeTruthy();
    expect(await findByText('v2.1.1')).toBeTruthy();
  });

  it('4. First-time onboarding is not interrupted (hidden on /onboarding screens)', async () => {
    // Simulate user currently on /onboarding/welcome
    mockSegments = ['onboarding', 'welcome'];

    const { queryByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" />,
    );

    // Modal must NEVER render during onboarding
    expect(queryByTestId('release-notes-modal')).toBeNull();

    // Check questionnaire step /onboarding/goal
    mockSegments = ['onboarding', 'goal'];
    const { queryByTestId: queryGoal } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" />,
    );
    expect(queryGoal('release-notes-modal')).toBeNull();
  });

  it('5. Guest users can use the popup without network dependencies', async () => {
    useAuthStore.setState({
      status: 'guest',
      user: null,
      isGuest: true,
    });

    const shouldShow = await releaseNotesService.shouldShowReleaseNotes('2.1.1');
    expect(shouldShow).toBe(true);

    const onDismiss = jest.fn();
    const { findByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" onDismiss={onDismiss} />,
    );

    const dismissBtn = await findByTestId('release-notes-dismiss-button');
    await act(async () => {
      fireEvent.press(dismissBtn);
    });

    expect(onDismiss).toHaveBeenCalled();
    expect(mockStorageMap.get(RELEASE_NOTES_STORAGE_KEY)).toBe('2.1.1');
    expect(await releaseNotesService.shouldShowReleaseNotes('2.1.1')).toBe(false);
  });

  it('6. Authenticated users can use the popup without network dependencies', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'usr_premium_athlete', email: 'athlete@bebig.app' },
      isGuest: false,
    });

    const shouldShow = await releaseNotesService.shouldShowReleaseNotes('2.1.1');
    expect(shouldShow).toBe(true);

    const onDismiss = jest.fn();
    const { findByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" onDismiss={onDismiss} />,
    );

    const dismissBtn = await findByTestId('release-notes-dismiss-button');
    await act(async () => {
      fireEvent.press(dismissBtn);
    });

    expect(onDismiss).toHaveBeenCalled();
    expect(mockStorageMap.get(RELEASE_NOTES_STORAGE_KEY)).toBe('2.1.1');
    expect(await releaseNotesService.shouldShowReleaseNotes('2.1.1')).toBe(false);
  });

  it('7. Missing or invalid stored version values are handled safely', async () => {
    // Test with null
    mockStorageMap.delete(RELEASE_NOTES_STORAGE_KEY);
    expect(await releaseNotesService.getAcknowledgedVersion()).toBeNull();
    expect(await releaseNotesService.shouldShowReleaseNotes('2.1.1')).toBe(true);

    // Test with whitespace-only string
    mockStorageMap.set(RELEASE_NOTES_STORAGE_KEY, '   ');
    expect(await releaseNotesService.getAcknowledgedVersion()).toBeNull();
    expect(await releaseNotesService.shouldShowReleaseNotes('2.1.1')).toBe(true);

    // Test storage exception recovery
    (platformStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage disk failure'));
    expect(await releaseNotesService.getAcknowledgedVersion()).toBeNull();

    // Passing empty or non-string version safely returns false without crashing
    expect(await releaseNotesService.shouldShowReleaseNotes('')).toBe(false);
    expect(await releaseNotesService.shouldShowReleaseNotes(undefined as any)).toBe(true); // falls back to current app version
  });

  it('8. Dismissal is persisted correctly via "Got it" button and backdrop tap', async () => {
    // 8a: Button dismissal
    const onDismissButton = jest.fn();
    const { findByTestId } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" onDismiss={onDismissButton} />,
    );

    const btn = await findByTestId('release-notes-dismiss-button');
    await act(async () => {
      fireEvent.press(btn);
    });

    expect(onDismissButton).toHaveBeenCalledTimes(1);
    expect(mockStorageMap.get(RELEASE_NOTES_STORAGE_KEY)).toBe('2.1.1');

    // 8b: Backdrop tap dismissal
    mockStorageMap.clear();
    const onDismissBackdrop = jest.fn();
    const { findByTestId: findByTestId2 } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" onDismiss={onDismissBackdrop} />,
    );

    const backdrop = await findByTestId2('release-notes-backdrop');
    await act(async () => {
      fireEvent.press(backdrop);
    });

    expect(onDismissBackdrop).toHaveBeenCalledTimes(1);
    expect(mockStorageMap.get(RELEASE_NOTES_STORAGE_KEY)).toBe('2.1.1');
  });

  it('9. Startup & navigation initialization remains stable (splash & workout protected)', async () => {
    // 9a: Root splash screen route (index) must NEVER show release notes
    mockSegments = ['index'];
    const { queryByTestId: querySplash } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" />,
    );
    expect(querySplash('release-notes-modal')).toBeNull();

    // 9b: Empty root route [] must NEVER show release notes
    mockSegments = [];
    const { queryByTestId: queryEmpty } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" />,
    );
    expect(queryEmpty('release-notes-modal')).toBeNull();

    // 9c: Active workout in progress must NEVER be interrupted by release notes
    mockSegments = ['workout', 'active'];
    const { queryByTestId: queryWorkout } = await render(
      <ReleaseNotesModal forcedVersion="2.1.1" />,
    );
    expect(queryWorkout('release-notes-modal')).toBeNull();
  });

  it('10. Existing behavior is preserved and release notes dictionary is valid', () => {
    // Verify 2.1.1 release notes structure
    const notes211 = releaseNotesService.getReleaseNotesForVersion('2.1.1');
    expect(notes211.version).toBe('2.1.1');
    expect(notes211.highlights.length).toBe(6);

    // Verify historical version fallback
    const notes210 = releaseNotesService.getReleaseNotesForVersion('2.1.0');
    expect(notes210.version).toBe('2.1.0');

    // Verify unknown version graceful fallback
    const fallbackNotes = releaseNotesService.getReleaseNotesForVersion('99.9.9');
    expect(fallbackNotes.version).toBe('99.9.9');
    expect(fallbackNotes.highlights.length).toBeGreaterThan(0);
  });
});
