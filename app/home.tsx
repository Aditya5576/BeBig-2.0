import { useAppTheme } from '../src/features/theme';
import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { ScreenContainer, ScreenScrollView, Text, Button, Card, Icon } from '../src/components/ui';
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

      const [workoutsResult, activeResult, templatesResult, schedulesResult] = await Promise.allSettled([
        workoutRepository.getCompletedWorkouts(),
        workoutRepository.getActiveWorkout(),
        templateRepository.getTemplates(),
        scheduledWorkoutRepository.getTodayScheduledWorkouts(),
      ]);

      setCompletedWorkouts(workoutsResult.status === 'fulfilled' ? workoutsResult.value : []);
      setActiveWorkout(activeResult.status === 'fulfilled' ? activeResult.value : null);
      setTemplates(templatesResult.status === 'fulfilled' ? templatesResult.value : []);
      setTodaySchedules(schedulesResult.status === 'fulfilled' ? schedulesResult.value : []);
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
      return `Today`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday`;
    }
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  };

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
        {/* 1. Header: Clean and Personal */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextGroup}>
              <Text variant="display" color="primary" testID="home-title" style={styles.greetingTitle}>
                {`${greeting}, ${athleteName}`}
              </Text>
              <Text variant="caption" color="secondary" style={styles.headerSubtitle}>
                Keep showing up. Progress adds up.
              </Text>
            </View>

            <Pressable
              testID="home-profile-button"
              onPress={() => router.push('/settings' as any)}
              accessibilityRole="button"
              accessibilityLabel="Open Profile & Settings"
              style={styles.profileButton}
            >
              {profileAvatarUrl && !avatarLoadError ? (
                <Image
                  source={{ uri: profileAvatarUrl }}
                  style={styles.profileAvatar}
                  onError={() => setAvatarLoadError(true)}
                  testID="home-avatar-image"
                />
              ) : (
                <View style={styles.profileAvatarFallback} testID="home-avatar-fallback">
                  <Text style={styles.profileInitials}>{initials}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* 2. Personal Progress: Compact & Clean */}
        <View style={styles.progressSection}>
          <View style={styles.progressGrid}>
            {/* PRs Stat (Interactive) */}
            <Card style={styles.statTile} testID="metric-prs-card">
              <Pressable
                testID="home-prs-button"
                onPress={() => router.push('/workout/progress/prs' as any)}
                style={styles.statTilePressable}
              >
                <View style={styles.statTileHeader}>
                  <Icon name="trophy" size={14} color="#F59E0B" />
                  <Text variant="caption" color="muted" style={styles.statLabel}>
                    PRS
                  </Text>
                  <Text variant="caption" color="muted" style={styles.statChevron}>
                    ›
                  </Text>
                </View>
                <Text variant="titleLarge" color="primary" style={styles.statNumber}>
                  {`🏆 ${analytics.totalPRsCount}`}
                </Text>
                <Text variant="caption" color="secondary" numberOfLines={1} style={styles.statDetail}>
                  {analytics.topPRs.length > 0
                    ? `Top: ${analytics.topPRs[0].exerciseName} (${analytics.topPRs[0].maxWeight}kg)`
                    : 'Personal bests'}
                </Text>
              </Pressable>
            </Card>

            {/* Monthly Workouts */}
            <Card style={styles.statTile} testID="metric-monthly-card">
              <View style={styles.statTileHeader}>
                <Icon name="calendar" size={14} color={colors.primary} />
                <Text variant="caption" color="muted" style={styles.statLabel}>
                  THIS MONTH
                </Text>
              </View>
              <Text variant="titleLarge" color="primary" style={styles.statNumber}>
                {`📅 ${analytics.workoutsThisMonth} ${analytics.workoutsThisMonth === 1 ? 'Workout' : 'Workouts'}`}
              </Text>
              <Text variant="caption" color="secondary" style={styles.statDetail}>
                Completed this month
              </Text>
            </Card>

            {/* Streak */}
            <Card style={styles.statTile} testID="metric-streak-card">
              <View style={styles.statTileHeader}>
                <Icon name="fire" size={14} color="#F59E0B" />
                <Text variant="caption" color="muted" style={styles.statLabel}>
                  STREAK
                </Text>
              </View>
              <Text variant="titleLarge" color="primary" style={styles.statNumber}>
                {`🔥 ${analytics.currentStreakDays} ${analytics.currentStreakDays === 1 ? 'Day' : 'Days'}`}
              </Text>
              <Text variant="caption" color="secondary" style={styles.statDetail}>
                {analytics.currentStreakDays > 0 ? 'Active streak' : 'Start streak today'}
              </Text>
            </Card>

            {/* Weekly Volume */}
            <Card style={styles.statTile} testID="metric-volume-card">
              <View style={styles.statTileHeader}>
                <Icon name="workout" size={14} color={colors.primary} />
                <Text variant="caption" color="muted" style={styles.statLabel}>
                  THIS WEEK
                </Text>
              </View>
              <Text variant="titleLarge" color="accent" style={styles.statNumber}>
                {`${formatVolume(analytics.weeklyVolume)}`}
              </Text>
              <Text variant="caption" color="secondary" style={styles.statDetail}>
                Tonnage lifted
              </Text>
            </Card>
          </View>

          {/* Weekly Goal Progress Strip */}
          <Card style={styles.goalStrip} testID="metric-weekly-goal-card">
            <View style={styles.goalRow}>
              <Text variant="caption" color="muted" style={styles.statLabel}>
                WEEKLY GOAL
              </Text>
              <Text variant="bodyBold" color="primary" style={styles.goalValue}>
                {`${analytics.workoutsThisWeek} / ${analytics.targetDaysPerWeek} Workouts`}
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, Math.max(4, analytics.weeklyGoalPercent))}%` },
                ]}
              />
            </View>
            <Text variant="caption" color="secondary" style={styles.goalSubtext}>
              {completedWorkouts.length === 0
                ? 'Start your first workout to begin your streak.'
                : analytics.workoutsThisWeek >= analytics.targetDaysPerWeek
                  ? 'Weekly workout target completed! 🎉'
                  : `${analytics.targetDaysPerWeek - analytics.workoutsThisWeek} workouts left to hit your weekly goal.`}
            </Text>
          </Card>
        </View>

        {/* 3. Primary Workout Action Hero */}
        <View style={styles.primaryActionSection}>
          <Card
            style={[styles.primaryActionCard, activeWorkout ? styles.primaryActionCardActive : undefined]}
            testID={activeWorkout ? 'home-active-workout-banner' : 'quick-start-card'}
          >
            <View style={styles.primaryActionHeader}>
              <View style={styles.primaryActionBadge}>
                <Icon name={activeWorkout ? 'fire' : 'workout'} size={13} color="#F59E0B" />
                <Text variant="label" color="accent" style={styles.primaryActionBadgeText}>
                  {activeWorkout ? 'ACTIVE WORKOUT IN PROGRESS' : 'READY TO TRAIN?'}
                </Text>
              </View>
            </View>

            <Text variant="titleMedium" color="primary" style={styles.primaryActionTitle}>
              {activeWorkout ? activeWorkout.name : 'Start your next workout.'}
            </Text>

            {activeWorkout && (
              <Text variant="caption" color="secondary" style={styles.primaryActionSubtext}>
                {`Started ${new Date(activeWorkout.startedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })} • ${activeWorkout.exercises.length} Exercises`}
              </Text>
            )}

            <View style={styles.primaryActionButtons}>
              {activeWorkout ? (
                <View style={styles.activeBtnRow}>
                  <Button
                    testID="home-resume-workout-button"
                    title="RESUME WORKOUT"
                    onPress={() => router.push('/workout/active' as any)}
                    variant="primary"
                    size="md"
                    style={styles.resumeButton}
                  />
                  <Button
                    testID="home-discard-workout-button"
                    title="Discard"
                    onPress={handleDiscardActiveWorkout}
                    variant="outline"
                    size="md"
                    style={styles.discardButton}
                  />
                </View>
              ) : (
                <Button
                  testID="start-quick-workout-button"
                  title="START WORKOUT"
                  onPress={handleStartEmptyWorkout}
                  variant="primary"
                  size="lg"
                  style={styles.startWorkoutButton}
                />
              )}

              {/* Quick link preserving browse-templates-link testID */}
              <Pressable
                testID="browse-templates-link"
                onPress={() => router.push('/workout/start' as any)}
                style={styles.blueprintLink}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text variant="caption" color="muted" style={styles.blueprintLinkText}>
                  Choose routine ›
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>

        {/* 3.5 Scheduled Today Card (if available) */}
        {todaySchedules.length > 0 && (
          <Card style={styles.scheduledTodayCard} testID="scheduled-today-card">
            <View style={styles.scheduledTodayHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="calendar" size={14} color="#F59E0B" />
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

            <View style={{ marginTop: 4 }}>
              {todaySchedules.map((item) => (
                <View key={item.id} style={styles.scheduledItemRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text variant="titleMedium" color="primary" style={{ fontWeight: '700', fontSize: 14 }}>
                      {item.name}
                    </Text>
                    {item.scheduledTime ? (
                      <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                        {`⏰ ${item.scheduledTime}`}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        setPreviewWorkout(item);
                        setPreviewVisible(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.homePreviewBtn}
                    >
                      <Icon name="search" size={12} color="#F59E0B" />
                      <Text style={styles.homePreviewText}>VIEW WORKOUT</Text>
                    </Pressable>
                  </View>

                  <View
                    style={[
                      styles.schedStatusBadge,
                      item.status === 'completed' && { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' },
                      item.status === 'skipped' && { backgroundColor: 'rgba(156, 163, 175, 0.15)', borderColor: '#9CA3AF' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.schedStatusText,
                        item.status === 'completed' && { color: '#10B981' },
                        item.status === 'skipped' && { color: '#9CA3AF' },
                      ]}
                    >
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* 4. My Workouts (Home Preview) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="caption" color="muted" style={styles.sectionTitle}>
              MY WORKOUTS
            </Text>
            <Pressable
              testID="my-templates-button"
              onPress={() => router.push('/templates' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text variant="label" color="accent" style={styles.sectionActionText}>
                {`View all (${templates.length}) →`}
              </Text>
            </Pressable>
          </View>

          {templates.length === 0 ? (
            <Card style={styles.emptyCard} testID="templates-empty-state">
              <Text variant="titleMedium" color="primary" style={styles.emptyTitle}>
                No saved workouts yet.
              </Text>
              <Text variant="caption" color="secondary" style={styles.emptySubtext}>
                Create reusable workout templates for quick starts.
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {templates.slice(0, 3).map((tpl) => {
                const totalSets = tpl.exercises?.reduce((sum, e) => sum + (e.sets || 3), 0) || 0;
                return (
                  <Card key={tpl.id} style={styles.workoutPlanCard}>
                    <Pressable
                      onPress={() => router.push(`/templates/${tpl.id}` as any)}
                      style={styles.workoutPlanContent}
                    >
                      <View style={styles.workoutPlanHeader}>
                        <View style={styles.focusDot} />
                        <Text variant="caption" color="muted" style={styles.workoutFocusText}>
                          {(tpl.workoutFocus || 'ROUTINE').toUpperCase()}
                        </Text>
                        {tpl.sequenceNumber ? (
                          <Text variant="caption" color="muted" style={styles.workoutSessionText}>
                            {`• Session ${tpl.sequenceNumber}`}
                          </Text>
                        ) : null}
                      </View>

                      <Text variant="titleMedium" color="primary" numberOfLines={1} style={styles.workoutPlanName}>
                        {tpl.name}
                      </Text>

                      <Text variant="caption" color="secondary" style={styles.workoutPlanDetails}>
                        {`${tpl.exercises?.length || 0} exercises • ${totalSets} sets`}
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
                      style={styles.planStartBtn}
                    />
                  </Card>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* 5. Recent Workouts (Completed History) */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text variant="caption" color="muted" style={styles.sectionTitle}>
              RECENT WORKOUTS
            </Text>
            <Pressable
              testID="workout-history-button"
              onPress={() => router.push('/workout/history' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text variant="label" color="accent" style={styles.sectionActionText}>
                View history →
              </Text>
            </Pressable>
          </View>

          {completedWorkouts.length === 0 ? (
            <Card style={styles.emptyCard} testID="recent-workouts-empty-state">
              <Text variant="titleMedium" color="primary" style={styles.emptyTitle}>
                No completed workouts yet.
              </Text>
              <Text variant="caption" color="secondary" style={styles.emptySubtext}>
                Your logged workouts and personal records will appear here.
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
              {completedWorkouts.slice(0, 3).map((w, idx) => (
                <Pressable
                  key={w.id}
                  testID={`recent-workout-card-${w.id}`}
                  onPress={() => router.push(`/workout/history/${w.id}` as any)}
                  style={[styles.historyRow, idx > 0 && styles.historyRowBorder]}
                >
                  <View style={styles.historyRowLeft}>
                    <Text variant="titleMedium" color="primary" numberOfLines={1} style={styles.historyName}>
                      {w.name}
                    </Text>
                    <Text variant="caption" color="secondary" style={styles.historyMeta}>
                      {`${w.exercises?.length || 0} exercises • ${w.completedSetsCount || 0} sets • ${formatVolume(w.totalVolume || 0)}`}
                    </Text>
                  </View>

                  <View style={styles.historyRowRight}>
                    <Text variant="caption" color="muted" style={styles.historyDate}>
                      {formatCompletedDate(w.finishedAt || w.startedAt)}
                    </Text>
                    <Text variant="caption" color="muted" style={styles.historyChevron}>
                      ›
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 6. Exercise Library CTA */}
        <Pressable
          testID="browse-exercises-button"
          onPress={() => router.push('/exercises' as any)}
          style={styles.exerciseLibraryTile}
        >
          <View style={styles.exerciseLibraryLeft}>
            <Icon name="exercises" size={16} color={colors.primary} />
            <View style={styles.exerciseLibraryTextGroup}>
              <Text variant="titleMedium" color="primary" style={styles.exerciseLibraryTitle}>
                Exercise Library
              </Text>
              <Text variant="caption" color="secondary" style={styles.exerciseLibrarySubtitle}>
                Browse exercises and find new movements
              </Text>
            </View>
          </View>
          <Text variant="titleMedium" color="muted" style={styles.exerciseLibraryChevron}>
            →
          </Text>
        </Pressable>

        {/* 7. App Footer */}
        <View style={styles.appFooter}>
          <Text variant="caption" color="muted" style={styles.appFooterText} testID="app-version-indicator">
            {`BeBig 2.0 ${env.displayVersion} • Developed by Aditya Patil`}
          </Text>
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

const createStyles = (colors: any) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingVertical: spacing.sm,
      paddingBottom: 100,
      gap: spacing.md + 2,
    },
    header: {
      marginBottom: 0,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTextGroup: {
      flex: 1,
      gap: 2,
    },
    greetingTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 12,
    },
    profileButton: {
      borderRadius: radii.full,
      marginLeft: spacing.sm,
    },
    profileAvatar: {
      width: 36,
      height: 36,
      borderRadius: radii.full,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    profileAvatarFallback: {
      width: 36,
      height: 36,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileInitials: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    progressSection: {
      gap: spacing.xs + 2,
    },
    progressGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs + 2,
    },
    statTile: {
      flex: 1,
      minWidth: '47%',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      padding: spacing.sm,
      borderRadius: radii.md,
      gap: 2,
    },
    statTilePressable: {
      gap: 2,
    },
    statTileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    statChevron: {
      fontSize: 13,
      marginLeft: 'auto',
      fontWeight: '700',
    },
    statNumber: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
      marginTop: 2,
    },
    statDetail: {
      fontSize: 11,
    },
    goalStrip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      padding: spacing.sm,
      borderRadius: radii.md,
      gap: 4,
    },
    goalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    goalValue: {
      fontSize: 13,
      fontWeight: '800',
    },
    progressBarTrack: {
      height: 4,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.full,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: radii.full,
    },
    goalSubtext: {
      fontSize: 11,
    },
    primaryActionSection: {},
    primaryActionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      padding: spacing.md,
      borderRadius: radii.lg,
      gap: spacing.xs,
    },
    primaryActionCardActive: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    primaryActionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    primaryActionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    primaryActionBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.primary,
    },
    primaryActionTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '800',
    },
    primaryActionSubtext: {
      fontSize: 12,
    },
    primaryActionButtons: {
      marginTop: 4,
      gap: spacing.xs,
    },
    activeBtnRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    resumeButton: {
      flex: 2,
    },
    discardButton: {
      flex: 1,
      borderColor: colors.error,
    },
    startWorkoutButton: {
      width: '100%',
    },
    blueprintLink: {
      alignItems: 'center',
      paddingVertical: 2,
    },
    blueprintLinkText: {
      fontSize: 11,
      fontWeight: '600',
    },
    scheduledTodayCard: {
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scheduledTodayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    scheduledItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: spacing.xs,
    },
    schedStatusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
      borderWidth: 1,
    },
    schedStatusText: {
      fontSize: 10,
      fontWeight: '800',
    },
    homePreviewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 4,
    },
    homePreviewText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.5,
    },
    sectionContainer: {
      gap: spacing.xs + 2,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
    },
    sectionActionText: {
      fontSize: 12,
      fontWeight: '700',
    },
    horizontalScroll: {
      gap: spacing.sm,
      paddingVertical: 2,
    },
    workoutPlanCard: {
      width: 210,
      padding: spacing.sm + 2,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      justifyContent: 'space-between',
    },
    workoutPlanContent: {
      gap: 3,
      marginBottom: spacing.sm,
    },
    workoutPlanHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    focusDot: {
      width: 6,
      height: 6,
      borderRadius: radii.full,
      backgroundColor: colors.primary,
    },
    workoutFocusText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: colors.textSecondary,
    },
    workoutSessionText: {
      fontSize: 9,
      fontWeight: '600',
    },
    workoutPlanName: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: 1,
    },
    workoutPlanDetails: {
      fontSize: 11,
    },
    planStartBtn: {
      minHeight: 32,
    },
    historyList: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.sm + 2,
    },
    historyRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    historyRowLeft: {
      flex: 1,
      marginRight: spacing.sm,
      gap: 2,
    },
    historyName: {
      fontSize: 14,
      fontWeight: '700',
    },
    historyMeta: {
      fontSize: 11,
    },
    historyRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    historyDate: {
      fontSize: 11,
      fontWeight: '600',
    },
    historyChevron: {
      fontSize: 14,
      fontWeight: '700',
    },
    emptyCard: {
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    emptySubtext: {
      fontSize: 11,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    emptyButton: {
      minWidth: 140,
    },
    exerciseLibraryTile: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.sm + 2,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    exerciseLibraryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    exerciseLibraryTextGroup: {
      flex: 1,
      gap: 1,
    },
    exerciseLibraryTitle: {
      fontSize: 13,
      fontWeight: '700',
    },
    exerciseLibrarySubtitle: {
      fontSize: 11,
    },
    exerciseLibraryChevron: {
      fontSize: 14,
      fontWeight: '700',
      marginLeft: spacing.xs,
    },
    appFooter: {
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    appFooterText: {
      fontSize: 11,
      letterSpacing: 0.2,
    },
  });
