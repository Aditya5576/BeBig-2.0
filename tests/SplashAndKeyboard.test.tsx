import React from 'react';
import { render } from '@testing-library/react-native';
import { StartupSplash } from '../src/components/ui/StartupSplash';
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
    it('3: StartupSplash renders BeBig branding, tagline, and loading indicator', async () => {
      const { getByTestId, getByText } = await render(<StartupSplash />);

      expect(getByTestId('startup-splash-screen')).toBeTruthy();
      expect(getByText('BEBIG')).toBeTruthy();
      expect(getByText('Your workout. Your progress. Your BeBig.')).toBeTruthy();
      expect(getByText('Developed by Aditya Patil')).toBeTruthy();
      expect(getByTestId('auth-loading-indicator')).toBeTruthy();
      expect(getByTestId('splash-athlete-image')).toBeTruthy();
    });

    it('4: app.json configures native Expo splash with athlete asset and dark obsidian background', () => {
      const splashPlugin = appConfig.expo.plugins.find(
        (p: any) => Array.isArray(p) && p[0] === 'expo-splash-screen',
      ) as [string, { image: string; backgroundColor: string; resizeMode: string }] | undefined;

      expect(splashPlugin).toBeDefined();
      expect(splashPlugin?.[1].image).toBe('./assets/splash-athlete.png');
      expect(splashPlugin?.[1].backgroundColor).toBe('#090D16');
      expect(splashPlugin?.[1].resizeMode).toBe('contain');
    });
  });
});
