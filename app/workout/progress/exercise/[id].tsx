import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect as routerFocusEffect } from 'expo-router';
import { useAppTheme } from '../../../../src/features/theme';
import { ScreenContainer, Text, Button, Card } from '../../../../src/components/ui';
import { workoutRepository, formatWorkoutDate, formatVolume } from '../../../../src/features/workout';
import { spacing, radii } from '../../../../src/constants/theme';
import {
  ExercisePerformanceSnapshot,
  extractExercisePerformances,
  findPreviousPerformance,
  compareExerciseSets,
  SetComparisonItem,
} from '../../../../src/features/performance';

const useFocusEffect = routerFocusEffect || React.useEffect;

export default function ExerciseProgressionScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();

  const [snapshots, setSnapshots] = useState<ExercisePerformanceSnapshot[]>([]);
  const [resolvedName, setResolvedName] = useState<string>(name || 'Exercise Progression');
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (!id) {
        setLoading(false);
        return;
      }
      if (snapshots.length === 0) {
        setLoading(true);
      }
      void (async () => {
        try {
          const workouts = await workoutRepository.getCompletedWorkouts();
          if (!isMounted) return;

          // Extract performance snapshots across all completed workouts for target exercise
          const allSnapshots: ExercisePerformanceSnapshot[] = [];
          for (const w of workouts) {
            const exSnaps = extractExercisePerformances(w);
            for (const s of exSnaps) {
              if (s.exerciseId === id) {
                allSnapshots.push(s);
              }
            }
          }

          // Sort chronologically ascending (oldest -> newest)
          allSnapshots.sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());

          setSnapshots(allSnapshots);

          // Infer exercise name if omitted in URL search params
          if (!name && allSnapshots.length > 0) {
            setResolvedName(allSnapshots[allSnapshots.length - 1].exerciseName);
          }
        } catch {
          if (isMounted) setSnapshots([]);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
      return () => {
        isMounted = false;
      };
    }, [id, name]),
  );

  // Latest (current) snapshot
  const latestSnapshot = useMemo(() => {
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }, [snapshots]);

  // Previous comparable snapshot
  const previousSnapshot = useMemo(() => {
    if (!latestSnapshot) return null;
    return findPreviousPerformance(latestSnapshot, snapshots);
  }, [latestSnapshot, snapshots]);

  // Set-by-Set comparisons (Last Workout vs Current Workout)
  const setComparisons = useMemo<SetComparisonItem[]>(() => {
    if (!latestSnapshot) return [];
    return compareExerciseSets(latestSnapshot.sets, previousSnapshot?.sets || []);
  }, [latestSnapshot, previousSnapshot]);

  // Factual Summary Statistics
  const summaryCounts = useMemo(() => {
    let increased = 0;
    let decreased = 0;
    let maintained = 0;

    for (const item of setComparisons) {
      if (item.status === 'increased' || item.status === 'new_set') {
        increased++;
      } else if (item.status === 'decreased' || item.status === 'removed_set') {
        decreased++;
      } else if (item.status === 'no_change') {
        maintained++;
      }
    }

    return { increased, decreased, maintained };
  }, [setComparisons]);

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Section 1: Header */}
        <View style={styles.header}>
          <Pressable
            testID="progression-back-button"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="bodyBold" color="accent" style={styles.backButtonText}>
              ‹ Back
            </Text>
          </Pressable>

          <View style={styles.titleContainer}>
            <View style={styles.progressionBadge}>
              <Text variant="caption" color="accent" style={styles.progressionBadgeText}>
                SET-BY-SET EXERCISE PROGRESSION
              </Text>
            </View>
            <Text variant="display" color="primary" testID="progression-exercise-name">
              {resolvedName}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : snapshots.length === 0 ? (
          /* Empty State: 0 Sessions */
          <Card style={styles.emptyCard} testID="progression-empty-state">
            <View style={styles.emptyIconContainer}>
              <Text variant="display" style={styles.emptyEmoji}>
                🏋️‍♂️
              </Text>
            </View>
            <Text variant="titleLarge" color="primary" style={styles.emptyTitle}>
              No History Logged Yet
            </Text>
            <Text variant="body" color="secondary" style={styles.emptySubtitle}>
              Complete a workout containing this exercise to track your set-by-set progression over time.
            </Text>
            <Button
              testID="progression-start-workout-button"
              title="Start Workout"
              onPress={() => router.push('/workout/start' as any)}
              variant="primary"
              size="lg"
              style={styles.emptyButton}
            />
          </Card>
        ) : (
          /* Populated State */
          <View style={styles.contentSection}>
            {/* Single Session Card (1 workout logged) */}
            {snapshots.length === 1 && latestSnapshot && (
              <Card style={styles.cardContainer} testID="progression-card-latest-summary">
                <Text variant="caption" color="muted" style={styles.sectionSubTitle}>
                  LATEST PERFORMANCE ({formatWorkoutDate(latestSnapshot.sessionDate)})
                </Text>

                <View style={styles.setsComparisonTable}>
                  {latestSnapshot.sets.map((set) => (
                    <View key={set.setNumber} style={styles.setRowCard} testID={`progression-set-item-${set.setNumber}`}>
                      <View style={styles.setRowHeader}>
                        <View style={styles.setBadge}>
                          <Text variant="caption" color="primary" style={styles.setNumberText}>
                            SET {set.setNumber}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.singleSetValueContainer}>
                        <Text variant="bodyBold" color="primary">
                          {set.weight} kg × {set.reps} reps
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.singleNotice} testID="progression-single-performance-notice">
                  <Text variant="caption" color="secondary">
                    First workout logged for this exercise. Complete another workout to compare set progression.
                  </Text>
                </View>
              </Card>
            )}

            {/* Set-by-Set Progression Comparison Card (2+ workouts) */}
            {snapshots.length > 1 && latestSnapshot && previousSnapshot && (
              <Card style={styles.cardContainer} testID="progression-card-comparison">
                <View style={styles.comparisonHeader}>
                  <Text variant="caption" color="muted" style={styles.sectionSubTitle}>
                    LAST WORKOUT VS CURRENT WORKOUT
                  </Text>

                  <View style={styles.datesRow}>
                    <Text variant="caption" color="secondary">
                      PREV: {formatWorkoutDate(previousSnapshot.sessionDate)}
                    </Text>
                    <Text variant="caption" color="accent">
                      CURR: {formatWorkoutDate(latestSnapshot.sessionDate)}
                    </Text>
                  </View>
                </View>

                {/* Set-by-Set Non-Overlapping Structured Cards */}
                <View style={styles.setsComparisonTable}>
                  {setComparisons.map((item) => (
                    <View
                      key={item.setNumber}
                      style={styles.setRowCard}
                      testID={`progression-set-item-${item.setNumber}`}
                    >
                      <View style={styles.setRowHeader}>
                        <View style={styles.setBadge}>
                          <Text variant="caption" color="primary" style={styles.setNumberText}>
                            SET {item.setNumber}
                          </Text>
                        </View>

                        {/* Delta Badge */}
                        <View
                          style={[
                            styles.deltaBadge,
                            item.status === 'increased' && styles.deltaBadgeIncreased,
                            item.status === 'decreased' && styles.deltaBadgeDecreased,
                            item.status === 'new_set' && styles.deltaBadgeNew,
                            item.status === 'removed_set' && styles.deltaBadgeRemoved,
                          ]}
                        >
                          <Text
                            variant="caption"
                            style={[
                              styles.deltaText,
                              item.status === 'increased' && { color: '#10B981' },
                              item.status === 'decreased' && { color: '#EF4444' },
                              item.status === 'new_set' && { color: '#3B82F6' },
                              item.status === 'removed_set' && { color: '#9CA3AF' },
                              item.status === 'no_change' && { color: colors.textMuted },
                            ]}
                            testID={`progression-set-delta-${item.setNumber}`}
                          >
                            {item.displayText}
                          </Text>
                        </View>
                      </View>

                      {/* Structured Responsive Grid Columns */}
                      <View style={styles.setValuesGrid}>
                        <View style={styles.setValCol}>
                          <Text variant="caption" color="muted" style={styles.valColHeader}>
                            PREVIOUS
                          </Text>
                          <Text variant="body" color="muted" style={styles.prevSetText}>
                            {item.previousSet ? `${item.previousSet.weight} kg × ${item.previousSet.reps}` : '—'}
                          </Text>
                        </View>

                        <Text variant="body" color="muted" style={styles.setValArrow}>
                          →
                        </Text>

                        <View style={styles.setValCol}>
                          <Text variant="caption" color="muted" style={styles.valColHeader}>
                            CURRENT
                          </Text>
                          <Text variant="bodyBold" color="primary" style={styles.currSetText}>
                            {item.currentSet ? `${item.currentSet.weight} kg × ${item.currentSet.reps}` : '—'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Factual Summary Metrics */}
                <View style={styles.summaryBar}>
                  <View style={styles.summaryBadgeItem} testID="progression-summary-increased">
                    <Text variant="caption" color="muted">
                      INCREASED
                    </Text>
                    <Text variant="titleMedium" style={{ color: '#10B981' }}>
                      {summaryCounts.increased}
                    </Text>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryBadgeItem} testID="progression-summary-decreased">
                    <Text variant="caption" color="muted">
                      DECREASED
                    </Text>
                    <Text variant="titleMedium" style={{ color: summaryCounts.decreased > 0 ? '#EF4444' : colors.textPrimary }}>
                      {summaryCounts.decreased}
                    </Text>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryBadgeItem} testID="progression-summary-maintained">
                    <Text variant="caption" color="muted">
                      MAINTAINED
                    </Text>
                    <Text variant="titleMedium" color="primary">
                      {summaryCounts.maintained}
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Historical Sessions List */}
            <View style={styles.timelineHeader}>
              <Text variant="titleMedium" color="primary">
                Workout History ({snapshots.length})
              </Text>
              <Text variant="caption" color="muted">
                Newest → Oldest
              </Text>
            </View>

            <View style={styles.sessionsList} testID="progression-history-list">
              {[...snapshots].reverse().map((snap, index) => {
                const isExpanded = !!expandedSessions[snap.sessionId];

                return (
                  <Card key={snap.sessionId} style={styles.sessionCard} testID={`progression-session-card-${snap.sessionId}`}>
                    <Pressable
                      testID={`progression-toggle-sets-${snap.sessionId}`}
                      onPress={() => toggleSession(snap.sessionId)}
                      style={styles.sessionHeaderPressable}
                    >
                      <View style={styles.sessionTopRow}>
                        <View style={styles.sessionDateGroup}>
                          <Text variant="caption" color="muted">
                            SESSION #{snapshots.length - index}
                          </Text>
                          <Text variant="titleMedium" color="primary" testID={`progression-session-date-${snap.sessionId}`}>
                            {formatWorkoutDate(snap.sessionDate)}
                          </Text>
                          <Text variant="caption" color="secondary">
                            {snap.sessionName}
                          </Text>
                        </View>

                        <Text variant="caption" color="accent" style={styles.toggleIndicator}>
                          {isExpanded ? 'Hide ▲' : 'Sets ▼'}
                        </Text>
                      </View>

                      {/* Performance Metrics Row */}
                      <View style={styles.timelineSessionMetricsRow}>
                        <View style={styles.summaryMetricItem}>
                          <Text variant="caption" color="muted">
                            SETS
                          </Text>
                          <Text variant="bodyBold" color="primary">
                            {snap.sets.length}
                          </Text>
                        </View>

                        <View style={styles.summaryMetricItem}>
                          <Text variant="caption" color="muted">
                            TOP WEIGHT
                          </Text>
                          <Text
                            variant="bodyBold"
                            color="accent"
                            testID={`progression-session-max-weight-${snap.sessionId}`}
                          >
                            {snap.topWeight} kg
                          </Text>
                        </View>

                        <View style={styles.summaryMetricItem}>
                          <Text variant="caption" color="muted">
                            TOP REPS
                          </Text>
                          <Text
                            variant="bodyBold"
                            color="primary"
                            testID={`progression-session-reps-${snap.sessionId}`}
                          >
                            {snap.topWeightReps}
                          </Text>
                        </View>

                        <View style={styles.summaryMetricItem}>
                          <Text variant="caption" color="muted">
                            VOLUME
                          </Text>
                          <Text
                            variant="bodyBold"
                            color="primary"
                            testID={`progression-session-volume-${snap.sessionId}`}
                          >
                            {formatVolume(snap.totalVolume)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    {/* Expandable Set Breakdown */}
                    {isExpanded && (
                      <View style={styles.setsTable} testID={`progression-sets-table-${snap.sessionId}`}>
                        <View style={styles.tableHeaderRow}>
                          <Text variant="caption" color="muted" style={styles.colSet}>
                            SET
                          </Text>
                          <Text variant="caption" color="muted" style={styles.colWeight}>
                            WEIGHT
                          </Text>
                          <Text variant="caption" color="muted" style={styles.colReps}>
                            REPS
                          </Text>
                        </View>

                        {snap.sets.map((set) => (
                          <View
                            key={set.setNumber}
                            style={styles.tableSetRow}
                            testID={`progression-set-row-${snap.sessionId}-${set.setNumber}`}
                          >
                            <View style={styles.colSet}>
                              <View style={styles.setNumberBadge}>
                                <Text variant="caption" color="primary">
                                  {set.setNumber}
                                </Text>
                              </View>
                            </View>
                            <Text variant="body" color="accent" style={styles.colWeight}>
                              {set.weight} kg
                            </Text>
                            <Text variant="body" color="primary" style={styles.colReps}>
                              {set.reps}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 140, // Content is fully scrollable well above bottom navigation / iOS safe area
    },
    header: {
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
      paddingRight: spacing.md,
      marginBottom: spacing.xs,
    },
    backButtonText: {
      fontSize: 16,
    },
    titleContainer: {
      marginTop: spacing.xs,
    },
    progressionBadge: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radii.full,
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    progressionBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    loadingContainer: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderRadius: radii.lg,
    },
    emptyIconContainer: {
      width: 64,
      height: 64,
      borderRadius: radii.full,
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyEmoji: {
      fontSize: 32,
    },
    emptyTitle: {
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    emptySubtitle: {
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    emptyButton: {
      width: '100%',
    },
    contentSection: {
      marginTop: spacing.xs,
      gap: spacing.md,
    },
    cardContainer: {
      padding: spacing.md,
    },
    sectionSubTitle: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    comparisonHeader: {
      marginBottom: spacing.sm,
    },
    datesRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    setsComparisonTable: {
      gap: spacing.sm,
      marginVertical: spacing.xs,
    },
    setRowCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radii.sm,
      gap: spacing.xs,
    },
    setRowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    setBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radii.xs || 4,
    },
    setNumberText: {
      fontSize: 10,
      fontWeight: '700',
    },
    singleSetValueContainer: {
      paddingTop: 2,
    },
    deltaBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radii.full,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    deltaBadgeIncreased: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    deltaBadgeDecreased: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    deltaBadgeNew: {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
    },
    deltaBadgeRemoved: {
      backgroundColor: 'rgba(156, 163, 175, 0.15)',
    },
    deltaText: {
      fontSize: 12,
      fontWeight: '700',
    },
    setValuesGrid: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 2,
    },
    setValCol: {
      flex: 1,
      alignItems: 'center',
    },
    valColHeader: {
      fontSize: 9,
      letterSpacing: 0.5,
      fontWeight: '800',
      marginBottom: 2,
    },
    setValArrow: {
      fontSize: 14,
      paddingHorizontal: spacing.xs,
    },
    prevSetText: {
      fontSize: 13,
      textDecorationLine: 'line-through',
      opacity: 0.7,
    },
    currSetText: {
      fontSize: 14,
    },
    summaryBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.08)',
      paddingTop: spacing.sm,
      marginTop: spacing.sm,
    },
    summaryBadgeItem: {
      alignItems: 'center',
    },
    summaryDivider: {
      width: 1,
      height: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    singleNotice: {
      marginTop: spacing.sm,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    timelineHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginTop: spacing.sm,
    },
    sessionsList: {
      gap: spacing.md,
    },
    sessionCard: {
      padding: 0,
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    sessionHeaderPressable: {
      padding: spacing.md,
    },
    sessionTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    sessionDateGroup: {
      flex: 1,
      flexShrink: 1,
      gap: 2,
    },
    timelineSessionMetricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radii.sm,
    },
    summaryMetricItem: {
      alignItems: 'center',
    },
    toggleIndicator: {
      fontWeight: '700',
      fontSize: 12,
    },
    setsTable: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: spacing.md,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    tableHeaderRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    colSet: {
      width: 48,
    },
    colWeight: {
      flex: 1,
      fontWeight: '700',
    },
    colReps: {
      width: 60,
      textAlign: 'center',
    },
    tableSetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    setNumberBadge: {
      width: 24,
      height: 24,
      borderRadius: radii.full,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
