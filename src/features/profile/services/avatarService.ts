/**
 * BeBig 2.0 — Cloud-Backed Profile Avatar Storage Service
 *
 * Implements:
 * - User-isolated storage paths: `${userId}/avatar_${timestamp}.${ext}`
 * - Client-side validation: image/* types only, 2MB max file size
 * - Safe upload and replacement: new image uploaded first, old image cleaned up after save
 * - Strict deletion safety: only deletes files in the user's own storage folder (`${userId}/`)
 * - Non-privileged client calls: uses authenticated user session via supabase client
 */

import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

export const AVATAR_BUCKET_NAME = 'avatars';
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface IAvatarService {
  validateAvatarFile(file: { type?: string; size?: number }): FileValidationResult;
  getAvatarStoragePath(userId: string, mimeType?: string): string;
  isUserOwnedAvatarUrl(userId: string, avatarUrl?: string | null): boolean;
  extractStoragePathFromUrl(userId: string, avatarUrl: string): string | null;
  uploadAvatar(userId: string, file: any, mimeType?: string): Promise<string>;
  deleteAvatarByUrl(userId: string, avatarUrl: string): Promise<boolean>;
}

export class AvatarService implements IAvatarService {
  /**
   * Validate file size and MIME type before network upload.
   */
  validateAvatarFile(file: { type?: string; size?: number }): FileValidationResult {
    if (!file) {
      return { valid: false, error: 'No file provided.' };
    }

    if (file.type && !ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Please select a valid image (JPEG, PNG, WebP, or GIF).',
      };
    }

    if (file.size !== undefined && file.size > MAX_AVATAR_SIZE_BYTES) {
      return {
        valid: false,
        error: 'Image file size must be less than 2MB.',
      };
    }

    return { valid: true };
  }

  /**
   * Generates a user-isolated path in the format: `${userId}/avatar_${timestamp}.${ext}`.
   */
  getAvatarStoragePath(userId: string, mimeType?: string): string {
    if (!userId) {
      throw new Error('User ID is required to generate avatar storage path.');
    }

    let ext = 'jpg';
    if (mimeType) {
      const lower = mimeType.toLowerCase();
      if (lower.includes('png')) ext = 'png';
      else if (lower.includes('webp')) ext = 'webp';
      else if (lower.includes('gif')) ext = 'gif';
      else if (lower.includes('jpeg') || lower.includes('jpg')) ext = 'jpg';
    }

    const timestamp = Date.now();
    return `${userId}/avatar_${timestamp}.${ext}`;
  }

  /**
   * Checks if an avatar URL is an uploaded object in the user's Supabase Storage folder.
   * Prevents accidental deletion of external preset URLs or other users' objects.
   */
  isUserOwnedAvatarUrl(userId: string, avatarUrl?: string | null): boolean {
    if (!userId || !avatarUrl) return false;
    return (
      avatarUrl.includes(`/${AVATAR_BUCKET_NAME}/${userId}/`) ||
      avatarUrl.includes(`/${AVATAR_BUCKET_NAME}%2F${userId}%2F`)
    );
  }

  /**
   * Extracts the relative path within the avatars bucket: `${userId}/avatar_...`.
   * Enforces that the extracted path strictly begins with `${userId}/`.
   */
  extractStoragePathFromUrl(userId: string, avatarUrl: string): string | null {
    if (!this.isUserOwnedAvatarUrl(userId, avatarUrl)) {
      return null;
    }

    try {
      const url = new URL(avatarUrl);
      const pathname = decodeURIComponent(url.pathname);
      const marker = `/${AVATAR_BUCKET_NAME}/`;
      const idx = pathname.indexOf(marker);
      if (idx === -1) return null;

      const path = pathname.slice(idx + marker.length);
      // Security check: path MUST begin with userId/
      if (path.startsWith(`${userId}/`)) {
        return path;
      }
      return null;
    } catch {
      // If URL parsing fails, attempt substring match
      const marker = `/${AVATAR_BUCKET_NAME}/`;
      const idx = avatarUrl.indexOf(marker);
      if (idx === -1) return null;
      const path = decodeURIComponent(avatarUrl.slice(idx + marker.length).split('?')[0]);
      if (path.startsWith(`${userId}/`)) {
        return path;
      }
      return null;
    }
  }

  /**
   * Uploads an avatar image into the user's isolated storage folder.
   * Returns the persistent public URL.
   */
  async uploadAvatar(userId: string, file: any, mimeType: string = 'image/jpeg'): Promise<string> {
    if (!userId) {
      throw new Error('User ID is required for avatar upload.');
    }

    const validation = this.validateAvatarFile({
      type: mimeType,
      size: file?.size,
    });
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid avatar image.');
    }

    const path = this.getAvatarStoragePath(userId, mimeType);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET_NAME)
      .upload(path, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError || !uploadData) {
      throw new Error(uploadError?.message || 'Failed to upload avatar to cloud storage.');
    }

    const { data: publicData } = supabase.storage
      .from(AVATAR_BUCKET_NAME)
      .getPublicUrl(path);

    if (!publicData?.publicUrl) {
      throw new Error('Failed to retrieve public URL for uploaded avatar.');
    }

    return publicData.publicUrl;
  }

  /**
   * Safely deletes an existing avatar from the user's folder.
   * Guaranteed to NEVER delete another user's file or non-storage preset.
   */
  async deleteAvatarByUrl(userId: string, avatarUrl: string): Promise<boolean> {
    if (!userId || !avatarUrl) return false;

    const path = this.extractStoragePathFromUrl(userId, avatarUrl);
    if (!path) {
      // Safe no-op (e.g. Unsplash athletic preset or external URL)
      return false;
    }

    try {
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET_NAME)
        .remove([path]);
      return !error;
    } catch {
      return false;
    }
  }
}

export const avatarService = new AvatarService();
