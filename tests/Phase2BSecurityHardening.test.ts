/**
 * BeBig 2.0 — Phase 2B Security Hardening & Compliance Tests
 *
 * Verifies:
 * - AUD-005: `xlsx` removed from package.json; pure-TS OOXML writer neutralizes formula injection
 * - AUD-010: Non-paused Edge Functions enforce allowlisted CORS (zero `*`), 405, payload caps, and redacted errors
 * - AUD-019: Atomic super-admin guard SQL migration (advisory lock trigger + transactional RPC)
 * - AUD-020: Web avatar EXIF stripping & downscaling + owner-scoped avatars storage SELECT RLS migration
 */

import {
  createOoxmlWorkbook,
  appendOoxmlSheet,
  writeOoxmlWorkbookToBytes,
  sanitizeSpreadsheetCell,
} from '../src/features/export/services/ooxmlWorkbook';
import {
  avatarService,
  AVATAR_MAX_EDGE_PX,
} from '../src/features/profile/services/avatarService';

declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

describe('Phase 2B Security Hardening (AUD-005, AUD-010, AUD-019, AUD-020)', () => {
  const rootDir = path.resolve(__dirname, '..');

  // ============================================================================
  // AUD-005: Vulnerable xlsx Removal & Formula Injection Defense
  // ============================================================================
  describe('AUD-005 — Dependency Remediation & Pure-TS OOXML Export', () => {
    it('removes vulnerable xlsx package from package.json dependencies', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      expect(pkg.dependencies?.xlsx).toBeUndefined();
      expect(pkg.devDependencies?.xlsx).toBeUndefined();
    });

    it('generates valid PKZIP OOXML archive with neutralized hostile formula payloads', () => {
      const wb = createOoxmlWorkbook();
      appendOoxmlSheet(
        wb,
        'Hostile Test',
        ['Formula', 'Number', 'Safe Text'],
        [
          ['=HYPERLINK("http://evil.example","Click")', 100, 'Normal Bench Press'],
          ['+1+1', -42.5, '@SUM(A1:A2)'],
        ]
      );

      const bytes = writeOoxmlWorkbookToBytes(wb);
      // PKZIP Local Header + EOCD signatures
      expect(bytes[0]).toBe(0x50);
      expect(bytes[1]).toBe(0x4b);
      expect(bytes[2]).toBe(0x03);
      expect(bytes[3]).toBe(0x04);

      const xml = new TextDecoder('utf-8').decode(bytes);
      expect(xml).toContain('&apos;=HYPERLINK');
      expect(xml).toContain('&apos;+1+1');
      expect(xml).toContain('&apos;@SUM(A1:A2)');
      expect(xml).toContain('<v>100</v>');
      expect(xml).toContain('<v>-42.5</v>');
      expect(sanitizeSpreadsheetCell('=CMD|\' /C calc\'!A0')).toBe("'=CMD|' /C calc'!A0");
    });
  });

  // ============================================================================
  // AUD-010: Edge Function Security Hardening Contracts
  // ============================================================================
  describe('AUD-010 — Edge Function CORS, Method, Payload & Error Contracts', () => {
    const sharedSecurityPath = path.join(rootDir, 'supabase', 'functions', '_shared', 'security.ts');
    const adminAssignPath = path.join(rootDir, 'supabase', 'functions', 'admin-assign-role', 'index.ts');
    const coachAgentPath = path.join(rootDir, 'supabase', 'functions', 'coach-agent', 'index.ts');
    const deleteAccountPath = path.join(rootDir, 'supabase', 'functions', 'delete-account', 'index.ts');

    it('defines allowlisted CORS with Vary: Origin and bounded JSON reader in _shared/security.ts', () => {
      const src = fs.readFileSync(sharedSecurityPath, 'utf8');
      expect(src).toContain('https://be-big-2-0.vercel.app');
      expect(src).toContain("'Vary': 'Origin'");
      expect(src).not.toContain("'Access-Control-Allow-Origin': '*'");
      expect(src).toContain('readBoundedJson');
      expect(src).toContain('status: 413');
      expect(src).toContain('createCorrelationId');
    });

    it.each([
      ['admin-assign-role', adminAssignPath],
      ['coach-agent', coachAgentPath],
      ['delete-account', deleteAccountPath],
    ])('%s eliminates wildcard CORS, enforces 405, bounds JSON payloads, and redacts raw errors', (_name, fnPath) => {
      const src = fs.readFileSync(fnPath, 'utf8');

      // Zero wildcard Access-Control-Allow-Origin
      expect(src).not.toContain("'Access-Control-Allow-Origin': '*'");
      expect(src).not.toContain('"Access-Control-Allow-Origin": "*"');

      // Uses shared security boundary
      expect(src).toContain('../_shared/security.ts');
      expect(src).toContain('getCorsHeaders(req)');
      expect(src).toContain('readBoundedJson');
      expect(src).toContain('createCorrelationId');

      // Explicit OPTIONS + 405 non-POST guard
      expect(src).toContain("req.method === 'OPTIONS'");
      expect(src).toContain("req.method !== 'POST'");
      expect(src).toContain('405');

      // Never returns raw err.message directly to caller
      expect(src).not.toContain('JSON.stringify({ error: err.message })');
    });

    it('admin-assign-role validates UUID, role enum, self-demotion, and calls atomic RPC', () => {
      const src = fs.readFileSync(adminAssignPath, 'utf8');
      expect(src).toContain('UUID_REGEX.test(target_user_id)');
      expect(src).toContain('VALID_ADMIN_ROLES');
      expect(src).toContain('target_user_id === user.id');
      expect(src).toContain("rpc('admin_mutate_role_atomic'");
      expect(src).toContain('CANNOT_REMOVE_LAST_SUPER_ADMIN');
    });
  });

  // ============================================================================
  // AUD-019: Atomic Super-Admin Guard Migration
  // ============================================================================
  describe('AUD-019 — Atomic Super-Admin Guard SQL Migration', () => {
    const migrationPath = path.join(
      rootDir,
      'supabase',
      'migrations',
      '20261118120000_atomic_super_admin_guard.sql'
    );

    it('enforces advisory-locked last-super-admin trigger and transactional role+audit RPC', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      expect(sql).toContain('pg_advisory_xact_lock');
      expect(sql).toContain('protect_last_super_admin_trigger');
      expect(sql).toContain('BEFORE DELETE OR UPDATE ON public.admin_roles');
      expect(sql).toContain('CANNOT_REMOVE_LAST_SUPER_ADMIN');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_mutate_role_atomic');
      expect(sql).toContain('SELF_DEMOTION_FORBIDDEN');
      expect(sql).toContain('INSERT INTO public.admin_audit_logs');
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.admin_mutate_role_atomic');
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.admin_mutate_role_atomic');
      expect(sql).toContain('TO service_role');
    });
  });

  // ============================================================================
  // AUD-020: Avatar EXIF Stripping & Owner-Scoped Storage RLS
  // ============================================================================
  describe('AUD-020 — Avatar EXIF Strip & Owner-Scoped Storage RLS', () => {
    const avatarMigrationPath = path.join(
      rootDir,
      'supabase',
      'migrations',
      '20261118120500_harden_avatars_storage_privacy.sql'
    );

    it('strips EXIF metadata and downscales oversized web avatars via offscreen canvas with GPU/blob cleanup', async () => {
      const originalDocument = (globalThis as any).document;
      const originalImage = (globalThis as any).Image;
      const originalUrl = (globalThis as any).URL;

      const drawImageMock = jest.fn();
      const revokeObjectURLMock = jest.fn();
      const createObjectURLMock = jest.fn(() => 'blob:mock-avatar-12mp');
      const mockCanvas: any = {
        width: 0,
        height: 0,
        getContext: jest.fn(() => ({ drawImage: drawImageMock })),
        toDataURL: jest.fn(() => 'data:image/jpeg;base64,/9j/cleanstrippedpayload'),
        toBlob: jest.fn((cb: (b: Blob) => void) => cb({ size: 24576, type: 'image/jpeg' } as any)),
      };

      (globalThis as any).document = {
        createElement: jest.fn(() => mockCanvas),
      };
      (globalThis as any).URL = {
        createObjectURL: createObjectURLMock,
        revokeObjectURL: revokeObjectURLMock,
      };
      (globalThis as any).Image = class MockImage {
        naturalWidth = 4032;
        naturalHeight = 3024;
        crossOrigin = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_val: string) {
          if (this.onload) this.onload();
        }
      };

      try {
        const fakeFile = { size: 1024 * 1024, type: 'image/jpeg' } as any;
        const result = await avatarService.sanitizeWebAvatarImage(fakeFile);

        expect(result).not.toBeNull();
        expect(result!.exifStripped).toBe(true);
        expect(result!.mimeType).toBe('image/jpeg');
        expect(result!.width).toBe(AVATAR_MAX_EDGE_PX);
        expect(result!.height).toBe(600);
        expect(result!.previewDataUrl).toBe('data:image/jpeg;base64,/9j/cleanstrippedpayload');
        expect(drawImageMock).toHaveBeenCalledTimes(1);

        // Canvas GPU backing store freed & temporary blob URL revoked
        expect(mockCanvas.width).toBe(0);
        expect(mockCanvas.height).toBe(0);
        expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-avatar-12mp');
      } finally {
        (globalThis as any).document = originalDocument;
        (globalThis as any).Image = originalImage;
        (globalThis as any).URL = originalUrl;
      }
    });

    it('returns null gracefully from sanitizeWebAvatarImage when Canvas DOM is unavailable', async () => {
      const result = await avatarService.sanitizeWebAvatarImage('data:image/jpeg;base64,abc');
      expect(result).toBeNull();
    });

    it('restricts avatars storage SELECT/listing RLS strictly to the owner folder', () => {
      expect(fs.existsSync(avatarMigrationPath)).toBe(true);
      const sql = fs.readFileSync(avatarMigrationPath, 'utf8');
      expect(sql).toContain('DROP POLICY IF EXISTS "Authenticated list access for avatars"');
      expect(sql).toContain('CREATE POLICY "Users can list and read own avatar folder"');
      expect(sql).toContain("bucket_id = 'avatars'");
      expect(sql).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    });
  });
});
