import { MultiProviderAdapter, ProviderError, UsageTracker } from './types.ts';
import { CoachResponse } from '../agent/types.ts';
import { createFallbackResponse } from '../agent/validation.ts';

export class AIRouter {
  private providers: MultiProviderAdapter[];

  constructor(
    providers: MultiProviderAdapter[],
    private usageTracker: UsageTracker
  ) {
    // Sort providers by priority (lowest number = highest priority)
    this.providers = [...providers].sort((a, b) => {
      const pA = a.config.priority ?? 999;
      const pB = b.config.priority ?? 999;
      return pA - pB;
    });
  }

  async generateWithFailover(
    systemPrompt: string,
    userMessage: string,
    contextData: Record<string, any>,
    authenticatedUserId: string
  ): Promise<CoachResponse> {
    
    // Iterate through priority list sequentially
    for (const provider of this.providers) {
      if (!provider.isConfigured()) {
        continue;
      }

      console.log(`[AIRouter] Attempting provider: ${provider.providerName} (model: ${provider.config.model || provider.defaultModel})`);
      const startTime = Date.now();
      try {
        const response = await provider.generateStructuredResponse(
          systemPrompt, 
          userMessage, 
          contextData
        );
        
        const latency = Date.now() - startTime;
        console.log(`[AIRouter] Provider ${provider.providerName} SUCCEEDED in ${latency}ms`);
        this.usageTracker.trackUsage({
          providerName: provider.providerName,
          model: provider.config.model || provider.defaultModel,
          latencyMs: latency,
          success: true,
          timestamp: new Date().toISOString(),
          authenticatedUserId
        });

        return response;

      } catch (error: any) {
        const latency = Date.now() - startTime;
        
        this.usageTracker.trackUsage({
          providerName: provider.providerName,
          model: provider.config.model || provider.defaultModel,
          latencyMs: latency,
          success: false,
          failureReason: error.message || 'Unknown provider error',
          timestamp: new Date().toISOString(),
          authenticatedUserId
        });

        if (error instanceof ProviderError) {
          if (error.isRetryable) {
            console.warn(`[AIRouter] Retryable failover triggered from ${provider.providerName} (${error.message})`);
            continue;
          } else {
            console.error(`[AIRouter] Non-retryable error from ${provider.providerName}. Aborting failover. (${error.message})`);
            return createFallbackResponse('AI processing failed due to an unrecoverable request error.');
          }
        } else {
          console.warn(`[AIRouter] Unknown error from ${provider.providerName}. Attempting failover.`, error.message);
          continue;
        }
      }
    }

    // If we exhaust all providers
    console.error('[AIRouter] All AI providers in failover chain were exhausted.');
    return createFallbackResponse('All AI providers are currently unavailable. Please try again later.');
  }
}
