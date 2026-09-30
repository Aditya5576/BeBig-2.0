import { useAppTheme } from '../../src/features/theme';
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import {
  workoutRepository,
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
  ActiveExerciseCard,
  ActiveWorkoutTimer,
} from '../../src/features/workout';
import { ExercisePickerModal } from '../../src/features/templates/components/ExercisePickerModal';
import { Exercise } from '../../src/features/exercises';
import { spacing, radii } from '../../src/constants/theme';
import { RestTimerOverlay } from '../../src/features/workout/components/RestTimerOverlay';

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
  const styles = useMemo(() => createStyles(colors, insets as any), [colors, insets.bottom]);

  const router = useRouter();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [restOverlayHeight, setRestOverlayHeight] = useState<number>(0);
  const sessionRef = useRef<WorkoutSession | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const cancelDebouncedSave = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const flushActiveWorkout = async (targetSession?: WorkoutSession) => {
    cancelDebouncedSave();
    const sessionToSave = targetSession || sessionRef.current;
    if (!sessionToSave) return;
    try {
      await workoutRepository.updateActiveWorkout(sessionToSave);
    } catch {
      // Background autosave failure caught gracefully
    }
  };

  const updateSessionAndAutosaveImmediate = async (newSession: WorkoutSession) => {
    setSession(newSession);
    sessionRef.current = newSession;
    await flushActiveWorkout(newSession);
  };

  const scheduleDebouncedSave = (newSession: WorkoutSession) => {
    setSession(newSession);
    sessionRef.current = newSession;

    cancelDebouncedSave();

    debounceTimerRef.current = setTimeout(async () => {
      debounceTimerRef.current = null;
      const sessionToSave = sessionRef.current;
      if (!sessionToSave) return;
      try {
        await workoutRepository.updateActiveWorkout(sessionToSave);
      } catch {
        // Silent error during debounced save
      }
    }, 300);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        void flushActiveWorkout();
      }
    });

    return () => {
      subscription.remove();
      void flushActiveWorkout();
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
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
        let active = await workoutRepository.getActiveWorkout();
        if (!isMounted) return;
        if (!active) {
          Alert.alert('No Active Workout', 'There is no workout currently in progress.', [
            { text: 'OK', onPress: () => router.replace('/workout/start' as any) },
          ]);
          return;
        }

        // Resume from paused state if applicable
        if (active.pausedAt) {
          const pauseStartMs = new Date(active.pausedAt).getTime();
          const nowMs = Date.now();
          const pauseDurationSec = Math.max(0, Math.floor((nowMs - pauseStartMs) / 1000));
          
          active = {
            ...active,
            accumulatedPauseSeconds: (active.accumulatedPauseSeconds || 0) + pauseDurationSec,
            pausedAt: null,
          };
          // Persist the resumed state
          await workoutRepository.updateActiveWorkout(active);
        }

        setSession(active);
        sessionRef.current = active;
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
    const current = sessionRef.current || session;
    if (!current) return;
    setIsPickerVisible(false);

    // Check duplicate
    if (current.exercises.some((e) => e.exerciseId === exercise.id)) {
      Alert.alert('Duplicate Exercise', `"${exercise.name}" is already in this workout session.`);
      return;
    }

    const updated = workoutRepository.addExerciseToWorkout(current, {
      id: exercise.id,
      name: exercise.name,
      categoryName: exercise.categoryName,
    });
    await updateSessionAndAutosaveImmediate(updated);
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
            const current = sessionRef.current || session;
            if (!current) return;
            const updated = workoutRepository.removeExerciseFromWorkout(
              current,
              exercise.exerciseId,
            );
            await updateSessionAndAutosaveImmediate(updated);
          },
        },
      ],
    );
  };

  // Reorder exercise move up
  const handleMoveUpExercise = async (index: number) => {
    const current = sessionRef.current || session;
    if (!current || index <= 0) return;
    const updated = [...current.exercises];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    const reindexed = updated.map((ex, idx) => ({ ...ex, order: idx }));
    await updateSessionAndAutosaveImmediate({ ...current, exercises: reindexed });
  };

  // Reorder exercise move down
  const handleMoveDownExercise = async (index: number) => {
    const current = sessionRef.current || session;
    if (!current || index >= current.exercises.length - 1) return;
    const updated = [...current.exercises];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    const reindexed = updated.map((ex, idx) => ({ ...ex, order: idx }));
    await updateSessionAndAutosaveImmediate({ ...current, exercises: reindexed });
  };

  // Add set to exercise
  const handleAddSet = async (exerciseId: string) => {
    const current = sessionRef.current || session;
    if (!current) return;
    const updated = workoutRepository.addSetToExercise(current, exerciseId);
    await updateSessionAndAutosaveImmediate(updated);
  };

  // Delete set
  const handleDeleteSet = async (exerciseId: string, setId: string) => {
    const current = sessionRef.current || session;
    if (!current) return;
    const updated = workoutRepository.removeSetFromExercise(current, exerciseId, setId);
    await updateSessionAndAutosaveImmediate(updated);
  };

  // Update set field (weight, reps, rir, notes)
  const handleUpdateSetField = async (
    exerciseId: string,
    setId: string,
    field: keyof WorkoutSet,
    value: string,
  ) => {
    const current = sessionRef.current || session;
    if (!current) return;

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
      const updated = workoutRepository.updateSet(current, exerciseId, setId, partial);
      scheduleDebouncedSave(updated);
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
    const current = sessionRef.current || session;
    if (!current) return;

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
      let updated = workoutRepository.updateSet(current, exercise.exerciseId, set.id, {
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

      await updateSessionAndAutosaveImmediate(updated);
    } else {
      // Un-complete set
      const updated = workoutRepository.updateSet(current, exercise.exerciseId, set.id, {
        completed: false,
        completedAt: undefined,
      });
      await updateSessionAndAutosaveImmediate(updated);
    }
  };

  // Extend active rest timer
  const handleExtendRest = async (addedSeconds: number) => {
    const current = sessionRef.current || session;
    if (!current || !current.activeRestTimer) return;
    const updated = workoutRepository.extendRestTimer(current, addedSeconds);
    await updateSessionAndAutosaveImmediate(updated);
  };

  // Skip or dismiss rest timer
  const handleClearRest = async () => {
    const current = sessionRef.current || session;
    if (!current) return;
    const updated = workoutRepository.clearRestTimer(current);
    await updateSessionAndAutosaveImmediate(updated);
  };

  // Pause or resume rest timer
  const handleTogglePauseRest = async () => {
    const current = sessionRef.current || session;
    if (!current || !current.activeRestTimer) return;
    const updated = current.activeRestTimer.isPaused
      ? workoutRepository.resumeRestTimer(current)
      : workoutRepository.pauseRestTimer(current);
    await updateSessionAndAutosaveImmediate(updated);
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
            cancelDebouncedSave();
            await workoutRepository.discardActiveWorkout();
            router.replace('/home' as any);
          },
        },
      ],
    );
  };

  // Finish workout
  const handleFinish = () => {
    const current = sessionRef.current || session;
    if (!current) return;

    const completedCount = workoutRepository.countCompletedSets(current);
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
              const latest = sessionRef.current || current;
              await flushActiveWorkout(latest);
              const completed = await workoutRepository.completeActiveWorkout(latest);
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

  const handleMinimize = async () => {
    const current = sessionRef.current || session;
    if (current) {
      const updatedSession = { ...current, pausedAt: new Date().toISOString() };
      await updateSessionAndAutosaveImmediate(updatedSession);
    }
    router.push('/home' as any);
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

  const baseBottomPadding = 80 + Math.max(insets.bottom, 12);
  const dynamicBottomPadding = !!session?.activeRestTimer
    ? Math.max(baseBottomPadding, (restOverlayHeight > 0 ? restOverlayHeight : 240) + 32)
    : baseBottomPadding;

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
            { paddingBottom: dynamicBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar / Header */}
          <View style={styles.topBar}>
            <Pressable
              testID="minimize-workout-button"
              onPress={handleMinimize}
              style={styles.minimizeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Minimize workout"
            >
              <Text variant="titleMedium" color="primary">
                ▼
              </Text>
            </Pressable>

            <View style={styles.headerTitleArea}>
              <Text
                variant="titleMedium"
                color="primary"
                numberOfLines={1}
                style={styles.workoutTitle}
              >
                {session.name}
              </Text>
              <ActiveWorkoutTimer
                startedAt={session.startedAt}
                accumulatedPauseSeconds={session.accumulatedPauseSeconds}
                pausedAt={session.pausedAt}
                status={session.status}
              />
            </View>

            <View style={styles.headerRightSpacer} />
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
              testID="finish-workout-button"
              title={`Finish Workout (${completedSetsCount} sets)`}
              onPress={handleFinish}
              variant="primary"
              size="lg"
              loading={finishing}
              style={styles.finishBottomButton}
            />

            <Button
              testID="discard-workout-button"
              title="Discard Workout"
              onPress={handleDiscard}
              variant="outline"
              size="sm"
              style={styles.discardBottomButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Persistent Bottom Rest Overlay */}
      {session.activeRestTimer && (
        <RestTimerOverlay
          activeRestTimer={session.activeRestTimer}
          onExtend={handleExtendRest}
          onClear={handleClearRest}
          onTogglePause={handleTogglePauseRest}
          onHeightChange={setRestOverlayHeight}
        />
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    gap: spacing.md,
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
    alignItems: 'center',
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  minimizeButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: 44,
  },
  headerRightSpacer: {
    width: 44,
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
  discardBottomButton: {
    minHeight: 44,
    borderColor: colors.error,
  },
});
