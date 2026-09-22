import { CoachDataProvider } from '../agent/types';
import { TrainingContext } from '../training/types';
import { buildTrainingContext } from '../training/trainingIntelligence';
import { WorkoutSession } from '../../workout/types';

export class SupabaseCoachDataProvider implements CoachDataProvider {
  /**
   * @param supabaseClient A Supabase client explicitly instantiated with the user's JWT.
   *                       This guarantees RLS policies are enforced at the database level.
   */
  constructor(private supabaseClient: any) {}

  async getTrainingContext(userId: string): Promise<TrainingContext> {
    // 1. Fetch minimum profile data (only what is needed for coaching context)
    const { data: profile, error: profileError } = await this.supabaseClient
      .from('profiles')
      .select('age, weight, height') // Minimum scoped fields
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // Ignore not found, just fallback
      throw new Error('Failed to fetch user profile data securely.');
    }

    // 2. Fetch completed workout sessions
    // Using RLS to ensure we ONLY get workouts owned by this user
    const { data: rawWorkouts, error: workoutsError } = await this.supabaseClient
      .from('workout_sessions')
      .select('id, name, started_at, finished_at, status, total_volume, exercises')
      .eq('status', 'completed')
      .order('started_at', { ascending: false });

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
      totalVolume: w.total_volume,
      // the JSON column `exercises` maps cleanly to our domain structure, 
      // but ensure it defaults to empty array if missing
      exercises: w.exercises || []
    }));

    // 4. Build Training Context deterministically
    return buildTrainingContext(
      userId,
      profile || {},
      completedWorkouts,
      new Date()
    );
  }
}
