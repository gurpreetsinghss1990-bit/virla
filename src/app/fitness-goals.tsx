import React, { useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfileStore } from '../store/userProfileStore';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function FitnessGoalsScreen() {
  const router = useRouter();
  const { selectedGoals, toggleGoal } = useUserProfileStore();

  const allGoals = [
    'Weight Loss',
    'Fat Loss',
    'Muscle Gain',
    'Body Recomposition',
    'Strength',
    'Flexibility',
    'Mobility',
    'Sports Training',
    'Senior Fitness',
    'Post Pregnancy',
    'Rehabilitation',
    'General Fitness',
    'Maintain Weight'
  ];

  const handleSave = () => {
    Alert.alert('Goals Profile Updated', 'Your training targets have been saved. Your matching priority will optimize for these categories.');
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[#111827] text-sm font-black uppercase tracking-wider">
          Target Fitness Goals
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text className="text-indigo-600 text-xs font-black uppercase">Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Focus Training Targets</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Select multiple targets. Coaches will review these focal points to design custom drills for your sessions.
            </Text>
          </View>

          {/* Goals Selection list */}
          <View className="flex-row flex-wrap gap-3">
            {allGoals.map((goal) => {
              const isSelected = selectedGoals.includes(goal);
              return (
                <TouchableOpacity
                  key={goal}
                  activeOpacity={0.85}
                  onPress={() => toggleGoal(goal)}
                  className={`px-4.5 py-3 rounded-2xl border flex-row items-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 shadow-md'
                      : 'bg-white border-zinc-200 shadow-xs'
                  }`}
                >
                  <Text className={`text-xs font-black uppercase tracking-wider ${
                    isSelected ? 'text-white font-extrabold' : 'text-zinc-900 font-semibold'
                  }`}>
                    {goal}
                  </Text>
                  {isSelected && <Feather name="check" size={12} color="white" />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Save button */}
          <TouchableOpacity
            onPress={handleSave}
            className="w-full bg-[#111827] py-4.5 rounded-2xl items-center justify-center mt-4 shadow-sm"
          >
            <Text className="text-white text-xs font-black uppercase">Save Training Goals</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
