import React, { useState, useEffect, useCallback } from 'react';
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
  onToggleCompleteSet: (
    exercise: WorkoutExercise,
    set: WorkoutSet,
    pendingUpdates?: Partial<WorkoutSet>,
  ) => void;
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

  const [localWeight, setLocalWeight] = useState(
    set.weight !== undefined && set.weight !== null ? String(set.weight) : ''
  );
  const [localReps, setLocalReps] = useState(
    set.reps !== undefined && set.reps !== null ? String(set.reps) : ''
  );
  const [localRir, setLocalRir] = useState(
    set.rir !== undefined && set.rir !== null ? String(set.rir) : '2'
  );
  const [localNotes, setLocalNotes] = useState(set.notes || '');

  // Sync local state when incoming props change (e.g., duplicate set, resume workout)
  useEffect(() => {
    setLocalWeight(set.weight !== undefined && set.weight !== null ? String(set.weight) : '');
    setLocalReps(set.reps !== undefined && set.reps !== null ? String(set.reps) : '');
    setLocalRir(set.rir !== undefined && set.rir !== null ? String(set.rir) : '2');
    setLocalNotes(set.notes || '');
  }, [set.weight, set.reps, set.rir, set.notes]);

  const commitWeight = useCallback(() => {
    onUpdateSetField(exercise.exerciseId, set.id, 'weight', localWeight);
  }, [exercise.exerciseId, set.id, localWeight, onUpdateSetField]);

  const commitReps = useCallback(() => {
    onUpdateSetField(exercise.exerciseId, set.id, 'reps', localReps);
  }, [exercise.exerciseId, set.id, localReps, onUpdateSetField]);

  const commitRir = useCallback(() => {
    onUpdateSetField(exercise.exerciseId, set.id, 'rir', localRir);
  }, [exercise.exerciseId, set.id, localRir, onUpdateSetField]);

  const commitNotes = useCallback(() => {
    onUpdateSetField(exercise.exerciseId, set.id, 'notes', localNotes);
  }, [exercise.exerciseId, set.id, localNotes, onUpdateSetField]);

  const handleToggleComplete = useCallback(() => {
    let pendingUpdates: Partial<WorkoutSet> = {};

    const numWeight = parseFloat(localWeight);
    if (!isNaN(numWeight)) pendingUpdates.weight = Math.max(0, numWeight);

    const numReps = parseInt(localReps, 10);
    if (!isNaN(numReps)) pendingUpdates.reps = Math.max(0, numReps);

    const numRir = parseFloat(localRir);
    if (!isNaN(numRir)) pendingUpdates.rir = Math.min(10, Math.max(0, numRir));

    pendingUpdates.notes = localNotes;

    onToggleCompleteSet(exercise, set, pendingUpdates);
  }, [exercise, set, localWeight, localReps, localRir, localNotes, onToggleCompleteSet]);

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
            value={localWeight}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            onChangeText={setLocalWeight}
            onBlur={commitWeight}
            onSubmitEditing={commitWeight}
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
            value={localReps}
            placeholder="10"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            onChangeText={setLocalReps}
            onBlur={commitReps}
            onSubmitEditing={commitReps}
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
            value={localRir}
            placeholder="2"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            onChangeText={setLocalRir}
            onBlur={commitRir}
            onSubmitEditing={commitRir}
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
            value={localNotes}
            placeholder="Form cues, tempo, notes..."
            placeholderTextColor={colors.textMuted}
            onChangeText={setLocalNotes}
            onBlur={commitNotes}
            onSubmitEditing={commitNotes}
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
        onPress={handleToggleComplete}
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
      padding: spacing.sm,
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    setCardCompleted: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(56, 189, 248, 0.05)',
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
      fontSize: 13,
    },
    completedBadge: {
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    completedBadgeText: {
      fontWeight: '700',
      color: colors.primary,
      fontSize: 11,
    },
    pendingBadge: {
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    pendingBadgeText: {
      fontWeight: '700',
      color: colors.textMuted,
      fontSize: 11,
    },
    deleteSetButton: {
      minHeight: 28,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: radii.xs,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteSetText: {
      color: colors.error,
      fontWeight: '600',
      fontSize: 12,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: spacing.xs + 2,
    },
    metricCol: {
      flex: 1,
      gap: 3,
    },
    inputLabel: {
      fontWeight: '700',
      letterSpacing: 0.5,
      fontSize: 10,
    },
    metricInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: 4,
      paddingVertical: 4,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      minHeight: 40,
    },
    metricInputCompleted: {
      backgroundColor: colors.surfaceSubtle,
      borderColor: 'rgba(56, 189, 248, 0.3)',
    },
    addNoteTrigger: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
      paddingHorizontal: spacing.xs,
    },
    addNoteText: {
      fontWeight: '600',
      fontSize: 12,
    },
    notesContainer: {
      gap: 3,
    },
    notesInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 4,
      color: colors.textPrimary,
      fontSize: 14,
      minHeight: 38,
    },
    completeSetButton: {
      minHeight: 42,
      borderRadius: radii.sm,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    completeSetButtonActive: {
      backgroundColor: colors.primary,
    },
    completeSetButtonDone: {
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
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
