import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { OnboardingHeader, useOnboardingStore } from '../../src/features/onboarding';
import { authService, useAuthStore } from '../../src/features/auth';
import { profileService } from '../../src/features/profile';
import { isSupabaseConfigured } from '../../src/lib/supabase';
import { spacing, colors, radii } from '../../src/constants/theme';

type EmailMode = 'sign_in' | 'sign_up';

export default function AuthScreen() {
  const router = useRouter();
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
  const setAuthSession = useAuthStore((state) => state.setSession);
  const enterGuestMode = useAuthStore((state) => state.enterGuestMode);

  const [emailMode, setEmailMode] = useState<EmailMode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'error' | 'info' | 'success';
  } | null>(null);

  const configured = isSupabaseConfigured();

  const handlePostAuthSuccess = async (session: any) => {
    try {
      if (session?.user?.id) {
        // Sync local onboarding selections to Supabase cloud profile
        await profileService.syncOnboardingProfile(session.user.id, useOnboardingStore.getState());
      }
    } catch {
      // Continue to home even if profile sync fails (can retry in background)
    }

    setAuthSession(session);
    completeOnboarding();
    router.replace('/home');
  };

  const handleContinueAsGuest = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const onboardingState = useOnboardingStore.getState();
      await enterGuestMode(onboardingState);
      completeOnboarding();
      router.replace('/home');
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'Failed to start guest session. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    setLoading(true);
    setStatusMessage(null);

    const result = await authService.signInWithApple();
    setLoading(false);

    if (result.success && result.session) {
      await handlePostAuthSuccess(result.session);
    } else {
      setStatusMessage({
        text: result.message,
        type: result.message.includes('cancelled') ? 'info' : 'error',
      });
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setStatusMessage(null);

    const result = await authService.signInWithGoogle();
    setLoading(false);

    if (result.success && result.session) {
      await handlePostAuthSuccess(result.session);
    } else {
      setStatusMessage({
        text: result.message,
        type: result.message.includes('cancelled') ? 'info' : 'error',
      });
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      setStatusMessage({ text: 'Please enter your email address.', type: 'error' });
      return;
    }
    if (!password) {
      setStatusMessage({ text: 'Please enter your password.', type: 'error' });
      return;
    }
    if (emailMode === 'sign_up' && password.length < 6) {
      setStatusMessage({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    if (emailMode === 'sign_up') {
      const result = await authService.signUpWithEmail(email, password);
      setLoading(false);

      if (result.success) {
        if (result.session) {
          await handlePostAuthSuccess(result.session);
        } else if (result.requiresEmailConfirmation) {
          setStatusMessage({
            text: result.message,
            type: 'success',
          });
        }
      } else {
        setStatusMessage({ text: result.message, type: 'error' });
      }
    } else {
      const result = await authService.signInWithEmail(email, password);
      setLoading(false);

      if (result.success && result.session) {
        await handlePostAuthSuccess(result.session);
      } else {
        setStatusMessage({ text: result.message, type: 'error' });
      }
    }
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

        {!configured && (
          <Card style={styles.unconfiguredCard} testID="supabase-unconfigured-banner">
            <Text variant="label" color="accent" style={styles.cardBadge}>
              ⚠️ Supabase Configuration Required
            </Text>
            <Text variant="body" color="secondary">
              Set{' '}
              <Text variant="bodyBold" color="primary">
                EXPO_PUBLIC_SUPABASE_URL
              </Text>{' '}
              and{' '}
              <Text variant="bodyBold" color="primary">
                EXPO_PUBLIC_SUPABASE_ANON_KEY
              </Text>{' '}
              in your{' '}
              <Text variant="bodyBold" color="primary">
                .env
              </Text>{' '}
              file to enable cloud accounts.
            </Text>
          </Card>
        )}

        {statusMessage && (
          <Card
            style={[
              styles.statusCard,
              statusMessage.type === 'error' && styles.statusCardError,
              statusMessage.type === 'success' && styles.statusCardSuccess,
            ]}
            testID="auth-status-banner"
          >
            <Text
              variant="body"
              color={
                statusMessage.type === 'error'
                  ? 'primary'
                  : statusMessage.type === 'success'
                    ? 'accent'
                    : 'secondary'
              }
            >
              {statusMessage.text}
            </Text>
          </Card>
        )}

        {/* Social Authentication */}
        <View style={styles.authButtonsSection}>
          <Button
            testID="auth-apple-button"
            title="  Continue with Apple"
            onPress={handleAppleAuth}
            variant="secondary"
            size="lg"
            disabled={loading}
            style={styles.appleButton}
          />

          <Button
            testID="auth-google-button"
            title="G  Continue with Google"
            onPress={handleGoogleAuth}
            variant="secondary"
            size="lg"
            disabled={loading}
            style={styles.googleButton}
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text variant="caption" color="muted" style={styles.dividerText}>
            OR CONTINUE WITH EMAIL
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email Authentication Form */}
        <View style={styles.emailSection}>
          {/* Mode Switcher */}
          <View style={styles.modeTabs}>
            <Pressable
              testID="toggle-signin"
              onPress={() => {
                setEmailMode('sign_in');
                setStatusMessage(null);
              }}
              style={[styles.tabButton, emailMode === 'sign_in' && styles.tabButtonActive]}
            >
              <Text variant="label" color={emailMode === 'sign_in' ? 'accent' : 'muted'}>
                Sign In
              </Text>
            </Pressable>

            <Pressable
              testID="toggle-signup"
              onPress={() => {
                setEmailMode('sign_up');
                setStatusMessage(null);
              }}
              style={[styles.tabButton, emailMode === 'sign_up' && styles.tabButtonActive]}
            >
              <Text variant="label" color={emailMode === 'sign_up' ? 'accent' : 'muted'}>
                Create Account
              </Text>
            </Pressable>
          </View>

          {/* Input Fields */}
          <View style={styles.inputsContainer}>
            <View style={styles.inputGroup}>
              <Text variant="label" color="secondary">
                Email
              </Text>
              <TextInput
                testID="auth-email-input"
                style={styles.input}
                placeholder="athlete@bebig.app"
                placeholderTextColor={colors.dark.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text variant="label" color="secondary">
                Password
              </Text>
              <TextInput
                testID="auth-password-input"
                style={styles.input}
                placeholder={emailMode === 'sign_up' ? 'At least 6 characters' : 'Enter password'}
                placeholderTextColor={colors.dark.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          <Button
            testID="auth-email-submit-button"
            title={emailMode === 'sign_in' ? 'Sign In' : 'Create Account'}
            onPress={handleEmailSubmit}
            variant="primary"
            size="lg"
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
          />

          {/* Guest Mode Option */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text variant="caption" color="muted" style={styles.dividerText}>
              OR
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.guestSection}>
            <Button
              testID="continue-as-guest-button"
              title="Continue as Guest"
              onPress={handleContinueAsGuest}
              variant="outline"
              size="lg"
              disabled={loading}
              style={styles.guestButton}
            />
            <Text variant="caption" color="muted" style={styles.guestCaption}>
              Full training features. Data stored locally on this device.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  headerSection: {
    gap: spacing.xs,
  },
  unconfiguredCard: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.warning,
    gap: spacing.xs,
  },
  cardBadge: {
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.borderLight,
  },
  statusCardError: {
    borderColor: colors.dark.error,
    backgroundColor: '#2A1215',
  },
  statusCardSuccess: {
    borderColor: colors.dark.success,
    backgroundColor: '#0E291B',
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
  emailSection: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.dark.surface,
    borderRadius: radii.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.dark.surfaceElevated,
  },
  inputsContainer: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.dark.textPrimary,
    fontSize: 16,
  },
  submitButton: {
    marginTop: spacing.xs,
  },
  guestSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  guestButton: {
    width: '100%',
    borderColor: colors.dark.borderLight,
  },
  guestCaption: {
    textAlign: 'center',
  },
});
