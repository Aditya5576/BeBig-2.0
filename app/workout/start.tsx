import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { templateRepository, WorkoutTemplate } from '../../src/features/templates';
import { workoutRepository, WorkoutSession } from '../../src/features/workout';
import { colors, spacing, radii } from '../../src/constants/theme';

export default function StartWorkoutScreen() {
  const router = useRouter();

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allTemplates, currentActive] = await Promise.all([
        templateRepository.getTemplates(),
        workoutRepository.getActiveWorkout(),
      ]);
      setTemplates(allTemplates);
      setActiveWorkout(currentActive);
    } catch {
      setTemplates([]);
      setActiveWorkout(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const handleStartFromTemplate = async (template: WorkoutTemplate) => {
    if (activeWorkout) {
      Alert.alert(
        'Active Workout in Progress',
        `You already have an active workout ("${activeWorkout.name}"). Would you like to resume it or discard it first?`,
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
              setActiveWorkout(null);
              await workoutRepository.startWorkoutFromTemplate(template);
              router.push('/workout/active' as any);
            },
          },
        ],
      );
      return;
    }

    try {
      setStarting(true);
      await workoutRepository.startWorkoutFromTemplate(template);
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start workout.');
    } finally {
      setStarting(false);
    }
  };

  const handleStartEmptyWorkout = async () => {
    if (activeWorkout) {
      Alert.alert(
        'Active Workout in Progress',
        `You already have an active workout ("${activeWorkout.name}"). Would you like to resume it or discard it first?`,
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
              setActiveWorkout(null);
              await workoutRepository.startEmptyWorkout('Quick Workout');
              router.push('/workout/active' as any);
            },
          },
        ],
      );
      return;
    }

    try {
      setStarting(true);
      await workoutRepository.startEmptyWorkout('Quick Workout');
      router.push('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to start workout.');
    } finally {
      setStarting(false);
    }
  };

  const handleDiscardActive = () => {
    Alert.alert(
      'Discard Active Workout',
      'Are you sure you want to discard your current workout draft? All unrecorded progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await workoutRepository.discardActiveWorkout();
            setActiveWorkout(null);
          },
        },
      ],
    );
  };

  const handleRenameTemplate = async (templateId: string) => {
    if (!editTemplateName.trim()) {
      Alert.alert('Invalid Name', 'Template name cannot be empty.');
      return;
    }
    try {
      await templateRepository.updateTemplate({ id: templateId, name: editTemplateName });
      await loadData();
      setEditingTemplateId(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to rename template.');
    }
  };

  const recommendedTemplate = templates.length > 0 ? templates[0] : null;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Navigation / Header */}
        <View style={styles.header}>
          <Pressable
            testID="start-workout-back-button"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="bodyBold" color="accent" style={styles.backButtonText}>
              ‹ Back
            </Text>
          </Pressable>

          <View style={styles.titleContainer}>
            <Text variant="display" color="primary" testID="start-workout-title">
              Start Workout
            </Text>
            <Text variant="body" color="secondary">
              Select a template or begin a blank training session.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.dark.primary} />
          </View>
        ) : (
          <>
            {/* Active Workout In Progress Notice */}
            {activeWorkout && (
              <Card style={styles.activeWorkoutCard} testID="active-workout-banner">
                <View style={styles.activeBadgeRow}>
                  <View style={styles.activeBadge}>
                    <Text variant="caption" color="accent" style={styles.activeBadgeText}>
                      SESSION IN PROGRESS
                    </Text>
                  </View>
                </View>
                <Text variant="titleMedium" color="primary" style={styles.activeWorkoutName}>
                  {activeWorkout.name}
                </Text>
                <Text variant="caption" color="secondary">
                  Started{' '}
                  {new Date(activeWorkout.startedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  • {activeWorkout.exercises.length} Exercises
                </Text>

                <View style={styles.activeActionRow}>
                  <Button
                    testID="start-resume-workout-button"
                    title="Resume Workout"
                    onPress={() => router.push('/workout/active' as any)}
                    variant="primary"
                    size="md"
                    style={styles.activeResumeButton}
                  />
                  <Button
                    testID="start-discard-workout-button"
                    title="Discard"
                    onPress={handleDiscardActive}
                    variant="outline"
                    size="md"
                    style={styles.activeDiscardButton}
                  />
                </View>
              </Card>
            )}

            {/* Quick Start / Blank Workout */}
            <Card style={styles.quickStartCard}>
              <View style={styles.cardHeader}>
                <Text variant="titleMedium" color="primary">
                  Quick Start
                </Text>
                <Text variant="caption" color="muted">
                  Log exercises on the go without a pre-made template
                </Text>
              </View>
              <Button
                testID="start-empty-workout-button"
                title="Start Empty Workout"
                onPress={handleStartEmptyWorkout}
                variant="secondary"
                size="lg"
                loading={starting}
                style={styles.startEmptyButton}
              />
            </Card>

            {/* Recommended / Today's Plan */}
            {recommendedTemplate && (
              <Card style={styles.recommendedCard} testID="recommended-template-card">
                <View style={styles.recommendedHeader}>
                  <View style={styles.recommendedBadge}>
                    <Text variant="caption" color="accent" style={styles.recommendedBadgeText}>
                      RECOMMENDED PLAN
                    </Text>
                  </View>
                  <Text variant="titleMedium" color="primary" numberOfLines={1}>
                    {recommendedTemplate.name}
                  </Text>
                  <Text variant="caption" color="secondary" numberOfLines={2}>
                    {recommendedTemplate.exercises.map((e) => e.exerciseName).join(' • ')}
                  </Text>
                </View>
                <Button
                  testID="start-recommended-template-button"
                  title={`Start "${recommendedTemplate.name}"`}
                  onPress={() => handleStartFromTemplate(recommendedTemplate)}
                  variant="primary"
                  size="lg"
                  loading={starting}
                  style={styles.startRecommendedButton}
                />
              </Card>
            )}

            {/* Saved Templates List */}
            <View style={styles.templatesSection}>
              <Text variant="titleMedium" color="primary" style={styles.sectionHeader}>
                Saved Templates ({templates.length})
              </Text>

              {templates.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Text variant="body" color="muted" style={styles.emptyText}>
                    No saved workout templates yet.
                  </Text>
                  <Button
                    testID="create-template-button"
                    title="Create Workout Template"
                    onPress={() => router.push('/templates/new' as any)}
                    variant="outline"
                    size="sm"
                    style={styles.createTemplateButton}
                  />
                </Card>
              ) : (
                templates.map((tpl) => (
                  <Card key={tpl.id} style={styles.templateCard} testID={`template-card-${tpl.id}`}>
                    {editingTemplateId === tpl.id ? (
                      <View style={styles.editModeContainer}>
                        <TextInput
                          style={styles.editInput}
                          value={editTemplateName}
                          onChangeText={setEditTemplateName}
                          autoFocus
                          placeholder="Template Name"
                          placeholderTextColor={colors.dark.textMuted}
                        />
                        <View style={styles.editActions}>
                          <Button
                            title="Cancel"
                            onPress={() => setEditingTemplateId(null)}
                            variant="outline"
                            size="sm"
                          />
                          <Button
                            title="Save"
                            onPress={() => handleRenameTemplate(tpl.id)}
                            variant="primary"
                            size="sm"
                          />
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.templateInfo}>
                          <View style={styles.templateNameRow}>
                            <Text variant="titleMedium" color="primary" numberOfLines={1} style={styles.templateNameText}>
                              {tpl.name}
                            </Text>
                            <Pressable 
                              hitSlop={8} 
                              onPress={() => {
                                setEditingTemplateId(tpl.id);
                                setEditTemplateName(tpl.name);
                              }}
                            >
                              <Text variant="caption" color="accent" style={styles.editButtonText}>Edit</Text>
                            </Pressable>
                          </View>
                          <Text variant="caption" color="muted">
                            {tpl.exercises.length}{' '}
                            {tpl.exercises.length === 1 ? 'Exercise' : 'Exercises'} •{' '}
                            {tpl.exercises
                              .map((e) => e.exerciseName)
                              .slice(0, 3)
                              .join(', ')}
                            {tpl.exercises.length > 3 ? '...' : ''}
                          </Text>
                        </View>
                        <Button
                          testID={`start-template-${tpl.id}`}
                          title="Start"
                          onPress={() => handleStartFromTemplate(tpl)}
                          variant="primary"
                          size="sm"
                          style={styles.startTemplateButton}
                        />
                      </>
                    )}
                  </Card>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  backButton: {
    minHeight: 40,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 17,
  },
  titleContainer: {
    gap: spacing.xs,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  activeWorkoutCard: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.primary,
    borderWidth: 1.5,
    gap: spacing.sm,
    padding: spacing.md,
  },
  activeBadgeRow: {
    flexDirection: 'row',
  },
  activeBadge: {
    backgroundColor: colors.dark.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeWorkoutName: {
    fontSize: 18,
    fontWeight: '700',
  },
  activeActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  activeResumeButton: {
    flex: 2,
    minHeight: 44,
  },
  activeDiscardButton: {
    flex: 1,
    minHeight: 44,
    borderColor: colors.dark.error,
  },
  quickStartCard: {
    gap: spacing.md,
    padding: spacing.md,
  },
  cardHeader: {
    gap: 4,
  },
  startEmptyButton: {
    minHeight: 48,
  },
  recommendedCard: {
    gap: spacing.md,
    padding: spacing.md,
    borderColor: colors.dark.borderLight,
  },
  recommendedHeader: {
    gap: spacing.xs,
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dark.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  recommendedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  startRecommendedButton: {
    minHeight: 48,
  },
  templatesSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  emptyCard: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
  },
  createTemplateButton: {
    minHeight: 40,
  },
  templateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  templateInfo: {
    flex: 1,
    gap: 4,
  },
  templateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.sm,
  },
  templateNameText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  editButtonText: {
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editModeContainer: {
    flex: 1,
    gap: spacing.sm,
    width: '100%',
  },
  editInput: {
    backgroundColor: colors.dark.surface,
    color: colors.dark.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  startTemplateButton: {
    minWidth: 80,
    minHeight: 40,
    flexShrink: 0,
  },
});
