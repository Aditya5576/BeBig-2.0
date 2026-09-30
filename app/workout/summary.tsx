import { useAppTheme } from '../../src/features/theme';
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { workoutRepository, WorkoutSession } from '../../src/features/workout';
import { templateRepository, CreateTemplateInput } from '../../src/features/templates';
import { spacing, radii } from '../../src/constants/theme';

export function convertWorkoutToTemplateInput(workout: WorkoutSession, customName?: string): CreateTemplateInput {
  const templateName = customName && customName.trim() ? customName.trim() : workout.name || 'Quick Workout';

  const validExercises = (workout.exercises || []).filter((ex) => ex.exerciseId && ex.exerciseName);

  const exercises = validExercises.map((ex) => {
    const finishedSets = (ex.actualSets || []).filter((s) => s.completed);

    const sets =
      finishedSets.length > 0
        ? finishedSets.length
        : ex.actualSets && ex.actualSets.length > 0
          ? ex.actualSets.length
          : ex.plannedSets || 3;

    let targetReps = ex.plannedTargetReps?.trim();
    if (!targetReps) {
      const setsForReps = finishedSets.length > 0 ? finishedSets : ex.actualSets || [];
      const validReps = setsForReps.map((s) => s.reps).filter((r) => typeof r === 'number' && r > 0);
      if (validReps.length > 0) {
        const minReps = Math.min(...validReps);
        const maxReps = Math.max(...validReps);
        targetReps = minReps === maxReps ? `${minReps}` : `${minReps}-${maxReps}`;
      } else {
        targetReps = '10';
      }
    }

    let targetWeight = ex.plannedTargetWeight;
    if (targetWeight === undefined) {
      const setsForWeight = finishedSets.length > 0 ? finishedSets : ex.actualSets || [];
      const validWeights = setsForWeight.map((s) => s.weight).filter((w) => typeof w === 'number' && w > 0);
      if (validWeights.length > 0) {
        targetWeight = Math.max(...validWeights);
      }
    }

    const restTime = typeof ex.plannedRestTime === 'number' && ex.plannedRestTime >= 0 ? ex.plannedRestTime : 90;

    return {
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      categoryName: ex.categoryName,
      sets,
      targetReps,
      restTime,
      targetWeight,
    };
  });

  return {
    name: templateName,
    exercises,
  };
}

