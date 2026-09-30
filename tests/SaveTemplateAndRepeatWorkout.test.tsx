import React from 'react';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateRepository } from '../src/features/templates/services/templateRepository';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { WorkoutSession } from '../src/features/workout/types';
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

import { convertWorkoutToTemplateInput } from '../app/workout/summary';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('BeBig 2.0 — Save as Template & Repeat Workout Flow Audit Fixes', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();
    await templateStorage.clearTemplates();
  });

  // 1 & 2. Save-as-template name propagates to active workout and completed History
  it('1 & 2. Save-as-template name propagates to active workout and completed History shows new name', async () => {
    // Start an active workout draft
    let active = await workoutRepository.startEmptyWorkout('Quick Workout');
    active = workoutRepository.addExerciseToWorkout(active, { id: 'ex_bench', name: 'Bench Press' });
    active = workoutRepository.updateSet(active, 'ex_bench', active.exercises[0].actualSets[0].id, {
      weight: 100,
      reps: 8,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(active);

    // Save as Template with new name "Push Day"
    const input = convertWorkoutToTemplateInput(active, 'Push Day');
    const createdTemplate = await templateRepository.createTemplate(input);
    expect(createdTemplate.name).toBe('Push Day');

    // Propagate new name to active draft
    await workoutRepository.updateActiveWorkoutName('Push Day');

    // Complete the active workout
    const updatedActive = await workoutRepository.getActiveWorkout();
    expect(updatedActive?.name).toBe('Push Day');
    const completed = await workoutRepository.completeActiveWorkout(updatedActive!);

    // History shows "Push Day"
    expect(completed.name).toBe('Push Day');
    const historyList = await workoutRepository.getCompletedWorkouts();
    expect(historyList[0].name).toBe('Push Day');
  });

  // 3 & 5 & 6. Repeating a completed workout creates a distinct session ID, independent sets, and original is unchanged
  it('3, 5, 6. Repeating a completed workout creates a distinct session ID with independent sets while original remains unchanged', async () => {
    // 1. Create original completed workout
    let session = await workoutRepository.startEmptyWorkout('Original Leg Session');
    session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_squat', name: 'Back Squat' });
    session = workoutRepository.updateSet(session, 'ex_squat', session.exercises[0].actualSets[0].id, {
      weight: 140,
      reps: 5,
      notes: 'Heavy set',
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(session);
    const originalCompleted = await workoutRepository.completeActiveWorkout(session);

    const originalId = originalCompleted.id;
    const originalFinishedAt = originalCompleted.finishedAt;
    const originalVolume = originalCompleted.totalVolume;

    // 2. Repeat workout
    const repeatedActive = await workoutRepository.startWorkoutFromCompleted(originalCompleted);

    // 3. Distinct active session ID
    expect(repeatedActive.id).not.toBe(originalId);
    expect(repeatedActive.status).toBe('active');
    expect(repeatedActive.exercises[0].actualSets[0].completed).toBe(false);
    expect(repeatedActive.exercises[0].actualSets[0].id).not.toBe(
      originalCompleted.exercises[0].actualSets[0].id,
    );

    // Mutate set in repeated active workout
    const updatedRepeatedActive = workoutRepository.updateSet(
      repeatedActive,
      'ex_squat',
      repeatedActive.exercises[0].actualSets[0].id,
      { weight: 150, reps: 5, completed: true },
    );
    await workoutRepository.updateActiveWorkout(updatedRepeatedActive);

    // 5. Verify original completed workout in storage remains untouched
    const originalInHistory = await workoutRepository.getCompletedWorkoutById(originalId);
    expect(originalInHistory).not.toBeNull();
    expect(originalInHistory!.id).toBe(originalId);
    expect(originalInHistory!.finishedAt).toBe(originalFinishedAt);
    expect(originalInHistory!.totalVolume).toBe(originalVolume);
    expect(originalInHistory!.exercises[0].actualSets[0].weight).toBe(140);
  });

  // 4 & 7. Completing repeats creates distinct completed History records and two repeats create two distinct entries
  it('4 & 7. Completing repeated workouts creates distinct completed History records, and two repeats yield two distinct entries', async () => {
    // Original completed session
    let session = await workoutRepository.startEmptyWorkout('Base Upper Body');
    session = workoutRepository.addExerciseToWorkout(session, { id: 'ex_press', name: 'Overhead Press' });
    session = workoutRepository.updateSet(session, 'ex_press', session.exercises[0].actualSets[0].id, {
      weight: 50,
      reps: 10,
      completed: true,
    });
    await workoutRepository.updateActiveWorkout(session);
    const original = await workoutRepository.completeActiveWorkout(session);

    // Repeat #1
    let repeat1Active = await workoutRepository.startWorkoutFromCompleted(original);
    repeat1Active = workoutRepository.updateSet(
      repeat1Active,
      'ex_press',
      repeat1Active.exercises[0].actualSets[0].id,
      { weight: 52.5, reps: 8, completed: true },
    );
    await workoutRepository.updateActiveWorkout(repeat1Active);
    const repeat1Completed = await workoutRepository.completeActiveWorkout(repeat1Active);

    // Repeat #2
    let repeat2Active = await workoutRepository.startWorkoutFromCompleted(original);
    repeat2Active = workoutRepository.updateSet(
      repeat2Active,
      'ex_press',
      repeat2Active.exercises[0].actualSets[0].id,
      { weight: 55, reps: 6, completed: true },
    );
    await workoutRepository.updateActiveWorkout(repeat2Active);
    const repeat2Completed = await workoutRepository.completeActiveWorkout(repeat2Active);

    // Verify all 3 completions are distinct in History
    expect(original.id).not.toBe(repeat1Completed.id);
    expect(repeat1Completed.id).not.toBe(repeat2Completed.id);
    expect(original.id).not.toBe(repeat2Completed.id);

    const history = await workoutRepository.getCompletedWorkouts();
    expect(history.length).toBe(3);

    // Original remains weight 50, Repeat 1 is 52.5, Repeat 2 is 55
    const foundOriginal = history.find((w) => w.id === original.id);
    const foundRepeat1 = history.find((w) => w.id === repeat1Completed.id);
    const foundRepeat2 = history.find((w) => w.id === repeat2Completed.id);

    expect(foundOriginal?.exercises[0].actualSets[0].weight).toBe(50);
    expect(foundRepeat1?.exercises[0].actualSets[0].weight).toBe(52.5);
    expect(foundRepeat2?.exercises[0].actualSets[0].weight).toBe(55);
  });

  // 8. Existing template creation and starting workout from template remains intact
  it('8. Existing template behavior remains intact', async () => {
    const input = {
      name: 'Chest Hypertrophy Template',
      exercises: [
        {
          exerciseId: 'ex_incline_db',
          exerciseName: 'Incline DB Press',
          categoryName: 'Chest',
          sets: 3,
          targetReps: '8-12',
          restTime: 90,
          targetWeight: 30,
        },
      ],
    };

    const template = await templateRepository.createTemplate(input);
    expect(template.id).toBeTruthy();
    expect(template.name).toBe('Chest Hypertrophy Template');

    const activeSession = await workoutRepository.startWorkoutFromTemplate(template);
    expect(activeSession.sourceTemplateId).toBe(template.id);
    expect(activeSession.exercises.length).toBe(1);
    expect(activeSession.exercises[0].actualSets.length).toBe(3);
    expect(activeSession.exercises[0].actualSets[0].weight).toBe(30);
  });
});
