/**
 * BeBig 2.0 — Global Curated Exercise Catalog Service (Admin Milestone 3)
 *
 * Strictly metadata/text-only curated exercises (`name`, `category`, `equipment`,
 * `primary_muscles`, `secondary_muscles`, `instructions`, `is_active`).
 *
 * Mandatory WebKit & Data-Safety Rules:
 * - ZERO base64/bitmap image payloads accepted, stored, or emitted (`images: []`).
 * - Deterministic `global_<id>` domain IDs so curated exercises NEVER overwrite
 *   or collide with user custom exercises (`custom_*`).
 * - Graceful offline / pre-migration fallback via `platformStorage`.
 */

import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  isDeviceOffline,
  isMissingSchemaError,
  isRemoteResourceBackedOff,
  markRemoteResourceMissing,
  withSafeTimeout,
} from '../../../lib/supabase/resilience';
import { platformStorage } from '../../../lib/storage';
import type { Exercise, ExerciseCategory } from '../types';

export interface GlobalExerciseRecord {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  name: string;
  category: ExerciseCategory;
  equipment: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  instructions: string[];
  is_active: boolean;
  image_url?: string | null;
  imageUrl?: string | null;
  source?: 'remote' | 'local';
}

export interface SaveGlobalExerciseInput {
  id?: string;
  name: string;
  category: ExerciseCategory | string;
  equipment?: string;
  primary_muscles: string[];
  secondary_muscles?: string[];
  instructions?: string[];
  is_active?: boolean;
  image_url?: string | null;
  imageUrl?: string | null;
  createdBy?: string | null;
}

export const GLOBAL_EXERCISE_ID_PREFIX = 'global_';
const LOCAL_GLOBAL_EXERCISES_KEY = 'bebig.admin.local_global_exercises';

const VALID_CATEGORIES: readonly ExerciseCategory[] = [
  'abs',
  'arms',
  'back',
  'calves',
  'cardio',
  'chest',
  'legs',
  'shoulders',
  'other',
];

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  abs: 'Abs',
  arms: 'Arms',
  back: 'Back',
  calves: 'Calves',
  cardio: 'Cardio',
  chest: 'Chest',
  legs: 'Legs',
  shoulders: 'Shoulders',
  other: 'Other',
};

const DATA_IMAGE_PATTERN = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
const GLOBAL_CATALOG_REMOTE_TTL_MS = 60_000;
const GLOBAL_CATALOG_TIMEOUT_MS = 2500;
const GLOBAL_CATALOG_RESOURCE_KEY = 'table:global_exercise_catalog';

let memoryActiveGlobalExercises: Exercise[] = [];
let lastRemoteGlobalFetchAt = 0;

function normalizeCategory(raw: unknown): ExerciseCategory {
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase() as ExerciseCategory;
    if (VALID_CATEGORIES.includes(lower)) {
      return lower;
    }
  }
  return 'other';
}

function stripBitmapStrings(text: string): string {
  return text.replace(DATA_IMAGE_PATTERN, '').trim();
}

function sanitizeStringArray(raw: unknown, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(raw)) return [];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const cleaned = stripBitmapStrings(item).slice(0, maxItemLength);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(cleaned);
    }
    if (deduped.length >= maxItems) break;
  }
  return deduped;
}

/**
 * Validates and sanitizes a global exercise payload, strictly rejecting/stripping
 * any base64/bitmap image payloads and returning metadata/text-only fields.
 */
export function sanitizeGlobalExerciseInput(input: SaveGlobalExerciseInput): {
  name: string;
  category: ExerciseCategory;
  equipment: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  instructions: string[];
  is_active: boolean;
  image_url: string | null;
} {
  const rawName = typeof input.name === 'string' ? input.name : '';
  if (DATA_IMAGE_PATTERN.test(rawName)) {
    DATA_IMAGE_PATTERN.lastIndex = 0;
    throw new Error('Bitmap/base64 image payloads are not permitted in the global exercise catalog.');
  }
  DATA_IMAGE_PATTERN.lastIndex = 0;

  const name = stripBitmapStrings(rawName).slice(0, 140);
  if (!name) {
    throw new Error('Exercise name is required.');
  }

  const category = normalizeCategory(input.category);
  const equipment =
    stripBitmapStrings(typeof input.equipment === 'string' ? input.equipment : '').slice(0, 80) ||
    'Bodyweight';

  const primary_muscles = sanitizeStringArray(input.primary_muscles, 10, 64);
  if (primary_muscles.length === 0) {
    throw new Error('At least one primary muscle is required.');
  }

  const secondary_muscles = sanitizeStringArray(input.secondary_muscles ?? [], 10, 64);
  const instructions = sanitizeStringArray(input.instructions ?? [], 15, 320);

  const rawImage = input.image_url ?? input.imageUrl;
  let image_url: string | null = null;
  if (typeof rawImage === 'string' && rawImage.trim().length > 0) {
    const trimmed = rawImage.trim();
    if (DATA_IMAGE_PATTERN.test(trimmed) || trimmed.startsWith('data:image/')) {
      DATA_IMAGE_PATTERN.lastIndex = 0;
      throw new Error(
        'Raw base64 data:image strings are not permitted. Please provide an HTTPS URL or use photo upload.',
      );
    }
    if (!trimmed.startsWith('https://')) {
      throw new Error('Exercise image must be a secure HTTPS URL (https://...).');
    }
    if (trimmed.length > 2048) {
      throw new Error('Image URL is too long (maximum 2048 characters).');
    }
    image_url = trimmed;
  }

  return {
    name,
    category,
    equipment,
    primary_muscles,
    secondary_muscles,
    instructions,
    is_active: input.is_active !== undefined ? Boolean(input.is_active) : true,
    image_url,
  };
}

