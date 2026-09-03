/**
 * BeBig 2.0 — Selectable Chip Group
 *
 * Provides accessible, high-contrast segmented pill and chip choices.
 */

import React from 'react';
import { View, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { colors, spacing, radii } from '../../../constants/theme';

export interface ChipOption<T> {
  label: string;
  value: T;
  subtitle?: string;
  testID?: string;
}

export interface ChipGroupProps<T> {
  options: ChipOption<T>[];
  selectedValue?: T | null;
  selectedValues?: T[];
  onSelect: (value: T) => void;
  multiSelect?: boolean;
  style?: StyleProp<ViewStyle>;
  chipStyle?: StyleProp<ViewStyle>;
}

export function ChipGroup<T extends string | number>({
  options,
  selectedValue,
  selectedValues = [],
  onSelect,
  multiSelect = false,
  style,
  chipStyle,
}: ChipGroupProps<T>) {
  const isSelected = (val: T) => {
    if (multiSelect) {
      return selectedValues.includes(val);
    }
    return selectedValue === val;
  };

  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <Pressable
            key={String(option.value)}
            testID={option.testID || `chip-${option.value}`}
            accessibilityRole={multiSelect ? 'checkbox' : 'button'}
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.chipPressed,
              chipStyle,
            ]}
          >
            <Text
              variant="bodyBold"
              color={selected ? 'accent' : 'primary'}
              style={styles.chipLabel}
            >
              {option.label}
            </Text>
            {option.subtitle && (
              <Text variant="caption" color={selected ? 'accent' : 'muted'}>
                {option.subtitle}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.border,
    borderWidth: 1.5,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44, // Meets Apple 44pt touch minimum
    minWidth: 44,
  },
  chipSelected: {
    borderColor: colors.dark.primary,
    backgroundColor: colors.dark.surfaceSubtle,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipLabel: {
    textAlign: 'center',
  },
});
