/**
 * BeBig 2.0 — Professional Athletic Typography System
 *
 * Dual-family typographic architecture:
 * - Display & Headings: Plus Jakarta Sans (static 600 / 700 / 800 weights)
 * - Body, Labels & UI Controls: Inter (static 400 / 500 / 600 / 700 weights)
 * - Timers & Numeric Metrics: tabular-nums (`fontVariant: ['tabular-nums']`)
 *   to eliminate horizontal digit jitter on ticking timers and weight/rep columns.
 */

import { Platform, TextStyle } from 'react-native';

const WEB_SANS_FALLBACK = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const resolveFontFamily = (registeredName: string): string =>
  Platform.select({
    web: `'${registeredName}', ${WEB_SANS_FALLBACK}`,
    ios: registeredName,
    android: registeredName,
    default: registeredName,
  }) ?? registeredName;

export const FONT_FAMILIES = {
  // Display & Headings — Plus Jakarta Sans
  display: resolveFontFamily('PlusJakartaSans_700Bold'),
  displayExtraBold: resolveFontFamily('PlusJakartaSans_800ExtraBold'),
  heading: resolveFontFamily('PlusJakartaSans_600SemiBold'),

  // Body & UI Controls — Inter
  body: resolveFontFamily('Inter_400Regular'),
  bodyMedium: resolveFontFamily('Inter_500Medium'),
  bodySemiBold: resolveFontFamily('Inter_600SemiBold'),
  bodyBold: resolveFontFamily('Inter_700Bold'),
} as const;

export const NUMERIC_TABULAR_STYLE: TextStyle = {
  fontVariant: ['tabular-nums'],
};

/**
 * Legacy-compatible font family map consumed by `src/constants/theme.ts` and `<Text>`.
 */
export const fontFamilies = {
  // Body & general sans roles -> Inter
  sans: FONT_FAMILIES.body,
  sansMedium: FONT_FAMILIES.bodyMedium,
  sansSemiBold: FONT_FAMILIES.bodySemiBold,
  sansBold: FONT_FAMILIES.bodyBold,

  // Display & heading roles -> Plus Jakarta Sans
  display: FONT_FAMILIES.display,
  displayExtraBold: FONT_FAMILIES.displayExtraBold,
  heading: FONT_FAMILIES.heading,
  sansExtraBold: FONT_FAMILIES.displayExtraBold,

  // Tabular numeric metrics -> Plus Jakarta Sans / Inter with tabular-nums
  numeric: FONT_FAMILIES.display,
  numericBold: FONT_FAMILIES.displayExtraBold,
} as const;

const headingLargePreset = {
  fontSize: 26,
  lineHeight: 32,
  fontWeight: '700' as const,
  fontFamily: FONT_FAMILIES.display,
  letterSpacing: -0.4,
};

const headingMediumPreset = {
  fontSize: 20,
  lineHeight: 26,
  fontWeight: '700' as const,
  fontFamily: FONT_FAMILIES.display,
  letterSpacing: -0.2,
};

const headingSmallPreset = {
  fontSize: 17,
  lineHeight: 22,
  fontWeight: '600' as const,
  fontFamily: FONT_FAMILIES.heading,
  letterSpacing: -0.1,
};

export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800' as const,
    fontFamily: FONT_FAMILIES.displayExtraBold,
    letterSpacing: -0.6,
  },
  h1: headingLargePreset,
  h2: headingMediumPreset,
  h3: headingSmallPreset,
  headingLarge: headingLargePreset,
  headingMedium: headingMediumPreset,
  headingSmall: headingSmallPreset,
  titleLarge: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700' as const,
    fontFamily: FONT_FAMILIES.display,
    letterSpacing: -0.4,
  },
  titleMedium: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600' as const,
    fontFamily: FONT_FAMILIES.heading,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    fontFamily: FONT_FAMILIES.body,
    letterSpacing: 0,
  },
  bodyBold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600' as const,
    fontFamily: FONT_FAMILIES.bodySemiBold,
    letterSpacing: 0,
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    fontFamily: FONT_FAMILIES.body,
    letterSpacing: 0,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
    fontFamily: FONT_FAMILIES.bodyBold,
    letterSpacing: 0.8,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    fontFamily: FONT_FAMILIES.body,
    letterSpacing: 0.1,
  },
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
    fontFamily: FONT_FAMILIES.bodySemiBold,
    letterSpacing: 0,
  },
  buttonSmall: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600' as const,
    fontFamily: FONT_FAMILIES.bodySemiBold,
    letterSpacing: 0,
  },
  numeric: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    fontFamily: FONT_FAMILIES.display,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
  numericHero: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800' as const,
    fontFamily: FONT_FAMILIES.displayExtraBold,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
} as const;

export type TypographyKey = keyof typeof typography;
