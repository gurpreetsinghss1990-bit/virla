import React from 'react';
import { View, Text } from 'react-native';

export function SuccessAnimation() {
  return (
    <View className="items-center justify-center my-6">
      {/* Concentric ripples */}
      <View className="w-24 h-24 bg-green-50 border border-green-100 rounded-full items-center justify-center animate-pulse">
        <View className="w-18 h-18 bg-green-100/50 border border-green-200/50 rounded-full items-center justify-center">
          <View className="w-14 h-14 bg-green-500 rounded-full items-center justify-center shadow-md">
            <Text className="text-white text-2xl font-black">✓</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
