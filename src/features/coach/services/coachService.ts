import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { WorkoutSession } from '../../workout/types';
import { buildTrainingContext } from '../training/trainingIntelligence';
import { calculateMuscleGroupVolume } from '../training/muscleGroupEngine';
import { calculateWeeklyPerformance, WeeklyPerformanceSummary } from '../../performance/weekly';
import { TrainingContext } from '../training/types';

export interface AIWeeklyAnalysisInsight {
  status: 'optimal' | 'attention' | 'neutral';
  title: string;
  detail: string;
}

export interface AIWeeklyAnalysisResult {
  headline: string;
  summary: string;
  keyInsights: AIWeeklyAnalysisInsight[];
  recommendations: string[];
  muscleFocus: { muscleGroup: string; sets: number; volume: number }[];
  isDeterministicFallback: boolean;
  generatedAt: string;
}

export interface GenerateAnalysisOptions {
  now?: Date;
  forceRefresh?: boolean;
}

/**
 * Deterministically generates high-value, factual coaching analysis
 * from actual workout history without hallucinating data.
 */
export function generateDeterministicWeeklyAnalysis(
  workouts: WorkoutSession[],
  now: Date = new Date()
): AIWeeklyAnalysisResult {
  const perf: WeeklyPerformanceSummary = calculateWeeklyPerformance(workouts, now);
  const context: TrainingContext = buildTrainingContext('local-user', {}, workouts, now);

  const workoutsThisWeek = perf.activity.current.workouts;
  const setsThisWeek = perf.activity.current.sets;
  const exercisesThisWeek = perf.activity.current.exercises;
  const volumeThisWeek = Math.round(context.weeklyVolume);

  // 1. Empty current week handling
  if (!perf.hasCurrentWeekWorkouts || workoutsThisWeek === 0) {
    if (perf.totalHistoricalWorkouts === 0) {
      // 1A. Truly brand new user (zero workouts all-time)
      return {
        headline: 'No Active Sessions This Week',
        summary: 'You have not logged any completed workout sessions for the current calendar week yet.',
        keyInsights: [
          {
            status: 'neutral',
            title: 'Fresh Training Slate',
            detail: 'Start a session from your templates or log an empty workout to begin tracking this week’s progressive overload.',
          },
        ],
        recommendations: [
          'Select a saved workout template or start a quick session.',
          'Target consistent compound lifts to establish this week’s baseline volume.',
        ],
        muscleFocus: [],
        isDeterministicFallback: true,
        generatedAt: new Date().toISOString(),
      };
    }

    // 1B. User has historical workouts, but zero workouts in current week
    const pastCount = perf.totalHistoricalWorkouts;
    const lastWorkout = perf.lastCompletedWorkout;
    const emptyWeekInsights: AIWeeklyAnalysisInsight[] = [];

    if (lastWorkout) {
      const lastDate = new Date(lastWorkout.finishedAt || lastWorkout.startedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      emptyWeekInsights.push({
        status: 'neutral',
        title: 'Previous Training Active',
        detail: `Last completed workout was "${lastWorkout.name}" on ${lastDate}.${lastWorkout.totalVolume ? ` (${Math.round(lastWorkout.totalVolume).toLocaleString()} kg volume)` : ''}`,
      });
    }

    if (perf.activity.previous && perf.activity.previous.workouts > 0) {
      const prev = perf.activity.previous;
      emptyWeekInsights.push({
        status: 'optimal',
        title: 'Previous Week Benchmark',
        detail: `Logged ${prev.workouts} ${prev.workouts === 1 ? 'workout' : 'workouts'} with ${prev.sets} sets across ${prev.exercises} exercises in ${perf.previousWeek.label}.`,
      });
    }

    if (context.weeklySummary.prCount > 0) {
      emptyWeekInsights.push({
        status: 'optimal',
        title: 'Historical Personal Records',
        detail: `${context.weeklySummary.prCount} all-time personal records established in your training history.`,
      });
    }

    emptyWeekInsights.push({
      status: 'neutral',
      title: 'Awaiting Weekly Kickoff',
      detail: `Log your first session for ${perf.currentWeek.label} to establish active weekly progressive overload comparisons.`,
    });

    return {
      headline: `No Sessions Yet This Week • ${pastCount} ${pastCount === 1 ? 'Workout' : 'Workouts'} in History`,
      summary: `No workout sessions have been logged for ${perf.currentWeek.label} yet. Your training history contains ${pastCount} completed ${pastCount === 1 ? 'session' : 'sessions'}. Start a workout to track this week's progression.`,
      keyInsights: emptyWeekInsights,
      recommendations: [
        'Start your first session for this week to maintain consistent training frequency.',
        'Review your previous session loads to apply progressive overload on key lifts.',
      ],
      muscleFocus: [],
      isDeterministicFallback: true,
      generatedAt: new Date().toISOString(),
    };
  }

  // 2. Factual Insights computation
  const insights: AIWeeklyAnalysisInsight[] = [];

  // Progression analysis
  if (perf.summary.progressed > 0) {
    const strongest = context.weeklySummary.strongestImprovement;
    const strongestDetail = strongest
      ? ` Top progression: ${strongest.exerciseName} (+${Math.round(strongest.weightDeltaPercent)}% load).`
      : '';
    insights.push({
      status: 'optimal',
      title: 'Progressive Overload Achieved',
      detail: `${perf.summary.progressed} ${perf.summary.progressed === 1 ? 'exercise' : 'exercises'} improved compared to prior sessions.${strongestDetail}`,
    });
  } else if (perf.summary.maintained > 0 && perf.summary.decreased === 0) {
    insights.push({
      status: 'neutral',
      title: 'Solid Baseline Maintained',
      detail: `${perf.summary.maintained} ${perf.summary.maintained === 1 ? 'exercise' : 'exercises'} matched previous loads with consistent form.`,
    });
  } else if (perf.summary.decreased > 0) {
    insights.push({
      status: 'attention',
      title: 'Fatigue or Load Adjustments',
      detail: `${perf.summary.decreased} ${perf.summary.decreased === 1 ? 'exercise experienced' : 'exercises experienced'} reduced volume or reps. Consider fatigue management or rest.`,
    });
  }

  // Volume & consistency insight
  if (perf.hasHistoricalComparison && perf.activity.previous) {
    const prevWorkouts = perf.activity.previous.workouts;
    const prevSets = perf.activity.previous.sets;
    const setDiff = setsThisWeek - prevSets;

    if (setDiff > 0) {
      insights.push({
        status: 'optimal',
        title: 'Weekly Volume Scaling',
        detail: `Logged ${setsThisWeek} total sets across ${workoutsThisWeek} workouts (+${setDiff} sets vs previous week).`,
      });
    } else if (setDiff < 0) {
      insights.push({
        status: 'neutral',
        title: 'Deload or Taper Detected',
        detail: `Volume decreased by ${Math.abs(setDiff)} sets vs previous week (${setsThisWeek} vs ${prevSets} sets).`,
      });
    } else {
      insights.push({
        status: 'neutral',
        title: 'Consistent Training Density',
        detail: `Identical set volume (${setsThisWeek} sets) maintained week-over-week.`,
      });
    }
  } else {
    insights.push({
      status: 'neutral',
      title: 'Weekly Training Density',
      detail: `${workoutsThisWeek} ${workoutsThisWeek === 1 ? 'session' : 'sessions'} logged with ${setsThisWeek} completed working sets (${exercisesThisWeek} unique exercises).`,
    });
  }

  // Personal records
  if (context.weeklySummary.prCount > 0) {
    insights.push({
      status: 'optimal',
      title: 'Personal Records',
      detail: `${context.weeklySummary.prCount} all-time personal bests established in your training history.`,
    });
  }

  // Muscle group focus breakdown strictly scoped to current week's training
  const currentWeekWorkouts = workouts.filter((w) => {
    const timestamp = new Date(w.startedAt).getTime();
    return !isNaN(timestamp) && timestamp >= perf.currentWeek.start.getTime() && timestamp <= perf.currentWeek.end.getTime();
  });
  const currentWeekMuscleVolumes = calculateMuscleGroupVolume(currentWeekWorkouts);

  const muscleFocus = currentWeekMuscleVolumes.slice(0, 4).map((mg) => ({
    muscleGroup: mg.muscleGroup,
    sets: mg.totalSets,
    volume: mg.totalVolume,
  }));

  // Smart actionable recommendations
  const recommendations: string[] = [];
  if (perf.summary.decreased > 0) {
    recommendations.push('Prioritize 8+ hours of sleep and adequate hydration before re-testing degraded sets.');
  }
  if (perf.summary.progressed > 0) {
    recommendations.push('Maintain current training cadence; add 1–2% load on your primary compound lifts next week.');
  }
  if (muscleFocus.length > 0) {
    const leadingGroup = muscleFocus[0].muscleGroup;
    recommendations.push(`Primary muscular focus this week was ${leadingGroup} (${muscleFocus[0].sets} sets). Ensure opposing muscle groups receive balanced stimulus.`);
  } else {
    recommendations.push('Continue progressive overload with consistent rest intervals and exercise execution.');
  }

  // Headline
  let headline = `${workoutsThisWeek} ${workoutsThisWeek === 1 ? 'Workout' : 'Workouts'} Completed • ${volumeThisWeek.toLocaleString()} kg Total Volume`;
  if (perf.summary.progressed > 0) {
    headline = `Strong Progression • ${perf.summary.progressed} ${perf.summary.progressed === 1 ? 'Exercise' : 'Exercises'} Advanced`;
  }

  return {
    headline,
    summary: `You completed ${workoutsThisWeek} ${workoutsThisWeek === 1 ? 'workout session' : 'workout sessions'} this week with ${setsThisWeek} effective sets and a total moved tonnage of ${volumeThisWeek.toLocaleString()} kg.`,
    keyInsights: insights,
    recommendations,
    muscleFocus,
    isDeterministicFallback: true,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Service orchestrating AI Weekly Workout Analysis.
 * Attempts cloud Edge Function AI execution if authenticated;
 * automatically and safely falls back to deterministic analysis when
 * in guest mode, offline, or when cloud quotas/errors occur.
 */
export class CoachService {
  /**
   * Fetches or generates weekly analysis for the specified workouts.
   */
  async generateWeeklyWorkoutAnalysis(
    workouts: WorkoutSession[],
    options?: GenerateAnalysisOptions
  ): Promise<AIWeeklyAnalysisResult> {
    const now = options?.now || new Date();

    // 1. If Supabase is not configured, immediately use deterministic engine
    if (!isSupabaseConfigured()) {
      return generateDeterministicWeeklyAnalysis(workouts, now);
    }

    try {
      // 2. Check authentication session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.access_token) {
        // Guest mode / unauthenticated -> deterministic local engine
        return generateDeterministicWeeklyAnalysis(workouts, now);
      }

      // 3. Attempt invocation of Edge Function `coach-agent`
      const requestPayload = {
        message: 'Provide a comprehensive weekly training summary and progressive overload analysis for my workouts this week.',
        intent: 'weekly_summary',
      };

      const { data, error } = await supabase.functions.invoke('coach-agent', {
        body: requestPayload,
      });

      if (error || !data || data.type === 'error') {
        // Fallback on edge function error or quota exhaustion
        return generateDeterministicWeeklyAnalysis(workouts, now);
      }

      // 4. Parse AI response into structured presentation format
      const deterministicBase = generateDeterministicWeeklyAnalysis(workouts, now);
      return {
        headline: data.message?.split('\n')?.[0]?.replace(/^#+\s*/, '') || deterministicBase.headline,
        summary: data.message || deterministicBase.summary,
        keyInsights: deterministicBase.keyInsights,
        recommendations: (Array.isArray(data.suggestedActions) && data.suggestedActions.length > 0)
          ? data.suggestedActions
          : deterministicBase.recommendations,
        muscleFocus: deterministicBase.muscleFocus,
        isDeterministicFallback: false,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      // 5. Network drop or unexpected client issue -> deterministic fallback
      return generateDeterministicWeeklyAnalysis(workouts, now);
    }
  }
}

export const coachService = new CoachService();
