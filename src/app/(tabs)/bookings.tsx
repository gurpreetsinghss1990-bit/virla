import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookingStore } from '../../store/bookingStore';
import { BookingCard } from '../../components/BookingCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useUserStore } from '../../store/userStore';
import { Database } from '../../database/Database';
import { useCoachStore, generateMonthlySlots } from '../../store/coachStore';
import { normalizeDate, canonicalizeTimeRange } from '../../utils/date';
import { Feather } from '@expo/vector-icons';

type FilterType = 'upcoming' | 'completed' | 'cancelled' | 'today' | 'past';
type TrainerTabType = 'today' | 'tomorrow' | 'weekly' | 'history';

const monthsNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getEndLimit = (baseDate: Date) => {
  const endLimit = new Date(baseDate);
  endLimit.setMonth(baseDate.getMonth() + 1);
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

const getPrevMonthYear = (m: number, y: number) => {
  if (m === 0) return { month: 11, year: y - 1 };
  return { month: m - 1, year: y };
};

const getNextMonthYear = (m: number, y: number) => {
  if (m === 11) return { month: 0, year: y + 1 };
  return { month: m + 1, year: y };
};

const getBookingDateObj = (dateStr: string) => {
  if (!dateStr) return new Date();
  if (dateStr.includes('Today')) return new Date();
  if (dateStr.includes('Tomorrow')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  const normalized = normalizeDate(dateStr);
  if (normalized) {
    return new Date(normalized);
  }
  return new Date(dateStr);
};

export default function BookingsScreen() {
  const router = useRouter();
  const { bookings } = useBookingStore();
  const { role, user } = useUserStore();
  const [prevRole, setPrevRole] = useState(role);
  const [activeFilter, setActiveFilter] = useState<FilterType>(role === 'trainer' ? 'today' : 'upcoming');
  const [loading, setLoading] = useState(true);

  // Trainer States
  const [today, setToday] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [trainerTab, setTrainerTab] = useState<TrainerTabType>('today');
  const [isSlotsExpanded, setIsSlotsExpanded] = useState(false);

  const { 
    coaches,
    availabilityOverrides,
    toggleMonthlySlotAvailability,
    updateMonthlySlotCategory,
    disableAllSlotsForDay,
    enableAllSlotsForDay
  } = useCoachStore();

  const coach = coaches.find(c => c.id === user.id || c.name === user.name);

  // Collapse slot controls by default when selected date changes
  useEffect(() => {
    setTimeout(() => {
      setIsSlotsExpanded(false);
    }, 0);
  }, [selectedDay, selectedMonth, selectedYear]);

  // Sync today timer
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (role !== prevRole) {
    setPrevRole(role);
    setActiveFilter(role === 'trainer' ? 'today' : 'upcoming');
  }

  // Date formatted strings
  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  
  const getSelectedDateLongString = () => {
    const dObj = new Date(selectedYear, selectedMonth, selectedDay);
    return dObj.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handlePrevMonth = () => {
    const prev = getPrevMonthYear(selectedMonth, selectedYear);
    if (isMonthInAllowedRange(prev.year, prev.month, today)) {
      setSelectedMonth(prev.month);
      setSelectedYear(prev.year);
      // Select first allowed day in the new month
      const daysCount = new Date(prev.year, prev.month + 1, 0).getDate();
      for (let d = 1; d <= daysCount; d++) {
        if (isDateInAllowedRange(prev.year, prev.month, d, today)) {
          setSelectedDay(d);
          break;
        }
      }
    }
  };

  const handleNextMonth = () => {
    const next = getNextMonthYear(selectedMonth, selectedYear);
    if (isMonthInAllowedRange(next.year, next.month, today)) {
      setSelectedMonth(next.month);
      setSelectedYear(next.year);
      // Select first allowed day in the new month
      const daysCount = new Date(next.year, next.month + 1, 0).getDate();
      for (let d = 1; d <= daysCount; d++) {
        if (isDateInAllowedRange(next.year, next.month, d, today)) {
          setSelectedDay(d);
          break;
        }
      }
    }
  };

  // Day states for dots
  const getDayStates = () => {
    const states: { [day: number]: { hasBookings: boolean; hasAvailability: boolean; isFullyBooked: boolean } } = {};
    if (!coach) return states;

    const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const bkList = bookings || [];
    const reservations = Database.schema.slot_reservations || [];
    const overrides = coach.preferences?.availabilityOverrides || [];
    const allDaysSlots = generateMonthlySlots(selectedMonth, selectedYear);

    for (let d = 1; d <= daysCount; d++) {
      const dStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const slotsData = allDaysSlots.find(day => day.date === dStr)?.slots || [];

      let totalAvailable = 0;
      let totalBooked = 0;

      slotsData.forEach(slot => {
        const isBooked = bkList.some((b: any) => 
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
        if (isAvailable) totalAvailable++;
        if (isBooked || isReserved) totalBooked++;
      });

      states[d] = {
        hasBookings: totalBooked > 0,
        hasAvailability: totalAvailable > 0,
        isFullyBooked: totalAvailable > 0 && totalBooked >= totalAvailable
      };
    }
    return states;
  };

  const dayStates = getDayStates();
  const prevMonthYearVal = getPrevMonthYear(selectedMonth, selectedYear);
  const prevMonthAvailable = isMonthInAllowedRange(prevMonthYearVal.year, prevMonthYearVal.month, today);
  const nextMonthYearVal = getNextMonthYear(selectedMonth, selectedYear);
  const nextMonthAvailable = isMonthInAllowedRange(nextMonthYearVal.year, nextMonthYearVal.month, today);

  const handleEditTimeSlot = (time: string) => {
    if (!coach) return;
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

  // Generate slots for selected day
  const allMonthlyDays = generateMonthlySlots(selectedMonth, selectedYear);
  const daySlotsData = allMonthlyDays.find(d => d.date === dateStr)?.slots || [];
  
  const dailySlots = daySlotsData.map(slot => {
    const isBooked = bookings.some((b: any) => 
      b.trainerId === coach?.id && 
      normalizeDate(b.date) === normalizeDate(dateStr) && 
      canonicalizeTimeRange(b.time) === canonicalizeTimeRange(slot.time) && 
      b.status === 'upcoming'
    );
    const isReserved = (Database.schema.slot_reservations || []).some((r: any) =>
      r.trainer_id === coach?.id &&
      normalizeDate(r.slot_date) === normalizeDate(dateStr) &&
      canonicalizeTimeRange(r.slot_time) === canonicalizeTimeRange(slot.time) &&
      r.expires_at > Date.now()
    );

    const override = availabilityOverrides.find(o => normalizeDate(o.date) === normalizeDate(dateStr) && canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time));
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

  const isSelectedDateOutOfRange = !isDateInAllowedRange(selectedYear, selectedMonth, selectedDay, today);

  // Trainer list filters
  const trainerBookings = bookings.filter(b => 
    b.trainerId === user.id || b.trainerName === user.name
  );

  const getFilteredSessions = (tab: TrainerTabType) => {
    const todayStr = normalizeDate(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = normalizeDate(tomorrow);
    
    if (tab === 'today') {
      return trainerBookings.filter(b => normalizeDate(getBookingDateObj(b.date)) === todayStr && b.status === 'upcoming');
    }
    if (tab === 'tomorrow') {
      return trainerBookings.filter(b => normalizeDate(getBookingDateObj(b.date)) === tomorrowStr && b.status === 'upcoming');
    }
    if (tab === 'weekly') {
      return trainerBookings.filter(b => b.status === 'upcoming');
    }
    if (tab === 'history') {
      return trainerBookings.filter(b => b.status === 'completed' || b.status === 'cancelled' || b.status === 'client_no_show' || b.status === 'trainer_no_show' || b.status === 'missed_session_not_started');
    }
    return [];
  };

  // Regular Customer Bookings list filter
  const filteredBookings = bookings.filter((b) => {
    if (activeFilter === 'upcoming') {
      return b.status === 'upcoming';
    }
    if (activeFilter === 'cancelled') {
      return b.status === 'cancelled' || b.status === 'client_no_show' || b.status === 'trainer_no_show' || b.status === 'missed_session_not_started';
    }
    return b.status === activeFilter;
  });

  const getFilterLabel = (type: FilterType) => {
    switch (type) {
      case 'upcoming': return 'Upcoming';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return '';
    }
  };

  const filterOptions: FilterType[] = ['upcoming', 'completed', 'cancelled'];

  if (role === 'trainer') {
    return (
      <SafeAreaViewWrapper>
        {loading ? (
          <SkeletonLoader layout="bookings" />
        ) : (
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            className="flex-1 bg-[#F7F8FC]"
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
          >
            {/* Page Header */}
            <View className="mb-6">
              <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest">
                PRO CONSOLE
              </Text>
              <Text className="text-[#101828] text-3xl font-black tracking-tight mt-1">
                My Schedule
              </Text>
              <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1">
                Manage your slots, availability limits, and client visits.
              </Text>
            </View>

            {/* Calendar Card Visual Grid */}
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4 mb-6">
              <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">
                  Availability Calendar
                </Text>
                
                {/* Month Navigation Control */}
                <View className="flex-row items-center gap-4 bg-zinc-950 px-3 py-1.5 rounded-full">
                  <TouchableOpacity 
                    onPress={handlePrevMonth} 
                    disabled={!prevMonthAvailable}
                    className={`w-6 h-6 items-center justify-center bg-zinc-800 rounded-full ${!prevMonthAvailable ? 'opacity-30' : ''}`}
                  >
                    <Feather name="chevron-left" size={12} color="white" />
                  </TouchableOpacity>
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider">
                    {monthsNames[selectedMonth]} {selectedYear}
                  </Text>
                  <TouchableOpacity 
                    onPress={handleNextMonth} 
                    disabled={!nextMonthAvailable}
                    className={`w-6 h-6 items-center justify-center bg-zinc-800 rounded-full ${!nextMonthAvailable ? 'opacity-30' : ''}`}
                  >
                    <Feather name="chevron-right" size={12} color="white" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Weekday Names Header */}
              <View className="flex-row justify-between border-b border-zinc-150/40 pb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayInitial, i) => (
                  <View key={i} className="flex-1 items-center">
                    <Text className="text-zinc-400 text-[9px] font-black">{dayInitial}</Text>
                  </View>
                ))}
              </View>

              {/* Grid rows */}
              <View className="gap-2">
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
                          return <View key={colIdx} className="flex-1 items-center justify-center py-2" style={{ aspectRatio: 1 }} />;
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
                            className="flex-1 items-center justify-center py-1.5"
                            style={{ aspectRatio: 1 }}
                          >
                            <View className={`w-8 h-8 rounded-full items-center justify-center ${
                              isSelected 
                                ? 'bg-zinc-950' 
                                : isToday 
                                ? 'border border-zinc-900 bg-zinc-50' 
                                : 'bg-transparent'
                            }`}>
                              <Text className={`text-[10px] font-black ${
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
                            {/* Simple Availability indicator dot */}
                            <View className="flex-row justify-center items-center h-2 mt-1">
                              {!isDisabled ? (
                                <View className={`w-1.5 h-1.5 rounded-full ${
                                  states.hasAvailability && !states.isFullyBooked 
                                    ? 'bg-[#16C784]' 
                                    : 'bg-red-500'
                                }`} />
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      {row.length < 7 && Array.from({ length: 7 - row.length }).map((_, padIdx) => (
                        <View key={`pad-${padIdx}`} className="flex-1 items-center justify-center py-2" style={{ aspectRatio: 1 }} />
                      ))}
                    </View>
                  ));
                })()}
              </View>
            </View>

            {/* Redesigned Day Availability Summary & Collapsible Slot Manager */}
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-4 mb-6">
              {/* Day info and status */}
              <View className="flex-row justify-between items-start border-b border-zinc-100 pb-3">
                <View className="gap-1 flex-1">
                  <Text className="text-zinc-950 text-[18px] font-black uppercase tracking-tight">
                    {getSelectedDateLongString()}
                  </Text>
                  
                  {isSelectedDateOutOfRange ? (
                    <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">
                      Outside Range
                    </Text>
                  ) : (() => {
                    const activeCount = dailySlots.filter(s => s.isAvailable && !s.isBooked).length;
                    const bookedCount = dailySlots.filter(s => s.isBooked).length;
                    const isAvailable = activeCount > 0 || bookedCount > 0;
                    
                    return (
                      <View className="gap-1 mt-1">
                        <View className="flex-row items-center gap-1.5">
                          <View className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-[#16C784]' : 'bg-red-500'}`} />
                          <Text className={`text-xs font-black uppercase tracking-wider ${isAvailable ? 'text-[#16C784]' : 'text-red-500'}`}>
                            {isAvailable ? 'AVAILABLE' : 'NOT AVAILABLE'}
                          </Text>
                        </View>
                        {isAvailable && (
                          <Text className="text-zinc-500 text-[11px] font-semibold">
                            {activeCount} hours available · {bookedCount} {bookedCount === 1 ? 'session' : 'sessions'} booked
                          </Text>
                        )}
                      </View>
                    );
                  })()}
                </View>

                {/* Day-level enable/disable button */}
                {!isSelectedDateOutOfRange && coach && (() => {
                  const activeCount = dailySlots.filter(s => s.isAvailable && !s.isBooked).length;
                  const bookedCount = dailySlots.filter(s => s.isBooked).length;
                  const isAvailable = activeCount > 0 || bookedCount > 0;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        if (isAvailable) {
                          const proceedToDisable = () => {
                            const dayName = getSelectedDateLongString().split(',')[0];
                            Alert.alert(
                              `Disable ${dayName}'s Schedule?`,
                              `This will make all eligible availability slots on:\n\n${getSelectedDateLongString()}\n\nunavailable for new bookings.\n\nAny existing confirmed bookings will NOT be cancelled automatically.`,
                              [
                                { text: 'CANCEL', style: 'cancel' },
                                {
                                  text: 'DISABLE DAY',
                                  style: 'destructive',
                                  onPress: () => {
                                    disableAllSlotsForDay(coach.id, dateStr);
                                    Alert.alert('Day Disabled', 'All slots for this day have been disabled.');
                                  }
                                }
                              ]
                            );
                          };

                          if (bookedCount > 0) {
                            Alert.alert(
                              'Existing Sessions on This Day',
                              `You already have ${bookedCount} confirmed ${bookedCount === 1 ? 'session' : 'sessions'}.\n\nDisabling availability will only affect future/unbooked slots. Your confirmed sessions remain scheduled.`,
                              [
                                { text: 'CANCEL', style: 'cancel' },
                                { text: 'CONTINUE', onPress: proceedToDisable }
                              ]
                            );
                          } else {
                            proceedToDisable();
                          }
                        } else {
                          enableAllSlotsForDay(coach.id, dateStr);
                          Alert.alert('Day Enabled', 'All slots for this day have been re-enabled.');
                        }
                      }}
                      className={`px-4 py-2 rounded-xl border ${
                        isAvailable 
                          ? 'border-[#E5E7EB] bg-zinc-50' 
                          : 'border-indigo-600 bg-indigo-600'
                      }`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-wider ${
                        isAvailable ? 'text-zinc-600' : 'text-white'
                      }`}>
                        {isAvailable ? 'Disable Day' : 'Enable Day'}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>

              {/* Manage slots collapsible toggle */}
              {!isSelectedDateOutOfRange && coach && (
                <View className="gap-3">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setIsSlotsExpanded(!isSlotsExpanded)}
                    className="flex-row items-center justify-between py-2 border-b border-zinc-50"
                  >
                    <Text className="text-indigo-600 text-xs font-black uppercase tracking-wider">
                      {isSlotsExpanded ? 'Manage Slots ▴' : 'Manage Slots ▾'}
                    </Text>
                  </TouchableOpacity>

                  {isSlotsExpanded && (
                    <View className="gap-2.5 mt-1">
                      {dailySlots.map((slot) => (
                        <View 
                          key={slot.id}
                          className={`p-3 rounded-2xl border flex-row justify-between items-center ${
                            slot.isAvailable ? 'bg-white border-zinc-200' : 'bg-zinc-50 border-zinc-150'
                          }`}
                        >
                          <TouchableOpacity
                            activeOpacity={slot.isBooked || isSelectedDateOutOfRange ? 1 : 0.8}
                            disabled={slot.isBooked || isSelectedDateOutOfRange}
                            onPress={() => {
                              if (slot.isAvailable) {
                                Alert.alert(
                                  'Disable slot?',
                                  'Are you sure you want to disable this availability slot?',
                                  [
                                    { text: 'CANCEL', style: 'cancel' },
                                    { 
                                      text: 'DISABLE SLOT', 
                                      style: 'destructive', 
                                      onPress: () => toggleMonthlySlotAvailability(coach.id, dateStr, slot.time) 
                                    }
                                  ]
                                );
                              } else {
                                toggleMonthlySlotAvailability(coach.id, dateStr, slot.time);
                              }
                            }}
                            className="flex-row items-center gap-3 flex-1 pr-4"
                          >
                            {/* Checkbox / Booked indicator */}
                            <View className={`w-4 h-4 rounded-md border justify-center items-center ${
                              slot.isBooked 
                                ? 'bg-zinc-150 border-zinc-250'
                                : slot.isAvailable 
                                ? 'bg-indigo-600 border-indigo-600' 
                                : 'border-zinc-300 bg-white'
                            }`}>
                              {slot.isBooked ? (
                                <Feather name="lock" size={9} color="#6B7280" />
                              ) : slot.isAvailable ? (
                                <Feather name="check" size={9} color="white" />
                              ) : null}
                            </View>

                            <View className="gap-0.5 flex-1">
                              <Text className={`text-xs font-black ${
                                slot.isBooked 
                                  ? 'text-zinc-400' 
                                  : slot.isAvailable 
                                  ? 'text-zinc-950' 
                                  : 'text-zinc-500 font-bold line-through'
                              }`}>
                                {slot.time}
                              </Text>
                              <View className="flex-row items-center gap-1.5 mt-0.5">
                                <Text className={`text-[8px] font-black uppercase ${slot.isAvailable ? 'text-[#4F46E5]' : 'text-zinc-400'}`}>
                                  {slot.isAvailable ? 'Available' : 'Unavailable'}
                                </Text>
                                {slot.category && (
                                  <>
                                    <Text className="text-zinc-300 text-[8px]">•</Text>
                                    <Text className="text-zinc-500 text-[8px] font-black uppercase">
                                      {slot.category}
                                    </Text>
                                  </>
                                )}
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
                              onPress={() => handleEditTimeSlot(slot.time)}
                              className="bg-zinc-50 border border-zinc-150 w-8 h-8 rounded-full items-center justify-center"
                            >
                              <Feather name="edit-2" size={11} color="#6B7280" />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* divider line */}
            <View className="h-[1px] bg-zinc-200 my-4" />

            {/* VISITS OVERVIEW TAB LIST */}
            <View className="mb-4">
              <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider pl-1 mb-3">
                Visits Feed Overview
              </Text>
              
              <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1 rounded-2xl">
                {(['today', 'tomorrow', 'weekly', 'history'] as const).map((tab) => {
                  const isActive = trainerTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      activeOpacity={0.8}
                      onPress={() => setTrainerTab(tab)}
                      className={`flex-1 py-3 rounded-xl items-center justify-center ${
                        isActive ? 'bg-[#101828]' : ''
                      }`}
                    >
                      <Text 
                        className={`text-[9px] font-black uppercase tracking-wider ${
                          isActive ? 'text-white' : 'text-[#6B7280]'
                        }`}
                      >
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* List rendered by trainerTab */}
            <View>
              {(() => {
                if (trainerTab === 'today') {
                  const list = getFilteredSessions('today');
                  if (list.length > 0) {
                    return list.map(b => <BookingCard key={b.id} booking={b} />);
                  }
                  return (
                    <View className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center justify-center">
                      <Text className="text-zinc-500 text-xs font-black uppercase text-center">No sessions today</Text>
                    </View>
                  );
                }

                if (trainerTab === 'tomorrow') {
                  const tomorrow = new Date(today);
                  tomorrow.setDate(today.getDate() + 1);
                  const tomorrowStr = normalizeDate(tomorrow);
                  
                  const allTomorrowSlots = generateMonthlySlots(tomorrow.getMonth(), tomorrow.getFullYear());
                  const tomorrowSlotsData = allTomorrowSlots.find((d: any) => d.date === tomorrowStr)?.slots || [];
                  const availabilityOverrides = coach?.preferences?.availabilityOverrides || [];
                  
                  const tomorrowActiveSlots = tomorrowSlotsData.filter((slot: any) => {
                    const override = availabilityOverrides.find((o: any) => 
                      normalizeDate(o.date) === tomorrowStr && 
                      canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time)
                    );
                    return override ? override.isAvailable : true;
                  });
                  
                  const isTomorrowScheduleDisabled = tomorrowActiveSlots.length === 0;

                  if (isTomorrowScheduleDisabled) {
                    return (
                      <View className="bg-zinc-50 border border-dashed border-zinc-300 p-6 rounded-[28px] items-center justify-center">
                        <Text className="text-zinc-450 text-xs font-black uppercase text-center">Schedule disabled for tomorrow</Text>
                      </View>
                    );
                  }

                  const list = getFilteredSessions('tomorrow');
                  if (list.length > 0) {
                    return list.map(b => <BookingCard key={b.id} booking={b} />);
                  }
                  return (
                    <View className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center justify-center">
                      <Text className="text-zinc-500 text-xs font-black uppercase text-center">No sessions booked</Text>
                    </View>
                  );
                }

                if (trainerTab === 'weekly') {
                  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                  const weeklyList = [];
                  for (let i = 0; i < 7; i++) {
                    const d = new Date(today);
                    d.setDate(today.getDate() + i);
                    const dStr = normalizeDate(d);
                    const dayBookings = trainerBookings.filter(b => normalizeDate(getBookingDateObj(b.date)) === dStr && b.status === 'upcoming');
                    weeklyList.push({
                      dayLabel: weekdays[d.getDay()],
                      dateLabel: d.getDate(),
                      count: dayBookings.length
                    });
                  }

                  return (
                    <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-1">
                      {weeklyList.map((item, idx) => (
                        <View key={idx} className="flex-row justify-between items-center py-2.5 border-b border-zinc-50 last:border-b-0">
                          <Text className="text-zinc-950 text-xs font-semibold uppercase tracking-wider">
                            {item.dayLabel} {item.dateLabel}
                          </Text>
                          <Text className="text-zinc-500 text-xs font-bold uppercase">
                            {item.count} {item.count === 1 ? 'session' : 'sessions'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                }

                if (trainerTab === 'history') {
                  const historicalBookings = trainerBookings.filter(b => b.status === 'completed' || b.status === 'cancelled');
                  const historyGroups: Record<string, typeof historicalBookings> = {};
                  historicalBookings.forEach(b => {
                    const bDate = normalizeDate(getBookingDateObj(b.date));
                    if (!historyGroups[bDate]) {
                      historyGroups[bDate] = [];
                    }
                    historyGroups[bDate].push(b);
                  });
                  const sortedHistoryDates = Object.keys(historyGroups).sort((a, b) => b.localeCompare(a));

                  return (
                    <View className="gap-4">
                      {sortedHistoryDates.length > 0 ? (
                        sortedHistoryDates.map(dateKey => {
                          const daySessions = historyGroups[dateKey];
                          const completedCount = daySessions.filter(s => s.status === 'completed').length;
                          const cancelledCount = daySessions.filter(s => s.status === 'cancelled').length;
                          
                          const d = new Date(dateKey);
                          const monthsAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                          const formattedDate = `${d.getDate()} ${monthsAbbr[d.getMonth()]}`;

                          return (
                            <View key={dateKey} className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-2">
                              <View className="flex-row justify-between items-center border-b border-zinc-100 pb-2">
                                <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">{formattedDate}</Text>
                                <Text className="text-zinc-500 text-[10px] font-bold uppercase">
                                  {completedCount} completed {completedCount === 1 ? 'session' : 'sessions'}
                                  {cancelledCount > 0 && ` · ${cancelledCount} cancelled`}
                                </Text>
                              </View>
                              <View className="gap-2.5 mt-1">
                                {daySessions.map(b => (
                                  <TouchableOpacity
                                    key={b.id}
                                    activeOpacity={0.8}
                                    onPress={() => router.push({ pathname: '/session-detail', params: { id: b.id } })}
                                    className="flex-row justify-between items-center py-1"
                                  >
                                    <View>
                                      <Text className="text-zinc-900 text-xs font-semibold">{b.workoutTitle}</Text>
                                      <Text className="text-zinc-450 text-[9px] font-bold mt-0.5">{b.time} · {b.clientName || 'Client'}</Text>
                                    </View>
                                    <View className={`px-2 py-0.5 rounded-full ${b.status === 'completed' ? 'bg-[#ECFDF5] border border-[#A7F3D0]' : 'bg-[#FEF2F2] border border-[#FEE2E2]'}`}>
                                      <Text className={`text-[8px] font-black uppercase ${b.status === 'completed' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {b.status === 'completed' ? 'Completed' : 'Cancelled'}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <View className="bg-white border border-[#E5E7EB] p-8 rounded-[32px] items-center justify-center">
                          <Text className="text-zinc-500 text-xs font-semibold text-center">No historical sessions</Text>
                        </View>
                      )}
                    </View>
                  );
                }

                return null;
              })()}
            </View>

          </ScrollView>
        )}
      </SafeAreaViewWrapper>
    );
  }

  // Client view remains unchanged
  return (
    <SafeAreaViewWrapper>
      {loading ? (
        <SkeletonLoader layout="bookings" />
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          className="flex-1 bg-[#F7F8FC]"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
        >
        {/* Page Header */}
        <View className="mb-6">
          <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest">
            MY SCHEDULE
          </Text>
          <Text className="text-[#101828] text-3xl font-black tracking-tight mt-1">
            Booked Sessions
          </Text>
          <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1">
            Track and manage all your scheduled home wellness visits.
          </Text>
        </View>

        {/* Filter Capsule Selector Tabs */}
        <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1.5 rounded-2xl mb-6">
          {filterOptions.map((opt) => {
            const isActive = activeFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.8}
                onPress={() => setActiveFilter(opt)}
                className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                  isActive ? 'bg-[#101828]' : ''
                }`}
                style={isActive ? {
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                } : undefined}
              >
                <Text 
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    isActive ? 'text-white' : 'text-[#6B7280]'
                  }`}
                >
                  {getFilterLabel(opt)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bookings Render List */}
        <View>
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))
          ) : (
            <EmptyState 
              type={activeFilter === 'completed' || activeFilter === 'past' ? 'no-sessions' : 'no-bookings'} 
              message={
                activeFilter === 'upcoming' 
                  ? 'Schedule your next premium at-home training session from the home dashboard.'
                  : `You do not have any ${activeFilter} visits logged in your profile.`
              }
            />
          )}
        </View>
        </ScrollView>
      )}
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {children}
    </View>
  );
}
