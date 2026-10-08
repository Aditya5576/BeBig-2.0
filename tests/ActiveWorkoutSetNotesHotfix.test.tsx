import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import ActiveWorkoutScreen from '../app/workout/active';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateStorage } from '../src/features/templates/storage/templateStorage';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      cb();
    }, [cb]);
  },
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

describe('BeBig 2.0 — Workout 2.0 Set Notes UX Hotfix', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
    await templateStorage.clearTemplates();
  });

  afterEach(() => {
    cleanup();
  });

  async function createFixtureSession() {
    let session = await workoutRepository.startEmptyWorkout('Notes Test Workout');

    // Exercise 1: Dumbbell Press (empty note)
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_db_press',
      name: 'Dumbbell Press',
      categoryName: 'Chest',
    });
    session = workoutRepository.updateSet(session, 'ex_db_press', session.exercises[0].actualSets[0].id, {
      weight: 30,
      reps: 10,
      rir: 2,
      notes: '',
      completed: false,
    });

    // Exercise 2: Lat Pulldown (with initial note)
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_lat_pulldown',
      name: 'Lat Pulldown',
      categoryName: 'Back',
    });
    session = workoutRepository.updateSet(session, 'ex_lat_pulldown', session.exercises[1].actualSets[0].id, {
      weight: 60,
      reps: 12,
      rir: 1,
      notes: 'Initial lat cue',
      completed: false,
    });

    // Exercise 3: Squat (empty note)
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_squat',
      name: 'Squat',
      categoryName: 'Legs',
    });
    session = workoutRepository.updateSet(session, 'ex_squat', session.exercises[2].actualSets[0].id, {
      weight: 100,
      reps: 5,
      rir: 3,
      notes: '',
      completed: false,
    });

    await workoutRepository.updateActiveWorkout(session);
    return session;
  }

  it('renders NOTE column in header and note toggle buttons on all 3 exercises', async () => {
    await createFixtureSession();
    const screen = await render(<ActiveWorkoutScreen />);

    // Header label on all exercises
    const noteHeaders = await screen.findAllByText('NOTE');
    expect(noteHeaders.length).toBe(3);

    // Notes buttons on all exercises
    expect(await screen.findByTestId('set-note-toggle-ex_db_press-1')).toBeTruthy();
    expect(await screen.findByTestId('set-note-toggle-ex_lat_pulldown-1')).toBeTruthy();
    expect(await screen.findByTestId('set-note-toggle-ex_squat-1')).toBeTruthy();

    // Empty set has no active indicator dot
    expect(screen.queryByTestId('set-note-indicator-ex_db_press-1')).toBeNull();

    // Set with initial note has active indicator dot and note input
    expect(await screen.findByTestId('set-note-indicator-ex_lat_pulldown-1')).toBeTruthy();
    expect(await screen.findByDisplayValue('Initial lat cue')).toBeTruthy();
  });

  it('allows opening notes, entering a note, saving, and displaying the note indicator & preview', async () => {
    await createFixtureSession();
    const screen = await render(<ActiveWorkoutScreen />);

    // Initially no note input for Dumbbell Press
    expect(screen.queryByTestId('set-notes-ex_db_press-1')).toBeNull();

    // Open notes
    fireEvent.press(await screen.findByTestId('set-note-toggle-ex_db_press-1'));

    // Input appears
    const noteInput = await screen.findByTestId('set-notes-ex_db_press-1');
    expect(noteInput).toBeTruthy();

    // Enter note
    fireEvent.changeText(noteInput, 'Elbows tucked 45 deg');

    // Save with Done button
    fireEvent.press(await screen.findByTestId('done-set-note-ex_db_press-1'));

    // Input collapses, preview pill and active indicator appear
    await waitFor(() => {
      expect(screen.queryByTestId('set-notes-ex_db_press-1')).toBeNull();
      expect(screen.getByTestId('set-note-indicator-ex_db_press-1')).toBeTruthy();
      expect(screen.getByTestId('set-note-preview-ex_db_press-1')).toBeTruthy();
      expect(screen.getByText('Elbows tucked 45 deg')).toBeTruthy();
    });
  });

  it('allows reopening, editing, and clearing a note via explicit clear button', async () => {
    await createFixtureSession();
    const screen = await render(<ActiveWorkoutScreen />);

    // Lat Pulldown starts with initial note input
    const noteInput = await screen.findByTestId('set-notes-ex_lat_pulldown-1');
    expect(noteInput.props.value).toBe('Initial lat cue');

    // Collapse it with Done to see preview pill
    fireEvent.press(await screen.findByTestId('done-set-note-ex_lat_pulldown-1'));
    expect(await screen.findByTestId('set-note-preview-ex_lat_pulldown-1')).toBeTruthy();
    expect(await screen.findByText('Initial lat cue')).toBeTruthy();

    // Tap preview pill to reopen
    fireEvent.press(await screen.findByTestId('set-note-preview-ex_lat_pulldown-1'));

    // Edit note
    const reopenedInput = await screen.findByTestId('set-notes-ex_lat_pulldown-1');
    fireEvent.changeText(reopenedInput, 'Squeeze lats at bottom');
    fireEvent.press(await screen.findByTestId('done-set-note-ex_lat_pulldown-1'));

    // Updated note is visible in preview pill
    expect(await screen.findByText('Squeeze lats at bottom')).toBeTruthy();

    // Reopen and clear
    fireEvent.press(await screen.findByTestId('set-note-preview-ex_lat_pulldown-1'));
    const clearBtn = await screen.findByTestId('clear-set-note-ex_lat_pulldown-1');
    fireEvent.press(clearBtn);
    fireEvent.press(await screen.findByTestId('done-set-note-ex_lat_pulldown-1'));

    // Note indicator and preview should be gone
    await waitFor(() => {
      expect(screen.queryByTestId('set-note-indicator-ex_lat_pulldown-1')).toBeNull();
      expect(screen.queryByTestId('set-note-preview-ex_lat_pulldown-1')).toBeNull();
    });
  });

  it('preserves set notes when set is completed (✓)', async () => {
    await createFixtureSession();
    const screen = await render(<ActiveWorkoutScreen />);

    // Collapse to preview
    fireEvent.press(await screen.findByTestId('done-set-note-ex_lat_pulldown-1'));
    expect(await screen.findByText('Initial lat cue')).toBeTruthy();

    // Complete the set
    const completeBtn = await screen.findByTestId('complete-set-ex_lat_pulldown-1');
    fireEvent.press(completeBtn);

    // Note remains visible on screen
    expect(await screen.findByText('Initial lat cue')).toBeTruthy();

    // Note is preserved in stored active workout
    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      const latEx = active?.exercises.find((e) => e.exerciseId === 'ex_lat_pulldown');
      const set = latEx?.actualSets[0];
      expect(set?.completed).toBe(true);
      expect(set?.notes).toBe('Initial lat cue');
    });
  });

  it('preserves set notes when exercise is reordered', async () => {
    await createFixtureSession();
    const screen = await render(<ActiveWorkoutScreen />);

    // Collapse to preview
    fireEvent.press(await screen.findByTestId('done-set-note-ex_lat_pulldown-1'));
    expect(await screen.findByText('Initial lat cue')).toBeTruthy();

    // Move Lat Pulldown down
    const moveDownBtn = await screen.findByTestId('move-down-exercise-ex_lat_pulldown');
    fireEvent.press(moveDownBtn);

    // Note remains attached to Lat Pulldown in storage
    await waitFor(async () => {
      const active = await workoutRepository.getActiveWorkout();
      const latEx = active?.exercises.find((e) => e.exerciseId === 'ex_lat_pulldown');
      expect(latEx?.order).toBe(2);
      expect(latEx?.actualSets[0].notes).toBe('Initial lat cue');
    });

    // Note remains visible on screen
    expect(await screen.findByText('Initial lat cue')).toBeTruthy();
  });

  it('preserves set notes when workout is minimized and reopened', async () => {
    await createFixtureSession();
    const screen1 = await render(<ActiveWorkoutScreen />);

    // Collapse to preview
    fireEvent.press(await screen1.findByTestId('done-set-note-ex_lat_pulldown-1'));
    expect(await screen1.findByText('Initial lat cue')).toBeTruthy();

    // Minimize workout
    const minimizeBtn = await screen1.findByTestId('minimize-workout-button');
    fireEvent.press(minimizeBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/home');
    });

    cleanup();

    // Reopen workout screen
    const screen2 = await render(<ActiveWorkoutScreen />);
    expect(await screen2.findByText('Notes Test Workout')).toBeTruthy();
    expect(await screen2.findByTestId('set-note-indicator-ex_lat_pulldown-1')).toBeTruthy();
    expect(await screen2.findByDisplayValue('Initial lat cue')).toBeTruthy();
  });
});
