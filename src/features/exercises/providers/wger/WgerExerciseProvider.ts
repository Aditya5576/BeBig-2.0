import { Exercise } from '../../types';
import { ExerciseFilterOptions, ExerciseListResult, IExerciseProvider } from '../types';
import { mapWgerToExercise, mapWgerCatalogRecordToExercise } from './wgerMapper';
import { WgerExerciseInfoItem, WgerExerciseInfoResponse } from './wgerTypes';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabase';
import {
  isDeviceOffline,
  isMissingSchemaError,
  isRemoteResourceBackedOff,
  markRemoteResourceMissing,
  withSafeTimeout,
} from '../../../../lib/supabase/resilience';

const DEFAULT_BASE_URL = 'https://wger.de/api/v2';
const DEFAULT_TIMEOUT_MS = 10000;
const WGER_CATALOG_RESOURCE_KEY = 'table:wger_exercise_catalog';


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
  private inFlightListRequests = new Map<string, Promise<ExerciseListResult>>();
  private inFlightDetailRequests = new Map<string, Promise<Exercise | null>>();

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

    const cacheKey = url.toString();
    const existing = this.inFlightListRequests.get(cacheKey);
    if (existing) {
      return existing;
    }

    const requestPromise = (async (): Promise<ExerciseListResult> => {
      // 1. Try server-side fast cached catalog first (eliminating mobile CORS & latency)
      if (
        isSupabaseConfigured() &&
        !isDeviceOffline() &&
        !isRemoteResourceBackedOff(WGER_CATALOG_RESOURCE_KEY)
      ) {
        try {
          let queryBuilder = supabase
            .from('wger_exercise_catalog')
            .select(
              'id, wger_id, name, description, category, primary_muscles, secondary_muscles, equipment, image_url, license_name, license_author, attribution_text, is_active',
              { count: 'exact' }
            )
            .eq('is_active', true);

          if (options.category && options.category !== 'all') {
            queryBuilder = queryBuilder.eq('category', options.category.toLowerCase());
          }

          if (options.query && options.query.trim().length > 0) {
            queryBuilder = queryBuilder.ilike('name', `%${options.query.trim()}%`);
          }

          const from = offset;
          const to = offset + limit - 1;
          queryBuilder = queryBuilder.range(from, to).order('name', { ascending: true });

          const timeoutResult = await withSafeTimeout(
            queryBuilder,
            3500,
            { data: null, count: null, error: new Error('Timeout') } as any
          );

          if (timeoutResult.error) {
            if (isMissingSchemaError(timeoutResult.error)) {
              markRemoteResourceMissing(WGER_CATALOG_RESOURCE_KEY);
            }
          } else if (Array.isArray(timeoutResult.data) && timeoutResult.data.length > 0) {
            const exercises: Exercise[] = [];
            for (const row of timeoutResult.data) {
              const mapped = mapWgerCatalogRecordToExercise(row);
              if (mapped) exercises.push(mapped);
            }
            const total = typeof timeoutResult.count === 'number' ? timeoutResult.count : exercises.length;
            const hasMore = offset + limit < total;
            return {
              exercises,
              totalCount: total,
              hasMore,
              nextOffset: hasMore ? offset + limit : undefined,
            };
          }
        } catch {
          // Fall through to direct Wger API fetch
        }
      }

      // 2. Fallback to direct Wger API fetch (or when catalog table is empty)
      try {
        const res = await this.fetchWithTimeout(cacheKey);

        if (!res.ok) {
          throw new Error(`Wger API error: HTTP ${res.status} ${res.statusText}`);
        }

        let raw: any;
        try {
          raw = await res.json();
        } catch {
          throw new Error('Malformed Wger response: invalid JSON');
        }

        if (!raw || typeof raw !== 'object') {
          return {
            exercises: [],
            totalCount: 0,
            hasMore: false,
          };
        }

        const data = raw as WgerExerciseInfoResponse;
        const rawResults = Array.isArray(data.results) ? data.results : [];
        const exercises: Exercise[] = [];
        for (const item of rawResults) {
          try {
            const mapped = mapWgerToExercise(item);
            if (mapped) exercises.push(mapped);
          } catch {
            // Skip individually malformed item without failing the entire batch
          }
        }

        const nextOffset = data.next ? offset + limit : undefined;
        const hasMore = Boolean(data.next);

        return {
          exercises,
          totalCount: typeof data.count === 'number' ? data.count : exercises.length,
          hasMore,
          nextOffset,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('Exercise request timed out. Please check your network connection.');
        }
        throw err;
      } finally {
        this.inFlightListRequests.delete(cacheKey);
      }
    })();

    this.inFlightListRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  async getExerciseById(sourceId: string): Promise<Exercise | null> {
    // Strip prefix if passed e.g. "wger_12" -> "12"
    const cleanId = sourceId.replace(/^wger_/, '');
    const url = `${this.baseUrl}/exerciseinfo/${cleanId}/`;

    const existing = this.inFlightDetailRequests.get(url);
    if (existing) {
      return existing;
    }

    const requestPromise = (async (): Promise<Exercise | null> => {
      // 1. Try server-side fast cached catalog first
      const numId = Number(cleanId);
      if (
        isSupabaseConfigured() &&
        !isDeviceOffline() &&
        !isRemoteResourceBackedOff(WGER_CATALOG_RESOURCE_KEY) &&
        !isNaN(numId)
      ) {
        try {
          const timeoutResult = await withSafeTimeout(
            supabase
              .from('wger_exercise_catalog')
              .select('*')
              .eq('wger_id', numId)
              .maybeSingle(),
            3000,
            { data: null, error: new Error('Timeout') } as any
          );

          if (timeoutResult.error) {
            if (isMissingSchemaError(timeoutResult.error)) {
              markRemoteResourceMissing(WGER_CATALOG_RESOURCE_KEY);
            }
          } else if (timeoutResult.data) {
            const mapped = mapWgerCatalogRecordToExercise(timeoutResult.data);
            if (mapped) return mapped;
          }
        } catch {
          // Fall through to direct Wger API fetch
        }
      }

      // 2. Fallback to direct Wger API fetch
      try {
        const res = await this.fetchWithTimeout(url);

        if (res.status === 404) {
          return null;
        }

        if (!res.ok) {
          throw new Error(`Wger API error: HTTP ${res.status}`);
        }

        let item: any;
        try {
          item = await res.json();
        } catch {
          return null;
        }

        if (!item || typeof item !== 'object' || item.id == null) {
          return null;
        }

        return mapWgerToExercise(item as WgerExerciseInfoItem);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('Exercise request timed out. Please check your network connection.');
        }
        throw err;
      } finally {
        this.inFlightDetailRequests.delete(url);
      }
    })();

    this.inFlightDetailRequests.set(url, requestPromise);
    return requestPromise;
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
