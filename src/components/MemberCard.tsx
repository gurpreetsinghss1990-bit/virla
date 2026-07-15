import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface MemberCardProps {
  name: string;
  relation: string;
  isSelected: boolean;
  onPress: () => void;
}

export function MemberCard({ name, relation, isSelected, onPress }: MemberCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`w-full flex-row items-center justify-between p-4 rounded-2xl border-2 mb-3 ${
        isSelected 
          ? 'bg-zinc-50/50 border-primary' 
          : 'bg-white border-zinc-100'
      }`}
    >
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-full bg-zinc-100 items-center justify-center">
          <Text className="text-base">👤</Text>
        </View>
        <View>
          <Text className="text-primary text-sm font-extrabold tracking-tight">
            {name}
          </Text>
          <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
            {relation}
          </Text>
        </View>
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
