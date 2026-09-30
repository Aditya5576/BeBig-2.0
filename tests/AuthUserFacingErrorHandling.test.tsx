/**
 * BeBig 2.0 — Focused User-Facing Auth Error Handling Test Suite
 *
 * Verifies clear, actionable error mapping, security non-disclosure of email existence,
 * Sentry filtering of expected mistakes, and raw technical error scrubbing.
 */

import { mapAuthError, reportAuthErrorToSentry, resolveAuthenticatedUserRoute, useAuthStore } from '../src/features/auth';

describe('BE BIG 2.0 — User-Facing Auth Error Handling & Security Invariants', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      session: null,
      isGuest: false,
    });
  });

  it('1. Wrong password maps to "Incorrect login details"', () => {
    const error = { code: 'invalid_credentials', message: 'Invalid login credentials' };
    const mapped = mapAuthError(error, 'sign_in');

    expect(mapped.title).toBe('Incorrect login details');
    expect(mapped.message).toBe('The email or password is incorrect. Please check your details and try again.');
    expect(mapped.type).toBe('error');
    expect(mapped.isExpectedUserError).toBe(true);
  });

  it('2. Wrong password does NOT reveal whether email exists', () => {
    const invalidCreds = mapAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'sign_in');
    const userNotFound = mapAuthError({ code: 'user_not_found', message: 'User not found' }, 'sign_in');
    const notFoundStatus = mapAuthError({ status: 404, message: 'Email not found' }, 'sign_in');

    expect(invalidCreds.title).toBe('Incorrect login details');
    expect(userNotFound.title).toBe('Incorrect login details');
    expect(notFoundStatus.title).toBe('Incorrect login details');

    expect(invalidCreds.message).toBe(userNotFound.message);
    expect(userNotFound.message).toBe(notFoundStatus.message);
    expect(invalidCreds.message).not.toContain('found');
    expect(invalidCreds.message).not.toContain('exist');
  });

  it('3. Invalid email produces proper validation message', () => {
    const mapped = mapAuthError('Enter a valid email address.', 'validation');
    expect(mapped.title).toBe('Check your email');
    expect(mapped.message).toBe('Enter a valid email address.');
    expect(mapped.field).toBe('email');
    expect(mapped.isExpectedUserError).toBe(true);
  });

  it('4. Email already registered produces proper signup message', () => {
    const error = { code: 'user_already_exists', message: 'User already registered' };
    const mapped = mapAuthError(error, 'sign_up');

    expect(mapped.title).toBe('Account already exists');
    expect(mapped.message).toBe('An account with this email already exists. Try signing in instead.');
    expect(mapped.isExpectedUserError).toBe(true);
  });

  it('5. Password mismatch produces proper local validation message', () => {
    const mapped = mapAuthError("Passwords don't match.", 'validation');
    expect(mapped.title).toBe("Passwords don't match");
    expect(mapped.message).toBe("Passwords don't match.");
    expect(mapped.field).toBe('confirmPassword');
    expect(mapped.isExpectedUserError).toBe(true);
  });

  it('6. Weak password produces existing password-rule message', () => {
    const error = { code: 'password_too_weak', message: 'Password should be at least 6 characters' };
    const mapped = mapAuthError(error, 'sign_up');

    expect(mapped.title).toBe('Weak password');
    expect(mapped.message).toBe('Choose a stronger password.');
    expect(mapped.isExpectedUserError).toBe(true);
  });

  it('7. Network failure produces "No internet connection"', () => {
    const error = new TypeError('Failed to fetch');
    const mapped = mapAuthError(error, 'sign_in');

    expect(mapped.title).toBe('No internet connection');
    expect(mapped.message).toBe('Check your internet connection and try again.');
    expect(mapped.isExpectedUserError).toBe(false);
  });

  it('8. Timeout produces timeout message', () => {
    const error = { status: 504, message: 'Request timed out' };
    const mapped = mapAuthError(error, 'sign_in');

    expect(mapped.title).toBe('Request timed out');
    expect(mapped.message).toBe('The request took too long. Please try again.');
    expect(mapped.isExpectedUserError).toBe(false);
  });

  it('9. Rate limit produces too-many-attempts message', () => {
    const error = { code: 'over_email_send_rate_limit', status: 429, message: 'Email rate limit exceeded' };
    const mapped = mapAuthError(error, 'sign_in');

    expect(mapped.title).toBe('Too many attempts');
    expect(mapped.message).toBe('Please wait a moment before trying again.');
    expect(mapped.isExpectedUserError).toBe(true);
  });

  it('10. Unknown error produces safe generic fallback', () => {
    const error = { code: 'unexpected_crash', message: 'Internal DB syntax error near line 42' };
    const mapped = mapAuthError(error, 'sign_in');

    expect(mapped.title).toBe('Something went wrong');
    expect(mapped.message).toBe("We couldn't complete the sign-in. Please try again.");
    expect(mapped.isExpectedUserError).toBe(false);
  });

  it('11. Raw Supabase error text is not exposed in mapped messages', () => {
    const rawErrors = [
      'AuthApiError: Invalid login credentials',
      'PGRST301: JWT expired or invalid token',
      'Database Error: postgres_connection_refused',
      'TypeError: NetworkRequestFailed on endpoint https://xyz.supabase.co/auth/v1/token',
    ];

    for (const raw of rawErrors) {
      const mapped = mapAuthError(raw, 'sign_in');
      expect(mapped.message).not.toContain('PGRST');
      expect(mapped.message).not.toContain('AuthApiError');
      expect(mapped.message).not.toContain('postgres');
      expect(mapped.message).not.toContain('supabase.co');
    }
  });

  it('12. Authentication security behavior remains unchanged', async () => {
    // Unauthenticated status block test
    const resolution = await resolveAuthenticatedUserRoute('usr_victim_999');
    expect(resolution).toBeNull();
  });

  it('13. Expected auth mistakes are not sent to Sentry as errors', () => {
    const mockSentry = { captureException: jest.fn() };

    const expectedErrors = [
      mapAuthError({ code: 'invalid_credentials' }, 'sign_in'),
      mapAuthError('Enter a valid email address.', 'validation'),
      mapAuthError("Passwords don't match.", 'validation'),
      mapAuthError({ code: 'user_already_exists' }, 'sign_up'),
    ];

    for (const mapped of expectedErrors) {
      const reported = reportAuthErrorToSentry('raw error info', mapped, mockSentry);
      expect(reported).toBe(false);
    }
    expect(mockSentry.captureException).not.toHaveBeenCalled();

    // Unexpected error SHOULD be reported
    const unexpected = mapAuthError(new TypeError('Failed to fetch'), 'sign_in');
    const reportedUnexpected = reportAuthErrorToSentry('Failed to fetch', unexpected, mockSentry);
    expect(reportedUnexpected).toBe(true);
    expect(mockSentry.captureException).toHaveBeenCalled();
  });
});
