import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import {
  OnboardingHeader,
  SelectableCard,
  ChipGroup,
  useOnboardingStore,
  WorkoutDuration,
  Equipment,
  DayOfWeek,
  WorkoutStyle,
} from '../../src/features/onboarding';
import { spacing, colors, radii } from '../../src/constants/theme';

const DAYS_PER_WEEK_OPTIONS = [
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
];

const DURATION_OPTIONS: { label: string; value: WorkoutDuration }[] = [
  { label: '30 min', value: '30_min' },
  { label: '45 min', value: '45_min' },
  { label: '60 min', value: '60_min' },
  { label: '90+ min', value: '90_plus_min' },
];

const DAYS_OF_WEEK_OPTIONS: { label: string; value: DayOfWeek }[] = [
  { label: 'Mon', value: 'monday' },
  { label: 'Tue', value: 'tuesday' },
  { label: 'Wed', value: 'wednesday' },
  { label: 'Thu', value: 'thursday' },
  { label: 'Fri', value: 'friday' },
  { label: 'Sat', value: 'saturday' },
  { label: 'Sun', value: 'sunday' },
];

const EQUIPMENT_OPTIONS: { id: Equipment; title: string; description: string }[] = [
  {
    id: 'full_gym',
    title: 'Full Gym',
    description: 'Barbells, dumbbells, cable towers, power racks, and specialized machines.',
  },
  {
    id: 'limited_equipment',
    title: 'Limited Equipment',
    description: 'Free weights, adjustable dumbbells, bench, and pull-up bar.',
  },
];

const WORKOUT_STYLE_OPTIONS: {
  id: WorkoutStyle;
  title: string;
  description: string;
  badge: string;
}[] = [
  {
    id: 'push_pull_legs',
    title: 'Push / Pull / Legs',
    description: 'Chest/Shoulders/Triceps, Back/Biceps, and Legs/Abs.',
    badge: 'Popular',
  },
  {
    id: 'upper_lower',
    title: 'Upper / Lower',
    description: 'Alternating upper body and lower body focus sessions.',
    badge: 'Balanced',
  },
  {
    id: 'full_body',
    title: 'Full Body',
    description: 'Full body stimulation in every session for high compound frequency.',
    badge: 'High Frequency',
  },
];

