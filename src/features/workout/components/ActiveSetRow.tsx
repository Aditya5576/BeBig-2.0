import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, TextInput, Pressable, Modal, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Icon } from '../../../components/ui';
import { WorkoutExercise, WorkoutSet, SetType } from '../types';
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
  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 380;
  const styles = useMemo(() => createStyles(colors, isNarrow), [colors, isNarrow]);

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
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);

  const handleSelectSetType = useCallback(
    (newType: SetType) => {
      onUpdateSetField(exercise.exerciseId, set.id, 'setType', newType);
      setIsTypeSelectorOpen(false);
    },
    [exercise.exerciseId, set.id, onUpdateSetField],
  );

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
    const tag =
      prev.setType === 'drop'
        ? 'D '
        : prev.setType === 'warmup'
        ? 'W '
        : prev.setType === 'failure'
        ? 'F '
        : '';
    const w = prev.weight > 0 ? `${prev.weight}` : 'BW';
    return `${tag}${w} × ${prev.reps}`;
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
      {/* Main Tabular Row: [SET] [PREV] [KG] [REPS] [RIR] [✓] [NOTE] [DEL] */}
      <View style={styles.mainRow}>
        {/* Set Type / Number Interactive Badge */}
        <Pressable
          testID={`set-type-badge-${set.id}`}
          onPress={() => setIsTypeSelectorOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          style={styles.colSetTouch}
          accessibilityLabel={`Set ${set.setNumber}, type ${set.setType || 'normal'}. Tap to select set type.`}
          accessibilityRole="button"
        >
          <View
            style={[
              styles.setNumberBadge,
              set.setType === 'drop'
                ? styles.badgeDrop
                : set.setType === 'warmup'
                ? styles.badgeWarmup
                : set.setType === 'failure'
                ? styles.badgeFailure
                : styles.badgeNormal,
            ]}
          >
            <Text
              variant="label"
              style={[
                styles.setNumberText,
                set.setType === 'drop'
                  ? styles.badgeTextDrop
                  : set.setType === 'warmup'
                  ? styles.badgeTextWarmup
                  : set.setType === 'failure'
                  ? styles.badgeTextFailure
                  : set.completed
                  ? styles.setNumberTextCompleted
                  : null,
              ]}
            >
              {set.setType === 'drop'
                ? 'D'
                : set.setType === 'warmup'
                ? 'W'
                : set.setType === 'failure'
                ? 'F'
                : set.setNumber}
            </Text>
            <Icon
              name="chevronDown"
              size={8}
              strokeWidth={3}
              color={
                set.setType === 'drop'
                  ? colors.dropSet || '#A855F7'
                  : set.setType === 'warmup'
                  ? colors.warning
                  : set.setType === 'failure'
                  ? colors.error
                  : colors.textMuted
              }
            />
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
            placeholderTextColor="#64748B"
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
            placeholderTextColor="#64748B"
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
            placeholderTextColor="#64748B"
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
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
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
            <Icon
              name="check"
              size={16}
              strokeWidth={3}
              color={set.completed ? '#FFFFFF' : colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Compact Note Trigger Button */}
        <View style={styles.colNote}>
          <Pressable
            testID={`set-note-toggle-${exercise.exerciseId}-${set.setNumber}`}
            onPress={() => onToggleNotes(set.id)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
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
            <Icon
              name="note"
              size={13}
              color={hasExistingNote ? colors.primary : colors.textMuted}
            />
            {hasExistingNote && (
              <View
                testID={`set-note-indicator-${exercise.exerciseId}-${set.setNumber}`}
                style={styles.noteActiveDot}
              />
            )}
          </Pressable>
        </View>

        {/* Remove Set Button (directly accessible on eligible set rows) */}
        <View style={styles.colDelete}>
          {canDelete ? (
            <Pressable
              testID={`delete-set-${exercise.exerciseId}-${set.setNumber}`}
              onPress={() => onDeleteSet(exercise.exerciseId, set.id)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              style={styles.deleteButton}
              accessibilityLabel={`Delete set ${set.setNumber}`}
              accessibilityRole="button"
            >
              <Icon name="trash" size={13} color={colors.error} />
            </Pressable>
          ) : null}
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
          <Icon name="note" size={12} color={colors.primary} />
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
              <Icon name="close" size={12} color={colors.textMuted} />
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
              testID={`delete-set-notes-${exercise.exerciseId}-${set.setNumber}`}
              onPress={() => onDeleteSet(exercise.exerciseId, set.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.deleteIconButton}
              accessibilityLabel={`Delete set ${set.setNumber}`}
              accessibilityRole="button"
            >
              <Icon name="trash" size={13} color={colors.error} />
            </Pressable>
          )}
        </View>
      )}

      {/* Set Type Selector Modal */}
      <Modal
        testID="set-type-selector-modal"
        visible={isTypeSelectorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTypeSelectorOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsTypeSelectorOpen(false)}
        >
          <Pressable
            style={styles.typeSelectorCard}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Drag Handle */}
            <View style={styles.modalDragHandle} />

            <View style={styles.typeSelectorHeader}>
              <Text variant="headingSmall" style={styles.typeSelectorTitle}>
                Select Set Type
              </Text>
              <Text variant="caption" style={styles.typeSelectorSubtitle}>
                Exercise: {exercise.exerciseName} • Set {set.setNumber}
              </Text>
            </View>

            <View style={styles.typeOptionList}>
              {/* Normal Set Option */}
              <Pressable
                testID="set-type-option-normal"
                onPress={() => handleSelectSetType('normal')}
                style={[
                  styles.typeOptionItem,
                  (!set.setType || set.setType === 'normal') && styles.typeOptionItemActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Normal working set"
              >
                <View style={[styles.typeOptionIconWrap, styles.badgeNormal]}>
                  <Text style={[styles.typeOptionIconText, styles.badgeTextNormal]}>
                    {set.setNumber}
                  </Text>
                </View>
                <View style={styles.typeOptionTexts}>
                  <Text style={styles.typeOptionLabel}>Normal Set</Text>
                  <Text style={styles.typeOptionDesc}>
                    Standard working set (qualifies for PRs & 1RM)
                  </Text>
                </View>
                {(!set.setType || set.setType === 'normal') && (
                  <Icon name="check" size={16} strokeWidth={2.5} color={colors.primary} />
                )}
              </Pressable>

              {/* Warm-up Set Option */}
              <Pressable
                testID="set-type-option-warmup"
                onPress={() => handleSelectSetType('warmup')}
                style={[
                  styles.typeOptionItem,
                  set.setType === 'warmup' && styles.typeOptionItemActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Warm-up set"
              >
                <View style={[styles.typeOptionIconWrap, styles.badgeWarmup]}>
                  <Text style={[styles.typeOptionIconText, styles.badgeTextWarmup]}>
                    W
                  </Text>
                </View>
                <View style={styles.typeOptionTexts}>
                  <Text style={styles.typeOptionLabel}>Warm-up Set</Text>
                  <Text style={styles.typeOptionDesc}>
                    Prepares muscles; excluded from top-weight PRs
                  </Text>
                </View>
                {set.setType === 'warmup' && (
                  <Icon name="check" size={16} strokeWidth={2.5} color={colors.warning} />
                )}
              </Pressable>

              {/* Drop Set Option */}
              <Pressable
                testID="set-type-option-drop"
                onPress={() => handleSelectSetType('drop')}
                style={[
                  styles.typeOptionItem,
                  set.setType === 'drop' && styles.typeOptionItemActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Drop set"
              >
                <View style={[styles.typeOptionIconWrap, styles.badgeDrop]}>
                  <Text style={[styles.typeOptionIconText, styles.badgeTextDrop]}>
                    D
                  </Text>
                </View>
                <View style={styles.typeOptionTexts}>
                  <Text style={styles.typeOptionLabel}>Drop Set</Text>
                  <Text style={styles.typeOptionDesc}>
                    Immediate back-to-back set; skips rest timer
                  </Text>
                </View>
                {set.setType === 'drop' && (
                  <Icon name="check" size={16} strokeWidth={2.5} color={colors.dropSet || '#A855F7'} />
                )}
              </Pressable>

              {/* Failure Set Option */}
              <Pressable
                testID="set-type-option-failure"
                onPress={() => handleSelectSetType('failure')}
                style={[
                  styles.typeOptionItem,
                  set.setType === 'failure' && styles.typeOptionItemActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Failure set"
              >
                <View style={[styles.typeOptionIconWrap, styles.badgeFailure]}>
                  <Text style={[styles.typeOptionIconText, styles.badgeTextFailure]}>
                    F
                  </Text>
                </View>
                <View style={styles.typeOptionTexts}>
                  <Text style={styles.typeOptionLabel}>Failure Set</Text>
                  <Text style={styles.typeOptionDesc}>
                    Pushed to concentric muscle failure; full PR tracking
                  </Text>
                </View>
                {set.setType === 'failure' && (
                  <Icon name="check" size={16} strokeWidth={2.5} color={colors.error} />
                )}
              </Pressable>
            </View>

            <Pressable
              testID="close-set-type-selector"
              onPress={() => setIsTypeSelectorOpen(false)}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

const createStyles = (colors: any, isNarrow: boolean = false) =>
  StyleSheet.create({
    rowWrapper: {
      backgroundColor: 'transparent',
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 2,
      gap: isNarrow ? 2 : 4,
    },
    rowWrapperCompleted: {
      backgroundColor: 'rgba(34, 197, 94, 0.08)',
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isNarrow ? 3 : 4,
    },
    colSet: {
      width: isNarrow ? 28 : 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colSetTouch: {
      width: isNarrow ? 28 : 32,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setNumberBadge: {
      width: isNarrow ? 26 : 28,
      height: 30,
      borderRadius: 6,
      borderWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    setNumberBadgeCompleted: {},
    setNumberText: {
      fontWeight: '700',
      fontSize: isNarrow ? 11 : 12,
      color: colors.textSecondary,
    },
    setNumberTextCompleted: {
      color: '#22C55E',
    },
    colPrev: {
      width: isNarrow ? 40 : 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prevText: {
      fontWeight: '500',
      fontSize: isNarrow ? 9.5 : 10.5,
      color: '#64748B',
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    prevTextEmpty: {
      color: '#64748B',
      fontSize: 12,
      fontWeight: '400',
    },
    colKg: {
      flex: 1.15,
      minWidth: isNarrow ? 34 : 38,
    },
    colReps: {
      flex: 1.0,
      minWidth: isNarrow ? 30 : 36,
    },
    colRir: {
      flex: 0.85,
      minWidth: isNarrow ? 28 : 32,
    },
    metricInput: {
      backgroundColor: '#0D121D',
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.16)',
      borderRadius: 8,
      paddingHorizontal: isNarrow ? 1 : 2,
      paddingVertical: 0,
      color: '#F8FAFC',
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
      height: 36,
      fontVariant: ['tabular-nums'],
    },
    metricInputCompleted: {
      backgroundColor: 'rgba(34, 197, 94, 0.06)',
      borderColor: 'rgba(34, 197, 94, 0.25)',
      color: '#F8FAFC',
    },
    metricInputRir: {
      fontSize: isNarrow ? 13 : 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    colCheck: {
      width: isNarrow ? 32 : 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkButtonPending: {
      backgroundColor: '#1E293B',
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.16)',
    },
    checkButtonDone: {
      backgroundColor: '#22C55E',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    checkButtonIcon: {
      fontSize: 15,
      fontWeight: '900',
    },
    checkIconPending: {
      color: colors.textMuted,
    },
    checkIconDone: {
      color: colors.background,
    },
    colNote: {
      width: isNarrow ? 26 : 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteButton: {
      width: isNarrow ? 26 : 28,
      height: 36,
      borderRadius: 8,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    noteButtonActive: {
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      borderColor: colors.primary,
    },
    noteButtonIcon: {
      fontSize: 12,
      color: colors.textMuted,
    },
    noteButtonIconActive: {
      fontSize: 12,
    },
    noteActiveDot: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.primary,
    },
    notePreviewPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(56, 189, 248, 0.08)',
      borderWidth: 0,
      borderColor: 'transparent',
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
      fontSize: 12,
      fontWeight: '700',
    },
    colDelete: {
      width: isNarrow ? 24 : 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButton: {
      width: isNarrow ? 24 : 26,
      height: 36,
      borderRadius: 8,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeNormal: {
      backgroundColor: '#1E293B',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 6,
    },
    badgeTextNormal: {
      color: '#F8FAFC',
      fontWeight: '700',
    },
    badgeDrop: {
      backgroundColor: 'rgba(168, 85, 247, 0.18)',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 6,
    },
    badgeTextDrop: {
      color: '#C084FC',
      fontWeight: '800',
    },
    badgeWarmup: {
      backgroundColor: 'rgba(245, 158, 11, 0.18)',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 6,
    },
    badgeTextWarmup: {
      color: '#FBBF24',
      fontWeight: '800',
    },
    badgeFailure: {
      backgroundColor: 'rgba(239, 68, 68, 0.18)',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 6,
    },
    badgeTextFailure: {
      color: '#F87171',
      fontWeight: '800',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    modalDragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#334155',
      alignSelf: 'center',
      marginBottom: 12,
    },
    typeSelectorCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: '#141824',
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: '#242C3D',
    },
    typeSelectorHeader: {
      marginBottom: 14,
    },
    typeSelectorTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    typeSelectorSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    typeOptionList: {
      gap: 8,
    },
    typeOptionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: '#0F1420',
      borderWidth: 1,
      borderColor: '#242C3D',
      minHeight: 52,
      gap: 12,
    },
    typeOptionItemActive: {
      borderColor: colors.primary || '#38BDF8',
      backgroundColor: 'rgba(56, 189, 248, 0.08)',
    },
    typeOptionIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    typeOptionIconText: {
      fontSize: 14,
      fontWeight: '800',
    },
    typeOptionTexts: {
      flex: 1,
    },
    typeOptionLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    typeOptionDesc: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    typeOptionCheckmark: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.primary || '#38BDF8',
      marginLeft: 'auto',
    },
    closeButton: {
      marginTop: 14,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: 'transparent',
    },
    closeButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
  });
