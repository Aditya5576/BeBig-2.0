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
 * - Strips sensitive query parameters, headers, and tokens from all error reports and breadcrumbs.
 * - Never collects default PII (IP address, user account names).
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
  'auth',
  'apikey',
  'secret',
  'token_hash',
  'supabaseanonkey',
  'supabasedb',
  'service_role',
  'cookie',
  'session',
  'jwt',
  'bearer',
  'private_key',
  'credential',
];

/**
 * Redacts JWT tokens, Bearer headers, and sensitive query parameters from string values.
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  // Redact Bearer tokens
  let cleaned = str.replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED_AUTH_TOKEN]');
  // Redact standalone JWT patterns (starts with eyJ, three base64 segments)
  cleaned = cleaned.replace(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, '[REDACTED_AUTH_TOKEN]');
  // Redact sensitive query parameters in URLs (e.g. apikey=..., token=..., password=..., secret=...)
  cleaned = cleaned.replace(/([?&](?:apikey|api_key|token|access_token|refresh_token|password|secret)=)[^&]*/gi, '$1[REDACTED]');
  return cleaned;
}

/**
 * Recursively scrubs sensitive keys and token values from objects, arrays, and primitives.
 */
export function sanitizeContextData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    return sanitizeString(data);
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

/**
 * Cleans Sentry ErrorEvent before transmission to guarantee zero credential leakage.
 */
export function sanitizeEvent(event: any): any {
  if (!event) return event;

  // 1. Sanitize exception messages & values
  if (event.exception?.values && Array.isArray(event.exception.values)) {
    for (const val of event.exception.values) {
      if (val && typeof val.value === 'string') {
        val.value = sanitizeString(val.value);
      }
    }
  }

  // 2. Sanitize top-level message if present
  if (typeof event.message === 'string') {
    event.message = sanitizeString(event.message);
  }

  // 3. Sanitize extras and tags
  if (event.extra) {
    event.extra = sanitizeContextData(event.extra);
  }
  if (event.tags) {
    event.tags = sanitizeContextData(event.tags);
  }

  // 4. Sanitize HTTP request data and headers if captured
  if (event.request) {
    if (typeof event.request.url === 'string') {
      event.request.url = sanitizeString(event.request.url);
    }
    if (event.request.headers) {
      event.request.headers = sanitizeContextData(event.request.headers);
    }
    if (event.request.data) {
      event.request.data = sanitizeContextData(event.request.data);
    }
  }

  // 5. Sanitize breadcrumbs attached to the event
  if (event.breadcrumbs && Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      sanitizeBreadcrumb(b);
    }
  }

  return event;
}

/**
 * Cleans individual breadcrumbs to prevent storing auth tokens or passwords in local telemetry.
 */
export function sanitizeBreadcrumb(breadcrumb: any): any {
  if (!breadcrumb) return breadcrumb;

  if (typeof breadcrumb.message === 'string') {
    breadcrumb.message = sanitizeString(breadcrumb.message);
  }

  if (breadcrumb.data) {
    breadcrumb.data = sanitizeContextData(breadcrumb.data);
    if (typeof breadcrumb.data.url === 'string') {
      breadcrumb.data.url = sanitizeString(breadcrumb.data.url);
    }
  }

  return breadcrumb;
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
    const environment = env.appEnv || 'production';
    const release = env.version
      ? `${env.appName || 'BeBig'}@${env.version}${env.commitSha ? `+${env.commitSha}` : ''}`
      : undefined;
    const dist = env.commitSha || undefined;

    Sentry.init({
      dsn,
      debug: false,
      environment,
      ...(release ? { release } : {}),
      ...(dist ? { dist } : {}),
      sendDefaultPii: false,
      enableAutoSessionTracking: true,
      beforeSend(event) {
        return sanitizeEvent(event);
      },
      beforeBreadcrumb(breadcrumb) {
        return sanitizeBreadcrumb(breadcrumb);
      },
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

export function captureMessage(message: string, context?: ErrorContext): void {
  if (!message) return;

  const sanitizedMessage = sanitizeString(message);
  const sanitizedExtra = context?.extra ? sanitizeContextData(context.extra) : undefined;
  const sanitizedTags = context?.tags ? sanitizeContextData(context.tags) : undefined;

  if (env.isDev) {
    console.log('[MONITORING_CAPTURED_MESSAGE]', sanitizedMessage, {
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
      Sentry.captureMessage(sanitizedMessage);
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

export function isMonitoringInitialized(): boolean {
  return isInitialized;
}

export function wrapRootLayout<P extends Record<string, any>>(Component: React.ComponentType<P>): React.ComponentType<P> {
  // Sentry.wrap handles root error boundaries safely
  return Sentry.wrap(Component);
}

