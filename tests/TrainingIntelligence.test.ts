import { buildTrainingContext } from '../src/features/coach/training/trainingIntelligence';
import { calculateProgressionForExercise } from '../src/features/coach/training/progressionEngine';
import { calculateMuscleGroupVolume } from '../src/features/coach/training/muscleGroupEngine';
import { WorkoutSession } from '../src/features/workout/types';

describe('M1: Training Intelligence Foundation', () => {
  const userId = 'user_123';
  const profile = { age: 30, goal: 'build_muscle' as any };
  const mockNow = new Date('2026-09-21T10:00:00Z'); // A fixed Monday

  const createSet = (num: number, weight: number, reps: number, completed = true) => ({
    id: `set_${num}`,
    setNumber: num,
    weight,
    reps,
    completed,
    completedAt: mockNow.toISOString()
  });

  const createWorkout = (id: string, date: Date, exercises: any[]): WorkoutSession => ({
    id,
    name: 'Test Workout',
    startedAt: date.toISOString(),
    finishedAt: date.toISOString(),
    status: 'completed',
    exercises: exercises.map(ex => ({
      exerciseId: ex.id,
      exerciseName: ex.name,
      categoryName: ex.categoryName || 'Other',
      order: 0,
      actualSets: ex.sets
    })),
    totalVolume: exercises.reduce((sum, ex) => sum + ex.sets.reduce((sSum: number, s: any) => sSum + (s.completed && s.reps > 0 ? s.weight * s.reps : 0), 0), 0)
  });

  it('handles empty workout history securely', () => {
    const context = buildTrainingContext(userId, profile, [], mockNow);
    expect(context.userId).toBe(userId);
    expect(context.workoutsThisWeek).toBe(0);
    expect(context.recentWorkouts).toHaveLength(0);
    expect(context.weeklySummary.totalVolume).toBe(0);
    expect(context.recentProgressions).toHaveLength(0);
    expect(context.personalRecords).toHaveLength(0);
  });

  it('calculates completed-set volume accurately (ignores uncompleted/0 rep sets)', () => {
    const date = new Date(mockNow);
    const workout = createWorkout('w1', date, [{
      id: 'ex1', name: 'Bench', categoryName: 'Chest', sets: [
        createSet(1, 100, 10), // 1000
        createSet(2, 100, 0),  // 0 (0 reps)
        createSet(3, 100, 10, false) // 0 (not completed)
      ]
    }]);

    const context = buildTrainingContext(userId, profile, [workout], mockNow);
    expect(context.weeklyVolume).toBe(1000);
    expect(context.weeklySummary.totalSets).toBe(1);
    expect(context.muscleGroupVolumes).toEqual([{ muscleGroup: 'Chest', totalSets: 1, totalVolume: 1000 }]);
  });

  it('calculates exercise progression for weight improvement', () => {
    // 50kg x 8 -> 55kg x 8
    const w1 = createWorkout('w1', new Date(mockNow.getTime() - 86400000 * 2), [{
      id: 'ex1', name: 'Bench', sets: [createSet(1, 50, 8)]
    }]);
    const w2 = createWorkout('w2', mockNow, [{
      id: 'ex1', name: 'Bench', sets: [createSet(1, 55, 8)]
    }]);

    const prog = calculateProgressionForExercise([w1, w2], 'ex1', 'Bench');
    expect(prog).not.toBeNull();
    expect(prog?.weightDelta).toBe(5);
    expect(prog?.repDelta).toBe(0);
    expect(prog?.weightDeltaPercent).toBe(10);
    expect(prog?.improved).toBe(true);
    expect(prog?.maintained).toBe(false);
    expect(prog?.declined).toBe(false);
  });

  it('calculates exercise progression for rep improvement', () => {
    // 55kg x 8 -> 55kg x 10
    const w1 = createWorkout('w1', new Date(mockNow.getTime() - 86400000 * 2), [{
      id: 'ex1', name: 'Bench', sets: [createSet(1, 55, 8)]
    }]);
    const w2 = createWorkout('w2', mockNow, [{
      id: 'ex1', name: 'Bench', sets: [createSet(1, 55, 10)]
    }]);

    const prog = calculateProgressionForExercise([w1, w2], 'ex1', 'Bench');
    expect(prog?.weightDelta).toBe(0);
    expect(prog?.repDelta).toBe(2);
    expect(prog?.improved).toBe(true);
    expect(prog?.declined).toBe(false);
  });

  it('calculates exercise progression for performance decline', () => {
    // 55kg x 8 -> 55kg x 6
    const w1 = createWorkout('w1', new Date(mockNow.getTime() - 86400000 * 2), [{
      id: 'ex1', name: 'Bench', sets: [createSet(1, 55, 8)]
    }]);
    const w2 = createWorkout('w2', mockNow, [{
      id: 'ex1', name: 'Bench', sets: [createSet(1, 55, 6)]
    }]);

    const prog = calculateProgressionForExercise([w1, w2], 'ex1', 'Bench');
    expect(prog?.weightDelta).toBe(0);
    expect(prog?.repDelta).toBe(-2);
    expect(prog?.improved).toBe(false);
    expect(prog?.declined).toBe(true);
  });

  it('handles insufficient comparison history (only 1 session)', () => {
    const w1 = createWorkout('w1', mockNow, [{
      id: 'ex1', name: 'Bench', sets: [createSet(1, 55, 8)]
    }]);
    const prog = calculateProgressionForExercise([w1], 'ex1', 'Bench');
    expect(prog).toBeNull();
  });

  it('verifies muscle-group calculation aggregates correctly', () => {
    const w1 = createWorkout('w1', mockNow, [
      { id: 'ex1', name: 'Bench', categoryName: 'Chest', sets: [createSet(1, 100, 5)] },
      { id: 'ex2', name: 'Fly', categoryName: 'Chest', sets: [createSet(1, 20, 10)] },
      { id: 'ex3', name: 'Curl', categoryName: 'Arms', sets: [createSet(1, 15, 10)] }
    ]);
    const mgv = calculateMuscleGroupVolume([w1]);
    expect(mgv.length).toBe(2);
    // Chest: 100*5 + 20*10 = 700 volume, 2 sets
    const chest = mgv.find(m => m.muscleGroup === 'Chest');
    expect(chest?.totalSets).toBe(2);
    expect(chest?.totalVolume).toBe(700);
    
    const arms = mgv.find(m => m.muscleGroup === 'Arms');
    expect(arms?.totalSets).toBe(1);
    expect(arms?.totalVolume).toBe(150);
  });

  it('scopes context strictly to the provided user profile (user isolation)', () => {
    const w1 = createWorkout('w1', mockNow, [{ id: 'ex1', name: 'Bench', sets: [createSet(1, 50, 10)] }]);
    const context = buildTrainingContext('strict_user', { age: 25 }, [w1], mockNow);
    
    expect(context.userId).toBe('strict_user');
    expect(context.profileSummary.age).toBe(25);
    expect(context.workoutsThisWeek).toBe(1);
    expect(context.weeklySummary.workoutsCompleted).toBe(1);
  });

  it('integrates PR reuse successfully', () => {
    const w1 = createWorkout('w1', mockNow, [{
      id: 'ex1', name: 'Bench', sets: [createSet(1, 100, 5), createSet(2, 110, 1)] // PR is 110
    }]);
    const context = buildTrainingContext(userId, profile, [w1], mockNow);
    
    expect(context.personalRecords.length).toBe(1);
    expect(context.personalRecords[0].maxWeight).toBe(110);
    expect(context.weeklySummary.prCount).toBe(1);
  });
});
