/**
 * BeBig 2.0 — Brand Asset Processor
 *
 * Strips baked-in checkerboard backgrounds and corner watermarks from source assets:
 * - `assets/Logo Name.png` -> `assets/bebig-logo-name.png` & `assets/splash-icon.png`
 * - `assets/only logo.png` -> `assets/bebig-only-logo.png` & `assets/bebig-emblem.png`
 *
 * Generates calibrated app and PWA icons:
 * - `assets/icon.png` (1024x1024 opaque #090D16 for iOS App Store)
 * - `assets/adaptive-icon.png` & `assets/android-icon-foreground.png` (1024x1024 transparent)
 * - `assets/favicon.png` & `public/favicon.png` (48x48)
 * - `public/icons/icon-192.png` & `public/icons/icon-512.png`
 * - `public/apple-touch-icon.png` & `public/icons/apple-touch-icon.png` (180x180 on #090D16)
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PUBLIC_ICONS_DIR = path.join(PUBLIC_DIR, 'icons');

// Brand palette constants
const OBSIDIAN_BG = { r: 9, g: 13, b: 22, alpha: 1 }; // #090D16

async function cleanSourceImage(inputPath, options = {}) {
  const { isOnlyLogo = false } = options;
  console.log(`Processing: ${path.basename(inputPath)}...`);

  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const out = Buffer.alloc(w * h * 4);

  // Pass 1: Mask out watermark, key out checkerboard, apply anti-aliased edge feathering
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * ch;
      const outIdx = (y * w + x) * 4;

      // 1. Watermark in bottom-right corner (x >= 1850 && y >= 1850)
      if (x >= 1850 && y >= 1850) {
        out[outIdx] = 0;
        out[outIdx + 1] = 0;
        out[outIdx + 2] = 0;
        out[outIdx + 3] = 0;
        continue;
      }

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC - minC;

      // 2. Checkerboard Detection:
      // Neutral gray/charcoal squares are <= 168 in max brightness and <= 12 in saturation
      if (maxC <= 168 && sat <= 12) {
        out[outIdx] = 0;
        out[outIdx + 1] = 0;
        out[outIdx + 2] = 0;
        out[outIdx + 3] = 0;
        continue;
      }

      // 3. Foreground / Anti-Aliased Edge Feathering
      let alpha = 255;
      if (sat > 20 || maxC >= 210) {
        alpha = 255;
      } else if (sat > 12) {
        // Colored edge transition (Electric Blue / Emerald Green)
        const t = Math.min(1, (sat - 12) / 10);
        alpha = Math.round(t * 255);
      } else if (maxC > 168) {
        // Metallic white edge transition
        const t = Math.min(1, (maxC - 168) / (210 - 168));
        alpha = Math.round(t * 255);
      }

      if (alpha <= 0) {
        out[outIdx] = 0;
        out[outIdx + 1] = 0;
        out[outIdx + 2] = 0;
        out[outIdx + 3] = 0;
      } else {
        out[outIdx] = r;
        out[outIdx + 1] = g;
        out[outIdx + 2] = b;
        out[outIdx + 3] = alpha;
      }
    }
  }

  // Pass 2: Find tight bounding box of non-zero alpha
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = out[(y * w + x) * 4 + 3];
      if (a > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const PADDING = 32;
  const cropLeft = Math.max(0, minX - PADDING);
  const cropTop = Math.max(0, minY - PADDING);
  const cropRight = Math.min(w - 1, maxX + PADDING);
  const cropBottom = Math.min(h - 1, maxY + PADDING);
  const cropWidth = cropRight - cropLeft + 1;
  const cropHeight = cropBottom - cropTop + 1;

  console.log(`  Tight bbox: [${minX}, ${minY}, ${maxX}, ${maxY}], cropped to: ${cropWidth}x${cropHeight}`);

  // Extract trimmed transparent image
  const trimmed = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { buffer: trimmed, width: cropWidth, height: cropHeight };
}

async function main() {
  console.log('--- Starting Brand Logo & Icon Processing ---');

  if (!fs.existsSync(PUBLIC_ICONS_DIR)) {
    fs.mkdirSync(PUBLIC_ICONS_DIR, { recursive: true });
  }

  const logoNameSource = path.join(ASSETS_DIR, 'Logo Name.png');
  const onlyLogoSource = path.join(ASSETS_DIR, 'only logo.png');

  if (!fs.existsSync(logoNameSource) || !fs.existsSync(onlyLogoSource)) {
    throw new Error('Missing source brand logos in assets/');
  }

  // 1. Process Logo Name (Emblem + Wordmark)
  const logoNameResult = await cleanSourceImage(logoNameSource, { isOnlyLogo: false });
  const bebigLogoNamePath = path.join(ASSETS_DIR, 'bebig-logo-name.png');
  const splashIconPath = path.join(ASSETS_DIR, 'splash-icon.png');
  const splashAthletePath = path.join(ASSETS_DIR, 'splash-athlete.png');

  fs.writeFileSync(bebigLogoNamePath, logoNameResult.buffer);
  fs.writeFileSync(splashIconPath, logoNameResult.buffer);
  fs.writeFileSync(splashAthletePath, logoNameResult.buffer);
  console.log(`✓ Wrote ${bebigLogoNamePath}`);
  console.log(`✓ Wrote ${splashIconPath}`);
  console.log(`✓ Wrote ${splashAthletePath}`);

  // 2. Process Only Logo (Emblem Only)
  const onlyLogoResult = await cleanSourceImage(onlyLogoSource, { isOnlyLogo: true });
  const bebigOnlyLogoPath = path.join(ASSETS_DIR, 'bebig-only-logo.png');
  const bebigEmblemPath = path.join(ASSETS_DIR, 'bebig-emblem.png');

  fs.writeFileSync(bebigOnlyLogoPath, onlyLogoResult.buffer);
  fs.writeFileSync(bebigEmblemPath, onlyLogoResult.buffer);
  console.log(`✓ Wrote ${bebigOnlyLogoPath}`);
  console.log(`✓ Wrote ${bebigEmblemPath}`);

  // 3. Generate App Store Icon: 1024x1024 opaque #090D16 background with centered emblem
  const iconEmblemSize = 640;
  const resizedEmblemForIcon = await sharp(onlyLogoResult.buffer)
    .resize(iconEmblemSize, iconEmblemSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const appIconBuffer = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: OBSIDIAN_BG.r, g: OBSIDIAN_BG.g, b: OBSIDIAN_BG.b },
    },
  })
    .composite([{ input: resizedEmblemForIcon, gravity: 'center' }])
    .removeAlpha()
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), appIconBuffer);
  console.log(`✓ Wrote assets/icon.png (1024x1024 opaque #090D16 without alpha)`);

  // 4. Generate Android Adaptive Icon Foreground: 1024x1024 transparent with safe zone
  const adaptiveEmblemSize = 560;
  const resizedEmblemForAdaptive = await sharp(onlyLogoResult.buffer)
    .resize(adaptiveEmblemSize, adaptiveEmblemSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const adaptiveIconBuffer = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resizedEmblemForAdaptive, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(ASSETS_DIR, 'adaptive-icon.png'), adaptiveIconBuffer);
  fs.writeFileSync(path.join(ASSETS_DIR, 'android-icon-foreground.png'), adaptiveIconBuffer);
  console.log(`✓ Wrote assets/adaptive-icon.png & android-icon-foreground.png`);

  // 5. Generate Favicons (48x48)
  const faviconBuffer = await sharp(onlyLogoResult.buffer)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(ASSETS_DIR, 'favicon.png'), faviconBuffer);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.png'), faviconBuffer);
  console.log(`✓ Wrote assets/favicon.png & public/favicon.png (48x48)`);

  // 6. Generate PWA Icons: 192x192 & 512x512
  const icon192Buffer = await sharp(onlyLogoResult.buffer)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-192.png'), icon192Buffer);

  const icon512Buffer = await sharp(onlyLogoResult.buffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-512.png'), icon512Buffer);
  console.log(`✓ Wrote public/icons/icon-192.png & icon-512.png`);

  // 7. Generate Maskable Icons for PWA on #090D16 background
  const maskable192 = await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: OBSIDIAN_BG.r, g: OBSIDIAN_BG.g, b: OBSIDIAN_BG.b, alpha: 1 },
    },
  })
    .composite([{
      input: await sharp(onlyLogoResult.buffer).resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      gravity: 'center',
    }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-maskable-192.png'), maskable192);

  const maskable512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: OBSIDIAN_BG.r, g: OBSIDIAN_BG.g, b: OBSIDIAN_BG.b, alpha: 1 },
    },
  })
    .composite([{
      input: await sharp(onlyLogoResult.buffer).resize(380, 380, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      gravity: 'center',
    }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'icon-maskable-512.png'), maskable512);
  console.log(`✓ Wrote public/icons/icon-maskable-192.png & icon-maskable-512.png`);

  // 8. Generate Apple Touch Icon: 180x180 on #090D16
  const appleTouchIcon = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 3,
      background: { r: OBSIDIAN_BG.r, g: OBSIDIAN_BG.g, b: OBSIDIAN_BG.b },
    },
  })
    .composite([{
      input: await sharp(onlyLogoResult.buffer).resize(130, 130, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      gravity: 'center',
    }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), appleTouchIcon);
  fs.writeFileSync(path.join(PUBLIC_ICONS_DIR, 'apple-touch-icon.png'), appleTouchIcon);
  console.log(`✓ Wrote public/apple-touch-icon.png & public/icons/apple-touch-icon.png`);

  console.log('--- All Brand & Icon Assets Successfully Generated ---');
}

main().catch((err) => {
  console.error('Asset processing failed:', err);
  process.exit(1);
});
