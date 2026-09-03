import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { ScreenContainer, Text } from '../src/components/ui';
import { useAuthStore } from '../src/features/auth';
import { useOnboardingStore } from '../src/features/onboarding';
import { profileService } from '../src/features/profile';
import { guestStorage } from '../src/lib/storage';
import { colors, spacing } from '../src/constants/theme';

/**
 * Root Index Gatekeeper
 *
 * Responsibilities:
 * 1. Initialize authentication session on app start (Supabase cloud or local guest).
 * 2. If authenticated, restore cloud profile data from Supabase.
 * 3. If guest, rehydrate local preferences from guestStorage.
 * 4. Route to /home if user (authenticated or guest) has completed onboarding.
 * 5. Route to /onboarding/welcome if unauthenticated or onboarding is incomplete.
 */
export default function Index() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const setGoal = useOnboardingStore((state) => state.setGoal);
  const setExperienceLevel = useOnboardingStore((state) => state.setExperienceLevel);
  const setDaysPerWeek = useOnboardingStore((state) => state.setDaysPerWeek);
  const setWorkoutDuration = useOnboardingStore((state) => state.setWorkoutDuration);
  const setEquipment = useOnboardingStore((state) => state.setEquipment);
  const setWorkoutStyle = useOnboardingStore((state) => state.setWorkoutStyle);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);

  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (status === 'initializing') {
      initializeAuth();
    }
  }, [status, initializeAuth]);

  useEffect(() => {
    let isMounted = true;

    async function checkProfileAndStorage() {
      if (status === 'authenticated' && user?.id) {
        try {
          const profile = await profileService.getProfile(user.id);
          if (profile && isMounted) {
            if (profile.goal) setGoal(profile.goal);
            if (profile.experience_level) setExperienceLevel(profile.experience_level);
            if (profile.days_per_week) setDaysPerWeek(profile.days_per_week);
            if (profile.workout_duration) setWorkoutDuration(profile.workout_duration);
            if (profile.equipment) setEquipment(profile.equipment);
            if (profile.workout_style) setWorkoutStyle(profile.workout_style);
            if (profile.onboarding_completed) completeOnboarding();
          }
        } catch {
          // Fallback to local onboarding state
        }
      } else if (status === 'guest') {
        try {
          const storedOnboarding = await guestStorage.getOnboardingData();
          if (storedOnboarding && isMounted) {
            if (storedOnboarding.goal) setGoal(storedOnboarding.goal);
            if (storedOnboarding.experienceLevel)
              setExperienceLevel(storedOnboarding.experienceLevel);
            if (storedOnboarding.daysPerWeek) setDaysPerWeek(storedOnboarding.daysPerWeek);
            if (storedOnboarding.workoutDuration)
              setWorkoutDuration(storedOnboarding.workoutDuration);
            if (storedOnboarding.equipment) setEquipment(storedOnboarding.equipment);
            if (storedOnboarding.workoutStyle) setWorkoutStyle(storedOnboarding.workoutStyle);
            if (storedOnboarding.hasCompletedOnboarding) completeOnboarding();
          }
        } catch {
          // Fallback to local memory state
        }
      }

      if (isMounted) {
        setProfileChecked(true);
      }
    }

    void checkProfileAndStorage();

    return () => {
      isMounted = false;
    };
  }, [
    status,
    user?.id,
    setGoal,
    setExperienceLevel,
    setDaysPerWeek,
    setWorkoutDuration,
    setEquipment,
    setWorkoutStyle,
    completeOnboarding,
  ]);

  // Loading Screen while initializing auth or restoring profiles/local data
  if (
    status === 'initializing' ||
    ((status === 'authenticated' || status === 'guest') && !profileChecked)
  ) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <View style={styles.loadingContent}>
          <Text variant="display" color="accent" style={styles.logoText}>
            BEBIG
          </Text>
          <Text variant="label" color="muted" style={styles.tagline}>
            TRAIN WITH PURPOSE
          </Text>
          <ActivityIndicator
            testID="auth-loading-indicator"
            size="large"
            color={colors.dark.primary}
            style={styles.spinner}
          />
        </View>
      </ScreenContainer>
    );
  }

  // Authenticated or Guest & Onboarding Complete -> Home
  if ((status === 'authenticated' || status === 'guest') && hasCompletedOnboarding) {
    return <Redirect href="/home" />;
  }

  // Incomplete onboarding or Unauthenticated -> Onboarding
  return <Redirect href="/onboarding/welcome" />;
}

const styles = StyleSheet.create({
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 4,
  },
  tagline: {
    letterSpacing: 2,
  },
  spinner: {
    marginTop: spacing.lg,
  },
});
