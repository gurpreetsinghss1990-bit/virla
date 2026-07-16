import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Animated, Platform } from 'react-native';
import { ProgressRing } from '../../components/ProgressRing';
import { EmptyState } from '../../components/EmptyState';
import { Feather } from '@expo/vector-icons';

type RangeType = 'weekly' | 'monthly' | 'yearly';

export default function ProgressScreen() {
  const [activeRange, setActiveRange] = useState<RangeType>('weekly');
  const [isEmpty, setIsEmpty] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Trigger spring fade in on tab switch
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [activeRange]);

  const getStats = () => {
    switch (activeRange) {
      case 'weekly':
        return {
          frequency: '4 sessions/wk',
          attendance: 98,
          calories: 1840,
          consistency: 92,
          recovery: 85,
          sessions: 14,
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
          attendance: 95,
          calories: 8200,
          consistency: 88,
          recovery: 78,
          sessions: 52,
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
          attendance: 94,
          calories: 94500,
          consistency: 84,
          recovery: 82,
          sessions: 240,
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

  // Premium S5 Achievements Badges (Feature 8)
  const achievements = [
    { id: 'a-1', icon: '🥇', title: 'Apex Forge', desc: 'Completed 10 high-intensity workouts' },
    { id: 'a-2', icon: '🏆', title: 'Wellness Master', desc: 'Perfect attendance for 4 weeks' },
    { id: 'a-3', icon: '🔥', title: 'Unstoppable', desc: 'Maintained a 5-day active workout streak' },
    { id: 'a-4', icon: '⭐', title: 'Zen Flow Specialist', desc: 'Completed 5 yoga and meditation classes' },
    { id: 'a-5', icon: '💎', title: 'Elite Status', desc: 'Earned all core seasonal badges' }
  ];

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 140 }}
        className="bg-[#F8F9FB]"
      >
        <View className="px-6 pt-8 pb-4 gap-6">
          {/* Header with Simulator Toggle */}
          <View className="flex-row justify-between items-end">
            <View>
              <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest">Analytics & Metrics</Text>
              <Text className="text-[#111827] text-3xl font-black tracking-tight mt-1">My Progress</Text>
            </View>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => setIsEmpty(!isEmpty)}
              className="bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800"
            >
              <Text className="text-amber-400 text-[8px] font-black uppercase tracking-wider">
                {isEmpty ? 'Show Progress' : 'Simulate Empty'}
              </Text>
            </TouchableOpacity>
          </View>

          {isEmpty ? (
            <EmptyState type="no-progress" />
          ) : (
            <>
              {/* Timeframe Selector (Weekly, Monthly, Yearly) */}
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

          {/* Card 1: 4 Animated Rings (Feature 8) */}
          <Animated.View 
            style={{ opacity: fadeAnim }}
            className="bg-white border border-[#E5E7EB] p-6 rounded-[30px] shadow-sm gap-5"
          >
            <Text className="text-[#111827] text-xs font-black uppercase tracking-wider pb-3.5 border-b border-zinc-150/50">
              Wellness Indicators
            </Text>

            {/* 2x2 Progress Rings Grid */}
            <View className="flex-row flex-wrap justify-around gap-y-6 pt-2">
              
              {/* Ring 1: Calories */}
              <View className="items-center w-[45%] gap-2.5">
                <ProgressRing progress={0.65} size={76} strokeWidth={6} activeColor="#06B6D4">
                  <View className="items-center justify-center">
                    <Text className="text-[#111827] text-xs font-black">65%</Text>
                  </View>
                </ProgressRing>
                <Text className="text-[#111827] text-xs font-extrabold">Calories</Text>
                <Text className="text-[#6B7280] text-[9px] font-bold uppercase">{currentStats.calories} Kcal</Text>
              </View>

              {/* Ring 2: Attendance */}
              <View className="items-center w-[45%] gap-2.5">
                <ProgressRing progress={currentStats.attendance / 100} size={76} strokeWidth={6} activeColor="#22C55E">
                  <View className="items-center justify-center">
                    <Text className="text-[#111827] text-xs font-black">{currentStats.attendance}%</Text>
                  </View>
                </ProgressRing>
                <Text className="text-[#111827] text-xs font-extrabold">Attendance</Text>
                <Text className="text-[#6B7280] text-[9px] font-bold uppercase">Optimal Rate</Text>
              </View>

              {/* Ring 3: Sessions */}
              <View className="items-center w-[45%] gap-2.5">
                <ProgressRing progress={0.7} size={76} strokeWidth={6} activeColor="#4F46E5">
                  <View className="items-center justify-center">
                    <Text className="text-[#111827] text-xs font-black">{currentStats.sessions}</Text>
                  </View>
                </ProgressRing>
                <Text className="text-[#111827] text-xs font-extrabold">Sessions</Text>
                <Text className="text-[#6B7280] text-[9px] font-bold uppercase">Completed</Text>
              </View>

              {/* Ring 4: Recovery */}
              <View className="items-center w-[45%] gap-2.5">
                <ProgressRing progress={currentStats.recovery / 100} size={76} strokeWidth={6} activeColor="#8B5CF6">
                  <View className="items-center justify-center">
                    <Text className="text-[#111827] text-xs font-black">{currentStats.recovery}%</Text>
                  </View>
                </ProgressRing>
                <Text className="text-[#111827] text-xs font-extrabold">Recovery</Text>
                <Text className="text-[#6B7280] text-[9px] font-bold uppercase">High Index</Text>
              </View>

            </View>
          </Animated.View>

          {/* Card 2: Smooth animated chart */}
          <Animated.View 
            style={{ opacity: fadeAnim }}
            className="bg-white border border-[#E5E7EB] p-6 rounded-[30px] shadow-sm"
          >
            <Text className="text-[#111827] text-xs font-black uppercase tracking-wider mb-5">
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
          </Animated.View>

          {/* Card 3: Achievements List (Feature 8) */}
          <View className="gap-3">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">Achievements Badges</Text>
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[30px] shadow-sm gap-4">
              {achievements.map((b) => (
                <View key={b.id} className="flex-row items-center gap-4 py-1.5 border-b border-zinc-100/50 last:border-b-0">
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
          </>
          )}
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
