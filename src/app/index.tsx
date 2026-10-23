import React, { useEffect, useMemo } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useUserStore } from '../store/userStore';
import { bootstrapApp } from '../utils/bootstrap';

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  
  // Animation values using useMemo to avoid render-phase ref reads
  const fadeAnim = useMemo(() => new Animated.Value(0), []);       // For the entire screen container
  const scaleAnim = useMemo(() => new Animated.Value(0.9), []);    // For logo scale
  const dotScale = useMemo(() => new Animated.Value(1), []);       // For blue/purple dot pulsing

  useEffect(() => {
    // 1. Fade in the screen and scale up the logo smoothly
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Pulse the spark icon continuously
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, {
          toValue: 1.22,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(dotScale, {
          toValue: 0.92,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Run bootstrap and control navigation timing
    let hasNavigated = false;
    const startTime = Date.now();

    const runBootstrap = async () => {
      try {
        // Run service initialization (with its internal 3s timeout)
        await bootstrapApp();
      } catch (err) {
        console.warn('Bootstrap orchestrator errored:', err);
      } finally {
        // Enforce duration limits: 1.5s (1500ms) minimum, 2s (2000ms) maximum
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(1500 - elapsed, 0);
        
        setTimeout(() => {
          triggerExitTransition();
        }, Math.min(remaining, 1200)); // cap wait time to avoid exceeding 2s total
      }
    };

    const triggerExitTransition = () => {
      if (hasNavigated) return;
      hasNavigated = true;

      // Smooth exit fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // Route selection based on persisted authentication state
        const { isLoggedIn, hasCompletedOnboarding, user } = useUserStore.getState();
        
        try {
          if (isLoggedIn) {
            if (user && user.registrationStatus !== 'complete') {
              console.log('[Splash] Incomplete registration detected on startup. Redirecting to user-metrics.');
              router.replace('/user-metrics' as any);
            } else {
              router.replace('/(tabs)');
            }
          } else if (hasCompletedOnboarding) {
            router.replace('/get-started');
          } else {
            router.replace('/onboarding');
          }
        } catch (error) {
          console.error('Splash screen transition error:', error);
          router.replace('/onboarding'); // safe fallback
        }
      });
    };

    // Backup safety timeout to guarantee the screen NEVER freezes, even in worst-case hangs
    const safetyTimeout = setTimeout(() => {
      triggerExitTransition();
    }, 2200);

    runBootstrap();

    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }} className="items-center justify-center">
      <StatusBar style="dark" />
      <Animated.View 
        style={{ 
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }} 
        className="items-center justify-center"
      >
        <View className="flex-row items-center justify-center">
          <Text
            style={{ fontFamily: 'System', letterSpacing: 16 }}
            className="font-extrabold text-black text-5xl"
          >
            VIRLA
          </Text>
          {/* 4-pointed pulsing spark icon next to the VIRLA logo text */}
          <Animated.View
            style={{
              transform: [{ scale: dotScale }],
              marginLeft: 6,
            }}
          >
            <Svg width={44} height={44} viewBox="0 0 100 100">
              <Path
                d="M50 0 C53 34 66 47 100 50 C66 53 53 66 50 100 C47 66 34 53 0 50 C34 47 47 34 50 0 Z"
                fill="#F07178"
              />
            </Svg>
          </Animated.View>
        </View>

        <Text
          style={{ letterSpacing: 5.5 }}
          className="text-black text-[12px] font-semibold uppercase text-center mt-5"
        >
          WELLNESS AT YOUR DOORSTEP
        </Text>
      </Animated.View>
    </View>
  );
}
