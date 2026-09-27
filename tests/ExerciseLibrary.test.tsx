import React from 'react';
import { View } from 'react-native';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { exerciseCacheStorage } from '../src/features/exercises/storage/exerciseCacheStorage';
import { Exercise, ExerciseCategory } from '../src/features/exercises/types';

// Fake component to trigger Babel JSX preset
export function FakeComp() { return <View />; }

jest.mock('../src/features/exercises/storage/customExerciseStorage');
jest.mock('../src/features/exercises/storage/exerciseCacheStorage');

describe('EXERCISE-1: Exercise Library Foundation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCustomExercise: any = {
    id: 'custom_123',
    name: 'My Custom Squat',
    category: 'legs',
    categoryName: 'Legs',
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    images: [],
    sourceProvider: 'custom',
    isCustom: true,
    description: '',
  };

  const mockWgerExercise: any = {
    id: 'wger_456',
    name: 'Wger Bench Press',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
    description: '',
  };

  it('1, 2. Distinguishes custom vs external exercises', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([mockCustomExercise]);
    
    // Mock the provider
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
    // Return same exercise from cache and provider
    (exerciseCacheStorage.searchCached as jest.Mock).mockReturnValue([mockWgerExercise]);
    
    const provider = exerciseRepository.getProvider();
    jest.spyOn(provider, 'listExercises').mockResolvedValue({
      exercises: [mockWgerExercise], // Same exact ID
      totalCount: 1,
      hasMore: false,
    });

    // Simulate search which triggers the deduplication logic
    const result = await exerciseRepository.getExercises({ query: 'bench' });
    
    // Should not have duplicates of 'wger_456'
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
    
    // Should only return custom exercises
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
    
    // Should only return external exercises
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].id).toBe('wger_456');
  });

  it('4. Search matching ranks exact matches higher', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([
      { ...mockCustomExercise, name: 'Leg Press', id: 'c1' },
      { ...mockCustomExercise, name: 'Squat', id: 'c2' }, // Exact match for "squat"
      { ...mockCustomExercise, name: 'Squat Jump', id: 'c3' },
    ]);
    
    jest.spyOn(exerciseRepository.getProvider(), 'listExercises').mockResolvedValue({
      exercises: [],
      totalCount: 0,
      hasMore: false,
    });

    const result = await exerciseRepository.getExercises({ query: 'squat' });
    
    // Squat should be first because it's an exact match (score 100)
    expect(result.exercises[0].id).toBe('c2');
    expect(result.exercises[1].id).toBe('c3');
  });

  it('14. Account isolation behavior remains intact', async () => {
    (customExerciseStorage.getCustomExercises as jest.Mock).mockResolvedValue([]);
    
    await exerciseRepository.getExercises({}, { ownerId: 'userA', ownerType: 'authenticated' });
    
    expect((customExerciseStorage.getCustomExercises as jest.Mock)).toHaveBeenCalledWith({ ownerId: 'userA', ownerType: 'authenticated' });
  });
});
