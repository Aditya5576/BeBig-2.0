import { env } from '../src/config/env';
import { colors, spacing } from '../src/constants/theme';
import { DOMAIN_LIMITS } from '../src/constants/domainLimits';
import { workoutStorage } from '../src/features/workout/storage/workoutStorage';
import { WorkoutSession } from '../src/features/workout/types';

describe('Milestone 1 — Foundation & Domain Setup Verification', () => {
  beforeEach(async () => {
    await workoutStorage.clearAllWorkouts();
  });

  it('loads configuration and design tokens accurately', () => {
    expect(env.appName).toBe('BeBig');
    expect(env.appEnv).toBeDefined();
    expect(colors.dark.primary).toBe('#38BDF8');
    expect(colors.dark.secondaryAccent).toBe('#00E599');
    expect(spacing.md).toBe(16);
    expect(DOMAIN_LIMITS.RIR_MIN).toBe(0);
    expect(DOMAIN_LIMITS.RIR_MAX).toBe(4);
  });

  it('persists and validates legacy completed workout payloads cleanly', async () => {
    const legacyWorkout: WorkoutSession = {
      id: 'legacy_1',
      name: 'Legacy Workout',
      startedAt: '2023-01-01T10:00:00Z',
      finishedAt: '2023-01-01T10:45:00Z',
      status: 'completed',
      exercises: [
        {
          exerciseId: 'ex1',
          exerciseName: 'Bench Press',
          order: 0,
          actualSets: [
            {
              id: 'set1',
              setNumber: 1,
              weight: 100,
              reps: 10,
              completed: true,
            },
          ],
        },
      ],
    };

    await workoutStorage.saveCompletedWorkout(legacyWorkout);
    const saved = await workoutStorage.getCompletedWorkouts();
    expect(saved.some((w) => w.id === 'legacy_1' && w.exercises[0]?.actualSets[0]?.weight === 100)).toBe(true);
  });
});
