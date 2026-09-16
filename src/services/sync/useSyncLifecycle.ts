/**
 * BeBig 2.0 — Sync Lifecycle Hook
 *
 * Mounts at the application root (RootLayout in app/_layout.tsx).
 * Connects the root AppState and network connectivity listeners,
 * and triggers initial synchronization upon Supabase Auth session hydration
 * and session state transitions.
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../features/auth';
import { syncLifecycleManager } from './syncLifecycleManager';

export function useSyncLifecycle(): void {
  const lastActiveUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Start AppState and network connectivity listeners
    syncLifecycleManager.startListening();

    // 2. Trigger initial app startup sync if auth session is already confirmed by Supabase
    const authState = useAuthStore.getState();
    if (
      authState.status === 'authenticated' &&
      authState.user?.id &&
      authState.session &&
      !authState.isGuest
    ) {
      const currentUserId = authState.user.id;
      lastActiveUserIdRef.current = currentUserId;
      const scope = {
        ownerId: currentUserId,
        ownerType: 'authenticated' as const,
      };
      void syncLifecycleManager.triggerSync({ reason: 'app_startup', scope }).catch(() => {});
    }

    // 3. Listen for reactive auth store transitions driven by Supabase Auth
    const unsubscribeAuth = useAuthStore.subscribe((state, prevState) => {
      // Guest or unauthenticated state -> reset lifecycle and suppress cloud sync
      if (
        state.isGuest ||
        state.status === 'unauthenticated' ||
        state.status === 'guest' ||
        !state.session ||
        !state.user?.id
      ) {
        if (lastActiveUserIdRef.current !== null || prevState.status === 'authenticated') {
          lastActiveUserIdRef.current = null;
          syncLifecycleManager.reset();
        }
        return;
      }

      const currentUserId = state.user.id;

      // Detect session confirmation or user switch
      const sessionConfirmed =
        state.status === 'authenticated' &&
        state.session !== null &&
        !state.isGuest &&
        (prevState.status !== 'authenticated' ||
          prevState.session === null ||
          prevState.user?.id !== currentUserId ||
          lastActiveUserIdRef.current !== currentUserId);

      if (sessionConfirmed) {
        // Account switch check: reset lifecycle if user ID changed
        if (lastActiveUserIdRef.current && lastActiveUserIdRef.current !== currentUserId) {
          syncLifecycleManager.reset();
        }

        lastActiveUserIdRef.current = currentUserId;

        const scope = {
          ownerId: currentUserId,
          ownerType: 'authenticated' as const,
        };

        void syncLifecycleManager.triggerSync({ reason: 'app_startup', scope }).catch(() => {});
      }
    });

    return () => {
      syncLifecycleManager.stopListening();
      unsubscribeAuth();
    };
  }, []);
}
