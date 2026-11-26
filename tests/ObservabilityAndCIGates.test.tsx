declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  wrap: (comp: unknown) => comp,
}));

import {
  initErrorMonitoring,
  sanitizeString,
  sanitizeEvent,
} from '../src/services/monitoring/errorMonitoring';

const ROOT_DIR = path.resolve(__dirname, '..');

describe('Phase 07: Observability & CI Quality Gates', () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    } else {
      process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    }
  });

  it('QA-01: initErrorMonitoring gracefully no-ops when EXPO_PUBLIC_SENTRY_DSN is absent', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    const initialized = initErrorMonitoring();
    expect(initialized).toBe(false);
  });

  it('QA-02: sanitizeString, sanitizeObject, and sanitizeEvent scrub Bearer tokens, JWTs, auth headers, and email PII', () => {
    const rawMsg =
      'Auth failed for athlete@example.com with Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig and ?access_token=secret123';
    const scrubbed = sanitizeString(rawMsg);
    expect(scrubbed).not.toContain('athlete@example.com');
    expect(scrubbed).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(scrubbed).not.toContain('secret123');
    expect(scrubbed).toContain('[REDACTED_EMAIL]');
    expect(scrubbed).toContain('[REDACTED_AUTH_TOKEN]');

    const event = sanitizeEvent({
      message: 'Failed for user@test.io',
      extra: {
        headers: {
          Authorization: 'Bearer super_secret_token',
          'x-custom': 'ok',
        },
        access_token: 'tok_abc',
        refresh_token: 'ref_xyz',
        userEmail: 'coach@bebig.app',
      },
      request: {
        headers: { authorization: 'Bearer abc.def.ghi' },
        url: 'https://api.example.com?refresh_token=r123',
      },
    });
    expect(event.message).toBe('Failed for [REDACTED_EMAIL]');
    expect((event.extra as any).headers.Authorization).toBe('[REDACTED]');
    expect((event.extra as any).headers['x-custom']).toBe('ok');
    expect((event.extra as any).access_token).toBe('[REDACTED]');
    expect((event.extra as any).refresh_token).toBe('[REDACTED]');
    expect((event.extra as any).userEmail).toBe('[REDACTED_EMAIL]');
    expect(event.request?.headers?.authorization).toBe('[REDACTED]');
    expect(event.request?.url).toContain('refresh_token=[REDACTED]');
  });

  it('QA-03: .github/workflows/ci.yml uses pinned actions and runs typecheck, lint, and Jest without secret env vars', () => {
    const ciPath = path.join(ROOT_DIR, '.github', 'workflows', 'ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);
    const ciYml = fs.readFileSync(ciPath, 'utf8');

    expect(ciYml).toContain('actions/checkout@v4');
    expect(ciYml).toContain('actions/setup-node@v4');
    expect(ciYml).toContain('npm ci');
    expect(ciYml).toContain('npm run typecheck');
    expect(ciYml).toContain('npm run lint');
    expect(ciYml).toMatch(/npx jest\s+--maxWorkers=2/);
    expect(ciYml).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
