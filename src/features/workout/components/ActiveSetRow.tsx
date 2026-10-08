import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text } from '../../../components/ui';
import { WorkoutExercise, WorkoutSet } from '../types';
import { spacing, radii } from '../../../constants/theme';

export interface ActiveSetRowProps {
  exercise: WorkoutExercise;
  set: WorkoutSet;
  previousSet?: WorkoutSet;
  canDelete: boolean;
  isNotesExpanded?: boolean;
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
  previousSet,
  canDelete,
  isNotesExpanded,
  onToggleNotes,
  onDeleteSet,
  onUpdateSetField,
  onToggleCompleteSet,
}) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  // Initialize input state:
  // Completed sets always display their confirmed logged values.
  // Pending sets display empty strings so placeholders ('kg', 'reps', 'RIR') appear,
  // unless user-entered non-zero data exists.
  const [localWeight, setLocalWeight] = useState(
    set.completed || (set.weight !== undefined && set.weight !== null && set.weight > 0)
      ? String(set.weight)
      : ''
  );
  const [localReps, setLocalReps] = useState(
    set.completed && set.reps !== undefined && set.reps !== null
      ? String(set.reps)
      : ''
  );
  const [localRir, setLocalRir] = useState(
    set.completed && set.rir !== undefined && set.rir !== null
      ? String(set.rir)
      : ''
  );
  const [localNotes, setLocalNotes] = useState(set.notes || '');

  // Synchronize when completion status transitions or when confirmed props change
  useEffect(() => {
    if (set.completed) {
      setLocalWeight(set.weight !== undefined && set.weight !== null ? String(set.weight) : '');
      setLocalReps(set.reps !== undefined && set.reps !== null ? String(set.reps) : '');
      setLocalRir(set.rir !== undefined && set.rir !== null ? String(set.rir) : '');
    }
    if (set.notes !== undefined) {
      setLocalNotes(set.notes);
    }
  }, [set.completed, set.weight, set.reps, set.rir, set.notes]);

  const handleWeightChange = useCallback((val: string) => {
    setLocalWeight(val);
    onUpdateSetField(exercise.exerciseId, set.id, 'weight', val);
  }, [exercise.exerciseId, set.id, onUpdateSetField]);

  const handleRepsChange = useCallback((val: string) => {
    setLocalReps(val);
    onUpdateSetField(exercise.exerciseId, set.id, 'reps', val);
  }, [exercise.exerciseId, set.id, onUpdateSetField]);

  const handleRirChange = useCallback((val: string) => {
    setLocalRir(val);
    onUpdateSetField(exercise.exerciseId, set.id, 'rir', val);
  }, [exercise.exerciseId, set.id, onUpdateSetField]);

  const handleNotesChange = useCallback((val: string) => {
    setLocalNotes(val);
    onUpdateSetField(exercise.exerciseId, set.id, 'notes', val);
  }, [exercise.exerciseId, set.id, onUpdateSetField]);

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

  const handleClearNote = useCallback(() => {
    setLocalNotes('');
    onUpdateSetField(exercise.exerciseId, set.id, 'notes', '');
  }, [exercise.exerciseId, set.id, onUpdateSetField]);

  const handleToggleComplete = useCallback(() => {
    let pendingUpdates: Partial<WorkoutSet> = {};

    const numWeight = parseFloat(localWeight);
    if (!isNaN(numWeight)) {
      pendingUpdates.weight = Math.max(0, numWeight);
    } else if (set.weight !== undefined && set.weight !== null) {
      pendingUpdates.weight = set.weight;
    }

    const numReps = parseInt(localReps, 10);
    if (!isNaN(numReps)) {
      pendingUpdates.reps = Math.max(0, numReps);
    } else if (set.reps !== undefined && set.reps !== null) {
      pendingUpdates.reps = set.reps;
    }

    const numRir = parseFloat(localRir);
    if (!isNaN(numRir)) {
      pendingUpdates.rir = Math.min(10, Math.max(0, numRir));
    } else if (set.rir !== undefined && set.rir !== null) {
      pendingUpdates.rir = set.rir;
    }

    pendingUpdates.notes = localNotes;

    onToggleCompleteSet(exercise, set, pendingUpdates);
  }, [exercise, set, localWeight, localReps, localRir, localNotes, onToggleCompleteSet]);

  const formatPrevious = (prev?: WorkoutSet) => {
    if (!prev) return '—';
    const w = prev.weight > 0 ? `${prev.weight}` : 'BW';
    return `${w} × ${prev.reps}`;
  };

  const previousText = formatPrevious(previousSet);

  const hasExistingNote = Boolean(localNotes && localNotes.trim().length > 0);
  const isExpanded = isNotesExpanded !== undefined ? isNotesExpanded : hasExistingNote;

  return (
    <View
      style={[
        styles.rowWrapper,
        set.completed ? styles.rowWrapperCompleted : null,
      ]}
    >
      {/* Main Tabular Row: [SET] [PREV] [KG] [REPS] [RIR] [✓] [NOTE] */}
      <View style={styles.mainRow}>
        {/* Set Number Indicator */}
        <Pressable
          onPress={() => onToggleNotes(set.id)}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          style={styles.colSet}
          accessibilityLabel={`Set ${set.setNumber}, tap to toggle notes`}
        >
          <View style={styles.setNumberBadge}>
            <Text
              variant="label"
              style={[
                styles.setNumberText,
                set.completed ? styles.setNumberTextCompleted : null,
              ]}
            >
              {set.setNumber}
            </Text>
          </View>
        </Pressable>

        {/* Previous Performance */}
        <View style={styles.colPrev}>
          <Text
            variant="caption"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.prevText,
              !previousSet ? styles.prevTextEmpty : null,
            ]}
          >
            {previousText}
          </Text>
        </View>

        {/* Weight (kg) */}
        <View style={styles.colKg}>
          <TextInput
            testID={`set-weight-${exercise.exerciseId}-${set.setNumber}`}
            value={localWeight}
            placeholder="kg"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            selectTextOnFocus
            onChangeText={handleWeightChange}
            onBlur={commitWeight}
            onSubmitEditing={commitWeight}
            style={[
              styles.metricInput,
              set.completed ? styles.metricInputCompleted : null,
            ]}
          />
        </View>

        {/* Reps */}
        <View style={styles.colReps}>
          <TextInput
            testID={`set-reps-${exercise.exerciseId}-${set.setNumber}`}
            value={localReps}
            placeholder="reps"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            selectTextOnFocus
            onChangeText={handleRepsChange}
            onBlur={commitReps}
            onSubmitEditing={commitReps}
            style={[
              styles.metricInput,
              set.completed ? styles.metricInputCompleted : null,
            ]}
          />
        </View>

        {/* RIR */}
        <View style={styles.colRir}>
          <TextInput
            testID={`set-rir-${exercise.exerciseId}-${set.setNumber}`}
            value={localRir}
            placeholder="RIR"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            selectTextOnFocus
            onChangeText={handleRirChange}
            onBlur={commitRir}
            onSubmitEditing={commitRir}
            style={[
              styles.metricInput,
              styles.metricInputRir,
              set.completed ? styles.metricInputCompleted : null,
            ]}
          />
        </View>

        {/* Compact Complete Button */}
        <View style={styles.colCheck}>
          <Pressable
            testID={`complete-set-${exercise.exerciseId}-${set.setNumber}`}
            onPress={handleToggleComplete}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={[
              styles.checkButton,
              set.completed ? styles.checkButtonDone : styles.checkButtonPending,
            ]}
            accessibilityLabel={
              set.completed
                ? `Completed set ${set.setNumber}. Tap to unmark.`
                : `Complete set ${set.setNumber}`
            }
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.checkButtonIcon,
                set.completed ? styles.checkIconDone : styles.checkIconPending,
              ]}
            >
              ✓
            </Text>
          </Pressable>
        </View>

        {/* Compact Note Trigger Button */}
        <View style={styles.colNote}>
          <Pressable
            testID={`set-note-toggle-${exercise.exerciseId}-${set.setNumber}`}
            onPress={() => onToggleNotes(set.id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={[
              styles.noteButton,
              hasExistingNote ? styles.noteButtonActive : null,
            ]}
            accessibilityLabel={
              hasExistingNote
                ? `Edit note for set ${set.setNumber}`
                : `Add note for set ${set.setNumber}`
            }
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.noteButtonIcon,
                hasExistingNote ? styles.noteButtonIconActive : null,
              ]}
            >
              {hasExistingNote ? '📝' : '✎'}
            </Text>
            {hasExistingNote && (
              <View
                testID={`set-note-indicator-${exercise.exerciseId}-${set.setNumber}`}
                style={styles.noteActiveDot}
              />
            )}
          </Pressable>
        </View>
      </View>

      {/* Collapsed Note Preview Pill */}
      {!isExpanded && hasExistingNote && (
        <Pressable
          testID={`set-note-preview-${exercise.exerciseId}-${set.setNumber}`}
          onPress={() => onToggleNotes(set.id)}
          style={styles.notePreviewPill}
          accessibilityLabel={`Note: ${localNotes}. Tap to edit.`}
          accessibilityRole="button"
        >
          <Text style={styles.notePreviewIcon}>📝</Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.notePreviewText}
          >
            {localNotes}
          </Text>
          <Text style={styles.notePreviewEditHint}>Edit</Text>
        </Pressable>
      )}

      {/* Expanded Notes & Actions Row */}
      {isExpanded && (
        <View style={styles.notesRow}>
          <TextInput
            testID={`set-notes-${exercise.exerciseId}-${set.setNumber}`}
            value={localNotes}
            placeholder="Set note / form cue..."
            placeholderTextColor={colors.textMuted}
            onChangeText={handleNotesChange}
            onBlur={commitNotes}
            onSubmitEditing={commitNotes}
            style={styles.notesInput}
            autoFocus={!hasExistingNote}
            returnKeyType="done"
          />
          {localNotes.trim().length > 0 && (
            <Pressable
              testID={`clear-set-note-${exercise.exerciseId}-${set.setNumber}`}
              onPress={handleClearNote}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={styles.clearNoteButton}
              accessibilityLabel={`Clear note for set ${set.setNumber}`}
              accessibilityRole="button"
            >
              <Text style={styles.clearNoteText}>✕</Text>
            </Pressable>
          )}
          <Pressable
            testID={`done-set-note-${exercise.exerciseId}-${set.setNumber}`}
            onPress={() => {
              commitNotes();
              onToggleNotes(set.id);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={styles.doneNoteButton}
            accessibilityLabel={`Done editing note for set ${set.setNumber}`}
            accessibilityRole="button"
          >
            <Text style={styles.doneNoteText}>Done</Text>
          </Pressable>
          {canDelete && (
            <Pressable
              testID={`delete-set-${exercise.exerciseId}-${set.setNumber}`}
              onPress={() => onDeleteSet(exercise.exerciseId, set.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.deleteIconButton}
              accessibilityLabel={`Delete set ${set.setNumber}`}
              accessibilityRole="button"
            >
              <Text style={styles.deleteIconText}>✕</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    rowWrapper: {
      backgroundColor: 'transparent',
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 2,
      gap: 4,
    },
    rowWrapperCompleted: {
      backgroundColor: 'rgba(56, 189, 248, 0.04)',
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    colSet: {
      width: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setNumberBadge: {
      width: 26,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    setNumberBadgeCompleted: {},
    setNumberText: {
      fontWeight: '700',
      fontSize: 14,
      color: colors.textSecondary,
    },
    setNumberTextCompleted: {
      color: colors.primary,
    },
    colPrev: {
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prevText: {
      fontWeight: '600',
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
    },
    prevTextEmpty: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '400',
    },
    colKg: {
      flex: 1.15,
      minWidth: 54,
    },
    colReps: {
      flex: 1.0,
      minWidth: 48,
    },
    colRir: {
      flex: 0.85,
      minWidth: 42,
    },
    metricInput: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      paddingHorizontal: 2,
      paddingVertical: 0,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      height: 44,
    },
    metricInputCompleted: {
      backgroundColor: 'rgba(56, 189, 248, 0.04)',
      borderColor: 'rgba(56, 189, 248, 0.25)',
      color: colors.textPrimary,
    },
    metricInputRir: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    colCheck: {
      width: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkButton: {
      width: 38,
      height: 44,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkButtonPending: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    checkButtonDone: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    checkButtonIcon: {
      fontSize: 16,
      fontWeight: '900',
    },
    checkIconPending: {
      color: colors.textMuted,
    },
    checkIconDone: {
      color: colors.background,
    },
    colNote: {
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteButton: {
      width: 32,
      height: 44,
      borderRadius: 8,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    noteButtonActive: {
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      borderColor: colors.primary,
    },
    noteButtonIcon: {
      fontSize: 13,
      color: colors.textMuted,
    },
    noteButtonIconActive: {
      fontSize: 13,
    },
    noteActiveDot: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    notePreviewPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(56, 189, 248, 0.06)',
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.2)',
      borderRadius: 6,
      paddingVertical: 5,
      paddingHorizontal: 8,
      marginTop: 2,
      gap: 6,
    },
    notePreviewIcon: {
      fontSize: 11,
    },
    notePreviewText: {
      flex: 1,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    notePreviewEditHint: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    notesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: 4,
      paddingHorizontal: 2,
    },
    notesInput: {
      flex: 1,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: 0,
      color: colors.textPrimary,
      fontSize: 12,
      height: 36,
    },
    clearNoteButton: {
      width: 32,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    clearNoteText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    doneNoteButton: {
      paddingHorizontal: 10,
      height: 36,
      borderRadius: 8,
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      borderWidth: 1,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    doneNoteText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    deleteIconButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteIconText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '700',
    },
  });
