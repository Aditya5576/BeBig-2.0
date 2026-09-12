/**
 * BeBig 2.0 — Network Connectivity Monitor
 *
 * Provides event-driven network connectivity tracking for sync lifecycle triggers.
 * Decoupled via interface to support unit test simulation and non-native environments.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkMonitor {
  /**
   * Checks current online status.
   */
  isOnline(): Promise<boolean>;

  /**
   * Subscribes to connectivity transitions (e.g. offline -> online).
   * Returns an unsubscribe cleanup function.
   */
  subscribe(onStatusChange: (isOnline: boolean) => void): () => void;
}

export class DefaultNetworkMonitor implements NetworkMonitor {
  async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return this.evaluateState(state);
    } catch {
      // Fallback for web / test
      if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
        return navigator.onLine;
      }
      return true;
    }
  }

  subscribe(onStatusChange: (isOnline: boolean) => void): () => void {
    try {
      let previousOnline: boolean | null = null;

      const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        const isCurrentlyOnline = this.evaluateState(state);
        // Only trigger listener when status genuinely transitions
        if (previousOnline === null || previousOnline !== isCurrentlyOnline) {
          previousOnline = isCurrentlyOnline;
          onStatusChange(isCurrentlyOnline);
        }
      });

      return () => {
        try {
          unsubscribe();
        } catch {
          // Handled
        }
      };
    } catch {
      // Return dummy cleanup if NetInfo is unavailable
      return () => {};
    }
  }

  private evaluateState(state: NetInfoState): boolean {
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  }
}

export const defaultNetworkMonitor = new DefaultNetworkMonitor();
