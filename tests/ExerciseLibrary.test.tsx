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
