import { useAppTheme } from '../../src/features/theme';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { useRouter, useFocusEffect as routerFocusEffect } from 'expo-router';
import { ScreenContainer, Text, Button, Card, Icon, ErrorBoundary } from '../../src/components/ui';
import {
  workoutRepository,
  workoutStorage,
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
  SetType,
  ActiveExerciseCard,
  ActiveWorkoutTimer,
  ExerciseDetailModal,
  WorkoutNumericKeypad,
  workoutNotificationService,
  getSupersetDisplayInfo,
} from '../../src/features/workout';
import { ExercisePickerModal } from '../../src/features/templates/components/ExercisePickerModal';
import {
  buildLastPerformanceMap,
  buildProgressiveOverloadMap,
} from '../../src/features/workout/services/previousPerformanceService';
import { useAuthStore } from '../../src/features/auth';
import { Exercise, exerciseRepository } from '../../src/features/exercises';
import { normalizeTrackingMode, resolveExerciseTrackingMode } from '../../src/features/exercises/exerciseTracking';
import { spacing, radii } from '../../src/constants/theme';
import { DOMAIN_LIMITS } from '../../src/constants/domainLimits';
import { RestTimerOverlay } from '../../src/features/workout/components/RestTimerOverlay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActiveFocusField } from '../../src/features/workout/components/ActiveSetRow';
import { registerActiveWorkoutUpdateGuard } from '../../src/lib/pwa/pwaUpdateCoordinator';

const useFocusEffect =
  typeof routerFocusEffect === 'function' ? routerFocusEffect : (fn: any) => fn();

