import {
  extractSessionNumberFromName,
  extractBaseTemplateName,
  getSuggestedTemplateSessionNumber,
  getSuggestedSessionNumber,
  deriveWorkoutFocus,
} from '../src/features/templates/utils/templateUtils';
import { WorkoutTemplate } from '../src/features/templates/types';

describe('Automatic Workout Template Session Numbering', () => {
  const chestTricepsTpl1: WorkoutTemplate = {
    id: 't-ct-1',
    name: 'Chest & Triceps Session - 1',
    workoutFocus: 'Chest & Triceps',
    sequenceNumber: 1,
    exercises: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };

  const chestTricepsTpl2: WorkoutTemplate = {
    id: 't-ct-2',
    name: 'Chest & Triceps Session - 2',
    workoutFocus: 'Chest & Triceps',
    sequenceNumber: 2,
    exercises: [],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
  };

  const chestTricepsTpl3: WorkoutTemplate = {
    id: 't-ct-3',
    name: 'Chest & Triceps Session - 3',
    workoutFocus: 'Chest & Triceps',
    sequenceNumber: 3,
    exercises: [],
    createdAt: '2026-10-03T10:00:00.000Z',
    updatedAt: '2026-10-03T10:00:00.000Z',
  };

  const backBicepsTpl1: WorkoutTemplate = {
    id: 't-bb-1',
    name: 'Back & Biceps Session - 1',
    workoutFocus: 'Back & Biceps',
    sequenceNumber: 1,
    exercises: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };

  const backBicepsTpl2: WorkoutTemplate = {
    id: 't-bb-2',
    name: 'Back & Biceps Session - 2',
    workoutFocus: 'Back & Biceps',
    sequenceNumber: 2,
    exercises: [],
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
  };

  describe('extractSessionNumberFromName', () => {
    test('extracts numbers from various formats correctly', () => {
      expect(extractSessionNumberFromName('Chest & Triceps Session - 1')).toBe(1);
      expect(extractSessionNumberFromName('Chest & Triceps Session - 2')).toBe(2);
      expect(extractSessionNumberFromName('Chest & Triceps — Session 3')).toBe(3);
      expect(extractSessionNumberFromName('Chest & Triceps Session 4')).toBe(4);
      expect(extractSessionNumberFromName('Chest & Triceps Session: 5')).toBe(5);
      expect(extractSessionNumberFromName('Chest & Triceps Session -6')).toBe(6);
    });

    test('returns null for names without session numbers', () => {
      expect(extractSessionNumberFromName('Chest & Triceps')).toBeNull();
      expect(extractSessionNumberFromName('Push Day')).toBeNull();
      expect(extractSessionNumberFromName('')).toBeNull();
      expect(extractSessionNumberFromName(null as any)).toBeNull();
    });
  });

  describe('extractBaseTemplateName', () => {
    test('strips session suffix and trims whitespace', () => {
      expect(extractBaseTemplateName('Chest & Triceps Session - 1')).toBe('Chest & Triceps');
      expect(extractBaseTemplateName('Chest & Triceps — Session 2')).toBe('Chest & Triceps');
      expect(extractBaseTemplateName('Back & Biceps Session 3')).toBe('Back & Biceps');
      expect(extractBaseTemplateName('Leg Day')).toBe('Leg Day');
    });
  });

  describe('getSuggestedTemplateSessionNumber — Acceptance Requirements', () => {
    test('Requirement 1: Existing Session - 1 and Session - 2 suggest Session 3', () => {
      const templates = [chestTricepsTpl1, chestTricepsTpl2];
      const suggested = getSuggestedTemplateSessionNumber(templates, 'Chest & Triceps');
      expect(suggested).toBe(3);
    });

    test('Requirement 2: Highest existing is 3 -> suggest Session 4', () => {
      const templates = [chestTricepsTpl1, chestTricepsTpl2, chestTricepsTpl3];
      const suggested = getSuggestedTemplateSessionNumber(templates, 'Chest & Triceps');
      expect(suggested).toBe(4);
    });

    test('Requirement 3: Gap in numbering (Sessions 1 and 3 exist) -> suggests Session 4 based on max', () => {
      const templates = [chestTricepsTpl1, chestTricepsTpl3];
      const suggested = getSuggestedTemplateSessionNumber(templates, 'Chest & Triceps');
      expect(suggested).toBe(4);
    });

    test('Requirement 4: Series isolation — Chest & Triceps does not affect Back & Biceps', () => {
      // User has Chest & Triceps Sessions 1 and 2, but Back & Biceps has no templates
      const templates = [chestTricepsTpl1, chestTricepsTpl2];
      const backSuggested = getSuggestedTemplateSessionNumber(templates, 'Back & Biceps');
      expect(backSuggested).toBe(1);

      // Add Back & Biceps Session 1 and 2
      const mixedTemplates = [chestTricepsTpl1, chestTricepsTpl2, backBicepsTpl1, backBicepsTpl2];
      expect(getSuggestedTemplateSessionNumber(mixedTemplates, 'Chest & Triceps')).toBe(3);
      expect(getSuggestedTemplateSessionNumber(mixedTemplates, 'Back & Biceps')).toBe(3);
    });

    test('Requirement 5: Templates without session numbers do not break numbering', () => {
      const nonNumberedTpl: WorkoutTemplate = {
        id: 't-nn',
        name: 'Chest & Triceps Pump',
        workoutFocus: 'Chest & Triceps',
        exercises: [],
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      };
      const templates = [nonNumberedTpl];
      expect(getSuggestedTemplateSessionNumber(templates, 'Chest & Triceps')).toBe(1);

      const mixedWithNumbered = [nonNumberedTpl, chestTricepsTpl1];
      expect(getSuggestedTemplateSessionNumber(mixedWithNumbered, 'Chest & Triceps')).toBe(2);
    });

    test('Requirement 6: Increments exactly once (no +1 on top of +1)', () => {
      const templates = [chestTricepsTpl1, chestTricepsTpl2];
      // Once calculated, it suggests 3
      const seq = getSuggestedTemplateSessionNumber(templates, 'Chest & Triceps');
      expect(seq).toBe(3);
      // It is NOT 4
      expect(seq).not.toBe(4);
    });

    test('Requirement 7: Reopening modal does not increment again without saving new template', () => {
      const templates = [chestTricepsTpl1, chestTricepsTpl2];
      const seqFirstOpen = getSuggestedTemplateSessionNumber(templates, 'Chest & Triceps');
      const seqSecondOpen = getSuggestedTemplateSessionNumber(templates, 'Chest & Triceps');
      const seqThirdOpen = getSuggestedTemplateSessionNumber(templates, 'Chest & Triceps');

      expect(seqFirstOpen).toBe(3);
      expect(seqSecondOpen).toBe(3);
      expect(seqThirdOpen).toBe(3);
    });

    test('Empty templates list defaults safely to Session 1', () => {
      expect(getSuggestedTemplateSessionNumber([], 'Chest & Triceps')).toBe(1);
      expect(getSuggestedTemplateSessionNumber(null, 'Chest & Triceps')).toBe(1);
      expect(getSuggestedTemplateSessionNumber(undefined, 'Chest & Triceps')).toBe(1);
    });
  });
});
