import { useAppTheme } from '../../src/features/theme';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer, ScreenScrollView, ScreenFlatList, Text, Button, Card } from '../../src/components/ui';
import { exerciseRepository, Exercise, STANDARD_CATEGORIES } from '../../src/features/exercises';
import { spacing, radii } from '../../src/constants/theme';
import { useEntitySyncStatus } from '../../src/services/sync';
import { SyncStatusChip } from '../../src/components/ui';

function CustomExerciseSyncStatus({ exerciseId, isCustom }: { exerciseId: string; isCustom: boolean }) {
  const status = useEntitySyncStatus('custom_exercise', exerciseId);
  if (!isCustom) return null;
  return <SyncStatusChip status={status} />;
}


export default function ExerciseListScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const router = useRouter();

  const [exercises, setExercises] = useState<Exercise[]>(() => {
    try {
      return exerciseRepository.getCachedExercises();
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return exerciseRepository.getCachedExercises().length === 0;
    } catch {
      return true;
    }
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'custom' | 'external'>('all');
  const [nextOffset, setNextOffset] = useState<number | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isCachedOnly, setIsCachedOnly] = useState(false);

  // 0. Refresh list whenever screen comes into focus (e.g. returning after deleting a custom exercise)
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function refreshOnFocus() {
        try {
          const result = await exerciseRepository.getExercises({
            query: searchQuery.trim() || undefined,
            category: selectedCategory !== 'all' ? selectedCategory : undefined,
            limit: 20,
            offset: 0,
            source: selectedSource,
          });
          if (isMounted) {
            setExercises(result.exercises);
            setHasMore(result.hasMore);
            setNextOffset(result.nextOffset);
          }
        } catch {
          // Ignore focus refresh failures
        }
      }
      void refreshOnFocus();
      return () => {
        isMounted = false;
      };
    }, [searchQuery, selectedCategory, selectedSource])
  );

  // 1. Instant local search against cache whenever query or category changes
  useEffect(() => {
    const cached = exerciseRepository.getCachedExercises({
      query: searchQuery.trim() || undefined,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      source: selectedSource,
    });
    if (cached.length > 0) {
      setExercises(cached);
      setLoading(false);
      setError(null);
    }
  }, [searchQuery, selectedCategory, selectedSource]);

  // 2. Background API refresh with debounce
  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(async () => {
      // If we don't already have exercises rendered, indicate loading
      if (exercises.length === 0) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await exerciseRepository.getExercises({
          query: searchQuery.trim() || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          limit: 20,
          offset: 0,
          source: selectedSource,
        });

        if (isMounted) {
          setExercises(result.exercises);
          setHasMore(result.hasMore);
          setNextOffset(result.nextOffset);
          setIsCachedOnly(false);
        }
      } catch (err: any) {
        if (isMounted) {
          // If we have cached results, keep displaying them gracefully
          const cached = exerciseRepository.getCachedExercises({
            query: searchQuery.trim() || undefined,
            category: selectedCategory !== 'all' ? selectedCategory : undefined,
            source: selectedSource,
          });
          if (cached.length > 0) {
            setExercises(cached);
            setIsCachedOnly(true);
          } else {
            setError(err?.message || 'Failed to load exercises. Please try again.');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, selectedCategory, refreshTrigger, selectedSource]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const handleLoadMore = async () => {
    if (loading || loadingMore || !hasMore || nextOffset === undefined) return;
    setLoadingMore(true);

    try {
      const result = await exerciseRepository.getExercises({
        query: searchQuery.trim() || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        limit: 20,
        offset: nextOffset,
        source: selectedSource,
      });

      setExercises((prev) => [...prev, ...result.exercises]);
      setHasMore(result.hasMore);
      setNextOffset(result.nextOffset);
    } catch {
      // Keep current list on pagination failure
    } finally {
      setLoadingMore(false);
    }
  };

  const renderItem = ({ item }: { item: Exercise }) => {
    const equipmentText =
      item.equipment.length > 0 ? item.equipment.map((e) => e.name).join(', ') : 'Bodyweight';
    const muscleText =
      item.primaryMuscles.length > 0
        ? item.primaryMuscles.map((m) => m.name).join(', ')
        : 'Full Body';

    return (
      <Pressable
        testID={`exercise-item-${item.id}`}
        onPress={() => router.push(`/exercises/${item.id}` as any)}
        style={styles.cardPressable}
      >
        <Card style={styles.exerciseCard}>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Text variant="bodyBold" color="primary" numberOfLines={1}>
                {item.name}
              </Text>
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {item.categoryName} • {equipmentText}
              </Text>
            </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {item.isCustom && (
                  <View style={styles.customBadge} testID="custom-badge">
                    <Text variant="caption" color="accent" style={styles.badgeText}>
                      CUSTOM
                    </Text>
                  </View>
                )}
                <CustomExerciseSyncStatus exerciseId={item.id} isCustom={item.isCustom} />
              </View>
          </View>

          <View style={styles.muscleRow}>
            <Text variant="caption" color="muted">
              Target:{' '}
              <Text variant="caption" color="accent">
                {muscleText}
              </Text>
            </Text>
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text variant="titleLarge" color="primary" testID="exercise-screen-title">
              Exercises
            </Text>
            <Text variant="caption" color="muted">
              Browse & create training movements
            </Text>
          </View>

          <Button
            testID="create-exercise-button"
            title="+ New"
            onPress={() => router.push('/exercises/new' as any)}
            variant="primary"
            size="sm"
            style={styles.newButton}
          />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            testID="exercise-search-input"
            style={styles.searchInput}
            placeholder="Search exercises by name..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Source Filter Chips */}
        <View style={styles.sourceRow} testID="source-filter-row">
          {(['all', 'custom', 'external'] as const).map((src) => {
            const isActive = selectedSource === src;
            const label = src === 'all' ? 'All Sources' : src === 'custom' ? 'Custom Only' : 'External Only';
            return (
              <Pressable
                key={src}
                testID={`source-filter-${src}`}
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

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <Pressable
            testID="category-filter-all"
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
                testID={`category-filter-${cat.id}`}
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

      {/* Offline/Cached Subtle Banner */}
      {isCachedOnly && (
        <View testID="exercise-offline-banner" style={styles.offlineBanner}>
          <Text variant="caption" color="primary" style={styles.offlineBannerText}>
            ⚡ Offline / Weak Network — Showing Cached Movements
          </Text>
        </View>
      )}

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator
            testID="exercise-loading-indicator"
            size="large"
            color={colors.primary}
          />
          <Text variant="caption" color="muted" style={styles.loadingText}>
            Loading exercises...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer} testID="exercise-error-state">
          <Text variant="bodyBold" color="primary">
            Unable to load exercises
          </Text>
          <Text variant="caption" color="muted" style={styles.errorSubtext}>
            {error}
          </Text>
          <Button
            testID="exercise-retry-button"
            title="Try Again"
            onPress={() => setRefreshTrigger((c) => c + 1)}
            variant="secondary"
            size="md"
            style={styles.retryButton}
          />
        </View>
      ) : exercises.length === 0 ? (
        <View style={styles.centerContainer} testID="exercise-empty-state">
          <Text variant="bodyBold" color="primary">
            No exercises found
          </Text>
          <Text variant="caption" color="muted" style={styles.errorSubtext}>
            Try changing your search term or category filter, or create a custom exercise.
          </Text>
          <Button
            testID="empty-create-exercise-button"
            title="Create Custom Exercise"
            onPress={() => router.push('/exercises/new' as any)}
            variant="outline"
            size="md"
            style={styles.retryButton}
          />
        </View>
      ) : (
        <ScreenFlatList
          testID="exercise-list"
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </ScreenContainer>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newButton: {
    paddingHorizontal: spacing.md,
  },
  searchContainer: {
    marginTop: spacing.xs,
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
    paddingVertical: spacing.xs,
  },
  sourceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
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
    paddingVertical: spacing.xs,
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
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xxl + spacing.xl,
    gap: spacing.sm,
  },
  cardPressable: {
    marginBottom: spacing.xs,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleContainer: {
    flex: 1,
    gap: 2,
  },
  customBadge: {
    backgroundColor: '#1E2C1A',
    borderColor: colors.success,
    borderWidth: 1,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  muscleRow: {
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    marginTop: spacing.xs,
  },
  errorSubtext: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.xs,
  },
  footerLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  offlineBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    alignItems: 'center',
  },
  offlineBannerText: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

