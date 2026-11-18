import { Platform } from 'react-native';
import { getUserScopedKey, getCurrentUserScope, UserScope } from '../../auth/utils/userScope';
import { Exercise } from '../types';
import { platformStorage } from '../../../lib/storage';
import {
  downscaleDataUrlToMaxEdge,
  exercisePhotoStorage,
  LARGE_DATA_URL_THRESHOLD_CHARS,
} from './exercisePhotoStorage';

export const BASE_CUSTOM_EXERCISES_KEY = 'bebig.exercises.custom';

const readStorage = async (key: string): Promise<string | null> => {
  return platformStorage.getItem(key);
};

const writeStorage = async (key: string, value: string): Promise<void> => {
  await platformStorage.setItem(key, value);
};

const deleteStorage = async (key: string): Promise<void> => {
  await platformStorage.removeItem(key);
};

// Track in-flight background photo compaction per storage key to prevent duplicate WebKit work
const activeCompactionKeys = new Set<string>();

function isOversizedDataUrl(val: unknown): val is string {
  return (
    typeof val === 'string' &&
    val.startsWith('data:image/') &&
    val.length > LARGE_DATA_URL_THRESHOLD_CHARS
  );
}

function hasOversizedInlinePhoto(ex: Exercise): boolean {
  if (Array.isArray(ex.images)) {
    for (const img of ex.images) {
      if (isOversizedDataUrl(img?.url) || isOversizedDataUrl(img?.thumbnailUrl)) {
        return true;
      }
    }
  }
  if (isOversizedDataUrl((ex as any).imageUrl)) {
    return true;
  }
  return false;
}

/**
 * Sequentially downscales pre-existing oversized `data:image/` URLs on custom exercises
 * one image at a time (bounded GPU memory) and returns whether any exercise was compacted.
 */
export async function compactOversizedCustomExercises(
  exercises: Exercise[],
): Promise<{ exercises: Exercise[]; changed: boolean }> {
  let changed = false;
  const result: Exercise[] = [];

  for (const ex of exercises) {
    if (!hasOversizedInlinePhoto(ex)) {
      result.push(ex);
      continue;
    }

    let exChanged = false;
    let updatedImages = ex.images;

    if (Array.isArray(ex.images) && ex.images.length > 0) {
      const nextImages = [];
      for (const img of ex.images) {
        let nextUrl = img.url;
        let nextThumb = img.thumbnailUrl;

        if (isOversizedDataUrl(img.url)) {
          const compacted = await downscaleDataUrlToMaxEdge(img.url);
          if (compacted !== img.url) {
            nextUrl = compacted;
            exChanged = true;
          }
        }
        if (isOversizedDataUrl(img.thumbnailUrl)) {
          const compactedThumb = await downscaleDataUrlToMaxEdge(img.thumbnailUrl);
          if (compactedThumb !== img.thumbnailUrl) {
            nextThumb = compactedThumb;
            exChanged = true;
          }
        }
        nextImages.push({
          ...img,
          url: nextUrl,
          ...(nextThumb !== undefined ? { thumbnailUrl: nextThumb } : {}),
        });
      }
      updatedImages = nextImages;
    }

    const legacyImageUrl = (ex as any).imageUrl;
    let nextLegacyUrl = legacyImageUrl;
    if (isOversizedDataUrl(legacyImageUrl)) {
      const compactedLegacy = await downscaleDataUrlToMaxEdge(legacyImageUrl);
      if (compactedLegacy !== legacyImageUrl) {
        nextLegacyUrl = compactedLegacy;
        exChanged = true;
      }
    }

    if (exChanged) {
      changed = true;
      const compactedExercise: Exercise = {
        ...ex,
        images: updatedImages,
        ...(legacyImageUrl !== undefined ? { imageUrl: nextLegacyUrl } : {}),
      } as Exercise;
      result.push(compactedExercise);

      // Also compact the standalone web photo key if present
      const mainUrl = updatedImages?.[0]?.url || nextLegacyUrl;
      if (typeof mainUrl === 'string' && mainUrl.startsWith('data:image/')) {
        try {
          const photoKey = exercisePhotoStorage.getWebStorageKey(ex.id);
          await platformStorage.setItem(photoKey, mainUrl);
        } catch {
          // Non-fatal
        }
      }
    } else {
      result.push(ex);
    }
  }

  return { exercises: result, changed };
}

