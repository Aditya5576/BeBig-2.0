import {
  Exercise,
  ExerciseCategory,
  ExerciseEquipment,
  ExerciseImage,
  ExerciseMuscle,
} from '../../types';
import { WgerExerciseInfoItem, WgerImage, WgerMuscle } from './wgerTypes';

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
 */
export function mapWgerToExercise(item: any): Exercise {
  if (!item || typeof item !== 'object') {
    throw new Error('Invalid Wger item: expected an object');
  }

  if (item.id == null || String(item.id).trim() === '') {
    throw new Error('Invalid Wger item: missing or empty id');
  }

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
