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
  Modal,
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
  const scrollViewRef = useRef<ScrollView>(null);
  const currentScrollY = useRef(0);
  const cardLayoutsRef = useRef<{ [exerciseId: string]: { y: number; height: number } }>({});

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
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renameInputText, setRenameInputText] = useState('');

  const toggleNotesForSet = (setId: string) => {
    setExpandedNotesSetIds((prev) => {
      let isCurrentlyExpanded = prev[setId];
      if (isCurrentlyExpanded === undefined) {
        const current = sessionRef.current || session;
        const setObj = current?.exercises
          .flatMap((e) => e.actualSets)
          .find((s) => s.id === setId);
        isCurrentlyExpanded = Boolean(setObj?.notes && setObj.notes.trim().length > 0);
      }
      return { ...prev, [setId]: !isCurrentlyExpanded };
    });
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

  // Add exercises from picker (multi-select)
  const handleSelectExercises = async (exercisesToAdd: Exercise[]) => {
    const current = sessionRef.current || session;
    if (!current || exercisesToAdd.length === 0) return;
    setIsPickerVisible(false);

    // Filter out duplicates that already exist in active workout
    const existingIds = new Set(current.exercises.map((e) => e.exerciseId));
    const nonDuplicates = exercisesToAdd.filter((e) => !existingIds.has(e.id));

    if (nonDuplicates.length === 0) {
      Alert.alert('Duplicate Exercises', 'All selected exercises are already in this workout session.');
      return;
    }

    let updated = current;
    for (const exercise of nonDuplicates) {
      updated = workoutRepository.addExerciseToWorkout(updated, {
        id: exercise.id,
        name: exercise.name,
        categoryName: exercise.categoryName,
      });
    }

    await updateSessionAndAutosaveImmediate(updated);
  };

  const handleSelectExercise = async (exercise: Exercise) => {
    await handleSelectExercises([exercise]);
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
    if (finishing) return;
    const current = sessionRef.current || session;
    if (!current || index <= 0) return;

    // Calculate vertical height of the item we are swapping with (above us)
    const swappedEx = current.exercises[index - 1];
    const swappedHeight =
      (swappedEx && cardLayoutsRef.current[swappedEx.exerciseId]?.height) || 260;
    const gap = 14;
    const shift = swappedHeight + gap;

    // Adjust scroll view immediately so moving exercise stays directly under finger
    const targetScrollY = Math.max(0, currentScrollY.current - shift);
    scrollViewRef.current?.scrollTo?.({ y: targetScrollY, animated: false });
    currentScrollY.current = targetScrollY;

    const updated = [...current.exercises];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    const reindexed = updated.map((ex, idx) => ({ ...ex, order: idx }));
    await updateSessionAndAutosaveImmediate({ ...current, exercises: reindexed });
  };

  // Reorder exercise move down
  const handleMoveDownExercise = async (index: number) => {
    if (finishing) return;
    const current = sessionRef.current || session;
    if (!current || index >= current.exercises.length - 1) return;

    // Calculate vertical height of the item we are swapping with (below us)
    const swappedEx = current.exercises[index + 1];
    const swappedHeight =
      (swappedEx && cardLayoutsRef.current[swappedEx.exerciseId]?.height) || 260;
    const gap = 14;
    const shift = swappedHeight + gap;

    // Adjust scroll view immediately so moving exercise stays directly under finger
    const targetScrollY = currentScrollY.current + shift;
    scrollViewRef.current?.scrollTo?.({ y: targetScrollY, animated: false });
    currentScrollY.current = targetScrollY;

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

  const handleTogglePause = async () => {
    const current = sessionRef.current || session;
    if (!current) return;

    if (current.pausedAt) {
      const pauseStartMs = new Date(current.pausedAt).getTime();
      const nowMs = Date.now();
      const pauseDurationSec = Math.max(0, Math.floor((nowMs - pauseStartMs) / 1000));
      const updated: WorkoutSession = {
        ...current,
        accumulatedPauseSeconds: (current.accumulatedPauseSeconds || 0) + pauseDurationSec,
        pausedAt: null,
      };
      await updateSessionAndAutosaveImmediate(updated);
    } else {
      const updated: WorkoutSession = {
        ...current,
        pausedAt: new Date().toISOString(),
      };
      await updateSessionAndAutosaveImmediate(updated);
    }
  };

  const handleOpenRename = () => {
    const current = sessionRef.current || session;
    if (!current) return;
    setRenameInputText(current.name);
    setIsRenameModalVisible(true);
  };

  const handleSaveRename = async () => {
    const trimmed = renameInputText.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Workout name cannot be empty.');
      return;
    }
    const current = sessionRef.current || session;
    if (!current) return;
    const updated = { ...current, name: trimmed };
    await updateSessionAndAutosaveImmediate(updated);
    setIsRenameModalVisible(false);
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
    ? Math.max(baseBottomPadding, (restOverlayHeight > 0 ? restOverlayHeight : 84) + 16)
    : baseBottomPadding;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={styles.keyboardContainer}
      >
        <ScrollView
          ref={scrollViewRef}
          onScroll={(e) => {
            currentScrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
              style={styles.headerIconButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Back or minimize workout"
            >
              <Text variant="titleLarge" color="primary" style={styles.backArrowText}>
                ‹
              </Text>
            </Pressable>

            <View style={styles.headerTitleArea}>
              <View style={styles.headerOverlineRow}>
                <Text variant="caption" style={styles.headerOverlineText}>
                  WORKOUT
                </Text>
                {session.pausedAt ? (
                  <View style={styles.pausedPill}>
                    <Text variant="caption" style={styles.pausedPillText}>
                      PAUSED
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                variant="titleMedium"
                color="primary"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.workoutTitle}
                testID="active-workout-title"
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

            <Pressable
              testID="active-workout-menu-button"
              onPress={() => setIsMenuVisible(true)}
              style={styles.headerIconButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Workout actions menu"
            >
              <Text variant="titleMedium" color="primary" style={styles.menuIconText}>
                ⋮
              </Text>
            </Pressable>
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
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  cardLayoutsRef.current[ex.exerciseId] = { y, height };
                }}
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
        onSelectExercises={handleSelectExercises}
        selectedExerciseIds={session.exercises.map((e) => e.exerciseId)}
        multiSelect={true}
      />

      {/* Workout Options Menu Modal */}
      <Modal
        visible={isMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setIsMenuVisible(false)}
        >
          <View style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <Text variant="caption" style={styles.menuHeaderOverline}>
                WORKOUT OPTIONS
              </Text>
              <Text variant="titleMedium" color="primary" numberOfLines={1} style={styles.menuTitleText}>
                {session.name}
              </Text>
            </View>

            <View style={styles.menuDivider} />

            {/* Pause / Resume Action */}
            <Pressable
              testID="menu-toggle-pause-button"
              onPress={() => {
                setIsMenuVisible(false);
                void handleTogglePause();
              }}
              style={styles.menuItem}
            >
              <Text variant="body" color="primary" style={styles.menuItemText}>
                {session.pausedAt ? '▶  Resume Workout' : '⏸  Pause Workout'}
              </Text>
            </Pressable>

            {/* Rename Action */}
            <Pressable
              testID="menu-rename-workout-button"
              onPress={() => {
                setIsMenuVisible(false);
                handleOpenRename();
              }}
              style={styles.menuItem}
            >
              <Text variant="body" color="primary" style={styles.menuItemText}>
                ✏️  Rename Workout
              </Text>
            </Pressable>

            {/* Discard Action */}
            <Pressable
              testID="menu-discard-workout-button"
              onPress={() => {
                setIsMenuVisible(false);
                handleDiscard();
              }}
              style={styles.menuItem}
            >
              <Text variant="body" style={styles.menuItemDestructiveText}>
                🗑  Discard Workout
              </Text>
            </Pressable>

            <View style={styles.menuDivider} />

            {/* Close Button */}
            <Button
              title="Close"
              variant="outline"
              size="md"
              onPress={() => setIsMenuVisible(false)}
              style={styles.menuCloseButton}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Rename Workout Modal */}
      <Modal
        visible={isRenameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.renameBackdrop}
        >
          <View style={styles.renameCard}>
            <Text variant="titleMedium" color="primary" style={styles.renameTitle}>
              Rename Workout
            </Text>
            <Text variant="caption" color="secondary" style={styles.renameSubtitle}>
              Give this active training session a personalized name.
            </Text>

            <TextInput
              testID="rename-workout-input"
              value={renameInputText}
              onChangeText={setRenameInputText}
              placeholder="e.g. Chest & Triceps"
              placeholderTextColor={colors.textMuted}
              style={styles.renameInput}
              autoFocus
              maxLength={50}
              selectTextOnFocus
            />

            <View style={styles.renameActionsRow}>
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                onPress={() => setIsRenameModalVisible(false)}
                style={styles.renameCancelButton}
              />
              <Button
                testID="save-rename-workout-button"
                title="Save Name"
                variant="primary"
                size="md"
                onPress={handleSaveRename}
                style={styles.renameSaveButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingVertical: 12,
    gap: 14,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrowText: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '400',
  },
  menuIconText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  headerTitleArea: {
    flex: 1,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerOverlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerOverlineText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  pausedPill: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.xs,
  },
  pausedPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 240,
  },
  // Menu Sheet Styles
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  menuHeader: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  menuHeaderOverline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  menuTitleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 4,
  },
  menuItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuItemDestructiveText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
  menuCloseButton: {
    minHeight: 44,
    marginTop: spacing.xs,
  },
  // Rename Modal Styles
  renameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  renameCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.md,
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  renameSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -spacing.xs,
  },
  renameInput: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderLight,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.primary,
    fontSize: 15,
  },
  renameActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  renameCancelButton: {
    flex: 1,
    minHeight: 44,
  },
  renameSaveButton: {
    flex: 1,
    minHeight: 44,
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
    gap: 10,
    marginTop: 12,
    paddingTop: 4,
  },
  addExerciseButton: {
    minHeight: 46,
    borderRadius: 10,
  },
  finishBottomButton: {
    minHeight: 48,
    borderRadius: 10,
  },
  discardBottomButton: {
    minHeight: 38,
    borderRadius: 10,
    borderColor: colors.error,
  },
});
