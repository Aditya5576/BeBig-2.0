/**
 * BeBig 2.0 — Milestone 10 Fix #4: NetInfo Cold-Start / Spurious Network-Recovery Unit Tests
 *
 * Validates:
 * 1. Cold-start suppression: initial NetInfo event (online or offline) sets baseline without triggering sync.
 * 2. ONLINE -> OFFLINE records state and does not trigger recovery sync.
 * 3. OFFLINE -> ONLINE triggers genuine network_recovery sync.
 * 4. Duplicate events (ONLINE -> ONLINE, OFFLINE -> OFFLINE) do not trigger spurious syncs.
 * 5. Sequence ONLINE -> OFFLINE -> ONLINE triggers exactly one recovery sync.
 * 6. Cooldown / debounce: rapid recovery events within TRIGGER_COOLDOWN_MS are debounced.
 * 7. Busy SyncEngine: network recovery during active sync schedules at most one trailing pass.
 * 8. Guest & unauthenticated isolation: network recovery makes zero cloud calls.
 * 9. App startup and foreground triggers remain intact.
 * 10. Lifecycle reset and re-arming: stopListening() and reset() re-arm baseline suppression.
 */

import { AppState, AppStateStatus } from 'react-native';
import {
  SyncEngine,
  SyncLifecycleManager,
  NetworkMonitor,
  TRIGGER_COOLDOWN_MS,
  syncMetadataStore,
} from '../src/services/sync';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { useAuthStore } from '../src/features/auth';
import { UserScope } from '../src/features/auth/types';

class ControllableNetworkMonitor implements NetworkMonitor {
  private onlineStatus: boolean;
  private listeners: ((isOnline: boolean) => void)[] = [];
  public fireOnSubscribe: boolean;

  constructor(initialOnline = true, fireOnSubscribe = true) {
    this.onlineStatus = initialOnline;
    this.fireOnSubscribe = fireOnSubscribe;
  }

  async isOnline(): Promise<boolean> {
    return this.onlineStatus;
  }

  subscribe(onStatusChange: (isOnline: boolean) => void): () => void {
    this.listeners.push(onStatusChange);
    // Real @react-native-community/netinfo delivers current state immediately on subscription
    if (this.fireOnSubscribe) {
      onStatusChange(this.onlineStatus);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== onStatusChange);
    };
  }

  emit(isOnline: boolean): void {
    this.onlineStatus = isOnline;
    for (const listener of [...this.listeners]) {
      listener(isOnline);
    }
  }

  getListenerCount(): number {
    return this.listeners.length;
  }
}

