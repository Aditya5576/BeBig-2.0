import { CoachResponse } from './types';

export interface AIProvider {
  /**
   * Generates a structured response from the LLM based on system instructions, 
   * the user's message, and strictly controlled context data.
   */
  generateStructuredResponse(
    systemPrompt: string,
    userMessage: string,
    contextData: Record<string, any>
  ): Promise<CoachResponse>;
}

export class MockAIProvider implements AIProvider {
  async generateStructuredResponse(
    systemPrompt: string,
    userMessage: string,
    contextData: Record<string, any>
  ): Promise<CoachResponse> {
    // A deterministic mock for testing response parsing and agent flow
    // without requiring real LLM API keys or network calls.
    if (userMessage.includes('malformed')) {
      // Simulate an LLM returning garbage or missing required fields
      return { type: 'coaching_answer' } as any; 
    }

    if (userMessage.includes('unsupported')) {
      return { 
        type: 'workout_generation', 
        message: 'Here is a new workout...',
        supportingFacts: { writeAction: true } // Mocking a disallowed action
      };
    }

    return {
      type: 'coaching_answer',
      message: 'This is a mocked deterministic response based on your verified data.',
      supportingFacts: contextData,
      suggestedActions: ['Keep training!']
    };
  }
}
