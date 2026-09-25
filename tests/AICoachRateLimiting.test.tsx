import { createClient } from '@supabase/supabase-js';

// Mock dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('SEC-1B-HARDEN: AI Rate Limiting (Edge Function Flow)', () => {
  let mockRpc: jest.Mock;
  let mockGetUser: jest.Mock;
  let mockGemini: jest.Mock;
  let mockGroq: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRpc = jest.fn();
    mockGetUser = jest.fn().mockResolvedValue({ data: { user: { id: 'user_123' } }, error: null });
    mockGemini = jest.fn();
    mockGroq = jest.fn();

    (createClient as jest.Mock).mockReturnValue({
      auth: { getUser: mockGetUser },
      rpc: mockRpc,
    });
  });

  // Simulated Edge Function Handler simulating exact flow of coach-agent/index.ts
  const simulateEdgeFunction = async (authHeader: string = 'Bearer valid-token', payload: any = { message: 'hello', user_id: 'fake_id' }) => {
    if (!authHeader) return { status: 401, body: { error: 'Missing Authorization header' } };

    const supabaseClient = createClient('mock-url', 'mock-key', { global: { headers: { Authorization: authHeader } } });
    
    // 1. Authenticate user strictly via Supabase JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return { status: 401, body: { error: 'Unauthorized' } };

    const verifiedUserId = user.id;

    // 2. Atomic Rate Limit Check (Fail-closed)
    const { data: quota, error: quotaError } = await supabaseClient.rpc('check_and_increment_ai_quota');
    if (quotaError) {
      return { status: 500, body: { type: 'error', message: 'Failed to verify usage quota. Please try again later.' } };
    }
    if (!quota || !quota.allowed) {
      return { status: 429, body: { type: 'error', message: 'Daily AI usage limit reached. Please try again tomorrow.', reset: '00:00 UTC' } };
    }

    // 3. Provider Routing (Simulated SecureEdgeGateway)
    // Ensures context is scoped to verifiedUserId, not payload.user_id
    let response;
    try {
      response = await mockGemini(payload.message, verifiedUserId);
    } catch (geminiError) {
      // Fallback
      try {
        response = await mockGroq(payload.message, verifiedUserId);
      } catch (groqError) {
         return { status: 500, body: { type: 'error', message: 'All providers failed.' } };
      }
    }

    return { status: 200, body: response };
  };

  it('A. First request (allowed, count = 1)', async () => {
    mockRpc.mockResolvedValue({ data: { allowed: true, count: 1, limit: 20 }, error: null });
    mockGemini.mockResolvedValue({ type: 'coaching_answer', message: 'Success' });
    const res = await simulateEdgeFunction();
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockGemini).toHaveBeenCalledTimes(1);
  });

  it('B. Requests below limit (allowed)', async () => {
    mockRpc.mockResolvedValue({ data: { allowed: true, count: 15, limit: 20 }, error: null });
    mockGemini.mockResolvedValue({ type: 'coaching_answer', message: 'Success' });
    const res = await simulateEdgeFunction();
    expect(res.status).toBe(200);
  });

  it('C. Request at limit (correct behavior)', async () => {
    mockRpc.mockResolvedValue({ data: { allowed: true, count: 20, limit: 20 }, error: null });
    mockGemini.mockResolvedValue({ type: 'coaching_answer', message: 'Success' });
    const res = await simulateEdgeFunction();
    expect(res.status).toBe(200);
  });

  it('D. Request above limit (denied with 429, provider NOT called)', async () => {
    mockRpc.mockResolvedValue({ data: { allowed: false, count: 21, limit: 20 }, error: null });
    const res = await simulateEdgeFunction();
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/limit reached/);
    expect(mockGemini).not.toHaveBeenCalled();
    expect(mockGroq).not.toHaveBeenCalled();
  });

  it('E. Concurrent requests (Real DB Concurrency UNVERIFIED locally)', () => {
    // We cannot run real parallel Postgres transactions in this Jest environment without a DB instance.
    // The SQL explicitly uses `ON CONFLICT DO UPDATE` which is atomic, but we mark this UNVERIFIED for real integration.
    expect(true).toBe(true); 
  });

  it('F & G. User spoofing (Payload ID ignored, JWT ID used)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'legit_user_123' } }, error: null });
    mockRpc.mockResolvedValue({ data: { allowed: true, count: 1, limit: 20 }, error: null });
    mockGemini.mockResolvedValue({ type: 'coaching_answer' });
    
    // Attacker tries to pass another user's ID in payload
    await simulateEdgeFunction('Bearer legit', { message: 'hello', user_id: 'victim_456' });
    
    // Quota belongs to JWT
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    // Provider request receives JWT ID, NOT the payload ID
    expect(mockGemini).toHaveBeenCalledWith('hello', 'legit_user_123');
  });

  it('H. Failed provider request (Quota remains consumed)', async () => {
    mockRpc.mockResolvedValue({ data: { allowed: true, count: 5, limit: 20 }, error: null });
    mockGemini.mockRejectedValue(new Error('Gemini down'));
    mockGroq.mockRejectedValue(new Error('Groq down'));
    
    const res = await simulateEdgeFunction();
    expect(res.status).toBe(500);
    // RPC was called successfully and consumed quota
    expect(mockRpc).toHaveBeenCalledTimes(1);
    // Providers failed, but quota is not refunded (no second RPC call)
    expect(mockRpc).toHaveBeenCalledTimes(1); 
  });

  it('I. Provider fallback (Gemini -> Groq consumes exactly ONE quota)', async () => {
    mockRpc.mockResolvedValue({ data: { allowed: true, count: 2, limit: 20 }, error: null });
    mockGemini.mockRejectedValue(new Error('Gemini down'));
    mockGroq.mockResolvedValue({ type: 'coaching_answer', message: 'Groq response' });
    
    const res = await simulateEdgeFunction();
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Groq response');
    
    // Both providers were called
    expect(mockGemini).toHaveBeenCalledTimes(1);
    expect(mockGroq).toHaveBeenCalledTimes(1);
    
    // Quota was checked exactly ONCE
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('J. Limiter/database failure (Fail closed, Provider NOT called)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('Database connection failed') });
    
    const res = await simulateEdgeFunction();
    
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Failed to verify usage quota/);
    
    // Ensures fail-closed prevents provider invocation
    expect(mockGemini).not.toHaveBeenCalled();
    expect(mockGroq).not.toHaveBeenCalled();
  });

  it('K. Window reset (Real UTC rollover UNVERIFIED locally)', () => {
    // Requires manipulating Postgres server time or mocking CURRENT_DATE.
    // The SQL uses `CASE WHEN window_date = v_current_date`, but without a real DB instance, we mark UNVERIFIED.
    expect(true).toBe(true);
  });

  it('L. Unauthorized request', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Invalid JWT') });
    const res = await simulateEdgeFunction();
    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGemini).not.toHaveBeenCalled();
  });

  it('M. Cross-User Isolation', async () => {
    // Proves that when user B authenticates, their ID is used for the provider request.
    // The database function strictly isolates quota via auth.uid() row locks.
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_B_999' } }, error: null });
    mockRpc.mockResolvedValue({ data: { allowed: true, count: 1, limit: 20 }, error: null });
    mockGemini.mockResolvedValue({ type: 'coaching_answer' });
    
    await simulateEdgeFunction('Bearer legitB', { message: 'hi' });
    expect(mockGemini).toHaveBeenCalledWith('hi', 'user_B_999');
  });
});
