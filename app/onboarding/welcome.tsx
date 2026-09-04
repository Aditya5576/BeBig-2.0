import React from 'react';
import { View, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/features/onboarding';
import { spacing, colors, radii } from '../../src/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleSignUp = () => {
    useOnboardingStore.getState().resetOnboarding();
    router.push('/onboarding/auth?mode=sign_up');
  };

  const handleLogin = () => {
    router.push('/onboarding/auth?mode=sign_in');
  };

  const handleGuest = () => {
    router.push('/onboarding/goal');
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header & Brand Identity */}
        <View style={styles.headerSection}>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text variant="caption" color="accent" style={styles.badgeText}>
                BeBig 2.0 • Athletic Intelligence
              </Text>
            </View>
          </View>

          {/* Athlete Hero Visual Artwork with Subtle Glow */}
          <View style={styles.heroGlowWrapper}>
            <View style={styles.heroContainer}>
              <Image
                source={require('../../assets/splash-athlete.png')}
                style={styles.heroImage}
                resizeMode="cover"
                testID="welcome-hero-image"
              />
            </View>
          </View>

          <View style={styles.titleSection}>
            <Text variant="display" color="primary" style={styles.title}>
              Train With Purpose.{'\n'}Track With Precision.
            </Text>
            <Text variant="body" color="secondary" style={styles.subtitle}>
              The dedicated progressive overload tracker built for serious lifters. Log your sets,
              master your progression, and achieve your peak physique.
            </Text>
          </View>
        </View>

        {/* Feature Value Props */}
        <View style={styles.featureList}>
          <Card style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Text variant="titleMedium" color="accent">
                ⚡
              </Text>
            </View>
            <View style={styles.featureText}>
              <Text variant="titleMedium" color="primary">
                Smart Set Logging
              </Text>
              <Text variant="caption" color="secondary">
                Frictionless logging for weights, reps, and RPE between heavy sets.
              </Text>
            </View>
          </Card>

          <Card style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Text variant="titleMedium" color="accent">
                📈
              </Text>
            </View>
            <View style={styles.featureText}>
              <Text variant="titleMedium" color="primary">
                Progressive Overload
              </Text>
              <Text variant="caption" color="secondary">
                Always know your previous numbers and beat your personal records.
              </Text>
            </View>
          </Card>

          <Card style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Text variant="titleMedium" color="accent">
                🛡️
              </Text>
            </View>
            <View style={styles.featureText}>
              <Text variant="titleMedium" color="primary">
                Gym-Resilient & Private
              </Text>
              <Text variant="caption" color="secondary">
                Works 100% offline in basement gyms. Your data remains isolated.
              </Text>
            </View>
          </Card>
        </View>

        {/* Two Clear, Intentionally Separated Actions */}
        <View style={styles.actionSection}>
          {/* Primary Action: New Lifter Sign Up */}
          <View testID="welcome-signup-button" style={styles.primaryActionWrapper}>
            <Button
              testID="welcome-get-started-button"
              title="I’m New — Sign Up"
              onPress={handleSignUp}
              variant="primary"
              size="lg"
              style={styles.primaryButton}
            />
          </View>

          {/* Secondary Action: Returning Lifter Log In */}
          <Button
            testID="welcome-sign-in-button"
            title="Log In"
            onPress={handleLogin}
            variant="secondary"
            size="lg"
            style={styles.secondaryButton}
          />

          {/* Discreet Guest Option */}
          <Pressable
            testID="welcome-guest-button"
            onPress={handleGuest}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.guestLink}
          >
            <Text variant="caption" color="muted">
              Want to explore first?{' '}
              <Text variant="caption" color="accent" style={styles.guestLinkAccent}>
                Continue as Guest
              </Text>
            </Text>
          </Pressable>
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
    gap: spacing.lg,
  },
  headerSection: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.primary,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeText: {
    letterSpacing: 1.2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroGlowWrapper: {
    marginVertical: spacing.xs,
    shadowColor: colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  heroContainer: {
    width: 140,
    height: 140,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.dark.borderLight,
    backgroundColor: colors.dark.surfaceElevated,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  title: {
    fontWeight: '900',
    lineHeight: 36,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
    color: colors.dark.textSecondary,
  },
  featureList: {
    gap: spacing.sm,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.dark.surface,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.dark.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  actionSection: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  primaryActionWrapper: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: radii.lg,
    shadowColor: colors.dark.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  secondaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.borderLight,
    borderWidth: 1,
  },
  guestLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  guestLinkAccent: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
