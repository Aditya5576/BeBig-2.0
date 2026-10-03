import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme';
import { Text, Card } from '../../components/ui';
import { spacing, radii } from '../../constants/theme';
import { WeeklyPerformanceSummary } from './weekly';

export interface WeeklyPerformanceCardProps {
  summary: WeeklyPerformanceSummary;
}

export function WeeklyPerformanceCard({ summary }: WeeklyPerformanceCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  if (!summary.hasCurrentWeekWorkouts) {
    return (
      <Card style={styles.container} testID="weekly-performance-card">
        <View style={styles.headerBlock}>
          <Text variant="titleMedium" color="primary" style={styles.title} testID="weekly-perf-title">
            Weekly Performance
          </Text>
          <Text variant="caption" color="muted" style={styles.subtitle}>
            {summary.currentWeek.label}
          </Text>
        </View>
        <Text variant="caption" color="secondary" style={styles.emptyNotice} testID="weekly-no-workouts-notice">
          No workouts recorded this week.
        </Text>
      </Card>
    );
  }

  const { activity, setChanges, exerciseChanges } = summary;
  const hasSetChanges =
    setChanges.weightIncreased > 0 ||
    setChanges.weightDecreased > 0 ||
    setChanges.repsIncreased > 0 ||
    setChanges.repsDecreased > 0 ||
    setChanges.newSets > 0 ||
    setChanges.removedSets > 0;

  return (
    <Card style={styles.container} testID="weekly-performance-card">
      {/* Header */}
      <View style={styles.headerBlock}>
        <Text variant="titleMedium" color="primary" style={styles.title} testID="weekly-perf-title">
          Weekly Performance
        </Text>
        <Text variant="caption" color="muted" style={styles.subtitle}>
          {summary.currentWeek.label} • Compared with previous week
        </Text>
      </View>

      {/* Summary Count Pills */}
      {!summary.hasHistoricalComparison ? (
        <View style={styles.noticeBox} testID="weekly-no-prev-comparison-notice">
          <Text variant="caption" color="secondary">
            No previous week available for comparison.
          </Text>
        </View>
      ) : (
        <View style={styles.summaryPillsRow} testID="weekly-summary-pills">
          {summary.summary.progressed > 0 && (
            <View style={styles.summaryPillGreen} testID="weekly-count-progressed">
              <Text variant="caption" style={{ color: '#10B981', fontWeight: '800' }}>
                {summary.summary.progressed} {summary.summary.progressed === 1 ? 'exercise' : 'exercises'} progressed
              </Text>
            </View>
          )}
          {summary.summary.maintained > 0 && (
            <View style={styles.summaryPillNeutral} testID="weekly-count-maintained">
              <Text variant="caption" color="primary" style={{ fontWeight: '800' }}>
                {summary.summary.maintained} {summary.summary.maintained === 1 ? 'exercise' : 'exercises'} maintained
              </Text>
            </View>
          )}
          {summary.summary.decreased > 0 && (
            <View style={styles.summaryPillRed} testID="weekly-count-decreased">
              <Text variant="caption" style={{ color: '#EF4444', fontWeight: '800' }}>
                {summary.summary.decreased} {summary.summary.decreased === 1 ? 'exercise' : 'exercises'} decreased
              </Text>
            </View>
          )}
          {summary.summary.mixed > 0 && (
            <View style={styles.summaryPillAmber} testID="weekly-count-mixed">
              <Text variant="caption" style={{ color: '#F59E0B', fontWeight: '800' }}>
                {summary.summary.mixed} {summary.summary.mixed === 1 ? 'exercise' : 'exercises'} mixed
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Workout Activity Overview */}
      <View style={styles.subSection} testID="weekly-activity-section">
        <Text variant="label" color="muted" style={styles.subSectionHeader}>
          WORKOUT ACTIVITY
        </Text>
        <View style={styles.activityStatsRow}>
          <View style={styles.activityStatItem} testID="weekly-activity-workouts">
            <Text variant="titleMedium" color="primary" style={styles.activityValue}>
              {activity.current.workouts}
            </Text>
            <Text variant="caption" color="muted">
              {activity.current.workouts === 1 ? 'Workout' : 'Workouts'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.activityStatItem} testID="weekly-activity-exercises">
            <Text variant="titleMedium" color="primary" style={styles.activityValue}>
              {activity.current.exercises}
            </Text>
            <Text variant="caption" color="muted">
              {activity.current.exercises === 1 ? 'Exercise' : 'Exercises'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.activityStatItem} testID="weekly-activity-sets">
            <Text variant="titleMedium" color="primary" style={styles.activityValue}>
              {activity.current.sets}
            </Text>
            <Text variant="caption" color="muted">
              Sets
            </Text>
          </View>
        </View>

        {activity.previous && (
          <Text variant="caption" color="secondary" style={styles.prevActivityNote} testID="weekly-prev-activity-note">
            Previous week: {activity.previous.workouts} {activity.previous.workouts === 1 ? 'workout' : 'workouts'} • {activity.previous.exercises} exercises • {activity.previous.sets} sets
          </Text>
        )}
      </View>

      {/* Set Changes Aggregation */}
      {summary.hasHistoricalComparison && hasSetChanges && (
        <View style={styles.subSection} testID="weekly-set-changes-section">
          <Text variant="label" color="muted" style={styles.subSectionHeader}>
            SET CHANGES
          </Text>
          <View style={styles.setChangesGrid}>
            {setChanges.weightIncreased > 0 && (
              <View style={styles.setChangeRow} testID="weekly-set-change-weight-inc">
                <Text variant="caption" style={{ color: '#10B981', fontWeight: '800' }}>
                  ↑ Weight increased
                </Text>
                <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>
                  {setChanges.weightIncreased} {setChanges.weightIncreased === 1 ? 'set' : 'sets'}
                </Text>
              </View>
            )}
            {setChanges.repsIncreased > 0 && (
              <View style={styles.setChangeRow} testID="weekly-set-change-reps-inc">
                <Text variant="caption" style={{ color: '#10B981', fontWeight: '800' }}>
                  ↑ Reps increased
                </Text>
                <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>
                  {setChanges.repsIncreased} {setChanges.repsIncreased === 1 ? 'set' : 'sets'}
                </Text>
              </View>
            )}
            {setChanges.weightDecreased > 0 && (
              <View style={styles.setChangeRow} testID="weekly-set-change-weight-dec">
                <Text variant="caption" style={{ color: '#EF4444', fontWeight: '800' }}>
                  ↓ Weight decreased
                </Text>
                <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>
                  {setChanges.weightDecreased} {setChanges.weightDecreased === 1 ? 'set' : 'sets'}
                </Text>
              </View>
            )}
            {setChanges.repsDecreased > 0 && (
              <View style={styles.setChangeRow} testID="weekly-set-change-reps-dec">
                <Text variant="caption" style={{ color: '#EF4444', fontWeight: '800' }}>
                  ↓ Reps decreased
                </Text>
                <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>
                  {setChanges.repsDecreased} {setChanges.repsDecreased === 1 ? 'set' : 'sets'}
                </Text>
              </View>
            )}
            {setChanges.newSets > 0 && (
              <View style={styles.setChangeRow} testID="weekly-set-change-new-sets">
                <Text variant="caption" style={{ color: '#3B82F6', fontWeight: '800' }}>
                  + New sets
                </Text>
                <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>
                  {setChanges.newSets}
                </Text>
              </View>
            )}
            {setChanges.removedSets > 0 && (
              <View style={styles.setChangeRow} testID="weekly-set-change-removed-sets">
                <Text variant="caption" style={{ color: '#9CA3AF', fontWeight: '800' }}>
                  - Removed sets
                </Text>
                <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>
                  {setChanges.removedSets}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Exercise Changes List */}
      {exerciseChanges.length > 0 && (
        <View style={styles.subSection} testID="weekly-exercise-changes-section">
          <Text variant="label" color="muted" style={styles.subSectionHeader}>
            EXERCISE BREAKDOWN
          </Text>

          <View style={styles.exerciseList}>
            {exerciseChanges.map((ex) => (
              <View key={ex.exerciseId} style={styles.exerciseCard} testID={`weekly-exercise-${ex.exerciseId}`}>
                <View style={styles.exerciseHeader}>
                  <Text variant="titleMedium" color="primary" style={styles.exerciseName}>
                    {ex.exerciseName}
                  </Text>
                  <Pressable
                    testID={`weekly-view-progression-${ex.exerciseId}`}
                    onPress={() =>
                      router.push({
                        pathname: '/workout/progress/exercise/[id]',
                        params: { id: ex.exerciseId, name: ex.exerciseName },
                      } as any)
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.viewProgressionLink}
                  >
                    <Text variant="caption" color="accent" style={styles.viewProgressionText}>
                      View Exercise Progression →
                    </Text>
                  </Pressable>
                </View>

                {ex.status === 'first_time' ? (
                  <Text variant="caption" color="secondary" style={{ marginTop: 4 }} testID={`weekly-first-record-${ex.exerciseId}`}>
                    First recorded workout for this exercise
                  </Text>
                ) : (
                  <View style={styles.setCompsList}>
                    {ex.comparisons.map((comp) => (
                      <View key={comp.setNumber} style={styles.setCompRow} testID={`weekly-set-row-${ex.exerciseId}-${comp.setNumber}`}>
                        <View style={styles.setNumberBadge}>
                          <Text variant="caption" color="primary" style={{ fontSize: 9, fontWeight: '800' }}>
                            SET {comp.setNumber}
                          </Text>
                        </View>

                        <View style={styles.setValuesBlock}>
                          {comp.status === 'new_set' ? (
                            <Text variant="bodyBold" color="primary" style={{ fontSize: 13 }}>
                              {comp.currentSet ? `${comp.currentSet.weight} kg × ${comp.currentSet.reps}` : '—'}
                            </Text>
                          ) : comp.status === 'removed_set' ? (
                            <Text variant="body" color="muted" style={{ fontSize: 13, textDecorationLine: 'line-through' }}>
                              {comp.previousSet ? `${comp.previousSet.weight} kg × ${comp.previousSet.reps}` : '—'}
                            </Text>
                          ) : (
                            <Text variant="body" color="secondary" style={{ fontSize: 13 }}>
                              <Text style={{ textDecorationLine: 'line-through', opacity: 0.7 }}>
                                {comp.previousSet ? `${comp.previousSet.weight} kg × ${comp.previousSet.reps}` : '—'}
                              </Text>
                              {' → '}
                              <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                                {comp.currentSet ? `${comp.currentSet.weight} kg × ${comp.currentSet.reps}` : '—'}
                              </Text>
                            </Text>
                          )}
                        </View>

                        <View
                          style={[
                            styles.deltaBadge,
                            comp.status === 'increased' && styles.deltaGreen,
                            comp.status === 'decreased' && styles.deltaRed,
                            comp.status === 'new_set' && styles.deltaBlue,
                            comp.status === 'removed_set' && styles.deltaMuted,
                          ]}
                        >
                          <Text
                            variant="caption"
                            style={[
                              styles.deltaText,
                              comp.status === 'increased' && { color: '#10B981' },
                              comp.status === 'decreased' && { color: '#EF4444' },
                              comp.status === 'new_set' && { color: '#3B82F6' },
                              comp.status === 'removed_set' && { color: '#9CA3AF' },
                              comp.status === 'no_change' && { color: colors.textMuted },
                            ]}
                            testID={`weekly-set-delta-${ex.exerciseId}-${comp.setNumber}`}
                          >
                            {comp.displayText}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderLight,
    },
    headerBlock: {
      gap: 2,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
    },
    subtitle: {
      fontSize: 12,
    },
    emptyNotice: {
      marginVertical: spacing.xs,
    },
    noticeBox: {
      padding: spacing.sm,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: radii.xs || 4,
    },
    summaryPillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    summaryPillGreen: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: radii.full,
    },
    summaryPillNeutral: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: radii.full,
    },
    summaryPillRed: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: radii.full,
    },
    summaryPillAmber: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: radii.full,
    },
    subSection: {
      gap: spacing.xs + 2,
    },
    subSectionHeader: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    activityStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: radii.xs || 6,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    activityStatItem: {
      alignItems: 'center',
      gap: 2,
      flex: 1,
    },
    activityValue: {
      fontSize: 18,
      fontWeight: '800',
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    prevActivityNote: {
      fontSize: 11,
      marginTop: 2,
    },
    setChangesGrid: {
      gap: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: radii.xs || 6,
      padding: spacing.sm,
    },
    setChangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    exerciseList: {
      gap: spacing.sm,
    },
    exerciseCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: radii.xs || 6,
      padding: spacing.sm + 2,
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    exerciseHeader: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 2,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.06)',
      paddingBottom: spacing.xs,
    },
    exerciseName: {
      fontSize: 14,
      fontWeight: '800',
      width: '100%',
    },
    viewProgressionLink: {
      alignSelf: 'flex-start',
    },
    viewProgressionText: {
      fontSize: 11,
      fontWeight: '700',
    },
    setCompsList: {
      gap: 4,
      marginTop: 2,
    },
    setCompRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 4,
      borderRadius: 4,
    },
    setNumberBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 2,
    },
    setValuesBlock: {
      flex: 1,
      paddingHorizontal: spacing.xs,
    },
    deltaBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.full,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    deltaGreen: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    deltaRed: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    deltaBlue: {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
    },
    deltaMuted: {
      backgroundColor: 'rgba(156, 163, 175, 0.15)',
    },
    deltaText: {
      fontSize: 10,
      fontWeight: '800',
    },
  });
