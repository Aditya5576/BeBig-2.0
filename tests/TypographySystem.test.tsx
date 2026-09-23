import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSegments: () => ['home'],
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => cb(),
}));

import { typography } from '../src/constants/theme';
import { Text, Button } from '../src/components/ui';

describe('BeBig 2.0 — Issue #10: Typography & Font System', () => {
  it('defines a coherent, complete typography token hierarchy', () => {
    // 1. Display & Headings
    expect(typography.display.fontSize).toBe(34);
    expect(typography.headingLarge.fontSize).toBe(26);
    expect(typography.headingMedium.fontSize).toBe(20);
    expect(typography.headingSmall.fontSize).toBe(17);

    // 2. Backward compatibility aliases
    expect(typography.titleLarge.fontSize).toBe(26);
    expect(typography.titleMedium.fontSize).toBe(20);

    // 3. Body text
    expect(typography.body.fontSize).toBe(15);
    expect(typography.bodyBold.fontSize).toBe(15);
    expect(typography.bodySmall.fontSize).toBe(13);

    // 4. Labels & Captions
    expect(typography.label.fontSize).toBe(12);
    expect(typography.label.letterSpacing).toBe(0.8);
    expect(typography.caption.fontSize).toBe(12);

    // 5. Buttons
    expect(typography.button.fontSize).toBe(15);
    expect(typography.buttonSmall.fontSize).toBe(13);

    // 6. Numeric & Statistics with tabular numbers support
    expect(typography.numeric.fontSize).toBe(22);
    expect(typography.numeric.fontVariant).toEqual(['tabular-nums']);
    expect(typography.numericHero.fontSize).toBe(36);
    expect(typography.numericHero.fontVariant).toEqual(['tabular-nums']);
  });

  it('renders Text component primitive with tabularNums support', async () => {
    const { getByText } = await render(
      <Text variant="numeric" tabularNums testID="stat-text">
        12,450 kg
      </Text>,
    );

    const element = getByText('12,450 kg');
    expect(element).toBeTruthy();
    expect(element.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontVariant: ['tabular-nums'] }),
      ]),
    );
  });

  it('renders Button component with dedicated button typography variants', async () => {
    const { getByText: getSmText } = await render(
      <Button title="Small Action" size="sm" onPress={() => {}} />,
    );
    expect(getSmText('Small Action')).toBeTruthy();

    const { getByText: getMdText } = await render(
      <Button title="Primary Action" size="md" onPress={() => {}} />,
    );
    expect(getMdText('Primary Action')).toBeTruthy();
  });
});
