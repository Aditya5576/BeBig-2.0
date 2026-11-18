/**
 * BeBig 2.0 — Design Tokens & Visual Identity System
 *
 * Minimal athletic visual foundation optimized for high gym visibility:
 * - High contrast typography
 * - Defined spacing grid
 * - Athletic color system with dark (default gym mode) and light palettes
 */

import {
  FONT_FAMILIES,
  NUMERIC_TABULAR_STYLE,
  fontFamilies,
  typography,
  TypographyKey,
} from '../theme/typography';

export { FONT_FAMILIES, NUMERIC_TABULAR_STYLE, fontFamilies, typography };
export type { TypographyKey };

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const colors = {
  dark: {
    background: '#090D16',
    surface: '#131B2E',
    surfaceSubtle: '#1E293B',
    surfaceElevated: '#24324B',
    surfaceInset: '#0D121D',
    primary: '#38BDF8',
    primaryPressed: '#0284C7',
    primaryText: '#06101E',
    secondaryAccent: '#00E599',
    accent: '#38BDF8',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#1E293B',
    borderLight: '#334155',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    dropSet: '#A855F7',
  },
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F5F9',
    surfaceElevated: '#E2E8F0',
    surfaceInset: '#F1F5F9',
    primary: '#0284C7',
    primaryPressed: '#0369A1',
    primaryText: '#FFFFFF',
    secondaryAccent: '#00C482',
    accent: '#0284C7',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#CBD5E1',
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
    dropSet: '#9333EA',
  },
} as const;

export const darkColors = colors.dark;
export const lightColors = colors.light;

export type ThemeColors = typeof colors.dark;
export type SpacingKey = keyof typeof spacing;
export type RadiiKey = keyof typeof radii;
