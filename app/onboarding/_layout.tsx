import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { useAuthStore, resolveAuthenticatedUserRoute } from '../../src/features/auth';

export default function OnboardingLayout() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (status === 'authenticated' && userId) {
      const activeUserId = userId;
      void (async () => {
        const resolution = await resolveAuthenticatedUserRoute(activeUserId);
        if (
          resolution &&
          resolution.onboardingCompleted &&
          useAuthStore.getState().user?.id === activeUserId
        ) {
          router.replace('/home');
        }
      })();
    }
  }, [status, userId, router]);

  return (
    <Stack
      initialRouteName="welcome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.dark.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="goal" />
      <Stack.Screen name="experience" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}

