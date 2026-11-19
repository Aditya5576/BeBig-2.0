import { useAppTheme } from '../../src/features/theme';
import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer, ScreenScrollView, Text, Button, Card, Icon } from '../../src/components/ui';
import { templateRepository, WorkoutTemplate } from '../../src/features/templates';
import { workoutRepository, WorkoutSession } from '../../src/features/workout';
import { useAuthStore } from '../../src/features/auth';
import { adminService, AssignedWorkoutRecord } from '../../src/features/admin';
import {
  getTemplateFocus,
  getSuggestedSessionNumber,
  deriveWorkoutFocus,
} from '../../src/features/templates/utils/templateUtils';
import { spacing, radii } from '../../src/constants/theme';

interface RecommendedTemplateResult {
  template: WorkoutTemplate;
  reason: string;
}

/**
 * Deterministic recommendation engine based on completed workout history
 * and workout focus rotation.
 * 
 * Rules:
 * 1. If completed workouts exist, rank templates by the time since their last completion:
 *    - Templates never completed come first (sorted by newest updatedAt).
 *    - Templates already completed are sorted by oldest completion date (the template
 *      trained longest ago is next in rotation).
 * 2. If no completed workouts exist, recommend the most recently updated template.
 */
function getRecommendedTemplate(
  templates: WorkoutTemplate[],
  completedWorkouts: WorkoutSession[],
): RecommendedTemplateResult | null {
  if (!templates || templates.length === 0) return null;

  if (templates.length === 1) {
    const tpl = templates[0];
    const hasHistory = completedWorkouts.some(
      (w) =>
        (w.status === 'completed' || !w.status) &&
        (w.sourceTemplateId === tpl.id || deriveWorkoutFocus(w.exercises) === getTemplateFocus(tpl)),
    );
    return {
      template: tpl,
      reason: hasHistory ? 'Next in your training rotation' : 'Ready for your first session',
    };
  }

  const templatesWithMeta = templates.map((tpl) => {
    const tplFocus = getTemplateFocus(tpl);
    let latestCompletionMs: number | null = null;

    for (const w of completedWorkouts) {
      if (w.status && w.status !== 'completed') continue;
      const matchesId = w.sourceTemplateId === tpl.id;
      const matchesFocus = deriveWorkoutFocus(w.exercises) === tplFocus;

      if (matchesId || matchesFocus) {
        const timestamp = new Date(w.finishedAt || w.startedAt).getTime();
        if (!isNaN(timestamp)) {
          if (latestCompletionMs === null || timestamp > latestCompletionMs) {
            latestCompletionMs = timestamp;
          }
        }
      }
    }

    return {
      template: tpl,
      latestCompletionMs,
      updatedAtMs: new Date(tpl.updatedAt || tpl.createdAt || 0).getTime(),
    };
  });

  templatesWithMeta.sort((a, b) => {
    if (a.latestCompletionMs === null && b.latestCompletionMs === null) {
      return b.updatedAtMs - a.updatedAtMs;
    }
    if (a.latestCompletionMs === null) return -1;
    if (b.latestCompletionMs === null) return 1;
    return a.latestCompletionMs - b.latestCompletionMs;
  });

  const best = templatesWithMeta[0];
  let reason = 'Ready for your first session';

  if (best.latestCompletionMs !== null) {
    const diffHours = Math.max(0, Math.floor((Date.now() - best.latestCompletionMs) / (1000 * 60 * 60)));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 0) {
      reason = 'Trained today • Next in rotation';
    } else if (diffDays === 1) {
      reason = 'Last trained yesterday • Next in rotation';
    } else {
      reason = `Last trained ${diffDays}d ago • Next in rotation`;
    }
  } else if (completedWorkouts.length > 0) {
    reason = 'New template • Ready to train';
  }

  return {
    template: best.template,
    reason,
  };
}

