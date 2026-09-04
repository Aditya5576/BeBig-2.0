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
  exerciseRepository,
  ExerciseCategory,
  STANDARD_CATEGORIES,
  STANDARD_EQUIPMENT,
} from '../../src/features/exercises';
import { colors, spacing, radii } from '../../src/constants/theme';

export default function CreateCustomExerciseScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('chest');
  const [equipment, setEquipment] = useState('Barbell');
  const [primaryMuscles, setPrimaryMuscles] = useState('');
  const [secondaryMuscles, setSecondaryMuscles] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter an exercise name.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const pMuscles = primaryMuscles
        .split(',')
        .map((m) => m.trim())
        .filter((m) => m.length > 0);

      const sMuscles = secondaryMuscles
        .split(',')
        .map((m) => m.trim())
        .filter((m) => m.length > 0);

      await exerciseRepository.createCustomExercise({
        name: name.trim(),
        category,
        equipment: equipment ? [equipment] : [],
        primaryMuscles: pMuscles.length > 0 ? pMuscles : ['General'],
        secondaryMuscles: sMuscles,
        description: description.trim(),
      });

      router.back();
    } catch (err: any) {
      setError(err?.message || 'Failed to save custom exercise.');
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        testID="custom-exercise-keyboard-view"
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
              testID="create-custom-back-button"
              title="← Cancel"
              onPress={() => router.back()}
              variant="ghost"
              size="sm"
              style={styles.backButton}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text variant="titleLarge" color="primary" testID="create-custom-title">
              New Custom Exercise
            </Text>
            <Text variant="caption" color="muted">
              Create a custom movement stored locally on your device
            </Text>
          </View>

          {/* Error Banner */}
          {error ? (
            <Card style={styles.errorCard} testID="create-custom-error">
              <Text variant="caption" color="primary">
                {error}
              </Text>
            </Card>
          ) : null}

          {/* Form Fields */}
          <View style={styles.formGroup}>
            <Text variant="label" color="secondary">
              EXERCISE NAME *
            </Text>
            <TextInput
              testID="custom-exercise-name-input"
              style={styles.input}
              placeholder="e.g. Incline Smith Machine Press"
              placeholderTextColor={colors.dark.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          {/* Category Picker Chips */}
          <View style={styles.formGroup}>
            <Text variant="label" color="secondary">
              TARGET CATEGORY *
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {STANDARD_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    testID={`category-select-${cat.id}`}
                    onPress={() => setCategory(cat.id)}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                  >
                    <Text
                      variant="caption"
                      color={isSelected ? 'accent' : 'secondary'}
                      style={styles.chipText}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Equipment Selector */}
          <View style={styles.formGroup}>
            <Text variant="label" color="secondary">
              EQUIPMENT
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {STANDARD_EQUIPMENT.map((eq) => {
                const isSelected = equipment === eq;
                return (
                  <Pressable
                    key={eq}
                    testID={`equipment-select-${eq}`}
                    onPress={() => setEquipment(eq)}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                  >
                    <Text
                      variant="caption"
                      color={isSelected ? 'accent' : 'secondary'}
                      style={styles.chipText}
                    >
                      {eq}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Primary Muscles */}
          <View style={styles.formGroup}>
            <Text variant="label" color="secondary">
              PRIMARY MUSCLES (COMMA-SEPARATED)
            </Text>
            <TextInput
              testID="custom-exercise-muscles-input"
              style={styles.input}
              placeholder="e.g. Upper Chest, Front Delts"
              placeholderTextColor={colors.dark.textMuted}
              value={primaryMuscles}
              onChangeText={setPrimaryMuscles}
            />
          </View>

          {/* Secondary Muscles */}
          <View style={styles.formGroup}>
            <Text variant="label" color="secondary">
              SECONDARY MUSCLES (OPTIONAL)
            </Text>
            <TextInput
              testID="custom-exercise-secondary-muscles-input"
              style={styles.input}
              placeholder="e.g. Triceps"
              placeholderTextColor={colors.dark.textMuted}
              value={secondaryMuscles}
              onChangeText={setSecondaryMuscles}
            />
          </View>

          {/* Instructions / Form Notes */}
          <View style={styles.formGroup}>
            <Text variant="label" color="secondary">
              FORM INSTRUCTIONS / NOTES (OPTIONAL)
            </Text>
            <TextInput
              testID="custom-exercise-instructions-input"
              style={[styles.input, styles.multilineInput]}
              placeholder="Add key form cues, grip setup, or execution tips..."
              placeholderTextColor={colors.dark.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Submit Action */}
          <Button
            testID="custom-exercise-submit-button"
            title="Save Custom Exercise"
            onPress={handleSave}
            variant="primary"
            size="lg"
            loading={saving}
            disabled={saving}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  navBar: {
    flexDirection: 'row',
  },
  backButton: {
    paddingHorizontal: 0,
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
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  chipRow: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  chipSelected: {
    backgroundColor: colors.dark.surfaceElevated,
    borderColor: colors.dark.primary,
  },
  chipText: {
    fontWeight: '600',
  },
  submitButton: {
    marginTop: spacing.md,
  },
});
