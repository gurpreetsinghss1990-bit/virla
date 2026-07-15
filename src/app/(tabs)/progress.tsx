import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { ProgressRing } from '../../components/ProgressRing';
import { Feather } from '@expo/vector-icons';

type RangeType = 'weekly' | 'monthly' | 'yearly';

export default function ProgressScreen() {
  const [activeRange, setActiveRange] = useState<RangeType>('weekly');

  const getStats = () => {
    switch (activeRange) {
      case 'weekly':
        return {
          frequency: '4 sessions/wk',
          attendance: '98%',
          calories: '1,840 kcal',
          consistency: '92%',
          recovery: 85,
          chartData: [
            { label: 'M', val: 40, cap: 'Strength' },
            { label: 'T', val: 25, cap: 'Cardio' },
            { label: 'W', val: 0, cap: 'Rest' },
            { label: 'T', val: 55, cap: 'HIIT' },
            { label: 'F', val: 30, cap: 'Yoga' },
            { label: 'S', val: 65, cap: 'Strength' },
            { label: 'S', val: 10, cap: 'Recovery' }
          ]
        };
      case 'monthly':
        return {
          frequency: '18 sessions/mo',
          attendance: '95%',
          calories: '8,200 kcal',
          consistency: '88%',
          recovery: 78,
          chartData: [
            { label: 'W1', val: 65, cap: 'Active' },
            { label: 'W2', val: 80, cap: 'Active' },
            { label: 'W3', val: 45, cap: 'Active' },
            { label: 'W4', val: 90, cap: 'Active' }
          ]
        };
      case 'yearly':
        return {
          frequency: '210 sessions/yr',
          attendance: '94%',
          calories: '94,500 kcal',
          consistency: '84%',
          recovery: 82,
          chartData: [
            { label: 'Q1', val: 70, cap: 'Active' },
            { label: 'Q2', val: 85, cap: 'Active' },
            { label: 'Q3', val: 60, cap: 'Active' },
            { label: 'Q4', val: 95, cap: 'Active' }
          ]
        };
    }
  };

  const currentStats = getStats();

  const badges = [
    { id: 'b-1', icon: '🏆', title: 'Personal Best', desc: 'Burned 650 kcal in Strength flow' },
    { id: 'b-2', icon: '🔥', title: 'Streak King', desc: 'Completed 5 consecutive workouts' },
    { id: 'b-3', icon: '🧘', title: 'Zen Master', desc: 'Completed 10 Yoga sessions' },
    { id: 'b-4', icon: '⚡', title: 'Unstoppable', desc: 'Achieved 95% attendance this month' }
  ];

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 130 }}
        className="bg-[#F8F9FB]"
      >
        <View className="px-6 pt-8 pb-4 gap-6">
          {/* Header */}
          <View>
            <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest">Analytics & Metrics</Text>
            <Text className="text-[#111827] text-3xl font-black tracking-tight mt-1">My Progress</Text>
          </View>

          {/* Timeframe Selector */}
          <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1.5 rounded-2xl">
            {(['weekly', 'monthly', 'yearly'] as const).map((r) => {
              const isActive = activeRange === r;
              return (
                <TouchableOpacity
                  key={r}
                  activeOpacity={0.8}
                  onPress={() => setActiveRange(r)}
                  className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                    isActive ? 'bg-[#111827] shadow-sm' : ''
                  }`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-[#6B7280]'}`}>
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Card 1: Core Metrics Grid */}
          <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] shadow-sm gap-5">
            <Text className="text-[#111827] text-sm font-black uppercase tracking-wider pb-3 border-b border-zinc-100">
              Wellness Index
            </Text>

            <View className="flex-row justify-between items-center">
              {/* Recovery Circular Indicator */}
              <ProgressRing progress={currentStats.recovery / 100} size={84} strokeWidth={6} activeColor="#4F46E5">
                <View className="items-center justify-center">
                  <Text className="text-[#111827] text-base font-black">{currentStats.recovery}%</Text>
                  <Text className="text-[#6B7280] text-[8px] font-extrabold uppercase mt-0.5">Recovery</Text>
                </View>
              </ProgressRing>

              {/* Text Metrics */}
              <View className="gap-3.5 flex-1 pl-8">
                <View className="flex-row justify-between">
                  <Text className="text-[#6B7280] text-xs font-semibold">Frequency</Text>
                  <Text className="text-[#111827] text-xs font-extrabold">{currentStats.frequency}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[#6B7280] text-xs font-semibold">Attendance</Text>
                  <Text className="text-[#22C55E] text-xs font-extrabold">{currentStats.attendance}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[#6B7280] text-xs font-semibold">Calories</Text>
                  <Text className="text-[#111827] text-xs font-extrabold">{currentStats.calories}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[#6B7280] text-xs font-semibold">Consistency</Text>
                  <Text className="text-[#4F46E5] text-xs font-extrabold">{currentStats.consistency}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Card 2: Interactive bar chart */}
          <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] shadow-sm">
            <Text className="text-[#111827] text-sm font-black uppercase tracking-wider mb-5">
              Activity History
            </Text>

            <View className="flex-row items-end justify-between h-32 pt-2">
              {currentStats.chartData.map((d, index) => {
                const heightPercent = d.val ? `${d.val}%` : '5%';
                return (
                  <View key={index} className="items-center flex-1 gap-2.5">
                    <View className="w-6 bg-zinc-50 border border-zinc-100 rounded-lg h-24 justify-end overflow-hidden">
                      <View 
                        style={{ height: heightPercent as any }} 
                        className={`w-full rounded-md ${
                          d.val === 0 ? 'bg-zinc-200' : index % 2 === 0 ? 'bg-[#4F46E5]' : 'bg-[#06B6D4]'
                        }`}
                      />
                    </View>
                    <Text className="text-[#6B7280] text-[10px] font-bold">{d.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Card 3: Achievement Badges */}
          <View className="gap-3">
            <Text className="text-[#111827] text-base font-black tracking-tight">Earning Badges</Text>
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
              {badges.map((b) => (
                <View key={b.id} className="flex-row items-center gap-4 py-1">
                  <View className="w-12 h-12 rounded-2xl bg-indigo-50/50 justify-center items-center">
                    <Text className="text-2xl">{b.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[#111827] text-sm font-extrabold tracking-tight">{b.title}</Text>
                    <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">{b.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return <View className="flex-1 bg-[#F8F9FB] pt-12">{children}</View>;
  }
  return <View className="flex-1 bg-[#F8F9FB]">{children}</View>;
}
