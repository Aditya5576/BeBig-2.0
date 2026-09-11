import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer, Text, Button, Card, Input } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/features/onboarding';
import { authService, useAuthStore } from '../../src/features/auth';
import { profileService } from '../../src/features/profile';
import { supabase, isSupabaseConfigured } from '../../src/lib/supabase';
import { getAuthRedirectUrl } from '../../src/features/auth/utils/redirect';
import { spacing, colors, radii } from '../../src/constants/theme';

type EmailMode = 'sign_in' | 'sign_up';

export interface AuthStatusMessage {
  text: string;
  type: 'error' | 'info' | 'success';
  title?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export interface AuthScreenProps {
  initialMode?: 'sign_in' | 'sign_up';
  initialStatusMessage?: AuthStatusMessage | null;
  initialEmail?: string;
}

export default function AuthScreen({
  initialMode,
  initialStatusMessage = null,
  initialEmail = '',
}: AuthScreenProps = {}) {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ mode?: string }>();
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
  const setAuthSession = useAuthStore((state) => state.setSession);
  const enterGuestMode = useAuthStore((state) => state.enterGuestMode);

  const [emailMode, setEmailMode] = useState<EmailMode>(
    initialMode || (searchParams.mode === 'sign_up' ? 'sign_up' : 'sign_in'),
  );
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<AuthStatusMessage | null>(initialStatusMessage);

  const configured = isSupabaseConfigured();

  const handlePostAuthSuccess = async (session: any) => {
    if (!session?.user?.id) {
      setAuthSession(session);
      router.replace('/home');
      return;
    }

    const userId = session.user.id;
    let existingProfile = null;

    try {
      existingProfile = await profileService.getProfile(userId);
    } catch {
      // Ignore network errors; fallback below
    }

    // 1. New Account Sign-Up: Always reset local onboarding state and route directly to /onboarding/goal
    if (emailMode === 'sign_up') {
      useOnboardingStore.getState().resetOnboarding();
      setAuthSession(session);
      router.replace('/onboarding/goal');
      return;
    }

    // 2. Existing account with completed onboarding:
    // Restore their saved profile into useOnboardingStore and route directly to Home.
    if (existingProfile && existingProfile.onboarding_completed) {
      const store = useOnboardingStore.getState();
      if (existingProfile.goal) store.setGoal(existingProfile.goal);
      if (existingProfile.experience_level)
        store.setExperienceLevel(existingProfile.experience_level);
      if (existingProfile.days_per_week) store.setDaysPerWeek(existingProfile.days_per_week);
      if (existingProfile.workout_duration)
        store.setWorkoutDuration(existingProfile.workout_duration);
      if (existingProfile.equipment) store.setEquipment(existingProfile.equipment);
      if (existingProfile.workout_style) store.setWorkoutStyle(existingProfile.workout_style);
      store.completeOnboarding();

      setAuthSession(session);
      router.replace('/home');
      return;
    }

    // 3. Existing account or social login with incomplete onboarding:
    // Reset local store to ensure clean slate and route to onboarding questions.
    useOnboardingStore.getState().resetOnboarding();
    setAuthSession(session);
    router.replace('/onboarding/goal');
  };

