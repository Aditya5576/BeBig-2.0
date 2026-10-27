/**
 * BeBig 2.0 — Custom Exercise Photos Private Cloud Service
 *
 * Implements:
 * - Dedicated private storage bucket: 'exercise-photos' (public = false)
 * - Strict user-scoped storage paths: `${userId}/${exerciseId}/photo_${timestamp}.${ext}`
 * - Ownership assertion: prevents uploading or deleting outside the authenticated user's folder
 * - Signed URLs: short-lived (default 3600s), never permanent public URLs
 * - Cross-device download to durable local storage
 * - Honest sync status tracking: 'local_only' | 'syncing' | 'synced' | 'sync_failed'
 * - Offline-first durability: local files preserved on failure/logout
 */

import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { exercisePhotoStorage, base64ToUint8Array } from '../storage/exercisePhotoStorage';
import { customExerciseStorage } from '../storage/customExerciseStorage';
import { getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { Exercise } from '../types';
import { platformStorage } from '../../../lib/storage';

export const EXERCISE_PHOTOS_BUCKET = 'exercise-photos';
export const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

export type PhotoSyncState = 'local_only' | 'syncing' | 'synced' | 'sync_failed';

export interface PhotoSyncStatusInfo {
  state: PhotoSyncState;
  storagePath?: string;
  lastAttemptAt?: string;
  errorMessage?: string;
  retryCount?: number;
}

const PHOTO_SYNC_STATUS_KEY_PREFIX = 'bebig.photo_sync_status.';

export class ExercisePhotoCloudService {
  /**
   * Generates isolated storage path: `${userId}/${exerciseId}/photo_${timestamp}.${ext}`
   */
  getStoragePath(userId: string, exerciseId: string, mimeType: string = 'image/jpeg'): string {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error('User ID is required to generate photo storage path.');
    }
    if (!exerciseId || typeof exerciseId !== 'string' || !exerciseId.trim()) {
      throw new Error('Exercise ID is required to generate photo storage path.');
    }

    const cleanUserId = userId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanExerciseId = exerciseId.trim().replace(/[^a-zA-Z0-9_-]/g, '');

    const ext = mimeType.includes('png')
      ? 'png'
      : mimeType.includes('webp')
        ? 'webp'
        : 'jpg';

    const timestamp = Date.now();
    return `${cleanUserId}/${cleanExerciseId}/photo_${timestamp}.${ext}`;
  }

  /**
   * Checks whether a storage path belongs to the given user.
   */
  isUserOwnedPath(userId: string, storagePath?: string | null): boolean {
    if (!userId || !storagePath) return false;
    const cleanUserId = userId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return storagePath.startsWith(`${cleanUserId}/`);
  }

  /**
   * Gets the sync status info for an exercise photo.
   */
  async getSyncStatus(exerciseId: string): Promise<PhotoSyncStatusInfo> {
    if (!exerciseId) return { state: 'local_only' };
    try {
      const raw = await platformStorage.getItem(`${PHOTO_SYNC_STATUS_KEY_PREFIX}${exerciseId}`);
      if (!raw) return { state: 'local_only' };
      return JSON.parse(raw) as PhotoSyncStatusInfo;
    } catch {
      return { state: 'local_only' };
    }
  }

  /**
   * Persists sync status info for an exercise photo.
   */
  async setSyncStatus(exerciseId: string, status: PhotoSyncStatusInfo): Promise<void> {
    if (!exerciseId) return;
    try {
      await platformStorage.setItem(
        `${PHOTO_SYNC_STATUS_KEY_PREFIX}${exerciseId}`,
        JSON.stringify(status),
      );
    } catch {
      // Ignored
    }
  }

  /**
   * Uploads an exercise photo binary to the private 'exercise-photos' bucket.
   * Path: `${userId}/${exerciseId}/photo_${timestamp}.${ext}`
   */
  async uploadPhoto(
    userId: string,
    exerciseId: string,
    fileData: any,
    mimeType: string = 'image/jpeg',
  ): Promise<{ storagePath: string; signedUrl?: string }> {
    if (!isSupabaseConfigured()) {
      await this.setSyncStatus(exerciseId, {
        state: 'sync_failed',
        errorMessage: 'Supabase is not configured.',
      });
      throw new Error('Supabase is not configured.');
    }

    const storagePath = this.getStoragePath(userId, exerciseId, mimeType);

    await this.setSyncStatus(exerciseId, {
      state: 'syncing',
      lastAttemptAt: new Date().toISOString(),
    });

    try {
      let payload = fileData;
      if (typeof fileData === 'string' && (fileData.startsWith('data:') || fileData.length > 60)) {
        try {
          const commaIdx = fileData.indexOf(',');
          const rawBase64 = commaIdx !== -1 ? fileData.slice(commaIdx + 1) : fileData;
          payload = base64ToUint8Array(rawBase64);
        } catch {
          payload = fileData;
        }
      }

      // Convert Uint8Array to ArrayBuffer for React Native / iOS fetch compatibility
      const uploadBody =
        payload instanceof Uint8Array
          ? payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)
          : payload;

      const { data, error } = await supabase.storage
        .from(EXERCISE_PHOTOS_BUCKET)
        .upload(storagePath, uploadBody, {
          contentType: mimeType,
          upsert: true,
        });

      if (error || !data) {
        const errorDetails = error?.message || 'Failed to upload photo to cloud storage.';
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn(`[PhotoSync] Supabase upload failed for ${storagePath}:`, errorDetails);
        }
        throw new Error(errorDetails);
      }

      // Generate initial short-lived signed URL for immediate use
      const { data: signedData } = await supabase.storage
        .from(EXERCISE_PHOTOS_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

      await this.setSyncStatus(exerciseId, {
        state: 'synced',
        storagePath,
        lastAttemptAt: new Date().toISOString(),
      });

      return {
        storagePath,
        signedUrl: signedData?.signedUrl,
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Upload failed.';
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`[PhotoSync] Exercise photo upload error for exercise ${exerciseId}:`, errorMsg);
      }
      await this.setSyncStatus(exerciseId, {
        state: 'sync_failed',
        errorMessage: errorMsg,
        lastAttemptAt: new Date().toISOString(),
      });
      throw err;
    }
  }

  /**
   * Generates a short-lived authenticated signed URL for a photo in the private bucket.
   * Never exposes permanent public URLs.
   */
  async getSignedUrl(
    storagePath: string,
    expiresInSeconds = SIGNED_URL_TTL_SECONDS,
  ): Promise<string | null> {
    if (!storagePath || !isSupabaseConfigured()) return null;

    try {
      const { data, error } = await supabase.storage
        .from(EXERCISE_PHOTOS_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  }

  /**
   * Downloads a photo from the cloud storage path into local durable storage.
   * Enables cross-device sync where Device B downloads Device A's photo locally.
   */
  async downloadPhotoToLocal(
    storagePath: string,
    exerciseId: string,
    scope?: UserScope,
  ): Promise<string | null> {
    if (!storagePath || !exerciseId || !isSupabaseConfigured()) return null;

    try {
      const { data, error } = await supabase.storage
        .from(EXERCISE_PHOTOS_BUCKET)
        .download(storagePath);

      if (error || !data) return null;

      // Determine MIME type
      const mimeType = storagePath.endsWith('.png')
        ? 'image/png'
        : storagePath.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';

      // Read blob as base64 on web/native
      const base64 = await new Promise<string>((resolve, reject) => {
        if (typeof FileReader !== 'undefined') {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            const commaIdx = res.indexOf(',');
            resolve(commaIdx !== -1 ? res.slice(commaIdx + 1) : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(data);
        } else {
          resolve('');
        }
      });

      if (!base64) return null;

      const localUri = await exercisePhotoStorage.saveLocalPhoto(exerciseId, {
        uri: `data:${mimeType};base64,${base64}`,
        mimeType,
        base64,
      });

      await this.setSyncStatus(exerciseId, {
        state: 'synced',
        storagePath,
      });

      // Race-safe hydration: Update customExerciseStorage if exercise exists locally
      try {
        const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
        const exercises = await customExerciseStorage.getCustomExercises(resolvedScope);
        const target = exercises.find((e) => e.id === exerciseId);
        if (target) {
          // Verify exercise still expects this photo and avoid duplicate images
          const matchesPhotoPath = target.photoPath === storagePath;
          const alreadyHasUri = target.images?.some((img) => img.url === localUri);
          if (matchesPhotoPath && !alreadyHasUri) {
            const updatedTarget: Exercise = {
              ...target,
              images: [{ id: `photo_${exerciseId}`, url: localUri, isMain: true }],
            };
            await customExerciseStorage.saveCustomExercise(updatedTarget, resolvedScope);
          }
        }
      } catch {
        // Durability: photo file is already saved locally on disk
      }

      return localUri;
    } catch {
      return null;
    }
  }

  /**
   * Safely deletes a photo from the private cloud storage bucket.
   * Strict user-ownership assertion ensures users can never delete other users' objects.
   */
  async deletePhoto(userId: string, storagePath: string): Promise<boolean> {
    if (!userId || !storagePath || !isSupabaseConfigured()) return false;

    if (!this.isUserOwnedPath(userId, storagePath)) {
      return false; // Security check failed
    }

    try {
      const { error } = await supabase.storage
        .from(EXERCISE_PHOTOS_BUCKET)
        .remove([storagePath]);

      return !error;
    } catch {
      return false;
    }
  }
}

export const exercisePhotoCloudService = new ExercisePhotoCloudService();
