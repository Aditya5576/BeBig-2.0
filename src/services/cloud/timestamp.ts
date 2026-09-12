/**
 * BeBig 2.0 — PostgREST Timestamp Normalization Utility
 *
 * Normalizes timestamp values to canonical ISO-8601 UTC strings (e.g. "2026-09-06T10:00:00.000Z")
 * before constructing Supabase/PostgREST incremental-sync filters and keyset pagination cursors.
 */

import { CloudError } from './cloudErrors';

/**
 * Normalizes an ISO-8601 timestamp string to canonical UTC ISO-8601 format:
 * "YYYY-MM-DDTHH:mm:ss.sssZ"
 *
 * Invariants & Guarantees:
 * 1. Must be a non-empty string starting with a valid ISO date prefix (YYYY-MM-DD).
 * 2. Parses any valid timezone representation (Z, +00:00, or arbitrary +/- timezone offsets).
 * 3. Never uses device local timezone: naive strings without timezone offset are treated as UTC.
 * 4. Equivalent timestamps representing the exact same instant produce the identical canonical string.
 * 5. Invalid timestamps safely throw typed CloudError('validation') and never silently produce a wrong filter.
 */
export function normalizeUtcTimestamp(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) {
    throw new CloudError(
      'validation',
      `Invalid timestamp: expected non-empty ISO-8601 string, received ${typeof input === 'string' ? '""' : typeof input}.`
    );
  }

  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    throw new CloudError(
      'validation',
      `Invalid timestamp format: "${trimmed}". Expected a valid ISO-8601 date string starting with YYYY-MM-DD.`
    );
  }

  // If timestamp contains time portion but lacks timezone specifier (Z or +/-HH:MM), treat as UTC to avoid local device offset
  const hasTime = trimmed.includes('T');
  const hasTimezone = /(Z|[+-]\d{2}(?::?\d{2})?)$/i.test(trimmed);
  const toParse = hasTime && !hasTimezone ? `${trimmed}Z` : trimmed;

  const parsed = new Date(toParse);
  if (isNaN(parsed.getTime())) {
    throw new CloudError(
      'validation',
      `Invalid timestamp value: "${trimmed}". Failed to parse as a valid ISO-8601 date.`
    );
  }

  return parsed.toISOString();
}
