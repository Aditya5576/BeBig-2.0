#!/usr/bin/env node
/**
 * Cross-platform web build helper for BeBig 2.0.
 *
 * Resolves the Git commit SHA for Expo web static export:
 * 1. EXPO_PUBLIC_GIT_SHA (already in environment)
 * 2. VERCEL_GIT_COMMIT_SHA (provided by Vercel deployment environment)
 * 3. Local git rev-parse --short HEAD (local development builds)
 * 4. Fallback to 'dev'
 *
 * Runs `npx expo export -p web` with inheritance of stdio.
 */

const { spawnSync } = require('child_process');

function resolveGitSha() {
  if (process.env.EXPO_PUBLIC_GIT_SHA && process.env.EXPO_PUBLIC_GIT_SHA.trim()) {
    return process.env.EXPO_PUBLIC_GIT_SHA.trim();
  }
  if (process.env.VERCEL_GIT_COMMIT_SHA && process.env.VERCEL_GIT_COMMIT_SHA.trim()) {
    return process.env.VERCEL_GIT_COMMIT_SHA.trim();
  }
  try {
    const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result.status === 0 && result.stdout && result.stdout.trim()) {
      return result.stdout.trim();
    }
  } catch {
    // Git unavailable or not in a git repository
  }
  return 'dev';
}

const gitSha = resolveGitSha();
process.env.EXPO_PUBLIC_GIT_SHA = gitSha;

console.log(`[build-web] Building Expo web bundle with EXPO_PUBLIC_GIT_SHA=${gitSha}`);

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const child = spawnSync(npxCmd, ['expo', 'export', '-p', 'web'], {
  stdio: 'inherit',
  shell: isWindows,
  env: process.env,
});

if (child.error) {
  console.error('[build-web] Failed to execute expo export:', child.error);
  process.exit(1);
}

process.exit(child.status !== null ? child.status : 1);
