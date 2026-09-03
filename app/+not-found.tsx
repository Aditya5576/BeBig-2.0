import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { ScreenContainer, Text } from '../src/components/ui';
import { spacing } from '../src/constants/theme';

export default function NotFoundScreen() {
  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text variant="titleLarge" color="primary">
          Screen not found
        </Text>
        <Text variant="body" color="secondary">
          This screen does not exist in the current milestone.
        </Text>
        <Link href="/" style={styles.link}>
          <Text variant="bodyBold" color="accent">
            Return to Foundation
          </Text>
        </Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  link: {
    marginTop: spacing.md,
  },
});
