import { Platform } from 'react-native';

/**
 * Initializes Meta (Facebook) SDK and requests iOS App Tracking Transparency (ATT)
 * permission on iOS 14.5+. Safe to call in any environment (no-ops if native module
 * is unavailable, e.g., Expo Go).
 */
export async function initMetaTracking(): Promise<void> {
  try {
    let trackingGranted = true;

    if (Platform.OS === 'ios') {
      const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
      const { status } = await requestTrackingPermissionsAsync();
      trackingGranted = status === 'granted';
    }

    const { Settings } = await import('react-native-fbsdk-next');
    Settings.initializeSDK();
    if (Platform.OS === 'ios') {
      await Settings.setAdvertiserTrackingEnabled(trackingGranted);
    }
  } catch (err) {
    if (__DEV__) {
      console.log('[MetaTracking] Skipped native init (likely Expo Go):', err);
    }
  }
}

export async function logMetaRegistration(method = 'phone'): Promise<void> {
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next');
    AppEventsLogger.logEvent('fb_mobile_complete_registration', {
      fb_registration_method: method,
    });
  } catch {}
}

export async function logMetaPurchase(amountInr: number, currency = 'INR'): Promise<void> {
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next');
    AppEventsLogger.logPurchase(amountInr, currency);
  } catch {}
}

