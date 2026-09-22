import { WorkoutSession } from '../../workout/types';
import { getExerciseHistory, ExerciseHistoryEntry } from '../../workout/utils/analytics';
import { ExerciseProgression } from './types';

function getBestSetPerformance(historyEntry: ExerciseHistoryEntry): { weight: number; reps: number } {
  if (historyEntry.sets.length === 0) return { weight: 0, reps: 0 };
  
  // Find sets that hit the max weight
  const maxWeightSets = historyEntry.sets.filter(s => s.weight === historyEntry.maxWeight);
  
  // Of those, find the one with the highest reps
  const bestSet = maxWeightSets.reduce((best, current) => current.reps > best.reps ? current : best, maxWeightSets[0]);
  
  return { weight: bestSet.weight, reps: bestSet.reps };
}

export function calculateProgressionForExercise(
  workouts: WorkoutSession[],
  exerciseId: string,
  exerciseName: string
): ExerciseProgression | null {
  // getExerciseHistory returns oldest-first
  const history = getExerciseHistory(workouts, exerciseId);
  
  if (history.length < 2) {
    return null; // Need at least two sessions to calculate progression
  }

  const previousSession = history[history.length - 2];
  const currentSession = history[history.length - 1];

  const previousPerf = getBestSetPerformance(previousSession);
  const currentPerf = getBestSetPerformance(currentSession);

  const weightDelta = currentPerf.weight - previousPerf.weight;
  const weightDeltaPercent = previousPerf.weight > 0 
    ? (weightDelta / previousPerf.weight) * 100 
    : (weightDelta > 0 ? 100 : 0);
  
  const repDelta = currentPerf.reps - previousPerf.reps;

  let improved = false;
  let maintained = false;
  let declined = false;

  if (weightDelta > 0) {
    improved = true;
  } else if (weightDelta < 0) {
    declined = true;
  } else {
    // weight remained same
    if (repDelta > 0) {
      improved = true;
    } else if (repDelta < 0) {
      declined = true;
    } else {
      maintained = true;
    }
  }

  return {
    exerciseId,
    exerciseName,
    previousWeight: previousPerf.weight,
    currentWeight: currentPerf.weight,
    previousReps: previousPerf.reps,
    currentReps: currentPerf.reps,
    weightDelta,
    weightDeltaPercent: Math.round(weightDeltaPercent * 100) / 100, // round to 2 decimal places
    repDelta,
    improved,
    maintained,
    declined,
  };
}

export function calculateRecentProgressions(workouts: WorkoutSession[]): ExerciseProgression[] {
  if (!workouts || workouts.length === 0) return [];
  
  // Find all unique exercises performed in the *most recent* workout
  const latestWorkout = workouts.reduce((latest, current) => {
    return new Date(current.startedAt).getTime() > new Date(latest.startedAt).getTime() ? current : latest;
  }, workouts[0]);

  if (!latestWorkout.exercises) return [];

  const progressions: ExerciseProgression[] = [];
  
  for (const ex of latestWorkout.exercises) {
    if (!ex.exerciseId) continue;
    // ensure the exercise was actually performed in this latest workout
    const hasCompletedSets = ex.actualSets?.some(s => s.completed && s.reps > 0);
    if (!hasCompletedSets) continue;

    const prog = calculateProgressionForExercise(workouts, ex.exerciseId, ex.exerciseName || 'Unknown Exercise');
    if (prog) {
      progressions.push(prog);
    }
  }

  return progressions;
}
