import { useAppTheme } from '../../src/features/theme';
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import {
  templateRepository,
  ExercisePickerModal,
  TemplateExercise,
} from '../../src/features/templates';
import { Exercise } from '../../src/features/exercises';
import { spacing, radii } from '../../src/constants/theme';
import { WORKOUT_FOCUS_OPTIONS, deriveWorkoutFocus, getSuggestedSessionNumber } from '../../src/features/templates/utils/templateUtils';
import { WorkoutTemplate } from '../../src/features/templates/types';
import { workoutRepository, WorkoutSession } from '../../src/features/workout';

type FormExercise = Omit<TemplateExercise, 'order'>;

export default function CreateTemplateScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const router = useRouter();

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<FormExercise[]>([]);
  const [activeFocus, setActiveFocus] = useState<string>('Other');
  const [sequenceNumber, setSequenceNumber] = useState<number>(1);
  const [allTemplates, setAllTemplates] = useState<WorkoutTemplate[]>([]);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutSession[]>([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      const tpls = await templateRepository.getTemplates();
      const completed = await workoutRepository.getCompletedWorkouts();
      setAllWorkouts(completed);
      setAllTemplates(tpls);
    }
    load();
  }, []);

  const handleAddExercise = (exercise: Exercise) => {
    // Check duplicate
    if (exercises.some((e) => e.exerciseId === exercise.id)) {
      setError(`"${exercise.name}" is already in this template.`);
      return;
    }

    setError(null);
    const newEntry: FormExercise = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      categoryName: exercise.categoryName,
      sets: 3,
      targetReps: '8-12',
      restTime: 90,
      targetWeight: undefined,
    };

    setExercises((prev) => [...prev, newEntry]);
  };

  React.useEffect(() => {
    if (exercises.length === 0) return;
    const focus = deriveWorkoutFocus(exercises);
    if (focus !== activeFocus) {
      const seq = getSuggestedSessionNumber(allWorkouts, focus);
      setActiveFocus(focus);
      setSequenceNumber(seq);
      // Auto-update name if it's currently generated or empty
      if (!name || name.includes(' — Session ')) {
        setName(`${focus} — Session ${seq}`);
      }
    }
  }, [exercises, allTemplates]);

  const handleFocusChange = (newFocus: string) => {
    const seq = getSuggestedSessionNumber(allWorkouts, newFocus);
    setActiveFocus(newFocus);
    setSequenceNumber(seq);
    setName(`${newFocus} — Session ${seq}`);
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((e) => e.exerciseId !== exerciseId));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setExercises((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= exercises.length - 1) return;
    setExercises((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleUpdateExercise = (index: number, field: keyof FormExercise, value: any) => {
    setExercises((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }

    if (exercises.length === 0) {
      setError('Template requires at least one exercise.');
      return;
    }

    setSaving(true);

    try {
      await templateRepository.createTemplate({
        name: name.trim(),
        workoutFocus: activeFocus,
        sequenceNumber,
        exercises,
      });

      router.back();
    } catch (err: any) {
      setError(err?.message || 'Failed to create template.');
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        testID="create-template-keyboard-view"
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Navigation Bar */}
          <View style={styles.navBar}>
            <Button
              testID="create-template-back-button"
              title="← Cancel"
              onPress={() => router.back()}
              variant="ghost"
              size="sm"
              style={styles.backButton}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text variant="titleLarge" color="primary" testID="create-template-title">
              New Workout Template
            </Text>
            <Text variant="caption" color="muted">
              Configure exercise sequence, target sets, and reps
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <Card style={styles.errorCard} testID="template-error-banner">
              <Text variant="caption" color="primary">
                {error}
              </Text>
            </Card>
          ) : null}

          {/* Template Name Input */}
          <View style={styles.formGroup}>
            <Text variant="label" color="secondary" style={{ marginBottom: spacing.xs }}>
              WORKOUT FOCUS
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

            <Text variant="label" color="secondary">
              TEMPLATE NAME *
            </Text>
            <TextInput
              testID="template-name-input"
              style={styles.input}
              placeholder="e.g. Upper Body Hypertrophy A"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          {/* Exercise Section Header */}
          <View style={styles.sectionHeader}>
            <View>
              <Text variant="label" color="secondary">
                EXERCISES IN PLAN ({exercises.length})
              </Text>
              <Text variant="caption" color="muted">
                Add movements and plan target values
              </Text>
            </View>

            <Button
              testID="add-exercise-button"
              title="+ Add Exercise"
              onPress={() => setIsPickerVisible(true)}
              variant="secondary"
              size="sm"
            />
          </View>

          {/* Empty Exercise State */}
          {exercises.length === 0 ? (
            <Card style={styles.emptyExercisesCard} testID="template-no-exercises-card">
              <Text variant="body" color="muted" style={styles.centerText}>
                {'No exercises added yet. Tap "+ Add Exercise" to choose from the library.'}
              </Text>
            </Card>
          ) : null}

          {/* Exercises List */}
          {exercises.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === exercises.length - 1;

            return (
              <Card
                key={item.exerciseId}
                style={styles.exerciseCard}
                testID={`template-exercise-item-${item.exerciseId}`}
              >
                {/* Exercise Header & Order Controls */}
                <View style={styles.exerciseCardHeader}>
                  <View style={styles.exerciseTitleGroup}>
                    <Text
                      testID={`order-label-${item.exerciseId}`}
                      variant="label"
                      color="accent"
                      style={styles.orderLabel}
                    >
                      #{index + 1}
                    </Text>
                    <Text
                      variant="bodyBold"
                      color="primary"
                      numberOfLines={2}
                      style={styles.exerciseName}
                    >
                      {item.exerciseName}
                    </Text>
                  </View>

                  <View style={styles.controlButtonGroup}>
                    <Pressable
                      testID={`move-up-${item.exerciseId}`}
                      onPress={() => handleMoveUp(index)}
                      disabled={isFirst}
                      style={[styles.arrowButton, isFirst && styles.buttonDisabled]}
                      hitSlop={8}
                    >
                      <Text
                        variant="caption"
                        color={isFirst ? 'muted' : 'primary'}
                        style={styles.controlIcon}
                      >
                        ▲
                      </Text>
                    </Pressable>

                    <Pressable
                      testID={`move-down-${item.exerciseId}`}
                      onPress={() => handleMoveDown(index)}
                      disabled={isLast}
                      style={[styles.arrowButton, isLast && styles.buttonDisabled]}
                      hitSlop={8}
                    >
                      <Text
                        variant="caption"
                        color={isLast ? 'muted' : 'primary'}
                        style={styles.controlIcon}
                      >
                        ▼
                      </Text>
                    </Pressable>

                    <Pressable
                      testID={`remove-exercise-${item.exerciseId}`}
                      onPress={() => handleRemoveExercise(item.exerciseId)}
                      style={styles.removeButton}
                      hitSlop={8}
                    >
                      <Text variant="caption" color="muted" style={styles.removeIcon}>
                        ✕
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Targets Grid: 2x2 Responsive Layout */}
                <View style={styles.gridContainer}>
                  <View style={styles.gridRow}>
                    {/* Sets */}
                    <View style={styles.gridColumn}>
                      <Text variant="caption" color="muted" style={styles.fieldLabel}>
                        SETS
                      </Text>
                      <TextInput
                        testID={`exercise-sets-${item.exerciseId}`}
                        style={styles.gridInput}
                        keyboardType="number-pad"
                        value={String(item.sets)}
                        onChangeText={(val) => {
                          const parsed = parseInt(val, 10);
                          handleUpdateExercise(index, 'sets', isNaN(parsed) ? 0 : parsed);
                        }}
                      />
                    </View>

                    {/* Target Reps */}
                    <View style={styles.gridColumn}>
                      <Text variant="caption" color="muted" style={styles.fieldLabel}>
                        TARGET REPS
                      </Text>
                      <TextInput
                        testID={`exercise-reps-${item.exerciseId}`}
                        style={styles.gridInput}
                        placeholder="e.g. 8-10"
                        placeholderTextColor={colors.textMuted}
                        value={item.targetReps}
                        onChangeText={(val) => handleUpdateExercise(index, 'targetReps', val)}
                      />
                    </View>
                  </View>

                  <View style={styles.gridRow}>
                    {/* Rest (sec) */}
                    <View style={styles.gridColumn}>
                      <Text variant="caption" color="muted" style={styles.fieldLabel}>
                        REST (SEC)
                      </Text>
                      <TextInput
                        testID={`exercise-rest-${item.exerciseId}`}
                        style={styles.gridInput}
                        keyboardType="number-pad"
                        value={String(item.restTime)}
                        onChangeText={(val) => {
                          const parsed = parseInt(val, 10);
                          handleUpdateExercise(index, 'restTime', isNaN(parsed) ? 0 : parsed);
                        }}
                      />
                    </View>

                    {/* Target Weight (kg) */}
                    <View style={styles.gridColumn}>
                      <Text variant="caption" color="muted" style={styles.fieldLabel}>
                        TARGET WEIGHT (KG)
                      </Text>
                      <TextInput
                        testID={`exercise-weight-${item.exerciseId}`}
                        style={styles.gridInput}
                        keyboardType="decimal-pad"
                        placeholder="Optional"
                        placeholderTextColor={colors.textMuted}
                        value={item.targetWeight !== undefined ? String(item.targetWeight) : ''}
                        onChangeText={(val) => {
                          if (val.trim() === '') {
                            handleUpdateExercise(index, 'targetWeight', undefined);
                          } else {
                            const parsed = parseFloat(val);
                            handleUpdateExercise(
                              index,
                              'targetWeight',
                              isNaN(parsed) ? undefined : parsed,
                            );
                          }
                        }}
                      />
                    </View>
                  </View>
                </View>
              </Card>
            );
          })}

          {/* Submit Action */}
          <Button
            testID="save-template-button"
            title="Save Template"
            onPress={handleSave}
            variant="primary"
            size="lg"
            loading={saving}
            disabled={saving}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        onSelectExercise={handleAddExercise}
        selectedExerciseIds={exercises.map((e) => e.exerciseId)}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
    gap: spacing.md,
  },
  navBar: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  backButton: {
    paddingHorizontal: 0,
    minHeight: 36,
  },
  header: {
    gap: 2,
  },
  errorCard: {
    backgroundColor: '#2A1215',
    borderColor: colors.error,
    padding: spacing.sm,
  },
  formGroup: {
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.textPrimary,
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  emptyExercisesCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    gap: spacing.md,
    padding: spacing.md,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.sm,
  },
  exerciseTitleGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    flex: 1,
    marginRight: spacing.sm,
  },
  orderLabel: {
    fontWeight: '800',
    marginTop: 1,
  },
  exerciseName: {
    flex: 1,
    lineHeight: 20,
  },
  controlButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  arrowButton: {
    backgroundColor: colors.surfaceElevated,
    minWidth: 36,
    minHeight: 32,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  controlIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  removeButton: {
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    fontSize: 15,
    fontWeight: '700',
  },
  gridContainer: {
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gridColumn: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  gridInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 44,
  },
  submitButton: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    minHeight: 50,
  },
});


