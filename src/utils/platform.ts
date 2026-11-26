/**
 * BeBig 2.0 — Platform Utilities
 *
 * Provides clear, cross-platform helpers with iOS-first awareness.
 */

import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isWeb = Platform.OS === 'web';
