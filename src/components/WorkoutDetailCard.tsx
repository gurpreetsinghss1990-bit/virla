import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Workout } from '../types';

interface WorkoutDetailCardProps {
  workout: Workout;
}

export function WorkoutDetailCard({ workout }: WorkoutDetailCardProps) {
  // Mock benefits & metadata mapping based on workout
  const getWorkoutMetadata = (title: string) => {
    switch (title) {
      case 'Strength Training':
        return {
          difficulty: 'Medium - Hard',
          benefits: ['Increase muscle mass & bone density', 'Boost resting metabolic rate', 'Improve joint support'],
          target: 'Perfect for building strength, toning, and athletic fitness.',
          equipment: ['Dumbbells or Resistance bands (Trainer will bring them)', 'Workout mat'],
        };
      case 'Yoga':
        return {
          difficulty: 'Beginner - Medium',
          benefits: ['Enhance balance & posture', 'Reduce stress & mental fatigue', 'Improve core flexibility'],
          target: 'Excellent for mindfulness, flexibility, and physical recovery.',
          equipment: ['Yoga mat (Trainer will bring one if needed)', 'Yoga blocks'],
        };
      case 'Stretching':
        return {
          difficulty: 'Beginner',
          benefits: ['Relieve muscle stiffness', 'Improve joint range of motion', 'Accelerate post-workout recovery'],
          target: 'Designed for daily body decompression and stress relief.',
          equipment: ['Comfortable clothes', 'Workout mat'],
        };
      case 'Boxing':
        return {
          difficulty: 'Hard',
          benefits: ['High calorie cardio burn', 'Enhance hand-eye coordination', 'Relieve stress & build stamina'],
          target: 'High-intensity conditioning for cardio and weight management.',
          equipment: ['Boxing pads & gloves (Trainer will provide)', 'Hand wraps'],
        };
      default:
        return {
          difficulty: 'Medium',
          benefits: ['Boost cardiovascular fitness', 'Improve mobility & strength', 'Enhance muscle tone'],
          target: 'Ideal for general wellness and active home routines.',
          equipment: ['Workout mat', 'Trainer-supplied gear'],
        };
    }
  };

  const metadata = getWorkoutMetadata(workout.title);

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-white">
      {/* Top Image Banner Visual */}
      <View className="w-full aspect-[16/10] bg-zinc-900 justify-center items-center rounded-b-[36px] relative overflow-hidden">
        {/* Abstract wellness gradient backdrop */}
        <View className="absolute w-72 h-72 rounded-full bg-green-500/10 -bottom-20 -right-10 blur-3xl" />
        <View className="w-20 h-20 rounded-full bg-white/10 items-center justify-center border border-white/20 mb-3 shadow-lg">
          <Text className="text-4xl">{workout.icon}</Text>
        </View>
        <Text className="text-white text-2xl font-black tracking-tight">{workout.title}</Text>
        <View className="bg-white/15 px-3 py-1 rounded-full border border-white/10 mt-3">
          <Text className="text-white text-[10px] font-black uppercase tracking-wider">
            {metadata.difficulty}
          </Text>
        </View>
      </View>

      <View className="p-6 gap-6">
        {/* Specs Highlights */}
        <View className="flex-row justify-around bg-zinc-50 border border-zinc-100 p-4 rounded-[24px]">
          <View className="items-center">
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Duration</Text>
            <Text className="text-primary text-sm font-black mt-1">⏱️ {workout.duration} mins</Text>
          </View>
          <View className="w-[1px] bg-zinc-200" />
          <View className="items-center">
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Avg Burn</Text>
            <Text className="text-primary text-sm font-black mt-1">🔥 {workout.calories} kcal</Text>
          </View>
          <View className="w-[1px] bg-zinc-200" />
          <View className="items-center">
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Credits</Text>
            <Text className="text-primary text-sm font-black mt-1">💳 1 Credit</Text>
          </View>
        </View>

        {/* Description Section */}
        <View className="gap-2">
          <Text className="text-primary text-base font-extrabold tracking-tight">Overview</Text>
          <Text className="text-zinc-500 text-sm leading-relaxed font-medium">{workout.description}</Text>
        </View>

        {/* Target Audience Section */}
        <View className="gap-2">
          <Text className="text-primary text-base font-extrabold tracking-tight">Who Is This For?</Text>
          <Text className="text-zinc-500 text-sm leading-relaxed font-medium">{metadata.target}</Text>
        </View>

        {/* Benefits Section */}
        <View className="gap-3">
          <Text className="text-primary text-base font-extrabold tracking-tight">Key Benefits</Text>
          <View className="gap-2.5">
            {metadata.benefits.map((benefit, i) => (
              <View key={i} className="flex-row items-start">
                <Text className="text-green-500 text-sm mr-2.5">✓</Text>
                <Text className="text-zinc-600 text-sm font-semibold flex-1 leading-relaxed">
                  {benefit}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Equipment Section */}
        <View className="gap-3 mb-10">
          <Text className="text-primary text-base font-extrabold tracking-tight">Equipment Required</Text>
          <View className="gap-2.5">
            {metadata.equipment.map((item, i) => (
              <View key={i} className="flex-row items-center bg-zinc-50 border border-zinc-100/50 p-3 rounded-2xl">
                <Text className="text-lg mr-3">📦</Text>
                <Text className="text-zinc-700 text-xs font-bold flex-1">
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
