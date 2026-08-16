import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useUserStore } from '../store/userStore';
import { useCoachStore, generateMonthlySlots } from '../store/coachStore';
import { Database } from '../database/Database';
import { normalizeDate, canonicalizeTimeRange } from '../utils/date';

const getEndLimit = (baseDate: Date) => {
  const endLimit = new Date(baseDate);
  endLimit.setMonth(baseDate.getMonth() + 1);
  // Handle month boundary overflow (e.g. Jan 31 -> Feb 28/29, or leap years)
  if (endLimit.getMonth() !== (baseDate.getMonth() + 1) % 12) {
    endLimit.setDate(0);
  }
  endLimit.setHours(23, 59, 59, 999);
  return endLimit;
};

const isDateInAllowedRange = (y: number, m: number, d: number, today: Date) => {
  const dateObj = new Date(y, m, d);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const endLimit = getEndLimit(today);
  return dateObj >= todayStart && dateObj <= endLimit;
};

const isMonthInAllowedRange = (y: number, m: number, today: Date) => {
  const monthStart = new Date(y, m, 1);
  const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const endLimit = getEndLimit(today);
  return monthStart <= endLimit && monthEnd >= todayStart;
};

const getFirstAvailableDayInMonth = (y: number, m: number, today: Date) => {
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (isDateInAllowedRange(y, m, d, today)) {
      return d;
    }
  }
  return 1;
};

