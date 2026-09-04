import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Animated, ActivityIndicator } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radii } from '../../constants/theme';

export interface StartupSplashProps {
  testID?: string;
}

export function StartupSplash({ testID = 'startup-splash-screen' }: StartupSplashProps) {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.95));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.container} testID={testID}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Athlete Artwork with Subtle Glow */}
        <View style={styles.imageGlowWrapper}>
          <View style={styles.imageContainer}>
            <Image
              source={require('../../../assets/splash-athlete.png')}
              style={styles.athleteImage}
              resizeMode="cover"
              testID="splash-athlete-image"
            />
          </View>
        </View>

        {/* Brand Typography */}
        <View style={styles.brandSection}>
          <Text variant="display" color="accent" style={styles.brandTitle}>
            BEBIG
          </Text>
          <Text variant="label" color="muted" style={styles.tagline}>
            TRAIN WITH PURPOSE
          </Text>
        </View>

        {/* Loading Spinner */}
        <ActivityIndicator
          testID="auth-loading-indicator"
          size="small"
          color={colors.dark.primary}
          style={styles.spinner}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  imageGlowWrapper: {
    shadowColor: colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  imageContainer: {
    width: 220,
    height: 220,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.dark.borderLight,
    backgroundColor: colors.dark.surfaceElevated,
  },
  athleteImage: {
    width: '100%',
    height: '100%',
  },
  brandSection: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 6,
  },
  tagline: {
    letterSpacing: 3,
    fontSize: 12,
    fontWeight: '700',
  },
  spinner: {
    marginTop: spacing.sm,
  },
});
