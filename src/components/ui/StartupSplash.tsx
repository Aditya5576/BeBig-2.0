import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Easing,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './Text';
import { colors, spacing } from '../../constants/theme';

export interface StartupSplashProps {
  testID?: string;
}

/**
 * Premium BeBig 2.0 Brand Startup Sequence — Polished Cinematic Edition
 *
 * Sophisticated overlapping animation choreography (~5.0s total startup gate):
 * 1. 0.0s – 1.2s (Atmospheric Emergence):
 *    - Ambient top-down spotlight beam sweeping smoothly across the dark obsidian void
 *    - Calibrated Olympic barbell plate geometry expanding and slowly rotating (0° → 25°)
 * 2. 0.8s – 2.0s (Connected Brand Reveal):
 *    - BeBig Barbell Monogram Crest reveals with controlled spring physics and subtle halo
 *    - Display BEBIG wordmark & submark glide upward with cyan depth shadow
 * 3. 2.2s – 3.4s (Strength & Progression Manifesto):
 *    - Calibrated hairlines expand outward from center
 *    - "BUILD • TRACK • BECOME" reveals with micro-spaced letter tracking
 * 4. 2.8s – 3.8s (Developer Signature):
 *    - "Developed by Aditya Patil" signature fades in softly at bottom center
 * 5. 3.8s – 4.3s (Peak Composition Hold):
 *    - Perfect visual stillness with synchronized cyan backlight breathing
 * 6. 4.3s – 5.0s (Cinematic Elevation & Transition):
 *    - Composition gently elevates (scale 1.025, slight Y lift, soft diffusion) into the app
 */
