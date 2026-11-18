/**
 * BeBig 2.0 — Shared Edge Function Security Helpers (AUD-010)
 *
 * Enforces:
 * - Origin-allowlisted CORS (no wildcard `*` in production) with `Vary: Origin`
 * - Strict HTTP method enforcement (`405 Method Not Allowed`)
 * - Bounded JSON request body parsing (`413 Payload Too Large` / `400 Bad Request`)
 * - Generic error responses with opaque `correlation_id` (no raw stack/DB leaks)
 * - Canonical admin role enum & UUID validation
 */

export const ALLOWED_ORIGINS: readonly string[] = [
  'https://be-big-2-0.vercel.app',
  'https://be-big-2-0-aditya-works.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'http://localhost:5173',
];

export const VERCEL_PREVIEW_PATTERNS: readonly RegExp[] = [
  /^https:\/\/be-big-[a-z0-9-]+-adityas-projects-[a-z0-9]+\.vercel\.app$/,
  /^https:\/\/be-big-2-0-[a-z0-9-]+-aditya-works\.vercel\.app$/,
];

export const VALID_ADMIN_ROLES = [
  'super_admin',
  'admin',
  'coach',
  'support',
  'content_manager',
  'developer',
] as const;

export type ValidAdminRole = (typeof VALID_ADMIN_ROLES)[number];

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return VERCEL_PREVIEW_PATTERNS.some((pattern) => pattern.test(origin));
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin)
    ? origin
    : 'https://be-big-2-0.vercel.app';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

export function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  correlationId?: string
): Response {
  const payload: Record<string, unknown> = { error: message };
  if (correlationId) {
    payload.correlation_id = correlationId;
  }
  return jsonResponse(payload, status, corsHeaders);
}

export type BoundedJsonResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 413; error: string };

/**
 * Reads and parses a JSON request body while strictly bounding byte length.
 */
export async function readBoundedJson<T = Record<string, unknown>>(
  req: Request,
  maxBytes: number
): Promise<BoundedJsonResult<T>> {
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const declared = Number(contentLengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, status: 413, error: 'Payload too large' };
    }
  }

  let rawText = '';
  try {
    rawText = await req.text();
  } catch {
    return { ok: false, status: 400, error: 'Unable to read request body' };
  }

  const byteLength = new TextEncoder().encode(rawText).length;
  if (byteLength > maxBytes) {
    return { ok: false, status: 413, error: 'Payload too large' };
  }

  if (!rawText.trim()) {
    return { ok: false, status: 400, error: 'Empty JSON payload' };
  }

  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, status: 400, error: 'JSON body must be an object' };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON payload' };
  }
}
