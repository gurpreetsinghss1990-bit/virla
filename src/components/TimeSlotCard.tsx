import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface TimeSlotCardProps {
  slot: string; // E.g., "08:00 AM - 09:00 AM"
  isSelected: boolean;
  isAvailable: boolean;
  onPress: () => void;
}

export function TimeSlotCard({ slot, isSelected, isAvailable, onPress }: TimeSlotCardProps) {
  if (!isAvailable) {
    return (
      <View 
        className="w-[47%] bg-zinc-50 border border-zinc-100 p-4 rounded-2xl items-center justify-center opacity-30"
      >
        <Text className="text-zinc-400 text-xs font-bold">{slot}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`w-[47%] p-4 rounded-2xl border-2 items-center justify-center ${
        isSelected 
          ? 'bg-zinc-900 border-zinc-900' 
          : 'bg-white border-zinc-100'
      }`}
    >
      <Text 
        className={`text-xs font-extrabold tracking-tight ${
          isSelected ? 'text-white' : 'text-primary'
        }`}
      >
        {slot}
      </Text>
    </TouchableOpacity>
  );
}
