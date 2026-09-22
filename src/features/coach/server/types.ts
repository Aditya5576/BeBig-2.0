import { AIProvider } from '../agent/aiProvider';
import { CoachResponse } from '../agent/types';

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
  enabled?: boolean;
  priority?: number;
  maxTokens?: number;
}

export interface MultiProviderAdapter extends AIProvider {
  readonly providerName: string;
  readonly defaultModel: string;
  readonly config: BaseProviderConfig;
  
  /**
   * Returns false if API keys are missing or invalidly configured.
   */
  isConfigured(): boolean;
}
