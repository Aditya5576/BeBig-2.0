import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Animated, ActivityIndicator } from 'react-native';
import { Text } from './Text';
import { colors, spacing } from '../../constants/theme';

export interface StartupSplashProps {
  testID?: string;
}

export function StartupSplash({ testID = 'startup-splash-screen' }: StartupSplashProps) {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.92));
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [glowAnim] = useState(() => new Animated.Value(0.4));
  const [textFadeAnim] = useState(() => new Animated.Value(0));
  const [textSlideAnim] = useState(() => new Animated.Value(8));

  useEffect(() => {
    // 1. Staggered entrance animation: Emblem reveals first, then typography slides in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(textFadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(textSlideAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // 2. Continuous athletic breathing aura loop
    const auraLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    auraLoop.start();

    return () => {
      auraLoop.stop();
    };
  }, [fadeAnim, scaleAnim, pulseAnim, glowAnim, textFadeAnim, textSlideAnim]);

  return (
    <View style={styles.container} testID={testID}>
      {/* Top Spacer for balanced vertical optical center */}
      <View style={styles.topSpacer} />

      {/* Main Brand Core */}
      <View style={styles.brandCore}>
        {/* Atmospheric Backlight Aura */}
        <Animated.View
          style={[
            styles.backlightAura,
            {
              opacity: glowAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Hero Insignia */}
        <Animated.View
          style={[
            styles.insigniaWrapper,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
            },
          ]}
        >
          <Image
            source={require('../../../assets/splash-athlete.png')}
            style={styles.heroInsignia}
            resizeMode="contain"
            testID="splash-athlete-image"
          />
        </Animated.View>

        {/* Brand Typography & Tagline */}
        <Animated.View
          style={[
            styles.typographyGroup,
            {
              opacity: textFadeAnim,
              transform: [{ translateY: textSlideAnim }],
            },
          ]}
        >
          <Text variant="display" style={styles.brandWordmark}>
            BEBIG
          </Text>

          <Text variant="label" style={styles.tagline}>
            Your workout. Your progress. Your BeBig.
          </Text>

          {/* Minimalist Energy Loading Indicator */}
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              testID="auth-loading-indicator"
              size="small"
              color={colors.dark.primary}
              style={styles.spinner}
            />
          </View>
        </Animated.View>
      </View>

      {/* Elegant Bottom Developer Attribution */}
      <View style={styles.footerContainer}>
        <Text variant="caption" style={styles.developerAttribution}>
          Developed by Aditya Patil
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  topSpacer: {
    height: 24,
  },
  brandCore: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    maxWidth: 420,
  },
  backlightAura: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
  },
  insigniaWrapper: {
    width: 176,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroInsignia: {
    width: '100%',
    height: '100%',
  },
  typographyGroup: {
    alignItems: 'center',
    gap: 8,
  },
  brandWordmark: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 9,
    color: '#F8FAFC',
    textShadowColor: 'rgba(56, 189, 248, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.8,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  loadingContainer: {
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
  },
  spinner: {
    transform: [{ scale: 0.85 }],
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xs,
  },
  developerAttribution: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '500',
    color: '#475569',
    textTransform: 'none',
  },
});
