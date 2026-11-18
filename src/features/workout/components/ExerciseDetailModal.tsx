/**
 * BeBig 2.0 — In-Workout Exercise Detail Modal
 *
 * Allows athletes to inspect full exercise details (visual demonstration,
 * category, equipment, primary/secondary muscles, and form instructions)
 * directly over `/workout/active` without navigating away or disrupting
 * active workout sets or rest timers.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ErrorBoundary, Icon, Text } from '../../../components/ui';
import { radii, spacing } from '../../../constants/theme';
import {
  Exercise,
  exerciseRepository,
  getCustomPhotoUri,
  hasCustomPhoto,
  resolveExerciseDemonstration,
} from '../../exercises';
import { useAppTheme } from '../../theme';

type DetailModalColors = ReturnType<typeof useAppTheme>['colors'];

export interface ExerciseDetailModalProps {
  visible: boolean;
  exerciseId: string | null;
  fallbackExerciseName?: string;
  onClose: () => void;
}

export function ExerciseDetailModal({
  visible,
  exerciseId,
  fallbackExerciseName,
  onClose,
}: ExerciseDetailModalProps) {
  const { colors } = useAppTheme();
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    insets = { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const bottomInset = insets.bottom;
  const styles = useMemo(
    () => createStyles(colors, { bottom: bottomInset }),
    [colors, bottomInset],
  );

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!visible || !exerciseId) {
      setExercise(null);
      setLoading(false);
      setLoadFailed(false);
      setImageError(false);
      return;
    }

    let isMounted = true;
    setImageError(false);
    setLoadFailed(false);

    const cached = exerciseRepository.getCachedExerciseByIdSync(exerciseId);
    if (cached) {
      setExercise(cached);
      setLoading(false);
    } else {
      setExercise(null);
      setLoading(true);
    }

    async function loadExerciseDetail() {
      try {
        const fetched = await exerciseRepository.getExerciseById(exerciseId!);
        if (!isMounted) return;
        if (fetched) {
          setExercise(fetched);
          setLoadFailed(false);
        } else if (!cached) {
          setExercise(null);
          setLoadFailed(true);
        }
      } catch {
        if (!isMounted) return;
        if (!cached) {
          setExercise(null);
          setLoadFailed(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadExerciseDetail();

    return () => {
      isMounted = false;
    };
  }, [visible, exerciseId]);

  if (!visible) {
    return null;
  }

  // Media priority matches app/exercises/[id].tsx:
  // 1. User's custom photo for custom exercises
  // 2. Approved curated demonstration
  // 3. Provider main image fallback
  const customPhotoUri =
    exercise?.isCustom && hasCustomPhoto(exercise) ? getCustomPhotoUri(exercise) : null;

  const curatedResolution =
    exercise && !exercise.isCustom ? resolveExerciseDemonstration(exercise) : null;

  const approvedCuratedDemo =
    curatedResolution?.status === 'approved' ? curatedResolution.demonstration : null;

  const rawProviderImage =
    exercise &&
    !customPhotoUri &&
    !approvedCuratedDemo &&
    Array.isArray(exercise.images) &&
    exercise.images.length > 0
      ? exercise.images.find((img) => img.isMain) || exercise.images[0]
      : null;

  const displayImageUri = !imageError
    ? customPhotoUri ||
      approvedCuratedDemo?.demonstrationUri ||
      approvedCuratedDemo?.thumbnailUri ||
      rawProviderImage?.url ||
      null
    : null;

  const primaryMusclesText =
    exercise?.primaryMuscles && exercise.primaryMuscles.length > 0
      ? exercise.primaryMuscles.map((m) => m.name).join(', ')
      : null;

  const secondaryMusclesText =
    exercise?.secondaryMuscles && exercise.secondaryMuscles.length > 0
      ? exercise.secondaryMuscles.map((m) => m.name).join(', ')
      : null;

  const equipmentList =
    exercise?.equipment && exercise.equipment.length > 0
      ? exercise.equipment.map((e) => e.name)
      : [];

  const equipmentText = equipmentList.length > 0 ? equipmentList.join(', ') : null;
  const hasInfoRows = Boolean(primaryMusclesText || secondaryMusclesText || equipmentText);
  const rawDescription = exercise?.description?.trim() || '';
  const instructionSteps = rawDescription
    ? rawDescription
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : [];

  const titleText = exercise?.name || fallbackExerciseName || 'Exercise Details';

  const sheetBody = (
    <View style={styles.backdropContainer} testID="exercise-detail-modal">
      <Pressable
        testID="exercise-detail-modal-backdrop"
        style={styles.backdropDismissArea}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close exercise details"
      />

      <View style={styles.sheetContainer}>
        {/* Grabber & Sticky Header */}
        <View style={styles.sheetGrabber} />
        <View style={styles.sheetHeader}>
          <View style={styles.headerTitleCol}>
            <View style={styles.badgeRow}>
              {exercise?.categoryName ? (
                <View style={styles.categoryBadge} testID="exercise-detail-modal-category">
                  <Text variant="caption" color="accent" style={styles.badgeText}>
                    {exercise.categoryName.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {exercise?.isCustom ? (
                <View style={styles.customBadge} testID="exercise-detail-modal-custom-badge">
                  <Text variant="caption" color="accent" style={styles.badgeText}>
                    CUSTOM
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              variant="titleLarge"
              color="primary"
              numberOfLines={2}
              style={styles.headerTitle}
              testID="exercise-detail-modal-name"
            >
              {titleText}
            </Text>
          </View>

          <Pressable
            testID="close-exercise-detail-modal"
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close exercise details"
          >
            <Icon name="close" size={18} strokeWidth={2.5} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ErrorBoundary
          testID="exercise-detail-modal-error-boundary"
          fallbackTitle="Could not display exercise details"
          fallbackMessage="Your active workout is safe. Close this sheet to continue logging."
        >
          <ScrollView
            testID="exercise-detail-modal-scroll"
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.stateContainer} testID="exercise-detail-modal-loading">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text variant="caption" color="muted">
                  Loading exercise details...
                </Text>
              </View>
            ) : !exercise || loadFailed ? (
              <Card style={styles.emptyCard} testID="exercise-detail-modal-fallback">
                <Text variant="titleMedium" color="primary">
                  Details Unavailable
                </Text>
                <Text variant="body" color="muted" style={styles.emptyText}>
                  Full details for {titleText} are currently unavailable offline or this custom exercise was removed. Your active workout sets remain unaffected.
                </Text>
              </Card>
            ) : (
              <>
                {/* Safe Single Visual / Photo Preview */}
                {displayImageUri ? (
                  <View style={styles.mediaWrapper}>
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: displayImageUri }}
                        style={styles.exerciseImage}
                        resizeMode="contain"
                        testID="exercise-detail-modal-image"
                        onError={() => setImageError(true)}
                        {...(Platform.OS === 'web'
                          ? ({ decoding: 'async' } as Record<string, unknown>)
                          : {})}
                      />
                    </View>
                    {approvedCuratedDemo ? (
                      <Text variant="caption" color="muted" style={styles.attributionText}>
                        Demonstration: {approvedCuratedDemo.license.author} •{' '}
                        {approvedCuratedDemo.license.type}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Equipment Chips */}
                {equipmentList.length > 0 ? (
                  <View style={styles.equipmentChipRow} testID="exercise-detail-modal-equipment-badges">
                    {equipmentList.map((eq) => (
                      <View key={eq} style={styles.equipmentChip}>
                        <Icon name="dumbbell" size={11} strokeWidth={2.2} color={colors.primary} />
                        <Text variant="caption" style={styles.equipmentChipText}>
                          {eq}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Anatomy & Equipment Card */}
                {hasInfoRows ? (
                  <Card style={styles.infoCard}>
                    {primaryMusclesText ? (
                      <View
                        style={[
                          styles.infoRow,
                          !secondaryMusclesText && !equipmentText && styles.noBorder,
                        ]}
                      >
                        <Text variant="label" color="muted">
                          PRIMARY MUSCLES
                        </Text>
                        <Text
                          variant="bodyBold"
                          color="primary"
                          testID="exercise-detail-modal-primary-muscles"
                        >
                          {primaryMusclesText}
                        </Text>
                      </View>
                    ) : null}

                    {secondaryMusclesText ? (
                      <View style={[styles.infoRow, !equipmentText && styles.noBorder]}>
                        <Text variant="label" color="muted">
                          SECONDARY MUSCLES
                        </Text>
                        <Text
                          variant="body"
                          color="secondary"
                          testID="exercise-detail-modal-secondary-muscles"
                        >
                          {secondaryMusclesText}
                        </Text>
                      </View>
                    ) : null}

                    {equipmentText ? (
                      <View style={[styles.infoRow, styles.noBorder]}>
                        <Text variant="label" color="muted">
                          EQUIPMENT
                        </Text>
                        <Text
                          variant="bodyBold"
                          color="accent"
                          testID="exercise-detail-modal-equipment"
                        >
                          {equipmentText}
                        </Text>
                      </View>
                    ) : null}
                  </Card>
                ) : null}

                {/* Step-by-Step Form Instructions */}
                <Card style={styles.instructionsCard}>
                  <Text variant="titleMedium" color="primary" style={styles.instructionsTitle}>
                    {exercise.isCustom ? 'Notes & Form' : 'Instructions & Form'}
                  </Text>
                  {instructionSteps.length > 1 ? (
                    <View style={styles.stepsList} testID="exercise-detail-modal-instructions">
                      {instructionSteps.map((step, index) => (
                        <View key={`${index}_${step.slice(0, 12)}`} style={styles.stepRow}>
                          <View style={styles.stepIndexBadge}>
                            <Text variant="caption" style={styles.stepIndexText}>
                              {index + 1}
                            </Text>
                          </View>
                          <Text variant="body" color="secondary" style={styles.stepText}>
                            {step}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : rawDescription ? (
                    <Text
                      variant="body"
                      color="secondary"
                      style={styles.instructionsText}
                      testID="exercise-detail-modal-instructions"
                    >
                      {rawDescription}
                    </Text>
                  ) : (
                    <Text
                      variant="body"
                      color="muted"
                      style={styles.instructionsText}
                      testID="exercise-detail-modal-instructions-empty"
                    >
                      No form instructions recorded for this exercise yet.
                    </Text>
                  )}
                </Card>
              </>
            )}

            <Button
              testID="exercise-detail-modal-done-button"
              title="Back to Workout"
              onPress={onClose}
              variant="secondary"
              size="md"
              style={styles.doneButton}
            />
          </ScrollView>
        </ErrorBoundary>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View testID="exercise-detail-web-overlay" style={styles.webOverlay}>
        {sheetBody}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {sheetBody}
    </Modal>
  );
}

const createStyles = (colors: DetailModalColors, insets: { bottom: number }) =>
  StyleSheet.create({
    webOverlay: {
      position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      width: '100%',
      height: (Platform.OS === 'web' ? '100dvh' : '100%') as '100%',
      maxHeight: (Platform.OS === 'web' ? '100dvh' : '100%') as '100%',
      overflow: 'hidden',
    },
    backdropContainer: {
      flex: 1,
      backgroundColor: 'rgba(2, 6, 23, 0.72)',
      justifyContent: 'flex-end',
    },
    backdropDismissArea: {
      flex: 1,
    },
    sheetContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderTopWidth: 1,
      borderColor: colors.borderLight,
      maxHeight: '88%',
      paddingTop: spacing.xs + 2,
      paddingBottom: Math.max(insets.bottom, spacing.md),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 10,
    },
    sheetGrabber: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      gap: spacing.sm,
    },
    headerTitleCol: {
      flex: 1,
      gap: 4,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    categoryBadge: {
      backgroundColor: 'rgba(56, 189, 248, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.30)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    customBadge: {
      backgroundColor: 'rgba(16, 185, 129, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.32)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    headerTitle: {
      fontWeight: '800',
      fontSize: 20,
      lineHeight: 26,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    scrollView: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    stateContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    emptyCard: {
      gap: spacing.xs,
    },
    emptyText: {
      lineHeight: 20,
    },
    mediaWrapper: {
      width: '100%',
      gap: 6,
    },
    imageContainer: {
      width: '100%',
      height: 200,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    exerciseImage: {
      width: '100%',
      height: '100%',
    },
    attributionText: {
      fontSize: 11,
      textAlign: 'center',
    },
    equipmentChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    equipmentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: radii.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    equipmentChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    infoCard: {
      gap: 0,
      paddingVertical: spacing.xs,
    },
    infoRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      gap: 3,
    },
    noBorder: {
      borderBottomWidth: 0,
    },
    instructionsCard: {
      gap: spacing.sm,
    },
    instructionsTitle: {
      fontWeight: '700',
    },
    instructionsText: {
      lineHeight: 22,
    },
    stepsList: {
      gap: spacing.sm,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    stepIndexBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(56, 189, 248, 0.14)',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
      flexShrink: 0,
    },
    stepIndexText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    stepText: {
      flex: 1,
      lineHeight: 21,
    },
    doneButton: {
      marginTop: spacing.xs,
    },
  });
