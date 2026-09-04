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

function mapMuscle(m: WgerMuscle): ExerciseMuscle {
  return {
    id: String(m.id),
    name: m.name_en && m.name_en.trim().length > 0 ? m.name_en : m.name,
    isFront: m.is_front,
  };
}

function mapImage(img: WgerImage): ExerciseImage {
  return {
    id: String(img.id),
    url: img.image,
    thumbnailUrl: img.thumbnails?.medium || img.thumbnails?.small || img.image,
    isMain: img.is_main ?? false,
  };
}

/**
 * Maps a single Wger exerciseinfo item into a provider-agnostic BeBig Exercise model.
 */
export function mapWgerToExercise(item: WgerExerciseInfoItem): Exercise {
  // English translation is language ID 2 in Wger
  const englishTrans = item.translations.find((t) => t.language === 2);
  const fallbackTrans = item.translations[0];
  const activeTrans = englishTrans || fallbackTrans;

  const name = activeTrans?.name?.trim() || `Exercise #${item.id}`;
  const rawDescription = activeTrans?.description_source || activeTrans?.description || '';
  const description = stripHtml(rawDescription);

  const { category, categoryName } = normalizeCategory(item.category?.name);

  const primaryMuscles: ExerciseMuscle[] = (item.muscles || []).map(mapMuscle);
  const secondaryMuscles: ExerciseMuscle[] = (item.muscles_secondary || []).map(mapMuscle);

  const equipment: ExerciseEquipment[] = (item.equipment || []).map((eq) => ({
    id: String(eq.id),
    name: eq.name,
  }));

  const images: ExerciseImage[] = (item.images || []).map(mapImage);

  return {
    id: `wger_${item.id}`,
    name,
    description,
    category,
    categoryName,
    primaryMuscles,
    secondaryMuscles,
    equipment,
    images,
    sourceProvider: 'wger',
    sourceExerciseId: String(item.id),
    isCustom: false,
  };
}
