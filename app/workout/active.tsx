import { useAppTheme } from '../../src/features/theme';
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import {
  workoutRepository,
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
  ActiveExerciseCard,
} from '../../src/features/workout';
import { ExercisePickerModal } from '../../src/features/templates/components/ExercisePickerModal';
import { Exercise } from '../../src/features/exercises';
import { spacing, radii } from '../../src/constants/theme';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ActiveWorkoutScreen() {
  const { colors } = useAppTheme();
  let insets = { bottom: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    insets = { bottom: 0 };
  }
  const styles = createStyles(colors, insets as any);

  const router = useRouter();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [isRestFinished, setIsRestFinished] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [lastPerformanceMap, setLastPerformanceMap] = useState<
    Record<string, { workoutDate?: string; sets: WorkoutSet[] }>
  >({});
  const [expandedNotesSetIds, setExpandedNotesSetIds] = useState<Record<string, boolean>>({});

  const toggleNotesForSet = (setId: string) => {
    setExpandedNotesSetIds((prev) => ({ ...prev, [setId]: !prev[setId] }));
  };

  // Fetch last performance per exercise from local completed history
  useEffect(() => {
    if (!session || !session.exercises || session.exercises.length === 0) return;

    let isMounted = true;

    async function loadLastPerformances() {
      try {
        const completed = await workoutRepository.getCompletedWorkouts();
        const map: Record<string, { workoutDate?: string; sets: WorkoutSet[] }> = {};

        for (const ex of session!.exercises) {
          if (!ex.exerciseId && !ex.exerciseName) continue;
          const targetId = ex.exerciseId;
          const targetName = ex.exerciseName ? ex.exerciseName.trim().toLowerCase() : '';

          for (const w of completed) {
            if (w.id === session!.id) continue;
            if (!w.exercises || w.exercises.length === 0) continue;

            const match = w.exercises.find((e) => {
              if (targetId && e.exerciseId && e.exerciseId === targetId) return true;
              if (
                targetName &&
                e.exerciseName &&
                e.exerciseName.trim().toLowerCase() === targetName
              ) {
                return true;
              }
              return false;
            });

            if (match && match.actualSets && match.actualSets.length > 0) {
              const loggedSets = match.actualSets.filter(
                (s) => s.completed || (s.weight ?? 0) > 0 || (s.reps ?? 0) > 0,
              );
              if (loggedSets.length > 0) {
                map[ex.exerciseId] = {
                  workoutDate: w.finishedAt || w.startedAt,
                  sets: loggedSets,
                };
                break;
              }
            }
          }
        }

        if (isMounted) {
          setLastPerformanceMap(map);
        }
      } catch {
        // Fallback gracefully
      }
    }

    void loadLastPerformances();

    return () => {
      isMounted = false;
    };
  }, [
    session?.id,
    session?.exercises?.map((e) => `${e.exerciseId}_${e.exerciseName}`).join(','),
  ]);

  // Load active workout draft
  useEffect(() => {
    let isMounted = true;

    async function initActiveWorkout() {
      try {
        const active = await workoutRepository.getActiveWorkout();
        if (!isMounted) return;
        if (!active) {
          Alert.alert('No Active Workout', 'There is no workout currently in progress.', [
            { text: 'OK', onPress: () => router.replace('/workout/start' as any) },
          ]);
          return;
        }
        setSession(active);
      } catch {
        if (isMounted) {
          Alert.alert('Error', 'Failed to load active workout session.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void initActiveWorkout();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed timer ticker
  useEffect(() => {
    if (!session || session.status !== 'active') return;

    const startMs = new Date(session.startedAt).getTime();
    const updateElapsed = () => {
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.startedAt, session?.status]);

  // Rest interval countdown ticker (timestamp-based)
  useEffect(() => {
    if (!session?.activeRestTimer) {
      return;
    }

    const { targetEndTime } = session.activeRestTimer;

    const checkRest = () => {
      const now = Date.now();
      const diff = Math.ceil((targetEndTime - now) / 1000);
      if (diff <= 0) {
        setRestRemaining(0);
        setIsRestFinished(true);
      } else {
        setRestRemaining(diff);
        setIsRestFinished(false);
      }
    };

    const timer = setTimeout(checkRest, 0);
    const interval = setInterval(checkRest, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [session?.activeRestTimer]);

  // Format MM:SS or HH:MM:SS
  const formatTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Autosave helper
  const updateSessionAndAutosave = async (newSession: WorkoutSession) => {
    setSession(newSession);
    try {
      await workoutRepository.updateActiveWorkout(newSession);
    } catch {
      // Background autosave failure caught gracefully
    }
  };

  // Add exercise from picker
  const handleSelectExercise = async (exercise: Exercise) => {
    if (!session) return;
    setIsPickerVisible(false);

    // Check duplicate
    if (session.exercises.some((e) => e.exerciseId === exercise.id)) {
      Alert.alert('Duplicate Exercise', `"${exercise.name}" is already in this workout session.`);
      return;
    }

    const updated = workoutRepository.addExerciseToWorkout(session, {
      id: exercise.id,
      name: exercise.name,
      categoryName: exercise.categoryName,
    });
    await updateSessionAndAutosave(updated);
  };

  // Remove exercise
  const handleRemoveExercise = (exercise: WorkoutExercise) => {
    Alert.alert(
      'Remove Exercise',
      `Remove "${exercise.exerciseName}" and all of its logged sets from this active workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!session) return;
            const updated = workoutRepository.removeExerciseFromWorkout(
              session,
              exercise.exerciseId,
            );
            await updateSessionAndAutosave(updated);
          },
        },
      ],
    );
  };

  // Reorder exercise move up
  const handleMoveUpExercise = async (index: number) => {
    if (!session || index <= 0) return;
    const updated = [...session.exercises];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    const reindexed = updated.map((ex, idx) => ({ ...ex, order: idx }));
    await updateSessionAndAutosave({ ...session, exercises: reindexed });
  };

  // Reorder exercise move down
  const handleMoveDownExercise = async (index: number) => {
    if (!session || index >= session.exercises.length - 1) return;
    const updated = [...session.exercises];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    const reindexed = updated.map((ex, idx) => ({ ...ex, order: idx }));
    await updateSessionAndAutosave({ ...session, exercises: reindexed });
  };

  // Add set to exercise
  const handleAddSet = async (exerciseId: string) => {
    if (!session) return;
    const updated = workoutRepository.addSetToExercise(session, exerciseId);
    await updateSessionAndAutosave(updated);
  };

  // Delete set
  const handleDeleteSet = async (exerciseId: string, setId: string) => {
    if (!session) return;
    const updated = workoutRepository.removeSetFromExercise(session, exerciseId, setId);
    await updateSessionAndAutosave(updated);
  };

  // Update set field (weight, reps, rir, notes)
  const handleUpdateSetField = async (
    exerciseId: string,
    setId: string,
    field: keyof WorkoutSet,
    value: string,
  ) => {
    if (!session) return;

    let partial: Partial<WorkoutSet> = {};
    if (field === 'weight') {
      const num = parseFloat(value);
      partial = { weight: isNaN(num) ? 0 : Math.max(0, num) };
    } else if (field === 'reps') {
      const num = parseInt(value, 10);
      partial = { reps: isNaN(num) ? 0 : Math.max(0, num) };
    } else if (field === 'rir') {
      const num = parseFloat(value);
      partial = { rir: isNaN(num) ? 0 : Math.min(10, Math.max(0, num)) };
    } else if (field === 'notes') {
      partial = { notes: value };
    }

    try {
      const updated = workoutRepository.updateSet(session, exerciseId, setId, partial);
      await updateSessionAndAutosave(updated);
    } catch {
      // Silent error during active typing
    }
  };

  // Toggle complete set
  const handleToggleCompleteSet = async (
    exercise: WorkoutExercise,
    set: WorkoutSet,
    pendingUpdates?: Partial<WorkoutSet>,
  ) => {
    if (!session) return;

    const effectiveSet = { ...set, ...pendingUpdates };

    if (!effectiveSet.completed) {
      // Validate before completing
      if (effectiveSet.reps <= 0 || !Number.isInteger(effectiveSet.reps)) {
        Alert.alert(
          'Invalid Reps',
          'Reps must be a positive integer (at least 1) to complete a set.',
        );
        return;
      }
      if (effectiveSet.weight < 0 || isNaN(effectiveSet.weight)) {
        Alert.alert('Invalid Weight', 'Weight cannot be negative.');
        return;
      }
      if (effectiveSet.rir !== undefined && (effectiveSet.rir < 0 || effectiveSet.rir > 10 || isNaN(effectiveSet.rir))) {
        Alert.alert('Invalid RIR', 'RIR must be between 0 and 10.');
        return;
      }

      // Complete set and trigger rest timer
      let updated = workoutRepository.updateSet(session, exercise.exerciseId, set.id, {
        ...pendingUpdates,
        completed: true,
        completedAt: new Date().toISOString(),
      });

      const restTime =
        exercise.plannedRestTime && exercise.plannedRestTime > 0 ? exercise.plannedRestTime : 90;
      updated = workoutRepository.startRestTimer(
        updated,
        exercise.exerciseId,
        set.setNumber,
        restTime,
        exercise.exerciseName,
      );
      setIsRestFinished(false);
      setRestRemaining(restTime);

      await updateSessionAndAutosave(updated);
    } else {
      // Un-complete set
      const updated = workoutRepository.updateSet(session, exercise.exerciseId, set.id, {
        completed: false,
        completedAt: undefined,
      });
      await updateSessionAndAutosave(updated);
    }
  };

  // Extend active rest timer by +10s or +20s
  const handleExtendRest = async (addedSeconds: number) => {
    if (!session || !session.activeRestTimer) return;
    if (session.activeRestTimer.targetEndTime <= Date.now()) return;

    const updated = workoutRepository.extendRestTimer(session, addedSeconds);
    const now = Date.now();
    if (updated.activeRestTimer) {
      const diff = Math.max(0, Math.ceil((updated.activeRestTimer.targetEndTime - now) / 1000));
      setRestRemaining(diff);
      setIsRestFinished(false);
    }
    await updateSessionAndAutosave(updated);
  };

  // Skip rest timer
  const handleSkipRest = async () => {
    if (!session) return;
    setIsRestFinished(false);
    setRestRemaining(null);
    const updated = workoutRepository.clearRestTimer(session);
    await updateSessionAndAutosave(updated);
  };

  // Dismiss completed rest banner
  const handleDismissRestComplete = async () => {
    if (!session) return;
    setIsRestFinished(false);
    setRestRemaining(null);
    const updated = workoutRepository.clearRestTimer(session);
    await updateSessionAndAutosave(updated);
  };

  // Discard workout
  const handleDiscard = () => {
    Alert.alert(
      'Discard Workout',
      'Are you sure you want to discard this workout? All recorded sets and timer data will be erased.',
      [
        { text: 'Keep Training', style: 'cancel' },
        {
          text: 'Discard Workout',
          style: 'destructive',
          onPress: async () => {
            await workoutRepository.discardActiveWorkout();
            router.replace('/home' as any);
          },
        },
      ],
    );
  };

  // Finish workout
  const handleFinish = () => {
    if (!session) return;

    const completedCount = workoutRepository.countCompletedSets(session);
    if (completedCount === 0) {
      Alert.alert(
        'No Sets Completed',
        'You must complete and check off at least one set before finishing the workout.',
      );
      return;
    }

    Alert.alert(
      'Finish Workout',
      `Complete this workout? You have logged ${completedCount} set${completedCount === 1 ? '' : 's'}.`,
      [
        { text: 'Keep Training', style: 'cancel' },
        {
          text: 'Finish & Save',
          style: 'default',
          onPress: async () => {
            try {
              setFinishing(true);
              const completed = await workoutRepository.completeActiveWorkout(session);
              router.replace(`/workout/summary?id=${completed.id}` as any);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to complete workout.');
            } finally {
              setFinishing(false);
            }
          },
        },
      ],
    );
  };

  if (loading || !session) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const completedSetsCount = workoutRepository.countCompletedSets(session);

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            ((restRemaining !== null && restRemaining > 0 && !isRestFinished) || isRestFinished) && styles.scrollContentRestActive
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar / Header */}
          <View style={styles.topBar}>
            <View style={styles.headerTitleArea}>
              <Text
                variant="titleMedium"
                color="primary"
                numberOfLines={1}
                style={styles.workoutTitle}
              >
                {session.name}
              </Text>
            </View>

            <View style={styles.topActions}>
              <Button
                testID="discard-workout-button"
                title="Discard"
                onPress={handleDiscard}
                variant="outline"
                size="sm"
                style={styles.discardButton}
              />
              <Button
                testID="finish-workout-button"
                title="Finish"
                onPress={handleFinish}
                variant="primary"
                size="sm"
                loading={finishing}
                style={styles.finishButton}
              />
            </View>
          </View>



          {/* Exercises List */}
          {session.exercises.length === 0 ? (
            <Card style={styles.emptyExercisesCard}>
              <Text variant="titleMedium" color="primary" style={styles.emptyTitle}>
                No Exercises in Session
              </Text>
              <Text variant="body" color="muted" style={styles.emptySubtitle}>
                Add exercises to your active workout below to start logging sets and weights.
              </Text>
            </Card>
          ) : (
            session.exercises.map((ex, exIndex) => (
              <ActiveExerciseCard
                key={ex.exerciseId}
                exercise={ex}
                exIndex={exIndex}
                totalExercisesCount={session.exercises.length}
                lastPerformance={lastPerformanceMap[ex.exerciseId]}
                expandedNotesSetIds={expandedNotesSetIds}
                onMoveUp={handleMoveUpExercise}
                onMoveDown={handleMoveDownExercise}
                onRemoveExercise={handleRemoveExercise}
                onAddSet={handleAddSet}
                onDeleteSet={handleDeleteSet}
                onToggleNotes={toggleNotesForSet}
                onUpdateSetField={handleUpdateSetField}
                onToggleCompleteSet={handleToggleCompleteSet}
              />
            ))
          )}

          {/* Bottom Action Section: Add Exercise & Finish */}
          <View style={styles.bottomActions}>
            <Button
              testID="add-exercise-to-workout-button"
              title="+ Add Exercise"
              onPress={() => setIsPickerVisible(true)}
              variant="secondary"
              size="lg"
              style={styles.addExerciseButton}
            />

            <Button
              testID="finish-workout-bottom-button"
              title={`Finish Workout (${completedSetsCount} sets)`}
              onPress={handleFinish}
              variant="primary"
              size="lg"
              loading={finishing}
              style={styles.finishBottomButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Persistent Bottom Rest Countdown Banner */}
      {restRemaining !== null && restRemaining > 0 && !isRestFinished && (
        <View style={styles.persistentRestOverlay}>
          <Card style={styles.restBannerCard} testID="rest-timer-banner">
            <View style={styles.restBannerContent}>
              <View style={styles.restInfo}>
                <Text variant="caption" color="accent" style={styles.restLabel}>
                  REST INTERVAL
                </Text>
                <Text variant="titleLarge" color="primary" style={styles.restCountdownText}>
                  REST {formatTime(restRemaining)}
                </Text>
                {session.activeRestTimer?.exerciseName ? (
                  <Text variant="caption" color="secondary" numberOfLines={1}>
                    After Set {session.activeRestTimer.setNumber} •{' '}
                    {session.activeRestTimer.exerciseName}
                  </Text>
                ) : null}
              </View>
              <View style={styles.restControlsGroup}>
                <View style={styles.extendButtonsRow}>
                  <Button
                    testID="extend-rest-10-button"
                    title="+10s"
                    onPress={() => handleExtendRest(10)}
                    variant="outline"
                    size="sm"
                    style={styles.extendRestButton}
                  />
                  <Button
                    testID="extend-rest-20-button"
                    title="+20s"
                    onPress={() => handleExtendRest(20)}
                    variant="outline"
                    size="sm"
                    style={styles.extendRestButton}
                  />
                </View>
                <Button
                  testID="skip-rest-timer-button"
                  title="Skip Rest"
                  onPress={handleSkipRest}
                  variant="secondary"
                  size="sm"
                  style={styles.skipRestButton}
                />
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Persistent Bottom Completed Rest Banner */}
      {isRestFinished && (
        <View style={styles.persistentRestOverlay}>
          <Card style={styles.restCompleteCard} testID="rest-complete-banner">
            <View style={styles.restBannerContent}>
              <View style={styles.restInfo}>
                <Text variant="caption" style={styles.restCompleteLabel}>
                  REST COMPLETE
                </Text>
                <Text variant="titleMedium" color="primary" style={styles.restCompleteTitle}>
                  Ready for your next set!
                </Text>
                {session.activeRestTimer?.exerciseName ? (
                  <Text variant="caption" color="secondary" numberOfLines={1}>
                    Target rest finished for {session.activeRestTimer.exerciseName}
                  </Text>
                ) : null}
              </View>
              <Button
                testID="dismiss-rest-timer-button"
                title="Dismiss"
                onPress={handleDismissRestComplete}
                variant="primary"
                size="sm"
                style={styles.dismissRestButton}
              />
            </View>
          </Card>
        </View>
      )}

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        onSelectExercise={handleSelectExercise}
        selectedExerciseIds={session.exercises.map((e) => e.exerciseId)}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: any, insets: { bottom: number }) => StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  persistentRestOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: Math.max(insets.bottom, 12),
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    paddingBottom: 160,
    gap: spacing.md,
  },
  scrollContentRestActive: {
    paddingBottom: 240 + Math.max(insets.bottom, 12),
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  headerTitleArea: {
    flex: 1,
    gap: 4,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  discardButton: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderColor: colors.error,
  },
  finishButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  restBannerCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
    borderWidth: 1.5,
    padding: spacing.sm,
  },
  restCompleteCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.success,
    borderWidth: 1.5,
    padding: spacing.sm,
  },
  restBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restInfo: {
    flex: 1,
    gap: 2,
  },
  restLabel: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  restCompleteLabel: {
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.success,
  },
  restCountdownText: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  restCompleteTitle: {
    fontWeight: '800',
  },
  skipRestButton: {
    minHeight: 34,
    minWidth: 80,
  },
  restControlsGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  extendButtonsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  extendRestButton: {
    minHeight: 32,
    paddingHorizontal: 8,
  },
  dismissRestButton: {
    minHeight: 40,
    minWidth: 90,
  },
  emptyExercisesCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
  },
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
  setCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setCardCompleted: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
  },
  setHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  setNumberText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  completedBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  completedBadgeText: {
    fontWeight: '700',
    color: colors.primary,
  },
  pendingBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  pendingBadgeText: {
    fontWeight: '700',
    color: colors.textMuted,
  },
  deleteSetButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteSetText: {
    color: colors.error,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCol: {
    flex: 1,
    gap: 4,
  },
  inputLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 46,
  },
  metricInputCompleted: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  addNoteTrigger: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    marginTop: 2,
  },
  addNoteText: {
    fontWeight: '600',
  },
  notesContainer: {
    gap: 4,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 44,
  },
  setInputDisabled: {
    opacity: 0.55,
  },
  completeSetButton: {
    minHeight: 46,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  completeSetButtonActive: {
    backgroundColor: colors.primary,
  },
  completeSetButtonDone: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  completeSetButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  completeSetTextActive: {
    color: colors.background,
  },
  completeSetTextDone: {
    color: colors.primary,
  },
  addSetButton: {
    minHeight: 44,
  },
  bottomActions: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  addExerciseButton: {
    minHeight: 48,
  },
  finishBottomButton: {
    minHeight: 48,
  },
});
