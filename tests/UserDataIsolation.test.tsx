import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { workoutRepository, workoutStorage } from '../src/features/workout';
import { templateRepository, templateStorage } from '../src/features/templates';
import { exerciseRepository, customExerciseStorage } from '../src/features/exercises';
import { useAuthStore } from '../src/features/auth';
import { guestStorage } from '../src/lib/storage';
import HomeScreen from '../app/home';

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

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `bebig://${path}`),
  getInitialURL: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithIdToken: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    from: jest.fn(),
  },
  isSupabaseConfigured: jest.fn(() => true),
}));

// Mock onboarding store for HomeScreen
jest.mock('../src/features/onboarding', () => ({
  useOnboardingStore: (selector: any) =>
    selector({
      goal: 'build_muscle',
      experienceLevel: 'intermediate',
      daysPerWeek: 4,
      workoutDuration: '60_min',
      trainingLocation: 'gym',
      equipment: 'full_gym',
      preferredTrainingDays: ['monday', 'wednesday', 'friday'],
      workoutStyle: 'push_pull_legs',
      resetOnboarding: jest.fn(),
    }),
}));

const loginUser = (userId: string, email = `${userId}@bebig.app`) => {
  useAuthStore.setState({
    status: 'authenticated',
    isGuest: false,
    user: { id: userId, email },
    session: {
      user: { id: userId, email },
      accessToken: `token_${userId}`,
    },
    guestSession: null,
    error: null,
  });
};

const loginGuest = (guestId: string) => {
  const now = new Date().toISOString();
  useAuthStore.setState({
    status: 'guest',
    isGuest: true,
    guestSession: { id: guestId, createdAt: now, lastActiveAt: now },
    user: null,
    session: null,
    error: null,
  });
};

const logoutUser = async () => {
  await useAuthStore.getState().signOut();
};

