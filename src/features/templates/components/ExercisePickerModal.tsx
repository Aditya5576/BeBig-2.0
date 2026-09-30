import { useAppTheme } from '../../theme';
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer, Text, Button, Card } from '../../../components/ui';
import {
  exerciseRepository,
  exerciseCacheStorage,
  Exercise,
  ExerciseCategory,
  STANDARD_CATEGORIES,
  STANDARD_EQUIPMENT,
} from '../../exercises';
import { spacing, radii } from '../../../constants/theme';

export interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  selectedExerciseIds?: string[];
}

export function ExercisePickerModal({
  visible,
  onClose,
  onSelectExercise,
  selectedExerciseIds = [],
}: ExercisePickerModalProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    // Fallback if rendered outside SafeAreaProvider
  }

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'custom' | 'external'>('all');

  // Custom exercise creation state inside picker
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<ExerciseCategory>('chest');
  const [customEquipment, setCustomEquipment] = useState('Barbell');
  const [customSaving, setCustomSaving] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setIsCreatingCustom(false);
      setCustomName('');
      setCustomError(null);
      return;
    }

    let isMounted = true;

    async function loadExercises() {
      // Instant local cache check first to avoid blocking user during weak network / offline
      const cachedInitial = exerciseRepository.getCachedExercises({
        query: searchQuery.trim() || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        source: selectedSource,
        limit: 30,
      });

      if (cachedInitial.length > 0) {
        setExercises(cachedInitial);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const result = await exerciseRepository.getExercises({
          query: searchQuery.trim() || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          source: selectedSource,
          limit: 30,
        });

        if (isMounted) {
          setExercises(result.exercises);
        }
      } catch {
        if (isMounted && cachedInitial.length === 0) {
          const cachedFallback = exerciseRepository.getCachedExercises({
            query: searchQuery.trim() || undefined,
            category: selectedCategory !== 'all' ? selectedCategory : undefined,
            source: selectedSource,
            limit: 30,
          });
          setExercises(cachedFallback);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadExercises();

    return () => {
      isMounted = false;
    };
  }, [visible, searchQuery, selectedCategory, selectedSource]);

  const handleCreateCustomExercise = async () => {
    const trimmed = customName.trim();
    if (!trimmed) {
      setCustomError('Exercise name is required.');
      return;
    }

    setCustomSaving(true);
    setCustomError(null);

    try {
      const created = await exerciseRepository.createCustomExercise({
        name: trimmed,
        category: customCategory,
        equipment: customEquipment ? [customEquipment] : [],
        primaryMuscles: ['General'],
      });

      setCustomName('');
      setIsCreatingCustom(false);
      setCustomSaving(false);

      // Auto select newly created custom exercise for active workout session
      onSelectExercise(created);
      onClose();
    } catch (err: any) {
      setCustomError(err?.message || 'Failed to create custom exercise.');
      setCustomSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Exercise }) => {
    const isAlreadyAdded = selectedExerciseIds.includes(item.id);

    return (
      <Pressable
        testID={`picker-exercise-${item.id}`}
        disabled={isAlreadyAdded}
        onPress={() => {
          onSelectExercise(item);
          onClose();
        }}
        style={[styles.cardPressable, isAlreadyAdded && styles.cardDisabled]}
      >
        <Card style={styles.exerciseCard}>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Text
                variant="bodyBold"
                color={isAlreadyAdded ? 'muted' : 'primary'}
                numberOfLines={2}
                style={styles.cardTitle}
              >
                {item.name}
              </Text>
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {item.categoryName}
              </Text>
            </View>

            {isAlreadyAdded ? (
              <View style={styles.addedBadge}>
                <Text variant="caption" color="muted" style={styles.badgeText}>
                  ADDED
                </Text>
              </View>
            ) : item.isCustom ? (
              <View style={styles.customBadge}>
                <Text variant="caption" color="accent" style={styles.badgeText}>
                  CUSTOM
                </Text>
              </View>
            ) : (
              <View style={styles.selectBadge}>
                <Text variant="caption" color="primary" style={styles.badgeText}>
                  + ADD
                </Text>
              </View>
            )}
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenContainer style={[styles.container, { paddingTop: Math.max(insets.top, spacing.xs) }]}>
        {isCreatingCustom ? (
          /* Custom Exercise Creation Form View */
          <ScrollView
            contentContainerStyle={styles.createFormContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerTitleRow}>
              <Text variant="titleMedium" color="primary" style={styles.modalTitle}>
                New Custom Exercise
              </Text>
              <Button
                testID="custom-exercise-cancel-button"
                title="Cancel"
                onPress={() => setIsCreatingCustom(false)}
                variant="ghost"
                size="sm"
                style={styles.closeButton}
              />
            </View>

            {customError ? (
              <Card style={styles.errorCard} testID="custom-exercise-error">
                <Text variant="caption" color="primary">
                  {customError}
                </Text>
              </Card>
            ) : null}

            <View style={styles.formGroup}>
              <Text variant="label" color="secondary">
                EXERCISE NAME *
              </Text>
              <TextInput
                testID="custom-exercise-name-input"
                style={styles.searchInput}
                placeholder="e.g. Cable Lateral Raise"
                placeholderTextColor={colors.textMuted}
                value={customName}
                onChangeText={setCustomName}
                autoFocus
              />
            </View>

            <View style={styles.formGroup}>
              <Text variant="label" color="secondary">
                TARGET CATEGORY *
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {STANDARD_CATEGORIES.map((cat) => {
                  const isSelected = customCategory === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      testID={`category-select-${cat.id}`}
                      onPress={() => setCustomCategory(cat.id)}
                      style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                    >
                      <Text
                        variant="caption"
                        color={isSelected ? 'accent' : 'secondary'}
                        style={styles.chipText}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text variant="label" color="secondary">
                EQUIPMENT
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {STANDARD_EQUIPMENT.map((eq) => {
                  const isSelected = customEquipment === eq;
                  return (
                    <Pressable
                      key={eq}
                      testID={`equipment-select-${eq}`}
                      onPress={() => setCustomEquipment(eq)}
                      style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                    >
                      <Text
                        variant="caption"
                        color={isSelected ? 'accent' : 'secondary'}
                        style={styles.chipText}
                      >
                        {eq}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <Button
              testID="save-custom-exercise-button"
              title="Create & Add to Workout"
              onPress={handleCreateCustomExercise}
              variant="primary"
              size="lg"
              loading={customSaving}
              style={styles.createSubmitButton}
            />
          </ScrollView>
        ) : (
          /* Exercise Picker List View */
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Text variant="titleMedium" color="primary" style={styles.modalTitle} numberOfLines={1}>
                  Select Exercise
                </Text>
                <Button
                  testID="picker-create-custom-button"
                  title="+ Custom"
                  onPress={() => setIsCreatingCustom(true)}
                  variant="outline"
                  size="sm"
                  style={styles.createTriggerButton}
                />
                <Button
                  testID="picker-close-button"
                  title="Cancel"
                  onPress={onClose}
                  variant="ghost"
                  size="sm"
                  style={styles.closeButton}
                />
              </View>

              {/* Search Input */}
              <TextInput
                testID="picker-search-input"
                style={styles.searchInput}
                placeholder="Search exercise library..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />

              {/* Source Filter Chips */}
              <View style={styles.sourceRow} testID="picker-source-filter-row">
                {(['all', 'custom', 'external'] as const).map((src) => {
                  const isActive = selectedSource === src;
                  const label = src === 'all' ? 'All' : src === 'custom' ? 'Custom' : 'External';
                  return (
                    <Pressable
                      key={src}
                      testID={`picker-source-filter-${src}`}
                      onPress={() => setSelectedSource(src)}
                      style={[styles.sourceChip, isActive && styles.sourceChipActive]}
                    >
                      <Text
                        variant="caption"
                        color={isActive ? 'accent' : 'secondary'}
                        style={styles.chipText}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Category Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                <Pressable
                  testID="picker-category-filter-all"
                  onPress={() => setSelectedCategory('all')}
                  style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
                >
                  <Text
                    variant="caption"
                    color={selectedCategory === 'all' ? 'accent' : 'secondary'}
                    style={styles.chipText}
                  >
                    All
                  </Text>
                </Pressable>

                {STANDARD_CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      testID={`picker-category-filter-${cat.id}`}
                      onPress={() => setSelectedCategory(cat.id)}
                      style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    >
                      <Text
                        variant="caption"
                        color={isActive ? 'accent' : 'secondary'}
                        style={styles.chipText}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Content */}
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : exercises.length === 0 ? (
              <View style={styles.centerContainer}>
                <Text variant="body" color="muted" style={{ marginBottom: spacing.md }}>
                  No exercises found.
                </Text>
                <Button
                  testID="picker-create-custom-empty-button"
                  title="+ Create Custom Exercise"
                  onPress={() => setIsCreatingCustom(true)}
                  variant="primary"
                  size="md"
                />
              </View>
            ) : (
              <FlatList
                testID="picker-exercise-list"
                data={exercises}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              />
            )}
          </>
        )}
      </ScreenContainer>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      paddingTop: spacing.xs,
    },
    header: {
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      paddingBottom: spacing.sm,
    },
    headerTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.xs,
    },
    modalTitle: {
      flex: 1,
    },
    closeButton: {
      minHeight: 36,
      paddingHorizontal: spacing.sm,
      flexShrink: 0,
    },
    createTriggerButton: {
      minHeight: 36,
      paddingHorizontal: spacing.sm,
      flexShrink: 0,
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      color: colors.textPrimary,
      fontSize: 16,
    },
    sourceRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    sourceChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    sourceChipActive: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primary,
    },
    categoryScroll: {
      gap: spacing.xs,
    },
    categoryChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    categoryChipActive: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primary,
    },
    chipText: {
      fontWeight: '600',
    },
    listContent: {
      paddingVertical: spacing.md,
      paddingBottom: spacing.xxl + spacing.lg,
      gap: spacing.sm,
    },
    cardPressable: {
      marginBottom: spacing.xs,
    },
    cardDisabled: {
      opacity: 0.5,
    },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    titleContainer: {
      flex: 1,
      gap: 2,
      marginRight: spacing.xs,
    },
    cardTitle: {
      lineHeight: 20,
    },
    addedBadge: {
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.sm,
      flexShrink: 0,
      minWidth: 56,
      alignItems: 'center',
    },
    customBadge: {
      backgroundColor: '#1E2C1A',
      borderColor: colors.success,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.sm,
      flexShrink: 0,
      minWidth: 64,
      alignItems: 'center',
    },
    selectBadge: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primary,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.sm,
      flexShrink: 0,
      minWidth: 56,
      alignItems: 'center',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    createFormContent: {
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    formGroup: {
      gap: spacing.xs,
    },
    createSubmitButton: {
      marginTop: spacing.md,
    },
    errorCard: {
      backgroundColor: '#3D1E1E',
      borderColor: colors.error,
      padding: spacing.sm,
    },
  });
