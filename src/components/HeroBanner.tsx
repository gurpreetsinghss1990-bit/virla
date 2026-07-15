import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export function HeroBanner() {
  const router = useRouter();

  const handleBook = () => {
    // Navigate to bookings tab
    router.push('/(tabs)/bookings');
  };

  return (
    <View className="w-full bg-zinc-50 border border-zinc-100 p-6 rounded-[24px] shadow-sm relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <View className="absolute w-32 h-32 rounded-full bg-zinc-200/20 -top-10 -left-10" />
      
      <View className="space-y-4">
        <View>
          <Text className="text-primary text-2xl font-black tracking-tight leading-none mb-2">
            Wellness At{'\n'}Your Doorstep
          </Text>
          <Text className="text-zinc-500 text-sm leading-relaxed max-w-[80%] font-medium">
            Book certified wellness coaches for home workouts in minutes.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleBook}
          className="bg-primary py-3.5 px-6 rounded-2xl items-center justify-center self-start mt-2 shadow-sm"
        >
          <Text className="text-white text-sm font-bold tracking-wide">
            Book Session
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
