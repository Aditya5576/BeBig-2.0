/**
 * BeBig 2.0 — Custom Exercise Photos Test Suite
 *
 * Covers:
 * 1. Selecting, replacing and removing a photo with validation (type, size).
 * 2. Local persistence across simulated app restarts (memory clear).
 * 3. Offline photo access with zero network dependencies.
 * 4. Private cloud upload to 'exercise-photos' bucket and cross-device download.
 * 5. Upload failure, retry and recovery while preserving local data.
 * 6. Guest-mode offline usage and safe account migration.
 * 7. User ownership isolation and prevention of cross-user storage tampering.
 * 8. Safe deletion and orphaned file cleanup.
 * 9. Compatibility with existing exercises, templates, and workout history.
 */

import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import {
  exercisePhotoStorage,
  MAX_PHOTO_SIZE_BYTES,
  ALLOWED_PHOTO_MIME_TYPES,
  pickExercisePhoto,
  base64ToUint8Array,
} from '../src/features/exercises/storage/exercisePhotoStorage';
import {
  exercisePhotoCloudService,
  EXERCISE_PHOTOS_BUCKET,
} from '../src/features/exercises/services/exercisePhotoCloudService';
import { guestMigrationService } from '../src/features/auth/services/guestMigrationService';
import { guestStorage } from '../src/lib/storage';
import { syncMetadataStore } from '../src/services/sync/syncMetadataStore';
import { syncEngine } from '../src/services/sync/syncEngine';
import { useAuthStore } from '../src/features/auth';
import { UserScope, AuthUser } from '../src/features/auth/types';
import { supabase } from '../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CreateCustomExerciseScreen from '../app/exercises/new';
import ExerciseDetailScreen from '../app/exercises/[id]';

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'custom_123' }),
  useFocusEffect: (cb: any) => {
    require('react').useEffect(cb, []);
  },
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn(() => () => {}),
}));

jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    isSupabaseConfigured: jest.fn(() => true),
  };
});

