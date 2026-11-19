import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../../theme';
import {
  FONT_FAMILIES,
  NUMERIC_TABULAR_STYLE,
  radii,
  spacing,
  typography,
} from '../../../constants/theme';
import { exerciseRepository } from '../../exercises';
import { SEED_EXERCISES } from '../../exercises/storage/exerciseCacheStorage';
import type {
  AdminDirectoryUser,
  AssignedWorkoutRecord,
  SaveTrainerTemplateInput,
  TrainerExerciseSpec,
  TrainerWorkoutTemplate,
} from '../services/adminService';

const FOCUS_TAGS = ['Push', 'Pull', 'Legs', 'Upper', 'Full Body', 'Conditioning'] as const;

interface SafeCatalogOption {
  id: string;
  name: string;
  categoryName: string;
}

export interface AdminTrainerTemplatesTabProps {
  templates: TrainerWorkoutTemplate[];
  users: AdminDirectoryUser[];
  recentAssignments: AssignedWorkoutRecord[];
  preselectedUserIds: string[];
  adminUserId: string | null;
  onSaveTemplate: (input: SaveTrainerTemplateInput) => Promise<TrainerWorkoutTemplate>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onAssignTemplate: (input: {
    templateId: string;
    userIds: string[];
    trainerNote: string;
  }) => Promise<AssignedWorkoutRecord[]>;
}

const DEFAULT_CATALOG_OPTIONS: SafeCatalogOption[] = SEED_EXERCISES.slice(0, 12).map((ex) => ({
  id: ex.id,
  name: ex.name,
  categoryName: ex.categoryName,
}));

