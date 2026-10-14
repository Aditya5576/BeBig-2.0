import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Card } from '../../../components/ui';
import { spacing, radii } from '../../../constants/theme';
import { AnalyticsPeriod, PeriodOverviewMetrics } from '../progressAnalytics';

export interface ProgressOverviewCardProps {
  overview: PeriodOverviewMetrics;
  selectedPeriod: AnalyticsPeriod;
  onSelectPeriod: (period: AnalyticsPeriod) => void;
}

export function ProgressOverviewCard({
  overview,
  selectedPeriod,
  onSelectPeriod,
}: ProgressOverviewCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const {
    currentRange,
    workoutCount,
    completedSetsCount,
    totalVolumeKg,
    activeDaysCount,
    prCount,
    comparison,
  } = overview;

  return (
    <Card style={styles.container} testID="progress-overview-card">
      {/* Period Selector Tabs */}
      <View style={styles.periodSelector} testID="analytics-period-selector">
        {(['week', 'month', 'all_time'] as AnalyticsPeriod[]).map((p) => {
          const isActive = selectedPeriod === p;
          const label = p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All Time';
          return (
            <Pressable
              key={p}
              testID={`analytics-period-${p}`}
              onPress={() => onSelectPeriod(p)}
              style={[styles.periodTab, isActive && styles.periodTabActive]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                variant="caption"
                style={[styles.periodTabText, isActive && styles.periodTabTextActive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Period Label Header */}
      <View style={styles.headerBlock}>
        <Text variant="caption" color="muted" style={styles.rangeLabel} testID="analytics-range-label">
          {currentRange.label}
        </Text>
        {comparison && comparison.hasPriorData && comparison.volumePercentDelta !== null && (
          <View
            style={[
              styles.comparisonPill,
              comparison.volumePercentDelta >= 0 ? styles.pillGreen : styles.pillRed,
            ]}
            testID="analytics-volume-delta-pill"
          >
            <Text
              variant="caption"
              style={[
                styles.comparisonPillText,
                comparison.volumePercentDelta >= 0 ? { color: '#10B981' } : { color: '#EF4444' },
              ]}
            >
              {comparison.volumePercentDelta >= 0 ? '↑' : '↓'}{' '}
              {Math.abs(comparison.volumePercentDelta)}% vol vs prior{' '}
              {selectedPeriod === 'week' ? 'week' : 'month'}
            </Text>
          </View>
        )}
      </View>

      {/* 2x2 Metric Grid */}
      <View style={styles.metricsGrid} testID="analytics-metrics-grid">
        {/* Workouts */}
        <View style={styles.metricTile} testID="analytics-metric-workouts">
          <Text variant="caption" color="muted" style={styles.metricLabel}>
            WORKOUTS
          </Text>
          <Text variant="titleMedium" color="primary" style={styles.metricValue}>
            {workoutCount}
          </Text>
          {comparison && comparison.hasPriorData ? (
            <Text variant="caption" color="secondary" style={styles.metricDeltaText}>
              {comparison.workoutDelta > 0
                ? `+${comparison.workoutDelta} vs prior`
                : comparison.workoutDelta < 0
                ? `${comparison.workoutDelta} vs prior`
                : 'Equal to prior'}
            </Text>
          ) : (
            <Text variant="caption" color="muted" style={styles.metricDeltaText}>
              {workoutCount === 1 ? '1 session logged' : `${workoutCount} sessions logged`}
            </Text>
          )}
        </View>

        {/* Working Sets */}
        <View style={styles.metricTile} testID="analytics-metric-sets">
          <Text variant="caption" color="muted" style={styles.metricLabel}>
            EFFECTIVE SETS
          </Text>
          <Text variant="titleMedium" color="primary" style={styles.metricValue}>
            {completedSetsCount}
          </Text>
          {comparison && comparison.hasPriorData ? (
            <Text variant="caption" color="secondary" style={styles.metricDeltaText}>
              {comparison.setDelta > 0
                ? `+${comparison.setDelta} sets`
                : comparison.setDelta < 0
                ? `${comparison.setDelta} sets`
                : 'Identical sets'}
            </Text>
          ) : (
            <Text variant="caption" color="muted" style={styles.metricDeltaText}>
              Completed working sets
            </Text>
          )}
        </View>

        {/* Training Volume */}
        <View style={styles.metricTile} testID="analytics-metric-volume">
          <Text variant="caption" color="muted" style={styles.metricLabel}>
            TOTAL VOLUME
          </Text>
          <Text variant="titleMedium" color="primary" style={styles.metricValue}>
            {totalVolumeKg > 0
              ? `${Math.round(totalVolumeKg).toLocaleString()} kg`
              : completedSetsCount > 0
              ? 'Bodyweight'
              : '0 kg'}
          </Text>
          {comparison && comparison.hasPriorData ? (
            <Text variant="caption" color="secondary" style={styles.metricDeltaText}>
              {comparison.volumeDeltaKg > 0
                ? `+${Math.round(comparison.volumeDeltaKg).toLocaleString()} kg`
                : comparison.volumeDeltaKg < 0
                ? `${Math.round(comparison.volumeDeltaKg).toLocaleString()} kg`
                : 'Steady volume'}
            </Text>
          ) : (
            <Text variant="caption" color="muted" style={styles.metricDeltaText}>
              {completedSetsCount > 0 && totalVolumeKg === 0 ? 'Bodyweight sets' : 'Tonnage moved'}
            </Text>
          )}
        </View>

        {/* Consistency & PRs */}
        <View style={styles.metricTile} testID="analytics-metric-consistency">
          <Text variant="caption" color="muted" style={styles.metricLabel}>
            CONSISTENCY & PRS
          </Text>
          <Text variant="titleMedium" color="primary" style={styles.metricValue}>
            {activeDaysCount} {activeDaysCount === 1 ? 'Day' : 'Days'}
          </Text>
          <Text variant="caption" color="secondary" style={styles.metricDeltaText}>
            {prCount > 0 ? `${prCount} all-time PRs` : 'Consistent cadence'}
          </Text>
        </View>
      </View>
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
    },
    periodSelector: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: radii.sm,
      padding: 3,
      gap: 4,
    },
    periodTab: {
      flex: 1,
      paddingVertical: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.xs,
    },
    periodTabActive: {
      backgroundColor: colors.card || '#1F2430',
      borderWidth: 1,
      borderColor: colors.borderLight || 'rgba(255, 255, 255, 0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    periodTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary || '#94A3B8',
    },
    periodTabTextActive: {
      color: colors.primary || '#E5A93C',
      fontWeight: '700',
    },
    headerBlock: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    rangeLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    comparisonPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.full,
    },
    pillGreen: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    pillRed: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    comparisonPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    metricTile: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: radii.sm,
      padding: spacing.sm,
      gap: 2,
    },
    metricLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    metricValue: {
      fontSize: 18,
      fontWeight: '800',
      marginTop: 2,
    },
    metricDeltaText: {
      fontSize: 11,
      marginTop: 2,
    },
  });
