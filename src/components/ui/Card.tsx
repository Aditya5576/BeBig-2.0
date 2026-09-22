/**
 * BeBig 2.0 — Card Component Primitive
 *
 * Theme-aware surface container with athletic border styling.
 */

import { useAppTheme } from '../../features/theme';
import React from 'react';
import { View, StyleSheet, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { spacing, radii } from '../../constants/theme';

export interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Card({ style, children, ...props }: CardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
});
