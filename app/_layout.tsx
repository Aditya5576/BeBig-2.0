import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSyncLifecycle } from '../src/services/sync';
import { useAuthStore, resolveAuthenticatedUserRoute } from '../src/features/auth';
import { WebAlertModal, ReleaseNotesModal, StartupSplash } from '../src/components/ui';
import { BottomNavBar } from '../src/components/navigation';
import { initErrorMonitoring, wrapRootLayout, setUserContext } from '../src/services/monitoring/errorMonitoring';
import { useThemeStore, useWebThemeSync, useAppTheme } from '../src/features/theme';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import '../src/features/workout/services/workoutNotificationService';

// Initialize monitoring eagerly if configured
initErrorMonitoring();

function useProtectedRoute() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id);

  // 1. Kick off monitoring, theme, & auth initialization on root mount
  useEffect(() => {
    initErrorMonitoring();
    useThemeStore.getState().initializeTheme();
    if (useAuthStore.getState().status === 'initializing') {
      void useAuthStore.getState().initializeAuth();
    }
  }, []);

  // 1b. Synchronize user context with error monitoring (anonymous user ID only)
  useEffect(() => {
    if (status === 'authenticated' && userId) {
      setUserContext(userId);
    } else {
      setUserContext(null);
    }
  }, [status, userId]);

  // 2. Route protection: guard protected routes against unauthenticated access
  // and prevent completed authenticated users from entering onboarding
  useEffect(() => {
    if (!router) return;
    if (!navigationState?.key) return;
    if (status === 'initializing') return; // Do NOT redirect prematurely while checking session

    const rawSegments = segments as string[];
    const firstSegment = rawSegments[0];
    const secondSegment = rawSegments[1];
    const isProtected = ['home', 'workout', 'templates', 'exercises', 'settings'].includes(firstSegment);

    if (status === 'unauthenticated' && isProtected) {
      router.replace('/onboarding/welcome');
      return;
    }

    const isGuest = useAuthStore.getState().isGuest;
    const isQuestionnaireRoute =
      firstSegment === 'onboarding' &&
      Boolean(secondSegment && ['goal', 'experience', 'preferences'].includes(secondSegment));

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

// In-memory cold-boot showcase tracker across JS session lifecycle
let hasShownSessionStartupSplash = false;

export default wrapRootLayout(function RootLayout() {
  useSyncLifecycle();
  useProtectedRoute();
  
  useWebThemeSync();
  const { colors, activeMode } = useAppTheme();
  const isHydrated = useThemeStore((state) => state.isHydrated);

  // Web Service Worker auto-update check on app mount
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update().catch(() => {});
      }).catch(() => {});
    }
  }, []);

  // Modern athletic typography: Plus Jakarta Sans & JetBrains Mono
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
    'JetBrainsMono-SemiBold': JetBrainsMono_600SemiBold,
    'JetBrainsMono-Bold': JetBrainsMono_700Bold,
  });

  // Intentional cinematic cold launch showcase gate (3.5 seconds / 3500ms)
  const [showColdBootSplash, setShowColdBootSplash] = useState(() => {
    if (process.env.NODE_ENV === 'test') {
      return false;
    }
    return !hasShownSessionStartupSplash;
  });

  useEffect(() => {
    if (!showColdBootSplash) return;
    const splashTimer = setTimeout(() => {
      hasShownSessionStartupSplash = true;
      setShowColdBootSplash(false);
    }, 3550);

    return () => clearTimeout(splashTimer);
  }, [showColdBootSplash]);

  if (!isHydrated || (!fontsLoaded && process.env.NODE_ENV !== 'test')) {
    return (
      <View style={{ flex: 1, backgroundColor: '#090D16' }}>
        <StatusBar style="light" />
        <StartupSplash />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={activeMode === 'light' ? 'dark' : 'light'} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { flex: 1, backgroundColor: colors.background },
            animation: 'default',
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
          <Stack.Screen name="workout/progress/weekly" />
          <Stack.Screen name="workout/progress/exercise/[id]" />
          <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
        </Stack>
        <BottomNavBar />
      </View>
      {showColdBootSplash && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 99999, backgroundColor: '#090D16' },
          ]}
          pointerEvents="auto"
        >
          <StartupSplash
            onFinish={() => {
              hasShownSessionStartupSplash = true;
              setShowColdBootSplash(false);
            }}
          />
        </View>
      )}
      <WebAlertModal />
      {!showColdBootSplash && <ReleaseNotesModal />}
    </SafeAreaProvider>
  );
});

