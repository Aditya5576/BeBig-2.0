import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { exerciseRepository, Exercise } from '../../src/features/exercises';
import { colors, spacing, radii } from '../../src/constants/theme';

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadExercise() {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const item = await exerciseRepository.getExerciseById(id);
        if (isMounted) {
          setExercise(item);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load exercise details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadExercise();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.dark.primary} testID="detail-loading" />
        <Text variant="caption" color="muted">
          Loading exercise details...
        </Text>
      </ScreenContainer>
    );
  }

  if (error || !exercise) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <Text variant="titleMedium" color="primary">
          Exercise Not Found
        </Text>
        <Text variant="body" color="muted" style={styles.errorSubtext}>
          {error || 'The requested exercise could not be found or has been removed.'}
        </Text>
        <Button
          testID="detail-back-button"
          title="Back to Exercises"
          onPress={() => router.back()}
          variant="secondary"
          size="md"
        />
      </ScreenContainer>
    );
  }

  const mainImage = exercise.images.find((img) => img.isMain) || exercise.images[0];
  const primaryMusclesText =
    exercise.primaryMuscles.length > 0
      ? exercise.primaryMuscles.map((m) => m.name).join(', ')
      : 'General';
  const secondaryMusclesText =
    exercise.secondaryMuscles.length > 0
      ? exercise.secondaryMuscles.map((m) => m.name).join(', ')
      : null;
  const equipmentText =
    exercise.equipment.length > 0
      ? exercise.equipment.map((e) => e.name).join(', ')
      : 'Bodyweight (no equipment)';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <Button
            testID="detail-back-button"
            title="← Back"
            onPress={() => router.back()}
            variant="ghost"
            size="sm"
            style={styles.backButton}
          />
        </View>

        {/* Exercise Image */}
        {mainImage?.url ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: mainImage.url }}
              style={styles.exerciseImage}
              resizeMode="contain"
              testID="exercise-detail-image"
            />
          </View>
        ) : null}

        {/* Title & Metadata */}
        <View style={styles.headerSection}>
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Text variant="caption" color="accent" style={styles.badgeText}>
                {exercise.categoryName.toUpperCase()}
              </Text>
            </View>

            {exercise.isCustom ? (
              <View style={styles.customBadge} testID="detail-custom-badge">
                <Text variant="caption" color="accent" style={styles.badgeText}>
                  CUSTOM EXERCISE
                </Text>
              </View>
            ) : (
              <View style={styles.sourceBadge}>
                <Text variant="caption" color="muted" style={styles.badgeText}>
                  WGER CATALOG
                </Text>
              </View>
            )}
          </View>

          <Text variant="display" color="primary" testID="exercise-detail-name">
            {exercise.name}
          </Text>
        </View>

        {/* Anatomy & Equipment Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text variant="label" color="muted">
              PRIMARY MUSCLES
            </Text>
            <Text variant="bodyBold" color="primary" testID="detail-primary-muscles">
              {primaryMusclesText}
            </Text>
          </View>

          {secondaryMusclesText ? (
            <View style={styles.infoRow}>
              <Text variant="label" color="muted">
                SECONDARY MUSCLES
              </Text>
              <Text variant="body" color="secondary" testID="detail-secondary-muscles">
                {secondaryMusclesText}
              </Text>
            </View>
          ) : null}

          <View style={[styles.infoRow, styles.noBorder]}>
            <Text variant="label" color="muted">
              EQUIPMENT
            </Text>
            <Text variant="bodyBold" color="accent" testID="detail-equipment">
              {equipmentText}
            </Text>
          </View>
        </Card>

        {/* Instructions Card */}
        <Card style={styles.instructionsCard}>
          <Text variant="titleMedium" color="primary" style={styles.instructionsTitle}>
            Instructions & Form
          </Text>
          <Text
            variant="body"
            color="secondary"
            style={styles.instructionsText}
            testID="exercise-detail-instructions"
          >
            {exercise.description && exercise.description.trim().length > 0
              ? exercise.description
              : 'No written instructions available for this exercise.'}
          </Text>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingHorizontal: 0,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorSubtext: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: colors.dark.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  headerSection: {
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryBadge: {
    backgroundColor: colors.dark.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  sourceBadge: {
    backgroundColor: colors.dark.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  customBadge: {
    backgroundColor: '#1E2C1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dark.success,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
    gap: spacing.md,
  },
  infoRow: {
    gap: 4,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  noBorder: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  instructionsCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
    gap: spacing.sm,
  },
  instructionsTitle: {
    marginBottom: spacing.xs,
  },
  instructionsText: {
    lineHeight: 22,
  },
});
