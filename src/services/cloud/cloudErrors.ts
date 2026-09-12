/**
 * BeBig 2.0 — Cloud Data Access Error Hierarchy
 *
 * Categorizes raw Supabase and PostgREST errors into structured, typed error kinds
 * so the sync engine can distinguish transient network blips from permanent auth/validation errors.
 */

export type CloudErrorKind =
  | 'network'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'unknown';

export interface CloudErrorOptions {
  originalError?: unknown;
  status?: number;
  code?: string;
}

export class CloudError extends Error {
  readonly kind: CloudErrorKind;
  readonly originalError?: unknown;
  readonly status?: number;
  readonly code?: string;

  constructor(kind: CloudErrorKind, message: string, options?: CloudErrorOptions) {
    super(message);
    this.name = 'CloudError';
    this.kind = kind;
    this.originalError = options?.originalError;
    this.status = options?.status;
    this.code = options?.code;
  }
}

export function isCloudError(error: unknown): error is CloudError {
  return error instanceof CloudError;
}

/**
 * Classifies any thrown error or Supabase PostgREST error into a typed CloudError.
 */
export function classifySupabaseError(error: any): CloudError {
  if (!error) {
    return new CloudError('unknown', 'An unknown cloud error occurred.');
  }

  if (isCloudError(error)) {
    return error;
  }

  const message: string =
    typeof error === 'string'
      ? error
      : error.message || error.error_description || error.details || '';
  const status: number | undefined = error.status || error.statusCode;
  const code: string | undefined = error.code;

  // 1. Network / connectivity failures
  const isNetwork =
    message.includes('FetchError') ||
    message.includes('Network') ||
    message.includes('Failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('connection refused') ||
    status === 0 ||
    status === 502 ||
    status === 503 ||
    status === 504;

  if (isNetwork) {
    return new CloudError('network', message || 'Network connection unavailable.', {
      originalError: error,
      status,
      code,
    });
  }

  // 2. Authentication / Session failures
  const isAuth =
    status === 401 ||
    code === 'PGRST301' || // JWT expired / invalid
    message.includes('JWT') ||
    message.includes('token') ||
    message.includes('unauthorized') ||
    message.includes('not authenticated') ||
    message.includes('auth session') ||
    /\b(invalid|expired|active|no) session\b/i.test(message);

  if (isAuth) {
    return new CloudError('auth', message || 'Authentication session is invalid or expired.', {
      originalError: error,
      status: 401,
      code,
    });
  }

  // 3. Permission / Row-Level Security failures
  const isPermission =
    status === 403 ||
    code === '42501' || // PostgreSQL insufficient_privilege
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('forbidden');

  if (isPermission) {
    return new CloudError('permission', message || 'Permission denied by row-level security policy.', {
      originalError: error,
      status: 403,
      code,
    });
  }

  // 4. Validation / Database constraint violations
  const isValidation =
    status === 400 ||
    status === 409 ||
    status === 422 ||
    code?.startsWith('22') || // data exception
    code?.startsWith('23') || // integrity constraint violation (e.g. 23514 check constraint)
    message.includes('violates') ||
    message.includes('constraint') ||
    message.includes('check constraint');

  if (isValidation) {
    return new CloudError('validation', message || 'Database constraint or validation failure.', {
      originalError: error,
      status: status || 400,
      code,
    });
  }

  return new CloudError('unknown', message || 'Unexpected cloud storage error.', {
    originalError: error,
    status,
    code,
  });
}
