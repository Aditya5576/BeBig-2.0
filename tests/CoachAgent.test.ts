import { CoachAgentOrchestrator } from '../src/features/coach/agent/agentOrchestrator';
import { MockAIProvider } from '../src/features/coach/agent/aiProvider';
import { CoachDataProvider } from '../src/features/coach/agent/types';
import { TrainingContext } from '../src/features/coach/training/types';
import { AgentTools } from '../src/features/coach/agent/tools';

describe('M2: Coach Agent Foundation', () => {
  const userId = 'auth_user_456';
  
  const mockContext: TrainingContext = {
    userId,
    profileSummary: { age: 30, goal: 'build_muscle' as any },
    recentWorkouts: [],
    workoutsThisWeek: 2,
    workoutsThisMonth: 10,
    weeklyVolume: 5000,
    allTimeVolume: 50000,
    recentProgressions: [],
    personalRecords: [],
    muscleGroupVolumes: [],
    weeklySummary: {
      workoutsCompleted: 2,
      totalSets: 20,
      totalVolume: 5000,
      prCount: 1,
      strongestImprovement: null
    }
  };

  const mockDataProvider: CoachDataProvider = {
    getTrainingContext: async (requestedId: string) => {
      // Mock validation: ensure the tool only fetches for the authenticated ID
      if (requestedId !== userId) {
        throw new Error('Unauthorized data access attempt.');
      }
      return mockContext;
    }
  };

  const aiProvider = new MockAIProvider();
  let orchestrator: CoachAgentOrchestrator;

  beforeEach(() => {
    orchestrator = new CoachAgentOrchestrator(aiProvider, mockDataProvider);
  });

  it('securely routes request using verified user identity', async () => {
    const response = await orchestrator.handleRequest({ message: 'How did I do this week?' }, userId);
    expect(response.type).toBe('coaching_answer');
    expect(response.message).toBeDefined();
  });

  it('prevents cross-user data access (user isolation)', async () => {
    const response = await orchestrator.handleRequest({ message: 'How did I do this week?' }, 'hacker_user');
    expect(response.type).toBe('error');
    expect(response.supportingFacts?.errorReason).toContain('Unauthorized data access attempt');
  });

  it('validates structured response and handles malformed output', async () => {
    const response = await orchestrator.handleRequest({ message: 'malformed_trigger' }, userId);
    // Provider returns garbage, validator intercepts it
    expect(response.type).toBe('error');
    expect(response.supportingFacts?.errorReason).toContain('empty message');
  });

  it('rejects unsupported write tools (e.g. workout_generation) in M2', async () => {
    const response = await orchestrator.handleRequest({ message: 'unsupported_trigger' }, userId);
    expect(response.type).toBe('error');
    expect(response.supportingFacts?.errorReason).toContain('Workout generation is not yet supported');
  });

  it('only executes tools from the allowlist', async () => {
    const tools = new AgentTools(mockDataProvider);
    await expect(tools.executeTool('delete_database', userId))
      .rejects.toThrow('Unauthorized or unknown tool requested: delete_database');
  });

  it('controls tokens by routing specific intents to minimal context slices', async () => {
    const tools = new AgentTools(mockDataProvider);
    
    // Using weekly summary tool strips out full profile and heavy arrays
    const summarySlice = await tools.executeTool('get_weekly_summary', userId);
    expect(summarySlice.weeklySummary).toBeDefined();
    expect(summarySlice.profileSummary).toBeUndefined(); // Minimizes token bloat
  });
});
