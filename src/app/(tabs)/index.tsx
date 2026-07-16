import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, Animated, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useBookingStore } from '../../store/bookingStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useUserStore } from '../../store/userStore';
import { useCoachStore } from '../../store/coachStore';
import { ProgressRing } from '../../components/ProgressRing';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';

export default function HomeScreen() {
  const router = useRouter();
  const { bookings, acceptBooking, updateTimelineStatus } = useBookingStore();
  const { membership } = useMembershipStore();
  const { unreadCount } = useNotificationStore();
  const { user, role } = useUserStore();
  const { totalEarnings, earningsList } = useCoachStore();

  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');
  const pastBookings = bookings.filter((b) => b.status === 'completed');
  const activeBooking = bookings.find(b => b.status === 'upcoming' && b.timelineStatus && b.timelineStatus !== 'session_closed' && b.timelineStatus !== 'booked');

  // Hydration state
  const [waterMl, setWaterMl] = useState(750);
  const waterGoal = 2500;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // AI recommendations array
  const recommendations = [
    { title: 'Stretch Today', desc: 'Recovery Day: Release lower back tension with a reset session.' },
    { title: 'Increase Intensity', desc: 'Optimal Recovery (84%): Great day for a high-intensity Forge Strength.' },
    { title: 'Try Combat Core', desc: 'Build Cardio: Book a boxing conditioning slot for tomorrow.' },
    { title: 'Book Next Session', desc: 'Keep the Streak: Schedule your mobility visit now.' }
  ];
  const [recIdx, setRecIdx] = useState(0);

  useEffect(() => {
    // Rotation of coach recommendations
    const interval = setInterval(() => {
      setRecIdx((prev) => (prev + 1) % recommendations.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fade up animations
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

    // Pulse animation for AI card
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, [role]);

  const getGreetingText = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return { title: 'Good Morning, Viral ☀️', subtitle: 'Ready to build another strong day?' };
    } else if (hour < 17) {
      return { title: 'Good Afternoon, Viral 🌤️', subtitle: 'Keep your momentum active today!' };
    } else {
      return { title: 'Good Evening, Viral 🌙', subtitle: 'How did your workout feel today?' };
    }
  };

  const greeting = getGreetingText();

  // Personal Fitness Score Calculation
  const consistency = 92;
  const frequency = 85;
  const recoveryVal = 84;
  const mobility = 78;
  const strength = 88;
  const attendance = 96;
  const fitnessScore = Math.round((consistency + frequency + recoveryVal + mobility + strength + attendance) / 6);

  const handleLogWater = () => {
    setWaterMl(prev => Math.min(prev + 250, waterGoal));
    Alert.alert('Hydration Logged', '+250ml added! Stay hydrated to maximize recovery index.');
  };

  const handleSupport = () => {
    Alert.alert('VIRLA VIP Concierge', 'Connecting to VIP wellness support line (+91 99999 88888)...');
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
      <View className="h-16 flex-row items-center justify-between px-6 border-b border-[#E5E7EB] bg-white">
        <View className="flex-row items-center gap-2">
          <View className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
          <Text className="text-[#111827] text-lg font-black uppercase tracking-widest">
            {role === 'trainer' ? 'VIRLA Pro' : 'VIRLA'}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/notifications' as any)}
            className="w-10 h-10 rounded-full border border-[#E5E7EB] bg-white items-center justify-center relative"
          >
            <Feather name="bell" size={16} color="#111827" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 justify-center items-center">
                <Text className="text-white text-[8px] font-black">{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/profile' as any)}
            className="w-10 h-10 rounded-full border border-[#E5E7EB] overflow-hidden"
          >
            <Image source={{ uri: user.avatar }} className="w-full h-full" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        className="bg-[#F8F9FB] flex-1"
      >
        <Animated.View 
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          className="px-6 pt-6 gap-6"
        >
          
          {/* ==================== CLIENT MODE DASHBOARD ==================== */}
          {role === 'customer' && (
            <>
              {/* Dynamic Greeting */}
              <View>
                <Text className="text-[#111827] text-2xl font-black tracking-tight leading-tight">
                  {greeting.title}
                </Text>
                <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1">
                  {greeting.subtitle}
                </Text>
              </View>

              {/* Quick Resume Active Session Card (Feature 10) */}
              {activeBooking && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push({ pathname: '/session-detail' as any, params: { id: activeBooking.id } })}
                  className="bg-indigo-600 p-5 rounded-[28px] shadow-lg flex-row justify-between items-center"
                >
                  <View className="flex-1 pr-3 gap-1">
                    <Text className="text-white text-[8px] font-black uppercase tracking-wider">Live Active Workout</Text>
                    <Text className="text-white text-sm font-black mt-0.5">Resume: {activeBooking.workoutTitle}</Text>
                    <Text className="text-indigo-200 text-[10px] font-bold">Status: {activeBooking.timelineStatus?.replace(/_/g, ' ')}</Text>
                  </View>
                  <Feather name="arrow-right-circle" size={24} color="white" />
                </TouchableOpacity>
              )}

              {/* AI Fitness Coach Recommendation Card (Feature 2) */}
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => router.push({ pathname: '/booking', params: { workoutId: recommendations[recIdx].title } })}
                  className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-800 shadow-xl overflow-hidden relative"
                >
                  <View className="absolute right-0 bottom-0 top-0 left-0 bg-indigo-500/5" />
                  <View className="flex-row justify-between items-center mb-3">
                    <View className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                      <Feather name="cpu" size={10} color="#F59E0B" />
                      <Text className="text-amber-500 text-[8px] font-black uppercase tracking-wider">Coach Prescription</Text>
                    </View>
                    <Feather name="arrow-up-right" size={14} color="#A1A1AA" />
                  </View>
                  <Text className="text-white text-base font-black tracking-tight">
                    {recommendations[recIdx].title}
                  </Text>
                  <Text className="text-zinc-400 text-[10px] font-bold mt-1.5 leading-relaxed">
                    {recommendations[recIdx].desc}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Personal Fitness Score Circular Ring (Feature 3) */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[30px] shadow-sm gap-4">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider pl-1">VIRLA Fitness Index</Text>
                <View className="flex-row items-center gap-6 justify-center py-2">
                  <ProgressRing progress={fitnessScore / 100} size={90} strokeWidth={8} activeColor="#4F46E5">
                    <View className="items-center justify-center">
                      <Text className="text-[#111827] text-xl font-black">{fitnessScore}</Text>
                      <Text className="text-zinc-400 text-[7px] font-black uppercase">Score</Text>
                    </View>
                  </ProgressRing>
                  <View className="flex-1 gap-2">
                    <View className="flex-row justify-between items-center border-b border-zinc-50 pb-1.5">
                      <Text className="text-zinc-500 text-[9px] font-bold">Consistency</Text>
                      <Text className="text-zinc-900 text-[10px] font-black">{consistency}%</Text>
                    </View>
                    <View className="flex-row justify-between items-center border-b border-zinc-50 pb-1.5">
                      <Text className="text-zinc-500 text-[9px] font-bold">Recovery Index</Text>
                      <Text className="text-zinc-900 text-[10px] font-black">{recoveryVal}%</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-zinc-500 text-[9px] font-bold">Attendance Rate</Text>
                      <Text className="text-zinc-900 text-[10px] font-black">{attendance}%</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Today's Activity / Stats Redesigned widgets (Feature 1) */}
              <View className="flex-row flex-wrap justify-between gap-y-4">
                
                {/* Calories Burned Widget */}
                <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-3">
                  <View className="w-8 h-8 rounded-xl bg-orange-50 items-center justify-center">
                    <Feather name="activity" size={14} color="#F97316" />
                  </View>
                  <View>
                    <Text className="text-zinc-900 text-base font-black">380 / 600</Text>
                    <Text className="text-zinc-500 text-[8px] font-bold uppercase mt-0.5">Calories Burned</Text>
                  </View>
                </View>

                {/* Workout Streak Widget */}
                <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-3">
                  <View className="w-8 h-8 rounded-xl bg-red-50 items-center justify-center">
                    <Feather name="zap" size={14} color="#EF4444" />
                  </View>
                  <View>
                    <Text className="text-zinc-900 text-base font-black">5 Days</Text>
                    <Text className="text-zinc-500 text-[8px] font-bold uppercase mt-0.5">Workout Streak</Text>
                  </View>
                </View>

                {/* Recovery Status Widget */}
                <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-3">
                  <View className="w-8 h-8 rounded-xl bg-emerald-50 items-center justify-center">
                    <Feather name="heart" size={14} color="#10B981" />
                  </View>
                  <View>
                    <Text className="text-zinc-900 text-base font-black">84% Optimal</Text>
                    <Text className="text-zinc-500 text-[8px] font-bold uppercase mt-0.5">Recovery status</Text>
                  </View>
                </View>

                {/* Credits Remaining Widget */}
                <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-3">
                  <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center">
                    <Feather name="credit-card" size={14} color="#4F46E5" />
                  </View>
                  <View>
                    <Text className="text-zinc-900 text-base font-black">
                      {membership.availableCredits} Credits
                    </Text>
                    <Text className="text-zinc-500 text-[8px] font-bold uppercase mt-0.5">Wallet Credits</Text>
                  </View>
                </View>

                {/* Hydration Reminder Tracker Widget (Feature 1) */}
                <View className="w-full bg-white border border-[#E5E7EB] p-5 rounded-[24px] shadow-xs flex-row justify-between items-center">
                  <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                    <View className="w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center">
                      <Feather name="droplet" size={18} color="#3B82F6" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[#111827] text-sm font-black">
                        {waterMl} / {waterGoal} ml
                      </Text>
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase mt-0.5">Hydration Goal: 2.5L</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleLogWater}
                    className="bg-blue-600 px-4 py-2.5 rounded-xl shadow-xs"
                  >
                    <Text className="text-white text-[9px] font-black uppercase">+250 ml</Text>
                  </TouchableOpacity>
                </View>

              </View>

              {/* Upcoming Session Details widget */}
              <View className="gap-3">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">Your Schedule</Text>
                {upcomingBookings.length > 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => router.push({ pathname: '/session-detail', params: { id: upcomingBookings[0].id } })}
                    className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4"
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center gap-2">
                        <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <Text className="text-zinc-900 text-xs font-black">{upcomingBookings[0].workoutTitle}</Text>
                      </View>
                      <Feather name="chevron-right" size={14} color="#9CA3AF" />
                    </View>
                    <View className="flex-row justify-between items-center px-1">
                      <View className="gap-0.5">
                        <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Assigned Coach</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">{upcomingBookings[0].trainerName}</Text>
                      </View>
                      <View className="gap-0.5 items-end">
                        <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Scheduled Time</Text>
                        <Text className="text-indigo-600 text-xs font-black">{upcomingBookings[0].date} • {upcomingBookings[0].time.split(' - ')[0]}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/booking')}
                    className="bg-white border border-dashed border-zinc-300 p-6 rounded-[28px] items-center justify-center py-8"
                  >
                    <Feather name="calendar" size={20} color="#9CA3AF" className="mb-2" />
                    <Text className="text-zinc-500 text-xs font-black uppercase tracking-wider">Schedule a Home Session</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* AI Coach Tip widget */}
              <View className="bg-indigo-50 border border-indigo-100 p-5 rounded-[28px] shadow-xs flex-row gap-3">
                <Text className="text-xl">💡</Text>
                <View className="flex-1">
                  <Text className="text-indigo-950 text-xs font-black uppercase tracking-wider">AI Physiology Tip</Text>
                  <Text className="text-indigo-900 text-[10px] font-semibold leading-relaxed mt-1">
                    Rest is a weapon. Target 8 hours of sleep tonight to optimize protein muscle synthesis and recover fully.
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* ==================== TRAINER MODE DASHBOARD ==================== */}
          {role === 'trainer' && (
            <>
              {/* Trainer greeting & Ledger */}
              <View className="gap-4">
                <View>
                  <Text className="text-[#111827] text-2xl font-black tracking-tight leading-tight">
                    Welcome back, Coach Karan Sharma
                  </Text>
                  <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1">
                    Pro Console • Availability and jobs tracking
                  </Text>
                </View>

                {/* Dashboard Analytics Card (Sprint 7.1) */}
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                  <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">Dashboard Analytics</Text>
                  
                  <View className="flex-row flex-wrap justify-between gap-y-3.5">
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Current Rank</Text>
                      <Text className="text-zinc-900 text-xs font-black">Associate Trainer</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Completed Sessions</Text>
                      <Text className="text-zinc-900 text-xs font-black">420 Sessions</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Average Rating</Text>
                      <Text className="text-zinc-900 text-xs font-black">⭐ 4.91 / 5.0</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Attendance Rate</Text>
                      <Text className="text-zinc-900 text-xs font-black">98%</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Punctuality Rate</Text>
                      <Text className="text-zinc-900 text-xs font-black">99%</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Retainer Status</Text>
                      <Text className="text-red-500 text-xs font-black">Not Eligible</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Promotion Progress</Text>
                      <Text className="text-amber-600 text-xs font-black">On Hold (84%)</Text>
                    </View>
                    <View className="w-[47%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-bold uppercase">Weekly Earnings</Text>
                      <Text className="text-emerald-600 text-xs font-black">₹6,400</Text>
                    </View>
                  </View>
                </View>

                {/* Today's Sessions List (Sprint 7.1) */}
                <View className="gap-3">
                  <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">Today's Visits</Text>
                  <View className="bg-white border border-[#E5E7EB] p-4 rounded-2xl flex-row justify-between items-center shadow-xs">
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center">
                        <Feather name="clock" size={14} color="#4F46E5" />
                      </View>
                      <View>
                        <Text className="text-zinc-900 text-xs font-black">Forge Strength - Juhu</Text>
                        <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Today • 08:00 AM</Text>
                      </View>
                    </View>
                    <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Text className="text-emerald-600 text-[7px] font-black uppercase">Completed</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Trainer Console Visits Hub (Feature 5) */}
              <View className="gap-5">
                
                {/* 1. Current Visit Control Center */}
                <View className="gap-3">
                  <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">Current Visit Console</Text>
                  {bookings.filter(b => b.status === 'upcoming').length > 0 ? (() => {
                    const job = bookings.filter(b => b.status === 'upcoming')[0];
                    const timeline = job.timelineStatus || 'booked';
                    
                    return (
                      <View className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-800 shadow-xl gap-4">
                        <View className="flex-row justify-between items-start">
                          <View className="gap-1 flex-1 pr-3">
                            <Text className="text-zinc-500 text-[8px] font-black uppercase">Active Workout ID: {job.id}</Text>
                            <Text className="text-white text-base font-black mt-1 leading-tight">{job.workoutTitle}</Text>
                            <Text className="text-zinc-400 text-[10px] font-semibold mt-1">👤 Customer: Viral • 📍 Worli, Mumbai</Text>
                            <Text className="text-zinc-500 text-[9px] font-semibold mt-0.5">⏱ Today • {job.time}</Text>
                          </View>
                          <View className="bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-0.5 rounded-full">
                            <Text className="text-indigo-400 text-[7px] font-black uppercase tracking-wider">{timeline.replace(/_/g, ' ')}</Text>
                          </View>
                        </View>

                        {/* Communication Action Keys */}
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            onPress={() => Alert.alert('GPS Routing Simulated', 'Opening navigation routing to Worli, Mumbai...')}
                            className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                          >
                            <Feather name="navigation" size={10} color="white" />
                            <Text className="text-white text-[7px] font-black uppercase">Navigate</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => Alert.alert('Secure Call', 'Connecting call to customer Viral (+91 99999 88888)...')}
                            className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                          >
                            <Feather name="phone" size={10} color="white" />
                            <Text className="text-white text-[7px] font-black uppercase">Call Client</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => router.push({ pathname: '/communication' as any, params: { id: job.id } })}
                            className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                          >
                            <Feather name="message-square" size={10} color="white" />
                            <Text className="text-white text-[7px] font-black uppercase">Message</Text>
                          </TouchableOpacity>
                        </View>

                        <View className="h-[1px] bg-zinc-800" />

                        {/* Interactive state transition controls */}
                        {timeline === 'booked' || timeline === 'trainer_assigned' ? (
                          <TouchableOpacity
                            onPress={() => handleTrainerJobClick(job.id, timeline)}
                            className="w-full bg-[#4F46E5] py-3.5 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-black uppercase tracking-wider">Accept Booking Visit</Text>
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
                            <Text className="text-white text-xs font-black uppercase tracking-wider">Start Travel</Text>
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
                            <Text className="text-white text-xs font-black uppercase tracking-wider">Reached Location</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => router.push({ pathname: '/session-detail' as any, params: { id: job.id } })}
                            className="w-full bg-zinc-800 py-3.5 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-black uppercase tracking-wider">
                              {timeline === 'trainer_arrived' ? 'Waiting client OTP check-in' : 'Open active console'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })() : (
                    <View className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center justify-center py-8 shadow-xs">
                      <Feather name="coffee" size={20} color="#9CA3AF" />
                      <Text className="text-zinc-500 text-[10px] font-black uppercase mt-2">No active current visits</Text>
                    </View>
                  )}
                </View>

                {/* 2. Next Visit Previews */}
                <View className="gap-3">
                  <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">Next Visit</Text>
                  {bookings.filter(b => b.status === 'upcoming').length > 1 ? (() => {
                    const nextJob = bookings.filter(b => b.status === 'upcoming')[1];
                    return (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => router.push({ pathname: '/session-detail' as any, params: { id: nextJob.id } })}
                        className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs flex-row justify-between items-center"
                      >
                        <View className="flex-1 pr-3 gap-0.5">
                          <Text className="text-zinc-900 text-xs font-black">{nextJob.workoutTitle}</Text>
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
                    <Text className="text-indigo-950 text-xs font-black uppercase tracking-wider">Weekly Schedule Planner</Text>
                    <Text className="text-[#4F46E5] text-[9px] font-semibold mt-0.5">Submit slots & manage compliance edits</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={14} color="#4F46E5" />
              </TouchableOpacity>

              {/* Pro Trainer Schedule Slot restoration rules (Feature 10 availability) */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider border-b border-zinc-100 pb-3">Restored Availability log</Text>
                <Text className="text-[#6B7280] text-[10px] font-semibold leading-relaxed">
                  Upon completion of any mandatory post-session client report, your corresponding slot block will automatically restore and reactivate for new bookings.
                </Text>
                
                <View className="flex-row flex-wrap gap-2.5 mt-1">
                  {['07:00 AM', '08:00 AM', '09:00 AM', '05:00 PM', '07:00 PM'].map((s, idx) => (
                    <View key={idx} className="bg-zinc-50 border border-zinc-100 px-3.5 py-2 rounded-xl flex-row items-center gap-1.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <Text className="text-zinc-800 text-[9px] font-black">{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

        </Animated.View>
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
