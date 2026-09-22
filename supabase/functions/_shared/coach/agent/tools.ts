import { TrainingContext } from '../training/types.ts';
import { CoachDataProvider } from './types.ts';

export type AllowedToolName = 
  | 'get_training_context'
  | 'get_exercise_progression'
  | 'get_personal_records'
  | 'get_training_volume'
  | 'get_weekly_summary'
  | 'get_muscle_group_volume';

// Note: NO write tools exist here by strict M2 requirement.
export const ALLOWED_TOOLS = new Set<string>([
  'get_training_context',
  'get_exercise_progression',
  'get_personal_records',
  'get_training_volume',
  'get_weekly_summary',
  'get_muscle_group_volume'
]);

export class AgentTools {
  constructor(private dataProvider: CoachDataProvider) {}

  async executeTool(toolName: string, userId: string): Promise<Record<string, any>> {
    if (!ALLOWED_TOOLS.has(toolName)) {
      throw new Error(`Unauthorized or unknown tool requested: ${toolName}`);
    }

    // Tools operate ONLY on the securely authenticated userId
    const context = await this.dataProvider.getTrainingContext(userId);

    switch (toolName as AllowedToolName) {
      case 'get_training_context':
        return context;
      
      case 'get_exercise_progression':
        return { recentProgressions: context.recentProgressions };
      
      case 'get_personal_records':
        return { personalRecords: context.personalRecords };
      
      case 'get_training_volume':
        return { 
          weeklyVolume: context.weeklyVolume,
          allTimeVolume: context.allTimeVolume,
          workoutsThisWeek: context.workoutsThisWeek,
          workoutsThisMonth: context.workoutsThisMonth
        };
      
      case 'get_weekly_summary':
        return { weeklySummary: context.weeklySummary };
      
      case 'get_muscle_group_volume':
        return { muscleGroupVolumes: context.muscleGroupVolumes };
        
      default:
        throw new Error('Unreachable tool execution path.');
    }
  }
}
