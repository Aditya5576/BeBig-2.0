import { useAppTheme } from '../../theme';
import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer, Text, Button, ErrorBoundary } from '../../../components/ui';
import {
  exerciseRepository,
  Exercise,
  STANDARD_CATEGORIES,
  ExerciseCard,
  CustomExerciseForm,
} from '../../exercises';
import {
  getRecentlyUsedExerciseEntries,
  formatRelativeRecentLabel,
  RecentExerciseEntry,
} from '../../workout/services/recentExercisesService';
import { filterAndRankExercises } from '../../exercises/utils/exerciseSearch';
import { WorkoutSession } from '../../workout/types';
import { spacing, radii } from '../../../constants/theme';

export interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise?: (exercise: Exercise) => void;
  onSelectExercises?: (exercises: Exercise[]) => void;
  selectedExerciseIds?: string[];
  multiSelect?: boolean;
  recentExercises?: Exercise[];
  completedWorkouts?: WorkoutSession[];
  showRecentlyUsed?: boolean;
}

/**
 * Strips heavy inline base64 / remote image payloads from Exercise objects
 * before rendering inside the virtualized picker FlatList so React Fiber and
 * WebKit never hold or diff multi-megabyte image strings in memory (v2.4.3).
 */
export function stripExerciseImagePayloads(exercise: Exercise): Exercise {
  if (!exercise) return exercise;
  const hasImages = Array.isArray(exercise.images) && exercise.images.length > 0;
  const hasLegacyImageUrl = (exercise as any).imageUrl !== undefined;
  if (!hasImages && !hasLegacyImageUrl) {
    return exercise;
  }
  const stripped: any = {
    ...exercise,
    images: [],
  };
  if (hasLegacyImageUrl) {
    stripped.imageUrl = undefined;
  }
  return stripped as Exercise;
}

