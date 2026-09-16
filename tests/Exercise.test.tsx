import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import {
  mapWgerToExercise,
  stripHtml,
  normalizeCategory,
} from '../src/features/exercises/providers/wger/wgerMapper';
import { WgerExerciseProvider } from '../src/features/exercises/providers/wger/WgerExerciseProvider';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { ExerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import ExerciseListScreen from '../app/exercises/index';
import ExerciseDetailScreen from '../app/exercises/[id]';
import CreateCustomExerciseScreen from '../app/exercises/new';
import { WgerExerciseInfoItem } from '../src/features/exercises/providers/wger/wgerTypes';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockParams,
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

const mockSecureStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, val: string) => {
    mockSecureStore.set(key, val);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));

// Sample Wger item for mapping tests
const sampleWgerItem: WgerExerciseInfoItem = {
  id: 42,
  uuid: 'abc-123',
  category: { id: 11, name: 'Chest' },
  muscles: [
    {
      id: 4,
      name: 'Pectoralis major',
      name_en: 'Chest',
      is_front: true,
      image_url_main: 'https://wger.de/static/muscle-4.svg',
    },
  ],
  muscles_secondary: [
    {
      id: 5,
      name: 'Triceps brachii',
      name_en: 'Triceps',
      is_front: false,
    },
  ],
  equipment: [{ id: 1, name: 'Barbell' }],
  images: [
    {
      id: 101,
      uuid: 'img-1',
      image: 'https://wger.de/media/bench.png',
      thumbnails: {
        small: 'https://wger.de/media/bench_sm.png',
        medium: 'https://wger.de/media/bench_md.png',
      },
      is_main: true,
    },
  ],
  translations: [
    {
      id: 1,
      uuid: 'trans-de',
      name: 'Bankdrücken',
      description: '<p>Auf die Bank legen...</p>',
      language: 1,
    },
    {
      id: 2,
      uuid: 'trans-en',
      name: 'Barbell Bench Press',
      description: '<p>Lie down on a flat bench.<br/>Grip the barbell firmly &amp; press up.</p>',
      description_source: 'Lie down on a flat bench.\nGrip the barbell firmly & press up.',
      language: 2,
    },
  ],
};

