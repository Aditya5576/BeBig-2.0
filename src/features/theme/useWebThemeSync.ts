import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAppTheme } from './useAppTheme';

export const useWebThemeSync = () => {
  const { colors } = useAppTheme();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Update HTML background
      document.documentElement.style.backgroundColor = colors.background;
      document.body.style.backgroundColor = colors.background;

      // Update theme-color meta tag
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute('content', colors.background);
    }
  }, [colors]);
};
