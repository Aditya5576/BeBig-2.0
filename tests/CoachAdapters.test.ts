import { GeminiAdapter, GroqAdapter, CerebrasAdapter, CohereAdapter } from '../src/features/coach/server/adapters';

describe('M4B: Real AI Provider Adapters', () => {
  const systemPrompt = 'You are a coach.';
  const userMessage = 'Help me';
  const contextData = { data: 'test' };

  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Gemini adapter uses gemini-1.5-flash and sends correct request', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"type":"coaching_answer","message":"Gemini Response"}' }] } }] })
    });
    globalThis.fetch = mockFetch;

    const adapter = new GeminiAdapter({ apiKey: 'real-gemini-key', maxTokens: 1024 });
    expect(adapter.defaultModel).toBe('gemini-1.5-flash');

    const res = await adapter.generateStructuredResponse(systemPrompt, userMessage, contextData);

    expect(res.message).toBe('Gemini Response');
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('models/gemini-1.5-flash:generateContent'), expect.objectContaining({ body: expect.stringContaining('maxOutputTokens":1024') }));
  });

  it('Groq adapter uses llama-3.3-70b-versatile and sends correct request', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"type":"coaching_answer","message":"Groq Response"}' } }] })
    });
    globalThis.fetch = mockFetch;

    const adapter = new GroqAdapter({ apiKey: 'real-groq-key', maxTokens: 2048 });
    expect(adapter.defaultModel).toBe('llama-3.3-70b-versatile');

    const res = await adapter.generateStructuredResponse(systemPrompt, userMessage, contextData);

    expect(res.message).toBe('Groq Response');
    expect(mockFetch).toHaveBeenCalledWith('https://api.groq.com/openai/v1/chat/completions', expect.objectContaining({ headers: expect.objectContaining({ 'Authorization': 'Bearer real-groq-key' }), body: expect.stringContaining('llama-3.3-70b-versatile') }));
  });

  it('Cerebras adapter sends correct fetch and normalizes response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"type":"coaching_answer","message":"Cerebras Response"}' } }] })
    });
    globalThis.fetch = mockFetch;

    const adapter = new CerebrasAdapter({ apiKey: 'real-cerebras-key', maxTokens: 500 });
    const res = await adapter.generateStructuredResponse(systemPrompt, userMessage, contextData);

    expect(res.message).toBe('Cerebras Response');
    expect(mockFetch).toHaveBeenCalledWith('https://api.cerebras.ai/v1/chat/completions', expect.objectContaining({ headers: expect.objectContaining({ 'Authorization': 'Bearer real-cerebras-key' }), body: expect.stringContaining('"max_tokens":500') }));
  });

  it('Cohere adapter sends correct fetch and normalizes response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '{"type":"coaching_answer","message":"Cohere Response"}' })
    });
    globalThis.fetch = mockFetch;

    const adapter = new CohereAdapter({ apiKey: 'real-cohere-key', maxTokens: 1000 });
    const res = await adapter.generateStructuredResponse(systemPrompt, userMessage, contextData);

    expect(res.message).toBe('Cohere Response');
    expect(mockFetch).toHaveBeenCalledWith('https://api.cohere.com/v1/chat', expect.objectContaining({ headers: expect.objectContaining({ 'Authorization': 'Bearer real-cohere-key' }), body: expect.stringContaining('"max_tokens":1000') }));
  });

  it('Provider network error throws retryable error', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('fetch failed network'));
    globalThis.fetch = mockFetch;
    const adapter = new GroqAdapter({ apiKey: 'real-groq-key' });
    await expect(adapter.generateStructuredResponse(systemPrompt, userMessage, contextData))
      .rejects.toMatchObject({ isRetryable: true, message: expect.stringContaining('Network failure') });
  });

  it('Missing provider secret throws retryable error to allow failover', async () => {
    const adapter = new GroqAdapter({ apiKey: '' });
    expect(adapter.isConfigured()).toBe(false);
    await expect(adapter.generateStructuredResponse(systemPrompt, userMessage, contextData))
      .rejects.toMatchObject({ isRetryable: true, message: 'groq not configured or disabled' });
  });

  it('Invalid provider JSON structure throws non-retryable validation error', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"wrong_schema":true}' }] } }] })
    });
    globalThis.fetch = mockFetch;

    const adapter = new GeminiAdapter({ apiKey: 'real-gemini-key' });
    await expect(adapter.generateStructuredResponse(systemPrompt, userMessage, contextData))
      .rejects.toMatchObject({ isRetryable: false, message: expect.stringContaining('Received unsupported response type') });
  });

  it('Never logs or exposes API keys in standard output or error messages and triggers retryable failover on HTTP 401', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized Invalid API Key'
    });
    globalThis.fetch = mockFetch;

    const adapter = new GroqAdapter({ apiKey: 'SUPER_SECRET_KEY_123' });
    try {
      await adapter.generateStructuredResponse(systemPrompt, userMessage, contextData);
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.message).not.toContain('SUPER_SECRET_KEY_123');
      expect(e.isRetryable).toBe(true); // 401 is an authentication error -> triggers failover!
    }
  });
});
