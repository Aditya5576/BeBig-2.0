import {
  sanitizeContextData,
  sanitizeString,
  sanitizeEvent,
  sanitizeBreadcrumb,
} from '../src/services/monitoring/errorMonitoring';
import { env } from '../src/config/env';
import * as Sentry from '@sentry/react-native';

jest.mock('@sentry/react-native', () => {
  const scopeMock = {
    setTags: jest.fn(),
    setExtras: jest.fn(),
    setLevel: jest.fn(),
  };
  return {
    init: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    withScope: jest.fn((cb) => cb(scopeMock)),
    setUser: jest.fn(),
    wrap: jest.fn((component) => component),
    _scopeMock: scopeMock, // Exposing for assertions
  };
});

jest.mock('../src/config/env', () => ({
  env: {
    appEnv: 'production',
    appName: 'BeBig',
    version: '2.1.1',
    commitSha: 'b511ab6',
    sentryDsn: '',
    isDev: false,
  },
}));

describe('Production Error Monitoring & Privacy Sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to load clean module state per test
  const getCleanModule = () => {
    let moduleExports: any;
    jest.isolateModules(() => {
      moduleExports = require('../src/services/monitoring/errorMonitoring');
    });
    return moduleExports;
  };

  it('TEST 1 - INITIALIZATION: calls Sentry.init() exactly once when valid DSN exists', () => {
    (env as any).sentryDsn = 'https://fake@sentry.io/123';
    const { initErrorMonitoring } = getCleanModule();

    // Call once
    const success1 = initErrorMonitoring();
    expect(success1).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      dsn: 'https://fake@sentry.io/123',
    }));

    // Call again - should not trigger init twice
    const success2 = initErrorMonitoring();
    expect(success2).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });

  it('TEST 2 - NO-DSN SAFETY: when DSN missing, does not crash and Sentry.init is not called', () => {
    (env as any).sentryDsn = '';
    const { initErrorMonitoring, isMonitoringConfigured } = getCleanModule();

    expect(() => initErrorMonitoring()).not.toThrow();
    expect(isMonitoringConfigured()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('TEST 3 - EXCEPTION CAPTURE: captureException forwards error to Sentry when initialized', () => {
    (env as any).sentryDsn = 'https://fake@sentry.io/123';
    const { initErrorMonitoring, captureException } = getCleanModule();
    initErrorMonitoring();

    const testError = new Error('Test production error');
    captureException(testError);

    expect(Sentry.captureException).toHaveBeenCalledWith(testError);
  });

  it('TEST 4 - CONTEXT / SANITIZATION: context reaches Sentry sanitized, no sensitive data forwarded', () => {
    (env as any).sentryDsn = 'https://fake@sentry.io/123';
    const { initErrorMonitoring, captureException } = getCleanModule();
    initErrorMonitoring();

    const testError = new Error('Auth failure');
    captureException(testError, {
      tags: { source: 'network' },
      extra: { access_token: 'secret_token', user_email: 'user@bebig.app' },
      level: 'warning',
    });

    // Check scope callbacks
    const scopeMock = (Sentry as any)._scopeMock;
    expect(Sentry.withScope).toHaveBeenCalled();
    
    // Tags forwarded
    expect(scopeMock.setTags).toHaveBeenCalledWith({ source: 'network' });
    
    // Extras sanitized
    expect(scopeMock.setExtras).toHaveBeenCalledWith({
      access_token: '[REDACTED]',
      user_email: 'user@bebig.app'
    });
    
    // Level
    expect(scopeMock.setLevel).toHaveBeenCalledWith('warning');
    
    // Error captured
    expect(Sentry.captureException).toHaveBeenCalledWith(testError);
  });

  it('TEST 5 - USER CONTEXT: setUserContext calls Sentry.setUser with expected ID', () => {
    (env as any).sentryDsn = 'https://fake@sentry.io/123';
    const { initErrorMonitoring, setUserContext } = getCleanModule();
    initErrorMonitoring();

    setUserContext('user-123');
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-123' });

    setUserContext(null);
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });

  it('TEST 6 - DISABLED USER CONTEXT: setUserContext safely no-ops when not initialized', () => {
    (env as any).sentryDsn = '';
    const { initErrorMonitoring, setUserContext } = getCleanModule();
    initErrorMonitoring(); // Returns false

    expect(() => setUserContext('user-123')).not.toThrow();
    expect(Sentry.setUser).not.toHaveBeenCalled();
  });

  it('TEST 7 - ROOT WRAPPER: wrapRootLayout delegates to Sentry.wrap() correctly', () => {
    const { wrapRootLayout } = getCleanModule();
    
    const DummyComponent = () => null;
    const WrappedComponent = wrapRootLayout(DummyComponent);
    
    expect(Sentry.wrap).toHaveBeenCalledWith(DummyComponent);
    // Because our mock returns the component itself:
    expect(WrappedComponent).toBe(DummyComponent);
  });

  it('TEST 8 - BEFORE_SEND SANITIZATION: scrubs tokens from unhandled exception messages, headers, and extras', () => {
    (env as any).sentryDsn = 'https://fake@sentry.io/123';
    const { initErrorMonitoring } = getCleanModule();
    initErrorMonitoring();

    const initOptions = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(initOptions.beforeSend).toBeDefined();

    const rawEvent = {
      message: 'Uncaught failure with eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDNssOJJqZO2Mm0GLBJJBtnhnkGyZr9QTjHBffmOw token',
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Request failed: Bearer secret_bearer_token_12345 at endpoint',
          },
        ],
      },
      extra: {
        password: 'my-plaintext-password',
        auth_header: 'Bearer 12345',
        safe_info: 'workout-completed',
      },
      request: {
        url: 'https://xyz.supabase.co/rest/v1/workouts?apikey=sb_secret_key&limit=10',
        headers: {
          authorization: 'Bearer secret_token',
          'content-type': 'application/json',
        },
      },
      breadcrumbs: [
        {
          category: 'fetch',
          message: 'POST with Bearer eyJhbGci...',
          data: {
            url: 'https://xyz.supabase.co/auth/v1/token?grant_type=refresh_token&token=sensitive_jwt',
            refresh_token: 'secret_refresh',
          },
        },
      ],
    };

    const sanitizedEvent = initOptions.beforeSend(rawEvent);

    expect(sanitizedEvent.message).toBe('Uncaught failure with [REDACTED_AUTH_TOKEN] token');
    expect(sanitizedEvent.exception.values[0].value).toBe('Request failed: Bearer [REDACTED_AUTH_TOKEN] at endpoint');
    expect(sanitizedEvent.extra.password).toBe('[REDACTED]');
    expect(sanitizedEvent.extra.auth_header).toBe('[REDACTED]');
    expect(sanitizedEvent.extra.safe_info).toBe('workout-completed');
    expect(sanitizedEvent.request.url).toBe('https://xyz.supabase.co/rest/v1/workouts?apikey=[REDACTED]&limit=10');
    expect(sanitizedEvent.request.headers.authorization).toBe('[REDACTED]');
    expect(sanitizedEvent.request.headers['content-type']).toBe('application/json');
    expect(sanitizedEvent.breadcrumbs[0].data.refresh_token).toBe('[REDACTED]');
    expect(sanitizedEvent.breadcrumbs[0].data.url).toBe('https://xyz.supabase.co/auth/v1/token?grant_type=refresh_token&token=[REDACTED]');
  });

  it('TEST 9 - BEFORE_BREADCRUMB SANITIZATION: scrubs sensitive URLs and credentials from telemetry', () => {
    (env as any).sentryDsn = 'https://fake@sentry.io/123';
    const { initErrorMonitoring } = getCleanModule();
    initErrorMonitoring();

    const initOptions = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(initOptions.beforeBreadcrumb).toBeDefined();

    const rawBreadcrumb = {
      category: 'xhr',
      message: 'Network request to Supabase Bearer eyJhbGciOi...',
      data: {
        url: 'https://example.com/api?access_token=sensitive_token&action=save',
        session_token: 'raw_session_value',
      },
    };

    const cleanedBreadcrumb = initOptions.beforeBreadcrumb(rawBreadcrumb);

    expect(cleanedBreadcrumb.message).toContain('Bearer [REDACTED_AUTH_TOKEN]');
    expect(cleanedBreadcrumb.data.url).toBe('https://example.com/api?access_token=[REDACTED]&action=save');
    expect(cleanedBreadcrumb.data.session_token).toBe('[REDACTED]');
  });

  it('TEST 10 - ENVIRONMENT, RELEASE & PII CONFIGURATION: configures Sentry with non-sensitive release facts', () => {
    (env as any).sentryDsn = 'https://fake@sentry.io/123';
    (env as any).appEnv = 'production';
    (env as any).appName = 'BeBig';
    (env as any).version = '2.1.1';
    (env as any).commitSha = 'b511ab6';

    const { initErrorMonitoring } = getCleanModule();
    initErrorMonitoring();

    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      dsn: 'https://fake@sentry.io/123',
      environment: 'production',
      release: 'BeBig@2.1.1+b511ab6',
      dist: 'b511ab6',
      sendDefaultPii: false,
      enableAutoSessionTracking: true,
      debug: false,
    }));
  });

  it('TEST 11 - CAPTURE_MESSAGE: scrubs message and forwards to Sentry.captureMessage', () => {
    (env as any).sentryDsn = 'https://fake@sentry.io/123';
    const { initErrorMonitoring, captureMessage } = getCleanModule();
    initErrorMonitoring();

    captureMessage('Sync warning for Bearer eyJhbGci...', {
      tags: { service: 'sync' },
      extra: { secret_token: 'should_redact' },
    });

    const scopeMock = (Sentry as any)._scopeMock;
    expect(Sentry.withScope).toHaveBeenCalled();
    expect(scopeMock.setTags).toHaveBeenCalledWith({ service: 'sync' });
    expect(scopeMock.setExtras).toHaveBeenCalledWith({ secret_token: '[REDACTED]' });
    expect(Sentry.captureMessage).toHaveBeenCalledWith('Sync warning for Bearer [REDACTED_AUTH_TOKEN]');
  });

  it('TEST 12 - STRING SANITIZATION HELPER: correctly cleans JWTs, Bearers, and query params', () => {
    expect(sanitizeString('Bearer abc123def456')).toBe('Bearer [REDACTED_AUTH_TOKEN]');
    expect(sanitizeString('Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDNssOJJqZO2Mm0GLBJJBtnhnkGyZr9QTjHBffmOw')).toBe('Token: [REDACTED_AUTH_TOKEN]');
    expect(sanitizeString('https://api.bebig.app/data?apikey=secret_key&filter=all')).toBe('https://api.bebig.app/data?apikey=[REDACTED]&filter=all');
    expect(sanitizeString('Clean message')).toBe('Clean message');
  });
});

