import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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
  onToggleCompleteSet: (exercise: WorkoutExercise, set: WorkoutSet) => void;
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
}) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Card key={exercise.exerciseId} style={styles.exerciseCard}>
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
          <Pressable
            testID={`move-up-exercise-${exercise.exerciseId}`}
            onPress={() => onMoveUp(exIndex)}
            disabled={exIndex === 0}
            style={[styles.arrowButton, exIndex === 0 && styles.buttonDisabled]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              variant="caption"
              color={exIndex === 0 ? 'muted' : 'primary'}
              style={styles.controlIcon}
            >
              ▲
            </Text>
          </Pressable>

          <Pressable
            testID={`move-down-exercise-${exercise.exerciseId}`}
            onPress={() => onMoveDown(exIndex)}
            disabled={exIndex === totalExercisesCount - 1}
            style={[
              styles.arrowButton,
              exIndex === totalExercisesCount - 1 && styles.buttonDisabled,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              variant="caption"
              color={exIndex === totalExercisesCount - 1 ? 'muted' : 'primary'}
              style={styles.controlIcon}
            >
              ▼
            </Text>
          </Pressable>

          <Pressable
            testID={`remove-exercise-${exercise.exerciseId}`}
            onPress={() => onRemoveExercise(exercise)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.removeExButton}
          >
            <Text variant="caption" style={styles.removeExText}>
              ✕ Remove
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
            {lastPerformance.sets.map((s, idx, arr) => (
              <Text
                key={s.id || idx}
                variant="caption"
                color="secondary"
                style={styles.lastTimeSetChip}
              >
                {s.weight > 0 ? `${s.weight}kg` : 'BW'} × {s.reps}
                {s.rir !== undefined && s.rir !== null ? ` @ RIR ${s.rir}` : ''}
                {idx < arr.length - 1 ? '  •  ' : ''}
              </Text>
            ))}
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

      {/* Sets List */}
      <View style={styles.setsContainer}>
        {exercise.actualSets.map((set) => (
          <ActiveSetRow
            key={set.id}
            exercise={exercise}
            set={set}
            canDelete={exercise.actualSets.length > 1 && !set.completed}
            isNotesExpanded={Boolean(expandedNotesSetIds[set.id])}
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
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
    },
    exerciseCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      paddingBottom: spacing.sm,
    },
    exerciseHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    arrowButton: {
      backgroundColor: colors.surfaceElevated,
      minWidth: 36,
      minHeight: 32,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.3,
    },
    controlIcon: {
      fontWeight: '700',
    },
    exerciseTitleGroup: {
      flexDirection: 'row',
      gap: spacing.sm,
      flex: 1,
      alignItems: 'flex-start',
    },
    indexBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.primary,
      marginTop: 2,
    },
    indexBadgeText: {
      fontWeight: '800',
    },
    exerciseNameContainer: {
      flex: 1,
      gap: 2,
    },
    exerciseName: {
      fontWeight: '700',
    },
    removeExButton: {
      minHeight: 44,
      paddingHorizontal: spacing.xs,
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeExText: {
      color: colors.error,
      fontWeight: '600',
    },
    targetsBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingVertical: 6,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    targetsText: {
      fontWeight: '600',
    },
    lastTimeContainer: {
      backgroundColor: 'rgba(56, 189, 248, 0.05)',
      paddingVertical: 6,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.2)',
      gap: 2,
    },
    lastTimeHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lastTimeTitle: {
      fontWeight: '800',
      letterSpacing: 0.5,
      color: colors.primary,
    },
    lastTimeSetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    lastTimeSetChip: {
      fontWeight: '600',
      color: colors.textSecondary,
    },
    noLastTimeContainer: {
      paddingVertical: 2,
      paddingHorizontal: 2,
    },
    noLastTimeText: {
      fontStyle: 'italic',
      color: colors.textMuted,
    },
    setsContainer: {
      gap: spacing.md,
    },
    addSetButton: {
      minHeight: 44,
    },
  });
