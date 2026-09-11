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
    touch-action: pan-x pan-y;
  }
  input, textarea, select {
    font-size: 16px !important;
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
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
