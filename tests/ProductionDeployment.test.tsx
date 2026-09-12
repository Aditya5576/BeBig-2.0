declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');
import { getAuthRedirectUrl } from '../src/features/auth/utils/redirect';
import { Platform } from 'react-native';

describe('Production Deployment Configuration', () => {
  const rootDir = path.resolve(__dirname, '..');
  const vercelJsonPath = path.join(rootDir, 'vercel.json');
  const gitignorePath = path.join(rootDir, '.gitignore');

  describe('vercel.json Configuration', () => {
    it('exists and is valid JSON', () => {
      expect(fs.existsSync(vercelJsonPath)).toBe(true);
      const content = fs.readFileSync(vercelJsonPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('specifies the correct build command and dist output directory', () => {
      const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
      expect(config.buildCommand).toBe('npm run build:web');
      expect(config.outputDirectory).toBe('dist');
      expect(config.cleanUrls).toBe(true);
      expect(config.trailingSlash).toBe(false);
    });

    it('configures proper Service Worker and manifest cache headers', () => {
      const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
      const swHeader = config.headers.find((h: any) => h.source === '/sw.js');
      expect(swHeader).toBeDefined();

      const swCacheControl = swHeader.headers.find((k: any) => k.key === 'Cache-Control');
      expect(swCacheControl.value).toContain('no-cache');
      expect(swCacheControl.value).toContain('no-store');
      expect(swCacheControl.value).toContain('must-revalidate');

      const swAllowed = swHeader.headers.find((k: any) => k.key === 'Service-Worker-Allowed');
      expect(swAllowed.value).toBe('/');

      const manifestHeader = config.headers.find((h: any) => h.source === '/manifest.json');
      expect(manifestHeader).toBeDefined();
      const manifestContentType = manifestHeader.headers.find((k: any) => k.key === 'Content-Type');
      expect(manifestContentType.value).toContain('application/manifest+json');
    });

    it('configures security headers for all routes', () => {
      const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
      const globalHeader = config.headers.find((h: any) => h.source === '/(.*)');
      expect(globalHeader).toBeDefined();

      const nosniff = globalHeader.headers.find((k: any) => k.key === 'X-Content-Type-Options');
      expect(nosniff.value).toBe('nosniff');

      const frameOptions = globalHeader.headers.find((k: any) => k.key === 'X-Frame-Options');
      expect(frameOptions.value).toBe('DENY');
    });

    it('configures rewrites for all dynamic routes', () => {
      const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
      expect(config.rewrites).toEqual([
        { source: '/exercises/:id', destination: '/exercises/[id].html' },
        { source: '/templates/:id', destination: '/templates/[id].html' },
        { source: '/workout/history/:id', destination: '/workout/history/[id].html' },
        { source: '/workout/progress/exercise/:id', destination: '/workout/progress/exercise/[id].html' },
      ]);
    });
  });

  describe('.gitignore Deployment Safety', () => {
    it('ignores .vercel and environment variable files', () => {
      const gitignore = fs.readFileSync(gitignorePath, 'utf8');
      expect(gitignore).toContain('.vercel/');
      expect(gitignore).toContain('.env');
      expect(gitignore).toContain('.env.*');
      expect(gitignore).toContain('dist/');
    });
  });

  describe('Dynamic Auth Redirect Configuration on Web', () => {
    const originalPlatform = Platform.OS;

    afterEach(() => {
      Platform.OS = originalPlatform;
      delete (globalThis as any).window;
    });

    it('dynamically derives production origin callback URL without localhost', () => {
      Platform.OS = 'web';
      (globalThis as any).window = {
        location: {
          origin: 'https://bebig.vercel.app',
        },
      };

      const redirectUrl = getAuthRedirectUrl();
      expect(redirectUrl).toBe('https://bebig.vercel.app/auth/callback');
      expect(redirectUrl).not.toContain('localhost');
      expect(redirectUrl).not.toContain('127.0.0.1');
    });

    it('respects EXPO_PUBLIC_AUTH_REDIRECT_URL override if provided', () => {
      Platform.OS = 'web';
      (globalThis as any).window = {
        location: {
          origin: 'https://bebig.vercel.app',
        },
      };

      const originalEnv = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
      process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL = 'https://custom.bebig.app/auth/callback';

      try {
        const redirectUrl = getAuthRedirectUrl();
        expect(redirectUrl).toBe('https://custom.bebig.app/auth/callback');
      } finally {
        process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL = originalEnv;
      }
    });
  });
});
