import { CoachRequest, CoachResponse, CoachDataProvider } from '../agent/types';
import { CoachAgentOrchestrator } from '../agent/agentOrchestrator';
import { AIRouter } from './aiRouter';
import { MultiProviderAdapter } from './types';
import { UsageTracker } from './types';
import { createFallbackResponse } from '../agent/validation';

/**
 * An AIProvider implementation that wraps the multi-provider AIRouter.
 * This satisfies the M2 CoachAgentOrchestrator's expectation of a single AIProvider.
 */
class GatewayAIProviderWrapper {
  constructor(
    private router: AIRouter, 
    private authenticatedUserId: string
  ) {}

  async generateStructuredResponse(
    systemPrompt: string,
    userMessage: string,
    contextData: Record<string, any>
  ): Promise<CoachResponse> {
    return this.router.generateWithFailover(systemPrompt, userMessage, contextData, this.authenticatedUserId);
  }
}

/**
 * This represents the secure server-side boundary (e.g., Supabase Edge Function).
 * It completely controls the initialization of providers from environment variables,
 * strictly enforces JWT-derived authenticatedUserId, and encapsulates the AI Router.
 */
export class SecureEdgeGateway {
  private router: AIRouter;

  constructor(
    providers: MultiProviderAdapter[],
    usageTracker: UsageTracker,
    private dataProvider: CoachDataProvider
  ) {
    // Configurable provider priority is established by the order in the array
    this.router = new AIRouter(providers, usageTracker);
  }

  /**
   * The single entry point for a Coach inference request.
   * 
   * @param rawRequest - The unverified payload from the client.
   * @param verifiedJwtUserId - The securely verified user ID extracted from the Edge Function's request context (e.g., Supabase Auth JWT).
   */
  async handleInferenceRequest(
    rawRequest: any,
    verifiedJwtUserId: string
  ): Promise<CoachResponse> {
    
    // 1. Strict User Isolation: Overwrite/ignore any client-provided ID
    if (!verifiedJwtUserId || verifiedJwtUserId.trim() === '') {
      return createFallbackResponse('Unauthorized: Invalid JWT context.');
    }

    // 2. Validate Request Shape
    if (!rawRequest || typeof rawRequest.message !== 'string') {
      return createFallbackResponse('Bad Request: Invalid message format.');
    }

    const request: CoachRequest = {
      message: rawRequest.message,
      intent: rawRequest.intent
    };

    // 3. Bind AI Router to the authenticated user scope
    const aiProviderWrapper = new GatewayAIProviderWrapper(this.router, verifiedJwtUserId);

    // 4. Initialize Orchestrator with Gateway components
    const orchestrator = new CoachAgentOrchestrator(aiProviderWrapper, this.dataProvider);

    // 5. Execute M2 Agent Flow
    return await orchestrator.handleRequest(request, verifiedJwtUserId);
  }
}
