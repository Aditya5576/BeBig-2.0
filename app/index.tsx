import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { StartupSplash } from '../src/components/ui';
import { useAuthStore, resolveAuthenticatedUserRoute } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import { profileService } from '../src/features/profile';
import { guestStorage } from '../src/lib/storage';

export interface IndexProps {
  splashDurationMs?: number;
}

/**
 * Root Index Gatekeeper & Startup Orchestrator
 *
 * Responsibilities:
 * 1. Display mandatory BeBig startup splash screen for ~3.5 seconds on every cold launch/relaunch.
 * 2. Concurrently initialize authentication (Supabase cloud session or guest session).
 * 3. Authoritative profile check:
 *    - If authenticated: check Supabase profiles table for onboarding_completed = true.
 *      If completed, rehydrate profile into useOnboardingStore and route to /home.
 *      If missing or incomplete, route to /onboarding/welcome.
 *    - If guest: check local guestStorage for saved onboarding data.
 *      If completed, rehydrate and route to /home.
 *      If not completed, route to /onboarding/welcome.
 *    - If unauthenticated: route to /onboarding/welcome.
 * 4. Output dev diagnostic routing logs.
 * 5. Gatekeeper keeps StartupSplash rendered until BOTH initialization and splash timer finish,
 *    then executes a single atomic redirection to the final target route.
 */
export default function Index({ splashDurationMs }: IndexProps = {}) {
  const [destination, setDestination] = useState<string | null>(null);

  // Default to 3500ms (3.5s) on physical device / production / dev.
  // In test environments (process.env.NODE_ENV === 'test'), default to 0ms so tests execute
  // rapidly without timeouts, unless explicitly overridden via splashDurationMs prop.
  const delayMs =
    splashDurationMs !== undefined ? splashDurationMs : process.env.NODE_ENV === 'test' ? 0 : 3500;

  useEffect(() => {
    let isMounted = true;

    async function runStartupGate() {
      // 1. Minimum splash duration timer
      const splashTimer = new Promise<void>((resolve) => {
        if (delayMs <= 0) {
          resolve();
        } else {
          setTimeout(resolve, delayMs);
        }
      });

      // 2. Initialization & profile resolution task
      const initTask = (async (): Promise<string | null> => {
        let authStatus = useAuthStore.getState().status;

        // If auth is still initializing, wait for session check
        if (authStatus === 'initializing') {
          try {
            await useAuthStore.getState().initializeAuth();
          } catch {
            // Ignore init failure; status defaults to unauthenticated
          }
          authStatus = useAuthStore.getState().status;
        }

        // If auth initialization is still pending or stalled, stay on splash screen
        if (authStatus === 'initializing') {
          return null;
        }

        const currentUser = useAuthStore.getState().user;
        const isGuest = useAuthStore.getState().isGuest;
        let profile = null;
        let localOnboardingCompleted = false;
        let resolvedRoute = '/onboarding/welcome';

        if (authStatus === 'authenticated' && currentUser?.id) {
          const resolution = await resolveAuthenticatedUserRoute(currentUser.id);
          if (resolution) {
            resolvedRoute = resolution.route;
            profile = resolution.profile;
            localOnboardingCompleted = resolution.onboardingCompleted;
          } else {
            resolvedRoute = '/onboarding/welcome';
          }
        } else if (authStatus === 'guest' || isGuest) {
          try {
            const guestData = await guestStorage.getOnboardingData();
            if (guestData) {
              const store = useOnboardingStore.getState();
              if (guestData.goal) store.setGoal(guestData.goal);
              if (guestData.experienceLevel) store.setExperienceLevel(guestData.experienceLevel);
              if (guestData.daysPerWeek) store.setDaysPerWeek(guestData.daysPerWeek);
              if (guestData.workoutDuration) store.setWorkoutDuration(guestData.workoutDuration);
              if (guestData.equipment) store.setEquipment(guestData.equipment);
              if (guestData.workoutStyle) store.setWorkoutStyle(guestData.workoutStyle);
              if (guestData.hasCompletedOnboarding) {
                store.completeOnboarding();
                localOnboardingCompleted = true;
              }
            }
          } catch {
            // Fallback to store
          }

          const hasCompleted = useOnboardingStore.getState().hasCompletedOnboarding;
          if (localOnboardingCompleted || hasCompleted) {
            resolvedRoute = '/home';
          } else {
            resolvedRoute = '/onboarding/welcome';
          }
        } else {
          // Unauthenticated
          resolvedRoute = '/onboarding/welcome';
        }

        const storeCompleted = useOnboardingStore.getState().hasCompletedOnboarding;

        if (__DEV__) {
          console.log(`[STARTUP] AUTH STATUS: ${authStatus}`);
          console.log(`[STARTUP] PROFILE USER ID: ${currentUser?.id ?? 'none'}`);
          console.log(`[STARTUP] PROFILE EXISTS: ${Boolean(profile)}`);
          console.log(
            `[STARTUP] PROFILE ONBOARDING COMPLETED: ${Boolean(profile?.onboarding_completed)}`,
          );
          console.log(
            `[STARTUP] LOCAL ONBOARDING COMPLETED: ${Boolean(localOnboardingCompleted || storeCompleted)}`,
          );
          console.log(`[STARTUP] GUEST SESSION: ${Boolean(authStatus === 'guest' || isGuest)}`);
          console.log(`[STARTUP] STARTUP INITIALIZATION COMPLETE: true`);
        }

        return resolvedRoute;
      })();

      // Wait for both the minimum splash screen timer AND the initialization task
      const [, initResolvedRoute] = await Promise.all([splashTimer, initTask]);

      if (isMounted) {
        let finalTargetRoute = initResolvedRoute;
        const currentAuthStatus = useAuthStore.getState().status;
        const currentUserId = useAuthStore.getState().user?.id;

        // Re-verify against current auth store state to ensure stale async startup decision
        // cannot overwrite state or redirect an authenticated completed user into onboarding
        if (currentAuthStatus === 'unauthenticated') {
          finalTargetRoute = '/onboarding/welcome';
        } else if (
          currentAuthStatus === 'authenticated' &&
          currentUserId &&
          (!initResolvedRoute || initResolvedRoute === '/onboarding/welcome')
        ) {
          const recheck = await resolveAuthenticatedUserRoute(currentUserId);
          if (recheck) {
            finalTargetRoute = recheck.route;
          }
        }

        if (__DEV__) {
          console.log(`[STARTUP] SPLASH COMPLETE: true`);
          console.log(`[STARTUP] FINAL ROUTE: ${finalTargetRoute}`);
        }
        if (finalTargetRoute) {
          setDestination(finalTargetRoute);
        }
      }
    }

    void runStartupGate();

    return () => {
      isMounted = false;
    };
  }, [delayMs]);

  if (!destination) {
    return <StartupSplash />;
  }

  return <Redirect href={destination} />;
}
