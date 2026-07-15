import React, { useEffect } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { AppLogo } from '@/presentation/components/AppLogo';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/onboarding');
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center items-center px-6">
        <View className="items-center">
          <AppLogo size="large" />
          
          <Text className="text-zinc-400 text-sm tracking-[0.2em] uppercase mt-8 text-center font-semibold">
            Wellness at Your Doorstep
          </Text>
        </View>
      </View>
      
      <View className="pb-12 px-6">
        <Text className="text-zinc-500 text-xs tracking-widest text-center font-medium">
          Strength  •  Yoga  •  Boxing  •  Dance  •  Stretching
        </Text>
      </View>
    </SafeAreaView>
  );
}
