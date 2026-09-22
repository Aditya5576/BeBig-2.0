import { UserProfile } from '../../profile/types';
import { WorkoutSession } from '../../workout/types';
import { 
  calculateWeeklyWorkouts, 
  calculateMonthlyWorkouts, 
  calculateWeeklyVolume, 
  calculateAllTimeVolume,
  calculatePersonalRecords
} from '../../workout/utils/analytics';
import { calculateRecentProgressions } from './progressionEngine';
import { calculateMuscleGroupVolume } from './muscleGroupEngine';
import { TrainingContext, WeeklySummary } from './types';

/**
 * Creates the deterministic Training Context scoped to the authenticated user.
 * This acts as the boundary between BeBig's raw database and the future AI Agent.
 * 
 * @param userId - The authenticated user ID (must be strictly scoped).
 * @param profile - The user's profile summary.
 * @param completedWorkouts - All completed workouts for the user.
 * @param now - Optional timestamp for "current time" (useful for testing).
 */
export function buildTrainingContext(
  userId: string,
  profile: Partial<UserProfile>,
  completedWorkouts: WorkoutSession[],
  now: Date = new Date()
): TrainingContext {
  
  // Base deterministic analytics
  const workoutsThisWeek = calculateWeeklyWorkouts(completedWorkouts, now);
  const workoutsThisMonth = calculateMonthlyWorkouts(completedWorkouts, now);
  const weeklyVolume = calculateWeeklyVolume(completedWorkouts, now);
  const allTimeVolume = calculateAllTimeVolume(completedWorkouts);
  
  // Progression & PRs
  const recentProgressions = calculateRecentProgressions(completedWorkouts);
  const personalRecordsResult = calculatePersonalRecords(completedWorkouts);
  
  // Muscle Group Mapping
  const muscleGroupVolumes = calculateMuscleGroupVolume(completedWorkouts);

  // Derive Weekly Summary from all completed workouts in the current week window
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = (day + 6) % 7; 
  startOfWeek.setDate(startOfWeek.getDate() - diff);
  startOfWeek.setHours(0, 0, 0, 0);

  let thisWeekTotalSets = 0;
  for (const w of completedWorkouts) {
    const timestamp = new Date(w.startedAt).getTime();
    if (!isNaN(timestamp) && timestamp >= startOfWeek.getTime()) {
      if (w.exercises) {
        for (const ex of w.exercises) {
          if (ex.actualSets) {
            for (const set of ex.actualSets) {
              if (set.completed && set.reps > 0) {
                thisWeekTotalSets += 1;
              }
            }
          }
        }
      }
    }
  }

  // Strongest improvement is the progression with highest weightDeltaPercent
  let strongestImprovement = null;
  if (recentProgressions.length > 0) {
    const sorted = [...recentProgressions].sort((a, b) => b.weightDeltaPercent - a.weightDeltaPercent);
    if (sorted[0].improved) {
      strongestImprovement = sorted[0];
    }
  }

  const weeklySummary: WeeklySummary = {
    workoutsCompleted: workoutsThisWeek,
    totalSets: thisWeekTotalSets,
    totalVolume: weeklyVolume,
    prCount: personalRecordsResult.totalPRsCount,
    strongestImprovement
  };

  // Build the subset of recent workouts
  const recentWorkouts = completedWorkouts
    .slice(0, 5)
    .map(w => ({
      id: w.id,
      name: w.name,
      startedAt: w.startedAt,
      volume: typeof w.totalVolume === 'number' ? w.totalVolume : 0
    }));

  return {
    userId,
    profileSummary: profile,
    recentWorkouts,
    workoutsThisWeek,
    workoutsThisMonth,
    weeklyVolume,
    allTimeVolume,
    recentProgressions,
    personalRecords: personalRecordsResult.topPRs, // Include top PRs in context to avoid token bloat
    muscleGroupVolumes,
    weeklySummary
  };
}
