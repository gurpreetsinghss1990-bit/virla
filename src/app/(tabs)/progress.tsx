import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Platform, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressRing } from '../../components/ProgressRing';
import { EmptyState } from '../../components/EmptyState';
import { LuxuryCard } from '../../components/LuxuryCard';
import { Feather, Ionicons } from '@expo/vector-icons';

type RangeType = 'weekly' | 'monthly' | 'yearly';

import { useUserProfileStore } from '../../store/userProfileStore';
import { useUserStore } from '../../store/userStore';
import { Database } from '../../database/Database';

export default function ProgressScreen() {
  const router = useRouter();
  const [activeRange, setActiveRange] = useState<RangeType>('weekly');
  const [simulateEmpty, setSimulateEmpty] = useState(false);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [router]);

  const { totalSessions, totalCalories } = useUserProfileStore();
  const { user, role } = useUserStore();

  const bookings = user.id 
    ? (role === 'trainer'
        ? (Database.schema.bookings || []).filter(b => b.trainerId === user.id || b.trainerName === user.name)
        : Database.getBookings(user.id))
    : [];
  const completedJobs = bookings.filter(b => b.status === 'completed');
  const upcomingJobs = bookings.filter(b => b.status === 'upcoming');
  const cancelledJobs = bookings.filter(b => b.status === 'cancelled');
  const totalCompleted = completedJobs.length;
  const totalUpcoming = upcomingJobs.length;

  const trainerEarningsList = user.id ? Database.getEarnings(user.id) : [];
  const monthlyEarnings = trainerEarningsList.reduce((acc, earn) => acc + (earn.amount > 0 ? earn.amount : 0), 0);

  const isEmpty = useMemo(() => {
    if (simulateEmpty) return true;
    const userId = Database.getCurrentUserId();
    if (!userId) return true;
    const bookingsCount = role === 'trainer'
      ? (Database.schema.bookings || []).filter(b => (b.trainerId === userId || b.trainerName === user.name) && b.status === 'completed').length
      : Database.getBookings(userId).filter(b => b.status === 'completed').length;
    const dateStr = new Date().toLocaleDateString('en-CA');
    const hydrationLogged = Database.getHydration(userId, dateStr);
    return role === 'trainer' ? bookingsCount === 0 : (bookingsCount === 0 && hydrationLogged === 0);
  }, [totalSessions, totalCalories, user.id, simulateEmpty, role, user.name]);

  useEffect(() => {
    fadeAnim.setValue(0.3);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeRange, fadeAnim]);

  const getStats = () => {
    const userId = Database.getCurrentUserId();
    const dateStr = new Date().toLocaleDateString('en-CA');
    const dbRecovery = userId ? (Database.getRecoveryScore(userId, dateStr) ?? 85) : 85;
    const completedSessions = userId 
      ? (role === 'trainer'
          ? (Database.schema.bookings || []).filter(b => (b.trainerId === userId || b.trainerName === user.name) && b.status === 'completed').length
          : Database.getBookings(userId).filter(b => b.status === 'completed').length)
      : 0;
    const caloriesBurned = userId ? Database.getCalories(userId, dateStr) : 0;

    switch (activeRange) {
      case 'weekly': {
        const calGoal = 3500;
        const calAmount = caloriesBurned > 0 
          ? caloriesBurned + 1850 
          : (completedSessions > 0 ? completedSessions * 450 + 1200 : 2450);
        const calProg = Math.min(1.0, calAmount / calGoal);

        const sessCount = Math.max(completedSessions, 4);
        const sessGoal = 5;

        return {
          frequency: `${sessCount} sessions/wk`,
          attendance: 100,
          attendanceSub: `${sessCount}/5 This Week`,
          calories: calAmount,
          caloriesDisplay: `${calAmount.toLocaleString()} Kcal`,
          caloriesGoal: calGoal,
          caloriesProgress: calProg,
          caloriesSub: 'This Week\'s Burn',
          consistency: 92,
          recovery: dbRecovery,
          recoverySub: 'Weekly Peak',
          sessions: sessCount,
          sessionsGoal: sessGoal,
          sessionsProgress: Math.min(1.0, sessCount / sessGoal),
          sessionsSub: 'Goal: 5/wk',
          // Trainer Stats
          trainerRating: '4.90',
          trainerRatingProgress: 0.98,
          trainerRatingSub: '6 Reviews (Wk)',
          trainerCompletion: '100%',
          trainerCompletionProgress: 1.0,
          trainerCompletionSub: 'Target 95%',
          trainerVisits: `${Math.max(totalUpcoming, 4)}`,
          trainerVisitsProgress: Math.min(1.0, Math.max(totalUpcoming, 4) / 5),
          trainerVisitsSub: '5 Assigned / Wk',
          trainerPayoutVal: '85%',
          trainerPayoutProgress: 0.85,
          trainerPayoutSub: '₹12,800 / ₹15k Goal',
          chartData: [
            { label: 'Mon', val: 65, cap: 'Active' },
            { label: 'Tue', val: 85, cap: 'Active' },
            { label: 'Wed', val: 30, cap: 'Rest' },
            { label: 'Thu', val: 90, cap: 'Active' },
            { label: 'Fri', val: 45, cap: 'Active' },
            { label: 'Sat', val: 80, cap: 'Active' },
            { label: 'Sun', val: 25, cap: 'Rest' }
          ]
        };
      }
      case 'monthly': {
        const calGoal = 14000;
        const calAmount = caloriesBurned > 0 
          ? caloriesBurned * 4 + 7800 
          : (completedSessions > 0 ? completedSessions * 1800 + 5400 : 10850);
        const calProg = Math.min(1.0, calAmount / calGoal);

        const sessCount = Math.max(completedSessions * 4, 18);
        const sessGoal = 20;

        return {
          frequency: `${sessCount} sessions/mo`,
          attendance: 94,
          attendanceSub: '22/24 Workouts',
          calories: calAmount,
          caloriesDisplay: `${(calAmount / 1000).toFixed(1)}k Kcal`,
          caloriesGoal: calGoal,
          caloriesProgress: calProg,
          caloriesSub: '30-Day Burn',
          consistency: 88,
          recovery: Math.max(70, Math.min(95, dbRecovery - 4)),
          recoverySub: '30-Day Mean',
          sessions: sessCount,
          sessionsGoal: sessGoal,
          sessionsProgress: Math.min(1.0, sessCount / sessGoal),
          sessionsSub: 'Goal: 20/mo',
          // Trainer Stats
          trainerRating: '4.95',
          trainerRatingProgress: 0.99,
          trainerRatingSub: '28 Reviews (Mo)',
          trainerCompletion: '98%',
          trainerCompletionProgress: 0.98,
          trainerCompletionSub: 'Target 95%',
          trainerVisits: `${Math.max(totalUpcoming * 4, 18)}`,
          trainerVisitsProgress: Math.min(1.0, Math.max(totalUpcoming * 4, 18) / 20),
          trainerVisitsSub: '20 Visits / Mo',
          trainerPayoutVal: '88%',
          trainerPayoutProgress: 0.88,
          trainerPayoutSub: '₹52,800 / ₹60k Goal',
          chartData: [
            { label: 'Wk 1', val: 75, cap: 'Active' },
            { label: 'Wk 2', val: 92, cap: 'Active' },
            { label: 'Wk 3', val: 68, cap: 'Active' },
            { label: 'Wk 4', val: 86, cap: 'Active' }
          ]
        };
      }
      case 'yearly': {
        const calGoal = 150000;
        const calAmount = caloriesBurned > 0 
          ? caloriesBurned * 48 + 85000 
          : (completedSessions > 0 ? completedSessions * 21000 + 62000 : 118400);
        const calProg = Math.min(1.0, calAmount / calGoal);

        const sessCount = Math.max(completedSessions * 48, 192);
        const sessGoal = 200;

        return {
          frequency: `${sessCount} sessions/yr`,
          attendance: 96,
          attendanceSub: '248/260 Days',
          calories: calAmount,
          caloriesDisplay: `${(calAmount / 1000).toFixed(1)}k Kcal`,
          caloriesGoal: calGoal,
          caloriesProgress: calProg,
          caloriesSub: 'Annual Total',
          consistency: 90,
          recovery: Math.min(96, dbRecovery + 2),
          recoverySub: 'Annual Baseline',
          sessions: sessCount,
          sessionsGoal: sessGoal,
          sessionsProgress: Math.min(1.0, sessCount / sessGoal),
          sessionsSub: 'Goal: 200/yr',
          // Trainer Stats
          trainerRating: '4.98',
          trainerRatingProgress: 0.996,
          trainerRatingSub: '214 Reviews (Yr)',
          trainerCompletion: '99%',
          trainerCompletionProgress: 0.99,
          trainerCompletionSub: 'Target 95%',
          trainerVisits: `${Math.max(totalUpcoming * 48, 192)}`,
          trainerVisitsProgress: Math.min(1.0, Math.max(totalUpcoming * 48, 192) / 200),
          trainerVisitsSub: '200 Visits / Yr',
          trainerPayoutVal: '92%',
          trainerPayoutProgress: 0.92,
          trainerPayoutSub: '₹6.6L / ₹7.2L Goal',
          chartData: [
            { label: 'Q1', val: 82, cap: 'Active' },
            { label: 'Q2', val: 94, cap: 'Active' },
            { label: 'Q3', val: 76, cap: 'Active' },
            { label: 'Q4', val: 90, cap: 'Active' }
          ]
        };
      }
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

  const getMedallionTheme = (id: string) => {
    switch (id) {
      case 'a-1':
        return {
          bg: '#FEF3C7',
          border: '#F59E0B',
          glow: '#F59E0B',
          chipBg: '#FEF3C7',
          chipText: '#B45309',
          tag: 'Gold Tier',
        };
      case 'a-2':
        return {
          bg: '#ECFDF5',
          border: '#10B981',
          glow: '#10B981',
          chipBg: '#D1FAE5',
          chipText: '#047857',
          tag: 'Mastery',
        };
      case 'a-3':
        return {
          bg: '#FFF1F2',
          border: '#F43F5E',
          glow: '#F43F5E',
          chipBg: '#FFE4E6',
          chipText: '#BE123C',
          tag: '5-Day Streak',
        };
      case 'a-4':
        return {
          bg: '#F5F3FF',
          border: '#8B5CF6',
          glow: '#8B5CF6',
          chipBg: '#EDE9FE',
          chipText: '#6D28D9',
          tag: 'Zen Master',
        };
      case 'a-5':
      default:
        return {
          bg: '#ECFEFF',
          border: '#06B6D4',
          glow: '#06B6D4',
          chipBg: '#CFFAFE',
          chipText: '#0E7490',
          tag: 'Seasonal Elite',
        };
    }
  };

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 140 }}
        className="bg-[#FCF5F5]"
      >
        <View className="px-6 pt-8 pb-4 gap-6">
          <View className="flex-row justify-between items-start">
            <View className="flex-row items-start gap-5 flex-1 pr-3">
              <TouchableOpacity
                activeOpacity={0.6}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/(tabs)');
                  }
                }}
                className="w-8 h-8 items-center justify-center active:opacity-60 mt-1"
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="chevron-back" size={28} color="#101828" />
              </TouchableOpacity>

              <View className="flex-1">
                <Text className="text-[#101828] text-3xl font-black tracking-tight">
                  {role === 'trainer' ? 'Performance' : 'My Progress'}
                </Text>
                <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest mt-1">
                  {role === 'trainer' ? 'PARTNER INSIGHTS' : 'Analytics & Metrics'}
                </Text>
              </View>
            </View>

            {role !== 'trainer' && (
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setSimulateEmpty(!simulateEmpty)}
                className="bg-[#101828] px-3 py-1.5 rounded-lg mb-1"
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
                      activeOpacity={0.7}
                      onPress={() => setActiveRange(r)}
                      className="flex-1 py-3.5 rounded-xl items-center justify-center"
                      style={{
                        backgroundColor: isActive ? '#101828' : 'transparent',
                        shadowColor: '#101828',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isActive ? 0.15 : 0,
                        shadowRadius: 4,
                        elevation: isActive ? 2 : 0,
                      }}
                    >
                      <Text
                        className="text-[10px] font-black uppercase tracking-wider"
                        style={{
                          color: isActive ? '#FFFFFF' : '#6B7280',
                        }}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Performance indicators */}
              <Animated.View style={{ opacity: fadeAnim }}>
                <LuxuryCard 
                  className="p-5 gap-5" 
                  interactive={false}
                  style={{
                    borderTopWidth: 1.5,
                    borderLeftWidth: 1.5,
                    borderTopColor: '#FFFFFF',
                    borderLeftColor: '#FFFFFF',
                    borderRightWidth: 1.5,
                    borderBottomWidth: 3.5,
                    borderRightColor: '#E2E8F0',
                    borderBottomColor: '#CBD5E1',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.08,
                    shadowRadius: 16,
                    elevation: 5,
                  }}
                >
                  <View className="flex-row justify-between items-center pb-3 border-b border-zinc-100">
                    <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">
                      Performance Indicators
                    </Text>
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-200/60">
                      <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <Text className="text-emerald-700 text-[9px] font-black uppercase tracking-wider">Live Metrics</Text>
                    </View>
                  </View>

                  <View className="flex-row flex-wrap justify-between gap-y-3.5 pt-1">
                    {/* Ring 1: Rating */}
                    <View 
                      style={{
                        width: '48%',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        paddingVertical: 16,
                        paddingHorizontal: 8,
                        alignItems: 'center',
                        borderTopWidth: 1.5,
                        borderLeftWidth: 1.5,
                        borderTopColor: '#FFFFFF',
                        borderLeftColor: '#FFFFFF',
                        borderRightWidth: 1.5,
                        borderBottomWidth: 3,
                        borderRightColor: '#E2E8F0',
                        borderBottomColor: '#CBD5E1',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.07,
                        shadowRadius: 10,
                        elevation: 4,
                      }}
                    >
                      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
                        <ProgressRing progress={currentStats.trainerRatingProgress} size={74} strokeWidth={6}>
                          <Text className="text-[#101828] text-xs font-black">{currentStats.trainerRating}</Text>
                        </ProgressRing>
                      </View>
                      <Text className="text-[#101828] text-xs font-extrabold mt-2.5">Rating</Text>
                      <View className="mt-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80">
                        <Text className="text-amber-700 text-[9px] font-bold uppercase">{currentStats.trainerRatingSub}</Text>
                      </View>
                    </View>

                    {/* Ring 2: Completion Rate */}
                    <View 
                      style={{
                        width: '48%',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        paddingVertical: 16,
                        paddingHorizontal: 8,
                        alignItems: 'center',
                        borderTopWidth: 1.5,
                        borderLeftWidth: 1.5,
                        borderTopColor: '#FFFFFF',
                        borderLeftColor: '#FFFFFF',
                        borderRightWidth: 1.5,
                        borderBottomWidth: 3,
                        borderRightColor: '#E2E8F0',
                        borderBottomColor: '#CBD5E1',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.07,
                        shadowRadius: 10,
                        elevation: 4,
                      }}
                    >
                      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
                        <ProgressRing progress={currentStats.trainerCompletionProgress} size={74} strokeWidth={6}>
                          <Text className="text-[#101828] text-xs font-black">{currentStats.trainerCompletion}</Text>
                        </ProgressRing>
                      </View>
                      <Text className="text-[#101828] text-xs font-extrabold mt-2.5">Completion</Text>
                      <View className="mt-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80">
                        <Text className="text-emerald-700 text-[9px] font-bold uppercase">{currentStats.trainerCompletionSub}</Text>
                      </View>
                    </View>

                    {/* Ring 3: Active Jobs / Visits */}
                    <View 
                      style={{
                        width: '48%',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        paddingVertical: 16,
                        paddingHorizontal: 8,
                        alignItems: 'center',
                        borderTopWidth: 1.5,
                        borderLeftWidth: 1.5,
                        borderTopColor: '#FFFFFF',
                        borderLeftColor: '#FFFFFF',
                        borderRightWidth: 1.5,
                        borderBottomWidth: 3,
                        borderRightColor: '#E2E8F0',
                        borderBottomColor: '#CBD5E1',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.07,
                        shadowRadius: 10,
                        elevation: 4,
                      }}
                    >
                      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
                        <ProgressRing progress={currentStats.trainerVisitsProgress} size={74} strokeWidth={6}>
                          <Text className="text-[#101828] text-xs font-black">{currentStats.trainerVisits}</Text>
                        </ProgressRing>
                      </View>
                      <Text className="text-[#101828] text-xs font-extrabold mt-2.5">Visits</Text>
                      <View className="mt-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80">
                        <Text className="text-indigo-700 text-[9px] font-bold uppercase">{currentStats.trainerVisitsSub}</Text>
                      </View>
                    </View>

                    {/* Ring 4: Earnings Goal */}
                    <View 
                      style={{
                        width: '48%',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 20,
                        paddingVertical: 16,
                        paddingHorizontal: 8,
                        alignItems: 'center',
                        borderTopWidth: 1.5,
                        borderLeftWidth: 1.5,
                        borderTopColor: '#FFFFFF',
                        borderLeftColor: '#FFFFFF',
                        borderRightWidth: 1.5,
                        borderBottomWidth: 3,
                        borderRightColor: '#E2E8F0',
                        borderBottomColor: '#CBD5E1',
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.07,
                        shadowRadius: 10,
                        elevation: 4,
                      }}
                    >
                      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3 }}>
                        <ProgressRing progress={currentStats.trainerPayoutProgress} size={74} strokeWidth={6}>
                          <Text className="text-[#101828] text-xs font-black">{currentStats.trainerPayoutVal}</Text>
                        </ProgressRing>
                      </View>
                      <Text className="text-[#101828] text-xs font-extrabold mt-2.5">Payout Target</Text>
                      <View className="mt-1 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200/80">
                        <Text className="text-purple-700 text-[9px] font-bold uppercase">{currentStats.trainerPayoutSub}</Text>
                      </View>
                    </View>
                  </View>
                </LuxuryCard>
              </Animated.View>

              {/* Weekly/Monthly Earnings chart */}
              <Animated.View style={{ opacity: fadeAnim }}>
                <LuxuryCard 
                  className="p-6" 
                  interactive={false}
                  style={{
                    borderTopWidth: 1.5,
                    borderLeftWidth: 1.5,
                    borderTopColor: '#FFFFFF',
                    borderLeftColor: '#FFFFFF',
                    borderRightWidth: 1.5,
                    borderBottomWidth: 3.5,
                    borderRightColor: '#E2E8F0',
                    borderBottomColor: '#CBD5E1',
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.08,
                    shadowRadius: 16,
                    elevation: 5,
                  }}
                >
                  <View className="flex-row justify-between items-center mb-5">
                    <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">
                      Sessions History Chart
                    </Text>
                    <View className="px-2.5 py-1 bg-zinc-100 rounded-full border border-zinc-200">
                      <Text className="text-[#6B7280] text-[9px] font-black uppercase tracking-wider">
                        {activeRange === 'weekly' ? 'Daily Breakdown' : activeRange === 'monthly' ? '4-Week View' : 'Quarterly Trend'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-end justify-between h-36 pt-2 pb-1">
                    {currentStats.chartData.map((d, index) => {
                      const isPeak = d.val > 0 && d.val === Math.max(...currentStats.chartData.map(c => c.val));
                      const heightPercent = d.val ? `${d.val}%` : '6%';
                      return (
                        <View key={index} className="items-center flex-1 gap-1.5">
                          {/* 3D Floating Peak Indicator */}
                          <View style={{ height: 16, justifyContent: 'center' }}>
                            {isPeak && (
                              <View 
                                style={{
                                  backgroundColor: '#E11D48',
                                  paddingHorizontal: 4,
                                  paddingVertical: 1,
                                  borderRadius: 4,
                                  shadowColor: '#E11D48',
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.3,
                                  shadowRadius: 3,
                                  elevation: 3,
                                }}
                              >
                                <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '900' }}>
                                  {d.val}%
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* 3D Recessed Pillar Groove (Track) */}
                          <View 
                            style={{
                              width: 26,
                              height: 100,
                              borderRadius: 13,
                              backgroundColor: '#EEF2F6',
                              justifyContent: 'flex-end',
                              overflow: 'hidden',
                              borderTopWidth: 2,
                              borderLeftWidth: 1.5,
                              borderTopColor: '#CBD5E1',
                              borderLeftColor: '#CBD5E1',
                              borderBottomWidth: 1,
                              borderRightWidth: 1,
                              borderBottomColor: '#FFFFFF',
                              borderRightColor: '#FFFFFF',
                            }}
                          >
                            {/* 3D Cylindrical Pillar Bar */}
                            <View 
                              style={{ 
                                height: heightPercent as any,
                                width: '100%',
                                borderRadius: 12,
                                backgroundColor: d.val === 0 
                                  ? '#E2E8F0' 
                                  : index % 2 === 0 ? '#E11D48' : '#BE123C',
                                borderLeftWidth: 1.5,
                                borderLeftColor: 'rgba(255, 255, 255, 0.45)',
                                borderRightWidth: 1.5,
                                borderRightColor: 'rgba(0, 0, 0, 0.22)',
                              }} 
                            >
                              {/* 3D Glowing Oval Top Cap */}
                              {d.val > 0 && (
                                <View 
                                  style={{
                                    width: '100%',
                                    height: 5,
                                    borderRadius: 2.5,
                                    backgroundColor: '#FFFFFF',
                                    opacity: 0.65,
                                  }}
                                />
                              )}
                            </View>
                          </View>

                          {/* 3D Pillar Base Ground Shadow */}
                          <View 
                            style={{
                              width: 20,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: d.val > 0 ? 'rgba(15, 23, 42, 0.16)' : 'rgba(15, 23, 42, 0.05)',
                              marginTop: 1,
                            }}
                          />

                          <Text 
                            style={{
                              color: isPeak ? '#101828' : '#6B7280',
                              fontSize: 10,
                              fontWeight: isPeak ? '900' : '700',
                            }}
                          >
                            {d.label}
                          </Text>
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
                      activeOpacity={0.7}
                      onPress={() => setActiveRange(r)}
                      className="flex-1 py-3.5 rounded-xl items-center justify-center"
                      style={{
                        backgroundColor: isActive ? '#101828' : 'transparent',
                        shadowColor: '#101828',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isActive ? 0.15 : 0,
                        shadowRadius: 4,
                        elevation: isActive ? 2 : 0,
                      }}
                    >
                      <Text
                        className="text-[10px] font-black uppercase tracking-wider"
                        style={{
                          color: isActive ? '#FFFFFF' : '#6B7280',
                        }}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Card 1: 4 Animated Rings (Feature 8) */}
              <Animated.View style={{ opacity: fadeAnim }} className="gap-3">
                <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pl-1">
                  Wellness Indicators
                </Text>

                {/* 2x2 3D Stat Pods Grid with Neon Inner Rim Lighting */}
                <View className="flex-row flex-wrap justify-between gap-y-3.5 pt-1">
                    {/* Pod 1: Calories */}
                    <View 
                      style={{
                        width: '48%',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 22,
                        padding: 3,
                        // Multi-layer Beveled Glass Borders
                        borderTopWidth: 2,
                        borderLeftWidth: 2,
                        borderTopColor: '#FFFFFF',
                        borderLeftColor: '#FFFFFF',
                        borderRightWidth: 1.5,
                        borderBottomWidth: 4,
                        borderRightColor: '#E2E8F0',
                        borderBottomColor: '#CBD5E1',
                        // Deep Ambient Drop Shadow
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.12,
                        shadowRadius: 18,
                        elevation: 6,
                      }}
                    >
                      {/* Neon Rose Inner Rim Lighting */}
                      <View 
                        style={{
                          borderRadius: 18,
                          paddingVertical: 14,
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          borderWidth: 1.5,
                          borderColor: 'rgba(244, 63, 94, 0.40)',
                          backgroundColor: 'rgba(255, 241, 242, 0.45)',
                          shadowColor: '#F43F5E',
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.35,
                          shadowRadius: 10,
                        }}
                      >
                        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FECDD3', shadowColor: '#F43F5E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5 }}>
                          <ProgressRing progress={currentStats.caloriesProgress} size={74} strokeWidth={6} activeColor="#F43F5E">
                            <Text className="text-[#101828] text-xs font-black">
                              {Math.round(currentStats.caloriesProgress * 100)}%
                            </Text>
                          </ProgressRing>
                        </View>
                        <Text className="text-[#101828] text-xs font-extrabold mt-2.5">Calories</Text>
                        <Text className="text-[#6B7280] text-[9px] font-bold uppercase mt-1">{currentStats.calories} Kcal</Text>
                      </View>
                    </View>

                    {/* Pod 2: Attendance */}
                    <View 
                      style={{
                        width: '48%',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 22,
                        padding: 3,
                        // Multi-layer Beveled Glass Borders
                        borderTopWidth: 2,
                        borderLeftWidth: 2,
                        borderTopColor: '#FFFFFF',
                        borderLeftColor: '#FFFFFF',
                        borderRightWidth: 1.5,
                        borderBottomWidth: 4,
                        borderRightColor: '#E2E8F0',
                        borderBottomColor: '#CBD5E1',
                        // Deep Ambient Drop Shadow
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.12,
                        shadowRadius: 18,
                        elevation: 6,
                      }}
                    >
                      {/* Neon Emerald Inner Rim Lighting */}
                      <View 
                        style={{
                          borderRadius: 18,
                          paddingVertical: 14,
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          borderWidth: 1.5,
                          borderColor: 'rgba(16, 185, 129, 0.40)',
                          backgroundColor: 'rgba(240, 253, 244, 0.45)',
                          shadowColor: '#10B981',
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.35,
                          shadowRadius: 10,
                        }}
                      >
                        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#A7F3D0', shadowColor: '#10B981', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5 }}>
                          <ProgressRing progress={currentStats.attendance / 100} size={74} strokeWidth={6} activeColor="#10B981">
                            <Text className="text-[#101828] text-xs font-black">{currentStats.attendance}%</Text>
                          </ProgressRing>
                        </View>
                        <Text className="text-[#101828] text-xs font-extrabold mt-2.5">Attendance</Text>
                        <Text className="text-[#6B7280] text-[9px] font-bold uppercase mt-1">Optimal Rate</Text>
                      </View>
                    </View>

                    {/* Pod 3: Sessions */}
                    <View 
                      style={{
                        width: '48%',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 22,
                        padding: 3,
                        // Multi-layer Beveled Glass Borders
                        borderTopWidth: 2,
                        borderLeftWidth: 2,
                        borderTopColor: '#FFFFFF',
                        borderLeftColor: '#FFFFFF',
                        borderRightWidth: 1.5,
                        borderBottomWidth: 4,
                        borderRightColor: '#E2E8F0',
                        borderBottomColor: '#CBD5E1',
                        // Deep Ambient Drop Shadow
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.12,
                        shadowRadius: 18,
                        elevation: 6,
                      }}
                    >
                      {/* Neon Indigo Inner Rim Lighting */}
                      <View 
                        style={{
                          borderRadius: 18,
                          paddingVertical: 14,
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          borderWidth: 1.5,
                          borderColor: 'rgba(99, 102, 241, 0.40)',
                          backgroundColor: 'rgba(238, 242, 255, 0.45)',
                          shadowColor: '#6366F1',
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.35,
                          shadowRadius: 10,
                        }}
                      >
                        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#C7D2FE', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5 }}>
                          <ProgressRing progress={currentStats.sessionsProgress} size={74} strokeWidth={6} activeColor="#6366F1">
                            <Text className="text-[#101828] text-xs font-black">{currentStats.sessions}</Text>
                          </ProgressRing>
                        </View>
                        <Text className="text-[#101828] text-xs font-extrabold mt-2.5">Sessions</Text>
                        <Text className="text-[#6B7280] text-[9px] font-bold uppercase mt-1">Completed</Text>
                      </View>
                    </View>

                    {/* Pod 4: Recovery */}
                    <View 
                      style={{
                        width: '48%',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 22,
                        padding: 3,
                        // Multi-layer Beveled Glass Borders
                        borderTopWidth: 2,
                        borderLeftWidth: 2,
                        borderTopColor: '#FFFFFF',
                        borderLeftColor: '#FFFFFF',
                        borderRightWidth: 1.5,
                        borderBottomWidth: 4,
                        borderRightColor: '#E2E8F0',
                        borderBottomColor: '#CBD5E1',
                        // Deep Ambient Drop Shadow
                        shadowColor: '#0F172A',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.12,
                        shadowRadius: 18,
                        elevation: 6,
                      }}
                    >
                      {/* Neon Amber/Gold Inner Rim Lighting */}
                      <View 
                        style={{
                          borderRadius: 18,
                          paddingVertical: 14,
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          borderWidth: 1.5,
                          borderColor: 'rgba(245, 158, 11, 0.40)',
                          backgroundColor: 'rgba(255, 251, 235, 0.45)',
                          shadowColor: '#F59E0B',
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.35,
                          shadowRadius: 10,
                        }}
                      >
                        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FDE68A', shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5 }}>
                          <ProgressRing progress={currentStats.recovery / 100} size={74} strokeWidth={6} activeColor="#F59E0B">
                            <Text className="text-[#101828] text-xs font-black">{currentStats.recovery}%</Text>
                          </ProgressRing>
                        </View>
                        <Text className="text-[#101828] text-xs font-extrabold mt-2.5">Recovery</Text>
                        <Text className="text-[#6B7280] text-[9px] font-bold uppercase mt-1">High Index</Text>
                      </View>
                    </View>
                  </View>
              </Animated.View>

              {/* Card 2: Sculpted 3D Liquid Energy Cylinders Chart */}
              <Animated.View style={{ opacity: fadeAnim }} className="gap-3">
                <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pl-1">
                  Activity History
                </Text>

                <View className="pt-2 pb-1">
                  <View className="flex-row items-end justify-between h-36 pt-2 pb-1">
                    {currentStats.chartData.map((d, index) => {
                      const isPeak = d.val > 0 && d.val === Math.max(...currentStats.chartData.map(c => c.val));
                      const heightPercent = d.val ? `${d.val}%` : '8%';
                      return (
                        <View key={index} className="items-center flex-1 gap-1.5">

                          {/* Sculpted 3D Glass Cylindrical Conduit */}
                          <View 
                            style={{
                              width: 30,
                              height: 112,
                              borderRadius: 15,
                              backgroundColor: '#EEF2F7',
                              justifyContent: 'flex-end',
                              overflow: 'hidden',
                              borderTopWidth: 2.5,
                              borderLeftWidth: 2,
                              borderTopColor: '#CBD5E1',
                              borderLeftColor: '#CBD5E1',
                              borderBottomWidth: 1.5,
                              borderRightWidth: 1.5,
                              borderBottomColor: '#FFFFFF',
                              borderRightColor: '#FFFFFF',
                              shadowColor: '#000000',
                              shadowOffset: { width: 0, height: 3 },
                              shadowOpacity: 0.10,
                              shadowRadius: 4,
                            }}
                          >
                            {/* Liquid Energy Core with Specular Reflections */}
                            <View 
                              style={{ 
                                height: heightPercent as any,
                                width: '100%',
                                borderRadius: 14,
                                backgroundColor: d.val === 0 
                                  ? '#E2E8F0' 
                                  : index % 2 === 0 ? '#4F46E5' : '#6366F1',
                                // Realistic Specular Reflections along left edge
                                borderLeftWidth: 2,
                                borderLeftColor: 'rgba(255, 255, 255, 0.85)',
                                // Cylindrical refraction depth along right edge
                                borderRightWidth: 2,
                                borderRightColor: 'rgba(0, 0, 0, 0.32)',
                                // Neon Liquid Energy Glow
                                shadowColor: '#4F46E5',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.55,
                                shadowRadius: 10,
                                elevation: 5,
                              }} 
                            >
                              {/* Convex 3D Liquid Meniscus / Illuminated Top Cap */}
                              {d.val > 0 && (
                                <View 
                                  style={{
                                    width: '100%',
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: '#FFFFFF',
                                    opacity: 0.9,
                                    shadowColor: '#FFFFFF',
                                    shadowOffset: { width: 0, height: -1 },
                                    shadowOpacity: 0.9,
                                    shadowRadius: 4,
                                  }}
                                />
                              )}
                            </View>
                          </View>

                          {/* 3D Pillar Base Ground Glow Shadow */}
                          <View 
                            style={{
                              width: 24,
                              height: 5,
                              borderRadius: 2.5,
                              backgroundColor: d.val > 0 ? 'rgba(79, 70, 229, 0.32)' : 'rgba(15, 23, 42, 0.08)',
                              marginTop: 4,
                            }}
                          />

                          <Text 
                            style={{
                              color: isPeak ? '#101828' : '#6B7280',
                              fontSize: 10.5,
                              fontWeight: isPeak ? '900' : '700',
                              marginTop: 2,
                            }}
                          >
                            {d.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>

              {/* Card 3: Embossed 3D Medallion Badges */}
              <View className="gap-3.5">
                <Text className="text-[#101828] text-xs font-black uppercase tracking-widest pl-1">
                  Achievements Badges
                </Text>

                {achievements.map((b) => {
                  const theme = getMedallionTheme(b.id);
                  return (
                    <View
                      key={b.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        paddingVertical: 10,
                        paddingHorizontal: 4,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(226, 232, 240, 0.7)',
                      }}
                    >
                      {/* Deep Inset Chamfer Medallion Socket */}
                      <View
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 29,
                          backgroundColor: '#E2E8F0',
                          borderTopWidth: 2.5,
                          borderLeftWidth: 2.5,
                          borderTopColor: '#94A3B8',
                          borderLeftColor: '#94A3B8',
                          borderBottomWidth: 1.5,
                          borderRightWidth: 1.5,
                          borderBottomColor: '#FFFFFF',
                          borderRightColor: '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {/* Glowing Metallic / 3D Gem Core */}
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: theme.bg,
                            borderWidth: 2,
                            borderColor: theme.border,
                            shadowColor: theme.glow,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.55,
                            shadowRadius: 10,
                            elevation: 6,
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Specular 3D Reflection Glint */}
                          <View
                            style={{
                              position: 'absolute',
                              top: 3,
                              left: 7,
                              width: 16,
                              height: 9,
                              borderRadius: 5,
                              backgroundColor: '#FFFFFF',
                              opacity: 0.85,
                              transform: [{ rotate: '-25deg' }],
                            }}
                          />
                          <Text style={{ fontSize: 24 }}>{b.icon}</Text>
                        </View>
                      </View>

                      {/* Content */}
                      <View className="flex-1">
                        <Text className="text-[#101828] text-sm font-extrabold tracking-tight">
                          {b.title}
                        </Text>
                        <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">
                          {b.desc}
                        </Text>
                      </View>
                    </View>
                  );
                })}
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
    <View style={{ flex: 1, backgroundColor: '#FCF5F5', paddingTop: insets.top }}>
      {children}
    </View>
  );
}
