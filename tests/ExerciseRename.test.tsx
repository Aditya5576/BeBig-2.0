import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { exerciseNameOverrideStorage } from '../src/features/exercises/storage/exerciseNameOverrideStorage';
import { resolveExerciseTrackingMode, TREADMILL_EXERCISE_ID } from '../src/features/exercises/exerciseTracking';
import { clearExerciseMemoryCache } from '../src/features/exercises/storage/customExerciseStorage';
import { guestMigrationService } from '../src/features/auth/services/guestMigrationService';
import { platformStorage } from '../src/lib/storage';
import { globalExerciseCatalogService } from '../src/features/exercises/services/globalExerciseCatalogService';
import { filterCatalogueForIndianGym } from '../src/features/exercises/data/gymEquipmentFilter';
import { Exercise } from '../src/features/exercises/types';
import { workoutRepository, mergeSessionDeep } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { UserScope } from '../src/features/auth/utils/userScope';

describe('Exercise Rename & Tracking Mode Safety', () => {
  const scopeA: UserScope = { ownerId: 'user_rename_a', ownerType: 'authenticated' };
  const scopeB: UserScope = { ownerId: 'user_rename_b', ownerType: 'authenticated' };

  beforeEach(async () => {
    clearExerciseMemoryCache();
    await exerciseNameOverrideStorage.clearOverrides(scopeA);
    await exerciseNameOverrideStorage.clearOverrides(scopeB);
    await workoutStorage.clearAllWorkouts();
  });

  it('renames seed/catalog exercise with user-scoped override without altering trackingMode', async () => {
    const renamed = await exerciseRepository.renameExercise(
      TREADMILL_EXERCISE_ID,
      '  Morning incline walk  ',
      scopeA,
    );
    expect(renamed.id).toBe(TREADMILL_EXERCISE_ID);
    expect(renamed.name).toBe('Morning incline walk');
    expect(renamed.trackingMode).toBe('treadmill');
    expect(resolveExerciseTrackingMode(renamed)).toBe('treadmill');

    // User B does not see User A's override
    const userBView = await exerciseRepository.getExerciseById(TREADMILL_EXERCISE_ID, scopeB);
    expect(userBView?.name).toBe('Treadmill');
    expect(userBView?.trackingMode).toBe('treadmill');

    // Restore original name for User A
    const restored = await exerciseRepository.restoreExerciseName(TREADMILL_EXERCISE_ID, scopeA);
    expect(restored?.name).toBe('Treadmill');
    expect(restored?.trackingMode).toBe('treadmill');
  });

  it('never turns a strength exercise into treadmill when renamed to "Treadmill"', async () => {
    const custom = await exerciseRepository.createCustomExercise(
      { name: 'Cable Curl', category: 'arms', primaryMuscles: ['Biceps'], equipment: ['Cable'] },
      scopeA,
    );
    expect(resolveExerciseTrackingMode(custom)).toBe('strength');

    const renamed = await exerciseRepository.renameExercise(custom.id, 'Treadmill', scopeA);
    expect(renamed.name).toBe('Treadmill');
    expect(renamed.trackingMode).toBe('strength');
    expect(resolveExerciseTrackingMode(renamed)).toBe('strength');
  });

  it('enforces trim + 80 char max and merges active workout exerciseName via 3-way scalar merge', async () => {
    await expect(
      exerciseRepository.renameExercise('seed-bench-press', '   ', scopeA),
    ).rejects.toThrow(/required/i);

    await expect(
      exerciseRepository.renameExercise('seed-bench-press', 'A'.repeat(81), scopeA),
    ).rejects.toThrow(/80/);

    const session = await workoutRepository.startEmptyWorkout('Rename Active Test');
    const base = workoutRepository.addExerciseToWorkout(session, {
      id: 'seed-bench-press',
      name: 'Barbell Bench Press',
      categoryName: 'Chest',
    });

    const renamedIncoming = workoutRepository.renameExerciseInWorkout(
      base,
      'seed-bench-press',
      'Competition Bench',
    );
    expect(renamedIncoming.exercises[0].exerciseId).toBe('seed-bench-press');
    expect(renamedIncoming.exercises[0].exerciseName).toBe('Competition Bench');

    // 3-way scalar merge keeps incoming rename over stale stored name
    const merged = mergeSessionDeep(base, renamedIncoming, undefined, base);
    expect(merged.exercises[0].exerciseName).toBe('Competition Bench');
    expect(merged.exercises[0].exerciseId).toBe('seed-bench-press');

    // Stored rename wins if incoming did not change exerciseName
    const storedRenamed = workoutRepository.renameExerciseInWorkout(
      base,
      'seed-bench-press',
      'Paused Bench',
    );
    const mergedStoredWins = mergeSessionDeep(storedRenamed, base, undefined, base);
    expect(mergedStoredWins.exercises[0].exerciseName).toBe('Paused Bench');
  });

  it('clears in-memory overrides on memory cache wipe', async () => {
    await exerciseNameOverrideStorage.setOverride('seed-squat', 'High Bar Squat', scopeA);
    expect(exerciseNameOverrideStorage.getOverrideSync('seed-squat', scopeA)).toBe('High Bar Squat');
    clearExerciseMemoryCache();
    expect(exerciseNameOverrideStorage.getOverrideSync('seed-squat', scopeA)).toBeUndefined();
  });

  it('finds renamed catalog exercises via offline getCachedExercises search and keeps distinct IDs with identical display names', async () => {
    await exerciseRepository.hydrate(scopeA, false);
    await exerciseRepository.renameExercise('seed-bench-press', 'Heavy Flat Press', scopeA);
    await exerciseRepository.renameExercise('seed-incline-db-press', 'Heavy Flat Press', scopeA);

    const hits = exerciseRepository.getCachedExercises({ query: 'Heavy Flat Press' }, scopeA);
    const hitIds = hits.map((e) => e.id);
    expect(hitIds).toContain('seed-bench-press');
    expect(hitIds).toContain('seed-incline-db-press');

    const browse = exerciseRepository.getCachedExercises({}, scopeA);
    const browseIds = browse.map((e) => e.id);
    expect(browseIds).toContain('seed-bench-press');
    expect(browseIds).toContain('seed-incline-db-press');
  });

  it('preserves distinct unrenamed exercise IDs sharing a name across filterCatalogueForIndianGym and global/custom merge', async () => {
    const sharedName = 'Overhead Barbell Press';
    const dupA: Exercise = {
      id: 'ex_dup_alpha',
      name: sharedName,
      description: '',
      category: 'shoulders',
      categoryName: 'Shoulders',
      primaryMuscles: [{ id: 'm_delt', name: 'Shoulders' }],
      secondaryMuscles: [],
      equipment: [{ id: 'eq_bb', name: 'Barbell' }],
      images: [],
      sourceProvider: 'wger',
      isCustom: false,
    };
    const dupB: Exercise = {
      ...dupA,
      id: 'ex_dup_beta',
    };

    // filterCatalogueForIndianGym deduplicates strictly by canonical id (seenIds), keeping distinct unrenamed IDs
    const { filtered } = filterCatalogueForIndianGym([dupA, dupB, { ...dupA }]);
    expect(filtered.map((e) => e.id)).toEqual(['ex_dup_alpha', 'ex_dup_beta']);

    // Custom exercise + global catalog exercise with identical unrenamed name both survive getExercises merge
    const customSameName = await exerciseRepository.createCustomExercise(
      {
        name: sharedName,
        category: 'shoulders',
        primaryMuscles: ['Shoulders'],
        equipment: ['Barbell'],
      },
      scopeA,
    );

    const globalSpy = jest
      .spyOn(globalExerciseCatalogService, 'getActiveGlobalExercises')
      .mockResolvedValue([
        {
          id: 'global_same_name_press',
          name: sharedName,
          description: '',
          category: 'shoulders',
          categoryName: 'Shoulders',
          primaryMuscles: [{ id: 'm_delt', name: 'Shoulders' }],
          secondaryMuscles: [],
          equipment: [{ id: 'eq_bb', name: 'Barbell' }],
          images: [],
          sourceProvider: 'system',
          isCustom: false,
        },
      ]);

    try {
      const merged = await exerciseRepository.getExercises({ limit: 100 }, scopeA);
      const mergedIds = merged.exercises.map((e) => e.id);
      expect(mergedIds).toContain(customSameName.id);
      expect(mergedIds).toContain('global_same_name_press');
    } finally {
      globalSpy.mockRestore();
    }
  });

  it('migrates guest catalog name overrides on sign-in without overwriting existing account overrides and preserves guest data on readback failure', async () => {
    const guestScope: UserScope = { ownerId: 'guest_override_mig_1', ownerType: 'guest' };
    const authScope: UserScope = { ownerId: 'auth_override_mig_1', ownerType: 'authenticated' };

    await exerciseNameOverrideStorage.clearOverrides(guestScope);
    await exerciseNameOverrideStorage.clearOverrides(authScope);

    // Account already renamed Barbell Bench Press; guest renamed both Barbell Bench Press (conflict) & Barbell Squat (new)
    await exerciseNameOverrideStorage.setOverride('seed-bench-press', 'Account Competition Bench', authScope);
    await exerciseNameOverrideStorage.setOverride('seed-bench-press', 'Guest Bench', guestScope);
    await exerciseNameOverrideStorage.setOverride('seed-squat', 'Guest High Bar Squat', guestScope);

    // 1. Readback failure MUST throw and leave guest overrides intact for retry
    const getItemSpy = jest.spyOn(platformStorage, 'getItem').mockResolvedValueOnce(null);
    await expect(
      exerciseNameOverrideStorage.mergeOverrides(guestScope, authScope),
    ).rejects.toThrow(/readback/i);
    getItemSpy.mockRestore();
    expect(await exerciseNameOverrideStorage.ensureHydrated(guestScope)).toEqual({
      'seed-bench-press': 'Guest Bench',
      'seed-squat': 'Guest High Bar Squat',
    });

    // 2. Full guestMigrationService migration merges non-conflicting renames, keeps existing account rename, and clears guest scope
    await guestMigrationService.migrateGuestDataToUser(guestScope, authScope);

    clearExerciseMemoryCache();
    const migratedAuth = await exerciseNameOverrideStorage.ensureHydrated(authScope);
    expect(migratedAuth).toEqual({
      'seed-bench-press': 'Account Competition Bench',
      'seed-squat': 'Guest High Bar Squat',
    });
    expect(await exerciseNameOverrideStorage.ensureHydrated(guestScope)).toEqual({});
  });
});
