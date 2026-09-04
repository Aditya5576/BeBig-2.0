import React, { useEffect } from 'react';
import { useOnboardingStore } from '../../src/features/onboarding';
import AuthScreen from './auth';

export default function SignUpScreen() {
  useEffect(() => {
    useOnboardingStore.getState().resetOnboarding();
  }, []);

  return <AuthScreen initialMode="sign_up" />;
}
