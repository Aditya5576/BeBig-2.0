/**
 * BeBig 2.0 — Canonical Unified Exercise Card
 *
 * Ground-truth unified exercise presentation card shared identically across:
 * 1. Exercises Tab Library (`app/exercises/index.tsx`)
 * 2. Ongoing Workout Picker Modal (`src/features/templates/components/ExercisePickerModal.tsx`)
 * 3. Workout Template Picker Modals
 *
 * Guarantees visual and functional consistency:
 * - Identical thumbnail sizing and fallbacks
 * - Title and category styling
 * - Standardized equipment tags
 * - Primary muscle group highlights
 * - Context-aware selection/action controls (Browse navigation vs Picker multi-select / add)
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../../theme';
import { Card, Text } from '../../../components/ui';
import { Exercise } from '../types';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { spacing, radii } from '../../../constants/theme';
import { useEntitySyncStatus } from '../../../services/sync';
import { SyncStatusChip } from '../../../components/ui';

function CustomExerciseSyncStatus({ exerciseId }: { exerciseId: string }) {
  const status = useEntitySyncStatus('custom_exercise', exerciseId);
  return <SyncStatusChip status={status} />;
}

export interface ExerciseCardProps {
  exercise: Exercise;
  onPress: (exercise: Exercise) => void;
  mode?: 'browse' | 'select';
  isSelected?: boolean;
  isAlreadyAdded?: boolean;
  isMultiSelect?: boolean;
  testID?: string;
  thumbnailTestID?: string;
}

const stylesMap = new Map<any, ReturnType<typeof createStyles>>();
function getCardStyles(colors: any) {
  let s = stylesMap.get(colors);
  if (!s) {
    s = createStyles(colors);
    stylesMap.set(colors, s);
  }
  return s;
}

function areExerciseCardPropsEqual(prev: ExerciseCardProps, next: ExerciseCardProps): boolean {
  if (prev.exercise.id !== next.exercise.id) return false;
  if (prev.mode !== next.mode) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isAlreadyAdded !== next.isAlreadyAdded) return false;
  if (prev.isMultiSelect !== next.isMultiSelect) return false;
  if (prev.onPress !== next.onPress) return false;
  if (prev.testID !== next.testID) return false;
  if (prev.thumbnailTestID !== next.thumbnailTestID) return false;
  if (prev.exercise.name !== next.exercise.name) return false;
  if (prev.exercise.photoPath !== next.exercise.photoPath) return false;
  if (prev.exercise.images?.[0]?.url !== next.exercise.images?.[0]?.url) return false;
  return true;
}

export const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  onPress,
  mode = 'browse',
  isSelected = false,
  isAlreadyAdded = false,
  isMultiSelect = false,
  testID,
  thumbnailTestID,
}: ExerciseCardProps) {
  const { colors } = useAppTheme();
  const styles = getCardStyles(colors);

  const equipmentText =
    exercise.equipment && exercise.equipment.length > 0
      ? exercise.equipment.map((e) => e.name).join(', ')
      : 'Bodyweight';

  const muscleText =
    exercise.primaryMuscles && exercise.primaryMuscles.length > 0
      ? exercise.primaryMuscles.map((m) => m.name).join(', ')
      : 'Full Body';

  const itemTestId = testID || (mode === 'browse' ? `exercise-item-${exercise.id}` : `picker-exercise-${exercise.id}`);

  return (
    <Pressable
      testID={itemTestId}
      disabled={isAlreadyAdded}
      onPress={() => onPress(exercise)}
      style={[styles.cardPressable, isAlreadyAdded && styles.cardDisabled]}
    >
      <Card
        style={[
          styles.exerciseCard,
          isSelected ? styles.exerciseCardSelected : null,
        ]}
      >
        <View style={styles.cardHeader}>
          <ExerciseThumbnail
            exercise={exercise}
            size={42}
            testID={thumbnailTestID || `${itemTestId}-thumbnail`}
          />

          <View style={styles.titleContainer}>
            <View style={styles.titleWithBadge}>
              <Text
                variant="bodyBold"
                color={isAlreadyAdded ? 'muted' : isSelected ? 'accent' : 'primary'}
                numberOfLines={1}
                style={styles.cardTitle}
              >
                {exercise.name}
              </Text>
              {exercise.isCustom && (
                <View style={styles.customBadge} testID="custom-badge">
                  <Text variant="caption" color="accent" style={styles.customBadgeText}>
                    CUSTOM
                  </Text>
                </View>
              )}
            </View>

            <Text variant="caption" color="secondary" numberOfLines={1}>
              {exercise.categoryName} • {equipmentText}
            </Text>
          </View>

          {/* Right Action Area */}
          {mode === 'browse' ? (
            <View style={styles.browseActionRow}>
              {exercise.isCustom && <CustomExerciseSyncStatus exerciseId={exercise.id} />}
              <Text variant="titleMedium" color="muted" style={styles.chevron}>
                ›
              </Text>
            </View>
          ) : isAlreadyAdded ? (
            <View style={styles.addedBadge} testID={`picker-added-badge-${exercise.id}`}>
              <Text variant="caption" color="muted" style={styles.badgeText}>
                ADDED
              </Text>
            </View>
          ) : isMultiSelect ? (
            <View
              testID={`picker-checkbox-${exercise.id}`}
              style={[
                styles.checkboxContainer,
                isSelected ? styles.checkboxSelected : styles.checkboxUnselected,
              ]}
            >
              {isSelected ? <Text style={styles.checkIcon}>✓</Text> : null}
            </View>
          ) : (
            <View style={styles.selectBadge}>
              <Text variant="caption" color="primary" style={styles.badgeText}>
                + ADD
              </Text>
            </View>
          )}
        </View>

        {/* Standardized Muscle Group Row across both Library and Picker */}
        <View style={styles.muscleRow}>
          <Text variant="caption" color="muted">
            Target:{' '}
            <Text variant="caption" color="accent" style={styles.muscleHighlight}>
              {muscleText}
            </Text>
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}, areExerciseCardPropsEqual);

const createStyles = (colors: any) =>
  StyleSheet.create({
    cardPressable: {
      marginBottom: spacing.xs + 2,
    },
    cardDisabled: {
      opacity: 0.5,
    },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.xs + 2,
    },
    exerciseCardSelected: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(56, 189, 248, 0.08)',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    titleContainer: {
      flex: 1,
      gap: 2,
    },
    titleWithBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexWrap: 'wrap',
    },
    cardTitle: {
      lineHeight: 20,
    },
    customBadge: {
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      borderColor: colors.success,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radii.xs,
    },
    customBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.success,
    },
    browseActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    chevron: {
      fontSize: 18,
      marginLeft: 4,
    },
    addedBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.sm,
      minWidth: 56,
      alignItems: 'center',
    },
    selectBadge: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primary,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.sm,
      minWidth: 56,
      alignItems: 'center',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    checkboxContainer: {
      width: 28,
      height: 28,
      borderRadius: radii.full,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    checkboxUnselected: {
      borderWidth: 2,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceSubtle,
    },
    checkboxSelected: {
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    checkIcon: {
      color: colors.background,
      fontSize: 15,
      fontWeight: '900',
    },
    muscleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 2,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    muscleHighlight: {
      fontWeight: '600',
    },
  });
