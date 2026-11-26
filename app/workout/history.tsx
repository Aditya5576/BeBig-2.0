import { useAppTheme } from '../../src/features/theme';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  SectionList,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import {
  ScreenContainer,
  useBottomContentInset,
  Text,
  Button,
  Card,
  Icon,
  SyncStatusChip,
} from '../../src/components/ui';
import {
  workoutRepository,
  WorkoutSession,
  formatDuration,
  getMonthGroupKey,
  getMonthGroupLabel,
  calculateWorkoutTreadmillDuration,
  formatTreadmillDuration,
} from '../../src/features/workout';
import { spacing, radii } from '../../src/constants/theme';
import { useEntitySyncStatus } from '../../src/services/sync';

function HistorySyncStatus({ workoutId }: { workoutId: string }) {
  const status = useEntitySyncStatus('workout', workoutId);
  return <SyncStatusChip status={status} />;
}

const useFocusEffect = routerFocusEffect || React.useEffect;

interface MonthSection {
  key: string;
  label: string;
  data: WorkoutSession[];
}

interface HistoryWorkoutRowProps {
  item: WorkoutSession;
  isEditing: boolean;
  editWorkoutName: string;
  onEditWorkoutNameChange: (text: string) => void;
  onPressItem: (id: string) => void;
  onStartRename: (item: WorkoutSession) => void;
  onSaveRename: (id: string) => void;
  onCancelRename: () => void;
  onDelete: (item: WorkoutSession) => void;
  formatCompletedDate: (dateStr?: string) => string;
  colors: any;
  styles: any;
}

