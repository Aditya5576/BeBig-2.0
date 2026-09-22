import { useColorScheme } from 'react-native';
import { useThemeStore } from './store';
import { colors } from '../../constants/theme';
import { useMemo } from 'react';

export const useAppTheme = () => {
  const mode = useThemeStore((state) => state.mode);
  const systemColorScheme = useColorScheme();

  const activeMode = mode === 'system' ? (systemColorScheme || 'dark') : mode;
  const activeColors = activeMode === 'light' ? colors.light : colors.dark;

  return useMemo(() => ({
    mode,
    activeMode,
    colors: activeColors,
  }), [mode, activeMode, activeColors]);
};
