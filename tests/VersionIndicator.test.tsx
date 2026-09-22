import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import HomeScreen from '../app/home';
import SettingsScreen from '../app/settings';
import { getAppVersionInfo } from '../src/config/version';
import { env } from '../src/config/env';
import packageJson from '../package.json';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Issue #8 — Version Indicator per Production Deployment', () => {
  const originalGitSha = process.env.EXPO_PUBLIC_GIT_SHA;

  afterEach(() => {
    if (originalGitSha !== undefined) {
      process.env.EXPO_PUBLIC_GIT_SHA = originalGitSha;
    } else {
      delete process.env.EXPO_PUBLIC_GIT_SHA;
    }
    delete process.env.EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GIT_COMMIT_SHA;
  });

  describe('Version Resolution Logic', () => {
    it('1 & 2. Correctly resolves package.json version and semver format', () => {
      const info = getAppVersionInfo();
      expect(info.version).toBe(packageJson.version);
      expect(info.displayVersion).toContain(`v${packageJson.version}`);
    });

    it('3. Resolves short 7-char Git commit SHA when production build env is present', () => {
      process.env.EXPO_PUBLIC_GIT_SHA = 'abcdef1234567890';
      const info = getAppVersionInfo();
      expect(info.isProductionBuild).toBe(true);
      expect(info.commitSha).toBe('abcdef1');
      expect(info.displayVersion).toBe(`v${packageJson.version} · abcdef1`);
    });

    it('4. Falls back safely to "dev" when build metadata is missing', () => {
      delete process.env.EXPO_PUBLIC_GIT_SHA;
      delete process.env.EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      delete process.env.GIT_COMMIT_SHA;

      const info = getAppVersionInfo();
      expect(info.isProductionBuild).toBe(false);
      expect(info.commitSha).toBe('dev');
      expect(info.displayVersion).toBe(`v${packageJson.version} · dev`);
    });

    it('5. Does not expose private environment variables or secrets', () => {
      const info = getAppVersionInfo();
      expect(info.displayVersion).not.toContain('SUPABASE');
      expect(info.displayVersion).not.toContain('SECRET');
      expect(info.displayVersion.length).toBeLessThan(40);
    });
  });

  describe('UI Rendering & Verification', () => {
    it('6. Home screen renders valid version indicator in footer', async () => {
      const { getByTestId, getByText } = await render(<HomeScreen />);

      await waitFor(() => {
        expect(getByTestId('app-version-indicator')).toBeTruthy();
        expect(getByText(new RegExp(env.displayVersion, 'i'))).toBeTruthy();
      });
    });

    it('7. Settings screen renders valid version indicator in App Information card', async () => {
      const { getByTestId, getByText } = await render(<SettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('settings-version-text')).toBeTruthy();
        expect(getByText(new RegExp(env.displayVersion, 'i'))).toBeTruthy();
      });
    });
  });
});
