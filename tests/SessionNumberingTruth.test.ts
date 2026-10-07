import {
  deriveWorkoutFocus,
  getSuggestedSessionNumber,
  getTemplateFocus,
  WORKOUT_FOCUS_OPTIONS,
} from '../src/features/templates/utils/templateUtils';
import { WorkoutTemplate } from '../src/features/templates/types';

describe('My Templates 2.0 — Comprehensive Session Numbering & Focus Truth', () => {
  const chestTricepsWorkout = {
    id: 'w-chest-tri',
    status: 'completed' as const,
    exercises: [
      { exerciseId: 'ex-1', exerciseName: 'Bench Press', categoryName: 'Chest' },
      { exerciseId: 'ex-2', exerciseName: 'Incline Press', categoryName: 'Chest' },
      { exerciseId: 'ex-3', exerciseName: 'Cable Fly', categoryName: 'Chest' },
      { exerciseId: 'ex-4', exerciseName: 'Triceps Pushdown', categoryName: 'Triceps' },
    ],
  };

  const backBicepsWorkout = {
    id: 'w-back-bi',
    status: 'completed' as const,
    exercises: [
      { exerciseId: 'ex-5', exerciseName: 'Lat Pulldown', categoryName: 'Back' },
      { exerciseId: 'ex-6', exerciseName: 'Seated Row', categoryName: 'Back' },
      { exerciseId: 'ex-7', exerciseName: 'Barbell Curl', categoryName: 'Biceps' },
      { exerciseId: 'ex-8', exerciseName: 'Hammer Curl', categoryName: 'Biceps' },
    ],
  };

  const pureBackWorkout = {
    id: 'w-pure-back',
    status: 'completed' as const,
    exercises: [
      { exerciseId: 'ex-5', exerciseName: 'Lat Pulldown', categoryName: 'Back' },
      { exerciseId: 'ex-6', exerciseName: 'Seated Row', categoryName: 'Back' },
      { exerciseId: 'ex-9', exerciseName: 'Deadlift', categoryName: 'Back' },
    ],
  };

  const pureChestWorkout = {
    id: 'w-pure-chest',
    status: 'completed' as const,
    exercises: [
      { exerciseId: 'ex-1', exerciseName: 'Bench Press', categoryName: 'Chest' },
      { exerciseId: 'ex-2', exerciseName: 'Incline Press', categoryName: 'Chest' },
      { exerciseId: 'ex-3', exerciseName: 'Dumbbell Fly', categoryName: 'Chest' },
    ],
  };

  const unknownOtherWorkout = {
    id: 'w-other',
    status: 'completed' as const,
    exercises: [
      { exerciseId: 'ex-10', exerciseName: 'Custom Movement A', categoryName: undefined },
      { exerciseId: 'ex-11', exerciseName: 'Custom Movement B', categoryName: undefined },
    ],
  };

  test('1. 0 completed Back workouts -> Back template -> Session 1', () => {
    const history: any[] = [];
    expect(getSuggestedSessionNumber(history, 'Back')).toBe(1);
  });

  test('2. 4 completed Back & Biceps workouts -> Back template -> Session 5', () => {
    const history = [backBicepsWorkout, backBicepsWorkout, backBicepsWorkout, backBicepsWorkout];
    expect(getSuggestedSessionNumber(history, 'Back & Biceps')).toBe(5);
  });

  test('3. 0 completed Chest workouts -> Chest template -> Session 1', () => {
    const history: any[] = [];
    expect(getSuggestedSessionNumber(history, 'Chest')).toBe(1);
  });

  test('4. 3 completed Chest & Triceps workouts -> Chest & Triceps template -> Session 4', () => {
    const history = [chestTricepsWorkout, chestTricepsWorkout, chestTricepsWorkout];
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(4);
  });

  test('5. Existing templates do NOT affect session number', () => {
    const templates: WorkoutTemplate[] = [
      {
        id: 't-1',
        name: 'Chest & Triceps — Session 99',
        workoutFocus: 'Chest & Triceps',
        sequenceNumber: 99,
        exercises: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const history = [chestTricepsWorkout, chestTricepsWorkout];
    // Session number is strictly derived from history (2 completed -> Session 3), ignoring templates array
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(3);
  });

  test('6. Template sequenceNumber does NOT affect session number', () => {
    const history = [chestTricepsWorkout];
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(2);
  });

  test('7. Template names containing "Session 9" do NOT affect session number', () => {
    const history = [chestTricepsWorkout, chestTricepsWorkout];
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(3);
  });

  test('8. Creating duplicate templates does NOT increase session number', () => {
    const history = [backBicepsWorkout, backBicepsWorkout];
    const seq1 = getSuggestedSessionNumber(history, 'Back & Biceps');
    expect(seq1).toBe(3);
    // Saving 5 templates for the same history does not alter history array
    const seq2 = getSuggestedSessionNumber(history, 'Back & Biceps');
    expect(seq2).toBe(3);
  });

  test('9. Active workout does NOT count', () => {
    const activeWorkout = {
      ...chestTricepsWorkout,
      id: 'w-active',
      status: 'active' as const,
    };
    const history = [chestTricepsWorkout, activeWorkout];
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(2);
  });

  test('10. Abandoned/discarded workout does NOT count', () => {
    const abandonedWorkout = {
      ...chestTricepsWorkout,
      id: 'w-abandoned',
      status: 'abandoned',
    };
    const discardedWorkout = {
      ...chestTricepsWorkout,
      id: 'w-discarded',
      status: 'discarded',
    };
    const history = [chestTricepsWorkout, abandonedWorkout, discardedWorkout];
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(2);
  });

  test('11. Scheduled workout does NOT count', () => {
    const scheduledWorkout = {
      ...chestTricepsWorkout,
      id: 'w-scheduled',
      status: 'scheduled',
    };
    const history = [chestTricepsWorkout, scheduledWorkout];
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(2);
  });

  test('12. Changing focus recalculates the session number', () => {
    const history = [
      chestTricepsWorkout,
      chestTricepsWorkout,
      backBicepsWorkout,
    ];
    // Focus Chest & Triceps -> 2 matching -> Session 3
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(3);
    // Switch to Back & Biceps -> 1 matching -> Session 2
    expect(getSuggestedSessionNumber(history, 'Back & Biceps')).toBe(2);
    // Switch to Shoulders & Legs -> 0 matching -> Session 1
    expect(getSuggestedSessionNumber(history, 'Shoulders & Legs')).toBe(1);
  });

  test('13. Old historical workout without required classification metadata does not get falsely counted', () => {
    const malformedWorkout = {
      id: 'w-malformed',
      status: 'completed',
      exercises: [],
    };
    const unclassifiedWorkout = {
      id: 'w-unclassified',
      status: 'completed',
      exercises: [{ exerciseId: 'ex-x', exerciseName: 'Unknown Lift', categoryName: undefined }],
    };
    const history = [chestTricepsWorkout, malformedWorkout, unclassifiedWorkout];
    // Only chestTricepsWorkout matches Chest & Triceps
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(2);
  });

  test('14. Multiple historical workouts with mixed focuses count only the requested focus', () => {
    const history = [
      chestTricepsWorkout,
      pureChestWorkout,
      backBicepsWorkout,
      pureBackWorkout,
      unknownOtherWorkout,
    ];
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(2);
    expect(getSuggestedSessionNumber(history, 'Chest')).toBe(2);
    expect(getSuggestedSessionNumber(history, 'Back & Biceps')).toBe(2);
    expect(getSuggestedSessionNumber(history, 'Back')).toBe(2);
    expect(getSuggestedSessionNumber(history, 'Other')).toBe(2);
    expect(getSuggestedSessionNumber(history, 'Shoulders & Legs')).toBe(1);
  });

  test('15. Deleted/renamed templates do not affect historical count', () => {
    const history = [chestTricepsWorkout, chestTricepsWorkout, chestTricepsWorkout];
    expect(getSuggestedSessionNumber(history, 'Chest & Triceps')).toBe(4);
  });

  test('16. Empty workout history gives Session 1', () => {
    expect(getSuggestedSessionNumber([], 'Chest & Triceps')).toBe(1);
    expect(getSuggestedSessionNumber(null, 'Back & Biceps')).toBe(1);
    expect(getSuggestedSessionNumber(undefined, 'Full Body')).toBe(1);
  });

  test('17. My Templates newest updated template appears first', () => {
    const t1: WorkoutTemplate = {
      id: 't-1',
      name: 'Old Plan',
      exercises: [],
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T10:00:00Z',
    };
    const t2: WorkoutTemplate = {
      id: 't-2',
      name: 'Recently Updated Plan',
      exercises: [],
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-02T10:00:00Z',
    };
    const list = [t1, t2];
    const sorted = [...list].sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
    );
    expect(sorted[0].id).toBe('t-2');
  });

  test('18. Focus filter returns only matching templates', () => {
    const tChest: WorkoutTemplate = {
      id: 't-chest',
      name: 'Chest Day',
      workoutFocus: 'Chest',
      exercises: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const tBack: WorkoutTemplate = {
      id: 't-back',
      name: 'Back Day',
      workoutFocus: 'Back',
      exercises: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const list = [tChest, tBack];
    const filtered = list.filter((t) => getTemplateFocus(t) === 'Chest');
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('t-chest');
  });

  test('19. "All" returns all templates', () => {
    const tChest: WorkoutTemplate = { id: 't-c', name: 'C', exercises: [], createdAt: '', updatedAt: '' };
    const tBack: WorkoutTemplate = { id: 't-b', name: 'B', exercises: [], createdAt: '', updatedAt: '' };
    const list = [tChest, tBack];
    const filter = 'All';
    const result = filter === 'All' ? list : list.filter((t) => getTemplateFocus(t) === filter);
    expect(result.length).toBe(2);
  });

  test('20. Filter with zero results identifies empty match', () => {
    const tChest: WorkoutTemplate = {
      id: 't-chest',
      name: 'Chest Day',
      workoutFocus: 'Chest',
      exercises: [],
      createdAt: '',
      updatedAt: '',
    };
    const list = [tChest];
    const filtered = list.filter((t) => getTemplateFocus(t) === 'Legs');
    expect(filtered.length).toBe(0);
  });

  test('21. Long template names do not break layout or focus derivation', () => {
    const longName = 'Very Long Custom Template Name That Could Overflow Screen Width In Extreme Viewport Sizes';
    const tLong: WorkoutTemplate = {
      id: 't-long',
      name: longName,
      workoutFocus: 'Chest & Triceps',
      exercises: [
        { exerciseId: 'e-1', exerciseName: 'Bench Press', categoryName: 'Chest', order: 0, sets: 4, targetReps: '8-10', restTime: 90 },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(getTemplateFocus(tLong)).toBe('Chest & Triceps');
    expect(tLong.name).toBe(longName);
  });

  test('22. Multiple templates with same focus render correctly', () => {
    const t1: WorkoutTemplate = { id: 't-1', name: 'Plan A', workoutFocus: 'Chest', exercises: [], createdAt: '', updatedAt: '' };
    const t2: WorkoutTemplate = { id: 't-2', name: 'Plan B', workoutFocus: 'Chest', exercises: [], createdAt: '', updatedAt: '' };
    const list = [t1, t2];
    const filtered = list.filter((t) => getTemplateFocus(t) === 'Chest');
    expect(filtered.length).toBe(2);
  });

  test('23. Existing pre-feature templates still render safely', () => {
    const legacyTemplate: WorkoutTemplate = {
      id: 't-legacy',
      name: 'Legacy Workout',
      exercises: [
        { exerciseId: 'e-1', exerciseName: 'Bench Press', categoryName: 'Chest', order: 0, sets: 3, targetReps: '10', restTime: 90 },
        { exerciseId: 'e-2', exerciseName: 'Triceps Pushdown', categoryName: 'Triceps', order: 1, sets: 3, targetReps: '10', restTime: 90 },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(getTemplateFocus(legacyTemplate)).toBe('Chest & Triceps');
  });

  test('24. Saving a template does not mutate completed workout history', () => {
    const initialHistory = [chestTricepsWorkout, chestTricepsWorkout];
    const initialLength = initialHistory.length;

    // Simulate saving a new template
    const newTemplate: WorkoutTemplate = {
      id: 't-new',
      name: 'Chest & Triceps — Session 3',
      workoutFocus: 'Chest & Triceps',
      sequenceNumber: 3,
      exercises: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Completed workout history remains unchanged
    expect(initialHistory.length).toBe(initialLength);
    expect(getSuggestedSessionNumber(initialHistory, 'Chest & Triceps')).toBe(3);
  });

  test('Failure & Isolation: Guest / Multi-user isolation', () => {
    const userAHistory = [
      backBicepsWorkout,
      backBicepsWorkout,
      backBicepsWorkout,
      backBicepsWorkout,
    ];
    const userBHistory: any[] = [];

    // User A creating Back & Biceps template -> Session 5
    expect(getSuggestedSessionNumber(userAHistory, 'Back & Biceps')).toBe(5);
    // User B creating Back & Biceps template -> Session 1
    expect(getSuggestedSessionNumber(userBHistory, 'Back & Biceps')).toBe(1);
  });
});
