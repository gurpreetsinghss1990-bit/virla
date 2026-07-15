import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkoutStore } from '../store/workoutStore';
import { WorkoutDetailCard } from '../components/WorkoutDetailCard';
import { Ionicons } from '@expo/vector-icons';

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const workoutId = params.id as string;
  
  const { workouts } = useWorkoutStore();
  const workout = workouts.find((w) => w.id === workoutId) || workouts[0];

  const handleStartBooking = () => {
    router.push({
      pathname: '/booking',
      params: { workoutId: workout.id },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Floating Header back button */}
      <View className="absolute top-12 left-6 z-10">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-md border border-zinc-100"
        >
          <Ionicons name="arrow-back" size={20} color="#111111" />
        </TouchableOpacity>
      </View>

      {/* Detail Content */}
      <WorkoutDetailCard workout={workout} />

      {/* Fixed Booking Footer */}
      <View className="p-6 bg-white border-t border-zinc-100">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleStartBooking}
          className="w-full py-4 bg-zinc-900 rounded-[20px] items-center justify-center shadow-sm"
        >
          <Text className="text-white text-base font-extrabold tracking-wide">
            Book Home Session
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
