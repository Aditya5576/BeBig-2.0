import { SupabaseCoachDataProvider, DEFAULT_COACH_WORKOUT_LIMIT } from '../src/features/coach/server/dataProvider';
import { TrainingContext } from '../src/features/coach/training/types';

describe('M3B: Coach Data Provider Optimization & Security', () => {
  const verifiedUserId = 'verified_user_123';
  
  // Enhanced Mock Supabase Client
  const createMockSupabase = (
    profileData: any,
    workoutData: any,
    profileError: any = null,
    workoutError: any = null,
    volumeRowsData: any = null
  ) => {
    const profileSelect = jest.fn().mockReturnThis();
    const workoutEqCalls: Array<[string, any]> = [];
    const workoutIsCalls: Array<[string, any]> = [];
    const workoutOrderCalls: Array<[string, any]> = [];
    let capturedLimit: number | null = null;
    let workoutSelectArgs = '';

    const fromMock = jest.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: profileSelect,
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: profileData, error: profileError })
        };
      }
      if (table === 'workout_sessions') {
        let isVolumeQuery = false;
        const builder: any = {
          select: jest.fn().mockImplementation((fields: string) => {
            if (fields === 'total_volume') {
              isVolumeQuery = true;
            } else {
              workoutSelectArgs = fields;
            }
            return builder;
          }),
          eq: jest.fn().mockImplementation((col: string, val: any) => {
            workoutEqCalls.push([col, val]);
            return builder;
          }),
          is: jest.fn().mockImplementation((col: string, val: any) => {
            workoutIsCalls.push([col, val]);
            return builder;
          }),
          order: jest.fn().mockImplementation((col: string, options: any) => {
            workoutOrderCalls.push([col, options]);
            return builder;
          }),
          limit: jest.fn().mockImplementation((count: number) => {
            capturedLimit = count;
            const sliced = workoutData ? workoutData.slice(0, count) : [];
            return Promise.resolve({ data: sliced, error: workoutError });
          }),
          then: (resolve: any, reject: any) => {
            if (isVolumeQuery) {
              const res = volumeRowsData !== null 
                ? volumeRowsData 
                : (workoutData || []).map((w: any) => ({ total_volume: w.total_volume }));
              return Promise.resolve({ data: res, error: null }).then(resolve, reject);
            }
            return Promise.resolve({ data: workoutData, error: workoutError }).then(resolve, reject);
          }
        };
        return builder;
      }
      throw new Error(`Unknown table: ${table}`);
    });

    return {
      from: fromMock,
      _profileSelect: profileSelect,
      getWorkoutEqCalls: () => workoutEqCalls,
      getWorkoutIsCalls: () => workoutIsCalls,
      getWorkoutOrderCalls: () => workoutOrderCalls,
      getCapturedLimit: () => capturedLimit,
      getWorkoutSelectArgs: () => workoutSelectArgs,
    };
  };

  it('securely scopes the data fetch to the authenticated client implicitly via RLS and explicitly via user_id', async () => {
    const mockDb = createMockSupabase(
      { age: 25, weight: 80, height: 180 },
      []
    );
    const provider = new SupabaseCoachDataProvider(mockDb);
    const context = await provider.getTrainingContext(verifiedUserId);

    expect(context.userId).toBe(verifiedUserId);
    expect(context.profileSummary.age).toBe(25);
    
    // Verifies the query builder chain uses RLS and explicit filters
    expect(mockDb.from).toHaveBeenCalledWith('profiles');
    expect(mockDb.from).toHaveBeenCalledWith('workout_sessions');

    const eqCalls = mockDb.getWorkoutEqCalls();
    expect(eqCalls).toContainEqual(['user_id', verifiedUserId]);
    expect(eqCalls).toContainEqual(['status', 'completed']);
  });

  it('minimizes profile data inclusion (avoids fetching sensitive fields)', async () => {
    const mockDb = createMockSupabase({ age: 30 }, []);
    const provider = new SupabaseCoachDataProvider(mockDb);
    
    await provider.getTrainingContext(verifiedUserId);
    
    const profileSelectMock = mockDb._profileSelect;
    expect(profileSelectMock).toHaveBeenCalledWith(expect.stringContaining('age'));
    expect(profileSelectMock).not.toHaveBeenCalledWith(expect.stringContaining('*'));
  });

  it('re-uses M1 TrainingIntelligence deterministically for the context payload', async () => {
    const mockWorkouts = [
      {
        id: 'w1',
        name: 'Bench Day',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        status: 'completed',
        total_volume: 1000,
        exercises: []
      }
    ];

    const mockDb = createMockSupabase({ age: 30 }, mockWorkouts);
    const provider = new SupabaseCoachDataProvider(mockDb);
    
    const context = await provider.getTrainingContext(verifiedUserId);
    expect(context.workoutsThisWeek).toBeGreaterThanOrEqual(0);
    expect(context.recentWorkouts.length).toBe(1);
    expect(context.recentWorkouts[0].id).toBe('w1');
    expect(context.weeklyVolume).toBe(1000);
  });

  it('limits the query to DEFAULT_COACH_WORKOUT_LIMIT (50) by default', async () => {
    const mockDb = createMockSupabase({ age: 28 }, []);
    const provider = new SupabaseCoachDataProvider(mockDb);
    
    await provider.getTrainingContext(verifiedUserId);

    expect(mockDb.getCapturedLimit()).toBe(DEFAULT_COACH_WORKOUT_LIMIT);
    expect(DEFAULT_COACH_WORKOUT_LIMIT).toBe(50);
  });

  it('allows custom limit override via constructor or method argument', async () => {
    const mockDb1 = createMockSupabase({ age: 28 }, []);
    const customLimitProvider = new SupabaseCoachDataProvider(mockDb1, 25);
    await customLimitProvider.getTrainingContext(verifiedUserId);
    expect(mockDb1.getCapturedLimit()).toBe(25);

    const mockDb2 = createMockSupabase({ age: 28 }, []);
    const defaultProvider = new SupabaseCoachDataProvider(mockDb2);
    await defaultProvider.getTrainingContext(verifiedUserId, 15);
    expect(mockDb2.getCapturedLimit()).toBe(15);
  });

  it('enforces deterministic ordering with recency primary sort and id tie-breaker', async () => {
    const mockDb = createMockSupabase({ age: 28 }, []);
    const provider = new SupabaseCoachDataProvider(mockDb);
    
    await provider.getTrainingContext(verifiedUserId);

    const orderCalls = mockDb.getWorkoutOrderCalls();
    expect(orderCalls).toEqual([
      ['started_at', { ascending: false }],
      ['id', { ascending: false }]
    ]);
  });

  it('filters out soft-deleted workout tombstones using is("deleted_at", null)', async () => {
    const mockDb = createMockSupabase({ age: 28 }, []);
    const provider = new SupabaseCoachDataProvider(mockDb);
    
    await provider.getTrainingContext(verifiedUserId);

    const isCalls = mockDb.getWorkoutIsCalls();
    expect(isCalls).toContainEqual(['deleted_at', null]);
  });

  it('handles empty workout history safely without errors', async () => {
    const mockDb = createMockSupabase({ age: 28 }, []);
    const provider = new SupabaseCoachDataProvider(mockDb);
    
    const context = await provider.getTrainingContext(verifiedUserId);
    expect(context.userId).toBe(verifiedUserId);
    expect(context.recentWorkouts).toHaveLength(0);
    expect(context.workoutsThisWeek).toBe(0);
    expect(context.workoutsThisMonth).toBe(0);
    expect(context.weeklyVolume).toBe(0);
    expect(context.allTimeVolume).toBe(0);
  });

  it('preserves exact lifetime allTimeVolume when workout history exceeds the limit', async () => {
    // Generate 50 workouts for limit threshold test
    const mock50Workouts = Array.from({ length: 50 }, (_, i) => ({
      id: `w_${i}`,
      name: `Workout ${i}`,
      started_at: new Date(Date.now() - i * 86400000).toISOString(),
      finished_at: new Date(Date.now() - i * 86400000 + 3600000).toISOString(),
      status: 'completed',
      total_volume: 1000,
      exercises: []
    }));

    // In this scenario, user has 100 lifetime workouts totaling 150,000 kg volume
    // Even though detailed query fetches latest 50 (50,000 kg), scalar volume query returns 150,000 kg
    const mockLifetimeVolumes = Array.from({ length: 100 }, () => ({ total_volume: 1500 }));

    const mockDb = createMockSupabase(
      { age: 30 },
      mock50Workouts,
      null,
      null,
      mockLifetimeVolumes
    );

    const provider = new SupabaseCoachDataProvider(mockDb, 50);
    const context = await provider.getTrainingContext(verifiedUserId);

    // Recent workouts bounded to 5 (from the 50 fetched)
    expect(context.recentWorkouts).toHaveLength(5);
    // Lifetime volume correctly preserves all 100 workouts (150,000) rather than truncated 50,000
    expect(context.allTimeVolume).toBe(150000);
  });

  it('propagates database errors securely without leaking sensitive details', async () => {
    const mockDb = createMockSupabase(
      { age: 25 },
      null,
      null,
      { message: 'Database connection failed' }
    );
    const provider = new SupabaseCoachDataProvider(mockDb);

    await expect(provider.getTrainingContext(verifiedUserId))
      .rejects.toThrow('Failed to fetch user workout history securely.');
  });
});
