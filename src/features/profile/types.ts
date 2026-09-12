import {
  Goal,
  ExperienceLevel,
  WorkoutDuration,
  Equipment,
  DayOfWeek,
  WorkoutStyle,
} from '../onboarding/types';

export interface UserProfile {
  id: string;
  display_name?: string | null;
  age?: number | null;
  height?: number | null; // in cm
  weight?: number | null; // in kg
  avatar_url?: string | null;
  goal: Goal | null;
  experience_level: ExperienceLevel | null;
  days_per_week: number | null;
  workout_duration: WorkoutDuration | null;
  training_location: string;
  equipment: Equipment | null;
  preferred_training_days: DayOfWeek[];
  workout_style: WorkoutStyle | null;
  onboarding_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ProfileUpsertPayload = Omit<UserProfile, 'created_at' | 'updated_at'>;

