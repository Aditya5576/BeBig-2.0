import { useAppTheme } from '../../../src/features/theme';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../../src/components/ui';
import { workoutRepository, WorkoutSession } from '../../../src/features/workout';
import { templateRepository } from '../../../src/features/templates';
import { convertWorkoutToTemplateInput } from '../summary';
import { spacing, radii } from '../../../src/constants/theme';
import {
  ExercisePerformanceSnapshot,
  extractExercisePerformances,
  findPreviousPerformance,
  compareExerciseSets,
} from '../../../src/features/performance';

export default function WorkoutHistoryDetailScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutSession[]>([]);
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
    async function loadWorkoutDetail() {
      setLoading(true);
      try {
        if (id) {
          const found = await workoutRepository.getCompletedWorkoutById(id);
          setWorkout(found);
        }
        const completed = await workoutRepository.getCompletedWorkouts();
        setAllWorkouts(completed);
      } catch {
        setWorkout(null);
      } finally {
        setLoading(false);
      }
    }

    void loadWorkoutDetail();
  }, [id]);

  // Group performance snapshots across all completed workouts by exerciseId
  const exerciseSnapshotsMap = useMemo(() => {
    const map = new Map<string, ExercisePerformanceSnapshot[]>();
    for (const w of allWorkouts) {
      const exSnaps = extractExercisePerformances(w);
      for (const s of exSnaps) {
        const existing = map.get(s.exerciseId) || [];
        existing.push(s);
        map.set(s.exerciseId, existing);
      }
    }
    return map;
  }, [allWorkouts]);

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

      if (workout.id) {
        const updated = await workoutRepository.updateCompletedWorkoutName(workout.id, trimmedName);
        setWorkout(updated);
      }

      setTemplateSaved(true);
      setShowSaveModal(false);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save template. Please try again.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleRepeatWorkout = async () => {
    if (!workout) return;
    try {
      await workoutRepository.startWorkoutFromCompleted(workout);
      router.replace('/workout/active' as any);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to repeat workout.');
    }
  };

  const formatCompletedDate = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    const d = new Date(dateStr);
    return d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0 && secs > 0) return `${mins}m ${secs}s`;
    if (mins > 0) return `${mins} min`;
    return `${secs}s`;
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
            Workout session not found.
          </Text>
          <Button
            testID="history-not-found-back-button"
            title="Back to History"
            onPress={() => router.replace('/workout/history' as any)}
            variant="primary"
            size="md"
            style={styles.notFoundButton}
          />
        </View>
      </ScreenContainer>
    );
  }

  const displayExercises = [...workout.exercises]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((ex) => ex.actualSets && ex.actualSets.length > 0);

  // Current session performance snapshots
  const currentWorkoutSnapshots = extractExercisePerformances(workout);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Navigation & Header */}
        <View style={styles.header}>
          <Pressable
            testID="history-detail-back-button"
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="bodyBold" color="primary">
              ‹ History
            </Text>
          </Pressable>

          <View style={styles.titleArea}>
            <View style={styles.historyBadge}>
              <Text variant="caption" color="primary" style={styles.historyBadgeText}>
                COMPLETED WORKOUT LOG (READ-ONLY)
              </Text>
            </View>
            <Text variant="display" color="primary" testID="history-detail-name">
              {workout.name || 'Completed Workout'}
            </Text>
            <Text variant="body" color="secondary" testID="history-detail-date">
              {formatCompletedDate(workout.finishedAt || workout.startedAt)}
            </Text>
          </View>
        </View>

        {/* High-level Summary Metrics Cards Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <Card style={styles.metricCard}>
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                DURATION
              </Text>
              <Text variant="numeric" color="primary" testID="history-detail-duration">
                {formatDuration(workout.totalDuration)}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                TOTAL VOLUME
              </Text>
              <Text variant="numeric" color="primary" testID="history-detail-volume">
                {(workout.totalVolume ?? 0).toLocaleString()} kg
              </Text>
            </Card>
          </View>

          <View style={styles.metricsRow}>
            <Card style={styles.metricCard}>
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                EXERCISES
              </Text>
              <Text variant="numeric" color="primary" testID="history-detail-exercises-count">
                {displayExercises.length}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text variant="caption" color="muted" style={styles.metricLabel}>
                COMPLETED SETS
              </Text>
              <Text variant="numeric" color="primary" testID="history-detail-sets-count">
                {workout.completedSetsCount ?? 0}
              </Text>
            </Card>
          </View>
        </View>

        {/* Completed Exercises & Logged Sets Breakdown */}
        <View style={styles.breakdownSection}>
          <Text variant="titleMedium" color="primary" style={styles.sectionHeader}>
            Exercise Performance
          </Text>

          {displayExercises.map((ex) => {
            const finishedSets = ex.actualSets.filter((s) => s.completed);
            const setsToRender = finishedSets.length > 0 ? finishedSets : ex.actualSets;

            // Progression logic for this exercise in history
            const currSnap = currentWorkoutSnapshots.find((s) => s.exerciseId === ex.exerciseId) || null;
            const historySnaps = exerciseSnapshotsMap.get(ex.exerciseId) || [];
            const prevSnap = currSnap ? findPreviousPerformance(currSnap, historySnaps) : null;
            const setComps = currSnap ? compareExerciseSets(currSnap.sets, prevSnap?.sets || []) : [];

            return (
              <Card
                key={ex.exerciseId}
                style={styles.exerciseCard}
                testID={`history-exercise-${ex.exerciseId}`}
              >
                {/* Exercise Title Header */}
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/workout/progress/exercise/[id]',
                      params: { id: ex.exerciseId, name: ex.exerciseName },
                    } as any)
                  }
                  style={styles.exerciseHeader}
                  testID={`history-exercise-header-${ex.exerciseId}`}
                >
                  <View style={styles.exerciseTitleGroup}>
                    <Text variant="titleMedium" color="primary" style={styles.exerciseName}>
                      {ex.exerciseName || 'Exercise'}
                    </Text>
                    {ex.categoryName ? (
                      <Text variant="caption" color="muted">
                        {ex.categoryName}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={styles.setsBadge}>
                      <Text variant="caption" color="primary" style={styles.setsBadgeText}>
                        {finishedSets.length} sets
                      </Text>
                    </View>
                    <Text variant="caption" color="accent" style={{ fontSize: 16, fontWeight: '700' }}>
                      ›
                    </Text>
                  </View>
                </Pressable>

                {/* Read-Only Current Sets List */}
                <View style={styles.setsList}>
                  {setsToRender.map((s, index) => {
                    const isLastSet = index === setsToRender.length - 1;
                    return (
                      <View
                        key={s.id}
                        style={[styles.setRow, isLastSet && styles.lastSetRow]}
                        testID={`history-set-${ex.exerciseId}-${s.setNumber}`}
                      >
                        <View style={styles.setIndexBadge}>
                          <Text variant="caption" color="primary" style={styles.setIndexText}>
                            SET {s.setNumber}
                          </Text>
                        </View>

                        <View style={styles.setMetricsGroup}>
                          <Text variant="bodyBold" color="primary">
                            {s.weight > 0 ? `${s.weight} kg` : 'Bodyweight'} × {s.reps} reps
                          </Text>
                          {typeof s.rir === 'number' ? (
                            <Text variant="caption" color="muted">
                              RIR {s.rir}
                            </Text>
                          ) : null}
                        </View>

                        {s.notes ? (
                          <Text variant="caption" color="secondary" style={styles.setNotesText}>
                            {`"${s.notes}"`}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {/* Progression Context: Since Last Workout */}
                <View style={styles.progressionSection} testID={`history-progression-${ex.exerciseId}`}>
                  <Text variant="caption" color="muted" style={styles.subSectionTitle}>
                    SINCE LAST WORKOUT
                  </Text>

                  {prevSnap && setComps.length > 0 ? (
                    <View style={styles.historySetComparisons}>
                      {setComps.map((comp) => (
                        <View
                          key={comp.setNumber}
                          style={styles.historySetCompRow}
                          testID={`history-comp-set-${ex.exerciseId}-${comp.setNumber}`}
                        >
                          <View style={styles.compSetBadge}>
                            <Text variant="caption" color="primary" style={styles.compSetBadgeText}>
                              SET {comp.setNumber}
                            </Text>
                          </View>
                          <Text variant="caption" color="muted" style={styles.historyCompPrevText}>
                            {comp.previousSet ? `${comp.previousSet.weight} kg × ${comp.previousSet.reps}` : '—'}
                          </Text>
                          <Text variant="caption" color="muted">
                            →
                          </Text>
                          <Text
                            variant="caption"
                            style={[
                              styles.historyCompDeltaText,
                              comp.status === 'increased' && { color: '#10B981' },
                              comp.status === 'decreased' && { color: '#EF4444' },
                              comp.status === 'new_set' && { color: '#3B82F6' },
                              comp.status === 'removed_set' && { color: '#9CA3AF' },
                              comp.status === 'no_change' && { color: colors.textMuted },
                            ]}
                            testID={`history-comp-delta-${ex.exerciseId}-${comp.setNumber}`}
                          >
                            {comp.displayText}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text
                      variant="caption"
                      color="secondary"
                      style={styles.firstRecordText}
                      testID={`history-first-record-${ex.exerciseId}`}
                    >
                      First recorded workout for this exercise
                    </Text>
                  )}

                  {/* View Full Progression Action */}
                  <Pressable
                    testID={`history-view-full-progression-${ex.exerciseId}`}
                    onPress={() =>
                      router.push({
                        pathname: '/workout/progress/exercise/[id]',
                        params: { id: ex.exerciseId, name: ex.exerciseName },
                      } as any)
                    }
                    style={styles.viewFullProgressionBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text variant="caption" color="accent" style={styles.viewFullProgressionText}>
                      View Full Progression →
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>

        {/* Action Buttons Section */}
        <View style={styles.templateSection}>
          <Button
            testID="repeat-workout-button"
            title="Repeat Workout"
            onPress={handleRepeatWorkout}
            variant="primary"
            size="lg"
            style={styles.saveTemplateButton}
          />
          {templateSaved ? (
            <View style={styles.savedNotice}>
              <Text variant="bodyBold" color="accent" testID="template-saved-badge">
                ✓ Saved as Template
              </Text>
            </View>
          ) : (
            <Button
              testID="save-as-template-button"
              title="Save as Template"
              onPress={() => {
                const initialName = workout.name || '';
                templateNameInputRef.current = initialName;
                setTemplateNameInput(initialName);
                setShowSaveModal(true);
              }}
              variant="outline"
              size="lg"
              style={styles.saveTemplateButton}
            />
          )}
        </View>
      </ScrollView>

      {/* Save Template Modal */}
      {showSaveModal ? (
        <View style={styles.modalOverlay} testID="save-template-modal">
          <Card style={styles.modalCard}>
            <Text variant="titleLarge" color="primary" style={styles.modalTitle}>
              Save as Template
            </Text>
            <Text variant="body" color="secondary" style={styles.modalSubtitle}>
              Give this template a clear name so you can start it anytime.
            </Text>

            <TextInput
              testID="template-name-input"
              style={styles.textInput}
              value={templateNameInput}
              onChangeText={updateTemplateName}
              placeholder="e.g. Upper Body Hypertrophy"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            {saveError ? (
              <Text variant="caption" style={[styles.errorText, { color: '#EF4444' }]}>
                {saveError}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Button
                testID="cancel-save-template-button"
                title="Cancel"
                onPress={() => setShowSaveModal(false)}
                variant="ghost"
                size="md"
              />
              <Button
                testID="confirm-save-template-button"
                title="Save Template"
                onPress={handleConfirmSaveTemplate}
                variant="primary"
                size="md"
                loading={savingTemplate}
              />
            </View>
          </Card>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 140, // Ensure bottom content is scrollable well above bottom navigation
    },
    header: {
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: spacing.xs,
      paddingRight: spacing.md,
      marginBottom: spacing.xs,
    },
    titleArea: {
      gap: 2,
    },
    historyBadge: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.full,
      marginBottom: spacing.xs,
    },
    historyBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    notFoundButton: {
      marginTop: spacing.md,
    },
    metricsGrid: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    metricCard: {
      flex: 1,
      padding: spacing.sm,
      alignItems: 'center',
    },
    metricLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    breakdownSection: {
      gap: spacing.md,
    },
    sectionHeader: {
      marginBottom: spacing.xs,
    },
    exerciseCard: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    exerciseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: spacing.xs,
    },
    exerciseTitleGroup: {
      flex: 1,
      gap: 2,
    },
    exerciseName: {
      fontWeight: '700',
    },
    setsBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    setsBadgeText: {
      fontSize: 11,
    },
    setsList: {
      gap: spacing.xs,
    },
    subSectionTitle: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: spacing.xs,
    },
    setRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    lastSetRow: {
      borderBottomWidth: 0,
    },
    setIndexBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radii.xs || 4,
    },
    setIndexText: {
      fontSize: 10,
      fontWeight: '700',
    },
    setMetricsGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    setNotesText: {
      fontStyle: 'italic',
    },
    progressionSection: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
      marginTop: spacing.xs,
    },
    historySetComparisons: {
      gap: spacing.xs,
      marginVertical: spacing.xs,
    },
    historySetCompRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.xs || 4,
    },
    compSetBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 2,
    },
    compSetBadgeText: {
      fontSize: 9,
      fontWeight: '700',
    },
    historyCompPrevText: {
      fontSize: 12,
      textDecorationLine: 'line-through',
      opacity: 0.7,
    },
    historyCompDeltaText: {
      fontSize: 12,
      fontWeight: '700',
    },
    firstRecordText: {
      fontSize: 12,
      marginVertical: spacing.xs,
    },
    viewFullProgressionBtn: {
      marginTop: spacing.xs,
      alignSelf: 'flex-start',
    },
    viewFullProgressionText: {
      fontSize: 12,
      fontWeight: '700',
    },
    templateSection: {
      marginTop: spacing.xl,
      gap: spacing.sm,
      alignItems: 'center',
    },
    saveTemplateButton: {
      width: '100%',
    },
    savedNotice: {
      paddingVertical: spacing.xs,
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.md,
      zIndex: 100,
    },
    modalCard: {
      width: '100%',
      padding: spacing.lg,
      gap: spacing.md,
    },
    modalTitle: {
      textAlign: 'center',
    },
    modalSubtitle: {
      textAlign: 'center',
    },
    textInput: {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      color: colors.textPrimary,
      borderRadius: radii.md,
      padding: spacing.md,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorText: {
      textAlign: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
  });
