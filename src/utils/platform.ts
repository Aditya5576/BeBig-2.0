/**
 * BeBig 2.0 — Platform Utilities
 *
 * Provides clear, cross-platform helpers with iOS-first awareness.
 */

import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';

/**
 * Type-safe platform selector helper.
 */
export function selectPlatform<T>(options: { ios: T; android: T; web?: T; default?: T }): T {
  if (isIOS) return options.ios;
  if (isAndroid) return options.android;
  if (isWeb && options.web !== undefined) return options.web;
  if (options.default !== undefined) return options.default;
  return options.ios;
}
