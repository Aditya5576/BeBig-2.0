import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { OnboardingState } from '../../onboarding/types';
import { UserProfile, ProfileUpsertPayload } from '../types';

export interface IProfileService {
  getProfile: (userId: string) => Promise<UserProfile | null>;
  getCachedProfile: (userId: string) => UserProfile | null;
  upsertProfile: (
    userId: string,
    data: Partial<ProfileUpsertPayload>,
  ) => Promise<UserProfile | null>;
  syncOnboardingProfile: (
    userId: string,
    onboarding: OnboardingState,
  ) => Promise<UserProfile | null>;
  clearMemoryCache: () => void;
}

const memoryProfiles = new Map<string, UserProfile>();

const getProfileStorageKey = (userId: string) => `bebig.profile.${userId}`;

async function readLocalProfile(userId: string): Promise<UserProfile | null> {
  const mem = memoryProfiles.get(userId);
  if (mem) return mem;

  const key = getProfileStorageKey(userId);
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web' || process.env.NODE_ENV === 'test') {
      if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(key);
      }
    } else {
      raw = await SecureStore.getItemAsync(key);
    }
    if (raw) {
      const parsed = JSON.parse(raw) as UserProfile;
      memoryProfiles.set(userId, parsed);
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

async function writeLocalProfile(userId: string, profile: UserProfile): Promise<void> {
  memoryProfiles.set(userId, profile);
  const key = getProfileStorageKey(userId);
  try {
    const serialized = JSON.stringify(profile);
    if (Platform.OS === 'web' || process.env.NODE_ENV === 'test') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, serialized);
      }
    } else {
      await SecureStore.setItemAsync(key, serialized);
    }
  } catch {
    // Ignore storage write errors
  }
}

export const profileService: IProfileService = {
  getCachedProfile: (userId: string): UserProfile | null => {
    if (!userId) return null;
    return memoryProfiles.get(userId) ?? null;
  },

  getProfile: async (userId: string): Promise<UserProfile | null> => {
    if (!userId) return null;

    // Fast memory return if completed
    const mem = memoryProfiles.get(userId);
    if (mem && mem.onboarding_completed) {
      return mem;
    }

    if (isSupabaseConfigured()) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (!error && data) {
            const profile = data as UserProfile;
            await writeLocalProfile(userId, profile);
            return profile;
          }
          if (!error && !data) {
            // Profile genuinely does not exist in DB yet
            break;
          }
        } catch {
          // Network or client blip; retry once
        }
        if (attempt === 0 && process.env.NODE_ENV !== 'test') {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    }

    return readLocalProfile(userId);
  },

  upsertProfile: async (
    userId: string,
    data: Partial<ProfileUpsertPayload>,
  ): Promise<UserProfile | null> => {
    if (!userId) return null;

    const payload: Partial<ProfileUpsertPayload> = {
      ...data,
      id: userId,
    };

    if (isSupabaseConfigured()) {
      try {
        const { data: updated, error } = await supabase
          .from('profiles')
          .upsert(payload)
          .select()
          .single();

        if (!error && updated) {
          const profile = updated as UserProfile;
          await writeLocalProfile(userId, profile);
          return profile;
        }
      } catch {
        // Fallback to local profile cache below
      }
    }

    const existing = await readLocalProfile(userId);
    const merged: UserProfile = {
      id: userId,
      goal: data.goal !== undefined ? data.goal : (existing?.goal ?? null),
      experience_level:
        data.experience_level !== undefined
          ? data.experience_level
          : (existing?.experience_level ?? null),
      days_per_week:
        data.days_per_week !== undefined ? data.days_per_week : (existing?.days_per_week ?? null),
      workout_duration:
        data.workout_duration !== undefined
          ? data.workout_duration
          : (existing?.workout_duration ?? null),
      training_location: data.training_location || existing?.training_location || 'gym',
      equipment: data.equipment !== undefined ? data.equipment : (existing?.equipment ?? null),
      preferred_training_days:
        data.preferred_training_days !== undefined
          ? data.preferred_training_days
          : (existing?.preferred_training_days ?? []),
      workout_style:
        data.workout_style !== undefined ? data.workout_style : (existing?.workout_style ?? null),
      onboarding_completed:
        data.onboarding_completed !== undefined
          ? data.onboarding_completed
          : (existing?.onboarding_completed ?? false),
    };
    await writeLocalProfile(userId, merged);
    return merged;
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

  clearMemoryCache: () => {
    memoryProfiles.clear();
  },
};
