import { useAppTheme } from '../../src/features/theme';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { exerciseRepository, Exercise } from '../../src/features/exercises';
import { spacing, radii } from '../../src/constants/theme';
import { useEntitySyncStatus } from '../../src/services/sync';
import { SyncStatusChip } from '../../src/components/ui';

function CustomExerciseSyncStatus({ exerciseId, isCustom }: { exerciseId: string; isCustom: boolean }) {
  const status = useEntitySyncStatus('custom_exercise', exerciseId);
  if (!isCustom) return null;
  return <SyncStatusChip status={status} />;
}

export default function ExerciseDetailScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
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

  const handleDeletePrompt = () => {
    Alert.alert(
      'Delete Custom Exercise?',
      'Are you sure you want to delete this custom exercise? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDelete,
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!exercise || !exercise.isCustom) return;
    setDeleting(true);
    try {
      await exerciseRepository.deleteCustomExercise(exercise.id);
      router.back();
    } catch (err: any) {
      setDeleting(false);
      Alert.alert('Delete Failed', err?.message || 'Failed to delete custom exercise.');
    }
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} testID="detail-loading" />
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

  const mainImage = exercise.images && exercise.images.length > 0
    ? exercise.images.find((img) => img.isMain) || exercise.images[0]
    : null;

  const primaryMusclesText =
    exercise.primaryMuscles && exercise.primaryMuscles.length > 0
      ? exercise.primaryMuscles.map((m) => m.name).join(', ')
      : null;

  const secondaryMusclesText =
    exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0
      ? exercise.secondaryMuscles.map((m) => m.name).join(', ')
      : null;

  const equipmentText =
    exercise.equipment && exercise.equipment.length > 0
      ? exercise.equipment.map((e) => e.name).join(', ')
      : null;

  const hasInfoRows = primaryMusclesText || secondaryMusclesText || equipmentText;
  const hasDescription = Boolean(exercise.description && exercise.description.trim().length > 0);

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
            {exercise.categoryName ? (
              <View style={styles.categoryBadge}>
                <Text variant="caption" color="accent" style={styles.badgeText}>
                  {exercise.categoryName.toUpperCase()}
                </Text>
              </View>
            ) : null}

            {exercise.isCustom ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.customBadge} testID="detail-custom-badge">
                  <Text variant="caption" color="accent" style={styles.badgeText}>
                    Source: Custom
                  </Text>
                </View>
                <CustomExerciseSyncStatus exerciseId={exercise.id} isCustom={exercise.isCustom} />
              </View>
            ) : null}
          </View>

          <Text variant="display" color="primary" testID="exercise-detail-name">
            {exercise.name}
          </Text>

          <Button
            testID="exercise-detail-view-progression-button"
            title="📊 View Performance Progression"
            onPress={() =>
              router.push({
                pathname: '/workout/progress/exercise/[id]',
                params: { id: exercise.id, name: exercise.name },
              } as any)
            }
            variant="primary"
            size="md"
            style={{ marginTop: spacing.sm }}
          />
        </View>

        {/* Anatomy & Equipment Card */}
        {hasInfoRows ? (
          <Card style={styles.infoCard}>
            {primaryMusclesText ? (
              <View style={[styles.infoRow, (!secondaryMusclesText && !equipmentText) && styles.noBorder]}>
                <Text variant="label" color="muted">
                  PRIMARY MUSCLES
                </Text>
                <Text variant="bodyBold" color="primary" testID="detail-primary-muscles">
                  {primaryMusclesText}
                </Text>
              </View>
            ) : null}

            {secondaryMusclesText ? (
              <View style={[styles.infoRow, !equipmentText && styles.noBorder]}>
                <Text variant="label" color="muted">
                  SECONDARY MUSCLES
                </Text>
                <Text variant="body" color="secondary" testID="detail-secondary-muscles">
                  {secondaryMusclesText}
                </Text>
              </View>
            ) : null}

            {equipmentText ? (
              <View style={[styles.infoRow, styles.noBorder]}>
                <Text variant="label" color="muted">
                  EQUIPMENT
                </Text>
                <Text variant="bodyBold" color="accent" testID="detail-equipment">
                  {equipmentText}
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Notes & Form / Instructions Card */}
        {hasDescription ? (
          <Card style={styles.instructionsCard}>
            <Text variant="titleMedium" color="primary" style={styles.instructionsTitle}>
              {exercise.isCustom ? 'Notes & Form' : 'Instructions & Form'}
            </Text>
            <Text
              variant="body"
              color="secondary"
              style={styles.instructionsText}
              testID="exercise-detail-instructions"
            >
              {exercise.description}
            </Text>
          </Card>
        ) : null}

        {/* Delete Action for Custom Exercises */}
        {exercise.isCustom ? (
          <View style={styles.actionSection}>
            <Button
              testID="delete-custom-exercise-button"
              title="Delete Custom Exercise"
              onPress={handleDeletePrompt}
              variant="outline"
              size="md"
              loading={deleting}
              disabled={deleting}
              style={styles.deleteButton}
            />
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customBadge: {
    backgroundColor: '#1E2C1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    gap: spacing.md,
  },
  infoRow: {
    gap: 4,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  noBorder: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  instructionsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  instructionsTitle: {
    marginBottom: spacing.xs,
  },
  instructionsText: {
    lineHeight: 22,
  },
  actionSection: {
    marginTop: spacing.md,
  },
  deleteButton: {
    borderColor: colors.error || '#EF4444',
  },
});
