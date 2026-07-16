import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, Animated, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useBookingStore } from '../../store/bookingStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useUserStore } from '../../store/userStore';
import { ProgressRing } from '../../components/ProgressRing';
import { Feather } from '@expo/vector-icons';

// Animated Numbers component for premium counter growth (Feature 1)
function CountingNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [currentVal, setCurrentVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) return;
    const duration = 800; // ms
    const stepTime = Math.abs(Math.floor(duration / end));
    const timer = setInterval(() => {
      start += 1;
      setCurrentVal(start);
      if (start >= end) {
        clearInterval(timer);
      }
    }, Math.max(stepTime, 15));
    return () => clearInterval(timer);
  }, [value]);

  return <Text className="text-[#111827] text-2xl font-black">{currentVal}{suffix}</Text>;
}

export default function HomeScreen() {
  const router = useRouter();
  const { bookings } = useBookingStore();
  const { membership } = useMembershipStore();
  const { notifications, unreadCount } = useNotificationStore();
  const { user } = useUserStore();

  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');
  const pastBookings = bookings.filter((b) => b.status === 'completed');

  // Core metrics mock state
  const streak = 5; // 5 days streak
  const caloriesBurned = 380;
  const calorieGoal = 600;
  const recoveryScore = 84; // 84% recovery
  const sessionsCompleted = 14;

  // Animation values (Feature 1)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Checklist / Ticker states
  const [secondsLeft, setSecondsLeft] = useState(12 * 3600 + 45 * 60 + 30);
  const [randomQuote, setRandomQuote] = useState('');

  // Daily AI Tips (Feature 5)
  const coachTips = [
    'Stretch your hamstrings today to release lower back tension.',
    'Drink another 500ml of water to optimize cellular hydration.',
    'Excellent attendance this week. Keep up the high intensity!',
    'Recovery score is optimal today. Perfect day for a PowerForge session.',
    'Rest is a weapon. Target 8 hours of sleep tonight for muscle synthesis.'
  ];

  // Rotate tip based on calendar date index
  const dayIndex = new Date().getDate() % coachTips.length;
  const dailyTip = coachTips[dayIndex];

  // Greeting and Quotes selection (Feature 2)
  useEffect(() => {
    // Fade up animation on load
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();

    // Live countdown ticker
    const timerInterval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // Random quotes
    const quotes = [
      'Ready to become stronger today?',
      'Focus on progress, not perfection.',
      'Your body can stand almost anything, convince your mind.',
      'Make today your best workout.',
      'You are one workout away from a good mood.'
    ];
    const randIdx = Math.floor(Math.random() * quotes.length);
    setRandomQuote(quotes[randIdx]);

    return () => clearInterval(timerInterval);
  }, []);

  const getGreetingText = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return { title: '☀️ Good Morning', subtitle: randomQuote || 'Ready to become stronger today?' };
    } else if (hour < 17) {
      return { title: '☀️ Good Afternoon', subtitle: 'Keep pushing your limits today.' };
    } else {
      return { title: '🌙 Welcome back', subtitle: 'Let’s finish today with one more session.' };
    }
  };

  const greeting = getGreetingText();

  const handleSupport = () => {
    Alert.alert('VIRLA Concierge', 'Connecting you to our VIP wellness support line (+91 99999 88888)...');
  };

  const handleManageMembership = () => {
    Alert.alert(
      'Manage Membership',
      `Plan: ${membership.tier}\nAvailable Credits: ${membership.availableCredits}/${membership.totalCredits}\nRenews on: ${membership.renewalDate}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Upgrade Plan', onPress: () => Alert.alert('Premium Access', 'Pricing options will load shortly.') }
      ]
    );
  };

  const handleCheckIn = (title: string) => {
    Alert.alert('Session Check-In', `Checked in successfully for your ${title} session! Have a great workout!`);
  };

  const handleNavigateMap = () => {
    Alert.alert('Navigation Active', 'Routing GPS directions to your session venue address...');
  };

  const formatCountdown = () => {
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;
    return `${h}h ${m}m ${s}s`;
  };

  // Simulated Weekly chart values
  const weeklyData = [
    { day: 'Mon', value: 45, color: '#4F46E5' },
    { day: 'Tue', value: 30, color: '#06B6D4' },
    { day: 'Wed', value: 0, color: '#E5E7EB' },
    { day: 'Thu', value: 50, color: '#4F46E5' },
    { day: 'Fri', value: 60, color: '#4F46E5' },
    { day: 'Sat', value: 20, color: '#06B6D4' },
    { day: 'Sun', value: 15, color: '#06B6D4' }
  ];

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        className="bg-[#F8F9FB]"
      >
        <Animated.View 
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          className="px-6 pt-8 pb-4 gap-6"
        >
          
          {/* Header Greeting & Notifications (Feature 2 & 10) */}
          <View className="flex-row justify-between items-center mb-1">
            <View className="flex-1 pr-4">
              <Text className="text-[#111827] text-3xl font-black tracking-tight leading-none">
                {greeting.title},{'\n'}{user.name}
              </Text>
              <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1">
                {greeting.subtitle}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/notifications' as any)}
                className="w-11 h-11 rounded-full border border-[#E5E7EB] bg-white items-center justify-center shadow-xs relative"
              >
                <Feather name="bell" size={18} color="#111827" />
                {unreadCount > 0 && (
                  <View className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#EF4444] border-2 border-white" />
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => router.push('/(tabs)/profile' as any)}
                className="w-11 h-11 rounded-full border-2 border-white bg-indigo-50 items-center justify-center shadow-xs overflow-hidden"
              >
                <Feather name="user" size={18} color="#4F46E5" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 1: YOUR NEXT SESSION (Feature 3 & 11) */}
          <View className="gap-3">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">
              Your Next Session
            </Text>
            
            {upcomingBookings.length > 0 ? (
              <View className="bg-white border border-[#E5E7EB] p-6 rounded-[30px] shadow-sm gap-5">
                <View className="flex-row justify-between items-start">
                  <View className="gap-1 flex-1 pr-3">
                    <Text className="text-indigo-600 text-[10px] font-black uppercase tracking-wider">
                      ★ Active Appointment
                    </Text>
                    <Text className="text-[#111827] text-2xl font-black tracking-tight mt-1 leading-tight">
                      {upcomingBookings[0].workoutTitle}
                    </Text>
                    <Text className="text-[#6B7280] text-xs font-semibold mt-1">
                      ⏱ {upcomingBookings[0].date} at {upcomingBookings[0].time}
                    </Text>
                  </View>
                  <View className="bg-indigo-50 px-3.5 py-1.5 rounded-2xl border border-indigo-100">
                    <Text className="text-[#4F46E5] text-[9px] font-black uppercase tracking-widest">
                      Live
                    </Text>
                  </View>
                </View>

                {/* Training details grid */}
                <View className="gap-3 border-t border-[#E5E7EB]/50 pt-4">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[#6B7280] text-xs font-medium">Coach Assigned</Text>
                    <Text className="text-[#111827] text-xs font-black">
                      {upcomingBookings[0].trainerName.includes('Assigning') 
                        ? 'VIRLA Master Coach' 
                        : upcomingBookings[0].trainerName.replace('Coach ', '').replace(' (Requested)', '')}
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-start">
                    <Text className="text-[#6B7280] text-xs font-medium mr-4">Gym Address</Text>
                    <Text className="text-[#111827] text-xs font-black flex-1 text-right leading-tight" numberOfLines={1}>
                      {upcomingBookings[0].address || 'Training Venue'}
                    </Text>
                  </View>

                  {/* Countdown live ticker */}
                  <View className="flex-row justify-between items-center mt-1">
                    <Text className="text-[#6B7280] text-xs font-medium">Starts In</Text>
                    <Text className="text-[#4F46E5] text-xs font-black tracking-wider">
                      {formatCountdown()}
                    </Text>
                  </View>
                </View>

                {/* Live actions */}
                <View className="flex-row gap-3.5 mt-2.5">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleNavigateMap}
                    className="flex-1 bg-zinc-950 py-3.5 rounded-2xl flex-row justify-center items-center gap-2 shadow-xs"
                  >
                    <Feather name="navigation" size={14} color="white" />
                    <Text className="text-white text-xs font-extrabold tracking-wide">Navigate</Text>
                  </TouchableOpacity>

                  {/* Check-In Button (displays always on day of training) */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleCheckIn(upcomingBookings[0].workoutTitle)}
                    className="flex-1 bg-[#4F46E5] py-3.5 rounded-2xl flex-row justify-center items-center gap-2 shadow-xs"
                  >
                    <Feather name="check-circle" size={14} color="white" />
                    <Text className="text-white text-xs font-extrabold tracking-wide">Check In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Empty state (Feature 11) */
              <View className="bg-white border border-[#E5E7EB] p-8 rounded-[30px] shadow-sm items-center justify-center gap-2">
                <Text className="text-4xl mb-1">🏋️‍♂️</Text>
                <Text className="text-[#111827] text-base font-extrabold">Let's get moving.</Text>
                <Text className="text-[#6B7280] text-xs text-center max-w-[80%] leading-relaxed font-semibold">
                  No upcoming workout scheduled. Match with our certified VIRLA wellness coaches today.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/booking' as any)}
                  className="mt-4 bg-zinc-950 px-8 py-3 rounded-full shadow-xs"
                >
                  <Text className="text-white text-xs font-black uppercase tracking-widest">Book your first session</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Section 2: Quick Action Widgets (Feature 4) */}
          <View className="gap-3">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">
              Quick Actions
            </Text>
            <View className="flex-row flex-wrap gap-4 justify-between">
              
              {/* Action 1 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/booking' as any)}
                className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-2xl flex-row items-center gap-3 shadow-xs"
              >
                <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center">
                  <Feather name="plus-circle" size={16} color="#4F46E5" />
                </View>
                <View>
                  <Text className="text-[#111827] text-xs font-extrabold">Book Session</Text>
                  <Text className="text-[#6B7280] text-[9px] font-semibold">Home visit</Text>
                </View>
              </TouchableOpacity>

              {/* Action 2 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/progress' as any)}
                className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-2xl flex-row items-center gap-3 shadow-xs"
              >
                <View className="w-10 h-10 rounded-xl bg-cyan-50 items-center justify-center">
                  <Feather name="trending-up" size={16} color="#06B6D4" />
                </View>
                <View>
                  <Text className="text-[#111827] text-xs font-extrabold">Progress</Text>
                  <Text className="text-[#6B7280] text-[9px] font-semibold">View charts</Text>
                </View>
              </TouchableOpacity>

              {/* Action 3 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleManageMembership}
                className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-2xl flex-row items-center gap-3 shadow-xs"
              >
                <View className="w-10 h-10 rounded-xl bg-purple-50 items-center justify-center">
                  <Feather name="credit-card" size={16} color="#8B5CF6" />
                </View>
                <View>
                  <Text className="text-[#111827] text-xs font-extrabold">Membership</Text>
                  <Text className="text-[#6B7280] text-[9px] font-semibold">Credits: {membership.availableCredits}</Text>
                </View>
              </TouchableOpacity>

              {/* Action 4 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSupport}
                className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-2xl flex-row items-center gap-3 shadow-xs"
              >
                <View className="w-10 h-10 rounded-xl bg-rose-50 items-center justify-center">
                  <Feather name="life-buoy" size={16} color="#EF4444" />
                </View>
                <View>
                  <Text className="text-[#111827] text-xs font-extrabold">Support</Text>
                  <Text className="text-[#6B7280] text-[9px] font-semibold">Get help</Text>
                </View>
              </TouchableOpacity>

            </View>
          </View>

          {/* Section 3: Today’s Progress Metrics (Feature 4 & 1) */}
          <View className="gap-3">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">
              Today's Metrics
            </Text>
            <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] shadow-sm flex-row justify-between items-center">
              
              {/* Left Circular Progress indicators */}
              <View className="flex-row gap-5 items-center">
                <ProgressRing progress={84 / 100} size={70} strokeWidth={6} activeColor="#4F46E5">
                  <View className="items-center justify-center">
                    <Text className="text-[#111827] text-xs font-black">84%</Text>
                    <Text className="text-[#6B7280] text-[7px] font-bold uppercase mt-0.5">Recov</Text>
                  </View>
                </ProgressRing>

                <ProgressRing progress={380 / 600} size={70} strokeWidth={6} activeColor="#06B6D4">
                  <View className="items-center justify-center">
                    <Text className="text-[#111827] text-xs font-black">380</Text>
                    <Text className="text-[#6B7280] text-[7px] font-bold uppercase mt-0.5">Kcal</Text>
                  </View>
                </ProgressRing>
              </View>

              {/* Right Counting up Metrics (Feature 1) */}
              <View className="gap-4 pr-1">
                <View className="items-end">
                  <Text className="text-[#6B7280] text-[8px] font-bold uppercase tracking-wider">Streak</Text>
                  <CountingNumber value={streak} suffix=" Days 🔥" />
                </View>
                <View className="items-end">
                  <Text className="text-[#6B7280] text-[8px] font-bold uppercase tracking-wider">Total Completed</Text>
                  <CountingNumber value={sessionsCompleted} suffix=" Visits" />
                </View>
              </View>

            </View>
          </View>

          {/* Section 4: Calories Chart Widget (Feature 4) */}
          <View className="gap-3">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">
              Calories This Week
            </Text>
            <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] shadow-sm">
              <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mb-6">
                Active minutes burn distribution (Mon - Sun)
              </Text>
              
              {/* Animated Bars */}
              <View className="flex-row items-end justify-between h-24 pt-2">
                {weeklyData.map((d, idx) => {
                  const heightPercent = d.value ? `${(d.value / 60) * 100}%` : '5%';
                  return (
                    <View key={idx} className="items-center flex-1 gap-2">
                      <View className="w-7 bg-zinc-50 border border-zinc-100 rounded-lg h-16 justify-end overflow-hidden">
                        <View 
                          className="w-full rounded-md"
                          style={{ height: heightPercent as any, backgroundColor: d.color }}
                        />
                      </View>
                      <Text className="text-[#6B7280] text-[10px] font-bold">{d.day}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Section 5: Active Membership Card (Feature 4) */}
          <View className="gap-3">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">
              Active Membership
            </Text>
            <View className="bg-zinc-900 p-6 rounded-[28px] shadow-lg relative overflow-hidden">
              <View className="absolute w-40 h-40 rounded-full bg-indigo-500/10 -bottom-16 -right-16 blur-xl" />
              
              <View className="flex-row justify-between items-start mb-6">
                <View>
                  <Text className="text-indigo-400 text-[10px] font-black uppercase tracking-wider">Plan Tier</Text>
                  <Text className="text-white text-xl font-extrabold mt-1 tracking-tight">{membership.tier}</Text>
                </View>
                <View className="bg-white/10 px-3 py-1 rounded-full border border-white/10">
                  <Text className="text-white text-[9px] font-black uppercase tracking-wider">
                    {membership.availableCredits} Credits Left
                  </Text>
                </View>
              </View>

              <View className="gap-1 mb-6">
                <Text className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Renewal Date</Text>
                <Text className="text-zinc-300 text-xs font-semibold">Auto-renews on {membership.renewalDate}</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleManageMembership}
                className="w-full bg-white/10 border border-white/10 py-3.5 rounded-2xl items-center"
              >
                <Text className="text-white text-xs font-bold uppercase tracking-wider">Manage Membership</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 6: Personal AI Coach Widget (Feature 5 - Bottom Floating) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm flex-row items-center gap-4 mt-2">
            <View className="w-12 h-12 rounded-full border-2 border-indigo-100 bg-indigo-50 justify-center items-center overflow-hidden">
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80' }} 
                className="w-full h-full"
              />
            </View>
            <View className="flex-1">
              <Text className="text-indigo-600 text-[9px] font-black uppercase tracking-widest">
                Personal AI Coach
              </Text>
              <Text className="text-[#111827] text-xs font-extrabold leading-normal mt-0.5">
                "{dailyTip}"
              </Text>
            </View>
          </View>

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
