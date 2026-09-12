/**
 * BeBig 2.0 — Sync Lifecycle Coordinator
 *
 * Coordinates event-driven synchronization triggers from:
 * 1. Initial authenticated app startup
 * 2. App returning to active foreground
 * 3. Network connectivity recovery
 * 4. Completed workout persistence
 *
 * Architectural Invariants:
 * - SyncEngine is the SOLE authoritative owner of synchronization serialization and mutexes.
 * - SyncLifecycleManager does NOT maintain a competing sync mutex. It acts purely as an event
 *   coordinator that debounces rapid events and manages at most one trailing request when SyncEngine is busy.
 * - Guest mode and unauthenticated sessions NEVER trigger cloud synchronization calls.
 */

import { AppState, AppStateStatus } from 'react-native';
import { getCurrentUserScope, UserScope } from '../../features/auth/utils/userScope';
import { SyncEngine } from './syncEngine';
import { NetworkMonitor, defaultNetworkMonitor } from './networkMonitor';
import { SyncResult, SyncTriggerReason, PushResult, PullResult } from './types';

export const TRIGGER_COOLDOWN_MS = 1500;

export class SyncLifecycleManager {
  private syncEngine: SyncEngine;
  private networkMonitor: NetworkMonitor;
  private hasTrailingRequest = false;
  private lastTriggerTimestamps = new Map<SyncTriggerReason, number>();
  private appStateSubscription: { remove: () => void } | null = null;
  private networkSubscription: (() => void) | null = null;
  private previousAppState: AppStateStatus = 'unknown';
  private previousNetworkOnline: boolean | null = null;
  private isNetworkInitialized = false;
  private isListening = false;

  constructor(
    syncEngine: SyncEngine = new SyncEngine(),
    networkMonitor: NetworkMonitor = defaultNetworkMonitor,
  ) {
    this.syncEngine = syncEngine;
    this.networkMonitor = networkMonitor;
  }

  /**
   * Sets the active SyncEngine instance (supports test injection).
   */
  setSyncEngine(engine: SyncEngine): void {
    this.syncEngine = engine;
  }

  /**
   * Sets the active NetworkMonitor instance (supports test injection).
   */
  setNetworkMonitor(monitor: NetworkMonitor): void {
    this.networkMonitor = monitor;
  }

