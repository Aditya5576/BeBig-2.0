import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSyncLifecycle } from '../src/services/sync';
import { useAuthStore, resolveAuthenticatedUserRoute } from '../src/features/auth';
import { WebAlertModal, ReleaseNotesModal, PwaUpdateCard, StartupSplash } from '../src/components/ui';
import { getAppVersionInfo } from '../src/config/version';
import { CURRENT_RELEASE_NOTES, defaultReleaseHighlights } from '../src/lib/releaseNotes/releaseNotesService';
import {
  authorizeAndApplyPwaUpdate,
  canReloadNow,
  getAuthorizedPwaReload,
  isActiveWorkoutMounted,
  PwaControllerCheckTarget,
  subscribeActiveWorkoutPresence,
} from '../src/lib/pwa/pwaUpdateCoordinator';
import { BottomNavBar } from '../src/components/navigation';
import { initErrorMonitoring, wrapRootLayout, setUserContext } from '../src/services/monitoring/errorMonitoring';
import { errorTelemetryService } from '../src/features/admin/services/errorTelemetryService';
import { useThemeStore, useWebThemeSync, useAppTheme } from '../src/features/theme';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import '../src/features/workout/services/workoutNotificationService';

export const FONT_LOAD_TIMEOUT_MS = 1500;

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
    errorTelemetryService.installGlobalErrorHandlers();
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

  const [pendingSwUpdate, setPendingSwUpdate] = useState<{
    worker: ServiceWorker;
    version: string;
    sha: string;
    highlight: string;
  } | null>(null);
  const [isApplyingSwUpdate, setIsApplyingSwUpdate] = useState(false);
  const [swUpdateError, setSwUpdateError] = useState<string | null>(null);
  const [dismissedSwVersion, setDismissedSwVersion] = useState<string | null>(null);
  const [isActiveWorkoutOpen, setIsActiveWorkoutOpen] = useState<boolean>(() =>
    isActiveWorkoutMounted(),
  );
  const lastAppliedSwRef = useRef<{ worker: ServiceWorker; version: string; sha: string } | null>(null);
  const deferredReloadTargetRef = useRef<PwaControllerCheckTarget | null>(null);

  const RELOAD_GUARD_KEY = 'bebig_sw_reloaded_v270';

  const executeDeferredReloadIfAuthorized = (target: PwaControllerCheckTarget | null) => {
    if (!target) return false;
    if (!canReloadNow(target)) return false;
    deferredReloadTargetRef.current = null;
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (sessionStorage.getItem(RELOAD_GUARD_KEY)) {
          return false;
        }
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
      }
      if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        window.location.reload();
      }
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    return subscribeActiveWorkoutPresence((isOpen) => {
      setIsActiveWorkoutOpen(isOpen);
      if (!isOpen && deferredReloadTargetRef.current) {
        executeDeferredReloadIfAuthorized(deferredReloadTargetRef.current);
      }
    });
  }, []);

  // Web Service Worker update detection + MessageChannel metadata + authorized reload
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let isMounted = true;

    const queryWorkerMetadata = (worker: ServiceWorker) => {
      const appVer = getAppVersionInfo().version;
      const fallbackHighlight =
        CURRENT_RELEASE_NOTES[appVer]?.highlights?.[0] ||
        defaultReleaseHighlights[0] ||
        'New improvements and stability fixes.';

      if (typeof MessageChannel === 'undefined') {
        if (isMounted) {
          setPendingSwUpdate({ worker, version: appVer, sha: '', highlight: fallbackHighlight });
        }
        return;
      }

      try {
        const channel = new MessageChannel();
        const timer = setTimeout(() => {
          if (isMounted) {
            setPendingSwUpdate({ worker, version: appVer, sha: '', highlight: fallbackHighlight });
          }
        }, 800);

        channel.port1.onmessage = (evt) => {
          clearTimeout(timer);
          const data = evt.data;
          const ver =
            data?.version && !String(data.version).startsWith('__BEBIG_')
              ? String(data.version)
              : appVer;
          const sha =
            data?.sha && !String(data.sha).startsWith('__BEBIG_') ? String(data.sha) : '';
          const hl =
            data?.highlight && !String(data.highlight).startsWith('__BEBIG_')
              ? String(data.highlight)
              : CURRENT_RELEASE_NOTES[ver]?.highlights?.[0] || fallbackHighlight;
          if (isMounted) {
            setPendingSwUpdate({ worker, version: ver, sha, highlight: hl });
          }
        };

        worker.postMessage({ type: 'GET_SW_METADATA' }, [channel.port2]);
      } catch {
        if (isMounted) {
          setPendingSwUpdate({ worker, version: appVer, sha: '', highlight: fallbackHighlight });
        }
      }
    };

    const readControllerMetadata = (
      controller: ServiceWorker | null,
    ): Promise<PwaControllerCheckTarget> => {
      if (!controller) return Promise.resolve({});
      const base: PwaControllerCheckTarget = { scriptUrl: controller.scriptURL };
      if (lastAppliedSwRef.current && lastAppliedSwRef.current.worker === controller) {
        return Promise.resolve({
          ...base,
          version: lastAppliedSwRef.current.version,
          sha: lastAppliedSwRef.current.sha,
        });
      }
      if (typeof MessageChannel === 'undefined') {
        return Promise.resolve(base);
      }
      return new Promise((resolve) => {
        try {
          const channel = new MessageChannel();
          const timer = setTimeout(() => resolve(base), 200);
          channel.port1.onmessage = (evt) => {
            clearTimeout(timer);
            const data = evt.data;
            resolve({
              ...base,
              version:
                data?.version && !String(data.version).startsWith('__BEBIG_')
                  ? String(data.version)
                  : undefined,
              sha:
                data?.sha && !String(data.sha).startsWith('__BEBIG_')
                  ? String(data.sha)
                  : undefined,
            });
          };
          controller.postMessage({ type: 'GET_SW_METADATA' }, [channel.port2]);
        } catch {
          resolve(base);
        }
      });
    };

    const handleControllerChange = () => {
      const controller = navigator.serviceWorker.controller;
      void readControllerMetadata(controller).then((target) => {
        if (!isMounted) return;
        if (!executeDeferredReloadIfAuthorized(target)) {
          const auth = getAuthorizedPwaReload();
          if (auth && auth.sessionId === null && isActiveWorkoutMounted()) {
            deferredReloadTargetRef.current = target;
          }
        }
      });
    };

    navigator.serviceWorker.addEventListener?.('controllerchange', handleControllerChange);

    let activeReg: ServiceWorkerRegistration | undefined;
    const handleUpdateFound = () => {
      const installing = activeReg?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          queryWorkerMetadata(installing);
        }
      });
    };

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg || !isMounted) return;
        activeReg = reg;
        if (reg.waiting && navigator.serviceWorker.controller) {
          queryWorkerMetadata(reg.waiting);
        }
        reg.addEventListener?.('updatefound', handleUpdateFound);
        reg.update().catch(() => {});
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      activeReg?.removeEventListener?.('updatefound', handleUpdateFound);
      navigator.serviceWorker.removeEventListener?.('controllerchange', handleControllerChange);
    };
  }, []);

  const handleApplyPwaUpdate = async () => {
    if (!pendingSwUpdate) return;
    setIsApplyingSwUpdate(true);
    setSwUpdateError(null);
    lastAppliedSwRef.current = {
      worker: pendingSwUpdate.worker,
      version: pendingSwUpdate.version,
      sha: pendingSwUpdate.sha,
    };
    const result = await authorizeAndApplyPwaUpdate(pendingSwUpdate.worker, {
      version: pendingSwUpdate.version,
      sha: pendingSwUpdate.sha,
    });
    if (!result.ok) {
      setIsApplyingSwUpdate(false);
      setSwUpdateError(result.error || 'Could not apply update yet.');
    }
  };

  // Professional athletic typography: 7 lightweight static TTF weights (Plus Jakarta Sans + Inter)
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Non-blocking 1.5s safety fallback: offline/failed font loads must never stall app startup
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timeoutId = setTimeout(() => {
      setFontLoadTimedOut(true);
    }, FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [fontsLoaded, fontError]);

  const fontsReady = fontsLoaded || Boolean(fontError) || fontLoadTimedOut;

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

  if (!isHydrated || !fontsReady) {
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
          <Stack.Screen name="legal/privacy" />
          <Stack.Screen name="legal/terms" />
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
      {!showColdBootSplash &&
        !isActiveWorkoutOpen &&
        pendingSwUpdate &&
        dismissedSwVersion !== pendingSwUpdate.version && (
        <PwaUpdateCard
          visible={true}
          version={pendingSwUpdate.version}
          highlight={pendingSwUpdate.highlight}
          updating={isApplyingSwUpdate}
          errorMessage={swUpdateError}
          onUpdateNow={() => void handleApplyPwaUpdate()}
          onLater={() => setDismissedSwVersion(pendingSwUpdate.version)}
        />
      )}
    </SafeAreaProvider>
  );
});

