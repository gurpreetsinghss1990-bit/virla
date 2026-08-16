import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { PushNotificationService } from '../services/PushNotificationService';
import { useUserStore } from '../store/userStore';
import '../global.css';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen immediately since we handle the premium splash layout in index.tsx
    SplashScreen.hideAsync();

    let isMounted = true;
    let responseSubscription: any = null;

    if (PushNotificationService.isNotificationsSupported()) {
      try {
        const Notifications = require('expo-notifications');

        // Configure default presentation handler for foreground notifications
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        // 1. Configure Android notification channels
        PushNotificationService.configureNotificationChannelsAsync().then();

        // 2. Request permission and register token if user is already logged in on startup
        const userId = useUserStore.getState().user.id;
        if (userId) {
          PushNotificationService.syncTokenWithBackend(userId).then();
        }

        // 3. Listen to notifications clicked/tapped (deep linking) while app is backgrounded or in foreground
        responseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const deepLink = response.notification.request.content.data?.deepLink;
          if (deepLink) {
            try {
              router.push(deepLink as any);
            } catch (e) {
              console.error('[NAVIGATION] Deep link route push failed:', e);
            }
          }
        });

        // 4. Check if the app was opened from a terminated state via a notification click
        Notifications.getLastNotificationResponseAsync().then((response: any) => {
          if (!isMounted) return;
          const deepLink = response?.notification?.request?.content?.data?.deepLink;
          if (deepLink) {
            // Wait a moment for navigation layout to mount before pushing the deep link
            setTimeout(() => {
              if (isMounted) {
                try {
                  router.push(deepLink as any);
                } catch (e) {
                  console.error('[NAVIGATION] Terminated state deep link push failed:', e);
                }
              }
            }, 1200);
          }
        });

      } catch (err: any) {
        console.warn('[LAYOUT] Push notifications native modules not available (likely simulator/uncompiled build):', err.message);
      }
    } else {
      console.warn('[LAYOUT] Push notifications native modules not available (likely simulator/uncompiled build). Skipping initialization.');
    }

    return () => {
      isMounted = false;
      if (responseSubscription) {
        responseSubscription.remove();
      }
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
