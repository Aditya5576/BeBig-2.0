import { TrainingContext } from '../training/types';

export type CoachResponseType = 
  | 'coaching_answer'
  | 'progression_insight'
  | 'workout_generation'
  | 'weekly_summary'
  | 'recommendation'
  | 'clarification'
  | 'error';

export interface CoachRequest {
  message: string;
  intent?: string;
  // Note: userId is injected by the secure server boundary, NOT by this payload
}

export interface CoachResponse {
  type: CoachResponseType;
  message: string;
  supportingFacts?: Record<string, any>;
  suggestedActions?: string[];
  confidence?: number;
}

export interface CoachDataProvider {
  getTrainingContext(userId: string): Promise<TrainingContext>;
}
