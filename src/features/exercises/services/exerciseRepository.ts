import { Exercise, ExerciseCategory, CreateCustomExerciseInput } from '../types';
import { ExerciseFilterOptions, ExerciseListResult, IExerciseProvider } from '../providers/types';
import { WgerExerciseProvider } from '../providers/wger/WgerExerciseProvider';
import { customExerciseStorage } from '../storage/customExerciseStorage';
import { normalizeCategory } from '../providers/wger/wgerMapper';
import { getCurrentUserScope } from '../../auth/utils/userScope';

export const STANDARD_CATEGORIES: { id: ExerciseCategory; name: string }[] = [
  { id: 'chest', name: 'Chest' },
  { id: 'back', name: 'Back' },
  { id: 'legs', name: 'Legs' },
  { id: 'arms', name: 'Arms' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'abs', name: 'Abs' },
  { id: 'calves', name: 'Calves' },
  { id: 'cardio', name: 'Cardio' },
];

export const STANDARD_EQUIPMENT: string[] = [
  'Barbell',
  'Dumbbell',
  'Cable machine',
  'Machine',
  'Kettlebell',
  'Bench',
  'Incline bench',
  'Pull-up bar',
  'Resistance band',
  'Bodyweight',
  'Other',
];

export class ExerciseRepository {
  private provider: IExerciseProvider;

  constructor(provider?: IExerciseProvider) {
    this.provider = provider || new WgerExerciseProvider();
  }

  setProvider(provider: IExerciseProvider): void {
    this.provider = provider;
  }

  getProvider(): IExerciseProvider {
    return this.provider;
  }

  getCategories(): { id: ExerciseCategory; name: string }[] {
    return STANDARD_CATEGORIES;
  }

  getEquipmentList(): string[] {
    return STANDARD_EQUIPMENT;
  }

  async getExercises(options: ExerciseFilterOptions = {}): Promise<ExerciseListResult> {
    const isFirstPage = !options.offset || options.offset === 0;

    // Retrieve local custom exercises
    let customMatches: Exercise[] = [];
    if (isFirstPage) {
      const allCustom = await customExerciseStorage.getCustomExercises();
      customMatches = allCustom.filter((ex) => {
        if (options.category && ex.category !== options.category) {
          return false;
        }
        if (options.query && options.query.trim().length > 0) {
          const q = options.query.toLowerCase().trim();
          const nameMatch = ex.name.toLowerCase().includes(q);
          const descMatch = ex.description.toLowerCase().includes(q);
          const catMatch = ex.categoryName.toLowerCase().includes(q);
          const muscleMatch = ex.primaryMuscles.some((m) => m.name.toLowerCase().includes(q));
          if (!nameMatch && !descMatch && !catMatch && !muscleMatch) {
            return false;
          }
        }
        return true;
      });
    }

    // Fetch provider exercises
    const providerResult = await this.provider.listExercises(options);

    // Merge custom exercises on the first page
    const combined = isFirstPage
      ? [...customMatches, ...providerResult.exercises]
      : providerResult.exercises;

    return {
      exercises: combined,
      totalCount: providerResult.totalCount + customMatches.length,
      hasMore: providerResult.hasMore,
      nextOffset: providerResult.nextOffset,
    };
  }

  async getExerciseById(id: string): Promise<Exercise | null> {
    // Check custom exercises first
    if (id.startsWith('custom_')) {
      const customs = await customExerciseStorage.getCustomExercises();
      return customs.find((e) => e.id === id) || null;
    }

    // Fall back to external provider
    return this.provider.getExerciseById(id);
  }

  async createCustomExercise(input: CreateCustomExerciseInput): Promise<Exercise> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Exercise name is required.');
    }

    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const { categoryName } = normalizeCategory(input.category);

    const primaryMuscles = (input.primaryMuscles || [])
      .map((name, idx) => ({ id: `cm_${idx}`, name: name.trim() }))
      .filter((m) => m.name.length > 0);

    const secondaryMuscles = (input.secondaryMuscles || [])
      .map((name, idx) => ({ id: `csm_${idx}`, name: name.trim() }))
      .filter((m) => m.name.length > 0);

    const equipment = (input.equipment || [])
      .map((name, idx) => ({ id: `ceq_${idx}`, name: name.trim() }))
      .filter((eq) => eq.name.length > 0);

    const scope = getCurrentUserScope();

    const newExercise: Exercise = {
      id,
      ownerId: scope?.ownerId,
      ownerType: scope?.ownerType,
      name: trimmedName,
      description: input.description?.trim() || '',
      category: input.category,
      categoryName,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      images: [],
      sourceProvider: 'custom',
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    await customExerciseStorage.saveCustomExercise(newExercise, scope);
    return newExercise;
  }

  async deleteCustomExercise(id: string): Promise<void> {
    await customExerciseStorage.deleteCustomExercise(id);
  }

  /**
   * Invalidates volatile in-memory storage cache on logout/user switch.
   */
  clearInMemoryState(): void {
    customExerciseStorage.clearMemoryCache();
  }
}

export const exerciseRepository = new ExerciseRepository();
