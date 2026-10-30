/**
 * BeBig 2.0 — Curated Exercise Demonstration Media Catalog
 *
 * Ground-truth repository of verified, licensed demonstration media
 * keyed strictly by canonical exercise IDs (e.g. 'seed-bench-press', 'wger_192').
 *
 * GOVERNANCE RULES:
 * 1. Mappings MUST use exact, stable exercise IDs as keys.
 * 2. Media MUST NOT be resolved by exercise display name alone.
 * 3. Every asset MUST have an individually verified author, source URL, and license.
 * 4. Assets MUST NOT be marked `isApproved: true` without explicit verification.
 * 5. Production catalog starts empty; asset curation and licensing validation
 *    is performed movement-by-movement in dedicated curation milestones.
 */

import { ExerciseDemonstration } from '../types';

export type CuratedMediaCatalog = Readonly<Record<string, ExerciseDemonstration>>;

/**
 * Production catalog of verified demonstration media.
 * Contains only individually audited, licensed, and approved assets.
 * Keyed strictly by canonical exercise IDs.
 */
export const CURATED_EXERCISE_MEDIA_CATALOG: CuratedMediaCatalog = Object.freeze({
  // 1. Bench Press (Barbell Bench Press)
  'wger_73': Object.freeze({
    exerciseId: 'wger_73',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/192/Bench-press-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'sistab2',
      sourceUrl: 'https://wger.de/en/exercise/73/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Bench Press illustration by sistab2, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // 2. Benchpress Dumbbells (Flat Dumbbell Bench Press)
  'wger_75': Object.freeze({
    exerciseId: 'wger_75',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/97/Dumbbell-bench-press-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/97/Dumbbell-bench-press-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic / wger.de',
      sourceUrl: 'https://wger.de/en/exercise/75/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Dumbbell Bench Press illustration by Everkinetic, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // 3. Incline Bench Press - Barbell
  'wger_538': Object.freeze({
    exerciseId: 'wger_538',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/41/Incline-bench-press-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/41/Incline-bench-press-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic / wger.de',
      sourceUrl: 'https://wger.de/en/exercise/538/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Incline Bench Press illustration by Everkinetic, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // 4. Front Squats
  'wger_257': Object.freeze({
    exerciseId: 'wger_257',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/191/Front-squat-1-857x1024.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/191/Front-squat-1-857x1024.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'sistab2',
      sourceUrl: 'https://wger.de/en/exercise/257/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Front Squat illustration by sistab2, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // 5. Biceps Curls With Barbell
  'wger_91': Object.freeze({
    exerciseId: 'wger_91',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/74/Bicep-curls-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/74/Bicep-curls-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic / wger.de',
      sourceUrl: 'https://wger.de/en/exercise/91/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Biceps Curls with Barbell illustration by Everkinetic, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // 6. Hammer Curls
  'wger_272': Object.freeze({
    exerciseId: 'wger_272',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/86/Bicep-hammer-curl-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/86/Bicep-hammer-curl-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic / wger.de',
      sourceUrl: 'https://wger.de/en/exercise/272/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Hammer Curls illustration by Everkinetic, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // 7. Shoulder Press, Barbell
  'wger_566': Object.freeze({
    exerciseId: 'wger_566',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/119/seated-barbell-shoulder-press-large-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/119/seated-barbell-shoulder-press-large-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic / wger.de',
      sourceUrl: 'https://wger.de/en/exercise/566/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Barbell Shoulder Press illustration by Everkinetic, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // 8. Lateral Raises
  'wger_348': Object.freeze({
    exerciseId: 'wger_348',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/148/lateral-dumbbell-raises-large-2.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/148/lateral-dumbbell-raises-large-2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic / wger.de',
      sourceUrl: 'https://wger.de/en/exercise/348/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Lateral Raises illustration by Everkinetic, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // 9. Dips Between Two Benches (Bench Dips)
  'wger_197': Object.freeze({
    exerciseId: 'wger_197',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/83/Bench-dips-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/83/Bench-dips-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic / wger.de',
      sourceUrl: 'https://wger.de/en/exercise/197/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Bench Dips illustration by Everkinetic, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // 10. Bent Over Rowing Reverse
  'wger_84': Object.freeze({
    exerciseId: 'wger_84',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/110/Reverse-grip-bent-over-rows-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/110/Reverse-grip-bent-over-rows-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic / wger.de',
      sourceUrl: 'https://wger.de/en/exercise/84/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Bent Over Rowing Reverse illustration by Everkinetic, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  // Seed Canonical Exercise Mappings (Offline / Instant First Run)
  'seed-bench-press': Object.freeze({
    exerciseId: 'seed-bench-press',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/192/Bench-press-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'sistab2',
      sourceUrl: 'https://wger.de/en/exercise/73/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Barbell Bench Press illustration by sistab2, sourced from wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),

  'seed-lateral-raise': Object.freeze({
    exerciseId: 'seed-lateral-raise',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/148/lateral-dumbbell-raises-large-2.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/148/lateral-dumbbell-raises-large-2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic / wger.de',
      sourceUrl: 'https://wger.de/en/exercise/348/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Dumbbell Lateral Raise illustration by Everkinetic / wger.de under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),
});
