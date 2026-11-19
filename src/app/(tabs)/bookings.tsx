import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookingStore } from '../../store/bookingStore';
import { BookingCard } from '../../components/BookingCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useUserStore } from '../../store/userStore';
import { Database, getCurrentServerTime, getISTDateInfo, SupportTicket } from '../../database/Database';
import { syncAllDomainStores } from '../../store/syncAllStores';
import { useCoachStore, generateMonthlySlots } from '../../store/coachStore';
import { normalizeDate, canonicalizeTimeRange, formatToDDMMYYYY, getBookingISTDateRange } from '../../utils/date';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Booking } from '../../types';
import { RaiseSupportTicketModal } from '../../components/RaiseSupportTicketModal';
import { SupportChatModal } from '../../components/SupportChatModal';
import { UserTicketsModal } from '../../components/UserTicketsModal';
import { NativeSegmentedControl } from '../../components/NativeSegmentedControl';
import { NativeDivider } from '../../components/NativeDivider';
import { NativeAlertDialog } from '../../components/NativeAlertDialog';
import { NativeSingleChoiceDialog } from '../../components/NativeSingleChoiceDialog';

import { softShadow } from '../../utils/shadows';
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

const isSlotVisibleForTrainer = (
  year: number,
  month: number,
  day: number,
  timeRange: string,
  now: Date
): boolean => {
  const slotDate = new Date(year, month, day);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (slotDate > todayStart) {
    return true;
  }
  if (slotDate < todayStart) {
    return false;
  }

  const startPart = timeRange.split(' - ')[0].trim();
  const match = startPart.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return true;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }

  const slotStart = new Date(year, month, day, hours, minutes, 0, 0);
  const cutoffTime = new Date(now.getTime() + 30 * 60 * 1000);

  return slotStart.getTime() > cutoffTime.getTime();
};

