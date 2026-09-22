import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WorkoutHistoryDetailScreen from '../app/workout/history/[id]';
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

describe('BeBig 2.0 — Issue #4: Save Any Completed Workout from History as Template', () => {
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

  // 1 & 13. Historical workout renders correctly in History Detail
  it('1 & 13. Completed historical workout opens and renders details cleanly in WorkoutHistoryDetailScreen', async () => {
    const historicalWorkout: WorkoutSession = {
      id: 'hist_workout_101',
      name: 'Old School Push Day',
      startedAt: '2026-08-15T10:00:00.000Z',
      finishedAt: '2026-08-15T11:00:00.000Z',
      status: 'completed',
      totalDuration: 3600,
      totalVolume: 4500,
      completedSetsCount: 3,
      exercises: [
        {
          exerciseId: 'bench_1',
          exerciseName: 'Flat Bench Press',
          order: 0,
          actualSets: [{ id: 's1', setNumber: 1, weight: 90, reps: 8, rir: 2, completed: true }],
        },
      ],
    };
    await workoutStorage.saveCompletedWorkout(historicalWorkout);
    mockParams = { id: 'hist_workout_101' };

    const { findByTestId, findByText } = await render(<WorkoutHistoryDetailScreen />);

    expect(await findByTestId('history-detail-name')).toBeTruthy();
    expect(await findByText('Old School Push Day')).toBeTruthy();
    expect(await findByTestId('history-detail-duration')).toBeTruthy();
    expect(await findByText('60 min')).toBeTruthy();
    expect(await findByTestId('history-exercise-bench_1')).toBeTruthy();
  });

  // 2, 3, 4, 5, 6, 7, 10, 11: History Detail Save as Template Flow & Immutability
  it('2-7, 10, 11. Historical workout converts cleanly, strips completion data, saves template, and leaves historical workout intact', async () => {
    const historicalWorkout: WorkoutSession = {
      id: 'hist_workout_102',
      name: 'Summer Heavy Pull',
      startedAt: '2026-07-20T09:00:00.000Z',
      finishedAt: '2026-07-20T10:15:00.000Z',
      status: 'completed',
      totalDuration: 4500,
      totalVolume: 6200,
      completedSetsCount: 4,
      exercises: [
        {
          exerciseId: 'row_1',
          exerciseName: 'Barbell Row',
          categoryName: 'Back',
          order: 0,
          actualSets: [
            { id: 's1', setNumber: 1, weight: 70, reps: 10, rir: 2, notes: 'Strict form', completed: true, completedAt: '2026-07-20' },
            { id: 's2', setNumber: 2, weight: 75, reps: 8, rir: 1, notes: 'Heavy set', completed: true, completedAt: '2026-07-20' },
          ],
        },
      ],
    };
    await workoutStorage.saveCompletedWorkout(historicalWorkout);
    mockParams = { id: 'hist_workout_102' };

    const { getByTestId, findByTestId, findByText } = await render(<WorkoutHistoryDetailScreen />);

    // 2. Action button visible
    const saveBtn = await findByTestId('history-save-template-button');
    expect(saveBtn).toBeTruthy();

    // 3. Tap opens modal
    fireEvent.press(saveBtn);
    const modal = await findByTestId('template-save-modal');
    expect(modal).toBeTruthy();

    // 4. Edit name
    const input = getByTestId('input-template-name');
    expect(input.props.value).toBe('Summer Heavy Pull');
    fireEvent.changeText(input, 'Saved Pull Template');

    // 5. Save Template
    const confirmBtn = await findByTestId('confirm-save-template-button');
    fireEvent.press(confirmBtn);

    // 6. Success banner shown
    expect(await findByTestId('save-template-success')).toBeTruthy();
    expect(await findByText('✓ Saved to My Templates!')).toBeTruthy();

    // 7. Verify template created in templateRepository
    const templates = await templateRepository.getTemplates();
    expect(templates.length).toBe(1);
    expect(templates[0].name).toBe('Saved Pull Template');
    expect(templates[0].ownerId).toBe('usr_test_auth_user');
    expect(templates[0].ownerType).toBe('authenticated');
    expect(templates[0].exercises[0].exerciseName).toBe('Barbell Row');
    expect(templates[0].exercises[0].sets).toBe(2);
    expect(templates[0].exercises[0].targetReps).toBe('8-10');
    expect(templates[0].exercises[0].targetWeight).toBe(75);

    // Completion-only data stripped
    const ex = templates[0].exercises[0] as any;
    expect(ex.rir).toBeUndefined();
    expect(ex.notes).toBeUndefined();
    expect(ex.completedAt).toBeUndefined();

    // 11. Historical workout session in storage remains untouched
    const originalInStorage = await workoutRepository.getCompletedWorkoutById('hist_workout_102');
    expect(originalInStorage).not.toBeNull();
    expect(originalInStorage?.name).toBe('Summer Heavy Pull');
    expect(originalInStorage?.exercises[0].actualSets[0].notes).toBe('Strict form');
  });

  // 8. Guest user scope persistence from History
  it('8. Guest user can save historical workout to local templates without cloud sync requirement', async () => {
    mockAuthState = {
      status: 'guest',
      user: null as any,
      guestSession: { id: 'guest_session_999', createdAt: '2026-09-22', lastActiveAt: '2026-09-22' },
      isGuest: true,
    };

    const historicalWorkout: WorkoutSession = {
      id: 'guest_hist_1',
      name: 'Guest Arm Session',
      startedAt: '2026-09-10T10:00:00.000Z',
      finishedAt: '2026-09-10T10:30:00.000Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'curl_1',
          exerciseName: 'Dumbbell Curl',
          order: 0,
          actualSets: [{ id: 's1', setNumber: 1, weight: 14, reps: 10, completed: true }],
        },
      ],
    };
    await workoutStorage.saveCompletedWorkout(historicalWorkout);
    mockParams = { id: 'guest_hist_1' };

    const { findByTestId } = await render(<WorkoutHistoryDetailScreen />);
    const saveBtn = await findByTestId('history-save-template-button');
    fireEvent.press(saveBtn);

    const confirmBtn = await findByTestId('confirm-save-template-button');
    fireEvent.press(confirmBtn);

    await waitFor(async () => {
      const templates = await templateRepository.getTemplates();
      expect(templates.length).toBe(1);
      expect(templates[0].name).toBe('Guest Arm Session');
      expect(templates[0].ownerType).toBe('guest');
    });
  });

  // 9 & 12. Save failure does not modify or delete historical workout
  it('9 & 12. Save failure displays error and leaves historical workout intact in storage', async () => {
    const historicalWorkout: WorkoutSession = {
      id: 'error_hist_workout',
      name: 'Fail Test Workout',
      startedAt: '2026-09-01T10:00:00.000Z',
      finishedAt: '2026-09-01T10:30:00.000Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex_squat',
          exerciseName: 'Goblet Squat',
          order: 0,
          actualSets: [{ id: 's1', setNumber: 1, weight: 24, reps: 15, completed: true }],
        },
      ],
    };
    await workoutStorage.saveCompletedWorkout(historicalWorkout);
    mockParams = { id: 'error_hist_workout' };

    jest.spyOn(templateRepository, 'createTemplate').mockRejectedValueOnce(new Error('Repository write error'));

    const { findByTestId, findByText } = await render(<WorkoutHistoryDetailScreen />);

    const saveBtn = await findByTestId('history-save-template-button');
    fireEvent.press(saveBtn);

    const confirmBtn = await findByTestId('confirm-save-template-button');
    fireEvent.press(confirmBtn);

    expect(await findByTestId('save-template-error')).toBeTruthy();
    expect(await findByText('⚠ Repository write error')).toBeTruthy();

    const stored = await workoutRepository.getCompletedWorkoutById('error_hist_workout');
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe('Fail Test Workout');
  });

  // 14. Issue #3 Summary -> Save as Template still works without regression
  it('14. Issue #3 WorkoutSummaryScreen Save as Template continues to work seamlessly', async () => {
    const summaryWorkout: WorkoutSession = {
      id: 'summary_regression_workout',
      name: 'Freshly Finished Workout',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'completed',
      totalDuration: 1500,
      totalVolume: 2500,
      completedSetsCount: 3,
      exercises: [
        {
          exerciseId: 'ex_fly',
          exerciseName: 'Chest Fly',
          order: 0,
          actualSets: [{ id: 's1', setNumber: 1, weight: 15, reps: 12, completed: true }],
        },
      ],
    };
    await workoutStorage.saveCompletedWorkout(summaryWorkout);
    mockParams = { id: 'summary_regression_workout' };

    const { findByTestId } = await render(<WorkoutSummaryScreen />);

    const saveBtn = await findByTestId('save-as-template-button');
    fireEvent.press(saveBtn);

    const confirmBtn = await findByTestId('confirm-save-template-button');
    fireEvent.press(confirmBtn);

    await waitFor(async () => {
      const templates = await templateRepository.getTemplates();
      expect(templates.length).toBe(1);
      expect(templates[0].name).toBe('Freshly Finished Workout');
    });
  });
});
