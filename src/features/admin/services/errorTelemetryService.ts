/**
 * BeBig 2.0 — Sanitized Client Error Telemetry Service (Admin Milestone 1)
 *
 * Captures uncaught ErrorBoundary crashes and optional global runtime errors into:
 * 1. A bounded local ring buffer (max 50 entries) persisted in `platformStorage`
 *    for offline resilience and instant admin inspection.
 * 2. A throttled, deduplicated, PII-sanitized async flush to Supabase `app_error_logs`
 *    when online and configured.
 *
 * Privacy & Security:
 * - Strips JWTs, Bearer tokens, API keys, passwords, query secrets, and email addresses.
 * - Never throws back into callers or disrupts React fallback rendering.
 */

import { Platform } from 'react-native';
import { platformStorage } from '../../../lib/storage';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  isDeviceOffline,
  isMissingSchemaError,
  isRemoteResourceBackedOff,
  markRemoteResourceMissing,
} from '../../../lib/supabase/resilience';
import { env } from '../../../config/env';

export type ErrorSeverity = 'crash' | 'error' | 'warning' | 'info';

export interface DeviceDiagnosticsInfo {
  platform: string;
  isWebKit: boolean;
  isIOS: boolean;
  userAgent: string;
  viewport?: string;
  online: boolean;
}

export interface ClientErrorLogEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  route: string;
  error_name: string;
  error_message: string;
  stack_trace: string | null;
  device_info: DeviceDiagnosticsInfo;
  app_version: string;
  severity: ErrorSeverity;
  source: 'local' | 'remote';
}

export interface CaptureErrorInput {
  error: unknown;
  route?: string;
  severity?: ErrorSeverity;
  componentStack?: string;
  userId?: string | null;
}

export const ERROR_RING_BUFFER_KEY = 'bebig.admin.error_ring_buffer';
export const ERROR_RING_BUFFER_MAX = 50;
const REMOTE_FLUSH_DEDUP_WINDOW_MS = 5000;

let memoryRingBuffer: ClientErrorLogEntry[] = [];
let hasHydratedBuffer = false;
const recentRemoteFlushMap = new Map<string, number>();
let globalHandlersInstalled = false;

/**
 * Strips tokens, JWTs, Bearer headers, secret parameters, and email PII from text.
 */
export function sanitizeErrorText(raw: string, maxLength: number): string {
  if (!raw) return '';

  let sanitized = raw
    // JWT tokens (header.payload.signature)
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]*)?/g, '[REDACTED_JWT]')
    // Authorization Bearer tokens
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]')
    // Supabase / API prefixed keys
    .replace(/\b(?:sb_secret|sbp|sk_live|sk_test|pk_live|pk_test)_[A-Za-z0-9_-]+/gi, '[REDACTED_KEY]')
    // Key-value secrets in URLs, headers, or logs
    .replace(
      /\b(apikey|api_key|access_token|refresh_token|authorization|password|passwd|secret|token)\s*([=:])\s*([^\s&"',;]+)/gi,
      '$1$2[REDACTED]',
    )
    // Email addresses
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]');

  if (sanitized.length > maxLength) {
    sanitized = `${sanitized.slice(0, Math.max(0, maxLength - 3))}...`;
  }

  return sanitized;
}

function generateLocalLogId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `local_${Date.now()}_${randomPart}`;
}

function collectDeviceInfo(): DeviceDiagnosticsInfo {
  const ua =
    typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? sanitizeErrorText(navigator.userAgent, 200)
      : Platform.OS;

  const isIOS =
    Platform.OS === 'ios' ||
    /iPad|iPhone|iPod/i.test(ua) ||
    (Platform.OS === 'web' && /Macintosh/i.test(ua) && typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 1);

  const isWebKit = /AppleWebKit/i.test(ua) && !/Chrome|CriOS|Android/i.test(ua);

  let viewport: string | undefined;
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
    viewport = `${window.innerWidth}x${window.innerHeight}`;
  }

  const online =
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;

  return {
    platform: Platform.OS,
    isWebKit,
    isIOS,
    userAgent: ua,
    viewport,
    online,
  };
}

function resolveCurrentRoute(explicitRoute?: string): string {
  if (explicitRoute && explicitRoute.trim().length > 0) {
    return sanitizeErrorText(explicitRoute.trim(), 256);
  }
  if (typeof window !== 'undefined' && window.location && typeof window.location.pathname === 'string') {
    return sanitizeErrorText(window.location.pathname || '/', 256);
  }
  return '/';
}

function normalizeErrorObject(error: unknown): { name: string; message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      name: sanitizeErrorText(error.name || 'Error', 128) || 'Error',
      message: sanitizeErrorText(error.message || 'Unknown error', 1000) || 'Unknown error',
      stack: error.stack ? sanitizeErrorText(error.stack, 6000) : null,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as { name?: unknown; message?: unknown; stack?: unknown };
    const name = typeof record.name === 'string' && record.name ? record.name : 'RuntimeError';
    const message =
      typeof record.message === 'string' && record.message
        ? record.message
        : JSON.stringify(error);
    const stack = typeof record.stack === 'string' ? record.stack : null;
    return {
      name: sanitizeErrorText(name, 128) || 'RuntimeError',
      message: sanitizeErrorText(message, 1000) || 'Unknown error',
      stack: stack ? sanitizeErrorText(stack, 6000) : null,
    };
  }

  return {
    name: 'Error',
    message: sanitizeErrorText(String(error ?? 'Unknown error'), 1000) || 'Unknown error',
    stack: null,
  };
}

