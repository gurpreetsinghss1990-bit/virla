import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, Platform, BackHandler } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';
import AnimatedReanimated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RangeType = 'weekly' | 'monthly' | 'yearly';

import { useUserProfileStore } from '../../store/userProfileStore';
import { useUserStore } from '../../store/userStore';
import { useAIWellnessStore } from '../../store/aiWellnessStore';
import { useBookingStore } from '../../store/bookingStore';
import { Database } from '../../database/Database';
import { NativeSegmentedRangeControl } from '../../components/NativeSegmentedRangeControl';
import { TrainerPerformanceView } from '../../components/TrainerPerformanceView';
import { ClientProgressView } from '../../components/ClientProgressView';

import { softShadow } from '../../utils/shadows';
let useMaterialColorsSafe: any = null;
if (Platform.OS === 'android') {
  try {
    const compose = require('@expo/ui/jetpack-compose');
    useMaterialColorsSafe = compose.useMaterialColors;
  } catch { }
}

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeRange, setActiveRange] = useState<RangeType>('weekly');
  const [scrollY, setScrollY] = useState(0);
  // 🚀 Native Reanimated UI-thread fade animation for timeframe switches
  const fadeSharedValue = useSharedValue(1);
  const animatedFadeStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeSharedValue.value,
    };
  });

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
  const { savedPlan } = useAIWellnessStore();
  const { bookings: storeBookings } = useBookingStore();

  let materialColors: any = null;
  if (useMaterialColorsSafe) {
    try {
      materialColors = useMaterialColorsSafe();
    } catch { }
  }
  const systemBgColor = materialColors?.background || materialColors?.surface || '#FCF5F5';

  const { bookings, completedJobs, upcomingJobs, cancelledJobs, totalCompleted, totalUpcoming, rawEffectiveSessions, effectiveSessions, streak, monthlyEarnings } = useMemo(() => {
    const bk = user.id
      ? (role === 'trainer'
        ? (storeBookings || []).filter(b => b.trainerId === user.id || b.trainerName === user.name)
        : storeBookings || [])
      : [];
    const comp = bk.filter(b => b.status === 'completed');
    const upc = bk.filter(b => b.status === 'upcoming');
    const canc = bk.filter(b => b.status === 'cancelled');
    const totComp = comp.length;
    const totUpc = upc.length;
    const rawEff = Math.max(totalSessions || 0, totComp || 0);
    const eff = rawEff === 0 ? 3 : rawEff;
    const strk = currentStreak || 4;
    const earnList = user.id && role === 'trainer' ? Database.getEarnings(user.id) : [];
    const moEarn = earnList.reduce((acc, earn) => acc + (earn.amount > 0 ? earn.amount : 0), 0);

    return {
      bookings: bk,
      completedJobs: comp,
      upcomingJobs: upc,
      cancelledJobs: canc,
      totalCompleted: totComp,
      totalUpcoming: totUpc,
      rawEffectiveSessions: rawEff,
      effectiveSessions: eff,
      streak: strk,
      monthlyEarnings: moEarn,
    };
  }, [user.id, user.name, role, storeBookings, totalSessions, currentStreak]);

  useEffect(() => {
    fadeSharedValue.value = 0.3;
    fadeSharedValue.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeRange]);

  const currentStats = useMemo(() => {
    const userId = user.id || Database.getCurrentUserId();
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
        const calGoal = savedPlan?.dailyCalories && savedPlan.dailyCalories > 0
          ? Math.round(savedPlan.dailyCalories * 0.28 * 7)
          : 3500;
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
        const calGoal = savedPlan?.dailyCalories && savedPlan.dailyCalories > 0
          ? Math.round(savedPlan.dailyCalories * 0.28 * 30)
          : 14000;
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
  }, [activeRange, user.id, role, totalCompleted, cancelledJobs.length, effectiveSessions, savedPlan?.dailyCalories, streak, completedJobs.length, totalUpcoming, monthlyEarnings]);

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

  const userProfile = useUserProfileStore();
  const userName = userProfile.name || user?.name || (role === 'trainer' ? 'Trainer' : 'User');

  return (
            <View style={{ flex: 1, backgroundColor: '#F8F9FC' }}>
              <View className="flex-1 relative" style={{ backgroundColor: '#F8F9FC' }}>
                {/* Sticky Top Header — flat bottom, no radius */}
                <View
                  style={{
                    backgroundColor: '#F8F9FC',
                    paddingTop: insets.top + 6,
                    zIndex: 40,
                  }}
                >
                  <View style={{ paddingHorizontal: 20 }}>
                          {/* Top Navigation & Page Title matching Stitch code.html */}
                          <View className="flex-row items-center justify-between pt-1 pb-1">
                            <View>
                              <Text
                                style={{ fontFamily: 'Outfit_800ExtraBold', color: role === 'trainer' ? '#0F172A' : '#E11D48' }}
                                className="text-2xl tracking-tight uppercase"
                              >
                                {role === 'trainer' ? 'Performance' : 'MY PROGRESS'}
                              </Text>
                              <Text
                                style={{ fontFamily: 'Inter_600SemiBold', color: role === 'trainer' ? '#94A3B8' : '#0F172A' }}
                                className="text-[10px] tracking-wider uppercase mt-0.5"
                              >
                                {role === 'trainer' ? 'PARTNER INSIGHTS & METRICS' : 'ANALYTICS & DAILY METRICS'}
                              </Text>
                            </View>

                        </View>

                          {/* Timeframe Selector (Weekly, Monthly, Yearly) - STICKY AT THE TOP */}
                          {role !== 'trainer' && (
                            <View className="pt-2 pb-3">
                              <NativeSegmentedRangeControl
                                activeRange={activeRange}
                                onChangeRange={setActiveRange}
                              />
                            </View>
                          )}
                        </View>

                      </View>

                      {/* Samsung One UI: content top corners round UP → header bottom appears to dip DOWN at edges */}
                      <View
                        style={{
                          flex: 1,
                          borderTopLeftRadius: 48,
                          borderTopRightRadius: 48,
                          overflow: 'hidden',
                          backgroundColor: '#F8F9FC',
                        }}
                      >
                      {/* Scrollable Content: Pure UI Thread Scrolling */}
                      <AnimatedReanimated.ScrollView
                        showsVerticalScrollIndicator={false}
                        decelerationRate={0.96}
                        bounces={true}
                        alwaysBounceVertical={true}
                        overScrollMode="always"
                        nestedScrollEnabled={true}
                        scrollEventThrottle={16}
                        contentContainerStyle={{
                          paddingTop: 12,
                          paddingBottom: Math.max((insets.bottom || 0) + 40, 140),
                          paddingHorizontal: 20,
                        }}
                      >
                        <View className="gap-5">
                          {role === 'trainer' ? (
                            <TrainerPerformanceView
                              activeRange={activeRange}
                              setActiveRange={setActiveRange}
                              animatedFadeStyle={animatedFadeStyle}
                              currentStats={currentStats}
                            />
                          ) : (
                            <ClientProgressView
                              animatedFadeStyle={animatedFadeStyle}
                              currentStats={currentStats}
                              activeRange={activeRange}
                              achievements={achievements}
                            />
                          )}
                    </View>
        </AnimatedReanimated.ScrollView>
              </View>{/* end Samsung curve wrapper */}
            </View>
    </View>
      );
}
