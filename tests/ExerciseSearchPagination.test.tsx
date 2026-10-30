import React from 'react';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import ExerciseListScreen from '../app/exercises/index';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { Exercise } from '../src/features/exercises/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: any) => {
    const React = require('react');
    React.useEffect(cb, []);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

describe('Exercise Library Search Concurrency & Pagination Deduplication', () => {
  const exercise75: Exercise = {
    id: 'wger_75',
    name: 'Benchpress Dumbbells',
    description: 'Flat bench dumbbell press',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: '1', name: 'Chest' }],
    secondaryMuscles: [{ id: '2', name: 'Triceps' }],
    equipment: [{ id: '1', name: 'Dumbbell' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
  };

  const exercise100: Exercise = {
    id: 'wger_100',
    name: 'Incline Bench Press',
    description: 'Incline barbell bench press',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: '1', name: 'Upper Chest' }],
    secondaryMuscles: [],
    equipment: [{ id: '2', name: 'Barbell' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
  };

  const exercise200: Exercise = {
    id: 'wger_200',
    name: 'Cable Fly',
    description: 'Standing cable chest fly',
    category: 'chest',
    categoryName: 'Chest',
    primaryMuscles: [{ id: '1', name: 'Chest' }],
    secondaryMuscles: [],
    equipment: [{ id: '3', name: 'Cable' }],
    images: [],
    sourceProvider: 'wger',
    isCustom: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    jest.spyOn(exerciseRepository, 'getCachedExercises').mockReturnValue([]);
  });

  afterEach(async () => {
    cleanup();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('1. Transition from browse (hasMore: true) to search does not allow handleLoadMore to fetch or duplicate wger_75', async () => {
    const getExercisesSpy = jest.spyOn(exerciseRepository, 'getExercises').mockImplementation(async (params) => {
      if (params?.query === 'bench') {
        return {
          exercises: [exercise75],
          totalCount: 1,
          hasMore: false,
          nextOffset: undefined,
        };
      }
      return {
        exercises: [exercise75, exercise100],
        totalCount: 50,
        hasMore: true,
        nextOffset: 20,
      };
    });

    const { unmount, getByTestId, queryAllByTestId } = await render(<ExerciseListScreen />);

    // Wait for browse exercises to load
    await waitFor(() => {
      expect(getByTestId('exercise-item-wger_75')).toBeTruthy();
      expect(getByTestId('exercise-item-wger_100')).toBeTruthy();
    });

    // Type "bench" in search input
    await act(async () => {
      fireEvent.changeText(getByTestId('exercise-search-input'), 'bench');
    });

    // Stale onEndReached occurs while search is active
    const list = getByTestId('exercise-list');
    await act(async () => {
      await list.props.onEndReached?.();
    });

    // Wait for debounced search to settle
    await waitFor(() => {
      expect(queryAllByTestId('exercise-item-wger_75').length).toBe(1);
    });

    // Verify handleLoadMore did not invoke offset: 20 during or after search
    const callsWithOffset20 = getExercisesSpy.mock.calls.filter(
      ([params]) => params?.offset === 20,
    );
    expect(callsWithOffset20).toHaveLength(0);

    // Verify wger_75 has exactly 1 element in DOM (no duplicate keys)
    expect(queryAllByTestId('exercise-item-wger_75')).toHaveLength(1);

    unmount();
  });

  it('2. handleLoadMore deduplicates overlapping items returned across browse pages', async () => {
    jest.spyOn(exerciseRepository, 'getExercises').mockImplementation(async (params) => {
      if (params?.offset === 20) {
        // Page 2 returns exercise75 again (overlapping provider bug) plus exercise200
        return {
          exercises: [exercise75, exercise200],
          totalCount: 3,
          hasMore: false,
          nextOffset: undefined,
        };
      }
      // Page 1
      return {
        exercises: [exercise75, exercise100],
        totalCount: 3,
        hasMore: true,
        nextOffset: 20,
      };
    });

    const { unmount, getByTestId, queryAllByTestId } = await render(<ExerciseListScreen />);

    await waitFor(() => {
      expect(getByTestId('exercise-item-wger_75')).toBeTruthy();
    });

    // Trigger load more
    const list = getByTestId('exercise-list');
    await act(async () => {
      await list.props.onEndReached?.();
    });

    await waitFor(() => {
      expect(getByTestId('exercise-item-wger_200')).toBeTruthy();
    });

    // wger_75 must only be rendered once despite overlapping response
    expect(queryAllByTestId('exercise-item-wger_75')).toHaveLength(1);
    expect(queryAllByTestId('exercise-item-wger_100')).toHaveLength(1);
    expect(queryAllByTestId('exercise-item-wger_200')).toHaveLength(1);

    unmount();
  });

  it('3. Clearing search query restores browse mode and resets pagination state', async () => {
    const getExercisesSpy = jest.spyOn(exerciseRepository, 'getExercises').mockImplementation(async (params) => {
      if (params?.query === 'bench') {
        return {
          exercises: [exercise75],
          totalCount: 1,
          hasMore: false,
          nextOffset: undefined,
        };
      }
      return {
        exercises: [exercise75, exercise100],
        totalCount: 2,
        hasMore: true,
        nextOffset: 20,
      };
    });

    const { unmount, getByTestId } = await render(<ExerciseListScreen />);

    await waitFor(() => {
      expect(getByTestId('exercise-item-wger_75')).toBeTruthy();
    });

    // Search "bench"
    await act(async () => {
      fireEvent.changeText(getByTestId('exercise-search-input'), 'bench');
    });

    await waitFor(() => {
      expect(getExercisesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'bench' }),
      );
    });

    // Clear search query back to empty
    await act(async () => {
      fireEvent.changeText(getByTestId('exercise-search-input'), '');
    });

    await waitFor(() => {
      expect(getByTestId('exercise-item-wger_100')).toBeTruthy();
    });

    // Query is undefined again in browse call
    expect(getExercisesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: undefined, offset: 0 }),
    );

    unmount();
  });

  it('4. Switching category resets pagination state immediately and fetches category exercises', async () => {
    const getExercisesSpy = jest.spyOn(exerciseRepository, 'getExercises').mockImplementation(async (params) => {
      if (params?.category === 'chest') {
        return {
          exercises: [exercise100],
          totalCount: 1,
          hasMore: false,
          nextOffset: undefined,
        };
      }
      return {
        exercises: [exercise75],
        totalCount: 50,
        hasMore: true,
        nextOffset: 20,
      };
    });

    const { unmount, getByTestId } = await render(<ExerciseListScreen />);

    await waitFor(() => {
      expect(getByTestId('exercise-item-wger_75')).toBeTruthy();
    });

    // Switch to category 'chest'
    await act(async () => {
      fireEvent.press(getByTestId('category-filter-chest'));
    });

    await waitFor(() => {
      expect(getByTestId('exercise-item-wger_100')).toBeTruthy();
    });

    expect(getExercisesSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'chest', offset: 0 }),
    );

    unmount();
  });

  it('5. Out-of-order asynchronous responses are safely discarded via searchReqIdRef', async () => {
    let resolveSlow: any;
    const slowPromise = new Promise<any>((resolve) => {
      resolveSlow = resolve;
    });

    let resolveFast: any;
    const fastPromise = new Promise<any>((resolve) => {
      resolveFast = resolve;
    });

    jest.spyOn(exerciseRepository, 'getExercises').mockImplementation(async (params) => {
      if (params?.query === 'slow') {
        return slowPromise;
      }
      if (params?.query === 'fast') {
        return fastPromise;
      }
      return {
        exercises: [exercise75],
        totalCount: 1,
        hasMore: false,
        nextOffset: undefined,
      };
    });

    const { unmount, getByTestId, queryByTestId } = await render(<ExerciseListScreen />);

    await waitFor(() => {
      expect(getByTestId('exercise-item-wger_75')).toBeTruthy();
    });

    // Trigger slow search
    await act(async () => {
      fireEvent.changeText(getByTestId('exercise-search-input'), 'slow');
    });

    // Trigger fast search
    await act(async () => {
      fireEvent.changeText(getByTestId('exercise-search-input'), 'fast');
    });

    // Fast search resolves first with exercise200
    await act(async () => {
      resolveFast({
        exercises: [exercise200],
        totalCount: 1,
        hasMore: false,
        nextOffset: undefined,
      });
    });

    await waitFor(() => {
      expect(getByTestId('exercise-item-wger_200')).toBeTruthy();
    });

    // Slow search resolves late with exercise100
    await act(async () => {
      resolveSlow({
        exercises: [exercise100],
        totalCount: 1,
        hasMore: false,
        nextOffset: undefined,
      });
    });

    // Fast search result (exercise200) remains, slow search result (exercise100) was discarded
    expect(getByTestId('exercise-item-wger_200')).toBeTruthy();
    expect(queryByTestId('exercise-item-wger_100')).toBeNull();

    unmount();
  });
});
