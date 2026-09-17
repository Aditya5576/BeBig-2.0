import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { colors, spacing, radii, typography } from '../../src/constants/theme';

export default function AdminDashboard() {
  const stats = [
    { label: 'Total Users', value: '1,248' },
    { label: 'Active Workouts', value: '42' },
    { label: 'Recent Errors', value: '3' },
    { label: 'Cloud Status', value: 'Healthy', color: colors.dark.success },
    { label: 'App Version', value: '2.0.4-prod' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {Platform.OS === 'web' ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media (max-width: 600px) {
                .admin-stat-card { width: 100% !important; max-width: 100% !important; }
              }
              @media (min-width: 601px) {
                .admin-stat-card { width: 48% !important; flex-grow: 1 !important; }
              }
            `,
          }}
        />
      ) : null}

      <Text style={styles.title}>Dashboard Overview</Text>
      <Text style={styles.subtitle}>
        System status and operations control panel.
      </Text>

      <View style={styles.grid}>
        {stats.map((stat, i) => (
          <View
            key={i}
            style={styles.card}
            {...({ dataSet: { class: 'admin-stat-card' } } as any)}
          >
            <Text style={styles.cardLabel}>{stat.label}</Text>
            <Text
              style={[
                styles.cardValue,
                stat.color ? { color: stat.color } : null,
              ]}
            >
              {stat.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>System Status Notice</Text>
        <Text style={styles.noticeText}>
          The analytics metrics above are static placeholders for Milestone 4. Real-time telemetry connection is operating in fallback mode.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
    width: '100%',
  },
  title: {
    ...typography.titleLarge,
    color: colors.dark.textPrimary,
    marginBottom: spacing.xs,
    width: '100%',
  },
  subtitle: {
    ...typography.body,
    color: colors.dark.textSecondary,
    marginBottom: spacing.lg,
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  card: {
    backgroundColor: colors.dark.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dark.border,
    width: '100%',
  },
  cardLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  cardValue: {
    ...typography.numericHero,
    fontSize: 30,
    color: colors.dark.textPrimary,
  },
  noticeBox: {
    backgroundColor: colors.dark.surfaceSubtle,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.dark.primary,
    borderWidth: 1,
    borderColor: colors.dark.border,
    width: '100%',
  },
  noticeTitle: {
    ...typography.label,
    color: colors.dark.textPrimary,
    marginBottom: spacing.xs,
  },
  noticeText: {
    ...typography.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.dark.textSecondary,
  },
});




