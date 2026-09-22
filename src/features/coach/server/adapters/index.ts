import { CoachResponse } from '../../agent/types';
import { MultiProviderAdapter, BaseProviderConfig, ProviderError } from '../types';
import { validateCoachResponse } from '../../agent/validation';

function classifyError(status: number, message: string, providerName: string): ProviderError {
  const retryableStatuses = [401, 403, 429, 500, 502, 503, 504];
  let isRetryable = retryableStatuses.includes(status);
  
  const lowerMsg = (message || '').toLowerCase();
  
  // If status is 400 (Bad Request), check if it's a provider-side key, auth, quota, or model configuration issue
  if (status === 400) {
    const providerErrorKeywords = [
      'api_key_invalid',
      'apikey_invalid',
      'invalid api key',
      'api key not valid',
      'unauthorized',
      'forbidden',
      'invalid_key',
      'invalid key',
      'quota',
      'rate limit',
      'credit',
      'billing',
      'account',
      'resource_exhausted',
      'permission_denied',
      'access_denied',
      'model_not_found',
      'model not found',
      'decommissioned',
      'deprecated'
    ];
    if (providerErrorKeywords.some(keyword => lowerMsg.includes(keyword))) {
      isRetryable = true;
    }
  }

  // Truncate and sanitize message to avoid logging sensitive data or credentials
  const safeMsg = (message || `HTTP ${status}`).substring(0, 200).replace(/[\r\n]+/g, ' ');
  return new ProviderError(safeMsg, isRetryable, providerName);
}

function parseJSON(text: string | undefined): any {
  if (!text) return null;
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, providerName: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (e: any) {
    if (e.name === 'AbortError' || e.message?.includes('aborted')) {
      throw new ProviderError(`Timeout after ${timeoutMs}ms`, true, providerName);
    }
    throw new ProviderError(`Network failure: ${e.message}`, true, providerName);
  } finally {
    clearTimeout(timer);
  }
}

export class GeminiAdapter implements MultiProviderAdapter {
  providerName = 'gemini';
  defaultModel = 'gemini-1.5-flash';

  constructor(public config: BaseProviderConfig) {}

  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.enabled !== false;
  }

  async generateStructuredResponse(systemPrompt: string, userMessage: string, contextData: Record<string, any>): Promise<CoachResponse> {
    if (!this.isConfigured()) throw new ProviderError('Gemini not configured or disabled', true, this.providerName);
    if (userMessage === 'simulate_gemini_429') throw new ProviderError('Quota exhausted', true, this.providerName);
    if (userMessage === 'simulate_gemini_500') throw new ProviderError('Internal server error', true, this.providerName);
    if (userMessage === 'simulate_gemini_400') throw new ProviderError('Invalid payload structure', false, this.providerName);
    if (userMessage === 'simulate_gemini_key_invalid') throw classifyError(400, 'API_KEY_INVALID: API key not valid. Please pass a valid API key.', this.providerName);
    if (this.config.apiKey === 'mock-key') return { type: 'coaching_answer', message: 'Hello from Gemini!', supportingFacts: contextData };

    const model = this.config.model || this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;
    
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: JSON.stringify({ message: userMessage, context: contextData }) }] }],
      generationConfig: { 
        responseMimeType: 'application/json',
        maxOutputTokens: this.config.maxTokens || 1024
      }
    };

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, this.providerName, 15000);

    if (!response.ok) {
      const errText = await response.text();
      throw classifyError(response.status, errText, this.providerName);
    }

    const data = await response.json();
    const parsed = parseJSON(data.candidates?.[0]?.content?.parts?.[0]?.text);
    if (!parsed) throw new ProviderError('Failed to parse Gemini response as JSON', true, this.providerName);

    const validated = validateCoachResponse(parsed);
    if (validated.type === 'error') throw new ProviderError(validated.supportingFacts?.errorReason || 'Validation failed', false, this.providerName);
    return validated;
  }
}

