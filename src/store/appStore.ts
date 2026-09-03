/**
 * BeBig 2.0 — App Global Store (Zustand)
 *
 * Manages core application status and preferences.
 * Milestone 1: App readiness and theme preference.
 */

import { create } from 'zustand';

export type ThemePreference = 'system' | 'dark' | 'light';

export interface AppState {
  /** Whether the core mobile runtime has finished bootstrapping */
  isReady: boolean;
  /** User selected theme mode */
  themePreference: ThemePreference;
  /** Set initialization completion */
  setReady: (ready: boolean) => void;
  /** Update theme preference */
  setThemePreference: (pref: ThemePreference) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isReady: true,
  themePreference: 'dark', // BeBig defaults to dark mode for gym environments
  setReady: (ready: boolean) => set({ isReady: ready }),
  setThemePreference: (themePreference: ThemePreference) => set({ themePreference }),
}));
