import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle, Platform } from 'react-native';

export type BrandLogoBadgeSize = 'sm' | 'md' | 'lg' | number;

export interface BrandLogoBadgeProps {
  /**
   * Predefined badge size variant or exact pixel dimension.
   * - 'sm': 24x24 badge, 18x18 emblem (for compact headers/pills)
   * - 'md': 42x42 badge, 30x30 emblem (for main screen headers)
   * - 'lg': 56x56 badge, 40x40 emblem (for hero/welcome banners)
   * - number: custom width/height (emblem scaled to ~72%)
   * @default 'md'
   */
  size?: BrandLogoBadgeSize;
  /** Test identifier for component queries */
  testID?: string;
  /** Custom wrapper style overrides */
  style?: StyleProp<ViewStyle>;
  /** Custom inner image style overrides */
  imageStyle?: StyleProp<ImageStyle>;
  /** Screen-reader label for accessibility */
  accessibilityLabel?: string;
}

const SIZE_CONFIGS = {
  sm: { containerSize: 24, emblemSize: 18, borderRadius: 8 },
  md: { containerSize: 42, emblemSize: 30, borderRadius: 12 },
  lg: { containerSize: 56, emblemSize: 40, borderRadius: 16 },
};

/**
 * Obsidian Athletic Brand Emblem Badge — BeBig 2.0
 *
 * Renders the isolated BeBig athlete mark inside a dark-glass Obsidian frame
 * with Electric Blue neon contour borders and an ambient backlight glow.
 */
export function BrandLogoBadge({
  size = 'md',
  testID = 'brand-logo-badge',
  style,
  imageStyle,
  accessibilityLabel = 'BeBig Emblem',
}: BrandLogoBadgeProps) {
  const config =
    typeof size === 'number'
      ? {
          containerSize: size,
          emblemSize: Math.round(size * 0.72),
          borderRadius: Math.round(size * 0.28),
        }
      : SIZE_CONFIGS[size] ?? SIZE_CONFIGS.md;

  const containerDynamicStyle: ViewStyle = {
    width: config.containerSize,
    height: config.containerSize,
    borderRadius: config.borderRadius,
  };

  const imageDynamicStyle: ImageStyle = {
    width: config.emblemSize,
    height: config.emblemSize,
  };

  return (
    <View
      style={[styles.container, containerDynamicStyle, style]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={require('../../../assets/bebig-only-logo.png')}
        style={[styles.emblem, imageDynamicStyle, imageStyle]}
        resizeMode="contain"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        // Subtle electric blue glow for dark mode web surfaces
        boxShadow: '0 2px 8px rgba(56, 189, 248, 0.25)',
      } as ViewStyle,
    }),
  },
  emblem: {
    backgroundColor: 'transparent',
  },
});
