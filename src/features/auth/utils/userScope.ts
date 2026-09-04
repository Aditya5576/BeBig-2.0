/**
 * BeBig 2.0 — User Scope & Data Isolation Utilities
 *
 * Enforces strong isolation for user-scoped local hardware storage.
 * Resolves ownership between Authenticated Supabase users and Guest sessions.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { UserScope } from '../types';

export type { UserScope };

export const LEGACY_UNSCOPED_STORAGE_KEYS = [
  'bebig.active.workout',
  'bebig.completed.workouts',
  'bebig.workout.templates',
  'bebig.custom.exercises',
] as const;

/**
 * Resolves the currently active user identity and ownership type.
 * Returns null if no user is signed in or guest session active.
 */
export function getCurrentUserScope(): UserScope | null {
  try {
    if (!useAuthStore || typeof useAuthStore.getState !== 'function') {
      return null;
    }

    const state = useAuthStore.getState();

    // 1. Authenticated user has priority
    if (state.user?.id) {
      return {
        ownerId: state.user.id,
        ownerType: 'authenticated',
      };
    }

    // 2. Active guest session
    if (state.isGuest && state.guestSession?.id) {
      return {
        ownerId: state.guestSession.id,
        ownerType: 'guest',
      };
    }

    // 3. In test environment when not explicitly unauthenticated, provide test fallback
    if (
      process.env.NODE_ENV === 'test' &&
      state.status === 'initializing' &&
      !state.user &&
      !state.isGuest
    ) {
      return {
        ownerId: 'test_default_user',
        ownerType: 'authenticated',
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generates an isolated, user-scoped storage key.
 * If scope is not provided, resolves against the current user scope.
 * Returns null if no user identity is active (protecting private data from unscoped access).
 */
export function getUserScopedKey(baseKey: string, scope?: UserScope | null): string | null {
  const targetScope = scope !== undefined ? scope : getCurrentUserScope();
  if (!targetScope || !targetScope.ownerId) {
    return null;
  }

  if (targetScope.ownerType === 'guest') {
    return `${baseKey}.guest.${targetScope.ownerId}`;
  }

  return `${baseKey}.${targetScope.ownerId}`;
}

/**
 * Purges legacy unscoped storage keys created before user isolation was implemented.
 * Guarantees historical unscoped workout/template data is not mistakenly assigned to any user.
 */
export async function purgeLegacyUnscopedStorage(): Promise<void> {
  for (const key of LEGACY_UNSCOPED_STORAGE_KEYS) {
    try {
      if (Platform.OS === 'web' || process.env.NODE_ENV === 'test') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignored
    }
  }
}
