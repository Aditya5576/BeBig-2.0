import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { authService, useAuthStore } from '../../src/features/auth';
import { profileService } from '../../src/features/profile';
import { useOnboardingStore } from '../../src/features/onboarding';
import { colors, spacing } from '../../src/constants/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const setSession = useAuthStore((state) => state.setSession);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function processAuthCallback() {
      try {
        // 1. Check if error was passed in search params
        const errorDesc = searchParams.error_description || searchParams.error;
        if (errorDesc) {
          const message = Array.isArray(errorDesc) ? errorDesc[0] : errorDesc;
          if (isMounted) {
            setError(decodeURIComponent(message.replace(/\+/g, ' ')));
            setLoading(false);
          }
          return;
        }

        // 2. Retrieve initial URL or reconstruct from search params
        const initialUrl = await Linking.getInitialURL();
        let urlToProcess = initialUrl;

        // If Linking doesn't provide the full URL, build from params
        if (!urlToProcess || !urlToProcess.includes('auth/callback')) {
          const queryString = Object.entries(searchParams)
            .map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v[0] : v)}`)
            .join('&');
          urlToProcess = `bebig://auth/callback?${queryString}`;
        }

        const result = await authService.handleIncomingAuthUrl(urlToProcess);

        if (!isMounted) return;

        if (result.success && result.session) {
          // Sync onboarding profile if present
          const onboardingState = useOnboardingStore.getState();
          if (onboardingState.goal) {
            try {
              await profileService.syncOnboardingProfile(result.session.user.id, onboardingState);
              useOnboardingStore.getState().completeOnboarding();
            } catch {
              // Proceed to home even if background sync fails
            }
          }

          setSession(result.session);
          router.replace('/home');
        } else {
          setError(result.message || 'Verification link expired or invalid.');
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to process authentication callback.');
          setLoading(false);
        }
      }
    }

    void processAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [searchParams, router, setSession]);

  const handleReturnToSignIn = () => {
    router.replace('/onboarding/auth');
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.content}>
        <Text variant="display" color="accent" style={styles.logoText}>
          BEBIG
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <Text variant="titleMedium" color="primary">
              Confirming Your Account...
            </Text>
            <Text variant="body" color="secondary" style={styles.subtitle}>
              Verifying your email and preparing your training profile.
            </Text>
            <ActivityIndicator
              testID="callback-loading-indicator"
              size="large"
              color={colors.dark.primary}
              style={styles.spinner}
            />
          </View>
        ) : (
          <View style={styles.errorBox}>
            <Card style={styles.errorCard} testID="callback-error-card">
              <Text variant="titleMedium" color="primary">
                Verification Issue
              </Text>
              <Text variant="body" color="secondary">
                {error}
              </Text>
            </Card>

            <Button
              testID="callback-signin-button"
              title="Return to Sign In"
              onPress={handleReturnToSignIn}
              variant="primary"
              size="lg"
              style={styles.button}
            />
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: spacing.xl,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 4,
  },
  loadingBox: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
  },
  spinner: {
    marginTop: spacing.lg,
  },
  errorBox: {
    width: '100%',
    gap: spacing.lg,
  },
  errorCard: {
    backgroundColor: '#2A1215',
    borderColor: colors.dark.error,
    gap: spacing.xs,
  },
  button: {
    width: '100%',
  },
});