export default function ActiveWorkoutScreen() {
  const { colors } = useAppTheme();
  let insets = { bottom: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    insets = { bottom: 0 };
  }
  const bottomInsetValue = insets.bottom;
  const styles = useMemo(
    () => createStyles(colors, { bottom: bottomInsetValue } as any),
    [colors, bottomInsetValue]
  );

  const router = useRouter();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [restOverlayHeight, setRestOverlayHeight] = useState<number>(0);

  const activeExerciseIds = useMemo(
    () => session?.exercises?.map((e) => e.exerciseId) ?? [],
    [session?.exercises],
  );
  const sessionRef = useRef<WorkoutSession | null>(null);
  const editGenerationRef = useRef(0);
  const isMountedRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: true once the workout is completed or discarded so that the
  // component cleanup / AppState background handler never re-saves a stale
  // active session over the already-cleared active draft.
  const workoutCompletedRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const currentScrollY = useRef(0);
  const cardLayoutsRef = useRef<{ [exerciseId: string]: { y: number; height: number } }>({});
  const cardLayoutHandlersRef = useRef<Record<string, (e: any) => void>>({});

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getCardLayoutHandler = useCallback((exerciseId: string) => {
    if (!cardLayoutHandlersRef.current[exerciseId]) {
      cardLayoutHandlersRef.current[exerciseId] = (e: any) => {
        const { y, height } = e.nativeEvent.layout;
        cardLayoutsRef.current[exerciseId] = { y, height };
      };
    }
    return cardLayoutHandlersRef.current[exerciseId];
  }, []);

  const [keypadFocus, setKeypadFocus] = useState<{
    exerciseId: string;
    setId: string;
    field: ActiveFocusField;
    value: string;
  } | null>(null);
  const [useNativeKeyboard, setUseNativeKeyboard] = useState(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const cancelDebouncedSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const flushActiveWorkout = useCallback(
    async (
      targetSession?: WorkoutSession,
      options?: { allowEmptyOverwrites?: boolean; allowExerciseRemoval?: boolean; surfaceError?: boolean }
    ): Promise<WorkoutSession | null | undefined> => {
      // Do not autosave after the workout has been completed or discarded.
      // This prevents the unmount cleanup from resurrecting a cleared active draft.
      if (workoutCompletedRef.current) return null;
      cancelDebouncedSave();
      const sessionToSave = targetSession || sessionRef.current;
      if (!sessionToSave) return null;
      const submittedSessionId = sessionToSave.id;
      const submittedGeneration = editGenerationRef.current;
      try {
        // Discard tombstone check: prevent resurrecting discarded session
        const isDiscarded = await workoutRepository.isSessionDiscarded(sessionToSave.id);
        if (isDiscarded) {
          workoutCompletedRef.current = true;
          return null;
        }
        const saved = await workoutRepository.updateActiveWorkout(sessionToSave, undefined, options);
        const isSameCurrentGeneration =
          sessionRef.current?.id === submittedSessionId &&
          editGenerationRef.current === submittedGeneration;
        if (saved && !workoutCompletedRef.current && isMountedRef.current && isSameCurrentGeneration) {
          sessionRef.current = saved;
          setSession(saved);
        }
        if (!isSameCurrentGeneration && sessionRef.current) {
          return sessionRef.current;
        }
        return saved || sessionToSave;
      } catch (err) {
        if (options?.surfaceError) {
          throw err;
        }
        // Background autosave failure caught gracefully
        return null;
      }
    },
    [cancelDebouncedSave]
  );

  const updateSessionAndAutosaveImmediate = useCallback(
    async (
      newSession: WorkoutSession,
      options?: { allowEmptyOverwrites?: boolean; allowExerciseRemoval?: boolean }
    ) => {
      const nextRev = Math.max(Number(newSession.revision ?? 0), Number(newSession.version ?? 0)) + 1;
      const sessionWithRev = { ...newSession, revision: nextRev, version: nextRev };
      editGenerationRef.current += 1;
      setSession(sessionWithRev);
      sessionRef.current = sessionWithRev;
      await flushActiveWorkout(sessionWithRev, options);
    },
    [flushActiveWorkout]
  );

  const scheduleDebouncedSave = useCallback(
    (newSession: WorkoutSession) => {
      const nextRev = Math.max(Number(newSession.revision ?? 0), Number(newSession.version ?? 0)) + 1;
      const sessionWithRev = { ...newSession, revision: nextRev, version: nextRev };
      editGenerationRef.current += 1;
      setSession(sessionWithRev);
      sessionRef.current = sessionWithRev;

      // Do not schedule a new debounced save after completion or discard.
      if (workoutCompletedRef.current) return;

      cancelDebouncedSave();

      debounceTimerRef.current = setTimeout(async () => {
        debounceTimerRef.current = null;
        const sessionToSave = sessionRef.current;
        if (!sessionToSave || workoutCompletedRef.current) return;
        const submittedSessionId = sessionToSave.id;
        const submittedGeneration = editGenerationRef.current;
        try {
          const isDiscarded = await workoutRepository.isSessionDiscarded(sessionToSave.id);
          if (isDiscarded) {
            workoutCompletedRef.current = true;
            return;
          }
          const saved = await workoutRepository.updateActiveWorkout(sessionToSave);
          const isSameCurrentGeneration =
            sessionRef.current?.id === submittedSessionId &&
            editGenerationRef.current === submittedGeneration;
          if (saved && !workoutCompletedRef.current && isMountedRef.current && isSameCurrentGeneration) {
            sessionRef.current = saved;
            setSession(saved);
          }
        } catch {
          // Silent error during debounced save
        }
      }, 300);
    },
    [cancelDebouncedSave]
  );

  useEffect(() => {
    const writeSyncEmergencyMirror = () => {
      const current = sessionRef.current;
      if (!current || workoutCompletedRef.current) return;
      workoutStorage.writeSyncEmergencyMirror(current);
    };

    const handleBackgroundFlush = () => {
      writeSyncEmergencyMirror();
      void flushActiveWorkout();
    };

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        handleBackgroundFlush();
      }
    });

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        handleBackgroundFlush();
      }
    };

    const onPageHide = () => {
      handleBackgroundFlush();
    };

    const onBeforeUnload = () => {
      handleBackgroundFlush();
    };

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('beforeunload', onBeforeUnload);
      window.addEventListener('freeze', handleBackgroundFlush);
    }

    return () => {
      subscription.remove();
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('beforeunload', onBeforeUnload);
        window.removeEventListener('freeze', handleBackgroundFlush);
      }
      handleBackgroundFlush();
    };
  }, [flushActiveWorkout]);

  // Register active workout revision-bound flush+verify guard so PWA updates never interrupt mid-edit
  useEffect(() => {
    const getRev = (s: WorkoutSession | null | undefined) =>
      Number(s?.revision ?? s?.version ?? 0);

    return registerActiveWorkoutUpdateGuard({
      flushAndReadSnapshot: async () => {
        const current = sessionRef.current;
        if (!current || workoutCompletedRef.current) {
          return { sessionId: null, revision: 0 };
        }
        const flushed = await flushActiveWorkout(current, { surfaceError: true });
        const latest = flushed || sessionRef.current;
        if (!latest) return null;
        return { sessionId: latest.id, revision: getRev(latest) };
      },
      verifyPersistedSnapshot: async (expected) => {
        if (!expected.sessionId) return true;
        const verified = await workoutRepository.getActiveWorkout();
        return Boolean(
          verified &&
            verified.id === expected.sessionId &&
            getRev(verified) === expected.revision,
        );
      },
      verifyCurrentSnapshot: (expected) => {
        const live = sessionRef.current;
        const hasLiveActiveWorkout = Boolean(live && !workoutCompletedRef.current);
        // If authorized outside an active workout (e.g. from Home), reject while a live workout is mounted
        if (!expected.sessionId) {
          return !hasLiveActiveWorkout;
        }
        if (!hasLiveActiveWorkout) return true;
        return live!.id === expected.sessionId && getRev(live) === expected.revision;
      },
    });
  }, [flushActiveWorkout]);

  useFocusEffect(
    useCallback(() => {
      let isFocused = true;

      async function syncActiveWorkoutOnFocus() {
        try {
          const active = await workoutRepository.getActiveWorkout();
          if (!isFocused) return;
          if (!active) {
            // Storage active session was cleared (e.g. discarded from another screen or browser tab)
            if (sessionRef.current && !workoutCompletedRef.current) {
              workoutCompletedRef.current = true;
              setSession(null);
              sessionRef.current = null;
              router.replace('/home' as any);
            }
            return;
          }

          const currentInMemory = sessionRef.current;

          // CONTENT PRESERVATION RULE:
          // If in-memory state has exercises and stored active session has 0 exercises,
          // IN-MEMORY WINS! Never clobber rich in-memory sets with empty storage.
          if (
            currentInMemory &&
            currentInMemory.id === active.id &&
            currentInMemory.exercises &&
            currentInMemory.exercises.length > 0 &&
            (!active.exercises || active.exercises.length === 0)
          ) {
            console.warn(
              '[ACTIVE_WORKOUT] In-memory workout has exercises while storage is empty. Healing storage from in-memory!'
            );
            void flushActiveWorkout(currentInMemory);
            return;
          }

          // If storage contains a different active workout session than currently mounted
          if (!sessionRef.current || sessionRef.current.id !== active.id) {
            editGenerationRef.current += 1;
            setSession(active);
            sessionRef.current = active;
            workoutCompletedRef.current = false;
          } else if (currentInMemory) {
            // Same session: rehydrate only if stored active has higher revision AND equal or more exercises
            const storedSeq = Math.max(Number(active.revision ?? 0), Number(active.version ?? 0));
            const inMemorySeq = Math.max(Number(currentInMemory.revision ?? 0), Number(currentInMemory.version ?? 0));
            const storedExercisesCount = active.exercises?.length ?? 0;
            const inMemoryExercisesCount = currentInMemory.exercises?.length ?? 0;

            if (storedSeq > inMemorySeq && storedExercisesCount >= inMemoryExercisesCount) {
              editGenerationRef.current += 1;
              setSession(active);
              sessionRef.current = active;
            }
          }
        } catch {
          // Graceful fallback
        }
      }

      void syncActiveWorkoutOnFocus();

      return () => {
        isFocused = false;
      };
    }, [router, flushActiveWorkout])
  );

  const [loading, setLoading] = useState(true);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [completedWorkoutsHistory, setCompletedWorkoutsHistory] = useState<WorkoutSession[]>([]);
  const [expandedNotesSetIds, setExpandedNotesSetIds] = useState<Record<string, boolean>>({});
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renameInputText, setRenameInputText] = useState('');
  const [selectedDetailExercise, setSelectedDetailExercise] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleOpenExerciseDetail = useCallback((exerciseId: string, exerciseName: string) => {
    setSelectedDetailExercise({ id: exerciseId, name: exerciseName });
  }, []);

  const handleRenameExercise = useCallback(async (exerciseId: string, newName: string) => {
    const updatedEx = await exerciseRepository.renameExercise(exerciseId, newName);
    const current = sessionRef.current;
    if (!current) return;
    const renamedSession = workoutRepository.renameExerciseInWorkout(
      current,
      exerciseId,
      updatedEx.name,
    );
    await updateSessionAndAutosaveImmediate(renamedSession);
  }, [updateSessionAndAutosaveImmediate]);

  const handleCloseExerciseDetail = useCallback(() => {
    setSelectedDetailExercise(null);
  }, []);

  const activeUserScopeKey = useAuthStore((state) =>
    state.user?.id
      ? `auth:${state.user.id}`
      : state.isGuest && state.guestSession?.id
      ? `guest:${state.guestSession.id}`
      : 'guest'
  );

  const toggleNotesForSet = useCallback((setId: string) => {
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
  }, [session]);

  const closeNotesForSet = useCallback(async (setId: string) => {
    setExpandedNotesSetIds((prev) => ({ ...prev, [setId]: false }));
    try {
      await flushActiveWorkout(sessionRef.current || undefined, { surfaceError: true });
    } catch (err: any) {
      Alert.alert(
        'Note Not Saved Yet',
        err?.message || 'Could not save your set note to storage. Please tap Done again to retry.'
      );
    }
  }, [flushActiveWorkout]);

  const EMPTY_NOTES_MAP: Record<string, boolean> = useMemo(() => ({}), []);
  const prevExerciseNotesRef = useRef<Record<string, Record<string, boolean>>>({});

  const expandedNotesByExercise = useMemo(() => {
    const nextByEx: Record<string, Record<string, boolean>> = {};
    const prevByEx = prevExerciseNotesRef.current;

    for (const ex of session?.exercises || []) {
      const slice: Record<string, boolean> = {};
      let hasAny = false;
      for (const s of ex.actualSets || []) {
        if (s.id in expandedNotesSetIds) {
          slice[s.id] = expandedNotesSetIds[s.id];
          hasAny = true;
        }
      }

      if (!hasAny) {
        nextByEx[ex.exerciseId] = EMPTY_NOTES_MAP;
        continue;
      }

      const prevSlice = prevByEx[ex.exerciseId];
      const sliceKeys = Object.keys(slice);
      if (
        prevSlice &&
        Object.keys(prevSlice).length === sliceKeys.length &&
        sliceKeys.every((k) => prevSlice[k] === slice[k])
      ) {
        nextByEx[ex.exerciseId] = prevSlice;
      } else {
        nextByEx[ex.exerciseId] = slice;
      }
    }

    prevExerciseNotesRef.current = nextByEx;
    return nextByEx;
  }, [session?.exercises, expandedNotesSetIds, EMPTY_NOTES_MAP]);

  // Load user-scoped completed workout history ONCE on mount / user scope change (zero per-keystroke queries)
  useEffect(() => {
    let isMounted = true;
    setCompletedWorkoutsHistory([]);

    async function loadCompletedHistoryOnce() {
      try {
        const completed = await workoutRepository.getCompletedWorkouts();
        if (isMounted) {
          setCompletedWorkoutsHistory(completed);
        }
      } catch {
        // Fallback gracefully
      }
    }

    void loadCompletedHistoryOnce();

    return () => {
      isMounted = false;
    };
  }, [activeUserScopeKey]);

  const exerciseIdentityKey = useMemo(
    () =>
      (session?.exercises || [])
        .map((e, i) => `${e.exerciseId}:${e.order ?? i}`)
        .join('|'),
    [session?.exercises]
  );

  const exercisesForLastPerfRef = useRef(session?.exercises);
  exercisesForLastPerfRef.current = session?.exercises;

  const lastPerformanceMap = useMemo(() => {
    const exList = exercisesForLastPerfRef.current;
    return exList && exList.length > 0 && exerciseIdentityKey
      ? buildLastPerformanceMap(exList, completedWorkoutsHistory, session?.id)
      : {};
  }, [exerciseIdentityKey, session?.id, completedWorkoutsHistory]);

  const progressiveOverloadMap = useMemo(
    () => buildProgressiveOverloadMap(completedWorkoutsHistory, session?.id),
    [completedWorkoutsHistory, session?.id]
  );

  // Load active workout draft
  useEffect(() => {
    let isMounted = true;
    void workoutNotificationService.ensureNotificationChannel();

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
          active = await workoutRepository.updateActiveWorkout(active);
        }

        editGenerationRef.current += 1;
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
      const trackingMode = resolveExerciseTrackingMode(exercise);
      updated = workoutRepository.addExerciseToWorkout(updated, {
        id: exercise.id,
        name: exercise.name,
        categoryName: exercise.categoryName,
        trackingMode,
      });
    }

    // 0ms optimistic UI: update state on frame 0, flush active workout immediately
    await updateSessionAndAutosaveImmediate(updated);
  };

  const handleSelectExercise = async (exercise: Exercise) => {
    await handleSelectExercises([exercise]);
  };

  // Remove exercise
  const handleRemoveExercise = useCallback((exercise: WorkoutExercise) => {
    Alert.alert(
      'Remove Exercise',
      `Remove "${exercise.exerciseName}" and all of its logged sets from this active workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setKeypadFocus((prev) => (prev?.exerciseId === exercise.exerciseId ? null : prev));
            const current = sessionRef.current;
            if (!current) return;
            const updated = workoutRepository.removeExerciseFromWorkout(
              current,
              exercise.exerciseId,
            );
            await updateSessionAndAutosaveImmediate(updated, {
              allowEmptyOverwrites: updated.exercises.length === 0,
              allowExerciseRemoval: true,
            });
          },
        },
      ],
    );
  }, [updateSessionAndAutosaveImmediate]);

  // Reorder exercise move up
  const handleMoveUpExercise = useCallback(async (index: number) => {
    const current = sessionRef.current;
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

    const updated = workoutRepository.moveExerciseUp(current, index);
    await updateSessionAndAutosaveImmediate(updated);
  }, [updateSessionAndAutosaveImmediate]);

  // Reorder exercise move down
  const handleMoveDownExercise = useCallback(async (index: number) => {
    const current = sessionRef.current;
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

    const updated = workoutRepository.moveExerciseDown(current, index);
    await updateSessionAndAutosaveImmediate(updated);
  }, [updateSessionAndAutosaveImmediate]);

  // Link exercise with next into Superset or Giant Set
  const handleLinkSuperset = useCallback(async (index: number) => {
    const current = sessionRef.current;
    if (!current) return;
    const updated = workoutRepository.linkSupersetWithNext(current, index);
    await updateSessionAndAutosaveImmediate(updated);
  }, [updateSessionAndAutosaveImmediate]);

  // Unlink exercise from Superset or Giant Set
  const handleUnlinkSuperset = useCallback(async (index: number) => {
    const current = sessionRef.current;
    if (!current) return;
    const updated = workoutRepository.unlinkSuperset(current, index);
    await updateSessionAndAutosaveImmediate(updated);
  }, [updateSessionAndAutosaveImmediate]);

  // Add set to exercise (0ms optimistic UI)
  const handleAddSet = useCallback((exerciseId: string) => {
    const current = sessionRef.current;
    if (!current) return;
    const updated = workoutRepository.addSetToExercise(current, exerciseId);
    void updateSessionAndAutosaveImmediate(updated);
  }, [updateSessionAndAutosaveImmediate]);

  // Delete set (0ms optimistic UI)
  const handleDeleteSet = useCallback((exerciseId: string, setId: string) => {
    setKeypadFocus((prev) => (prev?.setId === setId ? null : prev));
    const current = sessionRef.current;
    if (!current) return;
    const targetEx = current.exercises.find((e) => e.exerciseId === exerciseId);
    if (!targetEx || targetEx.actualSets.length <= 1) return;
    const targetSet = targetEx.actualSets.find((s) => s.id === setId);
    if (targetSet?.completed) return;

    const updated = workoutRepository.removeSetFromExercise(current, exerciseId, setId);
    void updateSessionAndAutosaveImmediate(updated);
  }, [updateSessionAndAutosaveImmediate]);

  // Update set field (weight, reps, rir, inclinePercent, speedKph, durationSeconds, notes)
  const handleUpdateSetField = useCallback(
    async (
      exerciseId: string,
      setId: string,
      field: keyof WorkoutSet | 'durationMinutes',
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
        partial = { rir: isNaN(num) ? 0 : Math.min(DOMAIN_LIMITS.RIR_MAX, Math.max(DOMAIN_LIMITS.RIR_MIN, num)) };
      } else if (field === 'inclinePercent') {
        if (!value || value.trim() === '') {
          partial = { inclinePercent: undefined };
        } else {
          const num = parseFloat(value);
          partial = { inclinePercent: isNaN(num) ? undefined : Math.min(50, Math.max(0, num)) };
        }
      } else if (field === 'speedKph') {
        if (!value || value.trim() === '') {
          partial = { speedKph: undefined };
        } else {
          const num = parseFloat(value);
          partial = { speedKph: isNaN(num) ? undefined : Math.min(40, Math.max(0, num)) };
        }
      } else if (field === 'durationMinutes') {
        if (!value || value.trim() === '') {
          partial = { durationSeconds: undefined };
        } else {
          const num = parseFloat(value);
          partial = { durationSeconds: isNaN(num) ? undefined : Math.min(86400, Math.max(0, Math.round(num * 60))) };
        }
      } else if (field === 'durationSeconds') {
        if (!value || value.trim() === '') {
          partial = { durationSeconds: undefined };
        } else {
          const num = parseInt(value, 10);
          partial = { durationSeconds: isNaN(num) ? undefined : Math.min(86400, Math.max(0, num)) };
        }
      } else if (field === 'notes') {
        partial = { notes: value };
      } else if (field === 'setType') {
        partial = { setType: value as SetType };
      }

      try {
        let updated = workoutRepository.updateSet(current, exerciseId, setId, partial);
        if (field === 'setType') {
          // If user changed setType to 'drop' while a rest timer is running for this exercise, dismiss it immediately
          if (value === 'drop' && updated.activeRestTimer && updated.activeRestTimer.exerciseId === exerciseId) {
            updated = workoutRepository.clearRestTimer(updated);
          }
          await updateSessionAndAutosaveImmediate(updated);
        } else {
          scheduleDebouncedSave(updated);
        }
      } catch {
        // Silent error during active typing
      }
    },
    [session, updateSessionAndAutosaveImmediate, scheduleDebouncedSave]
  );

  const handleFocusField = useCallback(
    (
      exerciseId: string,
      setId: string,
      field: ActiveFocusField,
      currentValue: string
    ) => {
      if (useNativeKeyboard) return;
      setKeypadFocus({
        exerciseId,
        setId,
        field,
        value: currentValue,
      });
    },
    [useNativeKeyboard]
  );

  const handleKeypadPress = useCallback(
    (digit: string) => {
      if (!keypadFocus) return;
      let currentVal = keypadFocus.value;
      let nextVal = currentVal;
      if (digit === '.') {
        if (nextVal.includes('.')) return;
        nextVal = nextVal ? `${nextVal}.` : '0.';
      } else {
        nextVal = nextVal === '0' ? digit : `${nextVal}${digit}`;
      }
      setKeypadFocus((prev) => (prev ? { ...prev, value: nextVal } : null));
      void handleUpdateSetField(keypadFocus.exerciseId, keypadFocus.setId, keypadFocus.field, nextVal);
    },
    [keypadFocus, handleUpdateSetField]
  );

  const handleKeypadBackspace = useCallback(() => {
    if (!keypadFocus) return;
    const currentVal = keypadFocus.value;
    const nextVal = currentVal.slice(0, -1);
    setKeypadFocus((prev) => (prev ? { ...prev, value: nextVal } : null));
    void handleUpdateSetField(keypadFocus.exerciseId, keypadFocus.setId, keypadFocus.field, nextVal);
  }, [keypadFocus, handleUpdateSetField]);

  const handleKeypadClear = useCallback(() => {
    if (!keypadFocus) return;
    const nextVal = '';
    setKeypadFocus((prev) => (prev ? { ...prev, value: nextVal } : null));
    void handleUpdateSetField(keypadFocus.exerciseId, keypadFocus.setId, keypadFocus.field, nextVal);
  }, [keypadFocus, handleUpdateSetField]);

  const handleKeypadStep = useCallback(
    (delta: number) => {
      if (!keypadFocus) return;
      const currentVal = keypadFocus.value;
      const currentNum = parseFloat(currentVal) || 0;
      const nextNum = Math.round((currentNum + delta) * 100) / 100;
      const clamped = Math.max(0, nextNum);
      const nextVal = keypadFocus.field === 'inclinePercent' ? String(clamped) : clamped === 0 ? '' : String(clamped);
      setKeypadFocus((prev) => (prev ? { ...prev, value: nextVal } : null));
      void handleUpdateSetField(keypadFocus.exerciseId, keypadFocus.setId, keypadFocus.field, nextVal);
    },
    [keypadFocus, handleUpdateSetField]
  );

  const handleKeypadNext = useCallback(() => {
    if (!keypadFocus) return;
    const current = sessionRef.current || session;
    if (!current) return;
    const currentEx = current.exercises.find((e) => e.exerciseId === keypadFocus.exerciseId);
    if (!currentEx) return;
    const currentSetIndex = currentEx.actualSets.findIndex((s) => s.id === keypadFocus.setId);
    if (currentSetIndex === -1) return;
    const targetSet = currentEx.actualSets[currentSetIndex];
    const isTreadmill = normalizeTrackingMode(currentEx.trackingMode) === 'treadmill';

    if (isTreadmill) {
      if (keypadFocus.field === 'inclinePercent') {
        const val = targetSet.speedKph != null && targetSet.speedKph > 0 ? String(targetSet.speedKph) : '';
        setKeypadFocus({
          exerciseId: keypadFocus.exerciseId,
          setId: keypadFocus.setId,
          field: 'speedKph',
          value: val,
        });
        return;
      } else if (keypadFocus.field === 'speedKph') {
        const val = targetSet.durationSeconds != null && targetSet.durationSeconds > 0
          ? String(Math.round((targetSet.durationSeconds / 60) * 100) / 100)
          : '';
        setKeypadFocus({
          exerciseId: keypadFocus.exerciseId,
          setId: keypadFocus.setId,
          field: 'durationMinutes',
          value: val,
        });
        return;
      }
      // durationMinutes -> advance to next set or next exercise or dismiss
    } else {
      if (keypadFocus.field === 'weight') {
        const val = targetSet.reps != null && targetSet.reps > 0 ? String(targetSet.reps) : '';
        setKeypadFocus({
          exerciseId: keypadFocus.exerciseId,
          setId: keypadFocus.setId,
          field: 'reps',
          value: val,
        });
        return;
      } else if (keypadFocus.field === 'reps') {
        const val = targetSet.rir != null ? String(targetSet.rir) : '';
        setKeypadFocus({
          exerciseId: keypadFocus.exerciseId,
          setId: keypadFocus.setId,
          field: 'rir',
          value: val,
        });
        return;
      }
      // rir -> advance to next set or next exercise or dismiss
    }

    // Advance to next set
    if (currentSetIndex < currentEx.actualSets.length - 1) {
      const nextSet = currentEx.actualSets[currentSetIndex + 1];
      if (isTreadmill) {
        const val = nextSet.inclinePercent != null ? String(nextSet.inclinePercent) : '';
        setKeypadFocus({
          exerciseId: keypadFocus.exerciseId,
          setId: nextSet.id,
          field: 'inclinePercent',
          value: val,
        });
      } else {
        const val = nextSet.weight != null && nextSet.weight > 0 ? String(nextSet.weight) : '';
        setKeypadFocus({
          exerciseId: keypadFocus.exerciseId,
          setId: nextSet.id,
          field: 'weight',
          value: val,
        });
      }
      return;
    }

    // Advance to next exercise
    const exIndex = current.exercises.findIndex((e) => e.exerciseId === keypadFocus.exerciseId);
    if (exIndex < current.exercises.length - 1) {
      const nextEx = current.exercises[exIndex + 1];
      if (nextEx.actualSets.length > 0) {
        const nextSet = nextEx.actualSets[0];
        const nextIsTreadmill = normalizeTrackingMode(nextEx.trackingMode) === 'treadmill';
        if (nextIsTreadmill) {
          const val = nextSet.inclinePercent != null ? String(nextSet.inclinePercent) : '';
          setKeypadFocus({
            exerciseId: nextEx.exerciseId,
            setId: nextSet.id,
            field: 'inclinePercent',
            value: val,
          });
        } else {
          const val = nextSet.weight != null && nextSet.weight > 0 ? String(nextSet.weight) : '';
          setKeypadFocus({
            exerciseId: nextEx.exerciseId,
            setId: nextSet.id,
            field: 'weight',
            value: val,
          });
        }
        return;
      }
    }

    setKeypadFocus(null);
    void flushActiveWorkout();
  }, [keypadFocus, session, flushActiveWorkout]);

  const handleKeypadDismiss = useCallback(() => {
    setKeypadFocus(null);
    void flushActiveWorkout();
  }, [flushActiveWorkout]);

  const handleToggleNativeKeyboard = useCallback(() => {
    setUseNativeKeyboard((prev) => !prev);
    setKeypadFocus(null);
  }, []);

  // Toggle complete set
  const handleToggleCompleteSet = useCallback(async (
    exercise: WorkoutExercise,
    set: WorkoutSet,
    pendingUpdates?: Partial<WorkoutSet>,
  ) => {
    setKeypadFocus((prev) => (prev?.setId === set.id ? null : prev));
    const current = sessionRef.current;
    if (!current) return;

    const latestExercise =
      current.exercises.find((e) => e.exerciseId === exercise.exerciseId) || exercise;
    const latestSet = latestExercise.actualSets.find((s) => s.id === set.id) || set;

    const effectiveSet = { ...latestSet, ...pendingUpdates };
    const isTreadmill = normalizeTrackingMode(latestExercise.trackingMode) === 'treadmill';

    if (!effectiveSet.completed) {
      // Validate before completing
      if (isTreadmill) {
        const speed = effectiveSet.speedKph ?? 0;
        const dur = effectiveSet.durationSeconds ?? 0;
        const incline = effectiveSet.inclinePercent ?? 0;

        if (speed <= 0 || isNaN(speed)) {
          Alert.alert('Invalid Speed', 'Speed must be greater than 0 km/h to complete a treadmill set.');
          return;
        }
        if (dur <= 0 || isNaN(dur)) {
          Alert.alert('Invalid Duration', 'Duration must be greater than 0 seconds to complete a treadmill set.');
          return;
        }
        if (incline < 0 || isNaN(incline)) {
          Alert.alert('Invalid Incline', 'Incline cannot be negative.');
          return;
        }
      } else {
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
        if (effectiveSet.rir !== undefined && (effectiveSet.rir < DOMAIN_LIMITS.RIR_MIN || effectiveSet.rir > DOMAIN_LIMITS.RIR_MAX || isNaN(effectiveSet.rir))) {
          Alert.alert('Invalid RIR', `RIR must be between ${DOMAIN_LIMITS.RIR_MIN} and ${DOMAIN_LIMITS.RIR_MAX}.`);
          return;
        }
      }

      // Complete set and trigger rest timer (unless treadmill, drop set, or superset intermediate)
      let updated = workoutRepository.updateSet(current, exercise.exerciseId, set.id, {
        ...pendingUpdates,
        completed: true,
        completedAt: new Date().toISOString(),
      });

      // Unified rest pacing:
      // Skip rest timer for treadmill exercises
      let shouldTriggerRestTimer = !isTreadmill;

      if (shouldTriggerRestTimer) {
        const currentEx = updated.exercises.find((e) => e.exerciseId === exercise.exerciseId);
        const setIndex = currentEx?.actualSets.findIndex((s) => s.id === set.id) ?? -1;
        const nextSet = setIndex >= 0 && currentEx ? currentEx.actualSets[setIndex + 1] : undefined;
        const isNextDropSet = nextSet?.setType === 'drop';

        if (isNextDropSet) {
          shouldTriggerRestTimer = false;
        }

        if (shouldTriggerRestTimer && exercise.supersetGroupId) {
          const groupExercises = updated.exercises.filter(
            (e) => e.supersetGroupId === exercise.supersetGroupId,
          );
          const groupPos = groupExercises.findIndex(
            (e) => e.exerciseId === exercise.exerciseId,
          );

          if (groupPos >= 0 && groupPos < groupExercises.length - 1) {
            shouldTriggerRestTimer = false;
          }
        }

        if (shouldTriggerRestTimer) {
          const restTime =
            exercise.plannedRestTime && exercise.plannedRestTime > 0 ? exercise.plannedRestTime : 90;
          updated = workoutRepository.startRestTimer(
            updated,
            exercise.exerciseId,
            set.setNumber,
            restTime,
            exercise.exerciseName,
          );
        }
      }

      await updateSessionAndAutosaveImmediate(updated);
    } else {
      // Un-complete set
      const updated = workoutRepository.updateSet(current, exercise.exerciseId, set.id, {
        completed: false,
        completedAt: undefined,
      });
      await updateSessionAndAutosaveImmediate(updated);
    }
  }, [updateSessionAndAutosaveImmediate]);

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
            setKeypadFocus(null);
            cancelDebouncedSave();
            // Mark completed BEFORE discarding so the unmount cleanup
            // does not re-save the stale active session after the clear.
            workoutCompletedRef.current = true;
            try {
              const sessionToDiscard = sessionRef.current || session;
              await workoutRepository.discardActiveWorkout(undefined, sessionToDiscard?.id);
              setSession(null);
              sessionRef.current = null;
              router.replace('/home' as any);
            } catch (err: any) {
              workoutCompletedRef.current = false;
              Alert.alert('Error', err?.message || 'Failed to discard workout.');
            }
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
              setKeypadFocus(null);
              const latest = sessionRef.current || current;
              await flushActiveWorkout(latest);
              // Mark completed BEFORE the repository call so the unmount
              // cleanup (flushActiveWorkout) cannot race with clearActiveWorkout
              // and resurrect the active draft on Home screen.
              workoutCompletedRef.current = true;
              const completed = await workoutRepository.completeActiveWorkout(latest);
              router.replace(`/workout/summary?id=${completed.id}` as any);
            } catch (err: any) {
              // If completion failed, unset the guard so autosave resumes.
              workoutCompletedRef.current = false;
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
  const measuredRestHeight = restOverlayHeight > 0 ? restOverlayHeight : 112;
  const isKeypadOpen = Boolean(keypadFocus) && !useNativeKeyboard;
  const keypadPadding = isKeypadOpen ? 320 : 0;
  const dynamicBottomPadding = Math.max(
    baseBottomPadding + keypadPadding,
    (session.activeRestTimer ? measuredRestHeight + Math.max(insets.bottom, 12) + 24 : 0) + keypadPadding
  );

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        style={styles.keyboardContainer}
      >
        <ErrorBoundary
          testID="active-workout-error-boundary"
          fallbackTitle="Active workout display issue"
          fallbackMessage="Your workout progress is safely saved locally. Tap below to reload the workout view."
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
              <Icon name="chevronLeft" size={24} color={colors.primary} />
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
              <Icon name="moreVertical" size={20} color={colors.textPrimary} />
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
            <View style={styles.exerciseListContainer}>
              {session.exercises.map((ex, exIndex) => {
                const isLinkedWithNext =
                  Boolean(ex.supersetGroupId) &&
                  exIndex < session.exercises.length - 1 &&
                  session.exercises[exIndex + 1].supersetGroupId === ex.supersetGroupId;
                return (
                  <ActiveExerciseCard
                    key={`${ex.exerciseId}_${ex.order ?? exIndex}`}
                    exercise={ex}
                    exIndex={exIndex}
                    totalExercisesCount={session.exercises.length}
                    supersetInfo={getSupersetDisplayInfo(session.exercises, ex.exerciseId)}
                    lastPerformance={lastPerformanceMap[`${ex.exerciseId}_${ex.order}`] ?? lastPerformanceMap[ex.exerciseId]}
                    overloadNudge={progressiveOverloadMap[ex.exerciseId] ?? null}
                    expandedNotesSetIds={expandedNotesByExercise[ex.exerciseId] || EMPTY_NOTES_MAP}
                    onMoveUp={handleMoveUpExercise}
                    onMoveDown={handleMoveDownExercise}
                    onLinkSuperset={handleLinkSuperset}
                    onUnlinkSuperset={handleUnlinkSuperset}
                    onRemoveExercise={handleRemoveExercise}
                    onAddSet={handleAddSet}
                    onDeleteSet={handleDeleteSet}
                    onToggleNotes={toggleNotesForSet}
                    onCloseNotes={closeNotesForSet}
                    onUpdateSetField={handleUpdateSetField}
                    onToggleCompleteSet={handleToggleCompleteSet}
                    onPressExerciseDetail={handleOpenExerciseDetail}
                    onRenameExercise={handleRenameExercise}
                    isCustomKeypadActive={Boolean(keypadFocus) && !useNativeKeyboard}
                    activeFocusSetId={keypadFocus?.setId}
                    activeFocusField={keypadFocus?.field}
                    onFocusField={handleFocusField}
                    style={
                      isLinkedWithNext
                        ? styles.cardMarginSuperset
                        : exIndex === session.exercises.length - 1
                        ? styles.cardMarginLast
                        : styles.cardMarginStandard
                    }
                    onLayout={getCardLayoutHandler(ex.exerciseId)}
                  />
                );
              })}
            </View>
          )}

          {/* Bottom Action Section: Add Exercise & Finish */}
          <View style={styles.bottomActions}>
            <Button
              testID="add-exercise-to-workout-button"
              title="+ Add Exercise"
              onPress={() => {
                if (sessionRef.current) {
                  void flushActiveWorkout();
                }
                setKeypadFocus(null);
                setIsPickerVisible(true);
              }}
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
        </ErrorBoundary>
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
        selectedExerciseIds={activeExerciseIds}
        completedWorkouts={completedWorkoutsHistory}
        multiSelect={true}
      />

      {/* In-Workout Exercise Detail Modal */}
      <ExerciseDetailModal
        visible={Boolean(selectedDetailExercise)}
        exerciseId={selectedDetailExercise?.id ?? null}
        fallbackExerciseName={selectedDetailExercise?.name}
        onClose={handleCloseExerciseDetail}
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
              <View style={styles.menuItemContent}>
                <Icon
                  name={session.pausedAt ? 'play' : 'pause'}
                  size={18}
                  color={colors.textPrimary}
                />
                <Text variant="body" color="primary" style={styles.menuItemText}>
                  {session.pausedAt ? 'Resume Workout' : 'Pause Workout'}
                </Text>
              </View>
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
              <View style={styles.menuItemContent}>
                <Icon name="edit" size={18} color={colors.textPrimary} />
                <Text variant="body" color="primary" style={styles.menuItemText}>
                  Rename Workout
                </Text>
              </View>
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
              <View style={styles.menuItemContent}>
                <Icon name="trash" size={18} color={colors.error} />
                <Text variant="body" style={styles.menuItemDestructiveText}>
                  Discard Workout
                </Text>
              </View>
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

      {/* Custom Workout Numeric Keypad */}
      {keypadFocus && !useNativeKeyboard && (
        <WorkoutNumericKeypad
          visible={Boolean(keypadFocus) && !useNativeKeyboard}
          mode={
            keypadFocus.field === 'weight'
              ? 'kg'
              : keypadFocus.field === 'inclinePercent'
              ? 'incline'
              : keypadFocus.field === 'speedKph'
              ? 'speed'
              : keypadFocus.field === 'durationMinutes'
              ? 'durationMinutes'
              : 'reps'
          }
          value={keypadFocus.value}
          exerciseName={
            session?.exercises.find((e) => e.exerciseId === keypadFocus.exerciseId)?.exerciseName
          }
          setNumber={
            (() => {
              const ex = session?.exercises.find((e) => e.exerciseId === keypadFocus.exerciseId);
              const s = ex?.actualSets.find((row) => row.id === keypadFocus.setId);
              return s?.setNumber;
            })()
          }
          useNativeKeyboard={useNativeKeyboard}
          onKeyPress={handleKeypadPress}
          onBackspace={handleKeypadBackspace}
          onClear={handleKeypadClear}
          onStep={handleKeypadStep}
          onNext={handleKeypadNext}
          onDismiss={handleKeypadDismiss}
          onToggleNativeKeyboard={handleToggleNativeKeyboard}
        />
      )}
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
  exerciseListContainer: {
    gap: 0,
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
    minWidth: 0,
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
    flexShrink: 1,
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
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  cardMarginStandard: {
    marginBottom: 14,
  },
  cardMarginSuperset: {
    marginBottom: 8,
  },
  cardMarginLast: {
    marginBottom: 0,
  },
});
