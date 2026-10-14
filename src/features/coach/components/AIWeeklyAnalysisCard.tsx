import React from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text } from '../../../components/ui/Text';
import { Card } from '../../../components/ui/Card';
import { spacing, radii } from '../../../constants/theme';
import { AIWeeklyAnalysisResult } from '../services/coachService';

export interface AIWeeklyAnalysisCardProps {
  analysis: AIWeeklyAnalysisResult | null;
  loading: boolean;
  onRefresh?: () => void;
}

export function AIWeeklyAnalysisCard({
  analysis,
  loading,
  onRefresh,
}: AIWeeklyAnalysisCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  if (loading && !analysis) {
    return (
      <Card style={styles.container} testID="ai-weekly-analysis-card-loading">
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <Text variant="titleMedium" color="primary" testID="ai-weekly-title" style={styles.titleText}>
              AI Weekly Analysis
            </Text>
          </View>
          <Text variant="caption" color="muted">
            Synthesizing training intelligence...
          </Text>
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="caption" color="secondary" style={styles.loadingText}>
            Analyzing volume, muscle distribution, and progression...
          </Text>
        </View>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <Card style={styles.container} testID="ai-weekly-analysis-card">
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View style={styles.badgeRow}>
            <Text variant="titleMedium" color="primary" testID="ai-weekly-title" style={styles.titleText}>
              AI Weekly Analysis
            </Text>
            {analysis.isDeterministicFallback ? (
              <View style={styles.pillFactual} testID="ai-factual-pill">
                <Text variant="caption" style={styles.pillFactualText}>
                  FACTUAL ENGINE
                </Text>
              </View>
            ) : (
              <View style={styles.pillAi} testID="ai-cloud-pill">
                <Text variant="caption" style={styles.pillAiText}>
                  AI COACH
                </Text>
              </View>
            )}
          </View>

          {onRefresh && (
            <Pressable
              testID="ai-weekly-refresh-button"
              onPress={onRefresh}
              disabled={loading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.6 }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text variant="caption" color="primary" style={styles.refreshText}>
                  Refresh
                </Text>
              )}
            </Pressable>
          )}
        </View>

        <Text variant="caption" color="muted" style={styles.headlineText} testID="ai-weekly-headline">
          {analysis.headline}
        </Text>
      </View>

      {/* Summary Narrative */}
      <View style={styles.summaryBox} testID="ai-weekly-summary-box">
        <Text variant="body" color="primary" style={styles.summaryText} testID="ai-weekly-summary-text">
          {analysis.summary}
        </Text>
      </View>

      {/* Key Insights List */}
      {analysis.keyInsights.length > 0 && (
        <View style={styles.section} testID="ai-weekly-insights-section">
          <Text variant="label" color="muted" style={styles.sectionHeader}>
            KEY TRAINING OBSERVATIONS
          </Text>
          <View style={styles.insightsList}>
            {analysis.keyInsights.map((insight, idx) => (
              <View key={idx} style={styles.insightRow} testID={`ai-insight-row-${idx}`}>
                <View
                  style={[
                    styles.statusIndicator,
                    insight.status === 'optimal'
                      ? styles.indicatorOptimal
                      : insight.status === 'attention'
                      ? styles.indicatorAttention
                      : styles.indicatorNeutral,
                  ]}
                />
                <View style={styles.insightContent}>
                  <Text variant="bodyBold" color="primary">
                    {insight.title}
                  </Text>
                  <Text variant="caption" color="secondary" style={styles.insightDetail}>
                    {insight.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Muscle Focus Breakdown */}
      {analysis.muscleFocus.length > 0 && (
        <View style={styles.section} testID="ai-weekly-muscle-section">
          <Text variant="label" color="muted" style={styles.sectionHeader}>
            MUSCLE GROUP STIMULUS
          </Text>
          <View style={styles.muscleWrap}>
            {analysis.muscleFocus.map((m, idx) => (
              <View key={idx} style={styles.muscleBadge} testID={`ai-muscle-badge-${idx}`}>
                <Text variant="caption" color="primary" style={styles.muscleName}>
                  {m.muscleGroup}
                </Text>
                <Text variant="caption" color="muted">
                  {m.sets} sets • {Math.round(m.volume).toLocaleString()} kg
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actionable Recommendations */}
      {analysis.recommendations.length > 0 && (
        <View style={styles.section} testID="ai-weekly-recommendations-section">
          <Text variant="label" color="muted" style={styles.sectionHeader}>
            RECOMMENDED COACHING FOCUS
          </Text>
          <View style={styles.recsList}>
            {analysis.recommendations.map((rec, idx) => (
              <View key={idx} style={styles.recItem} testID={`ai-rec-item-${idx}`}>
                <Text variant="caption" color="primary" style={styles.recBullet}>
                  •
                </Text>
                <Text variant="caption" color="primary" style={styles.recText}>
                  {rec}
                </Text>
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
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      gap: spacing.md,
    },
    headerContainer: {
      gap: 6,
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 32,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
      flex: 1,
      marginRight: spacing.sm,
    },
    titleText: {
      fontSize: 16,
      fontWeight: '700',
    },
    pillFactual: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.xs,
      backgroundColor: colors.border || '#334155',
      alignSelf: 'center',
    },
    pillFactualText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary || '#94A3B8',
    },
    pillAi: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radii.xs,
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      alignSelf: 'center',
    },
    pillAiText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.primary,
    },
    headlineText: {
      marginTop: 2,
    },
    refreshButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radii.xs,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1,
      borderColor: colors.border || '#374151',
      minHeight: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    refreshText: {
      fontWeight: '600',
      fontSize: 12,
    },
    loadingBox: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    loadingText: {
      textAlign: 'center',
    },
    summaryBox: {
      backgroundColor: colors.background,
      padding: spacing.sm,
      borderRadius: radii.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    summaryText: {
      lineHeight: 20,
    },
    section: {
      gap: spacing.xs,
    },
    sectionHeader: {
      letterSpacing: 0.8,
      fontSize: 10,
    },
    insightsList: {
      gap: spacing.xs,
    },
    insightRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.background,
      padding: spacing.sm,
      borderRadius: radii.sm,
    },
    statusIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 4,
    },
    indicatorOptimal: {
      backgroundColor: '#10B981',
    },
    indicatorAttention: {
      backgroundColor: '#EF4444',
    },
    indicatorNeutral: {
      backgroundColor: '#3B82F6',
    },
    insightContent: {
      flex: 1,
      gap: 2,
    },
    insightDetail: {
      lineHeight: 16,
    },
    muscleWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    muscleBadge: {
      backgroundColor: colors.background,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 2,
    },
    muscleName: {
      fontWeight: '600',
    },
    recsList: {
      gap: spacing.xs,
    },
    recItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    recBullet: {
      fontWeight: '700',
      marginTop: 1,
    },
    recText: {
      flex: 1,
      lineHeight: 18,
    },
  });
