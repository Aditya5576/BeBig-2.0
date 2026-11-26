import { useAppTheme } from '../../src/features/theme';
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, Pressable, Modal, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer, Text, Button, Card, useBottomContentInset, SyncStatusChip, Icon } from '../../src/components/ui';
import * as FileSystem from 'expo-file-system/legacy';
import { DOMAIN_LIMITS } from '../../src/constants/domainLimits';
import {
  exerciseRepository,
  exercisePhotoStorage,
  exercisePhotoCloudService,
  pickExercisePhoto,
  base64ToUint8Array,
  downscaleWebImageToMaxEdge,
  PhotoSyncStatusInfo,
  Exercise,
  resolveExerciseDemonstration,
  hasCustomPhoto,
  getCustomPhotoUri,
} from '../../src/features/exercises';
import { useAuthStore } from '../../src/features/auth';
import { spacing, radii } from '../../src/constants/theme';
import { useEntitySyncStatus } from '../../src/services/sync';

function CustomExerciseSyncStatus({ exerciseId, isCustom }: { exerciseId: string; isCustom: boolean }) {
  const status = useEntitySyncStatus('custom_exercise', exerciseId);
  if (!isCustom) return null;
  return <SyncStatusChip status={status} />;
}

function CustomExercisePhotoSyncChip({
  status,
  onRetry,
}: {
  status: PhotoSyncStatusInfo;
  onRetry?: () => void;
}) {
  let label = 'Photo: Local Only';
  let badgeColor = '#666';

  if (status.state === 'syncing') {
    label = 'Photo: Syncing...';
    badgeColor = '#3B82F6';
  } else if (status.state === 'synced') {
    label = 'Photo: Synced';
    badgeColor = '#10B981';
  } else if (status.state === 'sync_failed') {
    label = 'Photo: Sync Failed';
    badgeColor = '#EF4444';
  }

  return (
    <View style={{ gap: 4 }} testID="photo-sync-chip">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: radii.full,
            backgroundColor: badgeColor + '22',
            borderWidth: 1,
            borderColor: badgeColor,
          }}
        >
          <Text variant="caption" style={{ color: badgeColor, fontWeight: '600' }}>
            {label}
          </Text>
        </View>
        {status.state === 'sync_failed' && onRetry ? (
          <Pressable testID="retry-photo-sync-button" onPress={onRetry}>
            <Text variant="caption" color="accent" style={{ textDecorationLine: 'underline' }}>
              Retry
            </Text>
          </Pressable>
        ) : null}
      </View>
      {status.state === 'sync_failed' && status.errorMessage ? (
        <Text
          variant="caption"
          color="muted"
          testID="photo-sync-error-message"
          style={{ fontSize: 11, maxWidth: 280 }}
        >
          {status.errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

export default function ExerciseDetailScreen() {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottomInset = useBottomContentInset();

  const [exercise, setExercise] = useState<Exercise | null>(() => {
    if (!id) return null;
    return exerciseRepository.getCachedExerciseByIdSync(id);
  });
  const [loading, setLoading] = useState<boolean>(() => !exercise);
  const [deleting, setDeleting] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [photoSyncStatus, setPhotoSyncStatus] = useState<PhotoSyncStatusInfo>({ state: 'local_only' });
  const fileInputRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailImageError, setDetailImageError] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const handleSaveRename = async () => {
    if (!exercise) return;
    try {
      setRenameSaving(true);
      setRenameError(null);
      const updated = await exerciseRepository.renameExercise(exercise.id, renameInput);
      setExercise(updated);
      setIsRenameModalOpen(false);
    } catch (err: any) {
      setRenameError(err?.message || 'Could not rename exercise.');
    } finally {
      setRenameSaving(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadExercise() {
      if (!id) return;
      if (!exercise) {
        setLoading(true);
      }
      setError(null);

      try {
        const item = await exerciseRepository.getExerciseById(id);
        if (isMounted) {
          setExercise(item);
          if (item?.id && item.isCustom) {
            void exercisePhotoCloudService.getSyncStatus(item.id).then((status) => {
              if (isMounted) setPhotoSyncStatus(status);
            });
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setExercise((prev) => {
            if (!prev) {
              setError(err?.message || 'Failed to load exercise details.');
            }
            return prev;
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadExercise();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handlePickPhoto = async () => {
    if (!exercise || updatingPhoto) return;
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

      await handleApplyPhoto({
        uri: picked.uri,
        base64: picked.base64,
        mimeType: picked.mimeType,
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not select photo.');
    }
  };

  const handleApplyPhoto = async (photo: {
    uri: string;
    base64?: string;
    mimeType?: string;
    file?: any;
  }) => {
    if (!exercise) return;
    setUpdatingPhoto(true);
    try {
      const mimeType = photo.mimeType || 'image/jpeg';

      // 1. Local durable save first (offline-first)
      const localUri = await exercisePhotoStorage.saveLocalPhoto(exercise.id, {
        uri: photo.uri,
        mimeType,
        base64: photo.base64,
      });

      // 2. Update exercise locally immediately
      const updatedExercise = await exerciseRepository.updateCustomExercise({
        id: exercise.id,
        images: [{ id: `photo_${exercise.id}`, url: localUri, isMain: true }],
      });
      setExercise(updatedExercise);

      // 3. Upload to private cloud if authenticated
      const user = useAuthStore.getState().user;
      if (user) {
        try {
          const uploadPayload =
            photo.file ||
            (photo.base64 ? base64ToUint8Array(photo.base64) : null);
          if (uploadPayload) {
            const uploadRes = await exercisePhotoCloudService.uploadPhoto(
              user.id,
              exercise.id,
              uploadPayload,
              mimeType,
            );
            const withCloud = await exerciseRepository.updateCustomExercise({
              id: exercise.id,
              photoPath: uploadRes.storagePath,
            });
            setExercise(withCloud);
            setPhotoSyncStatus({ state: 'synced', storagePath: uploadRes.storagePath });
          } else {
            setPhotoSyncStatus({ state: 'local_only' });
          }
        } catch (uploadErr: any) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn('[ExerciseDetail] Photo cloud upload failed:', uploadErr?.message);
          }
          setPhotoSyncStatus({
            state: 'sync_failed',
            errorMessage: uploadErr?.message || 'Upload failed. Local copy preserved.',
          });
        }
      } else {
        setPhotoSyncStatus({ state: 'local_only' });
      }
    } catch (err: any) {
      Alert.alert('Photo Error', err?.message || 'Failed to update exercise photo.');
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const handlePhotoRemovePrompt = () => {
    Alert.alert(
      'Remove Photo?',
      'Are you sure you want to remove the photo from this custom exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: handlePhotoRemove },
      ],
    );
  };

  const handlePhotoRemove = async () => {
    if (!exercise) return;
    setUpdatingPhoto(true);
    try {
      const user = useAuthStore.getState().user;
      if (user && exercise.photoPath) {
        void exercisePhotoCloudService.deletePhoto(user.id, exercise.photoPath).catch(() => {});
      }
      await exercisePhotoStorage.deleteLocalPhoto(exercise.id);
      const updated = await exerciseRepository.updateCustomExercise({
        id: exercise.id,
        images: [],
        photoPath: null,
      });
      setExercise(updated);
      setPhotoSyncStatus({ state: 'local_only' });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to remove photo.');
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const handleRetryPhotoSync = async () => {
    if (!exercise) return;
    const user = useAuthStore.getState().user;
    if (!user) return;

    setPhotoSyncStatus({ state: 'syncing' });
    try {
      const localPhoto = await exercisePhotoStorage.getLocalPhoto(exercise.id);
      if (!localPhoto) {
        setPhotoSyncStatus({ state: 'local_only' });
        return;
      }
      let payload: any = localPhoto;
      if (typeof localPhoto === 'string' && localPhoto.startsWith('data:')) {
        const commaIdx = localPhoto.indexOf(',');
        payload = base64ToUint8Array(commaIdx !== -1 ? localPhoto.slice(commaIdx + 1) : localPhoto);
      } else if (typeof localPhoto === 'string' && (localPhoto.startsWith('file://') || localPhoto.startsWith('/'))) {
        try {
          const base64Content = await FileSystem.readAsStringAsync(localPhoto, {
            encoding: FileSystem.EncodingType.Base64,
          });
          payload = base64ToUint8Array(base64Content);
        } catch {
          if (typeof fetch !== 'undefined') {
            const resp = await fetch(localPhoto);
            payload = await resp.blob();
          }
        }
      }
      const mimeType = localPhoto.endsWith('.png')
        ? 'image/png'
        : localPhoto.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';

      const uploadRes = await exercisePhotoCloudService.uploadPhoto(
        user.id,
        exercise.id,
        payload,
        mimeType,
      );
      const withCloud = await exerciseRepository.updateCustomExercise({
        id: exercise.id,
        photoPath: uploadRes.storagePath,
      });
      setExercise(withCloud);
      setPhotoSyncStatus({ state: 'synced', storagePath: uploadRes.storagePath });
    } catch (err: any) {
      setPhotoSyncStatus({
        state: 'sync_failed',
        errorMessage: err?.message || 'Retry failed. Check network connection.',
      });
    }
  };

  const handleDeletePrompt = () => {
    Alert.alert(
      'Delete Custom Exercise?',
      'Are you sure you want to delete this custom exercise? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDelete,
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!exercise || !exercise.isCustom) return;
    setDeleting(true);
    try {
      await exerciseRepository.deleteCustomExercise(exercise.id);
      router.back();
    } catch (err: any) {
      setDeleting(false);
      Alert.alert('Delete Failed', err?.message || 'Failed to delete custom exercise.');
    }
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} testID="detail-loading" />
        <Text variant="caption" color="muted">
          Loading exercise details...
        </Text>
      </ScreenContainer>
    );
  }

  if (error || !exercise) {
    return (
      <ScreenContainer style={styles.centerContainer}>
        <Text variant="titleMedium" color="primary">
          Exercise Not Found
        </Text>
        <Text variant="body" color="muted" style={styles.errorSubtext}>
          {error || 'The requested exercise could not be found or has been removed.'}
        </Text>
        <Button
          testID="detail-back-button"
          title="Back to Exercises"
          onPress={() => router.back()}
          variant="secondary"
          size="md"
        />
      </ScreenContainer>
    );
  }

  // Media priority:
  // 1. User's custom photo for custom exercises
  // 2. Approved curated Wger demonstration
  // 3. Existing provider image fallback
  // 4. Clean fallback when no media exists
  const customPhotoUri = exercise.isCustom && hasCustomPhoto(exercise)
    ? getCustomPhotoUri(exercise)
    : null;

  const curatedResolution = !exercise.isCustom
    ? resolveExerciseDemonstration(exercise)
    : null;

  const approvedCuratedDemo = curatedResolution?.status === 'approved'
    ? curatedResolution.demonstration
    : null;

  const rawProviderImage = !customPhotoUri && !approvedCuratedDemo && exercise.images && exercise.images.length > 0
    ? exercise.images.find((img) => img.isMain) || exercise.images[0]
    : null;

  const displayImageUri =
    customPhotoUri ||
    approvedCuratedDemo?.demonstrationUri ||
    approvedCuratedDemo?.thumbnailUri ||
    (exercise.photoPath && (exercise.photoPath.startsWith('https://') || exercise.photoPath.startsWith('http://'))
      ? exercise.photoPath
      : null) ||
    rawProviderImage?.url ||
    null;

  const hasCustomExercisePhoto =
    exercise.isCustom && (Boolean(customPhotoUri) || Boolean(exercise.images && exercise.images.length > 0));

  const primaryMusclesText =
    exercise.primaryMuscles && exercise.primaryMuscles.length > 0
      ? exercise.primaryMuscles.map((m) => m.name).join(', ')
      : null;

  const secondaryMusclesText =
    exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0
      ? exercise.secondaryMuscles.map((m) => m.name).join(', ')
      : null;

  const equipmentText =
    exercise.equipment && exercise.equipment.length > 0
      ? exercise.equipment.map((e) => e.name).join(', ')
      : null;

  const hasInfoRows = primaryMusclesText || secondaryMusclesText || equipmentText;
  const hasDescription = Boolean(exercise.description && exercise.description.trim().length > 0);

  return (
    <ScreenContainer>
      <ScrollView
        testID="exercise-detail-scroll-view"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <Button
            testID="detail-back-button"
            title="Back"
            icon="chevronLeft"
            onPress={() => router.back()}
            variant="ghost"
            size="sm"
            style={styles.backButton}
          />
        </View>

        {/* Exercise Demonstration Image & Attribution */}
        {displayImageUri && !detailImageError ? (
          <View style={styles.mediaWrapper}>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: displayImageUri }}
                style={styles.exerciseImage}
                contentFit="contain"
                transition={150}
                cachePolicy="disk"
                recyclingKey={displayImageUri}
                onError={() => setDetailImageError(true)}
                testID="exercise-detail-image"
              />
            </View>
            {approvedCuratedDemo ? (
              <View style={styles.attributionContainer} testID="exercise-detail-attribution">
                <Text variant="caption" color="muted" style={styles.attributionText}>
                  Demonstration: {approvedCuratedDemo.license.author} • {approvedCuratedDemo.license.type}
                </Text>
              </View>
            ) : null}
          </View>
        ) : displayImageUri && detailImageError ? (
          <View style={styles.mediaWrapper}>
            <View style={styles.imageContainer} testID="exercise-detail-placeholder">
              <Icon name="workout" size={44} color={colors.textMuted} />
              <Text variant="caption" color="muted" style={{ marginTop: 8 }}>
                Demonstration image unavailable
              </Text>
            </View>
          </View>
        ) : null}

        {/* Custom Exercise Photo Actions */}
        {exercise.isCustom ? (
          <View style={styles.photoActionsContainer} testID="custom-exercise-photo-actions">
            {hasCustomExercisePhoto ? (
              <View style={styles.photoControlsRow}>
                <Button
                  testID="replace-photo-button"
                  title="Replace Photo"
                  variant="secondary"
                  size="sm"
                  loading={updatingPhoto}
                  disabled={updatingPhoto}
                  onPress={handlePickPhoto}
                />
                <Button
                  testID="remove-photo-button"
                  title="Remove Photo"
                  variant="ghost"
                  size="sm"
                  disabled={updatingPhoto}
                  onPress={handlePhotoRemovePrompt}
                />
              </View>
            ) : (
              <View style={styles.photoControlsRow}>
                <Button
                  testID="add-photo-button"
                  title="📷 Add Exercise Photo"
                  variant="secondary"
                  size="sm"
                  loading={updatingPhoto}
                  disabled={updatingPhoto}
                  onPress={handlePickPhoto}
                />
              </View>
            )}
            <CustomExercisePhotoSyncChip status={photoSyncStatus} onRetry={handleRetryPhotoSync} />
            {Platform.OS === 'web' && typeof document !== 'undefined' && (
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={async (e: any) => {
                  const file = e.target?.files?.[0];
                  e.target.value = '';
                  if (file) {
                    const validation = exercisePhotoStorage.validatePhotoFile(file);
                    if (!validation.valid) {
                      Alert.alert('Invalid Photo', validation.error || 'Please select a valid image file.');
                      return;
                    }
                    const downscaled = await downscaleWebImageToMaxEdge(file);
                    if (downscaled) {
                      void handleApplyPhoto({
                        uri: downscaled.dataUrl,
                        base64: downscaled.base64,
                        file: downscaled.blob,
                        mimeType: downscaled.mimeType,
                      });
                    } else {
                      const previewUrl =
                        typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
                      void handleApplyPhoto({ uri: previewUrl, file, mimeType: file.type || 'image/jpeg' });
                    }
                  }
                }}
              />
            )}
          </View>
        ) : null}

        {/* Title & Metadata */}
        <View style={styles.headerSection}>
          <View style={styles.badgeRow}>
            {exercise.categoryName ? (
              <View style={styles.categoryBadge}>
                <Text variant="caption" color="accent" style={styles.badgeText}>
                  {exercise.categoryName.toUpperCase()}
                </Text>
              </View>
            ) : null}

            {exercise.isCustom ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.customBadge} testID="detail-custom-badge">
                  <Text variant="caption" color="accent" style={styles.badgeText}>
                    Source: Custom
                  </Text>
                </View>
                <CustomExerciseSyncStatus exerciseId={exercise.id} isCustom={exercise.isCustom} />
              </View>
            ) : null}
          </View>

          <View style={styles.nameHeaderRow}>
            <Text variant="display" color="primary" testID="exercise-detail-name" style={{ flex: 1 }}>
              {exercise.name}
            </Text>
            <Button
              testID="detail-rename-exercise-button"
              title="Rename"
              onPress={() => {
                setRenameInput(exercise.name);
                setRenameError(null);
                setIsRenameModalOpen(true);
              }}
              variant="outline"
              size="sm"
            />
          </View>

          <Button
            testID="exercise-detail-view-progression-button"
            title="📊 View Performance Progression"
            onPress={() =>
              router.push({
                pathname: '/workout/progress/exercise/[id]',
                params: { id: exercise.id, name: exercise.name },
              } as any)
            }
            variant="primary"
            size="md"
            style={{ marginTop: spacing.sm }}
          />
        </View>

        {/* Anatomy & Equipment Card */}
        {hasInfoRows ? (
          <Card style={styles.infoCard}>
            {primaryMusclesText ? (
              <View style={[styles.infoRow, (!secondaryMusclesText && !equipmentText) && styles.noBorder]}>
                <Text variant="label" color="muted">
                  PRIMARY MUSCLES
                </Text>
                <Text variant="bodyBold" color="primary" testID="detail-primary-muscles">
                  {primaryMusclesText}
                </Text>
              </View>
            ) : null}

            {secondaryMusclesText ? (
              <View style={[styles.infoRow, !equipmentText && styles.noBorder]}>
                <Text variant="label" color="muted">
                  SECONDARY MUSCLES
                </Text>
                <Text variant="body" color="secondary" testID="detail-secondary-muscles">
                  {secondaryMusclesText}
                </Text>
              </View>
            ) : null}

            {equipmentText ? (
              <View style={[styles.infoRow, styles.noBorder]}>
                <Text variant="label" color="muted">
                  EQUIPMENT
                </Text>
                <Text variant="bodyBold" color="accent" testID="detail-equipment">
                  {equipmentText}
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Notes & Form / Instructions Card */}
        {hasDescription ? (
          <Card style={styles.instructionsCard}>
            <Text variant="titleMedium" color="primary" style={styles.instructionsTitle}>
              {exercise.isCustom ? 'Notes & Form' : 'Instructions & Form'}
            </Text>
            <Text
              variant="body"
              color="secondary"
              style={styles.instructionsText}
              testID="exercise-detail-instructions"
            >
              {exercise.description}
            </Text>
          </Card>
        ) : null}

        {/* Delete Action for Custom Exercises */}
        {exercise.isCustom ? (
          <View style={styles.actionSection}>
            <Button
              testID="delete-custom-exercise-button"
              title="Delete Custom Exercise"
              onPress={handleDeletePrompt}
              variant="outline"
              size="md"
              loading={deleting}
              disabled={deleting}
              style={styles.deleteButton}
            />
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={isRenameModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !renameSaving && setIsRenameModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.renameModalCard}>
            <Text variant="titleMedium" color="primary">
              Rename Exercise
            </Text>
            <TextInput
              testID="detail-rename-exercise-input"
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Exercise name"
              placeholderTextColor={colors.textMuted}
              maxLength={DOMAIN_LIMITS.EXERCISE_NAME_MAX_LENGTH}
              style={styles.renameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleSaveRename()}
            />
            {renameError ? (
              <Text variant="caption" style={{ color: colors.error || '#EF4444' }}>
                {renameError}
              </Text>
            ) : null}
            <View style={styles.renameActions}>
              <Button
                testID="detail-cancel-rename-button"
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => setIsRenameModalOpen(false)}
                disabled={renameSaving}
              />
              <Button
                testID="detail-save-rename-button"
                title="Save"
                variant="primary"
                size="sm"
                loading={renameSaving}
                onPress={() => void handleSaveRename()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingHorizontal: 0,
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
  },
  mediaWrapper: {
    width: '100%',
    gap: spacing.xs,
  },
  attributionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  attributionText: {
    fontSize: 11,
    textAlign: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  headerSection: {
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customBadge: {
    backgroundColor: '#1E2C1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    gap: spacing.md,
  },
  infoRow: {
    gap: 4,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  noBorder: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  instructionsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  instructionsTitle: {
    marginBottom: spacing.xs,
  },
  instructionsText: {
    lineHeight: 22,
  },
  actionSection: {
    marginTop: spacing.md,
  },
  deleteButton: {
    borderColor: colors.error || '#EF4444',
  },
  photoActionsContainer: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  photoControlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  renameModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    gap: spacing.md,
  },
  renameInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
