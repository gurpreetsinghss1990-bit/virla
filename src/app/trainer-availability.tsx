import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useUserStore } from '../store/userStore';
import { useCoachStore, generateMonthlySlots } from '../store/coachStore';
import { Database } from '../database/Database';

export default function TrainerAvailabilityScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();
  
  const { 
    coaches,
    syncFromDB,
    availabilityOverrides,
    toggleMonthlySlotAvailability,
    updateMonthlySlotCategory,
    disableAllSlotsForDay,
    enableAllSlotsForDay
  } = useCoachStore();

  const coach = coaches.find(c => c.id === user.id || c.name === user.name);

  if (!coach) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F7F8FC', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="small" color="#4F46E5" />
        <Text className="text-zinc-500 text-xs font-bold text-center mt-4">
          Unable to load availability
        </Text>
        <TouchableOpacity 
          onPress={() => syncFromDB()} 
          className="mt-6 bg-zinc-950 py-3 px-6 rounded-xl shadow-md"
        >
          <Text className="text-white text-xs font-black uppercase tracking-wider">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const prefs = coach?.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] };

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  const monthsNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

  const toggleOnline = () => {
    if (!coach) return;
    const nextVal = !prefs.online;
    Database.updateTrainerOnlineStatus(coach.id, nextVal);
    syncFromDB();
    Alert.alert('Status Updated', `You are now ${nextVal ? 'ONLINE' : 'OFFLINE'}.`);
  };

  const handleUpdateRadius = () => {
    if (!coach) return;
    Alert.alert(
      'Service Coverage Radius',
      'Select your maximum travel radius for home training visits:',
      [
        { text: 'Cancel', style: 'cancel' },
        ...[5, 10, 15, 20, 25].map(radius => ({
          text: `${radius} km`,
          onPress: () => {
            Database.updateTrainerPreferences(coach.id, { radiusKm: radius });
            syncFromDB();
            Alert.alert('Radius Updated', `Travel coverage updated to ${radius} km.`);
          }
        }))
      ]
    );
  };

  const handleUpdateMaxSessions = () => {
    if (!coach) return;
    Alert.alert(
      'Maximum Daily Workload',
      'Select your preferred maximum daily training sessions limit:',
      [
        { text: 'Cancel', style: 'cancel' },
        ...[2, 3, 4, 5, 6, 7, 8].map(max => ({
          text: `${max} sessions / day`,
          onPress: () => {
            Database.updateTrainerPreferences(coach.id, { maxDailySessions: max });
            syncFromDB();
            Alert.alert('Workload Updated', `Maximum daily sessions set to ${max}.`);
          }
        }))
      ]
    );
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
    setSelectedDay(1);
  };

  const handleEditTimeSlot = (time: string, currentCategory: string) => {
    const availableCategories = ['Strength', 'Mind & Body', 'Cardio', 'Conditioning', 'Boxing', 'Any Workout'];
    Alert.alert(
      'Select Category Restriction',
      'Set the allowed workout category for this slot:',
      [
        { text: 'Cancel', style: 'cancel' },
        ...availableCategories.map(cat => ({
          text: cat,
          onPress: () => {
            updateMonthlySlotCategory(coach.id, dateStr, time, cat === 'Any Workout' ? '' : cat);
            Alert.alert('Category Updated', `Slot category preference set to ${cat}.`);
          }
        }))
      ]
    );
  };

  // Generate slots dynamically for the selected date
  const allMonthlyDays = generateMonthlySlots(selectedMonth, selectedYear);
  const daySlotsData = allMonthlyDays.find(d => d.date === dateStr)?.slots || [];

  const bookings = Database.schema.bookings || [];
  const reservations = Database.schema.slot_reservations || [];

  const dailySlots = daySlotsData.map(slot => {
    // 1. Check if booked
    const isBooked = bookings.some((b: any) => 
      b.trainerId === coach.id && 
      b.date === dateStr && 
      b.time === slot.time && 
      b.status === 'upcoming'
    );

    // 2. Check if reserved
    const isReserved = reservations.some((r: any) =>
      r.trainer_id === coach.id &&
      r.slot_date === dateStr &&
      r.slot_time === slot.time &&
      r.expires_at > Date.now()
    );

    // 3. Find if override exists
    const override = availabilityOverrides.find(o => o.date === dateStr && o.time === slot.time);
    
    // 4. Default available is true, overridden is false
    const isAvailable = override ? override.isAvailable : true;
    const category = override?.category || '';

    return {
      id: slot.id,
      time: slot.time,
      isAvailable,
      isBooked: isBooked || isReserved,
      category
    };
  });

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#101828" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#101828] text-sm font-black uppercase tracking-wider mr-8">
          Monthly Availability
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="gap-6">

          {/* Section: Monthly Summary */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
              <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Commission Model Summary</Text>
              <View className="bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full">
                <Text className="text-emerald-600 text-[8px] font-black uppercase tracking-widest">Active Model</Text>
              </View>
            </View>
            <View className="gap-3">
              <View className="flex-row justify-between items-center py-2 border-b border-zinc-50">
                <Text className="text-zinc-500 text-xs font-semibold">Base Earnings</Text>
                <Text className="text-zinc-900 text-xs font-black">80% Commission per Session</Text>
              </View>
              <View className="flex-row justify-between items-center py-2">
                <Text className="text-zinc-500 text-xs font-semibold">Availability Policy</Text>
                <Text className="text-zinc-900 text-xs font-black">Available by default</Text>
              </View>
            </View>
          </View>

          {/* Section: Trainer Settings */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
              <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Operational Settings</Text>
              <View className="bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                <Text className="text-[#4F46E5] text-[8px] font-black uppercase tracking-widest">Real-time sync</Text>
              </View>
            </View>

            <View className="gap-3">
              {/* Online/Offline Toggle */}
              <TouchableOpacity
                onPress={toggleOnline}
                activeOpacity={0.8}
                className="flex-row justify-between items-center py-2 border-b border-zinc-50"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-xs font-black">Availability Mode</Text>
                  <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Allow customer bookings dispatch</Text>
                </View>
                <View className={`px-3 py-1.5 rounded-full ${prefs.online ? 'bg-emerald-50 border border-emerald-150' : 'bg-zinc-50 border border-zinc-200'}`}>
                  <Text className={`text-[8px] font-black uppercase ${prefs.online ? 'text-emerald-600' : 'text-zinc-500'}`}>
                    {prefs.online ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Service Radius */}
              <TouchableOpacity
                onPress={handleUpdateRadius}
                activeOpacity={0.8}
                className="flex-row justify-between items-center py-2 border-b border-zinc-50"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-xs font-black">Service Radius Limit</Text>
                  <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Maximum travel distance in Mumbai</Text>
                </View>
                <Text className="text-[#4F46E5] text-xs font-black">{prefs.radiusKm || 15} km</Text>
              </TouchableOpacity>

              {/* Max Daily Sessions */}
              <TouchableOpacity
                onPress={handleUpdateMaxSessions}
                activeOpacity={0.8}
                className="flex-row justify-between items-center py-2 border-b border-zinc-50"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-xs font-black">Maximum Daily Sessions</Text>
                  <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Prevents fatigue capping bookings</Text>
                </View>
                <Text className="text-[#4F46E5] text-xs font-black">{prefs.maxDailySessions || 5} sessions</Text>
              </TouchableOpacity>

              {/* Workout Categories */}
              <TouchableOpacity
                onPress={() => router.push('/trainer-workouts')}
                activeOpacity={0.8}
                className="flex-row justify-between items-center py-2"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-xs font-black">workout categories</Text>
                  <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Manage approved categories & requests</Text>
                </View>
                <Text className="text-[#4F46E5] text-[10px] font-black uppercase">
                  Manage Workouts
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Month Navigation Control */}
          <View className="bg-zinc-950 border border-zinc-800 p-4.5 rounded-[24px] flex-row justify-between items-center">
            <TouchableOpacity onPress={handlePrevMonth} className="w-8 h-8 items-center justify-center bg-zinc-800 rounded-full">
              <Feather name="chevron-left" size={16} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xs font-black uppercase tracking-wider">
              {monthsNames[selectedMonth]} {selectedYear}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} className="w-8 h-8 items-center justify-center bg-zinc-800 rounded-full">
              <Feather name="chevron-right" size={16} color="white" />
            </TouchableOpacity>
          </View>

          {/* Calendar Strip (Days selector list) */}
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row py-2"
            >
              {dayNumbers.map(dayNum => {
                const isSelected = selectedDay === dayNum;
                const dateObj = new Date(selectedYear, selectedMonth, dayNum);
                const daysOfWeekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const dayOfWeek = daysOfWeekNames[dateObj.getDay()];
                return (
                  <TouchableOpacity
                    key={dayNum}
                    activeOpacity={0.8}
                    onPress={() => setSelectedDay(dayNum)}
                    className={`px-4.5 py-3.5 mx-1 rounded-[18px] items-center justify-center border ${
                      isSelected 
                        ? 'bg-zinc-950 border-zinc-900 shadow-sm' 
                        : 'bg-white border-zinc-150'
                    }`}
                  >
                    <Text className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-indigo-400' : 'text-zinc-400'}`}>
                      {dayOfWeek}
                    </Text>
                    <Text className={`text-sm font-black mt-1 ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Bulk Controls */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                disableAllSlotsForDay(coach.id, dateStr);
                Alert.alert('Day Disabled', 'All slots for this day have been disabled.');
              }}
              className="flex-1 py-3 border border-zinc-200 bg-zinc-50 rounded-xl items-center justify-center"
            >
              <Text className="text-zinc-600 text-xs font-black uppercase tracking-wider">
                Disable Entire Day
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                enableAllSlotsForDay(coach.id, dateStr);
                Alert.alert('Day Enabled', 'All slots for this day have been re-enabled.');
              }}
              className="flex-1 py-3 bg-indigo-600 rounded-xl items-center justify-center"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">
                Enable Entire Day
              </Text>
            </TouchableOpacity>
          </View>

          {/* Availability Planner Slots grid */}
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
                    onPress={() => toggleMonthlySlotAvailability(coach.id, dateStr, slot.time)}
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
                        slot.isBooked ? 'text-zinc-400' : slot.isAvailable ? 'text-zinc-950' : 'text-zinc-500 font-bold line-through'
                      }`}>
                        {slot.time}
                      </Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <Text className={`text-[8px] font-black uppercase ${slot.isAvailable ? 'text-[#4F46E5]' : 'text-zinc-400'}`}>
                          {slot.isAvailable ? 'Available' : 'Unavailable'}
                        </Text>
                        <Text className="text-zinc-300 text-[8px]">•</Text>
                        <Text className="text-zinc-500 text-[8px] font-black uppercase">
                          {slot.category || 'Any Workout'}
                        </Text>
                        {slot.isBooked && (
                          <>
                            <Text className="text-zinc-300 text-[8px]">•</Text>
                            <Text className="text-red-500 text-[8px] font-black uppercase">Booked Session</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Configure category trigger */}
                  {!slot.isBooked && slot.isAvailable && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleEditTimeSlot(slot.time, slot.category)}
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
    </View>
  );
}