export default function WorkoutSummaryScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Save as Template state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const templateNameInputRef = useRef('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateTemplateName = (val: string) => {
    templateNameInputRef.current = val;
    setTemplateNameInput(val);
  };

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      try {
        if (id) {
          const found = await workoutRepository.getCompletedWorkoutById(id);
          if (found) {
            setWorkout(found);
            return;
          }
        }
        const completed = await workoutRepository.getCompletedWorkouts();
        if (completed.length > 0) {
          setWorkout(completed[0]);
        }
      } catch {
        setWorkout(null);
      } finally {
        setLoading(false);
      }
    }

    void loadSummary();
  }, [id]);

  const handleConfirmSaveTemplate = async () => {
    if (!workout) return;
    const nameToUse = templateNameInputRef.current !== undefined ? templateNameInputRef.current : templateNameInput;
    const trimmedName = nameToUse ? nameToUse.trim() : '';
    if (!trimmedName) {
      setSaveError('Template name is required.');
      return;
    }

    setSavingTemplate(true);
    setSaveError(null);

    try {
      const input = convertWorkoutToTemplateInput(workout, trimmedName);
      await templateRepository.createTemplate(input);

      // Also propagate the new template name to the active workout / completed history session
      if (workout.id) {
        const updated = await workoutRepository.updateCompletedWorkoutName(workout.id, trimmedName);
        setWorkout(updated);
      }
      await workoutRepository.updateActiveWorkoutName(trimmedName).catch(() => {});

      setTemplateSaved(true);
      setShowSaveModal(false);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save template. Please try again.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
    if (mins > 0) return `${mins} min`;
    return `${secs}s`;
  };

  const formatVolume = (vol?: number) => {
    if (!vol || vol <= 0) return '0 kg';
    return `${vol.toLocaleString()} kg`;
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!workout) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <Text variant="titleMedium" color="primary">
            Workout summary not found.
          </Text>
          <Button
            testID="summary-done-button"
            title="Back to Home"
            onPress={() => router.replace('/home' as any)}
            variant="primary"
            size="md"
            style={styles.backHomeButton}
          />
        </View>
      </ScreenContainer>
    );
  }

  const formatCompletedDate = (dateStr?: string) => {
    if (!dateStr) return 'Today';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return 'Today';
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const completedExercises = workout.exercises.filter(
    (ex) => ex.actualSets && ex.actualSets.some((s) => s.completed),
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.trophyBadge}>
            <Text variant="caption" color="accent" style={styles.trophyBadgeText}>
              WORKOUT COMPLETE
            </Text>
          </View>
          <Text variant="display" color="primary" testID="workout-summary-title">
            Great Work! 🎉
          </Text>
          <Text variant="body" color="secondary">
            {workout.name} • Completed {formatCompletedDate(workout.finishedAt)}
          </Text>
        </View>

        {/* Highlight Metrics Cards Grid */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              DURATION
            </Text>
            <Text variant="titleLarge" color="primary" testID="summary-duration" style={styles.metricValue}>
              {formatDuration(workout.totalDuration)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              TOTAL VOLUME
            </Text>
            <Text variant="titleLarge" color="accent" testID="summary-volume" style={styles.metricValue}>
              {formatVolume(workout.totalVolume)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              EXERCISES
            </Text>
            <Text variant="titleLarge" color="primary" testID="summary-exercises-count" style={styles.metricValue}>
              {completedExercises.length}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text variant="caption" color="muted" style={styles.metricLabel}>
              SETS LOGGED
            </Text>
            <Text variant="titleLarge" color="primary" testID="summary-sets-count" style={styles.metricValue}>
              {workout.completedSetsCount ?? 0}
            </Text>
          </Card>
        </View>

        {/* Exercise Breakdown */}
        <View style={styles.breakdownSection}>
          <Text variant="titleMedium" color="primary" style={styles.breakdownTitle}>
            Session Details
          </Text>

          {completedExercises.map((ex) => {
            const finishedSets = ex.actualSets.filter((s) => s.completed);
            return (
              <Card key={ex.exerciseId} style={styles.exerciseCard}>
                <View style={styles.exerciseCardHeader}>
                  <Text variant="titleMedium" color="primary" style={styles.exName}>
                    {ex.exerciseName}
                  </Text>
                  <Text variant="caption" color="accent" style={styles.setCountBadge}>
                    {finishedSets.length} sets
                  </Text>
                </View>

                <View style={styles.setsList}>
                  {finishedSets.map((s) => (
                    <View key={s.id} style={styles.setDetailRow}>
                      <Text variant="caption" color="muted" style={styles.setIndex}>
                        SET {s.setNumber}
                      </Text>
                      <Text variant="bodyBold" color="primary" style={styles.setData}>
                        {s.weight > 0 ? `${s.weight} kg × ` : ''}
                        {s.reps} reps
                        {s.rir !== undefined ? ` (RIR ${s.rir})` : ''}
                      </Text>
                      {s.notes ? (
                        <Text variant="caption" color="secondary" style={styles.setNotes}>
                          {`"${s.notes}"`}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
        </View>

        {/* Save as Template Section */}
        <View style={styles.templateSection}>
          {templateSaved ? (
            <View testID="save-template-success" style={styles.successBox}>
              <Text variant="bodyBold" color="accent">
                ✓ Saved to My Templates!
              </Text>
              <Button
                testID="view-my-templates-button"
                title="View My Templates"
                onPress={() => router.push('/templates' as any)}
                variant="ghost"
                size="sm"
              />
            </View>
          ) : !showSaveModal ? (
            <Button
              testID="save-as-template-button"
              title="Save as Template"
              onPress={() => {
                const defaultName = workout.name || 'Quick Workout';
                updateTemplateName(defaultName);
                setSaveError(null);
                setShowSaveModal(true);
              }}
              variant="outline"
              size="lg"
              style={styles.saveTemplateButton}
            />
          ) : (
            <Card style={styles.saveModalCard} testID="template-save-modal">
              <Text variant="titleMedium" color="primary">
                Save as Template
              </Text>
              <Text variant="caption" color="secondary">
                Convert this completed workout into a reusable template plan.
              </Text>

              {saveError ? (
                <Text testID="save-template-error" variant="caption" style={styles.errorText}>
                  ⚠ {saveError}
                </Text>
              ) : null}

              <TextInput
                testID="input-template-name"
                value={templateNameInput}
                onChangeText={updateTemplateName}
                placeholder="e.g. Quick Workout Template"
                placeholderTextColor={colors.textMuted}
                style={styles.textInput}
              />

              <View style={styles.modalActionsRow}>
                <Button
                  testID="confirm-save-template-button"
                  title={savingTemplate ? 'Saving...' : 'Save Template'}
                  onPress={handleConfirmSaveTemplate}
                  variant="primary"
                  size="md"
                  disabled={savingTemplate}
                  style={styles.confirmSaveButton}
                />
                <Button
                  testID="cancel-save-template-button"
                  title="Cancel"
                  onPress={() => {
                    setShowSaveModal(false);
                    setSaveError(null);
                  }}
                  variant="ghost"
                  size="md"
                  disabled={savingTemplate}
                />
              </View>
            </Card>
          )}
        </View>

        {/* Done / Return Home Button */}
        <Button
          testID="summary-done-button"
          title="Done — Back to Home"
          onPress={() => router.replace('/home' as any)}
          variant="primary"
          size="lg"
          style={styles.doneButton}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  trophyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  trophyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    gap: 4,
    backgroundColor: colors.surfaceElevated,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  breakdownSection: {
    gap: spacing.sm,
  },
  breakdownTitle: {
    marginBottom: spacing.xs,
  },
  exerciseCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.xs,
  },
  exName: {
    fontSize: 16,
    fontWeight: '700',
  },
  setCountBadge: {
    fontWeight: '700',
  },
  setsList: {
    gap: spacing.xs,
  },
  setDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  setIndex: {
    fontWeight: '800',
    minWidth: 44,
  },
  setData: {
    fontSize: 14,
  },
  setNotes: {
    fontStyle: 'italic',
  },
  templateSection: {
    marginTop: spacing.xs,
  },
  saveTemplateButton: {
    minHeight: 48,
  },
  saveModalCard: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  confirmSaveButton: {
    flex: 1,
  },
  successBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorText: {
    color: colors.error,
    fontWeight: '700',
  },
  doneButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
    minHeight: 52,
  },
  backHomeButton: {
    minWidth: 160,
  },
});
