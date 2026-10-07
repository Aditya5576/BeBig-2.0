import React from 'react';
import { render, fireEvent, waitFor, cleanup, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
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

describe('BeBig 2.0 — Workout 2.0 Phase 4: Active Workout Header & Actions Redesign', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
    await templateStorage.clearTemplates();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders compact header with WORKOUT label, actual title, and active timer', async () => {
    const session = await workoutRepository.startEmptyWorkout('Chest & Triceps Power');
    await workoutRepository.updateActiveWorkout(session);

    const screen = await render(<ActiveWorkoutScreen />);

    expect(await screen.findByText('WORKOUT')).toBeTruthy();
    expect(await screen.findByTestId('active-workout-title')).toBeTruthy();
    expect(await screen.findByText('Chest & Triceps Power')).toBeTruthy();
    expect(await screen.findByTestId('active-workout-timer')).toBeTruthy();
    expect(await screen.findByTestId('minimize-workout-button')).toBeTruthy();
    expect(await screen.findByTestId('active-workout-menu-button')).toBeTruthy();
  });

  it('exit / back minimizes workout safely to home without terminating session', async () => {
    const session = await workoutRepository.startEmptyWorkout('Leg Annihilation');
    await workoutRepository.updateActiveWorkout(session);

    const screen = await render(<ActiveWorkoutScreen />);

    const backBtn = await screen.findByTestId('minimize-workout-button');
    fireEvent.press(backBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/home');
    });

    // Session is still preserved and recoverable
    const active = await workoutRepository.getActiveWorkout();
    expect(active).not.toBeNull();
    expect(active?.name).toBe('Leg Annihilation');
    expect(active?.pausedAt).toBeTruthy();
  });

  it('opens action menu and handles pause and resume', async () => {
    const session = await workoutRepository.startEmptyWorkout('Back & Biceps Live');
    await workoutRepository.updateActiveWorkout(session);

    const screen = await render(<ActiveWorkoutScreen />);

    // Open Menu
    const menuBtn = await screen.findByTestId('active-workout-menu-button');
    fireEvent.press(menuBtn);

    // Pause Workout
    const pauseItem = await screen.findByTestId('menu-toggle-pause-button');
    expect(pauseItem).toBeTruthy();
    fireEvent.press(pauseItem);

    // PAUSED pill appears
    expect(await screen.findByText('PAUSED')).toBeTruthy();

    const pausedSession = await workoutRepository.getActiveWorkout();
    expect(pausedSession?.pausedAt).toBeTruthy();

    // Open Menu again and Resume
    fireEvent.press(await screen.findByTestId('active-workout-menu-button'));
    const resumeItem = await screen.findByTestId('menu-toggle-pause-button');
    fireEvent.press(resumeItem);

    // PAUSED pill should disappear
    await waitFor(() => {
      expect(screen.queryByText('PAUSED')).toBeNull();
    });

    const resumedSession = await workoutRepository.getActiveWorkout();
    expect(resumedSession?.pausedAt).toBeNull();
  });

  it('renames active workout via action menu modal', async () => {
    const session = await workoutRepository.startEmptyWorkout('Quick Workout');
    await workoutRepository.updateActiveWorkout(session);

    const screen = await render(<ActiveWorkoutScreen />);

    // Open Menu
    fireEvent.press(await screen.findByTestId('active-workout-menu-button'));

    // Tap Rename
    fireEvent.press(await screen.findByTestId('menu-rename-workout-button'));

    // Input new title
    const input = await screen.findByTestId('rename-workout-input');
    fireEvent.changeText(input, 'Upper Body Hypertrophy');

    // Save
    fireEvent.press(await screen.findByTestId('save-rename-workout-button'));

    // Title updates on screen
    expect(await screen.findByText('Upper Body Hypertrophy')).toBeTruthy();

    const updated = await workoutRepository.getActiveWorkout();
    expect(updated?.name).toBe('Upper Body Hypertrophy');
  });

  it('provides safe discard confirmation via action menu and bottom action', async () => {
    const session = await workoutRepository.startEmptyWorkout('Discardable Workout');
    await workoutRepository.updateActiveWorkout(session);

    const screen = await render(<ActiveWorkoutScreen />);

    const alertSpy = jest.spyOn(Alert, 'alert');

    // Tap bottom discard
    const discardBottom = await screen.findByTestId('discard-workout-button');
    fireEvent.press(discardBottom);

    expect(alertSpy).toHaveBeenCalledWith(
      'Discard Workout',
      expect.stringContaining('Are you sure you want to discard this workout?'),
      expect.any(Array),
    );
  });

  it('ensures Finish Workout button remains prominent and accessible', async () => {
    const session = await workoutRepository.startEmptyWorkout('Finished Session');
    const withEx = workoutRepository.addExerciseToWorkout(session, {
      id: 'curl_1',
      name: 'Bicep Curl',
    });
    await workoutRepository.updateActiveWorkout(withEx);

    const screen = await render(<ActiveWorkoutScreen />);

    const finishBtn = await screen.findByTestId('finish-workout-button');
    expect(finishBtn).toBeTruthy();
    expect(await screen.findByTestId('add-exercise-to-workout-button')).toBeTruthy();
  });
});
