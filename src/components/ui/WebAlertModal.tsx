/**
 * BeBig 2.0 — Web Alert Modal
 *
 * High-contrast athletic confirmation and alert dialog for Web runtime,
 * replacing the silent no-op Alert.alert in react-native-web.
 */

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { Text } from './Text';
import { colors, radii, spacing } from '../../constants/theme';
import { AlertButton, useWebAlertStore } from '../../lib/ui/webAlert';

export function WebAlertModal() {
  const currentAlert = useWebAlertStore((state) => state.currentAlert);
  const hideAlert = useWebAlertStore((state) => state.hideAlert);

  // On native platforms, Alert.alert is natively handled; modal remains dormant
  if (!currentAlert) {
    return null;
  }

  const {
    title,
    message,
    buttons = [{ text: 'OK', style: 'default' }],
    options,
  } = currentAlert;

  const handleButtonPress = (btn: AlertButton) => {
    hideAlert();
    btn.onPress?.();
  };

  const handleBackdropPress = () => {
    if (options?.cancelable !== false) {
      hideAlert();
      options?.onDismiss?.();
    }
  };

  const isStacked = buttons.length > 2;

  return (
    <Modal
      transparent
      visible={true}
      animationType="fade"
      onRequestClose={handleBackdropPress}
      testID="web-alert-modal"
    >
      <Pressable
        testID="web-alert-backdrop"
        style={styles.backdrop}
        onPress={handleBackdropPress}
      >
        <Pressable
          testID="web-alert-container"
          style={styles.dialogCard}
          onPress={(e) => {
            // Prevent clicks inside the dialog card from dismissing it
            e.stopPropagation?.();
          }}
        >
          {/* Alert Title */}
          <Text variant="titleMedium" color="primary" style={styles.title}>
            {title}
          </Text>

          {/* Alert Message */}
          {Boolean(message) && (
            <Text variant="body" color="secondary" style={styles.message}>
              {message}
            </Text>
          )}

          {/* Alert Buttons */}
          <View style={[styles.buttonGroup, isStacked && styles.buttonGroupStacked]}>
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';

              return (
                <Pressable
                  key={`alert-btn-${index}`}
                  testID={`web-alert-button-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={btn.text || 'Action'}
                  onPress={() => handleButtonPress(btn)}
                  style={({ pressed }) => [
                    styles.buttonBase,
                    isCancel && styles.cancelButton,
                    isDestructive && styles.destructiveButton,
                    !isCancel && !isDestructive && styles.primaryButton,
                    !isStacked && styles.buttonFlex,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    variant="bodyBold"
                    style={[
                      styles.buttonText,
                      isCancel && styles.cancelButtonText,
                      isDestructive && styles.destructiveButtonText,
                      !isCancel && !isDestructive && styles.primaryButtonText,
                    ]}
                  >
                    {btn.text || 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    zIndex: 99999,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.dark.surface,
    borderColor: colors.dark.borderLight,
    borderWidth: 1.5,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    // Elevation shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  message: {
    lineHeight: 22,
    color: colors.dark.textSecondary,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  buttonGroupStacked: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  buttonFlex: {
    flex: 1,
  },
  buttonBase: {
    minHeight: 44, // Meets Apple 44pt minimum touch target
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: colors.dark.primary,
  },
  primaryButtonText: {
    color: colors.dark.primaryText,
  },
  cancelButton: {
    backgroundColor: colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
  },
  cancelButtonText: {
    color: colors.dark.textSecondary,
  },
  destructiveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.dark.error,
  },
  destructiveButtonText: {
    color: colors.dark.error,
  },
});
