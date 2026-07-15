import React, { useState, useEffect } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Image, ScrollView, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useCoachStore } from '../store/coachStore';
import { BookingStatusBadge } from '../components/BookingStatusBadge';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';

export default function SessionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { bookings, cancelSession } = useBookingStore();
  const { workouts } = useWorkoutStore();
  const { coaches } = useCoachStore();

  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];

  // Checklist state
  const [checklist, setChecklist] = useState({
    towel: false,
    water: false,
    shoes: false,
  });

  // Simulated countdown timer (12 hours, 45 minutes, 30 seconds remaining)
  const [secondsLeft, setSecondsLeft] = useState(12 * 3600 + 45 * 60 + 30);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-zinc-400 font-semibold">No booking details found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-zinc-900 px-6 py-2 rounded-full">
          <Text className="text-white font-bold text-xs">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const coach = coaches.find(c => c.name === booking.trainerName.replace('Coach ', '').replace(' (Requested)', ''));
  const workout = workouts.find(w => w.title === booking.workoutTitle);

  const formatCountdown = () => {
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const handleCoachDetails = () => {
    if (booking.trainerName.includes('Assigning')) {
      Alert.alert(
        'Coach Assignment in Progress',
        'We are currently matching the best available certified VIRLA coach for your session. You will receive an alert once matched.'
      );
      return;
    }
    if (coach) {
      router.push({
        pathname: '/coach-profile' as any,
        params: { id: coach.id }
      });
    } else {
      Alert.alert('Details Unavailable', 'Coach profile cannot be loaded.');
    }
  };

  const handleNavigateMap = () => {
    Alert.alert('Navigation Active', `Getting GPS route directions to training venue: ${booking.address}`);
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel this wellness session? Your membership credit will be refunded.',
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: () => {
            cancelSession(booking.id);
            Alert.alert('Session Cancelled', 'Your home session has been successfully cancelled.');
          },
        },
      ]
    );
  };

  const isUpcoming = booking.status === 'upcoming';

  // Render a Mock premium QR Code using SVG rect grids
  const renderMockQRCode = () => {
    const qrMatrix = [
      [1, 1, 1, 1, 0, 1, 1, 1, 1],
      [1, 0, 0, 1, 0, 1, 0, 0, 1],
      [1, 0, 0, 1, 1, 1, 0, 0, 1],
      [1, 1, 1, 1, 0, 1, 1, 1, 1],
      [0, 0, 1, 0, 1, 0, 1, 0, 0],
      [1, 1, 0, 1, 0, 1, 0, 1, 1],
      [1, 0, 0, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 1, 0, 1, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];
    const cellSize = 14;
    return (
      <View className="bg-white border border-[#E5E7EB] p-4 rounded-3xl shadow-sm items-center justify-center">
        <Svg width={cellSize * 9} height={cellSize * 9}>
          {qrMatrix.map((row, rIdx) =>
            row.map((val, cIdx) => (
              <Rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx * cellSize}
                y={rIdx * cellSize}
                width={cellSize - 2}
                height={cellSize - 2}
                fill={val === 1 ? '#111827' : '#FFFFFF'}
              />
            ))
          )}
        </Svg>
        <Text className="text-[#6B7280] text-[9px] font-black uppercase tracking-wider mt-3">
          QR Session Check-In
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header back bar */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#111827] text-base font-black tracking-tight mr-8">
          Session Details
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          {/* Section 1: Live Countdown (Premium Feature) */}
          {isUpcoming && (
            <View className="bg-zinc-900 p-6 rounded-[28px] shadow-lg relative overflow-hidden items-center justify-center">
              <View className="absolute w-36 h-36 rounded-full bg-indigo-500/10 -bottom-12 -right-12 blur-xl" />
              <Text className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">Starts In</Text>
              <Text className="text-white text-3xl font-black mt-2 tracking-tighter">{formatCountdown()}</Text>
              <Text className="text-zinc-400 text-[9px] font-bold mt-1.5 uppercase">Tomorrow • {booking.time}</Text>
            </View>
          )}

          {/* Section 2: Header Info Card */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleCoachDetails}
                className="flex-row items-center gap-3 flex-1"
              >
                <Image
                  source={{ uri: booking.trainerPhoto }}
                  className="w-12 h-12 rounded-full border border-[#E5E7EB]"
                />
                <View className="flex-1">
                  <Text className="text-[#111827] text-base font-black tracking-tight">
                    {booking.trainerName.includes('Assigning') ? booking.trainerName : `Coach ${booking.trainerName}`}
                  </Text>
                  {!booking.trainerName.includes('Assigning') ? (
                    <Text className="text-[#4F46E5] text-[9px] font-black uppercase tracking-wider">
                      View Coach Profile
                    </Text>
                  ) : (
                    <Text className="text-[#6B7280] text-[9px] font-bold uppercase tracking-wider">
                      Auto-matching active
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              <BookingStatusBadge status={booking.status} />
            </View>
          </View>

          {/* Section 3: Training Info (Workout & Date/Time Details) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-indigo-50/50 justify-center items-center">
                <Text className="text-lg">🏋️‍♂️</Text>
              </View>
              <View>
                <Text className="text-[#6B7280] text-[9px] font-black uppercase">Workout Program</Text>
                <Text className="text-[#111827] text-sm font-extrabold">{booking.workoutTitle}</Text>
              </View>
            </View>

            <View className="h-[1px] bg-[#E5E7EB] my-1" />

            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Text className="text-base">📅</Text>
                <View>
                  <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Date</Text>
                  <Text className="text-[#111827] text-xs font-extrabold mt-0.5">{booking.date}</Text>
                </View>
              </View>
              <View className="w-[1px] h-8 bg-[#E5E7EB]" />
              <View className="flex-row items-center gap-2">
                <Text className="text-base">⏱️</Text>
                <View>
                  <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Time</Text>
                  <Text className="text-[#111827] text-xs font-extrabold mt-0.5">{booking.time}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Section 4: Training Venue & Navigation */}
          <View className="gap-2.5">
            <Text className="text-[#111827] text-sm font-black tracking-tight">📍 Training Venue</Text>
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
              <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed">
                {booking.address || 'Worli, Mumbai, India'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleNavigateMap}
                className="w-full bg-[#111827] py-3 rounded-2xl flex-row items-center justify-center gap-2 shadow-xs"
              >
                <Feather name="navigation" size={14} color="white" />
                <Text className="text-white text-xs font-extrabold tracking-wide">Get Directions</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section 5: Interactive Preparation Checklist */}
          {isUpcoming && (
            <View className="gap-2.5">
              <Text className="text-[#111827] text-sm font-black tracking-tight">🧘 Preparation Checklist</Text>
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-3">
                <Text className="text-[#6B7280] text-[10px] font-bold leading-normal mb-1">
                  Keep these items ready before the coach arrives:
                </Text>
                
                {/* Check 1 */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setChecklist({ ...checklist, towel: !checklist.towel })}
                  className="flex-row items-center justify-between py-2 border-b border-[#E5E7EB]/50"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Feather name="check" size={14} color={checklist.towel ? '#22C55E' : '#9CA3AF'} />
                    <Text className={`text-xs font-semibold ${checklist.towel ? 'text-zinc-400 line-through' : 'text-[#111827]'}`}>
                      Bring clean gym towel
                    </Text>
                  </View>
                  <View className={`w-4 h-4 rounded border items-center justify-center ${checklist.towel ? 'bg-[#22C55E] border-[#22C55E]' : 'border-zinc-300'}`}>
                    {checklist.towel && <Feather name="check" size={10} color="white" />}
                  </View>
                </TouchableOpacity>

                {/* Check 2 */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setChecklist({ ...checklist, water: !checklist.water })}
                  className="flex-row items-center justify-between py-2 border-b border-[#E5E7EB]/50"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Feather name="droplet" size={14} color={checklist.water ? '#22C55E' : '#9CA3AF'} />
                    <Text className={`text-xs font-semibold ${checklist.water ? 'text-zinc-400 line-through' : 'text-[#111827]'}`}>
                      Keep hydration water ready
                    </Text>
                  </View>
                  <View className={`w-4 h-4 rounded border items-center justify-center ${checklist.water ? 'bg-[#22C55E] border-[#22C55E]' : 'border-zinc-300'}`}>
                    {checklist.water && <Feather name="check" size={10} color="white" />}
                  </View>
                </TouchableOpacity>

                {/* Check 3 */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setChecklist({ ...checklist, shoes: !checklist.shoes })}
                  className="flex-row items-center justify-between py-2"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Feather name="heart" size={14} color={checklist.shoes ? '#22C55E' : '#9CA3AF'} />
                    <Text className={`text-xs font-semibold ${checklist.shoes ? 'text-zinc-400 line-through' : 'text-[#111827]'}`}>
                      Wear indoor training shoes
                    </Text>
                  </View>
                  <View className={`w-4 h-4 rounded border items-center justify-center ${checklist.shoes ? 'bg-[#22C55E] border-[#22C55E]' : 'border-zinc-300'}`}>
                    {checklist.shoes && <Feather name="check" size={10} color="white" />}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Section 6: QR Code Check-in */}
          {isUpcoming && (
            <View className="items-center py-4">
              {renderMockQRCode()}
            </View>
          )}

          {/* Section 7: Cancel Session */}
          {isUpcoming && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCancel}
              className="w-full bg-rose-50 border border-rose-100 py-4 rounded-2xl items-center justify-center"
            >
              <Text className="text-[#EF4444] text-xs font-extrabold uppercase tracking-wider">Cancel Session</Text>
            </TouchableOpacity>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
