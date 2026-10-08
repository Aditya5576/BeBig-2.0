import React from 'react';
import { View, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text, Card, Button } from '../../../components/ui';
import { WorkoutExercise, WorkoutSet } from '../types';
import { ActiveSetRow } from './ActiveSetRow';
import { spacing, radii } from '../../../constants/theme';

export interface ActiveExerciseCardProps {
  exercise: WorkoutExercise;
  exIndex: number;
  totalExercisesCount: number;
  lastPerformance?: { workoutDate?: string; sets: WorkoutSet[] };
  expandedNotesSetIds: Record<string, boolean>;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
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
  lastPerformance,
  expandedNotesSetIds,
  onMoveUp,
  onMoveDown,
  onRemoveExercise,
  onAddSet,
  onDeleteSet,
  onToggleNotes,
  onUpdateSetField,
  onToggleCompleteSet,
  onLayout,
}) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Card key={exercise.exerciseId} style={styles.exerciseCard} onLayout={onLayout}>
      {/* Exercise Header */}
      <View style={styles.exerciseCardHeader}>
        <View style={styles.exerciseTitleGroup}>
          <View style={styles.indexBadge}>
            <Text variant="caption" color="accent" style={styles.indexBadgeText}>
              #{exIndex + 1}
            </Text>
          </View>
          <View style={styles.exerciseNameContainer}>
            <Text variant="titleMedium" color="primary" style={styles.exerciseName}>
              {exercise.exerciseName}
            </Text>
            {exercise.categoryName ? (
              <Text variant="caption" color="muted">
                {exercise.categoryName}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.exerciseHeaderActions}>
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
                  {`${weightText} × ${s.reps}${rirText}${noteText}${separator}`}
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
      </View>

      {/* Sets List */}
      <View style={styles.setsContainer}>
        {exercise.actualSets.map((set) => (
          <ActiveSetRow
            key={set.id}
            exercise={exercise}
            set={set}
            previousSet={lastPerformance?.sets?.[set.setNumber - 1]}
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
      paddingVertical: 14,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderRadius: 12,
    },
    exerciseCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      paddingBottom: 8,
      gap: 8,
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
    exerciseTitleGroup: {
      flexDirection: 'row',
      gap: 8,
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
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
    exerciseNameContainer: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    exerciseName: {
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 20,
      color: colors.textPrimary,
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
      backgroundColor: colors.surfaceSubtle,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    targetsText: {
      fontWeight: '600',
      fontSize: 11,
      color: colors.textSecondary,
    },
    lastTimeContainer: {
      backgroundColor: 'rgba(56, 189, 248, 0.04)',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.15)',
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
      gap: 6,
      paddingHorizontal: 4,
      paddingBottom: 4,
    },
    headerLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textAlign: 'center',
      color: colors.textMuted,
    },
    headerColSet: {
      width: 26,
      alignItems: 'center',
    },
    headerColPrev: {
      width: 48,
      alignItems: 'center',
    },
    headerColKg: {
      flex: 1.15,
      minWidth: 54,
      alignItems: 'center',
    },
    headerColReps: {
      flex: 1.0,
      minWidth: 48,
      alignItems: 'center',
    },
    headerColRir: {
      flex: 0.85,
      minWidth: 42,
      alignItems: 'center',
    },
    headerColCheck: {
      width: 38,
      alignItems: 'center',
    },
    headerColNote: {
      width: 32,
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
