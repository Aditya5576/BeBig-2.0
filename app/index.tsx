import React from 'react';
import { Redirect } from 'expo-router';
import { useOnboardingStore } from '../src/features/onboarding';

/**
 * Root Index Gatekeeper
 *
 * Checks onboarding status:
 * - Returning users who completed onboarding navigate directly to /home.
 * - First-time users are routed to the BeBig onboarding flow at /onboarding/welcome.
 */
export default function Index() {
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);

  if (hasCompletedOnboarding) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/onboarding/welcome" />;
}
