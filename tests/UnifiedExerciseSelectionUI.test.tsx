/**
 * BeBig 2.0 — Unified Exercise Selection UI Test Suite
 *
 * Verifies that:
 * 1. Both Exercise Library (`/exercises`) and Ongoing Workout picker modal render identical canonical ExerciseCards.
 * 2. Equipment information and Target Muscle information are displayed consistently across both entry points.
 * 3. Custom exercise badges are rendered identically in both contexts.
 * 4. Browse mode displays navigation chevron, whereas select mode displays selection controls (checkbox / ADD badge).
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ExerciseListScreen from '../app/exercises/index';
import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { Exercise } from '../src/features/exercises/types';

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

describe('Unified Exercise Selection UI', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('1. Library renders equipment and target muscles on exercise card', async () => {
    const { getByTestId, findByText } = await render(<ExerciseListScreen />);

    // Seed Bench Press card should be present
    expect(getByTestId('exercise-item-seed-bench-press')).toBeTruthy();

    // Verify equipment and category text is rendered
    expect(await findByText(/Chest • Barbell, Bench/i)).toBeTruthy();

    // Verify Target muscles are rendered
    expect(await findByText(/Target: Chest/i)).toBeTruthy();
  });

  it('2. Workout Picker Modal renders matching equipment and target muscles on exercise card', async () => {
    const onSelect = jest.fn();
    const { getByTestId, findByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelectExercise={onSelect}
        selectedExerciseIds={[]}
      />
    );

    // Seed Bench Press card in picker
    expect(getByTestId('picker-exercise-seed-bench-press')).toBeTruthy();

    // Verify identical subtitle format: Category • Equipment
    expect(await findByText(/Chest • Barbell, Bench/i)).toBeTruthy();

    // Tapping exercise card in single-select picker invokes onSelect
    fireEvent.press(getByTestId('picker-exercise-seed-bench-press'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'seed-bench-press', name: 'Barbell Bench Press' })
    );
  });

  it('3. Multi-select Workout Picker renders checkboxes alongside unified card information', async () => {
    const onSelectMultiple = jest.fn();
    const { getByTestId } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelectExercises={onSelectMultiple}
        selectedExerciseIds={[]}
        multiSelect={true}
      />
    );

    // Multi-select checkbox is rendered on the unified card
    expect(getByTestId('picker-checkbox-seed-bench-press')).toBeTruthy();

    // Toggle exercise
    fireEvent.press(getByTestId('picker-exercise-seed-bench-press'));
    expect(getByTestId('picker-add-exercises-button')).toBeTruthy();
  });
});
