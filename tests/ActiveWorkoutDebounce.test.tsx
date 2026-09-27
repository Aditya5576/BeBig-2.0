import React from 'react';
import { View, AppState } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import ActiveWorkoutScreen from '../app/workout/active';
import { WorkoutSession } from '../src/features/workout/types';

export function FakeComp() {
  return <View />;
}

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

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children, style }: any) => React.createElement(View, { style }, children),
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

jest.mock('../src/features/auth', () => {
  const actual = jest.requireActual('../src/features/auth');
  const mockState = {
    user: { id: 'test_user_debounce', email: 'athlete@bebig.app' },
    isGuest: false,
    signOut: jest.fn(),
    exitGuestMode: jest.fn(),
  };
  const useAuthStore = (selector: any) => selector(mockState);
  useAuthStore.getState = () => mockState;
  useAuthStore.setState = jest.fn();
  return {
    ...actual,
    useAuthStore,
  };
});

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

describe('BeBig 2.0 — PERF-2: Active Workout Storage Write Debouncing', () => {
  let sampleSession: WorkoutSession;
  let appStateListener: ((state: string) => void) | null = null;
  let scheduledTimerCallbacks: Array<{ id: number; delay: number; cb: () => void }> = [];
  let timerIdCounter = 1;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    await workoutStorage.clearAllWorkouts();

    scheduledTimerCallbacks = [];
    timerIdCounter = 1;
    appStateListener = null;

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: string, callback: any) => {
      if (event === 'change') {
        appStateListener = callback;
      }
      return { remove: jest.fn() } as any;
    });

    jest.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: any, delay?: number, ...args: any[]) => {
      if (delay === 300) {
        const id = timerIdCounter++;
        scheduledTimerCallbacks.push({ id, delay, cb });
        return id as any;
      }
      return originalSetTimeout(cb, delay, ...args);
    }) as typeof setTimeout);

    jest.spyOn(globalThis, 'clearTimeout').mockImplementation(((id: any) => {
      scheduledTimerCallbacks = scheduledTimerCallbacks.filter((t) => t.id !== id);
      return originalClearTimeout(id);
    }) as typeof clearTimeout);

    sampleSession = {
      id: 'active_debounce_session_1',
      ownerId: 'test_user_debounce',
      name: 'Chest & Arms Power',
      status: 'active',
      startedAt: new Date(Date.now() - 300000).toISOString(),
      exercises: [
        {
          exerciseId: 'bench_press',
          exerciseName: 'Bench Press',
          order: 0,
          plannedSets: 1,
          actualSets: [
            {
              id: 'set_1',
              setNumber: 1,
              weight: 60,
              reps: 10,
              completed: false,
            },
          ],
        },
      ],
    };

    await workoutRepository.updateActiveWorkout(sampleSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const triggerPendingDebounce = async () => {
    const pending = [...scheduledTimerCallbacks];
    scheduledTimerCallbacks = [];
    for (const item of pending) {
      await act(async () => {
        await item.cb();
      });
    }
  };

  it('A & B & C. Keystrokes update UI immediately while storage write is debounced (latest value wins)', async () => {
    const updateSpy = jest.spyOn(workoutRepository, 'updateActiveWorkout');

    const screen = await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('set-weight-bench_press-1')).toBeTruthy();
    });

    updateSpy.mockClear();

    const weightInput = screen.getByTestId('set-weight-bench_press-1');

    // Rapid typing: "6" -> "65" -> "70" -> "80" -> "100"
    await act(async () => {
      fireEvent.changeText(weightInput, '6');
    });
    expect(screen.getByTestId('set-weight-bench_press-1').props.value).toBe('6'); // A: UI updates immediately!

    await act(async () => {
      fireEvent.changeText(weightInput, '65');
    });
    expect(screen.getByTestId('set-weight-bench_press-1').props.value).toBe('65');

    await act(async () => {
      fireEvent.changeText(weightInput, '70');
    });
    expect(screen.getByTestId('set-weight-bench_press-1').props.value).toBe('70');

    await act(async () => {
      fireEvent.changeText(weightInput, '80');
    });
    expect(screen.getByTestId('set-weight-bench_press-1').props.value).toBe('80');

    await act(async () => {
      fireEvent.changeText(weightInput, '100');
    });
    expect(screen.getByTestId('set-weight-bench_press-1').props.value).toBe('100');

    // B: Storage write has NOT executed during active typing
    expect(updateSpy).not.toHaveBeenCalled();

    // Trigger trailing 300ms debounce
    await triggerPendingDebounce();

    // B & C: Storage write occurs ONCE with the latest value "100"
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const saved = updateSpy.mock.calls[0][0];
    expect(saved.exercises[0].actualSets[0].weight).toBe(100);

    screen.unmount();
  });

  it('D & G. Immediate flush on set completion cancels pending debounce', async () => {
    const updateSpy = jest.spyOn(workoutRepository, 'updateActiveWorkout');

    const screen = await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('set-weight-bench_press-1')).toBeTruthy();
    });

    updateSpy.mockClear();

    const weightInput = screen.getByTestId('set-weight-bench_press-1');
    await act(async () => {
      fireEvent.changeText(weightInput, '105');
    });

    // Storage write not called yet during typing
    expect(updateSpy).not.toHaveBeenCalled();

    // D: Toggle complete set triggers immediate flush
    const completeBtn = screen.getByTestId('complete-set-bench_press-1');
    await act(async () => {
      fireEvent.press(completeBtn);
    });

    // Immediate flush persisted 105 to storage
    expect(updateSpy).toHaveBeenCalled();
    const saved = await workoutRepository.getActiveWorkout();
    expect(saved?.exercises[0].actualSets[0].weight).toBe(105);
    expect(saved?.exercises[0].actualSets[0].completed).toBe(true);

    const callCountAfterFlush = updateSpy.mock.calls.length;

    // G: Pending debounce should be cancelled
    await triggerPendingDebounce();
    expect(updateSpy.mock.calls.length).toBe(callCountAfterFlush);

    screen.unmount();
  });

  it('F & G. Immediate flush on AppState background transition', async () => {
    const updateSpy = jest.spyOn(workoutRepository, 'updateActiveWorkout');

    const screen = await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('set-weight-bench_press-1')).toBeTruthy();
    });

    updateSpy.mockClear();

    const weightInput = screen.getByTestId('set-weight-bench_press-1');
    await act(async () => {
      fireEvent.changeText(weightInput, '110');
    });

    expect(updateSpy).not.toHaveBeenCalled();

    // F: Trigger AppState background event
    await act(async () => {
      if (appStateListener) {
        appStateListener('background');
      }
    });

    // Flushed immediately to disk
    expect(updateSpy).toHaveBeenCalled();
    const saved = await workoutRepository.getActiveWorkout();
    expect(saved?.exercises[0].actualSets[0].weight).toBe(110);

    screen.unmount();
  });

  it('H. Workout recovery: debounced value persists after restart', async () => {
    const screen = await render(<ActiveWorkoutScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('set-weight-bench_press-1')).toBeTruthy();
    });

    const weightInput = screen.getByTestId('set-weight-bench_press-1');
    await act(async () => {
      fireEvent.changeText(weightInput, '120');
    });

    // Trigger debounced save
    await triggerPendingDebounce();

    screen.unmount();

    // Simulate app restart / reopen: verify 120 recovered from storage
    const recovered = await workoutRepository.getActiveWorkout();
    expect(recovered).not.toBeNull();
    expect(recovered!.exercises[0].actualSets[0].weight).toBe(120);
  });
});
