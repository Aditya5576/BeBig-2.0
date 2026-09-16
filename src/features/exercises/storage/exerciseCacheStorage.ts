/**
 * BeBig 2.0 — Local-First Exercise Cache Storage
 *
 * Provides instant zero-latency exercise access across weak networks (3G/offline):
 * - Persisted in platformStorage (IndexedDB 'bebig_db' on web, SecureStore on native)
 * - In-memory synchronous access for immediate UI rendering on screen mount
 * - Curated seed library of foundational lifts for instant first-run experience
 * - Fast local candidate search and ranking without network round-trips
 */

import { platformStorage } from '../../../lib/storage';
import { Exercise, ExerciseCategory } from '../types';
import { filterAndRankExercises } from '../utils/exerciseSearch';

const EXERCISE_CATALOG_KEY = 'bebig.exercises.cache.catalog';
const EXERCISE_CACHE_TIME_KEY = 'bebig.exercises.cache.timestamp';

/**
 * Curated seed library of standard compound and isolation lifts.
 * Guaranteed to exist even on fresh installs, cold starts, and offline devices.
 */
export const SEED_EXERCISES: Exercise[] = [
  {
    id: 'seed-bench-press',
    name: 'Barbell Bench Press',
    description: 'Primary compound movement for chest, front delts, and triceps.',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 'm-chest', name: 'Chest', isFront: true }],
    secondaryMuscles: [
      { id: 'm-triceps', name: 'Triceps', isFront: false },
      { id: 'm-front-delts', name: 'Anterior Deltoid', isFront: true },
    ],
    equipment: [{ id: 'eq-barbell', name: 'Barbell' }, { id: 'eq-bench', name: 'Bench' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-incline-db-press',
    name: 'Incline Dumbbell Press',
    description: 'Upper chest and shoulder compound pressing exercise.',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 'm-upper-chest', name: 'Upper Chest', isFront: true }],
    secondaryMuscles: [{ id: 'm-triceps', name: 'Triceps', isFront: false }],
    equipment: [{ id: 'eq-dumbbell', name: 'Dumbbell' }, { id: 'eq-incline-bench', name: 'Incline bench' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-squat',
    name: 'Barbell Back Squat',
    description: 'King of leg builders targeting quads, glutes, and core stability.',
    category: 'legs',
    categoryName: 'Legs',
    primaryMuscles: [{ id: 'm-quads', name: 'Quadriceps', isFront: true }],
    secondaryMuscles: [
      { id: 'm-glutes', name: 'Gluteus Maximus', isFront: false },
      { id: 'm-hamstrings', name: 'Hamstrings', isFront: false },
    ],
    equipment: [{ id: 'eq-barbell', name: 'Barbell' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-deadlift',
    name: 'Conventional Deadlift',
    description: 'Complete posterior chain pull targeting back, glutes, and hamstrings.',
    category: 'back',
    categoryName: 'Back',
    primaryMuscles: [
      { id: 'm-lower-back', name: 'Lower Back', isFront: false },
      { id: 'm-hamstrings', name: 'Hamstrings', isFront: false },
    ],
    secondaryMuscles: [
      { id: 'm-glutes', name: 'Glutes', isFront: false },
      { id: 'm-traps', name: 'Traps', isFront: false },
    ],
    equipment: [{ id: 'eq-barbell', name: 'Barbell' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-overhead-press',
    name: 'Overhead Press (OHP)',
    description: 'Vertical barbell press for shoulder mass and core stability.',
    category: 'shoulders',
    categoryName: 'Shoulders',
    primaryMuscles: [{ id: 'm-shoulders', name: 'Deltoids', isFront: true }],
    secondaryMuscles: [{ id: 'm-triceps', name: 'Triceps', isFront: false }],
    equipment: [{ id: 'eq-barbell', name: 'Barbell' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-barbell-row',
    name: 'Bent-Over Barbell Row',
    description: 'Horizontal compound pull for back thickness and lat engagement.',
    category: 'back',
    categoryName: 'Back',
    primaryMuscles: [{ id: 'm-lats', name: 'Latissimus Dorsi', isFront: false }],
    secondaryMuscles: [
      { id: 'm-rhomboids', name: 'Rhomboids', isFront: false },
      { id: 'm-biceps', name: 'Biceps', isFront: true },
    ],
    equipment: [{ id: 'eq-barbell', name: 'Barbell' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-pull-up',
    name: 'Pull-Up',
    description: 'Bodyweight vertical pulling movement building wide lats.',
    category: 'back',
    categoryName: 'Back',
    primaryMuscles: [{ id: 'm-lats', name: 'Lats', isFront: false }],
    secondaryMuscles: [{ id: 'm-biceps', name: 'Biceps', isFront: true }],
    equipment: [{ id: 'eq-pull-up-bar', name: 'Pull-up bar' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-lat-pulldown',
    name: 'Lat Pulldown',
    description: 'Cable vertical pull targeting lat width and biceps.',
    category: 'back',
    categoryName: 'Back',
    primaryMuscles: [{ id: 'm-lats', name: 'Lats', isFront: false }],
    secondaryMuscles: [{ id: 'm-biceps', name: 'Biceps', isFront: true }],
    equipment: [{ id: 'eq-cable', name: 'Cable machine' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-db-curl',
    name: 'Dumbbell Bicep Curl',
    description: 'Classic isolation arm movement for bicep peak and forearm strength.',
    category: 'arms',
    categoryName: 'Arms',
    primaryMuscles: [{ id: 'm-biceps', name: 'Biceps Brachii', isFront: true }],
    secondaryMuscles: [{ id: 'm-forearms', name: 'Brachialis', isFront: true }],
    equipment: [{ id: 'eq-dumbbell', name: 'Dumbbell' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-tricep-pushdown',
    name: 'Cable Tricep Pushdown',
    description: 'Cable isolation movement targeting all three heads of the triceps.',
    category: 'arms',
    categoryName: 'Arms',
    primaryMuscles: [{ id: 'm-triceps', name: 'Triceps', isFront: false }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq-cable', name: 'Cable machine' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    description: 'Side delt isolation for broad shoulder width.',
    category: 'shoulders',
    categoryName: 'Shoulders',
    primaryMuscles: [{ id: 'm-lateral-delt', name: 'Lateral Deltoid', isFront: false }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq-dumbbell', name: 'Dumbbell' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-leg-press',
    name: 'Leg Press',
    description: 'Machine compound press for quadriceps and glute hypertrophy.',
    category: 'legs',
    categoryName: 'Legs',
    primaryMuscles: [{ id: 'm-quads', name: 'Quadriceps', isFront: true }],
    secondaryMuscles: [{ id: 'm-glutes', name: 'Glutes', isFront: false }],
    equipment: [{ id: 'eq-machine', name: 'Machine' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-romanian-deadlift',
    name: 'Romanian Deadlift (RDL)',
    description: 'Hip hinge movement building strong hamstrings and glutes.',
    category: 'legs',
    categoryName: 'Legs',
    primaryMuscles: [{ id: 'm-hamstrings', name: 'Hamstrings', isFront: false }],
    secondaryMuscles: [{ id: 'm-glutes', name: 'Glutes', isFront: false }],
    equipment: [{ id: 'eq-barbell', name: 'Barbell' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-dips',
    name: 'Parallel Bar Dips',
    description: 'Bodyweight chest and tricep builder with forward lean.',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 'm-chest', name: 'Lower Chest', isFront: true }],
    secondaryMuscles: [{ id: 'm-triceps', name: 'Triceps', isFront: false }],
    equipment: [{ id: 'eq-bodyweight', name: 'Bodyweight' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-calf-raise',
    name: 'Standing Calf Raise',
    description: 'Gastrocnemius and soleus hypertrophy movement.',
    category: 'calves',
    categoryName: 'Calves',
    primaryMuscles: [{ id: 'm-calves', name: 'Gastrocnemius', isFront: false }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq-machine', name: 'Machine' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-plank',
    name: 'Plank',
    description: 'Isometric core stability and abdominal endurance exercise.',
    category: 'abs',
    categoryName: 'Abs',
    primaryMuscles: [{ id: 'm-abs', name: 'Rectus Abdominis', isFront: true }],
    secondaryMuscles: [{ id: 'm-obliques', name: 'Obliques', isFront: true }],
    equipment: [{ id: 'eq-bodyweight', name: 'Bodyweight' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
  {
    id: 'seed-hanging-leg-raise',
    name: 'Hanging Leg Raise',
    description: 'Advanced lower abdominal and hip flexor movement.',
    category: 'abs',
    categoryName: 'Abs',
    primaryMuscles: [{ id: 'm-lower-abs', name: 'Lower Abs', isFront: true }],
    secondaryMuscles: [],
    equipment: [{ id: 'eq-pull-up-bar', name: 'Pull-up bar' }],
    images: [],
    sourceProvider: 'system',
    isCustom: false,
  },
];

class ExerciseCacheStorage {
  private memoryCatalog: Map<string, Exercise> = new Map();
  private isHydrated: boolean = false;
  private inFlightHydration: Promise<void> | null = null;

  constructor() {
    // Pre-populate memory with seed exercises synchronously
    SEED_EXERCISES.forEach((ex) => this.memoryCatalog.set(ex.id, ex));
  }

  /**
   * Synchronously return whatever is in memory cache right now.
   * Enables 0ms render on initial component mount.
   */
  getCachedCatalogSync(): Exercise[] {
    return Array.from(this.memoryCatalog.values());
  }

  /**
   * Hydrates memory catalog from persistent platformStorage (IndexedDB on web).
   */
  async ensureHydrated(): Promise<void> {
    if (this.isHydrated) return;
    if (this.inFlightHydration) return this.inFlightHydration;

    this.inFlightHydration = (async () => {
      try {
        const raw = await platformStorage.getItem(EXERCISE_CATALOG_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Exercise[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((ex) => {
              if (ex && ex.id) {
                this.memoryCatalog.set(ex.id, ex);
              }
            });
          }
        }
      } catch {
        // Fall back to memory catalog
      } finally {
        this.isHydrated = true;
        this.inFlightHydration = null;
      }
    })();

    return this.inFlightHydration;
  }

  /**
   * Returns full cached catalog, hydrating if necessary.
   */
  async getCachedCatalog(): Promise<Exercise[]> {
    await this.ensureHydrated();
    return Array.from(this.memoryCatalog.values());
  }

  /**
   * Save and merge newly fetched exercises into cache.
   */
  async saveToCatalog(exercises: Exercise[]): Promise<void> {
    if (!exercises || exercises.length === 0) return;

    // Merge into memory
    exercises.forEach((ex) => {
      if (ex && ex.id) {
        this.memoryCatalog.set(ex.id, ex);
      }
    });

    // Enforce bounded catalog size (max 500 items) to prevent storage/memory bloat
    const MAX_CATALOG_SIZE = 500;
    if (this.memoryCatalog.size > MAX_CATALOG_SIZE) {
      const seedIds = new Set(SEED_EXERCISES.map((e) => e.id));
      const entries = Array.from(this.memoryCatalog.entries());
      const nonSeedEntries = entries.filter(([id]) => !seedIds.has(id));
      const overflowCount = this.memoryCatalog.size - MAX_CATALOG_SIZE;
      for (let i = 0; i < overflowCount && i < nonSeedEntries.length; i++) {
        this.memoryCatalog.delete(nonSeedEntries[i][0]);
      }
    }

    const allExercises = Array.from(this.memoryCatalog.values());

    try {
      await platformStorage.setItem(EXERCISE_CATALOG_KEY, JSON.stringify(allExercises));
      await platformStorage.setItem(EXERCISE_CACHE_TIME_KEY, Date.now().toString());
    } catch {
      // Storage write error ignored
    }
  }

  /**
   * Retrieve a single exercise by ID from cache.
   */
  async getCachedExerciseById(id: string): Promise<Exercise | null> {
    if (!id) return null;
    const mem = this.memoryCatalog.get(id);
    if (mem) return mem;

    await this.ensureHydrated();
    return this.memoryCatalog.get(id) || null;
  }

  /**
   * Instant local search against cached catalog.
   */
  searchCached(options: { query?: string; category?: string; limit?: number } = {}): Exercise[] {
    const all = Array.from(this.memoryCatalog.values());
    const query = options.query?.trim();
    const category = options.category && options.category !== 'all' ? options.category : undefined;

    let filtered = all;
    if (category) {
      filtered = filtered.filter((e) => e.category === category);
    }

    if (query) {
      filtered = filterAndRankExercises(filtered, query, category as ExerciseCategory);
    }

    if (options.limit && options.limit > 0) {
      return filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Clear cache (useful for dev tools / testing).
   */
  async clearCache(): Promise<void> {
    this.memoryCatalog.clear();
    SEED_EXERCISES.forEach((ex) => this.memoryCatalog.set(ex.id, ex));
    try {
      await platformStorage.removeItem(EXERCISE_CATALOG_KEY);
      await platformStorage.removeItem(EXERCISE_CACHE_TIME_KEY);
    } catch {
      // Storage remove error ignored
    }
  }
}

export const exerciseCacheStorage = new ExerciseCacheStorage();