describe('Fix #4 — NetInfo Cold-Start / Spurious Network Recovery Unit Tests', () => {
  const authUser: UserScope = { ownerId: 'usr_net_test', ownerType: 'authenticated' };
  const guestUser: UserScope = { ownerId: 'guest_net_test', ownerType: 'guest' };

  let mockWorkoutCloud: any;
  let mockTemplateCloud: any;
  let mockCustomExerciseCloud: any;
  let engine: SyncEngine;
  let appStateListeners: ((state: AppStateStatus) => void)[] = [];

  beforeEach(async () => {
    syncMetadataStore.clearMemoryCache();
    workoutStorage.clearMemoryCache();

    await syncMetadataStore.resetUserState(authUser.ownerId);
    await syncMetadataStore.resetUserState(guestUser.ownerId);
    await workoutStorage.clearAllWorkouts(authUser);

    useAuthStore.setState({
      user: { id: authUser.ownerId, email: 'net@bebig.app' } as any,
      isGuest: false,
      status: 'authenticated',
    });

    mockWorkoutCloud = {
      upsert: jest.fn(),
      upsertBatch: jest.fn(async (records: any[]) =>
        records.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      ),
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
    };

    mockTemplateCloud = {
      upsert: jest.fn(),
      upsertBatch: jest.fn(async (records: any[]) =>
        records.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      ),
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
    };

    mockCustomExerciseCloud = {
      upsert: jest.fn(),
      upsertBatch: jest.fn(async (records: any[]) =>
        records.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      ),
      fetchChanged: jest.fn(async () => ({ records: [], hasMore: false, nextCursor: null })),
    };

    engine = new SyncEngine(mockWorkoutCloud, mockTemplateCloud, mockCustomExerciseCloud);

    appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: string, handler: any) => {
      if (event === 'change') {
        appStateListeners.push(handler);
      }
      return { remove: jest.fn() } as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. cold start with initial ONLINE event initializes baseline without triggering network_recovery sync', async () => {
    const networkMonitor = new ControllableNetworkMonitor(true, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);

    const triggerSpy = jest.spyOn(manager, 'triggerSync');

    manager.startListening();

    // Baseline is initialized to online
    expect(manager.isNetworkStateInitialized()).toBe(true);
    expect(manager.getPreviousNetworkOnline()).toBe(true);

    // Wait microtask tick
    await new Promise((r) => setTimeout(r, 50));

    // Zero sync triggers occurred from this initial event
    expect(triggerSpy).not.toHaveBeenCalled();
    expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();

    manager.stopListening();
  });

  it('2. cold start with initial OFFLINE event initializes baseline without triggering network_recovery sync', async () => {
    const networkMonitor = new ControllableNetworkMonitor(false, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);

    const triggerSpy = jest.spyOn(manager, 'triggerSync');

    manager.startListening();

    // Baseline is initialized to offline
    expect(manager.isNetworkStateInitialized()).toBe(true);
    expect(manager.getPreviousNetworkOnline()).toBe(false);

    await new Promise((r) => setTimeout(r, 50));

    expect(triggerSpy).not.toHaveBeenCalled();
    expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();

    manager.stopListening();
  });

  it('3. subsequent transition from ONLINE to OFFLINE records state and does NOT trigger recovery sync', async () => {
    const networkMonitor = new ControllableNetworkMonitor(true, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);
    const triggerSpy = jest.spyOn(manager, 'triggerSync');

    manager.startListening();
    expect(manager.getPreviousNetworkOnline()).toBe(true);

    // Transition to offline
    networkMonitor.emit(false);

    expect(manager.getPreviousNetworkOnline()).toBe(false);
    await new Promise((r) => setTimeout(r, 50));

    expect(triggerSpy).not.toHaveBeenCalled();
    expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();

    manager.stopListening();
  });

  it('4. subsequent transition from OFFLINE to ONLINE triggers genuine network_recovery sync', async () => {
    const networkMonitor = new ControllableNetworkMonitor(false, true); // Starts offline
    const manager = new SyncLifecycleManager(engine, networkMonitor);
    const triggerSpy = jest.spyOn(manager, 'triggerSync');

    manager.startListening();
    expect(manager.getPreviousNetworkOnline()).toBe(false);
    expect(triggerSpy).not.toHaveBeenCalled();

    // Transition to online (genuine recovery)
    networkMonitor.emit(true);

    expect(manager.getPreviousNetworkOnline()).toBe(true);
    await new Promise((r) => setTimeout(r, 50));

    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy).toHaveBeenCalledWith({ reason: 'network_recovery' });
    expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledTimes(1);

    manager.stopListening();
  });

  it('5. duplicate events (ONLINE -> ONLINE and OFFLINE -> OFFLINE) do NOT trigger spurious syncs', async () => {
    const networkMonitor = new ControllableNetworkMonitor(true, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);
    const triggerSpy = jest.spyOn(manager, 'triggerSync');

    manager.startListening();

    // ONLINE -> ONLINE
    networkMonitor.emit(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(triggerSpy).not.toHaveBeenCalled();

    // ONLINE -> OFFLINE
    networkMonitor.emit(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(triggerSpy).not.toHaveBeenCalled();

    // OFFLINE -> OFFLINE
    networkMonitor.emit(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(triggerSpy).not.toHaveBeenCalled();

    expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();

    manager.stopListening();
  });

  it('6. full sequence ONLINE (cold-start) -> OFFLINE -> ONLINE triggers exactly one recovery sync for the recovery transition', async () => {
    const networkMonitor = new ControllableNetworkMonitor(true, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);
    const triggerSpy = jest.spyOn(manager, 'triggerSync');

    // 1. Cold start while online
    manager.startListening();
    expect(manager.getPreviousNetworkOnline()).toBe(true);
    expect(triggerSpy).not.toHaveBeenCalled();

    // 2. Go offline
    networkMonitor.emit(false);
    expect(manager.getPreviousNetworkOnline()).toBe(false);
    expect(triggerSpy).not.toHaveBeenCalled();

    // 3. Reconnect online
    networkMonitor.emit(true);
    expect(manager.getPreviousNetworkOnline()).toBe(true);

    await new Promise((r) => setTimeout(r, 50));

    // Exactly one trigger with reason 'network_recovery'
    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy).toHaveBeenCalledWith({ reason: 'network_recovery' });
    expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledTimes(1);

    manager.stopListening();
  });

  it('7. rapid repeated recovery events within TRIGGER_COOLDOWN_MS are debounced', async () => {
    const networkMonitor = new ControllableNetworkMonitor(false, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);

    manager.startListening();

    // First recovery: OFFLINE -> ONLINE
    networkMonitor.emit(true);

    await new Promise((r) => setTimeout(r, 50));
    expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledTimes(1);

    // Rapid flutter: ONLINE -> OFFLINE -> ONLINE within 100ms (< 1500ms cooldown)
    networkMonitor.emit(false);
    networkMonitor.emit(true);

    await new Promise((r) => setTimeout(r, 50));

    // Second recovery was suppressed by debounce window
    expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledTimes(1);

    manager.stopListening();
  });

  it('8. network recovery while SyncEngine is busy schedules at most one trailing pass', async () => {
    const networkMonitor = new ControllableNetworkMonitor(false, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);

    // Make sync take some time
    let resolveSync: () => void;
    const syncPromise = new Promise<void>((resolve) => {
      resolveSync = resolve;
    });

    mockWorkoutCloud.fetchChanged.mockImplementation(async () => {
      await syncPromise;
      return { records: [], hasMore: false, nextCursor: null };
    });

    manager.startListening();

    // Start manual sync so engine is busy
    const firstSyncPromise = manager.triggerSync({ reason: 'manual' });
    expect(engine.isBusy()).toBe(true);

    // Network transitions offline -> online while busy
    // We need to advance beyond cooldown timestamp for the trigger call
    const originalDateNow = Date.now;
    Date.now = jest.fn(() => originalDateNow() + TRIGGER_COOLDOWN_MS + 100);

    networkMonitor.emit(true);

    // Trailing pass should be queued
    expect(manager.hasPendingTrailing()).toBe(true);

    // Release first sync
    resolveSync!();
    await firstSyncPromise;

    // Both initial sync and trailing pass ran sequentially
    expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledTimes(2);
    expect(manager.hasPendingTrailing()).toBe(false);

    Date.now = originalDateNow;
    manager.stopListening();
  });

  it('9. guest and unauthenticated users make ZERO cloud calls on network recovery', async () => {
    // 1. Guest state
    useAuthStore.setState({
      user: null,
      isGuest: true,
      guestSession: { id: guestUser.ownerId } as any,
      status: 'guest' as any,
    });

    const networkMonitor = new ControllableNetworkMonitor(false, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);

    manager.startListening();

    // Network recovers
    networkMonitor.emit(true);

    await new Promise((r) => setTimeout(r, 50));

    // Zero cloud calls made
    expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();
    expect(mockWorkoutCloud.upsertBatch).not.toHaveBeenCalled();

    // 2. Unauthenticated state
    useAuthStore.setState({
      user: null,
      isGuest: false,
      status: 'unauthenticated' as any,
    });

    networkMonitor.emit(false);
    networkMonitor.emit(true);

    await new Promise((r) => setTimeout(r, 50));

    expect(mockWorkoutCloud.fetchChanged).not.toHaveBeenCalled();
    expect(mockWorkoutCloud.upsertBatch).not.toHaveBeenCalled();

    manager.stopListening();
  });

  it('10. stopListening() and reset() properly reset state and re-arm cold-start suppression', async () => {
    const networkMonitor = new ControllableNetworkMonitor(true, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);
    const triggerSpy = jest.spyOn(manager, 'triggerSync');

    // First session
    manager.startListening();
    expect(manager.isNetworkStateInitialized()).toBe(true);
    expect(manager.getPreviousNetworkOnline()).toBe(true);

    // Stop listening (e.g. app unmount)
    manager.stopListening();
    expect(manager.isNetworkStateInitialized()).toBe(false);
    expect(manager.getPreviousNetworkOnline()).toBeNull();
    expect(networkMonitor.getListenerCount()).toBe(0);

    // Restart listening (e.g. re-mount)
    manager.startListening();
    // Cold start suppression is re-armed: first event is baseline, not recovery
    expect(manager.isNetworkStateInitialized()).toBe(true);
    expect(manager.getPreviousNetworkOnline()).toBe(true);
    expect(triggerSpy).not.toHaveBeenCalled();

    // Reset method also clears state
    manager.reset();
    expect(manager.isNetworkStateInitialized()).toBe(false);
    expect(manager.getPreviousNetworkOnline()).toBeNull();

    manager.stopListening();
  });

  it('11. app startup and AppState foreground triggers remain fully operational', async () => {
    const networkMonitor = new ControllableNetworkMonitor(true, true);
    const manager = new SyncLifecycleManager(engine, networkMonitor);

    manager.startListening();

    // 1. App startup trigger
    const startupResult = await manager.triggerSync({ reason: 'app_startup' });
    expect(startupResult.status).toBe('success');
    expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledTimes(1);

    // 2. AppState foreground trigger
    expect(appStateListeners.length).toBeGreaterThan(0);
    const foregroundHandler = appStateListeners[0];

    // Wait cooldown
    const originalDateNow = Date.now;
    Date.now = jest.fn(() => originalDateNow() + TRIGGER_COOLDOWN_MS + 200);

    foregroundHandler('background');
    foregroundHandler('active');

    await new Promise((r) => setTimeout(r, 50));
    expect(mockWorkoutCloud.fetchChanged).toHaveBeenCalledTimes(2);

    Date.now = originalDateNow;
    manager.stopListening();
  });
});
