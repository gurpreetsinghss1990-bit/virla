import React, { useEffect, useState } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface BookingSuccessAnimationProps {
  workoutTitle: string;
  workoutDuration: number;
  selectedDate: string;
  selectedTime: string;
  locationAddress: string;
  successBookingId: string;
  onViewSession: (id: string) => void;
  onBackToHome: () => void;
}

export const BookingSuccessAnimation: React.FC<BookingSuccessAnimationProps> = ({
  workoutTitle,
  workoutDuration,
  selectedDate,
  selectedTime,
  locationAddress,
  successBookingId,
  onViewSession,
  onBackToHome,
}) => {
  const [successScaleAnim] = useState(() => new Animated.Value(0));
  const [successOpacityAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    successScaleAnim.setValue(0);
    successOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(successScaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [successScaleAnim, successOpacityAnim]);

  return (
    <View className="items-center gap-6 py-4">
      {/* Success Animation: Confetti/Pulse and popping checkmark */}
      <Animated.View
        style={{
          transform: [{ scale: successScaleAnim }],
          opacity: successOpacityAnim,
        }}
        className="w-20 h-20 rounded-full bg-emerald-500 items-center justify-center shadow-lg relative"
      >
        {/* Ring Pulse */}
        <View className="absolute inset-0 rounded-full bg-emerald-500 opacity-20 animate-ping" />
        <Feather name="check" size={40} color="white" />
      </Animated.View>

      {/* Success Message */}
      <View className="items-center gap-2 px-4">
        <Text className="text-[#101828] text-2xl font-black tracking-tight text-center">Session Confirmed</Text>
        <Text className="text-zinc-500 text-xs font-semibold text-center leading-relaxed max-w-[85%]">
          Your VIRLA wellness session has been successfully booked. Relax. We&apos;ve taken care of everything.
        </Text>
      </View>

      {/* Session Details Card */}
      <View 
        className="w-full bg-white border border-[#E5E7EB] p-5.5 rounded-[28px] gap-4"
        style={{
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.03,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pl-1">Booking Details</Text>
        
        <View className="gap-3.5">
          <View className="flex-row justify-between items-center">
            <Text className="text-[#6B7280] text-xs font-semibold">Workout Experience</Text>
            <Text className="text-[#101828] text-xs font-extrabold">{workoutTitle}</Text>
          </View>

          <View className="flex-row justify-between items-center">
            <Text className="text-[#6B7280] text-xs font-semibold">Coach Assignment</Text>
            <View className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
              <Text className="text-blue-600 text-[8px] font-black uppercase">Matching Best Coach</Text>
            </View>
          </View>

          <View className="flex-row justify-between items-center">
            <Text className="text-[#6B7280] text-xs font-semibold">Scheduled Date</Text>
            <Text className="text-[#101828] text-xs font-extrabold">{selectedDate}</Text>
          </View>

          <View className="flex-row justify-between items-center">
            <Text className="text-[#6B7280] text-xs font-semibold">Time Slot</Text>
            <Text className="text-[#101828] text-xs font-extrabold">{selectedTime}</Text>
          </View>

          <View className="flex-row justify-between items-start">
            <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">Location</Text>
            <Text className="text-[#101828] text-xs font-extrabold max-w-[65%] text-right leading-relaxed">
              {locationAddress || 'Selected Location'}
            </Text>
          </View>

          <View className="h-[1px] bg-zinc-100 my-1" />

          <View className="flex-row justify-between items-center">
            <Text className="text-[#6B7280] text-xs font-semibold">Credits Used</Text>
            <Text className="text-emerald-600 text-xs font-black">1 Credit</Text>
          </View>
        </View>
      </View>

      {/* Next Steps Timeline */}
      <View 
        className="w-full bg-white border border-[#E5E7EB] p-5.5 rounded-[28px] gap-4"
        style={{
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.03,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        <Text className="text-[#101828] text-xs font-black uppercase tracking-wider pl-1">What Happens Next</Text>
        
        <View className="gap-5 pl-1 relative">
          {/* Vertical line indicator */}
          <View className="absolute left-[9px] top-2.5 bottom-2.5 w-[1px] bg-zinc-100" />

          <View className="flex-row items-start gap-4">
            <View className="w-5 h-5 rounded-full bg-emerald-500 items-center justify-center z-10 border-2 border-white">
              <Feather name="check" size={10} color="white" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[#101828] text-xs font-black">Booking Confirmed</Text>
              <Text className="text-[#6B7280] text-[10px] font-medium leading-relaxed">Your wellness session request has been secured in our system.</Text>
            </View>
          </View>

          <View className="flex-row items-start gap-4">
            <View className="w-5 h-5 rounded-full bg-amber-500 items-center justify-center z-10 border-2 border-white">
              <Feather name="user" size={10} color="white" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[#101828] text-xs font-black">Coach Assignment</Text>
              <Text className="text-[#6B7280] text-[10px] font-medium leading-relaxed">We will match you with the best available VIRLA coach shortly.</Text>
            </View>
          </View>

          <View className="flex-row items-start gap-4">
            <View className="w-5 h-5 rounded-full bg-blue-500 items-center justify-center z-10 border-2 border-white">
              <Feather name="bell" size={10} color="white" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[#101828] text-xs font-black">Details Shared</Text>
              <Text className="text-[#6B7280] text-[10px] font-medium leading-relaxed">Coach profile vehicle description is unlocked 5 hours prior to training.</Text>
            </View>
          </View>

          <View className="flex-row items-start gap-4">
            <View className="w-5 h-5 rounded-full bg-zinc-200 items-center justify-center z-10 border-2 border-white">
              <Feather name="map-pin" size={10} color="white" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[#101828] text-xs font-black">Live Session Tracking</Text>
              <Text className="text-[#6B7280] text-[10px] font-medium leading-relaxed">Track your trainer on map in real time as they travel to your venue.</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Primary CTA Buttons */}
      <View className="w-full gap-3 mt-4">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onViewSession(successBookingId)}
          className="w-full bg-[#E11D48] py-4 rounded-2xl items-center justify-center"
          style={{
            shadowColor: '#E11D48',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text className="text-white text-xs font-black uppercase tracking-wider">View My Session</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onBackToHome}
          className="w-full bg-white border border-[#E5E7EB] py-4 rounded-2xl items-center justify-center"
        >
          <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
