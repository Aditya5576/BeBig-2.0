import React, { useState } from 'react';
import { View, StyleSheet, Pressable, LayoutChangeEvent, useWindowDimensions, Modal, TextInput } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Card, Button, Icon } from '../../../components/ui';
import { DOMAIN_LIMITS } from '../../../constants/domainLimits';
import { WorkoutExercise, WorkoutSet } from '../types';
import { SupersetDisplayInfo } from '../utils/supersetUtils';
import {
  findMatchingPreviousSet,
  computeBestLastSetNudge,
  ProgressiveOverloadNudge,
} from '../services/previousPerformanceService';
import { ActiveSetRow, ActiveFocusField } from './ActiveSetRow';
import { radii } from '../../../constants/theme';
import { FONT_FAMILIES, NUMERIC_TABULAR_STYLE } from '../../../theme/typography';
import {
  isTreadmillExercise,
  formatTreadmillSet,
  calculateTreadmillExerciseTotals,
  formatTreadmillDuration,
} from '../utils/treadmillMetrics';

export interface ActiveExerciseCardProps {
  exercise: WorkoutExercise;
  exIndex: number;
  totalExercisesCount: number;
  supersetInfo?: SupersetDisplayInfo;
  lastPerformance?: { workoutDate?: string; sets: WorkoutSet[] };
  overloadNudge?: ProgressiveOverloadNudge | null;
  expandedNotesSetIds: Record<string, boolean>;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onLinkSuperset?: (index: number) => void;
  onUnlinkSuperset?: (index: number) => void;
  onRemoveExercise: (exercise: WorkoutExercise) => void;
  onAddSet: (exerciseId: string) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
  onToggleNotes: (setId: string) => void;
  onCloseNotes?: (setId: string) => void;
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
  onPressExerciseDetail?: (exerciseId: string, exerciseName: string) => void;
  onRenameExercise?: (exerciseId: string, newName: string) => Promise<void> | void;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: any;
  isCustomKeypadActive?: boolean;
  activeFocusSetId?: string | null;
  activeFocusField?: ActiveFocusField | null;
  onFocusField?: (
    exerciseId: string,
    setId: string,
    field: ActiveFocusField,
    currentValue: string
  ) => void;
}

const formatShortDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const ActiveExerciseCard = React.memo<ActiveExerciseCardProps>(function ActiveExerciseCard({
  exercise,
  exIndex,
  totalExercisesCount,
  supersetInfo,
  lastPerformance,
  overloadNudge,
  expandedNotesSetIds,
  onMoveUp,
  onMoveDown,
  onLinkSuperset,
  onUnlinkSuperset,
  onRemoveExercise,
  onAddSet,
  onDeleteSet,
  onToggleNotes,
  onCloseNotes,
  onUpdateSetField,
  onToggleCompleteSet,
  onPressExerciseDetail,
  onRenameExercise,
  onLayout,
  style,
  isCustomKeypadActive,
  activeFocusSetId,
  activeFocusField,
  onFocusField,
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width: windowWidth } = useWindowDimensions();
  const [isLastSessionExpanded, setIsLastSessionExpanded] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renameText, setRenameText] = useState(exercise.exerciseName);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const handleConfirmRename = async () => {
    if (!onRenameExercise) return;
    const trimmed = renameText.trim();
    if (!trimmed) {
      setRenameError('Exercise name is required.');
      return;
    }
    try {
      setRenameSaving(true);
      setRenameError(null);
      await onRenameExercise(exercise.exerciseId, trimmed);
      setIsRenameModalVisible(false);
    } catch (err: any) {
      setRenameError(err?.message || 'Could not rename exercise.');
    } finally {
      setRenameSaving(false);
    }
  };

  const isTreadmill = isTreadmillExercise(exercise);
  const resolvedOverloadNudge = isTreadmill
    ? null
    : overloadNudge !== undefined
    ? overloadNudge
    : computeBestLastSetNudge(lastPerformance);

  const treadmillTotals = isTreadmill ? calculateTreadmillExerciseTotals(exercise) : null;

  const isCompact = windowWidth < 400;
  const colGap = 4;
  const colSetWidth = 28;
  const colPrevWidth = 66;
  const minKg = 42;
  const minReps = 38;
  const minRir = 32;

  const hasPlannedTargets = Boolean(
    exercise.plannedSets ||
      exercise.plannedTargetReps ||
      exercise.plannedRestTime ||
      exercise.plannedTargetWeight ||
      exercise.plannedTargetInclinePercent !== undefined ||
      exercise.plannedTargetSpeedKph !== undefined ||
      exercise.plannedTargetDurationSeconds !== undefined
  );
  const lastSessionDateText = formatShortDate(lastPerformance?.workoutDate);

  return (
    <Card
      key={exercise.exerciseId}
      style={[
        styles.exerciseCard,
        supersetInfo?.isInGroup && {
          borderLeftWidth: 4,
          borderLeftColor: supersetInfo.accentColor,
          borderColor:
            supersetInfo.groupType === 'giant_set'
              ? 'rgba(56, 189, 248, 0.28)'
              : 'rgba(0, 229, 153, 0.28)',
        },
        style,
      ]}
      onLayout={onLayout}
    >
      {/* Exercise Header — Two-Tier Architecture */}
      <View style={styles.exerciseCardHeader}>
        {/* Tier 1: Top Metadata & Action Strip */}
        <View style={styles.headerTopStrip}>
          <View style={styles.metaLeftGroup}>
            <View style={styles.indexBadge}>
              <Text variant="caption" color="accent" style={styles.indexBadgeText}>
                #{exIndex + 1}
              </Text>
            </View>
            {supersetInfo?.isInGroup && (
              <View
                style={[
                  styles.supersetPillBadge,
                  {
                    borderColor: supersetInfo.accentColor,
                    backgroundColor:
                      supersetInfo.groupType === 'giant_set'
                        ? 'rgba(56, 189, 248, 0.12)'
                        : 'rgba(0, 229, 153, 0.12)',
                  },
                ]}
                testID={`superset-badge-${exercise.exerciseId}`}
              >
                <Text
                  style={[
                    styles.supersetPillText,
                    { color: supersetInfo.accentColor },
                  ]}
                >
                  {supersetInfo.groupLabel}
                </Text>
              </View>
            )}
            {exercise.categoryName ? (
              <Text variant="caption" color="muted" style={styles.categoryTag} numberOfLines={1}>
                {exercise.categoryName}
              </Text>
            ) : null}
          </View>

          <View style={styles.exerciseHeaderActions}>
            {/* Superset Link / Unlink Button */}
            {supersetInfo?.isInGroup ? (
              onUnlinkSuperset && (
                <Pressable
                  testID={`superset-unlink-button-${exercise.exerciseId}`}
                  onPress={() => onUnlinkSuperset(exIndex)}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                  style={styles.supersetActionButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Unlink ${exercise.exerciseName} from ${supersetInfo.groupLabel}`}
                >
                  <View style={styles.supersetActionContent}>
                    <Icon name="unlink" size={13} strokeWidth={2.2} color={colors.textMuted} />
                    <Text style={[styles.supersetActionText, { color: colors.textMuted }]}>
                      Unlink
                    </Text>
                  </View>
                </Pressable>
              )
            ) : (
              exIndex < totalExercisesCount - 1 && onLinkSuperset && (
                <Pressable
                  testID={`superset-link-button-${exercise.exerciseId}`}
                  onPress={() => onLinkSuperset(exIndex)}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                  style={styles.supersetActionButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Link ${exercise.exerciseName} with next exercise into superset`}
                >
                  <View style={styles.supersetActionContent}>
                    <Icon name="link" size={13} strokeWidth={2.2} color={colors.primary} />
                    <Text style={[styles.supersetActionText, { color: colors.primary }]}>
                      + Superset
                    </Text>
                  </View>
                </Pressable>
              )
            )}

            {/* Reorder Up / Down Controls */}
            <View style={styles.reorderControlGroup}>
              <Pressable
                testID={`move-up-exercise-${exercise.exerciseId}`}
                onPress={() => onMoveUp(exIndex)}
                disabled={exIndex === 0}
                style={[styles.reorderButton, exIndex === 0 && styles.reorderButtonDisabled]}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                accessibilityLabel={`Move ${exercise.exerciseName} up`}
              >
                <Icon
                  name="arrowUp"
                  size={14}
                  strokeWidth={2.4}
                  color={exIndex === 0 ? colors.textMuted : colors.primary}
                />
              </Pressable>

              <View style={styles.reorderDivider} />

              <Pressable
                testID={`move-down-exercise-${exercise.exerciseId}`}
                onPress={() => onMoveDown(exIndex)}
                disabled={exIndex === totalExercisesCount - 1}
                style={[
                  styles.reorderButton,
                  exIndex === totalExercisesCount - 1 && styles.reorderButtonDisabled,
                ]}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                accessibilityLabel={`Move ${exercise.exerciseName} down`}
              >
                <Icon
                  name="arrowDown"
                  size={14}
                  strokeWidth={2.4}
                  color={
                    exIndex === totalExercisesCount - 1
                      ? colors.textMuted
                      : colors.primary
                  }
                />
              </Pressable>
            </View>

            <Pressable
              testID={`remove-exercise-${exercise.exerciseId}`}
              onPress={() => onRemoveExercise(exercise)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={styles.removeExButton}
              accessibilityLabel={`Remove ${exercise.exerciseName}`}
            >
              <Icon name="close" size={14} strokeWidth={2.4} color="#94A3B8" />
            </Pressable>
          </View>
        </View>

        {/* Tier 2: Dedicated Full-Width Exercise Name Row */}
        <View style={styles.exerciseNameRow}>
          {onPressExerciseDetail ? (
            <Pressable
              testID={`exercise-detail-trigger-${exercise.exerciseId}`}
              onPress={() => onPressExerciseDetail(exercise.exerciseId, exercise.exerciseName)}
              style={({ pressed }) => [
                styles.exerciseNameTrigger,
                pressed && styles.exerciseNameTriggerPressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`View details and instructions for ${exercise.exerciseName}`}
            >
              <Text style={styles.exerciseName} numberOfLines={2}>
                {exercise.exerciseName}
              </Text>
              <Icon name="chevronRight" size={16} strokeWidth={2.3} color={colors.textMuted} />
            </Pressable>
          ) : (
            <Text style={styles.exerciseName} numberOfLines={2}>
              {exercise.exerciseName}
            </Text>
          )}
          {onRenameExercise ? (
            <Pressable
              testID={`rename-active-exercise-${exercise.exerciseId}`}
              onPress={() => {
                setRenameText(exercise.exerciseName);
                setRenameError(null);
                setIsRenameModalVisible(true);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.renameTriggerButton}
              accessibilityRole="button"
              accessibilityLabel={`Rename ${exercise.exerciseName}`}
            >
              <Icon name="edit" size={14} strokeWidth={2.2} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Consistent Metadata Row: Best Last Badge + Collapsible History Trigger + Planned Targets */}
      {resolvedOverloadNudge || lastPerformance || hasPlannedTargets || (treadmillTotals && treadmillTotals.completedSetsCount > 0) ? (
        <View style={styles.metaBadgeRow}>
          {/* Live Treadmill Summary Pill */}
          {treadmillTotals && treadmillTotals.completedSetsCount > 0 ? (
            <View
              style={styles.overloadNudgePill}
              testID={`treadmill-summary-pill-${exercise.exerciseId}`}
            >
              <Icon name="clock" size={11} strokeWidth={2.3} color={colors.primary} />
              <Text
                variant="caption"
                tabularNums
                style={styles.overloadNudgeText}
                numberOfLines={1}
              >
                {`Completed: ${formatTreadmillDuration(treadmillTotals.totalDurationSeconds)} • ${treadmillTotals.totalDistanceKm.toFixed(2)} km`}
              </Text>
            </View>
          ) : null}

          {resolvedOverloadNudge ? (
            <View
              style={styles.overloadNudgePill}
              testID={`overload-nudge-badge-${exercise.exerciseId}`}
            >
              <Icon name="trophy" size={11} strokeWidth={2.3} color={colors.primary} />
              <Text
                variant="caption"
                tabularNums
                style={styles.overloadNudgeText}
                numberOfLines={1}
              >
                {resolvedOverloadNudge.label}
              </Text>
            </View>
          ) : null}

          {lastPerformance ? (
            <Pressable
              testID={`toggle-last-session-${exercise.exerciseId}`}
              onPress={() => setIsLastSessionExpanded((prev) => !prev)}
              style={({ pressed }) => [
                styles.historyTogglePill,
                isLastSessionExpanded && styles.historyTogglePillActive,
                pressed && styles.exerciseNameTriggerPressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={
                isLastSessionExpanded
                  ? `Hide last session breakdown for ${exercise.exerciseName}`
                  : `Show last session breakdown for ${exercise.exerciseName}`
              }
            >
              <Text variant="caption" style={styles.historyToggleText} numberOfLines={1}>
                {lastSessionDateText ? `History (${lastSessionDateText})` : 'History'}
              </Text>
              <Icon
                name={isLastSessionExpanded ? 'chevronUp' : 'chevronDown'}
                size={12}
                strokeWidth={2.4}
                color={isLastSessionExpanded ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          ) : null}

          {hasPlannedTargets ? (
            <View style={styles.targetsBadge}>
              <Text variant="caption" color="accent" style={styles.targetsText}>
                {isTreadmill ? (
                  `Target: ${exercise.plannedTargetInclinePercent !== undefined ? `${exercise.plannedTargetInclinePercent}%` : '0%'} @ ${exercise.plannedTargetSpeedKph !== undefined ? `${exercise.plannedTargetSpeedKph} km/h` : '5 km/h'} • ${formatTreadmillDuration(exercise.plannedTargetDurationSeconds ?? 600)}`
                ) : (
                  `Target: ${exercise.plannedSets ? `${exercise.plannedSets} sets` : ''}${exercise.plannedTargetReps ? ` × ${exercise.plannedTargetReps} reps` : ''}${exercise.plannedTargetWeight ? ` @ ${exercise.plannedTargetWeight}kg` : ''}${exercise.plannedRestTime ? ` • Rest ${exercise.plannedRestTime}s` : ''}`
                )}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Last Time Performance (Expanded on Demand; Empty State Preserved When No History) */}
      {lastPerformance ? (
        isLastSessionExpanded ? (
          <View
            style={styles.lastTimeContainer}
            testID={`last-time-performance-${exercise.exerciseId}`}
          >
            <View style={styles.lastTimeHeaderRow}>
              <Text variant="caption" style={styles.lastTimeTitle}>
                LAST TIME {lastSessionDateText ? `(${lastSessionDateText})` : ''}
              </Text>
            </View>
            <View style={styles.lastTimeSetsRow}>
              {lastPerformance.sets.map((s, idx, arr) => {
                const separator = idx < arr.length - 1 ? '  •  ' : '';
                if (isTreadmill) {
                  return (
                    <Text
                      key={s.id || idx}
                      variant="caption"
                      color="secondary"
                      style={styles.lastTimeSetChip}
                      testID={`last-time-set-chip-${exercise.exerciseId}-${s.setNumber || idx + 1}`}
                    >
                      {`${formatTreadmillSet(s)}${separator}`}
                    </Text>
                  );
                }
                const tag =
                  s.setType === 'drop'
                    ? 'D '
                    : s.setType === 'warmup'
                    ? 'W '
                    : s.setType === 'failure'
                    ? 'F '
                    : '';
                const weightText = s.weight > 0 ? `${s.weight}kg` : 'BW';
                const rirText = s.rir !== undefined && s.rir !== null ? ` @ RIR ${s.rir}` : '';
                const noteText = s.notes && s.notes.trim().length > 0 ? ' 📝' : '';
                return (
                  <Text
                    key={s.id || idx}
                    variant="caption"
                    color="secondary"
                    style={styles.lastTimeSetChip}
                    testID={`last-time-set-chip-${exercise.exerciseId}-${s.setNumber || idx + 1}`}
                  >
                    {`${tag}${weightText} × ${s.reps}${rirText}${noteText}${separator}`}
                  </Text>
                );
              })}
            </View>
          </View>
        ) : null
      ) : (
        <View
          style={styles.noLastTimeContainer}
          testID={`last-time-empty-${exercise.exerciseId}`}
        >
          <Text variant="caption" color="muted" style={styles.noLastTimeText}>
            No previous performance
          </Text>
        </View>
      )}

      {/* Sets Table Header:
          Strength:  SET | PREV | KG | REPS | RIR | ✓ | NOTE | DEL
          Treadmill: SET | PREV | INCLINE | SPEED | TIME | ✓ | NOTE | DEL
      */}
      <View style={[styles.tableHeaderRow, { gap: colGap }]}>
        <View style={[styles.headerColSet, { width: colSetWidth }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            SET
          </Text>
        </View>
        <View style={[styles.headerColPrev, { width: colPrevWidth }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            {isTreadmill ? 'PREVIOUS' : 'PREV'}
          </Text>
        </View>
        <View style={[styles.headerColKg, { minWidth: minKg }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            {isTreadmill ? 'INCLINE' : 'KG'}
          </Text>
        </View>
        <View style={[styles.headerColReps, { minWidth: minReps }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            {isTreadmill ? 'SPEED' : 'REPS'}
          </Text>
        </View>
        <View style={[styles.headerColRir, { minWidth: minRir }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            {isTreadmill ? 'TIME' : 'RIR'}
          </Text>
        </View>
        <View style={styles.headerActionButtons}>
          <View style={styles.headerColCheck}>
            <Icon name="check" size={12} strokeWidth={2.5} color={colors.textMuted} />
            <Text style={styles.hiddenTestText}>✓</Text>
          </View>
          <View style={styles.headerColNote}>
            <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
              NOTE
            </Text>
          </View>
          <View style={styles.headerColDelete} />
        </View>
      </View>

      {/* Sets List Container */}
      <View style={styles.setsContainer}>
        {exercise.actualSets.map((set, setIndex) => (
          <ActiveSetRow
            key={set.id}
            exercise={exercise}
            set={set}
            setIndex={setIndex}
            previousSet={findMatchingPreviousSet(lastPerformance?.sets, set)}
            canDelete={exercise.actualSets.length > 1 && !set.completed}
            isNotesExpanded={expandedNotesSetIds[set.id]}
            onToggleNotes={onToggleNotes}
            onCloseNotes={onCloseNotes}
            onDeleteSet={onDeleteSet}
            onUpdateSetField={onUpdateSetField}
            onToggleCompleteSet={onToggleCompleteSet}
            isCustomKeypadActive={isCustomKeypadActive}
            activeFocusField={activeFocusSetId === set.id ? activeFocusField : null}
            onFocusField={onFocusField}
          />
        ))}
      </View>

      {/* Add Set Button */}
      <Button
        testID={`add-set-${exercise.exerciseId}`}
        title="+ Add Set"
        onPress={() => onAddSet(exercise.exerciseId)}
        variant="ghost"
        size="md"
        style={styles.addSetButton}
      />

      <Modal
        visible={isRenameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !renameSaving && setIsRenameModalVisible(false)}
      >
        <View style={styles.renameModalBackdrop}>
          <View style={styles.renameModalCard}>
            <Text variant="titleMedium" color="primary">
              Rename Exercise
            </Text>
            <TextInput
              testID={`rename-active-exercise-input-${exercise.exerciseId}`}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Exercise name"
              placeholderTextColor={colors.textMuted}
              maxLength={DOMAIN_LIMITS.EXERCISE_NAME_MAX_LENGTH}
              style={styles.renameModalInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleConfirmRename()}
            />
            {renameError ? (
              <Text variant="caption" style={{ color: colors.error || '#EF4444' }}>
                {renameError}
              </Text>
            ) : null}
            <View style={styles.renameModalActions}>
              <Button
                testID={`cancel-active-exercise-rename-${exercise.exerciseId}`}
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => setIsRenameModalVisible(false)}
                disabled={renameSaving}
              />
              <Button
                testID={`save-active-exercise-rename-${exercise.exerciseId}`}
                title="Save"
                variant="primary"
                size="sm"
                loading={renameSaving}
                onPress={() => void handleConfirmRename()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    exerciseCard: {
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: '#131B2E',
      borderColor: 'rgba(255, 255, 255, 0.06)',
      borderRadius: 14,
      borderWidth: 1,
    },
    exerciseCardHeader: {
      gap: 6,
    },
    headerTopStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    metaLeftGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    categoryTag: {
      color: '#64748B',
      fontWeight: '600',
      fontSize: 11,
      letterSpacing: 0.3,
      flexShrink: 1,
    },
    exerciseNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    exerciseNameTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      paddingVertical: 2,
    },
    exerciseNameTriggerPressed: {
      opacity: 0.75,
    },
    exerciseName: {
      fontFamily: FONT_FAMILIES.heading,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
      color: '#F8FAFC',
      lineHeight: 22,
      flex: 1,
    },
    metaBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      paddingVertical: 2,
    },
    overloadNudgePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      borderColor: 'rgba(56, 189, 248, 0.32)',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      flexShrink: 0,
    },
    overloadNudgeText: {
      fontFamily: FONT_FAMILIES.bodyMedium,
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      ...NUMERIC_TABULAR_STYLE,
    },
    historyTogglePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(148, 163, 184, 0.10)',
      borderColor: 'rgba(148, 163, 184, 0.22)',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      flexShrink: 0,
    },
    historyTogglePillActive: {
      backgroundColor: 'rgba(56, 189, 248, 0.10)',
      borderColor: 'rgba(56, 189, 248, 0.32)',
    },
    historyToggleText: {
      fontFamily: FONT_FAMILIES.bodyMedium,
      fontSize: 11,
      fontWeight: '600',
      color: '#94A3B8',
    },
    exerciseHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    reorderControlGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    reorderButton: {
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    reorderButtonDisabled: {
      opacity: 0.25,
    },
    reorderArrowText: {
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
    },
    reorderDivider: {
      width: 1,
      height: 18,
      backgroundColor: colors.borderLight,
    },
    iconDisabled: {
      opacity: 0.4,
    },
    indexBadge: {
      backgroundColor: 'rgba(56, 189, 248, 0.14)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      flexShrink: 0,
    },
    indexBadgeText: {
      fontWeight: '700',
      fontSize: 11,
      color: colors.primary,
    },
    supersetPillBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      alignSelf: 'center',
    },
    supersetPillText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    supersetActionButton: {
      minHeight: 28,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: radii.full,
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
    },
    supersetActionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    supersetActionText: {
      fontSize: 11,
      fontWeight: '700',
    },
    removeExButton: {
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeExText: {
      color: colors.error,
      fontWeight: '700',
      fontSize: 12,
    },
    targetsBadge: {
      paddingVertical: 2,
      paddingHorizontal: 0,
      backgroundColor: 'transparent',
    },
    targetsText: {
      fontWeight: '500',
      fontSize: 12,
      color: '#94A3B8',
    },
    lastTimeContainer: {
      backgroundColor: '#0D121D',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      gap: 3,
    },
    lastTimeHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lastTimeTitle: {
      fontWeight: '700',
      letterSpacing: 0.6,
      fontSize: 10,
      color: colors.primary,
    },
    lastTimeSetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    lastTimeSetChip: {
      fontWeight: '500',
      fontSize: 11,
      color: '#94A3B8',
    },
    noLastTimeContainer: {
      paddingVertical: 2,
      paddingHorizontal: 2,
    },
    noLastTimeText: {
      fontStyle: 'italic',
      color: '#64748B',
      fontSize: 11,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 2,
      paddingTop: 4,
      paddingBottom: 4,
    },
    headerLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      textAlign: 'center',
      color: '#64748B',
    },
    headerLabelCompact: {
      fontSize: 9,
      letterSpacing: 0.2,
    },
    headerColSet: {
      width: 32,
      alignItems: 'center',
    },
    headerColPrev: {
      width: 48,
      alignItems: 'center',
    },
    headerColKg: {
      flex: 1.15,
      minWidth: 40,
      alignItems: 'center',
    },
    headerColReps: {
      flex: 1.0,
      minWidth: 38,
      alignItems: 'center',
    },
    headerColRir: {
      flex: 0.85,
      minWidth: 34,
      alignItems: 'center',
    },
    headerActionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    headerColCheck: {
      width: 30,
      alignItems: 'center',
    },
    headerColNote: {
      width: 26,
      alignItems: 'center',
    },
    headerColDelete: {
      width: 26,
      alignItems: 'center',
    },
    setsContainer: {
      gap: 4,
    },
    addSetButton: {
      minHeight: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: 'rgba(56, 189, 248, 0.10)',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    hiddenTestText: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0,
    },
    renameTriggerButton: {
      padding: 6,
      marginLeft: 4,
      borderRadius: 8,
    },
    renameModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    renameModalCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: 16,
      gap: 12,
    },
    renameModalInput: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 15,
    },
    renameModalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
  });
