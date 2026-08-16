import { Platform, NativeModules } from 'react-native';
import { supabase } from '../database/supabaseClient';
import Constants from 'expo-constants';

// Centralized sound mapping & notification taxonomy
export const NOTIFICATION_SOUNDS = {
  BOOKING_CONFIRMED: 'virla_notification.wav',
  TRAINER_ASSIGNED: 'virla_notification.wav',
  BOOKING_CANCELLED: 'virla_notification.wav',
  SESSION_REMINDER_1H: 'virla_reminder.wav',
  SESSION_STARTING_SOON: 'virla_reminder.wav',
  SESSION_MISSED: 'default',
  SESSION_COMPLETED: 'default',
  GENERAL: 'default'
};

export const NOTIFICATION_CHANNELS = {
  VIRLA_BOOKINGS: 'virla_bookings',
  VIRLA_SESSION_REMINDERS: 'virla_session_reminders',
  VIRLA_GENERAL: 'virla_general'
};

export class PushNotificationService {
  static isNotificationsSupported(): boolean {
    if (Platform.OS === 'web') return false;
    try {
      const hasExpoModule = typeof globalThis !== 'undefined' && (globalThis as any).ExpoModules && (globalThis as any).ExpoModules.ExpoPushTokenManager;
      const hasNativeModule = NativeModules && NativeModules.ExpoPushTokenManager;
      return !!(hasExpoModule || hasNativeModule);
    } catch (e) {
      return false;
    }
  }

  /**
   * Request notification permissions and register for push notifications.
   * Returns the push token or null if failed.
   */
  static async registerForPushNotificationsAsync(): Promise<string | null> {
    if (!this.isNotificationsSupported()) {
      console.log('[PUSH SERVICE] Push notifications are not supported in this environment (likely simulator or uncompiled dev client)');
      return null;
    }
    try {
      const Device = require('expo-device');
      const Notifications = require('expo-notifications');

      if (!Device || !Device.isDevice) {
        console.log('[PUSH SERVICE] Must use physical device for Push Notifications');
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[PUSH SERVICE] Failed to get push token: permission denied.');
        return null;
      }

      // Fetch the Project ID dynamically from app.json EAS extra
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('[PUSH SERVICE] Project ID not configured in app.json');
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId
      });
      
      const token = tokenData.data;
      console.log('[PUSH SERVICE] Push token generated successfully:', token);
      return token;
    } catch (e: any) {
      console.warn('[PUSH SERVICE] Push notifications are not supported in this environment (likely simulator or uncompiled dev client):', e.message);
      return null;
    }
  }

  /**
   * Syncs user device push token to database.
   */
  static async syncTokenWithBackend(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const token = await this.registerForPushNotificationsAsync();
      if (!token) return;

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      // 1. Clear any duplicate user mapping for this token to handle logouts/re-logins
      await supabase
        .from('device_tokens')
        .delete()
        .eq('token', token)
        .neq('user_id', userId);

      // 2. Upsert the token for the current user session
      const { error } = await supabase
        .from('device_tokens')
        .upsert({
          user_id: userId,
          token: token,
          platform: platform,
          last_seen_at: new Date().toISOString()
        }, {
          onConflict: 'token'
        });

      if (error) {
        console.error('[PUSH SERVICE] Supabase upsert error:', error.message);
      } else {
        console.log('[PUSH SERVICE] Device token synced successfully.');
      }
    } catch (e) {
      console.error('[PUSH SERVICE] Exception in syncTokenWithBackend:', e);
    }
  }

  /**
   * Removes device push token from database on logout.
   */
  static async removeTokenFromBackend(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const token = await this.registerForPushNotificationsAsync();
      if (!token) return;

      const { error } = await supabase
        .from('device_tokens')
        .delete()
        .eq('token', token)
        .eq('user_id', userId);

      if (error) {
        console.error('[PUSH SERVICE] Supabase delete error:', error.message);
      } else {
        console.log('[PUSH SERVICE] Device token removed successfully on logout.');
      }
    } catch (e) {
      console.error('[PUSH SERVICE] Exception in removeTokenFromBackend:', e);
    }
  }

  /**
   * Configure Android notification channels with specific chimes.
   */
  static async configureNotificationChannelsAsync(): Promise<void> {
    if (!this.isNotificationsSupported()) {
      return;
    }
    try {
      const Notifications = require('expo-notifications');
      if (Platform.OS === 'android') {
        // Create bookings channel
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.VIRLA_BOOKINGS, {
          name: 'VIRLA Bookings',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'virla_notification.wav',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4F46E5',
        });

        // Create session reminders channel
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.VIRLA_SESSION_REMINDERS, {
          name: 'VIRLA Session Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'virla_reminder.wav',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E11D48',
        });

        // Create general channel
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.VIRLA_GENERAL, {
          name: 'VIRLA General Alerts',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }
    } catch (e: any) {
      console.warn('[PUSH SERVICE] Android channels setup skipped/failed (uncompiled native modules):', e.message);
    }
  }
}
