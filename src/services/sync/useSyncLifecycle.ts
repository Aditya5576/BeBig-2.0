/**
 * BeBig 2.0 — Sync Lifecycle Hook
 *
 * Mounts at the application root (RootLayout in app/_layout.tsx).
 * Connects the root AppState and network connectivity listeners,
 * and triggers initial synchronization upon cold launch for authenticated users.
 */

import { useEffect } from 'react';
import { useAuthStore } from '../../features/auth';
import { syncLifecycleManager } from './syncLifecycleManager';

export function useSyncLifecycle(): void {
  useEffect(() => {
    // 1. Start AppState and network connectivity listeners
    syncLifecycleManager.startListening();

    // 2. Trigger initial app startup sync if already authenticated
    const authState = useAuthStore.getState();
    if (authState.status === 'authenticated' && authState.user && !authState.isGuest) {
      void syncLifecycleManager.triggerSync({ reason: 'app_startup' }).catch(() => {});
    }

    // 3. Listen for auth changes to trigger initial sync upon login
    const unsubscribeAuth = useAuthStore.subscribe((state, prevState) => {
      const justLoggedIn =
        prevState.status !== 'authenticated' &&
        state.status === 'authenticated' &&
        state.user &&
        !state.isGuest;

      if (justLoggedIn) {
        void syncLifecycleManager.triggerSync({ reason: 'app_startup' }).catch(() => {});
      } else if (state.status === 'unauthenticated') {
        syncLifecycleManager.reset();
      }
    });

    return () => {
      syncLifecycleManager.stopListening();
      unsubscribeAuth();
    };
  }, []);
}