export const ExercisePickerModal = React.memo(function ExercisePickerModal({
  visible,
  onClose,
  onSelectExercise,
  onSelectExercises,
  selectedExerciseIds = [],
  multiSelect,
  recentExercises: propsRecentExercises,
  completedWorkouts,
  showRecentlyUsed = true,
}: ExercisePickerModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    // Fallback if rendered outside SafeAreaProvider
  }

  // Multi-select is enabled if explicitly specified or if multi-exercise callback is provided
  const isMultiSelect = multiSelect !== undefined ? multiSelect : Boolean(onSelectExercises);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'custom' | 'external' | 'global'>('all');

  // Multi-select state: Map of id -> Exercise, and array of IDs preserving selection order
  const [selectedExercisesMap, setSelectedExercisesMap] = useState<Map<string, Exercise>>(new Map());
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);

  // Custom exercise creation state inside picker
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);

  // Recently used exercises state derived from workout history (Last 2 Weeks)
  const [recentEntriesList, setRecentEntriesList] = useState<RecentExerciseEntry[]>(() =>
    propsRecentExercises
      ? propsRecentExercises.map((exercise) => ({ exercise, lastUsedAt: '' }))
      : [],
  );

  useEffect(() => {
    if (!visible) {
      if (!propsRecentExercises) {
        setRecentEntriesList([]);
      }
      return;
    }

    if (propsRecentExercises) {
      setRecentEntriesList(
        propsRecentExercises.map((exercise) => ({ exercise, lastUsedAt: '' })),
      );
      return;
    }

    if (!showRecentlyUsed) {
      setRecentEntriesList([]);
      return;
    }

    let isMounted = true;
    async function loadRecent() {
      try {
        const recent = await getRecentlyUsedExerciseEntries({
          limit: 10,
          completedWorkouts,
        });
        if (isMounted) {
          setRecentEntriesList(recent);
        }
      } catch {
        if (isMounted) {
          setRecentEntriesList([]);
        }
      }
    }

    void loadRecent();

    return () => {
      isMounted = false;
    };
  }, [visible, propsRecentExercises, completedWorkouts, showRecentlyUsed]);

  // Filter recently used exercises using shared fuzzy/synonym scorer
  const visibleRecentEntries = useMemo(() => {
    if (recentEntriesList.length === 0) return [];

    const sourceFiltered = recentEntriesList.filter(({ exercise: item }) => {
      const isGlobal = Boolean(item.id && (item.id.startsWith('global_ex_') || item.sourceProvider === 'system'));
      if (selectedSource === 'custom' && !item.isCustom) return false;
      if (selectedSource === 'external' && (item.isCustom || isGlobal)) return false;
      if (selectedSource === 'global' && !isGlobal) return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      return true;
    });

    const trimmedQuery = deferredSearchQuery.trim();
    if (!trimmedQuery) {
      return sourceFiltered.map((entry) => ({
        ...entry,
        exercise: stripExerciseImagePayloads(entry.exercise),
      }));
    }

    const entryById = new Map(sourceFiltered.map((e) => [e.exercise.id, e]));
    const ranked = filterAndRankExercises(
      sourceFiltered.map((e) => e.exercise),
      trimmedQuery,
      selectedCategory !== 'all' ? selectedCategory : undefined,
    );

    return ranked.map((ex) => ({
      exercise: stripExerciseImagePayloads(ex),
      lastUsedAt: entryById.get(ex.id)?.lastUsedAt || '',
    }));
  }, [recentEntriesList, selectedSource, selectedCategory, deferredSearchQuery]);

  const cappedRecentEntries = useMemo(
    () => visibleRecentEntries.slice(0, 6),
    [visibleRecentEntries],
  );

  // Lightweight picker projections with image payloads stripped & recent IDs deduplicated
  const lightweightExercises = useMemo(() => {
    const recentIdSet = new Set(cappedRecentEntries.map((entry) => entry.exercise.id));
    return exercises
      .filter((ex) => !recentIdSet.has(ex.id))
      .map(stripExerciseImagePayloads);
  }, [exercises, cappedRecentEntries]);

  // Reset search query & transient state cleanly on every open/close visibility transition
  useEffect(() => {
    setSearchQuery('');
    if (!visible) {
      setExercises([]);
      setLoading(false);
      setSelectedExercisesMap(new Map());
      setSelectionOrder([]);
      setIsCreatingCustom(false);
      setHasMore(false);
      setNextOffset(undefined);
    }
  }, [visible]);

  // Load and filter exercises using deferredSearchQuery so WebKit keystrokes never block main thread
  useEffect(() => {
    if (!visible) {
      return;
    }

    let isMounted = true;

    // Instant local cache check first to avoid blocking user during weak network / offline
    const trimmed = deferredSearchQuery.trim();
    const cachedInitial = exerciseRepository.getCachedExercises({
      query: trimmed || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      source: selectedSource,
    });

    setExercises(cachedInitial);
    if (cachedInitial.length > 0) {
      setLoading(false);
      // If we already have matching exercises in cache for this query, skip the 3.5s WGER network fetch!
      if (trimmed) {
        return;
      }
    } else {
      setLoading(true);
    }

    const timeoutId = setTimeout(
      async () => {
        try {
          const result = await exerciseRepository.getExercises({
            query: trimmed || undefined,
            category: selectedCategory !== 'all' ? selectedCategory : undefined,
            source: selectedSource,
            limit: 30,
            offset: 0,
          });

          if (isMounted) {
            setExercises(result.exercises);
            setHasMore(result.hasMore);
            setNextOffset(result.nextOffset);
          }
        } catch {
          if (isMounted && cachedInitial.length === 0) {
            const cachedFallback = exerciseRepository.getCachedExercises({
              query: trimmed || undefined,
              category: selectedCategory !== 'all' ? selectedCategory : undefined,
              source: selectedSource,
            });
            setExercises(cachedFallback);
            setHasMore(false);
            setNextOffset(undefined);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      },
      trimmed ? 200 : 0,
    );

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [visible, deferredSearchQuery, selectedCategory, selectedSource]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    if (!visible) return;
    const cached = exerciseRepository.getCachedExercises({
      query: searchQuery.trim() || undefined,
      category: cat !== 'all' ? cat : undefined,
      source: selectedSource,
    });
    setExercises(cached);
    if (cached.length > 0) {
      setLoading(false);
    }
  };

  const handleSourceSelect = (src: 'all' | 'custom' | 'external' | 'global') => {
    setSelectedSource(src);
    if (!visible) return;
    const cached = exerciseRepository.getCachedExercises({
      query: searchQuery.trim() || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      source: src,
    });
    setExercises(cached);
    if (cached.length > 0) {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loading || loadingMore || !hasMore || nextOffset === undefined) return;
    setLoadingMore(true);

    try {
      const result = await exerciseRepository.getExercises({
        query: searchQuery.trim() || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        source: selectedSource,
        limit: 30,
        offset: nextOffset,
      });

      setExercises((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newExercises = result.exercises.filter((e) => !existingIds.has(e.id));
        return [...prev, ...newExercises];
      });
      setHasMore(result.hasMore);
      setNextOffset(result.nextOffset);
    } catch {
      // Keep current exercises on pagination failure
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCancelAndClose = useCallback(() => {
    setSearchQuery('');
    setSelectedExercisesMap(new Map());
    setSelectionOrder([]);
    onClose();
  }, [onClose]);

  const handleToggleExercise = useCallback((item: Exercise) => {
    if (selectedExerciseIds.includes(item.id)) return;

    if (!isMultiSelect) {
      setSearchQuery('');
      onSelectExercise?.(item);
      onClose();
      return;
    }

    setSelectedExercisesMap((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, item);
      }
      return next;
    });

    setSelectionOrder((prev) => {
      if (prev.includes(item.id)) {
        return prev.filter((id) => id !== item.id);
      } else {
        return [...prev, item.id];
      }
    });
  }, [isMultiSelect, selectedExerciseIds, onSelectExercise, onClose]);

  const handleSubmitSelection = useCallback(() => {
    const orderedExercises = selectionOrder
      .map((id) => selectedExercisesMap.get(id))
      .filter((e): e is Exercise => Boolean(e));

    if (orderedExercises.length === 0) return;

    if (onSelectExercises) {
      onSelectExercises(orderedExercises);
    } else if (onSelectExercise) {
      orderedExercises.forEach((ex) => onSelectExercise(ex));
    }

    setSearchQuery('');
    setSelectedExercisesMap(new Map());
    setSelectionOrder([]);
    onClose();
  }, [selectionOrder, selectedExercisesMap, onSelectExercises, onSelectExercise, onClose]);

  const selectedCount = selectionOrder.length;

  const renderExerciseCard = useCallback((item: Exercise, testIdPrefix: string = 'picker', recentLabel?: string) => {
    if (!item || !item.id) return null;
    const isAlreadyAdded = selectedExerciseIds.includes(item.id);
    const isSelected = selectedExercisesMap.has(item.id);

    return (
      <ExerciseCard
        key={`${testIdPrefix}_${item.id}`}
        testID={`${testIdPrefix}-exercise-${item.id}`}
        thumbnailTestID={`${testIdPrefix}-thumbnail-${item.id}`}
        exercise={item}
        recentLabel={recentLabel}
        recentLabelTestID={recentLabel ? `picker-recent-label-${item.id}` : undefined}
        mode="select"
        hideThumbnail={true}
        isSelected={isSelected}
        isAlreadyAdded={isAlreadyAdded}
        isMultiSelect={isMultiSelect}
        onPress={handleToggleExercise}
      />
    );
  }, [selectedExerciseIds, selectedExercisesMap, isMultiSelect, handleToggleExercise]);

  const renderItem = useCallback(
    ({ item }: { item: Exercise }) => renderExerciseCard(item, 'picker'),
    [renderExerciseCard]
  );

  const renderListHeader = () => {
    if (cappedRecentEntries.length === 0) return null;

    return (
      <View style={styles.recentSection} testID="picker-recent-section">
        <View style={styles.recentHeaderRow}>
          <Text variant="caption" color="secondary" style={styles.recentSectionTitle}>
            Recent (Last 2 Weeks)
          </Text>
        </View>

        <View style={styles.recentItemsContainer}>
          {cappedRecentEntries.map(({ exercise: item, lastUsedAt }) =>
            renderExerciseCard(
              item,
              'picker-recent',
              lastUsedAt ? formatRelativeRecentLabel(lastUsedAt) : undefined
            )
          )}
        </View>

        <View style={styles.recentDivider} />
        {lightweightExercises.length > 0 ? (
          <Text variant="caption" color="secondary" style={styles.librarySectionTitle}>
            ALL EXERCISES
          </Text>
        ) : null}
      </View>
    );
  };

  // Web-only: Cleanly lock body scroll when picker is open to prevent scroll fighting & visual jumps
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !document?.body) {
      return;
    }

    if (visible) {
      const originalOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';

      const handlePopState = () => {
        if (typeof document !== 'undefined' && document?.body?.style) {
          document.body.style.overflow = originalOverflow;
        }
      };

      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('popstate', handlePopState);
      }

      return () => {
        if (typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('popstate', handlePopState);
        }
        if (typeof document !== 'undefined' && document?.body?.style) {
          document.body.style.overflow = originalOverflow;
        }
      };
    }
  }, [visible]);

  // Web-only: Support ESC key to cancel/close modal cleanly
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.addEventListener) {
      return;
    }

    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelAndClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, handleCancelAndClose]);

  const modalBody = (
    <ScreenContainer style={[styles.container, { paddingTop: Math.max(insets.top, spacing.xs) }]}>
      <ErrorBoundary
        testID="picker-error-boundary"
        fallbackTitle="Could not load exercise picker"
        fallbackMessage="An unexpected render issue occurred. Tap below to reload."
      >
      {isCreatingCustom ? (
        <CustomExerciseForm
          isModal={true}
          submitButtonTitle="Create & Add to Workout"
          cancelButtonTitle="Cancel"
          onSuccess={(created) => {
            setIsCreatingCustom(false);
            if (onSelectExercises) {
              onSelectExercises([created]);
            } else if (onSelectExercise) {
              onSelectExercise(created);
            }
            onClose();
          }}
          onCancel={() => setIsCreatingCustom(false)}
        />
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
                title="+ New"
                onPress={() => setIsCreatingCustom(true)}
                variant="outline"
                size="sm"
                style={styles.createTriggerButton}
              />
              <Button
                testID="picker-close-button"
                title="Cancel"
                onPress={handleCancelAndClose}
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
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
              blurOnSubmit={false}
            />

            {/* Source Filter Chips */}
            <View style={styles.sourceRow} testID="picker-source-filter-row">
              {(['all', 'global', 'custom', 'external'] as const).map((src) => {
                const isActive = selectedSource === src;
                const label =
                  src === 'all'
                    ? 'All'
                    : src === 'global'
                      ? 'Global'
                      : src === 'custom'
                        ? 'Custom'
                        : 'External';
                return (
                  <Pressable
                    key={src}
                    testID={`picker-source-filter-${src}`}
                    onPress={() => handleSourceSelect(src)}
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
                onPress={() => handleCategorySelect('all')}
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
                    onPress={() => handleCategorySelect(cat.id)}
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

          {/* Content — Permanently mounted to preserve virtual keyboard and search focus */}
          <ErrorBoundary
            testID="picker-list-error-boundary"
            fallbackTitle="Unable to display exercises"
            fallbackMessage="An error occurred while rendering the exercise list. Tap below to retry."
          >
          <FlatList
            testID="picker-exercise-list"
            data={lightweightExercises}
            extraData={`${selectedCount}_${cappedRecentEntries.length}`}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={renderListHeader()}
            ListEmptyComponent={
              loading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
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
              )
            }
            contentContainerStyle={[
              styles.listContent,
              isMultiSelect ? { paddingBottom: 110 } : null,
              exercises.length === 0 && cappedRecentEntries.length === 0 && { flexGrow: 1, justifyContent: 'center' },
            ]}
            keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={Platform.OS === 'web' ? 8 : 12}
            maxToRenderPerBatch={Platform.OS === 'web' ? 6 : 10}
            windowSize={Platform.OS === 'web' ? 5 : 7}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS !== 'web'}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
          />
          </ErrorBoundary>

          {/* Sticky Bottom Action Bar for Multi-select */}
          {isMultiSelect && (
            <View
              style={[
                styles.bottomActionBar,
                { paddingBottom: Math.max(insets.bottom, spacing.md) },
              ]}
            >
              <Button
                testID="picker-add-exercises-button"
                title={
                  selectedCount === 0
                    ? 'SELECT EXERCISES'
                    : selectedCount === 1
                    ? 'ADD 1 EXERCISE'
                    : `ADD ${selectedCount} EXERCISES`
                }
                disabled={selectedCount === 0}
                onPress={handleSubmitSelection}
                variant="primary"
                size="lg"
                style={styles.addExercisesButton}
              />
            </View>
          )}
        </>
      )}
      </ErrorBoundary>
    </ScreenContainer>
  );

  if (Platform.OS === 'web') {
    if (!visible) {
      return null;
    }

    return (
      <View testID="picker-web-overlay" style={styles.webOverlay}>
        {modalBody}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancelAndClose}>
      {modalBody}
    </Modal>
  );
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    webOverlay: {
      position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      width: '100%' as any,
      height: (Platform.OS === 'web' ? '100dvh' : '100%') as any,
      maxHeight: (Platform.OS === 'web' ? '100dvh' : '100%') as any,
      overflow: 'hidden',
      backgroundColor: colors.background,
      flex: 1,
    },
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
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    exerciseCardSelected: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(56, 189, 248, 0.08)',
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
    titleWithBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      flexWrap: 'wrap',
    },
    customInlineBadge: {
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      borderColor: colors.success,
      borderWidth: 1,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radii.xs,
    },
    inlineBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.success,
    },
    cardTitle: {
      lineHeight: 20,
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
    bottomActionBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 10,
    },
    addExercisesButton: {
      minHeight: 48,
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
    loadingMoreContainer: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recentSection: {
      marginBottom: spacing.sm,
    },
    recentHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    recentSectionTitle: {
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    recentItemsContainer: {
      gap: spacing.xs,
    },
    recentDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: spacing.md,
    },
    librarySectionTitle: {
      fontWeight: '700',
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
  });
