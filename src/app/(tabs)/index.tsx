import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Platform, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { ProgressRing } from '../../components/ProgressRing';
import { LuxuryCard } from '../../components/LuxuryCard';
import { useBookingStore } from '../../store/bookingStore';
import { useCoachStore } from '../../store/coachStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useUserStore } from '../../store/userStore';
import { Database } from '../../database/Database';
import { SkeletonLoader } from '../../components/SkeletonLoader';

export default function HomeScreen() {
  const router = useRouter();
  const { bookings, acceptBooking, updateTimelineStatus } = useBookingStore();
  const { membership } = useMembershipStore();
  const { unreadCount } = useNotificationStore();
  const { user, role } = useUserStore();
  const { totalEarnings, earningsList } = useCoachStore();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');
  const pastBookings = bookings.filter((b) => b.status === 'completed');
  const activeBooking = bookings.find(b => b.status === 'upcoming' && b.timelineStatus && b.timelineStatus !== 'session_closed' && b.timelineStatus !== 'booked');

  // Hydration state
  const [waterMl, setWaterMl] = useState(0);
  const [caloriesToday, setCaloriesToday] = useState(0);
  const waterGoal = 2500;
  const caloriesGoal = 600;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // AI recommendations array
  const [recs, setRecs] = useState<{ title: string; desc: string }[]>([]);
  const [recIdx, setRecIdx] = useState(0);

  useEffect(() => {
    if (user.id) {
      setRecs(Database.getAIRecommendations(user.id));
    } else {
      setRecs([
        { title: 'Stretch Today', desc: 'Recovery Day: Release lower back tension with a reset session.' },
        { title: 'Increase Intensity', desc: 'Optimal Recovery (80%): Great day for a high-intensity Forge Strength.' },
        { title: 'Try Combat Core', desc: 'Build Cardio: Book a boxing conditioning slot for tomorrow.' },
        { title: 'Book Next Session', desc: 'Keep the Streak: Schedule your mobility visit now.' }
      ]);
    }
  }, [user.id, bookings]);

  useEffect(() => {
    if (recs.length === 0) return;
    const interval = setInterval(() => {
      setRecIdx((prev) => (prev + 1) % recs.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [recs]);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, [role]);

  useEffect(() => {
    if (user.id) {
      const dateStr = new Date().toLocaleDateString('en-CA');
      setWaterMl(Database.getHydration(user.id, dateStr));
      setCaloriesToday(Database.getCalories(user.id, dateStr));
    }
  }, [user.id, bookings]);

  const getGreetingText = () => {
    const hour = new Date().getHours();
    const nameText = user.name || 'User';
    if (hour < 12) {
      return { title: `Good Morning, ${nameText} 🌅`, subtitle: 'Ready to build another strong day?' };
    } else if (hour < 17) {
      return { title: `Good Afternoon, ${nameText} ☀️`, subtitle: 'Keep your momentum active today!' };
    } else {
      return { title: `Good Evening, ${nameText} 🌙`, subtitle: 'How did your workout feel today?' };
    }
  };

  const greeting = getGreetingText();

  // Personal Fitness Score Calculation
  const consistency = 92;
  const frequency = 85;
  const dateStr = new Date().toLocaleDateString('en-CA');
  const streak = user.id ? Database.getStreak(user.id) : 0;
  const recoveryVal = user.id ? (Database.getRecoveryScore(user.id, dateStr) ?? 80) : 80;
  const mobility = 78;
  const strength = 88;
  const attendance = 96;
  const fitnessScore = Math.round((consistency + frequency + recoveryVal + mobility + strength + attendance) / 6);

  // Trainer metric summary calculations
  const completedJobs = bookings.filter(b => b.status === 'completed');
  const upcomingJobs = bookings.filter(b => b.status === 'upcoming');
  const cancelledJobs = bookings.filter(b => b.status === 'cancelled');
  const totalCompleted = completedJobs.length;
  const totalUpcoming = upcomingJobs.length;

  const trainerEarningsList = user.id ? Database.getEarnings(user.id) : [];
  const monthlyEarnings = trainerEarningsList.reduce((acc, earn) => acc + (earn.amount > 0 ? earn.amount : 0), 0);

  const handleLogWater = () => {
    if (user.id) {
      const dateStr = new Date().toLocaleDateString('en-CA');
      const newWater = Database.logHydration(user.id, dateStr, 250);
      setWaterMl(newWater);
      Alert.alert('Hydration Logged', '+250ml added! Stay hydrated to maximize recovery index.');
    } else {
      Alert.alert('Authentication Required', 'Please register or log in first');
    }
  };

  const handleSupport = () => {
    Alert.alert('VIRLA VIP Concierge', 'Connecting to VIP wellness support line (+91 99999 88888)...');
  };

  const handleCommunicationCenter = () => {
    Alert.alert(
      'Communication Center',
      'Select a destination to open:',
      [
        {
          text: 'Notifications Center',
          onPress: () => router.push('/notifications' as any),
        },
        {
          text: 'Messages (Chats)',
          onPress: () => router.push('/(tabs)/messages' as any),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleTrainerJobClick = (bookingId: string, currentTimeline: string) => {
    if (currentTimeline === 'confirmed') {
      acceptBooking(bookingId);
      Alert.alert('Job Accepted', 'You accepted this session. Ready to begin travel at the scheduled time!');
    } else {
      router.push({
        pathname: '/session-detail' as any,
        params: { id: bookingId },
      });
    }
  };

  return (
    <SafeAreaViewWrapper>
      {/* Dynamic Header */}
      <View className="h-20 flex-row items-center justify-between px-6 bg-[#FCF5F5]">
        <View>
          <Text className="text-2xl font-bold tracking-[0.2em] text-[#E11D48]">
            {role === 'trainer' ? 'VIRLA PRO' : 'VIRLA'}
          </Text>
          <Text className="text-[10px] font-medium tracking-[0.25em] text-zinc-500 uppercase mt-1">
            Wellness At Your Doorstep
          </Text>
        </View>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleCommunicationCenter}
            className="w-11 h-11 rounded-full border border-zinc-200 bg-white items-center justify-center relative"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Feather name="bell" size={18} color="#101828" />
            {unreadCount > 0 && (
              <View className="absolute top-2.5 right-2.5 bg-red-500 rounded-full w-4 h-4 justify-center items-center">
                <Text className="text-white text-[8px] font-bold">{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/profile' as any)}
            className="w-11 h-11 rounded-full border border-zinc-200 overflow-hidden relative"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Image source={{ uri: user.avatar }} className="w-full h-full" />
            {/* Small gold crown badge overlay */}
            <View className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-500 border border-white items-center justify-center">
              <Text className="text-white text-[6px]">👑</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <SkeletonLoader layout="home" />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          className="bg-[#FCF5F5] flex-1"
        >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          className="px-6 pt-6 gap-8"
        >
          {/* ==================== CLIENT MODE DASHBOARD ==================== */}
          {role === 'customer' && (
            <>
              {/* Greeting */}
              <View className="gap-2 px-1">
                <Text className="text-[34px] font-bold tracking-tight text-[#101828] leading-tight">
                  {greeting.title}
                </Text>
              </View>

              {/* Recovery Hero Card */}
              <View 
                className="w-full bg-[#FFF1F1] rounded-[32px] p-6 shadow-md relative overflow-hidden border border-[#FFE4E6] min-h-[250px]"
                style={{
                  shadowColor: '#E11D48',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.04,
                  shadowRadius: 20,
                  elevation: 4,
                }}
              >
                {/* Athlete Image on the right */}
                <View className="absolute right-0 top-0 bottom-0 w-[52%] z-0">
                  <Image 
                    source={require('../../../assets/images/athlete_hero.png')} 
                    className="w-full h-full" 
                    resizeMode="cover"
                  />
                  {/* Blending Mask */}
                  <View style={StyleSheet.absoluteFill}>
                    <Svg width="100%" height="100%">
                      <Defs>
                        <LinearGradient id="blendGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <Stop offset="0%" stopColor="#FFF1F1" stopOpacity={1} />
                          <Stop offset="55%" stopColor="#FFF1F1" stopOpacity={0.8} />
                          <Stop offset="100%" stopColor="#FFF1F1" stopOpacity={0} />
                        </LinearGradient>
                      </Defs>
                      <Rect width="100%" height="100%" fill="url(#blendGrad)" />
                    </Svg>
                  </View>
                </View>

                {/* Hero Content */}
                <View className="z-10 gap-6 flex-1 justify-between">
                  {/* Recovery score and ring row */}
                  <View className="flex-row items-center gap-5 py-1">
                    {/* Ring Container */}
                    <View className="w-[104px] h-[104px] bg-white rounded-full items-center justify-center shadow-xs">
                      <ProgressRing progress={recoveryVal / 100} size={92} strokeWidth={8} activeColor="#E11D48" inactiveColor="#FFE4E6">
                        <View className="items-center justify-center">
                          <Text className="text-[#101828] text-[30px] font-bold tracking-tighter">
                            {user.id ? (Database.getRecoveryScore(user.id, dateStr) ?? '--') : '87'}
                          </Text>
                          <Text className="text-zinc-400 text-[11px] font-medium mt-0.5">/100</Text>
                        </View>
                      </ProgressRing>
                    </View>

                    {/* Status Info */}
                    <View className="flex-1 gap-1.5 justify-center">
                      <Text className="text-[#E11D48] text-[13px] font-semibold tracking-wider uppercase">Recovery Score</Text>
                      <Text className="text-[#101828] text-[20px] font-semibold tracking-tight">
                        {user.id ? (Database.getRecoveryScore(user.id, dateStr) ? (Database.getRecoveryScore(user.id, dateStr)! >= 80 ? 'Excellent Recovery' : 'Good Recovery') : 'No Logs Yet') : 'Excellent Recovery'}
                      </Text>
                      <Text className="text-zinc-500 text-[15px] font-normal leading-snug">
                        {user.id ? (Database.getRecoveryScore(user.id, dateStr) ? 'Ready for Strength Training Today.' : 'Log water or workouts to compute recovery.') : 'Ready for Strength Training Today.'}
                      </Text>
                      <View className="flex-row mt-1">
                        <View className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                          <Text className="text-amber-600 text-[9px] font-semibold tracking-wider">★ ELITE STATUS</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Schedule Session Button */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => router.push('/booking' as any)}
                    className="w-full h-14 bg-[#E11D48] rounded-[22px] justify-between items-center px-5 flex-row shadow-lg shadow-rose-900/10"
                    style={{ minHeight: 48 }}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Feather name="calendar" size={16} color="white" />
                      <Text className="text-white text-[13px] font-bold uppercase tracking-wider">
                        Schedule Home Session
                      </Text>
                    </View>
                    <View className="w-6 h-6 rounded-full bg-white items-center justify-center">
                      <Feather name="chevron-right" size={14} color="#E11D48" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Choose Your Workout Section */}
              <View className="gap-4">
                <View className="flex-row justify-between items-end pl-1">
                  <Text className="text-[#101828] text-[20px] font-semibold tracking-tight">Choose Your Workout</Text>
                  <TouchableOpacity onPress={() => router.push('/booking' as any)}>
                    <Text className="text-[#E11D48] text-[15px] font-semibold">View All ›</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 2 }}>
                  {[
                    { id: 'strength', title: 'Strength', sub: 'Build & Tone', emoji: '🏋️', colors: ['#FF7E7E', '#E11D48'] },
                    { id: 'yoga', title: 'Yoga', sub: 'Mind & Body', emoji: '🧘', colors: ['#F472B6', '#8B5CF6'] },
                    { id: 'boxing', title: 'Boxing', sub: 'Power & Endurance', emoji: '🥊', colors: ['#FBBF24', '#F97316'] },
                    { id: 'stretch', title: 'Stretching', sub: 'Mobility & Flex', emoji: '🙆', colors: ['#64748B', '#334155'] }
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/booking', params: { workoutId: item.id } })}
                      className="w-36 p-5 rounded-[28px] relative overflow-hidden gap-10"
                      style={{ minHeight: 160 }}
                    >
                      {/* SVG Background Gradient */}
                      <View style={StyleSheet.absoluteFill}>
                        <Svg width="100%" height="100%">
                          <Defs>
                            <LinearGradient id={`grad-${item.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <Stop offset="0%" stopColor={item.colors[0]} />
                              <Stop offset="100%" stopColor={item.colors[1]} />
                            </LinearGradient>
                          </Defs>
                          <Rect width="100%" height="100%" fill={`url(#grad-${item.id})`} />
                        </Svg>
                      </View>

                      {/* Icon container */}
                      <View className="w-11 h-11 rounded-full bg-white/20 items-center justify-center self-start">
                        <Text className="text-lg">{item.emoji}</Text>
                      </View>

                      {/* Text contents and chevron */}
                      <View className="gap-1.5">
                        <Text className="text-white text-[15px] font-semibold tracking-tight">{item.title}</Text>
                        <View className="flex-row justify-between items-center">
                          <Text className="text-white/80 text-[10px] font-medium">{item.sub}</Text>
                          <View className="w-5 h-5 rounded-full bg-white/25 items-center justify-center">
                            <Feather name="chevron-right" size={12} color="white" />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Your Coach Today Section */}
              <View className="gap-4">
                <Text className="text-[#101828] text-[20px] font-semibold tracking-tight pl-1">Your Coach Today</Text>
                
                <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] shadow-sm gap-5">
                  <View className="flex-row gap-4 items-center">
                    {/* Left: Avatar image with rating overlay */}
                    <View className="relative">
                      <Image 
                        source={{ uri: activeBooking?.trainerPhoto || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80' }} 
                        className="w-18 h-18 rounded-full border border-zinc-150" 
                      />
                      {/* Rating Overlay */}
                      <View className="absolute -top-1.5 -left-1.5 bg-white border border-zinc-100 px-1.5 py-0.5 rounded-lg shadow-xs items-center justify-center flex-row">
                        <Text className="text-[11px] font-bold text-zinc-800">⭐ 4.9</Text>
                      </View>
                    </View>

                    {/* Right: Coach info */}
                    <View className="flex-1 gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[#101828] text-[18px] font-semibold tracking-tight">
                          {activeBooking?.trainerName || 'Karan Sharma'}
                        </Text>
                        <Feather name="chevron-right" size={14} color="#9CA3AF" />
                      </View>
                      <Text className="text-[#6B7280] text-[15px] font-normal leading-none">
                        {activeBooking?.trainerSpeciality || 'Strength & Conditioning Specialist'}
                      </Text>

                      {/* Stats row */}
                      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5 mt-1">
                        <View className="flex-row items-center gap-1">
                          <Feather name="clock" size={12} color="#FF8A00" />
                          <Text className="text-zinc-500 text-[11px] font-medium uppercase">
                            Arriving {activeBooking?.time.split(' - ')[0] || '10:30 AM'}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <Feather name="map-pin" size={12} color="#3B82F6" />
                          <Text className="text-zinc-500 text-[11px] font-medium uppercase">
                            {activeBooking?.trainerDistance || '2.3 km'}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <Feather name="shield" size={12} color="#16C784" />
                          <Text className="text-zinc-500 text-[11px] font-medium uppercase">
                            Elite Coach
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className="h-[1px] bg-zinc-100" />

                  {/* Track Coach Live CTA Button */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      if (activeBooking) {
                        router.push({ pathname: '/session-detail', params: { id: activeBooking.id } });
                      } else {
                        Alert.alert('No Active Session', 'Your coach tracking line will activate once a training session is confirmed and in-progress.');
                      }
                    }}
                    className="w-full py-4 bg-rose-50 rounded-2xl items-center justify-center flex-row gap-2"
                    style={{ minHeight: 48 }}
                  >
                    <Feather name="map-pin" size={14} color="#E11D48" />
                    <Text className="text-[#E11D48] text-[13px] font-bold uppercase tracking-wider">
                      Track Coach Live
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Today's Overview Section */}
              <View className="gap-4">
                <Text className="text-[#101828] text-[20px] font-semibold tracking-tight pl-1">Today's Overview</Text>

                <View className="flex-row flex-wrap justify-between gap-y-4">
                  {/* Calories Widget */}
                  <View className="w-[47%] h-[148px] p-5 rounded-[28px] bg-[#FFF5F5] border border-[#FFE4E6] justify-between">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base">🔥</Text>
                      <Text className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Calories</Text>
                    </View>
                    <View>
                      <Text className="text-[#101828] text-[32px] font-bold tracking-tighter">{caloriesToday}</Text>
                      <Text className="text-zinc-400 text-[13px] font-medium mt-0.5">/{caloriesGoal} kcal</Text>
                    </View>
                    {/* Progress Bar */}
                    <View className="w-full h-1.5 bg-[#FFE4E6] rounded-full overflow-hidden">
                      <View className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, (caloriesToday / caloriesGoal) * 100)}%` }} />
                    </View>
                  </View>

                  {/* Hydration Widget */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleLogWater}
                    className="w-[47%] h-[148px] p-5 rounded-[28px] bg-[#ECFEFF] border border-[#CFFAFE] justify-between"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base">💧</Text>
                        <Text className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Hydration</Text>
                      </View>
                      <Text className="text-[#06B6D4] text-[9px] font-bold uppercase tracking-widest">+250ml</Text>
                    </View>
                    <View>
                      <Text className="text-[#101828] text-[32px] font-bold tracking-tighter">{waterMl}</Text>
                      <Text className="text-zinc-400 text-[13px] font-medium mt-0.5">/{waterGoal} ml</Text>
                    </View>
                    {/* Progress Bar */}
                    <View className="w-full h-1.5 bg-[#CFFAFE] rounded-full overflow-hidden">
                      <View className="h-full bg-[#06B6D4] rounded-full" style={{ width: `${Math.min(100, (waterMl / waterGoal) * 100)}%` }} />
                    </View>
                  </TouchableOpacity>

                  {/* Wallet Credits Widget */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/membership' as any)}
                    className="w-[47%] h-[148px] p-5 rounded-[28px] bg-[#F5F3FF] border border-[#EDE9FE] justify-between"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base">💳</Text>
                      <Text className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Wallet Credits</Text>
                    </View>
                    <View>
                      <Text className="text-[#101828] text-[32px] font-bold tracking-tighter">{membership.availableCredits}</Text>
                      <Text className="text-zinc-400 text-[13px] font-medium mt-0.5">Credits Available</Text>
                    </View>
                    {/* Progress Bar */}
                    <View className="w-full h-1.5 bg-[#EDE9FE] rounded-full overflow-hidden">
                      <View className="h-full bg-violet-600 rounded-full" style={{ width: `${Math.min(100, (membership.availableCredits / Math.max(1, membership.totalCredits)) * 100)}%` }} />
                    </View>
                  </TouchableOpacity>

                  {/* Workout Streak Widget */}
                  <View className="w-[47%] h-[148px] p-5 rounded-[28px] bg-[#FFF1F2] border border-[#FFE4E6] justify-between">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base">⚡</Text>
                      <Text className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Workout Streak</Text>
                    </View>
                    <View>
                      <Text className="text-[#101828] text-[32px] font-bold tracking-tighter">{streak}</Text>
                      <Text className="text-zinc-400 text-[13px] font-medium mt-0.5">Active Days</Text>
                    </View>
                    {/* Progress Bar */}
                    <View className="w-full h-1.5 bg-[#FFE4E6] rounded-full overflow-hidden">
                      <View className="h-full bg-[#EC4899] rounded-full" style={{ width: `${Math.min(100, (streak / 7) * 100)}%` }} />
                    </View>
                  </View>
                </View>
              </View>

              {/* AI Wellness Coach Section */}
              <View className="gap-4">
                <Text className="text-[#101828] text-[20px] font-semibold tracking-tight pl-1">AI Wellness Coach</Text>
                <View 
                  className="w-full bg-[#1F1135] rounded-[32px] p-6 shadow-md relative overflow-hidden border border-zinc-800"
                  style={{
                    shadowColor: '#8B5CF6',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.1,
                    shadowRadius: 20,
                    elevation: 4,
                  }}
                >
                  {/* Glowing Abstract Radar Wave on the right */}
                  <View className="absolute right-[-20px] top-[-10px] bottom-[-10px] w-[50%] z-0 items-center justify-center">
                    <Svg width="140" height="140" viewBox="0 0 100 100">
                      <Defs>
                        <LinearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <Stop offset="0%" stopColor="#EC4899" stopOpacity={0.15} />
                          <Stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.4} />
                          <Stop offset="100%" stopColor="#EC4899" stopOpacity={0.05} />
                        </LinearGradient>
                      </Defs>
                      <Circle cx="50" cy="50" r="45" stroke="url(#waveGrad)" strokeWidth={0.5} fill="none" strokeDasharray="3 3" />
                      <Circle cx="50" cy="50" r="35" stroke="url(#waveGrad)" strokeWidth={1} fill="none" />
                      <Circle cx="50" cy="50" r="25" stroke="url(#waveGrad)" strokeWidth={1.5} fill="none" strokeDasharray="6 2" />
                      <Circle cx="50" cy="50" r="16" stroke="#EC4899" strokeWidth={2} fill="#8B5CF6" opacity={0.3} />
                      <Circle cx="50" cy="50" r="10" fill="#EC4899" opacity={0.7} />
                    </Svg>

                    {/* Sparkling Center Star */}
                    <View className="absolute z-10 w-9 h-9 rounded-full bg-white/10 items-center justify-center border border-white/20">
                      <Text className="text-white text-xs">✦</Text>
                    </View>
                  </View>

                  {/* Left content */}
                  <View className="z-10 gap-5 pr-20">
                    <View className="flex-row items-center gap-1.5 pl-0.5">
                      <Text className="text-[#EC4899] text-xs">✦</Text>
                      <Text className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">AI Wellness Coach</Text>
                    </View>
                    <View className="gap-1">
                      <Text className="text-white text-[15px] font-semibold tracking-tight leading-relaxed">
                        Your recovery is excellent today.
                      </Text>
                      <Text className="text-white/70 text-[13px] font-normal leading-relaxed">
                        A 60-min <Text className="text-[#FF7E7E] font-semibold">Strength Training</Text> session is recommended to maximize performance.
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => router.push('/virla-ai' as any)}
                      className="h-11 bg-[#E11D48] rounded-[18px] justify-between items-center px-5 flex-row self-start gap-3 shadow-md shadow-rose-900/10"
                      style={{ minHeight: 44 }}
                    >
                      <Text className="text-white text-[11px] font-bold uppercase tracking-wider">
                        View AI Plan
                      </Text>
                      <View className="w-5 h-5 rounded-full bg-white items-center justify-center">
                        <Feather name="chevron-right" size={12} color="#E11D48" />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Upcoming Session Section */}
              <View className="gap-4">
                <Text className="text-[#101828] text-[20px] font-semibold tracking-tight pl-1">Upcoming Session</Text>
                {upcomingBookings.length > 0 ? (() => {
                  const bookingData = upcomingBookings[0];
                  const isTravelling = bookingData.timelineStatus === 'trainer_travelling';

                  return (
                    <View className="bg-white border border-[#E5E7EB] p-6 rounded-[32px] shadow-sm gap-4">
                      {/* Top: Coach avatar, title, and badge */}
                      <View className="flex-row justify-between items-start">
                        <View className="flex-row items-center gap-3">
                          <Image 
                            source={{ uri: bookingData.trainerPhoto }} 
                            className="w-14 h-14 rounded-full border border-zinc-150" 
                          />
                          <View>
                            <Text className="text-zinc-950 text-[15px] font-semibold">{bookingData.workoutTitle}</Text>
                            <Text className="text-zinc-500 text-[13px] font-normal mt-0.5">with {bookingData.trainerName}</Text>
                          </View>
                        </View>
                        {/* Elite coach badge */}
                        <View className="bg-amber-50 border border-amber-100 px-3.5 py-1 rounded-full">
                          <Text className="text-amber-600 text-[9px] font-bold uppercase tracking-wider">★ ELITE COACH</Text>
                        </View>
                      </View>

                      <View className="h-[1px] bg-zinc-150" />

                      {/* Middle: Timeline path details */}
                      <View className="flex-row justify-between items-center px-1">
                        <View className="flex-row items-stretch gap-3 flex-1 pr-4">
                          {/* Dotted indicator line */}
                          <View className="items-center justify-between py-1">
                            <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <View className="w-[1px] flex-1 border-l border-zinc-300 border-dashed my-0.5" />
                            <View className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          </View>
                          {/* Text info */}
                          <View className="gap-3 flex-1">
                            <View>
                              <Text className="text-zinc-950 text-[13px] font-semibold">{bookingData.date}</Text>
                              <Text className="text-zinc-400 text-[11px] font-medium mt-0.5">{bookingData.time.split(' - ')[0]}</Text>
                            </View>
                            <View>
                              <Text className="text-zinc-950 text-[13px] font-semibold">Home</Text>
                              <Text className="text-zinc-400 text-[11px] font-medium mt-0.5">Mumbai, India</Text>
                            </View>
                          </View>
                        </View>

                        {/* Right: Status badge & Map action */}
                        <View className="items-end gap-4">
                          {/* Status pill */}
                          <View className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5">
                            <Feather name="truck" size={12} color="#16C784" />
                            <Text className="text-emerald-600 text-[9px] font-bold uppercase tracking-wider">
                              {isTravelling ? 'Coach on the way' : 'Assigned'}
                            </Text>
                          </View>

                          {/* Navigation Map Action */}
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => router.push({ pathname: '/session-detail', params: { id: bookingData.id } })}
                            className="w-11 h-11 rounded-full bg-[#16C784] items-center justify-center shadow-md shadow-emerald-700/10"
                            style={{ minWidth: 44, minHeight: 44 }}
                          >
                            <Feather name="navigation" size={16} color="white" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })() : (
                  <View className="bg-white border border-[#E5E7EB] p-8 rounded-[32px] shadow-sm items-center justify-center gap-3">
                    <Text className="text-3xl">🗓️</Text>
                    <Text className="text-[#101828] text-base font-semibold">No Upcoming Sessions Scheduled</Text>
                    <Text className="text-zinc-500 text-sm text-center">Schedule your next personal training session today.</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {role === 'trainer' && (
            <>
              {/* Trainer greeting & Ledger */}
              <View className="gap-4">
                <View>
                  <Text className="text-[#101828] text-2xl font-bold tracking-tight leading-tight">
                    Welcome back, Coach {user.name}
                  </Text>
                  <Text className="text-zinc-500 text-xs font-semibold leading-relaxed mt-1">
                    Pro Console • Availability and jobs tracking
                  </Text>
                </View>

                {/* Dashboard Analytics Card (Sprint 7.1) */}
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                  <Text className="text-zinc-950 text-xs font-semibold uppercase tracking-wider pl-1">Dashboard Analytics</Text>

                  <View className="flex-row flex-wrap justify-between gap-y-3.5">
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Current Rank</Text>
                      <Text className="text-zinc-900 text-xs font-semibold">
                        {totalCompleted >= 20 ? 'Elite Coach' : totalCompleted >= 5 ? 'Certified Coach' : 'Associate Coach'}
                      </Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Completed Sessions</Text>
                      <Text className="text-zinc-900 text-xs font-semibold">{totalCompleted} Sessions</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Average Rating</Text>
                      <Text className="text-zinc-900 text-xs font-semibold">⭐ {user.id ? (Database.schema.coaches.find(c => c.name === user.name)?.rating ?? 5.0) : 5.0} / 5.0</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Attendance Rate</Text>
                      <Text className="text-zinc-900 text-xs font-semibold">98%</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Completion Rate</Text>
                      <Text className="text-[#E11D48] text-xs font-semibold">
                        {totalCompleted > 0 ? `${Math.round((totalCompleted / (totalCompleted + cancelledJobs.length)) * 100)}%` : '100%'}
                      </Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Upcoming Sessions</Text>
                      <Text className="text-indigo-600 text-xs font-semibold">{totalUpcoming} Pending</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Promotion Progress</Text>
                      <Text className="text-amber-600 text-xs font-semibold">
                        {totalCompleted >= 20 
                          ? 'Max Level' 
                          : totalCompleted >= 5 
                            ? `${Math.min(100, Math.round((totalCompleted / 20) * 100))}% (to Elite)` 
                            : `${Math.min(100, Math.round((totalCompleted / 5) * 100))}% (to Certified)`}
                      </Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Monthly Earnings</Text>
                      <Text className="text-emerald-600 text-xs font-semibold">₹{monthlyEarnings.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>

                {/* Today's Sessions List (Sprint 7.1) */}
                <View className="gap-3">
                  <Text className="text-[#101828] text-xs font-semibold uppercase tracking-widest pl-1">Today's Visits</Text>
                  {bookings.filter(b => b.date.includes('Today') || b.date.includes(new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }))).length > 0 ? (
                    bookings.filter(b => b.date.includes('Today') || b.date.includes(new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }))).map((booking) => (
                      <View key={booking.id} className="bg-white border border-[#E5E7EB] p-4 rounded-2xl flex-row justify-between items-center shadow-xs">
                        <View className="flex-row items-center gap-3">
                          <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center">
                            <Feather name="clock" size={14} color="#4F46E5" />
                          </View>
                          <View>
                            <Text className="text-zinc-900 text-xs font-semibold">{booking.workoutTitle} - {booking.address ? booking.address.split(',')[0] : 'Venue'}</Text>
                            <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{booking.date} • {booking.time}</Text>
                          </View>
                        </View>
                        <View className={`px-2 py-0.5 rounded-full ${booking.status === 'completed' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                          <Text className={`text-[7px] font-bold uppercase ${booking.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>{booking.status}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View className="bg-white border border-[#E5E7EB] p-6 rounded-2xl items-center justify-center">
                      <Text className="text-zinc-400 text-[9px] font-bold uppercase">No visits scheduled for today.</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Trainer Console Visits Hub (Feature 5) */}
              <View className="gap-5">

                {/* 1. Current Visit Control Center */}
                <View className="gap-3">
                  <Text className="text-[#101828] text-xs font-semibold uppercase tracking-widest pl-1">Current Visit Console</Text>
                  {bookings.filter(b => b.status === 'upcoming').length > 0 ? (() => {
                    const job = bookings.filter(b => b.status === 'upcoming')[0];
                    const timeline = job.timelineStatus || 'booked';

                    return (
                      <View className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-800 shadow-xl gap-4">
                        <View className="flex-row justify-between items-start">
                          <View className="gap-1 flex-1 pr-3">
                            <Text className="text-zinc-500 text-[8px] font-semibold uppercase">Active Workout ID: {job.id}</Text>
                            <Text className="text-white text-base font-semibold mt-1 leading-tight">{job.workoutTitle}</Text>
                            <Text className="text-zinc-400 text-[10px] font-medium mt-1">👤 Customer: Viral • 📍 Worli, Mumbai</Text>
                            <Text className="text-zinc-500 text-[9px] font-medium mt-0.5">⏱ Today • {job.time}</Text>
                          </View>
                          <View className="bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-0.5 rounded-full">
                            <Text className="text-indigo-400 text-[7px] font-bold uppercase tracking-wider">{timeline.replace(/_/g, ' ')}</Text>
                          </View>
                        </View>

                        {/* Communication Action Keys */}
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            onPress={() => Alert.alert('GPS Routing Simulated', 'Opening navigation routing to Worli, Mumbai...')}
                            className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                          >
                            <Feather name="navigation" size={10} color="white" />
                            <Text className="text-white text-[7px] font-bold uppercase">Navigate</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => Alert.alert('Secure Call', 'Connecting call to customer Viral (+91 99999 88888)...')}
                            className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                          >
                            <Feather name="phone" size={10} color="white" />
                            <Text className="text-white text-[7px] font-bold uppercase">Call Client</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => router.push({ pathname: '/communication' as any, params: { id: job.id } })}
                            className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                          >
                            <Feather name="message-square" size={10} color="white" />
                            <Text className="text-white text-[7px] font-bold uppercase">Message</Text>
                          </TouchableOpacity>
                        </View>

                        <View className="h-[1px] bg-zinc-800" />

                        {/* Interactive state transition controls */}
                        {timeline === 'booked' || timeline === 'trainer_assigned' ? (
                          <TouchableOpacity
                            onPress={() => handleTrainerJobClick(job.id, timeline)}
                            className="w-full bg-[#4F46E5] py-3.5 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-bold uppercase tracking-wider">Accept Booking Visit</Text>
                          </TouchableOpacity>
                        ) : timeline === 'trainer_accepted' ? (
                          <TouchableOpacity
                            onPress={() => {
                              updateTimelineStatus(job.id, 'trainer_travelling');
                              useNotificationStore.getState().addNotification({
                                title: 'Coach On The Way 🚗',
                                body: `Coach ${job.trainerName} started travelling to your venue.`,
                                icon: 'user-check'
                              });
                              Alert.alert('Travel Started', 'Clients have been notified you are on the way.');
                            }}
                            className="w-full bg-indigo-600 py-3.5 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-bold uppercase tracking-wider">Start Travel</Text>
                          </TouchableOpacity>
                        ) : timeline === 'trainer_travelling' ? (
                          <TouchableOpacity
                            onPress={() => {
                              updateTimelineStatus(job.id, 'trainer_arrived');
                              useNotificationStore.getState().addNotification({
                                title: 'Coach Arrived 🔔',
                                body: `Coach ${job.trainerName} has arrived at your location.`,
                                icon: 'lock'
                              });
                              Alert.alert('Arrived at Venue', 'Clients have been notified of your arrival. Awaiting check-in OTP.');
                            }}
                            className="w-full bg-emerald-600 py-3.5 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-bold uppercase tracking-wider">Reached Location</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => router.push({ pathname: '/session-detail' as any, params: { id: job.id } })}
                            className="w-full bg-zinc-800 py-3.5 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-bold uppercase tracking-wider">
                              {timeline === 'trainer_arrived' ? 'Waiting client OTP check-in' : 'Open active console'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })() : (
                    <View className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center justify-center py-8 shadow-xs">
                      <Feather name="coffee" size={20} color="#9CA3AF" />
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase mt-2">No active current visits</Text>
                    </View>
                  )}
                </View>

                {/* 2. Next Visit Previews */}
                <View className="gap-3">
                  <Text className="text-[#101828] text-xs font-semibold uppercase tracking-widest pl-1">Next Visit</Text>
                  {bookings.filter(b => b.status === 'upcoming').length > 1 ? (() => {
                    const nextJob = bookings.filter(b => b.status === 'upcoming')[1];
                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => router.push({ pathname: '/session-detail' as any, params: { id: nextJob.id } })}
                        className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs flex-row justify-between items-center"
                      >
                        <View className="flex-1 pr-3 gap-0.5">
                          <Text className="text-zinc-900 text-xs font-semibold">{nextJob.workoutTitle}</Text>
                          <Text className="text-zinc-400 text-[8px] font-bold uppercase">Client: Viral • {nextJob.date} @ {nextJob.time}</Text>
                        </View>
                        <Feather name="chevron-right" size={14} color="#6B7280" />
                      </TouchableOpacity>
                    );
                  })() : (
                    <View className="bg-white border border-[#E5E7EB] p-6 rounded-[24px] items-center justify-center shadow-xs">
                      <Text className="text-zinc-400 text-[9px] font-bold uppercase">No upcoming next visits booked</Text>
                    </View>
                  )}
                </View>

              </View>

              {/* Navigate to Availability Planner (Sprint 7) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/trainer-availability' as any)}
                className="bg-indigo-50 border border-indigo-150 p-5 rounded-[28px] shadow-xs flex-row justify-between items-center"
              >
                <View className="flex-row items-center gap-3">
                  <Feather name="calendar" size={16} color="#4F46E5" />
                  <View>
                    <Text className="text-indigo-950 text-xs font-bold uppercase tracking-wider">Weekly Schedule Planner</Text>
                    <Text className="text-[#4F46E5] text-[9px] font-semibold mt-0.5">Submit slots & manage compliance edits</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={14} color="#4F46E5" />
              </TouchableOpacity>

              {/* Pro Trainer Schedule Slot restoration rules (Feature 10 availability) */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
                <Text className="text-[#101828] text-xs font-bold uppercase tracking-wider border-b border-zinc-100 pb-3">Restored Availability log</Text>
                <Text className="text-zinc-500 text-[10px] font-medium leading-relaxed">
                  Upon completion of any mandatory post-session client report, your corresponding slot block will automatically restore and reactivate for new bookings.
                </Text>

                <View className="flex-row flex-wrap gap-2.5 mt-1">
                  {['07:00 AM', '08:00 AM', '09:00 AM', '05:00 PM', '07:00 PM'].map((s, idx) => (
                    <View key={idx} className="bg-zinc-50 border border-zinc-100 px-3.5 py-2 rounded-xl flex-row items-center gap-1.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <Text className="text-zinc-800 text-[9px] font-bold">{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

        </Animated.View>
      </ScrollView>
      )}
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return <View className="flex-1 bg-[#FCF5F5] pt-12">{children}</View>;
  }
  return <View className="flex-1 bg-[#FCF5F5]">{children}</View>;
}
