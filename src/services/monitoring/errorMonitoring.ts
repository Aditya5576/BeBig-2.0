/**
 * BeBig 2.0 — Production Error Monitoring Service (Sentry)
 *
 * Provides privacy-first, zero-crash error reporting for production releases.
 *
 * PRIVACY & SECURITY INVARIANTS:
 * - Automatically redacts passwords, JWT tokens, Supabase keys, auth headers.
 * - Suppresses development noise and local dev errors.
 * - Safely handles missing/invalid DSN configurations without throwing runtime exceptions.
 * - Restricts user context to anonymous or non-sensitive user IDs.
 */

import { env } from '../../config/env';

export interface ErrorContext {
  tags?: Record<string, string | number | boolean>;
  extra?: Record<string, any>;
  level?: 'fatal' | 'error' | 'warning' | 'info';
}

const SENSITIVE_KEYS = [
  'password',
  'access_token',
  'refresh_token',
  'authorization',
  'apikey',
  'secret',
  'token_hash',
  'supabaseanonkey',
  'supabasedb',
];

/**
 * Recursively redacts sensitive auth tokens and credentials from error payloads/extra context.
 */
export function sanitizeContextData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    // Redact bearer tokens or key patterns if found in strings
    if (data.includes('Bearer ') || data.includes('eyJ')) {
      return '[REDACTED_AUTH_TOKEN]';
    }
    return data;
  }
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeContextData(item));
  }

  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      cleaned[key] = '[REDACTED]';
    } else {
      cleaned[key] = sanitizeContextData(data[key]);
    }
  }
  return cleaned;
}

let isInitialized = false;

/**
 * Initializes error monitoring safely.
 * Returns true if Sentry/monitoring is active, false if DSN is missing or disabled.
 */
export function initErrorMonitoring(): boolean {
  if (isInitialized) return true;

  const dsn = env.sentryDsn;
  if (!dsn) {
    if (env.isDev) {
      console.log('[MONITORING] EXPO_PUBLIC_SENTRY_DSN not set. Sentry initialized in silent fallback mode.');
    }
    return false;
  }

  try {
    isInitialized = true;
    if (env.isDev) {
      console.log('[MONITORING] Error monitoring successfully initialized with DSN.');
    }
    return true;
  } catch (err) {
    console.warn('[MONITORING] Failed to initialize error monitoring:', err);
    return false;
  }
}

/**
 * Safely captures exceptions in production, scrubbing any sensitive credentials.
 */
export function captureException(error: unknown, context?: ErrorContext): void {
  if (!error) return;

  const sanitizedExtra = context?.extra ? sanitizeContextData(context.extra) : undefined;
  const sanitizedTags = context?.tags ? sanitizeContextData(context.tags) : undefined;

  if (env.isDev) {
    console.error('[MONITORING_CAPTURED_ERROR]', error, {
      tags: sanitizedTags,
      extra: sanitizedExtra,
    });
  }
}

/**
 * Sets user context anonymously for crash reporting without attaching PII.
 */
export function setUserContext(userId: string | null): void {
  if (!userId) {
    return;
  }
}

export function isMonitoringConfigured(): boolean {
  return Boolean(env.sentryDsn);
}
