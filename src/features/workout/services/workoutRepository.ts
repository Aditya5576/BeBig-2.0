/**
 * BeBig 2.0 — Workout Repository
 *
 * Central service layer for managing live workout execution, set logging,
 * rest interval countdowns, continuous autosave, and completed session history.
 */

import { WorkoutTemplate } from '../../templates/types';
import { WorkoutSession, WorkoutExercise, WorkoutSet, SetType, ActiveRestTimer, ExerciseTrackingMode } from '../types';
import { workoutStorage, SaveActiveWorkoutResult } from '../storage/workoutStorage';
import { getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { syncMetadataStore, syncLifecycleManager, getRecordKey } from '../../../services/sync';
import { nativeRestTimerService } from './nativeRestTimerService';
import { DOMAIN_LIMITS } from '../../../constants/domainLimits';
import { resolveExerciseTrackingMode } from '../../exercises/exerciseTracking';

/**
 * Structured persistence failure error surfaced when active workout persistence fails
 * or all CAS retry attempts are exhausted.
 */
export class ActiveWorkoutPersistenceError extends Error {
  readonly code = 'ACTIVE_WORKOUT_PERSISTENCE_FAILED';
  readonly lastConflict?: boolean;
  readonly incomingRevision?: number;
  readonly persistedRevision?: number;

  constructor(
    message: string,
    details?: { conflict?: boolean; incomingRevision?: number; persistedRevision?: number }
  ) {
    super(message);
    this.name = 'ActiveWorkoutPersistenceError';
    this.lastConflict = details?.conflict;
    this.incomingRevision = details?.incomingRevision;
    this.persistedRevision = details?.persistedRevision;
    Object.setPrototypeOf(this, ActiveWorkoutPersistenceError.prototype);
  }
}

/**
 * In-memory LRU cache of recent session snapshots indexed by sessionId:revision.
 * Enables 3-way set-level merge during CAS contention rebases.
 */
const recentSessionSnapshots = new Map<string, WorkoutSession>();

export function cacheSessionSnapshot(session: WorkoutSession): void {
  if (!session || !session.id) return;
  const rev = Math.max(Number(session.revision ?? 0), Number(session.version ?? 0));
  const key = `${session.id}:${rev}`;
  recentSessionSnapshots.set(key, JSON.parse(JSON.stringify(session)));
  if (recentSessionSnapshots.size > 100) {
    const oldestKey = recentSessionSnapshots.keys().next().value;
    if (oldestKey) recentSessionSnapshots.delete(oldestKey);
  }
}

export function getSessionSnapshot(sessionId: string, revision?: number): WorkoutSession | undefined {
  if (!sessionId) return undefined;
  if (revision !== undefined) {
    const exact = recentSessionSnapshots.get(`${sessionId}:${revision}`);
    if (exact) return exact;
  }
  let best: WorkoutSession | undefined;
  for (const [key, sess] of recentSessionSnapshots.entries()) {
    if (key.startsWith(`${sessionId}:`)) {
      const sessRev = Math.max(Number(sess.revision ?? 0), Number(sess.version ?? 0));
      if (revision === undefined || sessRev <= revision) {
        if (!best || Math.max(Number(best.revision ?? 0), Number(best.version ?? 0)) < sessRev) {
          best = sess;
        }
      }
    }
  }
  return best;
}

/**
 * Performs a deep exercise- and set-level 3-way merge when rebasing an incoming mutation onto latestStored.
 * Preserves edits/completions from latestStored on sets not modified by the incoming delta,
 * and takes the incoming mutation's modified sets/exercises cleanly so rapid/concurrent set edits
 * never clobber each other.
 */
export function mergeSessionDeep(
  latestStored: WorkoutSession,
  incoming: WorkoutSession,
  options?: { allowEmptyOverwrites?: boolean; allowExerciseRemoval?: boolean },
  base?: WorkoutSession
): WorkoutSession {
  // If stored has exercises and incoming has none, and empty overwrites is not authorized:
  if (
    latestStored.exercises &&
    latestStored.exercises.length > 0 &&
    (!incoming.exercises || incoming.exercises.length === 0) &&
    !options?.allowEmptyOverwrites
  ) {
    return {
      ...latestStored,
      ...incoming,
      exercises: latestStored.exercises,
      activeRestTimer: incoming.activeRestTimer ?? latestStored.activeRestTimer,
    };
  }

  const storedExMap = new Map<string, WorkoutExercise>();
  for (const ex of latestStored.exercises || []) {
    storedExMap.set(ex.exerciseId, ex);
  }

  const baseExMap = new Map<string, WorkoutExercise>();
  if (base?.exercises) {
    for (const ex of base.exercises) {
      baseExMap.set(ex.exerciseId, ex);
    }
  }

  const mergedExercises: WorkoutExercise[] = [];
  const processedExerciseIds = new Set<string>();

  for (const incEx of incoming.exercises || []) {
    processedExerciseIds.add(incEx.exerciseId);
    const storedEx = storedExMap.get(incEx.exerciseId);
    const baseEx = baseExMap.get(incEx.exerciseId);

    if (!storedEx) {
      mergedExercises.push(incEx);
      continue;
    }

    const storedSetMap = new Map<string, WorkoutSet>();
    for (const s of storedEx.actualSets || []) {
      storedSetMap.set(s.id, s);
    }

    const baseSetMap = new Map<string, WorkoutSet>();
    if (baseEx?.actualSets) {
      for (const s of baseEx.actualSets) {
        baseSetMap.set(s.id, s);
      }
    }

    const mergedSets: WorkoutSet[] = [];
    const processedSetIds = new Set<string>();

    for (const incSet of incEx.actualSets || []) {
      processedSetIds.add(incSet.id);
      const storedSet = storedSetMap.get(incSet.id);
      const baseSet = baseSetMap.get(incSet.id);

      if (!storedSet) {
        mergedSets.push(incSet);
        continue;
      }

      // 3-way merge on set attributes:
      // Completion:
      let completed = incSet.completed;
      let completedAt = incSet.completedAt;
      if (baseSet) {
        const incChangedCompleted = incSet.completed !== baseSet.completed;
        const storedChangedCompleted = storedSet.completed !== baseSet.completed;
        if (storedChangedCompleted && !incChangedCompleted) {
          completed = storedSet.completed;
          completedAt = storedSet.completedAt;
        } else if (incChangedCompleted) {
          completed = incSet.completed;
          completedAt = incSet.completedAt;
        } else {
          completed = storedSet.completed || incSet.completed;
          completedAt = incSet.completedAt || storedSet.completedAt;
        }
      } else {
        completed = storedSet.completed || incSet.completed;
        completedAt = incSet.completedAt || storedSet.completedAt;
      }

      // Weight:
      let weight = incSet.weight;
      if (baseSet) {
        const incChangedWeight = incSet.weight !== baseSet.weight;
        const storedChangedWeight = storedSet.weight !== baseSet.weight;
        if (storedChangedWeight && !incChangedWeight) {
          weight = storedSet.weight;
        } else if (incChangedWeight && !storedChangedWeight) {
          weight = incSet.weight;
        } else if (incChangedWeight && storedChangedWeight) {
          weight = incSet.weight; // incoming active mutation wins on true collision
        } else {
          weight = (storedSet.weight !== undefined && storedSet.weight > 0) ? storedSet.weight : incSet.weight;
        }
      } else {
        weight =
          incSet.weight !== storedSet.weight && incSet.weight > 0
            ? incSet.weight
            : (storedSet.weight !== undefined && storedSet.weight > 0 ? storedSet.weight : incSet.weight);
      }

      // Reps:
      let reps = incSet.reps;
      if (baseSet) {
        const incChangedReps = incSet.reps !== baseSet.reps;
        const storedChangedReps = storedSet.reps !== baseSet.reps;
        if (storedChangedReps && !incChangedReps) {
          reps = storedSet.reps;
        } else if (incChangedReps && !storedChangedReps) {
          reps = incSet.reps;
        } else if (incChangedReps && storedChangedReps) {
          reps = incSet.reps;
        } else {
          reps = (storedSet.reps !== undefined && storedSet.reps > 0) ? storedSet.reps : incSet.reps;
        }
      } else {
        reps =
          incSet.reps !== storedSet.reps && incSet.reps > 0
            ? incSet.reps
            : (storedSet.reps !== undefined && storedSet.reps > 0 ? storedSet.reps : incSet.reps);
      }

      // RIR:
      let rir = incSet.rir;
      if (baseSet) {
        const incChangedRir = incSet.rir !== baseSet.rir;
        const storedChangedRir = storedSet.rir !== baseSet.rir;
        if (storedChangedRir && !incChangedRir) {
          rir = storedSet.rir;
        } else {
          rir = incSet.rir !== undefined ? incSet.rir : storedSet.rir;
        }
      } else {
        rir = incSet.rir !== undefined ? incSet.rir : storedSet.rir;
      }

      // Notes:
      let notes = incSet.notes;
      if (baseSet) {
        const incChangedNotes = (incSet.notes || '').trim() !== (baseSet.notes || '').trim();
        const storedChangedNotes = (storedSet.notes || '').trim() !== (baseSet.notes || '').trim();
        if (storedChangedNotes && !incChangedNotes) {
          notes = storedSet.notes;
        } else if (incChangedNotes) {
          notes = incSet.notes;
        } else {
          notes = storedSet.notes !== undefined ? storedSet.notes : incSet.notes;
        }
      } else {
        notes = incSet.notes !== undefined ? incSet.notes : storedSet.notes;
      }

      const setType = incSet.setType || storedSet.setType || 'normal';

      // Treadmill scalar fields (allowing inclinePercent === 0 as valid):
      const mergeScalarField = <T>(
        baseVal: T | undefined,
        storedVal: T | undefined,
        incVal: T | undefined,
      ): T | undefined => {
        if (baseVal !== undefined) {
          const incChanged = incVal !== baseVal;
          const storedChanged = storedVal !== baseVal;
          if (storedChanged && !incChanged) return storedVal;
          if (incChanged && !storedChanged) return incVal;
          if (incChanged && storedChanged) return incVal;
          return incVal !== undefined ? incVal : storedVal;
        }
        return incVal !== undefined ? incVal : storedVal;
      };

      const inclinePercent = mergeScalarField(
        baseSet?.inclinePercent,
        storedSet.inclinePercent,
        incSet.inclinePercent,
      );
      const speedKph = mergeScalarField(
        baseSet?.speedKph,
        storedSet.speedKph,
        incSet.speedKph,
      );
      const durationSeconds = mergeScalarField(
        baseSet?.durationSeconds,
        storedSet.durationSeconds,
        incSet.durationSeconds,
      );

      mergedSets.push({
        ...storedSet,
        ...incSet,
        weight,
        reps,
        rir,
        notes,
        setType,
        ...(inclinePercent !== undefined ? { inclinePercent } : {}),
        ...(speedKph !== undefined ? { speedKph } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
        completed,
        completedAt,
      });
    }

    // Preserve any sets from storedEx that incoming didn't have:
    // Only preserve sets that were NOT in baseEx (i.e. concurrently added by another write).
    // If a set existed in baseEx and is absent in incEx, the user deliberately deleted it - do NOT resurrect it!
    for (const storedSet of storedEx.actualSets || []) {
      if (!processedSetIds.has(storedSet.id)) {
        const wasInBase = baseSetMap.has(storedSet.id);
        if (!wasInBase) {
          mergedSets.push(storedSet);
        }
      }
    }

    mergedSets.sort((a, b) => a.setNumber - b.setNumber);

    const helperMergeScalarEx = <T>(
      baseVal: T | undefined,
      storedVal: T | undefined,
      incVal: T | undefined,
    ): T | undefined => {
      if (baseVal !== undefined) {
        const incChanged = incVal !== baseVal;
        const storedChanged = storedVal !== baseVal;
        if (storedChanged && !incChanged) return storedVal;
        if (incChanged && !storedChanged) return incVal;
        if (incChanged && storedChanged) return incVal;
        return incVal !== undefined ? incVal : storedVal;
      }
      return incVal !== undefined ? incVal : storedVal;
    };

    const trackingMode = incEx.trackingMode || storedEx.trackingMode || baseEx?.trackingMode;
    const exerciseName =
      helperMergeScalarEx(
        baseEx?.exerciseName,
        storedEx.exerciseName,
        incEx.exerciseName,
      ) || incEx.exerciseName || storedEx.exerciseName;
    const plannedTargetInclinePercent = helperMergeScalarEx(
      baseEx?.plannedTargetInclinePercent,
      storedEx.plannedTargetInclinePercent,
      incEx.plannedTargetInclinePercent,
    );
    const plannedTargetSpeedKph = helperMergeScalarEx(
      baseEx?.plannedTargetSpeedKph,
      storedEx.plannedTargetSpeedKph,
      incEx.plannedTargetSpeedKph,
    );
    const plannedTargetDurationSeconds = helperMergeScalarEx(
      baseEx?.plannedTargetDurationSeconds,
      storedEx.plannedTargetDurationSeconds,
      incEx.plannedTargetDurationSeconds,
    );

    mergedExercises.push({
      ...storedEx,
      ...incEx,
      exerciseName,
      ...(trackingMode ? { trackingMode } : {}),
      ...(plannedTargetInclinePercent !== undefined ? { plannedTargetInclinePercent } : {}),
      ...(plannedTargetSpeedKph !== undefined ? { plannedTargetSpeedKph } : {}),
      ...(plannedTargetDurationSeconds !== undefined ? { plannedTargetDurationSeconds } : {}),
      actualSets: mergedSets,
    });
  }

  // Preserve any exercises from latestStored not present in incoming unless removal was authorized
  if (!options?.allowExerciseRemoval && !options?.allowEmptyOverwrites) {
    for (const storedEx of latestStored.exercises || []) {
      if (!processedExerciseIds.has(storedEx.exerciseId)) {
        mergedExercises.push(storedEx);
      }
    }
  }

  mergedExercises.sort((a, b) => a.order - b.order);

  return {
    ...latestStored,
    ...incoming,
    exercises: mergedExercises,
    activeRestTimer: incoming.activeRestTimer ?? latestStored.activeRestTimer,
  };
}

export class WorkoutRepository {
  /**
   * Calculates total volume (tonnage in kg) across all completed sets in a session.
   * Total Volume = Sum(weight * reps) for all sets where completed === true.
   */
  calculateTotalVolume(workout: WorkoutSession): number {
    if (!workout.exercises || workout.exercises.length === 0) return 0;
    let total = 0;
    for (const ex of workout.exercises) {
      if (ex.trackingMode === 'treadmill') continue;
      if (!ex.actualSets) continue;
      for (const set of ex.actualSets) {
        if (set.completed && set.weight > 0 && set.reps > 0) {
          total += set.weight * set.reps;
        }
      }
    }
    return Math.round(total * 100) / 100;
  }

  /**
   * Count total completed sets across all exercises.
   */
  countCompletedSets(workout: WorkoutSession): number {
    if (!workout.exercises) return 0;
    return workout.exercises.reduce(
      (acc, ex) => acc + (ex.actualSets ? ex.actualSets.filter((s) => s.completed).length : 0),
      0,
    );
  }

  /**
   * Starts a new workout session from an existing WorkoutTemplate.
   * Planning targets are copied into WorkoutExercise, while actualSets are generated
   * independently so template definitions are never mutated.
   */
  async startWorkoutFromTemplate(
    template: WorkoutTemplate,
    customName?: string,
    sourceScheduledWorkoutId?: string,
    options?: { forceDiscardExisting?: boolean; scope?: UserScope | null }
  ): Promise<WorkoutSession> {
    if (!template || !template.id) {
      throw new Error('Valid workout template is required to start a workout.');
    }

    const resolvedScope =
      options?.scope !== undefined
        ? options.scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const sessionId = `workout_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const exercises: WorkoutExercise[] = (template.exercises || []).map((tex, exIndex) => {
      const isTreadmill = tex.trackingMode === 'treadmill';
      // Parse reps from targetReps string, e.g. "8-10" -> 10, "12" -> 12
      const targetRepsStr =
        typeof tex.targetReps === 'string'
          ? tex.targetReps
          : typeof tex.targetReps === 'number'
          ? String(tex.targetReps)
          : '10';
      const parsedRepsMatch = targetRepsStr.match(/\d+/g);
      const defaultReps = parsedRepsMatch
        ? parseInt(parsedRepsMatch[parsedRepsMatch.length - 1], 10)
        : 10;
      const defaultWeight =
        typeof tex.targetWeight === 'number' && tex.targetWeight > 0 ? tex.targetWeight : 0;
      const numberOfSets = tex.sets > 0 ? tex.sets : (isTreadmill ? 1 : 3);

      const actualSets: WorkoutSet[] = [];
      for (let i = 1; i <= numberOfSets; i++) {
        actualSets.push(
          isTreadmill
            ? {
                id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${i}`,
                setNumber: i,
                weight: 0,
                reps: 0,
                rir: undefined,
                inclinePercent: tex.targetInclinePercent ?? 0,
                speedKph: tex.targetSpeedKph ?? 5,
                durationSeconds: tex.targetDurationSeconds ?? 600,
                setType: 'normal',
                completed: false,
              }
            : {
                id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${i}`,
                setNumber: i,
                weight: defaultWeight,
                reps: defaultReps,
                rir: 2,
                setType: 'normal',
                completed: false,
              }
        );
      }

      return {
        exerciseId: tex.exerciseId,
        exerciseName: tex.exerciseName,
        categoryName: tex.categoryName,
        order: tex.order !== undefined ? tex.order : exIndex,
        trackingMode: tex.trackingMode,
        plannedTargetInclinePercent: tex.targetInclinePercent,
        plannedTargetSpeedKph: tex.targetSpeedKph,
        plannedTargetDurationSeconds: tex.targetDurationSeconds,
        plannedSets: tex.sets,
        plannedTargetReps: isTreadmill ? undefined : tex.targetReps,
        plannedRestTime: isTreadmill ? 0 : tex.restTime,
        plannedTargetWeight: isTreadmill ? undefined : tex.targetWeight,
        actualSets,
      };
    });

    const session: WorkoutSession = {
      id: sessionId,
      ownerId: resolvedScope?.ownerId,
      ownerType: resolvedScope?.ownerType,
      name: customName?.trim() || template.name,
      sourceTemplateId: template.id,
      sourceScheduledWorkoutId,
      startedAt: now,
      updatedAt: now,
      version: 1,
      revision: 1,
      status: 'active',
      exercises,
      activeRestTimer: null,
    };

    const created = await workoutStorage.createActiveWorkout(session, resolvedScope, {
      forceDiscardExisting: options?.forceDiscardExisting,
    });
    cacheSessionSnapshot(created);
    return created;
  }

  /**
   * Starts a blank, empty workout session.
   */
  async startEmptyWorkout(
    name?: string,
    sourceScheduledWorkoutId?: string,
    options?: { forceDiscardExisting?: boolean; scope?: UserScope | null }
  ): Promise<WorkoutSession> {
    const resolvedScope =
      options?.scope !== undefined
        ? options.scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const sessionId = `workout_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const session: WorkoutSession = {
      id: sessionId,
      ownerId: resolvedScope?.ownerId,
      ownerType: resolvedScope?.ownerType,
      name: name?.trim() || 'Quick Workout',
      sourceScheduledWorkoutId,
      startedAt: now,
      updatedAt: now,
      version: 1,
      revision: 1,
      status: 'active',
      exercises: [],
      activeRestTimer: null,
    };

    const created = await workoutStorage.createActiveWorkout(session, resolvedScope, {
      forceDiscardExisting: options?.forceDiscardExisting,
    });
    cacheSessionSnapshot(created);
    return created;
  }

  /**
   * Retrieves the current active workout session draft, or null if none.
   */
  async getActiveWorkout(scope?: UserScope | null): Promise<WorkoutSession | null> {
    const session = await workoutStorage.getActiveWorkout(scope);
    if (session) {
      cacheSessionSnapshot(session);
    }
    return session;
  }

  /**
   * Persists an updated active workout session (continuous autosave).
   * Enforces CAS auto-rebase with deep set-level merge: if a CAS conflict occurs,
   * performs a bounded retry loop (up to 3 attempts), re-reading the latest stored session,
   * merging the delta cleanly onto higher revisions, and surfacing ActiveWorkoutPersistenceError
   * if all retries fail. Always returns the exact persisted session accepted by storage.
   */
  async updateActiveWorkout(
    workout: WorkoutSession,
    scope?: UserScope | null,
    options?: { allowEmptyOverwrites?: boolean; allowExerciseRemoval?: boolean }
  ): Promise<WorkoutSession> {
    if (!workout || workout.status !== 'active') {
      throw new Error('Only active workouts can be updated in draft.');
    }
    const currentSeq = Math.max(Number(workout.revision ?? 0), Number(workout.version ?? 0));
    const baseSnapshot = getSessionSnapshot(workout.id, currentSeq);
    let nextSeq = currentSeq + 1;
    let sessionToSave: WorkoutSession = {
      ...workout,
      updatedAt: new Date().toISOString(),
      version: nextSeq,
      revision: nextSeq,
    };
    let res: SaveActiveWorkoutResult;
    try {
      res = await workoutStorage.saveActiveWorkout(sessionToSave, scope, options);
    } catch (err: any) {
      if (err instanceof ActiveWorkoutPersistenceError) {
        throw err;
      }
      throw new ActiveWorkoutPersistenceError(
        err?.message || 'Storage write failed while updating active workout.',
        {
          incomingRevision: nextSeq,
          persistedRevision: currentSeq,
        }
      );
    }

    // Bounded CAS retry loop (up to 3 attempts) with deep set-level merge rebase
    const maxRetries = 3;
    let attempt = 0;
    while (!res.ok && res.conflict && attempt < maxRetries) {
      attempt++;
      let latestStored: WorkoutSession | null = null;
      try {
        latestStored = await workoutStorage.getActiveWorkout(scope);
      } catch (err: any) {
        if (err instanceof ActiveWorkoutPersistenceError) throw err;
        throw new ActiveWorkoutPersistenceError(
          err?.message || 'Storage read failed during CAS rebase.',
          { conflict: true, incomingRevision: nextSeq, persistedRevision: res.persistedRevision }
        );
      }
      if (latestStored && latestStored.id === workout.id) {
        cacheSessionSnapshot(latestStored);
        const higherRevision = Math.max(
          Number((latestStored as any).revision ?? 0),
          Number(latestStored.version ?? 0),
          Number(res.persistedRevision ?? 0),
          nextSeq
        );
        nextSeq = higherRevision + 1;
        const merged = mergeSessionDeep(latestStored, sessionToSave, options, baseSnapshot);
        sessionToSave = {
          ...merged,
          revision: nextSeq,
          version: nextSeq,
          updatedAt: new Date().toISOString(),
        };
        try {
          res = await workoutStorage.saveActiveWorkout(sessionToSave, scope, options);
        } catch (err: any) {
          if (err instanceof ActiveWorkoutPersistenceError) throw err;
          throw new ActiveWorkoutPersistenceError(
            err?.message || `Storage write failed during CAS retry attempt ${attempt}.`,
            { conflict: true, incomingRevision: nextSeq, persistedRevision: res.persistedRevision }
          );
        }
      } else {
        break;
      }
    }

    if (!res.ok) {
      throw new ActiveWorkoutPersistenceError(
        res.error || `Failed to persist active workout after ${attempt} retry attempt(s).`,
        {
          conflict: res.conflict,
          incomingRevision: res.incomingRevision,
          persistedRevision: res.persistedRevision,
        }
      );
    }

    const persistedSession = res.session || res.workout || sessionToSave;
    cacheSessionSnapshot(persistedSession);
    return persistedSession;
  }

  /**
   * Adds an exercise to an in-memory WorkoutSession.
   */
  addExerciseToWorkout(
    workout: WorkoutSession,
    exercise: {
      id: string;
      name: string;
      categoryName?: string;
      trackingMode?: ExerciseTrackingMode;
      plannedTargetInclinePercent?: number;
      plannedTargetSpeedKph?: number;
      plannedTargetDurationSeconds?: number;
    },
  ): WorkoutSession {
    const resolvedTrackingMode = exercise.trackingMode || resolveExerciseTrackingMode(exercise);
    const isTreadmill = resolvedTrackingMode === 'treadmill';
    const defaultSet: WorkoutSet = isTreadmill
      ? {
          id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_1`,
          setNumber: 1,
          weight: 0,
          reps: 0,
          rir: undefined,
          inclinePercent: exercise.plannedTargetInclinePercent ?? 0,
          speedKph: exercise.plannedTargetSpeedKph ?? 5,
          durationSeconds: exercise.plannedTargetDurationSeconds ?? 600,
          setType: 'normal',
          completed: false,
        }
      : {
          id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_1`,
          setNumber: 1,
          weight: 0,
          reps: 10,
          rir: 2,
          setType: 'normal',
          completed: false,
        };

    const newExercise: WorkoutExercise = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      categoryName: exercise.categoryName,
      trackingMode: resolvedTrackingMode,
      plannedTargetInclinePercent: exercise.plannedTargetInclinePercent,
      plannedTargetSpeedKph: exercise.plannedTargetSpeedKph,
      plannedTargetDurationSeconds: exercise.plannedTargetDurationSeconds,
      order: workout.exercises.length,
      plannedSets: 1,
      plannedTargetReps: isTreadmill ? undefined : '10',
      plannedRestTime: isTreadmill ? 0 : 90,
      actualSets: [defaultSet],
    };

    return {
      ...workout,
      exercises: [...workout.exercises, newExercise],
    };
  }

  /**
   * Renames an exercise's display name on an in-memory WorkoutSession while keeping
   * its canonical `exerciseId` and `trackingMode` intact so PRs and history never split.
   */
  renameExerciseInWorkout(
    workout: WorkoutSession,
    exerciseId: string,
    newName: string,
  ): WorkoutSession {
    const trimmed = newName.trim();
    if (!trimmed) return workout;
    const updatedExercises = workout.exercises.map((ex) =>
      ex.exerciseId === exerciseId ? { ...ex, exerciseName: trimmed } : ex,
    );
    return {
      ...workout,
      exercises: updatedExercises,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Adds an extra set to an exercise in an in-memory WorkoutSession.
   */
  addSetToExercise(workout: WorkoutSession, exerciseId: string): WorkoutSession {
    const updatedExercises = workout.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;

      const lastSet = ex.actualSets[ex.actualSets.length - 1];
      const newSetNumber = ex.actualSets.length + 1;
      const isTreadmill = ex.trackingMode === 'treadmill';

      const newSet: WorkoutSet = isTreadmill
        ? {
            id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${newSetNumber}`,
            setNumber: newSetNumber,
            weight: 0,
            reps: 0,
            rir: undefined,
            inclinePercent:
              lastSet?.inclinePercent !== undefined
                ? lastSet.inclinePercent
                : (ex.plannedTargetInclinePercent ?? 0),
            speedKph:
              lastSet?.speedKph !== undefined
                ? lastSet.speedKph
                : (ex.plannedTargetSpeedKph ?? 5),
            durationSeconds:
              lastSet?.durationSeconds !== undefined
                ? lastSet.durationSeconds
                : (ex.plannedTargetDurationSeconds ?? 600),
            setType: 'normal',
            notes: lastSet && lastSet.notes ? lastSet.notes : undefined,
            completed: false,
          }
        : {
            id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${newSetNumber}`,
            setNumber: newSetNumber,
            weight: lastSet ? lastSet.weight : 0,
            reps: lastSet ? lastSet.reps : 10,
            rir: lastSet ? lastSet.rir : 2,
            setType: 'normal',
            notes: lastSet && lastSet.notes ? lastSet.notes : undefined,
            completed: false,
          };

      return {
        ...ex,
        actualSets: [...ex.actualSets, newSet],
      };
    });

    return {
      ...workout,
      exercises: updatedExercises,
    };
  }

  /**
   * Removes a set from an exercise and re-indexes set numbers.
   * Enforces minimum 1 set rule and prevents deletion of completed sets.
   */
  removeSetFromExercise(
    workout: WorkoutSession,
    exerciseId: string,
    setId: string,
  ): WorkoutSession {
    const updatedExercises = workout.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;

      // Invariant: Cannot remove set if exercise only has 1 set (minimum-one-set rule)
      if (ex.actualSets.length <= 1) return ex;

      // Invariant: Cannot remove a completed set
      const targetSet = ex.actualSets.find((s) => s.id === setId);
      if (targetSet?.completed) return ex;

      const remainingSets = ex.actualSets.filter((s) => s.id !== setId);
      const reindexedSets = remainingSets.map((s, idx) => ({
        ...s,
        setNumber: idx + 1,
      }));

      return {
        ...ex,
        actualSets: reindexedSets,
      };
    });

    return {
      ...workout,
      exercises: updatedExercises,
    };
  }

  /**
   * Enforces superset group invariants:
   * - Only contiguous exercises can share a supersetGroupId.
   * - Any group with fewer than 2 exercises is dissolved (supersetGroupId reset to null).
   */
  cleanSupersetInvariants(exercises: WorkoutExercise[]): WorkoutExercise[] {
    if (!exercises || exercises.length === 0) return exercises;

    const result: WorkoutExercise[] = exercises.map((ex) => ({ ...ex }));

    let i = 0;
    while (i < result.length) {
      const groupId = result[i].supersetGroupId;
      if (!groupId) {
        i++;
        continue;
      }

      let j = i;
      while (j < result.length && result[j].supersetGroupId === groupId) {
        j++;
      }
      const runLength = j - i;

      if (runLength < 2) {
        // Orphan exercise: dissolve group ID to null
        for (let k = i; k < j; k++) {
          result[k].supersetGroupId = null;
        }
      }
      i = j;
    }

    return result;
  }

  /**
   * Links an exercise with the immediately following exercise into a Superset or Giant Set.
   * If either exercise is already in a group, reuses that group ID so 3+ contiguous exercises
   * seamlessly become a Giant Set.
   */
  linkSupersetWithNext(workout: WorkoutSession, exerciseIndex: number): WorkoutSession {
    if (!workout.exercises || exerciseIndex < 0 || exerciseIndex >= workout.exercises.length - 1) {
      return workout;
    }

    const currentEx = workout.exercises[exerciseIndex];
    const nextEx = workout.exercises[exerciseIndex + 1];

    const groupId =
      currentEx.supersetGroupId ||
      nextEx.supersetGroupId ||
      `ss_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const updatedExercises = workout.exercises.map((ex, idx) => {
      if (idx === exerciseIndex || idx === exerciseIndex + 1) {
        return {
          ...ex,
          supersetGroupId: groupId,
        };
      }
      return ex;
    });

    const cleaned = this.cleanSupersetInvariants(updatedExercises);
    return {
      ...workout,
      exercises: cleaned,
    };
  }

  /**
   * Unlinks an exercise from its Superset or Giant Set group.
   * Automatically dissolves any remaining 1-exercise orphan in the group.
   */
  unlinkSuperset(workout: WorkoutSession, exerciseIndex: number): WorkoutSession {
    if (!workout.exercises || exerciseIndex < 0 || exerciseIndex >= workout.exercises.length) {
      return workout;
    }

    const targetEx = workout.exercises[exerciseIndex];
    if (!targetEx.supersetGroupId) {
      return workout;
    }

    const updatedExercises = workout.exercises.map((ex, idx) => {
      if (idx === exerciseIndex) {
        return {
          ...ex,
          supersetGroupId: null,
        };
      }
      return ex;
    });

    const cleaned = this.cleanSupersetInvariants(updatedExercises);
    return {
      ...workout,
      exercises: cleaned,
    };
  }

  /**
   * Moves an exercise up in the workout sequence and enforces superset invariants.
   */
  moveExerciseUp(workout: WorkoutSession, exerciseIndex: number): WorkoutSession {
    if (!workout.exercises || exerciseIndex <= 0 || exerciseIndex >= workout.exercises.length) {
      return workout;
    }

    const updated = [...workout.exercises];
    const temp = updated[exerciseIndex - 1];
    updated[exerciseIndex - 1] = updated[exerciseIndex];
    updated[exerciseIndex] = temp;

    const reindexed = updated.map((ex, idx) => ({ ...ex, order: idx }));
    const cleaned = this.cleanSupersetInvariants(reindexed);

    return {
      ...workout,
      exercises: cleaned,
    };
  }

  /**
   * Moves an exercise down in the workout sequence and enforces superset invariants.
   */
  moveExerciseDown(workout: WorkoutSession, exerciseIndex: number): WorkoutSession {
    if (!workout.exercises || exerciseIndex < 0 || exerciseIndex >= workout.exercises.length - 1) {
      return workout;
    }

    const updated = [...workout.exercises];
    const temp = updated[exerciseIndex + 1];
    updated[exerciseIndex + 1] = updated[exerciseIndex];
    updated[exerciseIndex] = temp;

    const reindexed = updated.map((ex, idx) => ({ ...ex, order: idx }));
    const cleaned = this.cleanSupersetInvariants(reindexed);

    return {
      ...workout,
      exercises: cleaned,
    };
  }

  /**
   * Removes an exercise from the session and re-indexes order.
   */
  removeExerciseFromWorkout(workout: WorkoutSession, exerciseId: string): WorkoutSession {
    const remainingExercises = workout.exercises.filter((ex) => ex.exerciseId !== exerciseId);
    const reindexed = remainingExercises.map((ex, idx) => ({
      ...ex,
      order: idx,
    }));
    const cleaned = this.cleanSupersetInvariants(reindexed);

    return {
      ...workout,
      exercises: cleaned,
    };
  }

  /**
   * Updates fields on a specific set with validation.
   */
  updateSet(
    workout: WorkoutSession,
    exerciseId: string,
    setId: string,
    updates: Partial<WorkoutSet>,
  ): WorkoutSession {
    const updatedExercises = workout.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;

      const updatedSets = ex.actualSets.map((set) => {
        if (set.id !== setId) return set;

        const nextSet = { ...set, ...updates };

        if (ex.trackingMode === 'treadmill') {
          // Validate inclinePercent (0 to 50)
          if (typeof nextSet.inclinePercent === 'number') {
            if (isNaN(nextSet.inclinePercent) || nextSet.inclinePercent < 0 || nextSet.inclinePercent > 50) {
              throw new Error('Incline must be between 0% and 50%.');
            }
          }
          // Validate speedKph (allow undefined or 0 when uncompleted; 0.1 to 40 on completion)
          if (typeof nextSet.speedKph === 'number') {
            if (isNaN(nextSet.speedKph) || nextSet.speedKph < 0 || nextSet.speedKph > 40) {
              throw new Error('Speed must be between 0 and 40 km/h.');
            }
          }
          if (nextSet.completed) {
            if (typeof nextSet.speedKph !== 'number' || isNaN(nextSet.speedKph) || nextSet.speedKph < 0.1 || nextSet.speedKph > 40) {
              throw new Error('Completed treadmill sets require a valid speed between 0.1 and 40 km/h.');
            }
          }

          // Validate durationSeconds (allow undefined or 0 when uncompleted; 1 to 86400 on completion)
          if (typeof nextSet.durationSeconds === 'number') {
            if (isNaN(nextSet.durationSeconds) || nextSet.durationSeconds < 0 || nextSet.durationSeconds > 86400) {
              throw new Error('Duration must be between 0 and 86400 seconds.');
            }
          }
          if (nextSet.completed) {
            if (typeof nextSet.durationSeconds !== 'number' || isNaN(nextSet.durationSeconds) || nextSet.durationSeconds < 1 || nextSet.durationSeconds > 86400) {
              throw new Error('Completed treadmill sets require a valid duration between 1 and 86400 seconds.');
            }
          }
        } else {
          // Validate weight
          if (typeof nextSet.weight === 'number') {
            if (isNaN(nextSet.weight) || nextSet.weight < 0) {
              throw new Error('Weight cannot be negative.');
            }
          }

          // Validate reps
          if (typeof nextSet.reps === 'number') {
            if (isNaN(nextSet.reps) || nextSet.reps <= 0 || !Number.isInteger(nextSet.reps)) {
              throw new Error('Reps must be a positive integer.');
            }
          }

          // Validate RIR (0 to 4)
          if (typeof nextSet.rir === 'number') {
            if (isNaN(nextSet.rir) || nextSet.rir < DOMAIN_LIMITS.RIR_MIN || nextSet.rir > DOMAIN_LIMITS.RIR_MAX) {
              throw new Error(`RIR must be a number between ${DOMAIN_LIMITS.RIR_MIN} and ${DOMAIN_LIMITS.RIR_MAX}.`);
            }
          }
        }

        // Validate setType
        if (nextSet.setType !== undefined) {
          const validTypes: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
          if (!validTypes.includes(nextSet.setType)) {
            throw new Error(`Invalid setType: ${nextSet.setType}`);
          }
        }

        return nextSet;
      });

      return {
        ...ex,
        actualSets: updatedSets,
      };
    });

    return {
      ...workout,
      exercises: updatedExercises,
    };
  }

  /**
   * Starts or updates the active rest countdown timer.
   */
  startRestTimer(
    workout: WorkoutSession,
    exerciseId: string,
    setNumber: number,
    durationSeconds: number,
    exerciseName?: string,
  ): WorkoutSession {
    const targetEndTime = Date.now() + durationSeconds * 1000;
    const activeRestTimer: ActiveRestTimer = {
      exerciseId,
      exerciseName,
      setNumber,
      targetEndTime,
      durationSeconds,
      isPaused: false,
      pausedRemainingSeconds: undefined,
    };

    void nativeRestTimerService.syncRestTimer(activeRestTimer);

    return {
      ...workout,
      activeRestTimer,
    };
  }

  /**
   * Skips or clears the active rest countdown timer.
   */
  clearRestTimer(workout: WorkoutSession): WorkoutSession {
    void nativeRestTimerService.cancelRestTimer();

    return {
      ...workout,
      activeRestTimer: null,
    };
  }

  /**
   * Pauses the active rest countdown timer.
   */
  pauseRestTimer(workout: WorkoutSession): WorkoutSession {
    if (!workout.activeRestTimer || workout.activeRestTimer.isPaused) {
      return workout;
    }

    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((workout.activeRestTimer.targetEndTime - now) / 1000));

    const activeRestTimer: ActiveRestTimer = {
      ...workout.activeRestTimer,
      isPaused: true,
      pausedRemainingSeconds: remaining,
    };

    void nativeRestTimerService.syncRestTimer(activeRestTimer);

    return {
      ...workout,
      activeRestTimer,
    };
  }

  /**
   * Resumes a paused rest countdown timer.
   */
  resumeRestTimer(workout: WorkoutSession): WorkoutSession {
    if (!workout.activeRestTimer || !workout.activeRestTimer.isPaused) {
      return workout;
    }

    const remaining = workout.activeRestTimer.pausedRemainingSeconds ?? 0;
    const targetEndTime = Date.now() + remaining * 1000;

    const activeRestTimer: ActiveRestTimer = {
      ...workout.activeRestTimer,
      isPaused: false,
      targetEndTime,
      pausedRemainingSeconds: undefined,
    };

    void nativeRestTimerService.syncRestTimer(activeRestTimer);

    return {
      ...workout,
      activeRestTimer,
    };
  }

  /**
   * Extends the active rest countdown timer by additional seconds.
   * Does nothing if no active timer exists or if the timer has already expired.
   */
  extendRestTimer(workout: WorkoutSession, additionalSeconds: number): WorkoutSession {
    if (!workout.activeRestTimer) {
      return workout;
    }

    if (workout.activeRestTimer.isPaused) {
      const currentRemaining = workout.activeRestTimer.pausedRemainingSeconds ?? 0;
      const newRemaining = Math.max(0, currentRemaining + additionalSeconds);
      const durationSeconds = Math.max(0, workout.activeRestTimer.durationSeconds + additionalSeconds);

      const activeRestTimer: ActiveRestTimer = {
        ...workout.activeRestTimer,
        pausedRemainingSeconds: newRemaining,
        durationSeconds,
      };

      void nativeRestTimerService.syncRestTimer(activeRestTimer);

      return {
        ...workout,
        activeRestTimer,
      };
    }

    const now = Date.now();
    if (workout.activeRestTimer.targetEndTime <= now) {
      return workout;
    }

    const targetEndTime = workout.activeRestTimer.targetEndTime + additionalSeconds * 1000;
    const durationSeconds = workout.activeRestTimer.durationSeconds + additionalSeconds;

    const activeRestTimer: ActiveRestTimer = {
      ...workout.activeRestTimer,
      targetEndTime,
      durationSeconds,
    };

    void nativeRestTimerService.syncRestTimer(activeRestTimer);

    return {
      ...workout,
      activeRestTimer,
    };
  }

  /**
   * Completes the active workout session.
   * Requires at least one completed set. Calculates duration and total tonnage volume.
   * Clears active draft and adds to completed workouts history.
   */
  async completeActiveWorkout(
    activeSession?: WorkoutSession,
    scope?: UserScope | null
  ): Promise<WorkoutSession> {
    const resolvedScope =
      scope !== undefined
        ? scope
        : activeSession?.ownerId && activeSession?.ownerType
          ? { ownerId: activeSession.ownerId, ownerType: activeSession.ownerType }
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

    const sessionToFinish = activeSession ?? (await workoutStorage.getActiveWorkout(resolvedScope));
    if (!sessionToFinish) {
      throw new Error('No active workout to complete.');
    }

    const completedSetsCount = this.countCompletedSets(sessionToFinish);
    if (completedSetsCount === 0) {
      throw new Error('Cannot complete workout: at least one set must be completed.');
    }

    const finishTimeMs = Date.now();
    const finishedAt = new Date(finishTimeMs).toISOString();
    const startTimeMs = new Date(sessionToFinish.startedAt).getTime();
    
    // Total duration should exclude any time the workout spent paused (minimized)
    const pausedSecs = sessionToFinish.accumulatedPauseSeconds || 0;
    
    // If completed while actively paused, also subtract the current pause duration
    let currentPauseSecs = 0;
    if (sessionToFinish.pausedAt) {
      const pauseStartMs = new Date(sessionToFinish.pausedAt).getTime();
      currentPauseSecs = Math.max(0, Math.floor((finishTimeMs - pauseStartMs) / 1000));
    }
    
    const totalDuration = Math.max(0, Math.floor((finishTimeMs - startTimeMs) / 1000) - pausedSecs - currentPauseSecs);
    const totalVolume = this.calculateTotalVolume(sessionToFinish);

    const completedSession: WorkoutSession = {
      ...sessionToFinish,
      status: 'completed',
      finishedAt,
      totalDuration,
      totalVolume,
      completedSetsCount,
      activeRestTimer: null,
    };

    // 1. Save completed workout locally (Source of Truth)
    await (scope !== undefined
      ? workoutStorage.saveCompletedWorkout(completedSession, scope)
      : workoutStorage.saveCompletedWorkout(completedSession));

    // 2. Clear active in-progress draft (Immunity preserved)
    await nativeRestTimerService.cancelRestTimer();
    await (scope !== undefined
      ? workoutStorage.clearActiveWorkout(scope)
      : workoutStorage.clearActiveWorkout());

    // 3. Mark pending metadata (wrapped in try/catch to protect durability)
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
      try {
        await syncMetadataStore.markPendingUpload(
          'workout',
          completedSession.id,
          completedSession.finishedAt || completedSession.startedAt,
          resolvedScope,
        );
      } catch {
        // Local completed workout is already durable in local storage.
        // If metadata write fails or crashes, the Checkpoint 3.1
        // crash recovery scanner (syncMetadataStore.reconcileLocalEntities)
        // will automatically detect the untracked completed workout on the next launch/sync pass
        // and recreate the missing pending_upload metadata.
      }

      // 4. Fire-and-forget sync trigger (asynchronous, non-blocking)
      void syncLifecycleManager.triggerSync({ reason: 'workout_completed', scope: resolvedScope }).catch(() => {
        // Silently caught; sync failure cannot throw or affect caller
      });
    }

    return completedSession;
  }

  /**
   * Discards the active workout draft without saving to history.
   * Cancels native timer and permanently discards the session using discard tombstones and active token invalidation.
   */
  async discardActiveWorkout(scope?: UserScope | null, specificSessionId?: string): Promise<void> {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    await nativeRestTimerService.cancelRestTimer();
    await workoutStorage.discardActiveWorkout(resolvedScope, specificSessionId);
  }

  /**
   * Checks whether a session ID has been explicitly discarded.
   */
  async isSessionDiscarded(sessionId: string, scope?: UserScope | null): Promise<boolean> {
    return workoutStorage.isSessionDiscarded(sessionId, scope);
  }

  /**
   * Retrieves all completed workouts history, newest first.
   * Filters out any records that have active local tombstones (pending_delete or deletedAt).
   */
  async getCompletedWorkouts(scope?: UserScope | null): Promise<WorkoutSession[]> {
    const workouts = await workoutStorage.getCompletedWorkouts(scope);
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    if (!resolvedScope || resolvedScope.ownerType !== 'authenticated') {
      return workouts;
    }
    const state = await syncMetadataStore.getState(resolvedScope);
    if (!state) return workouts;

    return workouts.filter((w) => {
      const meta = state.records[getRecordKey('workout', w.id)];
      if (meta && (meta.syncStatus === 'pending_delete' || meta.deletedAt !== null)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Retrieves a specific completed workout by ID.
   * Returns null if the record has an active local tombstone.
   */
  async getCompletedWorkoutById(id: string, scope?: UserScope | null): Promise<WorkoutSession | null> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
      const meta = await syncMetadataStore.getRecord('workout', id, resolvedScope);
      if (meta && (meta.syncStatus === 'pending_delete' || meta.deletedAt !== null)) {
        return null;
      }
    }
    return workoutStorage.getCompletedWorkoutById(id, scope);
  }

  /**
   * Deletes a specific completed workout from history.
   * Produces a durable pending_delete tombstone if authenticated and previously synced.
   * Safely cleans up local-only unsynced creations without sending unnecessary cloud tombstones.
   */
  async deleteCompletedWorkout(id: string, scope?: UserScope | null): Promise<void> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
      const existingMeta = await syncMetadataStore.getRecord('workout', id, resolvedScope);
      const isUnsyncedLocalCreate =
        (!existingMeta || existingMeta.syncStatus === 'pending_upload') &&
        !existingMeta?.lastSyncedServerUpdatedAt;

      if (isUnsyncedLocalCreate) {
        // Unsynced local create -> delete: remove local entity and clear pending upload record
        await workoutStorage.deleteCompletedWorkout(id, resolvedScope);
        if (existingMeta) {
          await syncMetadataStore.removeRecord('workout', id, resolvedScope);
        }
        return;
      }

      // Durable tombstone first to prevent ID/sync loss on crash
      const now = new Date().toISOString();
      await syncMetadataStore.markPendingDelete('workout', id, now, now, resolvedScope);
      await workoutStorage.deleteCompletedWorkout(id, resolvedScope);

      // Fire-and-forget sync trigger (asynchronous, non-blocking)
      void syncLifecycleManager.triggerSync({ reason: 'local_delete', scope: resolvedScope }).catch(() => {
        // Silently caught; sync failure cannot throw or affect caller
      });
    } else {
      // Guest or unauthenticated: strictly local-only delete
      await workoutStorage.deleteCompletedWorkout(id, resolvedScope);
    }
  }

  /**
   * Updates the name of a completed workout from history.
   * Produces a durable pending_upload for sync if authenticated.
   */
  async updateCompletedWorkoutName(id: string, newName: string, scope?: UserScope | null): Promise<WorkoutSession> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const existing = await workoutStorage.getCompletedWorkoutById(id, resolvedScope);
    if (!existing) {
      throw new Error(`Completed workout with id "${id}" not found.`);
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      throw new Error('Workout name cannot be empty.');
    }

    const updated: WorkoutSession = {
      ...existing,
      name: trimmedName,
    };

    // 1. Local durable save first (Source of Truth)
    await workoutStorage.saveCompletedWorkout(updated, resolvedScope);

    // 2. Mark pending upload in sync metadata (authenticated only)
    if (resolvedScope && resolvedScope.ownerType === 'authenticated') {
      try {
        await syncMetadataStore.markPendingUpload(
          'workout',
          updated.id,
          new Date().toISOString(), // Use current time for the sync trigger
          resolvedScope,
        );
      } catch {
        // Durability: Local save succeeded. Crash recovery scanner will reconstruct missing metadata.
      }

      // 3. Fire-and-forget sync trigger (asynchronous, non-blocking)
      void syncLifecycleManager.triggerSync({ reason: 'workout_completed', scope: resolvedScope }).catch(() => {
        // Silently caught; sync failure cannot throw or affect caller
      });
    }

    return updated;
  }

  /**
   * Updates the name of the currently active workout session draft.
   */
  async updateActiveWorkoutName(newName: string, scope?: UserScope | null): Promise<WorkoutSession | null> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const active = await workoutStorage.getActiveWorkout(resolvedScope);
    if (!active) return null;
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Workout name cannot be empty.');
    const currentSeq = Math.max(Number(active.revision ?? 0), Number(active.version ?? 0));
    const nextSeq = currentSeq + 1;
    const updated: WorkoutSession = {
      ...active,
      name: trimmed,
      updatedAt: new Date().toISOString(),
      version: nextSeq,
      revision: nextSeq,
    };
    await workoutStorage.saveActiveWorkout(updated, resolvedScope);
    return updated;
  }

  /**
   * Starts a new active workout session by repeating a previously completed WorkoutSession.
   * Generates a brand new session ID and deep-copies exercises and sets with new set IDs
   * and reset completion flags, preserving the original completed workout completely untouched.
   */
  async startWorkoutFromCompleted(
    completedWorkout: WorkoutSession,
    customName?: string,
    scope?: UserScope | null,
    options?: { forceDiscardExisting?: boolean }
  ): Promise<WorkoutSession> {
    if (!completedWorkout || !completedWorkout.id) {
      throw new Error('Valid completed workout session is required to repeat a workout.');
    }

    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const sessionId = `workout_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const exercises: WorkoutExercise[] = (completedWorkout.exercises || []).map((ex, exIndex) => {
      const sourceSets = ex.actualSets || [];
      const completedSets = sourceSets.filter((s) => s.completed);
      const setsToCopy = completedSets.length > 0 ? completedSets : sourceSets;
      const isTreadmill = ex.trackingMode === 'treadmill';

      const newSets: WorkoutSet[] = (
        setsToCopy.length > 0
          ? setsToCopy
          : [
              isTreadmill
                ? ({
                    weight: 0,
                    reps: 0,
                    rir: undefined,
                    inclinePercent: ex.plannedTargetInclinePercent ?? 0,
                    speedKph: ex.plannedTargetSpeedKph ?? 5,
                    durationSeconds: ex.plannedTargetDurationSeconds ?? 600,
                    completed: false,
                  } as WorkoutSet)
                : ({ weight: 0, reps: 10, rir: 2, completed: false } as WorkoutSet),
            ]
      ).map((s, sIndex) =>
        isTreadmill
          ? {
              id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sIndex + 1}`,
              setNumber: sIndex + 1,
              weight: 0,
              reps: 0,
              rir: undefined,
              inclinePercent:
                typeof s.inclinePercent === 'number' && s.inclinePercent >= 0
                  ? s.inclinePercent
                  : (ex.plannedTargetInclinePercent ?? 0),
              speedKph:
                typeof s.speedKph === 'number' && s.speedKph > 0
                  ? s.speedKph
                  : (ex.plannedTargetSpeedKph ?? 5),
              durationSeconds:
                typeof s.durationSeconds === 'number' && s.durationSeconds > 0
                  ? s.durationSeconds
                  : (ex.plannedTargetDurationSeconds ?? 600),
              setType: s.setType || 'normal',
              notes: s.notes ? s.notes : undefined,
              completed: false,
            }
          : {
              id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sIndex + 1}`,
              setNumber: sIndex + 1,
              weight: typeof s.weight === 'number' && s.weight >= 0 ? s.weight : 0,
              reps: typeof s.reps === 'number' && s.reps > 0 ? s.reps : 10,
              rir: typeof s.rir === 'number' ? s.rir : 2,
              setType: s.setType || 'normal',
              notes: s.notes ? s.notes : undefined,
              completed: false,
            }
      );

      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        categoryName: ex.categoryName,
        order: ex.order !== undefined ? ex.order : exIndex,
        trackingMode: ex.trackingMode,
        plannedTargetInclinePercent: ex.plannedTargetInclinePercent,
        plannedTargetSpeedKph: ex.plannedTargetSpeedKph,
        plannedTargetDurationSeconds: ex.plannedTargetDurationSeconds,
        supersetGroupId: ex.supersetGroupId || null,
        plannedSets: ex.plannedSets || newSets.length,
        plannedTargetReps: isTreadmill ? undefined : ex.plannedTargetReps,
        plannedRestTime: isTreadmill ? 0 : (ex.plannedRestTime || 90),
        plannedTargetWeight: isTreadmill ? undefined : ex.plannedTargetWeight,
        actualSets: newSets,
      };
    });

    const cleanedExercises = this.cleanSupersetInvariants(exercises);

    const session: WorkoutSession = {
      id: sessionId,
      ownerId: resolvedScope?.ownerId,
      ownerType: resolvedScope?.ownerType,
      name: customName?.trim() || completedWorkout.name || 'Repeated Workout',
      startedAt: now,
      updatedAt: now,
      version: 1,
      status: 'active',
      exercises: cleanedExercises,
      activeRestTimer: null,
    };

    return workoutStorage.createActiveWorkout(session, resolvedScope, {
      forceDiscardExisting: options?.forceDiscardExisting,
    });
  }

  /**
   * Retrieves an abandoned workout recovery draft if one exists.
   */
  async getAbandonedWorkout(scope?: UserScope | null): Promise<WorkoutSession | null> {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));
    return workoutStorage.getAbandonedWorkout(resolvedScope);
  }

  /**
   * Restores an abandoned workout draft back into the active workout slot.
   */
  async restoreAbandonedWorkout(
    scope?: UserScope | null,
    options?: { forceDiscardExisting?: boolean }
  ): Promise<WorkoutSession | null> {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const abandoned = await workoutStorage.getAbandonedWorkout(resolvedScope);
    if (!abandoned) return null;

    const isDiscarded = await workoutStorage.isSessionDiscarded(abandoned.id, resolvedScope);
    if (isDiscarded) {
      await workoutStorage.removeAbandonedWorkoutById(abandoned.id, resolvedScope);
      return null;
    }

    const existing = await workoutStorage.getActiveWorkout(resolvedScope);
    if (existing && existing.status === 'active') {
      if (!options?.forceDiscardExisting) {
        throw new Error(
          `Cannot restore abandoned workout: an active workout is already in progress ("${existing.name}"). You must complete or discard it first.`
        );
      }
      await this.discardActiveWorkout(resolvedScope);
    }

    const currentSeq = Math.max(Number(abandoned.revision ?? 0), Number(abandoned.version ?? 0));
    const nextSeq = currentSeq + 1;
    const restoredSession: WorkoutSession = {
      ...abandoned,
      status: 'active',
      updatedAt: new Date().toISOString(),
      version: nextSeq,
      revision: nextSeq,
    };

    await workoutStorage.saveActiveWorkout(restoredSession, resolvedScope, {
      allowDifferentSession: true,
    });
    await workoutStorage.removeAbandonedWorkoutById(abandoned.id, resolvedScope);
    return restoredSession;
  }

  /**
   * Invalidates volatile in-memory storage cache on logout/user switch.
   */
  clearInMemoryState(): void {
    workoutStorage.clearMemoryCache();
  }
}

export const workoutRepository = new WorkoutRepository();
