import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ActiveSetRow } from '../src/features/workout/components/ActiveSetRow';
import { RestTimerOverlay } from '../src/features/workout/components/RestTimerOverlay';
import { BottomNavBar } from '../src/components/navigation/BottomNavBar';
import { WorkoutExercise, WorkoutSet } from '../src/features/workout/types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/home',
  useSegments: () => ['home'],
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('../src/features/auth', () => ({
  useAuthStore: (selector: (s: { status: string; isGuest: boolean }) => unknown) =>
    selector({ status: 'authenticated', isGuest: false }),
}));

function flattenStyleWidth(style: unknown): number {
  const flat = StyleSheet.flatten(style as any) || {};
  return Number(flat.width || flat.minWidth || 0);
}

function flattenStyleHeight(style: unknown): number {
  const flat = StyleSheet.flatten(style as any) || {};
  return Number(flat.height || flat.minHeight || 0);
}

function effectiveTouchSize(node: any): { width: number; height: number } {
  const rawSlop = node.props.hitSlop;
  const slop = typeof rawSlop === 'number'
    ? { top: rawSlop, bottom: rawSlop, left: rawSlop, right: rawSlop }
    : rawSlop || {};
  const w = flattenStyleWidth(node.props.style) + Number(slop.left || 0) + Number(slop.right || 0);
  const h = flattenStyleHeight(node.props.style) + Number(slop.top || 0) + Number(slop.bottom || 0);
  return { width: w, height: h };
}

describe('Phase 05: UI/UX & Accessibility Touch Targets', () => {
  const exercise: WorkoutExercise = {
    exerciseId: 'ex_bench',
    exerciseName: 'Bench Press',
    categoryName: 'Chest',
    order: 0,
    actualSets: [],
  };

  const set: WorkoutSet = {
    id: 'set_1',
    setNumber: 1,
    weight: 80,
    reps: 8,
    completed: false,
    setType: 'normal',
    notes: 'Controlled eccentric',
  };

  it('UI-01 / UI-04: ActiveSetRow controls meet >=44x44 effective touch targets and expose accessible roles/labels', async () => {
    const { getByTestId } = await render(
      <ActiveSetRow
        exercise={exercise}
        set={set}
        setIndex={0}
        canDelete={true}
        isNotesExpanded={true}
        onUpdateSetField={jest.fn()}
        onToggleCompleteSet={jest.fn()}
        onDeleteSet={jest.fn()}
        onToggleNotes={jest.fn()}
        onCloseNotes={jest.fn()}
      />
    );

    const completeBtn = getByTestId('complete-set-ex_bench-1');
    expect(completeBtn.props.accessibilityRole).toBe('checkbox');
    expect(completeBtn.props.accessibilityState).toEqual({ checked: false });
    expect(completeBtn.props.accessibilityLabel).toContain('Set 1 pending');
    expect(flattenStyleWidth(completeBtn.props.style)).toBe(30);
    expect(effectiveTouchSize(completeBtn).width).toBeGreaterThanOrEqual(44);
    expect(effectiveTouchSize(completeBtn).height).toBeGreaterThanOrEqual(44);

    const noteBtn = getByTestId('set-note-toggle-ex_bench-1');
    expect(noteBtn.props.accessibilityRole).toBe('button');
    expect(noteBtn.props.accessibilityLabel).toContain('Edit note for set 1');
    expect(flattenStyleWidth(noteBtn.props.style)).toBe(26);
    expect(effectiveTouchSize(noteBtn).width).toBeGreaterThanOrEqual(44);
    expect(effectiveTouchSize(noteBtn).height).toBeGreaterThanOrEqual(44);

    const deleteBtn = getByTestId('delete-set-ex_bench-set_1');
    expect(deleteBtn.props.accessibilityRole).toBe('button');
    expect(deleteBtn.props.accessibilityLabel).toBe('Delete set 1');
    expect(flattenStyleWidth(deleteBtn.props.style)).toBe(26);
    expect(effectiveTouchSize(deleteBtn).width).toBeGreaterThanOrEqual(44);
    expect(effectiveTouchSize(deleteBtn).height).toBeGreaterThanOrEqual(44);

    const clearNoteBtn = getByTestId('clear-set-note-ex_bench-1');
    expect(clearNoteBtn.props.accessibilityRole).toBe('button');
    expect(clearNoteBtn.props.accessibilityLabel).toBe('Clear note');

    const actionGroup = getByTestId('action-buttons-ex_bench-set_1');
    const actionGroupStyle = StyleSheet.flatten(actionGroup.props.style) || {};
    expect(actionGroupStyle.flexDirection).toBe('row');
    expect(Number(actionGroupStyle.gap ?? actionGroupStyle.columnGap ?? 0)).toBeGreaterThanOrEqual(4);
    expect(actionGroupStyle.flexShrink).toBe(0);

    const doneNoteBtn = getByTestId('done-set-note-ex_bench-1');
    expect(doneNoteBtn.props.accessibilityRole).toBe('button');
    expect(doneNoteBtn.props.accessibilityLabel).toBe('Done editing note');
  });

  it('UI-01 / UI-04: RestTimerOverlay controls expose accessibility roles, labels, and hitSlop', async () => {
    const { getByTestId } = await render(
      <RestTimerOverlay
        activeRestTimer={{
          exerciseId: 'ex_bench',
          exerciseName: 'Bench Press',
          setNumber: 1,
          durationSeconds: 90,
          targetEndTime: Date.now() + 60_000,
        }}
        onExtend={jest.fn()}
        onClear={jest.fn()}
      />
    );

    const collapseToggle = getByTestId('rest-timer-collapse-toggle');
    expect(collapseToggle.props.accessibilityRole).toBe('button');
    expect(collapseToggle.props.accessibilityLabel).toBeTruthy();
    expect(collapseToggle.props.hitSlop).toBeTruthy();

    const skipBtn = getByTestId('skip-rest-timer-button');
    expect(skipBtn.props.accessibilityRole).toBe('button');
    expect(skipBtn.props.accessibilityLabel).toMatch(/skip/i);
    expect(skipBtn.props.hitSlop).toBeTruthy();
  });

  it('UI-01 / UI-02 / UI-04: BottomNavBar tabs expose roles, labels, selected state, and >=44pt touch height', async () => {
    const { getByTestId } = await render(<BottomNavBar />);

    const homeTab = getByTestId('tab-home');
    expect(homeTab.props.accessibilityRole).toBe('tab');
    expect(homeTab.props.accessibilityLabel).toBe('Home');
    expect(homeTab.props.accessibilityState).toEqual({ selected: true });
    expect(flattenStyleHeight(homeTab.props.style)).toBeGreaterThanOrEqual(44);
    expect(effectiveTouchSize(homeTab).height).toBeGreaterThanOrEqual(44);

    const workoutTab = getByTestId('tab-workout');
    expect(workoutTab.props.accessibilityRole).toBe('button');
    expect(workoutTab.props.accessibilityLabel).toBe('Start Workout');
    expect(workoutTab.props.hitSlop).toBeTruthy();
  });
});