describe('BeBig 2.0 — Custom Exercise Photos: Local-First + Private Cloud Sync', () => {
  const userA: UserScope = { ownerId: 'usr_photo_alpha', ownerType: 'authenticated' };
  const userB: UserScope = { ownerId: 'usr_photo_beta', ownerType: 'authenticated' };
  const guestUser: UserScope = { ownerId: 'guest_photo_session', ownerType: 'guest' };

  let mockUpload: jest.Mock;
  let mockDownload: jest.Mock;
  let mockCreateSignedUrl: jest.Mock;
  let mockRemove: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    customExerciseStorage.clearMemoryCache();
    await customExerciseStorage.clearCustomExercises(userA);
    await customExerciseStorage.clearCustomExercises(userB);
    await customExerciseStorage.clearCustomExercises(guestUser);
    await guestStorage.clearGuestSession();
    syncMetadataStore.clearMemoryCache();
    await syncMetadataStore.resetUserState(userA.ownerId);
    await syncMetadataStore.resetUserState(userB.ownerId);

    // Setup Supabase Storage mock
    mockUpload = jest.fn().mockResolvedValue({
      data: { path: `${userA.ownerId}/custom_test/photo_123.jpg` },
      error: null,
    });
    mockDownload = jest.fn().mockResolvedValue({
      data: new Blob(['fake_image_bytes'], { type: 'image/jpeg' }),
      error: null,
    });
    mockCreateSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://supabase.co/storage/v1/object/sign/exercise-photos/signed?token=abc' },
      error: null,
    });
    mockRemove = jest.fn().mockResolvedValue({
      data: [{ name: 'photo_123.jpg' }],
      error: null,
    });

    (supabase.storage.from as jest.Mock) = jest.fn().mockReturnValue({
      upload: mockUpload,
      download: mockDownload,
      createSignedUrl: mockCreateSignedUrl,
      remove: mockRemove,
    });

    useAuthStore.setState({
      user: { id: userA.ownerId, email: 'alpha@bebig.app' } as AuthUser,
      isGuest: false,
      status: 'authenticated',
    });
  });

  describe('1. Selecting, Replacing and Removing Photos (Validation & Local CRUD)', () => {
    it('validates photo MIME types and file size correctly', () => {
      // Valid JPEG
      expect(
        exercisePhotoStorage.validatePhotoFile({ type: 'image/jpeg', size: 1024 * 1024 }).valid,
      ).toBe(true);

      // Valid PNG
      expect(
        exercisePhotoStorage.validatePhotoFile({ type: 'image/png', size: 500 * 1024 }).valid,
      ).toBe(true);

      // Valid WebP
      expect(
        exercisePhotoStorage.validatePhotoFile({ type: 'image/webp', size: 2 * 1024 * 1024 }).valid,
      ).toBe(true);

      // Invalid MIME type (PDF)
      const invalidType = exercisePhotoStorage.validatePhotoFile({ type: 'application/pdf', size: 1024 });
      expect(invalidType.valid).toBe(false);
      expect(invalidType.error).toMatch(/valid image file/i);

      // Oversized (> 5MB)
      const oversized = exercisePhotoStorage.validatePhotoFile({
        type: 'image/jpeg',
        size: MAX_PHOTO_SIZE_BYTES + 100,
      });
      expect(oversized.valid).toBe(false);
      expect(oversized.error).toMatch(/less than 5MB/i);

      // Empty / Null
      expect(exercisePhotoStorage.validatePhotoFile(null as any).valid).toBe(false);
    });

    it('saves a photo locally, replaces it, and removes it cleanly', async () => {
      const exercise = await exerciseRepository.createCustomExercise(
        {
          name: 'Incline Dumbbell Press',
          category: 'chest',
          primaryMuscles: ['Upper Chest'],
        },
        userA,
      );

      // 1. Add Photo
      const photo1 = 'data:image/jpeg;base64,sample_photo_base64_v1';
      const localUri1 = await exercisePhotoStorage.saveLocalPhoto(exercise.id, {
        uri: photo1,
        mimeType: 'image/jpeg',
      });
      expect(localUri1).toBeTruthy();

      const updated1 = await exerciseRepository.updateCustomExercise(
        {
          id: exercise.id,
          images: [{ id: `photo_${exercise.id}`, url: localUri1, isMain: true }],
        },
        userA,
      );
      expect(updated1.images).toHaveLength(1);
      expect(updated1.images[0].url).toBe(localUri1);

      // 2. Replace Photo
      const photo2 = 'data:image/png;base64,sample_photo_base64_v2_replacement';
      const localUri2 = await exercisePhotoStorage.saveLocalPhoto(exercise.id, {
        uri: photo2,
        mimeType: 'image/png',
      });
      expect(localUri2).toBeTruthy();

      const updated2 = await exerciseRepository.updateCustomExercise(
        {
          id: exercise.id,
          images: [{ id: `photo_${exercise.id}`, url: localUri2, isMain: true }],
        },
        userA,
      );
      expect(updated2.images[0].url).toBe(localUri2);

      // 3. Remove Photo
      await exercisePhotoStorage.deleteLocalPhoto(exercise.id);
      const updated3 = await exerciseRepository.updateCustomExercise(
        {
          id: exercise.id,
          images: [],
          photoPath: null,
        },
        userA,
      );
      expect(updated3.images).toHaveLength(0);
      expect(await exercisePhotoStorage.getLocalPhoto(exercise.id)).toBeNull();
    });
  });

  describe('2. Local Persistence Across App Restarts', () => {
    it('persists photo reference across memory cache purges', async () => {
      const exercise = await exerciseRepository.createCustomExercise(
        {
          name: 'Bulgarian Split Squat',
          category: 'legs',
          primaryMuscles: ['Quads', 'Glutes'],
        },
        userA,
      );

      const photoData = 'data:image/jpeg;base64,durable_photo_string';
      const savedUri = await exercisePhotoStorage.saveLocalPhoto(exercise.id, {
        uri: photoData,
        mimeType: 'image/jpeg',
      });

      await exerciseRepository.updateCustomExercise(
        {
          id: exercise.id,
          images: [{ id: `photo_${exercise.id}`, url: savedUri, isMain: true }],
        },
        userA,
      );

      // Simulate App Restart by clearing in-memory caches
      customExerciseStorage.clearMemoryCache();
      (exerciseRepository as any).invalidateCandidateCache();

      // Retrieve from cold storage
      const fetched = await exerciseRepository.getExerciseById(exercise.id, userA);
      expect(fetched).not.toBeNull();
      expect(fetched!.images).toHaveLength(1);
      expect(fetched!.images[0].url).toBe(savedUri);

      const localOnDisk = await exercisePhotoStorage.getLocalPhoto(exercise.id);
      expect(localOnDisk).toBe(savedUri);
    });
  });

  describe('3. Offline Photo Access', () => {
    it('guarantees custom exercise and photo are 100% accessible with no network', async () => {
      const exercise = await exerciseRepository.createCustomExercise(
        {
          name: 'Offline Hammer Curl',
          category: 'arms',
          primaryMuscles: ['Biceps', 'Brachialis'],
        },
        userA,
      );

      const photo = 'data:image/jpeg;base64,offline_image_bits';
      const localUri = await exercisePhotoStorage.saveLocalPhoto(exercise.id, {
        uri: photo,
      });

      await exerciseRepository.updateCustomExercise(
        {
          id: exercise.id,
          images: [{ id: `photo_${exercise.id}`, url: localUri, isMain: true }],
        },
        userA,
      );

      // Verify immediate retrieval works without any network call
      expect(supabase.storage.from).not.toHaveBeenCalled();

      const item = await exerciseRepository.getExerciseById(exercise.id, userA);
      expect(item).not.toBeNull();
      expect(item!.images[0].url).toBe(localUri);
    });
  });

  describe('4. Private Supabase Cloud Sync (Upload & Cross-Device Hydration)', () => {
    it('uploads to private exercise-photos bucket under authenticated user ID', async () => {
      const exerciseId = 'custom_bench_press';
      const file = { uri: 'file://path/photo.jpg', size: 1024 * 500 };

      const result = await exercisePhotoCloudService.uploadPhoto(
        userA.ownerId,
        exerciseId,
        file,
        'image/jpeg',
      );

      expect(supabase.storage.from).toHaveBeenCalledWith(EXERCISE_PHOTOS_BUCKET);
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${userA.ownerId}/${exerciseId}/photo_\\d+\\.jpg$`)),
        file,
        expect.objectContaining({ contentType: 'image/jpeg' }),
      );
      expect(result.storagePath).toContain(`${userA.ownerId}/${exerciseId}/`);

      // Verify signed URL was generated
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(
        result.storagePath,
        expect.any(Number),
      );
    });

    it('generates short-lived signed URLs and never exposes public permanent URLs', async () => {
      const storagePath = `${userA.ownerId}/custom_squat/photo_999.jpg`;
      const signedUrl = await exercisePhotoCloudService.getSignedUrl(storagePath, 3600);

      expect(mockCreateSignedUrl).toHaveBeenCalledWith(storagePath, 3600);
      expect(signedUrl).toBe('https://supabase.co/storage/v1/object/sign/exercise-photos/signed?token=abc');
    });

    it('hydrates photo on a second device via downloadPhotoToLocal', async () => {
      const exerciseId = 'custom_synced_exercise';
      const storagePath = `${userA.ownerId}/${exerciseId}/photo_123.jpg`;

      // Mock FileReader in test environment for downloadPhotoToLocal
      const originalFileReader = (globalThis as any).FileReader;
      (globalThis as any).FileReader = class {
        onloadend: any = null;
        readAsDataURL() {
          if (this.onloadend) {
            this.result = 'data:image/jpeg;base64,downloaded_bytes_device_b';
            this.onloadend();
          }
        }
        result: any = null;
      };

      try {
        const localUri = await exercisePhotoCloudService.downloadPhotoToLocal(storagePath, exerciseId);
        expect(mockDownload).toHaveBeenCalledWith(storagePath);
        expect(localUri).toBeTruthy();

        // Verify local storage has it on Device B
        const localPhoto = await exercisePhotoStorage.getLocalPhoto(exerciseId);
        expect(localPhoto).toBe(localUri);

        const status = await exercisePhotoCloudService.getSyncStatus(exerciseId);
        expect(status.state).toBe('synced');
      } finally {
        (globalThis as any).FileReader = originalFileReader;
      }
    });
  });

  describe('5. Upload Failure, Honest Sync State and Retry Recovery', () => {
    it('sets sync_failed state on network failure while preserving local photo', async () => {
      mockUpload.mockRejectedValueOnce(new Error('Network connection timeout.'));

      const exerciseId = 'custom_deadlift';
      const localUri = await exercisePhotoStorage.saveLocalPhoto(exerciseId, {
        uri: 'data:image/jpeg;base64,local_preserved_bits',
      });

      // Attempt upload
      await expect(
        exercisePhotoCloudService.uploadPhoto(userA.ownerId, exerciseId, 'fake_file'),
      ).rejects.toThrow('Network connection timeout.');

      // Honest sync status reports failure
      const status = await exercisePhotoCloudService.getSyncStatus(exerciseId);
      expect(status.state).toBe('sync_failed');
      expect(status.errorMessage).toContain('timeout');

      // Local photo remains intact
      expect(await exercisePhotoStorage.getLocalPhoto(exerciseId)).toBe(localUri);

      // Now simulate retry when connectivity returns
      mockUpload.mockResolvedValueOnce({
        data: { path: `${userA.ownerId}/${exerciseId}/photo_recovered.jpg` },
        error: null,
      });

      const retryResult = await exercisePhotoCloudService.uploadPhoto(
        userA.ownerId,
        exerciseId,
        'fake_file',
      );
      expect(retryResult.storagePath).toBeTruthy();

      const recoveredStatus = await exercisePhotoCloudService.getSyncStatus(exerciseId);
      expect(recoveredStatus.state).toBe('synced');
    });
  });

  describe('6. Guest-Mode Offline Guarantee & Safe Account Migration', () => {
    it('guest can add and view photos locally without cloud attempt', async () => {
      useAuthStore.setState({
        user: null,
        isGuest: true,
        guestSession: {
          id: guestUser.ownerId,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
        status: 'guest',
      });

      const guestExercise = await exerciseRepository.createCustomExercise(
        {
          name: 'Guest Pull-Up',
          category: 'back',
          primaryMuscles: ['Lats'],
        },
        guestUser,
      );

      const localPhoto = await exercisePhotoStorage.saveLocalPhoto(guestExercise.id, {
        uri: 'data:image/jpeg;base64,guest_photo_data',
      });

      const updated = await exerciseRepository.updateCustomExercise(
        {
          id: guestExercise.id,
          images: [{ id: `photo_${guestExercise.id}`, url: localPhoto, isMain: true }],
        },
        guestUser,
      );

      expect(updated.images[0].url).toBe(localPhoto);
      expect(supabase.storage.from).not.toHaveBeenCalled();

      const status = await exercisePhotoCloudService.getSyncStatus(guestExercise.id);
      expect(status.state).toBe('local_only');
    });

    it('safely migrates guest custom exercises with photos to authenticated user', async () => {
      // 1. Create guest session with exercise & photo
      await guestStorage.setGuestSession({
        id: guestUser.ownerId,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });

      const guestExercise = await exerciseRepository.createCustomExercise(
        {
          name: 'Guest Dip',
          category: 'arms',
          primaryMuscles: ['Triceps', 'Chest'],
        },
        guestUser,
      );

      const photoUri = await exercisePhotoStorage.saveLocalPhoto(guestExercise.id, {
        uri: 'data:image/jpeg;base64,guest_dips_photo',
      });

      await exerciseRepository.updateCustomExercise(
        {
          id: guestExercise.id,
          images: [{ id: `photo_${guestExercise.id}`, url: photoUri, isMain: true }],
        },
        guestUser,
      );

      // 2. Execute migration when user signs in
      const migrated = await guestMigrationService.runMigrationIfPending({
        id: userA.ownerId,
        email: 'migrated@bebig.app',
      } as AuthUser);

      expect(migrated).toBe(true);

      // 3. Verify userA now owns the custom exercise with photo preserved
      const authExercises = await customExerciseStorage.getCustomExercises(userA);
      expect(authExercises).toHaveLength(1);
      expect(authExercises[0].id).toBe(guestExercise.id);
      expect(authExercises[0].images[0].url).toBe(photoUri);

      // Verify pending upload record was queued
      const meta = await syncMetadataStore.getRecord('custom_exercise', guestExercise.id, userA);
      expect(meta).not.toBeNull();
      expect(meta!.syncStatus).toBe('pending_upload');
    });
  });

  describe('7. User Ownership Isolation & Unauthorized Storage Access', () => {
    it('enforces that users can only upload and delete within their own folder', async () => {
      // User A's path
      const pathA = exercisePhotoCloudService.getStoragePath(userA.ownerId, 'custom_1');
      expect(exercisePhotoCloudService.isUserOwnedPath(userA.ownerId, pathA)).toBe(true);
      expect(exercisePhotoCloudService.isUserOwnedPath(userB.ownerId, pathA)).toBe(false);

      // User B attempting to delete User A's photo is rejected by client security check
      const deleteResult = await exercisePhotoCloudService.deletePhoto(userB.ownerId, pathA);
      expect(deleteResult).toBe(false);
      expect(mockRemove).not.toHaveBeenCalled();

      // User A deleting own photo proceeds
      const legitimateDelete = await exercisePhotoCloudService.deletePhoto(userA.ownerId, pathA);
      expect(legitimateDelete).toBe(true);
      expect(mockRemove).toHaveBeenCalledWith([pathA]);
    });
  });

  describe('8. Safe Deletion & Orphaned Photo Pruning', () => {
    it('deleting an exercise cleans up its local photo without affecting other exercises', async () => {
      const ex1 = await exerciseRepository.createCustomExercise(
        { name: 'Active Exercise 1', category: 'chest', primaryMuscles: [] },
        userA,
      );
      const ex2 = await exerciseRepository.createCustomExercise(
        { name: 'Active Exercise 2', category: 'back', primaryMuscles: [] },
        userA,
      );

      await exercisePhotoStorage.saveLocalPhoto(ex1.id, { uri: 'data:image/jpeg;base64,photo1' });
      await exercisePhotoStorage.saveLocalPhoto(ex2.id, { uri: 'data:image/jpeg;base64,photo2' });

      // Delete ex1
      await exerciseRepository.deleteCustomExercise(ex1.id, userA);

      // ex1 photo should be deleted
      expect(await exercisePhotoStorage.getLocalPhoto(ex1.id)).toBeNull();
      // ex2 photo must remain untouched
      expect(await exercisePhotoStorage.getLocalPhoto(ex2.id)).not.toBeNull();
    });
  });

  describe('9. Existing Exercises, Templates and History Compatibility', () => {
    it('existing custom exercises without photos continue to function seamlessly', async () => {
      // Simulate an exercise created in prior version with no photoPath and empty images
      const legacyExercise = {
        id: 'custom_legacy_1',
        ownerId: userA.ownerId,
        ownerType: 'authenticated' as const,
        name: 'Legacy Overhead Press',
        description: 'Standard OHP',
        category: 'shoulders' as const,
        categoryName: 'Shoulders',
        primaryMuscles: [{ id: 'cm_0', name: 'Deltoids' }],
        secondaryMuscles: [],
        equipment: [{ id: 'ceq_0', name: 'Barbell' }],
        images: [],
        sourceProvider: 'custom' as const,
        isCustom: true,
      };

      await customExerciseStorage.saveCustomExercise(legacyExercise, userA);

      const fetched = await exerciseRepository.getExerciseById(legacyExercise.id, userA);
      expect(fetched).not.toBeNull();
      expect(fetched!.images).toEqual([]);
      expect(fetched!.photoPath).toBeUndefined();

      // Later adding a photo to a legacy exercise works cleanly
      const photoUri = await exercisePhotoStorage.saveLocalPhoto(legacyExercise.id, {
        uri: 'data:image/jpeg;base64,legacy_photo',
      });
      const updated = await exerciseRepository.updateCustomExercise(
        {
          id: legacyExercise.id,
          images: [{ id: `photo_${legacyExercise.id}`, url: photoUri, isMain: true }],
        },
        userA,
      );
      expect(updated.images[0].url).toBe(photoUri);
    });
  });

  describe('10. Native Photo Picker Integration & Physical iPhone Flow', () => {
    it('requests permission and safely returns user-friendly error if permission is denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: false,
        status: 'denied',
      });

      const result = await pickExercisePhoto();
      expect(result.canceled).toBe(true);
      expect(result.error).toMatch(/Photo library permission is required/i);
      expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    });

    it('handles user cancellation of photo picker gracefully without error', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: true,
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: true,
        assets: null,
      });

      const result = await pickExercisePhoto();
      expect(result.canceled).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects unsupported image formats', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: true,
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///var/mobile/Containers/Data/Application/test.gif',
            mimeType: 'image/gif',
            fileSize: 1024,
          },
        ],
      });

      const result = await pickExercisePhoto();
      expect(result.canceled).toBe(false);
      expect(result.error).toMatch(/valid image file/i);
    });

    it('rejects images exceeding the 5MB size limit', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: true,
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///var/mobile/Containers/Data/Application/large.jpg',
            mimeType: 'image/jpeg',
            fileSize: 6 * 1024 * 1024,
          },
        ],
      });

      const result = await pickExercisePhoto();
      expect(result.canceled).toBe(false);
      expect(result.error).toMatch(/less than 5MB/i);
    });

    it('successfully returns picked photo details on valid selection', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: true,
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///var/mobile/Containers/Data/Application/chest_press.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1.2 * 1024 * 1024,
            base64: 'sample_native_base64_data',
          },
        ],
      });

      const result = await pickExercisePhoto();
      expect(result.canceled).toBe(false);
      expect(result.uri).toBe('file:///var/mobile/Containers/Data/Application/chest_press.jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.base64).toBe('sample_native_base64_data');
      expect(result.error).toBeUndefined();
    });

    it('converts base64 data to Uint8Array for binary cloud upload', () => {
      const testData = 'BeBigExercisePhotoData';
      const base64 = btoa(testData);
      const bytes = base64ToUint8Array(base64);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(testData.length);
      let decoded = '';
      for (let i = 0; i < bytes.length; i++) {
        decoded += String.fromCharCode(bytes[i]);
      }
      expect(decoded).toBe(testData);
    });

    it('renders Add Exercise Photo button and updates UI on selection, replacement, and removal', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///var/mobile/Containers/Data/Application/bench.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024 * 1024,
            base64: 'bench_press_base64',
          },
        ],
      });

      const { getByTestId, queryByTestId } = await render(<CreateCustomExerciseScreen />);

      // 1. Initial state: Add Exercise Photo button is visible
      const addBtn = getByTestId('add-photo-button');
      expect(addBtn).toBeTruthy();
      expect(queryByTestId('exercise-photo-preview')).toBeNull();

      // 2. Tap Add Exercise Photo
      fireEvent.press(addBtn);

      await waitFor(() => {
        expect(getByTestId('exercise-photo-preview')).toBeTruthy();
      });
      expect(getByTestId('replace-photo-button')).toBeTruthy();
      expect(getByTestId('remove-photo-button')).toBeTruthy();

      // 3. Tap Replace Photo
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///var/mobile/Containers/Data/Application/bench_v2.png',
            mimeType: 'image/png',
            fileSize: 800 * 1024,
            base64: 'bench_v2_base64',
          },
        ],
      });

      fireEvent.press(getByTestId('replace-photo-button'));

      await waitFor(() => {
        expect(getByTestId('exercise-photo-preview')).toBeTruthy();
      });

      // 4. Tap Remove Photo
      fireEvent.press(getByTestId('remove-photo-button'));

      await waitFor(() => {
        expect(queryByTestId('exercise-photo-preview')).toBeNull();
      });
      expect(getByTestId('add-photo-button')).toBeTruthy();
    });

    it('allows adding, replacing, and removing photos on ExerciseDetailScreen', async () => {
      await customExerciseStorage.saveCustomExercise(
        {
          id: 'custom_123',
          ownerId: userA.ownerId,
          ownerType: 'authenticated',
          name: 'Cable Lateral Raise',
          description: 'Custom exercise for detail test',
          category: 'shoulders',
          categoryName: 'Shoulders',
          primaryMuscles: [{ id: 'cm_0', name: 'Lateral Deltoids' }],
          secondaryMuscles: [],
          equipment: [{ id: 'ceq_0', name: 'Cable' }],
          images: [],
          sourceProvider: 'custom',
          isCustom: true,
        },
        userA,
      );

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///var/mobile/Containers/Data/Application/lateral_raise.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024 * 1024,
            base64: 'lateral_raise_base64',
          },
        ],
      });

      const { getByTestId } = await render(<ExerciseDetailScreen />);

      await waitFor(() => {
        expect(getByTestId('exercise-detail-name')).toBeTruthy();
      });

      const addBtn = getByTestId('add-photo-button');
      expect(addBtn).toBeTruthy();

      fireEvent.press(addBtn);

      await waitFor(() => {
        expect(getByTestId('replace-photo-button')).toBeTruthy();
        expect(getByTestId('remove-photo-button')).toBeTruthy();
      });

      const updated = await exerciseRepository.getExerciseById('custom_123', userA);
      expect(updated?.images?.length).toBeGreaterThan(0);
    });
  });

  describe('11. Bottom Navigation Clearance, Safe-Area Insets & Input Usability', () => {
    it('applies generous bottom padding to CreateCustomExerciseScreen scroll view to clear BottomNavBar', async () => {
      const { getByTestId } = await render(<CreateCustomExerciseScreen />);
      const scrollView = getByTestId('custom-exercise-scroll-view');
      expect(scrollView).toBeTruthy();

      const flatStyles = Array.isArray(scrollView.props.contentContainerStyle)
        ? Object.assign({}, ...scrollView.props.contentContainerStyle.filter(Boolean))
        : scrollView.props.contentContainerStyle;

      // Bottom padding should be >= 110 (minimum bottomInset) + 24 (spacing.xl) = 134px
      expect(flatStyles.paddingBottom).toBeGreaterThanOrEqual(110);
    });

    it('renders both top header Save button and bottom Save Custom Exercise button', async () => {
      const { getByTestId } = await render(<CreateCustomExerciseScreen />);
      
      const headerSaveBtn = getByTestId('create-custom-header-save-button');
      const bottomSaveBtn = getByTestId('custom-exercise-submit-button');

      expect(headerSaveBtn).toBeTruthy();
      expect(bottomSaveBtn).toBeTruthy();

      // Triggering header save with empty name displays validation error
      fireEvent.press(headerSaveBtn);
      await waitFor(() => {
        expect(getByTestId('create-custom-error')).toBeTruthy();
      });
    });

    it('configures input progression with returnKeyType=next for seamless keyboard traversal', async () => {
      const { getByTestId } = await render(<CreateCustomExerciseScreen />);

      const nameInput = getByTestId('custom-exercise-name-input');
      const musclesInput = getByTestId('custom-exercise-muscles-input');
      const secondaryMusclesInput = getByTestId('custom-exercise-secondary-muscles-input');
      const instructionsInput = getByTestId('custom-exercise-instructions-input');

      expect(nameInput.props.returnKeyType).toBe('next');
      expect(musclesInput.props.returnKeyType).toBe('next');
      expect(secondaryMusclesInput.props.returnKeyType).toBe('next');
      expect(instructionsInput.props.returnKeyType).toBe('default');
    });

    it('applies bottom clearance to ExerciseDetailScreen scroll view for action buttons', async () => {
      await customExerciseStorage.saveCustomExercise(
        {
          id: 'custom_123',
          ownerId: userA.ownerId,
          ownerType: 'authenticated',
          name: 'Incline Bench Press',
          description: 'Testing clearance',
          category: 'chest',
          categoryName: 'Chest',
          primaryMuscles: [{ id: 'cm_1', name: 'Upper Chest' }],
          secondaryMuscles: [],
          equipment: [{ id: 'ceq_1', name: 'Barbell' }],
          images: [],
          sourceProvider: 'custom',
          isCustom: true,
        },
        userA,
      );

      const { getByTestId } = await render(<ExerciseDetailScreen />);
      await waitFor(() => {
        expect(getByTestId('exercise-detail-scroll-view')).toBeTruthy();
      });

      const scrollView = getByTestId('exercise-detail-scroll-view');
      const flatStyles = Array.isArray(scrollView.props.contentContainerStyle)
        ? Object.assign({}, ...scrollView.props.contentContainerStyle.filter(Boolean))
        : scrollView.props.contentContainerStyle;

      expect(flatStyles.paddingBottom).toBeGreaterThanOrEqual(110);
    });
  });

  describe('12. Supabase Storage Error Visibility, ArrayBuffer Payload & Sync Chip Error Display', () => {
    it('records sync_failed state and preserves exact error message when Supabase returns "Bucket not found"', async () => {
      mockUpload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Bucket not found' },
      });

      const exerciseId = 'custom_bucket_not_found_test';
      await expect(
        exercisePhotoCloudService.uploadPhoto(userA.ownerId, exerciseId, 'data:image/jpeg;base64,dGVzdA=='),
      ).rejects.toThrow('Bucket not found');

      const status = await exercisePhotoCloudService.getSyncStatus(exerciseId);
      expect(status.state).toBe('sync_failed');
      expect(status.errorMessage).toBe('Bucket not found');
    });

    it('converts base64 and Uint8Array payloads to standard ArrayBuffer before uploading', async () => {
      const exerciseId = 'custom_arraybuffer_test';
      const base64Data = 'data:image/jpeg;base64,QUJDREVGRw==';

      await exercisePhotoCloudService.uploadPhoto(userA.ownerId, exerciseId, base64Data);

      expect(mockUpload).toHaveBeenCalledTimes(1);
      const callArgs = mockUpload.mock.calls[0];
      const uploadedBody = callArgs[1];

      // Verifies uploadBody is an ArrayBuffer (or ArrayBuffer instance)
      expect(uploadedBody instanceof ArrayBuffer).toBe(true);
    });

    it('renders the detailed error message under the photo sync chip on ExerciseDetailScreen when sync_failed', async () => {
      const exerciseId = 'custom_123';
      await customExerciseStorage.saveCustomExercise(
        {
          id: exerciseId,
          ownerId: userA.ownerId,
          ownerType: 'authenticated',
          name: 'Seated Incline Curl',
          description: 'Custom exercise for error chip test',
          category: 'arms',
          categoryName: 'Arms',
          primaryMuscles: [{ id: 'cm_0', name: 'Biceps' }],
          secondaryMuscles: [],
          equipment: [{ id: 'ceq_0', name: 'Dumbbell' }],
          images: [{ id: `photo_${exerciseId}`, url: 'file:///local/photo.jpg', isMain: true }],
          sourceProvider: 'custom',
          isCustom: true,
        },
        userA,
      );

      // Pre-set sync_failed status with detailed error message
      await exercisePhotoCloudService.setSyncStatus(exerciseId, {
        state: 'sync_failed',
        errorMessage: 'Bucket not found: exercise-photos',
      });

      const { getByTestId, findByTestId } = await render(<ExerciseDetailScreen />);

      const chip = await findByTestId('photo-sync-chip');
      expect(chip).toBeTruthy();

      const errorText = getByTestId('photo-sync-error-message');
      expect(errorText).toBeTruthy();
      expect(errorText.props.children).toBe('Bucket not found: exercise-photos');

      const retryBtn = getByTestId('retry-photo-sync-button');
      expect(retryBtn).toBeTruthy();
    });
  });

  describe('13. Bug-1 & Bug-2 Regression: Cross-Device Photo Hydration and Cloud Photo Cleanup', () => {
    let originalFileReader: any;

    beforeEach(() => {
      originalFileReader = (globalThis as any).FileReader;
      (globalThis as any).FileReader = class {
        onloadend: any = null;
        readAsDataURL() {
          if (this.onloadend) {
            this.result = 'data:image/jpeg;base64,hydrated_device_b_bytes';
            this.onloadend();
          }
        }
        result: any = null;
      };
    });

    afterEach(() => {
      (globalThis as any).FileReader = originalFileReader;
    });

    // --- BUG-1 TESTS: Cross-Device Photo Hydration ---

    it('BUG-1: second-device pull produces a locally persisted, renderable photo in customExerciseStorage without manual editing', async () => {
      const exerciseId = 'custom_pulled_ex_1';
      const storagePath = `${userA.ownerId}/${exerciseId}/photo_1001.jpg`;

      // Mock cloud pull record with photo_path
      const cloudRecord = {
        id: exerciseId,
        user_id: userA.ownerId,
        name: 'Device A Bench Press',
        description: 'Pulled from cloud on Device B',
        category: 'chest',
        category_name: 'Chest',
        primary_muscles: ['Chest'],
        secondary_muscles: ['Triceps'],
        equipment: ['Barbell'],
        photo_path: storagePath,
        created_at: '2026-10-16T12:00:00.000Z',
        updated_at: '2026-10-16T12:00:00.000Z',
        client_updated_at: '2026-10-16T12:00:00.000Z',
        deleted_at: null,
      };

      // Execute pull reconciliation
      const result = await (syncEngine as any).reconcilePulledCustomExercises([cloudRecord], userA);
      expect(result.applied).toBe(1);

      // Verify customExerciseStorage now has the exercise WITH images populated
      const exercises = await customExerciseStorage.getCustomExercises(userA);
      const pulledExercise = exercises.find((e: any) => e.id === exerciseId);
      expect(pulledExercise).toBeDefined();
      expect(pulledExercise!.photoPath).toBe(storagePath);
      expect(pulledExercise!.images).toHaveLength(1);
      expect(pulledExercise!.images[0].url).toContain('data:image/jpeg;base64,hydrated_device_b_bytes');

      // Verify exerciseRepository.getExerciseById returns it with photo renderable
      const repoFetched = await exerciseRepository.getExerciseById(exerciseId, userA);
      expect(repoFetched?.images?.[0]?.url).toBe(pulledExercise!.images[0].url);
    });

    it('BUG-1: downloadPhotoToLocal updates existing custom exercise images and preserves identity/metadata', async () => {
      const exerciseId = 'custom_delayed_ex_2';
      const storagePath = `${userA.ownerId}/${exerciseId}/photo_1002.jpg`;

      // Save initial exercise without photo
      await customExerciseStorage.saveCustomExercise(
        {
          id: exerciseId,
          ownerId: userA.ownerId,
          ownerType: 'authenticated',
          name: 'Incline Dumbbell Fly',
          description: 'Initial text save',
          category: 'chest',
          categoryName: 'Chest',
          primaryMuscles: [{ id: 'cm_0', name: 'Upper Chest' }],
          secondaryMuscles: [],
          equipment: [{ id: 'ceq_0', name: 'Dumbbell' }],
          images: [],
          photoPath: storagePath,
          sourceProvider: 'custom',
          isCustom: true,
          createdAt: '2026-10-16T10:00:00.000Z',
        },
        userA,
      );

      // Trigger photo download
      const localUri = await exercisePhotoCloudService.downloadPhotoToLocal(storagePath, exerciseId, userA);
      expect(localUri).toBeTruthy();

      // Verify customExerciseStorage was automatically updated with image
      const exercises = await customExerciseStorage.getCustomExercises(userA);
      const updated = exercises.find((e: any) => e.id === exerciseId);
      expect(updated?.images).toHaveLength(1);
      expect(updated?.images[0].url).toBe(localUri);
      expect(updated?.name).toBe('Incline Dumbbell Fly'); // Metadata preserved
      expect(updated?.primaryMuscles[0].name).toBe('Upper Chest');
    });

    it('BUG-1: photo download does NOT resurrect an exercise if it was deleted while download was in-flight', async () => {
      const exerciseId = 'custom_deleted_mid_flight';
      const storagePath = `${userA.ownerId}/${exerciseId}/photo_1003.jpg`;

      // Ensure exercise is NOT in customExerciseStorage
      await customExerciseStorage.deleteCustomExercise(exerciseId, userA);

      // Run download
      const localUri = await exercisePhotoCloudService.downloadPhotoToLocal(storagePath, exerciseId, userA);
      expect(localUri).toBeTruthy();

      // Verify exercise was NOT resurrected in storage
      const exercises = await customExerciseStorage.getCustomExercises(userA);
      expect(exercises.find((e: any) => e.id === exerciseId)).toBeUndefined();
    });

    // --- BUG-2 TESTS: Cloud Photo Cleanup on Exercise Deletion ---

    it('BUG-2: deleting an authenticated custom exercise calls deletePhoto and cleans cloud storage', async () => {
      const exerciseId = 'custom_to_delete_with_photo';
      const photoPath = `${userA.ownerId}/${exerciseId}/photo_to_purge.jpg`;

      await customExerciseStorage.saveCustomExercise(
        {
          id: exerciseId,
          ownerId: userA.ownerId,
          ownerType: 'authenticated',
          name: 'Barbell Shrug',
          description: 'To be deleted',
          category: 'shoulders',
          categoryName: 'Shoulders',
          primaryMuscles: [],
          secondaryMuscles: [],
          equipment: [],
          images: [{ id: `photo_${exerciseId}`, url: 'file:///local/photo.jpg', isMain: true }],
          photoPath,
          sourceProvider: 'custom',
          isCustom: true,
        },
        userA,
      );

      await exercisePhotoStorage.saveLocalPhoto(exerciseId, {
        uri: 'data:image/jpeg;base64,shrug_photo',
      });

      // Spy on exercisePhotoCloudService.deletePhoto
      const deletePhotoSpy = jest.spyOn(exercisePhotoCloudService, 'deletePhoto');

      // Delete the exercise
      await exerciseRepository.deleteCustomExercise(exerciseId, userA);

      // Verify cloud photo delete was called with User A ID and photo path
      expect(deletePhotoSpy).toHaveBeenCalledWith(userA.ownerId, photoPath);
      expect(mockRemove).toHaveBeenCalledWith([photoPath]);

      // Verify local exercise and local photo are gone
      const remaining = await customExerciseStorage.getCustomExercises(userA);
      expect(remaining.find((e: any) => e.id === exerciseId)).toBeUndefined();
      expect(await exercisePhotoStorage.getLocalPhoto(exerciseId)).toBeNull();
    });

    it('BUG-2: deleting an exercise without a photo succeeds without attempting cloud photo deletion', async () => {
      const exerciseId = 'custom_no_photo_del';
      await customExerciseStorage.saveCustomExercise(
        {
          id: exerciseId,
          ownerId: userA.ownerId,
          ownerType: 'authenticated',
          name: 'Calf Raise',
          description: 'No photo attached',
          category: 'calves',
          categoryName: 'Calves',
          primaryMuscles: [],
          secondaryMuscles: [],
          equipment: [],
          images: [],
          photoPath: null,
          sourceProvider: 'custom',
          isCustom: true,
        },
        userA,
      );

      const deletePhotoSpy = jest.spyOn(exercisePhotoCloudService, 'deletePhoto');

      await exerciseRepository.deleteCustomExercise(exerciseId, userA);

      expect(deletePhotoSpy).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('BUG-2: guest mode exercise deletion does not attempt cloud photo deletion', async () => {
      const exerciseId = 'custom_guest_photo_del';
      await customExerciseStorage.saveCustomExercise(
        {
          id: exerciseId,
          ownerId: guestUser.ownerId,
          ownerType: 'guest',
          name: 'Guest Plank',
          description: 'Local guest exercise',
          category: 'abs',
          categoryName: 'Abs',
          primaryMuscles: [],
          secondaryMuscles: [],
          equipment: [],
          images: [{ id: `photo_${exerciseId}`, url: 'file:///local/guest.jpg', isMain: true }],
          photoPath: 'some_photo_path.jpg',
          sourceProvider: 'custom',
          isCustom: true,
        },
        guestUser,
      );

      const deletePhotoSpy = jest.spyOn(exercisePhotoCloudService, 'deletePhoto');

      await exerciseRepository.deleteCustomExercise(exerciseId, guestUser);

      expect(deletePhotoSpy).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('BUG-2: prevents User B from deleting User A cloud photo via ownership boundaries', async () => {
      const userAPhotoPath = `${userA.ownerId}/custom_secret/photo.jpg`;

      // User B attempts to delete User A's photo
      const success = await exercisePhotoCloudService.deletePhoto(userB.ownerId, userAPhotoPath);

      expect(success).toBe(false);
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('BUG-2: cloud deletion failure is handled gracefully and preserves local deletion and tombstone', async () => {
      const exerciseId = 'custom_cloud_err_del';
      const photoPath = `${userA.ownerId}/${exerciseId}/photo_fail.jpg`;

      await customExerciseStorage.saveCustomExercise(
        {
          id: exerciseId,
          ownerId: userA.ownerId,
          ownerType: 'authenticated',
          name: 'Close Grip Bench',
          description: 'Cloud error test',
          category: 'arms',
          categoryName: 'Arms',
          primaryMuscles: [],
          secondaryMuscles: [],
          equipment: [],
          images: [],
          photoPath,
          sourceProvider: 'custom',
          isCustom: true,
        },
        userA,
      );

      await syncMetadataStore.setRecord(
        {
          entityType: 'custom_exercise',
          id: exerciseId,
          clientUpdatedAt: new Date().toISOString(),
          deletedAt: null,
          syncStatus: 'synced',
          lastSyncedServerUpdatedAt: new Date().toISOString(),
        },
        userA,
      );

      // Simulate Supabase Storage failure on remove
      mockRemove.mockResolvedValueOnce({
        data: null,
        error: { message: 'Supabase storage gateway timeout' },
      });

      // Deletion must NOT throw and must complete local deletion + tombstone
      await expect(exerciseRepository.deleteCustomExercise(exerciseId, userA)).resolves.not.toThrow();

      // Verify local exercise was deleted
      const remaining = await customExerciseStorage.getCustomExercises(userA);
      expect(remaining.find((e: any) => e.id === exerciseId)).toBeUndefined();

      // Verify tombstone was created in syncMetadataStore
      const meta = await syncMetadataStore.getRecord('custom_exercise', exerciseId, userA);
      expect(meta?.syncStatus).toBe('pending_delete');
    });
  });
});


