/**
 * BeBig 2.0 — Button Component Primitive
 *
 * Accessible, cross-platform touchable primitive with theme-aware styling.
 */

import { useAppTheme } from '../../features/theme';
import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator, ViewStyle, StyleProp, Insets, View } from 'react-native';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { spacing, radii } from '../../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  iconSize?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: Insets | number;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconSize,
  accessibilityLabel,
  style,
  hitSlop,
  testID,
}: ButtonProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const isInteractive = !disabled && !loading;

  // Default accessible hitSlop for compact button sizes (< 44pt height)
  const effectiveHitSlop =
    hitSlop ??
    (size === 'sm' ? { top: 8, bottom: 8, left: 8, right: 8 } : undefined);

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

  const textVariant = size === 'sm' ? 'buttonSmall' : 'button';
  const textColor =
    variant === 'primary' ? 'inverse' : variant === 'outline' ? 'accent' : 'primary';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      hitSlop={effectiveHitSlop}
      disabled={!isInteractive}
      onPress={() => {
        if (isInteractive) {
          return onPress();
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
          color={variant === 'primary' ? colors.primaryText : colors.primary}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon ? (
            <Icon
              name={icon}
              size={iconSize || (size === 'sm' ? 14 : size === 'lg' ? 20 : 16)}
              color={
                variant === 'primary'
                  ? colors.primaryText
                  : variant === 'outline' || variant === 'ghost'
                    ? colors.primary
                    : colors.textPrimary
              }
            />
          ) : null}
          <Text variant={textVariant} color={textColor}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
  primaryContainer: {
    backgroundColor: colors.primary,
  },
  secondaryContainer: {
    backgroundColor: colors.surfaceElevated,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
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
