import React, { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { BottomNavigation } from '@/components/BottomNavigation';

export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments();

  // ponytail: Android system back on a non-home tab goes home instead of killing the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const atTabRoot = segments[0] === '(tabs)' && segments.length === 2;
      const current = segments[segments.length - 1] as string;
      if (atTabRoot && current !== 'index') {
        router.navigate('/(tabs)' as any);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [segments, router]);

  return (
    <Tabs
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#FCF5F5' },
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
