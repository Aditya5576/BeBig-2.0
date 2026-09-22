import { WorkoutSession } from '../../workout/types';
import { MuscleGroupVolume } from './types';

/**
 * Deterministically calculates muscle group volume based on completed sets.
 * Uses the exercise category (e.g. 'Chest', 'Back') stored directly in the workout session.
 */
export function calculateMuscleGroupVolume(workouts: WorkoutSession[]): MuscleGroupVolume[] {
  if (!workouts || workouts.length === 0) return [];

  const map = new Map<string, { totalSets: number; totalVolume: number }>();

  for (const workout of workouts) {
    if (!workout.exercises) continue;

    for (const ex of workout.exercises) {
      if (!ex.actualSets) continue;
      
      const muscleGroup = ex.categoryName ? ex.categoryName.trim() : 'Unknown';
      
      let exSets = 0;
      let exVol = 0;

      for (const set of ex.actualSets) {
        if (set.completed && set.reps > 0) {
          exSets += 1;
          exVol += (set.weight > 0 ? set.weight : 0) * set.reps;
        }
      }

      if (exSets > 0) {
        const existing = map.get(muscleGroup) || { totalSets: 0, totalVolume: 0 };
        map.set(muscleGroup, {
          totalSets: existing.totalSets + exSets,
          totalVolume: existing.totalVolume + exVol,
        });
      }
    }
  }

  // Convert map to array and sort by highest volume
  const results: MuscleGroupVolume[] = Array.from(map.entries()).map(([muscleGroup, stats]) => ({
    muscleGroup,
    totalSets: stats.totalSets,
    totalVolume: Math.round(stats.totalVolume * 100) / 100,
  }));

  return results.sort((a, b) => b.totalVolume - a.totalVolume);
}
