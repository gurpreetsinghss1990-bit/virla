import { Alert as RNAlert } from 'react-native';
import { useCustomAlertStore, AlertButton } from '../store/customAlertStore';

let isInstalled = false;

/**
 * Installs the custom top popup notification interceptor for Alert.alert.
 * When any component in the app calls `Alert.alert(...)`, it is routed
 * to our sleek white top popup card instead of the native system grey window.
 */
export function installCustomAlert() {
  if (isInstalled) return;
  isInstalled = true;

  const originalAlert = RNAlert.alert.bind(RNAlert);

  (RNAlert as any).alert = function (
    title?: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ) {
    try {
      useCustomAlertStore.getState().showAlert({
        title,
        message,
        buttons,
        cancelable: options?.cancelable ?? false,
      });
    } catch {
      // Fallback to original native alert if anything fails unexpectedly
      originalAlert(title || '', message, buttons, options);
    }
  };
}
