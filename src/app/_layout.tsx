import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PushNotificationService } from '../services/PushNotificationService';
import { useUserStore } from '../store/userStore';
import { TopToastNotification } from '../components/TopToastNotification';
import { useToastStore } from '../store/toastStore';
import '../global.css';

// Suppress known upstream React Native Fabric / Expo Router useLinking race condition warning
LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet",
]);

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen immediately since we handle the premium splash layout in index.tsx
    SplashScreen.hideAsync();

    let isMounted = true;
    let responseSubscription: any = null;
    let notificationReceivedSubscription: any = null;
    let urlSubscription: any = null;

    // 0. Deferred Deep-Link Handling: Capture 'ref' parameter from invite URLs
    const handleIncomingDeepLink = async (urlStr: string | null) => {
      if (!urlStr) return;
      try {
        const parsed = Linking.parse(urlStr);
        const refParam = parsed.queryParams?.ref;
        if (refParam && typeof refParam === 'string') {
          await AsyncStorage.setItem('pending_referral_id', refParam);
          console.log('[REFERRAL] Captured pending referral ID from incoming link:', refParam);
        }
      } catch (e) {
        console.warn('[REFERRAL] Failed to parse incoming deep link URL:', e);
      }
    };

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isMounted) {
        handleIncomingDeepLink(initialUrl);
      }
    });

    urlSubscription = Linking.addEventListener('url', (event) => {
      if (event.url && isMounted) {
        handleIncomingDeepLink(event.url);
      }
    });

    if (PushNotificationService.isNotificationsSupported()) {
      try {
        const Notifications = require('expo-notifications');

        // Configure presentation handler: disable native system banner in foreground to show custom Top Toast!
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: false,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: false,
            shouldShowList: true,
          }),
        });

        // Listen for notifications received while app is in foreground and show custom Top Toast
        notificationReceivedSubscription = Notifications.addNotificationReceivedListener((notification: any) => {
          const content = notification?.request?.content;
          if (content) {
            useToastStore.getState().showToast({
              title: content.title || 'VIRLA Notification',
              message: content.body || '',
              deepLink: content.data?.deepLink,
              type: content.data?.type || 'info',
            });
          }
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
      if (notificationReceivedSubscription) {
        notificationReceivedSubscription.remove();
      }
      if (urlSubscription) {
        urlSubscription.remove();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
      <TopToastNotification />
    </SafeAreaProvider>
  );
}
