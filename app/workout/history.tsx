import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import {
  workoutRepository,
  WorkoutSession,
  formatDuration,
  getMonthGroupKey,
  getMonthGroupLabel,
} from '../../src/features/workout';
import { colors, spacing, radii } from '../../src/constants/theme';

const useFocusEffect = routerFocusEffect || React.useEffect;

interface MonthGroup {
  key: string;
  label: string;
  workouts: WorkoutSession[];
}

export default function WorkoutHistoryScreen() {
  const router = useRouter();

  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editWorkoutName, setEditWorkoutName] = useState('');

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

  const handleDeleteWorkout = (workout: WorkoutSession) => {
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workout.name}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await workoutRepository.deleteCompletedWorkout(workout.id);
              await loadHistory();
            } catch {
              Alert.alert('Error', 'Failed to delete workout. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleRenameWorkout = async (workoutId: string) => {
    if (!editWorkoutName.trim()) {
      Alert.alert('Invalid Name', 'Workout name cannot be empty.');
      return;
    }
    try {
      await workoutRepository.updateCompletedWorkoutName(workoutId, editWorkoutName);
      await loadHistory();
      setEditingWorkoutId(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to rename workout.');
    }
  };

  const monthGroups = useMemo<MonthGroup[]>(() => {
    if (workouts.length === 0) return [];

    // Ensure workouts are sorted newest -> oldest
    const sortedWorkouts = [...workouts].sort((a, b) => {
      const timeA = new Date(a.finishedAt || a.startedAt).getTime();
      const timeB = new Date(b.finishedAt || b.startedAt).getTime();
      return timeB - timeA;
    });

    const groupMap = new Map<string, MonthGroup>();
    const groups: MonthGroup[] = [];

    for (const w of sortedWorkouts) {
      const dateStr = w.finishedAt || w.startedAt;
      const key = getMonthGroupKey(dateStr);
      const label = getMonthGroupLabel(dateStr);

      let group = groupMap.get(key);
      if (!group) {
        group = { key, label, workouts: [] };
        groupMap.set(key, group);
        groups.push(group);
      }
      group.workouts.push(w);
    }

    return groups;
  }, [workouts]);

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
          /* Month-Grouped Workouts List */
          <View style={styles.listContainer} testID="history-grouped-list">
            {monthGroups.map((group) => (
              <View
                key={group.key}
                style={styles.monthSection}
                testID={`history-month-section-${group.key}`}
              >
                {/* Month Group Header */}
                <View style={styles.monthHeader} testID={`history-month-header-${group.key}`}>
                  <Text variant="titleMedium" color="primary" style={styles.monthTitle}>
                    {group.label}
                  </Text>
                  <View style={styles.monthBadge}>
                    <Text variant="caption" color="secondary" style={styles.monthBadgeText}>
                      {group.workouts.length} {group.workouts.length === 1 ? 'workout' : 'workouts'}
                    </Text>
                  </View>
                </View>

                {/* Workouts in Month */}
                <View style={styles.monthCardsContainer}>
                  {group.workouts.map((item) => {
                    const exercisesSnippet = item.exercises
                      .map((e) => e.exerciseName)
                      .slice(0, 3)
                      .join(' • ');

                    return (
                      <Card key={item.id} style={styles.workoutCard} testID={`history-card-${item.id}`}>
                        <Pressable
                          testID={`history-item-${item.id}`}
                          onPress={() => {
                            if (editingWorkoutId === item.id) return;
                            router.push(`/workout/history/${item.id}` as any);
                          }}
                          style={styles.cardPressable}
                        >
                          <View style={styles.cardHeader}>
                            {editingWorkoutId === item.id ? (
                              <View style={styles.editModeContainer}>
                                <TextInput
                                  style={styles.editInput}
                                  value={editWorkoutName}
                                  onChangeText={setEditWorkoutName}
                                  autoFocus
                                  placeholder="Workout Name"
                                  placeholderTextColor={colors.dark.textMuted}
                                />
                                <View style={styles.editActions}>
                                  <Button
                                    title="Cancel"
                                    onPress={() => setEditingWorkoutId(null)}
                                    variant="outline"
                                    size="sm"
                                  />
                                  <Button
                                    title="Save"
                                    onPress={() => handleRenameWorkout(item.id)}
                                    variant="primary"
                                    size="sm"
                                  />
                                </View>
                              </View>
                            ) : (
                              <>
                                <Text
                                  variant="titleMedium"
                                  color="primary"
                                  style={styles.workoutName}
                                  numberOfLines={1}
                                >
                                  {item.name}
                                </Text>
                                <Text variant="caption" color="muted">
                                  {formatCompletedDate(item.finishedAt || item.startedAt)}
                                </Text>
                              </>
                            )}
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
                        </Pressable>

                        {/* Card Actions Row: Rename + Delete + View Details */}
                        <View style={styles.cardActionsRow}>
                          <View style={styles.leftActions}>
                            <Pressable
                              onPress={() => {
                                setEditingWorkoutId(item.id);
                                setEditWorkoutName(item.name);
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={styles.renameButton}
                            >
                              <Text variant="caption" style={styles.renameButtonText}>
                                Rename
                              </Text>
                            </Pressable>

                            <Pressable
                              testID={`delete-workout-${item.id}`}
                              onPress={() => handleDeleteWorkout(item)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={styles.deleteButton}
                              accessibilityLabel={`Delete ${item.name}`}
                              accessibilityRole="button"
                            >
                              <Text variant="caption" style={styles.deleteButtonText}>
                                Delete
                              </Text>
                            </Pressable>
                          </View>

                          <Pressable
                            onPress={() => router.push(`/workout/history/${item.id}` as any)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text variant="caption" color="accent" style={styles.viewDetailsText}>
                              View Details ›
                            </Text>
                          </Pressable>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </View>
            ))}
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
    gap: spacing.xl,
  },
  monthSection: {
    gap: spacing.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
    marginBottom: spacing.xs,
  },
  monthTitle: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  monthBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  monthBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  monthCardsContainer: {
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
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: spacing.sm,
    marginTop: 2,
  },
  leftActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  renameButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  renameButtonText: {
    color: colors.dark.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  deleteButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteButtonText: {
    color: colors.dark.error,
    fontWeight: '600',
    fontSize: 12,
  },
  viewDetailsText: {
    fontWeight: '700',
  },
  editModeContainer: {
    flex: 1,
    gap: spacing.sm,
    width: '100%',
  },
  editInput: {
    backgroundColor: colors.dark.surface,
    color: colors.dark.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});

