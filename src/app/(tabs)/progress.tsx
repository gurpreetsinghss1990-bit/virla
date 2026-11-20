import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Platform, BackHandler, Animated as RNAnimated } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressRing } from '../../components/ProgressRing';
import { EmptyState } from '../../components/EmptyState';
import { LuxuryCard } from '../../components/LuxuryCard';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

type RangeType = 'weekly' | 'monthly' | 'yearly';

import { useUserProfileStore } from '../../store/userProfileStore';
import { useUserStore } from '../../store/userStore';
import { useAIWellnessStore } from '../../store/aiWellnessStore';
import { useBookingStore } from '../../store/bookingStore';
import { Database } from '../../database/Database';
import { CalculatedTargetsCard } from '../../components/CalculatedTargetsCard';
import { NativeSegmentedRangeControl } from '../../components/NativeSegmentedRangeControl';
import { TrainerPerformanceView } from '../../components/TrainerPerformanceView';

import { softShadow } from '../../utils/shadows';
let useMaterialColorsSafe: any = null;
if (Platform.OS === 'android') {
  try {
    const compose = require('@expo/ui/jetpack-compose');
    useMaterialColorsSafe = compose.useMaterialColors;
  } catch {}
}

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeRange, setActiveRange] = useState<RangeType>('weekly');
  const [simulateEmpty, setSimulateEmpty] = useState(false);
  const [forceShowDemo, setForceShowDemo] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  // 🚀 Native Reanimated UI-thread fade animation for timeframe switches
  const fadeSharedValue = useSharedValue(1);
  const animatedFadeStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeSharedValue.value,
    };
  });
  const trainerFadeAnim = useRef(new RNAnimated.Value(1)).current;

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
    } catch {}
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
    const eff = forceShowDemo && rawEff === 0 ? 3 : rawEff;
    const strk = currentStreak || (forceShowDemo ? 4 : 0);
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
  }, [user.id, user.name, role, storeBookings, totalSessions, forceShowDemo, currentStreak]);

  const isNaturallyEmpty = useMemo(() => {
    const userId = user.id || Database.getCurrentUserId();
    if (!userId) return true;
    const bookingsCount = totalCompleted;
    const dateStr = new Date().toLocaleDateString('en-CA');
    const hydrationLogged = Database.getHydration(userId, dateStr);
    return role === 'trainer' ? bookingsCount === 0 : (bookingsCount === 0 && hydrationLogged === 0 && rawEffectiveSessions === 0);
  }, [user.id, role, totalCompleted, rawEffectiveSessions]);

  const isEmpty = useMemo(() => {
    if (simulateEmpty) return true;
    if (forceShowDemo) return false;
    return isNaturallyEmpty;
  }, [simulateEmpty, forceShowDemo, isNaturallyEmpty]);

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

  const userProfile = useUserProfileStore();
  const userName = userProfile.name || user?.name || (role === 'trainer' ? 'Trainer' : 'User');

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
      <View className="flex-1 relative" style={{ backgroundColor: '#F8F9FB' }}>
        <FlashList
          data={[1]}
          keyExtractor={() => 'progress-root'}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          scrollEventThrottle={32}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setScrollY(y);
          }}
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 140 }}
          style={{ backgroundColor: '#F8F9FB' }}
          renderItem={() => (
          <View className="px-5 pt-2 pb-4 gap-5">
            {/* Top Navigation & Page Title matching Stitch code.html */}
            <View className="flex-row items-center justify-between pt-1">
              <View>
                <Text 
                  style={{ fontFamily: 'Outfit_700Bold' }} 
                  className="text-2xl text-[#0F172A] tracking-tight"
                >
                  {role === 'trainer' ? 'Performance' : 'My Progress'}
                </Text>
                <Text 
                  style={{ fontFamily: 'Outfit_600SemiBold' }} 
                  className="text-[10px] tracking-wider uppercase text-slate-400 mt-0.5"
                >
                  {role === 'trainer' ? 'PARTNER INSIGHTS & METRICS' : 'ANALYTICS & DAILY METRICS'}
                </Text>
              </View>

              {role !== 'trainer' && (
                <TouchableOpacity 
                  activeOpacity={0.75}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    if (isEmpty) {
                      setSimulateEmpty(false);
                      setForceShowDemo(true);
                    } else {
                      setSimulateEmpty(true);
                      setForceShowDemo(false);
                    }
                  }}
                  style={{
                    backgroundColor: '#111726',
                    ...softShadow({ color: '#0F172A', opacity: 0.15, radius: 6, offsetY: 2 }),
                  }}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                >
                  <Feather 
                    name={isEmpty ? 'refresh-cw' : 'sliders'} 
                    size={12} 
                    color="#F59E0B" 
                  />
                  <Text 
                    style={{ fontFamily: 'Outfit_700Bold' }} 
                    className="text-white tracking-widest text-[9px] uppercase"
                  >
                    {isEmpty ? 'RESTORE DATA' : 'SIMULATE EMPTY'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

          {isEmpty ? (
            <EmptyState type="no-progress" showCard={false} />
          ) : role === 'trainer' ? (
            <TrainerPerformanceView
              activeRange={activeRange}
              setActiveRange={setActiveRange}
              fadeAnim={trainerFadeAnim}
              currentStats={currentStats}
            />
          ) : (
            <>
              {/* Timeframe Selector (Weekly, Monthly, Yearly) */}
              <NativeSegmentedRangeControl
                activeRange={activeRange}
                onChangeRange={setActiveRange}
              />

              {/* Calculated Targets Hero Card */}
              <Animated.View style={animatedFadeStyle}>
                <CalculatedTargetsCard />
              </Animated.View>

              {/* Card 1: 4 Animated Rings - Crisp White Pods matching Stitch master tokens */}
              <Animated.View style={animatedFadeStyle} className="gap-3.5">
                <View className="flex-row justify-between items-center px-1">
                  <Text 
                    style={{ fontFamily: 'Outfit_700Bold' }} 
                    className="text-[#0F172A] text-xs font-bold uppercase tracking-wider"
                  >
                    Wellness Indicators
                  </Text>
                </View>

                {/* 2x2 Stat Pods Grid (White Cards with ultra-soft hairline slate border) */}
                <View className="flex-row flex-wrap justify-between gap-y-3.5 pt-1">
                  {/* Pod 1: Calories */}
                  <View 
                    style={{ 
                      width: '48%', 
                      paddingVertical: 16, 
                      paddingHorizontal: 12,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(15, 23, 42, 0.06)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 4 }),
                    }}
                  >
                    <ProgressRing progress={currentStats.caloriesProgress} size={84} strokeWidth={9} activeColor="#E11D48" enable3D={true}>
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-base font-extrabold">
                        {Math.round(currentStats.caloriesProgress * 100)}%
                      </Text>
                    </ProgressRing>
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0F172A] text-xs font-bold mt-2.5">Calories</Text>
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-[10px] font-semibold uppercase mt-0.5 tracking-tight">{currentStats.calories} KCAL</Text>
                  </View>

                  {/* Pod 2: Attendance */}
                  <View 
                    style={{ 
                      width: '48%', 
                      paddingVertical: 16, 
                      paddingHorizontal: 12,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(15, 23, 42, 0.06)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 4 }),
                    }}
                  >
                    <ProgressRing progress={currentStats.attendance / 100} size={84} strokeWidth={9} activeColor="#10B981" enable3D={true}>
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-base font-extrabold">{currentStats.attendance}%</Text>
                    </ProgressRing>
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0F172A] text-xs font-bold mt-2.5">Attendance</Text>
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-[10px] font-semibold uppercase mt-0.5 tracking-tight">OPTIMAL RATE</Text>
                  </View>

                  {/* Pod 3: Sessions */}
                  <View 
                    style={{ 
                      width: '48%', 
                      paddingVertical: 16, 
                      paddingHorizontal: 12,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(15, 23, 42, 0.06)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 4 }),
                    }}
                  >
                    <ProgressRing progress={currentStats.sessionsProgress} size={84} strokeWidth={9} activeColor="#3B82F6" enable3D={true}>
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-lg font-extrabold">{currentStats.sessions}</Text>
                    </ProgressRing>
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0F172A] text-xs font-bold mt-2.5">Sessions</Text>
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-[10px] font-semibold uppercase mt-0.5 tracking-tight">COMPLETED</Text>
                  </View>

                  {/* Pod 4: Recovery */}
                  <View 
                    style={{ 
                      width: '48%', 
                      paddingVertical: 16, 
                      paddingHorizontal: 12,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(15, 23, 42, 0.06)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 4 }),
                    }}
                  >
                    <ProgressRing progress={currentStats.recovery / 100} size={84} strokeWidth={9} activeColor="#F59E0B" enable3D={true}>
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-base font-extrabold">{currentStats.recovery}%</Text>
                    </ProgressRing>
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0F172A] text-xs font-bold mt-2.5">Recovery</Text>
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-[10px] font-semibold uppercase mt-0.5 tracking-tight">HIGH INDEX</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Card 2: 7-Day Consistency Capsules Chart inside clean white card */}
              <Animated.View 
                style={[
                  animatedFadeStyle,
                  {
                    backgroundColor: '#FFFFFF',
                    borderRadius: 24,
                    padding: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(15, 23, 42, 0.06)',
                    ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 12, offsetY: 4 }),
                  }
                ]} 
                className="gap-4"
              >
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#0F172A] text-xs font-bold uppercase tracking-wider">
                      Activity History
                    </Text>
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-xs mt-0.5">
                      {activeRange === 'weekly' ? 'Daily intensity & consistency' : activeRange === 'monthly' ? '4-Week progression' : 'Annual volume overview'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 px-2.5 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                    <View className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider">
                      {activeRange === 'weekly' ? '7-Day View' : activeRange === 'monthly' ? 'Monthly' : 'Yearly'}
                    </Text>
                  </View>
                </View>

                <View style={{ height: 160, justifyContent: 'flex-end', paddingTop: 10 }}>
                  <View className="flex-row items-end justify-between">
                    {currentStats.chartData.map((d, index) => {
                      const isPeak = d.val > 0 && d.val === Math.max(...currentStats.chartData.map(c => c.val));
                      const heightPercent = d.val ? `${Math.max(12, d.val)}%` : '12%';
                      const barWidth = 24;
                      return (
                        <View key={index} className="items-center flex-1">
                          {/* Floating Peak / Value Indicator */}
                          <View style={{ height: 22, justifyContent: 'center', marginBottom: 6 }}>
                            {d.val > 0 ? (
                              <View 
                                style={{
                                  backgroundColor: isPeak ? '#4338CA' : 'transparent',
                                  paddingHorizontal: isPeak ? 6 : 0,
                                  paddingVertical: isPeak ? 1.5 : 0,
                                  borderRadius: 5,
                                  ...softShadow({ color: '#4338CA', opacity: isPeak ? 0.35 : 0, radius: 4, offsetY: 2 }),
                                }}
                              >
                                <Text 
                                  style={{ 
                                    fontFamily: 'Outfit_700Bold',
                                    color: isPeak ? '#FFFFFF' : '#94A3B8', 
                                    fontSize: 9, 
                                    fontWeight: '800' 
                                  }}
                                >
                                  {d.val}%
                                </Text>
                              </View>
                            ) : (
                              <Text style={{ color: '#CBD5E1', fontSize: 10, fontWeight: '600' }}>
                                -
                              </Text>
                            )}
                          </View>

                          {/* Consistency Capsule Outer Track */}
                          <View 
                            style={{
                              width: barWidth,
                              height: 108,
                              borderRadius: barWidth / 2,
                              backgroundColor: '#F1F5F9',
                              justifyContent: 'flex-end',
                              overflow: 'hidden',
                              padding: 2,
                              borderWidth: isPeak ? 1.5 : 0,
                              borderColor: isPeak ? '#818CF8' : 'transparent',
                            }}
                          >
                            {/* Inner Filled Capsule Pill with Indigo Gradient */}
                            {d.val > 0 && (
                              <View 
                                style={{ 
                                  height: heightPercent as any,
                                  width: '100%',
                                  borderRadius: (barWidth - 4) / 2,
                                  backgroundColor: isPeak ? '#4338CA' : '#4F46E5',
                                  ...softShadow({ color: '#4338CA', opacity: 0.4, radius: 6, offsetY: 0 }),
                                }} 
                              />
                            )}
                          </View>

                          <Text 
                            style={{
                              fontFamily: isPeak ? 'Outfit_700Bold' : 'Outfit_500Medium',
                              color: isPeak ? '#0F172A' : '#64748B',
                              fontSize: 10.5,
                              fontWeight: isPeak ? '700' : '500',
                              marginTop: 6,
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

              {/* Card 3: Achievements Badges Section matching Stitch Master Tokens */}
              <View className="gap-3">
                <View className="flex-row items-center justify-between px-1">
                  <Text 
                    style={{ fontFamily: 'Outfit_700Bold' }} 
                    className="text-[#0F172A] text-xs font-bold uppercase tracking-wider"
                  >
                    Achievements Badges
                  </Text>
                  <View className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
                    <Text 
                      style={{ fontFamily: 'Outfit_700Bold' }} 
                      className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider"
                    >
                      {unlockedCount} of {achievements.length} Unlocked
                    </Text>
                  </View>
                </View>

                {achievements.map((b) => {
                  return (
                    <View
                      key={b.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(15, 23, 42, 0.08)',
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        ...softShadow({ color: '#0F172A', opacity: 0.03, radius: 8, offsetY: 2 }),
                      }}
                    >
                      {/* Left Icon: Golden Medal for Unlocked, Slate Lock for Locked */}
                      {b.unlocked ? (
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: '#FEF3C7',
                            borderWidth: 2,
                            borderColor: '#FDE68A',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="star" size={24} color="#F59E0B" />
                        </View>
                      ) : (
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: '#F8FAFC',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Feather name="lock" size={20} color="#94A3B8" />
                        </View>
                      )}

                      {/* Content */}
                      <View className="flex-1 min-w-0">
                        <View className="flex-row items-center justify-between">
                          <Text 
                            style={{ 
                              fontFamily: 'Outfit_700Bold', 
                              color: b.unlocked ? '#0F172A' : '#334155',
                              fontSize: 13,
                            }}
                            numberOfLines={1}
                          >
                            {b.title}
                          </Text>
                          {b.unlocked ? (
                            <View 
                              style={{
                                backgroundColor: 'rgba(254, 243, 199, 0.9)',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 6,
                              }}
                            >
                              <Text 
                                style={{ 
                                  fontFamily: 'Outfit_700Bold', 
                                  color: '#B45309', 
                                  fontSize: 9, 
                                  textTransform: 'uppercase' 
                                }}
                              >
                                Pioneer
                              </Text>
                            </View>
                          ) : (
                            <Text 
                              style={{ 
                                fontFamily: 'Outfit_600SemiBold', 
                                color: '#94A3B8', 
                                fontSize: 9 
                              }}
                            >
                              Locked
                            </Text>
                          )}
                        </View>

                        <Text 
                          style={{ fontFamily: 'Outfit_500Medium', color: '#64748B', fontSize: 11 }}
                          className="mt-0.5"
                          numberOfLines={1}
                        >
                          {b.desc}
                        </Text>

                        {/* Progress Tracker for Locked Badges */}
                        {!b.unlocked && (
                          <View className="flex-row items-center gap-2 mt-2">
                            <View className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <View 
                                style={{ width: `${Math.min(100, Math.max(5, b.progress * 100))}%` }} 
                                className="h-full bg-indigo-500 rounded-full" 
                              />
                            </View>
                            <Text 
                              style={{ fontFamily: 'Outfit_700Bold', color: '#94A3B8', fontSize: 9 }}
                            >
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
          )}
        />

        {/* Semi-transparent status bar backdrop */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: '#F8F9FB',
            zIndex: 35,
          }}
        />
      </View>
    </View>
  );
}
