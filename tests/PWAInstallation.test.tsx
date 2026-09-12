declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

describe('Checkpoint 5 — PWA Installation Layer', () => {
  const rootDir = path.resolve(__dirname, '..');
  const manifestPath = path.join(rootDir, 'public', 'manifest.json');
  const swPath = path.join(rootDir, 'public', 'sw.js');
  const htmlPath = path.join(rootDir, 'app', '+html.tsx');
  const iconsDir = path.join(rootDir, 'public', 'icons');

  describe('Web App Manifest (manifest.json)', () => {
    it('exists and is valid JSON', () => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      const content = fs.readFileSync(manifestPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('defines required PWA installation metadata for Android Chrome', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      expect(manifest.name).toBe('BeBig');
      expect(manifest.short_name).toBe('BeBig');
      expect(manifest.start_url).toBe('/');
      expect(manifest.scope).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.orientation).toBe('portrait');
      expect(manifest.background_color).toBe('#090D16');
      expect(manifest.theme_color).toBe('#090D16');

      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

      const standard192 = manifest.icons.find(
        (i: any) => i.sizes === '192x192' && (i.purpose === 'any' || !i.purpose)
      );
      const standard512 = manifest.icons.find(
        (i: any) => i.sizes === '512x512' && (i.purpose === 'any' || !i.purpose)
      );
      const maskable192 = manifest.icons.find(
        (i: any) => i.sizes === '192x192' && i.purpose === 'maskable'
      );
      const maskable512 = manifest.icons.find(
        (i: any) => i.sizes === '512x512' && i.purpose === 'maskable'
      );

      expect(standard192).toBeDefined();
      expect(standard192.src).toBe('/icons/icon-192.png');
      expect(standard192.type).toBe('image/png');

      expect(standard512).toBeDefined();
      expect(standard512.src).toBe('/icons/icon-512.png');
      expect(standard512.type).toBe('image/png');

      expect(maskable192).toBeDefined();
      expect(maskable192.src).toBe('/icons/icon-maskable-192.png');
      expect(maskable192.type).toBe('image/png');

      expect(maskable512).toBeDefined();
      expect(maskable512.src).toBe('/icons/icon-maskable-512.png');
      expect(maskable512.type).toBe('image/png');
    });
  });

  describe('PWA Icon Assets', () => {
    const requiredIcons = [
      'icon-192.png',
      'icon-512.png',
      'icon-maskable-192.png',
      'icon-maskable-512.png',
      'apple-touch-icon.png',
    ];

    it.each(requiredIcons)('icon %s exists and has valid PNG signature', (filename) => {
      const filePath = path.join(iconsDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const buffer = fs.readFileSync(filePath);
      expect(buffer.length).toBeGreaterThan(100);

      // PNG magic number: 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    });

    it('favicon.png exists in public directory', () => {
      const faviconPath = path.join(rootDir, 'public', 'favicon.png');
      expect(fs.existsSync(faviconPath)).toBe(true);
      const buffer = fs.readFileSync(faviconPath);
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    });
  });

  describe('iOS Safari & HTML Shell Configuration (+html.tsx)', () => {
    let htmlContent: string;

    beforeAll(() => {
      htmlContent = fs.readFileSync(htmlPath, 'utf8');
    });

    it('links manifest.json and specifies theme-color', () => {
      expect(htmlContent).toContain('<link rel="manifest" href="/manifest.json" />');
      expect(htmlContent).toContain('<meta name="theme-color" content="#090D16" />');
    });

    it('configures iOS Safari standalone home-screen capability', () => {
      expect(htmlContent).toContain(
        '<meta name="apple-mobile-web-app-capable" content="yes" />'
      );
      expect(htmlContent).toContain(
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />'
      );
      expect(htmlContent).toContain(
        '<meta name="apple-mobile-web-app-title" content="BeBig" />'
      );
      expect(htmlContent).toContain(
        '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />'
      );
    });

    it('preserves fixed-scale viewport configuration', () => {
      expect(htmlContent).toContain('user-scalable=no');
      expect(htmlContent).toContain('maximum-scale=1');
      expect(htmlContent).toContain('viewport-fit=cover');
    });

    it('safely registers service worker without disruptive auto-reload', () => {
      expect(htmlContent).toContain("'serviceWorker' in navigator");
      expect(htmlContent).toContain("navigator.serviceWorker.register('/sw.js')");
      expect(htmlContent).not.toContain('window.location.reload()');
    });
  });

  describe('Service Worker Invariants & Security (sw.js)', () => {
    let swContent: string;

    beforeAll(() => {
      swContent = fs.readFileSync(swPath, 'utf8');
    });

    it('defines versioned cache and precaches core assets', () => {
      expect(swContent).toContain("CACHE_NAME = 'bebig-pwa-v1'");
      expect(swContent).toContain("'/manifest.json'");
      expect(swContent).toContain("'/icons/icon-192.png'");
      expect(swContent).toContain("'/icons/apple-touch-icon.png'");
    });

    it('cleans up old caches on activate and claims clients', () => {
      expect(swContent).toContain("addEventListener('activate'");
      expect(swContent).toContain('self.clients.claim()');
    });

    it('enforces strict security filters (only GET, same-origin only)', () => {
      expect(swContent).toContain("request.method !== 'GET'");
      expect(swContent).toContain('url.origin !== self.location.origin');
    });

    it('never caches authenticated requests or API endpoints', () => {
      expect(swContent).toContain("request.headers.has('authorization')");
      expect(swContent).toContain("request.headers.has('apikey')");
      expect(swContent).toContain("url.pathname.startsWith('/api/')");
      expect(swContent).toContain("url.pathname.startsWith('/rest/')");
      expect(swContent).toContain("url.pathname.startsWith('/auth/')");
    });

    it('uses Network-First strategy for HTML navigation requests', () => {
      expect(swContent).toContain("request.mode === 'navigate'");
      expect(swContent).toContain('fetch(request)');
      expect(swContent).toContain("caches.match('/')");
    });

    it('uses Cache-First strategy for static assets', () => {
      expect(swContent).toContain('/_expo/static/');
      expect(swContent).toContain('/assets/');
      expect(swContent).toContain('/icons/');
    });
  });
});
