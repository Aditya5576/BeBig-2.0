/**
 * BeBig 2.0 — Curated Exercise Demonstration Media Catalog
 *
 * Ground-truth repository of verified, licensed demonstration media
 * keyed strictly by canonical exercise IDs (e.g. 'seed-bench-press', 'wger_73').
 *
 * GOVERNANCE RULES:
 * 1. Mappings MUST use exact, stable exercise IDs as keys.
 * 2. Media MUST NOT be resolved by exercise display name alone.
 * 3. Every asset MUST have an individually verified author, source URL, and license.
 * 4. Assets MUST NOT be marked `isApproved: true` without explicit verification.
 * 5. Ingested from verified official WGER CC-BY-SA media catalog (279 verified movements).
 * 6. Preserves canonical seed bindings for offline / instant first-run consistency.
 */

import { ExerciseDemonstration } from '../types';

export type CuratedMediaCatalog = Readonly<Record<string, ExerciseDemonstration>>;

/**
 * Production catalog of verified demonstration media.
 * Contains only audited, licensed, and approved assets.
 * Keyed strictly by canonical exercise IDs.
 */
export const CURATED_EXERCISE_MEDIA_CATALOG: CuratedMediaCatalog = Object.freeze({
  // wger_12: Seated Hip Adduction
  'wger_12': Object.freeze({
    exerciseId: 'wger_12',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/12/4a42cc6f-648d-40cc-a72a-c49dd47e1667.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/12/4a42cc6f-648d-40cc-a72a-c49dd47e1667.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'flori',
      sourceUrl: 'https://wger.de/en/exercise/12/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Seated Hip Adduction demonstration illustration by flori, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_31: Axe Hold
  'wger_31': Object.freeze({
    exerciseId: 'wger_31',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/31/92f6451b-f89d-49d6-9531-8970ea420d97.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/31/92f6451b-f89d-49d6-9531-8970ea420d97.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'GrosseHund',
      sourceUrl: 'https://wger.de/en/exercise/31/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Axe Hold demonstration illustration by GrosseHund, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_41: Barbell Ab Rollout
  'wger_41': Object.freeze({
    exerciseId: 'wger_41',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/41/34b37423-269f-43d4-9d29-d2a90eeaa6b4.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/41/34b37423-269f-43d4-9d29-d2a90eeaa6b4.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'sevae',
      sourceUrl: 'https://wger.de/en/exercise/41/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Barbell Ab Rollout demonstration illustration by sevae, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_50: Barbell Triceps Extension
  'wger_50': Object.freeze({
    exerciseId: 'wger_50',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/50/695ced5c-9961-4076-add2-cb250d01089e.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/50/695ced5c-9961-4076-add2-cb250d01089e.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/50/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Barbell Triceps Extension demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_51: Barbell Wrist Curl
  'wger_51': Object.freeze({
    exerciseId: 'wger_51',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/51/f1730f56-7aca-4566-8338-3e42b1bee6e1.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/51/f1730f56-7aca-4566-8338-3e42b1bee6e1.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'burenl',
      sourceUrl: 'https://wger.de/en/exercise/51/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Barbell Wrist Curl demonstration illustration by burenl, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_73: Bench Press
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

  // wger_75: Benchpress Dumbbells
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

  // wger_76: Bench Press Narrow Grip
  'wger_76': Object.freeze({
    exerciseId: 'wger_76',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/88/Narrow-grip-bench-press-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/88/Narrow-grip-bench-press-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/76/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Bench Press Narrow Grip demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_79: Bent High Pulls
  'wger_79': Object.freeze({
    exerciseId: 'wger_79',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/79/da58dfbf-748a-461b-891e-3d6bc9cc4be2.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/79/da58dfbf-748a-461b-891e-3d6bc9cc4be2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'lakerbeezel',
      sourceUrl: 'https://wger.de/en/exercise/79/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Bent High Pulls demonstration illustration by lakerbeezel, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_81: Bent Over Dumbbell Rows (Single Arm)
  'wger_81': Object.freeze({
    exerciseId: 'wger_81',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/81/a751a438-ae2d-4751-8d61-cef0e9292174.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/81/a751a438-ae2d-4751-8d61-cef0e9292174.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/81/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Bent Over Dumbbell Rows (Single Arm) demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_83: Bent Over Rowing
  'wger_83': Object.freeze({
    exerciseId: 'wger_83',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/109/Barbell-rear-delt-row-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/109/Barbell-rear-delt-row-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/83/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Bent Over Rowing demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_84: Bent Over Rowing Reverse
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

  // wger_91: Biceps Curls With Barbell
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

  // wger_92: Biceps Curls With Dumbbell
  'wger_92': Object.freeze({
    exerciseId: 'wger_92',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/81/Biceps-curl-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/81/Biceps-curl-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/92/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Biceps Curls With Dumbbell demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_94: Biceps Curls With SZ-bar
  'wger_94': Object.freeze({
    exerciseId: 'wger_94',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/94/6dee2f60-aea2-4f2d-9bf6-aef50c4f9483.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/94/6dee2f60-aea2-4f2d-9bf6-aef50c4f9483.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/94/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Biceps Curls With SZ-bar demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_95: Biceps Curl With Cable
  'wger_95': Object.freeze({
    exerciseId: 'wger_95',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/129/Standing-biceps-curl-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/129/Standing-biceps-curl-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/95/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Biceps Curl With Cable demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_129: Chest Press
  'wger_129': Object.freeze({
    exerciseId: 'wger_129',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/129/b263c968-e067-4750-916a-d8758a7df23e.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/129/b263c968-e067-4750-916a-d8758a7df23e.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'roneydya',
      sourceUrl: 'https://wger.de/en/exercise/129/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Chest Press demonstration illustration by roneydya, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_135: Butterfly
  'wger_135': Object.freeze({
    exerciseId: 'wger_135',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/98/Butterfly-machine-2.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/98/Butterfly-machine-2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/135/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Butterfly demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_146: Calf Press Using Leg Press Machine
  'wger_146': Object.freeze({
    exerciseId: 'wger_146',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/146/8b284904-d072-4381-a256-4c81d8fd9c1f.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/146/8b284904-d072-4381-a256-4c81d8fd9c1f.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'nate303303',
      sourceUrl: 'https://wger.de/en/exercise/146/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Calf Press Using Leg Press Machine demonstration illustration by nate303303, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_152: Chin Up
  'wger_152': Object.freeze({
    exerciseId: 'wger_152',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/152/6c1a7459-266d-491a-bd50-7cbaea2bc771.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/152/6c1a7459-266d-491a-bd50-7cbaea2bc771.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/152/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Chin Up demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_158: Close-grip Lat Pull Down
  'wger_158': Object.freeze({
    exerciseId: 'wger_158',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/158/0d51a0f2-622f-434b-beb8-1a003c54712a.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/158/0d51a0f2-622f-434b-beb8-1a003c54712a.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/158/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Close-grip Lat Pull Down demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_161: Cross-Bench Dumbbell Pullovers
  'wger_161': Object.freeze({
    exerciseId: 'wger_161',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/161/b9b1803e-2817-40bf-8ac7-e398ca86d8b4.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/161/b9b1803e-2817-40bf-8ac7-e398ca86d8b4.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'powerade69',
      sourceUrl: 'https://wger.de/en/exercise/161/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Cross-Bench Dumbbell Pullovers demonstration illustration by powerade69, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_167: Crunches
  'wger_167': Object.freeze({
    exerciseId: 'wger_167',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/91/Crunches-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/91/Crunches-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'wger.de',
      sourceUrl: 'https://wger.de/en/exercise/167/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Crunches demonstration illustration by wger.de, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_171: Incline Crunches
  'wger_171': Object.freeze({
    exerciseId: 'wger_171',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/56/Decline-crunch-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/56/Decline-crunch-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/171/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Incline Crunches demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_184: Deadlifts
  'wger_184': Object.freeze({
    exerciseId: 'wger_184',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/184/1709c405-620a-4d07-9658-fade2b66a2df.jpeg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/184/1709c405-620a-4d07-9658-fade2b66a2df.jpeg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/184/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Deadlifts demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_185: Decline Bench Press Barbell
  'wger_185': Object.freeze({
    exerciseId: 'wger_185',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/100/Decline-bench-press-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/100/Decline-bench-press-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/185/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Decline Bench Press Barbell demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_194: Dips
  'wger_194': Object.freeze({
    exerciseId: 'wger_194',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/194/34600351-8b0b-4cb0-8daa-583537be15b0.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/194/34600351-8b0b-4cb0-8daa-583537be15b0.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cshep442',
      sourceUrl: 'https://wger.de/en/exercise/194/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dips demonstration illustration by cshep442, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_197: Dips Between Two Benches
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

  // wger_203: Dumbbell Goblet Squat
  'wger_203': Object.freeze({
    exerciseId: 'wger_203',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/203/1c052351-2af0-4227-aeb0-244008e4b0a8.jpeg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/203/1c052351-2af0-4227-aeb0-244008e4b0a8.jpeg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/203/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Goblet Squat demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_206: Dumbbell Lunges Walking
  'wger_206': Object.freeze({
    exerciseId: 'wger_206',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/113/Walking-lunges-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/113/Walking-lunges-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/206/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Dumbbell Lunges Walking demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_237: Fly With Cable
  'wger_237': Object.freeze({
    exerciseId: 'wger_237',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/122/Incline-cable-flyes-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/122/Incline-cable-flyes-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/237/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Fly With Cable demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_238: Fly With Dumbbells
  'wger_238': Object.freeze({
    exerciseId: 'wger_238',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/238/2fc242d3-5bdd-4f97-99bd-678adb8c96fc.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/238/2fc242d3-5bdd-4f97-99bd-678adb8c96fc.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cshep442',
      sourceUrl: 'https://wger.de/en/exercise/238/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Fly With Dumbbells demonstration illustration by cshep442, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_246: Skullcrusher SZ-bar
  'wger_246': Object.freeze({
    exerciseId: 'wger_246',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/84/Lying-close-grip-triceps-press-to-chin-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/84/Lying-close-grip-triceps-press-to-chin-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/246/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Skullcrusher SZ-bar demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_256: Front Raises
  'wger_256': Object.freeze({
    exerciseId: 'wger_256',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/256/b7def5bc-2352-499b-b9e5-fff741003831.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/256/b7def5bc-2352-499b-b9e5-fff741003831.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/256/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Front Raises demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_257: Front Squats
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

  // wger_265: Glute Bridge
  'wger_265': Object.freeze({
    exerciseId: 'wger_265',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/265/7528acb4-b2cc-4b75-b6ae-d514cbd4f78b.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/265/7528acb4-b2cc-4b75-b6ae-d514cbd4f78b.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'tdprice12',
      sourceUrl: 'https://wger.de/en/exercise/265/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Glute Bridge demonstration illustration by tdprice12, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_272: Hammer Curls
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

  // wger_275: Hammercurls on Cable
  'wger_275': Object.freeze({
    exerciseId: 'wger_275',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/138/Hammer-curls-with-rope-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/138/Hammer-curls-with-rope-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/275/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Hammercurls on Cable demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_279: Hand Grip
  'wger_279': Object.freeze({
    exerciseId: 'wger_279',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/279/36605bc8-d7e1-43e1-87c1-b9cb50db62b2.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/279/36605bc8-d7e1-43e1-87c1-b9cb50db62b2.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'vince63',
      sourceUrl: 'https://wger.de/en/exercise/279/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hand Grip demonstration illustration by vince63, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_282: Handstand Pushup
  'wger_282': Object.freeze({
    exerciseId: 'wger_282',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/282/f6121ac9-330e-4ed7-8219-91ce246bf871.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/282/f6121ac9-330e-4ed7-8219-91ce246bf871.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'BFad07',
      sourceUrl: 'https://wger.de/en/exercise/282/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Handstand Pushup demonstration illustration by BFad07, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_285: High Knee Jumps
  'wger_285': Object.freeze({
    exerciseId: 'wger_285',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/285/4141e8b2-d9f2-4597-8ef0-7768127fd0ec.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/285/4141e8b2-d9f2-4597-8ef0-7768127fd0ec.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'nate303303',
      sourceUrl: 'https://wger.de/en/exercise/285/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'High Knee Jumps demonstration illustration by nate303303, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_297: Hollow Hold
  'wger_297': Object.freeze({
    exerciseId: 'wger_297',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/297/b10d3341-baa8-49ab-b462-5b3529389aac.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/297/b10d3341-baa8-49ab-b462-5b3529389aac.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Behrooz',
      sourceUrl: 'https://wger.de/en/exercise/297/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hollow Hold demonstration illustration by Behrooz, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_301: Hyperextensions
  'wger_301': Object.freeze({
    exerciseId: 'wger_301',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/301/2d5c2f99-b8ff-4095-b515-4c2a85afde70.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/301/2d5c2f99-b8ff-4095-b515-4c2a85afde70.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'wger.de',
      sourceUrl: 'https://wger.de/en/exercise/301/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hyperextensions demonstration illustration by wger.de, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_320: Jumping Jacks
  'wger_320': Object.freeze({
    exerciseId: 'wger_320',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/320/6c9124b6-3551-47a8-9c22-20141c8b9c53.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/320/6c9124b6-3551-47a8-9c22-20141c8b9c53.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'student1234',
      sourceUrl: 'https://wger.de/en/exercise/320/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Jumping Jacks demonstration illustration by student1234, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_323: Cable Cross-over
  'wger_323': Object.freeze({
    exerciseId: 'wger_323',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/71/Cable-crossover-2.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/71/Cable-crossover-2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/323/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Cable Cross-over demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_348: Lateral Raises
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

  // wger_349: Lateral Rows on Cable, One Armed
  'wger_349': Object.freeze({
    exerciseId: 'wger_349',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/349/9d969203-9cb6-4d47-9c31-fef53bfe1de5.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/349/9d969203-9cb6-4d47-9c31-fef53bfe1de5.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/349/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Lateral Rows on Cable, One Armed demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_364: Leg Curl
  'wger_364': Object.freeze({
    exerciseId: 'wger_364',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/364/b318dde9-f5f2-489f-940a-cd864affb9e3.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/364/b318dde9-f5f2-489f-940a-cd864affb9e3.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/364/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Leg Curl demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_365: Leg Curls (laying)
  'wger_365': Object.freeze({
    exerciseId: 'wger_365',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/154/lying-leg-curl-machine-large-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/154/lying-leg-curl-machine-large-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/365/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Leg Curls (laying) demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_366: Leg Curls (sitting)
  'wger_366': Object.freeze({
    exerciseId: 'wger_366',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/117/seated-leg-curl-large-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/117/seated-leg-curl-large-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/366/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Leg Curls (sitting) demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_367: Leg Curls (standing)
  'wger_367': Object.freeze({
    exerciseId: 'wger_367',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/118/standing-leg-curls-large-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/118/standing-leg-curls-large-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/367/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Leg Curls (standing) demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_369: Leg Extension
  'wger_369': Object.freeze({
    exerciseId: 'wger_369',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/369/78c915d1-e46d-4d30-8124-65d68664c3ef.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/369/78c915d1-e46d-4d30-8124-65d68664c3ef.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/369/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Leg Extension demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_371: Leg Press
  'wger_371': Object.freeze({
    exerciseId: 'wger_371',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/371/d2136f96-3a43-4d4c-9944-1919c4ca1ce1.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/371/d2136f96-3a43-4d4c-9944-1919c4ca1ce1.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'BFad07',
      sourceUrl: 'https://wger.de/en/exercise/371/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Leg Press demonstration illustration by BFad07, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_373: Leg Presses (narrow)
  'wger_373': Object.freeze({
    exerciseId: 'wger_373',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/373/60e2aa21-1910-40d3-9fed-babfee06dd48.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/373/60e2aa21-1910-40d3-9fed-babfee06dd48.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/373/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Leg Presses (narrow) demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_375: Leg Press on Hackenschmidt Machine
  'wger_375': Object.freeze({
    exerciseId: 'wger_375',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/130/Narrow-stance-hack-squats-1-1024x721.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/130/Narrow-stance-hack-squats-1-1024x721.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/375/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Leg Press on Hackenschmidt Machine demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_377: Leg Raises, Lying
  'wger_377': Object.freeze({
    exerciseId: 'wger_377',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/125/Leg-raises-2.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/125/Leg-raises-2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/377/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Leg Raises, Lying demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_394: Long-Pulley (low Row)
  'wger_394': Object.freeze({
    exerciseId: 'wger_394',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/394/5e0c015f-9e4c-4034-beea-b0afbf15d0bd.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/394/5e0c015f-9e4c-4034-beea-b0afbf15d0bd.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'wger.de',
      sourceUrl: 'https://wger.de/en/exercise/394/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Long-Pulley (low Row) demonstration illustration by wger.de, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_418: Military Press mit SZ-Bar
  'wger_418': Object.freeze({
    exerciseId: 'wger_418',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/418/fa2a2207-43cb-4dc0-bc2a-039e32544790.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/418/fa2a2207-43cb-4dc0-bc2a-039e32544790.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/418/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Military Press mit SZ-Bar demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_427: Negative Crunches
  'wger_427': Object.freeze({
    exerciseId: 'wger_427',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/93/Decline-crunch-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/93/Decline-crunch-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'wger.de',
      sourceUrl: 'https://wger.de/en/exercise/427/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Negative Crunches demonstration illustration by wger.de, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_454: Pike Push Ups
  'wger_454': Object.freeze({
    exerciseId: 'wger_454',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/454/447f3c17-405f-46e0-b138-65c2a8caaab0.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/454/447f3c17-405f-46e0-b138-65c2a8caaab0.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Nash',
      sourceUrl: 'https://wger.de/en/exercise/454/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Pike Push Ups demonstration illustration by Nash, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_456: Pistol Squat
  'wger_456': Object.freeze({
    exerciseId: 'wger_456',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/456/3b681e59-377b-40db-9113-ca5873ce084b.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/456/3b681e59-377b-40db-9113-ca5873ce084b.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'wakanda90',
      sourceUrl: 'https://wger.de/en/exercise/456/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Pistol Squat demonstration illustration by wakanda90, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_458: Plank
  'wger_458': Object.freeze({
    exerciseId: 'wger_458',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/458/b7bd9c28-9f1d-4647-bd17-ab6a3adf5770.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/458/b7bd9c28-9f1d-4647-bd17-ab6a3adf5770.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'utkb',
      sourceUrl: 'https://wger.de/en/exercise/458/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Plank demonstration illustration by utkb, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_465: Preacher Curls
  'wger_465': Object.freeze({
    exerciseId: 'wger_465',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/193/Preacher-curl-3-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/193/Preacher-curl-3-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/465/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Preacher Curls demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_475: Pull-ups
  'wger_475': Object.freeze({
    exerciseId: 'wger_475',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/475/b0554016-16fd-4dbe-be47-a2a17d16ae0e.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/475/b0554016-16fd-4dbe-be47-a2a17d16ae0e.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Imobard',
      sourceUrl: 'https://wger.de/en/exercise/475/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Pull-ups demonstration illustration by Imobard, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_478: Push Press
  'wger_478': Object.freeze({
    exerciseId: 'wger_478',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/478/70a2d72c-a822-45f3-8de2-54ea85951b84.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/478/70a2d72c-a822-45f3-8de2-54ea85951b84.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/478/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Push Press demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_484: Rack Deadlift
  'wger_484': Object.freeze({
    exerciseId: 'wger_484',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/161/Dead-lifts-2.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/161/Dead-lifts-2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/484/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Rack Deadlift demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_487: Rear Delt Raises
  'wger_487': Object.freeze({
    exerciseId: 'wger_487',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/487/ad724e5c-b1ed-49e8-9279-a17545b0dd0b.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/487/ad724e5c-b1ed-49e8-9279-a17545b0dd0b.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cshep442',
      sourceUrl: 'https://wger.de/en/exercise/487/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Rear Delt Raises demonstration illustration by cshep442, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_507: Romanian Deadlift
  'wger_507': Object.freeze({
    exerciseId: 'wger_507',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/507/13d526ab-12fc-461e-828a-051dd7c13fb1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/507/13d526ab-12fc-461e-828a-051dd7c13fb1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'pjwirth',
      sourceUrl: 'https://wger.de/en/exercise/507/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Romanian Deadlift demonstration illustration by pjwirth, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_512: Rowing seated, narrow grip
  'wger_512': Object.freeze({
    exerciseId: 'wger_512',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/512/b938437e-ff00-4679-9036-acb41bb28bbd.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/512/b938437e-ff00-4679-9036-acb41bb28bbd.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'wger.de',
      sourceUrl: 'https://wger.de/en/exercise/512/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Rowing seated, narrow grip demonstration illustration by wger.de, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_513: Rowing, T-bar
  'wger_513': Object.freeze({
    exerciseId: 'wger_513',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/106/T-bar-row-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/106/T-bar-row-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/513/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Rowing, T-bar demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_537: Incline Bench Press - Dumbbell
  'wger_537': Object.freeze({
    exerciseId: 'wger_537',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/16/Incline-press-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/16/Incline-press-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/537/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Incline Bench Press - Dumbbell demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_538: Incline Bench Press - Barbell
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

  // wger_539: Incline Bench Press - MP
  'wger_539': Object.freeze({
    exerciseId: 'wger_539',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/61/Close-grip-bench-press-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/61/Close-grip-bench-press-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/539/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Incline Bench Press - MP demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_543: Shoulder Press, on Machine
  'wger_543': Object.freeze({
    exerciseId: 'wger_543',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/53/Shoulder-press-machine-2.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/53/Shoulder-press-machine-2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'wger.de',
      sourceUrl: 'https://wger.de/en/exercise/543/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Shoulder Press, on Machine demonstration illustration by wger.de, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_566: Shoulder Press, Barbell
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

  // wger_567: Shoulder Press, Dumbbells
  'wger_567': Object.freeze({
    exerciseId: 'wger_567',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/123/dumbbell-shoulder-press-large-1.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/123/dumbbell-shoulder-press-large-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/567/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Shoulder Press, Dumbbells demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_570: Shoulder Shrug
  'wger_570': Object.freeze({
    exerciseId: 'wger_570',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/570/68b4a33f-40f1-4dda-b56c-a2e20ed13903.jpg.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/570/68b4a33f-40f1-4dda-b56c-a2e20ed13903.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'BFad07',
      sourceUrl: 'https://wger.de/en/exercise/570/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Shoulder Shrug demonstration illustration by BFad07, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_571: Shrugs, Barbells
  'wger_571': Object.freeze({
    exerciseId: 'wger_571',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/150/Barbell-shrugs-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/150/Barbell-shrugs-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/571/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Shrugs, Barbells demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_572: Shrugs, Dumbbells
  'wger_572': Object.freeze({
    exerciseId: 'wger_572',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/151/Dumbbell-shrugs-2.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/151/Dumbbell-shrugs-2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/572/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Shrugs, Dumbbells demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_576: Side Crunch
  'wger_576': Object.freeze({
    exerciseId: 'wger_576',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/176/Cross-body-crunch-1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/176/Cross-body-crunch-1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/576/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Side Crunch demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_622: Standing Calf Raises
  'wger_622': Object.freeze({
    exerciseId: 'wger_622',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/622/9a429bd0-afd3-4ad0-8043-e9beec901c81.jpeg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/622/9a429bd0-afd3-4ad0-8043-e9beec901c81.jpeg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/622/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Standing Calf Raises demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_630: Sumo Deadlift
  'wger_630': Object.freeze({
    exerciseId: 'wger_630',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/630/b0f0c7d8-5878-4d9e-b820-21acc013741d.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/630/b0f0c7d8-5878-4d9e-b820-21acc013741d.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'magdy',
      sourceUrl: 'https://wger.de/en/exercise/630/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Sumo Deadlift demonstration illustration by magdy, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_659: Triceps Extensions on Cable
  'wger_659': Object.freeze({
    exerciseId: 'wger_659',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/659/a60452f1-e2ea-43fe-baa6-c1a2208d060c.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/659/a60452f1-e2ea-43fe-baa6-c1a2208d060c.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/659/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Triceps Extensions on Cable demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_691: Upright Row, on Multi Press
  'wger_691': Object.freeze({
    exerciseId: 'wger_691',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/691/297d4ce1-7e9e-4adb-8f5c-7d54054be885.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/691/297d4ce1-7e9e-4adb-8f5c-7d54054be885.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'anto.kreegyr',
      sourceUrl: 'https://wger.de/en/exercise/691/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Upright Row, on Multi Press demonstration illustration by anto.kreegyr, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_693: Upright Row, SZ-bar
  'wger_693': Object.freeze({
    exerciseId: 'wger_693',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/693/05c91bd2-7814-40b6-b2d1-51ae942b8321.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/693/05c91bd2-7814-40b6-b2d1-51ae942b8321.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'wger.de',
      sourceUrl: 'https://wger.de/en/exercise/693/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Upright Row, SZ-bar demonstration illustration by wger.de, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_694: Upright Row w/ Dumbbells
  'wger_694': Object.freeze({
    exerciseId: 'wger_694',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/694/119e6823-6960-4341-a9e1-aaf78d7fb57c.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/694/119e6823-6960-4341-a9e1-aaf78d7fb57c.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cshep442',
      sourceUrl: 'https://wger.de/en/exercise/694/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Upright Row w/ Dumbbells demonstration illustration by cshep442, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_804: Sloper hanging
  'wger_804': Object.freeze({
    exerciseId: 'wger_804',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/804/6f4b8bd9-fa05-49de-870b-1f79b595ce89.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/804/6f4b8bd9-fa05-49de-870b-1f79b595ce89.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'marcelbader',
      sourceUrl: 'https://wger.de/en/exercise/804/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Sloper hanging demonstration illustration by marcelbader, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_805: Tricep Pushdown on Cable
  'wger_805': Object.freeze({
    exerciseId: 'wger_805',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/805/7a437824-e2cc-46e1-804a-674f0ea31d25.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/805/7a437824-e2cc-46e1-804a-674f0ea31d25.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cshep442',
      sourceUrl: 'https://wger.de/en/exercise/805/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Tricep Pushdown on Cable demonstration illustration by cshep442, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_822: Cable Rear Delt Fly
  'wger_822': Object.freeze({
    exerciseId: 'wger_822',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/822/74affc0d-03b6-4f33-b5f4-a822a2615f68.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/822/74affc0d-03b6-4f33-b5f4-a822a2615f68.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cshep442',
      sourceUrl: 'https://wger.de/en/exercise/822/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Cable Rear Delt Fly demonstration illustration by cshep442, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_828: Incline Bench Reverse Fly
  'wger_828': Object.freeze({
    exerciseId: 'wger_828',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/828/2e959dab-f39b-4c7c-9063-eb43064ab5eb.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/828/2e959dab-f39b-4c7c-9063-eb43064ab5eb.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cshep442',
      sourceUrl: 'https://wger.de/en/exercise/828/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Incline Bench Reverse Fly demonstration illustration by cshep442, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_909: Reverse Nordic Curl
  'wger_909': Object.freeze({
    exerciseId: 'wger_909',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/909/159222d9-c1e4-46ae-89ee-6a2dfaab978d.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/909/159222d9-c1e4-46ae-89ee-6a2dfaab978d.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'karly',
      sourceUrl: 'https://wger.de/en/exercise/909/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Reverse Nordic Curl demonstration illustration by karly, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_912: Straight Bar Cable Curls
  'wger_912': Object.freeze({
    exerciseId: 'wger_912',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/912/e10a034f-6370-4dd6-b1c2-416b27844529.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/912/e10a034f-6370-4dd6-b1c2-416b27844529.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'novadani',
      sourceUrl: 'https://wger.de/en/exercise/912/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Straight Bar Cable Curls demonstration illustration by novadani, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_915: Bus Drivers
  'wger_915': Object.freeze({
    exerciseId: 'wger_915',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/915/fe8ebece-dff8-4700-b84c-9110e2e074f5.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/915/fe8ebece-dff8-4700-b84c-9110e2e074f5.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'novadani',
      sourceUrl: 'https://wger.de/en/exercise/915/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Bus Drivers demonstration illustration by novadani, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_916: Smith Press
  'wger_916': Object.freeze({
    exerciseId: 'wger_916',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/916/9bf7555a-fec6-43a9-b343-aae496744e5e.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/916/9bf7555a-fec6-43a9-b343-aae496744e5e.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'novadani',
      sourceUrl: 'https://wger.de/en/exercise/916/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Smith Press demonstration illustration by novadani, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_925: Smith Machine Slight Incline Press
  'wger_925': Object.freeze({
    exerciseId: 'wger_925',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/925/67dbb1c9-b378-46f9-adb6-1f55b3d3007a.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/925/67dbb1c9-b378-46f9-adb6-1f55b3d3007a.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'novadani',
      sourceUrl: 'https://wger.de/en/exercise/925/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Smith Machine Slight Incline Press demonstration illustration by novadani, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_926: Machine chest fly
  'wger_926': Object.freeze({
    exerciseId: 'wger_926',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/926/ae9deb5d-a1e9-4c30-b1e3-c128ba5d4969.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/926/ae9deb5d-a1e9-4c30-b1e3-c128ba5d4969.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'novadani',
      sourceUrl: 'https://wger.de/en/exercise/926/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Machine chest fly demonstration illustration by novadani, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_927: Suspended crossess
  'wger_927': Object.freeze({
    exerciseId: 'wger_927',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/927/7b392101-9c47-4693-935e-a88b1887eec5.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/927/7b392101-9c47-4693-935e-a88b1887eec5.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/927/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Suspended crossess demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_957: Quadriped Arm and Leg Raise
  'wger_957': Object.freeze({
    exerciseId: 'wger_957',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/957/0fd94587-6021-4763-856e-7227f5fcba2a.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/957/0fd94587-6021-4763-856e-7227f5fcba2a.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'utkb',
      sourceUrl: 'https://wger.de/en/exercise/957/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Quadriped Arm and Leg Raise demonstration illustration by utkb, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_958: Biceps with TRX
  'wger_958': Object.freeze({
    exerciseId: 'wger_958',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/958/947ac249-475d-44ed-bed3-8dc433374f59.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/958/947ac249-475d-44ed-bed3-8dc433374f59.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cynomops',
      sourceUrl: 'https://wger.de/en/exercise/958/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Biceps with TRX demonstration illustration by cynomops, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_959: TRX Rows
  'wger_959': Object.freeze({
    exerciseId: 'wger_959',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/959/53a5e008-bc31-4ee0-9463-69a858c2ec18.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/959/53a5e008-bc31-4ee0-9463-69a858c2ec18.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/959/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'TRX Rows demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_960: Kettlebell Swing
  'wger_960': Object.freeze({
    exerciseId: 'wger_960',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/960/da4d0560-da89-4bb5-b91f-746458fb04ad.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/960/da4d0560-da89-4bb5-b91f-746458fb04ad.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/960/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Kettlebell Swing demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_975: one-handed kettlebell curls
  'wger_975': Object.freeze({
    exerciseId: 'wger_975',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/975/41d9267a-99bc-4e94-b1c4-0e39fe7a968f.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/975/41d9267a-99bc-4e94-b1c4-0e39fe7a968f.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/975/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'one-handed kettlebell curls demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_976: Medicine ball booklet crunch
  'wger_976': Object.freeze({
    exerciseId: 'wger_976',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/976/94649ea6-bf58-4fd9-90c1-b2ec96ee20cd.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/976/94649ea6-bf58-4fd9-90c1-b2ec96ee20cd.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/976/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Medicine ball booklet crunch demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_977: Box squat
  'wger_977': Object.freeze({
    exerciseId: 'wger_977',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/977/3124c091-6395-4377-96c5-56048b627ceb.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/977/3124c091-6395-4377-96c5-56048b627ceb.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/977/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Box squat demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_978: Knee Raises
  'wger_978': Object.freeze({
    exerciseId: 'wger_978',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/978/d3ffe51f-7eb8-4cc9-9eae-105847af3005.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/978/d3ffe51f-7eb8-4cc9-9eae-105847af3005.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/978/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Knee Raises demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_979: Leg raises pull up bar
  'wger_979': Object.freeze({
    exerciseId: 'wger_979',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/979/27097a3a-5749-428d-b94c-6082afe390f6.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/979/27097a3a-5749-428d-b94c-6082afe390f6.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/979/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Leg raises pull up bar demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_981: Step-ups
  'wger_981': Object.freeze({
    exerciseId: 'wger_981',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/981/f9377a7e-eb58-4cca-b805-2d36863aeb03.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/981/f9377a7e-eb58-4cca-b805-2d36863aeb03.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'bxezi (imported from Feeel)',
      sourceUrl: 'https://wger.de/en/exercise/981/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Step-ups demonstration illustration by bxezi (imported from Feeel), hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_983: High knees
  'wger_983': Object.freeze({
    exerciseId: 'wger_983',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/983/16245344-9957-4a24-8d61-f9939ed5f964.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/983/16245344-9957-4a24-8d61-f9939ed5f964.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Luis Alfredo Figueroa Bracamontes (imported from Feeel)',
      sourceUrl: 'https://wger.de/en/exercise/983/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'High knees demonstration illustration by Luis Alfredo Figueroa Bracamontes (imported from Feeel), hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_984: Lunges
  'wger_984': Object.freeze({
    exerciseId: 'wger_984',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/984/5c7ffe68-e7b2-47f3-a22a-f9cc28640432.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/984/5c7ffe68-e7b2-47f3-a22a-f9cc28640432.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/984/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Lunges demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_988: Bulgarian split squats left
  'wger_988': Object.freeze({
    exerciseId: 'wger_988',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/988/6283b258-a4d7-4833-84f7-a38987022d3d.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/988/6283b258-a4d7-4833-84f7-a38987022d3d.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/988/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Bulgarian split squats left demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_990: Kneeling kickbacks
  'wger_990': Object.freeze({
    exerciseId: 'wger_990',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/990/de20457c-914a-45c9-8cf9-0ad9739759a1.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/990/de20457c-914a-45c9-8cf9-0ad9739759a1.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Luis Alfredo Figueroa Bracamontes (imported from Feeel)',
      sourceUrl: 'https://wger.de/en/exercise/990/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Kneeling kickbacks demonstration illustration by Luis Alfredo Figueroa Bracamontes (imported from Feeel), hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_999: Reverse lunges
  'wger_999': Object.freeze({
    exerciseId: 'wger_999',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/999/d0931eb3-8db0-4049-bb08-aa4036072056.jfif.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/999/d0931eb3-8db0-4049-bb08-aa4036072056.jfif',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/999/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Reverse lunges demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1000: Floor dips
  'wger_1000': Object.freeze({
    exerciseId: 'wger_1000',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1000/553266a8-a972-48c5-a014-b12afac66f65.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1000/553266a8-a972-48c5-a014-b12afac66f65.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1000/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Floor dips demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1002: Child\'s pose
  'wger_1002': Object.freeze({
    exerciseId: 'wger_1002',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1002/ddf91765-8045-4087-bece-de17f33332ce.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1002/ddf91765-8045-4087-bece-de17f33332ce.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'bxezi (imported from Feeel)',
      sourceUrl: 'https://wger.de/en/exercise/1002/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Child\'s pose demonstration illustration by bxezi (imported from Feeel), hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1003: Kettlebell deadlifts
  'wger_1003': Object.freeze({
    exerciseId: 'wger_1003',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1003/772d6e47-3865-4944-9255-7435d0b06782.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1003/772d6e47-3865-4944-9255-7435d0b06782.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'bxezi (imported from Feeel)',
      sourceUrl: 'https://wger.de/en/exercise/1003/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Kettlebell deadlifts demonstration illustration by bxezi (imported from Feeel), hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1007: Head turns
  'wger_1007': Object.freeze({
    exerciseId: 'wger_1007',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1007/757846d3-78e4-4068-bbca-62e567372c94.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1007/757846d3-78e4-4068-bbca-62e567372c94.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'bxezi (imported from Feeel)',
      sourceUrl: 'https://wger.de/en/exercise/1007/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Head turns demonstration illustration by bxezi (imported from Feeel), hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1012: Alternating bicep curls
  'wger_1012': Object.freeze({
    exerciseId: 'wger_1012',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1012/8270fdb8-28f1-4eff-b410-af8642085b3f.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1012/8270fdb8-28f1-4eff-b410-af8642085b3f.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1012/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Alternating bicep curls demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1018: Head tilts
  'wger_1018': Object.freeze({
    exerciseId: 'wger_1018',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1018/5bbd3879-b6fc-4aaa-9e8e-33ae9a688112.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1018/5bbd3879-b6fc-4aaa-9e8e-33ae9a688112.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'mondstern (imported from Feeel)',
      sourceUrl: 'https://wger.de/en/exercise/1018/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Head tilts demonstration illustration by mondstern (imported from Feeel), hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1022: Single Arm Plank to Row
  'wger_1022': Object.freeze({
    exerciseId: 'wger_1022',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1022/f74644fa-f43e-46bd-8603-6e3a2ee8ee2d.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1022/f74644fa-f43e-46bd-8603-6e3a2ee8ee2d.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/1022/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Single Arm Plank to Row demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1080: Hindu Pushups
  'wger_1080': Object.freeze({
    exerciseId: 'wger_1080',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1080/c4bf7ba1-6058-4d14-928f-7187885d5d57.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1080/c4bf7ba1-6058-4d14-928f-7187885d5d57.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Imobard',
      sourceUrl: 'https://wger.de/en/exercise/1080/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hindu Pushups demonstration illustration by Imobard, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1084: Dumbbell Floor Press
  'wger_1084': Object.freeze({
    exerciseId: 'wger_1084',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1084/91dd5a95-1c45-46f2-a074-de41b6ad599b.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1084/91dd5a95-1c45-46f2-a074-de41b6ad599b.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'admin',
      sourceUrl: 'https://wger.de/en/exercise/1084/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Floor Press demonstration illustration by admin, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1086: Close-grip Press-ups
  'wger_1086': Object.freeze({
    exerciseId: 'wger_1086',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1086/b2ee8d9b-0480-4992-8494-c223b37c2696.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1086/b2ee8d9b-0480-4992-8494-c223b37c2696.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/1086/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Close-grip Press-ups demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1087: Dumbbell Hang Power Cleans
  'wger_1087': Object.freeze({
    exerciseId: 'wger_1087',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1087/d85f4e02-b20c-457c-bdfb-0b00e2d14150.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1087/d85f4e02-b20c-457c-bdfb-0b00e2d14150.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/1087/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Hang Power Cleans demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1088: Dumbbell sumo deadlift
  'wger_1088': Object.freeze({
    exerciseId: 'wger_1088',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1088/9f66b288-ce8f-4154-ba80-78fee267263c.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1088/9f66b288-ce8f-4154-ba80-78fee267263c.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/1088/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell sumo deadlift demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1089: Medicine ball twist
  'wger_1089': Object.freeze({
    exerciseId: 'wger_1089',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1089/49f51716-535d-41dd-aeb5-cff5bb906bc1.jpeg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1089/49f51716-535d-41dd-aeb5-cff5bb906bc1.jpeg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/1089/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Medicine ball twist demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1091: Plank Shoulder Taps
  'wger_1091': Object.freeze({
    exerciseId: 'wger_1091',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1091/50c8912d-54ef-46c9-99d1-633b6196aa1e.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1091/50c8912d-54ef-46c9-99d1-633b6196aa1e.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'clafal',
      sourceUrl: 'https://wger.de/en/exercise/1091/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Plank Shoulder Taps demonstration illustration by clafal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1098: Seated rear delt rise
  'wger_1098': Object.freeze({
    exerciseId: 'wger_1098',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1098/fa5328a2-64cb-4afb-a283-b3d948ddaf3f.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1098/fa5328a2-64cb-4afb-a283-b3d948ddaf3f.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/1098/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Seated rear delt rise demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1100: Wall balls
  'wger_1100': Object.freeze({
    exerciseId: 'wger_1100',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1100/ab203e0c-8220-4537-987c-871eb259d687.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1100/ab203e0c-8220-4537-987c-871eb259d687.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'philip',
      sourceUrl: 'https://wger.de/en/exercise/1100/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Wall balls demonstration illustration by philip, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1105: Seated Knee Tuck
  'wger_1105': Object.freeze({
    exerciseId: 'wger_1105',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1105/36776818-799a-40bf-9eca-aebb3aa5008f.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1105/36776818-799a-40bf-9eca-aebb3aa5008f.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'utkb',
      sourceUrl: 'https://wger.de/en/exercise/1105/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Seated Knee Tuck demonstration illustration by utkb, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1109: Cable Concentration Curl
  'wger_1109': Object.freeze({
    exerciseId: 'wger_1109',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1109/00b0a0bf-c14a-4f13-bb14-62c09030a1aa.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1109/00b0a0bf-c14a-4f13-bb14-62c09030a1aa.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1109/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Cable Concentration Curl demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1112: Push-Ups | Decline
  'wger_1112': Object.freeze({
    exerciseId: 'wger_1112',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1112/81f40bee-4adf-4317-8476-1a87706e3031.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1112/81f40bee-4adf-4317-8476-1a87706e3031.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'anon1337',
      sourceUrl: 'https://wger.de/en/exercise/1112/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Push-Ups | Decline demonstration illustration by anon1337, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1117: Seated Cable Row
  'wger_1117': Object.freeze({
    exerciseId: 'wger_1117',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1117/2555c4c3-a84d-47db-b83b-cbf721f12e45.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1117/2555c4c3-a84d-47db-b83b-cbf721f12e45.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1117/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Seated Cable Row demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1119: Remo maquina agarre estrecho
  'wger_1119': Object.freeze({
    exerciseId: 'wger_1119',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1119/9b138ad2-5b80-42a8-bfff-93a960444ffe.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1119/9b138ad2-5b80-42a8-bfff-93a960444ffe.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1119/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Remo maquina agarre estrecho demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1120: Remo maquina agarre estrecho supino
  'wger_1120': Object.freeze({
    exerciseId: 'wger_1120',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1120/df9a5256-e977-44d0-bc9c-b53253faeb22.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1120/df9a5256-e977-44d0-bc9c-b53253faeb22.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1120/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Remo maquina agarre estrecho supino demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1127: Close-grip supinated lat pulldown
  'wger_1127': Object.freeze({
    exerciseId: 'wger_1127',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1127/4942b7c0-6bda-4983-88e5-86547c3d445e.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1127/4942b7c0-6bda-4983-88e5-86547c3d445e.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1127/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Close-grip supinated lat pulldown demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1131: Cable glute extension
  'wger_1131': Object.freeze({
    exerciseId: 'wger_1131',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1131/3bcf3024-2dcc-4995-9694-55aa2c2e4a9a.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1131/3bcf3024-2dcc-4995-9694-55aa2c2e4a9a.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1131/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Cable glute extension demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1136: Neutral-grip chest pulldown
  'wger_1136': Object.freeze({
    exerciseId: 'wger_1136',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1136/5778a8e9-c606-4843-89c8-9d9469eeb6e4.PNG.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1136/5778a8e9-c606-4843-89c8-9d9469eeb6e4.PNG',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1136/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Neutral-grip chest pulldown demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1137: High-pulley pullover
  'wger_1137': Object.freeze({
    exerciseId: 'wger_1137',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1137/42f22229-c0a0-4bfc-aca6-66fe5e1ab10d.PNG.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1137/42f22229-c0a0-4bfc-aca6-66fe5e1ab10d.PNG',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1137/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'High-pulley pullover demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1138: Incline bench pulldown
  'wger_1138': Object.freeze({
    exerciseId: 'wger_1138',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1138/6c35fd79-ef35-4cf3-abf5-9c969457b8d4.PNG.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1138/6c35fd79-ef35-4cf3-abf5-9c969457b8d4.PNG',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1138/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Incline bench pulldown demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1141: Arabesque
  'wger_1141': Object.freeze({
    exerciseId: 'wger_1141',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1141/c7be1cd1-46c5-4a86-a114-5f0fe861c3e0.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1141/c7be1cd1-46c5-4a86-a114-5f0fe861c3e0.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cleen',
      sourceUrl: 'https://wger.de/en/exercise/1141/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Arabesque demonstration illustration by cleen, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1143: Seated Back Extension Machine
  'wger_1143': Object.freeze({
    exerciseId: 'wger_1143',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1143/6e21cb6c-da09-4bcd-b9d2-1ef75237b763.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1143/6e21cb6c-da09-4bcd-b9d2-1ef75237b763.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1143/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Seated Back Extension Machine demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1185: Triceps Pushdown
  'wger_1185': Object.freeze({
    exerciseId: 'wger_1185',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1185/c5ca283d-8958-4fd8-9d59-a3f52a3ac66b.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1185/c5ca283d-8958-4fd8-9d59-a3f52a3ac66b.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'anto.kreegyr',
      sourceUrl: 'https://wger.de/en/exercise/1185/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Triceps Pushdown demonstration illustration by anto.kreegyr, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1186: One Arm Bent Row
  'wger_1186': Object.freeze({
    exerciseId: 'wger_1186',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1186/1987a039-cf35-437e-bbdc-40c53dd7d053.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1186/1987a039-cf35-437e-bbdc-40c53dd7d053.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'anto.kreegyr',
      sourceUrl: 'https://wger.de/en/exercise/1186/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'One Arm Bent Row demonstration illustration by anto.kreegyr, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1188: Side bend
  'wger_1188': Object.freeze({
    exerciseId: 'wger_1188',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1188/43e714e4-b736-4f3a-8ab4-97821fdff86a.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1188/43e714e4-b736-4f3a-8ab4-97821fdff86a.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'jptjptjptjpt',
      sourceUrl: 'https://wger.de/en/exercise/1188/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Side bend demonstration illustration by jptjptjptjpt, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1192: Alternating Biceps Curls With Dumbbell
  'wger_1192': Object.freeze({
    exerciseId: 'wger_1192',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1192/651a4535-8210-4dbd-8f06-61d95fdd9963.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1192/651a4535-8210-4dbd-8f06-61d95fdd9963.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1192/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Alternating Biceps Curls With Dumbbell demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1193: Russian Twist
  'wger_1193': Object.freeze({
    exerciseId: 'wger_1193',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1193/70ca5d80-3847-4a8c-8882-c6e9e485e29e.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1193/70ca5d80-3847-4a8c-8882-c6e9e485e29e.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'lion',
      sourceUrl: 'https://wger.de/en/exercise/1193/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Russian Twist demonstration illustration by lion, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1194: Pallof Press
  'wger_1194': Object.freeze({
    exerciseId: 'wger_1194',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1194/34c03421-0803-4859-a2b0-5710f2bd94cd.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1194/34c03421-0803-4859-a2b0-5710f2bd94cd.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'prevail90',
      sourceUrl: 'https://wger.de/en/exercise/1194/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Pallof Press demonstration illustration by prevail90, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1198: Inverted Rows
  'wger_1198': Object.freeze({
    exerciseId: 'wger_1198',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1198/864906ac-4ac7-4e52-a886-c6bb97950a9f.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1198/864906ac-4ac7-4e52-a886-c6bb97950a9f.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Gavru',
      sourceUrl: 'https://wger.de/en/exercise/1198/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Inverted Rows demonstration illustration by Gavru, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1217: Finger Pushup
  'wger_1217': Object.freeze({
    exerciseId: 'wger_1217',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1217/590e65db-de60-4727-b7eb-55f80af56043.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1217/590e65db-de60-4727-b7eb-55f80af56043.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'jptjptjptjpt',
      sourceUrl: 'https://wger.de/en/exercise/1217/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Finger Pushup demonstration illustration by jptjptjptjpt, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1223: Claps over the head
  'wger_1223': Object.freeze({
    exerciseId: 'wger_1223',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1223/bf20836a-23b0-4f50-8b98-cfdd97684527.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1223/bf20836a-23b0-4f50-8b98-cfdd97684527.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Lynn_McIntyre',
      sourceUrl: 'https://wger.de/en/exercise/1223/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Claps over the head demonstration illustration by Lynn_McIntyre, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1225: Dumbbell wide bicep curls
  'wger_1225': Object.freeze({
    exerciseId: 'wger_1225',
    mediaType: 'animation',
    thumbnailUri: 'https://wger.de/media/exercise-images/1225/39a0b7e7-9780-425d-84f5-56d10d1690ac.gif',
    demonstrationUri: 'https://wger.de/media/exercise-images/1225/39a0b7e7-9780-425d-84f5-56d10d1690ac.gif',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Lynn_McIntyre',
      sourceUrl: 'https://wger.de/en/exercise/1225/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell wide bicep curls demonstration illustration by Lynn_McIntyre, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1226: Dumbbell bicep curl to press
  'wger_1226': Object.freeze({
    exerciseId: 'wger_1226',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1226/a6154dbd-67a0-4a36-8748-0f5af3865e83.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1226/a6154dbd-67a0-4a36-8748-0f5af3865e83.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Lynn_McIntyre',
      sourceUrl: 'https://wger.de/en/exercise/1226/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell bicep curl to press demonstration illustration by Lynn_McIntyre, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1227: Dumbbell rear delt row
  'wger_1227': Object.freeze({
    exerciseId: 'wger_1227',
    mediaType: 'animation',
    thumbnailUri: 'https://wger.de/media/exercise-images/1227/57415c3c-2963-4130-9f6f-79f6a96113b6.gif',
    demonstrationUri: 'https://wger.de/media/exercise-images/1227/57415c3c-2963-4130-9f6f-79f6a96113b6.gif',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Lynn_McIntyre',
      sourceUrl: 'https://wger.de/en/exercise/1227/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell rear delt row demonstration illustration by Lynn_McIntyre, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1230: Triceps stretch left
  'wger_1230': Object.freeze({
    exerciseId: 'wger_1230',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1230/9fd1e2fd-f2c4-432d-b3ae-5e5f24085777.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1230/9fd1e2fd-f2c4-432d-b3ae-5e5f24085777.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'anonymous',
      sourceUrl: 'https://wger.de/en/exercise/1230/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Triceps stretch left demonstration illustration by anonymous, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1231: Triceps stretch right
  'wger_1231': Object.freeze({
    exerciseId: 'wger_1231',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1231/b10457ce-5fa5-4d20-a32f-3c7100c6a9d9.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1231/b10457ce-5fa5-4d20-a32f-3c7100c6a9d9.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'anonymous',
      sourceUrl: 'https://wger.de/en/exercise/1231/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Triceps stretch right demonstration illustration by anonymous, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1232: Standing biceps stretch left
  'wger_1232': Object.freeze({
    exerciseId: 'wger_1232',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1232/2b6de046-5806-49e3-bf36-b6fae16af021.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1232/2b6de046-5806-49e3-bf36-b6fae16af021.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'anonymous',
      sourceUrl: 'https://wger.de/en/exercise/1232/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Standing biceps stretch left demonstration illustration by anonymous, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1233: Standing biceps stretch right
  'wger_1233': Object.freeze({
    exerciseId: 'wger_1233',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1233/d7d6f9e1-7834-4cca-bd3b-f9def33ff44d.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1233/d7d6f9e1-7834-4cca-bd3b-f9def33ff44d.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'anonymous',
      sourceUrl: 'https://wger.de/en/exercise/1233/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Standing biceps stretch right demonstration illustration by anonymous, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1239: Standing Calf Stretch
  'wger_1239': Object.freeze({
    exerciseId: 'wger_1239',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1239/5026373a-a7b4-4e26-a0aa-c46634205196.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1239/5026373a-a7b4-4e26-a0aa-c46634205196.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'erikocobra',
      sourceUrl: 'https://wger.de/en/exercise/1239/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Standing Calf Stretch demonstration illustration by erikocobra, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1243: Double Leg Calf Raise
  'wger_1243': Object.freeze({
    exerciseId: 'wger_1243',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1243/53d4fabe-c994-4907-873f-8d82813a9832.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1243/53d4fabe-c994-4907-873f-8d82813a9832.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'erikocobra',
      sourceUrl: 'https://wger.de/en/exercise/1243/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Double Leg Calf Raise demonstration illustration by erikocobra, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1274: Sitting Calf Stretch (Dorsiflexion)
  'wger_1274': Object.freeze({
    exerciseId: 'wger_1274',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1274/bcffdf52-3c36-4b0c-b787-fb84f20bf82d.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1274/bcffdf52-3c36-4b0c-b787-fb84f20bf82d.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'erikocobra',
      sourceUrl: 'https://wger.de/en/exercise/1274/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Sitting Calf Stretch (Dorsiflexion) demonstration illustration by erikocobra, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1275: Plantarflexion Stretch with Band
  'wger_1275': Object.freeze({
    exerciseId: 'wger_1275',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1275/0652d306-93eb-42f0-b564-7c3261ea809a.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1275/0652d306-93eb-42f0-b564-7c3261ea809a.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'erikocobra',
      sourceUrl: 'https://wger.de/en/exercise/1275/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Plantarflexion Stretch with Band demonstration illustration by erikocobra, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1283: Incline Chest-Supported Dumbbell Row
  'wger_1283': Object.freeze({
    exerciseId: 'wger_1283',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1283/e7262f70-7512-408a-8d00-4c499ef632fc.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1283/e7262f70-7512-408a-8d00-4c499ef632fc.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'carlos3c',
      sourceUrl: 'https://wger.de/en/exercise/1283/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Incline Chest-Supported Dumbbell Row demonstration illustration by carlos3c, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1285: Talons fesses
  'wger_1285': Object.freeze({
    exerciseId: 'wger_1285',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1285/1ab8005d-41e4-4505-9a7d-5277d59bb3cd.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1285/1ab8005d-41e4-4505-9a7d-5277d59bb3cd.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'painDpice',
      sourceUrl: 'https://wger.de/en/exercise/1285/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Talons fesses demonstration illustration by painDpice, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1290: Reverse Grip Barbell Curls
  'wger_1290': Object.freeze({
    exerciseId: 'wger_1290',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1290/c05818bf-1c81-46df-9f24-42e354265388.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1290/c05818bf-1c81-46df-9f24-42e354265388.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Franpol',
      sourceUrl: 'https://wger.de/en/exercise/1290/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Reverse Grip Barbell Curls demonstration illustration by Franpol, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1296: Low-Cable Cross-Over - NB
  'wger_1296': Object.freeze({
    exerciseId: 'wger_1296',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1296/c42782fe-337a-44f4-9079-7f6dedab4885.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1296/c42782fe-337a-44f4-9079-7f6dedab4885.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'JackSparrow',
      sourceUrl: 'https://wger.de/en/exercise/1296/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Low-Cable Cross-Over - NB demonstration illustration by JackSparrow, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1298: High-Cable Cross Tricep Extention - NB
  'wger_1298': Object.freeze({
    exerciseId: 'wger_1298',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1298/ec4b83ec-5a8f-4303-9050-99ec4389bc2a.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1298/ec4b83ec-5a8f-4303-9050-99ec4389bc2a.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'JackSparrow',
      sourceUrl: 'https://wger.de/en/exercise/1298/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'High-Cable Cross Tricep Extention - NB demonstration illustration by JackSparrow, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1307: Front Plank
  'wger_1307': Object.freeze({
    exerciseId: 'wger_1307',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1307/321d796a-f394-40b8-a1ea-874bbed6ecee.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1307/321d796a-f394-40b8-a1ea-874bbed6ecee.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'hektkaso',
      sourceUrl: 'https://wger.de/en/exercise/1307/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Front Plank demonstration illustration by hektkaso, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1325: Lateral Push Off
  'wger_1325': Object.freeze({
    exerciseId: 'wger_1325',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1325/d8372291-6725-452a-9711-6321c061e354.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1325/d8372291-6725-452a-9711-6321c061e354.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'cleen',
      sourceUrl: 'https://wger.de/en/exercise/1325/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Lateral Push Off demonstration illustration by cleen, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1333: Forearm Curls (underhand grip)
  'wger_1333': Object.freeze({
    exerciseId: 'wger_1333',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1333/89f43354-32e3-473a-9bcf-caca51f1a8e3.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1333/89f43354-32e3-473a-9bcf-caca51f1a8e3.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Anastasious',
      sourceUrl: 'https://wger.de/en/exercise/1333/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Forearm Curls (underhand grip) demonstration illustration by Anastasious, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1336: Triceps Overhead (Dumbbell)
  'wger_1336': Object.freeze({
    exerciseId: 'wger_1336',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1336/ebf88217-df26-4ef7-94cb-f0c2220c6abe.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1336/ebf88217-df26-4ef7-94cb-f0c2220c6abe.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Anastasious',
      sourceUrl: 'https://wger.de/en/exercise/1336/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Triceps Overhead (Dumbbell) demonstration illustration by Anastasious, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1338: Shoulder Raise (Dumbbell)
  'wger_1338': Object.freeze({
    exerciseId: 'wger_1338',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1338/9d157b4d-5af0-43c1-bd34-f52144ba1b54.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1338/9d157b4d-5af0-43c1-bd34-f52144ba1b54.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Anastasious',
      sourceUrl: 'https://wger.de/en/exercise/1338/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Shoulder Raise (Dumbbell) demonstration illustration by Anastasious, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1348: Lower Back Extensions
  'wger_1348': Object.freeze({
    exerciseId: 'wger_1348',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1348/a3769120-2445-49f2-97d3-afc1238bfc2a.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1348/a3769120-2445-49f2-97d3-afc1238bfc2a.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Anastasious',
      sourceUrl: 'https://wger.de/en/exercise/1348/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Lower Back Extensions demonstration illustration by Anastasious, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1353: Dumbbell Hex Press
  'wger_1353': Object.freeze({
    exerciseId: 'wger_1353',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1353/138cb483-7d4d-4519-b029-63e4269810a6.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1353/138cb483-7d4d-4519-b029-63e4269810a6.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Anastasious',
      sourceUrl: 'https://wger.de/en/exercise/1353/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Hex Press demonstration illustration by Anastasious, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1363: Blackroll
  'wger_1363': Object.freeze({
    exerciseId: 'wger_1363',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1363/1dba566b-e799-4bde-abb0-c011a3c75e52.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1363/1dba566b-e799-4bde-abb0-c011a3c75e52.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Anastasious',
      sourceUrl: 'https://wger.de/en/exercise/1363/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Blackroll demonstration illustration by Anastasious, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1377: Torso Twist
  'wger_1377': Object.freeze({
    exerciseId: 'wger_1377',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1377/12e7a231-d36a-4992-bf57-ff7bfe0f3ae4.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1377/12e7a231-d36a-4992-bf57-ff7bfe0f3ae4.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'brucem',
      sourceUrl: 'https://wger.de/en/exercise/1377/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Torso Twist demonstration illustration by brucem, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1378: Cable Lateral Raises (Single Arm)
  'wger_1378': Object.freeze({
    exerciseId: 'wger_1378',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1378/7c1fcf34-fb7e-45e7-a0c1-51f296235315.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1378/7c1fcf34-fb7e-45e7-a0c1-51f296235315.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'carlos3c',
      sourceUrl: 'https://wger.de/en/exercise/1378/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Cable Lateral Raises (Single Arm) demonstration illustration by carlos3c, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1387: Hamstring Kicks
  'wger_1387': Object.freeze({
    exerciseId: 'wger_1387',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1387/a2cf7eda-5540-4105-b30e-1c2f2679a6c7.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1387/a2cf7eda-5540-4105-b30e-1c2f2679a6c7.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'captive0592',
      sourceUrl: 'https://wger.de/en/exercise/1387/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hamstring Kicks demonstration illustration by captive0592, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1392: Good Morning
  'wger_1392': Object.freeze({
    exerciseId: 'wger_1392',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1392/a02c9c7d-f42d-43e0-9946-1b99b014daee.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1392/a02c9c7d-f42d-43e0-9946-1b99b014daee.png',
    license: Object.freeze({
      type: 'CC-BY-SA-3.0',
      author: 'Everkinetic',
      sourceUrl: 'https://wger.de/en/exercise/1392/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en',
      attributionNotes: 'Good Morning demonstration illustration by Everkinetic, hosted on wger under CC-BY-SA-3.0',
    }),
    isApproved: true,
  }),

  // wger_1448: Seated W Curl
  'wger_1448': Object.freeze({
    exerciseId: 'wger_1448',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1448/2184e68c-32b5-413f-a7c1-4a2d1bb98c35.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1448/2184e68c-32b5-413f-a7c1-4a2d1bb98c35.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'M9',
      sourceUrl: 'https://wger.de/en/exercise/1448/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Seated W Curl demonstration illustration by M9, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1452: Knee to Chest Stretch
  'wger_1452': Object.freeze({
    exerciseId: 'wger_1452',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1452/85a6b9de-4eec-445b-8ebb-f1950b076aba.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1452/85a6b9de-4eec-445b-8ebb-f1950b076aba.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1452/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Knee to Chest Stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1479: Sit Up Elbow Thrust
  'wger_1479': Object.freeze({
    exerciseId: 'wger_1479',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1479/0305d98e-0887-4c0c-8992-7c220814efc2.webp.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1479/0305d98e-0887-4c0c-8992-7c220814efc2.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Moffi',
      sourceUrl: 'https://wger.de/en/exercise/1479/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Sit Up Elbow Thrust demonstration illustration by Moffi, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1519: Overhead Triceps Extension
  'wger_1519': Object.freeze({
    exerciseId: 'wger_1519',
    mediaType: 'animation',
    thumbnailUri: 'https://wger.de/media/exercise-images/1519/fab7f641-27d4-40b5-8edd-1a0a137bfd94.gif',
    demonstrationUri: 'https://wger.de/media/exercise-images/1519/fab7f641-27d4-40b5-8edd-1a0a137bfd94.gif',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'benjamin.yildiz@proton.me',
      sourceUrl: 'https://wger.de/en/exercise/1519/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Overhead Triceps Extension demonstration illustration by benjamin.yildiz@proton.me, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1521: Pendular hack
  'wger_1521': Object.freeze({
    exerciseId: 'wger_1521',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1521/e4e4aa78-3c96-4b1d-95c0-f9f73a0779d0.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1521/e4e4aa78-3c96-4b1d-95c0-f9f73a0779d0.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'polloperro',
      sourceUrl: 'https://wger.de/en/exercise/1521/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Pendular hack demonstration illustration by polloperro, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1551: Push-Up
  'wger_1551': Object.freeze({
    exerciseId: 'wger_1551',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1551/a6a9e561-3965-45c6-9f2b-ee671e1a3a45.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1551/a6a9e561-3965-45c6-9f2b-ee671e1a3a45.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Settebello',
      sourceUrl: 'https://wger.de/en/exercise/1551/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Push-Up demonstration illustration by Settebello, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1554: Clap Push-UP
  'wger_1554': Object.freeze({
    exerciseId: 'wger_1554',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1554/49207a62-8799-4b47-8c0b-7bde02926f3d.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1554/49207a62-8799-4b47-8c0b-7bde02926f3d.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Settebello',
      sourceUrl: 'https://wger.de/en/exercise/1554/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Clap Push-UP demonstration illustration by Settebello, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1556: Devil’s Press
  'wger_1556': Object.freeze({
    exerciseId: 'wger_1556',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1556/a23c820b-e08b-4911-a6a4-80f16c15d2e0.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1556/a23c820b-e08b-4911-a6a4-80f16c15d2e0.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Settebello',
      sourceUrl: 'https://wger.de/en/exercise/1556/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Devil’s Press demonstration illustration by Settebello, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1567: Alternating dumbbell hammer curl
  'wger_1567': Object.freeze({
    exerciseId: 'wger_1567',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1567/0a8c155c-a48e-47e8-9df3-e39f025c6cad.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1567/0a8c155c-a48e-47e8-9df3-e39f025c6cad.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Mariano_O',
      sourceUrl: 'https://wger.de/en/exercise/1567/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Alternating dumbbell hammer curl demonstration illustration by Mariano_O, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1572: Bird Dog
  'wger_1572': Object.freeze({
    exerciseId: 'wger_1572',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1572/3d14e761-a73d-49da-8804-f3016a7573ff.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1572/3d14e761-a73d-49da-8804-f3016a7573ff.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Settebello',
      sourceUrl: 'https://wger.de/en/exercise/1572/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Bird Dog demonstration illustration by Settebello, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1573: Ab wheel
  'wger_1573': Object.freeze({
    exerciseId: 'wger_1573',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1573/a9ab402b-61ef-4d60-b91a-df52bf7f41a9.jpg.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1573/a9ab402b-61ef-4d60-b91a-df52bf7f41a9.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'lhegedus',
      sourceUrl: 'https://wger.de/en/exercise/1573/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Ab wheel demonstration illustration by lhegedus, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1581: Trap press
  'wger_1581': Object.freeze({
    exerciseId: 'wger_1581',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1581/b71a6710-5798-4639-ac5a-22a2cdae2036.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1581/b71a6710-5798-4639-ac5a-22a2cdae2036.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'CptnFatbeard',
      sourceUrl: 'https://wger.de/en/exercise/1581/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Trap press demonstration illustration by CptnFatbeard, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1582: Side-laying interior rotation
  'wger_1582': Object.freeze({
    exerciseId: 'wger_1582',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1582/5094fe30-eea2-4269-b0de-4b8a20558fd7.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1582/5094fe30-eea2-4269-b0de-4b8a20558fd7.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'CptnFatbeard',
      sourceUrl: 'https://wger.de/en/exercise/1582/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Side-laying interior rotation demonstration illustration by CptnFatbeard, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1593: Smith Machine Split Squat
  'wger_1593': Object.freeze({
    exerciseId: 'wger_1593',
    mediaType: 'animation',
    thumbnailUri: 'https://wger.de/media/exercise-images/1593/9815fcd6-cf40-4ddd-9b38-2eac25973de1.gif',
    demonstrationUri: 'https://wger.de/media/exercise-images/1593/9815fcd6-cf40-4ddd-9b38-2eac25973de1.gif',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'workout@rooven.anonaddy.me',
      sourceUrl: 'https://wger.de/en/exercise/1593/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Smith Machine Split Squat demonstration illustration by workout@rooven.anonaddy.me, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1604: Sliding Lateral Lunge
  'wger_1604': Object.freeze({
    exerciseId: 'wger_1604',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1604/7695428e-bfed-4021-b987-498d93153995.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1604/7695428e-bfed-4021-b987-498d93153995.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'RiccaBaro',
      sourceUrl: 'https://wger.de/en/exercise/1604/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Sliding Lateral Lunge demonstration illustration by RiccaBaro, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1612: kettlebell sumo deadlift
  'wger_1612': Object.freeze({
    exerciseId: 'wger_1612',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1612/3dc33f57-2786-4305-8b91-e011d7055923.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1612/3dc33f57-2786-4305-8b91-e011d7055923.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1612/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'kettlebell sumo deadlift demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1613: rubber band glute kickback
  'wger_1613': Object.freeze({
    exerciseId: 'wger_1613',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1613/a851fe9d-771f-44da-82f0-799e02ae3fd1.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1613/a851fe9d-771f-44da-82f0-799e02ae3fd1.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1613/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'rubber band glute kickback demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1615: Treadmill Cardio
  'wger_1615': Object.freeze({
    exerciseId: 'wger_1615',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1615/7792295c-83b6-4ea8-9353-ce02f0ad2559.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1615/7792295c-83b6-4ea8-9353-ce02f0ad2559.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1615/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Treadmill Cardio demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1616: Dumbbell donkey kick
  'wger_1616': Object.freeze({
    exerciseId: 'wger_1616',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1616/97e6fd98-2ca6-486f-b9b2-f0499fe38044.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1616/97e6fd98-2ca6-486f-b9b2-f0499fe38044.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1616/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell donkey kick demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1618: Stationary bike cardio
  'wger_1618': Object.freeze({
    exerciseId: 'wger_1618',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1618/c18baedc-ff98-4fb2-b4f5-38a05c12f637.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1618/c18baedc-ff98-4fb2-b4f5-38a05c12f637.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1618/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Stationary bike cardio demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1620: Seated Dumbbell Calf Raise
  'wger_1620': Object.freeze({
    exerciseId: 'wger_1620',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1620/edd40e39-e337-4460-a8dd-6127d40ddd16.jpeg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1620/edd40e39-e337-4460-a8dd-6127d40ddd16.jpeg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1620/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Seated Dumbbell Calf Raise demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1621: Unilateral Cable row
  'wger_1621': Object.freeze({
    exerciseId: 'wger_1621',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1621/ca1bc68d-9c36-4dd3-8ec4-496c57b5c564.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1621/ca1bc68d-9c36-4dd3-8ec4-496c57b5c564.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'technofer',
      sourceUrl: 'https://wger.de/en/exercise/1621/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Unilateral Cable row demonstration illustration by technofer, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1634: Rope Pullover/row
  'wger_1634': Object.freeze({
    exerciseId: 'wger_1634',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1634/9a4704d3-1b25-43e3-b244-3885f4d3db87.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1634/9a4704d3-1b25-43e3-b244-3885f4d3db87.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Rottekongen',
      sourceUrl: 'https://wger.de/en/exercise/1634/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Rope Pullover/row demonstration illustration by Rottekongen, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1635: Modified pulldown
  'wger_1635': Object.freeze({
    exerciseId: 'wger_1635',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1635/b8c34e3a-7474-41ea-99e3-8d7fdb1e12d6.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1635/b8c34e3a-7474-41ea-99e3-8d7fdb1e12d6.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Rottekongen',
      sourceUrl: 'https://wger.de/en/exercise/1635/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Modified pulldown demonstration illustration by Rottekongen, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1637: Single arm row
  'wger_1637': Object.freeze({
    exerciseId: 'wger_1637',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1637/a1fbe83a-a3e5-49f6-a2c2-5d5b533c2be8.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1637/a1fbe83a-a3e5-49f6-a2c2-5d5b533c2be8.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Rottekongen',
      sourceUrl: 'https://wger.de/en/exercise/1637/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Single arm row demonstration illustration by Rottekongen, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1638: Barbell Clean and press
  'wger_1638': Object.freeze({
    exerciseId: 'wger_1638',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1638/046c09b0-c35d-48d0-a552-39dd49f956d2.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1638/046c09b0-c35d-48d0-a552-39dd49f956d2.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Rottekongen',
      sourceUrl: 'https://wger.de/en/exercise/1638/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Barbell Clean and press demonstration illustration by Rottekongen, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1639: Dumbbell Bent Over Face Pull
  'wger_1639': Object.freeze({
    exerciseId: 'wger_1639',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1639/8927346e-f5ca-4795-bdf1-5ac9309401e7.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1639/8927346e-f5ca-4795-bdf1-5ac9309401e7.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1639/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Bent Over Face Pull demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1640: Dumbbell Front Squat
  'wger_1640': Object.freeze({
    exerciseId: 'wger_1640',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1640/bdea82f1-15ef-4649-8b5a-1303cfc178e7.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1640/bdea82f1-15ef-4649-8b5a-1303cfc178e7.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1640/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Front Squat demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1641: Kettlebell One Legged Deadlift
  'wger_1641': Object.freeze({
    exerciseId: 'wger_1641',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1641/68d9488d-2596-420f-be0f-52aa70732c83.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1641/68d9488d-2596-420f-be0f-52aa70732c83.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1641/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Kettlebell One Legged Deadlift demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1642: Dumbbell Hip Thrust
  'wger_1642': Object.freeze({
    exerciseId: 'wger_1642',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1642/a81ad922-caf5-47f8-99b4-640cb0717436.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1642/a81ad922-caf5-47f8-99b4-640cb0717436.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1642/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Hip Thrust demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1648: Weighted Crunch
  'wger_1648': Object.freeze({
    exerciseId: 'wger_1648',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1648/63ae02d6-6dd9-4e9e-84da-d4905e78a33c.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1648/63ae02d6-6dd9-4e9e-84da-d4905e78a33c.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1648/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Weighted Crunch demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1650: Dumbbell Side Bend
  'wger_1650': Object.freeze({
    exerciseId: 'wger_1650',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1650/1d7a5336-ec0b-4898-a474-78ba32789bf3.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1650/1d7a5336-ec0b-4898-a474-78ba32789bf3.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1650/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Side Bend demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1651: Dumbbell Rear Lunge
  'wger_1651': Object.freeze({
    exerciseId: 'wger_1651',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1651/04ab2679-a04d-4d05-9c85-0d36e898328c.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1651/04ab2679-a04d-4d05-9c85-0d36e898328c.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1651/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Rear Lunge demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1652: Dumbbell Romanian Deadlift
  'wger_1652': Object.freeze({
    exerciseId: 'wger_1652',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1652/0306c8c0-70cc-45d4-92de-6fa72ceaa834.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1652/0306c8c0-70cc-45d4-92de-6fa72ceaa834.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1652/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Romanian Deadlift demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1653: Dumbbell Side Squat
  'wger_1653': Object.freeze({
    exerciseId: 'wger_1653',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1653/c10c4e17-1e14-4cf9-930b-cc3a614f15dd.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1653/c10c4e17-1e14-4cf9-930b-cc3a614f15dd.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1653/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Dumbbell Side Squat demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1654: Machine Lateral Raise
  'wger_1654': Object.freeze({
    exerciseId: 'wger_1654',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1654/aa724a58-b3b5-4522-b278-1155416236a5.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1654/aa724a58-b3b5-4522-b278-1155416236a5.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'roneydya',
      sourceUrl: 'https://wger.de/en/exercise/1654/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Machine Lateral Raise demonstration illustration by roneydya, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1706: Bulgarian Squat with Dumbbells
  'wger_1706': Object.freeze({
    exerciseId: 'wger_1706',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1706/0c5243cc-2539-4005-aee0-d3a8c5d3a32c.jfif.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1706/0c5243cc-2539-4005-aee0-d3a8c5d3a32c.jfif',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'AlucardEvil40',
      sourceUrl: 'https://wger.de/en/exercise/1706/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Bulgarian Squat with Dumbbells demonstration illustration by AlucardEvil40, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1725: Seated Row (Machine)
  'wger_1725': Object.freeze({
    exerciseId: 'wger_1725',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1725/f0ebd44e-b8e1-400c-b598-ca371f3a07af.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1725/f0ebd44e-b8e1-400c-b598-ca371f3a07af.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'barry',
      sourceUrl: 'https://wger.de/en/exercise/1725/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Seated Row (Machine) demonstration illustration by barry, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1726: Straight-Arm Pulldown (Cable)
  'wger_1726': Object.freeze({
    exerciseId: 'wger_1726',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1726/2e7e541b-5f55-405a-ae78-3e71b3f42db4.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1726/2e7e541b-5f55-405a-ae78-3e71b3f42db4.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'barry',
      sourceUrl: 'https://wger.de/en/exercise/1726/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Straight-Arm Pulldown (Cable) demonstration illustration by barry, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1732: Face pulls with yellow/green band
  'wger_1732': Object.freeze({
    exerciseId: 'wger_1732',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1732/d13b9adb-968e-4f73-95e6-b16690bcf616.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1732/d13b9adb-968e-4f73-95e6-b16690bcf616.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: '54str',
      sourceUrl: 'https://wger.de/en/exercise/1732/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Face pulls with yellow/green band demonstration illustration by 54str, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1733: Isometric Squat to Failure
  'wger_1733': Object.freeze({
    exerciseId: 'wger_1733',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1733/4ef77069-beb2-4504-a4f3-b181d5f35212.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1733/4ef77069-beb2-4504-a4f3-b181d5f35212.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1733/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Isometric Squat to Failure demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1734: Single-Leg Lunge with Kettlebell:
  'wger_1734': Object.freeze({
    exerciseId: 'wger_1734',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1734/782e2fbb-1267-476d-a817-14f3b83e0564.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1734/782e2fbb-1267-476d-a817-14f3b83e0564.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1734/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Single-Leg Lunge with Kettlebell: demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1735: Single-leg side glute press
  'wger_1735': Object.freeze({
    exerciseId: 'wger_1735',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1735/43bca7d9-2333-43f3-8554-2d0b39fa2a07.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1735/43bca7d9-2333-43f3-8554-2d0b39fa2a07.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1735/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Single-leg side glute press demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1736: Single-Leg Deadlift with Dumbbell
  'wger_1736': Object.freeze({
    exerciseId: 'wger_1736',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1736/aa724cc5-c485-4f3e-9d2a-0c6ae4baefbe.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1736/aa724cc5-c485-4f3e-9d2a-0c6ae4baefbe.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1736/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Single-Leg Deadlift with Dumbbell demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1738: Neutral-grip pull-ups or TRX rows
  'wger_1738': Object.freeze({
    exerciseId: 'wger_1738',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1738/0529acdf-ede8-42a2-a3e5-8d0c57b7a0e1.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1738/0529acdf-ede8-42a2-a3e5-8d0c57b7a0e1.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: '54str',
      sourceUrl: 'https://wger.de/en/exercise/1738/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Neutral-grip pull-ups or TRX rows demonstration illustration by 54str, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1744: Machine Side Lateral Raises
  'wger_1744': Object.freeze({
    exerciseId: 'wger_1744',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1744/cb9263c4-39fc-4261-8d30-a5d6d57841c1.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1744/cb9263c4-39fc-4261-8d30-a5d6d57841c1.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1744/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Machine Side Lateral Raises demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1745: Cable Front Raise with a small bar
  'wger_1745': Object.freeze({
    exerciseId: 'wger_1745',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1745/9c92843a-6b90-428b-a868-9af4b11bad38.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1745/9c92843a-6b90-428b-a868-9af4b11bad38.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1745/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Cable Front Raise with a small bar demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1747: Smith machine squat
  'wger_1747': Object.freeze({
    exerciseId: 'wger_1747',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1747/af9647dd-04ec-4adf-9c07-4e33edb77277.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1747/af9647dd-04ec-4adf-9c07-4e33edb77277.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1747/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Smith machine squat demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1748: Machine Hip Abduction
  'wger_1748': Object.freeze({
    exerciseId: 'wger_1748',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1748/923a3ff7-c269-49bd-9f03-697151a40f06.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1748/923a3ff7-c269-49bd-9f03-697151a40f06.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Tierrasverdes',
      sourceUrl: 'https://wger.de/en/exercise/1748/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Machine Hip Abduction demonstration illustration by Tierrasverdes, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1801: Barbell Full Squat
  'wger_1801': Object.freeze({
    exerciseId: 'wger_1801',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1801/60043328-1cfb-4289-9865-aaf64d5aaa28.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1801/60043328-1cfb-4289-9865-aaf64d5aaa28.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Workout Guru',
      sourceUrl: 'https://wger.de/en/exercise/1801/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Barbell Full Squat demonstration illustration by Workout Guru, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1804: ankle dorsiflexion rocks
  'wger_1804': Object.freeze({
    exerciseId: 'wger_1804',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1804/691c69b8-c3db-4177-8435-dd3a97d88542.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1804/691c69b8-c3db-4177-8435-dd3a97d88542.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1804/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'ankle dorsiflexion rocks demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1830: Barbell Step Back Lunge
  'wger_1830': Object.freeze({
    exerciseId: 'wger_1830',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1830/3b6c547c-ab3d-4472-93cf-561710279eab.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1830/3b6c547c-ab3d-4472-93cf-561710279eab.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'hans',
      sourceUrl: 'https://wger.de/en/exercise/1830/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Barbell Step Back Lunge demonstration illustration by hans, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1831: Hammerstrength Decline Chest Press
  'wger_1831': Object.freeze({
    exerciseId: 'wger_1831',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1831/2d9d509f-707b-4132-961e-91a2459ca198.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1831/2d9d509f-707b-4132-961e-91a2459ca198.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'hans',
      sourceUrl: 'https://wger.de/en/exercise/1831/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hammerstrength Decline Chest Press demonstration illustration by hans, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1835: External Rotation Stretch
  'wger_1835': Object.freeze({
    exerciseId: 'wger_1835',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1835/ca4a0b7e-9fdd-4173-843a-f0392824abe1.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1835/ca4a0b7e-9fdd-4173-843a-f0392824abe1.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Nick E',
      sourceUrl: 'https://wger.de/en/exercise/1835/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'External Rotation Stretch demonstration illustration by Nick E, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1854: Calves foam roller
  'wger_1854': Object.freeze({
    exerciseId: 'wger_1854',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1854/ccd3c18e-c864-426f-8176-15dce14305e3.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1854/ccd3c18e-c864-426f-8176-15dce14305e3.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1854/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Calves foam roller demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1855: Hamstring Foam roller
  'wger_1855': Object.freeze({
    exerciseId: 'wger_1855',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1855/a6597ed8-1613-4458-ba56-4b63bc946a35.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1855/a6597ed8-1613-4458-ba56-4b63bc946a35.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1855/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hamstring Foam roller demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1856: Foam Roller Anterior tibialis
  'wger_1856': Object.freeze({
    exerciseId: 'wger_1856',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1856/19c31c63-4968-4887-b8e6-4127be27fdde.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1856/19c31c63-4968-4887-b8e6-4127be27fdde.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1856/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Foam Roller Anterior tibialis demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1857: Foam Roller Iliotibial band
  'wger_1857': Object.freeze({
    exerciseId: 'wger_1857',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1857/92291128-cc7e-4f70-9663-80840c516fc9.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1857/92291128-cc7e-4f70-9663-80840c516fc9.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1857/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Foam Roller Iliotibial band demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1858: Foam Roller quadriceps
  'wger_1858': Object.freeze({
    exerciseId: 'wger_1858',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1858/058b6fdb-8093-4b6d-a504-cbf869f3e3d3.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1858/058b6fdb-8093-4b6d-a504-cbf869f3e3d3.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1858/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Foam Roller quadriceps demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1859: Foam Roller Gluteus
  'wger_1859': Object.freeze({
    exerciseId: 'wger_1859',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1859/2465d5eb-c249-454d-93eb-58aa13bdc080.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1859/2465d5eb-c249-454d-93eb-58aa13bdc080.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1859/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Foam Roller Gluteus demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1860: Foam Roller Adductors
  'wger_1860': Object.freeze({
    exerciseId: 'wger_1860',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1860/f0410e66-28d5-455f-90f3-d078e0988460.avif.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1860/f0410e66-28d5-455f-90f3-d078e0988460.avif',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1860/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Foam Roller Adductors demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1861: Side stretch
  'wger_1861': Object.freeze({
    exerciseId: 'wger_1861',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1861/0ffe4e99-71ad-47fb-b98c-1f243faa0499.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1861/0ffe4e99-71ad-47fb-b98c-1f243faa0499.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1861/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Side stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1862: Hip Circles
  'wger_1862': Object.freeze({
    exerciseId: 'wger_1862',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1862/93d993f8-1d8c-4e21-99c6-08b2fe424a17.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1862/93d993f8-1d8c-4e21-99c6-08b2fe424a17.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1862/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hip Circles demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1863: Hip Crossover
  'wger_1863': Object.freeze({
    exerciseId: 'wger_1863',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1863/5f29959d-0fd1-46d2-98b7-0c2cb5d9ee13.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1863/5f29959d-0fd1-46d2-98b7-0c2cb5d9ee13.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1863/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hip Crossover demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1864: Ankle Roll
  'wger_1864': Object.freeze({
    exerciseId: 'wger_1864',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1864/5970cdd8-0123-4eba-a921-2157fb6adacf.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1864/5970cdd8-0123-4eba-a921-2157fb6adacf.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1864/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Ankle Roll demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1865: Banded Ankle Mobility
  'wger_1865': Object.freeze({
    exerciseId: 'wger_1865',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1865/c2c9848e-5094-4ed9-bd81-0831b6551483.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1865/c2c9848e-5094-4ed9-bd81-0831b6551483.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1865/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Banded Ankle Mobility demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1867: Hip Flexor Stretch
  'wger_1867': Object.freeze({
    exerciseId: 'wger_1867',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1867/767631e5-10d2-46b8-b03f-cc298f96963b.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1867/767631e5-10d2-46b8-b03f-cc298f96963b.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1867/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hip Flexor Stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1868: Lunge with Twist Stretch
  'wger_1868': Object.freeze({
    exerciseId: 'wger_1868',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1868/446e7065-215d-4a91-9da7-9416101442bb.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1868/446e7065-215d-4a91-9da7-9416101442bb.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1868/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Lunge with Twist Stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1869: Lying Figure Four Stretch
  'wger_1869': Object.freeze({
    exerciseId: 'wger_1869',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1869/c49187bd-9f90-4a7a-b25e-1d50e857a104.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1869/c49187bd-9f90-4a7a-b25e-1d50e857a104.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1869/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Lying Figure Four Stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1870: Lying Hamstring Stretch with Band
  'wger_1870': Object.freeze({
    exerciseId: 'wger_1870',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1870/7465bbcf-3b86-42a6-8d2f-12a3d1f60a15.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1870/7465bbcf-3b86-42a6-8d2f-12a3d1f60a15.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1870/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Lying Hamstring Stretch with Band demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1872: Pigeon Stretch
  'wger_1872': Object.freeze({
    exerciseId: 'wger_1872',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1872/df982df1-512a-4eb9-acd9-68cc1c265df6.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1872/df982df1-512a-4eb9-acd9-68cc1c265df6.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1872/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Pigeon Stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1874: Runners Lunge Stretch
  'wger_1874': Object.freeze({
    exerciseId: 'wger_1874',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1874/66fca8a5-41e8-42d1-8776-5e46a4902650.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1874/66fca8a5-41e8-42d1-8776-5e46a4902650.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1874/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Runners Lunge Stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1875: Standing IT Band Stretch
  'wger_1875': Object.freeze({
    exerciseId: 'wger_1875',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1875/e1128391-4b73-43a9-ab27-657d8bb43083.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1875/e1128391-4b73-43a9-ab27-657d8bb43083.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1875/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Standing IT Band Stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1876: Supported Calf Stretch
  'wger_1876': Object.freeze({
    exerciseId: 'wger_1876',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1876/ca7b3fe7-5908-4ec2-9d85-7fa1b80bb105.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1876/ca7b3fe7-5908-4ec2-9d85-7fa1b80bb105.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/1876/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Supported Calf Stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1889: Decline Bench Leg Raise
  'wger_1889': Object.freeze({
    exerciseId: 'wger_1889',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1889/bc51ef67-0c12-4340-a36c-42ef722778dd.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1889/bc51ef67-0c12-4340-a36c-42ef722778dd.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'nishant0712',
      sourceUrl: 'https://wger.de/en/exercise/1889/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Decline Bench Leg Raise demonstration illustration by nishant0712, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1893: Overhead Barbell Press
  'wger_1893': Object.freeze({
    exerciseId: 'wger_1893',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1893/7dbad19e-0616-41fd-9d7d-3e21649c0eea.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1893/7dbad19e-0616-41fd-9d7d-3e21649c0eea.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'nishant0712',
      sourceUrl: 'https://wger.de/en/exercise/1893/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Overhead Barbell Press demonstration illustration by nishant0712, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1900: Tricep Rope Pushdowns
  'wger_1900': Object.freeze({
    exerciseId: 'wger_1900',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1900/a8243245-8f8f-4e2b-93ca-694d416cb11d.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1900/a8243245-8f8f-4e2b-93ca-694d416cb11d.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'nishant0712',
      sourceUrl: 'https://wger.de/en/exercise/1900/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Tricep Rope Pushdowns demonstration illustration by nishant0712, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1901: Clean and Press
  'wger_1901': Object.freeze({
    exerciseId: 'wger_1901',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1901/046f0f42-0ed5-48c5-a9ee-41de25e3b6a0.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1901/046f0f42-0ed5-48c5-a9ee-41de25e3b6a0.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'nishant0712',
      sourceUrl: 'https://wger.de/en/exercise/1901/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Clean and Press demonstration illustration by nishant0712, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1902: Weighted push-ups
  'wger_1902': Object.freeze({
    exerciseId: 'wger_1902',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1902/d0c3f170-543c-4be4-bc70-5c6dc606406c.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1902/d0c3f170-543c-4be4-bc70-5c6dc606406c.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'nishant0712',
      sourceUrl: 'https://wger.de/en/exercise/1902/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Weighted push-ups demonstration illustration by nishant0712, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1916: Tuck planche
  'wger_1916': Object.freeze({
    exerciseId: 'wger_1916',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1916/e7d97b4b-9fe4-4378-aea3-5a9d93b6eb8d.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1916/e7d97b4b-9fe4-4378-aea3-5a9d93b6eb8d.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'ISSACS',
      sourceUrl: 'https://wger.de/en/exercise/1916/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Tuck planche demonstration illustration by ISSACS, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1922: Seated Cable chest fly
  'wger_1922': Object.freeze({
    exerciseId: 'wger_1922',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1922/eb750ee5-3220-4128-aef1-5e2f1ccff40a.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1922/eb750ee5-3220-4128-aef1-5e2f1ccff40a.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'shushu',
      sourceUrl: 'https://wger.de/en/exercise/1922/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Seated Cable chest fly demonstration illustration by shushu, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1947: dumbbell snatch
  'wger_1947': Object.freeze({
    exerciseId: 'wger_1947',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1947/4201a9c0-f9e4-48ca-80f1-b46c7ffe5640.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1947/4201a9c0-f9e4-48ca-80f1-b46c7ffe5640.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Aleid',
      sourceUrl: 'https://wger.de/en/exercise/1947/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'dumbbell snatch demonstration illustration by Aleid, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1962: Step Jack
  'wger_1962': Object.freeze({
    exerciseId: 'wger_1962',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1962/74041371-1019-4f89-9ebe-cec792484a46.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1962/74041371-1019-4f89-9ebe-cec792484a46.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Anon#2',
      sourceUrl: 'https://wger.de/en/exercise/1962/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Step Jack demonstration illustration by Anon#2, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1963: Slow Squat
  'wger_1963': Object.freeze({
    exerciseId: 'wger_1963',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1963/db285682-1ab3-4be0-ae00-5117ecce1ee6.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1963/db285682-1ab3-4be0-ae00-5117ecce1ee6.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Anon#2',
      sourceUrl: 'https://wger.de/en/exercise/1963/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Slow Squat demonstration illustration by Anon#2, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1965: Marching High Knees
  'wger_1965': Object.freeze({
    exerciseId: 'wger_1965',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1965/03c08a42-dedb-4a46-8d15-acaf497a35a2.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1965/03c08a42-dedb-4a46-8d15-acaf497a35a2.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Anon#2',
      sourceUrl: 'https://wger.de/en/exercise/1965/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Marching High Knees demonstration illustration by Anon#2, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1968: Single-arm dumbbell shoulder press
  'wger_1968': Object.freeze({
    exerciseId: 'wger_1968',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1968/cd92e973-a0d9-4e5f-9011-5369012598d3.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/1968/cd92e973-a0d9-4e5f-9011-5369012598d3.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'evtimovgeorg',
      sourceUrl: 'https://wger.de/en/exercise/1968/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Single-arm dumbbell shoulder press demonstration illustration by evtimovgeorg, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_1971: Mentzer Pulldown
  'wger_1971': Object.freeze({
    exerciseId: 'wger_1971',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/1971/729af526-19a0-4d3d-a258-196c7575d139.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/1971/729af526-19a0-4d3d-a258-196c7575d139.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Athlean-X',
      sourceUrl: 'https://wger.de/en/exercise/1971/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Mentzer Pulldown demonstration illustration by Athlean-X, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2452: Curl De Muñeca Con Barra
  'wger_2452': Object.freeze({
    exerciseId: 'wger_2452',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2452/f6262118-1e01-4a98-b8aa-1cc69d383311.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/2452/f6262118-1e01-4a98-b8aa-1cc69d383311.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'xWan',
      sourceUrl: 'https://wger.de/en/exercise/2452/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Curl De Muñeca Con Barra demonstration illustration by xWan, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2494: Band Terminal Knee extension
  'wger_2494': Object.freeze({
    exerciseId: 'wger_2494',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2494/02f1ae86-d374-4b5a-b314-a76c487ea1e9.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/2494/02f1ae86-d374-4b5a-b314-a76c487ea1e9.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Knickers1833',
      sourceUrl: 'https://wger.de/en/exercise/2494/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Band Terminal Knee extension demonstration illustration by Knickers1833, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2529: Explosive Push-Ups
  'wger_2529': Object.freeze({
    exerciseId: 'wger_2529',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2529/e97b7a36-3414-4c4f-9d66-fe37182e829b.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2529/e97b7a36-3414-4c4f-9d66-fe37182e829b.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'ege',
      sourceUrl: 'https://wger.de/en/exercise/2529/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Explosive Push-Ups demonstration illustration by ege, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2530: Russian Push Ups
  'wger_2530': Object.freeze({
    exerciseId: 'wger_2530',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2530/c39eccd5-c7a5-47cd-85c2-76cac547ad7c.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2530/c39eccd5-c7a5-47cd-85c2-76cac547ad7c.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'ege',
      sourceUrl: 'https://wger.de/en/exercise/2530/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Russian Push Ups demonstration illustration by ege, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2618: Hip-Out and Hip-In Lateral Steps
  'wger_2618': Object.freeze({
    exerciseId: 'wger_2618',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2618/e0a5c993-37a8-4271-9056-7cdf1ad677be.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2618/e0a5c993-37a8-4271-9056-7cdf1ad677be.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'aboksz',
      sourceUrl: 'https://wger.de/en/exercise/2618/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Hip-Out and Hip-In Lateral Steps demonstration illustration by aboksz, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2619: Single-Leg Soft-Landing Holds
  'wger_2619': Object.freeze({
    exerciseId: 'wger_2619',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2619/32c68e76-6456-4c29-b24d-89d5a5b12d02.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2619/32c68e76-6456-4c29-b24d-89d5a5b12d02.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'aboksz',
      sourceUrl: 'https://wger.de/en/exercise/2619/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Single-Leg Soft-Landing Holds demonstration illustration by aboksz, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2620: Reverse V-Squat
  'wger_2620': Object.freeze({
    exerciseId: 'wger_2620',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2620/561eb05a-b0e4-4cde-a338-5855a30dffd4.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2620/561eb05a-b0e4-4cde-a338-5855a30dffd4.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'aboksz',
      sourceUrl: 'https://wger.de/en/exercise/2620/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Reverse V-Squat demonstration illustration by aboksz, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2673: Stomach Vacuum
  'wger_2673': Object.freeze({
    exerciseId: 'wger_2673',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2673/71e1dd6a-c407-45bd-a082-e0e6f5226eb6.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2673/71e1dd6a-c407-45bd-a082-e0e6f5226eb6.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Khp412',
      sourceUrl: 'https://wger.de/en/exercise/2673/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Stomach Vacuum demonstration illustration by Khp412, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2674: Captain\'s Chair Knee Raise
  'wger_2674': Object.freeze({
    exerciseId: 'wger_2674',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2674/3e752d40-288d-4a45-9b51-1f18433e664f.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2674/3e752d40-288d-4a45-9b51-1f18433e664f.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'fen',
      sourceUrl: 'https://wger.de/en/exercise/2674/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Captain\'s Chair Knee Raise demonstration illustration by fen, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2675: Captain\'s Chair Oblique Knee Raise
  'wger_2675': Object.freeze({
    exerciseId: 'wger_2675',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2675/6165b802-9139-4a27-8892-946aa19c2b5c.webp.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2675/6165b802-9139-4a27-8892-946aa19c2b5c.webp',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'fen',
      sourceUrl: 'https://wger.de/en/exercise/2675/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Captain\'s Chair Oblique Knee Raise demonstration illustration by fen, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2678: Incline Row - Rings
  'wger_2678': Object.freeze({
    exerciseId: 'wger_2678',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2678/030003e2-3042-4b12-b770-f5c702603540.jpg.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2678/030003e2-3042-4b12-b770-f5c702603540.jpg',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'wintercyan',
      sourceUrl: 'https://wger.de/en/exercise/2678/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Incline Row - Rings demonstration illustration by wintercyan, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2680: Wrist rocks
  'wger_2680': Object.freeze({
    exerciseId: 'wger_2680',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2680/566cfe8f-ee9a-4f4c-8d1f-f8d71f4779ba.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2680/566cfe8f-ee9a-4f4c-8d1f-f8d71f4779ba.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'nalhilal',
      sourceUrl: 'https://wger.de/en/exercise/2680/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Wrist rocks demonstration illustration by nalhilal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2681: Scapular Pushups
  'wger_2681': Object.freeze({
    exerciseId: 'wger_2681',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2681/d4f89553-c920-4748-8302-9bd30b4f4c4d.png.200x200_q85.jpg',
    demonstrationUri: 'https://wger.de/media/exercise-images/2681/d4f89553-c920-4748-8302-9bd30b4f4c4d.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'nalhilal',
      sourceUrl: 'https://wger.de/en/exercise/2681/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Scapular Pushups demonstration illustration by nalhilal, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // wger_2687: Quadriceps Stretch
  'wger_2687': Object.freeze({
    exerciseId: 'wger_2687',
    mediaType: 'image',
    thumbnailUri: 'https://wger.de/media/exercise-images/2687/c0ed299b-6d87-4d90-885d-bb3b5d85f1eb.png.200x200_q85.png',
    demonstrationUri: 'https://wger.de/media/exercise-images/2687/c0ed299b-6d87-4d90-885d-bb3b5d85f1eb.png',
    license: Object.freeze({
      type: 'CC-BY-SA-4.0',
      author: 'Davidgj32',
      sourceUrl: 'https://wger.de/en/exercise/2687/view/',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en',
      attributionNotes: 'Quadriceps Stretch demonstration illustration by Davidgj32, hosted on wger under CC-BY-SA-4.0',
    }),
    isApproved: true,
  }),

  // ============================================================================
  // Canonical Seed Bindings (Offline / Instant First Run)
  // ============================================================================
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
      attributionNotes: 'Bench Press illustration by sistab2, hosted on wger under CC-BY-SA 3.0',
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
      attributionNotes: 'Lateral Raises illustration by Everkinetic, hosted on wger under CC-BY-SA 3.0',
    }),
    isApproved: true,
  }),
});
