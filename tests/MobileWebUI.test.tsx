import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Platform, StyleSheet } from 'react-native';
import { WebAlertModal, Input, ScreenContainer, Button } from '../src/components/ui';
import {
  showWebAlert,
  installWebAlertPolyfill,
  useWebAlertStore,
} from '../src/lib/ui/webAlert';

describe('Checkpoint 4: Mobile Web UI Adaptation', () => {
  beforeEach(() => {
    useWebAlertStore.getState().hideAlert();
    jest.clearAllMocks();
  });

  describe('Web Alert Adapter & Modal', () => {
    it('renders null when there is no active alert', async () => {
      const { queryByTestId } = await render(<WebAlertModal />);
      expect(queryByTestId('web-alert-backdrop')).toBeNull();
    });

    it('renders single-button alert (OK default) and dismisses on press', async () => {
      const { getByTestId, getByText, queryByTestId } = await render(<WebAlertModal />);

      showWebAlert('Notice', 'Workout saved successfully.');

      await waitFor(() => {
        expect(getByTestId('web-alert-container')).toBeTruthy();
      });
      expect(getByText('Notice')).toBeTruthy();
      expect(getByText('Workout saved successfully.')).toBeTruthy();

      const okButton = getByTestId('web-alert-button-0');
      expect(okButton).toBeTruthy();
      expect(getByText('OK')).toBeTruthy();

      fireEvent.press(okButton);

      await waitFor(() => {
        expect(queryByTestId('web-alert-container')).toBeNull();
      });
    });

    it('renders two-button alert with cancel and destructive actions', async () => {
      const onDiscard = jest.fn();
      const onCancel = jest.fn();

      const { getByTestId, getByText, queryByTestId } = await render(<WebAlertModal />);

      showWebAlert(
        'Discard Workout?',
        'Are you sure? Progress will be lost.',
        [
          { text: 'Cancel', style: 'cancel', onPress: onCancel },
          { text: 'Discard', style: 'destructive', onPress: onDiscard },
        ]
      );

      await waitFor(() => {
        expect(getByText('Discard Workout?')).toBeTruthy();
      });
      expect(getByText('Are you sure? Progress will be lost.')).toBeTruthy();

      const cancelButton = getByTestId('web-alert-button-0');
      const discardButton = getByTestId('web-alert-button-1');

      expect(getByText('Cancel')).toBeTruthy();
      expect(getByText('Discard')).toBeTruthy();

      fireEvent.press(discardButton);

      expect(onDiscard).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(queryByTestId('web-alert-container')).toBeNull();
      });
    });

    it('renders 3+ buttons in stacked layout with correct handlers', async () => {
      const onResume = jest.fn();
      const onDiscard = jest.fn();
      const onCancel = jest.fn();

      const { getByTestId, queryByTestId } = await render(<WebAlertModal />);

      showWebAlert(
        'Active Session',
        'Choose what to do with the current workout:',
        [
          { text: 'Cancel', style: 'cancel', onPress: onCancel },
          { text: 'Discard', style: 'destructive', onPress: onDiscard },
          { text: 'Resume', style: 'default', onPress: onResume },
        ]
      );

      await waitFor(() => {
        expect(getByTestId('web-alert-button-0')).toBeTruthy();
      });
      expect(getByTestId('web-alert-button-1')).toBeTruthy();
      expect(getByTestId('web-alert-button-2')).toBeTruthy();

      fireEvent.press(getByTestId('web-alert-button-2'));

      expect(onResume).toHaveBeenCalledTimes(1);
      expect(onDiscard).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(queryByTestId('web-alert-container')).toBeNull();
      });
    });

    it('dismisses on backdrop press if cancelable is not false', async () => {
      const onDismiss = jest.fn();
      const { getByTestId, queryByTestId } = await render(<WebAlertModal />);

      showWebAlert('Info', 'Tap outside to close.', undefined, {
        cancelable: true,
        onDismiss,
      });

      await waitFor(() => {
        expect(getByTestId('web-alert-backdrop')).toBeTruthy();
      });

      const backdrop = getByTestId('web-alert-backdrop');
      fireEvent.press(backdrop);

      expect(onDismiss).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(queryByTestId('web-alert-container')).toBeNull();
      });
    });

    it('does not dismiss on backdrop press if cancelable is false', async () => {
      const { getByTestId } = await render(<WebAlertModal />);

      showWebAlert('Mandatory', 'Must pick an action.', [{ text: 'OK' }], {
        cancelable: false,
      });

      await waitFor(() => {
        expect(getByTestId('web-alert-backdrop')).toBeTruthy();
      });

      const backdrop = getByTestId('web-alert-backdrop');
      fireEvent.press(backdrop);

      expect(useWebAlertStore.getState().currentAlert).not.toBeNull();
    });

    it('integrates with Alert.alert polyfill on web', async () => {
      const originalPlatformOS = Platform.OS;
      try {
        Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
        installWebAlertPolyfill();

        const { getByTestId, getByText, queryByTestId } = await render(<WebAlertModal />);

        const alertAction = jest.fn();
        Alert.alert('Polyfill Test', 'Invoked via Alert.alert', [
          { text: 'Confirm', onPress: alertAction },
        ]);

        await waitFor(() => {
          expect(getByText('Polyfill Test')).toBeTruthy();
        });
        expect(getByText('Invoked via Alert.alert')).toBeTruthy();

        fireEvent.press(getByTestId('web-alert-button-0'));

        expect(alertAction).toHaveBeenCalledTimes(1);
        await waitFor(() => {
          expect(queryByTestId('web-alert-container')).toBeNull();
        });
      } finally {
        Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, configurable: true });
      }
    });
  });

  describe('Mobile Safe Area & Touch Accessibility', () => {
    it('renders ScreenContainer with safe area edges', async () => {
      const { getByText } = await render(
        <ScreenContainer>
          <Button title="Workout CTA" onPress={() => {}} />
        </ScreenContainer>
      );

      expect(getByText('Workout CTA')).toBeTruthy();
    });

    it('Button meets minimum 44pt touch target', async () => {
      const { getByTestId } = await render(
        <Button testID="test-button" title="Touch Target" onPress={() => {}} size="md" />
      );

      const btn = getByTestId('test-button');
      const flatStyle = StyleSheet.flatten(btn.props.style);
      expect(flatStyle.minHeight).toBeGreaterThanOrEqual(44);
    });

    it('Input component enforces 16px font size to prevent iOS Safari auto-zoom', async () => {
      const { getByTestId } = await render(
        <Input testID="zoom-safe-input" placeholder="Type here..." />
      );

      const input = getByTestId('zoom-safe-input');
      const flatStyle = StyleSheet.flatten(input.props.style);
      expect(flatStyle.fontSize).toBe(16);
    });
  });
});
