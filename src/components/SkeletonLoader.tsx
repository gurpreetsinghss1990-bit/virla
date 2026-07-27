import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface SkeletonLoaderProps {
  layout?: 'home' | 'bookings' | 'workout-detail' | 'session-detail';
}

export function SkeletonLoader({ layout = 'home' }: SkeletonLoaderProps) {
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Shimmering pulse effect (repeating loop)
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const animatedStyle = {
    opacity: shimmerAnim,
  };

  const renderHomeSkeleton = () => (
    <View className="flex-1 bg-[#F8F9FB] px-6 pt-6 gap-6">
      {/* Greeter Section */}
      <View className="gap-2">
        <Animated.View style={animatedStyle} className="h-6 w-[55%] bg-zinc-200 rounded-lg" />
        <Animated.View style={animatedStyle} className="h-4 w-[75%] bg-zinc-200 rounded-md" />
      </View>

      {/* Hero Card */}
      <Animated.View style={animatedStyle} className="h-40 w-full bg-zinc-200 rounded-[28px]" />

      {/* Row of Horizontal Items Title */}
      <Animated.View style={animatedStyle} className="h-5 w-[35%] bg-zinc-200 rounded-md mt-4" />

      {/* Horizontal Scroll items placeholders */}
      <View className="flex-row gap-4">
        <Animated.View style={animatedStyle} className="h-48 w-60 bg-zinc-200 rounded-[20px]" />
        <Animated.View style={animatedStyle} className="h-48 w-40 bg-zinc-200 rounded-[20px]" />
      </View>
    </View>
  );

  const renderBookingsSkeleton = () => (
    <View className="flex-1 bg-[#F8F9FB] px-6 pt-6 gap-6">
      {/* Header */}
      <View className="gap-2">
        <Animated.View style={animatedStyle} className="h-4 w-[25%] bg-zinc-200 rounded-md" />
        <Animated.View style={animatedStyle} className="h-8 w-[60%] bg-zinc-200 rounded-lg" />
      </View>

      {/* Tab Capsule Filter Bar */}
      <Animated.View style={animatedStyle} className="h-14 w-full bg-zinc-200 rounded-2xl" />

      {/* Sessions list */}
      <View className="gap-4">
        {[1, 2, 3].map((key) => (
          <Animated.View
            key={key}
            style={animatedStyle}
            className="h-32 w-full bg-zinc-200 rounded-[24px]"
          />
        ))}
      </View>
    </View>
  );

  const renderWorkoutDetailSkeleton = () => (
    <View className="flex-1 bg-white">
      {/* Top Hero Image Placeholder */}
      <Animated.View style={animatedStyle} className="h-80 w-full bg-zinc-200" />

      {/* Content wrapper */}
      <View className="p-6 gap-6">
        <View className="gap-2.5">
          <Animated.View style={animatedStyle} className="h-8 w-[45%] bg-zinc-200 rounded-lg" />
          <Animated.View style={animatedStyle} className="h-4 w-[30%] bg-zinc-200 rounded-md" />
        </View>

        <Animated.View style={animatedStyle} className="h-5 w-[90%] bg-zinc-200 rounded-md" />
        <Animated.View style={animatedStyle} className="h-5 w-[80%] bg-zinc-200 rounded-md" />

        {/* Benefits bullets */}
        <View className="gap-3 mt-4">
          <Animated.View style={animatedStyle} className="h-12 w-full bg-zinc-150 rounded-2xl" />
          <Animated.View style={animatedStyle} className="h-12 w-full bg-zinc-150 rounded-2xl" />
          <Animated.View style={animatedStyle} className="h-12 w-full bg-zinc-150 rounded-2xl" />
        </View>
      </View>
    </View>
  );

  const renderSessionDetailSkeleton = () => (
    <View className="flex-1 bg-[#F8F9FB] px-6 pt-6 gap-6">
      {/* Header bar */}
      <View className="flex-row justify-between items-center h-10">
        <Animated.View style={animatedStyle} className="h-8 w-8 bg-zinc-200 rounded-full" />
        <Animated.View style={animatedStyle} className="h-6 w-32 bg-zinc-200 rounded-md" />
        <Animated.View style={animatedStyle} className="h-8 w-8 bg-zinc-200 rounded-full" />
      </View>

      {/* Main detail card */}
      <Animated.View style={animatedStyle} className="h-48 w-full bg-zinc-200 rounded-[28px]" />

      {/* Timeline stages list */}
      <View className="gap-4 mt-2">
        <Animated.View style={animatedStyle} className="h-5 w-[40%] bg-zinc-200 rounded-md" />
        {[1, 2, 3, 4].map((key) => (
          <View key={key} className="flex-row items-center gap-4">
            <Animated.View style={animatedStyle} className="h-4 w-4 bg-zinc-200 rounded-full" />
            <Animated.View style={animatedStyle} className="h-4 w-[60%] bg-zinc-200 rounded-md" />
          </View>
        ))}
      </View>
    </View>
  );

  switch (layout) {
    case 'bookings':
      return renderBookingsSkeleton();
    case 'workout-detail':
      return renderWorkoutDetailSkeleton();
    case 'session-detail':
      return renderSessionDetailSkeleton();
    case 'home':
    default:
      return renderHomeSkeleton();
  }
}
