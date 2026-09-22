import { WorkoutSession } from './types.ts';

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  reps: number;
  achievedAt: string;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function calculateWeeklyWorkouts(workouts: WorkoutSession[], now: Date = new Date()): number {
  if (!workouts || workouts.length === 0) return 0;
  const startOfWeek = getStartOfWeek(now).getTime();
  return workouts.filter((w) => w.startedAt && new Date(w.startedAt).getTime() >= startOfWeek).length;
}

export function calculateMonthlyWorkouts(workouts: WorkoutSession[], now: Date = new Date()): number {
  if (!workouts || workouts.length === 0) return 0;
  const startOfMonth = getStartOfMonth(now).getTime();
  return workouts.filter((w) => w.startedAt && new Date(w.startedAt).getTime() >= startOfMonth).length;
}

export function calculateWeeklyVolume(workouts: WorkoutSession[], now: Date = new Date()): number {
  if (!workouts || workouts.length === 0) return 0;
  const startOfWeek = getStartOfWeek(now).getTime();
  let volume = 0;
  for (const w of workouts) {
    if (w.startedAt && new Date(w.startedAt).getTime() >= startOfWeek && w.totalVolume) {
      volume += w.totalVolume;
    }
  }
  return volume;
}

export function calculateAllTimeVolume(workouts: WorkoutSession[]): number {
  if (!workouts || workouts.length === 0) return 0;
  return workouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
}

export function calculatePersonalRecords(workouts: WorkoutSession[]): {
  totalPRsCount: number;
  topPRs: PersonalRecord[];
  allPRs: PersonalRecord[];
} {
  if (!workouts || workouts.length === 0) return { totalPRsCount: 0, topPRs: [], allPRs: [] };
  const prMap = new Map<string, PersonalRecord>();
  for (const workout of workouts) {
    if (!workout.exercises) continue;
    for (const ex of workout.exercises) {
      if (!ex.exerciseId || !ex.actualSets) continue;
      for (const set of ex.actualSets) {
        if (set.completed && typeof set.weight === 'number' && set.weight > 0 && set.reps > 0) {
          const existing = prMap.get(ex.exerciseId);
          if (!existing || set.weight > existing.maxWeight) {
            prMap.set(ex.exerciseId, {
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName || 'Exercise',
              maxWeight: set.weight,
              reps: set.reps,
              achievedAt: set.completedAt || workout.finishedAt || workout.startedAt,
            });
          }
        }
      }
    }
  }
  const records = Array.from(prMap.values());
  records.sort((a, b) => b.maxWeight - a.maxWeight);
  return {
    totalPRsCount: records.length,
    topPRs: records.slice(0, 3),
    allPRs: records,
  };
}

export interface ExerciseHistoryEntry {
  workoutId: string;
  workoutName: string;
  date: string;
  maxWeight: number;
  totalReps: number;
  volume: number;
  sets: { setNumber: number; weight: number; reps: number; rir?: number; notes?: string; }[];
}

export function getExerciseHistory(workouts: WorkoutSession[], exerciseId: string): ExerciseHistoryEntry[] {
  if (!workouts || workouts.length === 0 || !exerciseId) return [];
  const entries: ExerciseHistoryEntry[] = [];
  for (const workout of workouts) {
    if (!workout.exercises) continue;
    const exercise = workout.exercises.find((ex) => ex.exerciseId === exerciseId);
    if (!exercise || !exercise.actualSets) continue;
    const completedSets = exercise.actualSets.filter((s) => s.completed && s.reps > 0);
    if (completedSets.length === 0) continue;
    const maxWeight = completedSets.reduce((max, s) => (s.weight > max ? s.weight : max), completedSets[0].weight);
    const totalReps = completedSets.reduce((sum, s) => sum + s.reps, 0);
    const volume = completedSets.reduce((sum, s) => sum + (s.weight > 0 ? s.weight * s.reps : 0), 0);
    entries.push({
      workoutId: workout.id,
      workoutName: workout.name,
      date: workout.startedAt,
      maxWeight,
      totalReps,
      volume: Math.round(volume * 100) / 100,
      sets: completedSets.map((s) => ({
        setNumber: s.setNumber, weight: s.weight, reps: s.reps, rir: s.rir, notes: s.notes,
      })),
    });
  }
  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
