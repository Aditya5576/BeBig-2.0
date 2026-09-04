import { Exercise } from '../../types';
import { ExerciseFilterOptions, ExerciseListResult, IExerciseProvider } from '../types';
import { mapWgerToExercise } from './wgerMapper';
import { WgerExerciseInfoItem, WgerExerciseInfoResponse } from './wgerTypes';

const DEFAULT_BASE_URL = 'https://wger.de/api/v2';
const DEFAULT_TIMEOUT_MS = 10000;

// Wger category IDs mapping
const WGER_CATEGORY_IDS: Record<string, number> = {
  abs: 10,
  arms: 8,
  back: 12,
  calves: 14,
  cardio: 15,
  chest: 11,
  legs: 9,
  shoulders: 13,
};

export class WgerExerciseProvider implements IExerciseProvider {
  readonly providerId = 'wger';
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.EXPO_PUBLIC_WGER_API_URL || DEFAULT_BASE_URL;
  }

  private async fetchWithTimeout(
    url: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async listExercises(options: ExerciseFilterOptions = {}): Promise<ExerciseListResult> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    const url = new URL(`${this.baseUrl}/exerciseinfo/`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    if (options.category && WGER_CATEGORY_IDS[options.category.toLowerCase()]) {
      url.searchParams.set('category', String(WGER_CATEGORY_IDS[options.category.toLowerCase()]));
    }

    if (options.equipment) {
      url.searchParams.set('equipment', options.equipment);
    }

    if (options.query && options.query.trim().length > 0) {
      url.searchParams.set('search', options.query.trim());
    }

    try {
      const res = await this.fetchWithTimeout(url.toString());

      if (!res.ok) {
        throw new Error(`Wger API error: HTTP ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as WgerExerciseInfoResponse;
      const exercises = (data.results || []).map(mapWgerToExercise);

      const nextOffset = data.next ? offset + limit : undefined;
      const hasMore = Boolean(data.next);

      return {
        exercises,
        totalCount: data.count || 0,
        hasMore,
        nextOffset,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Exercise request timed out. Please check your network connection.');
      }
      throw err;
    }
  }

  async getExerciseById(sourceId: string): Promise<Exercise | null> {
    // Strip prefix if passed e.g. "wger_12" -> "12"
    const cleanId = sourceId.replace(/^wger_/, '');
    const url = `${this.baseUrl}/exerciseinfo/${cleanId}/`;

    try {
      const res = await this.fetchWithTimeout(url);

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        throw new Error(`Wger API error: HTTP ${res.status}`);
      }

      const item = (await res.json()) as WgerExerciseInfoItem;
      return mapWgerToExercise(item);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Exercise request timed out. Please check your network connection.');
      }
      throw err;
    }
  }

  async searchExercises(
    query: string,
    options: ExerciseFilterOptions = {},
  ): Promise<ExerciseListResult> {
    return this.listExercises({
      ...options,
      query,
    });
  }
}
