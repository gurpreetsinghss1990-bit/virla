import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressRing } from '../../components/ProgressRing';
import { EmptyState } from '../../components/EmptyState';
import { LuxuryCard } from '../../components/LuxuryCard';
import { Feather } from '@expo/vector-icons';

type RangeType = 'weekly' | 'monthly' | 'yearly';

import { useUserProfileStore } from '../../store/userProfileStore';
import { useUserStore } from '../../store/userStore';
import { Database } from '../../database/Database';

export default function ProgressScreen() {
  const [activeRange, setActiveRange] = useState<RangeType>('weekly');
  const fadeAnim = useMemo(() => new Animated.Value(0), []);

  const { totalSessions, totalCalories } = useUserProfileStore();
  const { user, role } = useUserStore();

  const bookings = user.id ? Database.getBookings(user.id) : [];
  const completedJobs = bookings.filter(b => b.status === 'completed');
  const upcomingJobs = bookings.filter(b => b.status === 'upcoming');
  const cancelledJobs = bookings.filter(b => b.status === 'cancelled');
  const totalCompleted = completedJobs.length;
  const totalUpcoming = upcomingJobs.length;

  const trainerEarningsList = user.id ? Database.getEarnings(user.id) : [];
  const monthlyEarnings = trainerEarningsList.reduce((acc, earn) => acc + (earn.amount > 0 ? earn.amount : 0), 0);

  const isEmpty = useMemo(() => {
    const userId = Database.getCurrentUserId();
    if (!userId) return true;
    const bookingsCount = Database.getBookings(userId).filter(b => b.status === 'completed').length;
    const dateStr = new Date().toLocaleDateString('en-CA');
    const hydrationLogged = Database.getHydration(userId, dateStr);
    return bookingsCount === 0 && hydrationLogged === 0;
  }, [totalSessions, totalCalories, user.id]);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [activeRange, fadeAnim]);

  const getStats = () => {
    const userId = Database.getCurrentUserId();
    const dateStr = new Date().toLocaleDateString('en-CA');
    const dbRecovery = userId ? (Database.getRecoveryScore(userId, dateStr) ?? 80) : 80;
    const completedSessions = userId ? Database.getBookings(userId).filter(b => b.status === 'completed').length : 0;
    const caloriesBurned = userId ? Database.getCalories(userId, dateStr) : 0;

    switch (activeRange) {
      case 'weekly':
        return {
          frequency: `${completedSessions} sessions/wk`,
          attendance: completedSessions > 0 ? 100 : 0,
          calories: caloriesBurned,
          consistency: completedSessions > 0 ? 90 : 0,
          recovery: dbRecovery,
          sessions: completedSessions,
          chartData: [
            { label: 'M', val: completedSessions > 0 ? 40 : 0, cap: 'Active' },
            { label: 'T', val: completedSessions > 0 ? 25 : 0, cap: 'Active' },
            { label: 'W', val: 0, cap: 'Rest' },
            { label: 'T', val: completedSessions > 0 ? 55 : 0, cap: 'Active' },
            { label: 'F', val: 0, cap: 'Rest' },
            { label: 'S', val: completedSessions > 0 ? 65 : 0, cap: 'Active' },
            { label: 'S', val: 0, cap: 'Rest' }
          ]
        };
      case 'monthly':
        return {
          frequency: `${completedSessions} sessions/mo`,
          attendance: completedSessions > 0 ? 95 : 0,
          calories: caloriesBurned * 4,
          consistency: completedSessions > 0 ? 88 : 0,
          recovery: dbRecovery,
          sessions: completedSessions,
          chartData: [
            { label: 'W1', val: completedSessions > 0 ? 65 : 0, cap: 'Active' },
            { label: 'W2', val: completedSessions > 0 ? 80 : 0, cap: 'Active' },
            { label: 'W3', val: completedSessions > 0 ? 45 : 0, cap: 'Active' },
            { label: 'W4', val: completedSessions > 0 ? 90 : 0, cap: 'Active' }
          ]
        };
      case 'yearly':
        return {
          frequency: `${completedSessions} sessions/yr`,
          attendance: completedSessions > 0 ? 94 : 0,
          calories: caloriesBurned * 48,
          consistency: completedSessions > 0 ? 84 : 0,
          recovery: dbRecovery,
          sessions: completedSessions,
          chartData: [
            { label: 'Q1', val: completedSessions > 0 ? 70 : 0, cap: 'Active' },
            { label: 'Q2', val: completedSessions > 0 ? 85 : 0, cap: 'Active' },
            { label: 'Q3', val: completedSessions > 0 ? 60 : 0, cap: 'Active' },
            { label: 'Q4', val: completedSessions > 0 ? 95 : 0, cap: 'Active' }
          ]
        };
    }
  };

  const currentStats = getStats();

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
        className="bg-[#F7F8FC]"
      >
        <View className="px-6 pt-8 pb-4 gap-6">
          <View className="flex-row justify-between items-end">
            <View>
              <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest">
                {role === 'trainer' ? 'PARTNER INSIGHTS' : 'Analytics & Metrics'}
              </Text>
              <Text className="text-[#101828] text-3xl font-black tracking-tight mt-1">
                {role === 'trainer' ? 'Performance' : 'My Progress'}
              </Text>
            </View>
            {role !== 'trainer' && (
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setIsEmpty(!isEmpty)}
                className="bg-[#101828] px-3 py-1.5 rounded-lg"
              >
                <Text className="text-amber-400 text-[8px] font-black uppercase tracking-wider">
                  {isEmpty ? 'Show Progress' : 'Simulate Empty'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {isEmpty ? (
            <EmptyState type="no-progress" />
          ) : role === 'trainer' ? (
            <>
              {/* Trainer timeframe indicator */}
              <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1.5 rounded-2xl">
                {(['weekly', 'monthly', 'yearly'] as const).map((r) => {
                  const isActive = activeRange === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      activeOpacity={0.8}
                      onPress={() => setActiveRange(r)}
                      className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                        isActive ? 'bg-[#101828] shadow-sm' : ''
                      }`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-white' : 'text-[#6B7280]'}`}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Performance indicators */}
              <Animated.View style={{ opacity: fadeAnim }}>
                <LuxuryCard className="p-6 gap-5" interactive={false}>
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pb-3.5 border-b border-zinc-100">
                    Performance Indicators
                  </Text>

                  <View className="flex-row flex-wrap justify-around gap-y-6 pt-2">
                    {/* Ring 1: Rating */}
                    <View className="items-center w-[45%] gap-2.5">
                      <ProgressRing progress={0.98} size={76} strokeWidth={6}>
                        <View className="items-center justify-center">
                          <Text className="text-[#101828] text-xs font-black">4.9</Text>
                        </View>
                      </ProgressRing>
                      <Text className="text-[#101828] text-xs font-extrabold">Rating</Text>
                      <Text className="text-[#6B7280] text-[9px] font-bold uppercase">Average Score</Text>
                    </View>

                    {/* Ring 2: Completion Rate */}
                    <View className="items-center w-[45%] gap-2.5">
                      <ProgressRing progress={totalCompleted > 0 ? totalCompleted / (totalCompleted + cancelledJobs.length) : 1.0} size={76} strokeWidth={6}>
                        <View className="items-center justify-center">
                          <Text className="text-[#101828] text-xs font-black">
                            {totalCompleted > 0 ? `${Math.round((totalCompleted / (totalCompleted + cancelledJobs.length)) * 100)}%` : '100%'}
                          </Text>
                        </View>
                      </ProgressRing>
                      <Text className="text-[#101828] text-xs font-extrabold">Completion</Text>
                      <Text className="text-[#6B7280] text-[9px] font-bold uppercase">Target 95%</Text>
                    </View>

                    {/* Ring 3: Active Jobs */}
                    <View className="items-center w-[45%] gap-2.5">
                      <ProgressRing progress={Math.min(1.0, totalUpcoming / 10)} size={76} strokeWidth={6}>
                        <View className="items-center justify-center">
                          <Text className="text-[#101828] text-xs font-black">{totalUpcoming}</Text>
                        </View>
                      </ProgressRing>
                      <Text className="text-[#101828] text-xs font-extrabold">Upcoming</Text>
                      <Text className="text-[#6B7280] text-[9px] font-bold uppercase">Assigned Visits</Text>
                    </View>

                    {/* Ring 4: Earnings Goal */}
                    <View className="items-center w-[45%] gap-2.5">
                      <ProgressRing progress={Math.min(1.0, monthlyEarnings / 50000)} size={76} strokeWidth={6}>
                        <View className="items-center justify-center">
                          <Text className="text-[#101828] text-xs font-black">
                            {Math.round((monthlyEarnings / 50000) * 100)}%
                          </Text>
                        </View>
                      </ProgressRing>
                      <Text className="text-[#101828] text-xs font-extrabold">Payout Target</Text>
                      <Text className="text-[#6B7280] text-[9px] font-bold uppercase">₹50,000/mo Goal</Text>
                    </View>
                  </View>
                </LuxuryCard>
              </Animated.View>

              {/* Weekly/Monthly Earnings chart */}
              <Animated.View style={{ opacity: fadeAnim }}>
                <LuxuryCard className="p-6" interactive={false}>
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider mb-5">
                    Sessions History Chart
                  </Text>

                  <View className="flex-row items-end justify-between h-32 pt-2">
                    {currentStats.chartData.map((d, index) => {
                      const heightPercent = d.val ? `${d.val}%` : '5%';
                      return (
                        <View key={index} className="items-center flex-1 gap-2.5">
                          <View className="w-6 bg-zinc-50 border border-zinc-150 rounded-lg h-24 justify-end overflow-hidden">
                            <View 
                              style={{ height: heightPercent as any }} 
                              className={`w-full rounded-md ${
                                d.val === 0 ? 'bg-zinc-200' : index % 2 === 0 ? 'bg-[#E11D48]' : 'bg-[#101828]'
                              }`}
                            />
                          </View>
                          <Text className="text-[#6B7280] text-[10px] font-bold">{d.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </LuxuryCard>
              </Animated.View>

              {/* Client Review Feed Wall */}
              <View className="gap-3">
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest pl-1">Client Review Wall</Text>
                <LuxuryCard className="p-5 gap-4" interactive={false}>
                  {[
                    { id: 'r-1', clientName: 'Viral S.', rating: 5, comment: 'Excellent strength coaching session! Focus on form was perfect.', date: 'Today', workout: 'PowerForge' },
                    { id: 'r-2', clientName: 'Amit M.', rating: 5, comment: 'Punctual, friendly and adjusted intensity perfectly for my shoulder recovery.', date: '2 days ago', workout: 'Zen Yoga Flow' },
                    { id: 'r-3', clientName: 'Pooja K.', rating: 4, comment: 'Very intense HIIT session! Loved the energy and playlist recommendation.', date: 'Last week', workout: 'Apex HIIT' }
                  ].map((rev) => (
                    <View key={rev.id} className="py-3 border-b border-zinc-100 last:border-b-0 gap-1.5">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-[#101828] text-xs font-extrabold">{rev.clientName} • {rev.workout}</Text>
                        <Text className="text-zinc-400 text-[9px] font-semibold">{rev.date}</Text>
                      </View>
                      <Text className="text-[#6B7280] text-xs italic">&ldquo;{rev.comment}&rdquo;</Text>
                      <View className="flex-row gap-0.5 mt-0.5">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Feather key={i} name="star" size={10} color="#F5B942" style={{ marginRight: 2 }} />
                        ))}
                      </View>
                    </View>
                  ))}
                </LuxuryCard>
              </View>
            </>
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
                        isActive ? 'bg-[#101828] shadow-sm' : ''
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
              <Animated.View style={{ opacity: fadeAnim }}>
                <LuxuryCard className="p-6 gap-5" interactive={false}>
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pb-3.5 border-b border-zinc-100">
                    Wellness Indicators
                  </Text>

                  {/* 2x2 Progress Rings Grid */}
                  <View className="flex-row flex-wrap justify-around gap-y-6 pt-2">
                    
                     {/* Ring 1: Calories */}
                    <View className="items-center w-[45%] gap-2.5">
                      <ProgressRing progress={currentStats.calories > 0 ? 0.85 : 0} size={76} strokeWidth={6}>
                        <View className="items-center justify-center">
                          <Text className="text-[#101828] text-xs font-black">{currentStats.calories > 0 ? '85%' : '0%'}</Text>
                        </View>
                      </ProgressRing>
                      <Text className="text-[#101828] text-xs font-extrabold">Calories</Text>
                      <Text className="text-[#6B7280] text-[9px] font-bold uppercase">{currentStats.calories} Kcal</Text>
                    </View>
 
                     {/* Ring 2: Attendance */}
                     <View className="items-center w-[45%] gap-2.5">
                       <ProgressRing progress={currentStats.attendance / 100} size={76} strokeWidth={6}>
                         <View className="items-center justify-center">
                           <Text className="text-[#101828] text-xs font-black">{currentStats.attendance}%</Text>
                         </View>
                       </ProgressRing>
                       <Text className="text-[#101828] text-xs font-extrabold">Attendance</Text>
                       <Text className="text-[#6B7280] text-[9px] font-bold uppercase">Optimal Rate</Text>
                     </View>
 
                     {/* Ring 3: Sessions */}
                     <View className="items-center w-[45%] gap-2.5">
                       <ProgressRing progress={Math.min(1.0, currentStats.sessions / (activeRange === 'weekly' ? 5 : activeRange === 'monthly' ? 20 : 200))} size={76} strokeWidth={6}>
                         <View className="items-center justify-center">
                           <Text className="text-[#101828] text-xs font-black">{currentStats.sessions}</Text>
                         </View>
                       </ProgressRing>
                       <Text className="text-[#101828] text-xs font-extrabold">Sessions</Text>
                       <Text className="text-[#6B7280] text-[9px] font-bold uppercase">Completed</Text>
                     </View>

                    {/* Ring 4: Recovery */}
                    <View className="items-center w-[45%] gap-2.5">
                      <ProgressRing progress={currentStats.recovery / 100} size={76} strokeWidth={6}>
                        <View className="items-center justify-center">
                          <Text className="text-[#101828] text-xs font-black">{currentStats.recovery}%</Text>
                        </View>
                      </ProgressRing>
                      <Text className="text-[#101828] text-xs font-extrabold">Recovery</Text>
                      <Text className="text-[#6B7280] text-[9px] font-bold uppercase">High Index</Text>
                    </View>

                  </View>
                </LuxuryCard>
              </Animated.View>

              {/* Card 2: Smooth animated chart */}
              <Animated.View style={{ opacity: fadeAnim }}>
                <LuxuryCard className="p-6" interactive={false}>
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider mb-5">
                    Activity History
                  </Text>

                  <View className="flex-row items-end justify-between h-32 pt-2">
                    {currentStats.chartData.map((d, index) => {
                      const heightPercent = d.val ? `${d.val}%` : '5%';
                      return (
                        <View key={index} className="items-center flex-1 gap-2.5">
                          <View className="w-6 bg-zinc-50 border border-zinc-150 rounded-lg h-24 justify-end overflow-hidden">
                            <View 
                              style={{ height: heightPercent as any }} 
                              className={`w-full rounded-md ${
                                d.val === 0 ? 'bg-zinc-200' : index % 2 === 0 ? 'bg-[#4F46E5]' : 'bg-[#6D5EF7]'
                              }`}
                            />
                          </View>
                          <Text className="text-[#6B7280] text-[10px] font-bold">{d.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </LuxuryCard>
              </Animated.View>

              {/* Card 3: Achievements List (Feature 8) */}
              <View className="gap-3">
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest pl-1">Achievements Badges</Text>
                <LuxuryCard className="p-5 gap-4" interactive={false}>
                  {achievements.map((b) => (
                    <View key={b.id} className="flex-row items-center gap-4 py-1.5 border-b border-zinc-100/50 last:border-b-0">
                      <View className="w-12 h-12 rounded-2xl bg-indigo-50/50 justify-center items-center">
                        <Text className="text-2xl">{b.icon}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-[#101828] text-sm font-extrabold tracking-tight">{b.title}</Text>
                        <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">{b.desc}</Text>
                      </View>
                    </View>
                  ))}
                </LuxuryCard>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {children}
    </View>
  );
}
