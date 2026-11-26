declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
import { exercisePhotoCloudService } from '../src/features/exercises/services/exercisePhotoCloudService';

const mockStorageRemove = jest.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = jest.fn().mockResolvedValue({
  data: { signedUrl: 'https://example.supabase.co/storage/v1/object/sign/exercise-photos/u1/ex1/p.jpg?token=abc' },
  error: null,
});
const mockGetPublicUrl = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  supabase: {
    storage: {
      from: jest.fn(() => ({
        remove: mockStorageRemove,
        createSignedUrl: mockCreateSignedUrl,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  },
}));

const ROOT_DIR = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase', 'migrations');

function readAllFilesRecursive(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readAllFilesRecursive(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function loadDeleteAccountHandler(deps: {
  getUser: jest.Mock;
  storageList: jest.Mock;
  storageRemove: jest.Mock;
  dbDeleteEq: jest.Mock;
  auditInsert: jest.Mock;
  deleteUser: jest.Mock;
}): (req: any) => Promise<Response> {
  const securitySrc = fs.readFileSync(
    path.join(ROOT_DIR, 'supabase', 'functions', '_shared', 'security.ts'),
    'utf8'
  );
  const fnSrc = fs.readFileSync(
    path.join(ROOT_DIR, 'supabase', 'functions', 'delete-account', 'index.ts'),
    'utf8'
  );

  const compileCjs = (source: string) =>
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;

  const securityExports: Record<string, any> = {};
  const securityModule = { exports: securityExports };
  vm.runInNewContext(compileCjs(securitySrc), {
    exports: securityExports,
    module: securityModule,
    Deno: { env: { get: () => undefined } },
    crypto: globalThis.crypto,
    Response: globalThis.Response,
    Headers: globalThis.Headers,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
  });

  let capturedHandler: ((req: any) => Promise<Response>) | null = null;
  const mockCreateClient = () => ({
    auth: {
      getUser: deps.getUser,
      admin: { deleteUser: deps.deleteUser },
    },
    storage: {
      from: (bucket: string) => ({
        list: (prefix: string, opts: unknown) => deps.storageList(bucket, prefix, opts),
        remove: (paths: string[]) => deps.storageRemove(bucket, paths),
      }),
    },
    from: (table: string) => ({
      delete: () => ({
        eq: (col: string, val: string) => deps.dbDeleteEq(table, col, val),
      }),
      insert: (row: unknown) => deps.auditInsert(table, row),
    }),
  });

  const fnRequire = (specifier: string) => {
    if (specifier.includes('std@') && specifier.includes('/http/server.ts')) {
      return {
        serve: (handler: (req: any) => Promise<Response>) => {
          capturedHandler = handler;
        },
      };
    }
    if (specifier.includes('@supabase/supabase-js')) {
      return { createClient: mockCreateClient };
    }
    if (specifier.endsWith('/security.ts') || specifier.endsWith('security.ts')) {
      return securityModule.exports;
    }
    throw new Error(`Unexpected import in delete-account: ${specifier}`);
  };

  vm.runInNewContext(compileCjs(fnSrc), {
    require: fnRequire,
    exports: {},
    module: { exports: {} },
    Deno: {
      env: {
        get: (key: string) => {
          if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
          if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-role-secret';
          return undefined;
        },
      },
    },
    Response: globalThis.Response,
    Headers: globalThis.Headers,
    console,
  });

  if (!capturedHandler) {
    throw new Error('delete-account did not register a serve() handler');
  }
  return capturedHandler;
}

describe('Phase 06: Supabase & Backend Security Audit (RLS, Storage & Edge Functions)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('SEC-01: all user tables in supabase/migrations/ enable RLS with scoped policies and no overly permissive user policies', () => {
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();
    expect(migrationFiles.length).toBeGreaterThan(0);

    const combinedSql = migrationFiles
      .map((f: string) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
      .join('\n');

    const userOwnedTables = [
      'profiles',
      'workout_sessions',
      'workout_templates',
      'custom_exercises',
      'scheduled_workouts',
      'admin_roles',
      'admin_audit_logs',
      'coach_client_relationships',
      'app_error_logs',
      'app_announcements',
      'trainer_workout_templates',
      'assigned_workouts',
      'global_exercise_catalog',
      'wger_exercise_catalog',
    ];

    for (const table of userOwnedTables) {
      const rlsRegex = new RegExp(
        `ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        'i'
      );
      expect(combinedSql).toMatch(rlsRegex);
    }

    // ai_usage_quotas intentionally revokes all direct PUBLIC/anon/authenticated access
    expect(combinedSql).toMatch(/REVOKE\s+ALL\s+ON\s+public\.ai_usage_quotas\s+FROM\s+PUBLIC/i);
    expect(combinedSql).toMatch(/REVOKE\s+ALL\s+ON\s+public\.ai_usage_quotas\s+FROM\s+anon/i);
    expect(combinedSql).toMatch(/REVOKE\s+ALL\s+ON\s+public\.ai_usage_quotas\s+FROM\s+authenticated/i);

    // Verify real CREATE POLICY owner/role predicates for every user-owned and admin/coach table
    const allPolicies = [...combinedSql.matchAll(/CREATE\s+POLICY[\s\S]*?;/gi)].map((m) => m[0]);
    const policiesFor = (table: string) =>
      allPolicies.filter((p) => new RegExp(`ON\\s+(?:public\\.)?${table}\\b`, 'i').test(p));

    // profiles: SELECT, INSERT, UPDATE bound to auth.uid() = id
    for (const op of ['FOR\\s+SELECT', 'FOR\\s+INSERT', 'FOR\\s+UPDATE']) {
      expect(
        policiesFor('profiles').some(
          (p) => new RegExp(op, 'i').test(p) && /auth\.uid\(\)\s*=\s*id/i.test(p)
        )
      ).toBe(true);
    }

    // workout_sessions, workout_templates, custom_exercises: SELECT, INSERT, UPDATE bound to auth.uid() = user_id
    for (const table of ['workout_sessions', 'workout_templates', 'custom_exercises']) {
      for (const op of ['FOR\\s+SELECT', 'FOR\\s+INSERT', 'FOR\\s+UPDATE']) {
        expect(
          policiesFor(table).some(
            (p) => new RegExp(op, 'i').test(p) && /auth\.uid\(\)\s*=\s*user_id/i.test(p)
          )
        ).toBe(true);
      }
    }

    // scheduled_workouts: SELECT, INSERT, UPDATE, DELETE bound to auth.uid() = user_id
    for (const op of ['FOR\\s+SELECT', 'FOR\\s+INSERT', 'FOR\\s+UPDATE', 'FOR\\s+DELETE']) {
      expect(
        policiesFor('scheduled_workouts').some(
          (p) => new RegExp(op, 'i').test(p) && /auth\.uid\(\)\s*=\s*user_id/i.test(p)
        )
      ).toBe(true);
    }

    // Coach & admin tables: verify explicit auth.uid() / admin_roles predicates
    expect(
      policiesFor('coach_client_relationships').some((p) =>
        /auth\.uid\(\)\s*=\s*coach_id\s+OR\s+auth\.uid\(\)\s*=\s*client_id/i.test(p)
      )
    ).toBe(true);
    expect(
      policiesFor('admin_roles').some(
        (p) => /FOR\s+SELECT/i.test(p) && /auth\.uid\(\)\s*=\s*user_id/i.test(p)
      )
    ).toBe(true);
    for (const adminTable of [
      'admin_audit_logs',
      'trainer_workout_templates',
      'assigned_workouts',
      'app_error_logs',
      'app_announcements',
    ]) {
      expect(policiesFor(adminTable).length).toBeGreaterThan(0);
      expect(
        policiesFor(adminTable).some((p) =>
          /admin_roles|is_current_user_admin|is_admin|has_admin_role/i.test(p)
        )
      ).toBe(true);
    }

    // Ensure any USING (true) policy in migrations is strictly restricted to service_role
    const usingTrueMatches = allPolicies.filter((p) => /USING\s*\(\s*true\s*\)/i.test(p));
    for (const match of usingTrueMatches) {
      expect(match).toMatch(/TO\s+service_role/i);
    }
  });

  it('SEC-02: exercise-photos and avatars storage policies enforce private owner-folder isolation without public read access', () => {
    const exercisePhotosSql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261016120000_create_exercise_photos_bucket.sql'),
      'utf8'
    );
    expect(exercisePhotosSql).toMatch(/'exercise-photos',\s*\r?\n\s*'exercise-photos',\s*\r?\n\s*false/i);
    expect(exercisePhotosSql).not.toMatch(/TO\s+public|TO\s+anon/i);

    for (const op of ['FOR SELECT', 'FOR INSERT', 'FOR UPDATE', 'FOR DELETE']) {
      expect(exercisePhotosSql).toContain(op);
    }
    const folderChecks = exercisePhotosSql.match(/\(storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/gi) || [];
    expect(folderChecks.length).toBeGreaterThanOrEqual(5);

    const avatarsHardeningSql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '20261118120500_harden_avatars_storage_privacy.sql'),
      'utf8'
    );
    expect(avatarsHardeningSql).toMatch(/DROP\s+POLICY\s+IF\s+EXISTS\s+"Public read access for avatars"/i);
    expect(avatarsHardeningSql).toMatch(/\(storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/i);
  });

  it('SEC-03: client code exposes zero service-role keys and exercisePhotoCloudService isolates paths & uses signed URLs only', async () => {
    const clientFiles = [
      ...readAllFilesRecursive(path.join(ROOT_DIR, 'app'), ['.ts', '.tsx']),
      ...readAllFilesRecursive(path.join(ROOT_DIR, 'src'), ['.ts', '.tsx']),
    ];

    for (const filePath of clientFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).not.toMatch(/EXPO_PUBLIC_.*SERVICE_ROLE/i);
      expect(content).not.toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/i);
      expect(content).not.toMatch(/Deno\.env\.get\(['"]SUPABASE_SERVICE_ROLE_KEY['"]\)/i);
    }

    // Ownership checks on private exercise-photos bucket
    expect(exercisePhotoCloudService.getStoragePath('user_1', 'ex_9', 'image/png')).toMatch(
      /^user_1\/ex_9\/photo_\d+\.png$/
    );
    expect(exercisePhotoCloudService.isUserOwnedPath('user_1', 'user_1/ex_9/photo_1.jpg')).toBe(true);
    expect(exercisePhotoCloudService.isUserOwnedPath('user_1', 'user_2/ex_9/photo_1.jpg')).toBe(false);
    expect(exercisePhotoCloudService.isUserOwnedPath('user_1', 'unscoped_photo.jpg')).toBe(false);

    // Cross-user delete must fail fast before touching Supabase storage
    const crossUserDeleted = await exercisePhotoCloudService.deletePhoto('user_1', 'user_2/ex_9/photo_1.jpg');
    expect(crossUserDeleted).toBe(false);
    expect(mockStorageRemove).not.toHaveBeenCalled();

    // Signed URL retrieval must use createSignedUrl and never getPublicUrl
    const signedUrl = await exercisePhotoCloudService.getSignedUrl('user_1/ex_9/photo_1.jpg');
    expect(signedUrl).toContain('token=abc');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('user_1/ex_9/photo_1.jpg', 3600);
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });

  it('SEC-04: delete-account Edge Function rejects missing/invalid JWTs with 401 and scopes cleanup strictly to verified user.id', async () => {
    const getUser = jest.fn();
    const storageList = jest.fn().mockResolvedValue({ data: [], error: null });
    const storageRemove = jest.fn().mockResolvedValue({ error: null });
    const dbDeleteEq = jest.fn().mockResolvedValue({ error: null });
    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const deleteUser = jest.fn().mockResolvedValue({ error: null });

    const handler = loadDeleteAccountHandler({
      getUser,
      storageList,
      storageRemove,
      dbDeleteEq,
      auditInsert,
      deleteUser,
    });

    const makeReq = (headers: Record<string, string>, body: unknown) => ({
      method: 'POST',
      headers: new Headers(headers),
      text: async () => JSON.stringify(body),
    });

    // 1. Missing Authorization header -> 401
    const missingAuthRes = await handler(makeReq({}, { confirm: 'DELETE_MY_ACCOUNT' }));
    expect(missingAuthRes.status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();

    // 2. Invalid/expired JWT -> 401
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid JWT' } });
    const invalidAuthRes = await handler(
      makeReq({ Authorization: 'Bearer bad.jwt.token' }, { confirm: 'DELETE_MY_ACCOUNT' })
    );
    expect(invalidAuthRes.status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();

    // 3. Valid JWT -> scopes storage, DB, and auth.admin.deleteUser strictly to verified user.id
    getUser.mockResolvedValueOnce({
      data: { user: { id: 'verified_user_123', email: 'athlete@example.com' } },
      error: null,
    });
    storageList.mockImplementation(async (bucket: string, prefix: string) => {
      if (bucket === 'exercise-photos' && prefix === 'verified_user_123') {
        return { data: [{ name: 'ex1.jpg', id: 'obj_1' }], error: null };
      }
      return { data: [], error: null };
    });

    const validRes = await handler(
      makeReq(
        { Authorization: 'Bearer valid.jwt.token' },
        { confirm: 'DELETE_MY_ACCOUNT', userId: 'attacker_spoofed_id' }
      )
    );
    expect(validRes.status).toBe(200);
    expect(storageList).toHaveBeenCalledWith('avatars', 'verified_user_123', expect.any(Object));
    expect(storageList).toHaveBeenCalledWith('exercise-photos', 'verified_user_123', expect.any(Object));
    expect(storageList).toHaveBeenCalledWith('exercise-demos', 'verified_user_123', expect.any(Object));
    expect(storageRemove).toHaveBeenCalledWith('exercise-photos', ['verified_user_123/ex1.jpg']);
    expect(dbDeleteEq).toHaveBeenCalledWith('workout_sessions', 'user_id', 'verified_user_123');
    expect(dbDeleteEq).toHaveBeenCalledWith('profiles', 'id', 'verified_user_123');
    expect(deleteUser).toHaveBeenCalledWith('verified_user_123');
    expect(deleteUser).not.toHaveBeenCalledWith('attacker_spoofed_id');
  });
});
