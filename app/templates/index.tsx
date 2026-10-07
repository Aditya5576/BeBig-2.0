import { useAppTheme } from '../../src/features/theme';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer, ScreenFlatList, Text, Button, Card } from '../../src/components/ui';
import { templateRepository, WorkoutTemplate } from '../../src/features/templates';
import { workoutRepository } from '../../src/features/workout';
import { getTemplateFocus } from '../../src/features/templates/utils/templateUtils';
import { spacing, radii } from '../../src/constants/theme';
import { useEntitySyncStatus } from '../../src/services/sync';
import { SyncStatusChip } from '../../src/components/ui';

function TemplateSyncStatus({ templateId }: { templateId: string }) {
  const status = useEntitySyncStatus('template', templateId);
  return <SyncStatusChip status={status} />;
}

type SortOption = 'latest_updated' | 'newest_created' | 'oldest_created' | 'a_z';

const FILTER_CATEGORIES = [
  'ALL',
  'CHEST',
  'BACK',
  'SHOULDERS',
  'LEGS',
  'ARMS',
  'FULL BODY',
  'OTHER',
] as const;

export default function TemplatesListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [activeSort, setActiveSort] = useState<SortOption>('latest_updated');
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await templateRepository.getTemplates();
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTemplates();
    }, [loadTemplates]),
  );

  const handleDeleteTemplate = useCallback((template: WorkoutTemplate) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await templateRepository.deleteTemplate(template.id);
            void loadTemplates();
          },
        },
      ],
    );
  }, [loadTemplates]);

  const handleStartWorkout = useCallback(async (template: WorkoutTemplate) => {
    try {
      setStartingTemplateId(template.id);
      const active = await workoutRepository.getActiveWorkout();
      if (active) {
        Alert.alert(
          'Active Workout in Progress',
          'You already have an active workout in progress. What would you like to do?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Resume Active',
              onPress: () => router.push('/workout/active' as any),
            },
            {
              text: 'Discard & Start New',
              style: 'destructive',
              onPress: async () => {
                await workoutRepository.discardActiveWorkout();
                await workoutRepository.startWorkoutFromTemplate(template);
                router.push('/workout/active' as any);
              },
            },
          ],
        );
        return;
      }

      await workoutRepository.startWorkoutFromTemplate(template);
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start workout from template.');
    } finally {
      setStartingTemplateId(null);
    }
  }, [router]);

  // Filter & Search & Sort
  const filteredAndSortedTemplates = useMemo(() => {
    let result = [...templates];

    // Focus filter
    if (activeFilter !== 'ALL') {
      const filterLower = activeFilter.toLowerCase();
      result = result.filter((t) => {
        const focus = getTemplateFocus(t).toLowerCase();
        if (filterLower === 'chest') {
          return focus.includes('chest');
        }
        if (filterLower === 'back') {
          return focus.includes('back');
        }
        if (filterLower === 'shoulders') {
          return focus.includes('shoulder');
        }
        if (filterLower === 'legs') {
          return focus.includes('leg');
        }
        if (filterLower === 'arms') {
          return focus.includes('arm') || focus.includes('bicep') || focus.includes('tricep');
        }
        if (filterLower === 'full body') {
          return focus.includes('full body');
        }
        if (filterLower === 'other') {
          return focus === 'other';
        }
        return focus.includes(filterLower);
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((t) => {
        const nameMatch = t.name.toLowerCase().includes(query);
        const focusMatch = getTemplateFocus(t).toLowerCase().includes(query);
        const exerciseMatch = (t.exercises || []).some((ex) =>
          ex.exerciseName.toLowerCase().includes(query),
        );
        return nameMatch || focusMatch || exerciseMatch;
      });
    }

    // Sort
    result.sort((a, b) => {
      if (activeSort === 'latest_updated') {
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      }
      if (activeSort === 'newest_created') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (activeSort === 'oldest_created') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (activeSort === 'a_z') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return result;
  }, [templates, activeFilter, searchQuery, activeSort]);

  // Library summary statistics
  const summaryStats = useMemo(() => {
    const totalCount = templates.length;
    const focuses = new Set(templates.map((t) => getTemplateFocus(t)));
    return {
      totalCount,
      focusCount: focuses.size,
    };
  }, [templates]);

  // Render individual template card
  const renderItem = useCallback(
    ({ item }: { item: WorkoutTemplate }) => {
      const focus = getTemplateFocus(item);
      const exerciseCount = item.exercises?.length || 0;
      const totalSets = (item.exercises || []).reduce((acc, ex) => acc + (ex.sets || 0), 0);
      const previewExercises = (item.exercises || []).slice(0, 3);
      const remainingCount = exerciseCount - previewExercises.length;
      const isStarting = startingTemplateId === item.id;

      return (
        <Card style={styles.templateCard} testID={`template-card-${item.id}`}>
          {/* Card Top: Focus Badge, Session Tag & Sync Status */}
          <View style={styles.cardTopRow}>
            <View style={styles.badgeGroup}>
              <View style={styles.focusBadge}>
                <Text variant="caption" style={styles.focusBadgeText}>
                  {focus.toUpperCase()}
                </Text>
              </View>
              {item.sequenceNumber ? (
                <View style={styles.sessionBadge}>
                  <Text variant="caption" style={styles.sessionBadgeText}>
                    Session {item.sequenceNumber}
                  </Text>
                </View>
              ) : null}
            </View>
            <TemplateSyncStatus templateId={item.id} />
          </View>

          {/* Template Title */}
          <Pressable
            testID={`template-item-${item.id}`}
            onPress={() => router.push(`/templates/${item.id}` as any)}
            style={styles.cardBody}
          >
            <Text
              variant="titleMedium"
              color="primary"
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.templateTitle}
            >
              {item.name}
            </Text>

            {/* Exercise Preview List (Max 3 + "+ N more") */}
            {exerciseCount > 0 ? (
              <View style={styles.exercisePreviewList}>
                {previewExercises.map((ex, idx) => (
                  <Text
                    key={`${ex.exerciseId}-${idx}`}
                    variant="caption"
                    color="muted"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.exercisePreviewItem}
                  >
                    • {ex.exerciseName}
                  </Text>
                ))}
                {remainingCount > 0 ? (
                  <Text variant="caption" color="secondary" style={styles.remainingBadge}>
                    + {remainingCount} more
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Meta Line */}
            <View style={styles.metaLine}>
              <Text variant="caption" color="muted" style={styles.metaText}>
                {exerciseCount} {exerciseCount === 1 ? 'EXERCISE' : 'EXERCISES'} • {totalSets} Sets
              </Text>
            </View>
          </Pressable>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <Button
              testID={`start-template-${item.id}`}
              title={isStarting ? 'Starting...' : 'START WORKOUT'}
              onPress={() => handleStartWorkout(item)}
              variant="primary"
              size="sm"
              disabled={isStarting}
              style={styles.startWorkoutButton}
            />
            <Button
              testID={`edit-template-${item.id}`}
              title="Edit"
              onPress={() => router.push(`/templates/${item.id}` as any)}
              variant="secondary"
              size="sm"
              style={styles.editButton}
            />
            <Button
              testID={`delete-template-${item.id}`}
              title="Delete"
              onPress={() => handleDeleteTemplate(item)}
              variant="ghost"
              size="sm"
              style={styles.deleteButton}
            />
          </View>
        </Card>
      );
    },
    [router, styles, handleDeleteTemplate, handleStartWorkout, startingTemplateId],
  );

  return (
    <ScreenContainer>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.navRow}>
          <Button
            testID="templates-back-button"
            title="← Home"
            onPress={() => router.back()}
            variant="ghost"
            size="sm"
            style={styles.backButton}
          />
        </View>

        <View style={styles.headerTitleRow}>
          <View style={styles.headerTextGroup}>
            <Text
              variant="titleLarge"
              color="primary"
              testID="templates-screen-title"
              numberOfLines={1}
              style={styles.mainTitle}
            >
              MY TEMPLATES
            </Text>
            <Text variant="caption" color="muted" numberOfLines={1}>
              Your personal workout library
            </Text>
          </View>

          <Button
            testID="create-template-button"
            title="+ New"
            onPress={() => router.push('/templates/new' as any)}
            variant="primary"
            size="sm"
            style={styles.newButton}
          />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            testID="templates-search-input"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search templates, focus, exercises..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <Pressable
              testID="clear-search-button"
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
            >
              <Text variant="caption" color="muted" style={styles.clearSearchText}>
                ✕
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Focus Navigation Selector */}
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {FILTER_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                testID={`filter-chip-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onPress={() => setActiveFilter(cat)}
                style={[styles.filterChip, activeFilter === cat && styles.filterChipActive]}
              >
                <Text
                  variant="caption"
                  style={[
                    styles.filterChipText,
                    activeFilter === cat ? styles.filterChipTextActive : { color: colors.textMuted },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Compact Library Summary & Sort Control */}
        <View style={styles.controlsRow}>
          <Text variant="caption" color="muted" style={styles.summaryStatsText}>
            {summaryStats.totalCount} {summaryStats.totalCount === 1 ? 'Template' : 'Templates'} •{' '}
            {summaryStats.focusCount} Focuses
          </Text>

          <View style={styles.sortToggleContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sortScroll}
            >
              {[
                { label: 'Latest', value: 'latest_updated' },
                { label: 'Newest', value: 'newest_created' },
                { label: 'Oldest', value: 'oldest_created' },
                { label: 'A-Z', value: 'a_z' },
              ].map((sort) => (
                <Pressable
                  key={sort.value}
                  onPress={() => setActiveSort(sort.value as SortOption)}
                  style={[styles.sortPill, activeSort === sort.value && styles.sortPillActive]}
                >
                  <Text
                    variant="caption"
                    style={{
                      color: activeSort === sort.value ? colors.primary : colors.textMuted,
                      fontWeight: activeSort === sort.value ? '700' : '500',
                      fontSize: 11,
                    }}
                  >
                    {sort.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Main List Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} testID="templates-loading" />
        </View>
      ) : templates.length === 0 ? (
        /* Global Empty State */
        <View style={styles.centerContainer} testID="templates-empty-state">
          <Text variant="titleMedium" color="primary" style={styles.emptyTitle}>
            BUILD YOUR WORKOUT LIBRARY
          </Text>
          <Text variant="caption" color="muted" style={styles.emptySubtext}>
            No workout templates yet. Save your favorite workouts here and start them whenever you're ready.
          </Text>
          <Button
            testID="empty-create-template-button"
            title="+ Create Template"
            onPress={() => router.push('/templates/new' as any)}
            variant="primary"
            size="md"
            style={styles.emptyButton}
          />
        </View>
      ) : filteredAndSortedTemplates.length === 0 ? (
        /* Filter / Search Zero Result State */
        <View style={styles.centerContainer} testID="templates-filter-empty-state">
          <Text variant="titleMedium" color="primary" style={styles.emptyTitle}>
            {searchQuery.trim()
              ? 'No matching templates'
              : `No ${activeFilter.toLowerCase()} templates yet`}
          </Text>
          <Text variant="caption" color="muted" style={styles.emptySubtext}>
            {searchQuery.trim()
              ? `No templates found matching "${searchQuery}". Try a different search term.`
              : `Create a template for this workout focus to see it here.`}
          </Text>
          {searchQuery.trim() ? (
            <Button
              testID="clear-search-empty-button"
              title="Clear Search"
              onPress={() => setSearchQuery('')}
              variant="secondary"
              size="md"
              style={styles.emptyButton}
            />
          ) : (
            <Button
              testID="filter-create-template-button"
              title={`Create ${activeFilter !== 'ALL' ? activeFilter : ''} Template`}
              onPress={() => router.push('/templates/new' as any)}
              variant="primary"
              size="md"
              style={styles.emptyButton}
            />
          )}
        </View>
      ) : (
        <ScreenFlatList
          testID="templates-list"
          data={filteredAndSortedTemplates}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    navRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    backButton: {
      marginLeft: -spacing.sm,
    },
    headerTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    headerTextGroup: {
      flex: 1,
      marginRight: spacing.md,
    },
    mainTitle: {
      letterSpacing: 0.5,
      fontWeight: '800',
    },
    newButton: {
      minWidth: 76,
    },
    searchContainer: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    searchInput: {
      flex: 1,
      height: 38,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      color: colors.textPrimary,
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearSearchButton: {
      position: 'absolute',
      right: spacing.sm,
      padding: spacing.xs,
    },
    clearSearchText: {
      fontSize: 12,
      fontWeight: '700',
    },
    filterRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    filterScroll: {
      paddingVertical: 2,
      gap: spacing.xs,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radii.full,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.5,
    },
    filterChipTextActive: {
      color: '#090D16',
      fontWeight: '800',
    },
    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.xs,
    },
    summaryStatsText: {
      fontSize: 11,
      fontWeight: '600',
    },
    sortToggleContainer: {
      flexDirection: 'row',
    },
    sortScroll: {
      gap: 6,
    },
    sortPill: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    sortPillActive: {
      backgroundColor: colors.surfaceSubtle,
    },
    listContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    templateCard: {
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    badgeGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    focusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    focusBadgeText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 10,
      letterSpacing: 0.5,
    },
    sessionBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sessionBadgeText: {
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 10,
    },
    cardBody: {
      marginBottom: spacing.sm,
    },
    templateTitle: {
      marginBottom: spacing.xs,
      fontWeight: '700',
    },
    exercisePreviewList: {
      marginBottom: spacing.xs,
      paddingLeft: 2,
    },
    exercisePreviewItem: {
      fontSize: 12,
      lineHeight: 18,
    },
    remainingBadge: {
      fontSize: 11,
      fontStyle: 'italic',
      marginTop: 2,
    },
    metaLine: {
      marginTop: spacing.xs,
    },
    metaText: {
      fontSize: 12,
      fontWeight: '500',
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    startWorkoutButton: {
      flex: 2,
    },
    editButton: {
      flex: 1,
    },
    deleteButton: {
      minWidth: 64,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    emptyTitle: {
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    emptySubtext: {
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      maxWidth: 280,
    },
    emptyButton: {
      minWidth: 180,
    },
  });
}
