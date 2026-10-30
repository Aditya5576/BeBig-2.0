/**
 * BeBig 2.0 — Canonical Custom Exercise Creation Form
 *
 * Ground-truth unified custom exercise creation form shared identically by:
 * 1. Exercise Library (`/exercises/new`)
 * 2. Ongoing Workout exercise picker (`ExercisePickerModal`)
 * 3. Workout Template exercise pickers (`ExercisePickerModal`)
 *
 * Guarantees:
 * - Identical fields, layout, styling, and validation across all entry points.
 * - Full photo picking, local persistence, cloud upload, replacement, and removal.
 * - Muscle groups, equipment, and form cues / notes input.
 * - Safe dirty-state discard confirmation.
 * - Pure callback delegation (`onSuccess`, `onCancel`) preserving caller context.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme';
import { ScreenContainer, Text, Button, Card, useBottomContentInset } from '../../../components/ui';
import {
  exerciseRepository,
  STANDARD_CATEGORIES,
  STANDARD_EQUIPMENT,
} from '../services/exerciseRepository';
import {
  exercisePhotoStorage,
  pickExercisePhoto,
  base64ToUint8Array,
} from '../storage/exercisePhotoStorage';
import {
  exercisePhotoCloudService,
} from '../services/exercisePhotoCloudService';
import { Exercise, ExerciseCategory } from '../types';
import { useAuthStore } from '../../auth';
import { spacing, radii } from '../../../constants/theme';

export interface CustomExerciseFormProps {
  onSuccess: (created: Exercise) => void | Promise<void>;
  onCancel: () => void;
  submitButtonTitle?: string;
  cancelButtonTitle?: string;
  title?: string;
  subtitle?: string;
  isModal?: boolean;
}

export function CustomExerciseForm({
  onSuccess,
  onCancel,
  submitButtonTitle = 'Save Custom Exercise',
  cancelButtonTitle = '← Cancel',
  title = 'New Custom Exercise',
  subtitle = 'Create a custom movement stored locally on your device',
  isModal = false,
}: CustomExerciseFormProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    // Fallback if rendered outside SafeAreaProvider
  }
  const bottomInset = useBottomContentInset();

  const nameInputRef = useRef<TextInput>(null);
  const primaryMusclesRef = useRef<TextInput>(null);
  const secondaryMusclesRef = useRef<TextInput>(null);
  const instructionsRef = useRef<TextInput>(null);
  const fileInputRef = useRef<any>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('chest');
  const [equipment, setEquipment] = useState('Barbell');
  const [primaryMuscles, setPrimaryMuscles] = useState('');
  const [secondaryMuscles, setSecondaryMuscles] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<{
    uri: string;
    base64?: string;
    mimeType: string;
    file?: any;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    name.trim().length > 0 ||
    description.trim().length > 0 ||
    primaryMuscles.trim().length > 0 ||
    secondaryMuscles.trim().length > 0 ||
    photoUri !== null;

  const handlePickPhoto = async () => {
    Keyboard.dismiss();
    try {
      const picked = await pickExercisePhoto();
      if (picked.canceled) {
        if (picked.error) {
          Alert.alert('Permission Required', picked.error);
        }
        return;
      }
      if (picked.error) {
        Alert.alert('Invalid Photo', picked.error);
        return;
      }
      if (!picked.uri) return;

      setPhotoUri(picked.uri);
      setPhotoData({
        uri: picked.uri,
        base64: picked.base64,
        mimeType: picked.mimeType || 'image/jpeg',
      });
      setError(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not select photo.');
    }
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    if (isDirty) {
      Alert.alert(
        'Discard Changes?',
        'Are you sure you want to discard this custom exercise? Your input will be lost.',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onCancel },
        ],
      );
    } else {
      onCancel();
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss();
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

      const created = await exerciseRepository.createCustomExercise({
        name: name.trim(),
        category,
        equipment: equipment ? [equipment] : [],
        primaryMuscles: pMuscles.length > 0 ? pMuscles : ['General'],
        secondaryMuscles: sMuscles,
        description: description.trim(),
      });

      let updatedExercise = created;

      if (photoData) {
        const localUri = await exercisePhotoStorage.saveLocalPhoto(created.id, {
          uri: photoData.uri,
          mimeType: photoData.mimeType,
          base64: photoData.base64,
        });

        let photoPath: string | null = null;
        const user = useAuthStore.getState().user;
        if (user) {
          try {
            const uploadPayload =
              photoData.file ||
              (photoData.base64 ? base64ToUint8Array(photoData.base64) : null);
            if (uploadPayload) {
              const uploadRes = await exercisePhotoCloudService.uploadPhoto(
                user.id,
                created.id,
                uploadPayload,
                photoData.mimeType,
              );
              photoPath = uploadRes.storagePath;
            }
          } catch (uploadErr: any) {
            // Local durability preserved
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.warn('[CreateCustomExercise] Photo cloud upload failed, preserved locally:', uploadErr?.message);
            }
          }
        }

        updatedExercise = await exerciseRepository.updateCustomExercise({
          id: created.id,
          images: [{ id: `photo_${created.id}`, url: localUri, isMain: true }],
          photoPath,
        });
      }

      await onSuccess(updatedExercise);
    } catch (err: any) {
      setError(err?.message || 'Failed to save custom exercise.');
      setSaving(false);
    }
  };

  const formBody = (
    <KeyboardAvoidingView
      testID="custom-exercise-keyboard-view"
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <ScrollView
        testID="custom-exercise-scroll-view"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <Pressable
            testID="custom-exercise-cancel-button"
            onPress={handleCancel}
            accessible={false}
          >
            <Button
              testID="create-custom-back-button"
              title={cancelButtonTitle}
              onPress={handleCancel}
              variant="ghost"
              size="sm"
              style={styles.backButton}
            />
          </Pressable>
          <Button
            testID="create-custom-header-save-button"
            title="Save"
            onPress={handleSave}
            variant="primary"
            size="sm"
            loading={saving}
            disabled={saving}
          />
        </View>

        {/* Header Title & Subtitle */}
        <View style={styles.header}>
          <Text variant="titleLarge" color="primary" testID="create-custom-title">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Error Banner */}
        {error ? (
          <View testID="custom-exercise-error">
            <Card style={styles.errorCard} testID="create-custom-error">
              <Text variant="caption" color="primary">
                {error}
              </Text>
            </Card>
          </View>
        ) : null}

        {/* Exercise Name */}
        <View style={styles.formGroup}>
          <Text variant="label" color="secondary">
            EXERCISE NAME *
          </Text>
          <TextInput
            ref={nameInputRef}
            testID="custom-exercise-name-input"
            style={styles.input}
            placeholder="e.g. Incline Smith Machine Press"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => primaryMusclesRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        {/* Exercise Photo Section */}
        <View style={styles.formGroup} testID="photo-picker-section">
          <Text variant="label" color="secondary">
            EXERCISE PHOTO (OPTIONAL)
          </Text>
          {photoUri ? (
            <View style={styles.photoPreviewCard}>
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                resizeMode="cover"
                testID="exercise-photo-preview"
              />
              <View style={styles.photoActionsRow}>
                <Button
                  testID="replace-photo-button"
                  title="Replace Photo"
                  variant="secondary"
                  size="sm"
                  onPress={handlePickPhoto}
                />
                <Button
                  testID="remove-photo-button"
                  title="Remove"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    setPhotoUri(null);
                    setPhotoData(null);
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.uploadRow}>
              <Button
                testID="add-photo-button"
                title="📷 Add Exercise Photo"
                variant="secondary"
                size="md"
                onPress={handlePickPhoto}
              />
            </View>
          )}

          {Platform.OS === 'web' && typeof document !== 'undefined' && (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={(e: any) => {
                const file = e.target?.files?.[0];
                if (!file) return;
                const validation = exercisePhotoStorage.validatePhotoFile(file);
                if (!validation.valid) {
                  setError(validation.error || 'Invalid photo file.');
                  return;
                }
                setError(null);
                const mimeType = file.type || 'image/jpeg';
                const previewUrl =
                  typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64Url = reader.result as string;
                  const commaIdx = base64Url.indexOf(',');
                  const base64 = commaIdx !== -1 ? base64Url.slice(commaIdx + 1) : '';
                  setPhotoUri(previewUrl || base64Url);
                  setPhotoData({
                    uri: previewUrl || base64Url,
                    base64,
                    mimeType,
                    file,
                  });
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
          )}
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
                  onPress={() => {
                    Keyboard.dismiss();
                    setCategory(cat.id);
                  }}
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
                  onPress={() => {
                    Keyboard.dismiss();
                    setEquipment(eq);
                  }}
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
            ref={primaryMusclesRef}
            testID="custom-exercise-muscles-input"
            style={styles.input}
            placeholder="e.g. Upper Chest, Front Delts"
            placeholderTextColor={colors.textMuted}
            value={primaryMuscles}
            onChangeText={setPrimaryMuscles}
            returnKeyType="next"
            onSubmitEditing={() => secondaryMusclesRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        {/* Secondary Muscles */}
        <View style={styles.formGroup}>
          <Text variant="label" color="secondary">
            SECONDARY MUSCLES (OPTIONAL)
          </Text>
          <TextInput
            ref={secondaryMusclesRef}
            testID="custom-exercise-secondary-muscles-input"
            style={styles.input}
            placeholder="e.g. Triceps"
            placeholderTextColor={colors.textMuted}
            value={secondaryMuscles}
            onChangeText={setSecondaryMuscles}
            returnKeyType="next"
            onSubmitEditing={() => instructionsRef.current?.focus()}
            blurOnSubmit={false}
          />
        </View>

        {/* Instructions / Form Notes */}
        <View style={styles.formGroup}>
          <Text variant="label" color="secondary">
            FORM INSTRUCTIONS / NOTES (OPTIONAL)
          </Text>
          <TextInput
            ref={instructionsRef}
            testID="custom-exercise-instructions-input"
            style={[styles.input, styles.multilineInput]}
            placeholder="Add key form cues, grip setup, or execution tips..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            returnKeyType="default"
          />
        </View>

        {/* Submit Actions */}
        <Pressable
          testID="save-custom-exercise-button"
          onPress={handleSave}
          disabled={saving}
          style={styles.submitButtonWrapper}
        >
          <Button
            testID="custom-exercise-submit-button"
            title={submitButtonTitle}
            onPress={handleSave}
            variant="primary"
            size="lg"
            loading={saving}
            disabled={saving}
            style={styles.submitButton}
          />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (isModal) {
    return formBody;
  }

  return <ScreenContainer>{formBody}</ScreenContainer>;
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    keyboardAvoiding: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingVertical: spacing.md,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    chipSelected: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primary,
    },
    chipText: {
      fontWeight: '600',
    },
    submitButtonWrapper: {
      width: '100%',
    },
    submitButton: {
      marginTop: spacing.md,
    },
    photoPreviewCard: {
      borderRadius: radii.md,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: spacing.sm,
      gap: spacing.sm,
      alignItems: 'center',
    },
    photoPreview: {
      width: '100%',
      height: 180,
      borderRadius: radii.sm,
    },
    photoActionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    uploadRow: {
      flexDirection: 'row',
    },
  });
