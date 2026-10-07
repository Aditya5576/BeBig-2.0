import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import { Alert } from 'react-native';
import StartWorkoutScreen from '../app/workout/start';
import { templateRepository } from '../src/features/templates/services/templateRepository';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
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

describe('BeBig 2.0 — Workout 2.0 Phase 3: Start Workout Screen Redesign', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
    await templateStorage.clearTemplates();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders screen header, back button, and empty state when no templates exist', async () => {
    const screen = await render(<StartWorkoutScreen />);

    expect(await screen.findByTestId('start-workout-title')).toBeTruthy();
    expect(await screen.findByTestId('start-workout-back-button')).toBeTruthy();
    expect(await screen.findByTestId('start-empty-workout-button')).toBeTruthy();
    expect(await screen.findByTestId('create-template-button')).toBeTruthy();
    expect(await screen.findByText('No Templates Yet')).toBeTruthy();

    fireEvent.press(await screen.findByTestId('start-workout-back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);

    fireEvent.press(await screen.findByTestId('create-template-button'));
    expect(mockPush).toHaveBeenCalledWith('/templates/new');
  });

  it('starts an empty workout and navigates to /workout/active', async () => {
    const screen = await render(<StartWorkoutScreen />);

    const emptyBtn = await screen.findByTestId('start-empty-workout-button');
    expect(emptyBtn).toBeTruthy();

    fireEvent.press(emptyBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/workout/active');
    });

    const active = await workoutRepository.getActiveWorkout();
    expect(active).not.toBeNull();
    expect(active?.name).toBe('Quick Workout');
  });

  it('renders active workout banner with resume and discard actions when active session exists', async () => {
    await workoutRepository.startEmptyWorkout('In-Progress Beast Mode');

    const screen = await render(<StartWorkoutScreen />);

    expect(await screen.findByTestId('active-workout-banner')).toBeTruthy();
    expect(await screen.findByText('In-Progress Beast Mode')).toBeTruthy();
    expect(await screen.findByTestId('start-resume-workout-button')).toBeTruthy();
    expect(await screen.findByTestId('start-discard-workout-button')).toBeTruthy();

    // Resume button navigates to active workout
    fireEvent.press(await screen.findByTestId('start-resume-workout-button'));
    expect(mockPush).toHaveBeenCalledWith('/workout/active');

    // Discard button alerts user
    const alertSpy = jest.spyOn(Alert, 'alert');
    fireEvent.press(await screen.findByTestId('start-discard-workout-button'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Discard Active Workout',
      expect.stringContaining('Are you sure'),
      expect.any(Array),
    );
  });

  it('deterministically recommends template based on completed history rotation and truth session number', async () => {
    // 1. Create two templates: "Chest & Triceps" and "Back & Biceps"
    const chestTpl = await templateRepository.createTemplate({
      name: 'Chest Heavy Focus',
      workoutFocus: 'Chest & Triceps',
      exercises: [
        {
          exerciseId: 'bench_1',
          exerciseName: 'Barbell Flat Bench',
          categoryName: 'Chest',
          sets: 3,
          targetReps: '8-10',
          restTime: 120,
        },
        {
          exerciseId: 'pushdown_1',
          exerciseName: 'Triceps Rope Pushdown',
          categoryName: 'Triceps',
          sets: 3,
          targetReps: '12',
          restTime: 60,
        },
      ],
    });

    const backTpl = await templateRepository.createTemplate({
      name: 'Back Hypertrophy',
      workoutFocus: 'Back & Biceps',
      exercises: [
        {
          exerciseId: 'row_1',
          exerciseName: 'Barbell Bent Over Row',
          categoryName: 'Back',
          sets: 3,
          targetReps: '8-10',
          restTime: 90,
        },
        {
          exerciseId: 'curl_1',
          exerciseName: 'Barbell Biceps Curl',
          categoryName: 'Biceps',
          sets: 3,
          targetReps: '10',
          restTime: 60,
        },
      ],
    });

    // 2. Add a completed session for "Chest Heavy Focus" done today
    const chestSession = await workoutRepository.startWorkoutFromTemplate(chestTpl);
    chestSession.exercises[0].actualSets[0].completed = true;
    await workoutRepository.completeActiveWorkout(chestSession);

    // 3. Render StartWorkoutScreen
    const screen = await render(<StartWorkoutScreen />);

    // Recommended card should be present
    expect(await screen.findByTestId('recommended-template-card')).toBeTruthy();
    expect(await screen.findByTestId('start-recommended-template-button')).toBeTruthy();

    // Chest has 1 completed session, so its next session is Session 2!
    // Back has 0 completed sessions, so its next session is Session 1!
    expect((await screen.findAllByText('Session 2')).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText('Session 1')).length).toBeGreaterThanOrEqual(1);

    // Press start on recommended template (which is Back Hypertrophy)
    fireEvent.press(await screen.findByTestId('start-recommended-template-button'));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/workout/active');
    });

    const active = await workoutRepository.getActiveWorkout();
    expect(active?.sourceTemplateId).toBe(backTpl.id);
  });

  it('renders template list and starts individual template when tapped', async () => {
    const tpl = await templateRepository.createTemplate({
      name: 'Leg Day Annihilation',
      workoutFocus: 'Legs',
      exercises: [
        {
          exerciseId: 'squat_1',
          exerciseName: 'Barbell Back Squat',
          categoryName: 'Legs',
          sets: 4,
          targetReps: '6-8',
          restTime: 180,
        },
      ],
    });

    const screen = await render(<StartWorkoutScreen />);

    expect(await screen.findByTestId(`template-card-${tpl.id}`)).toBeTruthy();
    const startBtn = await screen.findByTestId(`start-template-${tpl.id}`);
    expect(startBtn).toBeTruthy();

    fireEvent.press(startBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/workout/active');
    });

    const active = await workoutRepository.getActiveWorkout();
    expect(active?.sourceTemplateId).toBe(tpl.id);
  });
});
