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
    setLocalNotes(set.notes || '');
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

  const hasNotes = Boolean(set.notes && set.notes.trim().length > 0) || Boolean(isNotesExpanded);

  return (
    <View
      style={[
        styles.rowWrapper,
        set.completed ? styles.rowWrapperCompleted : null,
      ]}
    >
      {/* Main Tabular Row: [SET] [PREV] [KG] [REPS] [RIR] [✓] */}
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
      </View>

      {/* Expanded Notes & Delete Row */}
      {hasNotes && (
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
            autoFocus={!set.notes && Boolean(isNotesExpanded)}
          />
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
      width: 28,
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
      width: 58,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prevText: {
      fontWeight: '600',
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
    },
    prevTextEmpty: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '400',
    },
    colKg: {
      flex: 1.15,
      minWidth: 62,
    },
    colReps: {
      flex: 1.0,
      minWidth: 54,
    },
    colRir: {
      flex: 0.85,
      minWidth: 46,
    },
    metricInput: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 8,
      paddingHorizontal: 4,
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
      width: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkButton: {
      width: 42,
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
      fontSize: 17,
      fontWeight: '900',
    },
    checkIconPending: {
      color: colors.textMuted,
    },
    checkIconDone: {
      color: colors.background,
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
