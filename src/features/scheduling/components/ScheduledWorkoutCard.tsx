/**
 * BeBig 2.0 — Scheduled Workout Card Component
 *
 * Polished athletic card displaying a scheduled workout entity,
 * status badge, notes, and user actions (Edit, Skip, Delete).
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Card, Icon } from '../../../components/ui';
import { ScheduledWorkout } from '../types';
import { radii, spacing } from '../../../constants/theme';

interface ScheduledWorkoutCardProps {
  scheduledWorkout: ScheduledWorkout;
  templateName?: string | null;
  onView?: (workout: ScheduledWorkout) => void;
  onEdit: (workout: ScheduledWorkout) => void;
  onSkip: (workout: ScheduledWorkout) => void;
  onDelete: (workout: ScheduledWorkout) => void;
}

export function ScheduledWorkoutCard({
  scheduledWorkout,
  templateName,
  onView,
  onEdit,
  onSkip,
  onDelete,
}: ScheduledWorkoutCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const { name, status, scheduledTime, notes } = scheduledWorkout;

  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return { label: 'COMPLETED', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'skipped':
        return { label: 'SKIPPED', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.15)' };
      case 'scheduled':
      default:
        return { label: 'SCHEDULED', color: '#E5A93C', bg: 'rgba(229, 169, 60, 0.15)' };
    }
  };

  const badge = getStatusBadge();

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          {templateName ? (
            <Text variant="caption" style={styles.subtitle}>
              Template: {templateName}
            </Text>
          ) : null}
        </View>

        <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.color }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      {/* Optional Details Row (Time / Notes) */}
      {scheduledTime || notes ? (
        <View style={styles.detailsBox}>
          {scheduledTime ? (
            <View style={styles.detailItem}>
              <Icon name="clock" size={14} color={colors.textSecondary} />
              <Text variant="caption" style={styles.detailText}>
                {scheduledTime}
              </Text>
            </View>
          ) : null}
          {notes ? (
            <Text variant="body" style={styles.notesText} numberOfLines={2}>
              "{notes}"
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        {onView ? (
          <Pressable
            onPress={() => onView(scheduledWorkout)}
            style={[styles.actionBtn, styles.viewBtn]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="View workout preview"
            accessibilityRole="button"
          >
            <Icon name="search" size={15} color="#E5A93C" />
            <Text style={[styles.actionText, { color: '#E5A93C', fontWeight: '700' }]}>
              View Workout
            </Text>
          </Pressable>
        ) : null}

        {status === 'scheduled' ? (
          <Pressable
            onPress={() => onSkip(scheduledWorkout)}
            style={styles.actionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Skip schedule"
            accessibilityRole="button"
          >
            <Icon name="skipForward" size={16} color={colors.textSecondary} />
            <Text style={styles.actionText}>Skip</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => onEdit(scheduledWorkout)}
          style={styles.actionBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Edit schedule"
          accessibilityRole="button"
        >
          <Icon name="edit" size={16} color={colors.textSecondary} />
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>

        <Pressable
          onPress={() => onDelete(scheduledWorkout)}
          style={[styles.actionBtn, styles.deleteBtn]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Delete schedule"
          accessibilityRole="button"
        >
          <Icon name="trash" size={16} color="#EF4444" />
          <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: '#111218',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    titleContainer: {
      flex: 1,
      marginRight: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 18,
    },
    subtitle: {
      color: colors.textSecondary,
      marginTop: 2,
    },
    badge: {
      borderWidth: 1,
      borderRadius: radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    detailsBox: {
      backgroundColor: '#181A22',
      borderRadius: radii.md,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    detailText: {
      color: colors.textSecondary,
      marginLeft: 6,
      fontWeight: '600',
    },
    notesText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontStyle: 'italic',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.05)',
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    viewBtn: {
      marginRight: 'auto',
    },
    deleteBtn: {},
    actionText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 4,
    },
  });
