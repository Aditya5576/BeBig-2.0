import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import { platformStorage } from '../../lib/storage';
import { colors } from '../../constants/theme';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isHydrated: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  initializeTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'bebig.theme.preference';

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark', // default to dark
  isHydrated: false,
  
  setMode: async (mode: ThemeMode) => {
    set({ mode });
    try {
      await platformStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.warn('Failed to save theme preference', error);
    }
  },

  initializeTheme: async () => {
    try {
      const storedMode = await platformStorage.getItem(THEME_STORAGE_KEY);
      if (storedMode === 'dark' || storedMode === 'light' || storedMode === 'system') {
        set({ mode: storedMode as ThemeMode, isHydrated: true });
      } else {
        set({ isHydrated: true });
      }
    } catch (error) {
      console.warn('Failed to load theme preference', error);
      set({ isHydrated: true });
    }
  }
}));
