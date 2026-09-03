import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { OnboardingState } from '../../onboarding/types';
import { UserProfile, ProfileUpsertPayload } from '../types';

export interface IProfileService {
  getProfile: (userId: string) => Promise<UserProfile | null>;
  upsertProfile: (
    userId: string,
    data: Partial<ProfileUpsertPayload>,
  ) => Promise<UserProfile | null>;
  syncOnboardingProfile: (
    userId: string,
    onboarding: OnboardingState,
  ) => Promise<UserProfile | null>;
}

export const profileService: IProfileService = {
  getProfile: async (userId: string): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return null;
      }

      return data as UserProfile | null;
    } catch {
      return null;
    }
  },

  upsertProfile: async (
    userId: string,
    data: Partial<ProfileUpsertPayload>,
  ): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const payload: Partial<ProfileUpsertPayload> = {
        ...data,
        id: userId,
      };

      const { data: updated, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single();

      if (error) {
        return null;
      }

      return updated as UserProfile;
    } catch {
      return null;
    }
  },

  syncOnboardingProfile: async (
    userId: string,
    onboarding: OnboardingState,
  ): Promise<UserProfile | null> => {
    const payload: ProfileUpsertPayload = {
      id: userId,
      goal: onboarding.goal,
      experience_level: onboarding.experienceLevel,
      days_per_week: onboarding.daysPerWeek,
      workout_duration: onboarding.workoutDuration,
      training_location: onboarding.trainingLocation,
      equipment: onboarding.equipment,
      preferred_training_days: onboarding.preferredTrainingDays,
      workout_style: onboarding.workoutStyle,
      onboarding_completed: true,
    };

    return profileService.upsertProfile(userId, payload);
  },
};
