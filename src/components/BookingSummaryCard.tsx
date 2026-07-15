import React from 'react';
import { View, Text } from 'react-native';

interface BookingSummaryCardProps {
  workoutTitle: string;
  workoutIcon: string;
  duration: number;
  date: string;
  time: string;
  price: number;
  useCreditsMode: boolean;
}

export function BookingSummaryCard({
  workoutTitle,
  workoutIcon,
  duration,
  date,
  time,
  price,
  useCreditsMode,
}: BookingSummaryCardProps) {
  // Calculations
  const basePrice = price;
  const discount = useCreditsMode ? basePrice : Math.round(basePrice * 0.15); // 15% discount for cash, 100% for credits
  const taxableAmount = basePrice - discount;
  const gst = useCreditsMode ? 0 : Math.round(taxableAmount * 0.18); // 18% GST
  const finalAmount = useCreditsMode ? 0 : (taxableAmount + gst);
  const creditsUsed = useCreditsMode ? 1 : 0;

  return (
    <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-5 shadow-xs">
      {/* Session Details Row */}
      <View className="flex-row items-center gap-3 pb-4 border-b border-[#E5E7EB]/60">
        <View className="w-12 h-12 rounded-2xl bg-indigo-50/50 items-center justify-center">
          <Text className="text-xl">{workoutIcon}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[#111827] text-base font-extrabold tracking-tight">{workoutTitle}</Text>
          <Text className="text-[#6B7280] text-[9px] font-bold uppercase tracking-wider">At-Home Workout</Text>
        </View>
      </View>

      {/* Appointment Specifics Grid */}
      <View className="gap-3 pb-4 border-b border-[#E5E7EB]/60">
        <View className="flex-row justify-between items-start">
          <Text className="text-[#6B7280] text-xs font-semibold">Date</Text>
          <Text className="text-[#111827] text-xs font-extrabold tracking-tight">📅 {date}</Text>
        </View>
        <View className="flex-row justify-between items-start">
          <Text className="text-[#6B7280] text-xs font-semibold">Time</Text>
          <Text className="text-[#111827] text-xs font-extrabold tracking-tight">⏱️ {time}</Text>
        </View>
        <View className="flex-row justify-between items-start">
          <Text className="text-[#6B7280] text-xs font-semibold">Estimated Duration</Text>
          <Text className="text-[#111827] text-xs font-extrabold tracking-tight">⏱️ {duration} mins</Text>
        </View>
      </View>

      {/* Detailed Receipt Breakdown */}
      <View className="gap-2.5">
        <View className="flex-row justify-between items-center">
          <Text className="text-[#6B7280] text-xs font-semibold">Session Price</Text>
          <Text className="text-[#111827] text-xs font-extrabold">₹{basePrice}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-[#6B7280] text-xs font-semibold">Discount</Text>
          <Text className="text-[#22C55E] text-xs font-extrabold">-₹{discount}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-[#6B7280] text-xs font-semibold">GST (18%)</Text>
          <Text className="text-[#111827] text-xs font-extrabold">₹{gst}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text className="text-[#6B7280] text-xs font-semibold">Credits Used</Text>
          <Text className="text-[#4F46E5] text-xs font-extrabold">{creditsUsed} Credit</Text>
        </View>
        
        <View className="h-[1px] bg-[#E5E7EB] my-1" />
        
        <View className="flex-row justify-between items-center">
          <Text className="text-[#111827] text-sm font-black">Final Amount</Text>
          <Text className="text-[#111827] text-lg font-black">
            {useCreditsMode ? '₹0 (1 Credit)' : `₹${finalAmount}`}
          </Text>
        </View>
      </View>

      {/* Cancellation Notice */}
      <View className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
        <Text className="text-[10px] text-[#6B7280] leading-normal font-semibold">
          🛡️ <Text className="font-extrabold text-[#111827]">Cancellation Policy:</Text> Free cancellations or rescheduling permitted up to 4 hours before the session starts.
        </Text>
      </View>
    </View>
  );
}
