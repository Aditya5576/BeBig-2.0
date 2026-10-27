import { CoachDataProvider } from '../agent/types';
import { TrainingContext } from '../training/types';
import { buildTrainingContext } from '../training/trainingIntelligence';
import { WorkoutSession } from '../../workout/types';

export const DEFAULT_COACH_WORKOUT_LIMIT = 50;

export class SupabaseCoachDataProvider implements CoachDataProvider {
  /**
   * @param supabaseClient A Supabase client explicitly instantiated with the user's JWT.
   *                       This guarantees RLS policies are enforced at the database level.
   * @param workoutLimit The maximum number of recent completed workouts with exercises to fetch.
   */
  constructor(
    private supabaseClient: any,
    private workoutLimit: number = DEFAULT_COACH_WORKOUT_LIMIT
  ) {}

  async getTrainingContext(userId: string, customLimit?: number): Promise<TrainingContext> {
    const limit = typeof customLimit === 'number' && customLimit > 0 ? customLimit : this.workoutLimit;

    // 1. Fetch minimum profile data (only what is needed for coaching context)
    const { data: profile, error: profileError } = await this.supabaseClient
      .from('profiles')
      .select('age, weight, height') // Minimum scoped fields
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // Ignore not found, just fallback
      throw new Error('Failed to fetch user profile data securely.');
    }

    // 2. Fetch completed workout sessions bounded by limit with deterministic ordering
    // Includes explicit user_id filter (defense in depth) and soft-delete tombstone exclusion
    const { data: rawWorkouts, error: workoutsError } = await this.supabaseClient
      .from('workout_sessions')
      .select('id, name, started_at, finished_at, status, total_volume, exercises')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);

    if (workoutsError) {
      throw new Error('Failed to fetch user workout history securely.');
    }

    // 3. Map DB shape to WorkoutSession domain shape
    const completedWorkouts: WorkoutSession[] = (rawWorkouts || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      startedAt: w.started_at,
      finishedAt: w.finished_at,
      status: w.status,
      totalVolume: typeof w.total_volume === 'number' ? w.total_volume : Number(w.total_volume) || 0,
      // the JSON column `exercises` maps cleanly to our domain structure, 
      // but ensure it defaults to empty array if missing
      exercises: w.exercises || []
    }));

    // 4. Accurate lifetime volume: if retrieved count reached the limit,
    // query scalar total_volume across all completed workouts without downloading heavy exercises JSONB
    let allTimeVolumeOverride: number | undefined;
    if (completedWorkouts.length === limit) {
      try {
        const { data: volumeRows, error: volumeError } = await this.supabaseClient
          .from('workout_sessions')
          .select('total_volume')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .is('deleted_at', null);

        if (!volumeError && Array.isArray(volumeRows)) {
          allTimeVolumeOverride = volumeRows.reduce(
            (sum: number, r: any) => sum + (typeof r.total_volume === 'number' ? r.total_volume : Number(r.total_volume) || 0),
            0
          );
        }
      } catch {
        // Graceful fallback to volume of fetched workouts if scalar query fails
      }
    }

    // 5. Build Training Context deterministically
    return buildTrainingContext(
      userId,
      profile || {},
      completedWorkouts,
      new Date(),
      allTimeVolumeOverride
    );
  }
}
