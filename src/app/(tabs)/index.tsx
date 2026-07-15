import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useBookingStore } from '../../store/bookingStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useUserStore } from '../../store/userStore';
import { ProgressRing } from '../../components/ProgressRing';
import { Feather } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();
  const { bookings } = useBookingStore();
  const { membership } = useMembershipStore();
  const { notifications } = useNotificationStore();
  const { user } = useUserStore();

  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');
  
  // Custom mock progress metrics for Sprint 4 UI
  const streak = 5; // 5 days streak
  const caloriesBurned = 380;
  const calorieGoal = 600;
  const recoveryScore = 84; // 84% recovery
  const sessionsCompleted = 14;

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

  // Simulated Weekly chart values for Card 4
  const weeklyData = [
    { day: 'Mon', value: 45, type: 'Strength' },
    { day: 'Tue', value: 30, type: 'Cardio' },
    { day: 'Wed', value: 0, type: 'Rest' },
    { day: 'Thu', value: 50, type: 'Mobility' },
    { day: 'Fri', value: 60, type: 'Strength' },
    { day: 'Sat', value: 20, type: 'Cardio' },
    { day: 'Sun', value: 15, type: 'Recovery' }
  ];

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        className="bg-[#F8F9FB]"
      >
        <View className="px-6 pt-8 pb-4 gap-6">
          
          {/* Header Greeting */}
          <View className="flex-row justify-between items-center mb-1">
            <View>
              <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest">Welcome Back</Text>
              <Text className="text-[#111827] text-3xl font-black tracking-tight mt-1">
                Good Morning,{'\n'}{user.name} 👋
              </Text>
            </View>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => router.push('/profile' as any)}
              className="w-12 h-12 rounded-full border-2 border-white bg-indigo-50 items-center justify-center shadow-sm overflow-hidden"
            >
              <Feather name="user" size={20} color="#4F46E5" />
            </TouchableOpacity>
          </View>

          {/* Today's Summary Subtext */}
          <View className="bg-white/60 border border-zinc-100 p-4 rounded-2xl flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center">
              <Feather name="activity" size={14} color="#4F46E5" />
            </View>
            <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed flex-1">
              You are on a <Text className="text-[#111827] font-black">{streak}-day streak</Text>. Your recovery is optimal at <Text className="text-indigo-600 font-black">{recoveryScore}%</Text>.
            </Text>
          </View>

          {/* Card 1: Upcoming Session */}
          <View className="gap-3">
            <Text className="text-[#111827] text-base font-black tracking-tight">Upcoming Session</Text>
            {upcomingBookings.length > 0 ? (
              <View className="bg-white border border-zinc-150 p-6 rounded-[28px] shadow-sm gap-4">
                <View className="flex-row justify-between items-start">
                  <View className="gap-1 flex-1 pr-3">
                    <Text className="text-indigo-600 text-[10px] font-black uppercase tracking-wider">
                      ★ Confirmed Session
                    </Text>
                    <Text className="text-[#111827] text-xl font-black tracking-tight">
                      {upcomingBookings[0].workoutTitle}
                    </Text>
                    <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed">
                      📅 {upcomingBookings[0].date} at {upcomingBookings[0].time}
                    </Text>
                  </View>
                  <View className="bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                    <Text className="text-[#4F46E5] text-[9px] font-black uppercase tracking-wider">
                      Upcoming
                    </Text>
                  </View>
                </View>

                {/* Trainer Row */}
                <View className="flex-row items-center justify-between py-3 border-t border-b border-zinc-100">
                  <Text className="text-[#6B7280] text-xs font-medium">Assigned Coach</Text>
                  <Text className="text-[#111827] text-xs font-black">
                    {upcomingBookings[0].trainerName.includes('Assigning') 
                      ? 'Platform Auto-Assign' 
                      : upcomingBookings[0].trainerName.replace('Coach ', '').replace(' (Requested)', '')}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push({
                    pathname: '/session-detail' as any,
                    params: { id: upcomingBookings[0].id }
                  })}
                  className="bg-zinc-900 py-3.5 rounded-2xl items-center justify-center shadow-xs"
                >
                  <Text className="text-white text-xs font-extrabold tracking-wide">View Session</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="bg-white border border-zinc-150 p-6 rounded-[28px] shadow-sm items-center justify-center py-8">
                <Text className="text-3xl mb-2">🧘‍♀️</Text>
                <Text className="text-[#111827] text-sm font-bold">No sessions scheduled</Text>
                <Text className="text-[#6B7280] text-xs text-center mt-1 max-w-[80%]">
                  Let's match you with a certified VIRLA wellness coach.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push('/booking' as any)}
                  className="mt-4 bg-zinc-900 px-6 py-2.5 rounded-full"
                >
                  <Text className="text-white text-xs font-black uppercase tracking-wider">Book Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Card 2: Quick Actions */}
          <View className="gap-3">
            <Text className="text-[#111827] text-base font-black tracking-tight">Quick Actions</Text>
            <View className="flex-row flex-wrap gap-4 justify-between">
              
              {/* Action 1 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/booking' as any)}
                className="w-[47%] bg-white border border-zinc-150 p-4 rounded-2xl flex-row items-center gap-3 shadow-xs"
              >
                <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center">
                  <Feather name="plus-circle" size={16} color="#4F46E5" />
                </View>
                <View>
                  <Text className="text-[#111827] text-xs font-extrabold">Book Session</Text>
                  <Text className="text-[#6B7280] text-[9px] font-semibold">At-home coach</Text>
                </View>
              </TouchableOpacity>

              {/* Action 2 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/progress' as any)}
                className="w-[47%] bg-white border border-zinc-150 p-4 rounded-2xl flex-row items-center gap-3 shadow-xs"
              >
                <View className="w-10 h-10 rounded-xl bg-cyan-50 items-center justify-center">
                  <Feather name="bar-chart-2" size={16} color="#06B6D4" />
                </View>
                <View>
                  <Text className="text-[#111827] text-xs font-extrabold">Analytics</Text>
                  <Text className="text-[#6B7280] text-[9px] font-semibold">View stats</Text>
                </View>
              </TouchableOpacity>

              {/* Action 3 */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleManageMembership}
                className="w-[47%] bg-white border border-zinc-150 p-4 rounded-2xl flex-row items-center gap-3 shadow-xs"
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
                className="w-[47%] bg-white border border-zinc-150 p-4 rounded-2xl flex-row items-center gap-3 shadow-xs"
              >
                <View className="w-10 h-10 rounded-xl bg-rose-50 items-center justify-center">
                  <Feather name="phone-call" size={16} color="#EF4444" />
                </View>
                <View>
                  <Text className="text-[#111827] text-xs font-extrabold">Support</Text>
                  <Text className="text-[#6B7280] text-[9px] font-semibold">Concierge line</Text>
                </View>
              </TouchableOpacity>

            </View>
          </View>

          {/* Card 3: Today’s Progress */}
          <View className="gap-3">
            <Text className="text-[#111827] text-base font-black tracking-tight">Today's Progress</Text>
            <View className="bg-white border border-zinc-150 p-6 rounded-[28px] shadow-sm flex-row justify-between items-center">
              
              {/* Rings Grid */}
              <View className="flex-row gap-5 items-center">
                <ProgressRing progress={recoveryScore / 100} size={70} strokeWidth={6} activeColor="#4F46E5">
                  <View className="items-center justify-center">
                    <Text className="text-[#111827] text-xs font-black">{recoveryScore}%</Text>
                    <Text className="text-[#6B7280] text-[7px] font-bold uppercase">Recov</Text>
                  </View>
                </ProgressRing>

                <ProgressRing progress={caloriesBurned / calorieGoal} size={70} strokeWidth={6} activeColor="#06B6D4">
                  <View className="items-center justify-center">
                    <Text className="text-[#111827] text-xs font-black">{caloriesBurned}</Text>
                    <Text className="text-[#6B7280] text-[7px] font-bold uppercase">Kcal</Text>
                  </View>
                </ProgressRing>
              </View>

              {/* Text Metrics */}
              <View className="gap-3.5 pr-2">
                <View className="items-end">
                  <Text className="text-[#6B7280] text-[9px] font-bold uppercase tracking-wider">Streak</Text>
                  <Text className="text-[#111827] text-base font-black">{streak} Days 🔥</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[#6B7280] text-[9px] font-bold uppercase tracking-wider">Completed</Text>
                  <Text className="text-[#111827] text-base font-black">{sessionsCompleted} Visits</Text>
                </View>
              </View>

            </View>
          </View>

          {/* Card 4: Weekly Progress (Visual Chart) */}
          <View className="gap-3">
            <Text className="text-[#111827] text-base font-black tracking-tight">Weekly Progress</Text>
            <View className="bg-white border border-zinc-150 p-6 rounded-[28px] shadow-sm">
              <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mb-6">
                Active training distribution across past 7 days
              </Text>
              
              {/* Graphic Bars */}
              <View className="flex-row items-end justify-between h-28 pt-2">
                {weeklyData.map((d, idx) => {
                  const heightPercent = d.value ? `${(d.value / 60) * 100}%` : '5%';
                  const isRest = d.value === 0;
                  return (
                    <View key={idx} className="items-center flex-1 gap-2">
                      <View className="w-7 bg-zinc-100 rounded-lg h-20 justify-end overflow-hidden">
                        <View 
                          style={{ height: heightPercent as any }} 
                          className={`w-full rounded-md ${
                            isRest ? 'bg-zinc-200' : idx % 2 === 0 ? 'bg-[#4F46E5]' : 'bg-[#06B6D4]'
                          }`}
                        />
                      </View>
                      <Text className="text-[#6B7280] text-[10px] font-bold">{d.day}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Legends */}
              <View className="flex-row justify-center gap-6 border-t border-zinc-100 mt-5 pt-4">
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-[#4F46E5]" />
                  <Text className="text-[#6B7280] text-[10px] font-bold">Strength / Recovery</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" />
                  <Text className="text-[#6B7280] text-[10px] font-bold">Cardio / Mobility</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Card 5: Membership Details */}
          <View className="gap-3">
            <Text className="text-[#111827] text-base font-black tracking-tight">Active Membership</Text>
            <View className="bg-zinc-900 p-6 rounded-[28px] shadow-lg relative overflow-hidden">
              {/* Abstract luxury backdrop mesh glow */}
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
                className="w-full bg-white/10 border border-white/10 py-3 rounded-2xl items-center"
              >
                <Text className="text-white text-xs font-bold uppercase tracking-wider">Manage Membership</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Card 6: Notifications Preview */}
          <View className="gap-3">
            <Text className="text-[#111827] text-base font-black tracking-tight">Notifications Preview</Text>
            <View className="bg-white border border-zinc-150 p-5 rounded-[28px] shadow-sm gap-4">
              {notifications.slice(0, 3).map((item, idx) => (
                <View 
                  key={item.id}
                  className={`flex-row items-start gap-3 ${
                    idx > 0 ? 'border-t border-zinc-100 pt-3.5' : ''
                  }`}
                >
                  <View className="w-8 h-8 rounded-full bg-indigo-50 justify-center items-center mt-0.5">
                    <Feather name="bell" size={12} color="#4F46E5" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[#111827] text-xs font-extrabold tracking-tight">{item.title}</Text>
                    <Text className="text-[#6B7280] text-[10px] font-semibold mt-0.5" numberOfLines={1}>
                      {item.body}
                    </Text>
                  </View>
                  <Text className="text-zinc-400 text-[8px] font-bold uppercase">{item.timestamp}</Text>
                </View>
              ))}
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaViewWrapper>
  );
}

// Sub-layout components
function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return <View className="flex-1 bg-[#F8F9FB] pt-12">{children}</View>;
  }
  return <View className="flex-1 bg-[#F8F9FB]">{children}</View>;
}