export default function PreferencesScreen() {
  const router = useRouter();

  const daysPerWeek = useOnboardingStore((state) => state.daysPerWeek);
  const workoutDuration = useOnboardingStore((state) => state.workoutDuration);
  const equipment = useOnboardingStore((state) => state.equipment);
  const preferredTrainingDays = useOnboardingStore((state) => state.preferredTrainingDays);
  const workoutStyle = useOnboardingStore((state) => state.workoutStyle);

  const setDaysPerWeek = useOnboardingStore((state) => state.setDaysPerWeek);
  const setWorkoutDuration = useOnboardingStore((state) => state.setWorkoutDuration);
  const setEquipment = useOnboardingStore((state) => state.setEquipment);
  const togglePreferredTrainingDay = useOnboardingStore(
    (state) => state.togglePreferredTrainingDay,
  );
  const setWorkoutStyle = useOnboardingStore((state) => state.setWorkoutStyle);

  const canContinue = Boolean(daysPerWeek && workoutDuration && equipment && workoutStyle);

  const handleContinue = () => {
    const state = useOnboardingStore.getState();
    const canProceed = Boolean(
      (daysPerWeek || state.daysPerWeek) &&
      (workoutDuration || state.workoutDuration) &&
      (equipment || state.equipment) &&
      (workoutStyle || state.workoutStyle),
    );
    if (!canProceed) return;
    router.push('/onboarding/auth');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <ScreenContainer>
      <OnboardingHeader currentStep={3} totalSteps={4} onBack={handleBack} canGoBack={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <Text variant="display" color="primary">
            Workout Preferences
          </Text>
          <Text variant="body" color="secondary">
            Configure your schedule, equipment access, and favorite split style.
          </Text>
        </View>

        {/* 1. Days Per Week */}
        <View style={styles.categorySection}>
          <Text variant="titleMedium" color="primary">
            Days per week
          </Text>
          <Text variant="caption" color="muted">
            How many sessions do you realistically aim to complete?
          </Text>
          <ChipGroup
            options={DAYS_PER_WEEK_OPTIONS}
            selectedValue={daysPerWeek}
            onSelect={(val) => setDaysPerWeek(Number(val))}
            chipStyle={styles.dayChip}
          />
        </View>

        {/* 2. Workout Duration */}
        <View style={styles.categorySection}>
          <Text variant="titleMedium" color="primary">
            Workout duration
          </Text>
          <Text variant="caption" color="muted">
            Average time spent per workout session.
          </Text>
          <ChipGroup
            options={DURATION_OPTIONS}
            selectedValue={workoutDuration}
            onSelect={(val) => setWorkoutDuration(val as WorkoutDuration)}
          />
        </View>

        {/* 3. Training Location */}
        <View style={styles.categorySection}>
          <Text variant="titleMedium" color="primary">
            Training location
          </Text>
          <Card style={styles.locationCard}>
            <View style={styles.locationContent}>
              <Text variant="titleMedium" color="accent">
                🏋️‍♂️ Gym
              </Text>
              <Text variant="body" color="secondary">
                Commercial or private fitness facility with weights & machines.
              </Text>
            </View>
            <View style={styles.supportedBadge}>
              <Text variant="caption" color="accent" style={styles.badgeText}>
                Active
              </Text>
            </View>
          </Card>
        </View>

        {/* 4. Equipment */}
        <View style={styles.categorySection}>
          <Text variant="titleMedium" color="primary">
            Available equipment
          </Text>
          <View style={styles.cardGroup}>
            {EQUIPMENT_OPTIONS.map((option) => (
              <SelectableCard
                key={option.id}
                testID={`equipment-option-${option.id}`}
                title={option.title}
                description={option.description}
                selected={equipment === option.id}
                onSelect={() => setEquipment(option.id)}
              />
            ))}
          </View>
        </View>

        {/* 5. Preferred Training Days */}
        <View style={styles.categorySection}>
          <Text variant="titleMedium" color="primary">
            Preferred training days{' '}
            <Text variant="caption" color="muted">
              (Optional)
            </Text>
          </Text>
          <Text variant="caption" color="muted">
            Select the days you typically hit the gym.
          </Text>
          <ChipGroup
            options={DAYS_OF_WEEK_OPTIONS}
            selectedValues={preferredTrainingDays}
            onSelect={(val) => togglePreferredTrainingDay(val as DayOfWeek)}
            multiSelect={true}
          />
        </View>

        {/* 6. Workout Style */}
        <View style={styles.categorySection}>
          <Text variant="titleMedium" color="primary">
            Workout style
          </Text>
          <View style={styles.cardGroup}>
            {WORKOUT_STYLE_OPTIONS.map((option) => (
              <SelectableCard
                key={option.id}
                testID={`style-option-${option.id}`}
                title={option.title}
                description={option.description}
                badge={option.badge}
                selected={workoutStyle === option.id}
                onSelect={() => setWorkoutStyle(option.id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.actionSection}>
          <Button
            testID="preferences-continue-button"
            title="Continue"
            onPress={handleContinue}
            disabled={!canContinue}
            variant="primary"
            size="lg"
            style={styles.continueButton}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.md,
    gap: spacing.xl,
  },
  headerSection: {
    gap: spacing.xs,
  },
  categorySection: {
    gap: spacing.sm,
  },
  cardGroup: {
    gap: spacing.sm,
  },
  dayChip: {
    minWidth: 48,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: colors.dark.primary,
    backgroundColor: colors.dark.surfaceSubtle,
  },
  locationContent: {
    flex: 1,
    gap: 2,
  },
  supportedBadge: {
    backgroundColor: colors.dark.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionSection: {
    paddingVertical: spacing.md,
  },
  continueButton: {
    width: '100%',
  },
});
