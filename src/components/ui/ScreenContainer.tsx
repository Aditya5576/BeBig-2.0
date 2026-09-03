/**
 * BeBig 2.0 — ScreenContainer Component Primitive
 *
 * Safe-area aware screen wrapper ensuring consistent backgrounds and edge insets.
 */

import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '../../constants/theme';

export interface ScreenContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}

export function ScreenContainer({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
}: ScreenContainerProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
    paddingHorizontal: spacing.md,
  },
});
