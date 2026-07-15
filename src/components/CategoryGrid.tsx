import React from 'react';
import { ScrollView, View } from 'react-native';
import { useWorkoutStore } from '../store/workoutStore';
import { WorkoutCard } from './WorkoutCard';

interface CategoryGridProps {
  onCategorySelect?: (workoutId: string) => void;
}

export function CategoryGrid({ onCategorySelect }: CategoryGridProps) {
  const { workouts } = useWorkoutStore();

  return (
    <View className="w-full">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 4 }}
        className="flex-row"
      >
        {workouts.map((workout) => (
          <WorkoutCard
            key={workout.id}
            workout={workout}
            onPress={() => onCategorySelect?.(workout.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
