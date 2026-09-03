import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button } from '../../src/components/ui';
import {
  OnboardingHeader,
  SelectableCard,
  useOnboardingStore,
  Goal,
} from '../../src/features/onboarding';
import { spacing } from '../../src/constants/theme';

interface GoalOption {
  id: Goal;
  title: string;
  description: string;
  badge?: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'build_muscle',
    title: 'Build Muscle',
    description: 'Hypertrophy-focused training to stimulate maximum muscular growth and size.',
    badge: 'Hypertrophy',
  },
  {
    id: 'gain_strength',
    title: 'Gain Strength',
    description: 'Heavy compound movements designed to increase absolute strength and power.',
    badge: 'Strength',
  },
  {
    id: 'lose_fat',
    title: 'Lose Fat',
    description: 'High-density resistance workouts to retain lean muscle while burning calories.',
    badge: 'Conditioning',
  },
];

export default function GoalScreen() {
  const router = useRouter();
  const selectedGoal = useOnboardingStore((state) => state.goal);
  const setGoal = useOnboardingStore((state) => state.setGoal);

  const handleContinue = () => {
    const currentGoal = useOnboardingStore.getState().goal || selectedGoal;
    if (!currentGoal) return;
    router.push('/onboarding/experience');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <ScreenContainer>
      <OnboardingHeader currentStep={1} totalSteps={4} onBack={handleBack} canGoBack={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <Text variant="display" color="primary">
            What is your primary goal?
          </Text>
          <Text variant="body" color="secondary">
            Select the primary focus for your training routines and progression targets.
          </Text>
        </View>

        <View style={styles.optionsList}>
          {GOAL_OPTIONS.map((option) => (
            <SelectableCard
              key={option.id}
              testID={`goal-option-${option.id}`}
              title={option.title}
              description={option.description}
              badge={option.badge}
              selected={selectedGoal === option.id}
              onSelect={() => setGoal(option.id)}
            />
          ))}
        </View>

        <View style={styles.actionSection}>
          <Button
            testID="goal-continue-button"
            title="Continue"
            onPress={handleContinue}
            disabled={!selectedGoal}
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
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  headerSection: {
    gap: spacing.xs,
  },
  optionsList: {
    gap: spacing.md,
  },
  actionSection: {
    paddingBottom: spacing.sm,
  },
  continueButton: {
    width: '100%',
  },
});
