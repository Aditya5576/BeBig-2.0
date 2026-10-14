import {
  coachService,
  generateDeterministicWeeklyAnalysis,
  AIWeeklyAnalysisResult,
} from '../src/features/coach/services/coachService';
import { WorkoutSession } from '../src/features/workout/types';
import { supabase, isSupabaseConfigured } from '../src/lib/supabase';

// Mock supabase client
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
  isSupabaseConfigured: jest.fn(),
}));

describe('Milestone 5: AI Weekly Workout Analysis', () => {
  const referenceDate = new Date('2026-10-12T12:00:00.000Z'); // Monday

  const createWorkout = (
    id: string,
    startedAt: string,
    exercises: any[],
    name = 'Push Hypertrophy'
  ): WorkoutSession => ({
    id,
    name,
    startedAt,
    finishedAt: startedAt,
    exercises,
    status: 'completed',
    totalVolume: exercises.reduce(
      (sum, ex) =>
        sum +
        (ex.actualSets || []).reduce(
          (s: number, set: any) => s + (set.completed ? set.weight * set.reps : 0),
          0
        ),
      0
    ),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (isSupabaseConfigured as jest.Mock).mockReturnValue(true);
  });

  describe('Factual Deterministic Analysis Engine', () => {
    it('handles empty workout history gracefully without errors', () => {
      const result = generateDeterministicWeeklyAnalysis([], referenceDate);

      expect(result.headline).toBe('No Active Sessions This Week');
      expect(result.summary).toContain('You have not logged any completed workout sessions');
      expect(result.keyInsights.length).toBeGreaterThan(0);
      expect(result.muscleFocus).toEqual([]);
      expect(result.isDeterministicFallback).toBe(true);
      expect(result.generatedAt).toBeDefined();
    });

    it('accurately distinguishes zero current-week sessions from available past training history', () => {
      const pastWorkout = createWorkout('past-1', '2026-10-06T10:00:00.000Z', [
        {
          exerciseId: 'deadlift',
          exerciseName: 'Barbell Deadlift',
          categoryName: 'Back',
          actualSets: [{ id: 's1', setNumber: 1, weight: 140, reps: 5, completed: true }],
        },
      ], 'Deadlift Strength');

      const result = generateDeterministicWeeklyAnalysis([pastWorkout], referenceDate);

      expect(result.headline).toContain('1 Workout in History');
      expect(result.summary).toContain('No workout sessions have been logged');
      expect(result.summary).toContain('1 completed session');
      const pastInsight = result.keyInsights.find((i) => i.title === 'Previous Training Active');
      expect(pastInsight).toBeDefined();
      expect(pastInsight?.detail).toContain('Deadlift Strength');
      expect(result.muscleFocus).toEqual([]); // Truthful zero current-week volume
      expect(result.isDeterministicFallback).toBe(true);
    });

    it('accurately captures realistic multi-session training with progressive overload', () => {
      // Previous week workout (Oct 6, 2026)
      const prevWeekWorkout = createWorkout('prev-1', '2026-10-06T10:00:00.000Z', [
        {
          exerciseId: 'bench-press',
          exerciseName: 'Bench Press',
          categoryName: 'Chest',
          actualSets: [
            { id: 's1', setNumber: 1, weight: 100, reps: 5, completed: true },
            { id: 's2', setNumber: 2, weight: 100, reps: 5, completed: true },
          ],
        },
      ]);

      // Current week workout (Oct 12, 2026) with progression
      const currentWeekWorkout = createWorkout('curr-1', '2026-10-12T09:00:00.000Z', [
        {
          exerciseId: 'bench-press',
          exerciseName: 'Bench Press',
          categoryName: 'Chest',
          actualSets: [
            { id: 's1', setNumber: 1, weight: 102.5, reps: 5, completed: true },
            { id: 's2', setNumber: 2, weight: 102.5, reps: 5, completed: true },
          ],
        },
      ]);

      const result = generateDeterministicWeeklyAnalysis(
        [prevWeekWorkout, currentWeekWorkout],
        referenceDate
      );

      expect(result.headline).toContain('Strong Progression');
      expect(result.summary).toContain('1 workout session');
      expect(result.summary).toContain('1,025 kg'); // 102.5 * 5 * 2 = 1025 kg
      const progressionInsight = result.keyInsights.find((i) => i.title.includes('Progressive Overload'));
      expect(progressionInsight).toBeDefined();
      expect(progressionInsight?.detail).toContain('Bench Press');
      expect(result.muscleFocus).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            muscleGroup: 'Chest',
            sets: 2,
            volume: 1025,
          }),
        ])
      );
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('handles incomplete sets and skipped sets without hallucinating reps or volume', () => {
      const workoutWithSkippedSets = createWorkout('skipped-1', '2026-10-12T10:00:00.000Z', [
        {
          exerciseId: 'incline-db',
          exerciseName: 'Incline Dumbbell Press',
          categoryName: 'Chest',
          actualSets: [
            { id: 's1', setNumber: 1, weight: 30, reps: 10, completed: true },
            { id: 's2', setNumber: 2, weight: 30, reps: 0, completed: false }, // skipped
            { id: 's3', setNumber: 3, weight: 0, reps: 10, completed: true }, // 0 weight
          ],
        },
      ]);

      const result = generateDeterministicWeeklyAnalysis([workoutWithSkippedSets], referenceDate);

      // Only completed sets with reps > 0 contribute: set 1 = 30*10 = 300kg, set 3 = 0*10 = 0kg
      expect(result.summary).toContain('300 kg');
      const muscleGroup = result.muscleFocus.find((m) => m.muscleGroup === 'Chest');
      expect(muscleGroup?.volume).toBe(300);
      expect(muscleGroup?.sets).toBe(2); // set 1 and set 3
    });

    it('handles multi-muscle group training volume and prioritizes top volume muscle groups', () => {
      const fullBodyWorkout = createWorkout('full-body-1', '2026-10-12T10:00:00.000Z', [
        {
          exerciseId: 'squat',
          exerciseName: 'Barbell Squat',
          categoryName: 'Legs',
          actualSets: [
            { id: 'sq1', setNumber: 1, weight: 120, reps: 5, completed: true },
            { id: 'sq2', setNumber: 2, weight: 120, reps: 5, completed: true },
          ],
        },
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          categoryName: 'Chest',
          actualSets: [
            { id: 'bp1', setNumber: 1, weight: 80, reps: 5, completed: true },
          ],
        },
      ]);

      const result = generateDeterministicWeeklyAnalysis([fullBodyWorkout], referenceDate);

      expect(result.muscleFocus.length).toBe(2);
      expect(result.muscleFocus[0].muscleGroup).toBe('Legs');
      expect(result.muscleFocus[0].volume).toBe(1200); // 120 * 5 * 2
      expect(result.muscleFocus[1].muscleGroup).toBe('Chest');
      expect(result.muscleFocus[1].volume).toBe(400); // 80 * 5
    });
  });

  describe('Cloud Edge Function and Fallback Flow', () => {
    it('invokes coach-agent edge function when user is authenticated with a valid session', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'valid-jwt-token' } },
        error: null,
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: {
          type: 'weekly_summary',
          message: 'Top-tier progression observed on Bench Press this week.',
          suggestedActions: [
            'Maintain current progressive overload on primary compound movements.',
          ],
        },
        error: null,
      });

      const currentWorkout = createWorkout('curr-1', '2026-10-12T09:00:00.000Z', [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          categoryName: 'Chest',
          actualSets: [{ id: 's1', setNumber: 1, weight: 100, reps: 5, completed: true }],
        },
      ]);

      const res = await coachService.generateWeeklyWorkoutAnalysis([currentWorkout], { now: referenceDate });

      expect(supabase.functions.invoke).toHaveBeenCalledWith('coach-agent', expect.objectContaining({
        body: expect.objectContaining({ intent: 'weekly_summary' }),
      }));
      expect(res.isDeterministicFallback).toBe(false);
      expect(res.summary).toBe('Top-tier progression observed on Bench Press this week.');
      expect(res.recommendations).toContain(
        'Maintain current progressive overload on primary compound movements.'
      );
    });

    it('safely falls back to deterministic analysis when Edge Function returns error or quota 429', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'valid-jwt-token' } },
        error: null,
      });

      (supabase.functions.invoke as jest.Mock).mockResolvedValue({
        data: { type: 'error', message: 'Daily AI usage limit reached.' },
        error: null,
      });

      const currentWorkout = createWorkout('curr-1', '2026-10-12T09:00:00.000Z', [
        {
          exerciseId: 'squat',
          exerciseName: 'Squat',
          categoryName: 'Legs',
          actualSets: [{ id: 's1', setNumber: 1, weight: 140, reps: 5, completed: true }],
        },
      ]);

      const res = await coachService.generateWeeklyWorkoutAnalysis([currentWorkout], { now: referenceDate });

      expect(res.isDeterministicFallback).toBe(true);
      expect(res.summary).toContain('1 workout session');
      expect(res.summary).toContain('700 kg');
    });

    it('safely falls back to deterministic analysis when unauthenticated or guest', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const res = await coachService.generateWeeklyWorkoutAnalysis([], { now: referenceDate });

      expect(supabase.functions.invoke).not.toHaveBeenCalled();
      expect(res.isDeterministicFallback).toBe(true);
      expect(res.headline).toBe('No Active Sessions This Week');
    });

    it('safely falls back to deterministic analysis when supabase is not configured', async () => {
      (isSupabaseConfigured as jest.Mock).mockReturnValue(false);

      const res = await coachService.generateWeeklyWorkoutAnalysis([], { now: referenceDate });

      expect(supabase.functions.invoke).not.toHaveBeenCalled();
      expect(res.isDeterministicFallback).toBe(true);
      expect(res.headline).toBe('No Active Sessions This Week');
    });
  });

  describe('Navigation Target Verification', () => {
    it('verifies route registration exists in root stack layout file', () => {
      const fs = require('fs');
      const path = require('path');
      const layoutPath = path.join(process.cwd(), 'app', '_layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      expect(layoutContent).toContain('<Stack.Screen name="workout/progress/weekly" />');
    });

    it('verifies home screen contains verified Weekly Performance navigation targets', () => {
      const fs = require('fs');
      const path = require('path');
      const homePath = path.join(process.cwd(), 'app', 'home.tsx');
      const homeContent = fs.readFileSync(homePath, 'utf8');
      expect(homeContent).toContain('testID="home-weekly-performance-card"');
      expect(homeContent).toContain("router.push('/workout/progress/weekly'");
      expect(homeContent).toContain('testID="home-weekly-volume-button"');
    });

    it('verifies workout history screen contains verified Weekly Performance navigation target', () => {
      const fs = require('fs');
      const path = require('path');
      const historyPath = path.join(process.cwd(), 'app', 'workout', 'history.tsx');
      const historyContent = fs.readFileSync(historyPath, 'utf8');
      expect(historyContent).toContain('testID="history-weekly-performance-card"');
      expect(historyContent).toContain("router.push('/workout/progress/weekly'");
    });

    it('verifies the weekly performance screen file exists at expected path', () => {
      const fs = require('fs');
      const path = require('path');
      const screenPath = path.join(process.cwd(), 'app', 'workout', 'progress', 'weekly.tsx');
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, 'utf8');
      expect(content).toContain('WeeklyPerformanceScreen');
      expect(content).toContain('AIWeeklyAnalysisCard');
      expect(content).toContain('testID="weekly-perf-settings-button"');
    });

    it('verifies bottom navigation bar tabs contain single-line labels without multi-line wrapping', () => {
      const fs = require('fs');
      const path = require('path');
      const navPath = path.join(process.cwd(), 'src', 'components', 'navigation', 'BottomNavBar.tsx');
      const navContent = fs.readFileSync(navPath, 'utf8');
      expect(navContent).toContain('numberOfLines={1}');
      expect(navContent).toContain('ellipsizeMode="tail"');
      expect(navContent).toContain('Workout');
    });

    it('verifies AI Weekly Analysis card header has responsive layout with non-overlapping controls', () => {
      const fs = require('fs');
      const path = require('path');
      const cardPath = path.join(process.cwd(), 'src', 'features', 'coach', 'components', 'AIWeeklyAnalysisCard.tsx');
      const cardContent = fs.readFileSync(cardPath, 'utf8');
      expect(cardContent).toContain('styles.headerContainer');
      expect(cardContent).toContain('styles.headerTopRow');
      expect(cardContent).toContain('testID="ai-weekly-refresh-button"');
      expect(cardContent).toContain('testID="ai-factual-pill"');
    });
  });
});
