/**
 * BeBig 2.0 — Onboarding Domain Types
 *
 * Enforces strict typing for the 5-step onboarding flow.
 */

export type Goal = 'build_muscle' | 'gain_strength' | 'lose_fat';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type WorkoutDuration = '30_min' | '45_min' | '60_min' | '90_plus_min';

export type TrainingLocation = 'gym';

export type Equipment = 'full_gym' | 'limited_equipment';

export type DayOfWeek =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type WorkoutStyle = 'push_pull_legs' | 'upper_lower' | 'full_body';

export interface WorkoutPreferences {
  daysPerWeek: number | null;
  workoutDuration: WorkoutDuration | null;
  trainingLocation: TrainingLocation;
  equipment: Equipment | null;
  preferredTrainingDays: DayOfWeek[];
  workoutStyle: WorkoutStyle | null;
}

export interface OnboardingState extends WorkoutPreferences {
  goal: Goal | null;
  experienceLevel: ExperienceLevel | null;
  hasCompletedOnboarding: boolean;
}
