import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../src/components/ui';
import { useOnboardingStore } from '../src/features/onboarding';
import { useAuthStore } from '../src/features/auth';
import { spacing, colors, radii } from '../src/constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const signOut = useAuthStore((state) => state.signOut);
  const exitGuestMode = useAuthStore((state) => state.exitGuestMode);

  const goal = useOnboardingStore((state) => state.goal);
  const experienceLevel = useOnboardingStore((state) => state.experienceLevel);
  const daysPerWeek = useOnboardingStore((state) => state.daysPerWeek);
  const workoutDuration = useOnboardingStore((state) => state.workoutDuration);
  const trainingLocation = useOnboardingStore((state) => state.trainingLocation);
  const equipment = useOnboardingStore((state) => state.equipment);
  const preferredTrainingDays = useOnboardingStore((state) => state.preferredTrainingDays);
  const workoutStyle = useOnboardingStore((state) => state.workoutStyle);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);

  const handleSignOut = async () => {
    if (isGuest) {
      await exitGuestMode();
      // Onboarding and workout preferences are preserved on device per requirement
      router.replace('/onboarding/welcome');
    } else {
      await signOut();
      resetOnboarding();
      router.replace('/onboarding/welcome');
    }
  };

  const handleResetDev = () => {
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

  const badgeText = user
    ? 'Supabase Authenticated'
    : isGuest
      ? 'Guest Mode — Local Device'
      : 'Milestone 3 Verified';

  const subtitleText = user?.email
    ? `Signed in as ${user.email}. Your profile is synced with the cloud.`
    : isGuest
      ? 'Guest Mode — Data stored on this device'
      : 'Onboarding completed successfully. Your profile is ready.';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text variant="caption" color="accent" style={styles.badgeText}>
                {badgeText}
              </Text>
            </View>
          </View>

          <Text variant="display" color="primary" testID="home-title">
            Welcome to BeBig!
          </Text>
          <Text variant="body" color="secondary">
            {subtitleText}
          </Text>
        </View>

        {user && (
          <Card style={styles.accountCard} testID="account-card">
            <Text variant="label" color="muted">
              AUTHENTICATED ACCOUNT
            </Text>
            <Text variant="bodyBold" color="primary" testID="user-email">
              {user.email ?? 'No email associated'}
            </Text>
            <Text variant="caption" color="muted">
              User ID: {user.id}
            </Text>
          </Card>
        )}

        {isGuest && (
          <Card style={styles.accountCard} testID="guest-account-card">
            <Text variant="label" color="accent">
              GUEST MODE
            </Text>
            <Text variant="bodyBold" color="primary">
              Local Device Athlete
            </Text>
            <Text variant="caption" color="secondary">
              Full training features active. All workouts and preferences are stored privately on
              this device.
            </Text>
          </Card>
        )}

        <Card style={styles.profileCard}>
          <Text variant="titleMedium" color="primary" style={styles.cardHeader}>
            Configured Training Profile
          </Text>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Primary Goal:
            </Text>
            <Text variant="bodyBold" color="primary" testID="summary-goal">
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
            <Text variant="bodyBold" color="primary" testID="summary-frequency">
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

        {/* Account Actions */}
        <View style={styles.actionSection}>
          <Button
            testID={isGuest ? 'exit-guest-button' : 'sign-out-button'}
            title={isGuest ? 'Exit Guest Mode' : 'Sign Out'}
            onPress={handleSignOut}
            variant="outline"
            size="lg"
            style={styles.signOutButton}
          />

          <View style={styles.devDivider}>
            <View style={styles.dividerLine} />
            <Text variant="caption" color="muted" style={styles.dividerLabel}>
              DEVELOPMENT TOOLS
            </Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            testID="reset-onboarding-button"
            title="Reset Onboarding (Dev Testing)"
            onPress={handleResetDev}
            variant="secondary"
            size="md"
            style={styles.resetButton}
          />
          <Text variant="caption" color="muted" style={styles.resetHint}>
            Use this button during local testing to clear local state and run the flow again.
          </Text>
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
  header: {
    gap: spacing.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  badge: {
    backgroundColor: '#0E291B',
    borderColor: colors.dark.success,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  badgeText: {
    color: colors.dark.success,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  accountCard: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.borderLight,
    gap: spacing.xs,
  },
  profileCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    padding: spacing.md,
  },
  cardHeader: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  actionSection: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  signOutButton: {
    borderColor: colors.dark.error,
  },
  devDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.dark.border,
  },
  dividerLabel: {
    letterSpacing: 1,
    fontWeight: '700',
  },
  resetButton: {
    width: '100%',
  },
  resetHint: {
    textAlign: 'center',
  },
});
