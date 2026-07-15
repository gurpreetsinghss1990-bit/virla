import React from 'react';
import { View, Text } from 'react-native';

interface BookingSummaryCardProps {
  workoutTitle: string;
  workoutIcon: string;
  goal: string;
  date: string;
  time: string;
  address: string;
  price: number;
  creditsBefore: number;
  useCreditsMode: boolean;
}

export function BookingSummaryCard({
  workoutTitle,
  workoutIcon,
  goal,
  date,
  time,
  address,
  price,
  creditsBefore,
  useCreditsMode,
}: BookingSummaryCardProps) {
  // Calculations
  const basePrice = price;
  const membershipDiscount = useCreditsMode ? basePrice : Math.round(basePrice * 0.15); // 15% discount if cash, 100% if credits
  const taxes = useCreditsMode ? 0 : Math.round((basePrice - membershipDiscount) * 0.18); // 18% GST
  const totalAmount = useCreditsMode ? 0 : (basePrice - membershipDiscount + taxes);
  const creditsUsed = useCreditsMode ? 1 : 0;

  return (
    <View className="bg-zinc-50 border border-zinc-100 p-6 rounded-[28px] gap-5 shadow-sm">
      {/* Session Details Row */}
      <View className="flex-row items-center justify-between pb-4 border-b border-zinc-200/50">
        <View className="flex-row items-center gap-3">
          <View className="w-12 h-12 rounded-2xl bg-white border border-zinc-100 items-center justify-center shadow-xs">
            <Text className="text-xl">{workoutIcon}</Text>
          </View>
          <View>
            <Text className="text-primary text-base font-black tracking-tight">{workoutTitle}</Text>
            <Text className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Workout Category</Text>
          </View>
        </View>
      </View>

      {/* Goal Row */}
      <View className="flex-row items-center justify-between pb-4 border-b border-zinc-200/50">
        <View className="flex-row items-center gap-3">
          <View className="w-12 h-12 rounded-2xl bg-white border border-zinc-100 items-center justify-center shadow-xs">
            <Text className="text-xl">🎯</Text>
          </View>
          <View>
            <Text className="text-primary text-base font-black tracking-tight">{goal}</Text>
            <Text className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Workout Goal</Text>
          </View>
        </View>
      </View>

      {/* Appointment Specifics Grid */}
      <View className="gap-3 pb-4 border-b border-zinc-200/50">
        <View className="flex-row justify-between items-start">
          <Text className="text-zinc-500 text-xs font-semibold">Date</Text>
          <Text className="text-primary text-xs font-black tracking-tight">📅 {date}</Text>
        </View>
        <View className="flex-row justify-between items-start">
          <Text className="text-zinc-500 text-xs font-semibold">Time</Text>
          <Text className="text-primary text-xs font-black tracking-tight">⏱️ {time}</Text>
        </View>
        <View className="flex-row justify-between items-start">
          <Text className="text-zinc-500 text-xs font-semibold mr-4">Address</Text>
          <Text className="text-primary text-xs font-black tracking-tight flex-1 text-right leading-tight">📍 {address}</Text>
        </View>
      </View>

      {/* Detailed Receipt Breakdown */}
      <View className="gap-2.5">
        <View className="flex-row justify-between items-center">
          <Text className="text-zinc-500 text-xs font-semibold">Session Price</Text>
          <Text className="text-primary text-xs font-bold">₹{basePrice}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-zinc-500 text-xs font-semibold">Membership Discount</Text>
          <Text className="text-orange-500 text-xs font-bold">-₹{membershipDiscount}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-zinc-500 text-xs font-semibold">Taxes (18% GST)</Text>
          <Text className="text-primary text-xs font-bold">₹{taxes}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-zinc-500 text-xs font-semibold">Credits Used</Text>
          <Text className="text-primary text-xs font-bold">{creditsUsed} Credit</Text>
        </View>
        
        <View className="h-[1px] bg-zinc-200/50 my-1" />
        
        <View className="flex-row justify-between items-center">
          <Text className="text-primary text-sm font-black">Total Amount</Text>
          <Text className="text-primary text-lg font-black">₹{totalAmount}</Text>
        </View>
      </View>

      {/* Cancellation Warning Notice */}
      <View className="bg-zinc-100/50 p-3.5 rounded-2xl border border-zinc-200/30 mt-1">
        <Text className="text-[10px] text-zinc-400 leading-normal font-semibold">
          🛡️ <Text className="font-extrabold text-zinc-500">Cancellation Policy:</Text> Free cancellations or rescheduling permitted up to 4 hours before the session starts.
        </Text>
      </View>
    </View>
  );
}