describe('BeBig 2.0 — Exercise System Foundation', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    mockParams = {};
    await customExerciseStorage.clearCustomExercises();
  });

  // 1. Wger Mapping
  describe('Wger Response Mapping', () => {
    it('1: maps Wger exercise data into BeBig domain model correctly', () => {
      const exercise = mapWgerToExercise(sampleWgerItem);

      expect(exercise.id).toBe('wger_42');
      expect(exercise.name).toBe('Barbell Bench Press');
      expect(exercise.category).toBe('chest');
      expect(exercise.categoryName).toBe('Chest');
      expect(exercise.primaryMuscles).toHaveLength(1);
      expect(exercise.primaryMuscles[0].name).toBe('Chest');
      expect(exercise.secondaryMuscles[0].name).toBe('Triceps');
      expect(exercise.equipment[0].name).toBe('Barbell');
      expect(exercise.images).toHaveLength(1);
      expect(exercise.images[0].url).toBe('https://wger.de/media/bench.png');
      expect(exercise.sourceProvider).toBe('wger');
      expect(exercise.sourceExerciseId).toBe('42');
      expect(exercise.isCustom).toBe(false);
    });

    it('strips HTML markup and unescapes HTML entities', () => {
      const html = '<p>First line</p><br/><ul><li>Step 1 &amp; focus</li></ul>';
      const stripped = stripHtml(html);
      expect(stripped).not.toContain('<p>');
      expect(stripped).not.toContain('</p>');
      expect(stripped).not.toContain('<br/>');
      expect(stripped).toContain('&');
      expect(stripped).toContain('• Step 1');
    });

    it('normalizes category strings safely', () => {
      expect(normalizeCategory('Chest').category).toBe('chest');
      expect(normalizeCategory('Arms').category).toBe('arms');
      expect(normalizeCategory('Legs').category).toBe('legs');
      expect(normalizeCategory('Abs').category).toBe('abs');
      expect(normalizeCategory('Unknown Special').category).toBe('other');
    });
  });

  // 2, 3, 4, 5, 6, 7: Wger Provider behavior
  describe('WgerExerciseProvider', () => {
    it('2 & 4: handles exercise listing and pagination', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 50,
          next: 'https://wger.de/api/v2/exerciseinfo/?limit=20&offset=20',
          previous: null,
          results: [sampleWgerItem],
        }),
      });
      globalThis.fetch = mockFetch as any;

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      const result = await provider.listExercises({ limit: 20, offset: 0 });

      expect(result.exercises).toHaveLength(1);
      expect(result.totalCount).toBe(50);
      expect(result.hasMore).toBe(true);
      expect(result.nextOffset).toBe(20);
      expect(result.exercises[0].name).toBe('Barbell Bench Press');
    });

    it('3: handles search queries and filters', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 1,
          next: null,
          previous: null,
          results: [sampleWgerItem],
        }),
      });
      globalThis.fetch = mockFetch as any;

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      const result = await provider.searchExercises('bench', { category: 'chest' });

      expect(result.exercises).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('search=bench');
      expect(calledUrl).toContain('category=11');
    });

    it('5: retrieves single exercise by ID', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleWgerItem,
      });
      globalThis.fetch = mockFetch as any;

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      const exercise = await provider.getExerciseById('wger_42');

      expect(exercise).not.toBeNull();
      expect(exercise?.id).toBe('wger_42');
      expect(exercise?.name).toBe('Barbell Bench Press');
    });

    it('returns null on 404 not found for single exercise', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      globalThis.fetch = mockFetch as any;

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      const exercise = await provider.getExerciseById('wger_99999');

      expect(exercise).toBeNull();
    });

    it('6: throws friendly error on network failure / 500', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      globalThis.fetch = mockFetch as any;

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      await expect(provider.listExercises()).rejects.toThrow(/Wger API error: HTTP 500/);
    });

    it('7: returns empty results cleanly when provider returns 0 items', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 0,
          next: null,
          previous: null,
          results: [],
        }),
      });
      globalThis.fetch = mockFetch as any;

      const provider = new WgerExerciseProvider('https://wger.de/api/v2');
      const result = await provider.searchExercises('nonexistent');

      expect(result.exercises).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  // 8, 9, 10, 11, 12: Custom Exercises & Persistence
  describe('Custom Exercise Creation & Persistence', () => {
    it('8, 9, 10, 11: creates custom exercise with unique ID and persists locally', async () => {
      const repo = new ExerciseRepository();

      const created1 = await repo.createCustomExercise({
        name: 'Incline Smith Press',
        category: 'chest',
        primaryMuscles: ['Upper Chest'],
        secondaryMuscles: ['Triceps'],
        equipment: ['Smith Machine'],
        description: 'Set bench to 30 degrees and press smoothly.',
      });

      const created2 = await repo.createCustomExercise({
        name: 'Bulgarian Split Squat',
        category: 'legs',
        primaryMuscles: ['Quads', 'Glutes'],
        equipment: ['Dumbbell'],
      });

      // 9: Unique IDs
      expect(created1.id).not.toBe(created2.id);
      expect(created1.id).toMatch(/^custom_/);
      expect(created2.id).toMatch(/^custom_/);

      // 10: isCustom = true and sourceProvider = 'custom'
      expect(created1.isCustom).toBe(true);
      expect(created1.sourceProvider).toBe('custom');
      expect(created1.primaryMuscles[0].name).toBe('Upper Chest');

      // 11: Persists locally
      const stored = await customExerciseStorage.getCustomExercises();
      expect(stored).toHaveLength(2);
      expect(stored.some((e) => e.name === 'Incline Smith Press')).toBe(true);
      expect(stored.some((e) => e.name === 'Bulgarian Split Squat')).toBe(true);

      // 12: Can be retrieved by ID
      const retrieved = await repo.getExerciseById(created1.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Incline Smith Press');
    });

    it('merges custom exercises into exercise list query results', async () => {
      const mockProvider = {
        providerId: 'mock',
        listExercises: jest.fn().mockResolvedValue({
          exercises: [mapWgerToExercise(sampleWgerItem)],
          totalCount: 1,
          hasMore: false,
        }),
        getExerciseById: jest.fn().mockResolvedValue(null),
        searchExercises: jest
          .fn()
          .mockResolvedValue({ exercises: [], totalCount: 0, hasMore: false }),
      };

      const repo = new ExerciseRepository(mockProvider);

      await repo.createCustomExercise({
        name: 'Custom Pushup Variant',
        category: 'chest',
        primaryMuscles: ['Chest'],
      });

      const result = await repo.getExercises();

      // Custom exercise is merged at the front of the list
      expect(result.exercises).toHaveLength(2);
      expect(result.exercises[0].name).toBe('Custom Pushup Variant');
      expect(result.exercises[0].isCustom).toBe(true);
      expect(result.exercises[1].name).toBe('Barbell Bench Press');
      expect(result.exercises[1].isCustom).toBe(false);
      expect(result.totalCount).toBe(2);
    });

    it('rejects empty exercise name on creation', async () => {
      const repo = new ExerciseRepository();
      await expect(
        repo.createCustomExercise({
          name: '   ',
          category: 'arms',
          primaryMuscles: [],
        }),
      ).rejects.toThrow(/Exercise name is required/);
    });
  });

  // UI Screens
  describe('Exercise UI Screens', () => {
    it('renders ExerciseListScreen, displays exercises, and handles search input', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          count: 1,
          next: null,
          previous: null,
          results: [sampleWgerItem],
        }),
      });
      globalThis.fetch = mockFetch as any;

      const { getByTestId, findByText } = await render(<ExerciseListScreen />);

      expect(getByTestId('exercise-screen-title')).toBeTruthy();
      expect(getByTestId('exercise-search-input')).toBeTruthy();
      expect(getByTestId('create-exercise-button')).toBeTruthy();

      const exerciseTitle = await findByText('Barbell Bench Press');
      expect(exerciseTitle).toBeTruthy();

      // Test search typing
      fireEvent.changeText(getByTestId('exercise-search-input'), 'Bench');
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it('renders ExerciseDetailScreen with full instructions and anatomy', async () => {
      mockParams = { id: 'wger_42' };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleWgerItem,
      });
      globalThis.fetch = mockFetch as any;

      const { findByTestId, findByText } = await render(<ExerciseDetailScreen />);

      const nameElement = await findByTestId('exercise-detail-name');
      expect(nameElement).toBeTruthy();
      expect(await findByText('Barbell Bench Press')).toBeTruthy();
      expect(await findByTestId('detail-primary-muscles')).toBeTruthy();
      expect(await findByTestId('exercise-detail-instructions')).toBeTruthy();
    });

    it('validates empty name on custom exercise submission', async () => {
      const { getByTestId, getByText } = await render(<CreateCustomExerciseScreen />);

      fireEvent.press(getByTestId('custom-exercise-submit-button'));
      await waitFor(() => {
        expect(getByText(/Please enter an exercise name/i)).toBeTruthy();
      });
    });

    it('creates custom exercise and navigates back on valid submission', async () => {
      const { getByTestId } = await render(<CreateCustomExerciseScreen />);

      fireEvent.changeText(getByTestId('custom-exercise-name-input'), 'Cable Crossover Press');
      fireEvent.changeText(
        getByTestId('custom-exercise-muscles-input'),
        'Lower Chest, Inner Chest',
      );

      await waitFor(() => {
        expect(getByTestId('custom-exercise-name-input').props.value).toBe('Cable Crossover Press');
      });

      fireEvent.press(getByTestId('custom-exercise-submit-button'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      // Confirm saved in local storage
      const stored = await customExerciseStorage.getCustomExercises();
      expect(stored.some((e) => e.name === 'Cable Crossover Press')).toBe(true);
    });
  });
});
