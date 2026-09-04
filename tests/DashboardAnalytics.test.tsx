import {
  getStartOfWeek,
  getStartOfMonth,
  toLocalDateString,
  calculateWeeklyWorkouts,
  calculateMonthlyWorkouts,
  calculateWeeklyVolume,
  calculateAllTimeVolume,
  calculateWorkoutStreak,
  calculatePersonalRecords,
  calculateWeeklyGoalProgress,
  getSuggestedTodayWorkout,
  getGreeting,
  formatVolume,
  calculateDashboardAnalytics,
} from '../src/features/workout/utils/analytics';
import { WorkoutSession } from '../src/features/workout/types';
import { WorkoutTemplate } from '../src/features/templates/types';

describe('Milestone 8 — Dashboard Analytics Engine', () => {
  const mockTemplates: WorkoutTemplate[] = [
    {
      id: 'tpl-push',
      name: 'Push Day',
      exercises: [
        {
          exerciseId: 'ex-bench',
          exerciseName: 'Barbell Bench Press',
          order: 0,
          sets: 3,
          targetReps: '8-10',
          restTime: 90,
          targetWeight: 80,
        },
      ],
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'tpl-pull',
      name: 'Pull Day',
      exercises: [
        {
          exerciseId: 'ex-pullup',
          exerciseName: 'Weighted Pull-Up',
          order: 0,
          sets: 3,
          targetReps: '6-8',
          restTime: 120,
          targetWeight: 20,
        },
      ],
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'tpl-legs',
      name: 'Legs Day',
      exercises: [
        {
          exerciseId: 'ex-squat',
          exerciseName: 'Barbell Back Squat',
          order: 0,
          sets: 4,
          targetReps: '6-8',
          restTime: 180,
          targetWeight: 120,
        },
      ],
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
  ];

  describe('Date boundary calculations', () => {
    it('returns Monday 00:00:00 for getStartOfWeek on any day of the week', () => {
      // Wednesday Sep 2, 2026
      const wed = new Date(2026, 8, 2, 14, 30); // Months are 0-indexed: 8 = Sep
      const startOfWedWeek = getStartOfWeek(wed);
      expect(startOfWedWeek.getDay()).toBe(1); // Monday
      expect(startOfWedWeek.getDate()).toBe(31); // Aug 31, 2026
      expect(startOfWedWeek.getHours()).toBe(0);
      expect(startOfWedWeek.getMinutes()).toBe(0);

      // Sunday Sep 6, 2026
      const sun = new Date(2026, 8, 6, 22, 0);
      const startOfSunWeek = getStartOfWeek(sun);
      expect(startOfSunWeek.getDay()).toBe(1); // Monday
      expect(startOfSunWeek.getDate()).toBe(31); // Aug 31, 2026
    });

    it('returns 1st of month 00:00:00 for getStartOfMonth', () => {
      const midMonth = new Date(2026, 8, 18, 16, 45);
      const startOfMonth = getStartOfMonth(midMonth);
      expect(startOfMonth.getDate()).toBe(1);
      expect(startOfMonth.getMonth()).toBe(8);
      expect(startOfMonth.getHours()).toBe(0);
      expect(startOfMonth.getMinutes()).toBe(0);
    });

    it('formats local date string as YYYY-MM-DD', () => {
      const d = new Date(2026, 8, 4);
      expect(toLocalDateString(d)).toBe('2026-09-04');
    });
  });

  describe('Empty states (Zero workouts)', () => {
    it('returns zero metrics when workout history is completely empty', () => {
      const result = calculateDashboardAnalytics([], 4, mockTemplates);
      expect(result.workoutsThisWeek).toBe(0);
      expect(result.workoutsThisMonth).toBe(0);
      expect(result.weeklyVolume).toBe(0);
      expect(result.allTimeVolume).toBe(0);
      expect(result.currentStreakDays).toBe(0);
      expect(result.totalPRsCount).toBe(0);
      expect(result.topPRs).toEqual([]);
      expect(result.targetDaysPerWeek).toBe(4);
      expect(result.weeklyGoalPercent).toBe(0);
      expect(result.suggestedTemplate?.id).toBe('tpl-push');
    });

    it('returns null suggested template when user has no templates', () => {
      const result = calculateDashboardAnalytics([], 4, []);
      expect(result.suggestedTemplate).toBeNull();
    });
  });

  describe('Weekly & Monthly Workouts Counts', () => {
    const fixedNow = new Date(2026, 8, 4, 12, 0); // Friday Sep 4, 2026. Week is Aug 31 - Sep 6.

    it('counts only workouts in current week and excludes previous week', () => {
      const workouts: WorkoutSession[] = [
        // Inside this week: Tuesday Sep 1, 2026
        {
          id: 'w1',
          name: 'Push Day',
          startedAt: new Date(2026, 8, 1, 10, 0).toISOString(),
          status: 'completed',
          totalVolume: 3500,
          exercises: [],
        },
        // Inside this week: Thursday Sep 3, 2026
        {
          id: 'w2',
          name: 'Pull Day',
          startedAt: new Date(2026, 8, 3, 11, 0).toISOString(),
          status: 'completed',
          totalVolume: 4200,
          exercises: [],
        },
        // Last week: Sunday Aug 30, 2026
        {
          id: 'w3',
          name: 'Leg Day',
          startedAt: new Date(2026, 7, 30, 18, 0).toISOString(),
          status: 'completed',
          totalVolume: 5000,
          exercises: [],
        },
      ];

      expect(calculateWeeklyWorkouts(workouts, fixedNow)).toBe(2);
      expect(calculateWeeklyVolume(workouts, fixedNow)).toBe(7700);
      expect(calculateAllTimeVolume(workouts)).toBe(12700);
    });

    it('counts only workouts in current calendar month and excludes previous month', () => {
      const workouts: WorkoutSession[] = [
        // Sep 1, 2026
        {
          id: 'w1',
          name: 'Push Day',
          startedAt: new Date(2026, 8, 1, 10, 0).toISOString(),
          status: 'completed',
          totalVolume: 3000,
          exercises: [],
        },
        // Aug 31, 2026 (same week, but previous month!)
        {
          id: 'w2',
          name: 'Leg Day',
          startedAt: new Date(2026, 7, 31, 10, 0).toISOString(),
          status: 'completed',
          totalVolume: 4000,
          exercises: [],
        },
      ];

      expect(calculateMonthlyWorkouts(workouts, fixedNow)).toBe(1);
    });
  });

  describe('Streak Calculation', () => {
    const fixedNow = new Date(2026, 8, 4, 12, 0); // Friday Sep 4, 2026

    it('returns 1 if user only worked out today', () => {
      const workouts: WorkoutSession[] = [
        {
          id: 'w-today',
          name: 'Upper Body',
          startedAt: new Date(2026, 8, 4, 8, 0).toISOString(),
          status: 'completed',
          exercises: [],
        },
      ];
      expect(calculateWorkoutStreak(workouts, fixedNow)).toBe(1);
    });

    it('maintains streak if user worked out yesterday and not yet today', () => {
      const workouts: WorkoutSession[] = [
        {
          id: 'w-yesterday',
          name: 'Push Day',
          startedAt: new Date(2026, 8, 3, 18, 0).toISOString(), // Sep 3
          status: 'completed',
          exercises: [],
        },
        {
          id: 'w-2daysago',
          name: 'Leg Day',
          startedAt: new Date(2026, 8, 2, 18, 0).toISOString(), // Sep 2
          status: 'completed',
          exercises: [],
        },
      ];
      // Even though no workout on Sep 4 yet, Sep 3 + Sep 2 is a 2-day streak
      expect(calculateWorkoutStreak(workouts, fixedNow)).toBe(2);
    });

    it('deduplicates multiple workouts on the same day towards streak', () => {
      const workouts: WorkoutSession[] = [
        {
          id: 'w-today-morning',
          name: 'Cardio',
          startedAt: new Date(2026, 8, 4, 8, 0).toISOString(),
          status: 'completed',
          exercises: [],
        },
        {
          id: 'w-today-evening',
          name: 'Heavy Bench',
          startedAt: new Date(2026, 8, 4, 18, 0).toISOString(),
          status: 'completed',
          exercises: [],
        },
        {
          id: 'w-yesterday',
          name: 'Squat Session',
          startedAt: new Date(2026, 8, 3, 17, 0).toISOString(),
          status: 'completed',
          exercises: [],
        },
      ];
      expect(calculateWorkoutStreak(workouts, fixedNow)).toBe(2);
    });

    it('resets streak to 0 if the last workout was 2 or more days ago', () => {
      const workouts: WorkoutSession[] = [
        {
          id: 'w-old',
          name: 'Old Workout',
          startedAt: new Date(2026, 8, 1, 10, 0).toISOString(), // 3 days ago
          status: 'completed',
          exercises: [],
        },
      ];
      expect(calculateWorkoutStreak(workouts, fixedNow)).toBe(0);
    });
  });

  describe('Personal Records (PRs) Calculation', () => {
    it('accurately identifies max weight per exercise across multiple workouts and sets', () => {
      const workouts: WorkoutSession[] = [
        {
          id: 'w1',
          name: 'Chest & Back',
          startedAt: '2026-09-01T10:00:00.000Z',
          status: 'completed',
          exercises: [
            {
              exerciseId: 'bench',
              exerciseName: 'Barbell Bench Press',
              order: 0,
              actualSets: [
                { id: 's1', setNumber: 1, weight: 80, reps: 8, rir: 2, completed: true },
                { id: 's2', setNumber: 2, weight: 90, reps: 5, rir: 1, completed: true },
                { id: 's3', setNumber: 3, weight: 100, reps: 3, rir: 0, completed: false }, // Incomplete! Must be ignored
              ],
            },
            {
              exerciseId: 'row',
              exerciseName: 'Barbell Row',
              order: 1,
              actualSets: [
                { id: 's4', setNumber: 1, weight: 70, reps: 10, rir: 2, completed: true },
              ],
            },
          ],
        },
        {
          id: 'w2',
          name: 'Chest Focus',
          startedAt: '2026-09-03T10:00:00.000Z',
          status: 'completed',
          exercises: [
            {
              exerciseId: 'bench',
              exerciseName: 'Barbell Bench Press',
              order: 0,
              actualSets: [
                { id: 's5', setNumber: 1, weight: 95, reps: 4, rir: 1, completed: true }, // New PR for bench!
              ],
            },
          ],
        },
      ];

      const { totalPRsCount, topPRs } = calculatePersonalRecords(workouts);
      expect(totalPRsCount).toBe(2);
      expect(topPRs[0].exerciseName).toBe('Barbell Bench Press');
      expect(topPRs[0].maxWeight).toBe(95);
      expect(topPRs[1].exerciseName).toBe('Barbell Row');
      expect(topPRs[1].maxWeight).toBe(70);
    });

    it('ignores 0kg bodyweight sets from setting false PR weights', () => {
      const workouts: WorkoutSession[] = [
        {
          id: 'w-pushups',
          name: 'Calisthenics',
          startedAt: '2026-09-02T10:00:00.000Z',
          status: 'completed',
          exercises: [
            {
              exerciseId: 'pushup',
              exerciseName: 'Standard Push-Up',
              order: 0,
              actualSets: [
                { id: 'p1', setNumber: 1, weight: 0, reps: 25, rir: 2, completed: true },
              ],
            },
          ],
        },
      ];

      const { totalPRsCount, topPRs } = calculatePersonalRecords(workouts);
      expect(totalPRsCount).toBe(0);
      expect(topPRs).toEqual([]);
    });
  });

  describe('Weekly Goal Progress', () => {
    it('evaluates progress percentage correctly and caps at 100%', () => {
      expect(calculateWeeklyGoalProgress(0, 4)).toEqual({ targetDays: 4, percent: 0 });
      expect(calculateWeeklyGoalProgress(2, 4)).toEqual({ targetDays: 4, percent: 50 });
      expect(calculateWeeklyGoalProgress(4, 4)).toEqual({ targetDays: 4, percent: 100 });
      expect(calculateWeeklyGoalProgress(6, 4)).toEqual({ targetDays: 4, percent: 100 });
      // Default to 4 if target days is invalid or 0
      expect(calculateWeeklyGoalProgress(1, 0)).toEqual({ targetDays: 4, percent: 25 });
    });
  });

  describe('Template Rotation & Recommendation', () => {
    it('suggests the next template in cyclical rotation based on last workout', () => {
      const workouts: WorkoutSession[] = [
        {
          id: 'w-recent',
          name: 'Push Day',
          sourceTemplateId: 'tpl-push',
          startedAt: '2026-09-03T10:00:00.000Z',
          status: 'completed',
          exercises: [],
        },
      ];

      // Next after Push is Pull!
      const suggested = getSuggestedTodayWorkout(mockTemplates, workouts);
      expect(suggested?.id).toBe('tpl-pull');
    });

    it('wraps around to the first template if the last was the final template', () => {
      const workouts: WorkoutSession[] = [
        {
          id: 'w-recent',
          name: 'Legs Day',
          sourceTemplateId: 'tpl-legs',
          startedAt: '2026-09-03T10:00:00.000Z',
          status: 'completed',
          exercises: [],
        },
      ];

      // Next after Legs (index 2) wraps to Push (index 0)
      const suggested = getSuggestedTodayWorkout(mockTemplates, workouts);
      expect(suggested?.id).toBe('tpl-push');
    });
  });

  describe('Greeting & Volume Formatter', () => {
    it('returns time-aware greetings', () => {
      expect(getGreeting(new Date(2026, 8, 4, 8, 0))).toBe('Good morning 👋');
      expect(getGreeting(new Date(2026, 8, 4, 14, 0))).toBe('Good afternoon 👋');
      expect(getGreeting(new Date(2026, 8, 4, 20, 0))).toBe('Good evening 👋');
    });

    it('formats volume tonnage with comma separators', () => {
      expect(formatVolume(0)).toBe('0 kg');
      expect(formatVolume(450)).toBe('450 kg');
      expect(formatVolume(14250)).toBe('14,250 kg');
      expect(formatVolume(100500.6)).toBe('100,501 kg');
    });
  });
});
