import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Heading, Subtitle, PrimaryButton, SecondaryButton, AppLogo } from '@/presentation/components';
import { useUserStore } from '../store/userStore';

export default function GetStartedScreen() {
  const router = useRouter();
  const { setLoggedIn, setCompletedOnboarding } = useUserStore();

  const handleLogin = () => {
    setLoggedIn(true);
    setCompletedOnboarding(true);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]">
      {/* Background Luxury Glowing Aura */}
      <View className="absolute top-0 left-0 right-0 h-[45%] overflow-hidden">
        <Svg width="100%" height="100%" viewBox="0 0 360 300" fill="none">
          <Defs>
            <LinearGradient id="auraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#4F46E5" stopOpacity="0.12" />
              <Stop offset="50%" stopColor="#6D5EF7" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#F5B942" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>
          <Circle cx={180} cy={60} r={220} fill="url(#auraGrad)" />
          <Path d="M0 180 Q180 120 360 180" stroke="white" strokeWidth={2} opacity={0.3} />
          <Path d="M0 210 Q180 160 360 210" stroke="white" strokeWidth={1} opacity="0.15" />
        </Svg>
      </View>

      <View className="flex-1 justify-between px-6 py-10 z-10">
        {/* Top Header Logo */}
        <View className="items-center mt-10">
          <AppLogo size="large" />
          <Heading className="mt-8 mb-2">Begin Your Journey</Heading>
          <Subtitle align="center" className="max-w-[85%] mt-1">
            Access India's premium home wellness platform. Professional coaching, personalized for you.
          </Subtitle>
        </View>

        {/* Auth Buttons Group */}
        <View className="gap-4 mb-4 px-2">
          {/* Primary Mobile Button */}
          <PrimaryButton
            title="Continue with Mobile Number"
            onPress={handleLogin}
            icon={<Text className="text-white text-base">📱</Text>}
          />

          {/* Secondary Google Button */}
          <SecondaryButton
            title="Continue with Google"
            onPress={handleLogin}
            icon={<Text className="text-zinc-800 text-base">🌐</Text>}
          />

          {/* Secondary Apple Button */}
          <SecondaryButton
            title="Continue with Apple"
            onPress={handleLogin}
            icon={<Text className="text-zinc-800 text-lg font-bold"></Text>}
          />
        </View>

        {/* Terms & Privacy Policies at the Bottom */}
        <View className="px-4">
          <Text className="text-[12px] text-zinc-400 text-center leading-relaxed">
            By continuing, you agree to VIRLA's{'\n'}
            <Text className="text-zinc-500 font-extrabold underline">Terms of Service</Text>
            {'  '}&{'  '}
            <Text className="text-zinc-500 font-extrabold underline">Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
