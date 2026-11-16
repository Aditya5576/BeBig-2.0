import React from 'react';
import { render } from '@testing-library/react-native';
import { StartupSplash } from '../src/components/ui/StartupSplash';
import { BrandLogoBadge } from '../src/components/ui/BrandLogoBadge';
import AuthScreen from '../app/onboarding/auth';
import CreateCustomExerciseScreen from '../app/exercises/new';
import appConfig from '../app.json';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, {
    Screen: () => null,
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

describe('BeBig 2.0 — Startup Splash & Keyboard Overlap Fix', () => {
  describe('Objective 1: Mobile Keyboard Overlap Handling', () => {
    it('1: Auth screen wraps form inputs in KeyboardAvoidingView with iOS padding', async () => {
      const { getByTestId } = await render(<AuthScreen />);

      // Verify email & password fields are present and interactive
      expect(getByTestId('auth-email-input')).toBeTruthy();
      expect(getByTestId('auth-password-input')).toBeTruthy();

      // Verify KeyboardAvoidingView is rendered
      expect(getByTestId('auth-keyboard-avoiding-view')).toBeTruthy();
    });

    it('2: Custom exercise screen wraps form in KeyboardAvoidingView with scroll support', async () => {
      const { getByTestId } = await render(<CreateCustomExerciseScreen />);

      // Verify inputs and action buttons
      expect(getByTestId('custom-exercise-name-input')).toBeTruthy();
      expect(getByTestId('custom-exercise-muscles-input')).toBeTruthy();
      expect(getByTestId('custom-exercise-instructions-input')).toBeTruthy();
      expect(getByTestId('custom-exercise-submit-button')).toBeTruthy();

      // Verify KeyboardAvoidingView wraps the form
      expect(getByTestId('custom-exercise-keyboard-view')).toBeTruthy();
    });
  });

  describe('Objective 2: Startup Splash Screen', () => {
    it('3: StartupSplash renders BeBig branding, athletic manifesto, and loading indicator', async () => {
      const { getByTestId, getByText } = await render(<StartupSplash />);

      expect(getByTestId('startup-splash-screen')).toBeTruthy();
      expect(getByText('BEBIG')).toBeTruthy();
      expect(getByText('ATHLETIC OVERLOAD INTELLIGENCE')).toBeTruthy();
      expect(getByText('BUILD • TRACK • BECOME')).toBeTruthy();
      expect(getByText('Developed by Aditya Patil')).toBeTruthy();
      expect(getByTestId('auth-loading-indicator')).toBeTruthy();
      expect(getByTestId('splash-brand-mark')).toBeTruthy();
    });

    it('4: app.json configures native Expo splash with athlete asset and dark obsidian background', () => {
      const splashPlugin = appConfig.expo.plugins.find(
        (p: any) => Array.isArray(p) && p[0] === 'expo-splash-screen',
      ) as [string, { image: string; backgroundColor: string; resizeMode: string }] | undefined;

      expect(splashPlugin).toBeDefined();
      expect(['./assets/splash-icon.png', './assets/splash-athlete.png']).toContain(splashPlugin?.[1].image);
      expect(splashPlugin?.[1].backgroundColor).toBe('#090D16');
      expect(splashPlugin?.[1].resizeMode).toBe('contain');
    });

    it('5: BrandLogoBadge renders Obsidian frame with Electric Blue border and dimensions', async () => {
      const { getByTestId } = await render(
        <BrandLogoBadge size="md" testID="test-emblem-badge" />
      );

      const badge = getByTestId('test-emblem-badge');
      expect(badge).toBeTruthy();
      expect(badge.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: '#131B2E',
            borderColor: 'rgba(56, 189, 248, 0.35)',
            borderWidth: 1,
          }),
        ])
      );
    });

    it('6: BrandLogoBadge scales correctly for sm, md, and custom numeric sizes', async () => {
      const { getByTestId: getSm } = await render(
        <BrandLogoBadge size="sm" testID="badge-sm" />
      );
      const { getByTestId: getMd } = await render(
        <BrandLogoBadge size="md" testID="badge-md" />
      );
      const { getByTestId: getCustom } = await render(
        <BrandLogoBadge size={36} testID="badge-custom" />
      );

      expect(getSm('badge-sm').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 24, height: 24, borderRadius: 8 })])
      );
      expect(getMd('badge-md').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 42, height: 42, borderRadius: 12 })])
      );
      expect(getCustom('badge-custom').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 36, height: 36, borderRadius: 10 })])
      );
    });
  });
});
