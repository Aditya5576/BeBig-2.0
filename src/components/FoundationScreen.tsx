import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ScreenContainer, Text, Button, Card } from './ui';
import { spacing, colors } from '../constants/theme';
import { isIOS, isAndroid } from '../utils/platform';
import { env } from '../config/env';

export default function FoundationScreen() {
  const [pressedCount, setPressedCount] = useState(0);

  const platformName = isIOS
    ? 'iOS (Primary Target)'
    : isAndroid
      ? 'Android (Secondary Target)'
      : 'Cross-Platform';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="caption" color="accent" style={styles.badge}>
            MILESTONE 1
          </Text>
          <Text variant="display" color="primary">
            {env.appName}
          </Text>
          <Text variant="titleMedium" color="secondary">
            Mobile Architecture Foundation
          </Text>
        </View>

        <Card style={styles.statusCard}>
          <Text variant="titleMedium" color="primary" style={styles.sectionTitle}>
            System Readiness
          </Text>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Target Platform:
            </Text>
            <Text variant="bodyBold" color="accent">
              {platformName}
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Environment:
            </Text>
            <Text variant="bodyBold" color="primary">
              {env.appEnv}
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Navigation:
            </Text>
            <Text variant="bodyBold" color="primary">
              Expo Router
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              State Management:
            </Text>
            <Text variant="bodyBold" color="primary">
              Zustand
            </Text>
          </View>

          <View style={styles.row}>
            <Text variant="label" color="muted">
              Architecture:
            </Text>
            <Text variant="bodyBold" color="primary">
              Decoupled Services
            </Text>
          </View>
        </Card>

        <Card style={styles.verifyCard}>
          <Text variant="titleMedium" color="primary" style={styles.sectionTitle}>
            Interactive Verification
          </Text>
          <Text variant="body" color="secondary" style={styles.verifyDescription}>
            Testing interactive touch responses and theme primitives.
          </Text>

          <Button
            testID="foundation-test-button"
            title={pressedCount === 0 ? 'Verify Foundation' : `Verified (${pressedCount})`}
            onPress={() => setPressedCount((prev) => prev + 1)}
            variant="primary"
            size="md"
          />
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  badge: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statusCard: {
    gap: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark.border,
  },
  verifyCard: {
    gap: spacing.md,
  },
  verifyDescription: {
    marginBottom: spacing.xs,
  },
});
