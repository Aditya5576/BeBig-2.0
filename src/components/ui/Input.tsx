/**
 * BeBig 2.0 — Input Component Primitive
 *
 * Athletic, gym-styled text input with focus states, show/hide password toggle,
 * and high-contrast typography designed for gym lighting.
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Text } from './Text';
import { colors, spacing, radii } from '../../constants/theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  helperText?: string;
  leftIcon?: React.ReactNode;
  isPassword?: boolean;
  toggleTestID?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  isPassword = false,
  toggleTestID = 'toggle-password-visibility',
  containerStyle,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  testID,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSecure = isPassword ? !showPassword : secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" color={error ? 'accent' : 'secondary'} style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null,
        ]}
      >
        {leftIcon ? <View style={styles.leftIconContainer}>{leftIcon}</View> : null}

        <TextInput
          testID={testID}
          style={[styles.input, leftIcon ? styles.inputWithLeftIcon : null, style]}
          placeholderTextColor={colors.dark.textMuted}
          secureTextEntry={isSecure}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />

        {isPassword ? (
          <Pressable
            testID={toggleTestID}
            onPress={() => setShowPassword((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [styles.toggleButton, pressed && styles.toggleButtonPressed]}
          >
            <Text variant="caption" color="accent" style={styles.toggleText}>
              {showPassword ? 'HIDE' : 'SHOW'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" color="primary" style={styles.errorText}>
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" color="muted" style={styles.helperText}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    width: '100%',
  },
  label: {
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
    borderWidth: 1.5,
    borderColor: colors.dark.borderLight,
    borderRadius: radii.md,
    minHeight: 52, // Meets Apple 44pt touch minimum with generous padding
    paddingHorizontal: spacing.md,
  },
  inputWrapperFocused: {
    borderColor: colors.dark.primary,
    backgroundColor: colors.dark.surfaceElevated,
    shadowColor: colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  inputWrapperError: {
    borderColor: colors.dark.error,
  },
  input: {
    flex: 1,
    color: colors.dark.textPrimary,
    fontSize: 16,
    paddingVertical: spacing.sm + 4,
  },
  leftIconContainer: {
    marginRight: spacing.sm,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  toggleButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44, // Touch target minimum
  },
  toggleButtonPressed: {
    opacity: 0.6,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  errorText: {
    color: colors.dark.error,
    marginTop: 2,
  },
  helperText: {
    marginTop: 2,
  },
});
