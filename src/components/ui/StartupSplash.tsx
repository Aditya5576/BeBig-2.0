import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Animated, ActivityIndicator, Easing, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './Text';
import { colors, spacing } from '../../constants/theme';

export interface StartupSplashProps {
  testID?: string;
}

export function StartupSplash({ testID = 'startup-splash-screen' }: StartupSplashProps) {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.94));
  const [breathingAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // 1. Unified entrance animation: Insignia and typography reveal cohesively
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // 2. Synchronized 5-second breathing cycle (1800ms expansion, 1800ms contraction)
    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathingAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(breathingAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    breathingLoop.start();

    return () => {
      breathingLoop.stop();
    };
  }, [fadeAnim, scaleAnim, breathingAnim]);

  // Interpolated synchronized breathing values
  const insigniaScale = breathingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.025],
  });

  const auraOpacity = breathingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  const auraScale = breathingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeContainer} testID={testID}>
      {/* 1. Centered Hero Stage (100% optically and vertically centered) */}
      <View style={styles.centerStage}>
        <Animated.View
          style={[
            styles.brandGroup,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Insignia Unit with Concentric Backlight Aura */}
          <View style={styles.insigniaUnit}>
            {/* Concentric Backlight Aura (Anchored directly behind the emblem) */}
            <Animated.View
              style={[
                styles.concentricAura,
                {
                  opacity: auraOpacity,
                  transform: [{ scale: auraScale }],
                },
              ]}
            />

            {/* Emblem Image with Synchronized Breathing */}
            <Animated.View
              style={[
                styles.insigniaFrame,
                {
                  transform: [{ scale: insigniaScale }],
                },
              ]}
            >
              <Image
                source={require('../../../assets/splash-athlete.png')}
                style={styles.insigniaAsset}
                resizeMode="contain"
                testID="splash-athlete-image"
              />
            </Animated.View>
          </View>

          {/* Brand Wordmark & Tagline (Mathematically aligned) */}
          <View style={styles.typographyBlock}>
            <Text variant="display" style={styles.brandWordmark}>
              BEBIG
            </Text>

            <Text variant="label" style={styles.tagline}>
              Your workout. Your progress. Your BeBig.
            </Text>

            {/* Minimalist Cyan Status Loading Element */}
            <View style={styles.statusIndicatorWrapper}>
              <ActivityIndicator
                testID="auth-loading-indicator"
                size="small"
                color={colors.dark.primary}
                style={styles.indicator}
              />
            </View>
          </View>
        </Animated.View>
      </View>

      {/* 2. Pinned Safe-Area Footer */}
      <View style={styles.footerSection}>
        <Text variant="caption" style={styles.developerCredit}>
          Developed by Aditya Patil
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  brandGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 380,
  },
  insigniaUnit: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  concentricAura: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 36,
  },
  insigniaFrame: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insigniaAsset: {
    width: '100%',
    height: '100%',
  },
  typographyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
  },
  brandWordmark: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 8,
    paddingLeft: 8, // Compensate for trailing letterSpacing so BEBIG is 100% center-aligned
    color: '#F8FAFC',
    textAlign: 'center',
    textShadowColor: 'rgba(56, 189, 248, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    lineHeight: 46,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.6,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
  statusIndicatorWrapper: {
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
  },
  indicator: {
    transform: [{ scale: 0.85 }],
  },
  footerSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 28,
  },
  developerCredit: {
    fontSize: 11.5,
    letterSpacing: 1.2,
    fontWeight: '500',
    color: '#475569',
    textAlign: 'center',
  },
});
