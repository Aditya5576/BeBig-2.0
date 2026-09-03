/**
 * BeBig 2.0 — Card Component Primitive
 *
 * Theme-aware surface container with athletic border styling.
 */

import React from 'react';
import { View, StyleSheet, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, radii } from '../../constants/theme';

export interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Card({ style, children, ...props }: CardProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
});
