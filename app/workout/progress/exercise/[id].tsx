import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect as routerFocusEffect } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../../../src/components/ui';
import {
  workoutRepository,
  getExerciseHistory,
  ExerciseHistoryEntry,
  formatWorkoutDate,
  formatVolume,
} from '../../../../src/features/workout';
import { colors, spacing, radii } from '../../../../src/constants/theme';

const useFocusEffect = routerFocusEffect || React.useEffect;

export default function ExerciseProgressionScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();

  const [entries, setEntries] = useState<ExerciseHistoryEntry[]>([]);
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
      setLoading(true);
      void (async () => {
        try {
          const workouts = await workoutRepository.getCompletedWorkouts();
          if (!isMounted) return;
          const history = getExerciseHistory(workouts, id);
          setEntries(history);

          // If exercise name was not provided via params, deduce it from workouts
          if (!name) {
            for (const w of workouts) {
              const matched = w.exercises?.find((ex) => ex.exerciseId === id);
              if (matched && matched.exerciseName) {
                if (isMounted) setResolvedName(matched.exerciseName);
                break;
              }
            }
          }
        } catch {
          if (isMounted) setEntries([]);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
      return () => {
        isMounted = false;
      };
    }, [id, name]),
  );

  // Calculate summary metrics
  const summary = useMemo(() => {
    if (entries.length === 0) {
      return { allTimeMax: 0, totalVolume: 0, totalSessions: 0, recentDate: '—' };
    }

    const allTimeMax = entries.reduce(
      (max, e) => (e.maxWeight > max ? e.maxWeight : max),
      entries[0].maxWeight,
    );
    const totalVolume = entries.reduce((sum, e) => sum + e.volume, 0);
    // entries are sorted oldest -> newest, so the last item is the most recent
    const recentEntry = entries[entries.length - 1];

    return {
      allTimeMax,
      totalVolume,
      totalSessions: entries.length,
      recentDate: formatWorkoutDate(recentEntry.date),
    };
  }, [entries]);

  // Mark sessions where an all-time personal record was achieved
  const chronologicalSessions = useMemo(() => {
    let runningMax = 0;
    return entries.map((entry) => {
      const isPR = entry.maxWeight > runningMax;
      if (isPR) {
        runningMax = entry.maxWeight;
      }
      return {
        ...entry,
        isPR,
      };
    });
  }, [entries]);

  const toggleSession = (workoutId: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [workoutId]: !prev[workoutId],
    }));
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
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
                EXERCISE PROGRESSION LOG
              </Text>
            </View>
            <Text variant="display" color="primary" testID="progression-exercise-name">
              {resolvedName}
            </Text>
            <Text variant="body" color="secondary">
              Track your strength, volume, and rep progression across all logged sessions.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.dark.primary} />
          </View>
        ) : entries.length === 0 ? (
          /* Empty State */
          <Card style={styles.emptyCard} testID="progression-empty-state">
            <View style={styles.emptyIconContainer}>
              <Text variant="display" style={styles.emptyEmoji}>
                📈
              </Text>
            </View>
            <Text variant="titleLarge" color="primary" style={styles.emptyTitle}>
              No History Logged Yet
            </Text>
            <Text variant="body" color="secondary" style={styles.emptySubtitle}>
              Complete a workout containing this exercise to begin tracking your progression over
              time.
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
            {/* Summary Metrics Grid */}
            <View style={styles.summaryGrid}>
              <Card style={styles.summaryCard} testID="progression-card-max-weight">
                <Text variant="caption" color="muted" style={styles.summaryLabel}>
                  MAX WEIGHT
                </Text>
                <Text variant="titleLarge" color="accent" testID="progression-max-weight">
                  {summary.allTimeMax} kg
                </Text>
                <Text variant="caption" color="secondary">
                  All-time best
                </Text>
              </Card>

              <Card style={styles.summaryCard} testID="progression-card-sessions">
                <Text variant="caption" color="muted" style={styles.summaryLabel}>
                  SESSIONS
                </Text>
                <Text variant="titleLarge" color="primary" testID="progression-total-sessions">
                  {summary.totalSessions}
                </Text>
                <Text variant="caption" color="secondary">
                  Workouts logged
                </Text>
              </Card>

              <Card style={styles.summaryCard} testID="progression-card-volume">
                <Text variant="caption" color="muted" style={styles.summaryLabel}>
                  LIFETIME VOLUME
                </Text>
                <Text variant="titleMedium" color="primary" testID="progression-lifetime-volume" numberOfLines={1}>
                  {formatVolume(summary.totalVolume)}
                </Text>
                <Text variant="caption" color="secondary" testID="progression-recent-date" numberOfLines={1}>
                  Latest: {summary.recentDate}
                </Text>
              </Card>
            </View>

            {/* Progression History Timeline */}
            <View style={styles.timelineHeader}>
              <Text variant="titleMedium" color="primary">
                Chronological History ({chronologicalSessions.length})
              </Text>
              <Text variant="caption" color="muted">
                Oldest → Newest
              </Text>
            </View>

            <View style={styles.sessionsList} testID="progression-history-list">
              {chronologicalSessions.map((session, index) => {
                const isExpanded = !!expandedSessions[session.workoutId];

                return (
                  <Card
                    key={session.workoutId}
                    style={styles.sessionCard}
                    testID={`progression-session-card-${session.workoutId}`}
                  >
                    {/* Session Header / Summary */}
                    <Pressable
                      testID={`progression-toggle-sets-${session.workoutId}`}
                      onPress={() => toggleSession(session.workoutId)}
                      style={styles.sessionHeaderPressable}
                    >
                      <View style={styles.sessionTopRow}>
                        <View style={styles.sessionDateGroup}>
                          <Text variant="caption" color="muted">
                            SESSION #{index + 1}
                          </Text>
                          <Text
                            variant="titleMedium"
                            color="primary"
                            testID={`progression-session-date-${session.workoutId}`}
                          >
                            {formatWorkoutDate(session.date)}
                          </Text>
                          <Text variant="caption" color="secondary">
                            {session.workoutName}
                          </Text>
                        </View>

                        {session.isPR && (
                          <View
                            style={styles.prBadge}
                            testID={`progression-pr-badge-${session.workoutId}`}
                          >
                            <Text variant="caption" color="accent" style={styles.prBadgeText}>
                              🏆 NEW PR
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Performance Metrics Bar */}
                      <View style={styles.sessionMetricsRow}>
                        <View style={styles.metricItem}>
                          <Text variant="caption" color="muted">
                            TOP WEIGHT
                          </Text>
                          <Text
                            variant="bodyBold"
                            color="accent"
                            testID={`progression-session-max-weight-${session.workoutId}`}
                          >
                            {session.maxWeight} kg
                          </Text>
                        </View>

                        <View style={styles.metricItem}>
                          <Text variant="caption" color="muted">
                            TOTAL REPS
                          </Text>
                          <Text
                            variant="bodyBold"
                            color="primary"
                            testID={`progression-session-reps-${session.workoutId}`}
                          >
                            {session.totalReps}
                          </Text>
                        </View>

                        <View style={styles.metricItem}>
                          <Text variant="caption" color="muted">
                            VOLUME
                          </Text>
                          <Text
                            variant="bodyBold"
                            color="primary"
                            testID={`progression-session-volume-${session.workoutId}`}
                          >
                            {formatVolume(session.volume)}
                          </Text>
                        </View>

                        <View style={styles.metricItem}>
                          <Text variant="caption" color="muted">
                            SETS
                          </Text>
                          <Text variant="bodyBold" color="primary">
                            {session.sets.length}
                          </Text>
                        </View>

                        <Text variant="caption" color="accent" style={styles.toggleIndicator}>
                          {isExpanded ? 'Hide ▲' : 'Sets ▼'}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Expandable Set Breakdown */}
                    {isExpanded && (
                      <View
                        style={styles.setsTable}
                        testID={`progression-sets-table-${session.workoutId}`}
                      >
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
                          <Text variant="caption" color="muted" style={styles.colRir}>
                            RIR
                          </Text>
                        </View>

                        {session.sets.map((set) => (
                          <View
                            key={set.setNumber}
                            style={styles.tableSetRow}
                            testID={`progression-set-row-${session.workoutId}-${set.setNumber}`}
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
                            <Text variant="body" color="secondary" style={styles.colRir}>
                              {set.rir}
                            </Text>

                            {set.notes && (
                              <View
                                style={styles.notesRow}
                                testID={`progression-set-notes-${session.workoutId}-${set.setNumber}`}
                              >
                                <Text variant="caption" color="muted">
                                  📝 {set.notes}
                                </Text>
                              </View>
                            )}
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

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
    marginBottom: spacing.sm,
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
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.md,
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
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
    gap: 2,
  },
  prBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  prBadgeText: {
    color: '#F59E0B',
    fontWeight: '800',
    fontSize: 11,
  },
  sessionMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  metricItem: {
    alignItems: 'center',
  },
  toggleIndicator: {
    fontWeight: '700',
    fontSize: 12,
  },
  setsTable: {
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
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
  colRir: {
    width: 50,
    textAlign: 'right',
  },
  tableSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    flexWrap: 'wrap',
  },
  setNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesRow: {
    width: '100%',
    paddingTop: 4,
    paddingLeft: 28,
  },
});
