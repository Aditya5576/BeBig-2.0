import { AIProvider } from './aiProvider';
import { CoachRequest, CoachResponse, CoachDataProvider } from './types';
import { AgentTools } from './tools';
import { COACH_SYSTEM_PROMPT } from './systemPrompt';
import { validateCoachResponse, createFallbackResponse } from './validation';

export class CoachAgentOrchestrator {
  private tools: AgentTools;

  constructor(
    private aiProvider: AIProvider,
    dataProvider: CoachDataProvider
  ) {
    this.tools = new AgentTools(dataProvider);
  }

  /**
   * Main entry point for processing a coach request.
   * STRICT SECURITY BOUNDARY: `userId` is passed directly from the authenticated server layer, 
   * NEVER extracted from the user's unverified `request` payload.
   */
  async handleRequest(request: CoachRequest, authenticatedUserId: string): Promise<CoachResponse> {
    try {
      // 1. Token/Cost Control: Route Intent to Minimum Sufficient Context
      // Instead of pulling the entire training context blindly, we determine which tool to use.
      // For M2, we use a simple heuristic. In future, this could be a fast classification step.
      let toolName = 'get_training_context'; // Default
      
      const msg = request.message.toLowerCase();
      if (msg.includes('progress') || msg.includes('improve')) {
        toolName = 'get_exercise_progression';
      } else if (msg.includes('pr') || msg.includes('personal record')) {
        toolName = 'get_personal_records';
      } else if (msg.includes('week') || msg.includes('summary')) {
        toolName = 'get_weekly_summary';
      } else if (msg.includes('muscle') || msg.includes('balance') || msg.includes('volume')) {
        toolName = 'get_muscle_group_volume';
      }

      // 2. Execute Approved Tool with Scoped User Identity
      const contextData = await this.tools.executeTool(toolName, authenticatedUserId);

      // 3. Generate Response
      const rawResponse = await this.aiProvider.generateStructuredResponse(
        COACH_SYSTEM_PROMPT,
        request.message,
        contextData
      );

      // 4. Validate Response
      return validateCoachResponse(rawResponse);
      
    } catch (error: any) {
      // 5. Safe Fallback
      return createFallbackResponse(error.message || 'Internal Agent Error');
    }
  }
}
