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
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    // 1. Initial entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Subtle continuous breathing pulse for athletic aesthetic
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.025,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [fadeAnim, scaleAnim, pulseAnim]);

  return (
    <View style={styles.container} testID={testID}>
      {/* Centered Brand & Artwork Content */}
      <View style={styles.centerContainer}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Athlete Artwork with Subtle Pulsing Glow */}
          <Animated.View style={[styles.imageGlowWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.imageContainer}>
              <Image
                source={require('../../../assets/splash-athlete.png')}
                style={styles.athleteImage}
                resizeMode="cover"
                testID="splash-athlete-image"
              />
            </View>
          </Animated.View>

          {/* Brand Typography & Tagline */}
          <View style={styles.brandSection}>
            <Text variant="display" color="accent" style={styles.brandTitle}>
              BEBIG
            </Text>
            <Text variant="label" color="primary" style={styles.tagline}>
              Your workout. Your progress. Your BeBig.
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

      {/* Subtle Developer Attribution Footer */}
      <View style={styles.footerSection}>
        <Text variant="caption" color="muted" style={styles.developerAttribution}>
          Developed by Aditya Patil
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
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
    shadowRadius: 24,
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
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 7,
  },
  tagline: {
    letterSpacing: 0.8,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.9,
  },
  spinner: {
    marginTop: spacing.xs,
  },
  footerSection: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  developerAttribution: {
    fontSize: 12,
    letterSpacing: 0.6,
    opacity: 0.65,
    fontWeight: '500',
  },
});