const HistoryWorkoutRow = React.memo(function HistoryWorkoutRow({
  item,
  isEditing,
  editWorkoutName,
  onEditWorkoutNameChange,
  onPressItem,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
  formatCompletedDate,
  colors,
  styles,
}: HistoryWorkoutRowProps) {
  const exercisesSnippet = item.exercises
    .map((e) => e.exerciseName)
    .slice(0, 3)
    .join(' • ');

  const notesCount = (item.exercises || []).reduce(
    (acc, ex) =>
      acc +
      (ex.actualSets
        ? ex.actualSets.filter((s) => typeof s.notes === 'string' && s.notes.trim().length > 0).length
        : 0),
    0
  );

  const tmDuration = calculateWorkoutTreadmillDuration(item);

  return (
    <Card style={[styles.workoutCard, { marginBottom: spacing.md }]} testID={`history-card-${item.id}`}>
      <Pressable
        testID={`history-item-${item.id}`}
        onPress={() => {
          if (isEditing) return;
          onPressItem(item.id);
        }}
        style={styles.cardPressable}
      >
        <View style={styles.cardHeader}>
          {isEditing ? (
            <View style={styles.editModeContainer}>
              <TextInput
                style={styles.editInput}
                value={editWorkoutName}
                onChangeText={onEditWorkoutNameChange}
                autoFocus
                placeholder="Workout Name"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.editActions}>
                <Button
                  title="Cancel"
                  onPress={onCancelRename}
                  variant="outline"
                  size="sm"
                />
                <Button
                  title="Save"
                  onPress={() => onSaveRename(item.id)}
                  variant="primary"
                  size="sm"
                />
              </View>
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text
                  variant="titleMedium"
                  color="primary"
                  style={[styles.workoutName, { flexShrink: 1 }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <HistorySyncStatus workoutId={item.id} />
                {notesCount > 0 && (
                  <View style={styles.historyCardNoteBadge} testID={`history-card-notes-indicator-${item.id}`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Icon name="edit" size={10} color={colors.primary} />
                      <Text style={styles.historyCardNoteText}>
                        {notesCount} {notesCount === 1 ? 'note' : 'notes'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <Text variant="caption" color="muted">
                {formatCompletedDate(item.finishedAt || item.startedAt)}
              </Text>
            </View>
          )}
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              DURATION
            </Text>
            <Text
              variant="bodyBold"
              color="primary"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.metricNumericValue}
            >
              {formatDuration(item.totalDuration)}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            {(item.totalVolume ?? 0) === 0 && tmDuration > 0 ? (
              <>
                <Text variant="caption" color="muted" style={styles.metricLabel}>
                  CARDIO
                </Text>
                <Text
                  variant="bodyBold"
                  color="accent"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.metricNumericValue}
                >
                  {formatTreadmillDuration(tmDuration)}
                </Text>
              </>
            ) : (
              <>
                <Text variant="caption" color="muted" style={styles.metricLabel}>
                  VOLUME
                </Text>
                <Text
                  variant="bodyBold"
                  color="accent"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.metricNumericValue}
                >
                  {(item.totalVolume ?? 0).toLocaleString()} kg
                </Text>
              </>
            )}
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              SETS
            </Text>
            <Text
              variant="bodyBold"
              color="primary"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.metricNumericValue}
            >
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
            onPress={() => onStartRename(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.renameButton}
          >
            <Text variant="caption" style={styles.renameButtonText}>
              Rename
            </Text>
          </Pressable>

          <Pressable
            testID={`delete-workout-${item.id}`}
            onPress={() => onDelete(item)}
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
          onPress={() => onPressItem(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.viewDetailsButton}
        >
          <Text variant="caption" style={styles.viewDetailsText}>
            View Details
          </Text>
          <Icon name="chevronRight" size={12} color={colors.primary} />
        </Pressable>
      </View>
    </Card>
  );
});

export default function WorkoutHistoryScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useBottomContentInset();

  const router = useRouter();

  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editWorkoutName, setEditWorkoutName] = useState('');

  const loadHistory = useCallback(async (isInitial = false) => {
    if (isInitial && workouts.length === 0) {
      setLoading(true);
    }
    try {
      const data = await workoutRepository.getCompletedWorkouts();
      setWorkouts(data);
    } catch {
      // Keep visible scoped snapshot during refresh if already loaded
      setWorkouts((prev) => (prev.length > 0 ? prev : []));
    } finally {
      setLoading(false);
    }
  }, [workouts.length]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory(false);
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

  const monthSections = useMemo<MonthSection[]>(() => {
    if (workouts.length === 0) return [];

    // Ensure workouts are sorted newest -> oldest
    const sortedWorkouts = [...workouts].sort((a, b) => {
      const timeA = new Date(a.finishedAt || a.startedAt).getTime();
      const timeB = new Date(b.finishedAt || b.startedAt).getTime();
      return timeB - timeA;
    });

    const groupMap = new Map<string, MonthSection>();
    const sections: MonthSection[] = [];

    for (const w of sortedWorkouts) {
      const dateStr = w.finishedAt || w.startedAt;
      const key = getMonthGroupKey(dateStr);
      const label = getMonthGroupLabel(dateStr);

      let section = groupMap.get(key);
      if (!section) {
        section = { key, label, data: [] };
        groupMap.set(key, section);
        sections.push(section);
      }
      section.data.push(w);
    }

    return sections;
  }, [workouts]);

  const handlePressWorkout = useCallback(
    (id: string) => {
      router.push(`/workout/history/${id}` as any);
    },
    [router]
  );

  const handleStartRename = useCallback((item: WorkoutSession) => {
    setEditingWorkoutId(item.id);
    setEditWorkoutName(item.name);
  }, []);

  const handleCancelRename = useCallback(() => {
    setEditingWorkoutId(null);
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: MonthSection }) => (
      <View
        style={[styles.monthHeader, { marginTop: spacing.md, marginBottom: spacing.sm }]}
        testID={`history-month-header-${section.key}`}
      >
        <Text variant="titleMedium" color="primary" style={styles.monthTitle}>
          {section.label}
        </Text>
        <View style={styles.monthBadge}>
          <Text variant="caption" color="secondary" style={styles.monthBadgeText}>
            {section.data.length} {section.data.length === 1 ? 'workout' : 'workouts'}
          </Text>
        </View>
      </View>
    ),
    [styles]
  );

  const renderWorkoutItem = useCallback(
    ({ item }: { item: WorkoutSession }) => (
      <HistoryWorkoutRow
        item={item}
        isEditing={editingWorkoutId === item.id}
        editWorkoutName={editWorkoutName}
        onEditWorkoutNameChange={setEditWorkoutName}
        onPressItem={handlePressWorkout}
        onStartRename={handleStartRename}
        onSaveRename={handleRenameWorkout}
        onCancelRename={handleCancelRename}
        onDelete={handleDeleteWorkout}
        formatCompletedDate={formatCompletedDate}
        colors={colors}
        styles={styles}
      />
    ),
    [
      editingWorkoutId,
      editWorkoutName,
      handlePressWorkout,
      handleStartRename,
      handleCancelRename,
      colors,
      styles,
    ]
  );

  const listHeader = useMemo(
    () => (
      <View style={{ gap: spacing.lg, marginBottom: spacing.sm }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            testID="workout-history-back-button"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <View style={styles.backButtonRow}>
              <Icon name="chevronLeft" size={18} color={colors.accent} />
              <Text variant="bodyBold" color="accent" style={styles.backButtonText}>
                Back
              </Text>
            </View>
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

        {loading && workouts.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : workouts.length === 0 ? (
          /* Empty State */
          <Card style={styles.emptyCard} testID="history-empty-state">
            <View style={styles.emptyIconContainer}>
              <Icon name="workout" size={32} color={colors.textMuted} />
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
          /* Weekly Performance Navigation Banner */
          <Pressable
            testID="history-weekly-performance-card"
            onPress={() => router.push('/workout/progress/weekly' as any)}
            style={styles.weeklyPerformanceBanner}
            accessibilityRole="button"
            accessibilityLabel="View Weekly Performance and progressive overload"
          >
            <View style={styles.weeklyPerformanceBannerLeft}>
              <View style={styles.weeklyPerformanceIconWrap}>
                <Icon name="chart" size={18} color={colors.primary} />
              </View>
              <View style={styles.weeklyPerformanceTextGroup}>
                <View style={styles.weeklyPerformanceBadgeRow}>
                  <Text variant="titleMedium" color="primary" style={styles.weeklyPerformanceTitle}>
                    Weekly Performance
                  </Text>
                </View>
                <Text variant="caption" color="secondary" style={styles.weeklyPerformanceSubtitle}>
                  Review your weekly training and progressive overload.
                </Text>
              </View>
            </View>
            <Icon name="chevronRight" size={18} color={colors.primary} />
          </Pressable>
        )}
      </View>
    ),
    [styles, colors, loading, workouts.length, router]
  );

  return (
    <ScreenContainer>
      <SectionList
        testID="history-grouped-list"
        sections={loading && workouts.length === 0 ? [] : monthSections}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkoutItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={listHeader}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(bottomInset, spacing.xxl) },
        ]}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
  backButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {},
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
    backgroundColor: colors.surfaceElevated,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
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
    borderBottomColor: colors.borderLight,
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
    backgroundColor: colors.surfaceElevated,
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
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
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
    backgroundColor: colors.borderLight,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricNumericValue: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  deleteButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 12,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    minHeight: 36,
    justifyContent: 'center',
  },
  viewDetailsText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  editModeContainer: {
    flex: 1,
    gap: spacing.sm,
    width: '100%',
  },
  editInput: {
    backgroundColor: colors.surface,
    color: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  historyCardNoteBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs || 4,
    alignSelf: 'center',
  },
  historyCardNoteText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  weeklyPerformanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  weeklyPerformanceBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
  },
  weeklyPerformanceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyPerformanceTextGroup: {
    flex: 1,
    gap: 2,
  },
  weeklyPerformanceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weeklyPerformanceTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  weeklyPerformanceSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  weeklyPerformanceChevron: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
});

