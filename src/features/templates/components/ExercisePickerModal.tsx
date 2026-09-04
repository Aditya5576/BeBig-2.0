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
import { ScreenContainer, Text, Button, Card } from '../../../components/ui';
import { exerciseRepository, Exercise, STANDARD_CATEGORIES } from '../../exercises';
import { colors, spacing, radii } from '../../../constants/theme';

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
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (!visible) return;

    let isMounted = true;

    async function loadExercises() {
      setLoading(true);
      try {
        const result = await exerciseRepository.getExercises({
          query: searchQuery.trim() || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          limit: 30,
        });

        if (isMounted) {
          setExercises(result.exercises);
        }
      } catch {
        if (isMounted) {
          setExercises([]);
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
  }, [visible, searchQuery, selectedCategory]);

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
      <ScreenContainer style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text variant="titleMedium" color="primary" style={styles.modalTitle} numberOfLines={1}>
              Select Exercise
            </Text>
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
            placeholderTextColor={colors.dark.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />

          {/* Category Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            <Pressable
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
            <ActivityIndicator size="large" color={colors.dark.primary} />
          </View>
        ) : exercises.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text variant="body" color="muted">
              No exercises found.
            </Text>
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
      </ScreenContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xs,
  },
  header: {
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
    paddingBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    flex: 1,
  },
  closeButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    flexShrink: 0,
  },
  searchInput: {
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.dark.textPrimary,
    fontSize: 15,
  },
  categoryScroll: {
    gap: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  categoryChipActive: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.primary,
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
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
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
    backgroundColor: colors.dark.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    flexShrink: 0,
    minWidth: 56,
    alignItems: 'center',
  },
  customBadge: {
    backgroundColor: '#1E2C1A',
    borderColor: colors.dark.success,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    flexShrink: 0,
    minWidth: 64,
    alignItems: 'center',
  },
  selectBadge: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.primary,
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
});
