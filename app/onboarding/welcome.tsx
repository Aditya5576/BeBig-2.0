import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { spacing, colors, radii } from '../../src/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/onboarding/goal');
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text variant="caption" color="accent" style={styles.badgeText}>
                BeBig 2.0
              </Text>
            </View>
          </View>

          <Text variant="display" color="primary" style={styles.title}>
            Train With Purpose.{'\n'}Track With Precision.
          </Text>

          <Text variant="body" color="secondary" style={styles.subtitle}>
            The dedicated workout tracker built for serious lifters. Log your sets, master
            progressive overload, and achieve your peak physique.
          </Text>
        </View>

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
              <Text variant="body" color="secondary">
                Frictionless logging for weights, reps, and RPE designed for use between heavy sets.
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
              <Text variant="body" color="secondary">
                Always know your previous performance and beat your records workout by workout.
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
              <Text variant="body" color="secondary">
                Never lose active workout progress, even in zero-reception basement gyms.
              </Text>
            </View>
          </Card>
        </View>

        <View style={styles.actionSection}>
          <Button
            testID="welcome-get-started-button"
            title="Get Started"
            onPress={handleGetStarted}
            variant="primary"
            size="lg"
            style={styles.ctaButton}
          />
          <Text variant="caption" color="muted" style={styles.disclaimerText}>
            Personalize your training program in less than 2 minutes.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  heroSection: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
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
  title: {
    fontWeight: '800',
    lineHeight: 40,
  },
  subtitle: {
    lineHeight: 22,
  },
  featureList: {
    gap: spacing.md,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.dark.surface,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
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
    paddingBottom: spacing.sm,
  },
  ctaButton: {
    width: '100%',
  },
  disclaimerText: {
    textAlign: 'center',
  },
});
