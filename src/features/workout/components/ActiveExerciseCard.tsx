import React, { useState, useRef } from 'react';
import { View, StyleSheet, Pressable, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Card, Button, Icon } from '../../../components/ui';
import { WorkoutExercise, WorkoutSet } from '../types';
import { SupersetDisplayInfo } from '../utils/supersetUtils';
import {
  findMatchingPreviousSet,
  computeBestLastSetNudge,
  ProgressiveOverloadNudge,
} from '../services/previousPerformanceService';
import { ActiveSetRow } from './ActiveSetRow';
import { radii } from '../../../constants/theme';
import { FONT_FAMILIES, NUMERIC_TABULAR_STYLE } from '../../../theme/typography';

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
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: any;
  isCustomKeypadActive?: boolean;
  activeFocusSetId?: string | null;
  activeFocusField?: 'weight' | 'reps' | 'rir' | null;
  onFocusField?: (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps' | 'rir',
    currentValue: string
  ) => void;
  draftTarget?: { exerciseId: string; setId: string; field: 'weight' | 'reps' | 'rir' } | null;
  draftValue?: string;
  onSetRowLayout?: (setId: string, y: number, height: number) => void;
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
  onUpdateSetField,
  onToggleCompleteSet,
  onPressExerciseDetail,
  onLayout,
  style,
  isCustomKeypadActive,
  activeFocusSetId,
  activeFocusField,
  onFocusField,
  draftTarget,
  draftValue,
  onSetRowLayout,
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width: windowWidth } = useWindowDimensions();
  const [isLastSessionExpanded, setIsLastSessionExpanded] = useState(false);
  const setsContainerOffsetYRef = useRef<number>(0);
  const rawRowLayoutsRef = useRef<{ [setId: string]: { y: number; height: number } }>({});
  const resolvedOverloadNudge =
    overloadNudge !== undefined ? overloadNudge : computeBestLastSetNudge(lastPerformance);

  const isCompact = windowWidth < 400;
  const colGap = isCompact ? 3 : 4;
  const colSetWidth = isCompact ? 26 : 30;
  const colPrevWidth = isCompact ? 54 : 62;
  const colCheckWidth = isCompact ? 30 : 34;
  const colNoteWidth = isCompact ? 28 : 30;
  const colDeleteWidth = isCompact ? 24 : 26;
  const minKg = isCompact ? 34 : 38;
  const minReps = isCompact ? 30 : 36;
  const minRir = isCompact ? 26 : 30;

  const hasPlannedTargets = Boolean(
    exercise.plannedSets ||
      exercise.plannedTargetReps ||
      exercise.plannedRestTime ||
      exercise.plannedTargetWeight,
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
        </View>
      </View>

      {/* Consistent Metadata Row: Best Last Badge + Collapsible History Trigger + Planned Targets */}
      {resolvedOverloadNudge || lastPerformance || hasPlannedTargets ? (
        <View style={styles.metaBadgeRow}>
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
                Target: {exercise.plannedSets ? `${exercise.plannedSets} sets` : ''}
                {exercise.plannedTargetReps ? ` × ${exercise.plannedTargetReps} reps` : ''}
                {exercise.plannedTargetWeight ? ` @ ${exercise.plannedTargetWeight}kg` : ''}
                {exercise.plannedRestTime ? ` • Rest ${exercise.plannedRestTime}s` : ''}
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
                const separator = idx < arr.length - 1 ? '  •  ' : '';
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

      {/* Sets Table Header */}
      <View style={[styles.tableHeaderRow, { gap: colGap }]}>
        <View style={[styles.headerColSet, { width: colSetWidth }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            SET
          </Text>
        </View>
        <View style={[styles.headerColPrev, { width: colPrevWidth }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            PREV
          </Text>
        </View>
        <View style={[styles.headerColKg, { minWidth: minKg }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            KG
          </Text>
        </View>
        <View style={[styles.headerColReps, { minWidth: minReps }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            REPS
          </Text>
        </View>
        <View style={[styles.headerColRir, { minWidth: minRir }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            RIR
          </Text>
        </View>
        <View style={[styles.headerColCheck, { width: colCheckWidth }]}>
          <Icon name="check" size={12} strokeWidth={2.5} color={colors.textMuted} />
          <Text style={styles.hiddenTestText}>✓</Text>
        </View>
        <View style={[styles.headerColNote, { width: colNoteWidth }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            NOTE
          </Text>
        </View>
        <View style={[styles.headerColDelete, { width: colDeleteWidth, marginLeft: 4 }]}>
          <Text variant="caption" color="muted" style={[styles.headerLabel, isCompact && styles.headerLabelCompact]}>
            DEL
          </Text>
        </View>
      </View>

      {/* Sets List */}
      <View
        testID={`sets-container-${exercise.exerciseId}`}
        style={styles.setsContainer}
        onLayout={(e) => {
          setsContainerOffsetYRef.current = e.nativeEvent.layout.y;
          Object.entries(rawRowLayoutsRef.current).forEach(([sId, layout]) => {
            onSetRowLayout?.(sId, setsContainerOffsetYRef.current + layout.y, layout.height);
          });
        }}
      >
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
            onDeleteSet={onDeleteSet}
            onUpdateSetField={onUpdateSetField}
            onToggleCompleteSet={onToggleCompleteSet}
            isCustomKeypadActive={isCustomKeypadActive}
            activeFocusField={activeFocusSetId === set.id ? activeFocusField : null}
            draftValue={draftTarget?.setId === set.id ? draftValue : undefined}
            onFocusField={onFocusField}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              rawRowLayoutsRef.current[set.id] = { y, height };
              onSetRowLayout?.(set.id, setsContainerOffsetYRef.current + y, height);
            }}
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
      gap: 4,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.06)',
      paddingBottom: 8,
    },
    headerTopStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
      fontSize: 12,
      fontWeight: '500',
      color: '#94A3B8',
      flexShrink: 1,
    },
    exerciseNameRow: {
      width: '100%',
      marginTop: 4,
    },
    exerciseName: {
      fontFamily: FONT_FAMILIES.display,
      fontWeight: '700',
      fontSize: 18,
      lineHeight: 24,
      color: '#F8FAFC',
      flexShrink: 1,
    },
    exerciseNameTrigger: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    exerciseNameTriggerPressed: {
      opacity: 0.72,
    },
    metaBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    overloadNudgePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      borderColor: 'rgba(56, 189, 248, 0.30)',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      flexShrink: 0,
    },
    overloadNudgeText: {
      fontFamily: FONT_FAMILIES.bodySemiBold,
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
    headerColCheck: {
      width: 38,
      alignItems: 'center',
    },
    headerColNote: {
      width: 30,
      alignItems: 'center',
    },
    headerColDelete: {
      width: 28,
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
  });
