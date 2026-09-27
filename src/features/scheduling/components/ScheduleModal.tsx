/**
 * BeBig 2.0 — Schedule Workout Modal (Create / Edit)
 *
 * Polished mobile-first modal for creating new workout schedules or editing existing ones.
 * Features structured template selection, quick future-date presets, clear primary confirmation actions,
 * and keyboard avoidance for mobile/iPhone.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Button, Icon, Card } from '../../../components/ui';
import { ScheduledWorkout, ScheduledWorkoutStatus } from '../types';
import { scheduledWorkoutRepository } from '../services/scheduledWorkoutRepository';
import { templateRepository, WorkoutTemplate } from '../../templates';
import { radii, spacing } from '../../../constants/theme';
import {
  getTodayIsoDate,
  getTomorrowIsoDate,
  getNextMondayIsoDate,
  addDaysToIsoDate,
  formatReadableDate,
} from '../utils/dateUtils';

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  initialDate?: string;
  scheduledWorkout?: ScheduledWorkout | null;
}

export function ScheduleModal({
  visible,
  onClose,
  onSave,
  initialDate,
  scheduledWorkout,
}: ScheduleModalProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const isEditing = Boolean(scheduledWorkout?.id);

  const [name, setName] = useState('');
  const [scheduledDate, setScheduledDate] = useState(initialDate || getTodayIsoDate());
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ScheduledWorkoutStatus>('scheduled');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      void loadTemplates();
      if (scheduledWorkout) {
        setName(scheduledWorkout.name || '');
        setScheduledDate(scheduledWorkout.scheduledDate || initialDate || getTodayIsoDate());
        setScheduledTime(scheduledWorkout.scheduledTime || '');
        setNotes(scheduledWorkout.notes || '');
        setStatus(scheduledWorkout.status || 'scheduled');
        setSelectedTemplateId(scheduledWorkout.templateId || null);
      } else {
        setName('');
        setScheduledDate(initialDate || getTodayIsoDate());
        setScheduledTime('');
        setNotes('');
        setStatus('scheduled');
        setSelectedTemplateId(null);
      }
      setErrorMsg(null);
    }
  }, [visible, scheduledWorkout, initialDate]);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const list = await templateRepository.getTemplates();
      setTemplates(list);
    } catch {
      // Silently fail template list loading
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = (template: WorkoutTemplate) => {
    if (selectedTemplateId === template.id) {
      setSelectedTemplateId(null);
    } else {
      setSelectedTemplateId(template.id);
      if (!name || name === (templates.find((t) => t.id === selectedTemplateId)?.name || '')) {
        setName(template.name);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      setErrorMsg(null);
      if (!name.trim()) {
        setErrorMsg('Please enter a workout name.');
        return;
      }
      if (!scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
        setErrorMsg('Please enter a valid date in YYYY-MM-DD format.');
        return;
      }

      setIsSubmitting(true);

      if (isEditing && scheduledWorkout) {
        await scheduledWorkoutRepository.updateScheduledWorkout({
          id: scheduledWorkout.id,
          name: name.trim(),
          scheduledDate,
          scheduledTime: scheduledTime.trim() || null,
          notes: notes.trim() || null,
          status,
        });
      } else {
        await scheduledWorkoutRepository.createScheduledWorkout({
          name: name.trim(),
          scheduledDate,
          templateId: selectedTemplateId,
          scheduledTime: scheduledTime.trim() || null,
          notes: notes.trim() || null,
        });
      }

      onSave();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save scheduled workout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="calendar" size={20} color="#E5A93C" />
              <Text variant="titleMedium" style={styles.headerTitle}>
                {isEditing ? 'EDIT SCHEDULE' : 'SCHEDULE WORKOUT'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Icon name="x" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Template Selection Section (Structured list) */}
            {!isEditing && (
              <View style={styles.section}>
                <Text variant="caption" style={styles.label}>
                  SELECT ROUTINE TEMPLATE (OPTIONAL)
                </Text>
                {loadingTemplates ? (
                  <ActivityIndicator size="small" color="#E5A93C" style={{ marginVertical: 12 }} />
                ) : templates.length > 0 ? (
                  <View style={styles.templateList}>
                    {templates.map((t) => {
                      const isSelected = selectedTemplateId === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => handleSelectTemplate(t)}
                          style={[
                            styles.templateCard,
                            isSelected && styles.templateCardActive,
                          ]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              variant="titleMedium"
                              style={[
                                styles.templateCardTitle,
                                isSelected && styles.templateCardTitleActive,
                              ]}
                            >
                              {t.name}
                            </Text>
                            <Text variant="caption" style={styles.templateCardSubtitle}>
                              {t.exercises ? `${t.exercises.length} Exercises` : 'Custom Routine'}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.radioCircle,
                              isSelected && styles.radioCircleActive,
                            ]}
                          >
                            {isSelected ? (
                              <Icon name="check" size={14} color="#090D16" />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyTemplateBox}>
                    <Text variant="caption" style={{ color: colors.textSecondary }}>
                      No templates saved. Type a custom workout name below.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Workout Name Input */}
            <View style={styles.section}>
              <Text variant="caption" style={styles.label}>
                WORKOUT NAME *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Heavy Legs & Abs"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Date Section with Quick Presets */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text variant="caption" style={styles.label}>
                  SCHEDULED DATE *
                </Text>
                <Text variant="caption" style={styles.readableDateLabel}>
                  {formatReadableDate(scheduledDate)}
                </Text>
              </View>

              {/* Quick Presets */}
              <View style={styles.presetRow}>
                <Pressable
                  onPress={() => setScheduledDate(getTodayIsoDate())}
                  style={[
                    styles.presetBtn,
                    scheduledDate === getTodayIsoDate() && styles.presetBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      scheduledDate === getTodayIsoDate() && styles.presetBtnTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setScheduledDate(getTomorrowIsoDate())}
                  style={[
                    styles.presetBtn,
                    scheduledDate === getTomorrowIsoDate() && styles.presetBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      scheduledDate === getTomorrowIsoDate() && styles.presetBtnTextActive,
                    ]}
                  >
                    Tomorrow
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setScheduledDate(getNextMondayIsoDate())}
                  style={[
                    styles.presetBtn,
                    scheduledDate === getNextMondayIsoDate() && styles.presetBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      scheduledDate === getNextMondayIsoDate() && styles.presetBtnTextActive,
                    ]}
                  >
                    Next Mon
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setScheduledDate(addDaysToIsoDate(scheduledDate, 7))}
                  style={styles.presetBtn}
                >
                  <Text style={styles.presetBtnText}>+7 Days</Text>
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                value={scheduledDate}
                onChangeText={setScheduledDate}
              />
            </View>

            {/* Target Time (Optional) */}
            <View style={styles.section}>
              <Text variant="caption" style={styles.label}>
                TARGET TIME (OPTIONAL)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 08:30"
                placeholderTextColor={colors.textSecondary}
                value={scheduledTime}
                onChangeText={setScheduledTime}
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text variant="caption" style={styles.label}>
                NOTES / GOALS (OPTIONAL)
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Target squat 315 lbs x 5 reps..."
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Status Picker (When Editing) */}
            {isEditing && (
              <View style={styles.section}>
                <Text variant="caption" style={styles.label}>
                  SCHEDULE STATUS
                </Text>
                <View style={styles.statusRow}>
                  {(['scheduled', 'skipped', 'completed'] as ScheduledWorkoutStatus[]).map((st) => (
                    <Pressable
                      key={st}
                      onPress={() => setStatus(st)}
                      style={[styles.statusBtn, status === st && styles.statusBtnActive]}
                    >
                      <Text
                        style={[styles.statusBtnText, status === st && styles.statusBtnTextActive]}
                      >
                        {st.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Footer with Prominent Primary Button */}
          <View style={styles.footer}>
            <Button
              title="CANCEL"
              variant="outline"
              onPress={onClose}
              style={{ flex: 1, marginRight: 8, minHeight: 46 }}
              disabled={isSubmitting}
            />
            <Button
              title={
                isSubmitting
                  ? 'SAVING...'
                  : isEditing
                  ? 'SAVE CHANGES'
                  : 'SCHEDULE WORKOUT'
              }
              variant="primary"
              onPress={handleSubmit}
              style={{ flex: 1.6, marginLeft: 8, minHeight: 46 }}
              disabled={isSubmitting}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
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
      maxHeight: '92%',
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
      marginLeft: 8,
      fontSize: 15,
      letterSpacing: 0.5,
    },
    body: {
      maxHeight: 480,
    },
    bodyContent: {
      padding: spacing.lg,
    },
    errorBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.4)',
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 13,
    },
    section: {
      marginBottom: spacing.lg,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    label: {
      color: colors.textSecondary,
      fontWeight: '800',
      fontSize: 11,
      marginBottom: 6,
      letterSpacing: 0.8,
    },
    readableDateLabel: {
      color: '#E5A93C',
      fontWeight: '700',
      fontSize: 11,
      marginBottom: 6,
    },
    input: {
      backgroundColor: '#181A22',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.textPrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: 16, // Ensures 16px to prevent iOS PWA auto-zoom
    },
    textArea: {
      minHeight: 70,
      textAlignVertical: 'top',
    },
    templateList: {
      gap: spacing.xs + 2,
    },
    templateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#181A22',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    templateCardActive: {
      backgroundColor: 'rgba(229, 169, 60, 0.12)',
      borderColor: '#E5A93C',
    },
    templateCardTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    templateCardTitleActive: {
      color: '#E5A93C',
    },
    templateCardSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    radioCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioCircleActive: {
      backgroundColor: '#E5A93C',
      borderColor: '#E5A93C',
    },
    emptyTemplateBox: {
      backgroundColor: '#181A22',
      borderRadius: radii.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 8,
    },
    presetBtn: {
      flex: 1,
      backgroundColor: '#181A22',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.sm,
      paddingVertical: 6,
      alignItems: 'center',
    },
    presetBtnActive: {
      backgroundColor: 'rgba(229, 169, 60, 0.2)',
      borderColor: '#E5A93C',
    },
    presetBtnText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    presetBtnTextActive: {
      color: '#E5A93C',
    },
    statusRow: {
      flexDirection: 'row',
      gap: 6,
    },
    statusBtn: {
      flex: 1,
      backgroundColor: '#181A22',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      paddingVertical: 10,
      alignItems: 'center',
    },
    statusBtnActive: {
      backgroundColor: 'rgba(229, 169, 60, 0.2)',
      borderColor: '#E5A93C',
    },
    statusBtnText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
    },
    statusBtnTextActive: {
      color: '#E5A93C',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });
