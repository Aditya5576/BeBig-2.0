import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { workoutRepository, WorkoutSession } from '../../src/features/workout';
import { colors, spacing, radii } from '../../src/constants/theme';

const useFocusEffect = routerFocusEffect || React.useEffect;

export default function WorkoutHistoryScreen() {
  const router = useRouter();

  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workoutRepository.getCompletedWorkouts();
      setWorkouts(data);
    } catch {
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const formatCompletedDate = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return `Today • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString([], {
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

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            testID="workout-history-back-button"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="bodyBold" color="accent" style={styles.backButtonText}>
              ‹ Back
            </Text>
          </Pressable>

          <View style={styles.titleContainer}>
            <Text variant="display" color="primary" testID="workout-history-title">
              Workout History
            </Text>
            <Text variant="body" color="secondary">
              Browse your past completed sessions and volume logs.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.dark.primary} />
          </View>
        ) : workouts.length === 0 ? (
          /* Empty State */
          <Card style={styles.emptyCard} testID="history-empty-state">
            <View style={styles.emptyIconContainer}>
              <Text variant="display" style={styles.emptyEmoji}>
                🏋️‍♂️
              </Text>
            </View>
            <Text
              variant="titleLarge"
              color="primary"
              testID="no-workouts-yet-text"
              style={styles.emptyTitle}
            >
              No workouts yet
            </Text>
            <Text variant="body" color="secondary" style={styles.emptySubtitle}>
              Completed workouts will appear here with your duration, set counts, and volume
              history.
            </Text>
            <Button
              testID="history-start-workout-button"
              title="Start Workout"
              onPress={() => router.push('/workout/start' as any)}
              variant="primary"
              size="lg"
              style={styles.emptyButton}
            />
          </Card>
        ) : (
          /* Workouts List (Newest-first) */
          <View style={styles.listContainer}>
            {workouts.map((item) => {
              const exercisesSnippet = item.exercises
                .map((e) => e.exerciseName)
                .slice(0, 3)
                .join(' • ');

              return (
                <Card key={item.id} style={styles.workoutCard} testID={`history-card-${item.id}`}>
                  <Pressable
                    testID={`history-item-${item.id}`}
                    onPress={() => router.push(`/workout/history/${item.id}` as any)}
                    style={styles.cardPressable}
                  >
                    <View style={styles.cardHeader}>
                      <Text variant="titleMedium" color="primary" style={styles.workoutName}>
                        {item.name}
                      </Text>
                      <Text variant="caption" color="muted">
                        {formatCompletedDate(item.finishedAt || item.startedAt)}
                      </Text>
                    </View>

                    {/* Metrics Row */}
                    <View style={styles.metricsRow}>
                      <View style={styles.metricItem}>
                        <Text variant="caption" color="muted" style={styles.metricLabel}>
                          DURATION
                        </Text>
                        <Text variant="bodyBold" color="primary">
                          {formatDuration(item.totalDuration)}
                        </Text>
                      </View>

                      <View style={styles.metricDivider} />

                      <View style={styles.metricItem}>
                        <Text variant="caption" color="muted" style={styles.metricLabel}>
                          VOLUME
                        </Text>
                        <Text variant="bodyBold" color="accent">
                          {(item.totalVolume ?? 0).toLocaleString()} kg
                        </Text>
                      </View>

                      <View style={styles.metricDivider} />

                      <View style={styles.metricItem}>
                        <Text variant="caption" color="muted" style={styles.metricLabel}>
                          SETS
                        </Text>
                        <Text variant="bodyBold" color="primary">
                          {item.completedSetsCount ?? 0}
                        </Text>
                      </View>
                    </View>

                    {exercisesSnippet ? (
                      <Text
                        variant="caption"
                        color="secondary"
                        numberOfLines={1}
                        style={styles.exerciseList}
                      >
                        {exercisesSnippet}
                        {item.exercises.length > 3 ? '...' : ''}
                      </Text>
                    ) : null}

                    <View style={styles.detailsRow}>
                      <Text variant="caption" color="accent" style={styles.viewDetailsText}>
                        View Details ›
                      </Text>
                    </View>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}
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
  header: {
    gap: spacing.xs,
  },
  backButton: {
    minHeight: 40,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 17,
  },
  titleContainer: {
    gap: spacing.xs,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.dark.surfaceElevated,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyTitle: {
    textAlign: 'center',
    fontWeight: '700',
  },
  emptySubtitle: {
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: spacing.sm,
    minWidth: 180,
  },
  listContainer: {
    gap: spacing.md,
  },
  workoutCard: {
    backgroundColor: colors.dark.surfaceElevated,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardPressable: {
    gap: spacing.sm,
  },
  cardHeader: {
    gap: 2,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.dark.borderLight,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  exerciseList: {
    marginTop: 2,
  },
  detailsRow: {
    alignItems: 'flex-end',
    marginTop: 2,
  },
  viewDetailsText: {
    fontWeight: '700',
  },
});
