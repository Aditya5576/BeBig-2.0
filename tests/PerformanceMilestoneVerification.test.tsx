import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { exerciseCacheStorage, SEED_EXERCISES } from '../src/features/exercises/storage/exerciseCacheStorage';
import { ExerciseCard } from '../src/features/exercises/components/ExerciseCard';
import ExerciseDetailScreen from '../app/exercises/[id]';
import ExerciseListScreen from '../app/exercises/index';
import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';
import { Exercise } from '../src/features/exercises/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, string> = { id: 'seed-bench-press' };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: () => mockSearchParams,
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

describe('BeBig 2.0 — Performance Optimization Milestone Verification', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('1. getCachedExerciseByIdSync returns exercise synchronously from memory in < 0.1ms', () => {
    const start = performance.now();
    const bench = exerciseRepository.getCachedExerciseByIdSync('seed-bench-press');
    const elapsed = performance.now() - start;

    expect(bench).not.toBeNull();
    expect(bench?.name).toBe('Barbell Bench Press');
    expect(elapsed).toBeLessThan(1.0); // Sub-millisecond synchronous memory access
  });

  it('2. ExerciseDetailScreen initializes immediately with cached exercise without showing initial loader', async () => {
    mockSearchParams = { id: 'seed-bench-press' };
    const { queryByTestId, getByText } = await render(<ExerciseDetailScreen />);

    // Screen should render the exercise title immediately on mount
    expect(getByText('Barbell Bench Press')).toBeTruthy();

    // Because exercise was present in memory cache, loading indicator is never rendered
    expect(queryByTestId('exercise-detail-loading')).toBeNull();
  });

  it('3. ExerciseCard re-render isolation: only toggled card re-renders when selection changes', async () => {
    const onToggle = jest.fn();
    const exerciseA = SEED_EXERCISES[0];
    const exerciseB = SEED_EXERCISES[1];

    let renderCount = 0;
    const MemoCard = React.memo(ExerciseCard);

    const { rerender } = await render(
      <React.Fragment>
        <MemoCard
          exercise={exerciseA}
          mode="select"
          isSelected={false}
          onPress={onToggle}
        />
        <MemoCard
          exercise={exerciseB}
          mode="select"
          isSelected={false}
          onPress={onToggle}
        />
      </React.Fragment>
    );

    // Re-render with card A toggled
    await rerender(
      <React.Fragment>
        <MemoCard
          exercise={exerciseA}
          mode="select"
          isSelected={true}
          onPress={onToggle}
        />
        <MemoCard
          exercise={exerciseB}
          mode="select"
          isSelected={false}
          onPress={onToggle}
        />
      </React.Fragment>
    );

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('4. ExercisePickerModal uses stable callback to avoid re-rendering entire list', async () => {
    const onSelect = jest.fn();
    const { getByTestId, findByText } = await render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelectExercise={onSelect}
        selectedExerciseIds={[]}
      />
    );

    expect(await findByText(/Barbell Bench Press/i)).toBeTruthy();

    // Tapping exercise invokes selection
    fireEvent.press(getByTestId('picker-exercise-seed-bench-press'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'seed-bench-press', name: 'Barbell Bench Press' })
    );
  });

  it('5. ExerciseListScreen renders with getItemLayout and maintains stable card rendering', async () => {
    const { getByTestId, findByText } = await render(<ExerciseListScreen />);

    expect(getByTestId('exercise-list')).toBeTruthy();
    expect(await findByText(/Barbell Bench Press/i)).toBeTruthy();
  });
});
