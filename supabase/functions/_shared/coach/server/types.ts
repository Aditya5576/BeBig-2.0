import { AIProvider } from '../agent/aiProvider.ts';
import { CoachResponse } from '../agent/types.ts';

export interface UsageMetrics {
  providerName: string;
  model: string;
  latencyMs: number;
  estimatedTokens?: number;
  success: boolean;
  failureReason?: string;
  timestamp: string;
  authenticatedUserId: string;
}

export interface UsageTracker {
  trackUsage(metrics: UsageMetrics): void;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly isRetryable: boolean,
    public readonly providerName: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface BaseProviderConfig {
  apiKey?: string;
  model?: string;
}

export interface MultiProviderAdapter extends AIProvider {
  readonly providerName: string;
  readonly defaultModel: string;
  
  /**
   * Returns false if API keys are missing or invalidly configured.
   */
  isConfigured(): boolean;
}
