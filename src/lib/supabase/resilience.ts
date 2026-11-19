/**
 * BeBig 2.0 — Supabase Pre-Migration & Offline Resilience Helpers
 *
 * Ensures optional / newly migrated remote resources (e.g. `app_announcements`,
 * `assigned_workouts`, `global_exercise_catalog`, `app_error_logs`) NEVER hang
 * UI screens on flaky mobile networks and NEVER spam HTTP 404/400 PostgREST
 * errors before SQL migrations are rolled out.
 */

const MISSING_SCHEMA_BACKOFF_MS = 5 * 60 * 1000;
const missingResourceUntil = new Map<string, number>();

export function isDeviceOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Resolves to `fallbackValue` if `promise` does not settle within `timeoutMs`.
 * Always cleans up its timer so Jest and browser event loops teardown cleanly.
 */
export async function withSafeTimeout<T, F = T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  fallbackValue: F,
): Promise<T | F> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race<T | F>([
      Promise.resolve(promise),
      new Promise<F>((resolve) => {
        timerId = setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]);
  } catch {
    return fallbackValue;
  } finally {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
  }
}

/**
 * Detects PostgREST / Postgres errors indicating a table, column, or RPC
 * does not exist yet in the remote schema cache.
 */
export function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const rec = error as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof rec.code === 'string' ? rec.code : '';
  const status = typeof rec.status === 'number' ? rec.status : 0;
  const message = typeof rec.message === 'string' ? rec.message.toLowerCase() : '';

  if (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === 'PGRST202' ||
    code === '42P01' ||
    code === '42703' ||
    code === '42883' ||
    status === 404
  ) {
    return true;
  }

  return (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('could not find the function')
  );
}

export function isRemoteResourceBackedOff(resourceKey: string): boolean {
  const until = missingResourceUntil.get(resourceKey);
  if (until === undefined) return false;
  if (Date.now() < until) return true;
  missingResourceUntil.delete(resourceKey);
  return false;
}

export function markRemoteResourceMissing(resourceKey: string): void {
  missingResourceUntil.set(resourceKey, Date.now() + MISSING_SCHEMA_BACKOFF_MS);
}

export function resetRemoteResourceBackoffForTests(): void {
  missingResourceUntil.clear();
}
