/**
 * BeBig 2.0 — Unified Custom Exercise Creation UI Regression Test Suite
 *
 * Verifies that:
 * 1. Exercise Library → `+ New` and Ongoing Workout → `+ New` use the exact same canonical form.
 * 2. All canonical fields (Name, Photo, Category, Equipment, Primary Muscles, Secondary Muscles, Instructions) are present in both entry points.
 * 3. Validation rules ('Please enter an exercise name.') and duplicate handling are identical.
 * 4. Custom exercise photo upload, preview, replacement, and removal are supported in both entry points.
 * 5. Ongoing Workout state (existing exercises, completed sets, reps, notes) is preserved without resetting or losing data.
 * 6. Newly created exercise is immediately added to the ongoing workout.
 */

import React from 'react';
import { render, fireEvent, waitFor, screen, act, cleanup } from '@testing-library/react-native';
import CreateCustomExerciseScreen from '../app/exercises/new';
import { ExercisePickerModal } from '../src/features/templates/components/ExercisePickerModal';
import ActiveWorkoutScreen from '../app/workout/active';
import { exerciseRepository } from '../src/features/exercises/services/exerciseRepository';
import { customExerciseStorage } from '../src/features/exercises/storage/customExerciseStorage';
import { workoutRepository } from '../src/features/workout/services/workoutRepository';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../src/features/auth';
import { UserScope } from '../src/features/auth/utils/userScope';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: any) => {
    require('react').useEffect(cb, []);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

const mockUpload = jest.fn();
const mockDownload = jest.fn();
const mockRemove = jest.fn();
const mockCreateSignedUrl = jest.fn();

jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    isSupabaseConfigured: jest.fn(() => true),
    supabase: {
      storage: {
        from: () => ({
          upload: mockUpload,
          download: mockDownload,
          remove: mockRemove,
          createSignedUrl: mockCreateSignedUrl,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    },
  };
});

describe('Unified Custom Exercise Creation UI', () => {
  const testUser: UserScope = {
    ownerId: 'unified_test_user',
    ownerType: 'authenticated',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockParams = {};
    customExerciseStorage.clearMemoryCache();
    await customExerciseStorage.clearCustomExercises(testUser);

    useAuthStore.setState({
      user: { id: testUser.ownerId, email: 'unified@example.com' } as any,
      session: { user: { id: testUser.ownerId } } as any,
      isGuest: false,
      status: 'authenticated',
    });
  });

  afterEach(async () => {
    cleanup();
    await workoutStorage.clearAllWorkouts();
  });

  describe('1. Shared Canonical Form Presence across Both Entry Points', () => {
    it('1a. Exercise Library route renders all canonical fields and controls', async () => {
      await render(<CreateCustomExerciseScreen />);

      // Title & header actions
      expect(screen.getByTestId('create-custom-title')).toBeTruthy();
      expect(screen.getByTestId('create-custom-back-button')).toBeTruthy();
      expect(screen.getByTestId('create-custom-header-save-button')).toBeTruthy();

      // Form fields
      expect(screen.getByTestId('custom-exercise-name-input')).toBeTruthy();
      expect(screen.getByTestId('photo-picker-section')).toBeTruthy();
      expect(screen.getByTestId('add-photo-button')).toBeTruthy();
      expect(screen.getByTestId('category-select-chest')).toBeTruthy();
      expect(screen.getByTestId('equipment-select-Barbell')).toBeTruthy();
      expect(screen.getByTestId('custom-exercise-muscles-input')).toBeTruthy();
      expect(screen.getByTestId('custom-exercise-secondary-muscles-input')).toBeTruthy();
      expect(screen.getByTestId('custom-exercise-instructions-input')).toBeTruthy();

      // Bottom save action
      expect(screen.getByTestId('custom-exercise-submit-button')).toBeTruthy();
    });

    it('1b. Ongoing Workout picker modal renders the EXACT same canonical form when creating custom', async () => {
      const onSelect = jest.fn();
      const onClose = jest.fn();

      await render(
        <ExercisePickerModal
          visible={true}
          onClose={onClose}
          onSelectExercise={onSelect}
          selectedExerciseIds={[]}
        />
      );

      // Tap + New in picker
      await act(async () => {
        fireEvent.press(screen.getByTestId('picker-create-custom-button'));
      });

      // Must render ALL canonical fields identical to CreateCustomExerciseScreen
      expect(screen.getByTestId('create-custom-title')).toBeTruthy();
      expect(screen.getByTestId('custom-exercise-name-input')).toBeTruthy();
      expect(screen.getByTestId('photo-picker-section')).toBeTruthy();
      expect(screen.getByTestId('add-photo-button')).toBeTruthy();
      expect(screen.getByTestId('category-select-chest')).toBeTruthy();
      expect(screen.getByTestId('equipment-select-Barbell')).toBeTruthy();
      expect(screen.getByTestId('custom-exercise-muscles-input')).toBeTruthy();
      expect(screen.getByTestId('custom-exercise-secondary-muscles-input')).toBeTruthy();
      expect(screen.getByTestId('custom-exercise-instructions-input')).toBeTruthy();

      // Cancel and save controls
      expect(screen.getByTestId('create-custom-back-button')).toBeTruthy();
      expect(screen.getByTestId('custom-exercise-submit-button')).toBeTruthy();
    });
  });

  describe('2. Validation and Error Consistency', () => {
    it('2a. shows "Please enter an exercise name." when submitting empty name in Library flow', async () => {
      await render(<CreateCustomExerciseScreen />);

      await act(async () => {
        fireEvent.press(screen.getByTestId('custom-exercise-submit-button'));
      });

      await waitFor(() => {
        expect(screen.getByText('Please enter an exercise name.')).toBeTruthy();
      });
    });

    it('2b. shows "Please enter an exercise name." when submitting empty name in Workout picker flow', async () => {
      await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          onSelectExercise={jest.fn()}
          selectedExerciseIds={[]}
        />
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId('picker-create-custom-button'));
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId('custom-exercise-submit-button'));
      });

      await waitFor(() => {
        expect(screen.getByText('Please enter an exercise name.')).toBeTruthy();
      });
    });

    it('2c. duplicate exercise name throws and displays friendly error in Workout picker flow', async () => {
      // Create first exercise
      await exerciseRepository.createCustomExercise(
        { name: 'Cable Lateral Raise', category: 'shoulders', primaryMuscles: ['Lateral Deltoids'] },
        testUser
      );

      await render(
        <ExercisePickerModal
          visible={true}
          onClose={jest.fn()}
          onSelectExercise={jest.fn()}
          selectedExerciseIds={[]}
        />
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId('picker-create-custom-button'));
      });

      await act(async () => {
        fireEvent.changeText(screen.getByTestId('custom-exercise-name-input'), 'Cable Lateral Raise');
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId('custom-exercise-submit-button'));
      });

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeTruthy();
      });
    });
  });

  describe('3. Photo Picker and Storage in Workout Flow', () => {
    it('3a. allows selecting, previewing, replacing, and removing photos when creating from Workout picker', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock)
        .mockResolvedValueOnce({
          canceled: false,
          assets: [
            {
              uri: 'file:///local/custom_workout_lift.jpg',
              mimeType: 'image/jpeg',
              fileSize: 500 * 1024,
              base64: 'dGVzdF9iYXNlNjQ=',
            },
          ],
        })
        .mockResolvedValueOnce({
          canceled: false,
          assets: [
            {
              uri: 'file:///local/custom_workout_lift_v2.jpg',
              mimeType: 'image/jpeg',
              fileSize: 600 * 1024,
              base64: 'djJfYmFzZTY0',
            },
          ],
        });

      mockUpload.mockResolvedValue({ error: null });

      const onSelect = jest.fn();
      const onClose = jest.fn();

      await render(
        <ExercisePickerModal
          visible={true}
          onClose={onClose}
          onSelectExercise={onSelect}
          selectedExerciseIds={[]}
        />
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId('picker-create-custom-button'));
      });

      // 1. Pick photo
      await act(async () => {
        fireEvent.press(screen.getByTestId('add-photo-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('exercise-photo-preview')).toBeTruthy();
        expect(screen.getByTestId('replace-photo-button')).toBeTruthy();
        expect(screen.getByTestId('remove-photo-button')).toBeTruthy();
      });

      // 2. Replace photo
      await act(async () => {
        fireEvent.press(screen.getByTestId('replace-photo-button'));
      });

      await waitFor(() => {
        const preview = screen.getByTestId('exercise-photo-preview');
        expect(preview.props.source.uri).toBe('file:///local/custom_workout_lift_v2.jpg');
      });

      // 3. Remove photo
      await act(async () => {
        fireEvent.press(screen.getByTestId('remove-photo-button'));
      });

      await waitFor(() => {
        expect(screen.queryByTestId('exercise-photo-preview')).toBeNull();
        expect(screen.getByTestId('add-photo-button')).toBeTruthy();
      });
    });
  });

  describe('4. Active Workout State Protection and Auto-Selection', () => {
    it('4a. creates custom exercise with photo from Active Workout, preserves active session, and adds exercise', async () => {
      // 1. Start active workout with 1 exercise and 1 completed set
      let session = await workoutRepository.startEmptyWorkout('Active Session Protection Test');
      session = workoutRepository.addExerciseToWorkout(session, {
        id: 'wger_bench',
        name: 'Bench Press',
        categoryName: 'Chest',
      });
      session = workoutRepository.updateSet(
        session,
        'wger_bench',
        session.exercises[0].actualSets[0].id,
        {
          weight: 135,
          reps: 10,
          rir: 1,
          notes: 'Smooth warmup set',
          completed: true,
          completedAt: new Date().toISOString(),
        }
      );
      await workoutRepository.updateActiveWorkout(session);

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file:///local/incline_db_fly.jpg',
            mimeType: 'image/jpeg',
            fileSize: 400 * 1024,
            base64: 'Zmx5X2Jhc2U2NA==',
          },
        ],
      });

      // 2. Render Active Workout Screen
      await render(<ActiveWorkoutScreen />);

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeTruthy();
        expect(screen.getByTestId('complete-set-wger_bench-1')).toBeTruthy();
      });

      // 3. Open Add Exercise modal
      await act(async () => {
        fireEvent.press(screen.getByTestId('add-exercise-to-workout-button'));
      });

      // 4. Tap + New in picker
      await act(async () => {
        fireEvent.press(screen.getByTestId('picker-create-custom-button'));
      });

      // 5. Fill full canonical form
      await act(async () => {
        fireEvent.changeText(screen.getByTestId('custom-exercise-name-input'), 'Incline Dumbbell Fly');
        fireEvent.press(screen.getByTestId('category-select-chest'));
        fireEvent.press(screen.getByTestId('equipment-select-Dumbbell'));
        fireEvent.changeText(screen.getByTestId('custom-exercise-muscles-input'), 'Pectoralis Major, Sternal Head');
        fireEvent.changeText(screen.getByTestId('custom-exercise-secondary-muscles-input'), 'Anterior Deltoids');
        fireEvent.changeText(screen.getByTestId('custom-exercise-instructions-input'), 'Maintain slight elbow bend');
        fireEvent.press(screen.getByTestId('add-photo-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('exercise-photo-preview')).toBeTruthy();
      });

      // 6. Save
      await act(async () => {
        fireEvent.press(screen.getByTestId('custom-exercise-submit-button'));
      });

      // 7. Verify Active Workout state is 100% intact with newly created exercise added
      await waitFor(async () => {
        const active = await workoutRepository.getActiveWorkout();
        expect(active).not.toBeNull();
        expect(active!.exercises).toHaveLength(2);

        // Previous exercise preserved with exact set details
        expect(active!.exercises[0].exerciseName).toBe('Bench Press');
        expect(active!.exercises[0].actualSets[0].weight).toBe(135);
        expect(active!.exercises[0].actualSets[0].reps).toBe(10);
        expect(active!.exercises[0].actualSets[0].notes).toBe('Smooth warmup set');
        expect(active!.exercises[0].actualSets[0].completed).toBe(true);

        // Newly created custom exercise added to workout session
        expect(active!.exercises[1].exerciseName).toBe('Incline Dumbbell Fly');
        expect(active!.exercises[1].exerciseId).toMatch(/^custom_/);
      });

      // 8. Verify custom exercise was persisted in storage with photo attached
      const customs = await customExerciseStorage.getCustomExercises(testUser);
      expect(customs).toHaveLength(1);
      expect(customs[0].name).toBe('Incline Dumbbell Fly');
      expect(customs[0].images?.length).toBeGreaterThan(0);
      expect(customs[0].description).toBe('Maintain slight elbow bend');
    });
  });
});
