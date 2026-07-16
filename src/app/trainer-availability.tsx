import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useCoachStore } from '../store/coachStore';
import { ProgressRing } from '../components/ProgressRing';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function TrainerAvailabilityScreen() {
  const router = useRouter();
  const { 
    weeklySchedule, 
    remainingSlotChanges, 
    toggleSlotAvailability, 
    editScheduleSlot,
  } = useCoachStore();

  const [activeDay, setActiveDay] = useState('Mon');
  const daysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Current statistics (Sprint 7.1 Promotion metrics)
  const sessionsCompleted = 420;
  const sessionsReq = 500;
  const averageRating = 4.91;
  const ratingReq = 4.90;
  const attendanceRate = 98;
  const attendanceReq = 98;
  const punctualityRate = 99;
  const punctualityReq = 99;

  // Validation rules check
  const isSessionsValid = sessionsCompleted >= sessionsReq;
  const isRatingValid = averageRating >= ratingReq;
  const isAttendanceValid = attendanceRate >= attendanceReq;
  const isPunctualityValid = punctualityRate >= punctualityReq;

  // Overall status check (requires ALL parameters to be qualified)
  const isEligibleForPromotion = isSessionsValid && isRatingValid && isAttendanceValid && isPunctualityValid;
  const promotionStatus = isEligibleForPromotion 
    ? 'Eligible for Promotion' 
    : (!isSessionsValid || !isRatingValid || !isAttendanceValid || !isPunctualityValid) 
    ? 'Promotion On Hold' 
    : 'Keep Going';

  // Calculate current active slots in the schedule
  const activeSlots = weeklySchedule.filter(s => s.isAvailable);
  const activePrimeCount = activeSlots.filter(s => s.isPrime).length;
  const activeOffPeakCount = activeSlots.filter(s => !s.isPrime).length;
  const totalActiveCount = activeSlots.length;

  // Retainer Rules: Min 24 Prime, Min 12 Off-Peak, Total 36
  const isRetainerEligible = activePrimeCount >= 24 && activeOffPeakCount >= 12 && totalActiveCount >= 36;

  // Filter slots for active display day
  const dailySlots = weeklySchedule.filter(s => s.day === activeDay);

  // Time slots database to allow edits
  const primeOptions = [
    '07:00 AM - 08:00 AM',
    '08:00 AM - 09:00 AM',
    '05:00 PM - 06:00 PM',
    '06:00 PM - 07:00 PM'
  ];

  const offPeakOptions = [
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM',
    '07:00 PM - 08:00 PM',
    '09:00 PM - 10:00 PM'
  ];

  const handleEditTimeSlot = (slotId: string, currentIsPrime: boolean, currentTime: string) => {
    const options = currentIsPrime ? primeOptions : offPeakOptions;
    const filteredOptions = options.filter(t => t !== currentTime);

    Alert.alert(
      'Replace Time Slot',
      `Select a new ${currentIsPrime ? 'Prime' : 'Off-Peak'} slot to replace this.`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...filteredOptions.map((timeOption) => ({
          text: timeOption,
          onPress: () => {
            const success = editScheduleSlot(slotId, timeOption);
            if (success) {
              Alert.alert('Slot Updated', `Time slot updated to: ${timeOption}. Remaining Changes: ${remainingSlotChanges - 1}/2`);
            }
          }
        })),
        {
          text: `Replace with ${currentIsPrime ? 'Off-Peak' : 'Prime'} (Test Policy Check)`,
          onPress: () => {
            Alert.alert('Policy Rejection ⚠️', `Prime slots can only be replaced with another Prime slot, and Off-Peak with Off-Peak to preserve retainer compliance.`);
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#111827] text-sm font-black uppercase tracking-wider mr-8">
          Weekly Availability
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="gap-6">

          {/* Section 1: Promotion Progress Card (Feature 3) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
              <View>
                <Text className="text-zinc-400 text-[8px] font-black uppercase">Current Rank</Text>
                <Text className="text-zinc-900 text-sm font-black mt-0.5">Associate Trainer</Text>
              </View>
              <View className="bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full">
                <Text className="text-[#4F46E5] text-[8px] font-black uppercase tracking-wider">Progress to Certified</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-center py-2 gap-6">
              {/* Circular progress ring representing completed sessions progress (420/500 = 84%) */}
              <ProgressRing progress={sessionsCompleted / sessionsReq} size={88} strokeWidth={8} activeColor="#4F46E5">
                <View className="items-center justify-center">
                  <Text className="text-[#111827] text-base font-black">84%</Text>
                  <Text className="text-zinc-400 text-[6px] font-black uppercase mt-0.5">Complete</Text>
                </View>
              </ProgressRing>

              {/* Promotion Requirement Checklist */}
              <View className="flex-1 gap-2">
                <View className="flex-row justify-between items-center border-b border-zinc-50 pb-1">
                  <Text className="text-zinc-500 text-[9px] font-bold">Sessions: {sessionsCompleted} / {sessionsReq}</Text>
                  <Text className={`text-[10px] font-black ${isSessionsValid ? 'text-green-600' : 'text-red-500'}`}>
                    {isSessionsValid ? '✓' : '✗'}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center border-b border-zinc-50 pb-1">
                  <Text className="text-zinc-500 text-[9px] font-bold">Rating: {averageRating} / {ratingReq}</Text>
                  <Text className={`text-[10px] font-black ${isRatingValid ? 'text-green-600' : 'text-red-500'}`}>
                    {isRatingValid ? '✓' : '✗'}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center border-b border-zinc-50 pb-1">
                  <Text className="text-zinc-500 text-[9px] font-bold">Attendance: {attendanceRate}% / {attendanceReq}%</Text>
                  <Text className={`text-[10px] font-black ${isAttendanceValid ? 'text-green-600' : 'text-red-500'}`}>
                    {isAttendanceValid ? '✓' : '✗'}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-zinc-500 text-[9px] font-bold">Punctuality: {punctualityRate}% / {punctualityReq}%</Text>
                  <Text className={`text-[10px] font-black ${isPunctualityValid ? 'text-green-600' : 'text-red-500'}`}>
                    {isPunctualityValid ? '✓' : '✗'}
                  </Text>
                </View>
              </View>
            </View>

            <View className="h-[1px] bg-zinc-100 my-1" />

            <View className="flex-row justify-between items-center px-1">
              <Text className="text-zinc-400 text-[8px] font-black uppercase">Overall Promotion Status</Text>
              <View className={`px-2.5 py-0.5 rounded-full ${
                promotionStatus === 'Eligible for Promotion' 
                  ? 'bg-emerald-50 border border-emerald-150' 
                  : 'bg-amber-50 border border-amber-150'
              }`}>
                <Text className={`text-[8px] font-black uppercase ${
                  promotionStatus === 'Eligible for Promotion' ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {promotionStatus}
                </Text>
              </View>
            </View>
          </View>

          {/* Section 2: Availability Retainer Monthly Status Dashboard (Feature 4) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
              <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Availability Retainer</Text>
              <View className="bg-red-50 border border-red-150 px-2 py-0.5 rounded-full">
                <Text className="text-red-500 text-[8px] font-black uppercase tracking-widest">Monthly Status</Text>
              </View>
            </View>

            <View className="gap-3 px-1">
              <View className="flex-row justify-between items-center border-b border-zinc-50 pb-2">
                <Text className="text-zinc-500 text-xs font-semibold">Week 1 Status</Text>
                <Text className="text-green-600 text-xs font-black">Qualified ✓</Text>
              </View>
              
              <View className="border-b border-zinc-50 pb-2">
                <View className="flex-row justify-between items-center">
                  <Text className="text-zinc-500 text-xs font-semibold">Week 2 Status</Text>
                  <Text className="text-red-500 text-xs font-black">Missed Prime Slots ✗</Text>
                </View>
                <Text className="text-red-400 text-[8px] font-bold uppercase mt-0.5 pl-0.5">⚠️ Reason: Only 22 Prime Slots Submitted</Text>
              </View>

              <View className="flex-row justify-between items-center border-b border-zinc-50 pb-2">
                <Text className="text-zinc-500 text-xs font-semibold">Week 3 Status</Text>
                <Text className="text-green-600 text-xs font-black">Qualified ✓</Text>
              </View>

              <View className="pb-1">
                <View className="flex-row justify-between items-center">
                  <Text className="text-zinc-500 text-xs font-semibold">Week 4 Status</Text>
                  <Text className="text-[#4F46E5] text-xs font-black">Pending ⏰</Text>
                </View>
                <Text className="text-indigo-400 text-[8px] font-bold uppercase mt-0.5 pl-0.5">⚠️ Reason: Only 10 Off Peak Slots Submitted</Text>
              </View>

              <View className="h-[1px] bg-zinc-150 my-2" />

              <View className="flex-row justify-between items-center bg-red-50/50 p-3.5 rounded-xl">
                <View>
                  <Text className="text-zinc-400 text-[7px] font-black uppercase">Current Month Payout Result</Text>
                  <Text className="text-red-700 text-xs font-black mt-0.5">Not Eligible</Text>
                </View>
                <Text className="text-red-500 text-[8px] font-black uppercase text-right leading-relaxed max-w-[50%]">
                  Missed Prime Slot minimum compliance in Week 2.
                </Text>
              </View>
            </View>
          </View>

          {/* Section 3: Schedule edit policy info */}
          <View className="bg-zinc-50 border border-zinc-150 p-4.5 rounded-[24px] flex-row justify-between items-center">
            <View className="flex-row items-center gap-2.5">
              <Feather name="edit-3" size={14} color="#4F46E5" />
              <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Slot Edit Allowance</Text>
            </View>
            <View className="bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-lg">
              <Text className="text-amber-400 text-[9px] font-black uppercase tracking-wider">
                Remaining Changes: {remainingSlotChanges}/2
              </Text>
            </View>
          </View>

          {/* Section 4: Day Selector Tabs */}
          <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1 rounded-2xl">
            {daysList.map((day) => {
              const isAct = activeDay === day;
              return (
                <TouchableOpacity
                  key={day}
                  activeOpacity={0.8}
                  onPress={() => setActiveDay(day)}
                  className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
                    isAct ? 'bg-[#111827] shadow-xs' : ''
                  }`}
                >
                  <Text className={`text-[9px] font-black uppercase tracking-wider ${isAct ? 'text-white' : 'text-[#6B7280]'}`}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Section 5: Planner Grid Slots details */}
          <View className="gap-3.5">
            {dailySlots.map((slot) => {
              return (
                <View 
                  key={slot.id}
                  className={`p-4.5 rounded-[24px] border flex-row justify-between items-center shadow-xs ${
                    slot.isAvailable ? 'bg-white border-zinc-200' : 'bg-zinc-100/50 border-zinc-200/50'
                  }`}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={slot.isBooked}
                    onPress={() => toggleSlotAvailability(slot.id)}
                    className="flex-row items-center gap-3.5 flex-1 pr-4"
                  >
                    {/* Checkbox box indicator */}
                    <View className={`w-5 h-5 rounded-md border justify-center items-center ${
                      slot.isBooked 
                        ? 'bg-zinc-200 border-zinc-200'
                        : slot.isAvailable 
                        ? 'bg-indigo-600 border-indigo-600' 
                        : 'border-zinc-300 bg-white'
                    }`}>
                      {slot.isBooked ? (
                        <Feather name="lock" size={10} color="#6B7280" />
                      ) : slot.isAvailable ? (
                        <Feather name="check" size={10} color="white" />
                      ) : null}
                    </View>

                    <View className="gap-1 flex-1">
                      <Text className={`text-xs font-black ${
                        slot.isBooked ? 'text-zinc-400' : slot.isAvailable ? 'text-zinc-950' : 'text-zinc-500'
                      }`}>
                        {slot.time}
                      </Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <Text className={`text-[8px] font-black uppercase ${slot.isPrime ? 'text-amber-500' : 'text-zinc-400'}`}>
                          {slot.isPrime ? '★ Prime Slot' : 'Off-Peak Slot'}
                        </Text>
                        {slot.isBooked && (
                          <>
                            <Text className="text-zinc-300 text-[8px]">•</Text>
                            <Text className="text-indigo-600 text-[8px] font-black uppercase">Booked Session</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Edit Slot Time trigger */}
                  {!slot.isBooked && slot.isAvailable && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleEditTimeSlot(slot.id, slot.isPrime, slot.time)}
                      className="bg-zinc-50 border border-zinc-150 w-8 h-8 rounded-full items-center justify-center shadow-xs"
                    >
                      <Feather name="edit-2" size={12} color="#6B7280" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
