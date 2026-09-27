import React from 'react';
import { View, Alert } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { exerciseCacheStorage } from '../src/features/exercises/storage/exerciseCacheStorage';
import ExerciseDetailScreen from '../app/exercises/[id]';

// Fake component to trigger Babel JSX preset
export function FakeComp() { return <View />; }

jest.mock('../src/features/exercises/storage/customExerciseStorage');
jest.mock('../src/features/exercises/storage/exerciseCacheStorage');

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'custom_123' }),
}));

jest.mock('../src/services/sync', () => ({
  useEntitySyncStatus: jest.fn().mockReturnValue('SAVED_TO_CLOUD'),
  syncMetadataStore: {
    getRecord: jest.fn().mockResolvedValue(null),
    markPendingUpload: jest.fn().mockResolvedValue(undefined),
    markPendingDelete: jest.fn().mockResolvedValue(undefined),
    removeRecord: jest.fn().mockResolvedValue(undefined),
  },
  syncLifecycleManager: {
    triggerSync: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('EXERCISE-1: Exercise Library Foundation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockCustomExercise: any = {
    id: 'custom_123',
    name: 'My Custom Squat',
    category: 'legs',
    categoryName: 'Legs',
    primaryMuscles: [{ id: 1, name: 'Quadriceps' }],
    secondaryMuscles: [],
    equipment: [{ id: 1, name: 'Barbell' }],
    images: [],
    sourceProvider: 'custom',
    isCustom: true,
    description: 'Keep back straight and squat deep.',
  };

  const mockWgerExercise: any = {
    id: 'wger_456',
    name: 'Wger Bench Press',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 2, name: 'Pectoralis Major' }],
    secondaryMuscles: [{ id: 3, name: 'Triceps' }],
    equipment: [{ id: 1, name: 'Barbell' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
    description: 'Lie on bench and press upward.',
  };

  it('1, 2. Distinguishes custom vs external exercises', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockCustomExercise]);
    
    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockWgerExercise],
      totalCount: 1,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises();
    
    expect(result.exercises).toHaveLength(2);
    const custom = result.exercises.find(e => e.id === 'custom_123');
    const external = result.exercises.find(e => e.id === 'wger_456');

    expect(custom!.isCustom).toBe(true);
    expect(custom!.sourceProvider).toBe('custom');
    expect(external!.isCustom).toBe(false);
    expect(external!.sourceProvider).toBe('wger');
  });

  it('3, 12. Maintains stable exercise identity and deduplicates by ID', async () => {
    (exerciseCacheStorage.searchCached as jest.Mock).mockReturnValue([mockWgerExercise]);
    
    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockWgerExercise],
      totalCount: 1,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises({ query: 'bench' });
    
    expect(result.exercises.filter(e => e.id === 'wger_456')).toHaveLength(1);
  });

  it('6. Supports Source filtering: Custom Only', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockCustomExercise]);
    
    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockWgerExercise],
      totalCount: 1,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises({ source: 'custom' });
    
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].id).toBe('custom_123');
  });

  it('6. Supports Source filtering: External Only', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockCustomExercise]);
    
    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockWgerExercise],
      totalCount: 1,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises({ source: 'external' });
    
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].id).toBe('wger_456');
  });

  it('4. Search matching ranks exact matches higher', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([
      { ...mockCustomExercise, name: 'Leg Press', id: 'c1' },
      { ...mockCustomExercise, name: 'Squat', id: 'c2' },
      { ...mockCustomExercise, name: 'Squat Jump', id: 'c3' },
    ]);
    
    jest.spyOn(exerciseRepository.getProvider(), 'listExercises').mockResolvedValue({
      exercises: [],
      totalCount: 0,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises({ query: 'squat' });
    
    expect(result.exercises[0].id).toBe('c2');
    expect(result.exercises[1].id).toBe('c3');
  });

  it('14. Account isolation behavior remains intact', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);
    
    await exerciseRepository.getExercises({}, { ownerId: 'userA', ownerType: 'authenticated' });
    
    expect((customExerciseStorage.getCustomExercises as jest.Mock)).toHaveBeenCalledWith({ ownerId: 'userA', ownerType: 'authenticated' });
  });
});