async function hydrateBufferFromStorage(): Promise<void> {
  if (hasHydratedBuffer) return;
  hasHydratedBuffer = true;

  try {
    const raw = await platformStorage.getItem(ERROR_RING_BUFFER_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const validEntries = parsed.filter(
      (item): item is ClientErrorLogEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ClientErrorLogEntry).id === 'string' &&
        typeof (item as ClientErrorLogEntry).error_message === 'string',
    );

    if (validEntries.length > 0) {
      const merged = new Map<string, ClientErrorLogEntry>();
      for (const entry of memoryRingBuffer) {
        merged.set(entry.id, entry);
      }
      for (const entry of validEntries) {
        if (!merged.has(entry.id)) {
          merged.set(entry.id, entry);
        }
      }
      memoryRingBuffer = Array.from(merged.values())
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, ERROR_RING_BUFFER_MAX);
    }
  } catch {
    // Non-fatal: continue with in-memory buffer
  }
}

async function persistBufferToStorage(): Promise<void> {
  try {
    await platformStorage.setItem(ERROR_RING_BUFFER_KEY, JSON.stringify(memoryRingBuffer));
  } catch {
    // Non-fatal: ring buffer remains available in memory
  }
}

const ERROR_LOGS_RESOURCE_KEY = 'table:app_error_logs';

async function flushEntryToSupabase(entry: ClientErrorLogEntry): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (!entry.device_info.online || isDeviceOffline()) return;
  if (isRemoteResourceBackedOff(ERROR_LOGS_RESOURCE_KEY)) return;

  const dedupKey = `${entry.error_name}|${entry.error_message}|${entry.route}`;
  const now = Date.now();
  const lastSentAt = recentRemoteFlushMap.get(dedupKey);
  if (lastSentAt !== undefined && now - lastSentAt < REMOTE_FLUSH_DEDUP_WINDOW_MS) {
    return;
  }
  recentRemoteFlushMap.set(dedupKey, now);

  // Cap dedup map size to avoid unbounded growth
  if (recentRemoteFlushMap.size > 100) {
    const oldestKey = recentRemoteFlushMap.keys().next().value;
    if (oldestKey) {
      recentRemoteFlushMap.delete(oldestKey);
    }
  }

  try {
    const { error } = await supabase.from('app_error_logs').insert({
      user_id: entry.user_id,
      route: entry.route,
      error_name: entry.error_name,
      error_message: entry.error_message,
      stack_trace: entry.stack_trace,
      device_info: entry.device_info,
      app_version: entry.app_version,
      severity: entry.severity,
    });
    if (error && isMissingSchemaError(error)) {
      markRemoteResourceMissing(ERROR_LOGS_RESOURCE_KEY);
    }
  } catch {
    // Silent fail: entry is already safely persisted in local ring buffer
  }
}

export const errorTelemetryService = {
  /**
   * Captures and sanitizes a client error into the bounded local ring buffer
   * and triggers a throttled best-effort flush to Supabase `app_error_logs`.
   */
  captureError(input: CaptureErrorInput): ClientErrorLogEntry {
    const normalized = normalizeErrorObject(input.error);
    const sanitizedComponentStack = input.componentStack
      ? sanitizeErrorText(input.componentStack, 2000)
      : null;

    const combinedStack = [normalized.stack, sanitizedComponentStack]
      .filter((part): part is string => Boolean(part && part.trim().length > 0))
      .join('\n--- Component Stack ---\n');

    const entry: ClientErrorLogEntry = {
      id: generateLocalLogId(),
      created_at: new Date().toISOString(),
      user_id: input.userId ?? null,
      route: resolveCurrentRoute(input.route),
      error_name: normalized.name,
      error_message: normalized.message,
      stack_trace: combinedStack ? sanitizeErrorText(combinedStack, 8000) : null,
      device_info: collectDeviceInfo(),
      app_version: env.version,
      severity: input.severity ?? 'crash',
      source: 'local',
    };

    memoryRingBuffer = [entry, ...memoryRingBuffer].slice(0, ERROR_RING_BUFFER_MAX);

    void persistBufferToStorage();
    void flushEntryToSupabase(entry);

    return entry;
  },

  /**
   * Returns all locally buffered error entries (newest first).
   */
  async getLocalErrorLogs(): Promise<ClientErrorLogEntry[]> {
    await hydrateBufferFromStorage();
    return [...memoryRingBuffer];
  },

  /**
   * Clears both the in-memory and persisted local error ring buffer.
   */
  async clearLocalErrorLogs(): Promise<void> {
    memoryRingBuffer = [];
    hasHydratedBuffer = true;
    recentRemoteFlushMap.clear();
    try {
      await platformStorage.removeItem(ERROR_RING_BUFFER_KEY);
    } catch {
      // Best-effort clear
    }
  },

  /**
   * Resets internal hydration state (primarily for isolated unit tests).
   */
  _resetForTests(): void {
    memoryRingBuffer = [];
    hasHydratedBuffer = false;
    recentRemoteFlushMap.clear();
  },

  /**
   * Installs idempotent global unhandled rejection & error listeners on web.
   */
  installGlobalErrorHandlers(): void {
    if (globalHandlersInstalled || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    globalHandlersInstalled = true;

    window.addEventListener('error', (event: ErrorEvent) => {
      try {
        errorTelemetryService.captureError({
          error: event.error ?? new Error(event.message || 'Unhandled window error'),
          severity: 'crash',
        });
      } catch {
        // Never cascade from telemetry listener
      }
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      try {
        errorTelemetryService.captureError({
          error: event.reason ?? new Error('Unhandled promise rejection'),
          severity: 'error',
        });
      } catch {
        // Never cascade from telemetry listener
      }
    });
  },
};