  /**
   * Starts event listeners for AppState and network connectivity transitions.
   */
  startListening(): void {
    if (this.isListening) return;
    this.isListening = true;
    this.previousAppState = AppState.currentState;

    // 1. AppState foreground listener
    try {
      this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        const wasBackground = this.previousAppState === 'background' || this.previousAppState === 'inactive';
        this.previousAppState = nextState;

        if (nextState === 'active' && wasBackground) {
          void this.triggerSync({ reason: 'app_foreground' }).catch(() => {});
        }
      });
    } catch {
      // Handled for non-RN environments
    }

    // 2. Network recovery listener
    try {
      this.networkSubscription = this.networkMonitor.subscribe((isOnline: boolean) => {
        if (!this.isNetworkInitialized) {
          this.isNetworkInitialized = true;
          this.previousNetworkOnline = isOnline;
          return;
        }

        const wasOffline = this.previousNetworkOnline === false;
        this.previousNetworkOnline = isOnline;

        if (isOnline && wasOffline) {
          void this.triggerSync({ reason: 'network_recovery' }).catch(() => {});
        }
      });
    } catch {
      // Handled
    }
  }

  /**
   * Stops and cleans up all lifecycle event subscriptions.
   */
  stopListening(): void {
    if (!this.isListening) return;
    this.isListening = false;

    if (this.appStateSubscription) {
      try {
        this.appStateSubscription.remove();
      } catch {
        // Handled
      }
      this.appStateSubscription = null;
    }

    if (this.networkSubscription) {
      try {
        this.networkSubscription();
      } catch {
        // Handled
      }
      this.networkSubscription = null;
    }

    this.isNetworkInitialized = false;
    this.previousNetworkOnline = null;
  }

  /**
   * Dispatches a synchronization request for the specified reason.
   * Debounces identical rapid events and queues at most one trailing pass if SyncEngine is busy.
   */
  async triggerSync(options?: {
    reason?: SyncTriggerReason;
    scope?: UserScope | null;
  }): Promise<SyncResult> {
    const reason = options?.reason ?? 'manual';
    const resolvedScope = options?.scope !== undefined ? options.scope : getCurrentUserScope();

    // Invariant: Guests and unauthenticated sessions make ZERO network calls
    if (!resolvedScope || resolvedScope.ownerType !== 'authenticated' || !resolvedScope.ownerId) {
      const dummyPush: PushResult = {
        status: 'skipped_guest_or_unauthenticated',
        pushedCount: 0,
        reconciledCount: 0,
        quarantinedCount: 0,
        batches: [],
        errors: [],
      };
      const dummyPull: PullResult = {
        status: 'skipped_guest_or_unauthenticated',
        pulledCount: 0,
        appliedCount: 0,
        ignoredCount: 0,
        tombstonesApplied: 0,
        quarantinedCount: 0,
        hasMore: false,
        batches: [],
        errors: [],
      };
      return {
        status: 'skipped_guest_or_unauthenticated',
        pushResult: dummyPush,
        pullResult: dummyPull,
        errors: [],
      };
    }

    // Debounce rapid events for foreground and network recovery
    if (reason === 'app_foreground' || reason === 'network_recovery') {
      const lastTrigger = this.lastTriggerTimestamps.get(reason) || 0;
      const now = Date.now();
      if (now - lastTrigger < TRIGGER_COOLDOWN_MS) {
        return this.createBusyResult('Trigger suppressed by debounce window.');
      }
      this.lastTriggerTimestamps.set(reason, now);
    }

    // Trailing request handling: if SyncEngine is already busy, collapse into trailing pass
    if (this.syncEngine.isBusy()) {
      this.hasTrailingRequest = true;
      return this.createBusyResult('SyncEngine busy; trailing request scheduled.');
    }

    // Execute through SyncEngine (authoritative mutex owner)
    let result = await this.syncEngine.sync(resolvedScope);

    // If any triggers arrived while busy, execute ONE trailing pass
    while (this.hasTrailingRequest) {
      this.hasTrailingRequest = false;
      result = await this.syncEngine.sync(resolvedScope);
    }

    return result;
  }

  /**
   * Resets internal trailing flags, timestamps, and network tracking state (called on user logout or test setup).
   */
  reset(): void {
    this.hasTrailingRequest = false;
    this.lastTriggerTimestamps.clear();
    this.isNetworkInitialized = false;
    this.previousNetworkOnline = null;
  }

  /**
   * Returns whether the initial network connectivity baseline has been recorded.
   */
  isNetworkStateInitialized(): boolean {
    return this.isNetworkInitialized;
  }

  /**
   * Returns the last recorded network online status, or null if uninitialized.
   */
  getPreviousNetworkOnline(): boolean | null {
    return this.previousNetworkOnline;
  }

  /**
   * Exposes whether a trailing request is currently queued.
   */
  hasPendingTrailing(): boolean {
    return this.hasTrailingRequest;
  }

  private createBusyResult(message: string): SyncResult {
    const dummyPush: PushResult = {
      status: 'busy',
      pushedCount: 0,
      reconciledCount: 0,
      quarantinedCount: 0,
      batches: [],
      errors: [{ message, kind: 'busy' }],
    };
    const dummyPull: PullResult = {
      status: 'busy',
      pulledCount: 0,
      appliedCount: 0,
      ignoredCount: 0,
      tombstonesApplied: 0,
      quarantinedCount: 0,
      hasMore: false,
      batches: [],
      errors: [{ message, kind: 'busy' }],
    };
    return {
      status: 'busy',
      pushResult: dummyPush,
      pullResult: dummyPull,
      errors: [{ message, kind: 'busy' }],
    };
  }
}

export const syncLifecycleManager = new SyncLifecycleManager();
