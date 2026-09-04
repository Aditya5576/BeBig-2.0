import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card } from '../../src/components/ui';
import {
  templateRepository,
  ExercisePickerModal,
  WorkoutTemplate,
  TemplateExercise,
} from '../../src/features/templates';
import { Exercise } from '../../src/features/exercises';
import { colors, spacing, radii } from '../../src/constants/theme';

type FormExercise = Omit<TemplateExercise, 'order'>;

export default function TemplateDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<FormExercise[]>([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTemplate() {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const item = await templateRepository.getTemplateById(id);
        if (isMounted) {
          if (item) {
            setTemplate(item);
            setName(item.name);
            setExercises(
              item.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                exerciseName: e.exerciseName,
                categoryName: e.categoryName,
                sets: e.sets,
                targetReps: e.targetReps,
                restTime: e.restTime,
                targetWeight: e.targetWeight,
              })),
            );
          } else {
            setTemplate(null);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to load template.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadTemplate();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleAddExercise = (exercise: Exercise) => {
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
    if (!id) return;
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
      await templateRepository.updateTemplate({
        id,
        name: name.trim(),
        exercises,
      });

      router.back();
    } catch (err: any) {
      setError(err?.message || 'Failed to update template.');
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id || !template) return;

    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await templateRepository.deleteTemplate(id);
            router.back();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
          color={colors.dark.primary}
          testID="template-detail-loading"
        />
        <Text variant="caption" color="muted">
          Loading workout plan...
        </Text>
      </ScreenContainer>
    );
  }

  if (!template) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <Text variant="titleMedium" color="primary">
          Template Not Found
        </Text>
        <Text variant="body" color="muted" style={styles.errorSubtext}>
          {error || 'This workout template does not exist or was deleted.'}
        </Text>
        <Button
          testID="template-detail-back-button"
          title="Back to Templates"
          onPress={() => router.back()}
          variant="secondary"
          size="md"
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        testID="edit-template-keyboard-view"
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
          {/* Top Bar */}
          <View style={styles.navBar}>
            <Button
              testID="template-detail-back-button"
              title="← Templates"
              onPress={() => router.back()}
              variant="ghost"
              size="sm"
              style={styles.backButton}
            />

            <Button
              testID="delete-template-button"
              title="Delete"
              onPress={handleDelete}
              variant="ghost"
              size="sm"
              style={styles.deleteTopButton}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text variant="titleLarge" color="primary" testID="template-detail-title">
              Edit Template
            </Text>
            <Text variant="caption" color="muted">
              Update exercises, target sets, and reps
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <Card style={styles.errorCard} testID="template-edit-error-banner">
              <Text variant="caption" color="primary">
                {error}
              </Text>
            </Card>
          ) : null}

          {/* Template Name Input */}
          <View style={styles.formGroup}>
            <Text variant="label" color="secondary">
              TEMPLATE NAME
            </Text>
            <TextInput
              testID="template-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Exercises Header */}
          <View style={styles.sectionHeader}>
            <View>
              <Text variant="label" color="secondary">
                EXERCISES IN PLAN ({exercises.length})
              </Text>
              <Text variant="caption" color="muted">
                Order and configure planning targets
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
                {/* Header & Reordering */}
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
                        placeholderTextColor={colors.dark.textMuted}
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
                        placeholderTextColor={colors.dark.textMuted}
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

          {/* Action Buttons */}
          <Button
            testID="update-template-button"
            title="Save Changes"
            onPress={handleSave}
            variant="primary"
            size="lg"
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
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

const styles = StyleSheet.create({
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  backButton: {
    paddingHorizontal: 0,
    minHeight: 36,
  },
  deleteTopButton: {
    paddingHorizontal: 0,
    minHeight: 36,
  },
  header: {
    gap: 2,
  },
  errorCard: {
    backgroundColor: '#2A1215',
    borderColor: colors.dark.error,
    padding: spacing.sm,
  },
  formGroup: {
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.dark.textPrimary,
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  exerciseCard: {
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
    gap: spacing.md,
    padding: spacing.md,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
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
    backgroundColor: colors.dark.surfaceElevated,
    minWidth: 36,
    minHeight: 32,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.dark.border,
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
    backgroundColor: colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.dark.textPrimary,
    fontSize: 14,
    minHeight: 40,
  },
  saveButton: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    minHeight: 50,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorSubtext: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
});
