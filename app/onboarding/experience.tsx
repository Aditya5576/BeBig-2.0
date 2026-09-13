import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { ScreenContainer, Text, Button } from '../../src/components/ui';
import {
  OnboardingHeader,
  SelectableCard,
  useOnboardingStore,
  ExperienceLevel,
} from '../../src/features/onboarding';
import { spacing } from '../../src/constants/theme';

import { useAuthStore } from '../../src/features/auth';

interface ExperienceOption {
  id: ExperienceLevel;
  title: string;
  description: string;
  badge: string;
}

const EXPERIENCE_OPTIONS: ExperienceOption[] = [
  {
    id: 'beginner',
    title: 'Beginner',
    description:
      'Less than 1 year of consistent lifting. Focused on learning foundational movement patterns and technique.',
    badge: '< 1 Year',
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    description:
      '1–3 years of structured gym training. Comfortable with compound lifts and progressive overload fundamentals.',
    badge: '1–3 Years',
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description:
      '3+ years of dedicated, structured lifting. Familiar with periodization, RPE management, and plateau breaking.',
    badge: '3+ Years',
  },
];

export default function ExperienceScreen() {
  const router = useRouter();
  const selectedLevel = useOnboardingStore((state) => state.experienceLevel);
  const setExperienceLevel = useOnboardingStore((state) => state.setExperienceLevel);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const authStatus = useAuthStore((state) => state.status);
  const isGuest = useAuthStore((state) => state.isGuest);

  if (hasCompletedOnboarding && (authStatus === 'authenticated' || isGuest)) {
    return <Redirect href="/home" />;
  }

  const handleContinue = () => {
    const currentLevel = useOnboardingStore.getState().experienceLevel || selectedLevel;
    if (!currentLevel) return;
    router.push('/onboarding/preferences');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <ScreenContainer>
      <OnboardingHeader currentStep={2} totalSteps={3} onBack={handleBack} canGoBack={true} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <Text variant="display" color="primary">
            What is your experience level?
          </Text>
          <Text variant="body" color="secondary">
            This helps tailor your initial training volume, rest periods, and weight progression
            rates.
          </Text>
        </View>

        <View style={styles.optionsList}>
          {EXPERIENCE_OPTIONS.map((option) => (
            <SelectableCard
              key={option.id}
              testID={`experience-option-${option.id}`}
              title={option.title}
              description={option.description}
              badge={option.badge}
              selected={selectedLevel === option.id}
              onSelect={() => setExperienceLevel(option.id)}
            />
          ))}
        </View>

        <View style={styles.actionSection}>
          <Button
            testID="experience-continue-button"
            title="Continue"
            onPress={handleContinue}
            disabled={!selectedLevel}
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