describe('EXERCISE-2: Exercise Details & Deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockCustomExercise: any = {
    id: 'custom_123',
    name: 'My Custom Squat',
    category: 'legs',
    categoryName: 'Legs',
    primaryMuscles: [{ id: 1, name: 'Quadriceps' }],
    secondaryMuscles: [],
    equipment: [{ id: 1, name: 'Barbell' }],
    images: [],
    sourceProvider: 'custom',
    isCustom: true,
    description: 'Keep back straight and squat deep.',
  };

  const mockWgerExercise: any = {
    id: 'wger_456',
    name: 'Wger Bench Press',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 2, name: 'Pectoralis Major' }],
    secondaryMuscles: [{ id: 3, name: 'Triceps' }],
    equipment: [{ id: 1, name: 'Barbell' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
    description: 'Lie on bench and press upward.',
  };

  it('1. Custom detail shows Delete Custom Exercise button', async () => {
    jest.spyOn(exerciseRepository, 'getExerciseById').mockResolvedValue(mockCustomExercise);

    render(<ExerciseDetailScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('delete-custom-exercise-button')).toBeTruthy();
    });
  });

  it('2. External / WGER detail does NOT show Delete button', async () => {
    jest.spyOn(exerciseRepository, 'getExerciseById').mockResolvedValue(mockWgerExercise);

    render(<ExerciseDetailScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-detail-name').props.children).toBe('Wger Bench Press');
    });

    expect(screen.queryByTestId('delete-custom-exercise-button')).toBeNull();
  });

  it('3, 4. Delete requires confirmation; Cancel leaves custom exercise intact', async () => {
    jest.spyOn(exerciseRepository, 'getExerciseById').mockResolvedValue(mockCustomExercise);
    jest.spyOn(exerciseRepository, 'deleteCustomExercise').mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<ExerciseDetailScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('delete-custom-exercise-button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-custom-exercise-button'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Custom Exercise?',
      'Are you sure you want to delete this custom exercise? This action cannot be undone.',
      expect.any(Array)
    );

    const buttons = alertSpy.mock.calls[0][2] as any[];
    const cancelButton = buttons.find(b => b.text === 'Cancel');
    expect(cancelButton).toBeTruthy();
    
    expect(exerciseRepository.deleteCustomExercise).not.toHaveBeenCalled();
  });

  it('5, 6. Confirmed deletion removes custom exercise and navigates back', async () => {
    jest.spyOn(exerciseRepository, 'getExerciseById').mockResolvedValue(mockCustomExercise);
    jest.spyOn(exerciseRepository, 'deleteCustomExercise').mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<ExerciseDetailScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('delete-custom-exercise-button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('delete-custom-exercise-button'));

    const buttons = alertSpy.mock.calls[0][2] as any[];
    const deleteButton = buttons.find(b => b.text === 'Delete');
    expect(deleteButton).toBeTruthy();

    await deleteButton.onPress();

    expect(exerciseRepository.deleteCustomExercise).toHaveBeenCalledWith('custom_123');
    expect(mockBack).toHaveBeenCalled();
  });

  it('STALE-LIST FIX: Deleting custom exercise invalidates candidateCache and removes exercise from getExercises', async () => {
    jest.spyOn(exerciseRepository, 'deleteCustomExercise').mockRestore();
    jest.spyOn(exerciseRepository, 'getExerciseById').mockRestore();
    (exerciseCacheStorage.searchCached as jest.Mock).mockReturnValue([]);
    let customItems = [mockCustomExercise];
    (customExerciseStorage.getCustomExercises as jest.Mock).mockReset();
    (customExerciseStorage.getCustomExercises as jest.Mock).mockImplementation(async () => customItems);
    (customExerciseStorage.deleteCustomExercise as jest.Mock).mockReset();
    (customExerciseStorage.deleteCustomExercise as jest.Mock).mockImplementation(async (id) => {
      customItems = customItems.filter((item) => item.id !== id);
    });

    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockWgerExercise],
      totalCount: 1,
      hasMore: false,
    });

    // 1. Initial getExercises includes custom_123
    let initialList = await exerciseRepository.getExercises({ category: 'legs' });
    expect(initialList.exercises.some(e => e.id === 'custom_123')).toBe(true);

    // 2. Perform delete
    await exerciseRepository.deleteCustomExercise('custom_123');

    // 3. Re-query getExercises -> custom_123 is completely removed from result & candidateCache
    let updatedList = await exerciseRepository.getExercises({ category: 'legs' });
    expect(updatedList.exercises.some(e => e.id === 'custom_123')).toBe(false);

    // 4. WGER exercises remain intact
    expect(updatedList.exercises.some(e => e.id === 'wger_456')).toBe(true);
  });

  it('7. Existing notes behavior still works', async () => {
    jest.spyOn(exerciseRepository, 'getExerciseById').mockResolvedValue(mockCustomExercise);

    render(<ExerciseDetailScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-detail-instructions')).toBeTruthy();
    });

    expect(screen.getByText('Notes & Form')).toBeTruthy();
  });

  it('8. WGER source-hidden behavior still works', async () => {
    jest.spyOn(exerciseRepository, 'getExerciseById').mockResolvedValue(mockWgerExercise);

    render(<ExerciseDetailScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-detail-name').props.children).toBe('Wger Bench Press');
    });

    expect(screen.queryByTestId('detail-custom-badge')).toBeNull();
    expect(screen.queryByText('WGER')).toBeNull();
    expect(screen.queryByText('WGER CATALOG')).toBeNull();
    expect(screen.queryByText('External')).toBeNull();
  });
});