export default function StartWorkoutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const authStatus = useAuthStore((state) => state.status);
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const isGuest = useAuthStore((state) => state.isGuest);

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSession[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [assignedWorkouts, setAssignedWorkouts] = useState<AssignedWorkoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allTemplates, currentActive, history] = await Promise.all([
        templateRepository.getTemplates(),
        workoutRepository.getActiveWorkout(),
        workoutRepository.getCompletedWorkouts().catch(() => []),
      ]);
      setTemplates(allTemplates);
      setActiveWorkout(currentActive);
      setCompletedWorkouts(history || []);
    } catch {
      setTemplates([]);
      setActiveWorkout(null);
      setCompletedWorkouts([]);
    } finally {
      setLoading(false);
    }

    // Non-blocking trainer inbox hydration (strictly zero network calls for guests)
    const canFetchAssigned = authStatus === 'authenticated' && !isGuest && Boolean(authUserId);
    if (!canFetchAssigned) {
      setAssignedWorkouts([]);
      return;
    }

    try {
      const assigned = await adminService.getMyAssignedWorkouts(authUserId);
      setAssignedWorkouts(assigned);
    } catch {
      setAssignedWorkouts([]);
    }
  }, [authStatus, isGuest, authUserId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const handleStartAssignedWorkout = async (assignment: AssignedWorkoutRecord) => {
    // Ephemeral in-memory template — never mutates or saves to user's personal templates
    const ephemeralTemplate: WorkoutTemplate = {
      id: `assigned_${assignment.id}`,
      name: assignment.title,
      createdAt: assignment.created_at,
      updatedAt: assignment.created_at,
      exercises: assignment.exercises.map((ex, idx) => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        categoryName: ex.categoryName,
        order: idx,
        sets: ex.sets,
        targetReps: ex.targetReps,
        restTime: ex.restTime,
      })),
    };

    const currentActive = activeWorkout ?? (await workoutRepository.getActiveWorkout());
    if (currentActive) {
      Alert.alert(
        'Active Workout in Progress',
        `You already have an active workout ("${currentActive.name}"). Would you like to resume it or discard it first?`,
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
              try {
                await workoutRepository.discardActiveWorkout();
                setActiveWorkout(null);
                await workoutRepository.startWorkoutFromTemplate(
                  ephemeralTemplate,
                  undefined,
                  undefined,
                  { forceDiscardExisting: true },
                );
                void adminService.markAssignedWorkoutStatus(assignment.id, 'started');
                router.push('/workout/active' as any);
              } catch (err: any) {
                Alert.alert('Error', err?.message || 'Failed to start assigned workout.');
              }
            },
          },
        ],
      );
      return;
    }

    try {
      setStarting(true);
      await workoutRepository.startWorkoutFromTemplate(ephemeralTemplate);
      void adminService.markAssignedWorkoutStatus(assignment.id, 'started');
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start assigned workout.');
    } finally {
      setStarting(false);
    }
  };

  const handleStartFromTemplate = async (template: WorkoutTemplate) => {
    const currentActive = activeWorkout ?? (await workoutRepository.getActiveWorkout());
    if (currentActive) {
      Alert.alert(
        'Active Workout in Progress',
        `You already have an active workout ("${currentActive.name}"). Would you like to resume it or discard it first?`,
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
              try {
                await workoutRepository.discardActiveWorkout();
                setActiveWorkout(null);
                await workoutRepository.startWorkoutFromTemplate(template, undefined, undefined, {
                  forceDiscardExisting: true,
                });
                router.push('/workout/active' as any);
              } catch (err: any) {
                Alert.alert('Error', err?.message || 'Failed to start workout.');
              }
            },
          },
        ],
      );
      return;
    }

    try {
      setStarting(true);
      await workoutRepository.startWorkoutFromTemplate(template);
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start workout.');
    } finally {
      setStarting(false);
    }
  };

  const handleStartEmptyWorkout = async () => {
    const currentActive = activeWorkout ?? (await workoutRepository.getActiveWorkout());
    if (currentActive) {
      Alert.alert(
        'Active Workout in Progress',
        `You already have an active workout ("${currentActive.name}"). Would you like to resume it or discard it first?`,
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
              try {
                await workoutRepository.discardActiveWorkout();
                setActiveWorkout(null);
                await workoutRepository.startEmptyWorkout('Quick Workout', undefined, {
                  forceDiscardExisting: true,
                });
                router.push('/workout/active' as any);
              } catch (err: any) {
                Alert.alert('Error', err?.message || 'Failed to start empty workout.');
              }
            },
          },
        ],
      );
      return;
    }

    try {
      setStarting(true);
      await workoutRepository.startEmptyWorkout('Quick Workout');
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start workout.');
    } finally {
      setStarting(false);
    }
  };

  const handleDiscardActive = () => {
    Alert.alert(
      'Discard Active Workout',
      'Are you sure you want to discard your current workout draft? All unrecorded progress will be lost.',
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

  const recommendedResult = useMemo(
    () => getRecommendedTemplate(templates, completedWorkouts),
    [templates, completedWorkouts],
  );

  return (
    <ScreenContainer>
      <ScreenScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Navigation & Screen Header */}
        <View style={styles.header}>
          <Pressable
            testID="start-workout-back-button"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <View style={styles.backButtonContent}>
              <Icon name="chevronLeft" size={20} strokeWidth={2.5} color={colors.primary} />
              <Text variant="bodyBold" color="accent" style={styles.backButtonText}>
                Back
              </Text>
            </View>
          </Pressable>

          <View style={styles.titleContainer}>
            <Text variant="display" color="primary" testID="start-workout-title" style={styles.screenTitle}>
              Start Workout
            </Text>
            <Text variant="body" color="secondary" style={styles.screenSubtitle}>
              Launch a structured session or begin an empty workout.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Priority 1: Active Workout in Progress */}
            {activeWorkout && (
              <Card style={styles.activeWorkoutCard} testID="active-workout-banner">
                <View style={styles.activeTopRow}>
                  <View style={styles.activeBadge}>
                    <View style={styles.activePulseDot} />
                    <Text variant="caption" style={styles.activeBadgeText}>
                      SESSION IN PROGRESS
                    </Text>
                  </View>
                </View>

                <View style={styles.activeDetails}>
                  <Text variant="titleMedium" color="primary" numberOfLines={1} style={styles.activeWorkoutName}>
                    {activeWorkout.name}
                  </Text>
                  <Text variant="caption" color="secondary" style={styles.activeMetaText}>
                    Started{' '}
                    {new Date(activeWorkout.startedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {activeWorkout.exercises.length}{' '}
                    {activeWorkout.exercises.length === 1 ? 'Exercise' : 'Exercises'}
                  </Text>
                </View>

                <View style={styles.activeActionRow}>
                  <Button
                    testID="start-resume-workout-button"
                    title="Resume Workout"
                    onPress={() => router.push('/workout/active' as any)}
                    variant="primary"
                    size="md"
                    style={styles.activeResumeButton}
                  />
                  <Button
                    testID="start-discard-workout-button"
                    title="Discard"
                    onPress={handleDiscardActive}
                    variant="outline"
                    size="md"
                    style={styles.activeDiscardButton}
                  />
                </View>
              </Card>
            )}

            {/* Priority 2: Isolated Trainer-Assigned Workout Inbox (Authenticated only) */}
            {authStatus === 'authenticated' && !isGuest && assignedWorkouts.length > 0 && (
              <View style={styles.assignedSection} testID="assigned-by-trainer-section">
                <View style={styles.assignedHeaderRow}>
                  <Text variant="label" color="accent" style={styles.assignedSectionLabel}>
                    ASSIGNED BY TRAINER
                  </Text>
                  <Text variant="caption" color="muted">
                    {assignedWorkouts.length}{' '}
                    {assignedWorkouts.length === 1 ? 'Workout' : 'Workouts'}
                  </Text>
                </View>

                {assignedWorkouts.map((assignment) => (
                  <Card
                    key={assignment.id}
                    style={styles.assignedCard}
                    testID={`assigned-workout-card-${assignment.id}`}
                  >
                    <View style={styles.assignedCardTop}>
                      <View style={styles.assignedBadge}>
                        <Text variant="caption" style={styles.assignedBadgeText}>
                          COACH PLAN
                        </Text>
                      </View>
                      <Text variant="caption" color="muted">
                        {assignment.exercises.length}{' '}
                        {assignment.exercises.length === 1 ? 'Exercise' : 'Exercises'}
                      </Text>
                    </View>

                    <Text variant="titleMedium" color="primary" style={styles.assignedTitle}>
                      {assignment.title}
                    </Text>

                    {assignment.trainer_note ? (
                      <Text variant="caption" color="secondary" style={styles.assignedNote}>
                        {assignment.trainer_note}
                      </Text>
                    ) : null}

                    <Text variant="caption" color="muted" numberOfLines={2}>
                      {assignment.exercises.map((e) => e.exerciseName).join(' • ')}
                    </Text>

                    <Button
                      testID={`start-assigned-workout-${assignment.id}`}
                      title="Start Assigned Workout"
                      onPress={() => {
                        void handleStartAssignedWorkout(assignment);
                      }}
                      variant="primary"
                      size="sm"
                      loading={starting}
                      style={styles.startAssignedButton}
                    />
                  </Card>
                ))}
              </View>
            )}

            {/* Quick Action: Start Blank Workout */}
            <Card style={styles.quickStartCard}>
              <View style={styles.quickStartTextGroup}>
                <View style={styles.quickStartHeaderRow}>
                  <Text variant="titleMedium" color="primary" style={styles.quickStartTitle}>
                    Empty Workout
                  </Text>
                  <View style={styles.quickStartBadge}>
                    <Text variant="caption" style={styles.quickStartBadgeText}>
                      FREESTYLE
                    </Text>
                  </View>
                </View>
                <Text variant="caption" color="secondary" style={styles.quickStartSubtitle}>
                  Add exercises and record sets on the fly with no template.
                </Text>
              </View>

              <Button
                testID="start-empty-workout-button"
                title="Start Empty Workout"
                onPress={handleStartEmptyWorkout}
                variant="secondary"
                size="md"
                loading={starting}
                style={styles.startEmptyButton}
              />
            </Card>

            {/* Recommended Next Workout */}
            {recommendedResult && (
              <Card style={styles.recommendedCard} testID="recommended-template-card">
                <View style={styles.recommendedHeader}>
                  <View style={styles.recommendedBadgeRow}>
                    <View style={styles.recommendedBadge}>
                      <Text variant="caption" style={styles.recommendedBadgeText}>
                        RECOMMENDED NEXT
                      </Text>
                    </View>
                    <View style={styles.focusBadge}>
                      <Text variant="caption" style={styles.focusBadgeText}>
                        {getTemplateFocus(recommendedResult.template).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.sessionBadge}>
                      <Text variant="caption" style={styles.sessionBadgeText}>
                        Session{' '}
                        {getSuggestedSessionNumber(
                          completedWorkouts,
                          getTemplateFocus(recommendedResult.template),
                        )}
                      </Text>
                    </View>
                  </View>

                  <Text variant="titleMedium" color="primary" numberOfLines={1} style={styles.recommendedTitle}>
                    {recommendedResult.template.name}
                  </Text>

                  <Text variant="caption" color="accent" style={styles.recommendedReason}>
                    {recommendedResult.reason}
                  </Text>

                  {recommendedResult.template.exercises.length > 0 && (
                    <Text variant="caption" color="secondary" numberOfLines={2} style={styles.recommendedExercises}>
                      {recommendedResult.template.exercises.map((e) => e.exerciseName).join(' • ')}
                    </Text>
                  )}
                </View>

                <Button
                  testID="start-recommended-template-button"
                  title={`Start "${recommendedResult.template.name}"`}
                  onPress={() => handleStartFromTemplate(recommendedResult.template)}
                  variant="primary"
                  size="md"
                  loading={starting}
                  style={styles.startRecommendedButton}
                />
              </Card>
            )}

            {/* My Templates Library Section */}
            <View style={styles.templatesSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Text variant="titleMedium" color="primary" style={styles.sectionTitle}>
                    My Templates
                  </Text>
                  <View style={styles.countBadge}>
                    <Text variant="caption" style={styles.countBadgeText}>
                      {templates.length}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/templates' as any)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <View style={styles.manageTemplatesRow}>
                    <Text variant="caption" color="accent" style={styles.manageTemplatesText}>
                      Manage Library
                    </Text>
                    <Icon name="arrowRight" size={13} strokeWidth={2.5} color={colors.primary} />
                  </View>
                </Pressable>
              </View>

              {templates.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Text variant="titleMedium" color="primary" style={styles.emptyTitle}>
                    No Templates Yet
                  </Text>
                  <Text variant="caption" color="secondary" style={styles.emptyText}>
                    Create reusable templates for consistent progression tracking.
                  </Text>
                  <Button
                    testID="create-template-button"
                    title="+ Create Template"
                    onPress={() => router.push('/templates/new' as any)}
                    variant="outline"
                    size="md"
                    style={styles.createTemplateButton}
                  />
                </Card>
              ) : (
                templates.map((tpl) => {
                  const focus = getTemplateFocus(tpl);
                  const sessionNum = getSuggestedSessionNumber(completedWorkouts, focus);
                  const exCount = tpl.exercises.length;

                  return (
                    <Card key={tpl.id} style={styles.templateCard} testID={`template-card-${tpl.id}`}>
                      <View style={styles.templateCardContent}>
                        {/* Badges Row */}
                        <View style={styles.templateBadgesRow}>
                          <View style={styles.focusBadge}>
                            <Text variant="caption" style={styles.focusBadgeText}>
                              {focus.toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.sessionBadge}>
                            <Text variant="caption" style={styles.sessionBadgeText}>
                              Session {sessionNum}
                            </Text>
                          </View>
                          <Text variant="caption" color="secondary" style={styles.exerciseCountText}>
                            {exCount} {exCount === 1 ? 'exercise' : 'exercises'}
                          </Text>
                        </View>

                        {/* Template Name */}
                        <Text variant="titleMedium" color="primary" numberOfLines={1} style={styles.templateName}>
                          {tpl.name}
                        </Text>

                        {/* Exercise Preview List */}
                        {exCount > 0 && (
                          <Text variant="caption" color="secondary" numberOfLines={1} style={styles.templateExercisesPreview}>
                            {tpl.exercises.map((e) => e.exerciseName).slice(0, 3).join(' • ')}
                            {exCount > 3 ? ` +${exCount - 3} more` : ''}
                          </Text>
                        )}
                      </View>

                      {/* Start Action Button */}
                      <Button
                        testID={`start-template-${tpl.id}`}
                        title="Start"
                        onPress={() => handleStartFromTemplate(tpl)}
                        variant="primary"
                        size="sm"
                        disabled={starting}
                        style={styles.startTemplateButton}
                      />
                    </Card>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    header: {
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    backButton: {
      minHeight: 36,
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    backButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    titleContainer: {
      gap: 2,
    },
    screenTitle: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    screenSubtitle: {
      fontSize: 13,
      lineHeight: 18,
    },
    loadingContainer: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },

    // Active Workout Banner
    activeWorkoutCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primary,
      borderWidth: 1.5,
      padding: spacing.md,
      gap: spacing.sm,
      borderRadius: radii.md,
    },
    activeTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    activePulseDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    activeBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: colors.primary,
    },
    activeDetails: {
      gap: 2,
    },
    activeWorkoutName: {
      fontSize: 17,
      fontWeight: '700',
    },
    activeMetaText: {
      fontSize: 12,
    },
    activeActionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: 4,
    },
    activeResumeButton: {
      flex: 2,
      minHeight: 44,
    },
    activeDiscardButton: {
      flex: 1,
      minHeight: 44,
      borderColor: colors.error,
    },

    // Quick Start / Freestyle
    quickStartCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
      borderRadius: radii.md,
    },
    quickStartTextGroup: {
      gap: 4,
    },
    quickStartHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    quickStartTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    quickStartBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    quickStartBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.textMuted,
    },
    quickStartSubtitle: {
      fontSize: 12,
      lineHeight: 16,
    },
    startEmptyButton: {
      minHeight: 44,
    },

    // Recommended Next
    recommendedCard: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
      borderRadius: radii.md,
    },
    recommendedHeader: {
      gap: 6,
    },
    recommendedBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    recommendedBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    recommendedBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: colors.primary,
    },
    focusBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.xs + 4,
      paddingVertical: 3,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    focusBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.4,
    },
    sessionBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.xs + 4,
      paddingVertical: 3,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    sessionBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
    recommendedTitle: {
      fontSize: 17,
      fontWeight: '700',
      marginTop: 2,
    },
    recommendedReason: {
      fontSize: 12,
      fontWeight: '600',
    },
    recommendedExercises: {
      fontSize: 12,
      lineHeight: 16,
    },
    startRecommendedButton: {
      minHeight: 44,
    },

    // Templates List Section
    templatesSection: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    sectionTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    countBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    manageTemplatesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    manageTemplatesText: {
      fontSize: 12,
      fontWeight: '600',
    },
    emptyCard: {
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    emptyText: {
      textAlign: 'center',
      fontSize: 12,
      maxWidth: 240,
    },
    createTemplateButton: {
      marginTop: spacing.xs,
      minHeight: 40,
    },

    // Template Card
    templateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      gap: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    templateCardContent: {
      flex: 1,
      gap: 4,
    },
    templateBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 2,
    },
    exerciseCountText: {
      fontSize: 11,
    },
    templateName: {
      fontSize: 15,
      fontWeight: '700',
    },
    templateExercisesPreview: {
      fontSize: 12,
    },
    startTemplateButton: {
      minWidth: 72,
      minHeight: 38,
      flexShrink: 0,
    },
    assignedSection: {
      gap: spacing.sm,
    },
    assignedHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 2,
    },
    assignedSectionLabel: {
      letterSpacing: 0.8,
    },
    assignedCard: {
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      gap: spacing.xs + 2,
    },
    assignedCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    assignedBadge: {
      backgroundColor: 'rgba(56, 189, 248, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.4)',
      borderRadius: radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    assignedBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.6,
    },
    assignedTitle: {
      fontWeight: '700',
    },
    assignedNote: {
      lineHeight: 18,
    },
    startAssignedButton: {
      marginTop: spacing.xs,
      alignSelf: 'flex-start',
    },
  });
