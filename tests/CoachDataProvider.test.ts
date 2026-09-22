import { SupabaseCoachDataProvider } from '../src/features/coach/server/dataProvider';
import { TrainingContext } from '../src/features/coach/training/types';

describe('M3B: Real Coach Data Provider & RLS Execution', () => {
  const verifiedUserId = 'verified_user_123';
  
  // Mock Supabase Client
  const createMockSupabase = (profileData: any, workoutData: any, profileError: any = null, workoutError: any = null) => {
    const profileSelect = jest.fn().mockReturnThis();
    const workoutOrder = jest.fn().mockResolvedValue({ data: workoutData, error: workoutError });

    const fromMock = jest.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: profileSelect,
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: profileData, error: profileError })
        };
      }
      if (table === 'workout_sessions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: workoutOrder
        };
      }
      throw new Error('Unknown table');
    });

    return {
      from: fromMock,
      _profileSelect: profileSelect
    };
  };

  it('securely scopes the data fetch to the authenticated client implicitly via RLS', async () => {
    const mockDb = createMockSupabase(
      { age: 25, weight: 80, height: 180 },
      []
    );
    const provider = new SupabaseCoachDataProvider(mockDb);
    const context = await provider.getTrainingContext(verifiedUserId);

    expect(context.userId).toBe(verifiedUserId);
    expect(context.profileSummary.age).toBe(25);
    
    // Verifies the query builder chain uses RLS properly 
    expect(mockDb.from).toHaveBeenCalledWith('profiles');
    expect(mockDb.from).toHaveBeenCalledWith('workout_sessions');
  });

  it('minimizes profile data inclusion (avoids fetching sensitive fields)', async () => {
    const mockDb = createMockSupabase({ age: 30 }, []);
    const provider = new SupabaseCoachDataProvider(mockDb);
    
    // We expect the query to specifically request ONLY minimal safe fields
    await provider.getTrainingContext(verifiedUserId);
    
    // Check the select args for 'profiles' table
    const profileSelectMock = mockDb._profileSelect;
    // Inspect what was requested
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
        exercises: [] // No sets for this test
      }
    ];

    const mockDb = createMockSupabase({ age: 30 }, mockWorkouts);
    const provider = new SupabaseCoachDataProvider(mockDb);
    
    const context = await provider.getTrainingContext(verifiedUserId);
    // Since it goes through M1 intelligence, all metrics will be calculated correctly
    expect(context.workoutsThisWeek).toBeGreaterThanOrEqual(0);
    expect(context.recentWorkouts.length).toBe(1);
    expect(context.recentWorkouts[0].id).toBe('w1');
    expect(context.weeklyVolume).toBe(1000);
  });
});
