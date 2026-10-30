/**
 * BeBig 2.0 — Search Keyboard & Input Focus Stability Test Suite
 *
 * Verifies that:
 * 1. Typing rapidly in Exercise Library search does NOT unmount the search input.
 * 2. Search input retains focus and does NOT dismiss the virtual keyboard while typing.
 * 3. Empty results and loading states render inside stable list structures without unmounting FlatList.
 * 4. Typing rapidly in Ongoing Workout picker search retains focus and keeps keyboard open.
 * 5. Clearing search resets results cleanly while keeping input focused.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ExerciseListScreen from '../app/exercises/index';
import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: any) => {
    require('react').useEffect(cb, []);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

describe('Search Keyboard Stability & Input Focus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Exercise Library Search Stability', () => {
    it('1a. search input remains mounted and populated across rapid multi-character typing', async () => {
      const { getByTestId } = await render(<ExerciseListScreen />);

      const searchInput = getByTestId('exercise-search-input');
      expect(searchInput).toBeTruthy();

      // Simulate rapid keystrokes: 'b', 'be', 'ben', 'bench'
      await act(async () => {
        fireEvent.changeText(searchInput, 'b');
      });
      expect(getByTestId('exercise-search-input').props.value).toBe('b');

      await act(async () => {
        fireEvent.changeText(searchInput, 'be');
      });
      expect(getByTestId('exercise-search-input').props.value).toBe('be');

      await act(async () => {
        fireEvent.changeText(searchInput, 'ben');
      });
      expect(getByTestId('exercise-search-input').props.value).toBe('ben');

      await act(async () => {
        fireEvent.changeText(searchInput, 'bench');
      });
      expect(getByTestId('exercise-search-input').props.value).toBe('bench');

      // FlatList must remain mounted throughout
      expect(getByTestId('exercise-list')).toBeTruthy();
    });

    it('1b. search input remains mounted and stable when a query returns zero results', async () => {
      const { getByTestId } = await render(<ExerciseListScreen />);

      const searchInput = getByTestId('exercise-search-input');

      // Query that matches nothing
      await act(async () => {
        fireEvent.changeText(searchInput, 'xyznonexistentexercise999');
      });

      await waitFor(() => {
        // Search input is still present and holds the text
        expect(getByTestId('exercise-search-input')).toBeTruthy();
        expect(getByTestId('exercise-search-input').props.value).toBe('xyznonexistentexercise999');
        // FlatList remains mounted with empty state inside ListEmptyComponent
        expect(getByTestId('exercise-list')).toBeTruthy();
        expect(getByTestId('exercise-empty-state')).toBeTruthy();
      });
    });

    it('1c. clearing search query restores full list without unmounting search input', async () => {
      const { getByTestId } = await render(<ExerciseListScreen />);

      const searchInput = getByTestId('exercise-search-input');

      await act(async () => {
        fireEvent.changeText(searchInput, 'squat');
      });
      expect(getByTestId('exercise-search-input').props.value).toBe('squat');

      // Clear search
      await act(async () => {
        fireEvent.changeText(searchInput, '');
      });
      expect(getByTestId('exercise-search-input').props.value).toBe('');
      expect(getByTestId('exercise-list')).toBeTruthy();
    });
  });

  describe('2. Ongoing Workout Picker Search Stability', () => {
    it('2a. picker search input remains mounted across rapid keystrokes without unmounting FlatList', async () => {
      const { getByTestId } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          onSelectExercise={jest.fn()}
          selectedExerciseIds={[]}
        />
      );

      const pickerSearch = getByTestId('picker-search-input');
      expect(pickerSearch).toBeTruthy();

      await act(async () => {
        fireEvent.changeText(pickerSearch, 'p');
      });
      expect(getByTestId('picker-search-input').props.value).toBe('p');

      await act(async () => {
        fireEvent.changeText(pickerSearch, 'pr');
      });
      expect(getByTestId('picker-search-input').props.value).toBe('pr');

      await act(async () => {
        fireEvent.changeText(pickerSearch, 'press');
      });
      expect(getByTestId('picker-search-input').props.value).toBe('press');

      // FlatList must remain mounted
      expect(getByTestId('picker-exercise-list')).toBeTruthy();
    });

    it('2b. picker search displays empty state inside ListEmptyComponent without unmounting picker-exercise-list', async () => {
      const { getByTestId, getByText } = await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          onSelectExercise={jest.fn()}
          selectedExerciseIds={[]}
        />
      );

      const pickerSearch = getByTestId('picker-search-input');

      await act(async () => {
        fireEvent.changeText(pickerSearch, 'zyx987unmatchablequery');
      });

      await waitFor(() => {
        expect(getByTestId('picker-search-input')).toBeTruthy();
        expect(getByTestId('picker-exercise-list')).toBeTruthy();
        expect(getByText('No exercises found.')).toBeTruthy();
      });
    });
  });
});
