/**
 * BeBig 2.0 — Centralized Auth Error Mapper & User-Facing Error UX
 *
 * Converts raw Supabase errors, network exceptions, local validation failures,
 * and system timeouts into actionable, user-friendly messages without exposing
 * internal database schemas, stack traces, or email existence vulnerabilities.
 */

export interface MappedAuthError {
  title: string;
  message: string;
  type: 'error' | 'info' | 'success';
  isExpectedUserError: boolean;
  field?: 'email' | 'password' | 'confirmPassword';
}

/**
 * Maps any authentication or network error into a polished, safe presentation model.
 * Guarantees that raw technical strings and email existence leaks are never exposed.
 */
export function mapAuthError(
  error: any,
  context: 'sign_in' | 'sign_up' | 'validation' = 'sign_in',
): MappedAuthError {
  if (!error) {
    return {
      title: 'Something went wrong',
      message:
        context === 'sign_up'
          ? "We couldn't create your account. Please try again."
          : "We couldn't complete the sign-in. Please try again.",
      type: 'error',
      isExpectedUserError: false,
    };
  }

  const code = typeof error === 'object' && error?.code ? String(error.code).toLowerCase() : '';
  const status = typeof error === 'object' && error?.status ? Number(error.status) : 0;
  const rawMsg =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error?.message
        ? String(error.message)
        : '';
  const lowerMsg = rawMsg.toLowerCase();

  // 1. Local Validation Errors (Password mismatch, weak password, invalid email format)
  if (lowerMsg.includes("passwords don't match") || lowerMsg.includes('passwords do not match')) {
    return {
      title: "Passwords don't match",
      message: "Passwords don't match.",
      type: 'error',
      field: 'confirmPassword',
      isExpectedUserError: true,
    };
  }

  if (
    lowerMsg.includes('enter a valid email') ||
    lowerMsg.includes('valid email address') ||
    lowerMsg.includes('invalid email')
  ) {
    return {
      title: 'Check your email',
      message: 'Enter a valid email address.',
      type: 'error',
      field: 'email',
      isExpectedUserError: true,
    };
  }

  if (
    code === 'password_too_weak' ||
    lowerMsg.includes('password should be at least') ||
    lowerMsg.includes('weak password') ||
    lowerMsg.includes('choose a stronger password')
  ) {
    return {
      title: 'Weak password',
      message: 'Choose a stronger password.',
      type: 'error',
      field: 'password',
      isExpectedUserError: true,
    };
  }

  if (lowerMsg.includes('password must be at least')) {
    return {
      title: 'Password too short',
      message: 'Password must be at least 6 characters.',
      type: 'error',
      field: 'password',
      isExpectedUserError: true,
    };
  }

  // 2. Network & Connectivity Errors
  if (
    lowerMsg.includes('network') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('net::err') ||
    lowerMsg.includes('connection refused')
  ) {
    return {
      title: 'No internet connection',
      message: 'Check your internet connection and try again.',
      type: 'error',
      isExpectedUserError: false,
    };
  }

  // 3. Request Timeouts
  if (
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('aborted') ||
    code === 'etimedout' ||
    status === 504
  ) {
    return {
      title: 'Request timed out',
      message: 'The request took too long. Please try again.',
      type: 'error',
      isExpectedUserError: false,
    };
  }

  // 4. Rate Limiting
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'too_many_requests' ||
    status === 429 ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('too many requests') ||
    lowerMsg.includes('too many attempts')
  ) {
    return {
      title: 'Too many attempts',
      message: 'Please wait a moment before trying again.',
      type: 'error',
      isExpectedUserError: true,
    };
  }

  // 5. Server / Supabase Unavailable
  if (
    status >= 500 ||
    code === 'service_unavailable' ||
    lowerMsg.includes('service unavailable') ||
    lowerMsg.includes('502 bad gateway') ||
    lowerMsg.includes('500 internal')
  ) {
    return {
      title: 'Service temporarily unavailable',
      message:
        context === 'sign_up'
          ? "We couldn't create your account right now. Please try again in a moment."
          : "We couldn't sign you in right now. Please try again in a moment.",
      type: 'error',
      isExpectedUserError: false,
    };
  }

  // 6. Sign Up Specific Errors
  if (context === 'sign_up') {
    if (
      code === 'user_already_exists' ||
      lowerMsg.includes('already registered') ||
      lowerMsg.includes('already exists')
    ) {
      return {
        title: 'Account already exists',
        message: 'An account with this email already exists. Try signing in instead.',
        type: 'error',
        field: 'email',
        isExpectedUserError: true,
      };
    }

    if (
      code === 'email_not_confirmed' ||
      lowerMsg.includes('email not confirmed') ||
      lowerMsg.includes('confirmation required') ||
      lowerMsg.includes('verify your email')
    ) {
      return {
        title: 'Verify your email',
        message: 'Check your inbox and verify your email before signing in.',
        type: 'info',
        field: 'email',
        isExpectedUserError: true,
      };
    }
  }

  // 7. Login Specific Errors (Crucial Invariant: NEVER reveal if email exists during login)
  if (context === 'sign_in') {
    if (
      code === 'invalid_credentials' ||
      code === 'user_not_found' ||
      status === 400 ||
      status === 404 ||
      lowerMsg.includes('invalid login credentials') ||
      lowerMsg.includes('invalid credentials') ||
      lowerMsg.includes('user not found') ||
      lowerMsg.includes('no user found') ||
      lowerMsg.includes('email not found') ||
      lowerMsg.includes('incorrect email or password') ||
      lowerMsg.includes('unable to sign in')
    ) {
      return {
        title: 'Incorrect login details',
        message: 'The email or password is incorrect. Please check your details and try again.',
        type: 'error',
        isExpectedUserError: true,
      };
    }
  }

  // Fallback for unclassified errors
  return {
    title: 'Something went wrong',
    message:
      context === 'sign_up'
        ? "We couldn't create your account. Please try again."
        : "We couldn't complete the sign-in. Please try again.",
    type: 'error',
    isExpectedUserError: false,
  };
}

/**
 * Mock Sentry interface to test error reporting behavior without external dependencies.
 */
export interface SentryReporter {
  captureException: (error: any, extra?: any) => void;
}

/**
 * Filtered error reporting wrapper for Sentry.
 * Expected user mistakes (wrong password, invalid email, password mismatch, email already registered)
 * are NEVER captured as production Sentry errors. Unexpected system/network errors are scrubbed
 * of sensitive credentials before logging.
 */
export function reportAuthErrorToSentry(
  rawError: any,
  mappedError: MappedAuthError,
  sentryClient?: SentryReporter,
): boolean {
  // Rule: Do NOT send expected user mistakes to Sentry
  if (mappedError.isExpectedUserError) {
    return false;
  }

  if (sentryClient && typeof sentryClient.captureException === 'function') {
    // Scrub sensitive data (passwords, tokens) if rawError is an object
    const sanitizedError =
      typeof rawError === 'object' && rawError !== null
        ? {
            name: rawError.name ?? 'AuthError',
            message: rawError.message ?? String(rawError),
            code: rawError.code,
            status: rawError.status,
          }
        : String(rawError);

    sentryClient.captureException(sanitizedError, {
      extra: {
        mappedTitle: mappedError.title,
        mappedMessage: mappedError.message,
      },
    });
    return true;
  }

  return false;
}
