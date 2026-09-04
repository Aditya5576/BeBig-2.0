import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { templateRepository, WorkoutTemplate } from '../../src/features/templates';
import { colors, spacing, radii } from '../../src/constants/theme';

export default function TemplatesListScreen() {
  const router = useRouter();

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDeleteTemplate = (template: WorkoutTemplate) => {
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
  };

  const renderItem = ({ item }: { item: WorkoutTemplate }) => {
    const exerciseSummary = item.exercises.map((e) => e.exerciseName).join(' • ');

    return (
      <Card style={styles.templateCard} testID={`template-card-${item.id}`}>
        <Pressable
          testID={`template-item-${item.id}`}
          onPress={() => router.push(`/templates/${item.id}` as any)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Text
                variant="titleMedium"
                color="primary"
                numberOfLines={2}
                style={styles.templateTitle}
              >
                {item.name}
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.countBadge}>
                  <Text variant="caption" color="accent" style={styles.badgeText}>
                    {item.exercises.length} {item.exercises.length === 1 ? 'EXERCISE' : 'EXERCISES'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {exerciseSummary ? (
            <Text variant="caption" color="muted" numberOfLines={2} style={styles.exercisePreview}>
              {exerciseSummary}
            </Text>
          ) : null}
        </Pressable>

        <View style={styles.actionRow}>
          <Button
            testID={`edit-template-${item.id}`}
            title="Edit Plan"
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
  };

  return (
    <ScreenContainer>
      {/* Top Header */}
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
            >
              My Templates
            </Text>
            <Text variant="caption" color="muted" numberOfLines={1}>
              Saved workout routines & planning targets
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
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.dark.primary} testID="templates-loading" />
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.centerContainer} testID="templates-empty-state">
          <Text variant="titleMedium" color="primary">
            No workout templates yet
          </Text>
          <Text variant="caption" color="muted" style={styles.emptySubtext}>
            Create your first workout plan with exercises, sets, and target reps.
          </Text>
          <Button
            testID="empty-create-template-button"
            title="Create Your First Template"
            onPress={() => router.push('/templates/new' as any)}
            variant="primary"
            size="md"
            style={styles.emptyButton}
          />
        </View>
      ) : (
        <FlatList
          testID="templates-list"
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
    paddingBottom: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  backButton: {
    paddingHorizontal: 0,
    minHeight: 36,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  newButton: {
    paddingHorizontal: spacing.md,
    flexShrink: 0,
  },
  listContent: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxl + spacing.md,
    gap: spacing.sm,
  },
  templateCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  templateTitle: {
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  exercisePreview: {
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.dark.borderLight,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  editButton: {
    paddingHorizontal: spacing.md,
    minHeight: 38,
  },
  deleteButton: {
    paddingHorizontal: spacing.sm,
    minHeight: 38,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptySubtext: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  emptyButton: {
    marginTop: spacing.xs,
    minHeight: 44,
  },
});
