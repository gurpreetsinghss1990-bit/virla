import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useCoachStore } from '../store/coachStore';
import { ProgressRing } from '../components/ProgressRing';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

export default function TrainerAvailabilityScreen() {
  const router = useRouter();
  const { 
    weeklySchedule, 
    remainingSlotChanges, 
    toggleSlotAvailability, 
    editScheduleSlot,
    isScheduleSubmitted,
    submitSchedule
  } = useCoachStore();

  const [activeDay, setActiveDay] = useState('Mon');
  const daysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Current statistics (Sprint 7 Promotion metrics)
  const sessionsCompleted = 420;
  const sessionsGoal = 500;
  const averageRating = 4.92;
  const attendanceRate = 99;
  const complianceRate = 100;
  const promotionProgress = sessionsCompleted / sessionsGoal; // 84%

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
    // Show select modal/alert with options of the SAME type
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
        // Add option to try replacing with a different slot type (to trigger validation failure check)
        {
          text: `Replace with ${currentIsPrime ? 'Off-Peak' : 'Prime'} (Test Policy Check)`,
          onPress: () => {
            // Fails validation check
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

          {/* Section 1: Promotion Progress Card (Feature 7) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
              <View>
                <Text className="text-zinc-400 text-[8px] font-black uppercase">Current Rank</Text>
                <Text className="text-zinc-900 text-sm font-black mt-0.5">Associate Trainer</Text>
              </View>
              <View className="bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full">
                <Text className="text-[#4F46E5] text-[8px] font-black uppercase tracking-wider">Level Progress</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-center py-2 gap-6">
              <ProgressRing progress={promotionProgress} size={88} strokeWidth={8} activeColor="#4F46E5">
                <View className="items-center justify-center">
                  <Text className="text-zinc-900 text-base font-black">84%</Text>
                  <Text className="text-zinc-400 text-[6px] font-black uppercase mt-0.5">Progress</Text>
                </View>
              </ProgressRing>

              <View className="flex-1 gap-2">
                <View className="flex-row justify-between items-center border-b border-zinc-50 pb-1">
                  <Text className="text-zinc-500 text-[9px] font-bold">Sessions Done</Text>
                  <Text className="text-zinc-900 text-[10px] font-black">{sessionsCompleted} / {sessionsGoal}</Text>
                </View>
                <View className="flex-row justify-between items-center border-b border-zinc-50 pb-1">
                  <Text className="text-zinc-500 text-[9px] font-bold">Average Rating</Text>
                  <Text className="text-zinc-900 text-[10px] font-black">{averageRating} / 5.0</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-zinc-500 text-[9px] font-bold">Attendance rate</Text>
                  <Text className="text-zinc-900 text-[10px] font-black">{attendanceRate}%</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Section 2: Retainer eligibility checker card (Feature 1 & 2) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
              <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Retainer Status Check</Text>
              
              {/* Eligibility badge */}
              <View className={`px-2.5 py-0.5 rounded-full ${
                isRetainerEligible 
                  ? 'bg-emerald-50 border border-emerald-150' 
                  : 'bg-red-50 border border-red-150'
              }`}>
                <Text className={`text-[8px] font-black uppercase tracking-widest ${
                  isRetainerEligible ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {isRetainerEligible ? 'Eligible' : 'Not Eligible'}
                </Text>
              </View>
            </View>

            {/* Availability Retainer Rules compliance stats */}
            <View className="gap-2 px-1">
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Prime slots count (Min 24)</Text>
                <Text className={`text-xs font-black ${activePrimeCount >= 24 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {activePrimeCount} / 24
                </Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Off-Peak slots count (Min 12)</Text>
                <Text className={`text-xs font-black ${activeOffPeakCount >= 12 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {activeOffPeakCount} / 12
                </Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-500 text-xs font-semibold">Overall schedule slots (Min 36)</Text>
                <Text className={`text-xs font-black ${totalActiveCount >= 36 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {totalActiveCount} / 36
                </Text>
              </View>

              <View className="h-[1px] bg-zinc-100 my-2" />

              <Text className={`text-[10px] font-extrabold text-center uppercase tracking-wide py-1 rounded-xl ${
                isRetainerEligible ? 'bg-emerald-50/50 text-emerald-700' : 'bg-red-50/50 text-red-500'
              }`}>
                {isRetainerEligible ? 'Availability Retainer Eligible ✅' : 'Availability Retainer Not Eligible ⚠️'}
              </Text>
            </View>
          </View>

          {/* Section 3: Schedule edit policy info */}
          <View className="bg-zinc-50 border border-zinc-150 p-4.5 rounded-[24px] flex-row justify-between items-center">
            <View className="flex-row items-center gap-2.5">
              <Feather name="edit-3" size={14} color="#4F46E5" />
              <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Slot edit allowance</Text>
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

          {/* Section 6: Weekly Retainer Dashboard (Feature 6) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4.5 mt-2">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Retainer Earnings Ledger</Text>
            
            <View className="flex-row justify-between items-center">
              <View className="gap-0.5">
                <Text className="text-zinc-500 text-[8px] font-bold uppercase">Availability Submitted</Text>
                <Text className="text-zinc-900 text-sm font-black">4 Weeks</Text>
              </View>
              <View className="w-[1px] h-6 bg-zinc-200" />
              <View className="gap-0.5">
                <Text className="text-zinc-500 text-[8px] font-bold uppercase">Retainer Earned</Text>
                <Text className="text-emerald-600 text-sm font-black">₹5,000</Text>
              </View>
              <View className="w-[1px] h-6 bg-zinc-200" />
              <View className="gap-0.5 items-end">
                <Text className="text-zinc-500 text-[8px] font-bold uppercase">Availability Missed</Text>
                <Text className="text-red-500 text-sm font-black">0 Weeks</Text>
              </View>
            </View>

            <View className="bg-zinc-50 border border-zinc-100 p-3 rounded-2xl flex-row justify-between items-center">
              <Text className="text-zinc-500 text-[8px] font-bold uppercase">Retainer Payout Period</Text>
              <Text className="text-zinc-900 text-[9px] font-extrabold">Weekly (Cycle Ends Sundays)</Text>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