describe('BeBig 2.0 — Cross-User Data Isolation & Storage Scoping', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    workoutStorage.clearMemoryCache();
    templateStorage.clearMemoryCache();
    customExerciseStorage.clearMemoryCache();
    await guestStorage.wipeAllGuestData();
  });

  // TEST 1: User A creates workout → User B history is empty.
  it('TEST 1: User A creates workout -> User B history is empty', async () => {
    loginUser('user_A');
    const sessionA = await workoutRepository.startEmptyWorkout('User A First Workout');
    const withExA = workoutRepository.addExerciseToWorkout(sessionA, {
      id: 'ex_bench',
      name: 'Bench Press',
    });
    const withSetA = workoutRepository.updateSet(
      withExA,
      'ex_bench',
      withExA.exercises[0].actualSets[0].id,
      { weight: 80, reps: 10, completed: true },
    );
    await workoutRepository.completeActiveWorkout(withSetA);

    const historyA = await workoutRepository.getCompletedWorkouts();
    expect(historyA).toHaveLength(1);
    expect(historyA[0].name).toBe('User A First Workout');

    // Switch to User B
    loginUser('user_B');
    const historyB = await workoutRepository.getCompletedWorkouts();
    expect(historyB).toHaveLength(0);
  });

  // TEST 2: User A creates two workouts → User B cannot see either.
  it('TEST 2: User A creates two workouts -> User B cannot see either', async () => {
    loginUser('user_A');
    // Workout 1
    let w1 = await workoutRepository.startEmptyWorkout('User A Workout 1');
    w1 = workoutRepository.addExerciseToWorkout(w1, { id: 'e1', name: 'Curl' });
    w1 = workoutRepository.updateSet(w1, 'e1', w1.exercises[0].actualSets[0].id, {
      weight: 15,
      reps: 12,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(w1);

    // Workout 2
    let w2 = await workoutRepository.startEmptyWorkout('User A Workout 2');
    w2 = workoutRepository.addExerciseToWorkout(w2, { id: 'e2', name: 'Squat' });
    w2 = workoutRepository.updateSet(w2, 'e2', w2.exercises[0].actualSets[0].id, {
      weight: 100,
      reps: 5,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(w2);

    const historyA = await workoutRepository.getCompletedWorkouts();
    expect(historyA).toHaveLength(2);

    // Switch to User B
    loginUser('user_B');
    const historyB = await workoutRepository.getCompletedWorkouts();
    expect(historyB).toHaveLength(0);
    expect(await workoutStorage.getCompletedWorkouts()).toHaveLength(0);
  });

  // TEST 3: User B creates workout → User A still only sees User A's workouts.
  it("TEST 3: User B creates workout -> User A still only sees User A's workouts", async () => {
    // User A creates 2 workouts
    loginUser('user_A');
    let wA1 = await workoutRepository.startEmptyWorkout('User A Workout 1');
    wA1 = workoutRepository.addExerciseToWorkout(wA1, { id: 'e1', name: 'Exercise 1' });
    wA1 = workoutRepository.updateSet(wA1, 'e1', wA1.exercises[0].actualSets[0].id, {
      weight: 50,
      reps: 10,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(wA1);

    // User B creates 1 workout
    loginUser('user_B');
    let wB1 = await workoutRepository.startEmptyWorkout('User B Workout 1');
    wB1 = workoutRepository.addExerciseToWorkout(wB1, { id: 'e2', name: 'Exercise 2' });
    wB1 = workoutRepository.updateSet(wB1, 'e2', wB1.exercises[0].actualSets[0].id, {
      weight: 60,
      reps: 8,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(wB1);

    const historyB = await workoutRepository.getCompletedWorkouts();
    expect(historyB).toHaveLength(1);
    expect(historyB[0].name).toBe('User B Workout 1');

    // Switch back to User A
    loginUser('user_A');
    const historyA = await workoutRepository.getCompletedWorkouts();
    expect(historyA).toHaveLength(1);
    expect(historyA[0].name).toBe('User A Workout 1');
    expect(historyA.some((w) => w.name === 'User B Workout 1')).toBe(false);
  });

  // TEST 4: User A active workout → User B does not see Resume Workout.
  it('TEST 4: User A active workout -> User B does not see Resume Workout', async () => {
    loginUser('user_A');
    await workoutRepository.startEmptyWorkout('User A In-Progress Session');

    const activeA = await workoutRepository.getActiveWorkout();
    expect(activeA).not.toBeNull();
    expect(activeA?.name).toBe('User A In-Progress Session');

    // Switch to User B
    loginUser('user_B');
    const activeB = await workoutRepository.getActiveWorkout();
    expect(activeB).toBeNull();

    // Render HomeScreen for User B: banner must NOT be visible
    const { queryByTestId } = await render(<HomeScreen />);
    await waitFor(() => {
      expect(queryByTestId('home-active-workout-banner')).toBeNull();
      expect(queryByTestId('home-resume-workout-button')).toBeNull();
    });
  });

  // TEST 5: User A logout → User B login → no User A data remains in memory.
  it('TEST 5: User A logout -> User B login -> no User A data remains in memory', async () => {
    loginUser('user_A');
    let w = await workoutRepository.startEmptyWorkout('User A Memory Test');
    w = workoutRepository.addExerciseToWorkout(w, { id: 'e1', name: 'Ex 1' });
    w = workoutRepository.updateSet(w, 'e1', w.exercises[0].actualSets[0].id, {
      weight: 40,
      reps: 10,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(w);
    await workoutRepository.startEmptyWorkout('User A Leftover Draft');

    // User A logs out
    await logoutUser();
    expect(useAuthStore.getState().status).toBe('unauthenticated');

    // User B logs in
    loginUser('user_B');
    expect(await workoutRepository.getActiveWorkout()).toBeNull();
    expect(await workoutRepository.getCompletedWorkouts()).toHaveLength(0);
  });

  // TEST 6: Guest session A → guest session B → no shared workouts.
  it('TEST 6: Guest session A -> guest session B -> no shared workouts', async () => {
    loginGuest('guest_sess_alpha');
    let gA = await workoutRepository.startEmptyWorkout('Guest Alpha Workout');
    gA = workoutRepository.addExerciseToWorkout(gA, { id: 'e1', name: 'Pushup' });
    gA = workoutRepository.updateSet(gA, 'e1', gA.exercises[0].actualSets[0].id, {
      weight: 0,
      reps: 20,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(gA);

    const historyA = await workoutRepository.getCompletedWorkouts();
    expect(historyA).toHaveLength(1);
    expect(historyA[0].name).toBe('Guest Alpha Workout');

    // Switch to another guest session
    loginGuest('guest_sess_beta');
    const historyB = await workoutRepository.getCompletedWorkouts();
    expect(historyB).toHaveLength(0);
    expect(await workoutRepository.getActiveWorkout()).toBeNull();
  });

  // TEST 7: Guest → authenticated user → no guest workout leakage.
  it('TEST 7: Guest -> authenticated user -> no guest workout leakage', async () => {
    loginGuest('guest_temporary');
    let g = await workoutRepository.startEmptyWorkout('Guest Secret Workout');
    g = workoutRepository.addExerciseToWorkout(g, { id: 'e1', name: 'Dips' });
    g = workoutRepository.updateSet(g, 'e1', g.exercises[0].actualSets[0].id, {
      weight: 0,
      reps: 15,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(g);

    // Authenticated user logs in
    loginUser('auth_user_clean');
    const history = await workoutRepository.getCompletedWorkouts();
    expect(history).toHaveLength(0);
    expect(await workoutRepository.getActiveWorkout()).toBeNull();
  });

  // TEST 8: Authenticated user → Guest → no authenticated workout leakage.
  it('TEST 8: Authenticated user -> Guest -> no authenticated workout leakage', async () => {
    loginUser('auth_user_pro');
    let a = await workoutRepository.startEmptyWorkout('Pro Athlete Workout');
    a = workoutRepository.addExerciseToWorkout(a, { id: 'e1', name: 'Deadlift' });
    a = workoutRepository.updateSet(a, 'e1', a.exercises[0].actualSets[0].id, {
      weight: 200,
      reps: 3,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(a);

    // Enter guest mode
    loginGuest('guest_isolated_new');
    const guestHistory = await workoutRepository.getCompletedWorkouts();
    expect(guestHistory).toHaveLength(0);
    expect(await workoutRepository.getActiveWorkout()).toBeNull();
  });

  // TEST 9: Templates are isolated between authenticated users if currently private.
  it('TEST 9: Templates are isolated between authenticated users', async () => {
    loginUser('user_A');
    await templateRepository.createTemplate({
      name: 'User A Heavy Push',
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          sets: 4,
          targetReps: '6-8',
          restTime: 120,
        },
      ],
    });

    const templatesA = await templateRepository.getTemplates();
    expect(templatesA).toHaveLength(1);
    expect(templatesA[0].name).toBe('User A Heavy Push');

    // Switch to User B
    loginUser('user_B');
    const templatesB = await templateRepository.getTemplates();
    expect(templatesB).toHaveLength(0);

    // User B creates their own template
    await templateRepository.createTemplate({
      name: 'User B Arm Blast',
      exercises: [
        {
          exerciseId: 'curl',
          exerciseName: 'Bicep Curl',
          sets: 3,
          targetReps: '10-12',
          restTime: 60,
        },
      ],
    });

    const templatesBUpdated = await templateRepository.getTemplates();
    expect(templatesBUpdated).toHaveLength(1);
    expect(templatesBUpdated[0].name).toBe('User B Arm Blast');

    // Switch back to User A
    loginUser('user_A');
    const templatesAReloaded = await templateRepository.getTemplates();
    expect(templatesAReloaded).toHaveLength(1);
    expect(templatesAReloaded[0].name).toBe('User A Heavy Push');
  });

  // TEST 10: Custom exercises are isolated between authenticated users if currently private.
  it('TEST 10: Custom exercises are isolated between authenticated users', async () => {
    loginUser('user_A');
    await exerciseRepository.createCustomExercise({
      name: 'User A Secret Squat',
      category: 'legs',
      primaryMuscles: ['Quadriceps'],
    });

    const customA = await customExerciseStorage.getCustomExercises();
    expect(customA).toHaveLength(1);
    expect(customA[0].name).toBe('User A Secret Squat');

    // Switch to User B
    loginUser('user_B');
    const customB = await customExerciseStorage.getCustomExercises();
    expect(customB).toHaveLength(0);

    // User B creates a custom exercise
    await exerciseRepository.createCustomExercise({
      name: 'User B Overhead Extension',
      category: 'arms',
      primaryMuscles: ['Triceps'],
    });

    const customBUpdated = await customExerciseStorage.getCustomExercises();
    expect(customBUpdated).toHaveLength(1);
    expect(customBUpdated[0].name).toBe('User B Overhead Extension');

    // Switch back to User A
    loginUser('user_A');
    const customAReloaded = await customExerciseStorage.getCustomExercises();
    expect(customAReloaded).toHaveLength(1);
    expect(customAReloaded[0].name).toBe('User A Secret Squat');
  });

  // TEST 11: App restart preserves the correct user's data.
  it("TEST 11: App restart preserves the correct user's data", async () => {
    loginUser('user_persistent');
    let session = await workoutRepository.startEmptyWorkout('Saved Across Restart');
    session = workoutRepository.addExerciseToWorkout(session, {
      id: 'ex_restart',
      name: 'Restart Exercise',
    });
    session = workoutRepository.updateSet(
      session,
      'ex_restart',
      session.exercises[0].actualSets[0].id,
      { weight: 75, reps: 10, completed: true },
    );
    await workoutRepository.completeActiveWorkout(session);

    // Start active draft
    await workoutRepository.startEmptyWorkout('Active Restart Draft');

    // Clear in-memory caches to simulate app termination / cold restart
    workoutStorage.clearMemoryCache();

    // Re-verify after restart simulation with same user credentials
    loginUser('user_persistent');
    const history = await workoutRepository.getCompletedWorkouts();
    expect(history).toHaveLength(1);
    expect(history[0].name).toBe('Saved Across Restart');

    const active = await workoutRepository.getActiveWorkout();
    expect(active).not.toBeNull();
    expect(active?.name).toBe('Active Restart Draft');
  });

  // TEST 12: User switching preserves each user's separate data.
  it("TEST 12: User switching preserves each user's separate data across cycles", async () => {
    // User 1 setup
    loginUser('user_cycle_1');
    let w1 = await workoutRepository.startEmptyWorkout('Workout C1');
    w1 = workoutRepository.addExerciseToWorkout(w1, { id: 'c1', name: 'C1' });
    w1 = workoutRepository.updateSet(w1, 'c1', w1.exercises[0].actualSets[0].id, {
      weight: 10,
      reps: 10,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(w1);

    // User 2 setup
    loginUser('user_cycle_2');
    let w2 = await workoutRepository.startEmptyWorkout('Workout C2');
    w2 = workoutRepository.addExerciseToWorkout(w2, { id: 'c2', name: 'C2' });
    w2 = workoutRepository.updateSet(w2, 'c2', w2.exercises[0].actualSets[0].id, {
      weight: 20,
      reps: 20,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(w2);

    // Guest setup
    loginGuest('guest_cycle_3');
    let w3 = await workoutRepository.startEmptyWorkout('Workout G3');
    w3 = workoutRepository.addExerciseToWorkout(w3, { id: 'g3', name: 'G3' });
    w3 = workoutRepository.updateSet(w3, 'g3', w3.exercises[0].actualSets[0].id, {
      weight: 30,
      reps: 30,
      completed: true,
    });
    await workoutRepository.completeActiveWorkout(w3);

    // Cycle check: User 1
    loginUser('user_cycle_1');
    let h1 = await workoutRepository.getCompletedWorkouts();
    expect(h1).toHaveLength(1);
    expect(h1[0].name).toBe('Workout C1');

    // Cycle check: User 2
    loginUser('user_cycle_2');
    let h2 = await workoutRepository.getCompletedWorkouts();
    expect(h2).toHaveLength(1);
    expect(h2[0].name).toBe('Workout C2');

    // Cycle check: Guest
    loginGuest('guest_cycle_3');
    let h3 = await workoutRepository.getCompletedWorkouts();
    expect(h3).toHaveLength(1);
    expect(h3[0].name).toBe('Workout G3');
  });
});
