import React, { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { BottomNavigation } from '@/components/BottomNavigation';
import { useTabHistoryStore } from '@/store/tabHistoryStore';

export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { pushTab, popTab } = useTabHistoryStore();

  // Track active tab changes
  useEffect(() => {
    const segs = segments as unknown as string[];
    const atTabRoot = segs[0] === '(tabs)' && segs.length === 2;
    if (atTabRoot) {
      pushTab(segs[1]);
    }
  }, [segments, pushTab]);

  // Android hardware back: navigate to previous tab in history before exiting app
  useEffect(() => {
    const onBackPress = () => {
      const segs = segments as unknown as string[];
      const atTabRoot = segs[0] === '(tabs)' && segs.length === 2;
      if (!atTabRoot) return false;

      const previousTab = popTab();
      if (previousTab) {
        if (previousTab === 'index') {
          router.navigate('/(tabs)' as any);
        } else {
          router.navigate(`/(tabs)/${previousTab}` as any);
        }
        return true;
      }

      // If at root and no more history, allow default behavior (exit app)
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [segments, router, popTab]);

  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#FCF5F5' },
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
        },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
