import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../../theme';
import {
  FONT_FAMILIES,
  NUMERIC_TABULAR_STYLE,
  radii,
  spacing,
  typography,
} from '../../../constants/theme';
import type { ExerciseCategory } from '../../exercises/types';
import type {
  GlobalExerciseRecord,
  SaveGlobalExerciseInput,
} from '../../exercises/services/globalExerciseCatalogService';

const CATEGORY_OPTIONS: { id: ExerciseCategory; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'legs', label: 'Legs' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'abs', label: 'Abs' },
  { id: 'calves', label: 'Calves' },
  { id: 'cardio', label: 'Cardio' },
];

export interface AdminExerciseCatalogTabProps {
  exercises: GlobalExerciseRecord[];
  adminUserId: string | null;
  onSaveExercise: (input: SaveGlobalExerciseInput) => Promise<GlobalExerciseRecord>;
  onToggleActive: (id: string, nextActive: boolean) => Promise<void>;
  onDeleteExercise: (id: string) => Promise<void>;
}

function splitCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function splitInstructionLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function AdminExerciseCatalogTab({
  exercises,
  adminUserId,
  onSaveExercise,
  onToggleActive,
  onDeleteExercise,
}: AdminExerciseCatalogTabProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | ExerciseCategory>('all');

  // Form state (strictly text/metadata-only, zero bitmap/image fields)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('chest');
  const [equipment, setEquipment] = useState('Barbell');
  const [primaryMusclesText, setPrimaryMusclesText] = useState('');
  const [secondaryMusclesText, setSecondaryMusclesText] = useState('');
  const [instructionsText, setInstructionsText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyRowIds, setBusyRowIds] = useState<Record<string, boolean>>({});

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return exercises.filter((item) => {
      if (filterCategory !== 'all' && item.category !== filterCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.equipment.toLowerCase().includes(q) ||
        item.primary_muscles.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [exercises, searchQuery, filterCategory]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setCategory('chest');
    setEquipment('Barbell');
    setPrimaryMusclesText('');
    setSecondaryMusclesText('');
    setInstructionsText('');
    setFormError(null);
  }, []);

  const handleStartEdit = useCallback((item: GlobalExerciseRecord) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setEquipment(item.equipment);
    setPrimaryMusclesText(item.primary_muscles.join(', '));
    setSecondaryMusclesText(item.secondary_muscles.join(', '));
    setInstructionsText(item.instructions.join('\n'));
    setFormError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const primaryList = splitCommaList(primaryMusclesText);
    if (!name.trim()) {
      setFormError('Enter an exercise name.');
      return;
    }
    if (primaryList.length === 0) {
      setFormError('Enter at least one primary muscle (comma-separated).');
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      await onSaveExercise({
        id: editingId ?? undefined,
        name: name.trim(),
        category,
        equipment: equipment.trim() || 'Bodyweight',
        primary_muscles: primaryList,
        secondary_muscles: splitCommaList(secondaryMusclesText),
        instructions: splitInstructionLines(instructionsText),
        createdBy: adminUserId,
      });
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save global exercise.');
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    category,
    equipment,
    primaryMusclesText,
    secondaryMusclesText,
    instructionsText,
    editingId,
    adminUserId,
    onSaveExercise,
    resetForm,
  ]);

  const handleToggle = useCallback(
    async (item: GlobalExerciseRecord) => {
      setBusyRowIds((prev) => ({ ...prev, [item.id]: true }));
      try {
        await onToggleActive(item.id, !item.is_active);
      } finally {
        setBusyRowIds((prev) => ({ ...prev, [item.id]: false }));
      }
    },
    [onToggleActive],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setBusyRowIds((prev) => ({ ...prev, [id]: true }));
      try {
        await onDeleteExercise(id);
        if (editingId === id) {
          resetForm();
        }
      } finally {
        setBusyRowIds((prev) => ({ ...prev, [id]: false }));
      }
    },
    [onDeleteExercise, editingId, resetForm],
  );

  return (
    <View testID="admin-panel-catalog" style={styles.container}>
      {/* 1. Create / Edit Curated Exercise Form */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {editingId ? 'Edit Curated Global Exercise' : 'Add Curated Global Exercise'}
        </Text>
        <Text style={styles.helperText}>
          Text &amp; metadata only (zero bitmaps). Merges into the global catalog without ever modifying an athlete&apos;s custom exercises.
        </Text>

        <TextInput
          testID="global-ex-name-input"
          style={styles.textInput}
          placeholder="Exercise name (e.g., Pendulum Squat)"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={140}
        />

        <View style={styles.chipRow}>
          {CATEGORY_OPTIONS.map((opt) => {
            const active = category === opt.id;
            return (
              <Pressable
                key={opt.id}
                testID={`global-ex-cat-${opt.id}`}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategory(opt.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          testID="global-ex-equipment-input"
          style={styles.textInput}
          placeholder="Equipment (e.g., Machine, Barbell, Dumbbell, Cable machine)"
          placeholderTextColor={colors.textMuted}
          value={equipment}
          onChangeText={setEquipment}
          maxLength={80}
        />

        <TextInput
          testID="global-ex-primary-input"
          style={styles.textInput}
          placeholder="Primary muscles (comma-separated, e.g., Quadriceps, Glutes)"
          placeholderTextColor={colors.textMuted}
          value={primaryMusclesText}
          onChangeText={setPrimaryMusclesText}
          maxLength={240}
        />

        <TextInput
          testID="global-ex-secondary-input"
          style={styles.textInput}
          placeholder="Secondary muscles (optional, comma-separated, e.g., Adductors, Core)"
          placeholderTextColor={colors.textMuted}
          value={secondaryMusclesText}
          onChangeText={setSecondaryMusclesText}
          maxLength={240}
        />

        <TextInput
          testID="global-ex-instructions-input"
          style={[styles.textInput, styles.textArea]}
          placeholder="Step-by-step form cues (one step per line)..."
          placeholderTextColor={colors.textMuted}
          value={instructionsText}
          onChangeText={setInstructionsText}
          multiline
          numberOfLines={3}
          maxLength={2000}
        />

        {formError ? (
          <Text style={styles.errorText} testID="global-ex-form-error">
            {formError}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            testID="global-ex-save-button"
            style={styles.primaryButton}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={isSaving}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Saving...' : editingId ? 'Update Exercise' : 'Save Global Exercise'}
            </Text>
          </Pressable>

          {editingId ? (
            <Pressable style={styles.secondaryButton} onPress={resetForm}>
              <Text style={styles.secondaryButtonText}>Cancel Edit</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 2. Search & Manage Curated Global Exercises */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Curated Global Catalog ({filteredExercises.length}/{exercises.length})
        </Text>

        <TextInput
          testID="admin-catalog-search-input"
          style={styles.textInput}
          placeholder="Search curated exercises by name, muscle, or equipment..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.chipRow}>
          <Pressable
            testID="admin-catalog-filter-all"
            style={[styles.chip, filterCategory === 'all' && styles.chipActive]}
            onPress={() => setFilterCategory('all')}
          >
            <Text style={[styles.chipText, filterCategory === 'all' && styles.chipTextActive]}>
              All
            </Text>
          </Pressable>
          {CATEGORY_OPTIONS.map((opt) => {
            const active = filterCategory === opt.id;
            return (
              <Pressable
                key={`filter_${opt.id}`}
                testID={`admin-catalog-filter-${opt.id}`}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilterCategory(opt.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filteredExercises.length === 0 ? (
          <Text style={styles.helperText} testID="admin-catalog-empty">
            No curated global exercises match the current filter.
          </Text>
        ) : (
          filteredExercises.map((item) => {
            const isBusy = Boolean(busyRowIds[item.id]);
            return (
              <View
                key={item.id}
                testID={`global-ex-row-${item.id}`}
                style={styles.exerciseRow}
              >
                <View style={styles.rowInfoCol}>
                  <View style={styles.rowMeta}>
                    <Text style={styles.categoryTag}>{item.category.toUpperCase()}</Text>
                    <Text style={styles.equipmentTag}>{item.equipment}</Text>
                    <Text
                      style={[
                        styles.stateTag,
                        item.is_active
                          ? { color: colors.secondaryAccent }
                          : { color: colors.textMuted },
                      ]}
                    >
                      {item.is_active ? 'ACTIVE' : 'HIDDEN'}
                    </Text>
                  </View>

                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowMuscles}>
                    Primary: {item.primary_muscles.join(', ')}
                    {item.secondary_muscles.length > 0
                      ? ` · Secondary: ${item.secondary_muscles.join(', ')}`
                      : ''}
                  </Text>
                  {item.instructions.length > 0 ? (
                    <Text style={styles.rowInstructionsCount}>
                      {item.instructions.length}{' '}
                      {item.instructions.length === 1 ? 'form cue' : 'form cues'}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.rowActions}>
                  <Pressable
                    testID={`global-ex-edit-${item.id}`}
                    style={styles.smallBtn}
                    onPress={() => handleStartEdit(item)}
                    disabled={isBusy}
                  >
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    testID={`global-ex-toggle-${item.id}`}
                    style={styles.smallBtn}
                    onPress={() => {
                      void handleToggle(item);
                    }}
                    disabled={isBusy}
                  >
                    <Text style={styles.smallBtnText}>
                      {item.is_active ? 'Hide' : 'Activate'}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`global-ex-delete-${item.id}`}
                    style={styles.smallDangerBtn}
                    onPress={() => {
                      void handleDelete(item.id);
                    }}
                    disabled={isBusy}
                  >
                    <Text style={styles.smallDangerBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.titleMedium,
      ...NUMERIC_TABULAR_STYLE,
      fontFamily: FONT_FAMILIES.display,
      color: colors.textPrimary,
    },
    helperText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    textInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      ...typography.body,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: 5,
      borderRadius: radii.full,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.primaryText,
    },
    errorText: {
      ...typography.caption,
      color: colors.error,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    primaryButtonText: {
      ...typography.bodyBold,
      color: colors.primaryText,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    secondaryButtonText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
    exerciseRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm + 2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      backgroundColor: colors.background,
    },
    rowInfoCol: {
      flex: 1,
      minWidth: 200,
      gap: 2,
    },
    rowMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
    },
    categoryTag: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodyBold,
      color: colors.primary,
    },
    equipmentTag: {
      ...typography.caption,
      color: colors.textMuted,
    },
    stateTag: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
    },
    rowTitle: {
      ...typography.bodyBold,
      color: colors.textPrimary,
    },
    rowMuscles: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    rowInstructionsCount: {
      ...typography.caption,
      ...NUMERIC_TABULAR_STYLE,
      color: colors.textMuted,
    },
    rowActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    smallBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
      backgroundColor: colors.surface,
    },
    smallBtnText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textSecondary,
    },
    smallDangerBtn: {
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.45)',
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
    },
    smallDangerBtnText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.error,
    },
  });
