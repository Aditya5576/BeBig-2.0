import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/constants/theme';
import { useSyncLifecycle } from '../src/services/sync';
import { useAuthStore, resolveAuthenticatedUserRoute } from '../src/features/auth';
import { WebAlertModal } from '../src/components/ui';
import { BottomNavBar } from '../src/components/navigation';
import { initErrorMonitoring } from '../src/services/monitoring/errorMonitoring';

function useProtectedRoute() {
  const router = typeof useRouter === 'function' ? useRouter() : null;
  const segments = typeof useSegments === 'function' ? useSegments() : [];
  const navigationState =
    typeof useRootNavigationState === 'function' ? useRootNavigationState() : { key: 'ready' };
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id);

  // 1. Kick off monitoring & auth initialization on root mount
  useEffect(() => {
    initErrorMonitoring();
    if (useAuthStore.getState().status === 'initializing') {
      void useAuthStore.getState().initializeAuth();
    }
  }, []);

  // 2. Route protection: guard protected routes against unauthenticated access
  // and prevent completed authenticated users from entering onboarding
  useEffect(() => {
    if (!router) return;
    if (!navigationState?.key) return;
    if (status === 'initializing') return; // Do NOT redirect prematurely while checking session

    const firstSegment = segments[0];
    const secondSegment = segments[1];
    const isProtected = ['home', 'workout', 'templates', 'exercises', 'settings'].includes(firstSegment);

    if (status === 'unauthenticated' && isProtected) {
      router.replace('/onboarding/welcome');
      return;
    }

    const isGuest = useAuthStore.getState().isGuest;
    const isQuestionnaireRoute =
      firstSegment === 'onboarding' &&
      ['goal', 'experience', 'preferences'].includes(secondSegment);

    if (isGuest && isQuestionnaireRoute) {
      router.replace('/home');
      return;
    }

    if (status === 'authenticated' && userId && firstSegment === 'onboarding') {
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
  }, [status, userId, segments, navigationState?.key, router]);
}

export default function RootLayout() {
  useSyncLifecycle();
  useProtectedRoute();

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.dark.background }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.dark.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="home" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="exercises/index" />
          <Stack.Screen name="exercises/[id]" />
          <Stack.Screen name="exercises/new" />
          <Stack.Screen name="templates/index" />
          <Stack.Screen name="templates/new" />
          <Stack.Screen name="templates/[id]" />
          <Stack.Screen name="workout/start" />
          <Stack.Screen name="workout/active" />
          <Stack.Screen name="workout/summary" />
          <Stack.Screen name="workout/history" />
          <Stack.Screen name="workout/history/[id]" />
          <Stack.Screen name="workout/progress/prs" />
          <Stack.Screen name="workout/progress/exercise/[id]" />
          <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
        </Stack>
        <BottomNavBar />
      </View>
      <WebAlertModal />
    </SafeAreaProvider>
  );
}

