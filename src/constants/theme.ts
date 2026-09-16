/**
 * BeBig 2.0 — Design Tokens & Visual Identity System
 *
 * Minimal athletic visual foundation optimized for high gym visibility:
 * - High contrast typography
 * - Defined spacing grid
 * - Athletic color system with dark (default gym mode) and light palettes
 */

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

import { Platform } from 'react-native';

export const fontFamilies = {
  sans: Platform.select({
    web: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, sans-serif',
    ios: 'System',
    android: 'Roboto',
    default: 'sans-serif',
  }),
  numeric: Platform.select({
    web: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
    ios: 'System',
    android: 'Roboto',
    default: 'sans-serif',
  }),
};

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700' as const,
    fontFamily: fontFamilies.sans,
    letterSpacing: -0.5,
  },
  titleLarge: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    fontFamily: fontFamilies.sans,
    letterSpacing: -0.3,
  },
  titleMedium: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    fontFamily: fontFamilies.sans,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    fontFamily: fontFamilies.sans,
    letterSpacing: 0,
  },
  bodyBold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
    fontFamily: fontFamilies.sans,
    letterSpacing: 0,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
    fontFamily: fontFamilies.sans,
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    fontFamily: fontFamilies.sans,
    letterSpacing: 0.1,
  },
  numeric: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    fontFamily: fontFamilies.numeric,
    letterSpacing: -0.2,
  },
  numericHero: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800' as const,
    fontFamily: fontFamilies.numeric,
    letterSpacing: -0.5,
  },
} as const;

export const colors = {
  dark: {
    background: '#090D16',
    surface: '#131B2E',
    surfaceSubtle: '#1E293B',
    surfaceElevated: '#24324B',
    primary: '#38BDF8',
    primaryPressed: '#0284C7',
    primaryText: '#090D16',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#1E293B',
    borderLight: '#334155',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F5F9',
    surfaceElevated: '#E2E8F0',
    primary: '#0284C7',
    primaryPressed: '#0369A1',
    primaryText: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#CBD5E1',
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
  },
} as const;

export type ThemeColors = typeof colors.dark;
export type SpacingKey = keyof typeof spacing;
export type RadiiKey = keyof typeof radii;
export type TypographyKey = keyof typeof typography;
