import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfileStore } from '../store/userProfileStore';
import { useWalletStore } from '../store/walletStore';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Rect, Line } from 'react-native-svg';

export default function PersonalStatisticsScreen() {
  const router = useRouter();
  const { creditBalance } = useWalletStore();
  const profile = useUserProfileStore();

  const stats = [
    { label: 'Total Workouts', val: profile.totalSessions, icon: 'activity', color: 'text-indigo-600' },
    { label: 'Completed Visits', val: profile.totalSessions - profile.cancelledSessions, icon: 'check-circle', color: 'text-emerald-600' },
    { label: 'Cancelled Visits', val: profile.cancelledSessions, icon: 'x-circle', color: 'text-red-500' },
    { label: 'Hours Trained', val: `${profile.hoursTrained}h`, icon: 'clock', color: 'text-blue-500' },
    { label: 'Calories Burned', val: `${profile.totalCalories.toLocaleString()} kcal`, icon: 'zap', color: 'text-amber-500' },
    { label: 'Lifetime Spend', val: profile.lifetimeSpend, icon: 'shopping-bag', color: 'text-[#4F46E5]' },
    { label: 'Wallet Balance', val: `${creditBalance} Credits`, icon: 'credit-card', color: 'text-[#06B6D4]' },
    { label: 'Current Streak', val: `${profile.currentStreak} Days 🔥`, icon: 'trending-up', color: 'text-orange-500' },
    { label: 'Favorite Coach', val: profile.favoriteTrainer, icon: 'users', color: 'text-purple-500' },
    { label: 'Avg Rating Given', val: `⭐ ${profile.averageRatingGiven}`, icon: 'star', color: 'text-yellow-500' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[#111827] text-sm font-black uppercase tracking-wider">
          Personal Statistics
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Analytics Dashboard</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Track your performance summaries, calories burned, and booking statistics.
            </Text>
          </View>

          {/* Grid list of stats cards (Feature 10) */}
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {stats.map((s, idx) => (
              <View
                key={idx}
                className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-2"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">{s.label}</Text>
                  <Feather name={s.icon as any} size={11} color="#6B7280" />
                </View>
                <Text className={`text-sm font-black mt-1 ${s.color}`}>{s.val}</Text>
              </View>
            ))}
          </View>

          {/* Monthly Activity chart graph visual */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Monthly Workouts log</Text>
            
            <View className="flex-row justify-around items-end h-28 pt-4">
              {[
                { m: 'Mar', c: 4 },
                { m: 'Apr', c: 6 },
                { m: 'May', c: 8 },
                { m: 'Jun', c: 12 },
                { m: 'Jul', c: 15 }
              ].map((item, idx) => {
                const maxVal = 15;
                const barHeight = (item.c / maxVal) * 80;
                return (
                  <View key={idx} className="items-center gap-2">
                    <Text className="text-zinc-900 text-[8px] font-black">{item.c}</Text>
                    <View style={{ height: barHeight }} className="w-6 bg-indigo-600 rounded-t-lg shadow-sm" />
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">{item.m}</Text>
                  </View>
                );
              })}
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
