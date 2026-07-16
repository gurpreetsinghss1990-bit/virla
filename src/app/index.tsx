import React, { useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, Animated, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppLogo } from '../presentation/components/AppLogo';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export default function SplashScreen() {
  const router = useRouter();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in project logo and texts
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Loop spin loading indicator
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();

    // Move to Onboarding Screen after 2.8s
    const timer = setTimeout(() => {
      router.replace('/onboarding' as any);
    }, 2800);

    return () => clearTimeout(timer);
  }, [router]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Soft top gradient */}
      <View className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-[#F5F3FF]/30 to-white" />

      <Animated.View style={{ opacity: fadeAnim }} className="flex-1 justify-between px-6 py-12">
        {/* Empty placeholder to push logo to center */}
        <View className="h-10" />

        {/* Center Content */}
        <View className="items-center justify-center gap-6">
          <AppLogo size="large" />
          
          <Text className="text-zinc-950 text-base font-black uppercase tracking-[0.25em] text-center mt-2">
            Wellness At Your Doorstep
          </Text>

          {/* Premium animated loading ring */}
          <Animated.View style={{ transform: [{ rotate: spin }] }} className="mt-8 w-8 h-8 items-center justify-center">
            <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
              <Circle cx={16} cy={16} r={14} stroke="#E5E7EB" strokeWidth={3} />
              <Path d="M16 2A14 14 0 0 1 30 16" stroke="#4F46E5" strokeWidth={3} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        </View>

        {/* Footer categories list */}
        <View className="items-center">
          <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] text-center leading-relaxed">
            Strength  •  Yoga  •  Boxing  •  Dance  •  Stretching
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
