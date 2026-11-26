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
import { Card, Text, Icon, SyncStatusChip } from '../../../components/ui';
import type { IconName } from '../../../components/ui';
import { Exercise } from '../types';
import { ExerciseThumbnail } from './ExerciseThumbnail';
import { spacing, radii } from '../../../constants/theme';
import { useEntitySyncStatus } from '../../../services/sync';

function getCategoryBadgeIcon(category?: string, isCustom?: boolean): IconName {
  if (isCustom) return 'dumbbell';
  switch ((category || '').toLowerCase()) {
    case 'cardio':
      return 'flame';
    case 'core':
    case 'abs':
      return 'bolt';
    case 'legs':
    case 'back':
    case 'chest':
    case 'shoulders':
    case 'arms':
      return 'dumbbell';
    default:
      return 'workout';
  }
}

function CustomExerciseSyncStatus({ exerciseId }: { exerciseId: string }) {
  const status = useEntitySyncStatus('custom_exercise', exerciseId);
  return <SyncStatusChip status={status} />;
}

export interface ExerciseCardProps {
  exercise: Exercise;
  onPress: (exercise: Exercise) => void;
  onRename?: (exercise: Exercise) => void;
  mode?: 'browse' | 'select';
  isSelected?: boolean;
  isAlreadyAdded?: boolean;
  isMultiSelect?: boolean;
  hideThumbnail?: boolean;
  testID?: string;
  thumbnailTestID?: string;
  recentLabel?: string;
  recentLabelTestID?: string;
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
  if (prev.exercise?.id !== next.exercise?.id) return false;
  if (prev.mode !== next.mode) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isAlreadyAdded !== next.isAlreadyAdded) return false;
  if (prev.isMultiSelect !== next.isMultiSelect) return false;
  if (prev.hideThumbnail !== next.hideThumbnail) return false;
  if (prev.onPress !== next.onPress) return false;
  if (prev.onRename !== next.onRename) return false;
  if (prev.testID !== next.testID) return false;
  if (prev.thumbnailTestID !== next.thumbnailTestID) return false;
  if (prev.recentLabel !== next.recentLabel) return false;
  if (prev.recentLabelTestID !== next.recentLabelTestID) return false;
  if (prev.exercise?.name !== next.exercise?.name) return false;
  if (prev.exercise?.photoPath !== next.exercise?.photoPath) return false;
  if (prev.exercise?.images?.[0]?.url !== next.exercise?.images?.[0]?.url) return false;
  return true;
}

