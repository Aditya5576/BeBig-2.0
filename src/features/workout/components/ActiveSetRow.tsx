import React from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text } from '../../../components/ui';
import { WorkoutExercise, WorkoutSet } from '../types';
import { spacing, radii } from '../../../constants/theme';

export interface ActiveSetRowProps {
  exercise: WorkoutExercise;
  set: WorkoutSet;
  canDelete: boolean;
  isNotesExpanded: boolean;
  onToggleNotes: (setId: string) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
  onUpdateSetField: (
    exerciseId: string,
    setId: string,
    field: keyof WorkoutSet,
    value: string,
  ) => void;
  onToggleCompleteSet: (exercise: WorkoutExercise, set: WorkoutSet) => void;
}

export const ActiveSetRow = React.memo<ActiveSetRowProps>(({
  exercise,
  set,
  canDelete,
  isNotesExpanded,
  onToggleNotes,
  onDeleteSet,
  onUpdateSetField,
  onToggleCompleteSet,
}) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View
      style={[styles.setCard, set.completed ? styles.setCardCompleted : null]}
    >
      {/* Set Card Top Row: Set # and Delete */}
      <View style={styles.setHeaderRow}>
        <View style={styles.setNumberContainer}>
          <Text
            variant="label"
            color={set.completed ? 'accent' : 'primary'}
            style={styles.setNumberText}
          >
            SET {set.setNumber}
          </Text>
          {set.completed ? (
            <View style={styles.completedBadge}>
              <Text variant="caption" style={styles.completedBadgeText}>
                ✓ Logged
              </Text>
            </View>
          ) : (
            <View style={styles.pendingBadge}>
              <Text variant="caption" style={styles.pendingBadgeText}>
                Pending
              </Text>
            </View>
          )}
        </View>

        {canDelete && (
          <Pressable
            testID={`delete-set-${exercise.exerciseId}-${set.setNumber}`}
            onPress={() => onDeleteSet(exercise.exerciseId, set.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteSetButton}
            accessibilityLabel={`Delete set ${set.setNumber}`}
            accessibilityRole="button"
          >
            <Text variant="caption" style={styles.deleteSetText}>
              Delete Set
            </Text>
          </Pressable>
        )}
      </View>

      {/* 3-Column Metric Layout: Weight, Reps, RIR */}
      <View style={styles.metricsRow}>
        {/* Weight (kg) */}
        <View style={styles.metricCol}>
          <Text variant="caption" color="muted" style={styles.inputLabel}>
            WEIGHT (KG)
          </Text>
          <TextInput
            testID={`set-weight-${exercise.exerciseId}-${set.setNumber}`}
            defaultValue={set.weight ? String(set.weight) : ''}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            onChangeText={(val) =>
              onUpdateSetField(exercise.exerciseId, set.id, 'weight', val)
            }
            style={[
              styles.metricInput,
              set.completed ? styles.metricInputCompleted : null,
            ]}
          />
        </View>

        {/* Reps */}
        <View style={styles.metricCol}>
          <Text variant="caption" color="muted" style={styles.inputLabel}>
            REPS
          </Text>
          <TextInput
            testID={`set-reps-${exercise.exerciseId}-${set.setNumber}`}
            defaultValue={set.reps ? String(set.reps) : ''}
            placeholder="10"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            onChangeText={(val) =>
              onUpdateSetField(exercise.exerciseId, set.id, 'reps', val)
            }
            style={[
              styles.metricInput,
              set.completed ? styles.metricInputCompleted : null,
            ]}
          />
        </View>

        {/* RIR (0-10) */}
        <View style={styles.metricCol}>
          <Text variant="caption" color="muted" style={styles.inputLabel}>
            RIR (0–10)
          </Text>
          <TextInput
            testID={`set-rir-${exercise.exerciseId}-${set.setNumber}`}
            defaultValue={set.rir !== undefined ? String(set.rir) : '2'}
            placeholder="2"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            onChangeText={(val) =>
              onUpdateSetField(exercise.exerciseId, set.id, 'rir', val)
            }
            style={[
              styles.metricInput,
              set.completed ? styles.metricInputCompleted : null,
            ]}
          />
        </View>
      </View>

      {/* Smart Collapsible Notes Field */}
      {Boolean(set.notes && set.notes.trim().length > 0) || Boolean(isNotesExpanded) ? (
        <View style={styles.notesContainer}>
          <Text variant="caption" color="muted" style={styles.inputLabel}>
            NOTES (OPTIONAL)
          </Text>
          <TextInput
            testID={`set-notes-${exercise.exerciseId}-${set.setNumber}`}
            defaultValue={set.notes || ''}
            placeholder="Form cues, tempo, notes..."
            placeholderTextColor={colors.textMuted}
            onChangeText={(val) =>
              onUpdateSetField(exercise.exerciseId, set.id, 'notes', val)
            }
            style={styles.notesInput}
            autoFocus={!set.notes && Boolean(isNotesExpanded)}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => onToggleNotes(set.id)}
          style={styles.addNoteTrigger}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text variant="caption" color="secondary" style={styles.addNoteText}>
            + Add Note
          </Text>
        </Pressable>
      )}

      {/* Prominent Full-Width Complete Set Button */}
      <Pressable
        testID={`complete-set-${exercise.exerciseId}-${set.setNumber}`}
        onPress={() => onToggleCompleteSet(exercise, set)}
        style={[
          styles.completeSetButton,
          set.completed
            ? styles.completeSetButtonDone
            : styles.completeSetButtonActive,
        ]}
      >
        <Text
          variant="bodyBold"
          style={[
            styles.completeSetButtonText,
            set.completed
              ? styles.completeSetTextDone
              : styles.completeSetTextActive,
          ]}
        >
          {set.completed
            ? `✓ Set ${set.setNumber} Completed`
            : `Complete Set ${set.setNumber}`}
        </Text>
      </Pressable>
    </View>
  );
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    setCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    setCardCompleted: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(56, 189, 248, 0.06)',
    },
    setHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    setNumberContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    setNumberText: {
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    completedBadge: {
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.full,
    },
    completedBadgeText: {
      fontWeight: '700',
      color: colors.primary,
    },
    pendingBadge: {
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.full,
    },
    pendingBadgeText: {
      fontWeight: '700',
      color: colors.textMuted,
    },
    deleteSetButton: {
      minHeight: 36,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.xs,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteSetText: {
      color: colors.error,
      fontWeight: '600',
    },
    metricsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    metricCol: {
      flex: 1,
      gap: 4,
    },
    inputLabel: {
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    metricInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      minHeight: 46,
    },
    metricInputCompleted: {
      backgroundColor: colors.surfaceSubtle,
      borderColor: 'rgba(56, 189, 248, 0.3)',
    },
    addNoteTrigger: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: spacing.xs,
      marginTop: 2,
    },
    addNoteText: {
      fontWeight: '600',
    },
    notesContainer: {
      gap: 4,
    },
    notesInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      color: colors.textPrimary,
      fontSize: 16,
      minHeight: 44,
    },
    completeSetButton: {
      minHeight: 46,
      borderRadius: radii.sm,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    completeSetButtonActive: {
      backgroundColor: colors.primary,
    },
    completeSetButtonDone: {
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    completeSetButtonText: {
      fontSize: 14,
      fontWeight: '700',
    },
    completeSetTextActive: {
      color: colors.background,
    },
    completeSetTextDone: {
      color: colors.primary,
    },
  });
