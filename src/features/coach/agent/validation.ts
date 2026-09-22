import { CoachResponse, CoachResponseType } from './types';

const ALLOWED_RESPONSE_TYPES = new Set<CoachResponseType>([
  'coaching_answer',
  'progression_insight',
  'workout_generation',
  'weekly_summary',
  'recommendation',
  'clarification',
  'error'
]);

export function validateCoachResponse(response: any): CoachResponse {
  // 1. Check for null or undefined
  if (!response || typeof response !== 'object') {
    return createFallbackResponse('Received invalid response format from AI provider.');
  }

  // 2. Validate Response Type
  if (!response.type || !ALLOWED_RESPONSE_TYPES.has(response.type as CoachResponseType)) {
    return createFallbackResponse('Received unsupported response type from AI provider.');
  }

  // 3. Prevent Write Actions (M2 requirement)
  // If the model tries to return a workout_generation type in M2, we block it for now
  // since "No template creation yet" and "No write actions" are strict rules.
  if (response.type === 'workout_generation') {
    return createFallbackResponse('Workout generation is not yet supported in this version.');
  }

  // 4. Validate Required Message
  if (typeof response.message !== 'string' || response.message.trim().length === 0) {
    return createFallbackResponse('Received empty message from AI provider.');
  }

  return response as CoachResponse;
}

export function createFallbackResponse(reason: string): CoachResponse {
  return {
    type: 'error',
    message: 'I encountered an issue processing your request. Please try again.',
    supportingFacts: { errorReason: reason }
  };
}
