import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { workoutRepository, WorkoutSession } from '../../src/features/workout';
import { colors, spacing, radii } from '../../src/constants/theme';

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      try {
        if (id) {
          const found = await workoutRepository.getCompletedWorkoutById(id);
          if (found) {
            setWorkout(found);
            return;
          }
        }
        // Fallback to most recent completed workout
        const completed = await workoutRepository.getCompletedWorkouts();
        if (completed.length > 0) {
          setWorkout(completed[0]);
        }
      } catch {
        setWorkout(null);
      } finally {
        setLoading(false);
      }
    }

    void loadSummary();
  }, [id]);

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
    if (mins > 0) return `${mins} min`;
    return `${secs}s`;
  };

  const formatVolume = (vol?: number) => {
    if (!vol || vol <= 0) return '0 kg';
    return `${vol.toLocaleString()} kg`;
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
            Workout summary not found.
          </Text>
          <Button
            testID="summary-done-button"
            title="Back to Home"
            onPress={() => router.replace('/home' as any)}
            variant="primary"
            size="md"
            style={styles.backHomeButton}
          />
        </View>
      </ScreenContainer>
    );
  }

  const formatCompletedDate = (dateStr?: string) => {
    if (!dateStr) return 'Today';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return 'Today';
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const completedExercises = workout.exercises.filter(
    (ex) => ex.actualSets && ex.actualSets.some((s) => s.completed),
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.trophyBadge}>
            <Text variant="caption" color="accent" style={styles.trophyBadgeText}>
              WORKOUT COMPLETE
            </Text>
          </View>
          <Text variant="display" color="primary" testID="workout-summary-title">
            Great Work! 🎉
          </Text>
          <Text variant="body" color="secondary">
            {workout.name} • Completed {formatCompletedDate(workout.finishedAt)}
          </Text>
        </View>

        {/* Highlight Metrics Cards Grid */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              DURATION
            </Text>
            <Text
              variant="titleLarge"
              color="primary"
              testID="summary-duration"
              style={styles.metricValue}
            >
              {formatDuration(workout.totalDuration)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              TOTAL VOLUME
            </Text>
            <Text
              variant="titleLarge"
              color="accent"
              testID="summary-volume"
              style={styles.metricValue}
            >
              {formatVolume(workout.totalVolume)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              EXERCISES
            </Text>
            <Text
              variant="titleLarge"
              color="primary"
              testID="summary-exercises-count"
              style={styles.metricValue}
            >
              {completedExercises.length}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              SETS LOGGED
            </Text>
            <Text
              variant="titleLarge"
              color="primary"
              testID="summary-sets-count"
              style={styles.metricValue}
            >
              {workout.completedSetsCount ?? 0}
            </Text>
          </Card>
        </View>

        {/* Exercise Breakdown */}
        <View style={styles.breakdownSection}>
          <Text variant="titleMedium" color="primary" style={styles.breakdownTitle}>
            Session Details
          </Text>

          {completedExercises.map((ex) => {
            const finishedSets = ex.actualSets.filter((s) => s.completed);
            return (
              <Card key={ex.exerciseId} style={styles.exerciseCard}>
                <View style={styles.exerciseCardHeader}>
                  <Text variant="titleMedium" color="primary" style={styles.exName}>
                    {ex.exerciseName}
                  </Text>
                  <Text variant="caption" color="accent" style={styles.setCountBadge}>
                    {finishedSets.length} sets
                  </Text>
                </View>

                <View style={styles.setsList}>
                  {finishedSets.map((s) => (
                    <View key={s.id} style={styles.setDetailRow}>
                      <Text variant="caption" color="muted" style={styles.setIndex}>
                        SET {s.setNumber}
                      </Text>
                      <Text variant="bodyBold" color="primary" style={styles.setData}>
                        {s.weight > 0 ? `${s.weight} kg × ` : ''}
                        {s.reps} reps
                        {s.rir !== undefined ? ` (RIR ${s.rir})` : ''}
                      </Text>
                      {s.notes ? (
                        <Text variant="caption" color="secondary" style={styles.setNotes}>
                          {`"${s.notes}"`}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
        </View>

        {/* Done / Return Home Button */}
        <Button
          testID="summary-done-button"
          title="Done — Back to Home"
          onPress={() => router.replace('/home' as any)}
          variant="primary"
          size="lg"
          style={styles.doneButton}
        />
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
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  trophyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.dark.primary,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  trophyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    gap: 4,
    backgroundColor: colors.dark.surfaceElevated,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  breakdownSection: {
    gap: spacing.sm,
  },
  breakdownTitle: {
    marginBottom: spacing.xs,
  },
  exerciseCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
    paddingBottom: spacing.xs,
  },
  exName: {
    fontSize: 16,
    fontWeight: '700',
  },
  setCountBadge: {
    fontWeight: '700',
  },
  setsList: {
    gap: spacing.xs,
  },
  setDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  setIndex: {
    fontWeight: '800',
    minWidth: 44,
  },
  setData: {
    fontSize: 14,
  },
  setNotes: {
    fontStyle: 'italic',
  },
  doneButton: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
    minHeight: 52,
  },
  backHomeButton: {
    minWidth: 160,
  },
});
