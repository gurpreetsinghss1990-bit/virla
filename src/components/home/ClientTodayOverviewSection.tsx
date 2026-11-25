import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { NativeProgressBar } from '../NativeProgressBar';
import { softShadow } from '../../utils/shadows';

interface ClientTodayOverviewSectionProps {
  caloriesToday: number;
  caloriesGoal: number;
  waterMl: number;
  waterGoal: number;
  membership: {
    availableCredits: number;
    totalCredits: number;
  };
  streak: number;
  weeklyStreakGoal: number;
  handleLogCalories: () => void;
  handleLogWater: () => void;
  navigateSafely: (target: any) => void;
}

export const ClientTodayOverviewSection: React.FC<ClientTodayOverviewSectionProps> = ({
  caloriesToday,
  caloriesGoal,
  waterMl,
  waterGoal,
  membership,
  streak,
  weeklyStreakGoal,
  handleLogCalories,
  handleLogWater,
  navigateSafely,
}) => {
  return (
    <View className="gap-3">
      <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#0F172A', letterSpacing: -0.3 }}>
        Today's Overview
      </Text>

      <View className="flex-row flex-wrap justify-between gap-y-3">
        {/* Calories Widget */}
        <Pressable
          onPress={handleLogCalories}
          className="w-[48%] rounded-2xl p-4 justify-between bg-white border border-[#F1E5E7]"
          style={softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 })}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Feather name="activity" size={13} color="#F97316" />
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8, color: '#64748B', textTransform: 'uppercase' }}>
                CALORIES
              </Text>
            </View>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#E11D48', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              + LOG
            </Text>
          </View>
          <View className="my-2.5">
            <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: '#0F172A', letterSpacing: -0.5 }}>
              {caloriesToday}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94A3B8' }}>
              / {caloriesGoal} kcal
            </Text>
          </View>
          {/* Native Expo UI Progress Bar */}
          <NativeProgressBar
            progress={caloriesToday / Math.max(caloriesGoal, 1)}
            color="#FB7185"
            trackColor="#F1F5F9"
            height={6}
          />
        </Pressable>

        {/* Hydration Widget */}
        <Pressable
          onPress={handleLogWater}
          className="w-[48%] rounded-2xl p-4 justify-between bg-white border border-[#F1E5E7]"
          style={softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 })}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Feather name="droplet" size={13} color="#0EA5E9" />
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8, color: '#64748B', textTransform: 'uppercase' }}>
                HYDRATION
              </Text>
            </View>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#0284C7', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              + LOG
            </Text>
          </View>
          <View className="my-2.5">
            <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: '#0F172A', letterSpacing: -0.5 }}>
              {waterMl}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94A3B8' }}>
              / {waterGoal} ml
            </Text>
          </View>
          {/* Native Expo UI Progress Bar */}
          <NativeProgressBar
            progress={waterMl / Math.max(waterGoal, 1)}
            color="#38BDF8"
            trackColor="#F1F5F9"
            height={6}
          />
        </Pressable>

        {/* Wallet Credits Widget */}
        <Pressable
          onPress={() => navigateSafely('/membership')}
          className="w-[48%] rounded-2xl p-4 justify-between bg-white border border-[#F1E5E7]"
          style={softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 })}
        >
          <View className="flex-row items-center gap-1.5">
            <Feather name="credit-card" size={13} color="#F59E0B" />
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8, color: '#64748B', textTransform: 'uppercase' }}>
              WALLET CREDITS
            </Text>
          </View>
          <View className="my-2.5">
            <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: '#0F172A', letterSpacing: -0.5 }}>
              {membership.availableCredits}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748B' }}>
              Credits Available
            </Text>
          </View>
          {/* Native Expo UI Progress Bar */}
          <NativeProgressBar
            progress={membership.availableCredits / Math.max(membership.totalCredits, membership.availableCredits, 1)}
            color="#6366F1"
            trackColor="#F1F5F9"
            height={6}
          />
        </Pressable>

        {/* Workout Streak Widget */}
        <Pressable
          onPress={() => navigateSafely('/(tabs)/progress')}
          className="w-[48%] rounded-2xl p-4 justify-between bg-white border border-[#F1E5E7]"
          style={softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 })}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Feather name="zap" size={13} color="#F59E0B" />
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8, color: '#64748B', textTransform: 'uppercase' }}>
                WORKOUT STREAK
              </Text>
            </View>
            <Feather name="chevron-right" size={12} color="#F59E0B" />
          </View>
          <View className="my-2.5">
            <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: '#0F172A', letterSpacing: -0.5 }}>
              {streak}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#94A3B8' }}>
              / {weeklyStreakGoal} days this week
            </Text>
          </View>
          {/* Native Expo UI Progress Bar */}
          <NativeProgressBar
            progress={streak / Math.max(weeklyStreakGoal, 1)}
            color="#FBBF24"
            trackColor="#F1F5F9"
            height={6}
          />
        </Pressable>
      </View>
    </View>
  );
};
