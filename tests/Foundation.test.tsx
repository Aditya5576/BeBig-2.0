import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FoundationScreen from '../app/index';
import { env } from '../src/config/env';
import { colors, spacing } from '../src/constants/theme';

describe('Milestone 1 — Foundation Setup Verification', () => {
  it('loads configuration and design tokens accurately', () => {
    expect(env.appName).toBe('BeBig');
    expect(env.appEnv).toBeDefined();
    expect(colors.dark.primary).toBe('#38BDF8');
    expect(spacing.md).toBe(16);
  });

  it('renders the minimal foundation screen with BeBig branding', async () => {
    const { getByText, getByTestId } = await render(<FoundationScreen />);

    // Brand and Milestone validation
    expect(getByText('BeBig')).toBeTruthy();
    expect(getByText('MILESTONE 1')).toBeTruthy();
    expect(getByText('Mobile Architecture Foundation')).toBeTruthy();

    // Verify button existence
    const button = getByTestId('foundation-test-button');
    expect(button).toBeTruthy();
    expect(getByText('Verify Foundation')).toBeTruthy();
  });

  it('responds to user interaction and updates verification counter', async () => {
    const { getByTestId, findByText } = await render(<FoundationScreen />);

    const button = getByTestId('foundation-test-button');
    fireEvent.press(button);

    // Verify counter incremented
    expect(await findByText('Verified (1)')).toBeTruthy();

    fireEvent.press(button);
    expect(await findByText('Verified (2)')).toBeTruthy();
  });
});
