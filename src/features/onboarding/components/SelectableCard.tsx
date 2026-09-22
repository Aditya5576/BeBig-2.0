/**
 * BeBig 2.0 — Selectable Card Primitive
 *
 * Polished single-select card with high-contrast active state,
 * descriptive subtext, and accessible touch target.
 */

import { useAppTheme } from '../../theme';
import React from 'react';
import { Pressable, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { spacing, radii } from '../../../constants/theme';

export interface SelectableCardProps {
  title: string;
  description?: string;
  badge?: string;
  selected: boolean;
  onSelect: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SelectableCard({
  title,
  description,
  badge,
  selected,
  onSelect,
  style,
  testID,
}: SelectableCardProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}${description ? `, ${description}` : ''}`}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
        style,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text variant="titleMedium" color={selected ? 'accent' : 'primary'} style={styles.title}>
            {title}
          </Text>
          {badge && (
            <View style={styles.badge}>
              <Text variant="caption" color="accent" style={styles.badgeText}>
                {badge}
              </Text>
            </View>
          )}
        </View>

        {description && (
          <Text
            variant="body"
            color={selected ? 'primary' : 'secondary'}
            style={styles.description}
          >
            {description}
          </Text>
        )}
      </View>

      {/* Radio indicator circle */}
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </Pressable>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: radii.lg,
    padding: spacing.md,
    minHeight: 68, // Generous touch target
    gap: spacing.md,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceSubtle,
  },
  cardPressed: {
    opacity: 0.85,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontWeight: '700',
  },
  description: {
    lineHeight: 20,
  },
  badge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
});
