/* eslint-disable react-hooks/set-state-in-effect */
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Platform, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { ProgressRing } from '../../components/ProgressRing';
import { LuxuryCard } from '../../components/LuxuryCard';
import { useBookingStore } from '../../store/bookingStore';
import { useCoachStore } from '../../store/coachStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useUserStore } from '../../store/userStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useWorkoutStore } from '../../store/workoutStore';
import { useWalletStore } from '../../store/walletStore';
import { Database } from '../../database/Database';
import { supabase } from '../../database/supabaseClient';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useAIWellnessStore } from '../../store/aiWellnessStore';
import { Booking } from '../../types';

interface RequestCardProps {
  booking: Booking;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onTimeout: (id: string) => void;
  onPress: (id: string) => void;
}

export function RequestCard({ booking, onAccept, onDecline, onTimeout, onPress }: RequestCardProps) {
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const elapsed = Math.floor((Date.now() - (booking.createdAt || Date.now())) / 1000);
      return Math.max(0, 60 - elapsed);
    };

    const initialTimeLeft = calculateTimeLeft();
    setTimeLeft(initialTimeLeft);

    if (initialTimeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          const nextTime = calculateTimeLeft();
          if (nextTime <= 0) {
            clearInterval(timer);
            onTimeout(booking.id);
            return 0;
          }
          return nextTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [booking.id, booking.createdAt]);

  const customerId = `VIRLA-C${booking.id.slice(-6).toUpperCase()}`;
  const customerGender = booking.id.charCodeAt(booking.id.length - 1) % 2 === 0 ? 'Female' : 'Male';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(booking.id)}
      className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4 mb-4"
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-rose-500" />
          <Text className="text-[#101828] text-xs font-black tracking-wider">{customerId}</Text>
        </View>
        
        <View className="bg-rose-50 border border-rose-100 px-3 py-1 rounded-full flex-row items-center gap-1.5">
          <Feather name="clock" size={10} color="#E11D48" />
          <Text className="text-[#E11D48] text-[10px] font-black">{timeLeft}s left</Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-[#101828] text-base font-black tracking-tight">{booking.workoutTitle}</Text>
        <Text className="text-zinc-500 text-xs font-semibold leading-relaxed">
          {booking.date} • {booking.time} ({booking.durationMinutes || 60} mins)
        </Text>
        
        <View className="flex-row gap-2 mt-1 flex-wrap">
          <View className="bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg">
            <Text className="text-zinc-650 text-[9px] font-bold uppercase">{customerGender}</Text>
          </View>
          <View className="bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg">
            <Text className="text-zinc-650 text-[9px] font-bold uppercase">Solo Session</Text>
          </View>
          <View className="bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg">
            <Text className="text-zinc-650 text-[9px] font-bold uppercase">{booking.address ? booking.address.split(',')[0] : 'Venue'}</Text>
          </View>
        </View>
      </View>

      <View className="h-[1px] bg-zinc-100 my-1" />

      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onDecline(booking.id);
          }}
          className="flex-1 bg-zinc-50 border border-[#E5E7EB] py-3 rounded-2xl items-center justify-center"
        >
          <Text className="text-zinc-650 text-xs font-black uppercase">Decline</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onAccept(booking.id);
          }}
          className="flex-1 bg-[#E11D48] py-3 rounded-2xl items-center justify-center"
        >
          <Text className="text-white text-xs font-black uppercase">Accept</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { bookings, acceptBooking, updateTimelineStatus, reassignTrainer } = useBookingStore();
  const { membership } = useMembershipStore();
  const { unreadCount } = useNotificationStore();
  const { user, role } = useUserStore();
  const { totalEarnings, earningsList, coaches } = useCoachStore();
  const { savedPlan } = useAIWellnessStore();

  const handleHiddenAdminAccess = async () => {
    const userId = Database.getCurrentUserId();
    if (!userId) {
      Alert.alert('Access Denied', 'Please log in first.');
      return;
    }
    try {
      const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
      if (data && data.role === 'admin') {
        router.push('/admin-panel' as any);
      } else {
        Alert.alert('Access Denied', 'You do not have administrative authorization.');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Unable to verify administrative authorization.');
    }
  };

  const [trainerOnlineStatus, setTrainerOnlineStatus] = useState<'online' | 'offline'>('online');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await useBookingStore.getState().refreshBookings();
    } catch (e) {
      console.error('Manual sync failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAcceptRequest = (id: string) => {
    Alert.alert(
      'Accept Booking?',
      'By accepting this booking you agree to complete the session. Once accepted it cannot be cancelled except through VIRLA Support.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => {
            acceptBooking(id);
            Alert.alert('Booking Accepted', 'You have accepted the session request.');
          }
        }
      ]
    );
  };

  const handleDeclineRequest = (id: string) => {
    reassignTrainer(id, 'declined');
    Alert.alert('Request Declined', 'The request has been reassigned to another available trainer.');
  };

  const handleTimeoutRequest = (id: string) => {
    reassignTrainer(id, 'timeout');
  };

  const currentCoach = coaches.find(c => c.name === user.name);

  React.useEffect(() => {
    if (currentCoach) {
      setTrainerOnlineStatus(currentCoach.preferences?.online ? 'online' : 'offline');
    }
  }, [currentCoach]);

  const toggleOnlineStatus = () => {
    if (!currentCoach) return;
    const nextOnline = !(currentCoach.preferences?.online);
    const nextStatus = nextOnline ? 'online' : 'offline';
    setTrainerOnlineStatus(nextStatus);

    Database.updateTrainerOnlineStatus(currentCoach.id, nextOnline);
    useCoachStore.getState().syncFromDB();

    // Immediately revoke pending requests assigned to this coach when going offline
    if (!nextOnline) {
      const pendingRequests = bookings.filter(b => 
        b.trainerName === currentCoach.name && 
        b.timelineStatus === 'booked'
      );
      for (const req of pendingRequests) {
        reassignTrainer(req.id, 'timeout');
      }
    }
  };

  const getMinutesToSession = (job: Booking): number => {
    if (!job) return 0;
    try {
      let datePart = job.date;
      if (datePart.startsWith('Today, ')) {
        datePart = datePart.replace('Today, ', '');
      } else if (datePart.startsWith('Tomorrow, ')) {
        datePart = datePart.replace('Tomorrow, ', '');
      }
      
      let cleanDateStr = datePart;
      const dayMonthMatch = datePart.match(/^[A-Za-z]+ (\d+)/);
      if (dayMonthMatch) {
        const year = new Date().getFullYear();
        cleanDateStr = `${datePart}, ${year}`;
      }
      
      const sessionDate = new Date(cleanDateStr);
      if (isNaN(sessionDate.getTime())) return 0;
      
      const timePart = job.time;
      const timeMatch = timePart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        sessionDate.setHours(hours, minutes, 0, 0);
      }
      
      const now = new Date();
      return (sessionDate.getTime() - now.getTime()) / (1000 * 60);
    } catch (e) {
      return 0;
    }
  };

  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress] = useState(() => new Animated.Value(0));
  const holdTimeoutRef = useRef<any>(null);

  const handlePressIn = () => {
    setIsHolding(true);
    holdProgress.setValue(0);
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start();

    holdTimeoutRef.current = setTimeout(async () => {
      setIsHolding(false);
      holdProgress.setValue(0);
      await handleHiddenAdminAccess();
    }, 5000);
  };

  const handlePressOut = () => {
    setIsHolding(false);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    holdProgress.stopAnimation();
    holdProgress.setValue(0);
  };

  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncData = async () => {
      try {
        await Database.load();
        useUserStore.getState().syncFromDB();
        useUserProfileStore.getState().syncFromDB();
        useBookingStore.getState().syncFromDB();
        useCoachStore.getState().syncFromDB();
        useWorkoutStore.getState().syncFromDB();
        useWalletStore.getState().syncFromDB();
        useMembershipStore.getState().syncFromDB();
        useNotificationStore.getState().syncFromDB();
      } catch (e) {
        console.error('Home sync failed:', e);
      } finally {
        setLoading(false);
      }
    };
    syncData();
  }, [bookings.length]);

  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');
  const pastBookings = bookings.filter((b) => b.status === 'completed');
  const activeBooking = bookings.find(b => b.status === 'upcoming' && b.timelineStatus && b.timelineStatus !== 'session_closed');

  // Hydration state
  const [waterMl, setWaterMl] = useState(0);
  const [caloriesToday, setCaloriesToday] = useState(0);
  const waterGoal = 2500;
  const caloriesGoal = 600;

  // Animations
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(20));
  const [pulseAnim] = useState(() => new Animated.Value(1));

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
  }, [role, fadeAnim, slideAnim, pulseAnim]);

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
  const nameText = user.name || 'User';
  const hour = new Date().getHours();
  const greetingPrefix = hour < 12 ? 'Good Morning, ' : hour < 17 ? 'Good Afternoon, ' : 'Good Evening, ';
  const greetingSuffix = hour < 12 ? ' 🌅' : hour < 17 ? ' ☀️' : ' 🌙';
  const totalGreetingLength = greetingPrefix.length + nameText.length + greetingSuffix.length;
  
  const dynamicGreetingFontSize = totalGreetingLength > 20 
    ? Math.max(22, 34 - (totalGreetingLength - 20) * 0.8)
    : 34;

  const dynamicLetterSpacing = totalGreetingLength > 24 ? -0.3 : -0.7;

  // Personal Fitness Score Calculation
  const dateStr = new Date().toLocaleDateString('en-CA');
  const streak = user.id ? Database.getStreak(user.id) : 0;
  const userRecovery = user.id ? Database.getRecoveryScore(user.id, dateStr) : null;
  const recoveryVal = userRecovery ?? 0;
  const profileObj = user.id ? Database.getProfile(user.id) : null;

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
        <View className="relative flex-row items-center">
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            className="pr-4 py-2"
          >
            <Text className="text-2xl font-bold tracking-[0.2em] text-[#E11D48]">
              {role === 'trainer' ? 'VIRLA PRO' : 'VIRLA'}
            </Text>
            <Text className="text-[10px] font-medium tracking-[0.25em] text-zinc-500 uppercase mt-1">
              Wellness At Your Doorstep
            </Text>
          </TouchableOpacity>

          {isHolding && (
            <View className="absolute right-0 top-3 w-8 h-8 items-center justify-center">
              <Svg width={32} height={32} viewBox="0 0 32 32">
                <Circle
                  cx={16}
                  cy={16}
                  r={14}
                  stroke="#E5E7EB"
                  strokeWidth={2}
                  fill="none"
                />
                <AnimatedCircle
                  cx={16}
                  cy={16}
                  r={14}
                  stroke="#E11D48"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray={88}
                  strokeDashoffset={holdProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [88, 0],
                  })}
                  strokeLinecap="round"
                  transform="rotate(-90 16 16)"
                />
              </Svg>
            </View>
          )}
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
        <View className="flex-1 bg-[#FCF5F5]">
          {activeBooking && (role === 'customer' || role === 'admin') && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/session-detail' as any, params: { id: activeBooking.id } })}
              className="mx-6 mt-3 mb-1 p-3.5 bg-indigo-950 border border-indigo-900 rounded-2xl flex-row items-center justify-between shadow-md"
            >
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-2 h-2 rounded-full bg-rose-500" />
                <View className="flex-1">
                  <Text className="text-indigo-250 text-[8px] font-black uppercase tracking-wider">Live Concierge Update</Text>
                  <Text className="text-white text-[11px] font-extrabold mt-0.5" numberOfLines={1}>
                    {activeBooking.timelineStatus === 'booked' && 'Your session is booked & confirmed. Trainer details will be shared soon.'}
                    {activeBooking.timelineStatus === 'trainer_assigned' && 'Your session is booked & confirmed. Trainer details will be shared soon.'}
                    {activeBooking.timelineStatus === 'trainer_accepted' && `Coach ${activeBooking.trainerName} accepted your booking`}
                    {activeBooking.timelineStatus === 'trainer_preparing' && `Coach ${activeBooking.trainerName} is preparing your session gear`}
                    {activeBooking.timelineStatus === 'trainer_travelling' && `Coach ${activeBooking.trainerName} is on the way`}
                    {activeBooking.timelineStatus === 'trainer_arrived' && `Coach ${activeBooking.trainerName} has arrived at your gate!`}
                    {activeBooking.timelineStatus === 'otp_verified' && `Check-in Verified. Starting workout.`}
                    {activeBooking.timelineStatus === 'workout_started' && `Workout in progress (active session)`}
                    {activeBooking.timelineStatus === 'workout_completed' && `Workout complete! Submit rating feedback.`}
                    {activeBooking.timelineStatus === 'trainer_report_submitted' && `Report submitted. Rate your session.`}
                    {activeBooking.timelineStatus === 'customer_review_pending' && `Rating review pending.`}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={14} color="#A5B4FC" />
            </TouchableOpacity>
          )}

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
          {(role === 'customer' || role === 'admin') && (
            <>
              {/* Greeting */}
              <View className="gap-2 px-1">
                <Text 
                  style={{ 
                    fontSize: dynamicGreetingFontSize, 
                    letterSpacing: dynamicLetterSpacing,
                    lineHeight: dynamicGreetingFontSize * 1.15
                  }}
                  className="font-bold text-[#101828]"
                >
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
                    <View 
                      style={{
                        width: 104,
                        height: 104,
                        borderRadius: 52,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#101828',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.04,
                        shadowRadius: 12,
                        elevation: 2,
                      }}
                    >
                      <ProgressRing progress={recoveryVal / 100} size={92} strokeWidth={8} activeColor="#E11D48" inactiveColor="#FFE4E6">
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 28, fontWeight: '700', color: '#101828', letterSpacing: -1, lineHeight: 32 }}>
                            {userRecovery !== null ? userRecovery : '--'}
                          </Text>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: '#9CA3AF', marginTop: -2 }}>/100</Text>
                        </View>
                      </ProgressRing>
                    </View>

                    {/* Status Info */}
                    <View className="flex-1 gap-1.5 justify-center">
                      <Text className="text-[#E11D48] text-[13px] font-semibold tracking-wider uppercase">Recovery Score</Text>
                      <Text className="text-[#101828] text-[20px] font-semibold tracking-tight">
                        {user.id ? (userRecovery !== null ? (userRecovery >= 80 ? 'Excellent Recovery' : 'Good Recovery') : 'No Logs Today') : 'Unauthenticated'}
                      </Text>
                      <Text className="text-zinc-500 text-[15px] font-normal leading-snug">
                        {user.id ? (userRecovery !== null ? 'Ready for Strength Training Today.' : 'Log water or workouts to compute recovery index.') : 'Please log in to track recovery.'}
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
                    activeOpacity={0.95}
                    onPress={() => router.push('/booking' as any)}
                    className="w-full h-14 bg-[#E11D48] rounded-[22px] justify-between items-center px-5 flex-row"
                    style={{
                      minHeight: 56,
                      shadowColor: '#E11D48',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.2,
                      shadowRadius: 16,
                      elevation: 4,
                    }}
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
                      onPress={() => router.push({
                        pathname: '/booking',
                        params: {
                          workoutId: item.id,
                          workoutType: item.title,
                          workoutName: item.title,
                        },
                      })}
                      className="w-36 p-5 rounded-[28px] relative overflow-hidden justify-between"
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

                      <View>
                        {/* Icon container */}
                        <View className="w-11 h-11 rounded-full bg-white/20 items-center justify-center self-start">
                          <Text className="text-lg">{item.emoji}</Text>
                        </View>
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
                
                {activeBooking ? (
                  <View 
                    className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-5"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.04,
                      shadowRadius: 12,
                      elevation: 3,
                    }}
                  >
                    <View className="flex-row gap-4 items-center">
                      {/* Left: Avatar image with rating overlay */}
                      <View className="relative">
                        <Image 
                          source={{ uri: activeBooking.trainerPhoto || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80' }} 
                          className="w-18 h-18 rounded-full border border-zinc-150" 
                        />
                        {/* Rating Overlay */}
                        <View 
                          className="absolute -top-1.5 -left-1.5 bg-white border border-zinc-100 px-1.5 py-0.5 rounded-lg items-center justify-center flex-row"
                          style={{
                            shadowColor: '#101828',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.03,
                            shadowRadius: 4,
                            elevation: 1,
                          }}
                        >
                          <Text className="text-[11px] font-bold text-zinc-800">⭐ 4.9</Text>
                        </View>
                      </View>

                      {/* Right: Coach info */}
                      <View className="flex-1 gap-1.5">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-[#101828] text-[18px] font-semibold tracking-tight">
                            {activeBooking.trainerName}
                          </Text>
                          <Feather name="chevron-right" size={14} color="#9CA3AF" />
                        </View>
                        <Text className="text-[#6B7280] text-[15px] font-normal leading-none">
                          {activeBooking.trainerSpeciality || 'Strength & Conditioning Specialist'}
                        </Text>

                        {/* Stats row */}
                        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5 mt-1">
                          <View className="flex-row items-center gap-1">
                            <Feather name="clock" size={12} color="#FF8A00" />
                            <Text className="text-zinc-500 text-[11px] font-medium uppercase">
                              Arriving {activeBooking.time.split(' - ')[0] || '10:30 AM'}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1">
                            <Feather name="map-pin" size={12} color="#3B82F6" />
                            <Text className="text-zinc-500 text-[11px] font-medium uppercase">
                              {activeBooking.trainerDistance || '2.3 km'}
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
                        router.push({ pathname: '/session-detail', params: { id: activeBooking.id } });
                      }}
                      className="w-full bg-rose-50 rounded-2xl items-center justify-center flex-row gap-2"
                      style={{ minHeight: 52 }}
                    >
                      <Feather name="map-pin" size={14} color="#E11D48" />
                      <Text className="text-[#E11D48] text-[13px] font-bold uppercase tracking-wider">
                        Track Coach Live
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View 
                    className="bg-white border border-[#E5E7EB] p-8 rounded-[32px] items-center justify-center gap-3"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.04,
                      shadowRadius: 12,
                      elevation: 3,
                    }}
                  >
                    <Text className="text-3xl">🏋️</Text>
                    <Text className="text-[#101828] text-base font-semibold">No Active Coach Today</Text>
                    <Text className="text-zinc-500 text-sm text-center">Your assigned coach tracking details will activate here on the day of your session.</Text>
                  </View>
                )}
              </View>

              {/* Today's Overview Section */}
              <View className="gap-4">
                <Text className="text-[#101828] text-[20px] font-semibold tracking-tight pl-1">Today&apos;s Overview</Text>

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
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.15,
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
                      <Text className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
                        {savedPlan ? 'My AI Wellness Plan' : 'AI Wellness Coach'}
                      </Text>
                    </View>

                    {savedPlan ? (
                      <View className="gap-3.5">
                        <View className="flex-row justify-between flex-wrap gap-y-2.5">
                          <View className="w-[48%] gap-0.5">
                            <Text className="text-white/50 text-[9px] font-bold uppercase">Calories Goal</Text>
                            <Text className="text-white text-xs font-black">{savedPlan.dailyCalories} kcal</Text>
                          </View>
                          <View className="w-[48%] gap-0.5">
                            <Text className="text-white/50 text-[9px] font-bold uppercase">Protein Goal</Text>
                            <Text className="text-white text-xs font-black">{savedPlan.proteinTarget}g</Text>
                          </View>
                          <View className="w-[48%] gap-0.5">
                            <Text className="text-white/50 text-[9px] font-bold uppercase">Water Goal</Text>
                            <Text className="text-white text-xs font-black" numberOfLines={1}>
                              {savedPlan.hydrationGoal ? savedPlan.hydrationGoal.split(' ')[0] : '2'} L
                            </Text>
                          </View>
                          <View className="w-[48%] gap-0.5">
                            <Text className="text-white/50 text-[9px] font-bold uppercase">Next Session</Text>
                            <Text className="text-white text-xs font-black" numberOfLines={1}>
                              {upcomingBookings.length > 0 && upcomingBookings[0]?.date
                                ? `${upcomingBookings[0].date.split(',')[0]} @ ${upcomingBookings[0].time}`
                                : 'None scheduled'}
                            </Text>
                          </View>
                        </View>
                        
                        <View className="gap-0.5">
                          <Text className="text-white/50 text-[9px] font-bold uppercase">{"Today's"} Workout</Text>
                          <Text className="text-white text-[11px] font-semibold leading-relaxed pr-6" numberOfLines={1}>
                            {savedPlan.workoutRecommendation}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View className="gap-1">
                        <Text className="text-white text-[15px] font-semibold tracking-tight leading-relaxed">
                          Create Your AI Wellness Plan
                        </Text>
                        <Text className="text-white/70 text-[13px] font-normal leading-relaxed pr-4">
                          Answer a few questions so VIRLA AI can create a personalized wellness plan.
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => router.push('/virla-ai' as any)}
                      className="h-11 bg-[#E11D48] rounded-[18px] justify-between items-center px-5 flex-row self-start gap-3 mt-1"
                      style={{
                        minHeight: 44,
                        shadowColor: '#E11D48',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        elevation: 3,
                      }}
                    >
                      <Text className="text-white text-[11px] font-bold uppercase tracking-wider">
                        {savedPlan ? 'My AI Wellness Plan' : 'Get Started'}
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
                  const isAccepted = bookingData.timelineStatus !== 'booked' && bookingData.timelineStatus !== 'trainer_assigned';
                  const isSearching = !bookingData.trainerId || bookingData.trainerId === 'searching' || bookingData.trainerName === 'No Trainer Available';

                  return (
                    <View 
                      className="bg-white border border-[#E5E7EB] p-6 rounded-[32px] gap-4"
                      style={{
                        shadowColor: '#101828',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.04,
                        shadowRadius: 12,
                        elevation: 3,
                      }}
                    >
                      {/* Top: Coach avatar, title, and badge */}
                      <View className="flex-row justify-between items-start">
                        <View className="flex-row items-center gap-3">
                          {!isAccepted ? (
                            <View className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 items-center justify-center">
                              <Feather name="clock" size={20} color="#4F46E5" />
                            </View>
                          ) : (
                            <Image 
                              source={{ uri: bookingData.trainerPhoto }} 
                              className="w-14 h-14 rounded-full border border-zinc-150" 
                            />
                          )}
                          <View>
                            <Text className="text-zinc-950 text-[15px] font-semibold">{bookingData.workoutTitle}</Text>
                            <Text className="text-zinc-500 text-[13px] font-normal mt-0.5">
                              {!isAccepted 
                                ? 'Trainer details will be shared soon.' 
                                : `with ${bookingData.trainerName}`
                              }
                            </Text>
                          </View>
                        </View>
                        {/* Elite coach badge */}
                        {isAccepted && (
                          <View className="bg-amber-50 border border-amber-100 px-3.5 py-1 rounded-full">
                            <Text className="text-amber-600 text-[9px] font-bold uppercase tracking-wider">★ ELITE COACH</Text>
                          </View>
                        )}
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
                              <Text className="text-zinc-400 text-[11px] font-medium mt-0.5">{bookingData.time ? bookingData.time.split(' - ')[0] : ''}</Text>
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
                            <Feather 
                              name={isTravelling ? 'truck' : 'check-circle'} 
                              size={12} 
                              color="#16C784" 
                            />
                            <Text className="text-emerald-600 text-[9px] font-bold uppercase tracking-wider">
                              {isTravelling 
                                ? 'Coach on the way' 
                                : 'Confirmed'
                              }
                            </Text>
                          </View>

                          {/* Navigation Map Action */}
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => router.push({ pathname: '/session-detail', params: { id: bookingData.id } })}
                            className="w-11 h-11 rounded-full bg-[#16C784] items-center justify-center"
                            style={{
                              minWidth: 44,
                              minHeight: 44,
                              shadowColor: '#16C784',
                              shadowOffset: { width: 0, height: 6 },
                              shadowOpacity: 0.25,
                              shadowRadius: 12,
                              elevation: 3,
                            }}
                          >
                            <Feather name="navigation" size={16} color="white" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })() : (
                  <View 
                    className="bg-white border border-[#E5E7EB] p-8 rounded-[32px] items-center justify-center gap-3"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.04,
                      shadowRadius: 12,
                      elevation: 3,
                    }}
                  >
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
                    Good Morning, {user.name === 'Guest User' || user.name === 'Viral' ? 'Rahul' : user.name.split(' ')[0]}
                  </Text>
                  <Text className="text-zinc-500 text-xs font-semibold leading-relaxed mt-1">
                    VIRLA PRO Console • {"Today's"} Sessions & Requests
                  </Text>
                </View>

                {/* Availability Status Card */}
                <View 
                  className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4"
                  style={{
                    shadowColor: '#101828',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.02,
                    shadowRadius: 8,
                    elevation: 1,
                  }}
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-2.5">
                      <View className={`w-3 h-3 rounded-full ${trainerOnlineStatus === 'online' ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                      <View>
                        <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Availability Status</Text>
                        <Text className="text-zinc-500 text-[10px] font-semibold mt-0.5">
                          {trainerOnlineStatus === 'online' ? 'Online & Available for bookings' : 'Offline • Requests are paused'}
                        </Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={toggleOnlineStatus}
                      className={`px-4 py-2.5 rounded-full border ${
                        trainerOnlineStatus === 'online' 
                          ? 'bg-emerald-50 border-emerald-200' 
                          : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <Text className={`text-[9px] font-black uppercase tracking-wider ${
                        trainerOnlineStatus === 'online' ? 'text-emerald-700' : 'text-zinc-500'
                      }`}>
                        {trainerOnlineStatus === 'online' ? 'Online' : 'Offline'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Dashboard Analytics Card */}
                <View 
                  className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4"
                  style={{
                    shadowColor: '#101828',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.02,
                    shadowRadius: 8,
                    elevation: 1,
                  }}
                >
                  <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">Quick Statistics</Text>

                  <View className="flex-row flex-wrap justify-between gap-y-3 px-1">
                    <View className="w-[48%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase">{"Today's"} Earnings</Text>
                      <Text className="text-emerald-700 text-xs font-extrabold">
                        ₹{(bookings.filter(b => b.status === 'upcoming' && b.timelineStatus === 'trainer_accepted' && ((b.date || '').includes('Today') || (b.date || '').includes(new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })))).length * 1200).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View className="w-[48%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase">Completed Sessions</Text>
                      <Text className="text-[#101828] text-xs font-extrabold">{totalCompleted} Sessions</Text>
                    </View>
                    <View className="w-[48%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase">Average Rating</Text>
                      <Text className="text-amber-700 text-xs font-extrabold">⭐ 4.9 / 5.0</Text>
                    </View>
                    <View className="w-[48%] bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase">Rank Status</Text>
                      <Text className="text-indigo-700 text-xs font-extrabold">
                        {totalCompleted >= 20 ? 'Elite Coach' : totalCompleted >= 5 ? 'Certified Coach' : 'Associate Coach'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Upcoming Requests Section */}
                <View className="gap-3 mt-1">
                  <View className="flex-row justify-between items-center pr-1">
                    <Text className="text-[#101828] text-xs font-semibold uppercase tracking-widest pl-1">Upcoming Requests</Text>
                    <TouchableOpacity 
                      onPress={handleManualRefresh}
                      disabled={isRefreshing}
                      className="bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-150 flex-row items-center gap-1.5"
                    >
                      <Feather name="refresh-cw" size={10} color="#4F46E5" />
                      <Text className="text-[#4F46E5] text-[9px] font-black uppercase">
                        {isRefreshing ? 'Syncing...' : 'Refresh Requests'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {trainerOnlineStatus === 'online' ? (() => {
                    const requests = bookings.filter(b => 
                      b.timelineStatus === 'booked' && 
                      (b.trainerName === user.name || (currentCoach && b.trainerId === currentCoach.id))
                    );
                    if (requests.length > 0) {
                      return requests.map(req => (
                        <RequestCard
                          key={req.id}
                          booking={req}
                          onAccept={handleAcceptRequest}
                          onDecline={handleDeclineRequest}
                          onTimeout={handleTimeoutRequest}
                          onPress={(id) => router.push({ pathname: '/session-detail', params: { id } })}
                        />
                      ));
                    }
                    return (
                      <View className="bg-white border border-[#E5E7EB] p-8 rounded-2xl items-center justify-center">
                        <Text className="text-zinc-400 text-[10px] font-black uppercase">No pending session requests.</Text>
                      </View>
                    );
                  })() : (
                    <View className="bg-white border border-[#E5E7EB] p-8 rounded-2xl items-center justify-center gap-2">
                      <Feather name="slash" size={16} color="#9CA3AF" />
                      <Text className="text-zinc-400 text-[10px] font-black uppercase">Offline - Requests lock enabled.</Text>
                    </View>
                  )}
                </View>

                {/* Today's Scheduled Sessions */}
                <View className="gap-3 mt-1">
                  <Text className="text-[#101828] text-xs font-semibold uppercase tracking-widest pl-1">{"Today's"} Scheduled Sessions</Text>
                  {bookings.filter(b => b.status === 'upcoming' && b.timelineStatus === 'trainer_accepted' && ((b.date || '').includes('Today') || (b.date || '').includes(new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })))).length > 0 ? (
                    bookings.filter(b => b.status === 'upcoming' && b.timelineStatus === 'trainer_accepted' && ((b.date || '').includes('Today') || (b.date || '').includes(new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })))).map((booking) => (
                      <TouchableOpacity 
                        key={booking.id} 
                        activeOpacity={0.8}
                        onPress={() => router.push({ pathname: '/session-detail', params: { id: booking.id } })}
                        className="bg-white border border-[#E5E7EB] p-4 rounded-2xl flex-row justify-between items-center"
                        style={{
                          shadowColor: '#101828',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.03,
                          shadowRadius: 6,
                          elevation: 1,
                        }}
                      >
                        <View className="flex-row items-center gap-3">
                          <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center">
                            <Feather name="clock" size={14} color="#4F46E5" />
                          </View>
                          <View>
                            <Text className="text-zinc-900 text-xs font-semibold">{booking.workoutTitle}</Text>
                            <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{booking.date} • {booking.time}</Text>
                          </View>
                        </View>
                        <View className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
                          <Text className="text-[7px] font-bold uppercase text-emerald-600">Scheduled</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View className="bg-white border border-[#E5E7EB] p-6 rounded-2xl items-center justify-center">
                      <Text className="text-zinc-400 text-[9px] font-bold uppercase">No visits scheduled for today.</Text>
                    </View>
                  )}
                </View>

                {/* Trainer Console Visits Hub (Current Active Visit Console) */}
                {bookings.filter(b => b.status === 'upcoming' && b.timelineStatus !== 'booked' && b.timelineStatus !== 'trainer_assigned').length > 0 && (() => {
                  const activeJobs = bookings.filter(b => b.status === 'upcoming' && b.timelineStatus !== 'booked' && b.timelineStatus !== 'trainer_assigned');
                  const job = activeJobs[0];
                  const timeline = job.timelineStatus || 'booked';

                  return (
                    <View className="gap-3 mt-1">
                      <Text className="text-[#101828] text-xs font-semibold uppercase tracking-widest pl-1">Active Session Console</Text>
                      <View 
                        className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-800 gap-4"
                        style={{
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 12 },
                          shadowOpacity: 0.3,
                          shadowRadius: 24,
                          elevation: 6,
                        }}
                      >
                        <View className="flex-row justify-between items-start">
                          <View className="gap-1 flex-1 pr-3">
                            <Text className="text-zinc-500 text-[8px] font-semibold uppercase">Active Workout ID: {job.id}</Text>
                            <Text className="text-white text-base font-semibold mt-1 leading-tight">{job.workoutTitle}</Text>
                            <Text className="text-zinc-400 text-[10px] font-medium mt-1">👤 Client: VIRLA-C{job.id.slice(-6).toUpperCase()} • 📍 {job.address ? job.address.split(',')[0] : 'Venue'}</Text>
                            <Text className="text-zinc-500 text-[9px] font-medium mt-0.5">⏱ {job.date} • {job.time}</Text>
                          </View>
                          <View className="bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-0.5 rounded-full">
                            <Text className="text-indigo-400 text-[7px] font-bold uppercase tracking-wider">{timeline.replace(/_/g, ' ')}</Text>
                          </View>
                        </View>

                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            onPress={() => Alert.alert('GPS Routing Simulated', 'Opening navigation routing to venue...')}
                            className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                          >
                            <Feather name="navigation" size={10} color="white" />
                            <Text className="text-white text-[7px] font-bold uppercase">Navigate</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => {
                              if (getMinutesToSession(job) <= 60) {
                                Alert.alert('Secure Call', 'Connecting call to customer using masked calling...');
                              } else {
                                Alert.alert('Call Locked', 'Calling will be available 60 minutes before the session.');
                              }
                            }}
                            className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                          >
                            <Feather name="phone" size={10} color="white" />
                            <Text className="text-white text-[7px] font-bold uppercase">Call Client</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => router.push({ pathname: '/communication', params: { id: job.id } })}
                            className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                          >
                            <Feather name="message-square" size={10} color="white" />
                            <Text className="text-white text-[7px] font-bold uppercase">Message</Text>
                          </TouchableOpacity>
                        </View>

                        <View className="h-[1px] bg-zinc-800" />

                        {timeline === 'trainer_accepted' ? (
                          <TouchableOpacity
                            onPress={() => {
                              updateTimelineStatus(job.id, 'trainer_travelling');
                              useNotificationStore.getState().addNotification({
                                title: 'Coach On The Way 🚗',
                                body: `Coach has started travelling to your venue.`,
                                icon: 'user-check'
                              });
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
                                body: `Coach has arrived at your location.`,
                                icon: 'lock'
                              });
                            }}
                            className="w-full bg-emerald-600 py-3.5 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-bold uppercase tracking-wider">Reached Location</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => router.push({ pathname: '/session-detail', params: { id: job.id } })}
                            className="w-full bg-zinc-800 py-3.5 rounded-xl items-center justify-center"
                          >
                            <Text className="text-white text-xs font-bold uppercase tracking-wider">
                              {timeline === 'trainer_arrived' ? 'Waiting client OTP check-in' : 'Open active console'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })()}

              </View>

              {/* Navigate to Availability Planner */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/trainer-availability' as any)}
                className="bg-indigo-50 border border-indigo-150 p-5 rounded-[28px] flex-row justify-between items-center mt-4"
                style={{
                  shadowColor: '#4F46E5',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                }}
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
            </>
          )}

        </Animated.View>
      </ScrollView>
      </View>
      )}
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
