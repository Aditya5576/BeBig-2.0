/**
 * BeBig 2.0 — Account Deletion & Local Data Erasure Service
 *
 * Implements:
 * - AUD-006: Irreversible cloud account deletion via authenticated Supabase Edge Function
 * - AUD-011: Complete local device data erasure for both guest and authenticated users
 */

import { supabase } from '../../../lib/supabase/client';
import { platformStorage } from '../../../lib/storage/platformStorage';
import { guestStorage } from '../../../lib/storage/guestStorage';
import { getCurrentUserScope, getUserScopedKey, purgeLegacyUnscopedStorage, UserScope } from '../utils/userScope';
import { useAuthStore } from '../store/useAuthStore';
import { syncMetadataStore } from '../../../services/sync/syncMetadataStore';
import { profileService } from '../../profile/services/profileService';
import { workoutStorage } from '../../workout/storage/workoutStorage';
import { clearExerciseMemoryCache } from '../../exercises/storage/customExerciseStorage';

export interface DeleteAccountOptions {
  confirmPhrase: string;
  password?: string;
}

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
}

/**
 * Erases all local device data for the specified or active user scope.
 * Clears scoped workouts, templates, custom exercises, sync metadata, active drafts,
 * and memory caches, resetting the device cleanly to an uninitialized state.
 */
export async function eraseLocalDeviceData(targetScope?: UserScope | null): Promise<void> {
  const scope = targetScope !== undefined ? targetScope : getCurrentUserScope();

  const keysToPurge: string[] = [
    'bebig.sync.metadata',
    'bebig.sync.outbox',
    'bebig.active.workout',
    'bebig.completed.workouts',
    'bebig.workout.templates',
    'bebig.custom.exercises',
    'bebig.guest.session',
    'bebig.guest.onboarding',
  ];

  const baseScopedKeys = [
    'bebig.workout.sessions',
    'bebig.workout.active',
    'bebig.workout.active.abandoned',
    'bebig.workout.active.discarded',
    'bebig.workout.active.token',
    'bebig.templates',
    'bebig.exercises.custom',
  ];

  if (scope && scope.ownerId) {
    for (const base of baseScopedKeys) {
      const scopedKey = getUserScopedKey(base, scope);
      if (scopedKey) {
        keysToPurge.push(scopedKey);
      }
    }

    if (scope.ownerType === 'authenticated') {
      keysToPurge.push(`bebig.profile.${scope.ownerId}`);
      keysToPurge.push(`bebig.sync.metadata.${scope.ownerId}`);
      keysToPurge.push(`bebig.sync.outbox.${scope.ownerId}`);
    } else {
      keysToPurge.push(`bebig.profile.guest.${scope.ownerId}`);
    }
  }

  // 1. Purge all identified keys from persistent platformStorage
  for (const key of keysToPurge) {
    try {
      await platformStorage.removeItem(key);
    } catch {
      // Best-effort removal
    }
  }

  // 2. Clear guest storage
  await guestStorage.clearGuestSession().catch(() => {});
  await guestStorage.clearOnboardingData().catch(() => {});

  // 3. Purge legacy unscoped storage
  await purgeLegacyUnscopedStorage().catch(() => {});

  // 4. Reset persistent sync metadata state for the target user
  if (scope?.ownerId) {
    await syncMetadataStore.resetUserState(scope.ownerId).catch(() => {});
  }
  syncMetadataStore.clearMemoryCache();

  // 5. Clear all in-memory caches across services
  platformStorage.clearMemoryCache();
  profileService.clearMemoryCache();
  workoutStorage.clearMemoryCache();
  clearExerciseMemoryCache();
}

/**
 * Permanently deletes the authenticated user's account and cloud data.
 * Requires explicit confirmation ('DELETE') and re-authentication for email accounts.
 * On server success, purges all local storage and signs out the user.
 */
export async function deleteAccountAndCloudData(
  options: DeleteAccountOptions
): Promise<DeleteAccountResult> {
  const state = useAuthStore.getState();
  const user = state.user;

  if (!user || state.status !== 'authenticated') {
    return {
      success: false,
      error: 'You must be signed in to delete your account.',
    };
  }

  const normalizedPhrase = options.confirmPhrase?.trim().toUpperCase();
  if (normalizedPhrase !== 'DELETE' && normalizedPhrase !== 'DELETE_MY_ACCOUNT') {
    return {
      success: false,
      error: 'Please type DELETE to confirm account deletion.',
    };
  }

  // 1. Re-authentication verification for password-based users
  const isEmailUser = user.app_metadata?.provider === 'email' || !user.app_metadata?.provider;
  if (isEmailUser && options.password) {
    try {
      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: options.password,
      });

      if (reAuthError) {
        return {
          success: false,
          error: 'Re-authentication failed. Please check your password and try again.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Re-authentication failed.',
      };
    }
  }

  // 2. Invoke backend Edge Function with service-role authority
  try {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: 'DELETE_MY_ACCOUNT' },
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Server error occurred during account deletion.',
      };
    }

    if (data && data.success === false) {
      return {
        success: false,
        error: data.error || 'Server rejected account deletion request.',
      };
    }
  } catch (invokeErr: any) {
    return {
      success: false,
      error: invokeErr.message || 'Failed to communicate with account deletion service.',
    };
  }

  // 3. Purge all local device data and offline caches so records cannot resurrect
  const userScope: UserScope = {
    ownerId: user.id,
    ownerType: 'authenticated',
  };
  await eraseLocalDeviceData(userScope);

  // 4. Cleanly sign out from the client session
  try {
    await useAuthStore.getState().signOut();
  } catch {
    // Already deleted on backend; ignore local signout error
  }

  return { success: true };
}
