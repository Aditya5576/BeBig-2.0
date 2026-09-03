/**
 * BeBig 2.0 — Text Component Primitive
 *
 * Clean typography primitive enforcing BeBig typography scales and colors.
 */

import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import { typography, colors, TypographyKey } from '../../constants/theme';

export type TextVariant = TypographyKey;
export type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse' | 'accent';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function Text({
  variant = 'body',
  color = 'primary',
  style,
  children,
  ...props
}: TextProps) {
  const fontStyle = typography[variant];

  const colorStyle: TextStyle = (() => {
    switch (color) {
      case 'primary':
        return { color: colors.dark.textPrimary };
      case 'secondary':
        return { color: colors.dark.textSecondary };
      case 'muted':
        return { color: colors.dark.textMuted };
      case 'inverse':
        return { color: colors.dark.primaryText };
      case 'accent':
        return { color: colors.dark.primary };
      default:
        return { color: colors.dark.textPrimary };
    }
  })();

  return (
    <RNText style={[styles.base, fontStyle, colorStyle, style]} {...props}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
