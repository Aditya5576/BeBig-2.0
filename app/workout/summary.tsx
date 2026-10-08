import { useAppTheme } from '../../src/features/theme';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TextInput, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import { workoutRepository, WorkoutSession } from '../../src/features/workout';
import { templateRepository, CreateTemplateInput, WorkoutTemplate } from '../../src/features/templates';
import { WORKOUT_FOCUS_OPTIONS, deriveWorkoutFocus, getSuggestedSessionNumber } from '../../src/features/templates/utils/templateUtils';
import { spacing, radii } from '../../src/constants/theme';
import {
  ExercisePerformanceSnapshot,
  extractExercisePerformances,
  findPreviousPerformance,
  compareExerciseSets,
} from '../../src/features/performance';

export function convertWorkoutToTemplateInput(workout: WorkoutSession, customName?: string, workoutFocus?: string, sequenceNumber?: number): CreateTemplateInput {
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
    workoutFocus,
    sequenceNumber,
    exercises,
  };
}

export default function WorkoutSummaryScreen() {
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
  const [activeFocus, setActiveFocus] = useState<string>('Other');
  const [sequenceNumber, setSequenceNumber] = useState<number>(1);
  const [allTemplates, setAllTemplates] = useState<WorkoutTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedSummaryNotes, setExpandedSummaryNotes] = useState<Record<string, boolean>>({});

  const toggleSummaryNote = (setId: string) => {
    setExpandedSummaryNotes((prev) => ({ ...prev, [setId]: !prev[setId] }));
  };

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
          }
        } else {
          const completed = await workoutRepository.getCompletedWorkouts();
          if (completed.length > 0) {
            setWorkout(completed[0]);
          }
        }
        const allCompleted = await workoutRepository.getCompletedWorkouts();
        setAllWorkouts(allCompleted);
        const tpls = await templateRepository.getTemplates();
        setAllTemplates(tpls);
      } catch {
        setWorkout(null);
      } finally {
        setLoading(false);
      }
    }

    void loadSummary();
  }, [id]);

  const openSaveModal = () => {
    if (!workout) return;
    const focus = deriveWorkoutFocus(workout.exercises || []);
    const seq = getSuggestedSessionNumber(allWorkouts, focus);
    const defaultName = `${focus} — Session ${seq}`;
    
    setActiveFocus(focus);
    setSequenceNumber(seq);
    updateTemplateName(defaultName);
    setSaveError(null);
    setShowSaveModal(true);
  };

  const handleFocusChange = (newFocus: string) => {
    const seq = getSuggestedSessionNumber(allWorkouts, newFocus);
    setActiveFocus(newFocus);
    setSequenceNumber(seq);
    updateTemplateName(`${newFocus} — Session ${seq}`);
  };

  // Group exercise snapshots from all completed workouts (excluding current workout)
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

  // Current workout exercise snapshots
  const currentWorkoutSnapshots = useMemo(() => {
    if (!workout) return [];
    return extractExercisePerformances(workout);
  }, [workout]);

  // Insights summary counts
  const insightsSummary = useMemo(() => {
    if (!workout) return { progressed: 0, maintained: 0, decreased: 0, totalCompared: 0, hasHistory: false };

    let progressed = 0;
    let maintained = 0;
    let decreased = 0;
    let totalCompared = 0;

    const currentSnaps = extractExercisePerformances(workout);

    for (const currSnap of currentSnaps) {
      const historySnaps = exerciseSnapshotsMap.get(currSnap.exerciseId) || [];
      const prevSnap = findPreviousPerformance(currSnap, historySnaps);
      if (prevSnap) {
        totalCompared++;
        const comps = compareExerciseSets(currSnap.sets, prevSnap.sets);
        const hasIncrease = comps.some((c) => c.status === 'increased' || c.status === 'new_set');
        const hasDecrease = comps.some((c) => c.status === 'decreased' || c.status === 'removed_set');

        if (hasDecrease) {
          decreased++;
        } else if (hasIncrease) {
          progressed++;
        } else {
          maintained++;
        }
      }
    }

    return {
      progressed,
      maintained,
      decreased,
      totalCompared,
      hasHistory: totalCompared > 0,
    };
  }, [workout, exerciseSnapshotsMap]);

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
      const input = convertWorkoutToTemplateInput(workout, trimmedName, activeFocus, sequenceNumber);
      await templateRepository.createTemplate(input);

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

        {/* WORKOUT INSIGHTS SECTION (PERF-5F) */}
        <View style={styles.insightsSection} testID="workout-insights-section">
          <View style={styles.insightsHeaderBlock}>
            <Text variant="titleMedium" color="primary" style={styles.insightsTitle}>
              Workout Insights
            </Text>
            <Text variant="caption" color="muted" style={styles.insightsSubtitle}>
              Compared with your last workout
            </Text>
          </View>

          {/* Factual Summary Counts Card */}
          <Card style={styles.insightsSummaryCard} testID="insights-summary-header">
            {!insightsSummary.hasHistory ? (
              <Text variant="caption" color="secondary" testID="insights-first-workout-notice">
                First recorded workout — no previous workout to compare.
              </Text>
            ) : insightsSummary.progressed === 0 && insightsSummary.decreased === 0 ? (
              <Text variant="caption" color="secondary" testID="insights-no-changes-notice">
                No changes from your previous recorded workout.
              </Text>
            ) : (
              <View style={styles.summaryPillsRow}>
                {insightsSummary.progressed > 0 && (
                  <View style={styles.summaryPillGreen} testID="insights-count-progressed">
                    <Text variant="caption" style={{ color: '#10B981', fontWeight: '800' }}>
                      {insightsSummary.progressed} {insightsSummary.progressed === 1 ? 'exercise' : 'exercises'} progressed
                    </Text>
                  </View>
                )}
                {insightsSummary.maintained > 0 && (
                  <View style={styles.summaryPillNeutral} testID="insights-count-maintained">
                    <Text variant="caption" color="primary" style={{ fontWeight: '800' }}>
                      {insightsSummary.maintained} {insightsSummary.maintained === 1 ? 'exercise' : 'exercises'} maintained
                    </Text>
                  </View>
                )}
                {insightsSummary.decreased > 0 && (
                  <View style={styles.summaryPillRed} testID="insights-count-decreased">
                    <Text variant="caption" style={{ color: '#EF4444', fontWeight: '800' }}>
                      {insightsSummary.decreased} {insightsSummary.decreased === 1 ? 'exercise' : 'exercises'} decreased
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card>

          {/* Exercise-by-Exercise Factual Insights List */}
          {completedExercises.map((ex) => {
            const currSnap = currentWorkoutSnapshots.find((s) => s.exerciseId === ex.exerciseId) || null;
            const historySnaps = exerciseSnapshotsMap.get(ex.exerciseId) || [];
            const prevSnap = currSnap ? findPreviousPerformance(currSnap, historySnaps) : null;
            const setComps = currSnap ? compareExerciseSets(currSnap.sets, prevSnap?.sets || []) : [];

            return (
              <Card key={ex.exerciseId} style={styles.exerciseInsightCard} testID={`insights-exercise-${ex.exerciseId}`}>
                <View style={styles.exerciseInsightHeader}>
                  <Text variant="titleMedium" color="primary" style={styles.exInsightName}>
                    {ex.exerciseName}
                  </Text>

                  <Pressable
                    testID={`insights-view-progression-${ex.exerciseId}`}
                    onPress={() =>
                      router.push({
                        pathname: '/workout/progress/exercise/[id]',
                        params: { id: ex.exerciseId, name: ex.exerciseName },
                      } as any)
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.viewProgressionButton}
                  >
                    <Text variant="caption" color="accent" style={styles.viewProgressionText}>
                      View Full Progression →
                    </Text>
                  </Pressable>
                </View>

                {prevSnap && setComps.length > 0 ? (
                  <View style={styles.setCompsList}>
                    {setComps.map((comp) => (
                      <View key={comp.setNumber} style={styles.setCompCard} testID={`insights-set-row-${ex.exerciseId}-${comp.setNumber}`}>
                        <View style={styles.setCompTopRow}>
                          <View style={styles.setCompBadge}>
                            <Text variant="caption" color="primary" style={styles.setCompBadgeText}>
                              SET {comp.setNumber}
                            </Text>
                          </View>

                          {/* Delta Badge */}
                          <View
                            style={[
                              styles.insightDeltaBadge,
                              comp.status === 'increased' && styles.deltaGreen,
                              comp.status === 'decreased' && styles.deltaRed,
                              comp.status === 'new_set' && styles.deltaBlue,
                              comp.status === 'removed_set' && styles.deltaMuted,
                            ]}
                          >
                            <Text
                              variant="caption"
                              style={[
                                styles.insightDeltaText,
                                comp.status === 'increased' && { color: '#10B981' },
                                comp.status === 'decreased' && { color: '#EF4444' },
                                comp.status === 'new_set' && { color: '#3B82F6' },
                                comp.status === 'removed_set' && { color: '#9CA3AF' },
                                comp.status === 'no_change' && { color: colors.textMuted },
                              ]}
                              testID={`insights-set-delta-${ex.exerciseId}-${comp.setNumber}`}
                            >
                              {comp.displayText}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.setCompValuesRow}>
                          {comp.status === 'new_set' ? (
                            <View style={styles.setValBlock}>
                              <Text variant="caption" color="muted" style={styles.valLabel}>
                                CURRENT
                              </Text>
                              <Text variant="bodyBold" color="primary" style={styles.valTextCurrent}>
                                {comp.currentSet ? `${comp.currentSet.weight} kg × ${comp.currentSet.reps}` : '—'}
                              </Text>
                            </View>
                          ) : comp.status === 'removed_set' ? (
                            <View style={styles.setValBlock}>
                              <Text variant="caption" color="muted" style={styles.valLabel}>
                                PREVIOUS
                              </Text>
                              <Text variant="body" color="muted" style={[styles.valTextPrev, { textDecorationLine: 'line-through' }]}>
                                {comp.previousSet ? `${comp.previousSet.weight} kg × ${comp.previousSet.reps}` : '—'}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.setComparisonFlex}>
                              <View style={styles.setValBlock}>
                                <Text variant="caption" color="muted" style={styles.valLabel}>
                                  PREVIOUS
                                </Text>
                                <Text variant="body" color="secondary" style={styles.valTextPrev}>
                                  {comp.previousSet ? `${comp.previousSet.weight} kg × ${comp.previousSet.reps}` : '—'}
                                </Text>
                              </View>

                              <Text variant="body" color="muted" style={styles.arrowText}>
                                →
                              </Text>

                              <View style={styles.setValBlock}>
                                <Text variant="caption" color="muted" style={styles.valLabel}>
                                  CURRENT
                                </Text>
                                <Text variant="bodyBold" color="primary" style={styles.valTextCurrent}>
                                  {comp.currentSet ? `${comp.currentSet.weight} kg × ${comp.currentSet.reps}` : '—'}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text
                    variant="caption"
                    color="secondary"
                    style={{ marginVertical: spacing.xs }}
                    testID={`insights-first-record-${ex.exerciseId}`}
                  >
                    First recorded workout for this exercise
                  </Text>
                )}
              </Card>
            );
          })}
        </View>

        {/* Session Details Breakdown */}
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
                  {finishedSets.map((s) => {
                    const hasNote = Boolean(s.notes && s.notes.trim().length > 0);
                    return (
                      <View key={s.id} style={styles.setDetailItem}>
                        <View style={styles.setDetailRow}>
                          <View style={styles.setMainInfo}>
                            <Text variant="caption" color="muted" style={styles.setIndex}>
                              SET {s.setNumber}
                            </Text>
                            <Text variant="bodyBold" color="primary" style={styles.setData}>
                              {s.weight > 0 ? `${s.weight} kg × ` : ''}
                              {s.reps} reps
                              {s.rir !== undefined ? ` (RIR ${s.rir})` : ''}
                            </Text>
                          </View>
                          {hasNote && (
                            <Pressable
                              onPress={() => toggleSummaryNote(s.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              style={styles.summaryNoteBadge}
                              testID={`summary-note-indicator-${ex.exerciseId}-${s.setNumber}`}
                              accessibilityLabel={`Set ${s.setNumber} note: ${s.notes}`}
                            >
                              <Text style={styles.summaryNoteBadgeIcon}>📝</Text>
                            </Pressable>
                          )}
                        </View>
                        {hasNote && (
                          <Pressable
                            onPress={() => toggleSummaryNote(s.id)}
                            style={styles.summaryNoteCallout}
                            testID={`summary-note-${ex.exerciseId}-${s.setNumber}`}
                          >
                            <Text
                              variant="caption"
                              color="secondary"
                              style={styles.setNotes}
                              numberOfLines={expandedSummaryNotes[s.id] ? undefined : 2}
                            >
                              {`"${s.notes}"`}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
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
              onPress={openSaveModal}
              variant="outline"
              size="lg"
              style={styles.saveTemplateButton}
            />
          ) : (
            <Card style={styles.saveModalCard} testID="template-save-modal">
              <Text variant="titleMedium" color="primary">
                Save as Template
              </Text>
              <Text variant="caption" color="secondary" style={{ marginBottom: spacing.md }}>
                Convert this completed workout into a reusable template plan.
              </Text>

              {saveError ? (
                <Text testID="save-template-error" variant="caption" style={styles.errorText}>
                  s {saveError}
                </Text>
              ) : null}
              
              <Text variant="caption" color="primary" style={{ marginBottom: spacing.xs }}>
                Workout Focus
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {WORKOUT_FOCUS_OPTIONS.map(option => (
                  <Pressable
                    key={option}
                    onPress={() => handleFocusChange(option)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                      borderRadius: radii.full,
                      backgroundColor: activeFocus === option ? colors.textPrimary : colors.surfaceSubtle,
                      marginRight: spacing.xs,
                    }}
                  >
                    <Text variant="caption" style={{ color: activeFocus === option ? colors.background : colors.textMuted }}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text variant="caption" color="primary" style={{ marginBottom: spacing.xs }}>
                Template Name
              </Text>
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
    paddingBottom: spacing.xxl + 48,
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
  insightsSection: {
    gap: spacing.sm,
  },
  insightsHeaderBlock: {
    gap: 2,
    marginBottom: 2,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  insightsSubtitle: {
    fontSize: 12,
  },
  insightsSummaryCard: {
    padding: spacing.sm + 2,
  },
  summaryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  summaryPillGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  summaryPillNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  summaryPillRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  exerciseInsightCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  exerciseInsightHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.xs - 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.xs + 2,
  },
  exInsightName: {
    fontSize: 15,
    fontWeight: '800',
    width: '100%',
  },
  viewProgressionButton: {
    alignSelf: 'flex-start',
  },
  viewProgressionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  setCompsList: {
    gap: spacing.xs + 2,
    marginTop: 2,
  },
  setCompCard: {
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.xs || 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  setCompTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setCompBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  setCompBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  setCompValuesRow: {
    paddingTop: 2,
  },
  setComparisonFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  setValBlock: {
    gap: 2,
  },
  valLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  valTextPrev: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.75,
  },
  valTextCurrent: {
    fontSize: 14,
    fontWeight: '800',
  },
  arrowText: {
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.5,
    marginHorizontal: 2,
  },
  insightDeltaBadge: {
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  deltaGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  deltaRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  deltaBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  deltaMuted: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  insightDeltaText: {
    fontSize: 11,
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
  setDetailItem: {
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    gap: 3,
  },
  setDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setMainInfo: {
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
  summaryNoteBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  summaryNoteBadgeIcon: {
    fontSize: 12,
  },
  summaryNoteCallout: {
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 2,
  },
  setNotes: {
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 16,
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


