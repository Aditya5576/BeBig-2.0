import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../src/components/ui';
import { useOnboardingStore } from '../src/features/onboarding';
import { useAuthStore } from '../src/features/auth';
import {
  workoutRepository,
  WorkoutSession,
  calculateDashboardAnalytics,
  getGreeting,
  formatVolume,
} from '../src/features/workout';
import { templateRepository, WorkoutTemplate } from '../src/features/templates';
import { profileService } from '../src/features/profile';
import { guestStorage } from '../src/lib/storage';
import { spacing, colors, radii } from '../src/constants/theme';

const useFocusEffect =
  routerFocusEffect ||
  ((cb: () => void | (() => void)) => {
    React.useEffect(() => {
      return cb?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  });

export default function HomeScreen() {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const signOut = useAuthStore((state) => state.signOut);
  const exitGuestMode = useAuthStore((state) => state.exitGuestMode);

  const daysPerWeek = useOnboardingStore((state) => state.daysPerWeek);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const goal = useOnboardingStore((state) => state.goal);
  const experienceLevel = useOnboardingStore((state) => state.experienceLevel);
  const workoutDuration = useOnboardingStore((state) => state.workoutDuration);
  const trainingLocation = useOnboardingStore((state) => state.trainingLocation);
  const equipment = useOnboardingStore((state) => state.equipment);
  const workoutStyle = useOnboardingStore((state) => state.workoutStyle);
  const preferredTrainingDays = useOnboardingStore((state) => state.preferredTrainingDays);

  const formatText = (text: any) => {
    if (!text || typeof text !== 'string') return 'Not set';
    return text
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSession[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      // If user refreshed directly on /home and onboarding store is unhydrated, restore saved profile
      if (!useOnboardingStore.getState().hasCompletedOnboarding) {
        const currentUser = useAuthStore.getState().user;
        const isGuestUser = useAuthStore.getState().isGuest;
        if (currentUser?.id) {
          try {
            const profile = await profileService.getProfile(currentUser.id);
            if (profile && profile.onboarding_completed) {
              const store = useOnboardingStore.getState();
              if (profile.goal) store.setGoal(profile.goal);
              if (profile.experience_level) store.setExperienceLevel(profile.experience_level);
              if (profile.days_per_week) store.setDaysPerWeek(profile.days_per_week);
              if (profile.workout_duration) store.setWorkoutDuration(profile.workout_duration);
              if (profile.equipment) store.setEquipment(profile.equipment);
              if (profile.workout_style) store.setWorkoutStyle(profile.workout_style);
              store.completeOnboarding();
            }
          } catch {
            // Silently handled
          }
        } else if (isGuestUser) {
          try {
            const guestData = await guestStorage.getOnboardingData();
            if (guestData) {
              const store = useOnboardingStore.getState();
              if (guestData.goal) store.setGoal(guestData.goal);
              if (guestData.experienceLevel) store.setExperienceLevel(guestData.experienceLevel);
              if (guestData.daysPerWeek) store.setDaysPerWeek(guestData.daysPerWeek);
              if (guestData.workoutDuration) store.setWorkoutDuration(guestData.workoutDuration);
              if (guestData.equipment) store.setEquipment(guestData.equipment);
              if (guestData.workoutStyle) store.setWorkoutStyle(guestData.workoutStyle);
              if (guestData.hasCompletedOnboarding) {
                store.completeOnboarding();
              }
            }
          } catch {
            // Silently handled
          }
        }
      }

      const [workouts, active, userTemplates] = await Promise.all([
        workoutRepository.getCompletedWorkouts(),
        workoutRepository.getActiveWorkout(),
        templateRepository.getTemplates(),
      ]);
      setCompletedWorkouts(workouts);
      setActiveWorkout(active);
      setTemplates(userTemplates);
    } catch {
      setCompletedWorkouts([]);
      setActiveWorkout(null);
      setTemplates([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboardData();
    }, [loadDashboardData]),
  );

  // Derived Analytics Memoization
  const analytics = useMemo(() => {
    return calculateDashboardAnalytics(completedWorkouts, daysPerWeek || 4, templates);
  }, [completedWorkouts, daysPerWeek, templates]);

  const greeting = useMemo(() => getGreeting(), []);

  const handleStartTemplate = async (template: WorkoutTemplate) => {
    if (activeWorkout) {
      Alert.alert(
        'Active Workout in Progress',
        `You already have an active workout ("${activeWorkout.name}"). Would you like to resume it or discard it first?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resume Active',
            onPress: () => router.push('/workout/active' as any),
          },
          {
            text: 'Discard & Start New',
            style: 'destructive',
            onPress: async () => {
              await workoutRepository.discardActiveWorkout();
              setActiveWorkout(null);
              await workoutRepository.startWorkoutFromTemplate(template);
              router.push('/workout/active' as any);
            },
          },
        ],
      );
      return;
    }

    try {
      await workoutRepository.startWorkoutFromTemplate(template);
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start workout.');
    }
  };

  const handleStartEmptyWorkout = async () => {
    if (activeWorkout) {
      Alert.alert(
        'Active Workout in Progress',
        `You already have an active workout ("${activeWorkout.name}"). Would you like to resume it or discard it first?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resume Active',
            onPress: () => router.push('/workout/active' as any),
          },
          {
            text: 'Discard & Start New',
            style: 'destructive',
            onPress: async () => {
              await workoutRepository.discardActiveWorkout();
              setActiveWorkout(null);
              await workoutRepository.startEmptyWorkout('Quick Workout');
              router.push('/workout/active' as any);
            },
          },
        ],
      );
      return;
    }

    try {
      await workoutRepository.startEmptyWorkout('Quick Workout');
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start empty workout.');
    }
  };

  const handleDiscardActiveWorkout = () => {
    Alert.alert(
      'Discard Active Workout',
      'Are you sure you want to discard your current workout? All recorded sets will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await workoutRepository.discardActiveWorkout();
            setActiveWorkout(null);
          },
        },
      ],
    );
  };

  const handleSignOut = async () => {
    if (isGuest) {
      await exitGuestMode();
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

  const formatCompletedDate = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return `Today • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const badgeText = user ? 'Cloud Synced' : isGuest ? 'Guest Mode — Local Device' : 'BeBig Athlete';

  const athleteName = user?.email ? user.email.split('@')[0] : 'Athlete';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Header Row */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.badge}>
              <Text variant="caption" color="accent" style={styles.badgeText}>
                {badgeText}
              </Text>
            </View>
          </View>

          <Text variant="display" color="primary" testID="home-title" style={styles.greetingTitle}>
            {greeting}, {athleteName}
          </Text>
          <Text variant="body" color="secondary">
            Track your progressive overload and beat your personal records.
          </Text>
        </View>

        {/* 2. Active Workout in Progress Banner */}
        {activeWorkout && (
          <Card style={styles.activeWorkoutCard} testID="home-active-workout-banner">
            <View style={styles.activeBadgeRow}>
              <View style={styles.activeBadge}>
                <Text variant="caption" color="accent" style={styles.activeBadgeText}>
                  ACTIVE WORKOUT IN PROGRESS
                </Text>
              </View>
            </View>
            <Text variant="titleMedium" color="primary" style={styles.activeWorkoutTitle}>
              {activeWorkout.name}
            </Text>
            <Text variant="caption" color="secondary">
              Started{' '}
              {new Date(activeWorkout.startedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              • {activeWorkout.exercises.length} Exercises
            </Text>
            <View style={styles.activeWorkoutActions}>
              <Button
                testID="home-resume-workout-button"
                title="Resume Workout"
                onPress={() => router.push('/workout/active' as any)}
                variant="primary"
                size="md"
                style={styles.activeResumeBtn}
              />
              <Button
                testID="home-discard-workout-button"
                title="Discard"
                onPress={handleDiscardActiveWorkout}
                variant="outline"
                size="md"
                style={styles.activeDiscardBtn}
              />
            </View>
          </Card>
        )}

        {/* 3. Today's / Recommended Workout Hero Card */}
        <Card style={styles.todayCard} testID="today-workout-card">
          <View style={styles.todayHeaderRow}>
            <Text variant="label" color="accent" style={styles.todayPill}>
              {analytics.suggestedTemplate ? "TODAY'S WORKOUT" : 'QUICK START'}
            </Text>
          </View>

          <Text variant="titleLarge" color="primary" style={styles.todayTitle}>
            {analytics.suggestedTemplate ? analytics.suggestedTemplate.name : 'Start Workout'}
          </Text>

          <Text variant="body" color="secondary" style={styles.todaySubtitle}>
            {analytics.suggestedTemplate
              ? `${analytics.suggestedTemplate.exercises.length} Exercises • Planned targets configured`
              : 'Start an empty workout session or pick an existing routine.'}
          </Text>

          {analytics.suggestedTemplate && analytics.suggestedTemplate.exercises.length > 0 && (
            <View style={styles.exercisePreviewChips}>
              {analytics.suggestedTemplate.exercises.slice(0, 3).map((ex, idx) => (
                <View key={ex.exerciseId || idx} style={styles.exerciseChip}>
                  <Text variant="caption" color="secondary">
                    {ex.exerciseName}
                  </Text>
                </View>
              ))}
              {analytics.suggestedTemplate.exercises.length > 3 && (
                <View style={styles.exerciseChip}>
                  <Text variant="caption" color="accent">
                    +{analytics.suggestedTemplate.exercises.length - 3} more
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.todayActions}>
            <Button
              testID="start-workout-button"
              title="START WORKOUT"
              onPress={async () => {
                if (analytics.suggestedTemplate) {
                  await handleStartTemplate(analytics.suggestedTemplate);
                } else {
                  await handleStartEmptyWorkout();
                }
              }}
              variant="primary"
              size="lg"
              style={styles.todayStartButton}
            />

            <View style={styles.secondaryStartRow}>
              <Pressable
                testID="start-empty-workout-button"
                onPress={handleStartEmptyWorkout}
                style={styles.linkAction}
              >
                <Text variant="label" color="accent">
                  + Start Empty Workout
                </Text>
              </Pressable>

              <Pressable
                testID="browse-templates-link"
                onPress={() => router.push('/workout/start' as any)}
                style={styles.linkAction}
              >
                <Text variant="label" color="secondary">
                  Choose Another Routine ›
                </Text>
              </Pressable>
            </View>
          </View>
        </Card>

        {/* 4. Quick Analytics Section */}
        <View style={styles.analyticsSection}>
          <Text variant="titleMedium" color="primary" style={styles.sectionHeading}>
            Performance Overview
          </Text>

          {/* Weekly Goal Progress Card */}
          <Card style={styles.goalCard} testID="metric-weekly-goal-card">
            <View style={styles.goalHeaderRow}>
              <View>
                <Text variant="caption" color="muted" style={styles.metricLabel}>
                  {"THIS WEEK'S GOAL"}
                </Text>
                <Text variant="titleLarge" color="primary" style={styles.goalNumbers}>
                  {analytics.workoutsThisWeek} / {analytics.targetDaysPerWeek} Workouts
                </Text>
              </View>
              <View style={styles.goalBadge}>
                <Text variant="caption" color="accent" style={styles.goalBadgeText}>
                  {analytics.weeklyGoalPercent}%
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.max(4, analytics.weeklyGoalPercent)}%` },
                ]}
              />
            </View>

            <Text variant="caption" color="secondary">
              {completedWorkouts.length === 0
                ? 'Start your first workout to begin your streak.'
                : analytics.workoutsThisWeek >= analytics.targetDaysPerWeek
                  ? 'Weekly workout target completed! 🎉'
                  : `${analytics.targetDaysPerWeek - analytics.workoutsThisWeek} workouts left to hit your weekly goal.`}
            </Text>
          </Card>

          {/* 2x2 Metrics Grid */}
          <View style={styles.metricsGrid}>
            {/* Streak Card */}
            <Card style={styles.metricCard} testID="metric-streak-card">
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                STREAK
              </Text>
              <Text variant="titleLarge" color="primary" style={styles.metricValue}>
                🔥 {analytics.currentStreakDays}{' '}
                {analytics.currentStreakDays === 1 ? 'Day' : 'Days'}
              </Text>
              <Text variant="caption" color="secondary">
                {analytics.currentStreakDays > 0
                  ? 'Active workout streak'
                  : 'Log a workout to start streak'}
              </Text>
            </Card>

            {/* Volume Card */}
            <Card style={styles.metricCard} testID="metric-volume-card">
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                VOLUME (THIS WEEK)
              </Text>
              <Text variant="titleLarge" color="accent" style={styles.metricValue}>
                {formatVolume(analytics.weeklyVolume)}
              </Text>
              <Text variant="caption" color="secondary">
                All-time: {formatVolume(analytics.allTimeVolume)}
              </Text>
            </Card>

            {/* PRs Card */}
            <Card style={styles.metricCard} testID="metric-prs-card">
              <Pressable
                testID="home-prs-button"
                onPress={() => router.push('/workout/progress/prs' as any)}
                style={styles.metricPressable}
              >
                <View style={styles.metricHeaderRow}>
                  <Text variant="caption" color="muted" style={styles.metricLabel}>
                    PERSONAL RECORDS
                  </Text>
                  <Text variant="caption" color="accent" style={styles.viewMoreArrow}>
                    ›
                  </Text>
                </View>
                <Text variant="titleLarge" color="primary" style={styles.metricValue}>
                  🏆 {analytics.totalPRsCount}
                </Text>
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  {analytics.topPRs.length > 0
                    ? `Top: ${analytics.topPRs[0].exerciseName} (${analytics.topPRs[0].maxWeight}kg)`
                    : 'Record weights to set PRs'}
                </Text>
              </Pressable>
            </Card>

            {/* Monthly Workouts Card */}
            <Card style={styles.metricCard} testID="metric-monthly-card">
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                THIS MONTH
              </Text>
              <Text variant="titleLarge" color="primary" style={styles.metricValue}>
                📅 {analytics.workoutsThisMonth}{' '}
                {analytics.workoutsThisMonth === 1 ? 'Workout' : 'Workouts'}
              </Text>
              <Text variant="caption" color="secondary">
                Completed this month
              </Text>
            </Card>
          </View>
        </View>

        {/* 5. My Templates Section */}
        <View style={styles.templatesSection}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="titleMedium" color="primary">
              My Templates
            </Text>
            <Pressable
              testID="my-templates-button"
              onPress={() => router.push('/templates' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text variant="label" color="accent">
                View All ({templates.length}) ›
              </Text>
            </Pressable>
          </View>

          {templates.length === 0 ? (
            <Card style={styles.emptyCard} testID="templates-empty-state">
              <Text variant="titleMedium" style={styles.emptyIcon}>
                📋
              </Text>
              <Text variant="titleMedium" color="primary">
                No Templates Yet
              </Text>
              <Text variant="caption" color="secondary" style={styles.emptyText}>
                Create reusable workout routines for push, pull, legs, or custom splits.
              </Text>
              <Button
                testID="create-template-button"
                title="+ Create Template"
                onPress={() => router.push('/templates/new' as any)}
                variant="secondary"
                size="sm"
                style={styles.emptyButton}
              />
            </Card>
          ) : (
            <View style={styles.templatesList}>
              {templates.slice(0, 3).map((tpl) => (
                <Card key={tpl.id} style={styles.templateRowCard}>
                  <Pressable
                    onPress={() => router.push(`/templates/${tpl.id}` as any)}
                    style={styles.templateInfoPressable}
                  >
                    <Text variant="titleMedium" color="primary">
                      {tpl.name}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {tpl.exercises?.length || 0} exercises configured
                    </Text>
                  </Pressable>
                  <Button
                    testID={`template-start-${tpl.id}`}
                    title="Start"
                    onPress={async () => {
                      await handleStartTemplate(tpl);
                    }}
                    variant="primary"
                    size="sm"
                    style={styles.templateStartBtn}
                  />
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* 6. Recent Workouts Section */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="titleMedium" color="primary">
              Recent Workouts
            </Text>
            <Pressable
              testID="workout-history-button"
              onPress={() => router.push('/workout/history' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text variant="label" color="accent">
                View History ›
              </Text>
            </Pressable>
          </View>

          {completedWorkouts.length === 0 ? (
            <Card style={styles.emptyCard} testID="recent-workouts-empty-state">
              <Text variant="titleMedium" style={styles.emptyIcon}>
                🏋️‍♂️
              </Text>
              <Text variant="titleMedium" color="primary">
                No Workouts Recorded
              </Text>
              <Text variant="caption" color="secondary" style={styles.emptyText}>
                Your completed workouts, volume tonnage, and logs will appear here.
              </Text>
              <Button
                testID="empty-recent-start-button"
                title="Start First Workout"
                onPress={() => router.push('/workout/start' as any)}
                variant="secondary"
                size="sm"
                style={styles.emptyButton}
              />
            </Card>
          ) : (
            <View style={styles.historyList}>
              {completedWorkouts.slice(0, 3).map((w) => (
                <Pressable
                  key={w.id}
                  testID={`recent-workout-card-${w.id}`}
                  onPress={() => router.push(`/workout/history/${w.id}` as any)}
                >
                  <Card style={styles.historyItemCard}>
                    <View style={styles.historyItemTop}>
                      <Text variant="titleMedium" color="primary">
                        {w.name}
                      </Text>
                      <Text variant="caption" color="accent">
                        {formatCompletedDate(w.finishedAt || w.startedAt)}
                      </Text>
                    </View>
                    <View style={styles.historyItemStats}>
                      <Text variant="caption" color="secondary">
                        {w.exercises?.length || 0} exercises • {w.completedSetsCount || 0} sets •{' '}
                        {formatVolume(w.totalVolume || 0)}
                        {w.totalDuration ? ` • ${formatDuration(w.totalDuration)}` : ''}
                      </Text>
                      <Text variant="titleMedium" color="muted">
                        ›
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 6b. Training Program Configuration Card (from Onboarding) */}
        {(goal || experienceLevel || workoutStyle) && (
          <Card style={styles.profileCard} testID="profile-summary-card">
            <View style={styles.cardHeader}>
              <Text variant="titleMedium" color="primary">
                Your Training Configuration
              </Text>
            </View>

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
                {daysPerWeek ? `${daysPerWeek} days / week` : 'Not set'}
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
                {preferredTrainingDays && preferredTrainingDays.length > 0
                  ? preferredTrainingDays.map((d) => d.slice(0, 3).toUpperCase()).join(', ')
                  : 'Flexible'}
              </Text>
            </View>
          </Card>
        )}

        {/* 7. Quick Navigation & Account Section */}
        <View style={styles.quickNavSection}>
          <Button
            testID="browse-exercises-button"
            title="Browse Exercise Library"
            onPress={() => router.push('/exercises' as any)}
            variant="secondary"
            size="lg"
            style={styles.navButton}
          />

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
                Guest Mode — Data stored on this device
              </Text>
            </Card>
          )}

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
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: spacing.xs,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  greetingTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  activeWorkoutCard: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.primary,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.xs,
  },
  activeBadgeRow: {
    flexDirection: 'row',
  },
  activeBadge: {
    backgroundColor: colors.dark.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeWorkoutTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  activeWorkoutActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  activeResumeBtn: {
    flex: 2,
    minHeight: 44,
  },
  activeDiscardBtn: {
    flex: 1,
    minHeight: 44,
    borderColor: colors.dark.error,
  },
  todayCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.sm,
  },
  todayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayPill: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  todayTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  todaySubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  exercisePreviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  exerciseChip: {
    backgroundColor: colors.dark.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  todayActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  todayStartButton: {
    width: '100%',
    minHeight: 52,
  },
  secondaryStartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  linkAction: {
    paddingVertical: spacing.xs,
  },
  analyticsSection: {
    gap: spacing.sm,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  goalCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  goalNumbers: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  goalBadge: {
    backgroundColor: colors.dark.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  goalBadgeText: {
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.dark.surfaceSubtle,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.dark.primary,
    borderRadius: radii.full,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    padding: spacing.md,
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  metricPressable: {
    gap: 4,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewMoreArrow: {
    fontSize: 16,
    fontWeight: '700',
  },
  templatesSection: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  templatesList: {
    gap: spacing.xs,
  },
  templateRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    padding: spacing.md,
  },
  templateInfoPressable: {
    flex: 1,
    gap: 2,
  },
  templateStartBtn: {
    minWidth: 70,
    minHeight: 36,
  },
  historySection: {
    gap: spacing.sm,
  },
  historyList: {
    gap: spacing.xs,
  },
  historyItemCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    padding: spacing.md,
    gap: 4,
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    padding: spacing.lg,
    alignItems: 'center',
    textAlign: 'center',
    gap: spacing.xs,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyButton: {
    minWidth: 160,
  },
  quickNavSection: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  navButton: {
    width: '100%',
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
