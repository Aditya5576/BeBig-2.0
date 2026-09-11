import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useOnboardingStore } from '../../src/features/onboarding';

export default function SignUpScreen() {
  useEffect(() => {
    useOnboardingStore.getState().resetOnboarding();
  }, []);

  return <Redirect href="/onboarding/auth?mode=sign_up" />;
}
