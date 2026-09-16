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
} from '../../src/features/workout';
import { ExercisePickerModal } from '../../src/features/templates/components/ExercisePickerModal';
import { Exercise } from '../../src/features/exercises';
import { colors, spacing, radii } from '../../src/constants/theme';

export default function ActiveWorkoutScreen() {
  const router = useRouter();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [isRestFinished, setIsRestFinished] = useState(false);
  const [finishing, setFinishing] = useState(false);

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
      `Remove "${exercise.exerciseName}" and its logged sets from this workout?`,
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
  const handleToggleCompleteSet = async (exercise: WorkoutExercise, set: WorkoutSet) => {
    if (!session) return;

    if (!set.completed) {
      // Validate before completing
      if (set.reps <= 0 || !Number.isInteger(set.reps)) {
        Alert.alert(
          'Invalid Reps',
          'Reps must be a positive integer (at least 1) to complete a set.',
        );
        return;
      }
      if (set.weight < 0 || isNaN(set.weight)) {
        Alert.alert('Invalid Weight', 'Weight cannot be negative.');
        return;
      }
      if (set.rir < 0 || set.rir > 10 || isNaN(set.rir)) {
        Alert.alert('Invalid RIR', 'RIR must be between 0 and 10.');
        return;
      }

      // Complete set and trigger rest timer
      let updated = workoutRepository.updateSet(session, exercise.exerciseId, set.id, {
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
          <ActivityIndicator size="large" color={colors.dark.primary} />
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
          contentContainerStyle={styles.scrollContent}
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
              <View style={styles.timerBadge}>
                <Text variant="caption" color="accent" style={styles.timerText}>
                  ⏱ {formatTime(elapsedSeconds)}
                </Text>
                <Text variant="caption" color="muted">
                  • {completedSetsCount} completed
                </Text>
              </View>
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

          {/* Active Rest Countdown Timer Banner */}
          {restRemaining !== null && restRemaining > 0 && !isRestFinished && (
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
                <Button
                  testID="skip-rest-timer-button"
                  title="Skip Rest"
                  onPress={handleSkipRest}
                  variant="secondary"
                  size="sm"
                  style={styles.skipRestButton}
                />
              </View>
            </Card>
          )}

          {/* Completed Rest Interval Banner */}
          {isRestFinished && (
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
          )}

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
              <Card key={ex.exerciseId} style={styles.exerciseCard}>
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
                        {ex.exerciseName}
                      </Text>
                      {ex.categoryName ? (
                        <Text variant="caption" color="muted">
                          {ex.categoryName}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.exerciseHeaderActions}>
                    <Pressable
                      testID={`move-up-exercise-${ex.exerciseId}`}
                      onPress={() => handleMoveUpExercise(exIndex)}
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
                      testID={`move-down-exercise-${ex.exerciseId}`}
                      onPress={() => handleMoveDownExercise(exIndex)}
                      disabled={exIndex === session.exercises.length - 1}
                      style={[
                        styles.arrowButton,
                        exIndex === session.exercises.length - 1 && styles.buttonDisabled,
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text
                        variant="caption"
                        color={exIndex === session.exercises.length - 1 ? 'muted' : 'primary'}
                        style={styles.controlIcon}
                      >
                        ▼
                      </Text>
                    </Pressable>

                    <Pressable
                      testID={`remove-exercise-${ex.exerciseId}`}
                      onPress={() => handleRemoveExercise(ex)}
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
                {ex.plannedSets ||
                ex.plannedTargetReps ||
                ex.plannedRestTime ||
                ex.plannedTargetWeight ? (
                  <View style={styles.targetsBadge}>
                    <Text variant="caption" color="accent" style={styles.targetsText}>
                      Target: {ex.plannedSets ? `${ex.plannedSets} sets` : ''}
                      {ex.plannedTargetReps ? ` × ${ex.plannedTargetReps} reps` : ''}
                      {ex.plannedTargetWeight ? ` @ ${ex.plannedTargetWeight}kg` : ''}
                      {ex.plannedRestTime ? ` • Rest ${ex.plannedRestTime}s` : ''}
                    </Text>
                  </View>
                ) : null}

                {/* Sets List */}
                <View style={styles.setsContainer}>
                  {ex.actualSets.map((set) => (
                    <View
                      key={set.id}
                      style={[styles.setCard, set.completed ? styles.setCardCompleted : null]}
                    >
                      {/* Set Card Top Row: Set # and Delete */}
                      <View style={styles.setHeaderRow}>
                        <View style={styles.setNumberContainer}>
                          <Text
                            variant="label"
                            color={set.completed ? 'accent' : 'primary'}
                            style={styles.setNumberText}
                          >
                            SET {set.setNumber}
                          </Text>
                          {set.completed && (
                            <View style={styles.completedBadge}>
                              <Text variant="caption" style={styles.completedBadgeText}>
                                Logged
                              </Text>
                            </View>
                          )}
                        </View>

                        {ex.actualSets.length > 1 && !set.completed && (
                          <Pressable
                            testID={`delete-set-${ex.exerciseId}-${set.setNumber}`}
                            onPress={() => handleDeleteSet(ex.exerciseId, set.id)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={styles.deleteSetButton}
                          >
                            <Text variant="caption" color="muted">
                              Delete Set
                            </Text>
                          </Pressable>
                        )}
                      </View>

                      {/* 3-Column Metric Layout: Weight, Reps, RIR */}
                      <View style={styles.metricsRow}>
                        {/* Weight (kg) */}
                        <View style={styles.metricCol}>
                          <Text variant="caption" color="muted" style={styles.inputLabel}>
                            WEIGHT (KG)
                          </Text>
                          <TextInput
                            testID={`set-weight-${ex.exerciseId}-${set.setNumber}`}
                            defaultValue={set.weight ? String(set.weight) : ''}
                            placeholder="0"
                            placeholderTextColor={colors.dark.textMuted}
                            keyboardType="decimal-pad"
                            onChangeText={(val) =>
                              handleUpdateSetField(ex.exerciseId, set.id, 'weight', val)
                            }
                            style={styles.metricInput}
                          />
                        </View>

                        {/* Reps */}
                        <View style={styles.metricCol}>
                          <Text variant="caption" color="muted" style={styles.inputLabel}>
                            REPS
                          </Text>
                          <TextInput
                            testID={`set-reps-${ex.exerciseId}-${set.setNumber}`}
                            defaultValue={set.reps ? String(set.reps) : ''}
                            placeholder="10"
                            placeholderTextColor={colors.dark.textMuted}
                            keyboardType="number-pad"
                            onChangeText={(val) =>
                              handleUpdateSetField(ex.exerciseId, set.id, 'reps', val)
                            }
                            style={styles.metricInput}
                          />
                        </View>

                        {/* RIR (0-10) */}
                        <View style={styles.metricCol}>
                          <Text variant="caption" color="muted" style={styles.inputLabel}>
                            RIR (0–10)
                          </Text>
                          <TextInput
                            testID={`set-rir-${ex.exerciseId}-${set.setNumber}`}
                            defaultValue={set.rir !== undefined ? String(set.rir) : '2'}
                            placeholder="2"
                            placeholderTextColor={colors.dark.textMuted}
                            keyboardType="decimal-pad"
                            onChangeText={(val) =>
                              handleUpdateSetField(ex.exerciseId, set.id, 'rir', val)
                            }
                            style={styles.metricInput}
                          />
                        </View>
                      </View>

                      {/* Full-width Notes Field */}
                      <View style={styles.notesContainer}>
                        <Text variant="caption" color="muted" style={styles.inputLabel}>
                          NOTES (OPTIONAL)
                        </Text>
                        <TextInput
                          testID={`set-notes-${ex.exerciseId}-${set.setNumber}`}
                          defaultValue={set.notes || ''}
                          placeholder="Form cues, tempo, notes..."
                          placeholderTextColor={colors.dark.textMuted}
                          onChangeText={(val) =>
                            handleUpdateSetField(ex.exerciseId, set.id, 'notes', val)
                          }
                          style={styles.notesInput}
                        />
                      </View>

                      {/* Prominent Full-Width Complete Set Button */}
                      <Pressable
                        testID={`complete-set-${ex.exerciseId}-${set.setNumber}`}
                        onPress={() => handleToggleCompleteSet(ex, set)}
                        style={[
                          styles.completeSetButton,
                          set.completed
                            ? styles.completeSetButtonDone
                            : styles.completeSetButtonActive,
                        ]}
                      >
                        <Text
                          variant="bodyBold"
                          style={[
                            styles.completeSetButtonText,
                            set.completed
                              ? styles.completeSetTextDone
                              : styles.completeSetTextActive,
                          ]}
                        >
                          {set.completed
                            ? `✓ Set ${set.setNumber} Completed`
                            : `Complete Set ${set.setNumber}`}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>

                {/* Add Set Button */}
                <Button
                  testID={`add-set-${ex.exerciseId}`}
                  title="+ Add Set"
                  onPress={() => handleAddSet(ex.exerciseId)}
                  variant="outline"
                  size="md"
                  style={styles.addSetButton}
                />
              </Card>
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

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
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
    borderColor: colors.dark.error,
  },
  finishButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  restBannerCard: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.primary,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  restCompleteCard: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.success,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  restBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restInfo: {
    flex: 1,
    gap: 3,
  },
  restLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  restCompleteLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.dark.success,
  },
  restCountdownText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  restCompleteTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  skipRestButton: {
    minHeight: 44,
    minWidth: 95,
  },
  dismissRestButton: {
    minHeight: 44,
    minWidth: 95,
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
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
    paddingBottom: spacing.sm,
  },
  exerciseHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  arrowButton: {
    backgroundColor: colors.dark.surfaceElevated,
    minWidth: 36,
    minHeight: 32,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  controlIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseTitleGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    flex: 1,
    alignItems: 'flex-start',
  },
  indexBadge: {
    backgroundColor: colors.dark.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.primary,
    marginTop: 2,
  },
  indexBadgeText: {
    fontWeight: '800',
    fontSize: 11,
  },
  exerciseNameContainer: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '700',
  },
  removeExButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeExText: {
    color: colors.dark.error,
    fontWeight: '600',
  },
  targetsBadge: {
    backgroundColor: colors.dark.surfaceElevated,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  targetsText: {
    fontSize: 11,
    fontWeight: '600',
  },
  setsContainer: {
    gap: spacing.md,
  },
  setCard: {
    backgroundColor: colors.dark.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  setCardCompleted: {
    borderColor: colors.dark.primary,
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
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  completedBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.dark.primary,
  },
  deleteSetButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xs,
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricInput: {
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    color: colors.dark.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 46,
  },
  notesContainer: {
    gap: 4,
  },
  notesInput: {
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.dark.textPrimary,
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
    backgroundColor: colors.dark.primary,
  },
  completeSetButtonDone: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  completeSetButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  completeSetTextActive: {
    color: colors.dark.background,
  },
  completeSetTextDone: {
    color: colors.dark.primary,
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