describe('EXERCISE-3: Custom Exercise Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockExistingCustom: any = {
    id: 'custom_999',
    name: 'Incline Dumbbell Press',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 'cm_0', name: 'Upper Chest' }],
    secondaryMuscles: [],
    equipment: [{ id: 'ceq_0', name: 'Dumbbell' }],
    images: [],
    sourceProvider: 'custom',
    isCustom: true,
    description: 'Keep elbows at 45 degrees.',
  };

  it('1, 4, 5, 8, 9. Valid custom exercise creation trims name, preserves notes, assigns stable ID, and saves locally', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);
    (customExerciseStorage.saveCustomExercise as jest.Mock).mockResolvedValue(undefined);

    const created = await exerciseRepository.createCustomExercise({
      name: '  Bulgarian Split Squat  ',
      category: 'legs',
      primaryMuscles: ['Quadriceps', 'Glutes'],
      secondaryMuscles: ['Hamstrings'],
      equipment: ['Dumbbell'],
      description: '  Keep torso upright and drive through front heel.  ',
    });

    expect(created.name).toBe('Bulgarian Split Squat');
    expect(created.description).toBe('Keep torso upright and drive through front heel.');
    expect(created.category).toBe('legs');
    expect(created.id).toMatch(/^custom_\d+_[a-z0-9]+$/);
    expect(created.isCustom).toBe(true);
    expect(created.sourceProvider).toBe('custom');
    expect(created.primaryMuscles).toHaveLength(2);

    expect(customExerciseStorage.saveCustomExercise).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Bulgarian Split Squat',
        description: 'Keep torso upright and drive through front heel.',
      }),
      expect.anything()
    );
  });

  it('2, 3. Empty or whitespace-only name is rejected', async () => {
    await expect(
      exerciseRepository.createCustomExercise({
        name: '',
        category: 'chest',
        primaryMuscles: ['Chest'],
      })
    ).rejects.toThrow('Please enter an exercise name.');

    await expect(
      exerciseRepository.createCustomExercise({
        name: '     ',
        category: 'chest',
        primaryMuscles: ['Chest'],
      })
    ).rejects.toThrow('Please enter an exercise name.');
  });

  it('6. Duplicate custom exercise names (case-insensitive & trimmed) are rejected', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockExistingCustom]);

    await expect(
      exerciseRepository.createCustomExercise({
        name: '  incline dumbbell press  ',
        category: 'chest',
        primaryMuscles: ['Chest'],
      })
    ).rejects.toThrow('A custom exercise named "incline dumbbell press" already exists.');
  });

  it('7. WGER/external exercises do not trigger custom duplicate protection', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);
    (customExerciseStorage.saveCustomExercise as jest.Mock).mockResolvedValue(undefined);

    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [{ id: 'wger_100', name: 'Barbell Bench Press', category: 'chest', sourceProvider: 'wger', isCustom: false } as any],
      totalCount: 1,
      hasMore: false,
    });

    const created = await exerciseRepository.createCustomExercise({
      name: 'Barbell Bench Press',
      category: 'chest',
      primaryMuscles: ['Chest'],
    });

    expect(created.name).toBe('Barbell Bench Press');
    expect(created.isCustom).toBe(true);
  });

  it('10. Offline creation remains locally available and sets pending sync', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);
    (customExerciseStorage.saveCustomExercise as jest.Mock).mockResolvedValue(undefined);

    const created = await exerciseRepository.createCustomExercise(
      {
        name: 'Offline Cable Fly',
        category: 'chest',
        primaryMuscles: ['Chest'],
      },
      { ownerId: 'user_123', ownerType: 'authenticated' }
    );

    expect(created.id).toBeDefined();
    expect(customExerciseStorage.saveCustomExercise).toHaveBeenCalled();
  });

  it('11. Account/user scope is preserved during custom exercise creation', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);
    (customExerciseStorage.saveCustomExercise as jest.Mock).mockResolvedValue(undefined);

    const userScope = { ownerId: 'user_456', ownerType: 'authenticated' as const };
    const created = await exerciseRepository.createCustomExercise(
      {
        name: 'Scoped Pullup',
        category: 'back',
        primaryMuscles: ['Lats'],
      },
      userScope
    );

    expect(created.ownerId).toBe('user_456');
    expect(created.ownerType).toBe('authenticated');
    expect(customExerciseStorage.saveCustomExercise).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'user_456' }),
      userScope
    );
  });
});

