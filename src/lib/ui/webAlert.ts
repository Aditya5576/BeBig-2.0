import { Alert, Platform } from 'react-native';
import { create } from 'zustand';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

export interface WebAlertPayload {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

interface WebAlertStore {
  currentAlert: WebAlertPayload | null;
  showAlert: (payload: WebAlertPayload) => void;
  hideAlert: () => void;
}

export const useWebAlertStore = create<WebAlertStore>((set) => ({
  currentAlert: null,
  showAlert: (payload) => set({ currentAlert: payload }),
  hideAlert: () => set({ currentAlert: null }),
}));

/**
 * Directly displays the BeBig athletic WebAlertModal.
 */
export function showWebAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) {
  useWebAlertStore.getState().showAlert({
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
    options,
  });
}

/**
 * Trigger an alert.
 * On web: updates WebAlertStore to display the BeBig WebAlertModal.
 * On native: delegates to React Native's native Alert.alert dialog.
 */
export function triggerAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) {
  if (Platform.OS === 'web') {
    showWebAlert(title, message, buttons, options);
  } else {
    Alert.alert(title, message, buttons, options);
  }
}

/**
 * Installs the Alert.alert polyfill on web so all standard Alert.alert(...)
 * calls throughout the app invoke the athletic WebAlertModal instead of no-op'ing.
 */
export function installWebAlertPolyfill() {
  if (Platform.OS === 'web') {
    Alert.alert = (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      options?: AlertOptions
    ) => {
      showWebAlert(title, message, buttons, options);
    };
  }
}

// Auto-install on web runtime import
installWebAlertPolyfill();
