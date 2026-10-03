import { useAppTheme } from '../src/features/theme';
import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { ScreenContainer, ScreenScrollView, Text, Button, Card } from '../src/components/ui';
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
import { profileService, getInitials } from '../src/features/profile';
import { scheduledWorkoutRepository, ScheduledWorkout, ScheduledWorkoutPreviewModal } from '../src/features/scheduling';
import { Icon } from '../src/components/ui';
import { guestStorage } from '../src/lib/storage';
import { spacing, radii } from '../src/constants/theme';
import { env } from '../src/config/env';

const useFocusEffect =
  routerFocusEffect ||
  ((cb: () => void | (() => void)) => {
    React.useEffect(() => {
      return cb?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  });

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const daysPerWeek = useOnboardingStore((state) => state.daysPerWeek);

  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSession[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<ScheduledWorkout[]>([]);
  const [previewWorkout, setPreviewWorkout] = useState<ScheduledWorkout | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const currentUser = useAuthStore.getState().user;
      const isGuestUser = useAuthStore.getState().isGuest;

      if (currentUser?.id) {
        try {
          const profile = await profileService.getProfile(currentUser.id);
          setProfileDisplayName(profile?.display_name ?? null);
          setProfileAvatarUrl(profile?.avatar_url ?? null);
          setAvatarLoadError(false);
          if (!useOnboardingStore.getState().hasCompletedOnboarding && profile && profile.onboarding_completed) {
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
        setProfileDisplayName(null);
        setProfileAvatarUrl(null);
        setAvatarLoadError(false);
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

      const [workouts, active, userTemplates, schedulesToday] = await Promise.all([
        workoutRepository.getCompletedWorkouts(),
        workoutRepository.getActiveWorkout(),
        templateRepository.getTemplates(),
        scheduledWorkoutRepository.getTodayScheduledWorkouts(),
      ]);
      setCompletedWorkouts(workouts);
      setActiveWorkout(active);
      setTemplates(userTemplates);
      setTodaySchedules(schedulesToday);
    } catch {
      setCompletedWorkouts([]);
      setActiveWorkout(null);
      setTemplates([]);
      setTodaySchedules([]);
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

  const handleStartScheduledWorkout = async (scheduledWorkout: ScheduledWorkout) => {
    try {
      if (activeWorkout) {
        Alert.alert(
          'Active Workout in Progress',
          'You already have an active workout in progress. Discard it to start this scheduled workout?',
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
                await startScheduled(scheduledWorkout);
                router.push('/workout/active' as any);
              },
            },
          ],
        );
        return;
      }
      await startScheduled(scheduledWorkout);
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start scheduled workout.');
    }
  };

  const startScheduled = async (scheduledWorkout: ScheduledWorkout) => {
    if (scheduledWorkout.templateId) {
      const tpl = await templateRepository.getTemplateById(scheduledWorkout.templateId);
      if (tpl) {
        await workoutRepository.startWorkoutFromTemplate(tpl, scheduledWorkout.name, scheduledWorkout.id);
        return;
      }
    }
    await workoutRepository.startEmptyWorkout(scheduledWorkout.name, scheduledWorkout.id);
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

  const athleteName =
    user?.user_metadata?.profile?.display_name ||
    profileDisplayName ||
    user?.user_metadata?.display_name ||
    (user?.email ? user.email.split('@')[0] : 'Athlete');

  const initials = getInitials(
    profileDisplayName || user?.user_metadata?.profile?.display_name || user?.user_metadata?.display_name,
    user?.email,
  );

  return (
    <ScreenContainer>
      <ScreenScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Header Row */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.badge}>
              <Text variant="caption" color="accent" style={styles.badgeText}>
                {badgeText}
              </Text>
            </View>

            <Pressable
              testID="home-profile-button"
              onPress={() => router.push('/settings' as any)}
              accessibilityRole="button"
              accessibilityLabel="Open Profile & Settings"
              style={styles.headerAvatarContainer}
            >
              {profileAvatarUrl && !avatarLoadError ? (
                <Image
                  source={{ uri: profileAvatarUrl }}
                  style={styles.headerAvatarImage}
                  onError={() => setAvatarLoadError(true)}
                  testID="home-avatar-image"
                />
              ) : (
                <View style={styles.headerAvatarFallback} testID="home-avatar-fallback">
                  <Text style={styles.headerAvatarInitialsText}>{initials}</Text>
                </View>
              )}
            </Pressable>
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

        {/* 2.5 Scheduled Today Card */}
        <Card style={styles.scheduledTodayCard} testID="scheduled-today-card">
          <View style={styles.scheduledTodayHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="calendar" size={16} color="#E5A93C" />
              <Text variant="label" color="accent" style={{ marginLeft: 6, fontWeight: '800', letterSpacing: 0.8 }}>
                SCHEDULED TODAY
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/calendar' as any)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="View Calendar"
              accessibilityRole="button"
            >
              <Text variant="caption" color="accent" style={{ fontWeight: '700', fontSize: 12 }}>
                View Calendar ›
              </Text>
            </Pressable>
          </View>

          {todaySchedules.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              {todaySchedules.map((item) => (
                <View key={item.id} style={styles.scheduledItemRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text variant="titleMedium" color="primary" style={{ fontWeight: '700', fontSize: 15 }}>
                      {item.name}
                    </Text>
                    {item.scheduledTime ? (
                      <Text variant="caption" color="secondary" style={{ marginTop: 2, fontWeight: '600' }}>
                        ⏰ {item.scheduledTime}
                      </Text>
                    ) : null}
                    {item.notes ? (
                      <Text variant="caption" color="secondary" numberOfLines={1} style={{ marginTop: 2, fontStyle: 'italic' }}>
                        "{item.notes}"
                      </Text>
                    ) : null}

                    {/* View Workout Action Button */}
                    <Pressable
                      onPress={() => {
                        setPreviewWorkout(item);
                        setPreviewVisible(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.homePreviewBtn}
                    >
                      <Icon name="search" size={13} color="#E5A93C" />
                      <Text style={styles.homePreviewText}>VIEW WORKOUT</Text>
                    </Pressable>
                  </View>

                  <View style={[
                    styles.schedStatusBadge,
                    item.status === 'completed' && { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' },
                    item.status === 'skipped' && { backgroundColor: 'rgba(156, 163, 175, 0.15)', borderColor: '#9CA3AF' },
                  ]}>
                    <Text style={[
                      styles.schedStatusText,
                      item.status === 'completed' && { color: '#10B981' },
                      item.status === 'skipped' && { color: '#9CA3AF' },
                    ]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.scheduledEmptyRow}>
              <Text variant="body" color="secondary" style={{ fontSize: 13 }}>
                No workout planned for today.
              </Text>
              <Pressable
                onPress={() => router.push('/calendar' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text variant="caption" color="accent" style={{ fontWeight: '800', marginLeft: 10, fontSize: 12 }}>
                  + Schedule
                </Text>
              </Pressable>
            </View>
          )}
        </Card>

        {/* 3. Dedicated Quick Start Card */}
        <Card style={styles.quickStartCard} testID="quick-start-card">
          <View style={styles.quickStartHeader}>
            <View style={styles.quickStartPill}>
              <Icon name="fire" size={14} color="#E5A93C" />
              <Text variant="label" color="accent" style={styles.quickStartPillText}>
                QUICK START
              </Text>
            </View>
          </View>

          <Text variant="titleLarge" color="primary" style={styles.quickStartTitle}>
            Start Unscheduled Workout
          </Text>

          <Text variant="body" color="secondary" style={styles.quickStartSubtitle}>
            Start an ad-hoc session immediately or pick a blueprint from your saved templates.
          </Text>

          <View style={styles.quickStartActions}>
            <Button
              testID="start-quick-workout-button"
              title="START QUICK WORKOUT"
              onPress={handleStartEmptyWorkout}
              variant="primary"
              size="lg"
              style={styles.quickStartButton}
            />

            <Pressable
              testID="browse-templates-link"
              onPress={() => router.push('/workout/start' as any)}
              style={styles.quickStartSecondaryLink}
            >
              <Text variant="label" color="secondary" style={styles.quickStartLinkText}>
                Choose Routine Blueprint ›
              </Text>
            </Pressable>
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
                  { width: `${Math.min(100, Math.max(4, analytics.weeklyGoalPercent))}%` },
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

            {/* PRs Card (Interactive) */}
            <Card style={[styles.metricCard, styles.metricCardInteractive]} testID="metric-prs-card">
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
                      <Text variant="titleMedium" color="primary" style={styles.historyTitle}>
                        {w.name}
                      </Text>
                      <Text variant="caption" color="accent" style={styles.historyDate}>
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

        {/* 7. Quick Navigation & App Footer */}
        <View style={styles.quickNavSection}>
          <Button
            testID="browse-exercises-button"
            title="Browse Exercise Library"
            onPress={() => router.push('/exercises' as any)}
            variant="secondary"
            size="lg"
            style={styles.navButton}
          />

          <View style={styles.appFooter}>
            <Text variant="caption" color="muted" style={styles.appFooterText} testID="app-version-indicator">
              BeBig 2.0 {env.displayVersion} • Developed by Aditya Patil
            </Text>
          </View>
        </View>
      </ScreenScrollView>

      {/* Scheduled Workout Read-Only Preview Modal */}
      <ScheduledWorkoutPreviewModal
        visible={previewVisible}
        scheduledWorkout={previewWorkout}
        onClose={() => setPreviewVisible(false)}
        onStart={(workout) => {
          setPreviewVisible(false);
          handleStartScheduledWorkout(workout);
        }}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.xs + 2,
    gap: spacing.sm + 4,
  },
  loadingContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  settingsHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    minHeight: 36,
  },
  settingsHeaderIcon: {
    fontSize: 13,
  },
  settingsHeaderText: {
    fontWeight: '600',
    fontSize: 12,
    color: colors.textSecondary,
  },
  badge: {
    backgroundColor: '#0E291B',
    borderColor: colors.success,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  headerAvatarContainer: {
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  headerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarInitialsText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  badgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  greetingTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  activeWorkoutCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1.5,
    padding: spacing.sm + 2,
    gap: 4,
  },
  activeBadgeRow: {
    flexDirection: 'row',
  },
  activeBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeWorkoutTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  activeWorkoutActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  activeResumeBtn: {
    flex: 2,
    minHeight: 40,
  },
  activeDiscardBtn: {
    flex: 1,
    minHeight: 40,
    borderColor: colors.error,
  },
  scheduledTodayCard: {
    backgroundColor: '#111218',
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  scheduledTodayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scheduledItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181A22',
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: 6,
  },
  scheduledEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  schedStatusBadge: {
    backgroundColor: 'rgba(229, 169, 60, 0.15)',
    borderColor: '#E5A93C',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  schedStatusText: {
    color: '#E5A93C',
    fontSize: 10,
    fontWeight: '800',
  },
  homePreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 3,
  },
  homePreviewText: {
    color: '#E5A93C',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  quickStartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  quickStartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickStartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 169, 60, 0.15)',
    borderColor: '#E5A93C',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quickStartPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  quickStartTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
  },
  quickStartSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  quickStartActions: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  quickStartButton: {
    width: '100%',
  },
  quickStartSecondaryLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  quickStartLinkText: {
    fontWeight: '700',
    fontSize: 13,
  },
  todayCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderWidth: 1.5,
    padding: spacing.sm + 2,
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
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
  },
  todaySubtitle: {
    fontSize: 13,
    lineHeight: 17,
  },
  exercisePreviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 2,
  },
  exerciseChip: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayActions: {
    gap: spacing.xs + 2,
    marginTop: 2,
  },
  todayStartButton: {
    width: '100%',
    minHeight: 44,
  },
  secondaryStartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  linkAction: {
    paddingVertical: 2,
  },
  analyticsSection: {
    gap: spacing.sm,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  goalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    gap: spacing.sm,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalNumbers: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  goalBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  goalBadgeText: {
    fontWeight: '700',
    fontSize: 11,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.full,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    gap: 2,
    borderRadius: radii.sm,
  },
  metricCardInteractive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderLight,
    borderWidth: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  metricPressable: {
    gap: 2,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewMoreArrow: {
    fontSize: 14,
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
    gap: spacing.xs + 2,
  },
  templateRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    borderRadius: radii.sm,
  },
  templateInfoPressable: {
    flex: 1,
    gap: 1,
  },
  templateStartBtn: {
    minWidth: 60,
    minHeight: 32,
  },
  historySection: {
    gap: spacing.sm,
  },
  historyList: {
    gap: spacing.xs + 2,
  },
  historyItemCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    gap: 2,
    borderRadius: radii.sm,
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  historyTitle: {
    flex: 1,
    fontSize: 15,
  },
  historyDate: {
    flexShrink: 0,
    fontSize: 12,
  },
  historyItemStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyStatChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.sm + 4,
    alignItems: 'center',
    textAlign: 'center',
    gap: 2,
  },
  emptyIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 2,
    fontSize: 12,
  },
  emptyButton: {
    minWidth: 140,
    minHeight: 34,
  },
  quickNavSection: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  navButton: {
    width: '100%',
    minHeight: 42,
  },
  accountCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    padding: spacing.sm + 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  signOutButton: {
    borderColor: colors.error,
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
    backgroundColor: colors.border,
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
  appFooter: {
    alignItems: 'center',
    paddingTop: 4,
  },
  appFooterText: {
    fontSize: 11,
    letterSpacing: 0.5,
    opacity: 0.7,
    fontWeight: '500',
  },
});