export default function BookingsScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ filter?: string }>();
  const insets = useSafeAreaInsets();
  const { bookings } = useBookingStore();
  const { role, user } = useUserStore();
  const [prevRole, setPrevRole] = useState(role);
  const initialFilter: FilterType = (searchParams.filter as FilterType) || (role === 'trainer' ? 'today' : 'upcoming');
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);
  const [renderedFilter, setRenderedFilter] = useState<FilterType>(initialFilter);
  const [clientDateFilter, setClientDateFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  // Cursor-based pagination state for Completed & Cancelled sections
  // Cursor format: "<startMs>|<bookingId>" (null = first page)
  const CURSOR_PAGE_SIZE = 5;
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(() => !Database.getIsLoaded());
  // Only the "collapsed" threshold matters, so we keep a boolean instead of the raw
  // offset: the raw value re-rendered this whole screen on every scroll frame.
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // Native AlertDialog state for Trainer Mode actions
  const [nativeAlertState, setNativeAlertState] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'OK',
    onConfirm: () => {},
  });

  const [categoryDialogState, setCategoryDialogState] = useState<{
    visible: boolean;
    time: string;
    currentCategory?: string;
  }>({
    visible: false,
    time: '',
    currentCategory: '',
  });

  const handleOpenSupport = React.useCallback(async (b: Booking) => {
    setSupportBooking(b);
    try {
      // If a ticket already exists for this booking, open support chatbox directly
      const existingTicket = await Database.getRecentTicketForBooking(b.id);
      if (existingTicket) {
        setActiveChatTicket(existingTicket);
        setShowSupportChatModal(true);
        return;
      }
    } catch (e) {
      console.warn('[Bookings] Check existing ticket error:', e);
    }
    // Otherwise open the raise support ticket modal
    setShowRaiseTicketModal(true);
  }, []);

  // Client Support States
  const [supportBooking, setSupportBooking] = useState<Booking | null>(null);
  const [showRaiseTicketModal, setShowRaiseTicketModal] = useState<boolean>(false);
  const [showUserTicketsModal, setShowUserTicketsModal] = useState<boolean>(false);
  const [activeChatTicket, setActiveChatTicket] = useState<SupportTicket | null>(null);
  const [showSupportChatModal, setShowSupportChatModal] = useState<boolean>(false);

  // Trainer States
  const [today, setToday] = useState(() => getCurrentServerTime());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const t = getCurrentServerTime();
    return getISTDateInfo(t).month - 1;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const t = getCurrentServerTime();
    return getISTDateInfo(t).year;
  });
  const [selectedDay, setSelectedDay] = useState(() => {
    const t = getCurrentServerTime();
    return getISTDateInfo(t).day;
  });
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

  const coach = coaches.find(
    c => c.id === user.id || c.name === user.name || (user.name && c.name?.toLowerCase().startsWith(user.name.toLowerCase()))
  );

  // Sync today timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = getCurrentServerTime();
      const infoNow = getISTDateInfo(now);
      const infoToday = getISTDateInfo(today);
      if (
        infoNow.day !== infoToday.day ||
        infoNow.month !== infoToday.month ||
        infoNow.year !== infoToday.year
      ) {
        setToday(now);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [today]);

  useEffect(() => {
    const initData = async () => {
      // 1. Wait for Zustand store hydration
      if (!useUserStore.persist.hasHydrated()) {
        const unsub = useUserStore.persist.onHydrate(() => {
          unsub();
          initData();
        });
        return;
      }

      // 2. Set currentUserId context on Database
      const userId = useUserStore.getState().user?.id;
      if (userId) {
        Database.setCurrentUserId(userId);
      }

      const isAlreadyLoaded = Database.getIsLoaded();
      if (isAlreadyLoaded) {
        useBookingStore.getState().syncFromDB();
        useCoachStore.getState().syncFromDB();
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await Database.load();
        syncAllDomainStores();
      } catch (err) {
        console.warn('Failed to load database in bookings tab:', err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (searchParams.filter && ['upcoming', 'completed', 'cancelled', 'today', 'past'].includes(searchParams.filter)) {
      const target = searchParams.filter as FilterType;
      setActiveFilter(target);
      setRenderedFilter(target);
      setCurrentCursor(null);
      setCursorHistory([]);
    }
  }, [searchParams.filter]);

  if (role !== prevRole) {
    setPrevRole(role);
    const nextFilter = role === 'trainer' ? 'today' : 'upcoming';
    setActiveFilter(nextFilter);
    setRenderedFilter(nextFilter);
    setCurrentCursor(null);
    setCursorHistory([]);
  }

  // Date formatted strings
  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  
  const getSelectedDateLongString = () => {
    const dObj = new Date(selectedYear, selectedMonth, selectedDay);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekday = weekdays[dObj.getDay()];
    return `${weekday}, ${formatToDDMMYYYY(dObj)}`;
  };

  const handlePrevMonth = () => {
    const prev = getPrevMonthYear(selectedMonth, selectedYear);
    if (isMonthInAllowedRange(prev.year, prev.month, today)) {
      setSelectedMonth(prev.month);
      setSelectedYear(prev.year);
      setIsSlotsExpanded(false);
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
      setIsSlotsExpanded(false);
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

  // Day states for dots (only computed in trainer mode)
  const dayStates = useMemo(() => {
    const states: { [day: number]: { hasBookings: boolean; hasAvailability: boolean; isFullyBooked: boolean } } = {};
    if (role !== 'trainer' || !coach) return states;

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
          r.expires_at > getCurrentServerTime().getTime()
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
  }, [role, coach, selectedYear, selectedMonth, bookings, availabilityOverrides]);

  const prevMonthYearVal = getPrevMonthYear(selectedMonth, selectedYear);
  const prevMonthAvailable = isMonthInAllowedRange(prevMonthYearVal.year, prevMonthYearVal.month, today);
  const nextMonthYearVal = getNextMonthYear(selectedMonth, selectedYear);
  const nextMonthAvailable = isMonthInAllowedRange(nextMonthYearVal.year, nextMonthYearVal.month, today);

  const handleEditTimeSlot = (time: string, currentCategory?: string) => {
    if (!coach) return;
    setCategoryDialogState({
      visible: true,
      time,
      currentCategory: currentCategory || '',
    });
  };

  // Generate slots for selected day (only in trainer mode)
  const dailySlots = useMemo(() => {
    if (role !== 'trainer') return [];
    const allMonthlyDays = generateMonthlySlots(selectedMonth, selectedYear);
    const daySlotsData = allMonthlyDays.find(d => d.date === dateStr)?.slots || [];
    
    return daySlotsData.map(slot => {
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
        r.expires_at > getCurrentServerTime().getTime()
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
  }, [role, selectedMonth, selectedYear, dateStr, bookings, coach?.id, availabilityOverrides]);

  const isSelectedDateOutOfRange = !isDateInAllowedRange(selectedYear, selectedMonth, selectedDay, today);

  // Trainer list filters
  const trainerBookings = useMemo(() => {
    if (role !== 'trainer') return [];
    const isWildcardTrainer =
      user.isWildcardUser ||
      user.id === 'u-testadmin' ||
      user.id === 'u-testclient' ||
      user.id?.startsWith('u-test') ||
      user.phone?.includes('1234567891');

    const matched = bookings.filter(b =>
      b.trainerId === user.id ||
      b.trainerName === user.name ||
      (user.name && b.trainerName?.toLowerCase().startsWith(user.name.toLowerCase())) ||
      (coach && (b.trainerId === coach.id || b.trainerName === coach.name))
    );

    // If a wildcard/admin account is viewing Trainer Mode and has no direct trainer bookings under their own ID,
    // show all trainer-assigned sessions so they can inspect trainer schedule & history seamlessly.
    if (matched.length === 0 && isWildcardTrainer) {
      return bookings.filter(b => Boolean(b.trainerId && b.trainerId !== 'searching'));
    }
    return matched;
  }, [role, bookings, user.id, user.name, user.isWildcardUser, user.phone, coach]);

  const getFilteredSessions = (tab: TrainerTabType) => {
    const todayStr = normalizeDate(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = normalizeDate(tomorrow);
    
    if (tab === 'today') {
      return trainerBookings
        .filter(b => normalizeDate(getBookingDateObj(b.date)) === todayStr && b.status === 'upcoming')
        .sort((a, b) => getBookingISTDateRange(a).start.getTime() - getBookingISTDateRange(b).start.getTime());
    }
    if (tab === 'tomorrow') {
      return trainerBookings
        .filter(b => normalizeDate(getBookingDateObj(b.date)) === tomorrowStr && b.status === 'upcoming')
        .sort((a, b) => getBookingISTDateRange(a).start.getTime() - getBookingISTDateRange(b).start.getTime());
    }
    if (tab === 'weekly') {
      return trainerBookings
        .filter(b => b.status === 'upcoming')
        .sort((a, b) => getBookingISTDateRange(a).start.getTime() - getBookingISTDateRange(b).start.getTime());
    }
    if (tab === 'history') {
      return trainerBookings
        .filter(b => b.status === 'completed' || b.status === 'cancelled' || b.status === 'client_no_show' || b.status === 'trainer_no_show' || b.status === 'missed_session_not_started')
        .sort((a, b) => getBookingISTDateRange(b).start.getTime() - getBookingISTDateRange(a).start.getTime());
    }
    return [];
  };

  // Pre-group and sort customer bookings once when `bookings` changes — makes tab switching O(1) instant!
  const groupedCustomerBookings = useMemo(() => {
    const serverNow = getCurrentServerTime().getTime();
    const activeTimelineStatuses = new Set([
      'trainer_travelling',
      'trainer_arrived',
      'otp_verified',
      'workout_started',
      'workout_completed',
      'trainer_report_submitted',
      'customer_review_pending',
    ]);

    const withMeta = bookings.map((b) => {
      const startMs = b.scheduledStartAt
        ? new Date(b.scheduledStartAt).getTime()
        : getBookingISTDateRange(b).start.getTime();
      return { booking: b, startMs };
    });

    const upcoming: typeof withMeta = [];
    const completed: typeof withMeta = [];
    const cancelled: typeof withMeta = [];

    for (const item of withMeta) {
      const b = item.booking;
      if (b.status === 'upcoming') {
        const isOngoing = activeTimelineStatuses.has(b.timelineStatus || '');
        if (isOngoing || item.startMs > serverNow) {
          upcoming.push(item);
        }
      } else if (
        b.status === 'cancelled' ||
        b.status === 'client_no_show' ||
        b.status === 'trainer_no_show' ||
        b.status === 'missed_session_not_started'
      ) {
        cancelled.push(item);
      } else if (b.status === 'completed') {
        completed.push(item);
      }
    }

    upcoming.sort((a, b) => a.startMs - b.startMs || a.booking.id.localeCompare(b.booking.id));
    completed.sort((a, b) => b.startMs - a.startMs || b.booking.id.localeCompare(a.booking.id));
    cancelled.sort((a, b) => b.startMs - a.startMs || b.booking.id.localeCompare(a.booking.id));

    const cursorMap = new Map<string, string>();
    for (const item of withMeta) {
      cursorMap.set(item.booking.id, `${item.startMs}|${item.booking.id}`);
    }

    return {
      upcoming: upcoming.map((x) => x.booking),
      completed: completed.map((x) => x.booking),
      cancelled: cancelled.map((x) => x.booking),
      cursorMap,
    };
  }, [bookings]);

  // Regular Customer Bookings list filter (O(1) lookup when clientDateFilter === 'all')
  const filteredBookings = useMemo(() => {
    const baseList =
      renderedFilter === 'upcoming'
        ? groupedCustomerBookings.upcoming
        : renderedFilter === 'cancelled'
          ? groupedCustomerBookings.cancelled
          : groupedCustomerBookings.completed;

    if (clientDateFilter === 'all') {
      return baseList;
    }

    const now = getCurrentServerTime();
    const todayStr = normalizeDate(now);

    return baseList.filter((b) => {
      const bookingDate = getBookingDateObj(b.date);
      if (clientDateFilter === 'today') {
        return normalizeDate(bookingDate) === todayStr;
      }
      if (clientDateFilter === 'this_week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return bookingDate >= startOfWeek && bookingDate <= endOfWeek;
      }
      if (clientDateFilter === 'this_month') {
        return (
          bookingDate.getMonth() === now.getMonth() &&
          bookingDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [groupedCustomerBookings, renderedFilter, clientDateFilter]);

  // Cursor-based pagination for Completed & Cancelled sections
  const cursorPage = useMemo(() => {
    const isCursorPaginated = renderedFilter === 'completed' || renderedFilter === 'cancelled';
    if (!isCursorPaginated) {
      return {
        items: filteredBookings,
        nextCursor: null as string | null,
        hasNextPage: false,
        hasPrevPage: false,
        pageIndex: 1,
        totalItems: filteredBookings.length,
      };
    }

    let startIndex = 0;
    if (currentCursor) {
      const [cursorMsStr, cursorId] = currentCursor.split('|');
      const cursorMs = Number(cursorMsStr);
      // Seek first item strictly after the cursor in descending order (startMs < cursorMs, or equal & id < cursorId)
      const foundIdx = filteredBookings.findIndex((b) => {
        const itemCursor = groupedCustomerBookings.cursorMap.get(b.id) || '0|';
        const [itemMsStr, itemId] = itemCursor.split('|');
        const itemMs = Number(itemMsStr);
        if (itemMs < cursorMs) return true;
        if (itemMs === cursorMs && itemId.localeCompare(cursorId) < 0) return true;
        return false;
      });
      startIndex = foundIdx === -1 ? filteredBookings.length : foundIdx;
    }

    const items = filteredBookings.slice(startIndex, startIndex + CURSOR_PAGE_SIZE);
    const hasNextPage = startIndex + CURSOR_PAGE_SIZE < filteredBookings.length;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasNextPage && lastItem
        ? groupedCustomerBookings.cursorMap.get(lastItem.id) || null
        : null;

    return {
      items,
      nextCursor,
      hasNextPage,
      hasPrevPage: cursorHistory.length > 0,
      pageIndex: cursorHistory.length + 1,
      totalItems: filteredBookings.length,
    };
  }, [filteredBookings, renderedFilter, currentCursor, cursorHistory.length, groupedCustomerBookings.cursorMap]);

  // Count bookings in the active tab ignoring the date filter — hides date pills when the tab is empty
  const activeTabCount = useMemo(() => {
    if (renderedFilter === 'upcoming') return groupedCustomerBookings.upcoming.length;
    if (renderedFilter === 'cancelled') return groupedCustomerBookings.cancelled.length;
    return groupedCustomerBookings.completed.length;
  }, [groupedCustomerBookings, renderedFilter]);

  const getFilterLabel = (type: FilterType) => {    switch (type) {
      case 'upcoming': return 'Upcoming';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return '';
    }
  };

  const filterOptions: FilterType[] = ['upcoming', 'completed', 'cancelled'];

  if (role === 'trainer') {
    return (
      <View style={{ flex: 1, backgroundColor: '#FCF5F5' }}>
        {loading ? (
          <SkeletonLoader layout="bookings" />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#FCF5F5' }}>
            {/* Scrollable Content flowing underneath floating compact header */}
            <ScrollView 
              showsVerticalScrollIndicator={false}
              decelerationRate={0.96}
              bounces={true}
              alwaysBounceVertical={true}
              overScrollMode="always"
              nestedScrollEnabled={true}
              className="flex-1 bg-[#FCF5F5]"
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: insets.top + 70,
                paddingBottom: 180,
              }}
            >
              {/* Calendar Card Visual Grid with native styles */}
              <View style={{
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                padding: 20,
                borderRadius: 28,
                gap: 16,
                marginBottom: 24,
              }}>
              <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: "#F4F4F5",
                paddingBottom: 12,
              }}>
                <Text style={{
                  color: "#18181B",
                  fontSize: 12,
                  fontWeight: "900",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  Availability Calendar
                </Text>
                
                {/* Month Navigation Control */}
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                  backgroundColor: "#09090B",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                }}>
                  <TouchableOpacity 
                    onPress={handlePrevMonth} 
                    disabled={!prevMonthAvailable}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#27272A",
                      opacity: !prevMonthAvailable ? 0.3 : 1,
                    }}
                  >
                    <Feather name="chevron-left" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={{
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}>
                    {monthsNames[selectedMonth]} {selectedYear}
                  </Text>
                  <TouchableOpacity 
                    onPress={handleNextMonth} 
                    disabled={!nextMonthAvailable}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#27272A",
                      opacity: !nextMonthAvailable ? 0.3 : 1,
                    }}
                  >
                    <Feather name="chevron-right" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Weekday Names Header */}
              <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderBottomColor: "#F4F4F5",
                paddingBottom: 8,
              }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayInitial, i) => (
                  <View key={i} style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ color: "#A1A1AA", fontSize: 9, fontWeight: "900" }}>{dayInitial}</Text>
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
                            onPress={() => {
                              setSelectedDay(dayNum);
                              setIsSlotsExpanded(false);
                            }}
                            className="flex-1 items-center justify-center py-1.5"
                            style={{ aspectRatio: 1 }}
                          >
                            <View 
                              style={{ width: 32, height: 32, borderRadius: 16 }}
                              className={`items-center justify-center ${
                                isSelected 
                                  ? 'bg-zinc-950' 
                                  : isToday 
                                  ? 'border border-zinc-900 bg-zinc-50' 
                                  : 'bg-transparent'
                              }`}
                            >
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
            <View style={{
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#E5E7EB",
              padding: 20,
              borderRadius: 28,
              gap: 16,
              marginBottom: 24,
            }}>
              {/* Day info and status */}
              <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottomWidth: 1,
                borderBottomColor: "#F4F4F5",
                paddingBottom: 12,
              }}>
                <View style={{ gap: 4, flex: 1 }}>
                  <Text style={{
                    color: "#09090B",
                    fontSize: 18,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: -0.5,
                  }}>
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
                      <View style={{ gap: 4, marginTop: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: isAvailable ? "#16C784" : "#EF4444",
                          }} />
                          <Text style={{
                            fontSize: 12,
                            fontWeight: "900",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            color: isAvailable ? "#16C784" : "#EF4444",
                          }}>
                            {isAvailable ? "AVAILABLE" : "NOT AVAILABLE"}
                          </Text>
                        </View>
                        {isAvailable && (
                          <Text style={{
                            color: "#71717A",
                            fontSize: 11,
                            fontWeight: "600",
                          }}>
                            {activeCount} hours available · {bookedCount} {bookedCount === 1 ? "session" : "sessions"} booked
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
                        if (Platform.OS === 'web') {
                          const confirmMsg = isAvailable 
                            ? `Disable Schedule for ${dateStr}?

This will make all eligible availability slots unavailable.`
                            : `Enable Schedule for ${dateStr}?`;
                          if (window.confirm(confirmMsg)) {
                            if (isAvailable) {
                              disableAllSlotsForDay(coach.id, dateStr);
                            } else {
                              enableAllSlotsForDay(coach.id, dateStr);
                            }
                          }
                          return;
                        }

                        if (isAvailable) {
                          const proceedToDisable = () => {
                            const dayName = getSelectedDateLongString().split(',')[0];
                            setNativeAlertState({
                              visible: true,
                              title: `Disable ${dayName}'s Schedule?`,
                              message: `This will make all eligible availability slots on:

${getSelectedDateLongString()}

unavailable for new bookings.

Any existing confirmed bookings will NOT be cancelled automatically.`,
                              cancelText: 'Cancel',
                              confirmText: 'Disable Day',
                              onConfirm: () => {
                                disableAllSlotsForDay(coach.id, dateStr);
                                setNativeAlertState({
                                  visible: true,
                                  title: 'Day Disabled',
                                  message: 'All slots for this day have been disabled.',
                                  confirmText: 'OK',
                                  onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
                                });
                              },
                            });
                          };

                          if (bookedCount > 0) {
                            setNativeAlertState({
                              visible: true,
                              title: 'Existing Sessions on This Day',
                              message: `You already have ${bookedCount} confirmed ${bookedCount === 1 ? 'session' : 'sessions'}.

Disabling availability will only affect future/unbooked slots. Your confirmed sessions remain scheduled.`,
                              cancelText: 'Cancel',
                              confirmText: 'Continue',
                              onConfirm: proceedToDisable,
                            });
                          } else {
                            proceedToDisable();
                          }
                        } else {
                          enableAllSlotsForDay(coach.id, dateStr);
                          setNativeAlertState({
                            visible: true,
                            title: 'Day Enabled',
                            message: 'All slots for this day have been re-enabled.',
                            confirmText: 'OK',
                            onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
                          });
                        }
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 12,
                        borderWidth: 1,
                        backgroundColor: isAvailable ? "#FAFAFA" : "#4F46E5",
                        borderColor: isAvailable ? "#E5E7EB" : "#4F46E5",
                      }}
                    >
                      <Text style={{
                        fontSize: 10,
                        fontWeight: "900",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: isAvailable ? "#52525B" : "#FFFFFF",
                      }}>
                        {isAvailable ? "Disable Day" : "Enable Day"}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>

              {/* Manage slots collapsible toggle */}
              {!isSelectedDateOutOfRange && coach && (
                <View style={{ gap: 12 }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      console.log('[AVAILABILITY-CLICK-TRACE] MANAGE SLOTS PRESSED');
                      setIsSlotsExpanded(!isSlotsExpanded);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: "#FAFAFA",
                    }}
                  >
                    <Text style={{
                      color: "#4F46E5",
                      fontSize: 12,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}>
                      {isSlotsExpanded ? "Manage Slots ▴" : "Manage Slots ▾"}
                    </Text>
                  </TouchableOpacity>

                   {isSlotsExpanded && (
                     <View style={{ gap: 10, marginTop: 4 }}>
                       {dailySlots
                         .filter((s) =>
                           isSlotVisibleForTrainer(
                             selectedYear,
                             selectedMonth,
                             selectedDay,
                             s.time,
                             today
                           )
                         )
                         .map((slot) => (
                           <View 
                             key={slot.id}
                             style={{
                               padding: 12,
                               borderRadius: 16,
                               borderWidth: 1,
                               flexDirection: "row",
                               justifyContent: "space-between",
                               alignItems: "center",
                               backgroundColor: slot.isAvailable ? "#FFFFFF" : "#FAFAFA",
                               borderColor: slot.isAvailable ? "#E4E4E7" : "#F4F4F5",
                             }}
                           >
                             <TouchableOpacity
                               activeOpacity={slot.isBooked || isSelectedDateOutOfRange ? 1 : 0.8}
                               disabled={slot.isBooked || isSelectedDateOutOfRange}
                               onPress={() => {
                                 if (Platform.OS === "web") {
                                   if (slot.isAvailable) {
                                     if (window.confirm(`Disable availability slot: ${slot.time}?`)) {
                                       toggleMonthlySlotAvailability(coach.id, dateStr, slot.time);
                                     }
                                   } else {
                                     toggleMonthlySlotAvailability(coach.id, dateStr, slot.time);
                                   }
                                   return;
                                 }

                                 if (slot.isAvailable) {
                                   setNativeAlertState({
                                     visible: true,
                                     title: "Disable slot?",
                                     message: "Are you sure you want to disable this availability slot?",
                                     cancelText: "Cancel",
                                     confirmText: "Disable Slot",
                                     onConfirm: () => {
                                       toggleMonthlySlotAvailability(coach.id, dateStr, slot.time);
                                       setNativeAlertState(prev => ({ ...prev, visible: false }));
                                     },
                                   });
                                 } else {
                                   toggleMonthlySlotAvailability(coach.id, dateStr, slot.time);
                                 }
                               }}
                               style={{
                                 flexDirection: "row",
                                 alignItems: "center",
                                 gap: 12,
                                 flex: 1,
                                 paddingRight: 16,
                               }}
                             >
                            {/* Checkbox / Booked indicator with exact native styles */}
                            <View style={{
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              borderWidth: 1,
                              justifyContent: "center",
                              alignItems: "center",
                              backgroundColor: slot.isBooked 
                                ? "#E4E4E7" 
                                : slot.isAvailable 
                                ? "#4F46E5" 
                                : "#FFFFFF",
                              borderColor: slot.isBooked
                                ? "#D4D4D8"
                                : slot.isAvailable
                                ? "#4F46E5"
                                : "#D4D4D8",
                            }}>
                              {slot.isBooked ? (
                                <Feather name="lock" size={9} color="#6B7280" />
                              ) : slot.isAvailable ? (
                                <Feather name="check" size={9} color="#FFFFFF" />
                              ) : null}
                            </View>

                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={{
                                fontSize: 12,
                                fontWeight: "900",
                                color: slot.isBooked
                                  ? "#A1A1AA"
                                  : slot.isAvailable
                                  ? "#09090B"
                                  : "#71717A",
                                textDecorationLine: !slot.isAvailable && !slot.isBooked ? "line-through" : "none",
                              }}>
                                {slot.time}
                              </Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                                <Text style={{
                                  fontSize: 8,
                                  fontWeight: "900",
                                  textTransform: "uppercase",
                                  color: slot.isAvailable ? "#4F46E5" : "#A1A1AA",
                                }}>
                                  {slot.isAvailable ? "Available" : "Unavailable"}
                                </Text>
                                {!!slot.category && (
                                  <>
                                    <Text style={{ color: "#D4D4D8", fontSize: 8 }}>•</Text>
                                    <Text style={{
                                      color: "#71717A",
                                      fontSize: 8,
                                      fontWeight: "900",
                                      textTransform: "uppercase",
                                    }}>
                                      {slot.category}
                                    </Text>
                                  </>
                                )}
                                {slot.isBooked && (
                                  <>
                                    <Text style={{ color: "#D4D4D8", fontSize: 8 }}>•</Text>
                                    <Text style={{
                                      color: "#EF4444",
                                      fontSize: 8,
                                      fontWeight: "900",
                                      textTransform: "uppercase",
                                    }}>
                                      Booked Session
                                    </Text>
                                  </>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>

                          {/* Configure category trigger with exact native styles */}
                          {!slot.isBooked && slot.isAvailable && !isSelectedDateOutOfRange && (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => handleEditTimeSlot(slot.time, slot.category)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: "#FAFAFA",
                                borderWidth: 1,
                                borderColor: "#F4F4F5",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
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
            <NativeDivider color="#E4E4E7" className="my-4" />

            {/* VISITS OVERVIEW TAB LIST */}
            <View className="mb-4">
              <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider pl-1 mb-3">
                Visits Feed Overview
              </Text>
              
              <NativeSegmentedControl
                items={[
                  { key: 'today', label: 'Today' },
                  { key: 'tomorrow', label: 'Tomorrow' },
                  { key: 'weekly', label: 'Weekly' },
                  { key: 'history', label: 'History' },
                ]}
                activeKey={trainerTab}
                onChangeKey={(tab) => setTrainerTab(tab)}
                marginVertical={0}
              />
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
                      dateLabel: formatToDDMMYYYY(d),
                      count: dayBookings.length
                    });
                  }

                  return (
                    <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-1">
                      {weeklyList.map((item, idx) => (
                        <View key={idx} className="flex-row justify-between items-center py-2.5 border-b border-zinc-50 last:border-b-0">
                          <Text className="text-zinc-950 text-xs font-semibold uppercase tracking-wider">
                            {item.dayLabel} • {item.dateLabel}
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
                  const historicalBookings = getFilteredSessions('history');
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
                          const missedCount = daySessions.filter(s => s.status === 'client_no_show' || s.status === 'trainer_no_show' || s.status === 'missed_session_not_started').length;
                          
                          const d = new Date(dateKey);
                          const formattedDate = formatToDDMMYYYY(d);

                          return (
                            <View key={dateKey} className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-2">
                              <View className="flex-row justify-between items-center border-b border-zinc-100 pb-2">
                                <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">{formattedDate}</Text>
                                <Text className="text-zinc-500 text-[10px] font-bold uppercase">
                                  {completedCount} completed {completedCount === 1 ? 'session' : 'sessions'}
                                  {cancelledCount > 0 && ` · ${cancelledCount} cancelled`}
                                  {missedCount > 0 && ` · ${missedCount} missed`}
                                </Text>
                              </View>
                              <View className="gap-2.5 mt-1">
                                {daySessions.map(b => {
                                  const isMissedSession = b.status === 'client_no_show' || b.status === 'trainer_no_show' || b.status === 'missed_session_not_started';
                                  return (
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
                                      <View className={`px-2 py-0.5 rounded-full ${
                                        b.status === 'completed' 
                                          ? 'bg-[#ECFDF5] border border-[#A7F3D0]' 
                                          : isMissedSession 
                                          ? 'bg-amber-50 border border-amber-200' 
                                          : 'bg-[#FEF2F2] border border-[#FEE2E2]'
                                      }`}>
                                        <Text className={`text-[8px] font-black uppercase ${
                                          b.status === 'completed' 
                                            ? 'text-emerald-600' 
                                            : isMissedSession 
                                            ? 'text-amber-600' 
                                            : 'text-rose-600'
                                        }`}>
                                          {b.status === 'completed' ? 'Completed' : isMissedSession ? 'Missed' : 'Cancelled'}
                                        </Text>
                                      </View>
                                    </TouchableOpacity>
                                  );
                                })}
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

          {/* Floating Compact Header with integrated Back, Title & Pro Console Tag */}
          <View
            className="px-5 pb-3 bg-[#FCF5F5]/92 border-b border-zinc-200/60"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 30,
              paddingTop: insets.top + 6,
              ...softShadow({ color: '#101828', opacity: 0.03, radius: 6, offsetY: 2 }),
            }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                <TouchableOpacity
                  activeOpacity={0.6}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => {
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.replace('/(tabs)');
                    }
                  }}
                  className="w-9 h-9 items-center justify-center rounded-full bg-white/80 border border-zinc-200/70"
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <Ionicons name="chevron-back" size={22} color="#101828" />
                </TouchableOpacity>

                <View className="flex-1">
                  <Text className="text-[#101828] text-xl font-black tracking-tight" numberOfLines={1}>
                    My Schedule
                  </Text>
                  <Text className="text-[#6B7280] text-[10.5px] font-semibold tracking-tight" numberOfLines={1}>
                    Manage slots & availability limits
                  </Text>
                </View>
              </View>

              <View className="px-2.5 py-1 rounded-full bg-zinc-900/5 border border-zinc-900/10">
                <Text className="text-[#6B7280] text-[9.5px] font-black uppercase tracking-widest">
                  PRO CONSOLE
                </Text>
              </View>
            </View>
          </View>
          </View>
        )}

        {/* Semi-transparent white status bar strip for smooth frosted glass / translucent edge-to-edge feel */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: 'rgba(255, 255, 255, 0.55)',
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(0, 0, 0, 0.05)',
            zIndex: 40,
          }}
        />

        {/* Native Alert Dialog for Trainer Actions */}
        <NativeAlertDialog
          visible={nativeAlertState.visible}
          title={nativeAlertState.title}
          message={nativeAlertState.message}
          confirmText={nativeAlertState.confirmText || 'OK'}
          cancelText={nativeAlertState.cancelText}
          onConfirm={nativeAlertState.onConfirm}
          onDismiss={() => setNativeAlertState(prev => ({ ...prev, visible: false }))}
        />

        {/* Native Single Choice Dialog for Category Restriction */}
        <NativeSingleChoiceDialog
          visible={categoryDialogState.visible}
          title="Select Category Restriction"
          message="Set the allowed workout category for this slot:"
          options={['Strength', 'Mind & Body', 'Cardio', 'Conditioning', 'Boxing', 'Aerial Yoga', 'Pilates', 'Any Workout']}
          selectedOption={categoryDialogState.currentCategory || 'Any Workout'}
          onSelect={(cat) => {
            if (coach) {
              updateMonthlySlotCategory(coach.id, dateStr, categoryDialogState.time, cat === 'Any Workout' ? '' : cat);
              setNativeAlertState({
                visible: true,
                title: 'Category Updated',
                message: `Slot category preference set to ${cat}.`,
                confirmText: 'OK',
                onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
              });
            }
          }}
          onDismiss={() => setCategoryDialogState(prev => ({ ...prev, visible: false }))}
        />
      </View>
    );
  }

  // Client view
  return (
    <View style={{ flex: 1, backgroundColor: '#FCF5F5' }}>
      {loading ? (
        <SkeletonLoader layout="bookings" />
      ) : (
        <View style={{ flex: 1 }}>
          {/* Scrollable Content flowing underneath floating top bar */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            decelerationRate={0.96}
            bounces={true}
            alwaysBounceVertical={true}
            overScrollMode="always"
            snapToOffsets={[0, 90]}
            snapToStart={false}
            snapToEnd={false}
            nestedScrollEnabled={true}
            className="flex-1 px-4"
            contentContainerStyle={{ 
              paddingTop: insets.top + 60,
              paddingBottom: Math.max((insets.bottom || 0) + 40, 140)
            }}
            scrollEventThrottle={16}
            onScroll={({ nativeEvent }) => {
              const collapsed = nativeEvent.contentOffset.y > 90;
              setIsHeaderCollapsed((prev) => (prev === collapsed ? prev : collapsed));
            }}
          >
            {/* Header Title Section inside page scroll */}
            <View className="mb-5 pt-1 px-2">
              <Text className="text-[#E11D48] text-2xl font-black uppercase tracking-tight">
                MY SCHEDULE
              </Text>
              <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1">
                Track and manage all your scheduled home wellness visits.
              </Text>
            </View>

            {/* Filter Capsule Selector Tabs */}
            <View className="mb-4">
              <NativeSegmentedControl
                items={filterOptions.map((opt) => ({
                  key: opt,
                  label: getFilterLabel(opt),
                }))}
                activeKey={activeFilter}
                onChangeKey={(opt) => {
                  if (activeFilter === opt) return;
                  setActiveFilter(opt);
                  setClientDateFilter('all');
                  setCurrentCursor(null);
                  setCursorHistory([]);
                  setRenderedFilter(opt);
                }}
                marginVertical={0}
              />
            </View>

        {/* Date Filter Pills (All / Today / This Week / This Month) — hidden when the tab is empty */}
        {activeTabCount > 0 && (
        <View className="mb-5 -mx-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}
          >
            {(['all', 'today', 'this_week', 'this_month'] as const).map((filterKey) => {
              const isActive = clientDateFilter === filterKey;
              const labels = {
                all: 'All',
                today: 'Today',
                this_week: 'This Week',
                this_month: 'This Month',
              };
              return (
                <TouchableOpacity
                  key={filterKey}
                  activeOpacity={0.8}
                  onPress={() => {
                    setClientDateFilter(filterKey);
                    setCurrentCursor(null);
                    setCursorHistory([]);
                  }}
                  className={`px-4 py-2 rounded-full border items-center justify-center flex-row ${
                    isActive
                      ? 'bg-[#101828] border-[#101828]'
                      : 'bg-white border-zinc-200/80'
                  }`}
                  style={{ flexShrink: 0 }}
                >
                  <Text
                    numberOfLines={1}
                    className={`text-xs font-bold ${
                      isActive ? 'text-white' : 'text-zinc-600'
                    }`}
                  >
                    {labels[filterKey]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            </ScrollView>
          </View>
          )}

          {/* Bookings Render List */}
        <View className="min-h-[220px]">
          {cursorPage.items.length > 0 ? (
            <>
              {cursorPage.items.map((booking) => (
                <BookingCard 
                  key={booking.id} 
                  booking={booking} 
                  onOpenSupport={handleOpenSupport}
                />
              ))}
              {(renderedFilter === 'completed' || renderedFilter === 'cancelled') &&
                (cursorPage.hasPrevPage || cursorPage.hasNextPage) && (
                  <View className="flex-row items-center justify-between mt-4 mb-2 pt-3 border-t border-zinc-200/80">
                    <TouchableOpacity
                      activeOpacity={0.75}
                      disabled={!cursorPage.hasPrevPage}
                      onPress={() => {
                        if (!cursorPage.hasPrevPage) return;
                        const prevCursor = cursorHistory[cursorHistory.length - 1] ?? null;
                        setCursorHistory((prev) => prev.slice(0, -1));
                        setCurrentCursor(prevCursor);
                      }}
                      className={`px-4 py-2.5 rounded-full flex-row items-center gap-1.5 border ${
                        cursorPage.hasPrevPage
                          ? 'bg-white border-zinc-300'
                          : 'bg-zinc-100 border-zinc-200 opacity-40'
                      }`}
                    >
                      <Feather name="chevron-left" size={14} color="#101828" />
                      <Text className="text-[#101828] text-xs font-bold">Prev</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.75}
                      disabled={!cursorPage.hasNextPage || !cursorPage.nextCursor}
                      onPress={() => {
                        if (!cursorPage.hasNextPage || !cursorPage.nextCursor) return;
                        setCursorHistory((prev) => [...prev, currentCursor]);
                        setCurrentCursor(cursorPage.nextCursor);
                      }}
                      className={`px-4 py-2.5 rounded-full flex-row items-center gap-1.5 ${
                        cursorPage.hasNextPage
                          ? 'bg-[#101828]'
                          : 'bg-zinc-200 opacity-40'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          cursorPage.hasNextPage ? 'text-white' : 'text-zinc-500'
                        }`}
                      >
                        Next
                      </Text>
                      <Feather
                        name="chevron-right"
                        size={14}
                        color={cursorPage.hasNextPage ? '#FFFFFF' : '#6B7280'}
                      />
                    </TouchableOpacity>
                  </View>
                )}
            </>
          ) : (
            <EmptyState 
              type={renderedFilter === 'completed' || renderedFilter === 'past' ? 'no-sessions' : 'no-bookings'} 
              title={
                renderedFilter === 'cancelled' 
                  ? 'No Cancelled Sessions' 
                  : renderedFilter === 'completed' 
                    ? 'No Completed Sessions' 
                    : 'No Upcoming Sessions'
              }
              showCard={false}
              message={
                renderedFilter === 'cancelled' && clientDateFilter !== 'all'
                  ? `No cancelled or missed visits found for this period.`
                  : renderedFilter === 'upcoming' 
                    ? 'Schedule your next premium at-home training session from the home dashboard.'
                    : renderedFilter === 'cancelled'
                      ? 'You do not have any cancelled sessions logged in your profile.'
                      : `You do not have any ${renderedFilter} visits logged in your profile.`
              }
              actionText={clientDateFilter !== 'all' ? 'Show All' : undefined}
              onAction={clientDateFilter !== 'all' ? () => setClientDateFilter('all') : undefined}
            />
          )}
        </View>
        </ScrollView>

        {/* Floating Top Bar (Matching Wallet Detail Page): Left Back Button with SVG Scrim, Center Dynamic Pill, Right Notepad with SVG Scrim */}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            right: 16,
            zIndex: 40,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Localized Pill-shaped Back Button Scrim */}
          <View pointerEvents="box-none" className="relative flex-row items-center">
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -6,
                left: -8,
                right: -32,
                bottom: -6,
              }}
            >
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="bookingsBackBtnScrim" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FCF5F5" stopOpacity="0.95" />
                    <Stop offset="65%" stopColor="#FCF5F5" stopOpacity="0.85" />
                    <Stop offset="85%" stopColor="#FCF5F5" stopOpacity="0.4" />
                    <Stop offset="100%" stopColor="#FCF5F5" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" rx={25} ry={25} fill="url(#bookingsBackBtnScrim)" />
              </Svg>
            </View>

            <TouchableOpacity
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              }}
              className="w-10 h-10 rounded-full bg-white/90 border border-zinc-200/80 shadow-xs items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={22} color="#101828" style={{ marginLeft: -1 }} />
            </TouchableOpacity>
          </View>

          {/* Center Pill Section: Seamless pill with transparent frosted backdrop */}
          <View pointerEvents="none" className="absolute left-0 right-0 items-center justify-center">
            <View 
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.65)',
                borderColor: 'rgba(226, 232, 240, 0.75)',
                borderWidth: 1,
              }}
              className="flex-row items-center px-4 py-1.5 rounded-full shadow-2xs gap-1.5"
            >
              {isHeaderCollapsed ? (
                <>
                  <Text className="text-[#E11D48] text-[13.5px] font-black tracking-tight">
                    {groupedCustomerBookings.completed.length}
                  </Text>
                  <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">
                    Completed
                  </Text>
                </>
              ) : (
                <Text className="text-zinc-950 text-[13px] font-black tracking-tight">
                  My Schedule
                </Text>
              )}
            </View>
          </View>

          {/* Right Action: Support Tickets Notepad with localized Scrim */}
          <View pointerEvents="box-none" className="relative flex-row items-center">
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -6,
                right: -8,
                left: -32,
                bottom: -6,
              }}
            >
              <Svg width="100%" height="100%" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="bookingsNotepadBtnScrim" x1="100%" y1="0%" x2="0%" y2="0%">
                    <Stop offset="0%" stopColor="#FCF5F5" stopOpacity="0.95" />
                    <Stop offset="65%" stopColor="#FCF5F5" stopOpacity="0.85" />
                    <Stop offset="85%" stopColor="#FCF5F5" stopOpacity="0.4" />
                    <Stop offset="100%" stopColor="#FCF5F5" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" rx={25} ry={25} fill="url(#bookingsNotepadBtnScrim)" />
              </Svg>
            </View>

            <TouchableOpacity
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => setShowUserTicketsModal(true)}
              className="w-10 h-10 rounded-full bg-white/90 border border-zinc-200/80 shadow-xs items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="My Support Tickets"
            >
              <Feather name="file-text" size={17} color="#101828" />
            </TouchableOpacity>
          </View>
        </View>
        </View>
      )}

      {/* 1. Raise Support Ticket Question Flow Modal */}
      <RaiseSupportTicketModal
        visible={showRaiseTicketModal}
        booking={supportBooking}
        userId={user.id}
        onClose={() => {
          setShowRaiseTicketModal(false);
          setSupportBooking(null);
        }}
        onTicketCreated={(newTicket) => {
          setActiveChatTicket(newTicket);
          setShowSupportChatModal(true);
        }}
      />

      {/* 2. User Ticket History Modal */}
      <UserTicketsModal
        visible={showUserTicketsModal}
        userId={user.id}
        onClose={() => setShowUserTicketsModal(false)}
        onSelectTicket={(ticket) => {
          setActiveChatTicket(ticket);
          setShowSupportChatModal(true);
        }}
      />

      {/* 3. Realtime User ↔ Admin Support Chat Modal */}
      <SupportChatModal
        visible={showSupportChatModal}
        ticket={activeChatTicket}
        currentRole="customer"
        onClose={() => {
          setShowSupportChatModal(false);
          setActiveChatTicket(null);
        }}
      />

      {/* Native Alert Dialog for Trainer Actions */}
      <NativeAlertDialog
        visible={nativeAlertState.visible}
        title={nativeAlertState.title}
        message={nativeAlertState.message}
        confirmText={nativeAlertState.confirmText || 'OK'}
        cancelText={nativeAlertState.cancelText}
        onConfirm={nativeAlertState.onConfirm}
        onDismiss={() => setNativeAlertState(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#FCF5F5', paddingTop: insets.top }}>
      {children}
    </View>
  );
}
