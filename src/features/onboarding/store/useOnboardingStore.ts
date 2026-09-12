/**
 * BeBig 2.0 — Onboarding State Store (Zustand)
 *
 * Manages user responses during the onboarding flow.
 * Provides clean actions and completion flag for local and future cloud sync.
 */

import { create } from 'zustand';
import {
  OnboardingState,
  Goal,
  ExperienceLevel,
  WorkoutDuration,
  Equipment,
  DayOfWeek,
  WorkoutStyle,
} from '../types';

export interface OnboardingStore extends OnboardingState {
  setGoal: (goal: Goal) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setDaysPerWeek: (days: number) => void;
  setWorkoutDuration: (duration: WorkoutDuration) => void;
  setEquipment: (equipment: Equipment) => void;
  togglePreferredTrainingDay: (day: DayOfWeek) => void;
  setPreferredTrainingDays: (days: DayOfWeek[]) => void;
  setWorkoutStyle: (style: WorkoutStyle) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const initialState: OnboardingState = {
  goal: null,
  experienceLevel: null,
  daysPerWeek: null,
  workoutDuration: null,
  trainingLocation: 'gym',
  equipment: null,
  preferredTrainingDays: [],
  workoutStyle: null,
  hasCompletedOnboarding: false,
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  ...initialState,

  setGoal: (goal: Goal) => set({ goal }),

  setExperienceLevel: (experienceLevel: ExperienceLevel) => set({ experienceLevel }),

  setDaysPerWeek: (daysPerWeek: number) => set({ daysPerWeek }),

  setWorkoutDuration: (workoutDuration: WorkoutDuration) => set({ workoutDuration }),

  setEquipment: (equipment: Equipment) => set({ equipment }),

  togglePreferredTrainingDay: (day: DayOfWeek) =>
    set((state) => {
      const exists = state.preferredTrainingDays.includes(day);
      return {
        preferredTrainingDays: exists
          ? state.preferredTrainingDays.filter((d) => d !== day)
          : [...state.preferredTrainingDays, day],
      };
    }),

  setPreferredTrainingDays: (preferredTrainingDays: DayOfWeek[]) =>
    set({ preferredTrainingDays }),

  setWorkoutStyle: (workoutStyle: WorkoutStyle) => set({ workoutStyle }),

  completeOnboarding: () => set({ hasCompletedOnboarding: true }),

  resetOnboarding: () => set({ ...initialState }),
}));
