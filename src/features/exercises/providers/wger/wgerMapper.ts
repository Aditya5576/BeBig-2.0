import { z } from 'zod';
import {
  Exercise,
  ExerciseCategory,
  ExerciseEquipment,
  ExerciseImage,
  ExerciseMuscle,
} from '../../types';

/**
 * Zod schema for runtime validation of untrusted Wger API payloads.
 */
export const wgerItemSchema = z
  .object({
    id: z.union([z.number(), z.string()]).refine((val) => String(val).trim().length > 0, {
      message: 'missing or empty id',
    }),
    translations: z
      .array(
        z
          .object({
            id: z.union([z.number(), z.string()]).optional(),
            language: z.number().optional(),
            name: z.string().optional(),
            description: z.string().optional(),
            description_source: z.string().optional(),
          })
          .passthrough()
      )
      .optional()
      .nullable(),
    category: z
      .union([
        z.object({ id: z.union([z.number(), z.string()]).optional(), name: z.string().optional() }).passthrough(),
        z.string(),
      ])
      .optional()
      .nullable(),
    muscles: z.array(z.any()).optional().nullable(),
    muscles_secondary: z.array(z.any()).optional().nullable(),
    equipment: z.array(z.any()).optional().nullable(),
    images: z.array(z.any()).optional().nullable(),
  })
  .passthrough();

/**
 * Strips HTML tags and unescapes common HTML entities to produce clean text.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normalizes raw category name into BeBig standard ExerciseCategory.
 */
export function normalizeCategory(categoryName: string | undefined): {
  category: ExerciseCategory;
  categoryName: string;
} {
  if (!categoryName) return { category: 'other', categoryName: 'Other' };
  const lower = categoryName.trim().toLowerCase();

  if (lower.includes('chest')) return { category: 'chest', categoryName: 'Chest' };
  if (lower.includes('back')) return { category: 'back', categoryName: 'Back' };
  if (
    lower.includes('leg') ||
    lower.includes('quad') ||
    lower.includes('hamstring') ||
    lower.includes('glute')
  ) {
    return { category: 'legs', categoryName: 'Legs' };
  }
  if (lower.includes('arm') || lower.includes('bicep') || lower.includes('tricep')) {
    return { category: 'arms', categoryName: 'Arms' };
  }
  if (lower.includes('shoulder') || lower.includes('deltoid')) {
    return { category: 'shoulders', categoryName: 'Shoulders' };
  }
  if (lower.includes('ab') || lower.includes('core'))
    return { category: 'abs', categoryName: 'Abs' };
  if (lower.includes('calf') || lower.includes('calves'))
    return { category: 'calves', categoryName: 'Calves' };
  if (lower.includes('cardio')) return { category: 'cardio', categoryName: 'Cardio' };

  return { category: 'other', categoryName: categoryName };
}

function mapMuscle(m: any): ExerciseMuscle | null {
  if (!m || typeof m !== 'object') return null;
  return {
    id: String(m.id ?? ''),
    name: m.name_en && String(m.name_en).trim().length > 0 ? String(m.name_en) : String(m.name || 'Muscle'),
    isFront: Boolean(m.is_front),
  };
}

function mapImage(img: any): ExerciseImage | null {
  if (!img || typeof img !== 'object' || !img.image) return null;
  return {
    id: String(img.id ?? ''),
    url: String(img.image),
    thumbnailUrl: String(img.thumbnails?.medium || img.thumbnails?.small || img.image),
    isMain: Boolean(img.is_main),
  };
}

/**
 * Maps a single Wger exerciseinfo item into a provider-agnostic BeBig Exercise model.
 * Validates untrusted remote payloads using Zod schema.
 */
export function mapWgerToExercise(rawItem: unknown): Exercise {
  const parseResult = wgerItemSchema.safeParse(rawItem);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new Error(`Invalid Wger item: ${errorDetails}`);
  }

  const item = parseResult.data as any;
  const itemId = String(item.id).trim();
  const translations = Array.isArray(item.translations) ? item.translations : [];
  // English translation is language ID 2 in Wger
  const englishTrans = translations.find((t: any) => t && t.language === 2);
  const fallbackTrans = translations[0];
  const activeTrans = englishTrans || fallbackTrans;

  const name = activeTrans?.name?.trim() || `Exercise #${itemId}`;
  const rawDescription = activeTrans?.description_source || activeTrans?.description || '';
  const description = stripHtml(rawDescription);

  const rawCategoryName =
    item.category && typeof item.category === 'object'
      ? item.category.name
      : typeof item.category === 'string'
        ? item.category
        : undefined;
  const { category, categoryName } = normalizeCategory(rawCategoryName);

  const primaryMuscles: ExerciseMuscle[] = (Array.isArray(item.muscles) ? item.muscles : [])
    .map(mapMuscle)
    .filter((m: any): m is ExerciseMuscle => m !== null);
  const secondaryMuscles: ExerciseMuscle[] = (Array.isArray(item.muscles_secondary) ? item.muscles_secondary : [])
    .map(mapMuscle)
    .filter((m: any): m is ExerciseMuscle => m !== null);

  const equipment: ExerciseEquipment[] = (Array.isArray(item.equipment) ? item.equipment : [])
    .filter((eq: any) => eq && typeof eq === 'object')
    .map((eq: any) => ({
      id: String(eq.id ?? ''),
      name: String(eq.name ?? ''),
    }));

  const images: ExerciseImage[] = (Array.isArray(item.images) ? item.images : [])
    .map(mapImage)
    .filter((img: any): img is ExerciseImage => img !== null);

  return {
    id: `wger_${itemId}`,
    name,
    description,
    category,
    categoryName,
    primaryMuscles,
    secondaryMuscles,
    equipment,
    images,
    sourceProvider: 'wger',
    sourceExerciseId: itemId,
    isCustom: false,
  };
}
export interface WgerCatalogRecord {
  id: string;
  wger_id: number;
  name: string;
  description?: string;
  category: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  equipment?: string[];
  image_url?: string | null;
  license_name?: string;
  license_author?: string;
  attribution_text?: string;
  is_active?: boolean;
  synced_at?: string;
}

export function mapWgerCatalogRecordToExercise(record: Partial<WgerCatalogRecord>): Exercise | null {
  if (!record || record.wger_id == null || !record.name) return null;
  const itemId = String(record.wger_id);
  const { category, categoryName } = normalizeCategory(record.category);

  const primaryMuscles: ExerciseMuscle[] = (Array.isArray(record.primary_muscles) ? record.primary_muscles : []).map(
    (mName, idx) => ({ id: String(idx + 1), name: String(mName) })
  );
  const secondaryMuscles: ExerciseMuscle[] = (Array.isArray(record.secondary_muscles) ? record.secondary_muscles : []).map(
    (mName, idx) => ({ id: String(idx + 1), name: String(mName) })
  );
  const equipment: ExerciseEquipment[] = (Array.isArray(record.equipment) ? record.equipment : []).map(
    (eqName, idx) => ({ id: String(idx + 1), name: String(eqName) })
  );
  const images: ExerciseImage[] = record.image_url
    ? [
        {
          id: `wger_img_${itemId}`,
          url: record.image_url,
          thumbnailUrl: record.image_url,
          isMain: true,
        },
      ]
    : [];

  return {
    id: `wger_${itemId}`,
    name: record.name,
    description: record.description || '',
    category,
    categoryName,
    primaryMuscles,
    secondaryMuscles,
    equipment,
    images,
    sourceProvider: 'wger',
    sourceExerciseId: itemId,
    isCustom: false,
  };
}
