import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML Document Template for Web.
 *
 * Configures the HTML shell, viewport, character encoding, and resets.
 * Ensures viewport-fit=cover for notch/home-indicator handling on iOS Safari,
 * while preserving zoom accessibility (no user-scalable=no).
 */
const mobileWebStyles = `
  html, body, #root {
    height: 100%;
    min-height: 100%;
    min-height: 100dvh;
    width: 100%;
    overflow-x: hidden;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    background-color: #090D16;
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, sans-serif;
    touch-action: pan-x pan-y;
  }
  input, textarea, select {
    font-size: 16px !important;
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    outline: none;
  }
  * {
    -webkit-tap-highlight-color: transparent;
    box-sizing: border-box;
  }
  body {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>BeBig</title>
        {/* PWA Manifest & Android Chrome Theme */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#090D16" />

        {/* iOS Safari Home Screen Configuration */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BeBig" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        {/* Google Fonts: Plus Jakarta Sans & JetBrains Mono */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: mobileWebStyles }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof document !== 'undefined') {
                document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });
                document.addEventListener('gesturechange', function(e) { e.preventDefault(); }, { passive: false });
                document.addEventListener('gestureend', function(e) { e.preventDefault(); }, { passive: false });
              }
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    if (reg && typeof reg.update === 'function') {
                      reg.update();
                    }
                  }).catch(function(err) {
                    console.warn('[SW] Registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