  const handleContinueAsGuest = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      completeOnboarding();
      const onboardingState = useOnboardingStore.getState();
      await enterGuestMode(onboardingState);
      router.replace('/home');
    } catch (err: any) {
      setLoading(false);
      setStatusMessage({
        text: err?.message || 'Failed to start guest session. Please try again.',
        type: 'error',
      });
    }
  };

  const handleAppleAuth = async () => {
    setLoading(true);
    setStatusMessage(null);

    const result = await authService.signInWithApple();

    if (result.success && result.session) {
      await handlePostAuthSuccess(result.session);
    } else if (result.success) {
      // Web browser is redirecting to Apple
      setStatusMessage({
        text: result.message,
        type: 'info',
      });
    } else {
      setLoading(false);
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

    if (result.success && result.session) {
      await handlePostAuthSuccess(result.session);
    } else if (result.success) {
      // Web browser is redirecting to Google
      setStatusMessage({
        text: result.message,
        type: 'info',
      });
    } else {
      setLoading(false);
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
    if (emailMode === 'sign_up' && confirmPassword && password !== confirmPassword) {
      setStatusMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    if (emailMode === 'sign_up') {
      useOnboardingStore.getState().resetOnboarding();
      const result = await authService.signUpWithEmail(email, password);

      if (result.success) {
        if (result.session) {
          await handlePostAuthSuccess(result.session);
        } else if (result.requiresEmailConfirmation) {
          setLoading(false);
          setStatusMessage({
            text: result.message,
            type: 'success',
          });
        }
      } else {
        setLoading(false);
        setStatusMessage({ text: result.message, type: 'error' });
      }
    } else {
      const result = await authService.signInWithEmail(email, password);

      if (result.success && result.session) {
        await handlePostAuthSuccess(result.session);
      } else {
        setLoading(false);
        if (result.isNonExistentUser) {
          setStatusMessage({
            title: 'No account found',
            text: "We couldn't find an account with this email. Create an account to get started.",
            type: 'error',
            action: {
              label: 'Create Account',
              onPress: () => {
                setEmailMode('sign_up');
                setStatusMessage(null);
              },
            },
          });
        } else {
          setStatusMessage({ text: result.message, type: 'error' });
        }
      }
    }
  };

  const handleResetPassword = async () => {
    const targetEmail = (resetEmail || email).trim();
    if (!targetEmail) {
      setStatusMessage({
        text: 'Please enter your email address to reset password.',
        type: 'error',
      });
      return;
    }

    setResetLoading(true);
    setStatusMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: getAuthRedirectUrl(),
      });
      if (error) {
        setStatusMessage({ text: error.message, type: 'error' });
      } else {
        setStatusMessage({
          text: `Password reset instructions have been sent to ${targetEmail}.`,
          type: 'success',
        });
        setShowForgotPassword(false);
      }
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'Failed to send password reset email.',
        type: 'error',
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleBack = () => {
    if (showForgotPassword) {
      setShowForgotPassword(false);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/onboarding/welcome');
    }
  };

  return (
    <ScreenContainer>
      {/* Top Header Row with Athletic Branding & Back Navigation */}
      <View style={styles.topNavRow}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          testID="auth-back-button"
        >
          <Text variant="titleLarge" color="accent" style={styles.backChevron}>
            ‹
          </Text>
          <Text variant="bodyBold" color="accent">
            Back
          </Text>
        </Pressable>

        <View style={styles.brandBadge}>
          <Text variant="caption" color="accent" style={styles.brandBadgeText}>
            BEBIG 2.0
          </Text>
        </View>

        <View style={styles.topNavPlaceholder} />
      </View>

      <KeyboardAvoidingView
        testID="auth-keyboard-avoiding-view"
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text variant="display" color="primary" style={styles.headingTitle}>
              {emailMode === 'sign_in' ? 'Welcome Back' : 'Create Your Account'}
            </Text>
            <Text variant="body" color="secondary" style={styles.headingSubtitle}>
              {emailMode === 'sign_in'
                ? 'Sign in to access your workouts, templates, and progression history.'
                : 'Join the lifters tracking progression, beating PRs, and building peak physique.'}
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
              {statusMessage.title ? (
                <Text
                  variant="titleMedium"
                  color="primary"
                  style={styles.statusBannerTitle}
                  testID="auth-status-banner-title"
                >
                  {statusMessage.title}
                </Text>
              ) : null}
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
              {statusMessage.action ? (
                <Button
                  testID="auth-status-action-button"
                  title={statusMessage.action.label}
                  onPress={statusMessage.action.onPress}
                  variant="primary"
                  size="sm"
                  style={styles.statusActionButton}
                />
              ) : null}
            </Card>
          )}

          {/* Mode Switcher Tabs */}
          <View style={styles.modeTabs}>
            <Pressable
              testID="toggle-signin"
              onPress={() => {
                setEmailMode('sign_in');
                setShowForgotPassword(false);
                setStatusMessage(null);
              }}
              style={[styles.tabButton, emailMode === 'sign_in' && styles.tabButtonActive]}
            >
              <Text
                variant="label"
                color={emailMode === 'sign_in' ? 'accent' : 'muted'}
                style={styles.tabText}
              >
                Log In
              </Text>
            </Pressable>

            <Pressable
              testID="toggle-signup"
              onPress={() => {
                setEmailMode('sign_up');
                setShowForgotPassword(false);
                setStatusMessage(null);
              }}
              style={[styles.tabButton, emailMode === 'sign_up' && styles.tabButtonActive]}
            >
              <Text
                variant="label"
                color={emailMode === 'sign_up' ? 'accent' : 'muted'}
                style={styles.tabText}
              >
                Create Account
              </Text>
            </Pressable>
          </View>

          {/* Forgot Password Sub-Card */}
          {showForgotPassword ? (
            <Card style={styles.forgotPasswordCard} testID="forgot-password-card">
              <View style={styles.forgotPasswordHeader}>
                <Text variant="titleMedium" color="primary">
                  Reset Your Password
                </Text>
                <Text variant="caption" color="secondary">
                  Enter your email address and we will send you a recovery link to choose a new
                  password.
                </Text>
              </View>

              <Input
                testID="forgot-password-email-input"
                label="ACCOUNT EMAIL"
                placeholder="athlete@bebig.app"
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!resetLoading}
              />

              <View style={styles.forgotPasswordActions}>
                <Button
                  testID="forgot-password-submit-button"
                  title="Send Reset Link"
                  onPress={handleResetPassword}
                  variant="primary"
                  size="md"
                  loading={resetLoading}
                  disabled={resetLoading}
                  style={styles.resetSubmitButton}
                />
                <Button
                  testID="forgot-password-cancel-button"
                  title="Cancel"
                  onPress={() => setShowForgotPassword(false)}
                  variant="ghost"
                  size="md"
                  disabled={resetLoading}
                />
              </View>
            </Card>
          ) : (
            /* Email Authentication Form */
            <View style={styles.formContainer}>
              <View style={styles.inputsGroup}>
                <Input
                  testID="auth-email-input"
                  label="Email Address"
                  placeholder="athlete@bebig.app"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                <Input
                  testID="auth-password-input"
                  label="Password"
                  placeholder={emailMode === 'sign_up' ? 'At least 6 characters' : 'Enter password'}
                  value={password}
                  onChangeText={setPassword}
                  isPassword={true}
                  toggleTestID="toggle-password-visibility"
                  editable={!loading}
                />

                {emailMode === 'sign_up' ? (
                  <View style={styles.confirmPasswordContainer}>
                    <Input
                      testID="auth-confirm-password-input"
                      label="Confirm Password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      isPassword={true}
                      toggleTestID="toggle-confirm-password-visibility"
                      editable={!loading}
                    />
                    {confirmPassword.length > 0 ? (
                      <Text
                        variant="caption"
                        color={password === confirmPassword ? 'accent' : 'primary'}
                        style={styles.matchIndicator}
                      >
                        {password === confirmPassword
                          ? '✓ Passwords match'
                          : '✕ Passwords do not match'}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {emailMode === 'sign_in' ? (
                  <View style={styles.forgotPasswordRow}>
                    <Pressable
                      testID="auth-forgot-password-button"
                      onPress={() => {
                        setResetEmail(email);
                        setShowForgotPassword(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.forgotPasswordLink}
                    >
                      <Text variant="caption" color="accent" style={styles.forgotPasswordText}>
                        Forgot Password?
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {/* Primary Action Button */}
              <Button
                testID="auth-email-submit-button"
                title={emailMode === 'sign_in' ? 'Log In' : 'Sign Up'}
                onPress={handleEmailSubmit}
                variant="primary"
                size="lg"
                loading={loading}
                disabled={loading}
                style={styles.submitButton}
              />

              {/* Navigation toggle link */}
              <Pressable
                onPress={() => {
                  setEmailMode(emailMode === 'sign_in' ? 'sign_up' : 'sign_in');
                  setStatusMessage(null);
                }}
                style={styles.switchModeRow}
              >
                <Text variant="caption" color="secondary">
                  {emailMode === 'sign_in'
                    ? "Don't have an account? "
                    : 'Already have an account? '}
                  <Text variant="caption" color="accent" style={styles.switchModeAccent}>
                    {emailMode === 'sign_in' ? 'Sign Up' : 'Log In'}
                  </Text>
                </Text>
              </Pressable>
            </View>
          )}

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text variant="caption" color="muted" style={styles.dividerText}>
              OR CONTINUE WITH
            </Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Authentication */}
          <View style={styles.socialButtonsSection}>
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

          {/* Guest Mode Option */}
          <View style={styles.guestSection}>
            <Button
              testID="continue-as-guest-button"
              title="Continue as Guest"
              onPress={handleContinueAsGuest}
              variant="outline"
              size="md"
              disabled={loading}
              style={styles.guestButton}
            />
            <Text variant="caption" color="muted" style={styles.guestCaption}>
              Full training features. Data stored locally on this device.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    minHeight: 44,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    minWidth: 44,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backChevron: {
    fontSize: 28,
    lineHeight: 28,
    marginTop: -2,
  },
  brandBadge: {
    backgroundColor: colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  brandBadgeText: {
    fontWeight: '800',
    letterSpacing: 1.5,
    fontSize: 10,
  },
  topNavPlaceholder: {
    width: 44,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xxl + 12,
    gap: spacing.md,
  },
  headerSection: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  headingTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headingSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.dark.textSecondary,
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
    backgroundColor: '#0F291E',
  },
  statusBannerTitle: {
    marginBottom: 4,
  },
  statusActionButton: {
    marginTop: spacing.sm,
    minHeight: 44,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.dark.surface,
    borderRadius: radii.lg,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  tabButtonActive: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.borderLight,
    borderWidth: 1,
  },
  tabText: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  formContainer: {
    gap: spacing.md,
  },
  inputsGroup: {
    gap: spacing.sm + 2,
  },
  confirmPasswordContainer: {
    gap: spacing.xs,
  },
  matchIndicator: {
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: -2,
  },
  forgotPasswordLink: {
    paddingVertical: spacing.xs,
  },
  forgotPasswordText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  forgotPasswordCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
    gap: spacing.md,
    padding: spacing.md,
  },
  forgotPasswordHeader: {
    gap: spacing.xs,
  },
  forgotPasswordActions: {
    gap: spacing.xs,
  },
  resetSubmitButton: {
    width: '100%',
  },
  submitButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: radii.lg,
    marginTop: spacing.xs,
    shadowColor: colors.dark.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  switchModeRow: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  switchModeAccent: {
    fontWeight: '700',
    textDecorationLine: 'underline',
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
    letterSpacing: 1.2,
    fontWeight: '800',
    fontSize: 10,
  },
  socialButtonsSection: {
    gap: spacing.sm,
  },
  appleButton: {
    backgroundColor: '#F8FAFC',
    minHeight: 48,
    borderRadius: radii.lg,
  },
  googleButton: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.borderLight,
    borderWidth: 1,
    minHeight: 48,
    borderRadius: radii.lg,
  },
  guestSection: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  guestButton: {
    width: '100%',
    borderColor: colors.dark.borderLight,
    borderRadius: radii.lg,
  },
  guestCaption: {
    textAlign: 'center',
    fontSize: 11,
  },
});