export function AdminTrainerTemplatesTab({
  templates,
  users,
  recentAssignments,
  preselectedUserIds,
  adminUserId,
  onSaveTemplate,
  onDeleteTemplate,
  onAssignTemplate,
}: AdminTrainerTemplatesTabProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Template Builder state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [focusTag, setFocusTag] = useState<string>('Upper');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<TrainerExerciseSpec[]>([]);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Safe bitmap-free catalog exercise search
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState('all');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [catalogOptions, setCatalogOptions] = useState<SafeCatalogOption[]>(
    DEFAULT_CATALOG_OPTIONS,
  );

  // Assignment panel state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templates[0]?.id ?? null,
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(preselectedUserIds);
  const [assignNote, setAssignNote] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignConfirmation, setAssignConfirmation] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (preselectedUserIds.length > 0) {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...preselectedUserIds])));
    }
  }, [preselectedUserIds]);

  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    let active = true;
    const query = exerciseSearch.trim();
    const cat = exerciseCategoryFilter !== 'all' ? exerciseCategoryFilter : undefined;

    void (async () => {
      try {
        const res = await exerciseRepository.getExercises({
          query: query || undefined,
          category: cat,
          limit: 25,
          source: 'all',
        });
        if (!active) return;
        if (res?.exercises?.length) {
          // Strip bitmap/image payloads
          setCatalogOptions(
            res.exercises.slice(0, 25).map((ex) => ({
              id: ex.id,
              name: ex.name,
              categoryName: ex.categoryName,
            })),
          );
        } else {
          const seedMatches: SafeCatalogOption[] = SEED_EXERCISES.filter((ex) => {
            const matchesQuery = !query || ex.name.toLowerCase().includes(query.toLowerCase());
            const matchesCat = !cat || ex.categoryName.toLowerCase() === cat.toLowerCase();
            return matchesQuery && matchesCat;
          })
            .slice(0, 20)
            .map((ex) => ({ id: ex.id, name: ex.name, categoryName: ex.categoryName }));
          setCatalogOptions(seedMatches);
        }
      } catch {
        const seedMatches: SafeCatalogOption[] = SEED_EXERCISES.filter((ex) => {
          const matchesQuery = !query || ex.name.toLowerCase().includes(query.toLowerCase());
          const matchesCat = !cat || ex.categoryName.toLowerCase() === cat.toLowerCase();
          return matchesQuery && matchesCat;
        })
          .slice(0, 20)
          .map((ex) => ({ id: ex.id, name: ex.name, categoryName: ex.categoryName }));
        setCatalogOptions(seedMatches);
      }
    })();

    return () => {
      active = false;
    };
  }, [exerciseSearch, exerciseCategoryFilter]);

  const handleAddExercise = useCallback((option: SafeCatalogOption) => {
    setExercises((prev) => {
      if (prev.some((row) => row.exerciseId === option.id)) {
        return prev;
      }
      return [
        ...prev,
        {
          exerciseId: option.id,
          exerciseName: option.name,
          categoryName: option.categoryName,
          sets: 3,
          targetReps: '8-12',
          restTime: 90,
        },
      ];
    });
    setBuilderError(null);
  }, []);

  const handleAddCustomExercise = useCallback(() => {
    const trimmed = customExerciseName.trim();
    if (!trimmed) return;
    const id = `custom_tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    handleAddExercise({
      id,
      name: trimmed,
      categoryName: 'Custom',
    });
    setCustomExerciseName('');
  }, [customExerciseName, handleAddExercise]);

  const handleUpdateExerciseField = useCallback(
    (
      exerciseId: string,
      field: 'sets' | 'targetReps' | 'restTime',
      value: string,
    ) => {
      setExercises((prev) =>
        prev.map((row) => {
          if (row.exerciseId !== exerciseId) return row;
          if (field === 'sets') {
            const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
            return { ...row, sets: Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 1 };
          }
          if (field === 'restTime') {
            const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
            return {
              ...row,
              restTime: Number.isFinite(parsed) && parsed >= 15 ? Math.min(parsed, 600) : 60,
            };
          }
          return { ...row, targetReps: value.slice(0, 24) };
        }),
      );
    },
    [],
  );

  const handleRemoveExercise = useCallback((exerciseId: string) => {
    setExercises((prev) => prev.filter((row) => row.exerciseId !== exerciseId));
  }, []);

  const resetBuilder = useCallback(() => {
    setEditingTemplateId(null);
    setTitle('');
    setFocusTag('Upper');
    setDescription('');
    setExercises([]);
    setBuilderError(null);
  }, []);

  const handleEditTemplate = useCallback((tpl: TrainerWorkoutTemplate) => {
    setEditingTemplateId(tpl.id);
    setTitle(tpl.title);
    setFocusTag(tpl.focus_tag || 'Full Body');
    setDescription(tpl.description || '');
    setExercises(tpl.exercises);
    setBuilderError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setBuilderError('Enter a template title.');
      return;
    }
    if (exercises.length === 0) {
      setBuilderError('Add at least one exercise from the catalog.');
      return;
    }

    setBuilderError(null);
    setIsSaving(true);
    try {
      const saved = await onSaveTemplate({
        id: editingTemplateId ?? undefined,
        title: title.trim(),
        focus_tag: focusTag,
        description: description.trim(),
        exercises,
        createdBy: adminUserId,
      });
      setSelectedTemplateId(saved.id);
      resetBuilder();
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : 'Unable to save template.');
    } finally {
      setIsSaving(false);
    }
  }, [title, exercises, editingTemplateId, focusTag, description, adminUserId, onSaveTemplate, resetBuilder]);

  const toggleSelectUser = useCallback((uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
    setAssignError(null);
  }, []);

  const handleAssignSubmit = useCallback(async () => {
    if (!selectedTemplateId) {
      setAssignError('Select a saved trainer template first.');
      return;
    }
    if (selectedUserIds.length === 0) {
      setAssignError('Select at least one athlete from the directory.');
      return;
    }

    setAssignError(null);
    setAssignConfirmation(null);
    setIsAssigning(true);
    try {
      const created = await onAssignTemplate({
        templateId: selectedTemplateId,
        userIds: selectedUserIds,
        trainerNote: assignNote.trim(),
      });
      const tplName =
        templates.find((tpl) => tpl.id === selectedTemplateId)?.title ?? 'Workout';
      setAssignConfirmation(
        `Assigned "${tplName}" to ${created.length} ${created.length === 1 ? 'athlete' : 'athletes'}`,
      );
      setAssignNote('');
      setSelectedUserIds([]);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign workout.');
    } finally {
      setIsAssigning(false);
    }
  }, [selectedTemplateId, selectedUserIds, assignNote, onAssignTemplate, templates]);

  return (
    <View testID="admin-panel-templates" style={styles.container}>
      {/* 1. Reusable Trainer Template Builder */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {editingTemplateId ? 'Edit Trainer Template' : 'Trainer Workout Template Builder'}
        </Text>
        <Text style={styles.helperText}>
          Templates live in an isolated trainer catalog and never overwrite an athlete&apos;s personal routines.
        </Text>

        <TextInput
          testID="trainer-tpl-title-input"
          style={styles.textInput}
          placeholder="Template title (e.g., Upper Hypertrophy A)"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={140}
        />

        <View style={styles.chipRow}>
          {FOCUS_TAGS.map((tag) => {
            const active = focusTag === tag;
            return (
              <Pressable
                key={tag}
                testID={`trainer-focus-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFocusTag(tag)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          testID="trainer-tpl-description-input"
          style={[styles.textInput, styles.textArea]}
          placeholder="Default trainer coaching cues / description..."
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={2}
          maxLength={1000}
        />

        {/* Safe Bitmap-Free Exercise Picker */}
        <View style={styles.pickerBox} testID="trainer-exercise-library-picker">
          <Text style={styles.subHeading}>Search Exercise Library</Text>
          <TextInput
            testID="trainer-exercise-search-input"
            style={styles.textInput}
            placeholder="Search catalog (e.g., Bench, Squat, Row)..."
            placeholderTextColor={colors.textMuted}
            value={exerciseSearch}
            onChangeText={setExerciseSearch}
          />

          {/* Muscle / Category Filter Chips */}
          <View style={styles.catalogFilterRow}>
            {['all', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'].map((cat) => {
              const isSelected = exerciseCategoryFilter === cat;
              return (
                <Pressable
                  key={cat}
                  testID={`trainer-category-filter-${cat.toLowerCase()}`}
                  style={[styles.smallFilterChip, isSelected && styles.smallFilterChipActive]}
                  onPress={() => setExerciseCategoryFilter(cat)}
                >
                  <Text
                    style={[
                      styles.smallFilterChipText,
                      isSelected && styles.smallFilterChipTextActive,
                    ]}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.catalogChipWrap}>
            {catalogOptions.slice(0, 20).map((opt) => {
              const added = exercises.some((e) => e.exerciseId === opt.id);
              return (
                <Pressable
                  key={opt.id}
                  testID={`trainer-catalog-add-${opt.id}`}
                  style={[styles.catalogChip, added && styles.catalogChipAdded]}
                  onPress={() => handleAddExercise(opt)}
                >
                  <Text
                    style={[
                      styles.catalogChipText,
                      added && { color: colors.secondaryAccent },
                    ]}
                  >
                    {added ? `✓ ${opt.name}` : `+ ${opt.name}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Optional Custom Exercise Input */}
          <View style={styles.customAddRow}>
            <TextInput
              testID="trainer-custom-exercise-input"
              style={[styles.textInput, styles.customAddInput]}
              placeholder="Or type custom exercise name..."
              placeholderTextColor={colors.textMuted}
              value={customExerciseName}
              onChangeText={setCustomExerciseName}
            />
            <Pressable
              testID="trainer-add-custom-btn"
              style={styles.addCustomBtn}
              onPress={handleAddCustomExercise}
            >
              <Text style={styles.addCustomBtnText}>+ Add Custom</Text>
            </Pressable>
          </View>
        </View>

        {/* Added Exercise Rows */}
        {exercises.length > 0 ? (
          <View style={styles.selectedExercisesList}>
            <Text style={styles.subHeading}>
              Selected Exercises ({exercises.length})
            </Text>
            {exercises.map((ex) => (
              <View
                key={ex.exerciseId}
                testID={`trainer-exercise-row-${ex.exerciseId}`}
                style={styles.exerciseRow}
              >
                <View style={styles.exerciseRowTop}>
                  <View style={styles.exerciseNameCol}>
                    <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
                    <Text style={styles.exerciseCategory}>{ex.categoryName}</Text>
                  </View>
                  <Pressable
                    testID={`trainer-exercise-remove-${ex.exerciseId}`}
                    onPress={() => handleRemoveExercise(ex.exerciseId)}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>

                <View style={styles.exerciseInputsRow}>
                  <View style={styles.metricInputCol}>
                    <Text style={styles.metricInputLabel}>Sets</Text>
                    <TextInput
                      testID={`trainer-sets-${ex.exerciseId}`}
                      style={styles.metricInput}
                      keyboardType="number-pad"
                      value={String(ex.sets)}
                      onChangeText={(v) => handleUpdateExerciseField(ex.exerciseId, 'sets', v)}
                    />
                  </View>
                  <View style={styles.metricInputCol}>
                    <Text style={styles.metricInputLabel}>Target Reps</Text>
                    <TextInput
                      testID={`trainer-reps-${ex.exerciseId}`}
                      style={styles.metricInput}
                      value={ex.targetReps}
                      onChangeText={(v) =>
                        handleUpdateExerciseField(ex.exerciseId, 'targetReps', v)
                      }
                    />
                  </View>
                  <View style={styles.metricInputCol}>
                    <Text style={styles.metricInputLabel}>Rest (s)</Text>
                    <TextInput
                      testID={`trainer-rest-${ex.exerciseId}`}
                      style={styles.metricInput}
                      keyboardType="number-pad"
                      value={String(ex.restTime)}
                      onChangeText={(v) => handleUpdateExerciseField(ex.exerciseId, 'restTime', v)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {builderError ? (
          <Text style={styles.errorText} testID="trainer-builder-error">
            {builderError}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            testID="trainer-tpl-save-button"
            style={styles.primaryButton}
            onPress={() => {
              void handleSave();
            }}
            disabled={isSaving}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving
                ? 'Saving...'
                : editingTemplateId
                  ? 'Update Template'
                  : 'Save Template'}
            </Text>
          </Pressable>

          {editingTemplateId ? (
            <Pressable style={styles.secondaryButton} onPress={resetBuilder}>
              <Text style={styles.secondaryButtonText}>Cancel Edit</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 2. Saved Trainer Templates */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Saved Trainer Templates ({templates.length})</Text>
        {templates.length === 0 ? (
          <Text style={styles.helperText}>
            No trainer templates yet. Build one above to assign to athletes.
          </Text>
        ) : (
          templates.map((tpl) => {
            const isSelected = selectedTemplateId === tpl.id;
            return (
              <View
                key={tpl.id}
                testID={`trainer-template-card-${tpl.id}`}
                style={[styles.templateRow, isSelected && styles.templateRowSelected]}
              >
                <View style={styles.templateInfoCol}>
                  <View style={styles.templateMetaRow}>
                    <Text style={styles.focusBadge}>{tpl.focus_tag.toUpperCase()}</Text>
                    <Text style={styles.exerciseCountMeta}>
                      {tpl.exercises.length} exercises
                    </Text>
                  </View>
                  <Text style={styles.templateTitle}>{tpl.title}</Text>
                  {tpl.description ? (
                    <Text style={styles.templateDesc} numberOfLines={2}>
                      {tpl.description}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.templateActions}>
                  <Pressable
                    testID={`trainer-tpl-select-${tpl.id}`}
                    style={[styles.smallBtn, isSelected && styles.smallBtnActive]}
                    onPress={() => setSelectedTemplateId(tpl.id)}
                  >
                    <Text
                      style={[
                        styles.smallBtnText,
                        isSelected && { color: colors.primaryText },
                      ]}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`trainer-tpl-edit-${tpl.id}`}
                    style={styles.smallBtn}
                    onPress={() => handleEditTemplate(tpl)}
                  >
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    testID={`trainer-tpl-delete-${tpl.id}`}
                    style={styles.smallDangerBtn}
                    onPress={() => {
                      void onDeleteTemplate(tpl.id);
                    }}
                  >
                    <Text style={styles.smallDangerBtnText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* 3. Assign Template to Selected Athletes */}
      <View style={styles.card} testID="trainer-assign-panel">
        <Text style={styles.sectionTitle}>Assign Template to Athletes</Text>
        <Text style={styles.helperText}>
          Assigned workouts appear in each athlete&apos;s dedicated &quot;Assigned by Trainer&quot; inbox without modifying their own routines.
        </Text>

        {users.length === 0 ? (
          <Text style={styles.helperText}>
            No directory athletes loaded yet. Refresh once the M2 User Directory migration is active.
          </Text>
        ) : (
          <View style={styles.athleteSelectGrid}>
            {users.map((u) => {
              const checked = selectedUserIds.includes(u.user_id);
              return (
                <Pressable
                  key={u.user_id}
                  testID={`assign-select-user-${u.user_id}`}
                  style={[styles.athleteChip, checked && styles.athleteChipSelected]}
                  onPress={() => toggleSelectUser(u.user_id)}
                >
                  <Text
                    style={[
                      styles.athleteChipText,
                      checked && { color: colors.primaryText },
                    ]}
                  >
                    {checked ? '✓ ' : ''}
                    {u.full_name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <TextInput
          testID="trainer-assign-note-input"
          style={styles.textInput}
          placeholder="Optional note for selected athletes (e.g., Focus on slow eccentrics)"
          placeholderTextColor={colors.textMuted}
          value={assignNote}
          onChangeText={setAssignNote}
          maxLength={1000}
        />

        {assignError ? (
          <Text style={styles.errorText} testID="trainer-assign-error">
            {assignError}
          </Text>
        ) : null}

        {assignConfirmation ? (
          <View style={styles.successBanner} testID="trainer-assign-confirmation">
            <Text style={styles.successBannerText}>✓ {assignConfirmation}</Text>
          </View>
        ) : null}

        <Pressable
          testID="trainer-assign-submit-button"
          style={styles.primaryButton}
          onPress={() => {
            void handleAssignSubmit();
          }}
          disabled={isAssigning}
        >
          <Text style={styles.primaryButtonText}>
            {isAssigning
              ? 'Assigning...'
              : `Assign Selected (${selectedUserIds.length})`}
          </Text>
        </Pressable>

        {recentAssignments.length > 0 ? (
          <View style={styles.recentBox}>
            <Text style={styles.subHeading}>
              Recent Assignments ({recentAssignments.length})
            </Text>
            {recentAssignments.slice(0, 6).map((item) => (
              <View key={item.id} style={styles.recentRow}>
                <Text style={styles.recentTitle}>{item.title}</Text>
                <Text style={styles.recentMeta}>
                  {item.status.toUpperCase()} · {item.exercises.length} exercises
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
      width: '100%',
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
      width: '100%',
    },
    sectionTitle: {
      ...typography.titleMedium,
      fontFamily: FONT_FAMILIES.display,
      color: colors.textPrimary,
    },
    subHeading: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodyBold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
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
      width: '100%',
    },
    textArea: {
      minHeight: 68,
      textAlignVertical: 'top',
      width: '100%',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
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
    pickerBox: {
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      padding: spacing.sm + 2,
      gap: spacing.sm,
    },
    catalogFilterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    smallFilterChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.xs,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    smallFilterChipActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(0, 229, 153, 0.12)',
    },
    smallFilterChipText: {
      fontSize: 11,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textSecondary,
    },
    smallFilterChipTextActive: {
      color: colors.primaryText,
      fontWeight: '700',
    },
    customAddRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 4,
    },
    customAddInput: {
      flex: 1,
      marginBottom: 0,
    },
    addCustomBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addCustomBtnText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.primary,
      fontWeight: '700',
    },
    catalogChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    catalogChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 6,
    },
    catalogChipAdded: {
      borderColor: 'rgba(0, 229, 153, 0.45)',
      backgroundColor: 'rgba(0, 229, 153, 0.08)',
    },
    catalogChipText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textPrimary,
    },
    selectedExercisesList: {
      gap: spacing.sm,
    },
    exerciseRow: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      padding: spacing.sm + 2,
      gap: spacing.xs + 2,
    },
    exerciseRowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    exerciseNameCol: {
      flex: 1,
    },
    exerciseName: {
      ...typography.bodyBold,
      color: colors.textPrimary,
    },
    exerciseCategory: {
      ...typography.caption,
      color: colors.textMuted,
    },
    removeText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.error,
    },
    exerciseInputsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      width: '100%',
    },
    metricInputCol: {
      flex: 1,
      minWidth: 65,
      gap: 3,
    },
    metricInputLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    metricInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      color: colors.textPrimary,
      ...typography.bodySmall,
      ...NUMERIC_TABULAR_STYLE,
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
      alignItems: 'center',
    },
    secondaryButtonText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
    errorText: {
      ...typography.caption,
      color: colors.error,
    },
    successBanner: {
      backgroundColor: 'rgba(0, 229, 153, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(0, 229, 153, 0.35)',
      borderRadius: radii.sm,
      padding: spacing.sm + 2,
    },
    successBannerText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.secondaryAccent,
    },
    templateRow: {
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
    templateRowSelected: {
      borderColor: colors.primary,
    },
    templateInfoCol: {
      flex: 1,
      minWidth: 180,
      gap: 2,
    },
    templateMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    focusBadge: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodyBold,
      color: colors.primary,
    },
    exerciseCountMeta: {
      ...typography.caption,
      ...NUMERIC_TABULAR_STYLE,
      color: colors.textMuted,
    },
    templateTitle: {
      ...typography.bodyBold,
      color: colors.textPrimary,
    },
    templateDesc: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    templateActions: {
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
    smallBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
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
    athleteSelectGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    athleteChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: colors.background,
    },
    athleteChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    athleteChipText: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textPrimary,
    },
    recentBox: {
      marginTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
      gap: 6,
    },
    recentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    recentTitle: {
      ...typography.caption,
      fontFamily: FONT_FAMILIES.bodySemiBold,
      color: colors.textPrimary,
    },
    recentMeta: {
      ...typography.caption,
      ...NUMERIC_TABULAR_STYLE,
      color: colors.textMuted,
    },
  });
