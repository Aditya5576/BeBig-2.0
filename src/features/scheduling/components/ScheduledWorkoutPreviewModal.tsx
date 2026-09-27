/**
 * BeBig 2.0 — Scheduled Workout Preview Modal (Read-Only)
 *
 * Read-only preview modal showing exercise details, target sets/reps, rest,
 * and target weight of a scheduled workout before execution.
 * Preserves exact snapshot data without modifying templates or initiating execution.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Button, Icon, Card, SyncStatusChip } from '../../../components/ui';
import { ScheduledWorkout } from '../types';
import { templateRepository, WorkoutTemplate } from '../../templates';
import { radii, spacing } from '../../../constants/theme';
import { formatReadableDate } from '../utils/dateUtils';
import { useEntitySyncStatus } from '../../../services/sync';

interface ScheduledWorkoutPreviewModalProps {
  visible: boolean;
  scheduledWorkout: ScheduledWorkout | null;
  onClose: () => void;
  onStart?: (workout: ScheduledWorkout) => void;
}

export function ScheduledWorkoutPreviewModal({
  visible,
  scheduledWorkout,
  onClose,
  onStart,
}: ScheduledWorkoutPreviewModalProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  const syncStatus = useEntitySyncStatus('scheduled_workout', scheduledWorkout?.id);

  useEffect(() => {
    if (visible && scheduledWorkout?.templateId) {
      void loadTemplate(scheduledWorkout.templateId);
    } else {
      setTemplate(null);
    }
  }, [visible, scheduledWorkout]);

  const loadTemplate = async (templateId: string) => {
    try {
      setLoading(true);
      const t = await templateRepository.getTemplateById(templateId);
      setTemplate(t);
    } catch {
      setTemplate(null);
    } finally {
      setLoading(false);
    }
  };

  if (!scheduledWorkout) return null;

  const getStatusBadge = (status: string) => {
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

  const badge = getStatusBadge(scheduledWorkout.status);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="workout" size={20} color="#E5A93C" />
                <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
                  {scheduledWorkout.name}
                </Text>
              </View>
              <Text variant="caption" style={styles.dateSubtitle}>
                {formatReadableDate(scheduledWorkout.scheduledDate)}
                {scheduledWorkout.scheduledTime ? ` • ${scheduledWorkout.scheduledTime}` : ''}
              </Text>
              <View style={{ marginLeft: 26, marginTop: 6 }}>
                <SyncStatusChip status={syncStatus} />
              </View>
            </View>

            <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.color }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ marginLeft: 12 }}
              accessibilityLabel="Close Preview"
              accessibilityRole="button"
            >
              <Icon name="x" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Notes Box if Present */}
            {scheduledWorkout.notes ? (
              <View style={styles.notesBox}>
                <Text variant="caption" style={styles.notesLabel}>
                  NOTES / GOALS
                </Text>
                <Text variant="body" style={styles.notesText}>
                  "{scheduledWorkout.notes}"
                </Text>
              </View>
            ) : null}

            {/* Exercise List Section */}
            <Text variant="caption" style={styles.sectionLabel}>
              SCHEDULED EXERCISES
            </Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#E5A93C" />
              </View>
            ) : template && template.exercises && template.exercises.length > 0 ? (
              <View style={styles.exerciseList}>
                {template.exercises.map((ex, idx) => (
                  <View key={ex.exerciseId || idx} style={styles.exerciseRow}>
                    <View style={styles.indexCircle}>
                      <Text style={styles.indexText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={styles.exName}>
                        {ex.exerciseName}
                      </Text>
                      <View style={styles.exMetricsRow}>
                        <Text variant="caption" style={styles.exMetric}>
                          {ex.sets} {ex.sets === 1 ? 'Set' : 'Sets'} × {ex.targetReps} reps
                        </Text>
                        {ex.restTime ? (
                          <Text variant="caption" style={styles.exMetricSecondary}>
                            ⏱ {ex.restTime}s rest
                          </Text>
                        ) : null}
                        {ex.targetWeight ? (
                          <Text variant="caption" style={styles.exMetricSecondary}>
                            🏋️ {ex.targetWeight} lbs
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyExerciseCard}>
                <Icon name="exercises" size={24} color={colors.textSecondary} />
                <Text variant="body" style={styles.emptyText}>
                  Ad-hoc custom workout schedule
                </Text>
                <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
                  No pre-configured template exercise list attached.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            {scheduledWorkout.status === 'scheduled' && onStart ? (
              <View style={styles.footerActions}>
                <Button
                  title="CLOSE"
                  variant="outline"
                  onPress={onClose}
                  style={{ flex: 1, minHeight: 44, marginRight: 8 }}
                />
                <Button
                  title="START WORKOUT"
                  variant="primary"
                  onPress={() => onStart(scheduledWorkout)}
                  style={{ flex: 2, minHeight: 44 }}
                />
              </View>
            ) : (
              <Button
                title="CLOSE PREVIEW"
                variant="outline"
                onPress={onClose}
                style={{ flex: 1, minHeight: 44 }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    footerActions: {
      flexDirection: 'row',
      width: '100%',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: '#111218',
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      maxHeight: '85%',
      paddingBottom: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontWeight: '800',
      marginLeft: 6,
      fontSize: 16,
    },
    dateSubtitle: {
      color: colors.textSecondary,
      marginTop: 2,
      marginLeft: 26,
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
    body: {
      maxHeight: 420,
    },
    bodyContent: {
      padding: spacing.lg,
    },
    notesBox: {
      backgroundColor: '#181A22',
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    notesLabel: {
      color: '#E5A93C',
      fontWeight: '800',
      fontSize: 10,
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    notesText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontStyle: 'italic',
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontWeight: '800',
      fontSize: 11,
      letterSpacing: 0.8,
      marginBottom: spacing.md,
    },
    loadingBox: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    exerciseList: {
      gap: spacing.sm,
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#181A22',
      borderRadius: radii.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    indexCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(229, 169, 60, 0.15)',
      borderColor: '#E5A93C',
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    indexText: {
      color: '#E5A93C',
      fontWeight: '800',
      fontSize: 12,
    },
    exName: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    exMetricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
      flexWrap: 'wrap',
      gap: 8,
    },
    exMetric: {
      color: '#E5A93C',
      fontWeight: '600',
      fontSize: 12,
    },
    exMetricSecondary: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    emptyExerciseCard: {
      backgroundColor: '#181A22',
      borderRadius: radii.md,
      padding: spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: {
      color: colors.textPrimary,
      fontWeight: '600',
      marginTop: spacing.sm,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });
