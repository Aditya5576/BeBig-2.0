import { SecureEdgeGateway } from '../src/features/coach/server/edgeHandler';
import { GeminiAdapter, GroqAdapter, CerebrasAdapter, CohereAdapter } from '../src/features/coach/server/adapters';
import { InMemoryUsageTracker } from '../src/features/coach/server/usageTracker';
import { CoachDataProvider } from '../src/features/coach/agent/types';
import { TrainingContext } from '../src/features/coach/training/types';

describe('M4B: Secure Multi-Provider AI Gateway & Sequential Failover', () => {
  const verifiedUserId = 'jwt_user_abc';
  
  const mockContext: TrainingContext = {
    userId: verifiedUserId,
    profileSummary: {},
    recentWorkouts: [],
    workoutsThisWeek: 0,
    workoutsThisMonth: 0,
    weeklyVolume: 0,
    allTimeVolume: 0,
    recentProgressions: [],
    personalRecords: [],
    muscleGroupVolumes: [],
    weeklySummary: {
      workoutsCompleted: 0,
      totalSets: 0,
      totalVolume: 0,
      prCount: 0,
      strongestImprovement: null
    }
  };

  const mockDataProvider: CoachDataProvider = {
    getTrainingContext: jest.fn().mockResolvedValue(mockContext)
  };

  let tracker: InMemoryUsageTracker;
  let gateway: SecureEdgeGateway;

  beforeEach(() => {
    tracker = new InMemoryUsageTracker();
    const gemini = new GeminiAdapter({ apiKey: 'mock-key', priority: 1 });
    const groq = new GroqAdapter({ apiKey: 'mock-key', priority: 2 });
    const cerebras = new CerebrasAdapter({ apiKey: 'mock-key', priority: 3 });
    const cohere = new CohereAdapter({ apiKey: 'mock-key', priority: 4 });
    
    gateway = new SecureEdgeGateway([gemini, groq, cerebras, cohere], tracker, mockDataProvider);
  });

  it('Scenario 1: Gemini success -> Gemini called -> Groq NOT called', async () => {
    const response = await gateway.handleInferenceRequest({ message: 'Hello' }, verifiedUserId);
    expect(response.type).toBe('coaching_answer');
    expect(response.message).toMatch(/gemini/i);
    
    const logs = tracker.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].providerName).toBe('gemini');
    expect(logs[0].success).toBe(true);
  });

  it('Scenario 2: Gemini API_KEY_INVALID -> Groq called -> Gemini not retried repeatedly', async () => {
    const response = await gateway.handleInferenceRequest({ message: 'simulate_gemini_key_invalid' }, verifiedUserId);
    expect(response.type).toBe('coaching_answer');
    expect(response.message).toMatch(/groq/i);
    
    const logs = tracker.getLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].providerName).toBe('gemini');
    expect(logs[0].success).toBe(false);
    expect(logs[0].failureReason).toContain('API_KEY_INVALID');
    expect(logs[1].providerName).toBe('groq');
    expect(logs[1].success).toBe(true);
  });

  it('Scenario 3: Gemini 429 -> Groq called', async () => {
    const response = await gateway.handleInferenceRequest({ message: 'simulate_gemini_429' }, verifiedUserId);
    expect(response.type).toBe('coaching_answer');
    expect(response.message).toMatch(/groq/i);
    
    const logs = tracker.getLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].providerName).toBe('gemini');
    expect(logs[0].success).toBe(false);
    expect(logs[0].failureReason).toContain('Quota exhausted');
    expect(logs[1].providerName).toBe('groq');
    expect(logs[1].success).toBe(true);
  });

  it('Scenario 4: Gemini 500 -> Groq called', async () => {
    const response = await gateway.handleInferenceRequest({ message: 'simulate_gemini_500' }, verifiedUserId);
    expect(response.type).toBe('coaching_answer');
    expect(response.message).toMatch(/groq/i);
    
    const logs = tracker.getLogs();
    expect(logs[0].providerName).toBe('gemini');
    expect(logs[0].success).toBe(false);
    expect(logs[1].providerName).toBe('groq');
    expect(logs[1].success).toBe(true);
  });

  it('Scenario 5 & 6: Gemini fails, Groq succeeds -> response from Groq -> Cerebras/Cohere NOT called', async () => {
    const response = await gateway.handleInferenceRequest({ message: 'simulate_gemini_429' }, verifiedUserId);
    expect(response.message).toMatch(/groq/i);
    
    const logs = tracker.getLogs();
    expect(logs.length).toBe(2);
    expect(logs.map(l => l.providerName)).toEqual(['gemini', 'groq']);
  });

  it('Scenario 7: Gemini fails, Groq fails, Cerebras succeeds -> Cohere NOT called', async () => {
    const customTracker = new InMemoryUsageTracker();
    const g = new GeminiAdapter({ apiKey: 'mock-key', priority: 1 });
    g.generateStructuredResponse = async () => { throw new Error('Network timeout'); };
    const gr = new GroqAdapter({ apiKey: 'mock-key', priority: 2 });
    gr.generateStructuredResponse = async () => { throw new Error('API down'); };
    const cer = new CerebrasAdapter({ apiKey: 'mock-key', priority: 3 });
    const coh = new CohereAdapter({ apiKey: 'mock-key', priority: 4 });

    const cascadeGateway = new SecureEdgeGateway([g, gr, cer, coh], customTracker, mockDataProvider);
    const response = await cascadeGateway.handleInferenceRequest({ message: 'Hello' }, verifiedUserId);

    expect(response.message).toMatch(/cerebras/i);
    const logs = customTracker.getLogs();
    expect(logs.length).toBe(3);
    expect(logs.map(l => l.providerName)).toEqual(['gemini', 'groq', 'cerebras']);
  });

  it('Scenario 8: Gemini, Groq, Cerebras fail, Cohere succeeds -> response returned', async () => {
    const customTracker = new InMemoryUsageTracker();
    const g = new GeminiAdapter({ apiKey: 'mock-key', priority: 1 });
    g.generateStructuredResponse = async () => { throw new Error('Fail 1'); };
    const gr = new GroqAdapter({ apiKey: 'mock-key', priority: 2 });
    gr.generateStructuredResponse = async () => { throw new Error('Fail 2'); };
    const cer = new CerebrasAdapter({ apiKey: 'mock-key', priority: 3 });
    cer.generateStructuredResponse = async () => { throw new Error('Fail 3'); };
    const coh = new CohereAdapter({ apiKey: 'mock-key', priority: 4 });

    const cascadeGateway = new SecureEdgeGateway([g, gr, cer, coh], customTracker, mockDataProvider);
    const response = await cascadeGateway.handleInferenceRequest({ message: 'Hello' }, verifiedUserId);

    expect(response.message).toMatch(/cohere/i);
    const logs = customTracker.getLogs();
    expect(logs.length).toBe(4);
    expect(logs.map(l => l.providerName)).toEqual(['gemini', 'groq', 'cerebras', 'cohere']);
  });

  it('Scenario 9: All providers fail -> safe generic error returned', async () => {
    const customTracker = new InMemoryUsageTracker();
    const g = new GeminiAdapter({ apiKey: 'mock-key', priority: 1 });
    g.generateStructuredResponse = async () => { throw new Error('Fail 1'); };
    const gr = new GroqAdapter({ apiKey: 'mock-key', priority: 2 });
    gr.generateStructuredResponse = async () => { throw new Error('Fail 2'); };
    const cascadeGateway = new SecureEdgeGateway([g, gr], customTracker, mockDataProvider);

    const response = await cascadeGateway.handleInferenceRequest({ message: 'Hello' }, verifiedUserId);
    expect(response.type).toBe('error');
    expect(response.message).toContain('I encountered an issue processing your request');
  });

  it('Scenario 10: Provider calls are strictly sequential, one at a time', async () => {
    const executionOrder: string[] = [];
    const customTracker = new InMemoryUsageTracker();

    const g = new GeminiAdapter({ apiKey: 'mock-key', priority: 1 });
    g.generateStructuredResponse = async () => {
      executionOrder.push('gemini_start');
      await new Promise(r => setTimeout(r, 20));
      executionOrder.push('gemini_end');
      throw new Error('Fail gemini');
    };

    const gr = new GroqAdapter({ apiKey: 'mock-key', priority: 2 });
    gr.generateStructuredResponse = async () => {
      executionOrder.push('groq_start');
      await new Promise(r => setTimeout(r, 20));
      executionOrder.push('groq_end');
      return { type: 'coaching_answer', message: 'Groq OK' };
    };

    const cascadeGateway = new SecureEdgeGateway([g, gr], customTracker, mockDataProvider);
    await cascadeGateway.handleInferenceRequest({ message: 'Hello' }, verifiedUserId);

    // Verify gemini completed BEFORE groq started (sequential)
    expect(executionOrder).toEqual(['gemini_start', 'gemini_end', 'groq_start', 'groq_end']);
  });

  it('Scenario 11: API keys never appear in logs or error messages', async () => {
    const response = await gateway.handleInferenceRequest({ message: 'simulate_gemini_key_invalid' }, verifiedUserId);
    const logs = tracker.getLogs();
    expect(JSON.stringify(logs)).not.toContain('mock-key');
    expect(JSON.stringify(response)).not.toContain('mock-key');
  });

  it('Scenario 12: Malformed internal request does not trigger four provider calls', async () => {
    const response = await gateway.handleInferenceRequest({ message: 'simulate_gemini_400' }, verifiedUserId);
    expect(response.type).toBe('error');
    
    const logs = tracker.getLogs();
    expect(logs.length).toBe(1); // Aborted after 1 attempt because malformed payload isn't retryable
    expect(logs[0].providerName).toBe('gemini');
  });
});
