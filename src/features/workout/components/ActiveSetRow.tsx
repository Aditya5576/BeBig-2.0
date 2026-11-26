import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, TextInput, Pressable, Modal, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Icon } from '../../../components/ui';
import { WorkoutExercise, WorkoutSet, SetType } from '../types';
import { spacing } from '../../../constants/theme';
import { FONT_FAMILIES, NUMERIC_TABULAR_STYLE } from '../../../theme/typography';
import { DOMAIN_LIMITS, clampText } from '../../../constants/domainLimits';
import { isTreadmillExercise, formatTreadmillSet, formatTreadmillDuration } from '../utils/treadmillMetrics';

export type ActiveFocusField =
  | 'weight'
  | 'reps'
  | 'rir'
  | 'inclinePercent'
  | 'speedKph'
  | 'durationMinutes';

export interface ActiveSetRowProps {
  exercise: WorkoutExercise;
  set: WorkoutSet;
  setIndex?: number;
  previousSet?: WorkoutSet;
  canDelete: boolean;
  isNotesExpanded?: boolean;
  onToggleNotes: (setId: string) => void;
  onCloseNotes?: (setId: string) => void;
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
  isCustomKeypadActive?: boolean;
  activeFocusField?: ActiveFocusField | null;
  onFocusField?: (
    exerciseId: string,
    setId: string,
    field: ActiveFocusField,
    currentValue: string
  ) => void;
}

