---
name: bebig-obsidian-design-system
description: >
  Enforces BeBig 2.0 Obsidian Dark theme tokens (#090D16, #131B2E, #00E599),
  44x44 touch targets, safe areas, VoiceOver accessibility, React Native
  StyleSheet/Expo Router conventions, and protection of workout keypad & body map.
---

# BeBig Obsidian Design System

Apply this skill when creating or styling UI components, screens, or modals in `app/` and `src/`.

## Verified Repository Contracts

- **Exact Theme Tokens (`src/constants/theme.ts`)**:
  - `colors.dark.background`: `'#090D16'`
  - `colors.dark.surface`: `'#131B2E'`
  - `colors.dark.surfaceSubtle`: `'#1E293B'`
  - `colors.dark.surfaceElevated`: `'#24324B'`
  - `colors.dark.surfaceInset`: `'#0D121D'`
  - `colors.dark.primary`: `'#38BDF8'` (`primaryPressed`: `'#0284C7'`, `primaryText`: `'#06101E'`)
  - `colors.dark.secondaryAccent`: `'#00E599'`
  - `colors.dark.textPrimary`: `'#F8FAFC'`, `textSecondary`: `'#94A3B8'`, `textMuted`: `'#64748B'`
  - `colors.dark.error`: `'#EF4444'`, `warning`: `'#F59E0B'`, `success`: `'#22C55E'`
  - Import tokens from `src/constants/theme.ts` and `src/theme/typography.ts` (`Plus Jakarta Sans` + `Inter`, `tabular-nums` on timers/set inputs). Never hardcode ad-hoc hex colors when a token exists.
- **Touch Targets, Safe Areas & VoiceOver**:
  - Interactive controls MUST meet minimum `44x44` pt hit targets (via dimensions or `hitSlop`).
  - Respect device safe areas (`react-native-safe-area-context` / `useSafeAreaInsets`) for bottom sheets, sticky footers, and headers.
  - Provide `accessibilityRole` and `accessibilityLabel` for icon-only buttons, toggles, and custom controls so VoiceOver/TalkBack navigation is complete.
- **No Tailwind / Next.js DOM Assumptions**:
  - BeBig 2.0 uses React Native (`StyleSheet.create`, `View`, `Text`, `Pressable`) with Expo Router. Never introduce Tailwind `className` utilities, Next.js APIs (`next/router`, `next/image`), or web-only DOM assumptions (`document.querySelector`, `<div>`) in shared components.
- **Protected UI Components**:
  - Preserve the behavior, layout, and test contracts of `src/features/workout/components/WorkoutNumericKeypad.tsx` and the explore muscles body map (`tests/ExploreMusclesBodyMap.test.tsx`).
