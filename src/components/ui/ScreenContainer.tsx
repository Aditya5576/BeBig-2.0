/**
 * BeBig 2.0 — ScreenContainer Component Primitive
 *
 * Safe-area aware screen wrapper ensuring consistent backgrounds and edge insets.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, ViewStyle, StyleProp, Animated, Platform } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '../../constants/theme';

export interface ScreenContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  disableAnimation?: boolean;
}

export function ScreenContainer({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  disableAnimation = false,
}: ScreenContainerProps) {
  const isTest = process.env.NODE_ENV === 'test';
  const shouldDisableAnim = disableAnimation || isTest;
  const fadeAnim = useRef(new Animated.Value(shouldDisableAnim ? 1 : 0.9)).current;

  useEffect(() => {
    if (shouldDisableAnim) return;

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ) {
      fadeAnim.setValue(1);
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [fadeAnim, shouldDisableAnim]);

  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      <Animated.View style={[styles.animatedContent, { opacity: fadeAnim }]}>
        {children}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
    paddingHorizontal: spacing.md,
  },
  animatedContent: {
    flex: 1,
  },
});
