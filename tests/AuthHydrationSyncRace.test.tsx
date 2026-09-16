/**
 * BeBig 2.0 — Focused Auth Hydration Race & Sync Lifecycle Unit Tests
 *
 * Validates:
 * 1. Startup before auth hydration does not attempt cloud sync.
 * 2. Authenticated session event triggers pending sync.
 * 3. Guest session does not trigger cloud sync.
 * 4. Signed-out state does not trigger cloud sync.
 * 5. Auth/account change cannot sync another user's pending workout.
 * 6. Existing pending workout becomes eligible for sync after auth hydration.
 * 7. Duplicate auth events do not create duplicate concurrent sync operations.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useSyncLifecycle } from '../src/services/sync/useSyncLifecycle';
import { syncLifecycleManager, syncMetadataStore, SyncEngine } from '../src/services/sync';
import { useAuthStore } from '../src/features/auth';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { UserScope, AuthSession } from '../src/features/auth/types';
import { WorkoutSession } from '../src/features/workout/types';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
  isSupabaseConfigured: () => true,
}));

function TestSyncLifecycleComponent() {
  useSyncLifecycle();
  return null;
}

describe('Auth Hydration Race & Sync Lifecycle Tests', () => {
  const userA: UserScope = { ownerId: 'usr_race_alpha', ownerType: 'authenticated' };
  const userB: UserScope = { ownerId: 'usr_race_beta', ownerType: 'authenticated' };

  let triggerSyncSpy: jest.SpyInstance;
  let resetSpy: jest.SpyInstance;

  beforeEach(async () => {
    syncMetadataStore.clearMemoryCache();
    workoutStorage.clearMemoryCache();

    await syncMetadataStore.resetUserState(userA.ownerId);
    await syncMetadataStore.resetUserState(userB.ownerId);
    await workoutStorage.clearAllWorkouts(userA);
    await workoutStorage.clearAllWorkouts(userB);

    // Default to initializing state (before Supabase Auth hydration)
    useAuthStore.setState({
      status: 'initializing',
      user: null,
      session: null,
      guestSession: null,
      isGuest: false,
    });

    triggerSyncSpy = jest.spyOn(syncLifecycleManager, 'triggerSync').mockResolvedValue({
      status: 'success',
      pushResult: {
        status: 'success',
        pushedCount: 0,
        reconciledCount: 0,
        quarantinedCount: 0,
        batches: [],
        errors: [],
      },
      pullResult: {
        status: 'success',
        pulledCount: 0,
        appliedCount: 0,
        ignoredCount: 0,
        tombstonesApplied: 0,
        quarantinedCount: 0,
        hasMore: false,
        batches: [],
        errors: [],
      },
      errors: [],
    });

    resetSpy = jest.spyOn(syncLifecycleManager, 'reset').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Startup before auth hydration does not attempt cloud sync', async () => {
    render(<TestSyncLifecycleComponent />);

    // Before Supabase Auth confirms a session, no sync must be triggered
    expect(triggerSyncSpy).not.toHaveBeenCalled();
  });

  it('2. Authenticated session event triggers pending sync', async () => {
    render(<TestSyncLifecycleComponent />);

    const mockSessionA: AuthSession = {
      user: { id: userA.ownerId, email: 'alpha@bebig.app', createdAt: new Date().toISOString() },
      accessToken: 'token_alpha',
      refreshToken: 'refresh_alpha',
    };

    await act(async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: mockSessionA.user,
        session: mockSessionA,
        isGuest: false,
      });
    });

    expect(triggerSyncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'app_startup',
        scope: expect.objectContaining({ ownerId: userA.ownerId, ownerType: 'authenticated' }),
      }),
    );
  });

  it('3. Guest session does not trigger cloud sync', async () => {
    render(<TestSyncLifecycleComponent />);

    await act(async () => {
      useAuthStore.setState({
        status: 'guest',
        isGuest: true,
        guestSession: { id: 'guest_1' } as any,
        session: null,
        user: null,
      });
    });

    expect(triggerSyncSpy).not.toHaveBeenCalled();
  });

  it('4. Signed-out state does not trigger cloud sync', async () => {
    render(<TestSyncLifecycleComponent />);

    const mockSessionA: AuthSession = {
      user: { id: userA.ownerId, email: 'alpha@bebig.app', createdAt: new Date().toISOString() },
      accessToken: 'token_alpha',
      refreshToken: 'refresh_alpha',
    };

    await act(async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: mockSessionA.user,
        session: mockSessionA,
        isGuest: false,
      });
    });

    await act(async () => {
      useAuthStore.setState({
        status: 'unauthenticated',
        user: null,
        session: null,
        isGuest: false,
      });
    });

    expect(resetSpy).toHaveBeenCalled();
  });

  it('5. Auth/account change cannot sync another user\'s pending workout', async () => {
    render(<TestSyncLifecycleComponent />);

    const mockSessionA: AuthSession = {
      user: { id: userA.ownerId, email: 'alpha@bebig.app', createdAt: new Date().toISOString() },
      accessToken: 'token_alpha',
      refreshToken: 'refresh_alpha',
    };

    const mockSessionB: AuthSession = {
      user: { id: userB.ownerId, email: 'beta@bebig.app', createdAt: new Date().toISOString() },
      accessToken: 'token_beta',
      refreshToken: 'refresh_beta',
    };

    // 1. User A hydrates
    await act(async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: mockSessionA.user,
        session: mockSessionA,
        isGuest: false,
      });
    });

    expect(triggerSyncSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'app_startup',
        scope: expect.objectContaining({ ownerId: userA.ownerId }),
      }),
    );

    // 2. User A signs out
    await act(async () => {
      useAuthStore.setState({
        status: 'unauthenticated',
        user: null,
        session: null,
        isGuest: false,
      });
    });
    expect(resetSpy).toHaveBeenCalled();

    // 3. User B signs in
    await act(async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: mockSessionB.user,
        session: mockSessionB,
        isGuest: false,
      });
    });

    // User B's sync must run with User B's scope, NOT User A's scope
    expect(triggerSyncSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'app_startup',
        scope: expect.objectContaining({ ownerId: userB.ownerId }),
      }),
    );
  });

  it('6. Existing pending workout becomes eligible for sync after auth hydration', async () => {
    // Save a pending workout locally for User A
    const pendingSession: WorkoutSession = {
      id: 'w_pending_hydration',
      name: 'Hydration Pending Workout',
      startedAt: '2026-09-16T10:00:00Z',
      finishedAt: '2026-09-16T11:00:00Z',
      status: 'completed',
      exercises: [],
      ownerId: userA.ownerId,
      ownerType: 'authenticated',
    };
    await workoutStorage.saveCompletedWorkout(pendingSession, userA);
    await syncMetadataStore.markPendingUpload('workout', 'w_pending_hydration', '2026-09-16T10:00:00Z', userA);

    // Un-spy triggerSync to let real execution test SyncEngine
    triggerSyncSpy.mockRestore();

    const mockWorkoutCloud = {
      upsertBatch: jest.fn(async (records: any[]) =>
        records.map((r) => ({ ...r, updated_at: '2026-09-16T12:00:00Z' })),
      ),
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
    };

    const realEngine = new SyncEngine(mockWorkoutCloud as any, {} as any, {} as any);
    syncLifecycleManager.setSyncEngine(realEngine);

    render(<TestSyncLifecycleComponent />);

    const mockSessionA: AuthSession = {
      user: { id: userA.ownerId, email: 'alpha@bebig.app', createdAt: new Date().toISOString() },
      accessToken: 'token_alpha',
      refreshToken: 'refresh_alpha',
    };

    await act(async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: mockSessionA.user,
        session: mockSessionA,
        isGuest: false,
      });
    });

    // Wait for async sync completion
    await new Promise((r) => setTimeout(r, 100));

    expect(mockWorkoutCloud.upsertBatch).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'w_pending_hydration' })]),
    );

    const meta = await syncMetadataStore.getRecord('workout', 'w_pending_hydration', userA);
    expect(meta?.syncStatus).toBe('synced');
  });

  it('7. Duplicate auth events do not create duplicate concurrent sync operations', async () => {
    render(<TestSyncLifecycleComponent />);

    const mockSessionA: AuthSession = {
      user: { id: userA.ownerId, email: 'alpha@bebig.app', createdAt: new Date().toISOString() },
      accessToken: 'token_alpha',
      refreshToken: 'refresh_alpha',
    };

    await act(async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: mockSessionA.user,
        session: mockSessionA,
        isGuest: false,
      });
    });

    await act(async () => {
      useAuthStore.setState({
        status: 'authenticated',
        user: mockSessionA.user,
        session: mockSessionA,
        isGuest: false,
      });
    });

    // Only called once due to duplicate suppression
    expect(triggerSyncSpy).toHaveBeenCalledTimes(1);
  });
});