/**
 * Maps a curated `GlobalExerciseRecord` into a bitmap-free BeBig `Exercise` domain entity.
 */
export function mapGlobalRecordToExercise(record: GlobalExerciseRecord): Exercise {
  const exerciseId = record.id.startsWith(GLOBAL_EXERCISE_ID_PREFIX)
    ? record.id
    : `${GLOBAL_EXERCISE_ID_PREFIX}${record.id}`;

  const category = normalizeCategory(record.category);
  const description =
    record.instructions.length > 0
      ? record.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n')
      : `${record.name} targeting ${record.primary_muscles.join(', ')}.`;

  const safeImageUrl =
    record.image_url && record.image_url.trim().startsWith('https://')
      ? record.image_url.trim()
      : record.imageUrl && record.imageUrl.trim().startsWith('https://')
        ? record.imageUrl.trim()
        : null;

  return {
    id: exerciseId,
    name: record.name,
    description,
    category,
    categoryName: CATEGORY_LABELS[category],
    primaryMuscles: record.primary_muscles.map((m, idx) => ({
      id: `gm-p-${idx}-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: m,
    })),
    secondaryMuscles: record.secondary_muscles.map((m, idx) => ({
      id: `gm-s-${idx}-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: m,
    })),
    equipment: [
      {
        id: `eq-global-${record.equipment.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: record.equipment,
      },
    ],
    instructions: [...record.instructions],
    images: [],
    photoPath: safeImageUrl,
    sourceProvider: 'system',
    sourceExerciseId: record.id,
    isCustom: false,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function normalizeRemoteRow(row: unknown): GlobalExerciseRecord {
  const rec = (row ?? {}) as Record<string, unknown>;
  const rawImg = typeof rec.image_url === 'string' ? rec.image_url.trim() : null;
  const safeImg = rawImg && rawImg.startsWith('https://') ? rawImg : null;
  return {
    id: String(rec.id ?? ''),
    created_at: typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString(),
    updated_at: typeof rec.updated_at === 'string' ? rec.updated_at : new Date().toISOString(),
    created_by: typeof rec.created_by === 'string' ? rec.created_by : null,
    name: stripBitmapStrings(typeof rec.name === 'string' ? rec.name : '').slice(0, 140),
    category: normalizeCategory(rec.category),
    equipment:
      stripBitmapStrings(typeof rec.equipment === 'string' ? rec.equipment : '').slice(0, 80) ||
      'Bodyweight',
    primary_muscles: sanitizeStringArray(rec.primary_muscles, 10, 64),
    secondary_muscles: sanitizeStringArray(rec.secondary_muscles, 10, 64),
    instructions: sanitizeStringArray(rec.instructions, 15, 320),
    is_active: rec.is_active !== false,
    image_url: safeImg,
    imageUrl: safeImg,
    source: 'remote',
  };
}

async function readLocalGlobalExercises(): Promise<GlobalExerciseRecord[]> {
  try {
    const raw = await platformStorage.getItem(LOCAL_GLOBAL_EXERCISES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GlobalExerciseRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as GlobalExerciseRecord).id === 'string' &&
        typeof (item as GlobalExerciseRecord).name === 'string',
    );
  } catch {
    return [];
  }
}

async function writeLocalGlobalExercises(items: GlobalExerciseRecord[]): Promise<void> {
  try {
    await platformStorage.setItem(LOCAL_GLOBAL_EXERCISES_KEY, JSON.stringify(items));
  } catch {
    // Non-fatal local persistence fallback
  }
}

function syncMemoryActiveCache(records: GlobalExerciseRecord[]): Exercise[] {
  const mapped = records
    .filter((rec) => rec.is_active && rec.name.length > 0)
    .map(mapGlobalRecordToExercise);
  memoryActiveGlobalExercises = mapped;
  return mapped;
}

export const globalExerciseCatalogService = {
  /**
   * Lists ALL curated global exercises (active + hidden) for Admin Tab 6.
   */
  async listAllGlobalExercises(): Promise<GlobalExerciseRecord[]> {
    const localRows = await readLocalGlobalExercises();

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('global_exercise_catalog')
          .select(
            'id, created_at, updated_at, created_by, name, category, equipment, primary_muscles, secondary_muscles, instructions, is_active, image_url',
          )
          .order('name', { ascending: true })
          .limit(250);

        if (!error && Array.isArray(data)) {
          const remoteRows = data.map(normalizeRemoteRow);
          const merged = new Map<string, GlobalExerciseRecord>();
          for (const row of remoteRows) merged.set(row.id, row);
          for (const row of localRows) {
            if (!merged.has(row.id)) merged.set(row.id, row);
          }
          const combined = Array.from(merged.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          syncMemoryActiveCache(combined);
          return combined;
        }
      } catch {
        // Fall through to local fallback
      }
    }

    const sortedLocal = [...localRows].sort((a, b) => a.name.localeCompare(b.name));
    syncMemoryActiveCache(sortedLocal);
    return sortedLocal;
  },

  /**
   * Returns active curated global exercises mapped to BeBig `Exercise` domain objects.
   * Gracefully falls back when offline or before M3 migration rollout.
   */
  async getActiveGlobalExercises(): Promise<Exercise[]> {
    const localActive = (await readLocalGlobalExercises()).filter((rec) => rec.is_active);
    const now = Date.now();

    // Serve fresh in-memory cache cleanly during rapid search/navigation
    if (
      lastRemoteGlobalFetchAt > 0 &&
      now - lastRemoteGlobalFetchAt < GLOBAL_CATALOG_REMOTE_TTL_MS &&
      memoryActiveGlobalExercises.length >= localActive.length
    ) {
      return [...memoryActiveGlobalExercises];
    }

    const remoteActive: GlobalExerciseRecord[] = [];

    if (
      isSupabaseConfigured() &&
      !isDeviceOffline() &&
      !isRemoteResourceBackedOff(GLOBAL_CATALOG_RESOURCE_KEY)
    ) {
      try {
        const resp = await withSafeTimeout(
          supabase
            .from('global_exercise_catalog')
            .select(
              'id, created_at, updated_at, created_by, name, category, equipment, primary_muscles, secondary_muscles, instructions, is_active, image_url',
            )
            .eq('is_active', true)
            .order('name', { ascending: true })
            .limit(250),
          GLOBAL_CATALOG_TIMEOUT_MS,
          { data: null, error: null },
        );

        if (resp.error) {
          if (isMissingSchemaError(resp.error)) {
            markRemoteResourceMissing(GLOBAL_CATALOG_RESOURCE_KEY);
          }
        } else if (Array.isArray(resp.data)) {
          lastRemoteGlobalFetchAt = now;
          for (const row of resp.data) {
            remoteActive.push(normalizeRemoteRow(row));
          }
        }
      } catch {
        // Graceful offline/unmigrated fallback
      }
    }

    const merged = new Map<string, GlobalExerciseRecord>();
    for (const row of remoteActive) merged.set(row.id, row);
    for (const row of localActive) {
      if (!merged.has(row.id)) merged.set(row.id, row);
    }

    return syncMemoryActiveCache(Array.from(merged.values()));
  },

  /**
   * Resolves a single curated global exercise by `global_<id>` or raw UUID.
   */
  async getGlobalExerciseById(id: string): Promise<Exercise | null> {
    if (!id) return null;
    const syncHit = this.getCachedGlobalExerciseByIdSync(id);
    if (syncHit) return syncHit;

    const all = await this.getActiveGlobalExercises();
    const rawId = id.startsWith(GLOBAL_EXERCISE_ID_PREFIX)
      ? id.slice(GLOBAL_EXERCISE_ID_PREFIX.length)
      : id;

    return (
      all.find((ex) => ex.id === id || ex.sourceExerciseId === rawId) ?? null
    );
  },

  /**
   * Synchronous 0ms lookup against the in-memory active global catalog mirror.
   */
  getCachedGlobalExerciseByIdSync(id: string): Exercise | null {
    if (!id || memoryActiveGlobalExercises.length === 0) return null;
    const rawId = id.startsWith(GLOBAL_EXERCISE_ID_PREFIX)
      ? id.slice(GLOBAL_EXERCISE_ID_PREFIX.length)
      : id;
    return (
      memoryActiveGlobalExercises.find(
        (ex) => ex.id === id || ex.sourceExerciseId === rawId,
      ) ?? null
    );
  },

  /**
   * Creates or updates a curated global exercise (text/metadata only, zero bitmaps).
   */
  async saveGlobalExercise(input: SaveGlobalExerciseInput): Promise<GlobalExerciseRecord> {
    const clean = sanitizeGlobalExerciseInput(input);
    const isUpdateRemote =
      Boolean(input.id) && !String(input.id).startsWith('local_gex_');

    if (isSupabaseConfigured() && (!input.id || isUpdateRemote)) {
      try {
        if (input.id && isUpdateRemote) {
          const { data, error } = await supabase
            .from('global_exercise_catalog')
            .update({
              name: clean.name,
              category: clean.category,
              equipment: clean.equipment,
              primary_muscles: clean.primary_muscles,
              secondary_muscles: clean.secondary_muscles,
              instructions: clean.instructions,
              is_active: clean.is_active,
              image_url: clean.image_url,
            })
            .eq('id', input.id)
            .select(
              'id, created_at, updated_at, created_by, name, category, equipment, primary_muscles, secondary_muscles, instructions, is_active, image_url',
            )
            .single();

          if (!error && data) {
            const normalized = normalizeRemoteRow(data);
            void this.getActiveGlobalExercises();
            return normalized;
          }
        } else {
          const { data, error } = await supabase
            .from('global_exercise_catalog')
            .insert({
              name: clean.name,
              category: clean.category,
              equipment: clean.equipment,
              primary_muscles: clean.primary_muscles,
              secondary_muscles: clean.secondary_muscles,
              instructions: clean.instructions,
              is_active: clean.is_active,
              image_url: clean.image_url,
              created_by: input.createdBy ?? null,
            })
            .select(
              'id, created_at, updated_at, created_by, name, category, equipment, primary_muscles, secondary_muscles, instructions, is_active, image_url',
            )
            .single();

          if (!error && data) {
            const normalized = normalizeRemoteRow(data);
            void this.getActiveGlobalExercises();
            return normalized;
          }
        }
      } catch {
        // Fall through to local fallback
      }
    }

    const nowIso = new Date().toISOString();
    const existing = await readLocalGlobalExercises();

    if (input.id) {
      let updated: GlobalExerciseRecord | null = null;
      const nextList = existing.map((item) => {
        if (item.id === input.id) {
          updated = {
            ...item,
            ...clean,
            updated_at: nowIso,
          };
          return updated;
        }
        return item;
      });
      if (updated) {
        await writeLocalGlobalExercises(nextList);
        syncMemoryActiveCache(nextList);
        return updated;
      }
    }

    const createdLocal: GlobalExerciseRecord = {
      id: `local_gex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: nowIso,
      updated_at: nowIso,
      created_by: input.createdBy ?? null,
      ...clean,
      source: 'local',
    };

    const nextList = [createdLocal, ...existing].slice(0, 250);
    await writeLocalGlobalExercises(nextList);
    syncMemoryActiveCache(nextList);
    return createdLocal;
  },

  /**
   * Toggles a global exercise's visibility (`Active` / `Hidden`).
   */
  async toggleGlobalExerciseActive(
    id: string,
    isActive: boolean,
  ): Promise<GlobalExerciseRecord | null> {
    if (isSupabaseConfigured() && !id.startsWith('local_gex_')) {
      try {
        const { data, error } = await supabase
          .from('global_exercise_catalog')
          .update({ is_active: isActive })
          .eq('id', id)
          .select(
            'id, created_at, updated_at, created_by, name, category, equipment, primary_muscles, secondary_muscles, instructions, is_active',
          )
          .single();

        if (!error && data) {
          const normalized = normalizeRemoteRow(data);
          void this.getActiveGlobalExercises();
          return normalized;
        }
      } catch {
        // Fall through to local update
      }
    }

    const existing = await readLocalGlobalExercises();
    let updated: GlobalExerciseRecord | null = null;
    const nextList = existing.map((item) => {
      if (item.id === id) {
        updated = { ...item, is_active: isActive, updated_at: new Date().toISOString() };
        return updated;
      }
      return item;
    });
    if (updated) {
      await writeLocalGlobalExercises(nextList);
      syncMemoryActiveCache(nextList);
    }
    return updated;
  },

  /**
   * Deletes a curated global exercise from the catalog.
   */
  async deleteGlobalExercise(id: string): Promise<void> {
    if (isSupabaseConfigured() && !id.startsWith('local_gex_')) {
      try {
        await supabase.from('global_exercise_catalog').delete().eq('id', id);
      } catch {
        // Best-effort remote delete
      }
    }

    const existing = await readLocalGlobalExercises();
    const nextList = existing.filter((item) => item.id !== id);
    await writeLocalGlobalExercises(nextList);
    syncMemoryActiveCache(nextList);
  },

  /**
   * Resets in-memory mirror (used by isolated unit tests).
   */
  _resetForTests(): void {
    memoryActiveGlobalExercises = [];
    lastRemoteGlobalFetchAt = 0;
  },
};
