import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/constants/theme';
import { useSyncLifecycle } from '../src/services/sync';
import { useAuthStore } from '../src/features/auth';
import { WebAlertModal } from '../src/components/ui';
import '../src/lib/ui/webAlert';

function useProtectedRoute() {
  const router = typeof useRouter === 'function' ? useRouter() : null;
  const segments = typeof useSegments === 'function' ? useSegments() : [];
  const navigationState =
    typeof useRootNavigationState === 'function' ? useRootNavigationState() : { key: 'ready' };
  const status = useAuthStore((state) => state.status);

  // 1. Kick off auth initialization on root mount if still initializing (e.g. direct URL navigation / refresh)
  useEffect(() => {
    if (useAuthStore.getState().status === 'initializing') {
      void useAuthStore.getState().initializeAuth();
    }
  }, []);

  // 2. Route protection: guard protected routes against unauthenticated access
  useEffect(() => {
    if (!router) return;
    if (!navigationState?.key) return;
    if (status === 'initializing') return; // Do NOT redirect prematurely while checking session

    const firstSegment = segments[0];
    const isProtected = ['home', 'workout', 'templates', 'exercises'].includes(firstSegment);

    if (status === 'unauthenticated' && isProtected) {
      router.replace('/onboarding/welcome');
    }
  }, [status, segments, navigationState?.key, router]);
}

export default function RootLayout() {
  useSyncLifecycle();
  useProtectedRoute();

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.dark.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="home" />
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
      <WebAlertModal />
    </SafeAreaProvider>
  );
}
