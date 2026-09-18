import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../../src/components/ui';
import { workoutRepository, WorkoutSession } from '../../../src/features/workout';
import { colors, spacing, radii } from '../../../src/constants/theme';

export default function WorkoutHistoryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWorkoutDetail() {
      setLoading(true);
      try {
        if (id) {
          const found = await workoutRepository.getCompletedWorkoutById(id);
          setWorkout(found);
        }
      } catch {
        setWorkout(null);
      } finally {
        setLoading(false);
      }
    }

    void loadWorkoutDetail();
  }, [id]);

  const formatCompletedDate = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    const d = new Date(dateStr);
    return d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
    if (mins > 0) return `${mins} min`;
    return `${secs}s`;
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.dark.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!workout) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <Text variant="titleMedium" color="primary">
            Workout session not found.
          </Text>
          <Button
            testID="history-not-found-back-button"
            title="Back to History"
            onPress={() => router.replace('/workout/history' as any)}
            variant="primary"
            size="md"
            style={styles.notFoundButton}
          />
        </View>
      </ScreenContainer>
    );
  }

  const displayExercises = [...workout.exercises]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((ex) => ex.actualSets && ex.actualSets.length > 0);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Navigation & Header */}
        <View style={styles.header}>
          <Pressable
            testID="history-detail-back-button"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="bodyBold" color="primary">
              ‹ History
            </Text>
          </Pressable>

          <View style={styles.titleArea}>
            <View style={styles.historyBadge}>
              <Text variant="caption" color="primary" style={styles.historyBadgeText}>
                COMPLETED WORKOUT LOG (READ-ONLY)
              </Text>
            </View>
            <Text variant="display" color="primary" testID="history-detail-name">
              {workout.name || 'Completed Workout'}
            </Text>
            <Text variant="body" color="secondary" testID="history-detail-date">
              {formatCompletedDate(workout.finishedAt || workout.startedAt)}
            </Text>
          </View>
        </View>

        {/* High-level Summary Metrics Cards Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <Card style={styles.metricCard}>
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                DURATION
              </Text>
              <Text
                variant="numeric"
                color="primary"
                testID="history-detail-duration"
              >
                {formatDuration(workout.totalDuration)}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                TOTAL VOLUME
              </Text>
              <Text
                variant="numeric"
                color="primary"
                testID="history-detail-volume"
              >
                {(workout.totalVolume ?? 0).toLocaleString()} kg
              </Text>
            </Card>
          </View>

          <View style={styles.metricsRow}>
            <Card style={styles.metricCard}>
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                EXERCISES
              </Text>
              <Text
                variant="numeric"
                color="primary"
                testID="history-detail-exercises-count"
              >
                {displayExercises.length}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                COMPLETED SETS
              </Text>
              <Text
                variant="numeric"
                color="primary"
                testID="history-detail-sets-count"
              >
                {workout.completedSetsCount ?? 0}
              </Text>
            </Card>
          </View>
        </View>

        {/* Completed Exercises & Logged Sets Breakdown */}
        <View style={styles.breakdownSection}>
          <Text variant="titleMedium" color="primary" style={styles.sectionHeader}>
            Exercise Performance
          </Text>

          {displayExercises.map((ex) => {
            const finishedSets = ex.actualSets.filter((s) => s.completed);
            const setsToRender = finishedSets.length > 0 ? finishedSets : ex.actualSets;

            return (
              <Card
                key={ex.exerciseId}
                style={styles.exerciseCard}
                testID={`history-exercise-${ex.exerciseId}`}
              >
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseTitleGroup}>
                    <Text variant="titleMedium" color="primary" style={styles.exerciseName}>
                      {ex.exerciseName || 'Exercise'}
                    </Text>
                    {ex.categoryName ? (
                      <Text variant="caption" color="muted">
                        {ex.categoryName}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.setsBadge}>
                    <Text variant="caption" color="primary" style={styles.setsBadgeText}>
                      {finishedSets.length} sets
                    </Text>
                  </View>
                </View>

                {/* Read-Only Sets List */}
                <View style={styles.setsList}>
                  {setsToRender.map((s, index) => {
                    const isLastSet = index === setsToRender.length - 1;
                    return (
                      <View
                        key={s.id}
                        style={[styles.setRow, isLastSet && styles.lastSetRow]}
                        testID={`history-set-${ex.exerciseId}-${s.setNumber}`}
                      >
                        <View style={styles.setIndexBadge}>
                          <Text variant="caption" color="primary" style={styles.setIndexText}>
                            SET {s.setNumber}
                          </Text>
                        </View>

                        <View style={styles.setMetricsGroup}>
                          <Text variant="bodyBold" color="primary">
                            {s.weight > 0 ? `${s.weight} kg` : 'Bodyweight'} × {s.reps} reps
                          </Text>
                          <Text variant="caption" color="muted">
                            RIR {s.rir}
                          </Text>
                        </View>

                        {s.notes ? (
                          <Text variant="caption" color="secondary" style={styles.setNotesText}>
                            {`"${s.notes}"`}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  backButton: {
    minHeight: 40,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  titleArea: {
    gap: spacing.xs,
  },
  historyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dark.surfaceElevated,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  historyBadgeText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricsGrid: {
    gap: spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    gap: 4,
    backgroundColor: colors.dark.surfaceElevated,
  },
  metricLabel: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  breakdownSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  exerciseCard: {
    backgroundColor: colors.dark.surfaceElevated,
    padding: spacing.md,
    gap: spacing.sm,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
    paddingBottom: spacing.xs,
  },
  exerciseTitleGroup: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontWeight: '700',
  },
  setsBadge: {
    backgroundColor: colors.dark.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  setsBadgeText: {
    fontWeight: '700',
  },
  setsList: {
    gap: spacing.xs,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
    flexWrap: 'wrap',
  },
  lastSetRow: {
    borderBottomWidth: 0,
  },
  setIndexBadge: {
    minWidth: 44,
  },
  setIndexText: {
    fontWeight: '800',
  },
  setMetricsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setNotesText: {
    fontStyle: 'italic',
    flexBasis: '100%',
    marginTop: 2,
    paddingLeft: 44,
  },
  notFoundButton: {
    minWidth: 160,
  },
});