function scheduleWebPhotoCompaction(storageKey: string, loaded: Exercise[]): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (activeCompactionKeys.has(storageKey)) return;
  if (!loaded.some(hasOversizedInlinePhoto)) return;

  activeCompactionKeys.add(storageKey);

  void (async () => {
    try {
      const { exercises: compacted, changed } = await compactOversizedCustomExercises(loaded);
      if (changed) {
        await writeStorage(storageKey, JSON.stringify(compacted));
      }
    } catch {
      // Background compaction failure is non-fatal
    } finally {
      activeCompactionKeys.delete(storageKey);
    }
  })();
}

export const customExerciseStorage = {
  /**
   * Clears volatile in-memory storage (called on logout/user switch).
   */
  clearMemoryCache: (): void => {
    activeCompactionKeys.clear();
  },

  getCustomExercises: async (scope?: UserScope | null): Promise<Exercise[]> => {
    try {
      const resolvedScope =
        scope !== undefined
          ? scope
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

      const key = getUserScopedKey(BASE_CUSTOM_EXERCISES_KEY, resolvedScope);
      if (!key) return [];

      let raw = await readStorage(key);
      if (!raw && process.env.NODE_ENV === 'test') {
        raw = await readStorage('bebig.custom.exercises');
      }
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Exercise[];
      if (Array.isArray(parsed)) {
        // One-time non-blocking background compaction for pre-v2.4.2 12MP stored photos on Web
        scheduleWebPhotoCompaction(key, parsed);
      }
      return parsed;
    } catch {
      return [];
    }
  },

  saveCustomExercise: async (exercise: Exercise, scope?: UserScope | null): Promise<void> => {
    const targetScope =
      scope !== undefined
        ? scope
        : exercise.ownerId && exercise.ownerType
          ? { ownerId: exercise.ownerId, ownerType: exercise.ownerType }
          : (getCurrentUserScope() ??
            (process.env.NODE_ENV === 'test'
              ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
              : null));

    const key = getUserScopedKey(BASE_CUSTOM_EXERCISES_KEY, targetScope);
    if (!key) {
      throw new Error('Cannot save custom exercise without an active user session.');
    }

    try {
      const current = await customExerciseStorage.getCustomExercises(targetScope);
      const filtered = current.filter((e) => e.id !== exercise.id);
      const updated = [exercise, ...filtered];
      await writeStorage(key, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  deleteCustomExercise: async (id: string, scope?: UserScope | null): Promise<void> => {
    const resolvedScope =
      scope !== undefined
        ? scope
        : (getCurrentUserScope() ??
          (process.env.NODE_ENV === 'test'
            ? { ownerId: 'test_default_user', ownerType: 'authenticated' as const }
            : null));

    const key = getUserScopedKey(BASE_CUSTOM_EXERCISES_KEY, resolvedScope);
    if (!key) return;

    try {
      const current = await customExerciseStorage.getCustomExercises(resolvedScope);
      const updated = current.filter((e) => e.id !== id);
      await writeStorage(key, JSON.stringify(updated));
    } catch {
      // Handled
    }
  },

  clearCustomExercises: async (scope?: UserScope | null): Promise<void> => {
    const key = getUserScopedKey(BASE_CUSTOM_EXERCISES_KEY, scope);
    try {
      if (key) await deleteStorage(key);
      if (!scope && process.env.NODE_ENV === 'test') {
        platformStorage.clearMemoryCache();
        await deleteStorage('bebig.custom.exercises');
      }
    } catch {
      // Handled
    }
  },
};
