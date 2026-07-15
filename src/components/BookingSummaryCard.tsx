import React from 'react';
import { View, Text, Image } from 'react-native';

interface BookingSummaryCardProps {
  workoutTitle: string;
  workoutIcon: string;
  coachName: string;
  coachPhoto: string;
  date: string;
  time: string;
  location: string;
  creditsBefore: number;
}

export function BookingSummaryCard({
  workoutTitle,
  workoutIcon,
  coachName,
  coachPhoto,
  date,
  time,
  location,
  creditsBefore,
}: BookingSummaryCardProps) {
  return (
    <View className="bg-zinc-50 border border-zinc-100 p-6 rounded-[24px] gap-5">
      {/* Session Details Row */}
      <View className="flex-row items-center justify-between pb-4 border-b border-zinc-200/50">
        <View className="flex-row items-center gap-3">
          <View className="w-12 h-12 rounded-xl bg-white border border-zinc-100 items-center justify-center">
            <Text className="text-xl">{workoutIcon}</Text>
          </View>
          <View>
            <Text className="text-primary text-base font-black tracking-tight">{workoutTitle}</Text>
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Workout type</Text>
          </View>
        </View>
      </View>

      {/* Assigned Coach Row */}
      <View className="flex-row items-center justify-between pb-4 border-b border-zinc-200/50">
        <View className="flex-row items-center gap-3">
          <Image
            source={{ uri: coachPhoto }}
            className="w-12 h-12 rounded-full border border-zinc-100"
          />
          <View>
            <Text className="text-primary text-base font-black tracking-tight">{coachName}</Text>
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Assigned Coach</Text>
          </View>
        </View>
      </View>

      {/* Appointment Specifics Grid */}
      <View className="gap-3">
        <View className="flex-row justify-between items-center">
          <Text className="text-zinc-500 text-xs font-semibold">Date</Text>
          <Text className="text-primary text-xs font-black tracking-tight">📅 {date}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-zinc-500 text-xs font-semibold">Time</Text>
          <Text className="text-primary text-xs font-black tracking-tight">⏱️ {time}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-zinc-500 text-xs font-semibold">Location</Text>
          <Text className="text-primary text-xs font-black tracking-tight">📍 {location}</Text>
        </View>
      </View>

      {/* Credits Calculations */}
      <View className="border-t border-zinc-200/50 pt-4 gap-2">
        <View className="flex-row justify-between items-center">
          <Text className="text-zinc-500 text-xs font-semibold">Credits Required</Text>
          <Text className="text-primary text-xs font-black">1 Credit</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-zinc-500 text-xs font-semibold">Remaining Balance</Text>
          <Text className="text-green-500 text-xs font-black">
            {creditsBefore - 1} Credits
          </Text>
        </View>
      </View>

      {/* Cancellation Warning Notice */}
      <View className="bg-zinc-100/50 p-3 rounded-2xl border border-zinc-200/30">
        <Text className="text-[10px] text-zinc-400 leading-normal font-semibold">
          🛡️ <Text className="font-extrabold text-zinc-500">Cancellation Policy:</Text> Free cancellations or rescheduling permitted up to 4 hours before the session starts.
        </Text>
      </View>
    </View>
  );
}
