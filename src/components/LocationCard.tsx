import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface LocationCardProps {
  icon: string;
  title: string;
  isSelected: boolean;
  onPress: () => void;
}

export function LocationCard({ icon, title, isSelected, onPress }: LocationCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`w-full flex-row items-center justify-between p-5 rounded-2xl border-2 mb-3.5 transition-all ${
        isSelected 
          ? 'bg-zinc-50/50 border-primary' 
          : 'bg-white border-zinc-100'
      }`}
    >
      <View className="flex-row items-center gap-4">
        <View className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-100 items-center justify-center">
          <Text className="text-xl">{icon}</Text>
        </View>
        <Text className="text-primary text-base font-extrabold tracking-tight">
          {title}
        </Text>
      </View>
      <View 
        className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
          isSelected ? 'border-primary bg-primary' : 'border-zinc-200'
        }`}
      >
        {isSelected && (
          <View className="w-2 h-2 rounded-full bg-white" />
        )}
      </View>
    </TouchableOpacity>
  );
}
