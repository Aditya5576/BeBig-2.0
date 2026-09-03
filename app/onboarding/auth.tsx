import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { OnboardingHeader, useOnboardingStore } from '../../src/features/onboarding';
import { authService } from '../../src/features/auth';
import { spacing, colors } from '../../src/constants/theme';

export default function AuthScreen() {
  const router = useRouter();
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
  const [authStatusMessage, setAuthStatusMessage] = useState<string | null>(null);

  const handleAppleAuth = async () => {
    const result = await authService.signInWithApple();
    setAuthStatusMessage(result.message);
  };

  const handleGoogleAuth = async () => {
    const result = await authService.signInWithGoogle();
    setAuthStatusMessage(result.message);
  };

  const handleEmailAuth = async () => {
    const result = await authService.signInWithEmail('user@bebig.app');
    setAuthStatusMessage(result.message);
  };

  const handleCompleteOnboardingDev = () => {
    completeOnboarding();
    router.replace('/home');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <ScreenContainer>
      <OnboardingHeader currentStep={4} totalSteps={4} onBack={handleBack} canGoBack={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <Text variant="display" color="primary">
            Save Your Profile
          </Text>
          <Text variant="body" color="secondary">
            Connect your account to sync workouts, preserve routines, and access your training
            history across all your devices.
          </Text>
        </View>

        {authStatusMessage && (
          <Card style={styles.noticeCard} testID="auth-status-banner">
            <View style={styles.noticeHeader}>
              <Text variant="label" color="accent">
                ℹ️ Milestone 2 Notice
              </Text>
            </View>
            <Text variant="body" color="primary">
              {authStatusMessage}
            </Text>
          </Card>
        )}

        <View style={styles.authButtonsSection}>
          {/* Apple Sign In */}
          <Button
            testID="auth-apple-button"
            title="  Continue with Apple"
            onPress={handleAppleAuth}
            variant="secondary"
            size="lg"
            style={styles.appleButton}
          />

          {/* Google Sign In */}
          <Button
            testID="auth-google-button"
            title="G  Continue with Google"
            onPress={handleGoogleAuth}
            variant="secondary"
            size="lg"
            style={styles.googleButton}
          />

          {/* Email Sign In */}
          <Button
            testID="auth-email-button"
            title="✉️  Continue with Email"
            onPress={handleEmailAuth}
            variant="outline"
            size="lg"
            style={styles.emailButton}
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text variant="caption" color="muted" style={styles.dividerText}>
            DEVELOPMENT PREVIEW
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.devSection}>
          <Text variant="caption" color="muted" style={styles.devDisclaimer}>
            Cloud authentication will be activated in Milestone 3 with Supabase. Tap below to finish
            onboarding and enter the application.
          </Text>

          <Button
            testID="complete-onboarding-button"
            title="Complete Onboarding & Enter App"
            onPress={handleCompleteOnboardingDev}
            variant="primary"
            size="lg"
            style={styles.completeButton}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.xl,
  },
  headerSection: {
    gap: spacing.xs,
  },
  noticeCard: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.primary,
    gap: spacing.xs,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authButtonsSection: {
    gap: spacing.md,
  },
  appleButton: {
    backgroundColor: '#F8FAFC',
  },
  googleButton: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.borderLight,
    borderWidth: 1,
  },
  emailButton: {
    borderColor: colors.dark.borderLight,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.dark.border,
  },
  dividerText: {
    letterSpacing: 1,
    fontWeight: '700',
  },
  devSection: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  devDisclaimer: {
    textAlign: 'center',
    lineHeight: 18,
  },
  completeButton: {
    width: '100%',
  },
});
