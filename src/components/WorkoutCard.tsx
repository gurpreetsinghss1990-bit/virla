import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Workout } from '../types';

interface WorkoutCardProps {
  workout: Workout;
  onPress?: () => void;
}

export function WorkoutCard({ workout, onPress }: WorkoutCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="bg-white border border-zinc-100 p-5 rounded-[20px] shadow-sm flex-col justify-between w-64 mr-4"
    >
      <View>
        {/* Workout Icon Header */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="w-12 h-12 bg-zinc-50 border border-zinc-100 rounded-2xl items-center justify-center">
            <Text className="text-2xl">{workout.icon}</Text>
          </View>
        </View>
        
        {/* Workout Info */}
        <Text className="text-primary text-base font-extrabold tracking-tight mb-1.5">
          {workout.title}
        </Text>
        <Text className="text-zinc-500 text-xs leading-normal mb-4 font-medium" numberOfLines={2}>
          {workout.description}
        </Text>
      </View>

      {/* Tags Footer */}
      <View className="flex-row items-center gap-2">
        <View className="bg-zinc-50 border border-zinc-100/50 px-2.5 py-1 rounded-lg">
          <Text className="text-zinc-500 text-[10px] font-bold">
            ⚡ {workout.calories} kcal
          </Text>
        </View>
        <View className="bg-zinc-50 border border-zinc-100/50 px-2.5 py-1 rounded-lg">
          <Text className="text-zinc-500 text-[10px] font-bold">
            ⏱️ {workout.duration} mins
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
