import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import WorkoutSummaryScreen from '../app/workout/summary';
import WorkoutHistoryDetailScreen from '../app/workout/history/[id]';
import WorkoutHistoryScreen from '../app/workout/history';
import { ActiveExerciseCard } from '../src/features/workout/components/ActiveExerciseCard';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { WorkoutSession, WorkoutExercise } from '../src/features/workout/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      return callback?.();
    }, []);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

jest.mock('../src/services/sync', () => {
  const actual = jest.requireActual('../src/services/sync');
  return {
    ...actual,
    useEntitySyncStatus: () => 'synced',
    syncLifecycleManager: {
      triggerSync: jest.fn(async () => {}),
    },
  };
});

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

const mockUser = {
  id: 'usr_test_notes_user',
  email: 'athlete@bebig.app',
  provider: 'email' as const,
  app_metadata: { provider: 'email' },
};

let mockAuthState = {
  status: 'authenticated',
  user: mockUser as any,
  guestSession: null as any,
  isGuest: false,
};

jest.mock('../src/features/auth/store/useAuthStore', () => ({
  useAuthStore: Object.assign((selector: any) => selector(mockAuthState), {
    getState: () => mockAuthState,
    setState: (newState: any) => {
      mockAuthState = { ...mockAuthState, ...newState };
    },
  }),
}));

jest.mock('../src/features/auth', () => {
  const actual = jest.requireActual('../src/features/auth');
  return {
    ...actual,
    useAuthStore: Object.assign((selector: any) => selector(mockAuthState), {
      getState: () => mockAuthState,
      setState: (newState: any) => {
        mockAuthState = { ...mockAuthState, ...newState };
      },
    }),
  };
});

