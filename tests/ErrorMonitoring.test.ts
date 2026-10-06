import {
  sanitizeContextData,
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
    withScope: jest.fn((cb) => cb(scopeMock)),
    setUser: jest.fn(),
    wrap: jest.fn((component) => component),
    _scopeMock: scopeMock, // Exposing for assertions
  };
});

jest.mock('../src/config/env', () => ({
  env: {
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
});
