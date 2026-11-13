import React from 'react';
import { View, StyleSheet, Pressable, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Card, Button, Icon } from '../../../components/ui';
import { WorkoutExercise, WorkoutSet } from '../types';
import { SupersetDisplayInfo } from '../utils/supersetUtils';
import { findMatchingPreviousSet } from '../services/previousPerformanceService';
import { ActiveSetRow } from './ActiveSetRow';
import { spacing, radii } from '../../../constants/theme';

export interface ActiveExerciseCardProps {
  exercise: WorkoutExercise;
  exIndex: number;
  totalExercisesCount: number;
  supersetInfo?: SupersetDisplayInfo;
  lastPerformance?: { workoutDate?: string; sets: WorkoutSet[] };
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
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: any;
}

const formatShortDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const ActiveExerciseCard = React.memo<ActiveExerciseCardProps>(({
  exercise,
  exIndex,
  totalExercisesCount,
  supersetInfo,
  lastPerformance,
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
  onLayout,
  style,
}) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { width: windowWidth } = useWindowDimensions();

  const isNarrow = windowWidth < 380;
  const colGap = isNarrow ? 3 : 4;
  const colSetWidth = isNarrow ? 28 : 32;
  const colPrevWidth = isNarrow ? 40 : 46;
  const colCheckWidth = isNarrow ? 32 : 36;
  const colNoteWidth = isNarrow ? 26 : 28;
  const colDeleteWidth = isNarrow ? 24 : 26;
  const minKg = isNarrow ? 34 : 40;
  const minReps = isNarrow ? 30 : 36;
  const minRir = isNarrow ? 28 : 32;

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
          <Text style={styles.exerciseName} numberOfLines={2}>
            {exercise.exerciseName}
          </Text>
        </View>
      </View>

      {/* Planned Targets Header */}
      {exercise.plannedSets ||
      exercise.plannedTargetReps ||
      exercise.plannedRestTime ||
      exercise.plannedTargetWeight ? (
        <View style={styles.targetsBadge}>
          <Text variant="caption" color="accent" style={styles.targetsText}>
            Target: {exercise.plannedSets ? `${exercise.plannedSets} sets` : ''}
            {exercise.plannedTargetReps ? ` × ${exercise.plannedTargetReps} reps` : ''}
            {exercise.plannedTargetWeight ? ` @ ${exercise.plannedTargetWeight}kg` : ''}
            {exercise.plannedRestTime ? ` • Rest ${exercise.plannedRestTime}s` : ''}
          </Text>
        </View>
      ) : null}

      {/* Last Time Performance */}
      {lastPerformance ? (
        <View
          style={styles.lastTimeContainer}
          testID={`last-time-performance-${exercise.exerciseId}`}
        >
          <View style={styles.lastTimeHeaderRow}>
            <Text variant="caption" style={styles.lastTimeTitle}>
              LAST TIME{' '}
              {formatShortDate(lastPerformance.workoutDate)
                ? `(${formatShortDate(lastPerformance.workoutDate)})`
                : ''}
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
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            SET
          </Text>
        </View>
        <View style={[styles.headerColPrev, { width: colPrevWidth }]}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            PREV
          </Text>
        </View>
        <View style={[styles.headerColKg, { minWidth: minKg }]}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            KG
          </Text>
        </View>
        <View style={[styles.headerColReps, { minWidth: minReps }]}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            REPS
          </Text>
        </View>
        <View style={[styles.headerColRir, { minWidth: minRir }]}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            RIR
          </Text>
        </View>
        <View style={[styles.headerColCheck, { width: colCheckWidth }]}>
          <Icon name="check" size={12} strokeWidth={2.5} color={colors.textMuted} />
          <Text style={styles.hiddenTestText}>✓</Text>
        </View>
        <View style={[styles.headerColNote, { width: colNoteWidth }]}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            NOTE
          </Text>
        </View>
        <View style={[styles.headerColDelete, { width: colDeleteWidth }]}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            DEL
          </Text>
        </View>
      </View>

      {/* Sets List */}
      <View style={styles.setsContainer}>
        {exercise.actualSets.map((set) => (
          <ActiveSetRow
            key={set.id}
            exercise={exercise}
            set={set}
            previousSet={findMatchingPreviousSet(lastPerformance?.sets, set)}
            canDelete={exercise.actualSets.length > 1 && !set.completed}
            isNotesExpanded={expandedNotesSetIds[set.id]}
            onToggleNotes={onToggleNotes}
            onDeleteSet={onDeleteSet}
            onUpdateSetField={onUpdateSetField}
            onToggleCompleteSet={onToggleCompleteSet}
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
      fontWeight: '700',
      fontSize: 18,
      lineHeight: 24,
      color: '#F8FAFC',
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
