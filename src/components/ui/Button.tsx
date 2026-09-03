/**
 * BeBig 2.0 — Button Component Primitive
 *
 * Accessible, cross-platform touchable primitive with theme-aware styling.
 */

import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radii } from '../../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const isInteractive = !disabled && !loading;

  const containerVariantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'primary':
        return styles.primaryContainer;
      case 'secondary':
        return styles.secondaryContainer;
      case 'outline':
        return styles.outlineContainer;
      case 'ghost':
        return styles.ghostContainer;
    }
  })();

  const sizeStyle: ViewStyle = (() => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'md':
        return styles.sizeMd;
      case 'lg':
        return styles.sizeLg;
    }
  })();

  const textVariant = size === 'sm' ? 'label' : 'bodyBold';
  const textColor =
    variant === 'primary' ? 'inverse' : variant === 'outline' ? 'accent' : 'primary';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      disabled={!isInteractive}
      onPress={() => {
        if (isInteractive) {
          onPress();
        }
      }}
      style={({ pressed }) => [
        styles.base,
        containerVariantStyle,
        sizeStyle,
        pressed && isInteractive && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.dark.primaryText : colors.dark.primary}
        />
      ) : (
        <Text variant={textVariant} color={textColor}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
  primaryContainer: {
    backgroundColor: colors.dark.primary,
  },
  secondaryContainer: {
    backgroundColor: colors.dark.surfaceElevated,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  sizeSm: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    minHeight: 32,
  },
  sizeMd: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    minHeight: 44, // Meets Apple 44pt minimum touch target
  },
  sizeLg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
});
