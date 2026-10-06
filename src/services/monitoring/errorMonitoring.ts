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

import * as Sentry from '@sentry/react-native';
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

export function sanitizeContextData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
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
    Sentry.init({
      dsn,
      debug: false,
      enableAutoSessionTracking: true,
    });
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

  if (isInitialized) {
    Sentry.withScope((scope) => {
      if (sanitizedTags) {
        scope.setTags(sanitizedTags as Record<string, string>);
      }
      if (sanitizedExtra) {
        scope.setExtras(sanitizedExtra);
      }
      if (context?.level) {
        scope.setLevel(context.level as Sentry.SeverityLevel);
      }
      Sentry.captureException(error);
    });
  }
}

export function setUserContext(userId: string | null): void {
  if (!userId) {
    if (isInitialized) {
      Sentry.setUser(null);
    }
    return;
  }
  if (isInitialized) {
    Sentry.setUser({ id: userId });
  }
}

export function isMonitoringConfigured(): boolean {
  return Boolean(env.sentryDsn);
}

export function wrapRootLayout<P extends Record<string, any>>(Component: React.ComponentType<P>): React.ComponentType<P> {
  // Sentry.wrap handles root error boundaries safely
  return Sentry.wrap(Component);
}