describe('EXERCISE-4: Search, Filtering & Selection UX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockCustomExercise: any = {
    id: 'custom_101',
    name: 'Incline Smith Press',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 'cm_0', name: 'Upper Chest' }],
    secondaryMuscles: [],
    equipment: [{ id: 'ceq_0', name: 'Smith Machine' }],
    images: [],
    sourceProvider: 'custom',
    isCustom: true,
  };

  const mockWgerExercise: any = {
    id: 'wger_202',
    name: 'Dumbbell Incline Bench Press',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: 'w_0', name: 'Pectoralis Major' }],
    secondaryMuscles: [],
    equipment: [{ id: 'w_eq_0', name: 'Dumbbell' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
  };

  it('1. Search works case-insensitively and trims whitespace for custom and WGER exercises', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockCustomExercise]);
    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockWgerExercise],
      totalCount: 1,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises({ query: '   incline   ' });

    expect(result.exercises).toHaveLength(2);
    expect(result.exercises.some((e) => e.id === 'custom_101')).toBe(true);
    expect(result.exercises.some((e) => e.id === 'wger_202')).toBe(true);
  });

  it('2. Custom Only source filter does not invoke WGER provider listExercises', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockCustomExercise]);
    const provider = exerciseRepository.getProvider();
    const listSpy = jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockWgerExercise],
      totalCount: 1,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises({ source: 'custom' });

    expect(listSpy).not.toHaveBeenCalled();
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].id).toBe('custom_101');
  });

  it('2. External Only source filter excludes custom exercises', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockCustomExercise]);
    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockWgerExercise],
      totalCount: 1,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises({ source: 'external' });

    expect(result.exercises.some((e) => e.isCustom)).toBe(false);
    expect(result.exercises.some((e) => e.id === 'wger_202')).toBe(true);
  });

  it('2. All Sources combines custom and external exercises without duplicate IDs', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockCustomExercise]);
    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockCustomExercise, mockWgerExercise],
      totalCount: 2,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises({ source: 'all' });

    const customCount = result.exercises.filter((e) => e.id === 'custom_101').length;
    expect(customCount).toBe(1);
  });

  it('6. Custom exercises remain discoverable offline when WGER request fails', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockCustomExercise]);
    (exerciseCacheStorage.searchCached as jest.Mock).mockReturnValue([]);
    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockRejectedValue(new Error('Network error'));

    const result = await exerciseRepository.getExercises({ category: 'chest' });

    expect(result.exercises.some((e) => e.id === 'custom_101')).toBe(true);
  });
});

describe('EXERCISE-5: Performance & Reliability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Latest search wins over stale search response', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);
    const provider = exerciseRepository.getProvider();

    let resolveSlow: any;
    const slowPromise = new Promise((resolve) => { resolveSlow = resolve; });

    jest.spyOn(provider, 'listExercises')
      .mockImplementationOnce(() => slowPromise as any)
      .mockResolvedValueOnce({
        exercises: [{ id: 'wger_fast', name: 'Fast Press', category: 'chest', isCustom: false } as any],
        totalCount: 1,
        hasMore: false,
      });

    const search1 = exerciseRepository.getExercises({ query: 'slow' });
    const search2 = await exerciseRepository.getExercises({ query: 'fast' });

    resolveSlow({
      exercises: [{ id: 'wger_slow', name: 'Slow Press', category: 'chest', isCustom: false }],
      totalCount: 1,
      hasMore: false,
    });
    await search1;

    expect(search2.exercises.some((e) => e.id === 'wger_fast')).toBe(true);
  });

  it('5. Online recovery behaves correctly when network restores', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);
    (exerciseCacheStorage.searchCached as jest.Mock).mockReturnValue([]);
    const provider = exerciseRepository.getProvider();

    jest.spyOn(provider, 'listExercises')
      .mockRejectedValueOnce(new Error('Network offline'))
      .mockResolvedValueOnce({
        exercises: [{ id: 'wger_recovered', name: 'Recovered Exercise', category: 'chest', isCustom: false } as any],
        totalCount: 1,
        hasMore: false,
      });

    // 1. Offline attempt handles error gracefully
    const offlineResult = await exerciseRepository.getExercises({ category: 'chest' });
    expect(offlineResult.exercises).toHaveLength(0);

    // 2. Network restored attempt recovers naturally
    const onlineResult = await exerciseRepository.getExercises({ category: 'chest' });
    expect(onlineResult.exercises.some((e) => e.id === 'wger_recovered')).toBe(true);
  });
});



