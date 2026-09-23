/**
 * BeBig 2.0 — Text Component Primitive
 *
 * Clean typography primitive enforcing BeBig typography scales and colors.
 */

import { useAppTheme } from '../../features/theme';
import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import { typography, TypographyKey } from '../../constants/theme';

export type TextVariant = TypographyKey;
export type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse' | 'accent';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  tabularNums?: boolean;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function Text({
  variant = 'body',
  color = 'primary',
  tabularNums,
  style,
  children,
  ...props
}: TextProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const fontStyle = typography[variant];

  const colorStyle: TextStyle = (() => {
    switch (color) {
      case 'primary':
        return { color: colors.textPrimary };
      case 'secondary':
        return { color: colors.textSecondary };
      case 'muted':
        return { color: colors.textMuted };
      case 'inverse':
        return { color: colors.primaryText };
      case 'accent':
        return { color: colors.primary };
      default:
        return { color: colors.textPrimary };
    }
  })();

  const tabularStyle: TextStyle | null = tabularNums ? { fontVariant: ['tabular-nums'] } : null;

  return (
    <RNText style={[styles.base, fontStyle, colorStyle, tabularStyle, style]} {...props}>
      {children}
    </RNText>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  base: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
