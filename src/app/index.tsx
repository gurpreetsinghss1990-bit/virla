import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { router } from 'expo-router';
import { useUserStore } from '../store/userStore';
import { bootstrapApp } from '../utils/bootstrap';

export default function SplashScreen() {
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;       // For the entire screen container
  const scaleAnim = useRef(new Animated.Value(0.9)).current;    // For logo scale
  const dotScale = useRef(new Animated.Value(1)).current;       // For blue/purple dot pulsing

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

    // 2. Pulse the blue/purple dot continuously
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, {
          toValue: 1.6,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(dotScale, {
          toValue: 1,
          duration: 700,
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
        const { isLoggedIn, hasCompletedOnboarding } = useUserStore.getState();
        
        try {
          if (isLoggedIn) {
            router.replace('/(tabs)');
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
    <View className="flex-1 bg-white items-center justify-center">
      <Animated.View 
        style={{ 
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }} 
        className="items-center justify-center"
      >
        <View className="flex-row items-center justify-center">
          <Text className="font-bold text-[#101828] text-5xl tracking-[0.3em]">
            VIRLA
          </Text>
          {/* Small animated blue/purple dot next to the logo text */}
          <Animated.View 
            style={{ 
              transform: [{ scale: dotScale }] 
            }} 
            className="w-3.5 h-3.5 rounded-full bg-[#E11D48] ml-2" 
          />
        </View>
        
        <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-[0.25em] text-center mt-6">
          Wellness At Your Doorstep
        </Text>
      </Animated.View>
    </View>
  );
}
