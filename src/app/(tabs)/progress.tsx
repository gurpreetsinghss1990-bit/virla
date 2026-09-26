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

  const { totalSessions, totalCalories, currentStreak } = useUserProfileStore();
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
  const effectiveSessions = Math.max(totalSessions || 0, totalCompleted || 0);
  const streak = currentStreak || 0;

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
    return role === 'trainer' ? bookingsCount === 0 : (bookingsCount === 0 && hydrationLogged === 0 && effectiveSessions === 0);
  }, [totalSessions, totalCalories, effectiveSessions, user.id, simulateEmpty, role, user.name]);

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
    const caloriesBurned = userId ? Database.getCalories(userId, dateStr) : 0;
    const totalJobs = totalCompleted + cancelledJobs.length;
    const attendanceRate = totalJobs > 0 
      ? Math.round((totalCompleted / totalJobs) * 100) 
      : (effectiveSessions > 0 ? 96 : 0);
    const trainerObj = role === 'trainer' && user.id ? (Database.schema.coaches || []).find((c) => c.id === user.id) : null;
    const computedTrainerRating = trainerObj?.rating ? Number(trainerObj.rating).toFixed(2) : '4.90';

    switch (activeRange) {
      case 'weekly': {
        const calGoal = 3500;
        const calAmount = caloriesBurned > 0 
          ? caloriesBurned + (effectiveSessions > 0 ? effectiveSessions * 450 : 0)
          : (effectiveSessions > 0 ? effectiveSessions * 450 : 0);
        const calProg = calGoal > 0 ? Math.min(1.0, calAmount / calGoal) : 0;

        const sessCount = effectiveSessions > 0 ? Math.min(effectiveSessions, 5) : 0;
        const sessGoal = 5;

        return {
          frequency: `${sessCount} sessions/wk`,
          attendance: attendanceRate,
          attendanceSub: `${sessCount}/${sessGoal} This Week`,
          calories: calAmount,
          caloriesDisplay: `${calAmount.toLocaleString()} Kcal`,
          caloriesGoal: calGoal,
          caloriesProgress: calProg,
          caloriesSub: "This Week's Burn",
          consistency: Math.min(100, Math.max(60, streak * 20)),
          recovery: dbRecovery,
          recoverySub: 'Weekly Peak',
          sessions: sessCount,
          sessionsGoal: sessGoal,
          sessionsProgress: Math.min(1.0, sessCount / sessGoal),
          sessionsSub: `Goal: ${sessGoal}/wk`,
          // Trainer Stats
          trainerRating: computedTrainerRating,
          trainerRatingProgress: 0.98,
          trainerRatingSub: `${completedJobs.length} Completed (Wk)`,
          trainerCompletion: `${attendanceRate}%`,
          trainerCompletionProgress: attendanceRate / 100,
          trainerCompletionSub: 'Target 95%',
          trainerVisits: `${Math.max(totalUpcoming, 0)}`,
          trainerVisitsProgress: Math.min(1.0, totalUpcoming / 5),
          trainerVisitsSub: '5 Target / Wk',
          trainerPayoutVal: monthlyEarnings > 0 ? `₹${Math.round(monthlyEarnings / 4)}` : '85%',
          trainerPayoutProgress: 0.85,
          trainerPayoutSub: 'Target: ₹15k/wk',
          chartData: [
            { label: 'Mon', val: sessCount >= 1 ? 75 : 0, cap: 'Active' },
            { label: 'Tue', val: sessCount >= 2 ? 85 : 0, cap: 'Active' },
            { label: 'Wed', val: 0, cap: 'Rest' },
            { label: 'Thu', val: sessCount >= 3 ? 90 : 0, cap: 'Active' },
            { label: 'Fri', val: sessCount >= 4 ? 65 : 0, cap: 'Active' },
            { label: 'Sat', val: sessCount >= 5 ? 80 : 0, cap: 'Active' },
            { label: 'Sun', val: 0, cap: 'Rest' }
          ]
        };
      }
      case 'monthly': {
        const calGoal = 14000;
        const calAmount = caloriesBurned > 0 
          ? caloriesBurned * 4 + (effectiveSessions > 0 ? effectiveSessions * 1800 : 0)
          : (effectiveSessions > 0 ? effectiveSessions * 1800 : 0);
        const calProg = calGoal > 0 ? Math.min(1.0, calAmount / calGoal) : 0;

        const sessCount = effectiveSessions > 0 ? Math.min(effectiveSessions * 4, 20) : 0;
        const sessGoal = 20;

        return {
          frequency: `${sessCount} sessions/mo`,
          attendance: attendanceRate,
          attendanceSub: `${sessCount}/${sessGoal} Workouts`,
          calories: calAmount,
          caloriesDisplay: `${(calAmount / 1000).toFixed(1)}k Kcal`,
          caloriesGoal: calGoal,
          caloriesProgress: calProg,
          caloriesSub: '30-Day Burn',
          consistency: Math.min(100, Math.max(65, streak * 18)),
          recovery: Math.max(70, Math.min(95, dbRecovery - 4)),
          recoverySub: '30-Day Mean',
          sessions: sessCount,
          sessionsGoal: sessGoal,
          sessionsProgress: Math.min(1.0, sessCount / sessGoal),
          sessionsSub: `Goal: ${sessGoal}/mo`,
          // Trainer Stats
          trainerRating: computedTrainerRating,
          trainerRatingProgress: 0.99,
          trainerRatingSub: `${completedJobs.length * 4} Reviews (Mo)`,
          trainerCompletion: `${attendanceRate}%`,
          trainerCompletionProgress: attendanceRate / 100,
          trainerCompletionSub: 'Target 95%',
          trainerVisits: `${Math.max(totalUpcoming * 4, 0)}`,
          trainerVisitsProgress: Math.min(1.0, (totalUpcoming * 4) / 20),
          trainerVisitsSub: '20 Target / Mo',
          trainerPayoutVal: monthlyEarnings > 0 ? `₹${monthlyEarnings.toLocaleString()}` : '88%',
          trainerPayoutProgress: 0.88,
          trainerPayoutSub: 'Target: ₹60k/mo',
          chartData: [
            { label: 'Wk 1', val: sessCount >= 4 ? 75 : 30, cap: 'Active' },
            { label: 'Wk 2', val: sessCount >= 8 ? 92 : 45, cap: 'Active' },
            { label: 'Wk 3', val: sessCount >= 12 ? 68 : 20, cap: 'Active' },
            { label: 'Wk 4', val: sessCount >= 16 ? 86 : 40, cap: 'Active' }
          ]
        };
      }
      case 'yearly': {
        const calGoal = 150000;
        const calAmount = caloriesBurned > 0 
          ? caloriesBurned * 48 + (effectiveSessions > 0 ? effectiveSessions * 21000 : 0)
          : (effectiveSessions > 0 ? effectiveSessions * 21000 : 0);
        const calProg = calGoal > 0 ? Math.min(1.0, calAmount / calGoal) : 0;

        const sessCount = effectiveSessions > 0 ? effectiveSessions * 12 : 0;
        const sessGoal = 100;

        return {
          frequency: `${sessCount} sessions/yr`,
          attendance: attendanceRate,
          attendanceSub: `${sessCount}/${sessGoal} Sessions`,
          calories: calAmount,
          caloriesDisplay: `${(calAmount / 1000).toFixed(1)}k Kcal`,
          caloriesGoal: calGoal,
          caloriesProgress: calProg,
          caloriesSub: 'Annual Total',
          consistency: Math.min(100, Math.max(70, streak * 16)),
          recovery: Math.min(96, dbRecovery + 2),
          recoverySub: 'Annual Baseline',
          sessions: sessCount,
          sessionsGoal: sessGoal,
          sessionsProgress: Math.min(1.0, sessCount / sessGoal),
          sessionsSub: `Goal: ${sessGoal}/yr`,
          // Trainer Stats
          trainerRating: computedTrainerRating,
          trainerRatingProgress: 0.996,
          trainerRatingSub: `${completedJobs.length * 48} Reviews (Yr)`,
          trainerCompletion: `${attendanceRate}%`,
          trainerCompletionProgress: attendanceRate / 100,
          trainerCompletionSub: 'Target 95%',
          trainerVisits: `${Math.max(totalUpcoming * 48, 0)}`,
          trainerVisitsProgress: Math.min(1.0, (totalUpcoming * 48) / 200),
          trainerVisitsSub: '200 Target / Yr',
          trainerPayoutVal: monthlyEarnings > 0 ? `₹${(monthlyEarnings * 12).toLocaleString()}` : '92%',
          trainerPayoutProgress: 0.92,
          trainerPayoutSub: 'Target: ₹7.2L/yr',
          chartData: [
            { label: 'Q1', val: sessCount >= 20 ? 82 : 35, cap: 'Active' },
            { label: 'Q2', val: sessCount >= 40 ? 94 : 50, cap: 'Active' },
            { label: 'Q3', val: sessCount >= 60 ? 76 : 40, cap: 'Active' },
            { label: 'Q4', val: sessCount >= 80 ? 90 : 45, cap: 'Active' }
          ]
        };
      }
    }
  };

  const currentStats = getStats();

  const achievements = useMemo(() => {
    return [
      {
        id: 'a-1',
        icon: '🥇',
        title: 'First Workout',
        desc: 'Completed your first in-home coaching session',
        unlocked: effectiveSessions >= 1,
        progress: Math.min(1, effectiveSessions / 1),
        progressText: `${Math.min(effectiveSessions, 1)}/1 Session`,
        tag: 'Pioneer',
      },
      {
        id: 'a-2',
        icon: '🏆',
        title: '5 Sessions Club',
        desc: 'Completed 5 dedicated workout slots',
        unlocked: effectiveSessions >= 5,
        progress: Math.min(1, effectiveSessions / 5),
        progressText: `${Math.min(effectiveSessions, 5)}/5 Sessions`,
        tag: 'Gold Tier',
      },
      {
        id: 'a-3',
        icon: '🔥',
        title: 'Consistency Streak',
        desc: 'Maintained a 5-day active workout streak',
        unlocked: streak >= 5 || effectiveSessions >= 5,
        progress: Math.min(1, Math.max(streak, effectiveSessions) / 5),
        progressText: `${Math.min(Math.max(streak, effectiveSessions), 5)}/5 Days`,
        tag: '5-Day Streak',
      },
      {
        id: 'a-4',
        icon: '⭐',
        title: 'Apex 10 Master',
        desc: 'Logged 10 complete personal training workouts',
        unlocked: effectiveSessions >= 10,
        progress: Math.min(1, effectiveSessions / 10),
        progressText: `${Math.min(effectiveSessions, 10)}/10 Sessions`,
        tag: 'Mastery',
      },
      {
        id: 'a-5',
        icon: '💎',
        title: 'Elite Centenary',
        desc: 'Completed 25+ in-home personal training sessions',
        unlocked: effectiveSessions >= 25,
        progress: Math.min(1, effectiveSessions / 25),
        progressText: `${Math.min(effectiveSessions, 25)}/25 Sessions`,
        tag: 'Seasonal Elite',
      },
    ];
  }, [effectiveSessions, streak]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const getMedallionTheme = (id: string, unlocked: boolean) => {
    if (!unlocked) {
      return {
        bg: '#F1F5F9',
        border: '#CBD5E1',
        glow: 'transparent',
        chipBg: '#F1F5F9',
        chipText: '#64748B',
        tag: 'Locked',
      };
    }
    switch (id) {
      case 'a-1':
        return {
          bg: '#FEF3C7',
          border: '#F59E0B',
          glow: '#F59E0B',
          chipBg: '#FEF3C7',
          chipText: '#B45309',
          tag: 'Pioneer',
        };
      case 'a-2':
        return {
          bg: '#FEF3C7',
          border: '#F59E0B',
          glow: '#F59E0B',
          chipBg: '#FEF3C7',
          chipText: '#B45309',
          tag: 'Gold Tier',
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
          bg: '#ECFDF5',
          border: '#10B981',
          glow: '#10B981',
          chipBg: '#D1FAE5',
          chipText: '#047857',
          tag: 'Mastery',
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
                <Text className="text-[#101828] text-2xl font-bold tracking-tight">
                  {role === 'trainer' ? 'Performance' : 'My Progress'}
                </Text>
                <Text className="text-[#6B7280] text-[11px] font-semibold uppercase tracking-wider mt-0.5">
                  {role === 'trainer' ? 'Partner Insights & Metrics' : 'Analytics & Daily Metrics'}
                </Text>
              </View>
            </View>

            {role !== 'trainer' && (
              <TouchableOpacity 
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setSimulateEmpty(!simulateEmpty)}
                style={{
                  backgroundColor: isEmpty ? '#4F46E5' : '#101828',
                  shadowColor: isEmpty ? '#4F46E5' : '#101828',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.22,
                  shadowRadius: 5,
                  elevation: 3,
                }}
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full mt-1 border border-white/10"
              >
                <Feather 
                  name={isEmpty ? 'refresh-cw' : 'sliders'} 
                  size={11} 
                  color={isEmpty ? '#FFFFFF' : '#F59E0B'} 
                />
                <Text 
                  style={{ color: isEmpty ? '#FFFFFF' : '#FBBF24' }} 
                  className="text-[9.5px] font-bold uppercase tracking-wider"
                >
                  {isEmpty ? 'Restore Data' : 'Simulate Empty'}
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
                      className="flex-1 py-3 rounded-xl items-center justify-center"
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
                        className="text-[11px] font-bold uppercase tracking-wider"
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

              {/* Performance indicators - Seamless on canvas */}
              <Animated.View style={{ opacity: fadeAnim }} className="gap-4">
                <View className="flex-row justify-between items-center px-1">
                  <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider">
                    Performance Indicators
                  </Text>
                </View>

                <View className="flex-row flex-wrap justify-between gap-y-6 pt-1">
                  {/* Ring 1: Rating */}
                  <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
                    <ProgressRing progress={currentStats.trainerRatingProgress} size={84} strokeWidth={10} activeColor="#F59E0B" enable3D={true}>
                      <Text className="text-[#101828] text-sm font-extrabold">{currentStats.trainerRating}</Text>
                    </ProgressRing>
                    <Text className="text-[#101828] text-xs font-bold mt-2.5">Rating</Text>
                    <View className="mt-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80">
                      <Text className="text-amber-700 text-[9px] font-bold uppercase">{currentStats.trainerRatingSub}</Text>
                    </View>
                  </View>

                  {/* Ring 2: Completion Rate */}
                  <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
                    <ProgressRing progress={currentStats.trainerCompletionProgress} size={84} strokeWidth={10} activeColor="#10B981" enable3D={true}>
                      <Text className="text-[#101828] text-sm font-extrabold">{currentStats.trainerCompletion}</Text>
                    </ProgressRing>
                    <Text className="text-[#101828] text-xs font-bold mt-2.5">Completion</Text>
                    <View className="mt-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80">
                      <Text className="text-emerald-700 text-[9px] font-bold uppercase">{currentStats.trainerCompletionSub}</Text>
                    </View>
                  </View>

                  {/* Ring 3: Active Jobs / Visits */}
                  <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
                    <ProgressRing progress={currentStats.trainerVisitsProgress} size={84} strokeWidth={10} activeColor="#6366F1" enable3D={true}>
                      <Text className="text-[#101828] text-sm font-extrabold">{currentStats.trainerVisits}</Text>
                    </ProgressRing>
                    <Text className="text-[#101828] text-xs font-bold mt-2.5">Visits</Text>
                    <View className="mt-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80">
                      <Text className="text-indigo-700 text-[9px] font-bold uppercase">{currentStats.trainerVisitsSub}</Text>
                    </View>
                  </View>

                  {/* Ring 4: Earnings Goal */}
                  <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
                    <ProgressRing progress={currentStats.trainerPayoutProgress} size={84} strokeWidth={10} activeColor="#8B5CF6" enable3D={true}>
                      <Text className="text-[#101828] text-sm font-extrabold">{currentStats.trainerPayoutVal}</Text>
                    </ProgressRing>
                    <Text className="text-[#101828] text-xs font-bold mt-2.5">Payout Target</Text>
                    <View className="mt-1 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200/80">
                      <Text className="text-purple-700 text-[9px] font-bold uppercase">{currentStats.trainerPayoutSub}</Text>
                    </View>
                  </View>
                </View>
              </Animated.View>

              {/* Weekly/Monthly Earnings chart - Seamless on canvas */}
              <Animated.View style={{ opacity: fadeAnim }} className="gap-4">
                <View className="flex-row justify-between items-center px-1">
                  <View>
                    <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider">
                      Sessions History Chart
                    </Text>
                    <Text className="text-zinc-500 text-[10px] font-medium mt-0.5">
                      {activeRange === 'weekly' ? 'Daily session breakdown' : activeRange === 'monthly' ? '4-Week progression' : 'Quarterly trend'}
                    </Text>
                  </View>
                  <View className="px-2.5 py-1 bg-[#101828]/5 rounded-full border border-[#101828]/10">
                    <Text className="text-[#6B7280] text-[9px] font-bold uppercase tracking-wider">
                      {activeRange === 'weekly' ? 'Daily Breakdown' : activeRange === 'monthly' ? '4-Week View' : 'Quarterly Trend'}
                    </Text>
                  </View>
                </View>

                <View style={{ height: 152, justifyContent: 'flex-end', paddingTop: 8 }}>
                  <View className="flex-row items-end justify-between">
                    {currentStats.chartData.map((d, index) => {
                      const isPeak = d.val > 0 && d.val === Math.max(...currentStats.chartData.map(c => c.val));
                      const heightPercent = d.val ? `${d.val}%` : '6%';
                      const barWidth = currentStats.chartData.length > 5 ? 24 : 30;
                      const shadowWidth = currentStats.chartData.length > 5 ? 20 : 24;
                      return (
                        <View key={index} className="items-center flex-1">
                          {/* 3D Floating Peak Indicator */}
                          <View style={{ height: 20, justifyContent: 'center', marginBottom: 6 }}>
                            {isPeak ? (
                              <View 
                                style={{
                                  backgroundColor: '#E11D48',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1.5,
                                  borderRadius: 5,
                                  shadowColor: '#E11D48',
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.3,
                                  shadowRadius: 3,
                                  elevation: 3,
                                }}
                              >
                                <Text style={{ color: '#FFFFFF', fontSize: 8.5, fontWeight: '800' }}>
                                  {d.val}%
                                </Text>
                              </View>
                            ) : (
                              <Text style={{ color: '#94A3B8', fontSize: 8.5, fontWeight: '600' }}>
                                {d.val > 0 ? `${d.val}%` : ''}
                              </Text>
                            )}
                          </View>

                          {/* 3D Recessed Pillar Groove (Track) */}
                          <View 
                            style={{
                              width: barWidth,
                              height: 88,
                              borderRadius: barWidth / 2,
                              backgroundColor: '#EAEFF5',
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
                                borderRadius: (barWidth - 2) / 2,
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
                              width: shadowWidth,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: d.val > 0 ? 'rgba(15, 23, 42, 0.16)' : 'rgba(15, 23, 42, 0.05)',
                              marginTop: 4,
                            }}
                          />

                          <Text 
                            style={{
                              color: isPeak ? '#101828' : '#64748B',
                              fontSize: 10,
                              fontWeight: isPeak ? '800' : '600',
                              marginTop: 4,
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

              {/* Client Review Feed Wall */}
              <View className="gap-3">
                <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider pl-1">Client Review Wall</Text>
                <LuxuryCard className="p-5 gap-4" interactive={false}>
                  {[
                    { id: 'r-1', clientName: 'Viral S.', rating: 5, comment: 'Excellent strength coaching session! Focus on form was perfect.', date: 'Today', workout: 'PowerForge' },
                    { id: 'r-2', clientName: 'Amit M.', rating: 5, comment: 'Punctual, friendly and adjusted intensity perfectly for my shoulder recovery.', date: '2 days ago', workout: 'Zen Yoga Flow' },
                    { id: 'r-3', clientName: 'Pooja K.', rating: 4, comment: 'Very intense HIIT session! Loved the energy and playlist recommendation.', date: 'Last week', workout: 'Apex HIIT' }
                  ].map((rev) => (
                    <View key={rev.id} className="py-3 border-b border-zinc-100 last:border-b-0 gap-1.5">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-[#101828] text-xs font-bold">{rev.clientName} • {rev.workout}</Text>
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
                      className="flex-1 py-3 rounded-xl items-center justify-center"
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
                        className="text-[11px] font-bold uppercase tracking-wider"
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

              {/* Card 1: 4 Animated Rings (Feature 8) - Seamless on canvas */}
              <Animated.View style={{ opacity: fadeAnim }} className="gap-4">
                <View className="flex-row justify-between items-center px-1">
                  <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider">
                    Wellness Indicators
                  </Text>
                </View>

                {/* 2x2 Stat Pods Grid (No white card background) */}
                <View className="flex-row flex-wrap justify-between gap-y-6 pt-1">
                  {/* Pod 1: Calories */}
                  <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
                    <ProgressRing progress={currentStats.caloriesProgress} size={84} strokeWidth={10} activeColor="#F43F5E" enable3D={true}>
                      <Text className="text-[#101828] text-sm font-extrabold">
                        {Math.round(currentStats.caloriesProgress * 100)}%
                      </Text>
                    </ProgressRing>
                    <Text className="text-[#101828] text-xs font-bold mt-2.5">Calories</Text>
                    <Text className="text-zinc-500 text-[10px] font-semibold uppercase mt-0.5">{currentStats.calories} Kcal</Text>
                  </View>

                  {/* Pod 2: Attendance */}
                  <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
                    <ProgressRing progress={currentStats.attendance / 100} size={84} strokeWidth={10} activeColor="#10B981" enable3D={true}>
                      <Text className="text-[#101828] text-sm font-extrabold">{currentStats.attendance}%</Text>
                    </ProgressRing>
                    <Text className="text-[#101828] text-xs font-bold mt-2.5">Attendance</Text>
                    <Text className="text-zinc-500 text-[10px] font-semibold uppercase mt-0.5">Optimal Rate</Text>
                  </View>

                  {/* Pod 3: Sessions */}
                  <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
                    <ProgressRing progress={currentStats.sessionsProgress} size={84} strokeWidth={10} activeColor="#6366F1" enable3D={true}>
                      <Text className="text-[#101828] text-sm font-extrabold">{currentStats.sessions}</Text>
                    </ProgressRing>
                    <Text className="text-[#101828] text-xs font-bold mt-2.5">Sessions</Text>
                    <Text className="text-zinc-500 text-[10px] font-semibold uppercase mt-0.5">Completed</Text>
                  </View>

                  {/* Pod 4: Recovery */}
                  <View className="items-center" style={{ width: '48%', paddingVertical: 8 }}>
                    <ProgressRing progress={currentStats.recovery / 100} size={84} strokeWidth={10} activeColor="#F59E0B" enable3D={true}>
                      <Text className="text-[#101828] text-sm font-extrabold">{currentStats.recovery}%</Text>
                    </ProgressRing>
                    <Text className="text-[#101828] text-xs font-bold mt-2.5">Recovery</Text>
                    <Text className="text-zinc-500 text-[10px] font-semibold uppercase mt-0.5">High Index</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Card 2: Sculpted 3D Liquid Energy Cylinders Chart (Seamless on canvas) */}
              <Animated.View style={{ opacity: fadeAnim }} className="gap-4">
                <View className="flex-row justify-between items-center px-1">
                  <View>
                    <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider">
                      Activity History
                    </Text>
                    <Text className="text-zinc-500 text-[10px] font-medium mt-0.5">
                      {activeRange === 'weekly' ? 'Daily intensity & consistency' : activeRange === 'monthly' ? '4-Week progression' : 'Annual volume overview'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 px-2.5 py-1 bg-[#101828]/5 rounded-full border border-[#101828]/10">
                    <View className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <Text className="text-indigo-700 text-[9px] font-bold uppercase tracking-wider">
                      {activeRange === 'weekly' ? '7-Day View' : activeRange === 'monthly' ? 'Monthly' : 'Yearly'}
                    </Text>
                  </View>
                </View>

                <View style={{ height: 152, justifyContent: 'flex-end', paddingTop: 8 }}>
                  <View className="flex-row items-end justify-between">
                    {currentStats.chartData.map((d, index) => {
                      const isPeak = d.val > 0 && d.val === Math.max(...currentStats.chartData.map(c => c.val));
                      const heightPercent = d.val ? `${d.val}%` : '8%';
                      const barWidth = currentStats.chartData.length > 5 ? 24 : 30;
                      const shadowWidth = currentStats.chartData.length > 5 ? 20 : 24;
                      return (
                        <View key={index} className="items-center flex-1">
                          {/* Floating Peak / Value Indicator */}
                          <View style={{ height: 20, justifyContent: 'center', marginBottom: 6 }}>
                            {isPeak ? (
                              <View 
                                style={{
                                  backgroundColor: '#4F46E5',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1.5,
                                  borderRadius: 5,
                                  shadowColor: '#4F46E5',
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.35,
                                  shadowRadius: 3,
                                  elevation: 3,
                                }}
                              >
                                <Text style={{ color: '#FFFFFF', fontSize: 8.5, fontWeight: '800' }}>
                                  {d.val}%
                                </Text>
                              </View>
                            ) : (
                              <Text style={{ color: '#94A3B8', fontSize: 8.5, fontWeight: '600' }}>
                                {d.val > 0 ? `${d.val}%` : ''}
                              </Text>
                            )}
                          </View>

                          {/* Sculpted 3D Glass Cylindrical Conduit */}
                          <View 
                            style={{
                              width: barWidth,
                              height: 88,
                              borderRadius: barWidth / 2,
                              backgroundColor: '#EAEFF5',
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
                              shadowColor: '#000000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.08,
                              shadowRadius: 3,
                            }}
                          >
                            {/* Liquid Energy Core with Specular Reflections */}
                            <View 
                              style={{ 
                                height: heightPercent as any,
                                width: '100%',
                                borderRadius: (barWidth - 2) / 2,
                                backgroundColor: d.val === 0 
                                  ? '#E2E8F0' 
                                  : index % 2 === 0 ? '#4F46E5' : '#6366F1',
                                borderLeftWidth: 1.5,
                                borderLeftColor: 'rgba(255, 255, 255, 0.85)',
                                borderRightWidth: 1.5,
                                borderRightColor: 'rgba(0, 0, 0, 0.28)',
                                shadowColor: '#4F46E5',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.5,
                                shadowRadius: 8,
                                elevation: 4,
                              }} 
                            >
                              {d.val > 0 && (
                                <View 
                                  style={{
                                    width: '100%',
                                    height: 5,
                                    borderRadius: 2.5,
                                    backgroundColor: '#FFFFFF',
                                    opacity: 0.9,
                                    shadowColor: '#FFFFFF',
                                    shadowOffset: { width: 0, height: -1 },
                                    shadowOpacity: 0.9,
                                    shadowRadius: 3,
                                  }}
                                />
                              )}
                            </View>
                          </View>

                          {/* 3D Pillar Base Ground Glow Shadow */}
                          <View 
                            style={{
                              width: shadowWidth,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: d.val > 0 ? 'rgba(79, 70, 229, 0.28)' : 'rgba(15, 23, 42, 0.06)',
                              marginTop: 4,
                            }}
                          />

                          <Text 
                            style={{
                              color: isPeak ? '#101828' : '#64748B',
                              fontSize: 10,
                              fontWeight: isPeak ? '800' : '600',
                              marginTop: 4,
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

              {/* Card 3: Embossed 3D Medallion Badges (Dynamic Status) */}
              <View className="gap-3.5">
                <View className="flex-row items-center justify-between px-1">
                  <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider">
                    Achievements Badges
                  </Text>
                  <View className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80">
                    <Text className="text-indigo-700 text-[9px] font-bold uppercase tracking-wider">
                      {unlockedCount} of {achievements.length} Unlocked
                    </Text>
                  </View>
                </View>

                {achievements.map((b) => {
                  const theme = getMedallionTheme(b.id, b.unlocked);
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
                        opacity: b.unlocked ? 1 : 0.75,
                      }}
                    >
                      {/* Deep Inset Chamfer Medallion Socket */}
                      <View
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 29,
                          backgroundColor: b.unlocked ? '#E2E8F0' : '#EDE8E8',
                          borderTopWidth: 2.5,
                          borderLeftWidth: 2.5,
                          borderTopColor: b.unlocked ? '#94A3B8' : '#CBD5E1',
                          borderLeftColor: b.unlocked ? '#94A3B8' : '#CBD5E1',
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
                            shadowOpacity: b.unlocked ? 0.55 : 0,
                            shadowRadius: 10,
                            elevation: b.unlocked ? 6 : 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Specular 3D Reflection Glint for Unlocked Badges */}
                          {b.unlocked && (
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
                          )}
                          {b.unlocked ? (
                            <Text style={{ fontSize: 24 }}>{b.icon}</Text>
                          ) : (
                            <Feather name="lock" size={18} color="#94A3B8" />
                          )}
                        </View>
                      </View>

                      {/* Content */}
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text 
                            style={{ color: b.unlocked ? '#101828' : '#64748B' }}
                            className="text-sm font-bold tracking-tight"
                          >
                            {b.title}
                          </Text>
                          <View 
                            style={{
                              backgroundColor: theme.chipBg,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ color: theme.chipText, fontSize: 9, fontWeight: '700' }}>
                              {theme.tag}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-4">
                          {b.desc}
                        </Text>

                        {/* Progress Tracker for Locked Badges */}
                        {!b.unlocked && (
                          <View className="flex-row items-center gap-2 mt-2">
                            <View className="flex-1 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
                              <View 
                                style={{ width: `${b.progress * 100}%` }} 
                                className="h-full bg-indigo-500 rounded-full" 
                              />
                            </View>
                            <Text className="text-zinc-400 text-[9px] font-semibold">
                              {b.progressText}
                            </Text>
                          </View>
                        )}
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
