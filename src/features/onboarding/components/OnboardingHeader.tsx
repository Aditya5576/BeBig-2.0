/**
 * BeBig 2.0 — Onboarding Header Component
 *
 * Provides iOS-first back navigation, step indicators, and progress bar.
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { colors, spacing, radii } from '../../../constants/theme';

export interface OnboardingHeaderProps {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  canGoBack?: boolean;
}

export function OnboardingHeader({
  currentStep,
  totalSteps,
  onBack,
  canGoBack = true,
}: OnboardingHeaderProps) {
  const progressPercent = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));

  return (
    <View style={styles.container}>
      <View style={styles.navRow}>
        <View style={styles.leftSlot}>
          {canGoBack && onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              testID="onboarding-back-button"
            >
              <Text variant="titleLarge" color="accent" style={styles.backIcon}>
                ‹
              </Text>
              <Text variant="body" color="accent" style={styles.backText}>
                Back
              </Text>
            </Pressable>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}
        </View>

        <View style={styles.centerSlot}>
          <Text variant="label" color="muted" testID="step-indicator">
            {`Step ${currentStep} of ${totalSteps}`}
          </Text>
        </View>

        <View style={styles.rightSlot} />
      </View>

      {/* Visual Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44, // Meets Apple 44pt touch minimum
  },
  leftSlot: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSlot: {
    flex: 2,
    alignItems: 'center',
  },
  rightSlot: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonPlaceholder: {
    width: 44,
  },
  backIcon: {
    fontSize: 28,
    lineHeight: 28,
    marginTop: -2,
  },
  backText: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.dark.surfaceSubtle,
    borderRadius: radii.full,
    overflow: 'hidden',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.dark.primary,
    borderRadius: radii.full,
  },
});
