import {
  initErrorMonitoring,
  captureException,
  sanitizeContextData,
  isMonitoringConfigured,
} from '../src/services/monitoring/errorMonitoring';

describe('Production Error Monitoring & Privacy Sanitization', () => {
  it('1. initErrorMonitoring operates in silent fallback mode when DSN is missing without crashing', () => {
    expect(() => initErrorMonitoring()).not.toThrow();
    expect(isMonitoringConfigured()).toBe(false);
  });

  it('2. sanitizeContextData redacts sensitive keys and bearer tokens', () => {
    const rawContext = {
      user: { id: 'user-123', email: 'user@bebig.app' },
      password: 'SecretPassword123!',
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      headers: {
        authorization: 'Bearer eyJhbGci...',
      },
    };

    const sanitized = sanitizeContextData(rawContext);

    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.access_token).toBe('[REDACTED]');
    expect(sanitized.headers.authorization).toBe('[REDACTED]');
    expect(sanitized.user.id).toBe('user-123');
  });

  it('3. captureException safely processes exceptions with privacy context without throwing', () => {
    expect(() => {
      captureException(new Error('Test production error'), {
        tags: { route: '/home' },
        extra: { token: 'secret-val' },
      });
    }).not.toThrow();
  });
});