describe('BeBig 2.0 — Completed Workout Notes Visibility Suite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockParams = {};
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
  });

  afterEach(() => {
    cleanup();
  });

  test('1. Durability: finishing active workout retains set notes in completed workout storage', async () => {
    let session = await workoutRepository.startEmptyWorkout('Notes Retention Workout');
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_squat',
      name: 'Barbell Back Squat',
      categoryName: 'Legs',
    });
    session = workoutRepository.addSetToExercise(session, 'ex_squat');

    // Update set 1 with notes and complete it
    const set1 = session.exercises[0].actualSets[0];
    session = workoutRepository.updateSet(session, 'ex_squat', set1.id, {
      weight: 120,
      reps: 5,
      rir: 2,
      notes: 'Paused at bottom, excellent depth',
      completed: true,
    });

    // Complete set 2 without notes
    const set2 = session.exercises[0].actualSets[1];
    session = workoutRepository.updateSet(session, 'ex_squat', set2.id, {
      weight: 120,
      reps: 5,
      rir: 1,
      completed: true,
    });

    await workoutRepository.updateActiveWorkout(session);

    // Finish the workout
    const completed = await workoutRepository.completeActiveWorkout(session);
    expect(completed.status).toBe('completed');

    // Retrieve from storage
    const retrieved = await workoutRepository.getCompletedWorkoutById(completed.id);
    expect(retrieved).not.toBeNull();
    const retrievedExercise = retrieved!.exercises.find((e) => e.exerciseId === 'ex_squat');
    expect(retrievedExercise).toBeDefined();
    expect(retrievedExercise!.actualSets[0].notes).toBe('Paused at bottom, excellent depth');
    expect(retrievedExercise!.actualSets[1].notes).toBeFalsy();
  });

  test('2. Active Exercise Card: LAST TIME set chip displays 📝 if previous performance set had a note', async () => {
    const mockExercise: WorkoutExercise = {
      exerciseId: 'ex_press',
      exerciseName: 'Overhead Press',
      categoryName: 'Shoulders',
      order: 0,
      actualSets: [
        {
          id: 'set_1',
          setNumber: 1,
          weight: 50,
          reps: 5,
          rir: 2,
          completed: false,
        },
      ],
    };

    const mockLastPerformance = {
      workoutDate: '2026-10-01T10:00:00.000Z',
      sets: [
        {
          id: 'prev_s1',
          setNumber: 1,
          weight: 48,
          reps: 5,
          rir: 1,
          notes: 'Belted set, great stability',
          completed: true,
        },
        {
          id: 'prev_s2',
          setNumber: 2,
          weight: 48,
          reps: 5,
          rir: 0,
          completed: true,
        },
      ],
    };

    const screen = await render(
      <ActiveExerciseCard
        exercise={mockExercise}
        exIndex={0}
        totalExercisesCount={1}
        lastPerformance={mockLastPerformance}
        expandedNotesSetIds={{}}
        onMoveUp={jest.fn()}
        onMoveDown={jest.fn()}
        onRemoveExercise={jest.fn()}
        onAddSet={jest.fn()}
        onDeleteSet={jest.fn()}
        onToggleNotes={jest.fn()}
        onUpdateSetField={jest.fn()}
        onToggleCompleteSet={jest.fn()}
      />
    );

    // Set 1 had notes -> includes 📝
    const chip1 = screen.getByTestId('last-time-set-chip-ex_press-1');
    expect(chip1).toBeTruthy();
    expect(chip1.props.children).toContain('📝');
    expect(chip1.props.children).toContain('48kg × 5 @ RIR 1');

    // Set 2 had no notes -> does not include 📝
    const chip2 = screen.getByTestId('last-time-set-chip-ex_press-2');
    expect(chip2).toBeTruthy();
    expect(chip2.props.children).not.toContain('📝');
    expect(chip2.props.children).toContain('48kg × 5 @ RIR 0');
  });

  test('3. Workout Summary Screen: renders 📝 indicator and callout for sets with notes, omits for note-less sets', async () => {
    let session = await workoutRepository.startEmptyWorkout('Summary Notes Workout');
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_bench',
      name: 'Bench Press',
      categoryName: 'Chest',
    });
    session = workoutRepository.addSetToExercise(session, 'ex_bench');

    const set1 = session.exercises[0].actualSets[0];
    session = workoutRepository.updateSet(session, 'ex_bench', set1.id, {
      weight: 80,
      reps: 8,
      rir: 2,
      notes: 'Felt slight left shoulder pinch',
      completed: true,
    });

    const set2 = session.exercises[0].actualSets[1];
    session = workoutRepository.updateSet(session, 'ex_bench', set2.id, {
      weight: 80,
      reps: 8,
      rir: 1,
      completed: true,
    });

    const completed = await workoutRepository.completeActiveWorkout(session);
    mockParams = { id: completed.id };

    const screen = await render(<WorkoutSummaryScreen />);

    // Set 1 has note: badge and callout exist
    const noteBadge = await screen.findByTestId('summary-note-indicator-ex_bench-1');
    expect(noteBadge).toBeTruthy();

    const noteCallout = await screen.findByTestId('summary-note-ex_bench-1');
    expect(noteCallout).toBeTruthy();
    expect(await screen.findByText('"Felt slight left shoulder pinch"')).toBeTruthy();

    // Set 2 has no note: badge and callout should be null
    expect(screen.queryByTestId('summary-note-indicator-ex_bench-2')).toBeNull();
    expect(screen.queryByTestId('summary-note-ex_bench-2')).toBeNull();

    // Tapping the callout toggles expansion without throwing
    fireEvent.press(noteCallout);
  });

  test('4. Workout History Detail Screen: renders 📝 indicator and callout for sets with notes, toggle works', async () => {
    let session = await workoutRepository.startEmptyWorkout('History Detail Notes Workout');
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_deadlift',
      name: 'Deadlift',
      categoryName: 'Back',
    });
    session = workoutRepository.addSetToExercise(session, 'ex_deadlift');

    const set1 = session.exercises[0].actualSets[0];
    session = workoutRepository.updateSet(session, 'ex_deadlift', set1.id, {
      weight: 160,
      reps: 5,
      rir: 3,
      notes: 'Hook grip, smooth lockout',
      completed: true,
    });

    const set2 = session.exercises[0].actualSets[1];
    session = workoutRepository.updateSet(session, 'ex_deadlift', set2.id, {
      weight: 160,
      reps: 5,
      rir: 2,
      completed: true,
    });

    const completed = await workoutRepository.completeActiveWorkout(session);
    mockParams = { id: completed.id };

    const screen = await render(<WorkoutHistoryDetailScreen />);

    // Set 1 has note: badge and callout exist
    const noteBadge = await screen.findByTestId('history-set-note-indicator-ex_deadlift-1');
    expect(noteBadge).toBeTruthy();

    const noteCallout = await screen.findByTestId('history-set-note-ex_deadlift-1');
    expect(noteCallout).toBeTruthy();
    expect(await screen.findByText('"Hook grip, smooth lockout"')).toBeTruthy();

    // Set 2 has no note: badge and callout should be null
    expect(screen.queryByTestId('history-set-note-indicator-ex_deadlift-2')).toBeNull();
    expect(screen.queryByTestId('history-set-note-ex_deadlift-2')).toBeNull();

    // Tapping the indicator or callout toggles expansion
    fireEvent.press(noteBadge);
    fireEvent.press(noteCallout);
  });

  test('5. Workout History List: shows 📝 X note(s) badge for workouts with notes, omits for workouts without notes', async () => {
    // Workout 1: has 2 sets with notes
    let sessionWithNotes = await workoutRepository.startEmptyWorkout('Workout With Notes');
    sessionWithNotes = workoutRepository.addExerciseToWorkout(sessionWithNotes, {
      id: 'ex_curl',
      name: 'Bicep Curl',
      categoryName: 'Arms',
    });
    sessionWithNotes = workoutRepository.addSetToExercise(sessionWithNotes, 'ex_curl');

    const s1 = sessionWithNotes.exercises[0].actualSets[0];
    sessionWithNotes = workoutRepository.updateSet(sessionWithNotes, 'ex_curl', s1.id, {
      weight: 15,
      reps: 10,
      notes: 'Strict form',
      completed: true,
    });
    const s2 = sessionWithNotes.exercises[0].actualSets[1];
    sessionWithNotes = workoutRepository.updateSet(sessionWithNotes, 'ex_curl', s2.id, {
      weight: 15,
      reps: 10,
      notes: 'Drop set on last 2 reps',
      completed: true,
    });
    const completedWithNotes = await workoutRepository.completeActiveWorkout(sessionWithNotes);

    // Workout 2: has 0 sets with notes
    let sessionNoNotes = await workoutRepository.startEmptyWorkout('Workout Without Notes');
    sessionNoNotes = workoutRepository.addExerciseToWorkout(sessionNoNotes, {
      id: 'ex_triceps',
      name: 'Triceps Extension',
      categoryName: 'Arms',
    });
    const sNoNote = sessionNoNotes.exercises[0].actualSets[0];
    sessionNoNotes = workoutRepository.updateSet(sessionNoNotes, 'ex_triceps', sNoNote.id, {
      weight: 20,
      reps: 12,
      completed: true,
    });
    const completedNoNotes = await workoutRepository.completeActiveWorkout(sessionNoNotes);

    const screen = await render(<WorkoutHistoryScreen />);

    // Workout with notes should display badge with "📝 2 notes"
    await waitFor(() => {
      const noteBadge = screen.getByTestId(`history-card-notes-indicator-${completedWithNotes.id}`);
      expect(noteBadge).toBeTruthy();
      expect(screen.getByText('📝 2 notes')).toBeTruthy();
      expect(screen.queryByTestId(`history-card-notes-indicator-${completedNoNotes.id}`)).toBeNull();
    });
  });
});
