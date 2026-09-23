/**
 * BeBig 2.0 — ScreenContainer Component Primitive
 *
 * Safe-area aware screen wrapper ensuring consistent backgrounds and edge insets.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, ViewStyle, StyleProp, Animated, Platform } from 'react-native';
import { SafeAreaView, Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../constants/theme';
import { useAppTheme } from '../../features/theme';

export interface ScreenContainerProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  disableAnimation?: boolean;
}

import { useSegments } from 'expo-router';

export function useBottomContentInset() {
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    // Fallback if rendered outside SafeAreaProvider
  }
  
  let isHidden = false;
  try {
    const segments = useSegments() as string[];
    const firstSegment = segments.length > 0 ? segments[0] : undefined;
    const secondSegment = segments.length > 1 ? segments[1] : undefined;
    
    isHidden = 
      firstSegment === 'onboarding' ||
      firstSegment === 'auth' ||
      firstSegment === 'index' ||
      firstSegment === 'admin' ||
      !firstSegment ||
      (firstSegment === 'workout' && secondSegment === 'active');
  } catch (e) {
    // Fallback if useSegments fails (e.g. outside of routing context)
  }
  
  if (isHidden) {
    return insets.bottom;
  }

  // BottomNavBar Base (64) + Safe Area + Workout Button overlap clearance (18) + Visual spacing (16)
  return 64 + Math.max(insets.bottom, 12) + 34; 
}

import { ScrollView, FlatList, ScrollViewProps, FlatListProps } from 'react-native';

export function ScreenScrollView({ style, contentContainerStyle, ...props }: ScrollViewProps) {
  const bottomInset = useBottomContentInset();
  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingBottom: bottomInset }
      ]}
      {...props}
    />
  );
}

export function ScreenFlatList<T>(props: FlatListProps<T>) {
  const bottomInset = useBottomContentInset();
  const { style, contentContainerStyle, ...rest } = props;
  return (
    <FlatList
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingBottom: bottomInset }
      ]}
      {...rest}
    />
  );
}
export function ScreenContainer({
  children,
  style,
  edges = ['top', 'left', 'right'],
  disableAnimation = false,
}: ScreenContainerProps) {
  const isTest = process.env.NODE_ENV === 'test';
  const shouldDisableAnim = disableAnimation || isTest;
  const fadeAnim = useRef(new Animated.Value(shouldDisableAnim ? 1 : 0.9)).current;
  const { colors } = useAppTheme();

  useEffect(() => {
    if (shouldDisableAnim) return;

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ) {
      fadeAnim.setValue(1);
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [fadeAnim, shouldDisableAnim]);

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md }, style]}>
      <Animated.View style={[styles.animatedContent, { opacity: fadeAnim }]}>
        {children}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  animatedContent: {
    flex: 1,
  },
});