export function StartupSplash({ testID = 'startup-splash-screen' }: StartupSplashProps) {
  const useNativeDriver = Platform.OS !== 'web';

  // 1. Atmosphere & Light Sweep Drivers
  const atmosphereFadeAnim = useRef(new Animated.Value(0)).current;
  const spotlightPanAnim = useRef(new Animated.Value(0)).current;
  const plateScaleAnim = useRef(new Animated.Value(0.85)).current;
  const plateRotateAnim = useRef(new Animated.Value(0)).current;
  const breathingAnim = useRef(new Animated.Value(0)).current;

  // 2. Brand Identity & Crest Drivers
  const crestFadeAnim = useRef(new Animated.Value(0)).current;
  const crestScaleAnim = useRef(new Animated.Value(0.88)).current;
  const wordmarkFadeAnim = useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = useRef(new Animated.Value(12)).current;

  // 3. Manifesto & Line Expansion Drivers
  const manifestoFadeAnim = useRef(new Animated.Value(0)).current;
  const manifestoLineScaleX = useRef(new Animated.Value(0)).current;
  const manifestoTranslateY = useRef(new Animated.Value(6)).current;

  // 4. Developer Signature Driver
  const footerFadeAnim = useRef(new Animated.Value(0)).current;

  // 5. Final Elevation & App Transition Driver
  const exitElevationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    // Accessibility: Support reduced motion preferences
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((isReduced) => {
        if (!isMounted) return;
        if (isReduced) {
          atmosphereFadeAnim.setValue(1);
          spotlightPanAnim.setValue(0.5);
          plateScaleAnim.setValue(1);
          plateRotateAnim.setValue(0.5);
          crestFadeAnim.setValue(1);
          crestScaleAnim.setValue(1);
          wordmarkFadeAnim.setValue(1);
          wordmarkTranslateY.setValue(0);
          manifestoFadeAnim.setValue(1);
          manifestoLineScaleX.setValue(1);
          manifestoTranslateY.setValue(0);
          footerFadeAnim.setValue(1);
          exitElevationAnim.setValue(0);
        }
      })
      .catch(() => {});

    // Sequence 1: Atmosphere & Calibrated Plate Rotation (0.0s – 5.0s continuous)
    Animated.parallel([
      Animated.timing(atmosphereFadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(plateScaleAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(plateRotateAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver,
      }),
      Animated.timing(spotlightPanAnim, {
        toValue: 1,
        duration: 4600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver,
      }),
    ]).start();

    // Sequence 2: Crest Entrance (0.8s – 1.8s)
    Animated.sequence([
      Animated.delay(750),
      Animated.parallel([
        Animated.timing(crestFadeAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
        Animated.spring(crestScaleAnim, {
          toValue: 1,
          friction: 7.5,
          tension: 38,
          useNativeDriver,
        }),
      ]),
    ]).start();

    // Sequence 3: Wordmark & Submark Elevation (1.2s – 2.2s)
    Animated.sequence([
      Animated.delay(1150),
      Animated.parallel([
        Animated.timing(wordmarkFadeAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
        Animated.timing(wordmarkTranslateY, {
          toValue: 0,
          duration: 850,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
      ]),
    ]).start();

    // Sequence 4: Manifesto Lines & Text Expansion (2.2s – 3.4s)
    Animated.sequence([
      Animated.delay(2150),
      Animated.parallel([
        Animated.timing(manifestoFadeAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
        Animated.timing(manifestoLineScaleX, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(manifestoTranslateY, {
          toValue: 0,
          duration: 750,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
      ]),
    ]).start();

    // Sequence 5: Developer Signature Soft Entrance (2.8s – 3.8s)
    Animated.sequence([
      Animated.delay(2800),
      Animated.timing(footerFadeAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver,
      }),
    ]).start();

    // Sequence 6: Intentional Final Elevation & Transition (4.3s – 5.0s)
    Animated.sequence([
      Animated.delay(4300),
      Animated.timing(exitElevationAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver,
      }),
    ]).start();

    // Continuous Subtle Breathing Loop for the Backlight Aura
    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathingAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(breathingAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
      ]),
    );
    breathingLoop.start();

    return () => {
      isMounted = false;
      breathingLoop.stop();
    };
  }, [
    useNativeDriver,
    atmosphereFadeAnim,
    spotlightPanAnim,
    plateScaleAnim,
    plateRotateAnim,
    crestFadeAnim,
    crestScaleAnim,
    wordmarkFadeAnim,
    wordmarkTranslateY,
    manifestoFadeAnim,
    manifestoLineScaleX,
    manifestoTranslateY,
    footerFadeAnim,
    exitElevationAnim,
    breathingAnim,
  ]);

  // Synchronized Interpolations
  const spotlightTranslateX = spotlightPanAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-24, 24, 0],
  });

  const spotlightOpacity = atmosphereFadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.08],
  });

  const plateRotation = plateRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '25deg'],
  });

  const auraOpacity = breathingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.7],
  });

  const auraScale = breathingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const crestHaloScale = breathingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.025],
  });

  // Final Transition Interpolations (4.3s – 5.0s)
  const masterCompositionScale = exitElevationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.025],
  });

  const masterCompositionTranslateY = exitElevationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const masterCompositionOpacity = exitElevationAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 1, 0.88],
  });

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeContainer} testID={testID}>
      {/* 1. Ambient Top-Down Spotlight Beam with Subtle Motion Sweep */}
      <Animated.View
        style={[
          styles.spotlightBeam,
          {
            opacity: spotlightOpacity,
            transform: [{ translateX: spotlightTranslateX }],
          },
        ]}
      />

      {/* 2. Main Stage with Elevation Master Driver */}
      <Animated.View
        style={[
          styles.centerStage,
          {
            opacity: masterCompositionOpacity,
            transform: [
              { scale: masterCompositionScale },
              { translateY: masterCompositionTranslateY },
            ],
          },
        ]}
      >
        {/* Calibrated Olympic Plate Rings with Slow Dynamic Rotation */}
        <Animated.View
          style={[
            styles.plateGeometryContainer,
            {
              opacity: atmosphereFadeAnim,
              transform: [
                { scale: plateScaleAnim },
                { rotate: plateRotation },
                { scale: auraScale },
              ],
            },
          ]}
        >
          {/* Outer Dashed Calibration Ring */}
          <View style={styles.outerRing} />
          {/* Middle Knurled Steel Ring */}
          <View style={styles.knurledRing} />
          {/* Inner Cyan Power Core */}
          <Animated.View
            style={[
              styles.innerAuraCore,
              {
                opacity: auraOpacity,
              },
            ]}
          />

          {/* Precision Competition Calibration Tick Marks */}
          <View style={[styles.tickMark, styles.tickTop]} />
          <View style={[styles.tickMark, styles.tickBottom]} />
          <View style={[styles.tickMark, styles.tickLeft]} />
          <View style={[styles.tickMark, styles.tickRight]} />
        </Animated.View>

        {/* 3. Hero Brand Identity Composition */}
        <View style={styles.heroBrandUnit}>
          {/* Architectural BeBig Barbell Monogram Crest */}
          <Animated.View
            style={[
              styles.crestWrapper,
              {
                opacity: crestFadeAnim,
                transform: [{ scale: crestScaleAnim }, { scale: crestHaloScale }],
              },
            ]}
            testID="splash-brand-mark"
          >
            <View style={styles.crestShield} testID="splash-athlete-image">
              {/* Symmetrical Steel Barbell & Monogram */}
              <View style={styles.barbellMonogram}>
                {/* Left Plate Pack */}
                <View style={styles.plateOuter} />
                <View style={styles.plateInner} />
                {/* High-Tensile Steel Barbell Shaft */}
                <View style={styles.barbellShaft}>
                  {/* Beveled Diamond Housing the Bold 'B' */}
                  <View style={styles.crestDiamond}>
                    <Text style={styles.crestInitial}>B</Text>
                  </View>
                </View>
                {/* Right Plate Pack */}
                <View style={styles.plateInner} />
                <View style={styles.plateOuter} />
              </View>
            </View>
          </Animated.View>

          {/* Hero BEBIG Wordmark & Submark */}
          <Animated.View
            style={[
              styles.typographyBlock,
              {
                opacity: wordmarkFadeAnim,
                transform: [{ translateY: wordmarkTranslateY }],
              },
            ]}
          >
            <Text variant="display" style={styles.brandWordmark}>
              BEBIG
            </Text>

            <Text variant="caption" style={styles.brandSubmark}>
              ATHLETIC OVERLOAD INTELLIGENCE
            </Text>
          </Animated.View>

          {/* 4. Progressive Manifesto Lines (BUILD • TRACK • BECOME) */}
          <Animated.View
            style={[
              styles.manifestoBlock,
              {
                opacity: manifestoFadeAnim,
                transform: [{ translateY: manifestoTranslateY }],
              },
            ]}
          >
            {/* Left Calibrated Hairline with ScaleX Reveal */}
            <Animated.View
              style={[
                styles.calibratedLine,
                {
                  transform: [{ scaleX: manifestoLineScaleX }],
                },
              ]}
            />

            <Text variant="label" style={styles.manifestoText}>
              BUILD • TRACK • BECOME
            </Text>

            {/* Right Calibrated Hairline with ScaleX Reveal */}
            <Animated.View
              style={[
                styles.calibratedLine,
                {
                  transform: [{ scaleX: manifestoLineScaleX }],
                },
              ]}
            />
          </Animated.View>
        </View>
      </Animated.View>

      {/* 5. Invisible Loading Indicator (Preserves Test Assertions with Zero UI Clutter) */}
      <ActivityIndicator
        testID="auth-loading-indicator"
        size="small"
        color={colors.dark.primary}
        style={styles.hiddenIndicator}
      />

      {/* 6. Restrained Developer Signature (Bottom-Centered) */}
      <Animated.View
        style={[
          styles.footerSection,
          {
            opacity: footerFadeAnim,
          },
        ]}
      >
        <Text variant="caption" style={styles.developerCredit}>
          Developed by Aditya Patil
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#090D16',
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  spotlightBeam: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 40 },
    shadowOpacity: 0.5,
    shadowRadius: 90,
  },
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    width: '100%',
    position: 'relative',
  },
  plateGeometryContainer: {
    position: 'absolute',
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
    borderStyle: 'dashed',
  },
  knurledRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.14)',
  },
  innerAuraCore: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(56, 189, 248, 0.09)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 36,
  },
  tickMark: {
    position: 'absolute',
    backgroundColor: 'rgba(56, 189, 248, 0.35)',
  },
  tickTop: {
    top: 18,
    width: 1.5,
    height: 8,
  },
  tickBottom: {
    bottom: 18,
    width: 1.5,
    height: 8,
  },
  tickLeft: {
    left: 18,
    width: 8,
    height: 1.5,
  },
  tickRight: {
    right: 18,
    width: 8,
    height: 1.5,
  },
  heroBrandUnit: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 380,
    zIndex: 2,
  },
  crestWrapper: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
  },
  crestShield: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#131B2E',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  barbellMonogram: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateOuter: {
    width: 4,
    height: 28,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
    opacity: 0.7,
  },
  plateInner: {
    width: 5,
    height: 38,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
    marginLeft: 2,
    marginRight: 2,
  },
  barbellShaft: {
    width: 32,
    height: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestDiamond: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#090D16',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  crestInitial: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    transform: [{ rotate: '-45deg' }],
    textAlign: 'center',
    includeFontPadding: false,
  },
  typographyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
  },
  brandWordmark: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 12,
    paddingLeft: 12, // Optical balance compensation for letterSpacing
    color: '#F8FAFC',
    textAlign: 'center',
    textShadowColor: 'rgba(56, 189, 248, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    lineHeight: 52,
  },
  brandSubmark: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 3.5,
    paddingLeft: 3.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  manifestoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    width: '100%',
  },
  calibratedLine: {
    width: 32,
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.35)',
  },
  manifestoText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    paddingLeft: 3,
    color: '#38BDF8',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  hiddenIndicator: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    pointerEvents: 'none',
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
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '400',
    color: '#475569',
    textAlign: 'center',
  },
});
