import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkoutStore } from '../store/workoutStore';
import { WorkoutDetailCard } from '../components/WorkoutDetailCard';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { Ionicons } from '@expo/vector-icons';

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const workoutId = params.id as string;
  
  const { workouts } = useWorkoutStore();
  const workout = workouts.find((w) => w.id === workoutId) || workouts[0];

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleStartBooking = () => {
    router.push({
      pathname: '/booking',
      params: {
        workoutId: workout.id,
        workoutType: workout.category,
        workoutName: workout.title,
      },
    });
  };

  if (loading) {
    return <SkeletonLoader layout="workout-detail" />;
  }

  return (
    <View className="flex-1 bg-white">
      {/* Floating Header back button */}
      <View style={{ top: insets.top + 12 }} className="absolute left-6 z-10">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-md"
        >
          <Ionicons name="arrow-back" size={20} color="#111111" />
        </Pressable>
      </View>

      {/* Detail Content */}
      <WorkoutDetailCard workout={workout} />

      {/* Fixed Booking Footer */}
      <View style={{ paddingBottom: Math.max(insets.bottom, 24), paddingTop: 16, paddingHorizontal: 24 }} className="bg-white border-t border-zinc-100">
        <Pressable
          onPress={handleStartBooking}
          className="w-full py-4 bg-zinc-900 rounded-[20px] items-center justify-center shadow-sm"
        >
          <Text className="text-white text-base font-extrabold tracking-wide">
            Book Home Session
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