export const ExerciseCard = React.memo(function ExerciseCard({
  exercise,
  onPress,
  onRename,
  mode = 'browse',
  isSelected = false,
  isAlreadyAdded = false,
  isMultiSelect = false,
  hideThumbnail = false,
  testID,
  thumbnailTestID,
  recentLabel,
  recentLabelTestID,
}: ExerciseCardProps) {
  const { colors } = useAppTheme();
  const styles = getCardStyles(colors);

  const equipmentText =
    Array.isArray(exercise?.equipment) && exercise.equipment.length > 0
      ? exercise.equipment
          .map((e) => (typeof e === 'string' ? e : e?.name || ''))
          .filter(Boolean)
          .join(', ') || 'Bodyweight'
      : 'Bodyweight';

  const muscleText =
    Array.isArray(exercise?.primaryMuscles) && exercise.primaryMuscles.length > 0
      ? exercise.primaryMuscles
          .map((m) => (typeof m === 'string' ? m : m?.name || ''))
          .filter(Boolean)
          .join(', ') || 'Full Body'
      : 'Full Body';

  const exerciseId = exercise?.id || 'unknown';
  const exerciseName = exercise?.name || 'Unnamed Movement';
  const categoryName = exercise?.categoryName || 'General';

  const itemTestId = testID || (mode === 'browse' ? `exercise-item-${exerciseId}` : `picker-exercise-${exerciseId}`);
  const addedBadgeTestId = testID
    ? testID.replace('-exercise-', '-added-badge-')
    : `picker-added-badge-${exerciseId}`;
  const checkboxTestId = testID
    ? testID.replace('-exercise-', '-checkbox-')
    : `picker-checkbox-${exerciseId}`;

  return (
    <Pressable
      testID={itemTestId}
      disabled={isAlreadyAdded}
      onPress={() => exercise && onPress(exercise)}
      style={[styles.cardPressable, isAlreadyAdded && styles.cardDisabled]}
    >
      <Card
        style={[
          styles.exerciseCard,
          isSelected ? styles.exerciseCardSelected : null,
        ]}
      >
        <View style={styles.cardHeader}>
          {hideThumbnail ? (
            <View
              testID={thumbnailTestID || `${itemTestId}-badge`}
              style={[
                styles.vectorBadge,
                exercise?.isCustom ? styles.vectorBadgeCustom : null,
              ]}
            >
              <Icon
                name={getCategoryBadgeIcon(exercise?.category, exercise?.isCustom)}
                size={18}
                strokeWidth={2}
                color={exercise?.isCustom ? colors.primary : colors.textSecondary}
              />
            </View>
          ) : (
            <ExerciseThumbnail
              exercise={exercise}
              size={42}
              testID={thumbnailTestID || `${itemTestId}-thumbnail`}
            />
          )}

          <View style={styles.titleContainer}>
            <View style={styles.titleWithBadge}>
              <Text
                variant="bodyBold"
                color={isAlreadyAdded ? 'muted' : isSelected ? 'accent' : 'primary'}
                numberOfLines={1}
                style={styles.cardTitle}
              >
                {exerciseName}
              </Text>
              {exercise?.isCustom && (
                <View style={styles.customBadge} testID="custom-badge">
                  <Text variant="caption" color="accent" style={styles.customBadgeText}>
                    CUSTOM
                  </Text>
                </View>
              )}
            </View>

            <Text variant="caption" color="secondary" numberOfLines={1}>
              {categoryName} • {equipmentText}
            </Text>
          </View>

          {/* Right Action Area */}
          {mode === 'browse' ? (
            <View style={styles.browseActionRow}>
              {exercise?.isCustom && <CustomExerciseSyncStatus exerciseId={exerciseId} />}
              {onRename ? (
                <Pressable
                  testID={`rename-exercise-${exerciseId}`}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    onRename(exercise);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Rename ${exerciseName}`}
                  style={{ padding: 4 }}
                >
                  <Icon name="edit" size={16} strokeWidth={2.1} color={colors.textMuted} />
                </Pressable>
              ) : null}
              <Icon name="chevronRight" size={18} strokeWidth={2.2} color={colors.textMuted} />
            </View>
          ) : (
            <View style={styles.rightActionColumn}>
              {recentLabel ? (
                <Text
                  variant="caption"
                  color="muted"
                  testID={recentLabelTestID}
                  style={styles.recentLabelText}
                >
                  {recentLabel}
                </Text>
              ) : null}
              {isAlreadyAdded ? (
                <View style={styles.addedBadge} testID={addedBadgeTestId}>
                  <Text variant="caption" color="muted" style={styles.badgeText}>
                    ADDED
                  </Text>
                </View>
              ) : isMultiSelect ? (
                <View
                  testID={checkboxTestId}
                  style={[
                    styles.checkboxContainer,
                    isSelected ? styles.checkboxSelected : styles.checkboxUnselected,
                  ]}
                >
                  {isSelected ? (
                    <>
                      <Icon name="check" size={16} strokeWidth={3} color={colors.primaryText} />
                      <Text style={styles.hiddenTestText}>✓</Text>
                    </>
                  ) : null}
                </View>
              ) : (
                <View style={styles.selectBadge}>
                  <Text variant="caption" color="primary" style={styles.badgeText}>
                    + ADD
                  </Text>
                </View>
              )}
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
    vectorBadge: {
      width: 42,
      height: 42,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceSubtle,
      borderColor: colors.borderLight,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    vectorBadgeCustom: {
      backgroundColor: 'rgba(0, 229, 153, 0.08)',
      borderColor: 'rgba(0, 229, 153, 0.35)',
    },
    titleContainer: {
      flex: 1,
      gap: 2,
    },
    titleWithBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      lineHeight: 20,
      flexShrink: 1,
    },
    customBadge: {
      flexShrink: 0,
      backgroundColor: 'rgba(0, 229, 153, 0.12)',
      borderColor: colors.primary,
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radii.xs,
    },
    customBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.primary,
    },
    browseActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    rightActionColumn: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 4,
      flexShrink: 0,
    },
    recentLabelText: {
      fontSize: 11,
      lineHeight: 14,
    },
    hiddenTestText: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0,
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
