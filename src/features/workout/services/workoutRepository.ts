/**
 * BeBig 2.0 — Workout Repository
 *
 * Central service layer for managing live workout execution, set logging,
 * rest interval countdowns, continuous autosave, and completed session history.
 */

import { WorkoutTemplate } from '../../templates/types';
import { WorkoutSession, WorkoutExercise, WorkoutSet, ActiveRestTimer } from '../types';
import { workoutStorage } from '../storage/workoutStorage';
import { getCurrentUserScope } from '../../auth/utils/userScope';

export class WorkoutRepository {
  /**
   * Calculates total volume (tonnage in kg) across all completed sets in a session.
   * Total Volume = Sum(weight * reps) for all sets where completed === true.
   */
  calculateTotalVolume(workout: WorkoutSession): number {
    if (!workout.exercises || workout.exercises.length === 0) return 0;
    let total = 0;
    for (const ex of workout.exercises) {
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
  ): Promise<WorkoutSession> {
    if (!template || !template.id) {
      throw new Error('Valid workout template is required to start a workout.');
    }

    const sessionId = `workout_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const exercises: WorkoutExercise[] = (template.exercises || []).map((tex, exIndex) => {
      // Parse reps from targetReps string, e.g. "8-10" -> 10, "12" -> 12
      const parsedRepsMatch = tex.targetReps.match(/\d+/g);
      const defaultReps = parsedRepsMatch
        ? parseInt(parsedRepsMatch[parsedRepsMatch.length - 1], 10)
        : 10;
      const defaultWeight =
        typeof tex.targetWeight === 'number' && tex.targetWeight > 0 ? tex.targetWeight : 0;
      const numberOfSets = tex.sets > 0 ? tex.sets : 3;

      const actualSets: WorkoutSet[] = [];
      for (let i = 1; i <= numberOfSets; i++) {
        actualSets.push({
          id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${i}`,
          setNumber: i,
          weight: defaultWeight,
          reps: defaultReps,
          rir: 2,
          completed: false,
        });
      }

      return {
        exerciseId: tex.exerciseId,
        exerciseName: tex.exerciseName,
        categoryName: tex.categoryName,
        order: tex.order !== undefined ? tex.order : exIndex,
        plannedSets: tex.sets,
        plannedTargetReps: tex.targetReps,
        plannedRestTime: tex.restTime,
        plannedTargetWeight: tex.targetWeight,
        actualSets,
      };
    });

    const scope = getCurrentUserScope();

    const session: WorkoutSession = {
      id: sessionId,
      ownerId: scope?.ownerId,
      ownerType: scope?.ownerType,
      name: customName?.trim() || template.name,
      sourceTemplateId: template.id,
      startedAt: now,
      status: 'active',
      exercises,
      activeRestTimer: null,
    };

    await workoutStorage.saveActiveWorkout(session, scope);
    return session;
  }

  /**
   * Starts a blank, empty workout session.
   */
  async startEmptyWorkout(name?: string): Promise<WorkoutSession> {
    const sessionId = `workout_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    const scope = getCurrentUserScope();

    const session: WorkoutSession = {
      id: sessionId,
      ownerId: scope?.ownerId,
      ownerType: scope?.ownerType,
      name: name?.trim() || 'Quick Workout',
      startedAt: now,
      status: 'active',
      exercises: [],
      activeRestTimer: null,
    };

    await workoutStorage.saveActiveWorkout(session, scope);
    return session;
  }

  /**
   * Retrieves the current active workout session draft, or null if none.
   */
  async getActiveWorkout(): Promise<WorkoutSession | null> {
    return workoutStorage.getActiveWorkout();
  }

  /**
   * Persists an updated active workout session (continuous autosave).
   */
  async updateActiveWorkout(workout: WorkoutSession): Promise<WorkoutSession> {
    if (!workout || workout.status !== 'active') {
      throw new Error('Only active workouts can be updated in draft.');
    }
    await workoutStorage.saveActiveWorkout(workout);
    return workout;
  }

  /**
   * Adds an exercise to an in-memory WorkoutSession.
   */
  addExerciseToWorkout(
    workout: WorkoutSession,
    exercise: { id: string; name: string; categoryName?: string },
  ): WorkoutSession {
    const defaultSet: WorkoutSet = {
      id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_1`,
      setNumber: 1,
      weight: 0,
      reps: 10,
      rir: 2,
      completed: false,
    };

    const newExercise: WorkoutExercise = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      categoryName: exercise.categoryName,
      order: workout.exercises.length,
      plannedSets: 1,
      plannedTargetReps: '10',
      plannedRestTime: 90,
      actualSets: [defaultSet],
    };

    return {
      ...workout,
      exercises: [...workout.exercises, newExercise],
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
      const newSet: WorkoutSet = {
        id: `set_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${newSetNumber}`,
        setNumber: newSetNumber,
        weight: lastSet ? lastSet.weight : 0,
        reps: lastSet ? lastSet.reps : 10,
        rir: lastSet ? lastSet.rir : 2,
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
   */
  removeSetFromExercise(
    workout: WorkoutSession,
    exerciseId: string,
    setId: string,
  ): WorkoutSession {
    const updatedExercises = workout.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;

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
   * Removes an exercise from the session and re-indexes order.
   */
  removeExerciseFromWorkout(workout: WorkoutSession, exerciseId: string): WorkoutSession {
    const remainingExercises = workout.exercises.filter((ex) => ex.exerciseId !== exerciseId);
    const reindexed = remainingExercises.map((ex, idx) => ({
      ...ex,
      order: idx,
    }));

    return {
      ...workout,
      exercises: reindexed,
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

        // Validate RIR (0 to 10)
        if (typeof nextSet.rir === 'number') {
          if (isNaN(nextSet.rir) || nextSet.rir < 0 || nextSet.rir > 10) {
            throw new Error('RIR must be a number between 0 and 10.');
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
    };

    return {
      ...workout,
      activeRestTimer,
    };
  }

  /**
   * Skips or clears the active rest countdown timer.
   */
  clearRestTimer(workout: WorkoutSession): WorkoutSession {
    return {
      ...workout,
      activeRestTimer: null,
    };
  }

  /**
   * Completes the active workout session.
   * Requires at least one completed set. Calculates duration and total tonnage volume.
   * Clears active draft and adds to completed workouts history.
   */
  async completeActiveWorkout(activeSession?: WorkoutSession): Promise<WorkoutSession> {
    const sessionToFinish = activeSession ?? (await workoutStorage.getActiveWorkout());
    if (!sessionToFinish) {
      throw new Error('No active workout to complete.');
    }

    const completedSetsCount = this.countCompletedSets(sessionToFinish);
    if (completedSetsCount === 0) {
      throw new Error('Cannot complete workout: at least one set must be completed.');
    }

    const finishedAt = new Date().toISOString();
    const startTimeMs = new Date(sessionToFinish.startedAt).getTime();
    const finishTimeMs = new Date(finishedAt).getTime();
    const totalDuration = Math.max(0, Math.floor((finishTimeMs - startTimeMs) / 1000));
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

    await workoutStorage.saveCompletedWorkout(completedSession);
    await workoutStorage.clearActiveWorkout();
    return completedSession;
  }

  /**
   * Discards the active workout draft without saving to history.
   */
  async discardActiveWorkout(): Promise<void> {
    await workoutStorage.clearActiveWorkout();
  }

  /**
   * Retrieves all completed workouts history, newest first.
   */
  async getCompletedWorkouts(): Promise<WorkoutSession[]> {
    return workoutStorage.getCompletedWorkouts();
  }

  /**
   * Retrieves a specific completed workout by ID.
   */
  async getCompletedWorkoutById(id: string): Promise<WorkoutSession | null> {
    return workoutStorage.getCompletedWorkoutById(id);
  }

  /**
   * Deletes a specific completed workout from history.
   */
  async deleteCompletedWorkout(id: string): Promise<void> {
    await workoutStorage.deleteCompletedWorkout(id);
  }

  /**
   * Invalidates volatile in-memory storage cache on logout/user switch.
   */
  clearInMemoryState(): void {
    workoutStorage.clearMemoryCache();
  }
}

export const workoutRepository = new WorkoutRepository();