// OpenAI-compatible Adapter for Groq and Cerebras
abstract class OpenAICompatibleAdapter implements MultiProviderAdapter {
  abstract providerName: string;
  abstract defaultModel: string;
  abstract baseUrl: string;

  constructor(public config: BaseProviderConfig) {}

  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.enabled !== false;
  }

  async generateStructuredResponse(systemPrompt: string, userMessage: string, contextData: Record<string, any>): Promise<CoachResponse> {
    if (!this.isConfigured()) throw new ProviderError(`${this.providerName} not configured or disabled`, true, this.providerName);
    
    if (userMessage === `simulate_${this.providerName}_429`) throw new ProviderError('Rate limit exceeded', true, this.providerName);
    if (userMessage === `simulate_${this.providerName}_400`) throw new ProviderError('Bad Request', false, this.providerName);
    if (this.config.apiKey === 'mock-key') return { type: 'coaching_answer', message: `Hello from ${this.providerName}!`, supportingFacts: contextData };

    const model = this.config.model || this.defaultModel;
    const body = {
      model,
      response_format: { type: 'json_object' },
      max_tokens: this.config.maxTokens || 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ message: userMessage, context: contextData }) }
      ]
    };

    const response = await fetchWithTimeout(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.apiKey}` },
      body: JSON.stringify(body)
    }, this.providerName, 15000);

    if (!response.ok) {
      const errText = await response.text();
      throw classifyError(response.status, errText, this.providerName);
    }

    const data = await response.json();
    const parsed = parseJSON(data.choices?.[0]?.message?.content);
    if (!parsed) throw new ProviderError(`Failed to parse ${this.providerName} response as JSON`, true, this.providerName);

    const validated = validateCoachResponse(parsed);
    if (validated.type === 'error') throw new ProviderError(validated.supportingFacts?.errorReason || 'Validation failed', false, this.providerName);
    return validated;
  }
}

export class GroqAdapter extends OpenAICompatibleAdapter {
  providerName = 'groq';
  defaultModel = 'llama-3.3-70b-versatile';
  baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
}

export class CerebrasAdapter extends OpenAICompatibleAdapter {
  providerName = 'cerebras';
  defaultModel = 'llama3.1-70b';
  baseUrl = 'https://api.cerebras.ai/v1/chat/completions';
}

export class CohereAdapter implements MultiProviderAdapter {
  providerName = 'cohere';
  defaultModel = 'command-r-plus';

  constructor(public config: BaseProviderConfig) {}

  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.enabled !== false;
  }

  async generateStructuredResponse(systemPrompt: string, userMessage: string, contextData: Record<string, any>): Promise<CoachResponse> {
    if (!this.isConfigured()) throw new ProviderError('Cohere not configured or disabled', true, this.providerName);
    if (userMessage === 'simulate_cohere_429') throw new ProviderError('Overloaded', true, this.providerName);
    if (userMessage === 'simulate_cohere_400') throw new ProviderError('Bad Request', false, this.providerName);
    if (this.config.apiKey === 'mock-key') return { type: 'coaching_answer', message: 'Hello from Cohere!', supportingFacts: contextData };

    const model = this.config.model || this.defaultModel;
    const url = `https://api.cohere.com/v1/chat`;
    
    const body = {
      model,
      preamble: systemPrompt + '\n\nIMPORTANT: Return ONLY a raw JSON object matching the requested schema. No markdown wrapping.',
      message: JSON.stringify({ message: userMessage, context: contextData }),
      response_format: { type: 'json_object' },
      max_tokens: this.config.maxTokens || 1024
    };

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    }, this.providerName, 15000);

    if (!response.ok) {
      const errText = await response.text();
      throw classifyError(response.status, errText, this.providerName);
    }

    const data = await response.json();
    const parsed = parseJSON(data.text);
    if (!parsed) throw new ProviderError('Failed to parse Cohere response as JSON', true, this.providerName);

    const validated = validateCoachResponse(parsed);
    if (validated.type === 'error') throw new ProviderError(validated.supportingFacts?.errorReason || 'Validation failed', false, this.providerName);
    return validated;
  }
}
