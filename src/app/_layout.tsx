import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import '../global.css';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen immediately since we handle the premium splash layout in index.tsx
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="get-started" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="booking" />
        <Stack.Screen name="session-detail" />
        <Stack.Screen name="workout-detail" />
        <Stack.Screen name="coach-profile" />
        <Stack.Screen name="address-management" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="trainer-availability" />
        <Stack.Screen name="membership" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="payment-history" />
        <Stack.Screen name="invoice" />
        <Stack.Screen name="communication" />
        <Stack.Screen name="health-profile" />
        <Stack.Screen name="fitness-goals" />
        <Stack.Screen name="emergency-contacts" />
        <Stack.Screen name="privacy-security" />
        <Stack.Screen name="help-support" />
        <Stack.Screen name="legal-center" />
        <Stack.Screen name="personal-statistics" />
        <Stack.Screen name="personal-achievements" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}
