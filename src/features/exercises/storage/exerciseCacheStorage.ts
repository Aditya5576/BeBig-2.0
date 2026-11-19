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
import {
  customExerciseStorage,
  registerExerciseMemoryCacheCleaner,
  resolveExerciseScopeNamespace,
} from './customExerciseStorage';
import { UserScope } from '../../auth/utils/userScope';
import { globalExerciseCatalogService } from '../services/globalExerciseCatalogService';

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
  private customCatalogByScope: Map<string, Map<string, Exercise>> = new Map();
  private isCatalogHydrated: boolean = false;
  private hydratedCustomScopes: Set<string> = new Set();
  private inFlightHydrations: Map<string, Promise<void>> = new Map();
  private catalogRevision: number = 0;
  private lastSearchKey: string = '';
  private lastSearchResult: Exercise[] = [];

  constructor() {
    // Pre-populate memory with seed exercises synchronously
    SEED_EXERCISES.forEach((ex) => this.memoryCatalog.set(ex.id, ex));
  }

  private getScopeCustomMap(scope?: UserScope | null, create: boolean = false): Map<string, Exercise> | undefined {
    const namespace = resolveExerciseScopeNamespace(scope);
    let scopeMap = this.customCatalogByScope.get(namespace);
    if (!scopeMap && create) {
      scopeMap = new Map<string, Exercise>();
      this.customCatalogByScope.set(namespace, scopeMap);
    }
    return scopeMap;
  }

  /**
   * Clears volatile user-scoped custom exercise caches (all namespaces if scope omitted).
   * Preserves public seed/provider catalog while preventing cross-user leaks (AUD-016).
   */
  clearCustomMemoryCache(scope?: UserScope | null): void {
    if (scope !== undefined) {
      const namespace = resolveExerciseScopeNamespace(scope);
      this.customCatalogByScope.delete(namespace);
      this.hydratedCustomScopes.delete(namespace);
      this.inFlightHydrations.delete(namespace);
    } else {
      this.customCatalogByScope.clear();
      this.hydratedCustomScopes.clear();
      this.inFlightHydrations.clear();
    }
    this.catalogRevision++;
    this.lastSearchKey = '';
    this.lastSearchResult = [];
  }

  /**
   * Sets and indexes custom exercises in memory for instant unified search,
   * strictly isolated under the active/provided user namespace.
   */
  setCustomExercises(exercises: Exercise[], scope?: UserScope | null): void {
    const scopeMap = this.getScopeCustomMap(scope, true)!;
    scopeMap.clear();
    if (Array.isArray(exercises)) {
      exercises.forEach((ex) => {
        if (ex && ex.id) {
          scopeMap.set(ex.id, ex);
        }
      });
    }
    this.catalogRevision++;
    this.lastSearchKey = '';
    this.lastSearchResult = [];
  }

  /**
   * Adds or updates a single custom exercise in the user-scoped unified search index.
   */
  saveCustomExercise(exercise: Exercise, scope?: UserScope | null): void {
    if (exercise && exercise.id) {
      const scopeMap = this.getScopeCustomMap(scope, true)!;
      scopeMap.set(exercise.id, exercise);
      this.catalogRevision++;
      this.lastSearchKey = '';
      this.lastSearchResult = [];
    }
  }

  /**
   * Removes a custom exercise from the user-scoped unified search index.
   */
  deleteCustomExercise(id: string, scope?: UserScope | null): void {
    const scopeMap = this.getScopeCustomMap(scope, false);
    if (scopeMap && scopeMap.delete(id)) {
      this.catalogRevision++;
      this.lastSearchKey = '';
      this.lastSearchResult = [];
    }
  }

  /**
   * Synchronously returns all currently indexed custom exercises for the active/provided user namespace.
   */
  getCustomExercisesSync(scope?: UserScope | null): Exercise[] {
    const scopeMap = this.getScopeCustomMap(scope, false);
    return scopeMap ? Array.from(scopeMap.values()) : [];
  }

  /**
   * Synchronously return whatever is in memory cache right now.
   * Enables 0ms render on initial component mount.
   */
  getCachedCatalogSync(): Exercise[] {
    return Array.from(this.memoryCatalog.values());
  }

  /**
   * Synchronously return a cached exercise by ID if present in the active user's namespace or public catalog.
   * Enables 0ms render when navigating to Exercise Detail without cross-user leakage.
   */
  getCachedExerciseByIdSync(id: string, scope?: UserScope | null): Exercise | null {
    if (!id) return null;
    const scopeMap = this.getScopeCustomMap(scope, false);
    return scopeMap?.get(id) || this.memoryCatalog.get(id) || null;
  }

  /**
   * Returns true if persistent catalog AND active user custom exercises have been hydrated.
   */
  getIsHydrated(scope?: UserScope | null): boolean {
    const namespace = resolveExerciseScopeNamespace(scope);
    return this.isCatalogHydrated && this.hydratedCustomScopes.has(namespace);
  }

  /**
   * Hydrates memory catalog and custom exercises from persistent platformStorage for the given namespace.
   */
  async ensureHydrated(scope?: UserScope | null, forceRefreshCustom: boolean = false): Promise<void> {
    const namespace = resolveExerciseScopeNamespace(scope);
    if (!forceRefreshCustom && this.isCatalogHydrated && this.hydratedCustomScopes.has(namespace)) return;
    const existingFlight = this.inFlightHydrations.get(namespace);
    if (existingFlight) {
      if (!forceRefreshCustom) return existingFlight;
      await existingFlight;
    }

    const flight = (async () => {
      try {
        const [rawCatalog, customExercises] = await Promise.all([
          this.isCatalogHydrated
            ? Promise.resolve(null)
            : platformStorage.getItem(EXERCISE_CATALOG_KEY).catch(() => null),
          customExerciseStorage.getCustomExercises(scope).catch(() => []),
        ]);

        if (rawCatalog) {
          const parsed = JSON.parse(rawCatalog) as Exercise[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((ex) => {
              if (ex && ex.id) {
                this.memoryCatalog.set(ex.id, ex);
              }
            });
          }
        }

        const scopeMap = this.getScopeCustomMap(scope, true)!;
        scopeMap.clear();
        if (Array.isArray(customExercises) && customExercises.length > 0) {
          customExercises.forEach((ex) => {
            if (ex && ex.id) {
              scopeMap.set(ex.id, ex);
            }
          });
        }
      } catch {
        // Fall back to memory catalog
      } finally {
        this.isCatalogHydrated = true;
        this.hydratedCustomScopes.add(namespace);
        this.inFlightHydrations.delete(namespace);
        this.catalogRevision++;
        this.lastSearchKey = '';
        this.lastSearchResult = [];
      }
    })();

    this.inFlightHydrations.set(namespace, flight);
    return flight;
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

    // Invalidate cached query results on catalog updates
    this.catalogRevision++;
    this.lastSearchKey = '';
    this.lastSearchResult = [];

    const allExercises = Array.from(this.memoryCatalog.values());

    try {
      await platformStorage.setItem(EXERCISE_CATALOG_KEY, JSON.stringify(allExercises));
      await platformStorage.setItem(EXERCISE_CACHE_TIME_KEY, Date.now().toString());
    } catch {
      // Storage write error ignored
    }
  }

  /**
   * Retrieve a single exercise by ID from cache (scoped to active or provided user namespace).
   */
  async getCachedExerciseById(id: string, scope?: UserScope | null): Promise<Exercise | null> {
    if (!id) return null;
    const scopeMap = this.getScopeCustomMap(scope, false);
    const custom = scopeMap?.get(id);
    if (custom) return custom;
    const mem = this.memoryCatalog.get(id);
    if (mem) return mem;

    await this.ensureHydrated(scope);
    const hydratedScopeMap = this.getScopeCustomMap(scope, false);
    return hydratedScopeMap?.get(id) || this.memoryCatalog.get(id) || null;
  }

  /**
   * Instant local search against cached catalog with namespace-isolated query memoization.
   * Merges active user's custom exercises and public provider catalog into a unified index.
   */
  searchCached(
    options: {
      query?: string;
      category?: string;
      limit?: number;
      source?: 'all' | 'custom' | 'external' | 'global';
    } = {},
    scope?: UserScope | null,
  ): Exercise[] {
    const query = options.query?.trim() || '';
    const category = options.category && options.category !== 'all' ? options.category : '';
    const source = options.source || 'all';
    const namespace = resolveExerciseScopeNamespace(scope);
    const cacheKey = `${this.catalogRevision}::${namespace}::${source}::${category}::${query.toLowerCase()}`;

    let baseResults: Exercise[];
    if (this.lastSearchKey === cacheKey) {
      baseResults = this.lastSearchResult;
    } else {
      const scopeMap = this.getScopeCustomMap(scope, false);
      let pool: Exercise[];
      if (source === 'custom') {
        pool = scopeMap ? Array.from(scopeMap.values()) : [];
      } else if (source === 'external') {
        pool = Array.from(this.memoryCatalog.values());
      } else if (source === 'global') {
        pool = globalExerciseCatalogService.getActiveGlobalExercisesSync();
      } else {
        // 'all': unified index with active user's custom exercises placed first
        const customItems = scopeMap ? Array.from(scopeMap.values()) : [];
        const globalItems = globalExerciseCatalogService.getActiveGlobalExercisesSync();
        const providerItems = Array.from(this.memoryCatalog.values());
        const mergedMap = new Map<string, Exercise>();
        customItems.forEach((c) => mergedMap.set(c.id, c));
        globalItems.forEach((g) => {
          if (!mergedMap.has(g.id)) {
            mergedMap.set(g.id, g);
          }
        });
        providerItems.forEach((p) => {
          if (!mergedMap.has(p.id)) {
            mergedMap.set(p.id, p);
          }
        });
        pool = Array.from(mergedMap.values());
      }

      let filtered = pool;
      if (category) {
        filtered = filtered.filter((e) => e.category === category);
      }

      if (query) {
        filtered = filterAndRankExercises(filtered, query, category as ExerciseCategory);
      }

      this.lastSearchKey = cacheKey;
      this.lastSearchResult = filtered;
      baseResults = filtered;
    }

    if (options.limit && options.limit > 0) {
      return baseResults.slice(0, options.limit);
    }

    return baseResults;
  }

  /**
   * Clear cache (useful for dev tools / testing).
   */
  async clearCache(): Promise<void> {
    this.isCatalogHydrated = false;
    this.hydratedCustomScopes.clear();
    this.inFlightHydrations.clear();
    this.catalogRevision++;
    this.lastSearchKey = '';
    this.lastSearchResult = [];
    this.memoryCatalog.clear();
    this.customCatalogByScope.clear();
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
registerExerciseMemoryCacheCleaner(() => exerciseCacheStorage.clearCustomMemoryCache());
