import { platformStorage } from '../../../lib/storage';
import { getCurrentUserScope, getUserScopedKey, UserScope } from '../../auth/utils/userScope';
import { DOMAIN_LIMITS } from '../../../constants/domainLimits';
import {
  registerExerciseMemoryCacheCleaner,
  resolveExerciseScopeNamespace,
} from './customExerciseStorage';
import { resolveExerciseTrackingMode } from '../exerciseTracking';
import { Exercise } from '../types';

export const BASE_EXERCISE_NAME_OVERRIDES_KEY = 'bebig.exercises.name_overrides';

const memoryByNamespace = new Map<string, Record<string, string>>();
const hydratedNamespaces = new Set<string>();
const writeQueues = new Map<string, Promise<unknown>>();

registerExerciseMemoryCacheCleaner(() => {
  memoryByNamespace.clear();
  hydratedNamespaces.clear();
});

function enqueueScopedWrite<T>(namespace: string, task: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(namespace) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const tracked = next.finally(() => {
    if (writeQueues.get(namespace) === tracked) {
      writeQueues.delete(namespace);
    }
  });
  writeQueues.set(namespace, tracked);
  return next;
}

function sanitizeOverridesMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key === 'string' && key.trim().length > 0 && typeof val === 'string') {
      const trimmed = val.trim().slice(0, DOMAIN_LIMITS.EXERCISE_NAME_MAX_LENGTH);
      if (trimmed.length > 0) {
        result[key] = trimmed;
      }
    }
  }
  return result;
}

export function normalizeExerciseRename(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    throw new Error('Exercise name is required.');
  }
  if (trimmed.length > DOMAIN_LIMITS.EXERCISE_NAME_MAX_LENGTH) {
    throw new Error(
      `Exercise name cannot exceed ${DOMAIN_LIMITS.EXERCISE_NAME_MAX_LENGTH} characters.`
    );
  }
  return trimmed;
}

export const exerciseNameOverrideStorage = {
  async ensureHydrated(scope?: UserScope | null): Promise<Record<string, string>> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const namespace = resolveExerciseScopeNamespace(resolvedScope);
    if (hydratedNamespaces.has(namespace)) {
      return { ...(memoryByNamespace.get(namespace) || {}) };
    }

    const storageKey =
      getUserScopedKey(BASE_EXERCISE_NAME_OVERRIDES_KEY, resolvedScope) ||
      BASE_EXERCISE_NAME_OVERRIDES_KEY;
    try {
      const raw = await platformStorage.getItem(storageKey);
      const parsed = raw ? sanitizeOverridesMap(JSON.parse(raw)) : {};
      memoryByNamespace.set(namespace, parsed);
      hydratedNamespaces.add(namespace);
      return { ...parsed };
    } catch {
      const fallback = memoryByNamespace.get(namespace) || {};
      hydratedNamespaces.add(namespace);
      return { ...fallback };
    }
  },

  getOverridesSync(scope?: UserScope | null): Record<string, string> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const namespace = resolveExerciseScopeNamespace(resolvedScope);
    return { ...(memoryByNamespace.get(namespace) || {}) };
  },

  getOverrideSync(exerciseId: string, scope?: UserScope | null): string | undefined {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const namespace = resolveExerciseScopeNamespace(resolvedScope);
    return memoryByNamespace.get(namespace)?.[exerciseId];
  },

  async setOverride(
    exerciseId: string,
    customDisplayName: string,
    scope?: UserScope | null,
  ): Promise<Record<string, string>> {
    const trimmedId = (exerciseId || '').trim();
    if (!trimmedId) {
      throw new Error('Exercise ID is required.');
    }
    const validName = normalizeExerciseRename(customDisplayName);
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const namespace = resolveExerciseScopeNamespace(resolvedScope);
    const storageKey =
      getUserScopedKey(BASE_EXERCISE_NAME_OVERRIDES_KEY, resolvedScope) ||
      BASE_EXERCISE_NAME_OVERRIDES_KEY;

    return enqueueScopedWrite(namespace, async () => {
      const current = await exerciseNameOverrideStorage.ensureHydrated(resolvedScope);
      const nextMap: Record<string, string> = {
        ...current,
        [trimmedId]: validName,
      };
      await platformStorage.setItem(storageKey, JSON.stringify(nextMap));
      memoryByNamespace.set(namespace, nextMap);
      hydratedNamespaces.add(namespace);
      return { ...nextMap };
    });
  },

  async removeOverride(
    exerciseId: string,
    scope?: UserScope | null,
  ): Promise<Record<string, string>> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const namespace = resolveExerciseScopeNamespace(resolvedScope);
    const storageKey =
      getUserScopedKey(BASE_EXERCISE_NAME_OVERRIDES_KEY, resolvedScope) ||
      BASE_EXERCISE_NAME_OVERRIDES_KEY;

    return enqueueScopedWrite(namespace, async () => {
      const current = await exerciseNameOverrideStorage.ensureHydrated(resolvedScope);
      if (!(exerciseId in current)) {
        return { ...current };
      }
      const nextMap = { ...current };
      delete nextMap[exerciseId];
      if (Object.keys(nextMap).length === 0) {
        await platformStorage.removeItem(storageKey);
      } else {
        await platformStorage.setItem(storageKey, JSON.stringify(nextMap));
      }
      memoryByNamespace.set(namespace, nextMap);
      hydratedNamespaces.add(namespace);
      return { ...nextMap };
    });
  },

  async clearOverrides(scope?: UserScope | null): Promise<void> {
    const resolvedScope = scope !== undefined ? scope : getCurrentUserScope();
    const namespace = resolveExerciseScopeNamespace(resolvedScope);
    const storageKey =
      getUserScopedKey(BASE_EXERCISE_NAME_OVERRIDES_KEY, resolvedScope) ||
      BASE_EXERCISE_NAME_OVERRIDES_KEY;

    return enqueueScopedWrite(namespace, async () => {
      await platformStorage.removeItem(storageKey);
      memoryByNamespace.delete(namespace);
      hydratedNamespaces.delete(namespace);
    });
  },

  /**
   * Projects any user-scoped custom display name onto an Exercise without ever altering
   * its canonical trackingMode (trackingMode is resolved BEFORE projecting the name).
   */
  projectExercise(exercise: Exercise, scope?: UserScope | null): Exercise {
    const canonicalTrackingMode = resolveExerciseTrackingMode(exercise);
    const override = exerciseNameOverrideStorage.getOverrideSync(exercise.id, scope);
    if (!override || override === exercise.name) {
      return exercise.trackingMode === canonicalTrackingMode
        ? exercise
        : { ...exercise, trackingMode: canonicalTrackingMode };
    }
    return {
      ...exercise,
      canonicalName: exercise.canonicalName ?? exercise.name,
      name: override,
      trackingMode: canonicalTrackingMode,
    };
  },

  projectExercises(exercises: Exercise[], scope?: UserScope | null): Exercise[] {
    const overrides = exerciseNameOverrideStorage.getOverridesSync(scope);
    const hasOverrides = Object.keys(overrides).length > 0;
    return exercises.map((ex) => {
      const canonicalTrackingMode = resolveExerciseTrackingMode(ex);
      const override = hasOverrides ? overrides[ex.id] : undefined;
      if (override && override !== ex.name) {
        return {
          ...ex,
          canonicalName: ex.canonicalName ?? ex.name,
          name: override,
          trackingMode: canonicalTrackingMode,
        };
      }
      return ex.trackingMode === canonicalTrackingMode
        ? ex
        : { ...ex, trackingMode: canonicalTrackingMode };
    });
  },
};
