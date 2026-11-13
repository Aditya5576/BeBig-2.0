import React from 'react';
import { View, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Card, Button } from '../../../components/ui';
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.supersetActionButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Unlink ${exercise.exerciseName} from ${supersetInfo.groupLabel}`}
                >
                  <Text style={[styles.supersetActionText, { color: colors.textMuted }]}>
                    Unlink
                  </Text>
                </Pressable>
              )
            ) : (
              exIndex < totalExercisesCount - 1 && onLinkSuperset && (
                <Pressable
                  testID={`superset-link-button-${exercise.exerciseId}`}
                  onPress={() => onLinkSuperset(exIndex)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.supersetActionButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Link ${exercise.exerciseName} with next exercise into superset`}
                >
                  <Text style={[styles.supersetActionText, { color: '#00E599' }]}>
                    + Superset
                  </Text>
                </Pressable>
              )
            )}

            <View style={styles.reorderControlGroup}>
              <Pressable
                testID={`move-up-exercise-${exercise.exerciseId}`}
                onPress={() => onMoveUp(exIndex)}
                disabled={exIndex === 0}
                style={[styles.reorderButton, exIndex === 0 && styles.reorderButtonDisabled]}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityLabel={`Move ${exercise.exerciseName} up`}
              >
                <Text
                  style={[
                    styles.reorderArrowText,
                    { color: exIndex === 0 ? colors.textMuted : colors.primary },
                    exIndex === 0 && styles.iconDisabled,
                  ]}
                >
                  ↑
                </Text>
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
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityLabel={`Move ${exercise.exerciseName} down`}
              >
                <Text
                  style={[
                    styles.reorderArrowText,
                    {
                      color:
                        exIndex === totalExercisesCount - 1
                          ? colors.textMuted
                          : colors.primary,
                    },
                    exIndex === totalExercisesCount - 1 && styles.iconDisabled,
                  ]}
                >
                  ↓
                </Text>
              </Pressable>
            </View>

            <Pressable
              testID={`remove-exercise-${exercise.exerciseId}`}
              onPress={() => onRemoveExercise(exercise)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={styles.removeExButton}
              accessibilityLabel={`Remove ${exercise.exerciseName}`}
            >
              <Text variant="caption" style={styles.removeExText}>
                ✕
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Tier 2: Dedicated Full-Width Exercise Name Row */}
        <View style={styles.exerciseNameRow}>
          <Text style={styles.exerciseName}>
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
      <View style={styles.tableHeaderRow}>
        <View style={styles.headerColSet}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            SET
          </Text>
        </View>
        <View style={styles.headerColPrev}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            PREV
          </Text>
        </View>
        <View style={styles.headerColKg}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            KG
          </Text>
        </View>
        <View style={styles.headerColReps}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            REPS
          </Text>
        </View>
        <View style={styles.headerColRir}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            RIR
          </Text>
        </View>
        <View style={styles.headerColCheck}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            ✓
          </Text>
        </View>
        <View style={styles.headerColNote}>
          <Text variant="caption" color="muted" style={styles.headerLabel}>
            NOTE
          </Text>
        </View>
        <View style={styles.headerColDelete}>
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
        variant="outline"
        size="md"
        style={styles.addSetButton}
      />
    </Card>
  );
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    exerciseCard: {
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: '#141824',
      borderColor: colors.borderLight,
      borderRadius: 14,
      borderWidth: 1,
    },
    exerciseCardHeader: {
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
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
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
      flexShrink: 1,
    },
    exerciseNameRow: {
      width: '100%',
      marginTop: 2,
    },
    exerciseName: {
      fontWeight: '700',
      fontSize: 17,
      lineHeight: 22,
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
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
    },
    reorderButton: {
      width: 36,
      height: 34,
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
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.25)',
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
      minHeight: 44,
      minWidth: 44,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    supersetActionText: {
      fontSize: 11,
      fontWeight: '700',
    },
    removeExButton: {
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeExText: {
      color: colors.error,
      fontWeight: '700',
      fontSize: 12,
    },
    targetsBadge: {
      backgroundColor: '#0F1420',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    targetsText: {
      fontWeight: '600',
      fontSize: 11,
      color: colors.textSecondary,
    },
    lastTimeContainer: {
      backgroundColor: '#0F1420',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.16)',
      gap: 2,
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
      fontWeight: '600',
      fontSize: 11,
      color: colors.textSecondary,
    },
    noLastTimeContainer: {
      paddingVertical: 2,
      paddingHorizontal: 2,
    },
    noLastTimeText: {
      fontStyle: 'italic',
      color: colors.textMuted,
      fontSize: 11,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 2,
      paddingBottom: 4,
    },
    headerLabel: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.5,
      textAlign: 'center',
      color: colors.textMuted,
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
      borderRadius: 8,
      borderColor: colors.borderLight,
    },
  });
