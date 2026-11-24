import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme';
import { Text, Icon } from '../../../components/ui';
import { spacing, radii } from '../../../constants/theme';
import { FONT_FAMILIES } from '../../../theme/typography';

export type KeypadMode = 'kg' | 'reps' | 'incline' | 'speed' | 'durationMinutes';

export interface WorkoutNumericKeypadProps {
  visible: boolean;
  mode: KeypadMode;
  value: string;
  exerciseName?: string;
  setNumber?: number;
  useNativeKeyboard?: boolean;
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onStep: (delta: number) => void;
  onNext: () => void;
  onDismiss: () => void;
  onToggleNativeKeyboard?: () => void;
  unit?: 'kg' | 'lb';
}

export const WorkoutNumericKeypad: React.FC<WorkoutNumericKeypadProps> = ({
  visible = true,
  mode,
  value: _value,
  exerciseName,
  setNumber,
  useNativeKeyboard = false,
  onKeyPress,
  onBackspace,
  onClear,
  onStep,
  onNext,
  onDismiss,
  onToggleNativeKeyboard,
  unit = 'kg',
}) => {
  const { colors } = useAppTheme();
  let insets = { bottom: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    insets = { bottom: 0 };
  }

  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(colors, insets.bottom, windowWidth),
    [colors, insets.bottom, windowWidth]
  );

  if (!visible) return null;

  const stepDelta = mode === 'kg' ? (unit === 'kg' ? 2.5 : 5) : 1;
  const allowsDecimal =
    mode === 'kg' ||
    mode === 'incline' ||
    mode === 'speed' ||
    mode === 'durationMinutes';

  const modeBadgeLabel =
    mode === 'kg'
      ? unit.toUpperCase()
      : mode === 'incline'
      ? 'INCLINE %'
      : mode === 'speed'
      ? 'SPEED KM/H'
      : mode === 'durationMinutes'
      ? 'TIME MIN'
      : 'REPS';

  return (
    <View
      testID="workout-numeric-keypad"
      style={styles.container}
      accessibilityRole="toolbar"
      accessibilityLabel={`Workout numeric keypad ${mode}`}
    >
      <View style={styles.contentWrap}>
        {/* Accessory / Top Header Bar */}
        <View style={styles.accessoryBar}>
          <View style={styles.accessoryLeft}>
            <View style={styles.modeBadge}>
              <Text variant="caption" style={styles.modeBadgeText}>
                {modeBadgeLabel}
              </Text>
            </View>
            {setNumber !== undefined ? (
              <Text variant="caption" color="secondary" style={styles.contextText}>
                Set {setNumber}
                {exerciseName ? ` • ${exerciseName}` : ''}
              </Text>
            ) : null}
          </View>

          <View style={styles.accessoryRight}>
            {onToggleNativeKeyboard ? (
              <Pressable
                testID="keypad-toggle-native-btn"
                onPress={onToggleNativeKeyboard}
                style={({ pressed }) => [
                  styles.accessoryIconBtn,
                  pressed && styles.accessoryIconBtnPressed,
                  useNativeKeyboard && styles.accessoryIconBtnActive,
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Switch to standard keyboard"
              >
                <Icon
                  name="edit"
                  size={15}
                  color={useNativeKeyboard ? colors.primary : colors.textMuted}
                />
              </Pressable>
            ) : null}

            <Pressable
              testID="keypad-dismiss-btn"
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.accessoryIconBtn,
                pressed && styles.accessoryIconBtnPressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keypad"
            >
              <Icon name="chevronDown" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Quick Steppers & Reps Row */}
        {mode === 'kg' ? (
          <View style={styles.stepperRow}>
            <Pressable
              testID="keypad-step-minus-double"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(-stepDelta * 2)}
            >
              <Text style={styles.stepButtonText}>-{stepDelta * 2}</Text>
            </Pressable>
            <Pressable
              testID="keypad-step-minus"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(-stepDelta)}
            >
              <Text style={styles.stepButtonText}>-{stepDelta}</Text>
            </Pressable>
            <Pressable
              testID="keypad-step-plus"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(stepDelta)}
            >
              <Text style={styles.stepButtonText}>+{stepDelta}</Text>
            </Pressable>
            <Pressable
              testID="keypad-step-plus-double"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(stepDelta * 2)}
            >
              <Text style={styles.stepButtonText}>+{stepDelta * 2}</Text>
            </Pressable>
          </View>
        ) : mode === 'incline' ? (
          <View style={styles.stepperRow}>
            <Pressable
              testID="keypad-incline-step-minus-2"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(-2)}
            >
              <Text style={styles.stepButtonText}>-2%</Text>
            </Pressable>
            <Pressable
              testID="keypad-incline-step-minus-half"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(-0.5)}
            >
              <Text style={styles.stepButtonText}>-0.5%</Text>
            </Pressable>
            <Pressable
              testID="keypad-incline-step-plus-half"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(0.5)}
            >
              <Text style={styles.stepButtonText}>+0.5%</Text>
            </Pressable>
            <Pressable
              testID="keypad-incline-step-plus-2"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(2)}
            >
              <Text style={styles.stepButtonText}>+2%</Text>
            </Pressable>
          </View>
        ) : mode === 'speed' ? (
          <View style={styles.stepperRow}>
            <Pressable
              testID="keypad-speed-step-minus-1"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(-1)}
            >
              <Text style={styles.stepButtonText}>-1.0</Text>
            </Pressable>
            <Pressable
              testID="keypad-speed-step-minus-point2"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(-0.2)}
            >
              <Text style={styles.stepButtonText}>-0.2</Text>
            </Pressable>
            <Pressable
              testID="keypad-speed-step-plus-point2"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(0.2)}
            >
              <Text style={styles.stepButtonText}>+0.2</Text>
            </Pressable>
            <Pressable
              testID="keypad-speed-step-plus-1"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(1)}
            >
              <Text style={styles.stepButtonText}>+1.0</Text>
            </Pressable>
          </View>
        ) : mode === 'durationMinutes' ? (
          <View style={styles.stepperRow}>
            <Pressable
              testID="keypad-duration-step-minus-5"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(-5)}
            >
              <Text style={styles.stepButtonText}>-5 min</Text>
            </Pressable>
            <Pressable
              testID="keypad-duration-step-minus-1"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(-1)}
            >
              <Text style={styles.stepButtonText}>-1 min</Text>
            </Pressable>
            <Pressable
              testID="keypad-duration-step-plus-1"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(1)}
            >
              <Text style={styles.stepButtonText}>+1 min</Text>
            </Pressable>
            <Pressable
              testID="keypad-duration-step-plus-5"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(5)}
            >
              <Text style={styles.stepButtonText}>+5 min</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.repsStepperWrap}>
            <Pressable
              testID="keypad-reps-step-minus"
              style={({ pressed }) => [
                styles.repsStepBtn,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(-1)}
            >
              <Text style={styles.stepButtonText}>-1 Rep</Text>
            </Pressable>
            <Pressable
              testID="keypad-reps-step-plus"
              style={({ pressed }) => [
                styles.repsStepBtn,
                pressed && styles.stepButtonPressed,
              ]}
              onPress={() => onStep(1)}
            >
              <Text style={styles.stepButtonText}>+1 Rep</Text>
            </Pressable>
          </View>
        )}

        {/* 4x3 Numeric Keypad Grid */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            {['1', '2', '3'].map((digit) => (
              <Pressable
                key={digit}
                testID={`keypad-key-${digit}`}
                style={({ pressed }) => [
                  styles.key,
                  pressed && styles.keyPressed,
                ]}
                onPress={() => onKeyPress(digit)}
              >
                <Text style={styles.keyText}>{digit}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.gridRow}>
            {['4', '5', '6'].map((digit) => (
              <Pressable
                key={digit}
                testID={`keypad-key-${digit}`}
                style={({ pressed }) => [
                  styles.key,
                  pressed && styles.keyPressed,
                ]}
                onPress={() => onKeyPress(digit)}
              >
                <Text style={styles.keyText}>{digit}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.gridRow}>
            {['7', '8', '9'].map((digit) => (
              <Pressable
                key={digit}
                testID={`keypad-key-${digit}`}
                style={({ pressed }) => [
                  styles.key,
                  pressed && styles.keyPressed,
                ]}
                onPress={() => onKeyPress(digit)}
              >
                <Text style={styles.keyText}>{digit}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.gridRow}>
            {allowsDecimal ? (
              <Pressable
                testID="keypad-key-dot"
                style={({ pressed }) => [
                  styles.key,
                  styles.keySpecial,
                  pressed && styles.keyPressed,
                ]}
                onPress={() => onKeyPress('.')}
              >
                <Text style={styles.keyText}>.</Text>
              </Pressable>
            ) : (
              <Pressable
                testID="keypad-key-clear"
                style={({ pressed }) => [
                  styles.key,
                  styles.keySpecial,
                  pressed && styles.keyPressed,
                ]}
                onPress={onClear}
              >
                <Text style={styles.keySpecialText}>C</Text>
              </Pressable>
            )}

            <Pressable
              testID="keypad-key-0"
              style={({ pressed }) => [
                styles.key,
                pressed && styles.keyPressed,
              ]}
              onPress={() => onKeyPress('0')}
            >
              <Text style={styles.keyText}>0</Text>
            </Pressable>

            <Pressable
              testID="keypad-key-backspace"
              style={({ pressed }) => [
                styles.key,
                styles.keySpecial,
                pressed && styles.keyPressed,
              ]}
              onPress={onBackspace}
              accessibilityRole="button"
              accessibilityLabel="Backspace"
            >
              <Icon name="x" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Big Primary Next Action Button */}
        <View style={styles.actionRow}>
          <Pressable
            testID="keypad-key-next"
            style={({ pressed }) => [
              styles.nextButton,
              pressed && styles.nextButtonPressed,
            ]}
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel="Next field or next set"
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const createStyles = (
  colors: any,
  bottomInset: number,
  windowWidth: number
) => {
  const maxWidth = Math.min(520, windowWidth);

  return StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface ?? '#0F172A',
      borderTopWidth: 1,
      borderTopColor: colors.border ?? '#334155',
      paddingBottom: Math.max(bottomInset, 8),
      alignItems: 'center',
      zIndex: 9999,
      ...Platform.select({
        web: {
          boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.45)',
        },
        default: {
          elevation: 12,
        },
      }),
    },
    contentWrap: {
      width: '100%',
      maxWidth,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs + 2,
    },
    accessoryBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      marginBottom: 6,
    },
    accessoryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    modeBadge: {
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
      borderRadius: radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    modeBadgeText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 10,
      letterSpacing: 0.5,
    },
    contextText: {
      fontSize: 12,
      fontWeight: '600',
    },
    accessoryRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    accessoryIconBtn: {
      padding: 4,
      borderRadius: radii.sm,
    },
    accessoryIconBtnPressed: {
      opacity: 0.6,
    },
    accessoryIconBtnActive: {
      backgroundColor: 'rgba(0, 229, 153, 0.15)',
    },
    stepperRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: 6,
    },
    stepButton: {
      flex: 1,
      backgroundColor: colors.background ?? '#1E293B',
      borderWidth: 1,
      borderColor: colors.border ?? '#334155',
      borderRadius: radii.sm,
      paddingVertical: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepButtonPressed: {
      backgroundColor: colors.surfaceElevated ?? '#334155',
    },
    stepButtonText: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 12,
    },
    rpeAndStepperSection: {
      gap: 6,
      marginBottom: 6,
    },
    repsStepperWrap: {
      flexDirection: 'row',
      gap: 6,
    },
    repsStepBtn: {
      flex: 1,
      backgroundColor: colors.background ?? '#1E293B',
      borderWidth: 1,
      borderColor: colors.border ?? '#334155',
      borderRadius: radii.sm,
      paddingVertical: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grid: {
      gap: 5,
    },
    gridRow: {
      flexDirection: 'row',
      gap: 5,
    },
    key: {
      flex: 1,
      height: 44,
      backgroundColor: colors.background ?? '#1E293B',
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border ?? '#334155',
    },
    keySpecial: {
      backgroundColor: colors.surfaceElevated ?? '#1E293B',
    },
    keyPressed: {
      backgroundColor: colors.primary ?? '#475569',
      transform: [{ scale: 0.98 }],
    },
    keyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      fontFamily: FONT_FAMILIES.heading,
    },
    keySpecialText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    actionRow: {
      marginTop: 6,
    },
    nextButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.sm,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextButtonPressed: {
      opacity: 0.85,
    },
    nextButtonText: {
      color: '#000000',
      fontWeight: '700',
      fontSize: 13,
      letterSpacing: 0.3,
    },
  });
};
