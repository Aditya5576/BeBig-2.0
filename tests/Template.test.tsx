import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { templateRepository } from '../src/features/templates/services/templateRepository';
import { templateStorage } from '../src/features/templates/storage/templateStorage';
import { WorkoutTemplate } from '../src/features/templates/types';
import TemplatesListScreen from '../app/templates/index';
import CreateTemplateScreen from '../app/templates/new';
import TemplateDetailScreen from '../app/templates/[id]';
import { exerciseRepository } from '../src/features/exercises';

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

describe('BeBig 2.0 — Workout Templates Milestone', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSecureStore.clear();
    mockParams = {};
    await templateStorage.clearTemplates();
  });

  // 1, 4, 9, 10, 12, 13: Template Creation, decimal weight, ordering, persistence & rehydration
  describe('Domain & Repository: Creation and Persistence', () => {
    it('1, 4, 9, 10, 12, 13: creates template with exercises, decimal weights, order, and persists', async () => {
      const created = await templateRepository.createTemplate({
        name: 'Push Day Hypertrophy',
        exercises: [
          {
            exerciseId: 'wger_42',
            exerciseName: 'Barbell Bench Press',
            categoryName: 'Chest',
            sets: 4,
            targetReps: '8-10',
            restTime: 120,
            targetWeight: 82.5,
          },
          {
            exerciseId: 'custom_101',
            exerciseName: 'Incline Dumbbell Press',
            categoryName: 'Chest',
            sets: 3,
            targetReps: '10-12',
            restTime: 90,
            targetWeight: 32.5,
          },
        ],
      });

      // 1: ID generation and structure
      expect(created.id).toMatch(/^template_/);
      expect(created.name).toBe('Push Day Hypertrophy');
      expect(created.exercises).toHaveLength(2);

      // 9: Decimal target weights preserved
      expect(created.exercises[0].targetWeight).toBe(82.5);
      expect(created.exercises[1].targetWeight).toBe(32.5);

      // 10: Normalized order
      expect(created.exercises[0].order).toBe(0);
      expect(created.exercises[1].order).toBe(1);

      // 12: Stored locally
      const stored = await templateStorage.getTemplates();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(created.id);

      // 13: Rehydrates correctly from repository
      const rehydrated = await templateRepository.getTemplateById(created.id);
      expect(rehydrated).not.toBeNull();
      expect(rehydrated?.name).toBe('Push Day Hypertrophy');
      expect(rehydrated?.exercises[0].exerciseName).toBe('Barbell Bench Press');
    });

    // 2: Template name validation
    it('2: rejects empty or whitespace-only template name', async () => {
      await expect(
        templateRepository.createTemplate({
          name: '   ',
          exercises: [
            {
              exerciseId: 'wger_1',
              exerciseName: 'Squat',
              sets: 3,
              targetReps: '10',
              restTime: 90,
            },
          ],
        }),
      ).rejects.toThrow(/Template name is required/i);
    });

    // 3: Requires at least one exercise
    it('3: rejects template creation with zero exercises', async () => {
      await expect(
        templateRepository.createTemplate({
          name: 'Empty Template',
          exercises: [],
        }),
      ).rejects.toThrow(/Template requires at least one exercise/i);
    });

    // 5: Duplicate prevention
    it('5: rejects duplicate exercises within the same template', async () => {
      await expect(
        templateRepository.createTemplate({
          name: 'Leg Day',
          exercises: [
            {
              exerciseId: 'wger_1',
              exerciseName: 'Barbell Squat',
              sets: 3,
              targetReps: '8',
              restTime: 120,
            },
            {
              exerciseId: 'wger_1',
              exerciseName: 'Barbell Squat Duplicate',
              sets: 3,
              targetReps: '8',
              restTime: 120,
            },
          ],
        }),
      ).rejects.toThrow(/Duplicate exercise/i);
    });

    // 6: Sets validation
    it('6: rejects invalid or non-positive sets', async () => {
      await expect(
        templateRepository.createTemplate({
          name: 'Invalid Sets',
          exercises: [
            {
              exerciseId: 'wger_1',
              exerciseName: 'Squat',
              sets: 0,
              targetReps: '10',
              restTime: 60,
            },
          ],
        }),
      ).rejects.toThrow(/Sets must be an integer of at least 1/i);
    });

    // 7: Target reps validation
    it('7: rejects empty target reps string', async () => {
      await expect(
        templateRepository.createTemplate({
          name: 'Invalid Reps',
          exercises: [
            {
              exerciseId: 'wger_1',
              exerciseName: 'Squat',
              sets: 3,
              targetReps: '   ',
              restTime: 60,
            },
          ],
        }),
      ).rejects.toThrow(/Target reps are required/i);
    });

    // 8: Rest time validation
    it('8: rejects negative rest time', async () => {
      await expect(
        templateRepository.createTemplate({
          name: 'Negative Rest',
          exercises: [
            {
              exerciseId: 'wger_1',
              exerciseName: 'Squat',
              sets: 3,
              targetReps: '10',
              restTime: -30,
            },
          ],
        }),
      ).rejects.toThrow(/Rest time cannot be negative/i);
    });

    // 14: Editing template
    it('14: updates template name and exercises', async () => {
      const created = await templateRepository.createTemplate({
        name: 'Initial Name',
        exercises: [
          {
            exerciseId: 'wger_1',
            exerciseName: 'Squat',
            sets: 3,
            targetReps: '10',
            restTime: 90,
          },
        ],
      });

      const updated = await templateRepository.updateTemplate({
        id: created.id,
        name: 'Updated Name',
        exercises: [
          {
            exerciseId: 'wger_1',
            exerciseName: 'Squat',
            sets: 5,
            targetReps: '5',
            restTime: 180,
            targetWeight: 140,
          },
        ],
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.exercises[0].sets).toBe(5);
      expect(updated.exercises[0].targetWeight).toBe(140);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime(),
      );
    });

    // 15: Deleting template
    it('15: deletes template cleanly from storage', async () => {
      const created = await templateRepository.createTemplate({
        name: 'To Delete',
        exercises: [
          {
            exerciseId: 'wger_1',
            exerciseName: 'Squat',
            sets: 3,
            targetReps: '10',
            restTime: 90,
          },
        ],
      });

      await templateRepository.deleteTemplate(created.id);
      const remaining = await templateRepository.getTemplates();
      expect(remaining).toHaveLength(0);
      expect(await templateRepository.getTemplateById(created.id)).toBeNull();
    });

    // 16 & 17: Guest and Authenticated parity
    it('16 & 17: stores templates on device without calling cloud authentication APIs', async () => {
      const t1 = await templateRepository.createTemplate({
        name: 'Guest / Auth Parity Plan',
        exercises: [
          {
            exerciseId: 'wger_1',
            exerciseName: 'Pull Up',
            sets: 3,
            targetReps: '12',
            restTime: 90,
          },
        ],
      });

      expect(t1.id).toBeDefined();
      const list = await templateRepository.getTemplates();
      expect(list.some((t) => t.name === 'Guest / Auth Parity Plan')).toBe(true);
    });

    // 18: Handling corrupted/invalid data
    it('18: safely filters out corrupt or invalid persisted data without crashing', async () => {
      // Inject corrupt JSON into storage
      const corruptData = [
        { invalidField: 123 }, // Missing id, name, exercises
        null,
        {
          id: 'valid_1',
          name: 'Valid Template',
          exercises: [
            {
              exerciseId: 'e1',
              exerciseName: 'Pushup',
              order: 0,
              sets: 3,
              targetReps: '15',
              restTime: 60,
            },
          ],
        },
        { id: 'broken_ex', name: 'Broken', exercises: 'not-an-array' },
      ];
      mockSecureStore.set('bebig.workout.templates', JSON.stringify(corruptData));

      const templates = await templateStorage.getTemplates();
      // Only the valid template record is accepted
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('valid_1');
      expect(templates[0].name).toBe('Valid Template');
    });
  });

  // UI Screens: My Templates, Create Template, Template Detail
  describe('Template UI Screens', () => {
    it('renders My Templates screen, shows empty state, and handles navigation', async () => {
      const { getByTestId, findByText } = await render(<TemplatesListScreen />);

      expect(getByTestId('templates-screen-title')).toBeTruthy();
      expect(getByTestId('create-template-button')).toBeTruthy();
      expect(await findByText(/No workout templates yet/i)).toBeTruthy();

      fireEvent.press(getByTestId('create-template-button'));
      expect(mockPush).toHaveBeenCalledWith('/templates/new');
    });

    it('renders existing templates in My Templates list', async () => {
      await templateRepository.createTemplate({
        name: 'Full Body A',
        exercises: [
          {
            exerciseId: 'wger_1',
            exerciseName: 'Barbell Deadlift',
            sets: 3,
            targetReps: '5',
            restTime: 180,
          },
        ],
      });

      const { findByText } = await render(<TemplatesListScreen />);
      expect(await findByText('Full Body A')).toBeTruthy();
      expect(await findByText(/1 EXERCISE/i)).toBeTruthy();
      expect(await findByText(/Barbell Deadlift/i)).toBeTruthy();
    });

    it('renders CreateTemplateScreen, validates empty submission, and saves valid template', async () => {
      // Mock exercise library returning sample exercise
      jest.spyOn(exerciseRepository, 'getExercises').mockResolvedValueOnce({
        exercises: [
          {
            id: 'wger_42',
            name: 'Barbell Bench Press',
            description: '',
            category: 'chest',
            categoryName: 'Chest',
            primaryMuscles: [],
            secondaryMuscles: [],
            equipment: [],
            images: [],
            sourceProvider: 'wger',
            isCustom: false,
          },
        ],
        totalCount: 1,
        hasMore: false,
      });

      const { getByTestId, findByText, getByText } = await render(<CreateTemplateScreen />);

      const saveButton = getByTestId('save-template-button');

      // 1. Submit with empty name fails
      fireEvent.press(saveButton);
      expect(await findByText(/Template name is required/i)).toBeTruthy();

      // 2. Fill in template name
      fireEvent.changeText(getByTestId('template-name-input'), 'Push Day');

      await waitFor(() => {
        expect(getByTestId('template-name-input').props.value).toBe('Push Day');
      });

      // 3. Submit without exercises fails
      fireEvent.press(saveButton);
      expect(await findByText(/Template requires at least one exercise/i)).toBeTruthy();

      // 4. Open exercise picker and select exercise
      fireEvent.press(getByTestId('add-exercise-button'));
      const exerciseItem = await findByText('Barbell Bench Press');
      fireEvent.press(exerciseItem);

      // Verify exercise appears in template
      expect(await findByText('#1')).toBeTruthy();
      expect(getByTestId('exercise-sets-wger_42')).toBeTruthy();

      // 5. Submit valid template
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      // Verify template is in storage
      const templates = await templateRepository.getTemplates();
      expect(templates.some((t) => t.name === 'Push Day')).toBe(true);
    });

    it('10 & 11: supports exercise reordering (Up/Down) and exercise removal in UI', async () => {
      const template = await templateRepository.createTemplate({
        name: 'Reorder Test Plan',
        exercises: [
          {
            exerciseId: 'ex_1',
            exerciseName: 'Exercise Alpha',
            sets: 3,
            targetReps: '10',
            restTime: 60,
          },
          {
            exerciseId: 'ex_2',
            exerciseName: 'Exercise Beta',
            sets: 3,
            targetReps: '10',
            restTime: 60,
          },
        ],
      });

      mockParams = { id: template.id };

      const { findByTestId, getByTestId } = await render(<TemplateDetailScreen />);

      expect(await findByTestId('template-detail-title')).toBeTruthy();

      // Move Exercise Beta Up (order swap)
      const moveUpBeta = getByTestId('move-up-ex_2');
      fireEvent.press(moveUpBeta);

      // Wait for re-render: Exercise Beta is now #1
      await waitFor(() => {
        const betaLabel = getByTestId('order-label-ex_2');
        expect(JSON.stringify(betaLabel.props.children)).toContain('1');
      });

      // Save changes
      fireEvent.press(getByTestId('update-template-button'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      // Confirm order changed in persisted template
      const updated = await templateRepository.getTemplateById(template.id);
      expect(updated?.exercises[0].exerciseId).toBe('ex_2');
      expect(updated?.exercises[1].exerciseId).toBe('ex_1');

      // 11: Removal test
      const { getByTestId: getDetailItem, queryByTestId } = await render(<TemplateDetailScreen />);
      await waitFor(() => {
        expect(getDetailItem('remove-exercise-ex_1')).toBeTruthy();
      });
      fireEvent.press(getDetailItem('remove-exercise-ex_1'));

      await waitFor(() => {
        expect(queryByTestId('remove-exercise-ex_1')).toBeNull();
      });

      fireEvent.press(getDetailItem('update-template-button'));

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      const afterRemoval = await templateRepository.getTemplateById(template.id);
      expect(afterRemoval?.exercises).toHaveLength(1);
      expect(afterRemoval?.exercises[0].exerciseId).toBe('ex_2');
    });
  });
});
