import { Exercise } from '../types';

export interface ExerciseFilterOptions {
  query?: string;
  category?: string;
  equipment?: string;
  muscle?: string;
  limit?: number;
  offset?: number;
}

export interface ExerciseListResult {
  exercises: Exercise[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
}

export interface IExerciseProvider {
  readonly providerId: string;
  listExercises(options?: ExerciseFilterOptions): Promise<ExerciseListResult>;
  getExerciseById(sourceId: string): Promise<Exercise | null>;
  searchExercises(query: string, options?: ExerciseFilterOptions): Promise<ExerciseListResult>;
}
