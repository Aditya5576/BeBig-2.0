import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../src/components/ui';
import { useOnboardingStore } from '../src/features/onboarding';
import { spacing, colors, radii } from '../src/constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  const goal = useOnboardingStore((state) => state.goal);
  const experienceLevel = useOnboardingStore((state) => state.experienceLevel);
  const daysPerWeek = useOnboardingStore((state) => state.daysPerWeek);
  const workoutDuration = useOnboardingStore((state) => state.workoutDuration);
  const trainingLocation = useOnboardingStore((state) => state.trainingLocation);
  const equipment = useOnboardingStore((state) => state.equipment);
  const preferredTrainingDays = useOnboardingStore((state) => state.preferredTrainingDays);
  const workoutStyle = useOnboardingStore((state) => state.workoutStyle);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);

  const handleReset = () => {
    resetOnboarding();
    router.replace('/onboarding/welcome');
  };

  const formatText = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return 'Not selected';
    if (typeof val === 'number') return `${val} days / week`;
    return val.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formattedDays =
    preferredTrainingDays.length > 0
      ? preferredTrainingDays.map((d) => d.slice(0, 3).toUpperCase()).join(', ')
      : 'Any day';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text variant="caption" color="accent" style={styles.badgeText}>
                Milestone 2 Verified
              </Text>
            </View>
          </View>

          <Text variant="display" color="primary" testID="home-title">
            Welcome to BeBig!
          </Text>
          <Text variant="body" color="secondary">
            Onboarding completed successfully. Your training preferences are captured below in local
            state.
          </Text>
        </View>

        <Card style={styles.profileCard}>
          <Text variant="titleMedium" color="primary" style={styles.cardHeader}>
            Configured Training Profile
          </Text>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Primary Goal:
            </Text>
            <Text variant="bodyBold" color="accent" testID="summary-goal">
              {formatText(goal)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Experience Level:
            </Text>
            <Text variant="bodyBold" color="primary" testID="summary-experience">
              {formatText(experienceLevel)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Weekly Frequency:
            </Text>
            <Text variant="bodyBold" color="primary" testID="summary-days">
              {formatText(daysPerWeek)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Session Duration:
            </Text>
            <Text variant="bodyBold" color="primary" testID="summary-duration">
              {formatText(workoutDuration)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Training Location:
            </Text>
            <Text variant="bodyBold" color="primary" testID="summary-location">
              {formatText(trainingLocation)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Equipment Access:
            </Text>
            <Text variant="bodyBold" color="primary" testID="summary-equipment">
              {formatText(equipment)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Workout Style:
            </Text>
            <Text variant="bodyBold" color="primary" testID="summary-style">
              {formatText(workoutStyle)}
            </Text>
          </View>

          <View style={[styles.row, styles.noBorder]}>
            <Text variant="label" color="muted">
              Preferred Days:
            </Text>
            <Text variant="bodyBold" color="accent" testID="summary-training-days">
              {formattedDays}
            </Text>
          </View>
        </Card>

        <Card style={styles.infoCard}>
          <Text variant="titleMedium" color="primary">
            Upcoming Milestones
          </Text>
          <Text variant="body" color="secondary">
            In Milestone 3, Supabase will be integrated for cloud authentication and cross-device
            profile synchronization.
          </Text>
        </Card>

        <View style={styles.actionSection}>
          <Button
            testID="reset-onboarding-button"
            title="Reset Onboarding (Dev Testing)"
            onPress={handleReset}
            variant="outline"
            size="lg"
            style={styles.resetButton}
          />
          <Text variant="caption" color="muted" style={styles.resetHint}>
            Use this button on your iPhone to reset state and test the onboarding flow again.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
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
  profileCard: {
    gap: spacing.md,
  },
  cardHeader: {
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark.border,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  infoCard: {
    gap: spacing.xs,
    backgroundColor: colors.dark.surfaceSubtle,
  },
  actionSection: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  resetButton: {
    width: '100%',
    borderColor: colors.dark.borderLight,
  },
  resetHint: {
    textAlign: 'center',
  },
});
