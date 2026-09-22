import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WorkoutSummaryScreen, { convertWorkoutToTemplateInput } from '../app/workout/summary';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { templateRepository } from '../src/features/templates/services/templateRepository';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { WorkoutSession } from '../src/features/workout/types';

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
      callback();
    }, [callback]);
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

const mockUser = {
  id: 'usr_test_auth_user',
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

describe('BeBig 2.0 — Issue #3: Save Completed Quick Workout as Template', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockSecureStore.clear();
    mockParams = {};
    mockAuthState = {
      status: 'authenticated',
      user: mockUser as any,
      guestSession: null as any,
      isGuest: false,
    };
    await workoutStorage.clearAllWorkouts();
    await templateStorage.clearTemplates();
  });

  // 1 & 2 & 3: Conversion logic preserves exercises, sets, reps, rest, weight
  it('1-3. convertWorkoutToTemplateInput correctly extracts exercises, set count, target reps, rest, and weight', () => {
    const workout: WorkoutSession = {
      id: 'quick_w1',
      name: 'Quick Workout',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_bench',
          exerciseName: 'Barbell Bench Press',
          categoryName: 'Chest',
          order: 0,
          actualSets: [
            { id: 's1', setNumber: 1, weight: 80, reps: 10, rir: 2, completed: true, completedAt: '2026-09-21' },
            { id: 's2', setNumber: 2, weight: 85, reps: 8, rir: 1, completed: true, completedAt: '2026-09-21' },
          ],
        },
      ],
    };

    const input = convertWorkoutToTemplateInput(workout, 'My Bench Routine');

    expect(input.name).toBe('My Bench Routine');
    expect(input.exercises.length).toBe(1);
    expect(input.exercises[0]).toEqual({
      exerciseId: 'ex_bench',
      exerciseName: 'Barbell Bench Press',
      categoryName: 'Chest',
      sets: 2,
      targetReps: '8-10',
      restTime: 90,
      targetWeight: 85,
    });
  });

  // 4. Completion-only data is not copied to template
  it('4. Completion-only data (rir, notes, completed timestamps, session metadata) is stripped from template input', () => {
    const workout: WorkoutSession = {
      id: 'quick_w2',
      name: 'Quick Session',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'completed',
      totalVolume: 5000,
      totalDuration: 2400,
      exercises: [
        {
          exerciseId: 'ex_squat',
          exerciseName: 'Back Squat',
          order: 0,
          actualSets: [
            { id: 's1', setNumber: 1, weight: 100, reps: 5, rir: 0, notes: 'Heavy single', completed: true, completedAt: '2026-09-21' },
          ],
        },
      ],
    };

    const input = convertWorkoutToTemplateInput(workout);
    const ex = input.exercises[0] as any;

    expect(ex.rir).toBeUndefined();
    expect(ex.notes).toBeUndefined();
    expect(ex.completed).toBeUndefined();
    expect(ex.completedAt).toBeUndefined();
    expect((input as any).totalVolume).toBeUndefined();
    expect((input as any).totalDuration).toBeUndefined();
  });

  // 5 & 6: UI user flow - provide/edit template name & save to My Templates
  it('5-6. WorkoutSummaryScreen allows user to open modal, edit name, and save template to templateRepository', async () => {
    const completedWorkout: WorkoutSession = {
      id: 'summary_quick_1',
      name: 'Quick Workout',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'completed',
      totalDuration: 1200,
      totalVolume: 3000,
      completedSetsCount: 3,
      exercises: [
        {
          exerciseId: 'ex_press',
          exerciseName: 'Overhead Press',
          order: 0,
          actualSets: [
            { id: 's1', setNumber: 1, weight: 50, reps: 10, completed: true },
            { id: 's2', setNumber: 2, weight: 50, reps: 10, completed: true },
            { id: 's3', setNumber: 3, weight: 50, reps: 10, completed: true },
          ],
        },
      ],
    };
    await workoutStorage.saveCompletedWorkout(completedWorkout);
    mockParams = { id: 'summary_quick_1' };

    const { getByTestId, findByTestId, findByText } = await render(<WorkoutSummaryScreen />);

    // 1. Save as Template button present
    const saveBtn = await findByTestId('save-as-template-button');
    expect(saveBtn).toBeTruthy();

    // 2. Click Save as Template -> modal opens
    fireEvent.press(saveBtn);

    const nameInput = await findByTestId('input-template-name');
    expect(nameInput.props.value).toBe('Quick Workout');

    // 3. Edit template name
    fireEvent.changeText(nameInput, 'Custom Shoulder Blast');

    // 4. Click Save Template
    const confirmBtn = await findByTestId('confirm-save-template-button');
    fireEvent.press(confirmBtn);

    // 5. Success banner shown
    expect(await findByTestId('save-template-success')).toBeTruthy();
    expect(await findByText('✓ Saved to My Templates!')).toBeTruthy();

    // 6. Verify template is saved in templateRepository
    const templates = await templateRepository.getTemplates();
    expect(templates.length).toBe(1);
    expect(templates[0].name).toBe('Custom Shoulder Blast');
    expect(templates[0].exercises.length).toBe(1);
    expect(templates[0].exercises[0].exerciseName).toBe('Overhead Press');
    expect(templates[0].exercises[0].sets).toBe(3);
    expect(templates[0].exercises[0].targetReps).toBe('10');
  });

  // 7. Authenticated user scope persistence
  it('7. Authenticated template save attaches user ownerId and ownerType', async () => {
    const completedWorkout: WorkoutSession = {
      id: 'auth_summary_1',
      name: 'Leg Day',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_lunge',
          exerciseName: 'Walking Lunge',
          order: 0,
          actualSets: [{ id: 's1', setNumber: 1, weight: 20, reps: 12, completed: true }],
        },
      ],
    };
    await workoutStorage.saveCompletedWorkout(completedWorkout);
    mockParams = { id: 'auth_summary_1' };

    const { findByTestId } = await render(<WorkoutSummaryScreen />);
    const saveBtn = await findByTestId('save-as-template-button');
    fireEvent.press(saveBtn);

    const confirmBtn = await findByTestId('confirm-save-template-button');
    fireEvent.press(confirmBtn);

    await waitFor(async () => {
      const templates = await templateRepository.getTemplates();
      expect(templates.length).toBe(1);
      expect(templates[0].ownerId).toBe('usr_test_auth_user');
      expect(templates[0].ownerType).toBe('authenticated');
    });
  });

  // 8. Guest user scope persistence
  it('8. Guest user save persists template locally under guest scope', async () => {
    mockAuthState = {
      status: 'guest',
      user: null as any,
      guestSession: { id: 'guest_session_123', createdAt: '2026-09-21', lastActiveAt: '2026-09-21' },
      isGuest: true,
    };

    const completedWorkout: WorkoutSession = {
      id: 'guest_summary_1',
      name: 'Guest Quick Push',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_pushup',
          exerciseName: 'Push-Up',
          order: 0,
          actualSets: [{ id: 's1', setNumber: 1, weight: 0, reps: 20, completed: true }],
        },
      ],
    };
    await workoutStorage.saveCompletedWorkout(completedWorkout);
    mockParams = { id: 'guest_summary_1' };

    const { findByTestId } = await render(<WorkoutSummaryScreen />);
    const saveBtn = await findByTestId('save-as-template-button');
    fireEvent.press(saveBtn);

    const confirmBtn = await findByTestId('confirm-save-template-button');
    fireEvent.press(confirmBtn);

    await waitFor(async () => {
      const templates = await templateRepository.getTemplates();
      expect(templates.length).toBe(1);
      expect(templates[0].name).toBe('Guest Quick Push');
      expect(templates[0].ownerType).toBe('guest');
    });
  });

  // 9. Save failure does not delete or modify completed workout
  it('9. Template save error does not delete or alter the completed workout session', async () => {
    const completedWorkout: WorkoutSession = {
      id: 'error_test_workout',
      name: 'Arm Workout',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'completed',
      totalVolume: 1200,
      exercises: [
        {
          exerciseId: 'ex_curl',
          exerciseName: 'Bicep Curl',
          order: 0,
          actualSets: [{ id: 's1', setNumber: 1, weight: 15, reps: 10, completed: true }],
        },
      ],
    };
    await workoutStorage.saveCompletedWorkout(completedWorkout);
    mockParams = { id: 'error_test_workout' };

    jest.spyOn(templateRepository, 'createTemplate').mockRejectedValueOnce(new Error('Storage error'));

    const { findByTestId, findByText } = await render(<WorkoutSummaryScreen />);
    const saveBtn = await findByTestId('save-as-template-button');
    fireEvent.press(saveBtn);

    const confirmBtn = await findByTestId('confirm-save-template-button');
    fireEvent.press(confirmBtn);

    // Error banner shown
    expect(await findByTestId('save-template-error')).toBeTruthy();
    expect(await findByText('⚠ Storage error')).toBeTruthy();

    // Verify completed workout is still safely intact in storage
    const stored = await workoutRepository.getCompletedWorkoutById('error_test_workout');
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe('Arm Workout');
  });

  // 10. Duplicate save creates distinct templates without error
  it('10. Saving the same completed workout twice creates distinct templates', async () => {
    const completedWorkout: WorkoutSession = {
      id: 'dup_test_workout',
      name: 'Core Session',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_plank',
          exerciseName: 'Plank',
          order: 0,
          actualSets: [{ id: 's1', setNumber: 1, weight: 0, reps: 60, completed: true }],
        },
      ],
    };

    const input1 = convertWorkoutToTemplateInput(completedWorkout, 'Core Session');
    const input2 = convertWorkoutToTemplateInput(completedWorkout, 'Core Session');

    const t1 = await templateRepository.createTemplate(input1);
    const t2 = await templateRepository.createTemplate(input2);

    expect(t1.id).not.toBe(t2.id);
    const all = await templateRepository.getTemplates();
    expect(all.length).toBe(2);
  });

  // 11 & 12. Standard template creation and workout completion remain functional
  it('11-12. Standard template creation and workout completion operate unchanged', async () => {
    // Standard template creation
    const standard = await templateRepository.createTemplate({
      name: 'Standard Upper',
      exercises: [
        {
          exerciseId: 'ex_dip',
          exerciseName: 'Tricep Dips',
          sets: 3,
          targetReps: '12',
          restTime: 60,
        },
      ],
    });
    expect(standard.id).toBeTruthy();

    // Standard workout completion with at least 1 completed set
    const active = await workoutRepository.startEmptyWorkout('Quick Active Test');
    const withEx = workoutRepository.addExerciseToWorkout(active, { id: 'ex_1', name: 'Exercise 1' });
    const updated = workoutRepository.updateSet(withEx, 'ex_1', withEx.exercises[0].actualSets[0].id, {
      completed: true,
      reps: 10,
      weight: 50,
    });

    const finished = await workoutRepository.completeActiveWorkout(updated);
    expect(finished.status).toBe('completed');
  });
});
