import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Heading, Subtitle, PrimaryButton, SecondaryButton, AppLogo } from '@/presentation/components';

export default function GetStartedScreen() {
  const router = useRouter();

  const handleLogin = () => {
    // Navigate to tabs layout to simulate login success
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-between px-6 py-8">
        {/* Top Header Logo */}
        <View className="items-center mt-8">
          <AppLogo size="medium" />
          <Heading className="mt-8 mb-2">Begin Your Journey</Heading>
          <Subtitle>Access India's premium home wellness platform.</Subtitle>
        </View>

        {/* Auth Buttons Group */}
        <View className="space-y-4 mb-4">
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
          <Text className="text-xs text-zinc-400 text-center leading-relaxed">
            By continuing, you agree to VIRLA's{'\n'}
            <TouchableOpacity activeOpacity={0.6}>
              <Text className="text-xs text-primary font-semibold underline decoration-zinc-400">
                Terms of Service
              </Text>
            </TouchableOpacity>
            {'  '}&{'  '}
            <TouchableOpacity activeOpacity={0.6}>
              <Text className="text-xs text-primary font-semibold underline decoration-zinc-400">
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
