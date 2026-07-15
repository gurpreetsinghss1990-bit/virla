import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Coach } from '../types';

interface CoachCardProps {
  coach: Coach;
  onPress?: () => void;
}

export function CoachCard({ coach, onPress }: CoachCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className="bg-white border border-zinc-100 p-4 rounded-[20px] shadow-sm flex-row items-center w-72 mr-4"
    >
      {/* Coach Image */}
      <Image
        source={{ uri: coach.photo }}
        className="w-16 h-16 rounded-2xl border border-zinc-50 mr-4"
      />

      {/* Profile Details */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-primary text-base font-extrabold tracking-tight" numberOfLines={1}>
            {coach.name}
          </Text>
        </View>
        <Text className="text-zinc-500 text-xs font-semibold mb-2" numberOfLines={1}>
          {coach.specialty}
        </Text>
        
        {/* Statistics row */}
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Text className="text-[10px]">⭐</Text>
            <Text className="text-primary text-[10px] font-black">{coach.rating}</Text>
          </View>
          <View className="w-1 h-1 rounded-full bg-zinc-300" />
          <Text className="text-zinc-400 text-[10px] font-bold">
            {coach.experience}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
