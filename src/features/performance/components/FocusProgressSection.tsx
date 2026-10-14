import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../theme';
import { Text, Card } from '../../../components/ui';
import { spacing, radii } from '../../../constants/theme';
import { WorkoutFocusSummary, FocusExerciseItem } from '../progressAnalytics';

export interface FocusProgressSectionProps {
  focuses: WorkoutFocusSummary[];
  allExercises: FocusExerciseItem[];
  initialFocusId?: string;
}

export function FocusProgressSection({
  focuses,
  allExercises,
  initialFocusId = 'all',
}: FocusProgressSectionProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  // Selected focus ID: 'all' or specific focus ID
  const [selectedFocusId, setSelectedFocusId] = useState<string>(initialFocusId);

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  if (!focuses || focuses.length === 0) {
    return (
      <Card style={styles.container} testID="focus-progress-section">
        <View style={styles.headerBlock}>
          <Text variant="label" color="muted" style={styles.sectionOverline}>
            WORKOUT FOCUS PROGRESSION
          </Text>
          <Text variant="titleMedium" color="primary" style={styles.sectionTitle} testID="focus-section-title">
            Progress by Workout Focus
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text variant="bodyBold" color="secondary" style={styles.emptyTitle}>
            No Workout Focuses Yet
          </Text>
          <Text variant="caption" color="muted" style={styles.emptySubtitle}>
            Complete your workouts to automatically cluster routines (e.g. Chest & Triceps, Legs) and track progressive overload.
          </Text>
        </View>
      </Card>
    );
  }

  const selectedFocus =
    selectedFocusId === 'all'
      ? null
      : focuses.find((f) => f.id === selectedFocusId) || null;

  const displayedExercises = selectedFocus ? selectedFocus.exercises : allExercises.slice(0, 10);

  const improvedTotal = selectedFocus
    ? selectedFocus.improvedCount
    : focuses.reduce((sum, f) => sum + f.improvedCount, 0);

  const maintainedTotal = selectedFocus
    ? selectedFocus.maintainedCount
    : focuses.reduce((sum, f) => sum + f.maintainedCount, 0);

  const decliningTotal = selectedFocus
    ? selectedFocus.decliningCount
    : focuses.reduce((sum, f) => sum + f.decliningCount, 0);

  const totalSessions = selectedFocus
    ? selectedFocus.workoutCount
    : focuses.reduce((sum, f) => sum + f.workoutCount, 0);

  const totalSets = selectedFocus
    ? selectedFocus.completedSets
    : focuses.reduce((sum, f) => sum + f.completedSets, 0);

  const totalVolume = selectedFocus
    ? selectedFocus.totalVolume
    : focuses.reduce((sum, f) => sum + f.totalVolume, 0);

  const isSingleSession = selectedFocus ? selectedFocus.workoutCount === 1 : totalSessions === 1;

  return (
    <Card style={styles.container} testID="focus-progress-section">
      {/* 1. Section Header */}
      <View style={styles.headerBlock}>
        <View style={styles.headerTitleRow}>
          <Text variant="label" color="muted" style={styles.sectionOverline}>
            WORKOUT FOCUS PROGRESSION
          </Text>
          <View style={styles.focusCountBadge}>
            <Text variant="caption" style={styles.focusCountBadgeText}>
              {focuses.length} {focuses.length === 1 ? 'Focus' : 'Focuses'}
            </Text>
          </View>
        </View>
        <Text variant="titleMedium" color="primary" style={styles.sectionTitle} testID="focus-section-title">
          Progress by Workout Focus
        </Text>
        <Text variant="caption" color="secondary" style={styles.sectionSubtitle}>
          Track progressive overload, rep deltas, and volume by training split.
        </Text>
      </View>

      {/* 2. Dynamic Focus Selector */}
      <View style={styles.selectorContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.focusPillsScroll}
          testID="focus-pills-scroll"
        >
          <Pressable
            testID="focus-pill-all"
            onPress={() => setSelectedFocusId('all')}
            style={[styles.focusPill, selectedFocusId === 'all' && styles.focusPillActive]}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text
              variant="caption"
              style={[
                styles.focusPillText,
                selectedFocusId === 'all' && styles.focusPillTextActive,
              ]}
            >
              All Focuses ({focuses.length})
            </Text>
          </Pressable>

          {focuses.map((f) => {
            const isActive = selectedFocusId === f.id;
            return (
              <Pressable
                key={f.id}
                testID={`focus-pill-${f.id}`}
                onPress={() => setSelectedFocusId(f.id)}
                style={[styles.focusPill, isActive && styles.focusPillActive]}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text
                  variant="caption"
                  style={[styles.focusPillText, isActive && styles.focusPillTextActive]}
                >
                  {f.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Selected Focus Summary Strip */}
      <View style={styles.focusSummaryStrip} testID="focus-summary-strip">
        <View style={styles.focusMetaHeader}>
          <Text variant="bodyBold" color="primary" style={styles.focusMetaTitle}>
            {selectedFocus ? selectedFocus.name : 'Combined Training Overload'}
          </Text>
          <Text variant="caption" color="muted" style={styles.focusMetaSubtitle}>
            {selectedFocus
              ? `${selectedFocus.workoutCount} ${selectedFocus.workoutCount === 1 ? 'session' : 'sessions'} logged`
              : `${allExercises.length} tracked exercises`}
          </Text>
        </View>

        {/* 3 Metric Tiles (Sessions, Sets, Volume) */}
        <View style={styles.summaryMetricsRow}>
          <View style={styles.summaryMetricTile}>
            <Text variant="caption" color="muted" style={styles.summaryMetricLabel}>
              SESSIONS
            </Text>
            <Text variant="bodyBold" color="primary" style={styles.summaryMetricValue}>
              {totalSessions}
            </Text>
          </View>

          <View style={styles.summaryMetricTile}>
            <Text variant="caption" color="muted" style={styles.summaryMetricLabel}>
              SETS
            </Text>
            <Text variant="bodyBold" color="primary" style={styles.summaryMetricValue}>
              {totalSets}
            </Text>
          </View>

          <View style={styles.summaryMetricTile}>
            <Text variant="caption" color="muted" style={styles.summaryMetricLabel}>
              VOLUME
            </Text>
            <Text variant="bodyBold" color="primary" style={styles.summaryMetricValue}>
              {totalVolume > 0
                ? totalVolume > 10000
                  ? `${(totalVolume / 1000).toFixed(1)} t`
                  : `${Math.round(totalVolume).toLocaleString()} kg`
                : 'Bodyweight'}
            </Text>
          </View>
        </View>

        {/* Progression Status Breakdown */}
        {isSingleSession ? (
          <View style={styles.baselineNoticeRow}>
            <Text variant="caption" color="secondary" style={styles.baselineNoticeText}>
              Baseline recorded • Complete another session to track overload
            </Text>
          </View>
        ) : (
          <View style={styles.statusPillsRow}>
            {improvedTotal > 0 && (
              <View style={styles.statusPillGreen} testID="focus-count-improved">
                <Text variant="caption" style={styles.statusPillGreenText}>
                  ↑ {improvedTotal} progressing
                </Text>
              </View>
            )}
            {maintainedTotal > 0 && (
              <View style={styles.statusPillNeutral} testID="focus-count-maintained">
                <Text variant="caption" color="secondary" style={styles.statusPillNeutralText}>
                  = {maintainedTotal} stable
                </Text>
              </View>
            )}
            {decliningTotal > 0 && (
              <View style={styles.statusPillRed} testID="focus-count-declining">
                <Text variant="caption" style={styles.statusPillRedText}>
                  ↓ {decliningTotal} declining
                </Text>
              </View>
            )}
            {improvedTotal === 0 && maintainedTotal === 0 && decliningTotal === 0 && (
              <View style={styles.statusPillNeutral}>
                <Text variant="caption" color="muted">
                  Baseline established
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 4. Exercise Progression Cards */}
      <View style={styles.exercisesList} testID="focus-exercises-list">
        {displayedExercises.length === 0 ? (
          <View style={styles.emptyExerciseBox}>
            <Text variant="caption" color="muted">
              No exercises logged for this focus yet.
            </Text>
          </View>
        ) : (
          displayedExercises.map((ex) => {
            const hasPrior = ex.status !== 'first_time' && ex.previousReps !== null;
            return (
              <View key={ex.exerciseId} style={styles.exerciseCard} testID={`focus-exercise-card-${ex.exerciseId}`}>
                {/* Exercise Header Row */}
                <View style={styles.exerciseCardHeader}>
                  <View style={styles.exerciseTitleWrap}>
                    <Text variant="bodyBold" color="primary" style={styles.exerciseNameText} numberOfLines={1}>
                      {ex.exerciseName}
                    </Text>
                    {ex.categoryName && (
                      <View style={styles.categoryBadge}>
                        <Text variant="caption" color="muted" style={styles.categoryBadgeText}>
                          {ex.categoryName}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Status Badge */}
                  <View
                    style={[
                      styles.statusBadge,
                      ex.status === 'improved' && styles.statusBadgeGreen,
                      ex.status === 'declining' && styles.statusBadgeRed,
                      ex.status === 'maintained' && styles.statusBadgeNeutral,
                      ex.status === 'first_time' && styles.statusBadgeMuted,
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={[
                        styles.statusBadgeText,
                        ex.status === 'improved' && styles.statusTextGreen,
                        ex.status === 'declining' && styles.statusTextRed,
                        ex.status === 'maintained' && styles.statusTextNeutral,
                        ex.status === 'first_time' && styles.statusTextMuted,
                      ]}
                    >
                      {ex.status === 'improved'
                        ? ex.weightDelta > 0
                          ? `↑ +${ex.weightDelta} kg`
                          : `↑ +${ex.repDelta} reps`
                        : ex.status === 'declining'
                        ? ex.weightDelta < 0
                          ? `↓ ${ex.weightDelta} kg`
                          : `↓ ${ex.repDelta} reps`
                        : ex.status === 'maintained'
                        ? '= Stable'
                        : 'Baseline'}
                    </Text>
                  </View>
                </View>

                {/* Performance & Comparison Row */}
                <View style={styles.cardContentRow}>
                  {/* Left: Metrics & Deltas */}
                  <View style={styles.metricsCol}>
                    <Text variant="bodyBold" color="primary" style={styles.currentPerformanceText}>
                      {ex.isBodyweight
                        ? `Bodyweight × ${ex.latestReps} reps`
                        : `${ex.latestWeight} kg × ${ex.latestReps} reps`}
                    </Text>
                    <Text variant="caption" color="muted" style={styles.comparisonSubtext}>
                      {hasPrior
                        ? ex.isBodyweight
                          ? `Prev: ${ex.previousReps} reps`
                          : `Prev: ${ex.previousWeight} kg × ${ex.previousReps} reps`
                        : 'Baseline session recorded'}
                    </Text>
                  </View>

                  {/* Right: Sparkline & Details Action */}
                  <View style={styles.actionsCol}>
                    {ex.sparkline.length > 1 && (
                      <View style={styles.miniSparkline}>
                        {ex.sparkline.map((pt, pIdx) => {
                          const maxVal = Math.max(
                            ...ex.sparkline.map((s) => (s.weight > 0 ? s.weight : s.reps)),
                            1
                          );
                          const currentVal = pt.weight > 0 ? pt.weight : pt.reps;
                          const heightPct = Math.max(25, Math.round((currentVal / maxVal) * 100));
                          const isLatest = pIdx === ex.sparkline.length - 1;

                          return (
                            <View key={pIdx} style={styles.sparkTrack}>
                              <View
                                style={[
                                  styles.sparkFill,
                                  { height: `${heightPct}%` },
                                  isLatest && styles.sparkFillLatest,
                                ]}
                              />
                            </View>
                          );
                        })}
                      </View>
                    )}

                    <Pressable
                      testID={`focus-drilldown-${ex.exerciseId}`}
                      onPress={() =>
                        router.push({
                          pathname: '/workout/progress/exercise/[id]',
                          params: { id: ex.exerciseId, name: ex.exerciseName },
                        } as any)
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.drilldownButton}
                    >
                      <Text variant="caption" style={styles.drilldownButtonText}>
                        Details →
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* 5. Recent Sessions Timeline for this Focus */}
      {selectedFocus && selectedFocus.recentSessions.length > 0 && (
        <View style={styles.timelineSection} testID="focus-timeline-section">
          <View style={styles.timelineHeaderBlock}>
            <Text variant="label" color="muted" style={styles.timelineHeader}>
              RECENT SESSIONS ({selectedFocus.recentSessions.length})
            </Text>
            <Text variant="caption" color="muted" style={styles.timelineSubtitle}>
              Comparing latest session with previous session
            </Text>
          </View>

          <View style={styles.timelineList}>
            {selectedFocus.recentSessions.map((s, idx) => (
              <View key={s.id} style={styles.timelineItem} testID={`focus-session-${s.id}`}>
                <View style={styles.timelineLeftCol}>
                  <View
                    style={[
                      styles.timelineMarkerDot,
                      idx === 0 && styles.timelineMarkerDotLatest,
                    ]}
                  />
                  <Text variant="caption" color="primary" style={styles.timelineDateText}>
                    {formatShortDate(s.date)}
                  </Text>
                  {idx === 0 && (
                    <View style={styles.latestTag}>
                      <Text variant="caption" style={styles.latestTagText}>
                        Latest
                      </Text>
                    </View>
                  )}
                  {idx === 1 && (
                    <View style={styles.previousTag}>
                      <Text variant="caption" style={styles.previousTagText}>
                        Previous
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.timelineRightCol}>
                  <Text variant="caption" color="secondary" style={styles.timelineMetricsText}>
                    {s.sets} sets
                    {s.durationSeconds ? ` • ${Math.round(s.durationSeconds / 60)} min` : ''}
                    {s.volume > 0 ? ` • ${Math.round(s.volume).toLocaleString()} kg` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => router.push('/workout/history' as any)}
            style={styles.historyLinkButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text variant="caption" style={styles.historyLinkText}>
              View Full Workout History →
            </Text>
          </Pressable>
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
      backgroundColor: colors.surfaceElevated || '#161922',
      borderColor: colors.borderLight || '#2A303C',
      borderRadius: radii.md,
    },
    headerBlock: {
      gap: 3,
    },
    headerTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionOverline: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    focusCountBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radii.full,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    focusCountBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary || '#94A3B8',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary || '#F8FAFC',
    },
    sectionSubtitle: {
      fontSize: 12,
      lineHeight: 16,
    },
    emptyContainer: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: 4,
    },
    emptyTitle: {
      fontSize: 14,
    },
    emptySubtitle: {
      fontSize: 12,
      textAlign: 'center',
      maxWidth: 280,
    },
    selectorContainer: {
      marginHorizontal: -spacing.md,
      paddingHorizontal: spacing.md,
    },
    focusPillsScroll: {
      gap: spacing.xs,
      paddingVertical: 2,
    },
    focusPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.full,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    focusPillActive: {
      backgroundColor: colors.primary ? `${colors.primary}22` : 'rgba(229, 169, 60, 0.16)',
      borderColor: colors.primary || '#E5A93C',
    },
    focusPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary || '#94A3B8',
    },
    focusPillTextActive: {
      color: colors.primary || '#E5A93C',
      fontWeight: '700',
    },
    focusSummaryStrip: {
      padding: spacing.sm + 2,
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRadius: radii.sm,
      gap: spacing.xs + 2,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.04)',
    },
    focusMetaHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
    },
    focusMetaTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    focusMetaSubtitle: {
      fontSize: 11,
    },
    summaryMetricsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: 2,
    },
    summaryMetricTile: {
      flex: 1,
      paddingVertical: 6,
      paddingHorizontal: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: radii.xs,
      alignItems: 'center',
      gap: 1,
    },
    summaryMetricLabel: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    summaryMetricValue: {
      fontSize: 14,
      fontWeight: '800',
    },
    statusPillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: 4,
    },
    statusPillGreen: {
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.full,
    },
    statusPillGreenText: {
      color: '#10B981',
      fontSize: 11,
      fontWeight: '700',
    },
    statusPillNeutral: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.full,
    },
    statusPillNeutralText: {
      fontSize: 11,
      fontWeight: '700',
    },
    statusPillRed: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.full,
    },
    statusPillRedText: {
      color: '#EF4444',
      fontSize: 11,
      fontWeight: '700',
    },
    baselineNoticeRow: {
      marginTop: 4,
      paddingVertical: 2,
    },
    baselineNoticeText: {
      fontSize: 11,
      fontStyle: 'italic',
    },
    exercisesList: {
      gap: spacing.sm,
    },
    emptyExerciseBox: {
      padding: spacing.md,
      alignItems: 'center',
    },
    exerciseCard: {
      padding: spacing.sm + 2,
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.04)',
      gap: 6,
    },
    exerciseCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    exerciseTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      marginRight: spacing.xs,
    },
    exerciseNameText: {
      fontSize: 14,
      fontWeight: '700',
    },
    categoryBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    categoryBadgeText: {
      fontSize: 9,
      fontWeight: '600',
    },
    statusBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    statusBadgeGreen: {
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
    },
    statusBadgeRed: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
    },
    statusBadgeNeutral: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    statusBadgeMuted: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    statusTextGreen: {
      color: '#10B981',
    },
    statusTextRed: {
      color: '#EF4444',
    },
    statusTextNeutral: {
      color: colors.textSecondary || '#94A3B8',
    },
    statusTextMuted: {
      color: colors.textMuted || '#64748B',
    },
    cardContentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metricsCol: {
      gap: 1,
    },
    currentPerformanceText: {
      fontSize: 14,
      fontWeight: '700',
    },
    comparisonSubtext: {
      fontSize: 11,
    },
    actionsCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    miniSparkline: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 22,
      gap: 3,
    },
    sparkTrack: {
      width: 7,
      height: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: 2,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    sparkFill: {
      width: '100%',
      backgroundColor: 'rgba(229, 169, 60, 0.35)',
      borderRadius: 1.5,
    },
    sparkFillLatest: {
      backgroundColor: colors.primary || '#E5A93C',
    },
    drilldownButton: {
      paddingVertical: 3,
      paddingHorizontal: 6,
    },
    drilldownButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary || '#E5A93C',
    },
    timelineSection: {
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.05)',
      gap: spacing.xs + 2,
    },
    timelineHeaderBlock: {
      gap: 1,
    },
    timelineHeader: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    timelineSubtitle: {
      fontSize: 10,
      fontStyle: 'italic',
    },
    timelineList: {
      gap: 6,
    },
    timelineItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
    },
    timelineLeftCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    timelineMarkerDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    timelineMarkerDotLatest: {
      backgroundColor: colors.primary || '#E5A93C',
    },
    timelineDateText: {
      fontSize: 12,
      fontWeight: '700',
    },
    latestTag: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 3,
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    latestTagText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#10B981',
    },
    previousTag: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    previousTagText: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textSecondary || '#94A3B8',
    },
    timelineRightCol: {
      alignItems: 'flex-end',
    },
    timelineMetricsText: {
      fontSize: 11,
    },
    historyLinkButton: {
      marginTop: 2,
      paddingVertical: 4,
      alignItems: 'center',
    },
    historyLinkText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary || '#E5A93C',
    },
  });