export default function TrainerAvailabilityScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();

  useEffect(() => {
    const initData = async () => {
      try {
        console.log('[AVAILABILITY] Reloading database from Supabase on mount...');
        await Database.reload();
        useCoachStore.getState().syncFromDB();
        console.log('[AVAILABILITY] Database reloaded and synced.');
      } catch (err) {
        console.warn('Failed to load database in availability:', err);
      }
    };
    initData();
  }, []);
  
  const { 
    coaches,
    syncFromDB,
    availabilityOverrides,
    toggleMonthlySlotAvailability,
    updateMonthlySlotCategory,
    disableAllSlotsForDay,
    enableAllSlotsForDay
  } = useCoachStore();

  const [today, setToday] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (
        now.getDate() !== today.getDate() ||
        now.getMonth() !== today.getMonth() ||
        now.getFullYear() !== today.getFullYear()
      ) {
        setToday(now);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [today]);

  const params = useLocalSearchParams<{ date?: string }>();

  const getInitialDate = () => {
    if (params.date) {
      const parts = params.date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return { year: y, month: m, day: d };
        }
      }
    }
    return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
  };

  const initialDate = getInitialDate();
  const [selectedMonth, setSelectedMonth] = useState(initialDate.month);
  const [selectedYear, setSelectedYear] = useState(initialDate.year);
  const [selectedDay, setSelectedDay] = useState(initialDate.day);

  useEffect(() => {
    if (params.date) {
      const parts = params.date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const t = setTimeout(() => {
            setSelectedYear(y);
            setSelectedMonth(m);
            setSelectedDay(d);
          }, 0);
          return () => clearTimeout(t);
        }
      }
    }
  }, [params.date]);

  useEffect(() => {
    if (!isDateInAllowedRange(selectedYear, selectedMonth, selectedDay, today)) {
      const t = setTimeout(() => {
        setSelectedMonth(today.getMonth());
        setSelectedYear(today.getFullYear());
        setSelectedDay(today.getDate());
      }, 0);
      return () => clearTimeout(t);
    }
  }, [today, selectedYear, selectedMonth, selectedDay]);

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
          className="mt-6 bg-zinc-950 py-3 px-6 rounded-xl"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
        >
          <Text className="text-white text-xs font-black uppercase tracking-wider">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const prefs = coach?.preferences || { online: false, radiusKm: 15, maxDailySessions: 5, categories: [] };

  const monthsNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const isSelectedDateOutOfRange = !isDateInAllowedRange(selectedYear, selectedMonth, selectedDay, today);

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

  const getPrevMonthYear = (m: number, y: number) => {
    if (m === 0) {
      return { month: 11, year: y - 1 };
    }
    return { month: m - 1, year: y };
  };

  const getNextMonthYear = (m: number, y: number) => {
    if (m === 11) {
      return { month: 0, year: y + 1 };
    }
    return { month: m + 1, year: y };
  };

  const handlePrevMonth = () => {
    const prev = getPrevMonthYear(selectedMonth, selectedYear);
    if (isMonthInAllowedRange(prev.year, prev.month, today)) {
      setSelectedMonth(prev.month);
      setSelectedYear(prev.year);
      setSelectedDay(getFirstAvailableDayInMonth(prev.year, prev.month, today));
    }
  };

  const handleNextMonth = () => {
    const next = getNextMonthYear(selectedMonth, selectedYear);
    if (isMonthInAllowedRange(next.year, next.month, today)) {
      setSelectedMonth(next.month);
      setSelectedYear(next.year);
      setSelectedDay(getFirstAvailableDayInMonth(next.year, next.month, today));
    }
  };

  const prevMonthYear = getPrevMonthYear(selectedMonth, selectedYear);
  const prevMonthAvailable = isMonthInAllowedRange(prevMonthYear.year, prevMonthYear.month, today);

  const nextMonthYear = getNextMonthYear(selectedMonth, selectedYear);
  const nextMonthAvailable = isMonthInAllowedRange(nextMonthYear.year, nextMonthYear.month, today);

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
      normalizeDate(b.date) === normalizeDate(dateStr) && 
      canonicalizeTimeRange(b.time) === canonicalizeTimeRange(slot.time) && 
      b.status === 'upcoming'
    );

    // 2. Check if reserved
    const isReserved = reservations.some((r: any) =>
      r.trainer_id === coach.id &&
      normalizeDate(r.slot_date) === normalizeDate(dateStr) &&
      canonicalizeTimeRange(r.slot_time) === canonicalizeTimeRange(slot.time) &&
      r.expires_at > Date.now()
    );

    // 3. Find if override exists
    const override = availabilityOverrides.find(o => normalizeDate(o.date) === normalizeDate(dateStr) && canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time));
    
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

  // Generate states for each day in the selected month
  const getDayStates = () => {
    const states: { [day: number]: { hasBookings: boolean; hasAvailability: boolean; isFullyBooked: boolean } } = {};
    if (!coach) return states;

    const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const bookings = Database.schema.bookings || [];
    const reservations = Database.schema.slot_reservations || [];
    const overrides = coach.preferences?.availabilityOverrides || [];
    const allDaysSlots = generateMonthlySlots(selectedMonth, selectedYear);

    for (let d = 1; d <= daysCount; d++) {
      const dStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const slotsData = allDaysSlots.find(day => day.date === dStr)?.slots || [];

      let totalAvailable = 0;
      let totalBooked = 0;

      slotsData.forEach(slot => {
        const isBooked = bookings.some((b: any) => 
          b.trainerId === coach.id && 
          normalizeDate(b.date) === dStr && 
          canonicalizeTimeRange(b.time) === canonicalizeTimeRange(slot.time) && 
          b.status === 'upcoming'
        );
        const isReserved = reservations.some((r: any) =>
          r.trainer_id === coach.id &&
          normalizeDate(r.slot_date) === dStr &&
          canonicalizeTimeRange(r.slot_time) === canonicalizeTimeRange(slot.time) &&
          r.expires_at > Date.now()
        );
        const override = overrides.find((o: any) => 
          normalizeDate(o.date) === dStr && 
          canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time)
        );
        const isAvailable = override ? override.isAvailable : true;
        const isActuallyBooked = isBooked || isReserved;

        if (isActuallyBooked) {
          totalBooked++;
        } else if (isAvailable) {
          totalAvailable++;
        }
      });

      states[d] = {
        hasBookings: totalBooked > 0,
        hasAvailability: totalAvailable > 0,
        isFullyBooked: totalBooked > 0 && totalAvailable === 0
      };
    }
    return states;
  };
  const dayStates = getDayStates();

  const getSelectedWeekDays = () => {
    const selectedDate = new Date(selectedYear, selectedMonth, selectedDay);
    const dayOfWeek = selectedDate.getDay();
    const sunday = new Date(selectedDate);
    sunday.setDate(selectedDate.getDate() - dayOfWeek);
    
    const weekDaysList = [];
    const weekdaysNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      weekDaysList.push({
        dayNum: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        label: weekdaysNames[d.getDay()],
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      });
    }
    return weekDaysList;
  };
  const weekDays = getSelectedWeekDays();

  const getSelectedDateLongString = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  const availableSlotsCount = dailySlots.filter(s => s.isAvailable && !s.isBooked).length;
  const bookedSlotsCount = dailySlots.filter(s => s.isBooked).length;
  const availableHours = (availableSlotsCount * 1.5).toFixed(1).replace('.0', '');
  const bookedHours = (bookedSlotsCount * 1.5).toFixed(1).replace('.0', '');
  
  const availabilityText = bookedSlotsCount > 0
    ? `${bookedHours} hours booked · ${availableHours} hours available`
    : `${availableHours} hours available`;

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
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4">
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
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4">
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
            <TouchableOpacity 
              onPress={handlePrevMonth} 
              disabled={!prevMonthAvailable}
              className={`w-8 h-8 items-center justify-center bg-zinc-800 rounded-full ${!prevMonthAvailable ? 'opacity-30' : ''}`}
            >
              <Feather name="chevron-left" size={16} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xs font-black uppercase tracking-wider">
              {monthsNames[selectedMonth]} {selectedYear}
            </Text>
            <TouchableOpacity 
              onPress={handleNextMonth} 
              disabled={!nextMonthAvailable}
              className={`w-8 h-8 items-center justify-center bg-zinc-800 rounded-full ${!nextMonthAvailable ? 'opacity-30' : ''}`}
            >
              <Feather name="chevron-right" size={16} color="white" />
            </TouchableOpacity>
          </View>

          {/* Redesigned 7-column Month Grid Calendar */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4">
            <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider pl-1">Monthly Calendar</Text>
            
            {/* Weekday Names Header */}
            <View className="flex-row justify-between border-b border-zinc-100 pb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayInitial, i) => (
                <View key={i} className="flex-1 items-center">
                  <Text className="text-zinc-400 text-[10px] font-black">{dayInitial}</Text>
                </View>
              ))}
            </View>

            {/* Grid rows */}
            <View className="gap-2.5">
              {(() => {
                const firstDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay();
                const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                const gridCells = [];
                for (let i = 0; i < firstDayOfWeek; i++) {
                  gridCells.push(null);
                }
                for (let d = 1; d <= daysCount; d++) {
                  gridCells.push(d);
                }
                const rows = [];
                for (let i = 0; i < gridCells.length; i += 7) {
                  rows.push(gridCells.slice(i, i + 7));
                }

                return rows.map((row, rowIdx) => (
                  <View key={rowIdx} className="flex-row justify-between">
                    {row.map((dayNum, colIdx) => {
                      if (dayNum === null) {
                        return <View key={colIdx} className="flex-1 items-center justify-center py-2.5" style={{ aspectRatio: 1 }} />;
                      }

                      const isDisabled = !isDateInAllowedRange(selectedYear, selectedMonth, dayNum, today);
                      const isSelected = selectedDay === dayNum;
                      const isToday = today.getDate() === dayNum && today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;
                      const states = dayStates[dayNum] || { hasBookings: false, hasAvailability: false, isFullyBooked: false };

                      return (
                        <TouchableOpacity
                          key={colIdx}
                          activeOpacity={isDisabled ? 1 : 0.8}
                          disabled={isDisabled}
                          onPress={() => setSelectedDay(dayNum)}
                          className="flex-1 items-center justify-center py-2.5"
                          style={{ aspectRatio: 1 }}
                        >
                          <View className={`w-8 h-8 rounded-full items-center justify-center ${
                            isSelected 
                              ? 'bg-zinc-950' 
                              : isToday 
                              ? 'border border-zinc-900 bg-zinc-50' 
                              : 'bg-transparent'
                          }`}>
                            <Text className={`text-[11px] font-black ${
                              isSelected 
                                ? 'text-white' 
                                : isDisabled 
                                ? 'text-zinc-200' 
                                : isToday
                                ? 'text-zinc-950'
                                : 'text-zinc-700'
                            }`}>
                              {dayNum}
                            </Text>
                          </View>
                          
                          {/* Subtle Indicators under the day number */}
                          <View className="flex-row gap-0.5 justify-center items-center h-2 mt-1">
                            {states.hasBookings ? (
                              <View className="w-1 h-1 rounded-full bg-indigo-600" />
                            ) : null}
                            {states.hasAvailability && !states.isFullyBooked ? (
                              <View className="w-1 h-1 rounded-full bg-emerald-500" />
                            ) : null}
                            {states.isFullyBooked ? (
                              <View className="w-1 h-1 rounded-full bg-zinc-400" />
                            ) : null}
                            {!states.hasBookings && !states.hasAvailability && !states.isFullyBooked ? (
                              <View className="w-1 h-1 bg-transparent" />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {/* Pad end of week if row length is less than 7 */}
                    {row.length < 7 && Array.from({ length: 7 - row.length }).map((_, padIdx) => (
                      <View key={`pad-${padIdx}`} className="flex-1 items-center justify-center py-2.5" style={{ aspectRatio: 1 }} />
                    ))}
                  </View>
                ));
              })()}
            </View>
          </View>

          {/* Clean Horizontal Date Selector (Week Strip around Selected Date) */}
          <View className="bg-white border border-[#E5E7EB] p-4.5 rounded-[28px]">
            <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider pl-1 mb-3">Selected Week</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row"
            >
              {weekDays.map((day, idx) => {
                const isSelected = selectedDay === day.dayNum && selectedMonth === day.month && selectedYear === day.year;
                const isDisabled = !isDateInAllowedRange(day.year, day.month, day.dayNum, today);
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={isDisabled ? 1 : 0.8}
                    disabled={isDisabled}
                    onPress={() => {
                      setSelectedYear(day.year);
                      setSelectedMonth(day.month);
                      setSelectedDay(day.dayNum);
                    }}
                    className={`px-4.5 py-3 mx-1 rounded-[20px] items-center justify-center border min-w-[65px] ${
                      isSelected 
                        ? 'bg-zinc-950 border-zinc-950' 
                        : isDisabled
                        ? 'bg-zinc-50 border-zinc-100 opacity-40'
                        : 'bg-white border-zinc-150'
                    }`}
                  >
                    <Text className={`text-[9px] font-black uppercase tracking-wider ${
                      isSelected ? 'text-indigo-400' : isDisabled ? 'text-zinc-300' : 'text-zinc-450'
                    }`}>
                      {day.label}
                    </Text>
                    <Text className={`text-sm font-black mt-1 ${
                      isSelected ? 'text-white' : isDisabled ? 'text-zinc-300' : 'text-zinc-900'
                    }`}>
                      {day.dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Day Detail Header */}
          <View className="pl-1 mt-1 gap-1">
            <Text className="text-zinc-950 text-base font-black">
              {getSelectedDateLongString()}
            </Text>
            <Text className="text-zinc-500 text-xs font-semibold">
              {availabilityText}
            </Text>
          </View>

          {/* Bulk Controls */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              activeOpacity={isSelectedDateOutOfRange ? 1 : 0.8}
              disabled={isSelectedDateOutOfRange}
              onPress={() => {
                disableAllSlotsForDay(coach.id, dateStr);
                Alert.alert('Day Disabled', 'All slots for this day have been disabled.');
              }}
              className={`flex-1 py-3 border border-zinc-200 rounded-xl items-center justify-center ${
                isSelectedDateOutOfRange ? 'bg-zinc-100 opacity-40' : 'bg-zinc-50'
              }`}
            >
              <Text className={`text-zinc-600 text-xs font-black uppercase tracking-wider ${
                isSelectedDateOutOfRange ? 'text-zinc-400' : ''
              }`}>
                Disable Entire Day
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={isSelectedDateOutOfRange ? 1 : 0.8}
              disabled={isSelectedDateOutOfRange}
              onPress={() => {
                enableAllSlotsForDay(coach.id, dateStr);
                Alert.alert('Day Enabled', 'All slots for this day have been re-enabled.');
              }}
              className={`flex-1 py-3 rounded-xl items-center justify-center ${
                isSelectedDateOutOfRange ? 'bg-zinc-200 opacity-40' : 'bg-indigo-600'
              }`}
            >
              <Text className={`text-white text-xs font-black uppercase tracking-wider ${
                isSelectedDateOutOfRange ? 'text-zinc-400' : ''
              }`}>
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
                  className={`p-4.5 rounded-[24px] border flex-row justify-between items-center ${
                    slot.isAvailable ? 'bg-white border-zinc-200' : 'bg-zinc-100 border-zinc-150'
                  }`}
                >
                  <TouchableOpacity
                    activeOpacity={slot.isBooked || isSelectedDateOutOfRange ? 1 : 0.8}
                    disabled={slot.isBooked || isSelectedDateOutOfRange}
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
                  {!slot.isBooked && slot.isAvailable && !isSelectedDateOutOfRange && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleEditTimeSlot(slot.time, slot.category)}
                      className="bg-zinc-50 border border-zinc-150 w-8 h-8 rounded-full items-center justify-center"
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
