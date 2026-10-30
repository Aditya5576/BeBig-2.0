/**
 * BeBig 2.0 — Exercise Thumbnail Component
 *
 * Renders a static, non-autoplay visual indicator for exercises in lists and pickers:
 * 1. Approved Curated Media: Renders static thumbnail poster from the curated catalog.
 * 2. Custom Exercise Photo: Renders user-owned custom photo if present on custom exercises.
 * 3. Simple Neutral Fallback: Clean, understated neutral fallback without letters or game-style visuals
 *    when no legitimate image is available.
 *
 * STRICT GOVERNANCE:
 * - Never autoplays video or animation.
 * - Keyed strictly by exact canonical exercise ID via exerciseMediaService.
 * - Does not invent URLs or insert unverified assets.
 * - No letter-based or game-style placeholder tiles.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageErrorEventData,
  NativeSyntheticEvent,
} from 'react-native';
import { useAppTheme } from '../../theme';
import { radii } from '../../../constants/theme';
import { Exercise } from '../types';
import {
  resolveExerciseDemonstration,
  hasCustomPhoto,
  getCustomPhotoUri,
} from '../services/exerciseMediaService';
import { CuratedMediaCatalog } from '../data/curatedMediaCatalog';
import { Icon } from '../../../components/ui/Icon';

export interface ExerciseThumbnailProps {
  exercise: Exercise | null | undefined;
  size?: number;
  catalog?: CuratedMediaCatalog;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  hideWhenEmpty?: boolean;
}

export const ExerciseThumbnail = React.memo(function ExerciseThumbnail({
  exercise,
  size = 44,
  catalog,
  style,
  testID,
  hideWhenEmpty = false,
}: ExerciseThumbnailProps) {
  const { colors } = useAppTheme();
  const [imageError, setImageError] = useState(false);

  // Deterministically resolve media source using exact exercise ID
  const mediaUri = useMemo(() => {
    if (!exercise) return null;

    // 1. User-uploaded custom exercise photo (absolute priority)
    if (hasCustomPhoto(exercise)) {
      const customUri = getCustomPhotoUri(exercise);
      if (customUri) return customUri;
    }

    // 2. Check approved curated demonstration catalog
    const resolution = resolveExerciseDemonstration(exercise, catalog);
    if (resolution.status === 'approved' && resolution.demonstration?.thumbnailUri) {
      return resolution.demonstration.thumbnailUri;
    }

    // 3. Provider image fallback for standard library exercises
    if (!exercise.isCustom && exercise.images && exercise.images.length > 0) {
      const main = exercise.images.find((img) => img.isMain) || exercise.images[0];
      if (main?.thumbnailUrl || main?.url) {
        return main.thumbnailUrl || main.url;
      }
    }

    return null;
  }, [exercise, catalog]);

  const containerTestId = testID || `exercise-thumbnail-${exercise?.id || 'unknown'}`;
  const borderRadius = size > 40 ? radii.md : radii.sm;

  // If a valid media URI is resolved and hasn't errored, render static Image
  if (mediaUri && !imageError) {
    return (
      <View
        testID={containerTestId}
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderLight,
          },
          style,
        ]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={exercise?.name ? `${exercise.name} thumbnail` : 'Exercise thumbnail'}
      >
        <Image
          testID={`${containerTestId}-image`}
          source={{ uri: mediaUri }}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          resizeMode="cover"
          fadeDuration={0}
          onError={(_e: NativeSyntheticEvent<ImageErrorEventData>) => setImageError(true)}
        />
      </View>
    );
  }

  // If hideWhenEmpty is requested and no image is available, render nothing
  if (hideWhenEmpty) {
    return null;
  }

  // Simple neutral fallback (no letters, no artificial game-style visual)
  return (
    <View
      testID={containerTestId}
      style={[
        styles.container,
        styles.fallbackContainer,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: colors.surfaceSubtle,
          borderColor: colors.borderLight,
        },
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={exercise?.name ? `${exercise.name} thumbnail placeholder` : 'Exercise thumbnail placeholder'}
    >
      <View testID={`${containerTestId}-fallback`} style={styles.fallbackIconWrapper}>
        <Icon name="workout" size={Math.round(size * 0.44)} color={colors.textMuted} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