export const ActiveSetRow = React.memo<ActiveSetRowProps>(function ActiveSetRow({
  exercise,
  set,
  setIndex,
  previousSet,
  canDelete,
  isNotesExpanded,
  onToggleNotes,
  onCloseNotes,
  onDeleteSet,
  onUpdateSetField,
  onToggleCompleteSet,
  isCustomKeypadActive,
  activeFocusField,
  onFocusField,
}) {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth < 400;
  const styles = useMemo(() => createStyles(colors, isCompact), [colors, isCompact]);
  const isTreadmill = isTreadmillExercise(exercise);

  // Initialize input state:
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

  // Treadmill metrics state:
  const [localIncline, setLocalIncline] = useState(
    set.inclinePercent !== undefined && set.inclinePercent !== null
      ? String(set.inclinePercent)
      : (set.completed ? '0' : '')
  );
  const [localSpeed, setLocalSpeed] = useState(
    set.speedKph !== undefined && set.speedKph !== null && set.speedKph > 0
      ? String(set.speedKph)
      : ''
  );
  const [localDurationMinutes, setLocalDurationMinutes] = useState(
    set.durationSeconds !== undefined && set.durationSeconds !== null && set.durationSeconds > 0
      ? String(Math.round((set.durationSeconds / 60) * 100) / 100)
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
    if (isTreadmill) {
      if (set.inclinePercent !== undefined && set.inclinePercent !== null) {
        setLocalIncline(String(set.inclinePercent));
      } else {
        setLocalIncline(set.completed ? '0' : '');
      }
      if (set.speedKph !== undefined && set.speedKph !== null) {
        setLocalSpeed(set.speedKph === 0 ? '' : String(set.speedKph));
      } else {
        setLocalSpeed('');
      }
      if (set.durationSeconds !== undefined && set.durationSeconds !== null && set.durationSeconds > 0) {
        const mins = Math.round((set.durationSeconds / 60) * 100) / 100;
        setLocalDurationMinutes(String(mins));
      } else {
        setLocalDurationMinutes('');
      }
    } else {
      if (set.completed) {
        setLocalWeight(set.weight !== undefined && set.weight !== null ? String(set.weight) : '');
        setLocalReps(set.reps !== undefined && set.reps !== null ? String(set.reps) : '');
        setLocalRir(set.rir !== undefined && set.rir !== null ? String(set.rir) : '');
      } else {
        if (set.weight !== undefined && set.weight !== null) {
          setLocalWeight(set.weight === 0 ? '' : String(set.weight));
        }
        if (set.reps !== undefined && set.reps !== null) {
          setLocalReps(set.reps === 0 ? '' : String(set.reps));
        }
        if (set.rir !== undefined && set.rir !== null) {
          setLocalRir(String(set.rir));
        }
      }
    }
    setLocalNotes(set.notes ?? '');
  }, [
    isTreadmill,
    set.completed,
    set.weight,
    set.reps,
    set.rir,
    set.inclinePercent,
    set.speedKph,
    set.durationSeconds,
    set.notes,
  ]);

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

  // Treadmill metric changes:
  const handleInclineChange = useCallback((val: string) => {
    setLocalIncline(val);
    onUpdateSetField(exercise.exerciseId, set.id, 'inclinePercent', val);
  }, [exercise.exerciseId, set.id, onUpdateSetField]);

  const handleSpeedChange = useCallback((val: string) => {
    setLocalSpeed(val);
    onUpdateSetField(exercise.exerciseId, set.id, 'speedKph', val);
  }, [exercise.exerciseId, set.id, onUpdateSetField]);

  const handleDurationChange = useCallback((val: string) => {
    setLocalDurationMinutes(val);
    const parsedMins = parseFloat(val);
    if (!isNaN(parsedMins) && parsedMins > 0) {
      const totalSec = Math.round(parsedMins * 60);
      onUpdateSetField(exercise.exerciseId, set.id, 'durationSeconds', String(totalSec));
    } else {
      onUpdateSetField(exercise.exerciseId, set.id, 'durationSeconds', '');
    }
  }, [exercise.exerciseId, set.id, onUpdateSetField]);

  const handleNotesChange = useCallback((val: string) => {
    const clamped = clampText(val, DOMAIN_LIMITS.SET_NOTES_MAX_LENGTH);
    setLocalNotes(clamped);
    onUpdateSetField(exercise.exerciseId, set.id, 'notes', clamped);
  }, [exercise.exerciseId, set.id, onUpdateSetField]);

  const handleCloseNotes = useCallback(() => {
    if (onCloseNotes) {
      onCloseNotes(set.id);
    } else {
      onToggleNotes(set.id);
    }
  }, [onCloseNotes, onToggleNotes, set.id]);

  const commitWeight = useCallback(() => {
    onUpdateSetField(exercise.exerciseId, set.id, 'weight', localWeight);
  }, [exercise.exerciseId, set.id, onUpdateSetField, localWeight]);

  const commitReps = useCallback(() => {
    onUpdateSetField(exercise.exerciseId, set.id, 'reps', localReps);
  }, [exercise.exerciseId, set.id, onUpdateSetField, localReps]);

  const commitRir = useCallback(() => {
    onUpdateSetField(exercise.exerciseId, set.id, 'rir', localRir);
  }, [exercise.exerciseId, set.id, onUpdateSetField, localRir]);

  const commitIncline = useCallback(() => {
    onUpdateSetField(exercise.exerciseId, set.id, 'inclinePercent', localIncline);
  }, [exercise.exerciseId, set.id, onUpdateSetField, localIncline]);

  const commitSpeed = useCallback(() => {
    onUpdateSetField(exercise.exerciseId, set.id, 'speedKph', localSpeed);
  }, [exercise.exerciseId, set.id, onUpdateSetField, localSpeed]);

  const commitDuration = useCallback(() => {
    const parsedMins = parseFloat(localDurationMinutes);
    if (!isNaN(parsedMins) && parsedMins > 0) {
      const totalSec = Math.round(parsedMins * 60);
      onUpdateSetField(exercise.exerciseId, set.id, 'durationSeconds', String(totalSec));
    } else {
      onUpdateSetField(exercise.exerciseId, set.id, 'durationSeconds', '');
    }
  }, [exercise.exerciseId, set.id, onUpdateSetField, localDurationMinutes]);

  const handleToggleComplete = useCallback(() => {
    if (isTreadmill) {
      let durationSeconds: number | undefined;
      if (localDurationMinutes.trim()) {
        const parsedMins = parseFloat(localDurationMinutes);
        if (!isNaN(parsedMins) && parsedMins > 0) {
          durationSeconds = Math.round(parsedMins * 60);
        }
      }
      let speedKph: number | undefined;
      if (localSpeed.trim()) {
        const parsedSpeed = parseFloat(localSpeed);
        if (!isNaN(parsedSpeed) && parsedSpeed > 0) {
          speedKph = parsedSpeed;
        }
      }
      let inclinePercent: number | undefined;
      if (localIncline.trim()) {
        const parsedIncline = parseFloat(localIncline);
        if (!isNaN(parsedIncline) && parsedIncline >= 0) {
          inclinePercent = parsedIncline;
        }
      }
      onToggleCompleteSet(exercise, set, {
        ...(inclinePercent !== undefined ? { inclinePercent } : {}),
        ...(speedKph !== undefined ? { speedKph } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      });
    } else {
      const pendingUpdates: Partial<WorkoutSet> = {};
      if (localWeight.trim()) {
        const w = parseFloat(localWeight);
        if (!isNaN(w) && w >= 0) pendingUpdates.weight = w;
      }
      if (localReps.trim()) {
        const r = parseInt(localReps, 10);
        if (!isNaN(r) && r > 0) pendingUpdates.reps = r;
      }
      if (localRir.trim()) {
        const rir = parseFloat(localRir);
        if (!isNaN(rir) && rir >= DOMAIN_LIMITS.RIR_MIN && rir <= DOMAIN_LIMITS.RIR_MAX) pendingUpdates.rir = rir;
      }
      onToggleCompleteSet(exercise, set, pendingUpdates);
    }
  }, [
    isTreadmill,
    localIncline,
    localSpeed,
    localDurationMinutes,
    localWeight,
    localReps,
    localRir,
    exercise,
    set,
    onToggleCompleteSet,
  ]);

  // Format Previous set
  const formatPrevious = (prev?: WorkoutSet) => {
    if (!prev) return '—';
    if (isTreadmill) {
      if ((prev.speedKph ?? 0) > 0 || (prev.durationSeconds ?? 0) > 0) {
        return formatTreadmillSet(prev, isCompact);
      }
      return '—';
    }
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
  const resolvedSetIndex = setIndex !== undefined ? setIndex : Math.max(0, set.setNumber - 1);
  const canQuickFillPrev = Boolean(
    previousSet &&
      previousText !== '—' &&
      (isTreadmill
        ? (previousSet.speedKph ?? 0) > 0 || (previousSet.durationSeconds ?? 0) > 0
        : (previousSet.weight ?? 0) > 0 || (previousSet.reps ?? 0) > 0),
  );

  const handleQuickFillPrevious = useCallback(() => {
    if (!previousSet) return;
    if (isTreadmill) {
      if (
        localIncline.trim() === '' &&
        previousSet.inclinePercent !== undefined &&
        previousSet.inclinePercent !== null
      ) {
        const nextInc = String(previousSet.inclinePercent);
        setLocalIncline(nextInc);
        onUpdateSetField(exercise.exerciseId, set.id, 'inclinePercent', nextInc);
      }
      if (
        localSpeed.trim() === '' &&
        previousSet.speedKph !== undefined &&
        previousSet.speedKph !== null &&
        previousSet.speedKph > 0
      ) {
        const nextSpd = String(previousSet.speedKph);
        setLocalSpeed(nextSpd);
        onUpdateSetField(exercise.exerciseId, set.id, 'speedKph', nextSpd);
      }
      if (
        localDurationMinutes.trim() === '' &&
        previousSet.durationSeconds !== undefined &&
        previousSet.durationSeconds !== null &&
        previousSet.durationSeconds > 0
      ) {
        const nextMins = String(Math.round((previousSet.durationSeconds / 60) * 100) / 100);
        setLocalDurationMinutes(nextMins);
        onUpdateSetField(exercise.exerciseId, set.id, 'durationSeconds', String(previousSet.durationSeconds));
      }
    } else {
      if (
        localWeight.trim() === '' &&
        previousSet.weight !== undefined &&
        previousSet.weight !== null
      ) {
        const nextWeight = String(previousSet.weight);
        setLocalWeight(nextWeight);
        onUpdateSetField(exercise.exerciseId, set.id, 'weight', nextWeight);
      }
      if (
        localReps.trim() === '' &&
        previousSet.reps !== undefined &&
        previousSet.reps !== null &&
        previousSet.reps > 0
      ) {
        const nextReps = String(previousSet.reps);
        setLocalReps(nextReps);
        onUpdateSetField(exercise.exerciseId, set.id, 'reps', nextReps);
      }
    }
  }, [
    isTreadmill,
    exercise.exerciseId,
    localIncline,
    localSpeed,
    localDurationMinutes,
    localReps,
    localWeight,
    onUpdateSetField,
    previousSet,
    set.id,
  ]);

  const hasExistingNote = Boolean(localNotes && localNotes.trim().length > 0);
  const isExpanded = isNotesExpanded !== undefined ? isNotesExpanded : hasExistingNote;

  // Display duration: while editing, shows decimal minutes (e.g. "12.5"); when blurred, shows mm:ss (e.g. "12:30")
  const displayDuration = useMemo(() => {
    if (activeFocusField === 'durationMinutes') {
      return localDurationMinutes;
    }
    if (set.durationSeconds && set.durationSeconds > 0) {
      return formatTreadmillDuration(set.durationSeconds);
    }
    if (localDurationMinutes.trim()) {
      const parsed = parseFloat(localDurationMinutes);
      if (!isNaN(parsed) && parsed > 0) {
        return formatTreadmillDuration(Math.round(parsed * 60));
      }
    }
    return '';
  }, [activeFocusField, localDurationMinutes, set.durationSeconds]);

  return (
    <View
      testID={`active-set-row-${set.id}`}
      style={[
        styles.rowWrapper,
        set.completed ? styles.rowWrapperCompleted : null,
      ]}
    >
      {/* Main Tabular Row: Strength: [SET] [PREV] [KG] [REPS] [RIR] [✓] [NOTE] [DEL] */}
      {/*                   Treadmill: [SET] [PREV] [INCLINE] [SPEED] [TIME] [✓] [NOTE] [DEL] */}
      <View style={styles.mainRow}>
        {/* Set Type / Number Interactive Badge */}
        {isTreadmill ? (
          <View style={styles.colSetTouch}>
            <View style={[styles.setNumberBadge, styles.badgeNormal]}>
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
          </View>
        ) : (
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
        )}

        {/* Previous Performance (One-Tap Quick-Fill When Non-Empty) */}
        <View style={styles.colPrev}>
          {canQuickFillPrev ? (
            <Pressable
              testID={`prev-quick-fill-${resolvedSetIndex}`}
              onPress={handleQuickFillPrevious}
              hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
              style={({ pressed }) => [
                styles.prevQuickFillPill,
                pressed && styles.prevQuickFillPillPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Quick fill set ${set.setNumber} from previous ${previousText}`}
            >
              <Text
                variant="caption"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.prevText, styles.prevTextInteractive]}
              >
                {previousText}
              </Text>
            </Pressable>
          ) : (
            <Text
              variant="caption"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                styles.prevText,
                !previousSet ? styles.prevTextEmpty : null,
              ]}
            >
              {previousText}
            </Text>
          )}
        </View>

        {isTreadmill ? (
          <>
            {/* Incline (%) */}
            <View style={styles.colKg}>
              <TextInput
                testID={`set-incline-${exercise.exerciseId}-${set.setNumber}`}
                value={localIncline}
                placeholder="%"
                placeholderTextColor="#64748B"
                keyboardType="decimal-pad"
                selectTextOnFocus
                showSoftInputOnFocus={!isCustomKeypadActive}
                inputMode={isCustomKeypadActive ? 'none' : 'decimal'}
                onFocus={() =>
                  onFocusField?.(exercise.exerciseId, set.id, 'inclinePercent', localIncline)
                }
                onChangeText={handleInclineChange}
                onBlur={commitIncline}
                onSubmitEditing={commitIncline}
                style={[
                  styles.metricInput,
                  set.completed ? styles.metricInputCompleted : null,
                  activeFocusField === 'inclinePercent' && styles.metricInputFocused,
                ]}
              />
            </View>

            {/* Speed (km/h) */}
            <View style={styles.colReps}>
              <TextInput
                testID={`set-speed-${exercise.exerciseId}-${set.setNumber}`}
                value={localSpeed}
                placeholder="km/h"
                placeholderTextColor="#64748B"
                keyboardType="decimal-pad"
                selectTextOnFocus
                showSoftInputOnFocus={!isCustomKeypadActive}
                inputMode={isCustomKeypadActive ? 'none' : 'decimal'}
                onFocus={() =>
                  onFocusField?.(exercise.exerciseId, set.id, 'speedKph', localSpeed)
                }
                onChangeText={handleSpeedChange}
                onBlur={commitSpeed}
                onSubmitEditing={commitSpeed}
                style={[
                  styles.metricInput,
                  set.completed ? styles.metricInputCompleted : null,
                  activeFocusField === 'speedKph' && styles.metricInputFocused,
                ]}
              />
            </View>

            {/* Time (decimal min while focused, mm:ss when blurred) */}
            <View style={styles.colRir}>
              <TextInput
                testID={`set-time-${exercise.exerciseId}-${set.setNumber}`}
                value={displayDuration}
                placeholder="min"
                placeholderTextColor="#64748B"
                keyboardType="decimal-pad"
                selectTextOnFocus
                showSoftInputOnFocus={!isCustomKeypadActive}
                inputMode={isCustomKeypadActive ? 'none' : 'decimal'}
                onFocus={() =>
                  onFocusField?.(exercise.exerciseId, set.id, 'durationMinutes', localDurationMinutes)
                }
                onChangeText={handleDurationChange}
                onBlur={commitDuration}
                onSubmitEditing={commitDuration}
                style={[
                  styles.metricInput,
                  styles.metricInputRir,
                  set.completed ? styles.metricInputCompleted : null,
                  activeFocusField === 'durationMinutes' && styles.metricInputFocused,
                ]}
              />
            </View>
          </>
        ) : (
          <>
            {/* Weight (kg) */}
            <View style={styles.colKg}>
              <TextInput
                testID={`set-weight-${exercise.exerciseId}-${set.setNumber}`}
                value={localWeight}
                placeholder="kg"
                placeholderTextColor="#64748B"
                keyboardType="decimal-pad"
                selectTextOnFocus
                showSoftInputOnFocus={!isCustomKeypadActive}
                inputMode={isCustomKeypadActive ? 'none' : 'decimal'}
                onFocus={() =>
                  onFocusField?.(exercise.exerciseId, set.id, 'weight', localWeight)
                }
                onChangeText={handleWeightChange}
                onBlur={commitWeight}
                onSubmitEditing={commitWeight}
                style={[
                  styles.metricInput,
                  set.completed ? styles.metricInputCompleted : null,
                  activeFocusField === 'weight' && styles.metricInputFocused,
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
                showSoftInputOnFocus={!isCustomKeypadActive}
                inputMode={isCustomKeypadActive ? 'none' : 'numeric'}
                onFocus={() =>
                  onFocusField?.(exercise.exerciseId, set.id, 'reps', localReps)
                }
                onChangeText={handleRepsChange}
                onBlur={commitReps}
                onSubmitEditing={commitReps}
                style={[
                  styles.metricInput,
                  set.completed ? styles.metricInputCompleted : null,
                  activeFocusField === 'reps' && styles.metricInputFocused,
                ]}
              />
            </View>

            {/* RIR (Standard Numeric Input Column - Reverted to v2.6.0) */}
            <View style={styles.colRir}>
              <TextInput
                testID={`set-rir-${exercise.exerciseId}-${set.setNumber}`}
                value={localRir}
                placeholder="RIR"
                placeholderTextColor="#64748B"
                keyboardType="decimal-pad"
                selectTextOnFocus
                showSoftInputOnFocus={!isCustomKeypadActive}
                inputMode={isCustomKeypadActive ? 'none' : 'decimal'}
                onFocus={() =>
                  onFocusField?.(exercise.exerciseId, set.id, 'rir', localRir)
                }
                onChangeText={handleRirChange}
                onBlur={commitRir}
                onSubmitEditing={commitRir}
                style={[
                  styles.metricInput,
                  styles.metricInputRir,
                  set.completed ? styles.metricInputCompleted : null,
                  activeFocusField === 'rir' && styles.metricInputFocused,
                ]}
              />
            </View>
          </>
        )}

        {/* Action Buttons Group: Complete, Note, Delete (>=44x44 non-overlapping targets) */}
        <View
          testID={`action-buttons-${exercise.exerciseId}-${set.id}`}
          style={styles.actionButtons}
        >
        {/* Compact Complete Button */}
        <View style={styles.colCheck}>
          <Pressable
            testID={`complete-set-${exercise.exerciseId}-${set.setNumber}`}
            onPress={handleToggleComplete}
            hitSlop={7}
            style={styles.touchTargetBoxCheck}
            accessibilityLabel={
              set.completed
                ? `Set ${set.setNumber} completed. Tap to mark uncompleted.`
                : `Set ${set.setNumber} pending. Tap to mark complete.`
            }
            accessibilityRole="checkbox"
            accessibilityState={{ checked: set.completed }}
          >
            <View
              style={[
                styles.checkButton,
                set.completed ? styles.checkButtonDone : styles.checkButtonPending,
              ]}
            >
              <Icon
                name="check"
                size={14}
                strokeWidth={3}
                color={set.completed ? colors.background : colors.textMuted}
              />
            </View>
          </Pressable>
        </View>

        {/* Note Toggle Button */}
        <View style={styles.colNote}>
          <Pressable
            testID={`set-note-toggle-${exercise.exerciseId}-${set.setNumber}`}
            onPress={() => onToggleNotes(set.id)}
            hitSlop={9}
            style={styles.touchTargetBoxSmall}
            accessibilityLabel={
              hasExistingNote
                ? `Edit note for set ${set.setNumber}: ${set.notes}`
                : `Add note for set ${set.setNumber}`
            }
            accessibilityRole="button"
          >
            <View
              style={[
                styles.noteButton,
                hasExistingNote && styles.noteButtonActive,
              ]}
            >
              <Icon
                name="edit"
                size={13}
                color={hasExistingNote ? colors.primary : colors.textMuted}
              />
              {hasExistingNote ? (
                <View
                  testID={`set-note-indicator-${exercise.exerciseId}-${set.setNumber}`}
                  style={styles.noteIndicatorDot}
                />
              ) : null}
            </View>
          </Pressable>
        </View>

        {/* Delete Set Button */}
        <View style={styles.colDelete}>
          {canDelete && !set.completed ? (
            <Pressable
              testID={`delete-set-${exercise.exerciseId}-${set.id}`}
              onPress={() => onDeleteSet(exercise.exerciseId, set.id)}
              hitSlop={9}
              style={styles.touchTargetBoxSmall}
              accessibilityLabel={`Delete set ${set.setNumber}`}
              accessibilityRole="button"
            >
              <View style={styles.deleteButton}>
                <Icon name="close" size={13} color={colors.textMuted} />
              </View>
            </Pressable>
          ) : null}
        </View>
        </View>
      </View>

      {/* Collapsed Note Preview Row (visible beneath both strength & treadmill rows) */}
      {!isExpanded && hasExistingNote ? (
        <Pressable
          testID={`set-note-preview-${exercise.exerciseId}-${set.setNumber}`}
          onPress={() => onToggleNotes(set.id)}
          style={styles.notePreviewRow}
          accessibilityLabel={`Note for set ${set.setNumber}: ${localNotes || set.notes}`}
          accessibilityRole="button"
        >
          <Icon name="edit" size={11} color={colors.primary} />
          <Text
            variant="caption"
            numberOfLines={2}
            style={styles.notePreviewText}
          >
            {(localNotes || set.notes || '').trim()}
          </Text>
        </Pressable>
      ) : null}

      {/* Expanded Inline Notes Row */}
      {isExpanded ? (
        <View style={styles.inlineNotesRow} testID={`inline-notes-${set.id}`}>
          <TextInput
            testID={`set-notes-${exercise.exerciseId}-${set.setNumber}`}
            value={localNotes}
            placeholder="Add note for this set (e.g. paused at bottom, felt easy)..."
            placeholderTextColor={colors.textMuted}
            onChangeText={handleNotesChange}
            maxLength={DOMAIN_LIMITS.SET_NOTES_MAX_LENGTH}
            style={styles.notesInput}
            returnKeyType="done"
            onSubmitEditing={handleCloseNotes}
          />
          {localNotes.length > 0 ? (
            <Pressable
              testID={`clear-set-note-${exercise.exerciseId}-${set.setNumber}`}
              onPress={() => handleNotesChange('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearNoteButton}
              accessibilityRole="button"
              accessibilityLabel="Clear note"
            >
              <Text style={styles.clearNoteText}>×</Text>
            </Pressable>
          ) : null}
          <Pressable
            testID={`done-set-note-${exercise.exerciseId}-${set.setNumber}`}
            onPress={handleCloseNotes}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.doneNoteButton}
            accessibilityRole="button"
            accessibilityLabel="Done editing note"
          >
            <Text style={styles.doneNoteText}>Done</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Modal: Set Type Selector */}
      <Modal
        visible={isTypeSelectorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTypeSelectorOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsTypeSelectorOpen(false)}
          testID="type-selector-backdrop"
        >
          <Pressable style={styles.typeSelectorCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalDragHandle} />
            <View style={styles.typeSelectorHeader}>
              <Text variant="titleMedium" color="primary" style={styles.typeSelectorTitle}>
                Select Set Type
              </Text>
              <Text variant="caption" color="muted" style={styles.typeSelectorSubtitle}>
                Tag set intensity for targeted volume analysis
              </Text>
            </View>

            <View style={styles.typeOptionList}>
              {/* Normal */}
              <Pressable
                testID="set-type-option-normal"
                onPress={() => handleSelectSetType('normal')}
                style={[
                  styles.typeOptionItem,
                  (!set.setType || set.setType === 'normal') && styles.typeOptionItemActive,
                ]}
              >
                <View style={[styles.typeOptionIconWrap, styles.badgeNormal]}>
                  <Text style={[styles.typeOptionIconText, styles.badgeTextNormal]}>
                    {set.setNumber}
                  </Text>
                </View>
                <View style={styles.typeOptionTexts}>
                  <Text style={styles.typeOptionLabel}>Normal Set</Text>
                  <Text style={styles.typeOptionDesc}>Standard working set towards targets</Text>
                </View>
                {(!set.setType || set.setType === 'normal') && (
                  <Text style={styles.typeOptionCheckmark}>✓</Text>
                )}
              </Pressable>

              {/* Warmup */}
              <Pressable
                testID="set-type-option-warmup"
                onPress={() => handleSelectSetType('warmup')}
                style={[
                  styles.typeOptionItem,
                  set.setType === 'warmup' && styles.typeOptionItemActive,
                ]}
              >
                <View style={[styles.typeOptionIconWrap, styles.badgeWarmup]}>
                  <Text style={[styles.typeOptionIconText, styles.badgeTextWarmup]}>W</Text>
                </View>
                <View style={styles.typeOptionTexts}>
                  <Text style={styles.typeOptionLabel}>Warm-up Set</Text>
                  <Text style={styles.typeOptionDesc}>Light set to prepare muscles & joints</Text>
                </View>
                {set.setType === 'warmup' && (
                  <Text style={styles.typeOptionCheckmark}>✓</Text>
                )}
              </Pressable>

              {/* Drop */}
              <Pressable
                testID="set-type-option-drop"
                onPress={() => handleSelectSetType('drop')}
                style={[
                  styles.typeOptionItem,
                  set.setType === 'drop' && styles.typeOptionItemActive,
                ]}
              >
                <View style={[styles.typeOptionIconWrap, styles.badgeDrop]}>
                  <Text style={[styles.typeOptionIconText, styles.badgeTextDrop]}>D</Text>
                </View>
                <View style={styles.typeOptionTexts}>
                  <Text style={styles.typeOptionLabel}>Drop Set</Text>
                  <Text style={styles.typeOptionDesc}>Immediate weight reduction after failure</Text>
                </View>
                {set.setType === 'drop' && (
                  <Text style={styles.typeOptionCheckmark}>✓</Text>
                )}
              </Pressable>

              {/* Failure */}
              <Pressable
                testID="set-type-option-failure"
                onPress={() => handleSelectSetType('failure')}
                style={[
                  styles.typeOptionItem,
                  set.setType === 'failure' && styles.typeOptionItemActive,
                ]}
              >
                <View style={[styles.typeOptionIconWrap, styles.badgeFailure]}>
                  <Text style={[styles.typeOptionIconText, styles.badgeTextFailure]}>F</Text>
                </View>
                <View style={styles.typeOptionTexts}>
                  <Text style={styles.typeOptionLabel}>Failure Set</Text>
                  <Text style={styles.typeOptionDesc}>Pushed to complete mechanical failure</Text>
                </View>
                {set.setType === 'failure' && (
                  <Text style={styles.typeOptionCheckmark}>✓</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              onPress={() => setIsTypeSelectorOpen(false)}
              style={styles.closeButton}
              testID="type-selector-close-button"
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

const createStyles = (colors: any, isCompact: boolean) =>
  StyleSheet.create({
    rowWrapper: {
      paddingVertical: 3,
      paddingHorizontal: 2,
      borderRadius: 10,
    },
    rowWrapperCompleted: {
      backgroundColor: 'rgba(56, 189, 248, 0.04)',
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 38,
      gap: 4,
    },
    colSetTouch: {
      width: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    setNumberBadge: {
      width: isCompact ? 26 : 30,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
    },
    setNumberText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      ...NUMERIC_TABULAR_STYLE,
    },
    setNumberTextCompleted: {
      color: colors.primary,
    },
    colPrev: {
      width: 66,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    prevText: {
      fontSize: 11,
      color: '#94A3B8',
      fontWeight: '600',
      textAlign: 'center',
      ...NUMERIC_TABULAR_STYLE,
    },
    prevTextEmpty: {
      color: '#475569',
      fontStyle: 'italic',
    },
    prevTextInteractive: {
      color: colors.primary,
      fontWeight: '700',
    },
    prevQuickFillPill: {
      backgroundColor: 'rgba(56, 189, 248, 0.08)',
      borderColor: 'rgba(56, 189, 248, 0.28)',
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 3,
      paddingVertical: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prevQuickFillPillPressed: {
      backgroundColor: 'rgba(56, 189, 248, 0.22)',
      transform: [{ scale: 0.96 }],
    },
    colKg: {
      flex: 1.15,
      minWidth: 42,
      maxWidth: 54,
    },
    colReps: {
      flex: 1.0,
      minWidth: 38,
      maxWidth: 48,
    },
    colRir: {
      flex: 0.85,
      minWidth: 32,
      maxWidth: 40,
      position: 'relative',
    },
    metricInput: {
      height: 34,
      backgroundColor: '#141824',
      borderWidth: 1,
      borderColor: '#242C3D',
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 0,
      color: colors.textPrimary,
      fontSize: isCompact ? 13 : 14,
      fontWeight: '700',
      fontFamily: FONT_FAMILIES.heading,
      textAlign: 'center',
      ...NUMERIC_TABULAR_STYLE,
    },
    metricInputCompleted: {
      backgroundColor: '#0F1420',
      borderColor: 'rgba(56, 189, 248, 0.22)',
      color: colors.primary,
    },
    metricInputFocused: {
      borderColor: colors.primary || '#38BDF8',
      borderWidth: 1.5,
      backgroundColor: '#1A2234',
    },
    metricInputRir: {
      color: colors.textSecondary,
      fontSize: isCompact ? 12 : 13,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    colCheck: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    touchTargetBoxCheck: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    touchTargetBoxSmall: {
      width: 26,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkButton: {
      width: isCompact ? 28 : 32,
      height: 32,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkButtonPending: {
      backgroundColor: '#1E293B',
      borderWidth: 1,
      borderColor: '#334155',
    },
    checkButtonDone: {
      backgroundColor: colors.primary,
      borderWidth: 0,
      borderColor: 'transparent',
    },
    colNote: {
      width: 26,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteButton: {
      width: isCompact ? 24 : 26,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    noteButtonActive: {
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
    },
    noteIndicatorDot: {
      position: 'absolute',
      top: 4,
      right: 3,
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.primary,
    },
    notePreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      marginHorizontal: 2,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: 'rgba(56, 189, 248, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.2)',
    },
    notePreviewText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
    },
    inlineNotesRow: {
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
    colDelete: {
      width: 26,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButton: {
      width: isCompact ? 24 : 26,
      height: 32,
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
