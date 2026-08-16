/* eslint-disable react-hooks/set-state-in-effect */
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Platform, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { ProgressRing } from '../../components/ProgressRing';
import { LuxuryCard } from '../../components/LuxuryCard';
import { useBookingStore } from '../../store/bookingStore';
import { useCoachStore, generateMonthlySlots } from '../../store/coachStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useUserStore } from '../../store/userStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useWorkoutStore } from '../../store/workoutStore';
import { useWalletStore } from '../../store/walletStore';
import { Database } from '../../database/Database';
import { AddPartnerModal } from '../../components/AddPartnerModal';
import { supabase } from '../../database/supabaseClient';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useAIWellnessStore } from '../../store/aiWellnessStore';
import { Booking } from '../../types';
import { normalizeDate, canonicalizeTimeRange } from '../../utils/date';

interface RequestCardProps {
  booking: Booking;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onTimeout: (id: string) => void;
  onPress: (id: string) => void;
}

export function RequestCard({ booking, onAccept, onDecline, onTimeout, onPress }: RequestCardProps) {
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const elapsed = Math.floor((Date.now() - (booking.createdAt || Date.now())) / 1000);
      return Math.max(0, 60 - elapsed);
    };

    const initialTimeLeft = calculateTimeLeft();
    setTimeLeft(initialTimeLeft);

    if (initialTimeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          const nextTime = calculateTimeLeft();
          if (nextTime <= 0) {
            clearInterval(timer);
            onTimeout(booking.id);
            return 0;
          }
          return nextTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [booking.id, booking.createdAt]);

  const customerId = `VIRLA-C${booking.id.slice(-6).toUpperCase()}`;
  const customerGender = booking.id.charCodeAt(booking.id.length - 1) % 2 === 0 ? 'Female' : 'Male';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(booking.id)}
      className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4 mb-4"
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-rose-500" />
          <Text className="text-[#101828] text-xs font-black tracking-wider">{customerId}</Text>
        </View>
        
        <View className="bg-rose-50 border border-rose-100 px-3 py-1 rounded-full flex-row items-center gap-1.5">
          <Feather name="clock" size={10} color="#E11D48" />
          <Text className="text-[#E11D48] text-[10px] font-black">{timeLeft}s left</Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-[#101828] text-base font-black tracking-tight">{booking.workoutTitle}</Text>
        <Text className="text-zinc-500 text-xs font-semibold leading-relaxed">
          {booking.date} • {booking.time} ({booking.durationMinutes || 60} mins)
        </Text>
        
        <View className="flex-row gap-2 mt-1 flex-wrap">
          <View className="bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg">
            <Text className="text-zinc-650 text-[9px] font-bold uppercase">{customerGender}</Text>
          </View>
          <View className="bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg">
            <Text className="text-zinc-650 text-[9px] font-bold uppercase">Solo Session</Text>
          </View>
          <View className="bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg">
            <Text className="text-zinc-650 text-[9px] font-bold uppercase">{booking.address ? booking.address.split(',')[0] : 'Venue'}</Text>
          </View>
        </View>
      </View>

      <View className="h-[1px] bg-zinc-100 my-1" />

      <View className="flex-row">
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onAccept(booking.id);
          }}
          className="flex-1 bg-[#E11D48] py-3.5 rounded-2xl items-center justify-center"
        >
          <Text className="text-white text-xs font-black uppercase">Accept Request</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const getWorkoutEmoji = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('forge') || t.includes('strength')) return '🏋️';
  if (t.includes('flow') || t.includes('motion')) return '🧘‍♀️';
  if (t.includes('rhythm') || t.includes('burn')) return '💃';
  if (t.includes('reset') || t.includes('studio') || t.includes('stretch')) return '🧘‍♂️';
  if (t.includes('combat') || t.includes('boxing')) return '🥊';
  return '🧘';
};

export default function HomeScreen() {
  const router = useRouter();
  const { bookings, acceptBooking, updateTimelineStatus, reassignTrainer } = useBookingStore();
  const { membership } = useMembershipStore();
  const { unreadCount } = useNotificationStore();
  const { user, role } = useUserStore();
  const { totalEarnings, earningsList, coaches } = useCoachStore();
  const { savedPlan } = useAIWellnessStore();

  const [partnerModalVisible, setPartnerModalVisible] = useState(false);
  const [activePartnerBookingId, setActivePartnerBookingId] = useState('');

  const handleHiddenAdminAccess = async () => {
    const userId = Database.getCurrentUserId();
    if (!userId) {
      Alert.alert('Access Denied', 'Please log in first.');
      return;
    }
    try {
      const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
      if (data && data.role === 'admin') {
        router.push('/admin-panel' as any);
      } else {
        Alert.alert('Access Denied', 'You do not have administrative authorization.');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Unable to verify administrative authorization.');
    }
  };

  const [trainerOnlineStatus, setTrainerOnlineStatus] = useState<'online' | 'offline'>('online');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await useBookingStore.getState().refreshBookings();
    } catch (e) {
      console.error('Manual sync failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAcceptRequest = (id: string) => {
    Alert.alert(
      'Accept Booking?',
      'By accepting this booking you agree to complete the session. Once accepted it cannot be cancelled except through VIRLA Support.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => {
            acceptBooking(id);
            Alert.alert('Booking Accepted', 'You have accepted the session request.');
          }
        }
      ]
    );
  };

  const handleDeclineRequest = (id: string) => {
    reassignTrainer(id, 'declined');
    Alert.alert('Request Declined', 'The request has been reassigned to another available trainer.');
  };

  const handleTimeoutRequest = (id: string) => {
    reassignTrainer(id, 'timeout');
  };

  const currentCoach = coaches.find(c => c.name === user.name);

  // Helper date calculations for Trainer Console Redesign
  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getFormattedToday = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const now = new Date();
    return `${days[now.getDay()]} • ${now.getDate()} ${months[now.getMonth()]}`;
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

  const getBookingStartDateTime = (b: Booking): Date => {
    const dateObj = getBookingDateObj(b.date);
    const timeStr = (b.time || '').split('-')[0].trim();
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      dateObj.setHours(h, m, 0, 0);
    }
    return dateObj;
  };

  const sortBookingsChronologically = (list: Booking[]) => {
    return [...list].sort((a, b) => {
      const dateA = getBookingDateObj(a.date);
      const dateB = getBookingDateObj(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      const parseTimeToMinutes = (t: string) => {
        const match = (t || '').split('-')[0].trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return 0;
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };
      return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
    });
  };

  const trainerBookings = bookings.filter(b => 
    (b.trainerName === user.name || (currentCoach && b.trainerId === currentCoach.id))
  );

  const confirmedBookings = trainerBookings.filter(b => 
    b.status === 'upcoming' && 
    [
      'trainer_accepted', 
      'trainer_travelling', 
      'trainer_arrived', 
      'session_started',
      'completed'
    ].includes(b.timelineStatus || '')
  );

  const sortedConfirmed = sortBookingsChronologically(confirmedBookings);
  const nowTime = new Date();
  
  const activeSession = sortedConfirmed.find(b => 
    ['trainer_travelling', 'trainer_arrived', 'otp_verified', 'workout_started'].includes(b.timelineStatus || '')
  );

  const nextSession = sortedConfirmed.find(b => {
    if (activeSession && b.id === activeSession.id) return false;
    if (b.timelineStatus === 'workout_completed' || b.timelineStatus === 'session_closed' || b.status === 'completed' || b.status === 'cancelled') return false;
    const start = getBookingStartDateTime(b);
    const end = new Date(start.getTime() + (b.durationMinutes || 60) * 60 * 1000);
    return end > nowTime;
  });

  let countdownText = '';
  let isNextSessionToday = false;
  if (nextSession) {
    const start = getBookingStartDateTime(nextSession);
    isNextSessionToday = normalizeDate(start) === normalizeDate(nowTime);
    
    const diffMs = start.getTime() - nowTime.getTime();
    if (diffMs > 0) {
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (hours > 0) {
        countdownText = `Starts in ${hours}h ${mins}m`;
      } else {
        countdownText = `Starts in ${mins}m`;
      }
    } else {
      countdownText = 'Active Session';
    }
  }

  const nextSessionTime = nextSession ? (nextSession.time || '').split('-')[0].trim() : '';

  const todayBookings = sortedConfirmed.filter(b => {
    return normalizeDate(getBookingDateObj(b.date)) === normalizeDate(nowTime);
  });
  
  const todaySessionsCount = todayBookings.length;
  const todaySessionsHours = todayBookings.reduce((sum, b) => sum + (b.durationMinutes || 60), 0) / 60;
  const formattedTodayHours = todaySessionsHours.toFixed(1).replace('.0', '');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDateStr = normalizeDate(tomorrow);

  const tomorrowBookings = sortedConfirmed.filter(b => {
    return normalizeDate(getBookingDateObj(b.date)) === tomorrowDateStr;
  });

  const getIsTomorrowScheduleEnabled = () => {
    if (!currentCoach) return false;
    const allTomorrowSlots = generateMonthlySlots(tomorrow.getMonth(), tomorrow.getFullYear());
    const tomorrowSlotsData = allTomorrowSlots.find((d: any) => d.date === tomorrowDateStr)?.slots || [];
    const availabilityOverrides = currentCoach.preferences?.availabilityOverrides || [];
    const tomorrowActiveSlots = tomorrowSlotsData.filter((slot: any) => {
      const override = availabilityOverrides.find((o: any) => 
        normalizeDate(o.date) === tomorrowDateStr && 
        canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time)
      );
      return override ? override.isAvailable : true; // Default to true if no override
    });
    return tomorrowActiveSlots.length > 0;
  };

  const isTomorrowScheduleEnabled = getIsTomorrowScheduleEnabled();

  const getTodayAvailability = () => {
    if (!currentCoach) return { booked: 0, available: 0 };
    const todayDateStr = normalizeDate(new Date());
    const allDaysSlots = generateMonthlySlots(new Date().getMonth(), new Date().getFullYear());
    const todaySlotsData = allDaysSlots.find((d: any) => d.date === todayDateStr)?.slots || [];
    const availabilityOverrides = currentCoach.preferences?.availabilityOverrides || [];
    const reservations = Database.schema.slot_reservations || [];
    
    let bookedSlotsToday = 0;
    let availableSlotsToday = 0;

    todaySlotsData.forEach((slot: any) => {
      const isBooked = bookings.some((b: any) => 
        b.trainerId === currentCoach.id && 
        normalizeDate(b.date) === normalizeDate(todayDateStr) && 
        canonicalizeTimeRange(b.time) === canonicalizeTimeRange(slot.time) && 
        b.status === 'upcoming'
      );
      const isReserved = reservations.some((r: any) =>
        r.trainer_id === currentCoach.id &&
        normalizeDate(r.slot_date) === normalizeDate(todayDateStr) &&
        canonicalizeTimeRange(r.slot_time) === canonicalizeTimeRange(slot.time) &&
        r.expires_at > Date.now()
      );
      const override = availabilityOverrides.find((o: any) => 
        normalizeDate(o.date) === normalizeDate(todayDateStr) && 
        canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time)
      );
      const isAvailable = override ? override.isAvailable : true;
      if (isBooked || isReserved) {
        bookedSlotsToday++;
      } else if (isAvailable) {
        availableSlotsToday++;
      }
    });

    return {
      booked: bookedSlotsToday * 1.5,
      available: availableSlotsToday * 1.5
    };
  };

  const todayAvail = getTodayAvailability();
  const formattedBookedHours = todayAvail.booked.toFixed(1).replace('.0', '');
  const formattedAvailableHours = todayAvail.available.toFixed(1).replace('.0', '');

  const getUpcomingDaysData = () => {
    const list = [];
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const reservations = Database.schema.slot_reservations || [];
    
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStrYMD = normalizeDate(d);
      
      const dayBookingsCount = confirmedBookings.filter(b => 
        normalizeDate(getBookingDateObj(b.date)) === dateStrYMD
      ).length;

      let availableSlots = 0;
      if (currentCoach) {
        const allDaysSlots = generateMonthlySlots(d.getMonth(), d.getFullYear());
        const daySlotsData = allDaysSlots.find((day: any) => day.date === dateStrYMD)?.slots || [];
        const availabilityOverrides = currentCoach.preferences?.availabilityOverrides || [];
        
        daySlotsData.forEach((slot: any) => {
          const isBooked = bookings.some((b: any) => 
            b.trainerId === currentCoach.id && 
            normalizeDate(b.date) === dateStrYMD && 
            canonicalizeTimeRange(b.time) === canonicalizeTimeRange(slot.time) && 
            b.status === 'upcoming'
          );
          const isReserved = reservations.some((r: any) =>
            r.trainer_id === currentCoach.id &&
            normalizeDate(r.slot_date) === dateStrYMD &&
            canonicalizeTimeRange(r.slot_time) === canonicalizeTimeRange(slot.time) &&
            r.expires_at > Date.now()
          );
          const override = availabilityOverrides.find((o: any) => 
            normalizeDate(o.date) === dateStrYMD && 
            canonicalizeTimeRange(o.time) === canonicalizeTimeRange(slot.time)
          );
          const isAvailable = override ? override.isAvailable : true;
          if (!isBooked && !isReserved && isAvailable) {
            availableSlots++;
          }
        });
      }

      list.push({
        dateStr: dateStrYMD,
        label: `${weekdays[d.getDay()]} ${d.getDate()}`,
        sessionsCount: dayBookingsCount,
        availableHours: availableSlots * 1.5
      });
    }
    return list;
  };
  
  const upcomingDays = getUpcomingDaysData();

  React.useEffect(() => {
    if (currentCoach) {
      setTrainerOnlineStatus(currentCoach.preferences?.online ? 'online' : 'offline');
    }
  }, [currentCoach]);

  const toggleOnlineStatus = () => {
    if (!currentCoach) return;
    const nextOnline = !(currentCoach.preferences?.online);

    const performToggle = () => {
      const nextStatus = nextOnline ? 'online' : 'offline';
      setTrainerOnlineStatus(nextStatus);

      Database.updateTrainerOnlineStatus(currentCoach.id, nextOnline);
      useCoachStore.getState().syncFromDB();

      // Immediately revoke pending requests assigned to this coach when going offline
      if (!nextOnline) {
        const pendingRequests = bookings.filter(b => 
          b.trainerName === currentCoach.name && 
          b.timelineStatus === 'booked'
        );
        for (const req of pendingRequests) {
          reassignTrainer(req.id, 'timeout');
        }
      }
    };

    if (!nextOnline) {
      Alert.alert(
        'Go Offline?',
        'Going offline may prevent you from receiving new session requests.\n\nYour already confirmed bookings will remain subject to VIRLA\'s existing booking rules.',
        [
          { text: 'CANCEL', style: 'cancel' },
          { text: 'GO OFFLINE', style: 'destructive', onPress: performToggle }
        ]
      );
    } else {
      performToggle();
    }
  };

  const getMinutesToSession = (job: Booking): number => {
    if (!job) return 0;
    try {
      let datePart = job.date;
      if (datePart.startsWith('Today, ')) {
        datePart = datePart.replace('Today, ', '');
      } else if (datePart.startsWith('Tomorrow, ')) {
        datePart = datePart.replace('Tomorrow, ', '');
      }
      
      let cleanDateStr = datePart;
      const dayMonthMatch = datePart.match(/^[A-Za-z]+ (\d+)/);
      if (dayMonthMatch) {
        const year = new Date().getFullYear();
        cleanDateStr = `${datePart}, ${year}`;
      }
      
      const sessionDate = new Date(cleanDateStr);
      if (isNaN(sessionDate.getTime())) return 0;
      
      const timePart = job.time;
      const timeMatch = timePart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const ampm = timeMatch[3].toUpperCase();
        
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        sessionDate.setHours(hours, minutes, 0, 0);
      }
      
      const now = new Date();
      return (sessionDate.getTime() - now.getTime()) / (1000 * 60);
    } catch (e) {
      return 0;
    }
  };

  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress] = useState(() => new Animated.Value(0));
  const holdTimeoutRef = useRef<any>(null);

  const handlePressIn = () => {
    setIsHolding(true);
    holdProgress.setValue(0);
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start();

    holdTimeoutRef.current = setTimeout(async () => {
      setIsHolding(false);
      holdProgress.setValue(0);
      await handleHiddenAdminAccess();
    }, 5000);
  };

  const handlePressOut = () => {
    setIsHolding(false);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    holdProgress.stopAnimation();
    holdProgress.setValue(0);
  };

  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncData = async () => {
      try {
        await Database.load();
        useUserStore.getState().syncFromDB();
        useUserProfileStore.getState().syncFromDB();
        useBookingStore.getState().syncFromDB();
        useCoachStore.getState().syncFromDB();
        useWorkoutStore.getState().syncFromDB();
        useWalletStore.getState().syncFromDB();
        useMembershipStore.getState().syncFromDB();
        useNotificationStore.getState().syncFromDB();
      } catch (e) {
        console.error('Home sync failed:', e);
      } finally {
        setLoading(false);
      }
    };
    syncData();
  }, [bookings.length]);

  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');
  const pastBookings = bookings.filter((b) => b.status === 'completed');
  const activeBooking = bookings.find(b => b.status === 'upcoming' && b.timelineStatus && b.timelineStatus !== 'session_closed');

  // Hydration state
  const [waterMl, setWaterMl] = useState(0);
  const [caloriesToday, setCaloriesToday] = useState(0);
  const waterGoal = 2500;
  const caloriesGoal = 600;

  // Animations
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(20));
  const [pulseAnim] = useState(() => new Animated.Value(1));

  // AI recommendations array
  const [recs, setRecs] = useState<{ title: string; desc: string }[]>([]);
  const [recIdx, setRecIdx] = useState(0);

  useEffect(() => {
    if (user.id) {
      setRecs(Database.getAIRecommendations(user.id));
    } else {
      setRecs([
        { title: 'Stretch Today', desc: 'Recovery Day: Release lower back tension with a reset session.' },
        { title: 'Increase Intensity', desc: 'Optimal Recovery (80%): Great day for a high-intensity Forge Strength.' },
        { title: 'Try Combat Core', desc: 'Build Cardio: Book a boxing conditioning slot for tomorrow.' },
        { title: 'Book Next Session', desc: 'Keep the Streak: Schedule your mobility visit now.' }
      ]);
    }
  }, [user.id, bookings]);

  useEffect(() => {
    if (recs.length === 0) return;
    const interval = setInterval(() => {
      setRecIdx((prev) => (prev + 1) % recs.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [recs]);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, [role, fadeAnim, slideAnim, pulseAnim]);

  useEffect(() => {
    if (user.id) {
      const dateStr = new Date().toLocaleDateString('en-CA');
      setWaterMl(Database.getHydration(user.id, dateStr));
      setCaloriesToday(Database.getCalories(user.id, dateStr));
    }
  }, [user.id, bookings]);

  const getGreetingText = () => {
    const hour = new Date().getHours();
    const nameText = user.name || 'User';
    if (hour < 12) {
      return { title: `Good Morning, ${nameText} 🌅`, subtitle: 'Ready to build another strong day?' };
    } else if (hour < 17) {
      return { title: `Good Afternoon, ${nameText} ☀️`, subtitle: 'Keep your momentum active today!' };
    } else {
      return { title: `Good Evening, ${nameText} 🌙`, subtitle: 'How did your workout feel today?' };
    }
  };

  const greeting = getGreetingText();
  const nameText = user.name || 'User';
  const hour = new Date().getHours();
  const greetingPrefix = hour < 12 ? 'Good Morning, ' : hour < 17 ? 'Good Afternoon, ' : 'Good Evening, ';
  const greetingSuffix = hour < 12 ? ' 🌅' : hour < 17 ? ' ☀️' : ' 🌙';
  const totalGreetingLength = greetingPrefix.length + nameText.length + greetingSuffix.length;
  
  const dynamicGreetingFontSize = totalGreetingLength > 20 
    ? Math.max(22, 34 - (totalGreetingLength - 20) * 0.8)
    : 34;

  const dynamicLetterSpacing = totalGreetingLength > 24 ? -0.3 : -0.7;

  // Personal Fitness Score Calculation
  const dateStr = new Date().toLocaleDateString('en-CA');
  const streak = user.id ? Database.getStreak(user.id) : 0;
  const userRecovery = user.id ? Database.getRecoveryScore(user.id, dateStr) : null;
  const recoveryVal = userRecovery ?? 0;
  const profileObj = user.id ? Database.getProfile(user.id) : null;

  // Trainer metric summary calculations
  const completedJobs = bookings.filter(b => b.status === 'completed');
  const upcomingJobs = bookings.filter(b => b.status === 'upcoming');
  const cancelledJobs = bookings.filter(b => b.status === 'cancelled');
  const totalCompleted = completedJobs.length;
  const totalUpcoming = upcomingJobs.length;

  const trainerEarningsList = user.id ? Database.getEarnings(user.id) : [];
  const monthlyEarnings = trainerEarningsList.reduce((acc, earn) => acc + (earn.amount > 0 ? earn.amount : 0), 0);

  const handleLogWater = () => {
    if (user.id) {
      const dateStr = new Date().toLocaleDateString('en-CA');
      const newWater = Database.logHydration(user.id, dateStr, 250);
      setWaterMl(newWater);
      Alert.alert('Hydration Logged', '+250ml added! Stay hydrated to maximize recovery index.');
    } else {
      Alert.alert('Authentication Required', 'Please register or log in first');
    }
  };

  const handleSupport = () => {
    Alert.alert('VIRLA VIP Concierge', 'Connecting to VIP wellness support line (+91 99999 88888)...');
  };

  const handleCommunicationCenter = () => {
    Alert.alert(
      'Communication Center',
      'Select a destination to open:',
      [
        {
          text: 'Notifications Center',
          onPress: () => router.push('/notifications' as any),
        },
        {
          text: 'Messages (Chats)',
          onPress: () => router.push('/(tabs)/messages' as any),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleTrainerJobClick = (bookingId: string, currentTimeline: string) => {
    if (currentTimeline === 'confirmed') {
      acceptBooking(bookingId);
      Alert.alert('Job Accepted', 'You accepted this session. Ready to begin travel at the scheduled time!');
    } else {
      router.push({
        pathname: '/session-detail' as any,
        params: { id: bookingId },
      });
    }
  };

  return (
    <SafeAreaViewWrapper>
      {/* Dynamic Header */}
      <View className="h-20 flex-row items-center justify-between px-6 bg-[#FCF5F5]">
        <View className="relative flex-row items-center">
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            className="pr-4 py-2"
          >
            <Text className="text-2xl font-bold tracking-[0.2em] text-[#E11D48]">
              {role === 'trainer' ? 'VIRLA PRO' : 'VIRLA'}
            </Text>
            <Text className="text-[10px] font-medium tracking-[0.25em] text-zinc-500 uppercase mt-1">
              Wellness At Your Doorstep
            </Text>
          </TouchableOpacity>

          {isHolding && (
            <View className="absolute right-0 top-3 w-8 h-8 items-center justify-center">
              <Svg width={32} height={32} viewBox="0 0 32 32">
                <Circle
                  cx={16}
                  cy={16}
                  r={14}
                  stroke="#E5E7EB"
                  strokeWidth={2}
                  fill="none"
                />
                <AnimatedCircle
                  cx={16}
                  cy={16}
                  r={14}
                  stroke="#E11D48"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray={88}
                  strokeDashoffset={holdProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [88, 0],
                  })}
                  strokeLinecap="round"
                  transform="rotate(-90 16 16)"
                />
              </Svg>
            </View>
          )}
        </View>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleCommunicationCenter}
            className="w-11 h-11 rounded-full border border-zinc-200 bg-white items-center justify-center relative"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Feather name="bell" size={18} color="#101828" />
            {unreadCount > 0 && (
              <View className="absolute top-2.5 right-2.5 bg-red-500 rounded-full w-4 h-4 justify-center items-center">
                <Text className="text-white text-[8px] font-bold">{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/profile' as any)}
            className="w-11 h-11 rounded-full border border-zinc-200 overflow-hidden relative"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Image source={{ uri: user.avatar }} className="w-full h-full" />
            {/* Small gold crown badge overlay */}
            <View className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-500 border border-white items-center justify-center">
              <Text className="text-white text-[6px]">👑</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <SkeletonLoader layout="home" />
      ) : (
        <View className="flex-1 bg-[#FCF5F5]">
          {activeBooking && (role === 'customer' || role === 'admin') && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push({ pathname: '/session-detail' as any, params: { id: activeBooking.id } })}
              className="mx-6 mt-3 mb-1 p-3.5 bg-indigo-950 border border-indigo-900 rounded-2xl flex-row items-center justify-between shadow-md"
            >
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-2 h-2 rounded-full bg-rose-500" />
                <View className="flex-1">
                  <Text className="text-indigo-250 text-[8px] font-black uppercase tracking-wider">Live Concierge Update</Text>
                  <Text className="text-white text-[11px] font-extrabold mt-0.5" numberOfLines={1}>
                    {activeBooking.timelineStatus === 'booked' && 'Your session is booked & confirmed. Trainer details will be shared soon.'}
                    {activeBooking.timelineStatus === 'trainer_assigned' && 'Your session is booked & confirmed. Trainer details will be shared soon.'}
                    {activeBooking.timelineStatus === 'trainer_accepted' && `Coach ${activeBooking.trainerName} accepted your booking`}
                    {activeBooking.timelineStatus === 'trainer_preparing' && `Coach ${activeBooking.trainerName} is preparing your session gear`}
                    {activeBooking.timelineStatus === 'trainer_travelling' && `Coach ${activeBooking.trainerName} is on the way`}
                    {activeBooking.timelineStatus === 'trainer_arrived' && `Coach ${activeBooking.trainerName} has arrived at your gate!`}
                    {activeBooking.timelineStatus === 'otp_verified' && `Check-in Verified. Starting workout.`}
                    {activeBooking.timelineStatus === 'workout_started' && `Workout in progress (active session)`}
                    {activeBooking.timelineStatus === 'workout_completed' && `Workout complete! Submit rating feedback.`}
                    {activeBooking.timelineStatus === 'trainer_report_submitted' && `Report submitted. Rate your session.`}
                    {activeBooking.timelineStatus === 'customer_review_pending' && `Rating review pending.`}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={14} color="#A5B4FC" />
            </TouchableOpacity>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
            className="bg-[#FCF5F5] flex-1"
          >
            <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          className="px-6 pt-6 gap-8"
        >
          {/* ==================== CLIENT MODE DASHBOARD ==================== */}
          {(role === 'customer' || role === 'admin') && (
            <>
              {/* Greeting */}
              <View className="gap-2 px-1">
                <Text 
                  style={{ 
                    fontSize: dynamicGreetingFontSize, 
                    letterSpacing: dynamicLetterSpacing,
                    lineHeight: dynamicGreetingFontSize * 1.15
                  }}
                  className="font-bold text-[#101828]"
                >
                  {greeting.title}
                </Text>
              </View>

              {/* Recovery Hero Card */}
              <View 
                className="w-full bg-[#FFF1F1] rounded-[32px] p-6 shadow-md relative overflow-hidden border border-[#FFE4E6] min-h-[250px]"
                style={{
                  shadowColor: '#E11D48',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.04,
                  shadowRadius: 20,
                  elevation: 4,
                }}
              >
                {/* Athlete Image on the right */}
                <View className="absolute right-0 top-0 bottom-0 w-[52%] z-0">
                  <Image 
                    source={require('../../../assets/images/athlete_hero.png')} 
                    className="w-full h-full" 
                    resizeMode="cover"
                  />
                  {/* Blending Mask */}
                  <View style={StyleSheet.absoluteFill}>
                    <Svg width="100%" height="100%">
                      <Defs>
                        <LinearGradient id="blendGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <Stop offset="0%" stopColor="#FFF1F1" stopOpacity={1} />
                          <Stop offset="55%" stopColor="#FFF1F1" stopOpacity={0.8} />
                          <Stop offset="100%" stopColor="#FFF1F1" stopOpacity={0} />
                        </LinearGradient>
                      </Defs>
                      <Rect width="100%" height="100%" fill="url(#blendGrad)" />
                    </Svg>
                  </View>
                </View>

                {/* Hero Content */}
                <View className="z-10 gap-6 flex-1 justify-between">
                  {/* Recovery score and ring row */}
                  <View className="flex-row items-center gap-5 py-1">
                    {/* Ring Container */}
                    <View 
                      style={{
                        width: 104,
                        height: 104,
                        borderRadius: 52,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#101828',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.04,
                        shadowRadius: 12,
                        elevation: 2,
                      }}
                    >
                      <ProgressRing progress={recoveryVal / 100} size={92} strokeWidth={8} activeColor="#E11D48" inactiveColor="#FFE4E6">
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 28, fontWeight: '700', color: '#101828', letterSpacing: -1, lineHeight: 32 }}>
                            {userRecovery !== null ? userRecovery : '--'}
                          </Text>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: '#9CA3AF', marginTop: -2 }}>/100</Text>
                        </View>
                      </ProgressRing>
                    </View>

                    {/* Status Info */}
                    <View className="flex-1 gap-1.5 justify-center">
                      <Text className="text-[#E11D48] text-[13px] font-semibold tracking-wider uppercase">Recovery Score</Text>
                      <Text className="text-[#101828] text-[20px] font-semibold tracking-tight">
                        {user.id ? (userRecovery !== null ? (userRecovery >= 80 ? 'Excellent Recovery' : 'Good Recovery') : 'No Logs Today') : 'Unauthenticated'}
                      </Text>
                      <Text className="text-zinc-500 text-[15px] font-normal leading-snug">
                        {user.id ? (userRecovery !== null ? 'Ready for Strength Training Today.' : 'Log water or workouts to compute recovery index.') : 'Please log in to track recovery.'}
                      </Text>
                      <View className="flex-row mt-1">
                        <View className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                          <Text className="text-amber-600 text-[9px] font-semibold tracking-wider">★ ELITE STATUS</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Schedule Session Button */}
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => router.push('/booking' as any)}
                    className="w-full h-14 bg-[#E11D48] rounded-[22px] justify-between items-center px-5 flex-row"
                    style={{
                      minHeight: 56,
                      shadowColor: '#E11D48',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.2,
                      shadowRadius: 16,
                      elevation: 4,
                    }}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Feather name="calendar" size={16} color="white" />
                      <Text className="text-white text-[13px] font-bold uppercase tracking-wider">
                        Schedule Home Session
                      </Text>
                    </View>
                    <View className="w-6 h-6 rounded-full bg-white items-center justify-center">
                      <Feather name="chevron-right" size={14} color="#E11D48" />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Choose Your Workout Section */}
              <View className="gap-4">
                <View className="flex-row justify-between items-end pl-1">
                  <Text className="text-[#101828] text-[20px] font-semibold tracking-tight">Choose Your Workout</Text>
                  <TouchableOpacity onPress={() => router.push('/booking' as any)}>
                    <Text className="text-[#E11D48] text-[15px] font-semibold">View All ›</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 2 }}>
                  {[
                    { id: 'strength', title: 'Strength', sub: 'Build & Tone', emoji: '🏋️', colors: ['#FF7E7E', '#E11D48'] },
                    { id: 'yoga', title: 'Yoga', sub: 'Mind & Body', emoji: '🧘', colors: ['#F472B6', '#8B5CF6'] },
                    { id: 'boxing', title: 'Boxing', sub: 'Power & Endurance', emoji: '🥊', colors: ['#FBBF24', '#F97316'] },
                    { id: 'stretch', title: 'Stretching', sub: 'Mobility & Flex', emoji: '🙆', colors: ['#64748B', '#334155'] }
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => router.push({
                        pathname: '/booking',
                        params: {
                          workoutId: item.id,
                          workoutType: item.title,
                          workoutName: item.title,
                        },
                      })}
                      className="w-36 p-5 rounded-[28px] relative overflow-hidden justify-between"
                      style={{ minHeight: 160 }}
                    >
                      {/* SVG Background Gradient */}
                      <View style={StyleSheet.absoluteFill}>
                        <Svg width="100%" height="100%">
                          <Defs>
                            <LinearGradient id={`grad-${item.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <Stop offset="0%" stopColor={item.colors[0]} />
                              <Stop offset="100%" stopColor={item.colors[1]} />
                            </LinearGradient>
                          </Defs>
                          <Rect width="100%" height="100%" fill={`url(#grad-${item.id})`} />
                        </Svg>
                      </View>

                      <View>
                        {/* Icon container */}
                        <View className="w-11 h-11 rounded-full bg-white/20 items-center justify-center self-start">
                          <Text className="text-lg">{item.emoji}</Text>
                        </View>
                      </View>

                      {/* Text contents and chevron */}
                      <View className="gap-1.5">
                        <Text className="text-white text-[15px] font-semibold tracking-tight">{item.title}</Text>
                        <View className="flex-row justify-between items-center">
                          <Text className="text-white/80 text-[10px] font-medium">{item.sub}</Text>
                          <View className="w-5 h-5 rounded-full bg-white/25 items-center justify-center">
                            <Feather name="chevron-right" size={12} color="white" />
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Your Coach Today Section */}
              <View className="gap-4">
                <Text className="text-[#101828] text-[20px] font-semibold tracking-tight pl-1">Your Coach Today</Text>
                
                {activeBooking ? (() => {
                  const isActiveAccepted = activeBooking.timelineStatus !== 'booked' && activeBooking.timelineStatus !== 'trainer_assigned';
                  if (!isActiveAccepted) {
                    return (
                      // Booking pending trainer acceptance (Trainer details hidden)
                      <View 
                        className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-5"
                        style={{
                          shadowColor: '#101828',
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: 0.04,
                          shadowRadius: 12,
                          elevation: 3,
                        }}
                      >
                        <View className="flex-row gap-4 items-center">
                          {/* Left: Placeholder Clock/Zen icon */}
                          <View className="w-18 h-18 rounded-full bg-indigo-50 border border-indigo-100 items-center justify-center">
                            <Text className="text-3xl">{getWorkoutEmoji(activeBooking.workoutTitle)}</Text>
                          </View>

                          {/* Right: Booking status */}
                          <View className="flex-1 gap-1">
                            <Text className="text-[#101828] text-[17px] font-black uppercase tracking-tight">
                              {getWorkoutEmoji(activeBooking.workoutTitle)} {activeBooking.workoutTitle} Booked
                            </Text>
                            <Text className="text-[#6B7280] text-[14px] font-medium leading-relaxed mt-0.5">
                              Your session is confirmed. Trainer details will be shared soon.
                            </Text>

                            {/* Stats row */}
                            <View className="flex-row items-center gap-1.5 mt-2">
                              <Feather name="clock" size={12} color="#FF8A00" />
                              <Text className="text-zinc-500 text-[11px] font-semibold uppercase">
                                Scheduled for {activeBooking.time ? activeBooking.time.split(' - ')[0] : ''}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  }
                  return (
                    // Booking accepted by trainer (Trainer details fully revealed)
                    <View 
                      className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-5"
                      style={{
                        shadowColor: '#101828',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.04,
                        shadowRadius: 12,
                        elevation: 3,
                      }}
                    >
                      <View className="flex-row gap-4 items-center">
                        {/* Left: Avatar image with rating overlay */}
                        <View className="relative">
                          <Image 
                            source={{ uri: activeBooking.trainerPhoto || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80' }} 
                            className="w-18 h-18 rounded-full border border-zinc-150" 
                          />
                          {/* Rating Overlay */}
                          <View 
                            className="absolute -top-1.5 -left-1.5 bg-white border border-zinc-100 px-1.5 py-0.5 rounded-lg items-center justify-center flex-row"
                            style={{
                              shadowColor: '#101828',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.03,
                              shadowRadius: 4,
                              elevation: 1,
                            }}
                          >
                            <Text className="text-[11px] font-bold text-zinc-800">⭐ 4.9</Text>
                          </View>
                        </View>

                        {/* Right: Coach info */}
                        <View className="flex-1 gap-1.5">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-[#101828] text-[18px] font-semibold tracking-tight">
                              {activeBooking.trainerName}
                            </Text>
                            <Feather name="chevron-right" size={14} color="#9CA3AF" />
                          </View>
                          <Text className="text-[#6B7280] text-[15px] font-normal leading-none">
                            {activeBooking.trainerSpeciality || 'Strength & Conditioning Specialist'}
                          </Text>

                          {/* Stats row */}
                          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5 mt-1">
                            <View className="flex-row items-center gap-1">
                              <Feather name="clock" size={12} color="#FF8A00" />
                              <Text className="text-zinc-500 text-[11px] font-medium uppercase">
                                Arriving {activeBooking.time ? activeBooking.time.split(' - ')[0] : '10:30 AM'}
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-1">
                              <Feather name="map-pin" size={12} color="#3B82F6" />
                              <Text className="text-zinc-500 text-[11px] font-medium uppercase">
                                {activeBooking.trainerDistance || '2.3 km'}
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-1">
                              <Feather name="shield" size={12} color="#16C784" />
                              <Text className="text-zinc-500 text-[11px] font-medium uppercase">
                                Elite Coach
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View className="h-[1px] bg-zinc-100" />

                      {/* Track Coach Live CTA Button */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          router.push({ pathname: '/session-detail', params: { id: activeBooking.id } });
                        }}
                        className="w-full bg-rose-50 rounded-2xl items-center justify-center flex-row gap-2"
                        style={{ minHeight: 52 }}
                      >
                        <Feather name="map-pin" size={14} color="#E11D48" />
                        <Text className="text-[#E11D48] text-[13px] font-bold uppercase tracking-wider">
                          Track Coach Live
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })() : (
                  <View 
                    className="bg-white border border-[#E5E7EB] p-8 rounded-[32px] items-center justify-center gap-3"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.04,
                      shadowRadius: 12,
                      elevation: 3,
                    }}
                  >
                    <Text className="text-3xl">🏋️</Text>
                    <Text className="text-[#101828] text-base font-semibold">No Active Coach Today</Text>
                    <Text className="text-zinc-500 text-sm text-center">Your assigned coach tracking details will activate here on the day of your session.</Text>
                  </View>
                )}
              </View>

              {/* Today's Overview Section */}
              <View className="gap-4">
                <Text className="text-[#101828] text-[20px] font-semibold tracking-tight pl-1">Today&apos;s Overview</Text>

                <View className="flex-row flex-wrap justify-between gap-y-4">
                  {/* Calories Widget */}
                  <View className="w-[47%] h-[148px] p-5 rounded-[28px] bg-[#FFF5F5] border border-[#FFE4E6] justify-between">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base">🔥</Text>
                      <Text className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Calories</Text>
                    </View>
                    <View>
                      <Text className="text-[#101828] text-[32px] font-bold tracking-tighter">{caloriesToday}</Text>
                      <Text className="text-zinc-400 text-[13px] font-medium mt-0.5">/{caloriesGoal} kcal</Text>
                    </View>
                    {/* Progress Bar */}
                    <View className="w-full h-1.5 bg-[#FFE4E6] rounded-full overflow-hidden">
                      <View className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, (caloriesToday / caloriesGoal) * 100)}%` }} />
                    </View>
                  </View>

                  {/* Hydration Widget */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleLogWater}
                    className="w-[47%] h-[148px] p-5 rounded-[28px] bg-[#ECFEFF] border border-[#CFFAFE] justify-between"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base">💧</Text>
                        <Text className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Hydration</Text>
                      </View>
                      <Text className="text-[#06B6D4] text-[9px] font-bold uppercase tracking-widest">+250ml</Text>
                    </View>
                    <View>
                      <Text className="text-[#101828] text-[32px] font-bold tracking-tighter">{waterMl}</Text>
                      <Text className="text-zinc-400 text-[13px] font-medium mt-0.5">/{waterGoal} ml</Text>
                    </View>
                    {/* Progress Bar */}
                    <View className="w-full h-1.5 bg-[#CFFAFE] rounded-full overflow-hidden">
                      <View className="h-full bg-[#06B6D4] rounded-full" style={{ width: `${Math.min(100, (waterMl / waterGoal) * 100)}%` }} />
                    </View>
                  </TouchableOpacity>

                  {/* Wallet Credits Widget */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/membership' as any)}
                    className="w-[47%] h-[148px] p-5 rounded-[28px] bg-[#F5F3FF] border border-[#EDE9FE] justify-between"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base">💳</Text>
                      <Text className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Wallet Credits</Text>
                    </View>
                    <View>
                      <Text className="text-[#101828] text-[32px] font-bold tracking-tighter">{membership.availableCredits}</Text>
                      <Text className="text-zinc-400 text-[13px] font-medium mt-0.5">Credits Available</Text>
                    </View>
                    {/* Progress Bar */}
                    <View className="w-full h-1.5 bg-[#EDE9FE] rounded-full overflow-hidden">
                      <View className="h-full bg-violet-600 rounded-full" style={{ width: `${Math.min(100, (membership.availableCredits / Math.max(1, membership.totalCredits)) * 100)}%` }} />
                    </View>
                  </TouchableOpacity>

                  {/* Workout Streak Widget */}
                  <View className="w-[47%] h-[148px] p-5 rounded-[28px] bg-[#FFF1F2] border border-[#FFE4E6] justify-between">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base">⚡</Text>
                      <Text className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Workout Streak</Text>
                    </View>
                    <View>
                      <Text className="text-[#101828] text-[32px] font-bold tracking-tighter">{streak}</Text>
                      <Text className="text-zinc-400 text-[13px] font-medium mt-0.5">Active Days</Text>
                    </View>
                    {/* Progress Bar */}
                    <View className="w-full h-1.5 bg-[#FFE4E6] rounded-full overflow-hidden">
                      <View className="h-full bg-[#EC4899] rounded-full" style={{ width: `${Math.min(100, (streak / 7) * 100)}%` }} />
                    </View>
                  </View>
                </View>
              </View>

              {/* AI Wellness Coach Section */}
              <View className="gap-4">
                <Text className="text-[#101828] text-[20px] font-semibold tracking-tight pl-1">AI Wellness Coach</Text>
                <View 
                  className="w-full bg-[#1F1135] rounded-[32px] p-6 shadow-md relative overflow-hidden border border-zinc-800"
                  style={{
                    shadowColor: '#8B5CF6',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.15,
                    shadowRadius: 20,
                    elevation: 4,
                  }}
                >
                  {/* Glowing Abstract Radar Wave on the right */}
                  <View className="absolute right-[-20px] top-[-10px] bottom-[-10px] w-[50%] z-0 items-center justify-center">
                    <Svg width="140" height="140" viewBox="0 0 100 100">
                      <Defs>
                        <LinearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <Stop offset="0%" stopColor="#EC4899" stopOpacity={0.15} />
                          <Stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.4} />
                          <Stop offset="100%" stopColor="#EC4899" stopOpacity={0.05} />
                        </LinearGradient>
                      </Defs>
                      <Circle cx="50" cy="50" r="45" stroke="url(#waveGrad)" strokeWidth={0.5} fill="none" strokeDasharray="3 3" />
                      <Circle cx="50" cy="50" r="35" stroke="url(#waveGrad)" strokeWidth={1} fill="none" />
                      <Circle cx="50" cy="50" r="25" stroke="url(#waveGrad)" strokeWidth={1.5} fill="none" strokeDasharray="6 2" />
                      <Circle cx="50" cy="50" r="16" stroke="#EC4899" strokeWidth={2} fill="#8B5CF6" opacity={0.3} />
                      <Circle cx="50" cy="50" r="10" fill="#EC4899" opacity={0.7} />
                    </Svg>

                    {/* Sparkling Center Star */}
                    <View className="absolute z-10 w-9 h-9 rounded-full bg-white/10 items-center justify-center border border-white/20">
                      <Text className="text-white text-xs">✦</Text>
                    </View>
                  </View>

                  {/* Left content */}
                  <View className="z-10 gap-5 pr-20">
                    <View className="flex-row items-center gap-1.5 pl-0.5">
                      <Text className="text-[#EC4899] text-xs">✦</Text>
                      <Text className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
                        {savedPlan ? 'My AI Wellness Plan' : 'AI Wellness Coach'}
                      </Text>
                    </View>

                    {savedPlan ? (
                      <View className="gap-3.5">
                        <View className="flex-row justify-between flex-wrap gap-y-2.5">
                          <View className="w-[48%] gap-0.5">
                            <Text className="text-white/50 text-[9px] font-bold uppercase">Calories Goal</Text>
                            <Text className="text-white text-xs font-black">{savedPlan.dailyCalories} kcal</Text>
                          </View>
                          <View className="w-[48%] gap-0.5">
                            <Text className="text-white/50 text-[9px] font-bold uppercase">Protein Goal</Text>
                            <Text className="text-white text-xs font-black">{savedPlan.proteinTarget}g</Text>
                          </View>
                          <View className="w-[48%] gap-0.5">
                            <Text className="text-white/50 text-[9px] font-bold uppercase">Water Goal</Text>
                            <Text className="text-white text-xs font-black" numberOfLines={1}>
                              {savedPlan.hydrationGoal ? savedPlan.hydrationGoal.split(' ')[0] : '2'} L
                            </Text>
                          </View>
                          <View className="w-[48%] gap-0.5">
                            <Text className="text-white/50 text-[9px] font-bold uppercase">Next Session</Text>
                            <Text className="text-white text-xs font-black" numberOfLines={1}>
                              {upcomingBookings.length > 0 && upcomingBookings[0]?.date
                                ? `${upcomingBookings[0].date.split(',')[0]} @ ${upcomingBookings[0].time}`
                                : 'None scheduled'}
                            </Text>
                          </View>
                        </View>
                        
                        <View className="gap-0.5">
                          <Text className="text-white/50 text-[9px] font-bold uppercase">{"Today's"} Workout</Text>
                          <Text className="text-white text-[11px] font-semibold leading-relaxed pr-6" numberOfLines={1}>
                            {savedPlan.workoutRecommendation}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View className="gap-1">
                        <Text className="text-white text-[15px] font-semibold tracking-tight leading-relaxed">
                          Create Your AI Wellness Plan
                        </Text>
                        <Text className="text-white/70 text-[13px] font-normal leading-relaxed pr-4">
                          Answer a few questions so VIRLA AI can create a personalized wellness plan.
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => router.push('/virla-ai' as any)}
                      className="h-11 bg-[#E11D48] rounded-[18px] justify-between items-center px-5 flex-row self-start gap-3 mt-1"
                      style={{
                        minHeight: 44,
                        shadowColor: '#E11D48',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        elevation: 3,
                      }}
                    >
                      <Text className="text-white text-[11px] font-bold uppercase tracking-wider">
                        {savedPlan ? 'My AI Wellness Plan' : 'Get Started'}
                      </Text>
                      <View className="w-5 h-5 rounded-full bg-white items-center justify-center">
                        <Feather name="chevron-right" size={12} color="#E11D48" />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Upcoming Session Section */}
              <View className="gap-4">
                <Text className="text-[#101828] text-[20px] font-semibold tracking-tight pl-1">Upcoming Session</Text>
                {upcomingBookings.length > 0 ? (() => {
                  const bookingData = upcomingBookings[0];
                  const isTravelling = bookingData.timelineStatus === 'trainer_travelling';
                  const isAccepted = bookingData.timelineStatus !== 'booked' && bookingData.timelineStatus !== 'trainer_assigned';
                  const isSearching = !bookingData.trainerId || bookingData.trainerId === 'searching' || bookingData.trainerName === 'No Trainer Available';

                  return (
                    <View 
                      className="bg-white border border-[#E5E7EB] p-6 rounded-[32px] gap-4"
                      style={{
                        shadowColor: '#101828',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.04,
                        shadowRadius: 12,
                        elevation: 3,
                      }}
                    >
                      {/* Top: Coach avatar, title, and badge */}
                      <View className="flex-row justify-between items-start">
                        <View className="flex-row items-center gap-3">
                          {!isAccepted ? (
                            <View className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 items-center justify-center">
                              <Feather name="clock" size={20} color="#4F46E5" />
                            </View>
                          ) : (
                            <Image 
                              source={{ uri: bookingData.trainerPhoto }} 
                              className="w-14 h-14 rounded-full border border-zinc-150" 
                            />
                          )}
                          <View>
                            <Text className="text-zinc-950 text-[15px] font-semibold">{bookingData.workoutTitle}</Text>
                            <Text className="text-zinc-500 text-[13px] font-normal mt-0.5">
                              {!isAccepted 
                                ? 'Trainer details will be shared soon.' 
                                : `with ${bookingData.trainerName}`
                              }
                            </Text>
                          </View>
                        </View>
                        {/* Elite coach badge */}
                        {isAccepted && (
                          <View className="bg-amber-50 border border-amber-100 px-3.5 py-1 rounded-full">
                            <Text className="text-amber-600 text-[9px] font-bold uppercase tracking-wider">★ ELITE COACH</Text>
                          </View>
                        )}
                      </View>

                      <View className="h-[1px] bg-zinc-150" />

                      {/* Middle: Timeline path details */}
                      <View className="flex-row justify-between items-center px-1">
                        <View className="flex-row items-stretch gap-3 flex-1 pr-4">
                          {/* Dotted indicator line */}
                          <View className="items-center justify-between py-1">
                            <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <View className="w-[1px] flex-1 border-l border-zinc-300 border-dashed my-0.5" />
                            <View className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          </View>
                          {/* Text info */}
                          <View className="gap-3 flex-1">
                            <View>
                              <Text className="text-zinc-950 text-[13px] font-semibold">{bookingData.date}</Text>
                              <Text className="text-zinc-400 text-[11px] font-medium mt-0.5">{bookingData.time ? bookingData.time.split(' - ')[0] : ''}</Text>
                            </View>
                            <View>
                              <Text className="text-zinc-950 text-[13px] font-semibold">Home</Text>
                              <Text className="text-zinc-400 text-[11px] font-medium mt-0.5">Mumbai, India</Text>
                            </View>
                          </View>
                        </View>

                        {/* Right: Status badge & Map action */}
                        <View className="items-end gap-4">
                          {/* Status pill */}
                          <View className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5">
                            <Feather 
                              name={isTravelling ? 'truck' : 'check-circle'} 
                              size={12} 
                              color="#16C784" 
                            />
                            <Text className="text-emerald-600 text-[9px] font-bold uppercase tracking-wider">
                              {isTravelling 
                                ? 'Coach on the way' 
                                : 'Confirmed'
                              }
                            </Text>
                          </View>

                          {/* Navigation Map Action */}
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => router.push({ pathname: '/session-detail', params: { id: bookingData.id } })}
                            className="w-11 h-11 rounded-full bg-[#16C784] items-center justify-center"
                            style={{
                              minWidth: 44,
                              minHeight: 44,
                              shadowColor: '#16C784',
                              shadowOffset: { width: 0, height: 6 },
                              shadowOpacity: 0.25,
                              shadowRadius: 12,
                              elevation: 3,
                            }}
                          >
                            <Feather name="navigation" size={16} color="white" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {bookingData.sessionType === 'SINGLE' && bookingData.timelineStatus !== 'otp_verified' && bookingData.timelineStatus !== 'workout_started' && bookingData.timelineStatus !== 'workout_completed' && bookingData.timelineStatus !== 'session_closed' && bookingData.status === 'upcoming' && (
                        <>
                          <View className="h-[1px] bg-zinc-150 mt-3 mb-1" />
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                              setActivePartnerBookingId(bookingData.id);
                              setPartnerModalVisible(true);
                            }}
                            className="flex-row items-center justify-center gap-1.5 py-1.5"
                          >
                            <Feather name="plus-circle" size={14} color="#E11D48" />
                            <Text className="text-[#E11D48] text-xs font-black uppercase tracking-wider">Add Partner</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {bookingData.sessionType === 'COUPLE' && bookingData.partnerName && (
                        <>
                          <View className="h-[1px] bg-zinc-150 mt-3 mb-1.5" />
                          <View className="flex-row items-center justify-center gap-1.5 py-0.5">
                            <Feather name="users" size={12} color="#10B981" />
                            <Text className="text-zinc-500 text-[10px] font-semibold">
                              Training with <Text className="font-extrabold text-zinc-800">{bookingData.partnerName}</Text>
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })() : (
                  <View 
                    className="bg-white border border-[#E5E7EB] p-8 rounded-[32px] items-center justify-center gap-3"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.04,
                      shadowRadius: 12,
                      elevation: 3,
                    }}
                  >
                    <Text className="text-3xl">🗓️</Text>
                    <Text className="text-[#101828] text-base font-semibold">No Upcoming Sessions Scheduled</Text>
                    <Text className="text-zinc-500 text-sm text-center">Schedule your next personal training session today.</Text>
                  </View>
                )}
              </View>
            </>
          )}

                    {role === 'trainer' && (
            <>
              {/* Header Greeting */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                      {getGreeting()}
                    </Text>
                    <Text className="text-[#101828] text-2xl font-black tracking-tight mt-1">
                      {user.name.split(' ')[0]} 👋
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={toggleOnlineStatus}
                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-150 bg-white"
                  >
                    <View className={`w-2 h-2 rounded-full ${trainerOnlineStatus === 'online' ? 'bg-[#16C784]' : 'bg-red-500'}`} />
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${trainerOnlineStatus === 'online' ? 'text-[#16C784]' : 'text-red-500'}`}>
                      {trainerOnlineStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-zinc-450 text-[10px] font-semibold mt-2">
                  {getFormattedToday()}
                </Text>
              </View>

              {/* Priority 1: New Requests */}
              {(() => {
                const requests = bookings.filter(b => 
                  b.timelineStatus === 'booked' && 
                  (b.trainerName === user.name || (currentCoach && b.trainerId === currentCoach.id))
                );
                if (requests.length === 0) return null;
                return (
                  <View className="gap-3 mb-6">
                    <View className="flex-row justify-between items-center pr-1">
                      <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest pl-1">
                        New Session Requests • {requests.length}
                      </Text>
                      <TouchableOpacity 
                        onPress={handleManualRefresh}
                        disabled={isRefreshing}
                        className="bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-150 flex-row items-center gap-1.5"
                      >
                        <Feather name="refresh-cw" size={10} color="#4F46E5" />
                        <Text className="text-[#4F46E5] text-[9px] font-black uppercase">
                          {isRefreshing ? 'Syncing...' : 'Sync'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {requests.map(req => (
                      <RequestCard
                        key={req.id}
                        booking={req}
                        onAccept={handleAcceptRequest}
                        onDecline={handleDeclineRequest}
                        onTimeout={handleTimeoutRequest}
                        onPress={(id) => router.push({ pathname: '/session-detail', params: { id } })}
                      />
                    ))}
                  </View>
                );
              })()}

              {/* Priority 2: Current Active Session */}
              {activeSession ? (
                <View className="mb-6">
                  <Text className="text-rose-500 text-[10px] font-black uppercase tracking-widest pl-1 mb-2.5">
                    Current Session
                  </Text>
                  <View
                    className="bg-white border-2 border-rose-500/30 p-5 rounded-[28px] gap-4"
                    style={{
                      shadowColor: '#F43F5E',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.05,
                      shadowRadius: 12,
                      elevation: 2,
                    }}
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="bg-rose-50 border border-rose-100 px-3 py-1 rounded-full flex-row items-center gap-1.5">
                        <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <Text className="text-rose-600 text-[9px] font-black uppercase tracking-wider">
                          Session In Progress
                        </Text>
                      </View>
                      <Text className="text-zinc-450 text-[10px] font-bold">
                        {activeSession.time}
                      </Text>
                    </View>

                    <View className="gap-1.5">
                      <Text className="text-zinc-455 text-[9px] font-bold uppercase">Workout: {activeSession.workoutTitle}</Text>
                      <Text className="text-[#101828] text-base font-black tracking-tight mt-0.5">
                        Client: {activeSession.clientName || 'Viral'}
                      </Text>
                      <Text className="text-zinc-650 text-xs font-semibold leading-relaxed mt-1">
                        📍 {activeSession.address ? activeSession.address.split(',')[0] : 'Home Session'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push({ pathname: '/session-detail', params: { id: activeSession.id } })}
                      className="w-full bg-rose-500 py-3.5 rounded-2xl items-center justify-center flex-row gap-2"
                      style={{
                        shadowColor: '#E11D48',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 2,
                      }}
                    >
                      <Text className="text-white text-xs font-black uppercase tracking-wider">Open Session →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* Priority 3: Next Session */}
              <View className="mb-6">
                <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest pl-1 mb-2.5">
                  Next Session
                </Text>
                {nextSession ? (() => {
                  const start = getBookingStartDateTime(nextSession);
                  const isTomorrow = normalizeDate(start) === tomorrowDateStr;
                  const isToday = normalizeDate(start) === normalizeDate(nowTime);

                  return (
                    <View
                      className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-800 gap-4"
                      style={{
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 12 },
                        shadowOpacity: 0.3,
                        shadowRadius: 24,
                        elevation: 6,
                      }}
                    >
                      <View className="flex-row justify-between items-center">
                        <Text className="text-white text-sm font-black uppercase tracking-wider">
                          {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : nextSession.date.replace(/Today, |Tomorrow, /, '')} • {nextSessionTime}
                        </Text>
                        {isToday && countdownText ? (
                          <View className="bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-0.5 rounded-full">
                            <Text className="text-indigo-400 text-[8px] font-black uppercase tracking-wider">
                              {countdownText}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View className="gap-1">
                        <Text className="text-zinc-500 text-[8px] font-black uppercase">Workout: {nextSession.workoutTitle}</Text>
                        <Text className="text-white text-base font-semibold mt-1 leading-tight">
                          Client: {nextSession.clientName || 'Viral'}
                        </Text>
                        <Text className="text-zinc-400 text-[10px] font-medium mt-1">
                          📍 Venue: {nextSession.address ? nextSession.address.split(',')[0] : 'Home Session'}
                        </Text>
                        <Text className="text-zinc-500 text-[9px] font-medium mt-0.5">
                          ⏱ {nextSession.time} ({nextSession.durationMinutes || 60} mins)
                        </Text>
                      </View>

                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => Alert.alert('GPS Routing Simulated', 'Opening navigation routing to venue...')}
                          className="flex-1 bg-zinc-900 border border-zinc-850 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                        >
                          <Feather name="navigation" size={10} color="white" />
                          <Text className="text-white text-[8px] font-bold uppercase">Navigate</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            if (getMinutesToSession(nextSession) <= 60) {
                              Alert.alert('Secure Call', 'Connecting call to customer using masked calling...');
                            } else {
                              Alert.alert('Call Locked', 'Calling will be available 60 minutes before the session.');
                            }
                          }}
                          className="flex-1 bg-zinc-900 border border-zinc-850 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                        >
                          <Feather name="phone" size={10} color="white" />
                          <Text className="text-white text-[8px] font-bold uppercase">Call Client</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => router.push({ pathname: '/communication', params: { id: nextSession.id } })}
                          className="flex-1 bg-zinc-900 border border-zinc-850 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                        >
                          <Feather name="message-square" size={10} color="white" />
                          <Text className="text-white text-[8px] font-bold uppercase">Message</Text>
                        </TouchableOpacity>
                      </View>

                      <View className="h-[1px] bg-zinc-855" />

                      {nextSession.timelineStatus === 'trainer_accepted' ? (
                        <TouchableOpacity
                          onPress={() => {
                            updateTimelineStatus(nextSession.id, 'trainer_travelling');
                            useNotificationStore.getState().addNotification({
                              title: 'Coach On The Way 🚗',
                              body: 'Coach has started travelling to your venue.',
                              icon: 'user-check'
                            });
                          }}
                          className="w-full bg-indigo-600 py-3.5 rounded-xl items-center justify-center"
                        >
                          <Text className="text-white text-xs font-black uppercase tracking-wider">Start Travel</Text>
                        </TouchableOpacity>
                      ) : nextSession.timelineStatus === 'trainer_travelling' ? (
                        <TouchableOpacity
                          onPress={() => {
                            updateTimelineStatus(nextSession.id, 'trainer_arrived');
                            useNotificationStore.getState().addNotification({
                              title: 'Coach Arrived 🔔',
                              body: 'Coach has arrived at your location.',
                              icon: 'lock'
                            });
                          }}
                          className="w-full bg-emerald-600 py-3.5 rounded-xl items-center justify-center"
                        >
                          <Text className="text-white text-xs font-black uppercase tracking-wider">Reached Location</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => router.push({ pathname: '/session-detail', params: { id: nextSession.id } })}
                          className="w-full bg-zinc-800 py-3.5 rounded-xl items-center justify-center"
                        >
                          <Text className="text-white text-xs font-black uppercase tracking-wider">
                            {nextSession.timelineStatus === 'trainer_arrived' ? 'Waiting client OTP check-in' : 'Open active console'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })() : (
                  <View 
                    className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-2 items-center justify-center text-center"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.02,
                      shadowRadius: 8,
                      elevation: 1,
                    }}
                  >
                    <Text className="text-3xl mt-1">👌</Text>
                    <Text className="text-zinc-900 text-sm font-black mt-2">You're all clear today</Text>
                    <Text className="text-zinc-400 text-[10px] font-semibold text-center mt-0.5">
                      No upcoming bookings scheduled. Manage availability to get bookings.
                    </Text>
                  </View>
                )}
              </View>

              {/* Priority 4: Today's Sessions */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-2.5 pl-1 pr-1">
                  <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                    Today's Sessions
                  </Text>
                  {todaySessionsCount > 0 ? (
                    <Text className="text-zinc-500 text-[9px] font-black uppercase">
                      {todaySessionsCount} {todaySessionsCount === 1 ? 'Session' : 'Sessions'} • {formattedTodayHours} hrs
                    </Text>
                  ) : null}
                </View>

                {todayBookings.length > 0 ? (
                  <View className="gap-3">
                    {todayBookings.map((booking) => (
                      <TouchableOpacity 
                        key={booking.id} 
                        activeOpacity={0.8}
                        onPress={() => router.push({ pathname: '/session-detail', params: { id: booking.id } })}
                        className="bg-white border border-[#E5E7EB] p-4 rounded-2xl flex-row justify-between items-center"
                        style={{
                          shadowColor: '#101828',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.02,
                          shadowRadius: 6,
                          elevation: 1,
                        }}
                      >
                        <View className="flex-row items-center gap-3">
                          <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center">
                            <Feather name="clock" size={14} color="#4F46E5" />
                          </View>
                          <View>
                            <Text className="text-zinc-900 text-xs font-semibold">{booking.workoutTitle}</Text>
                            <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">
                              {booking.time} • Client: {booking.clientName || 'Viral'}
                            </Text>
                          </View>
                        </View>
                        <View className={`px-2 py-0.5 rounded-full ${
                          booking.timelineStatus === 'workout_completed' || booking.status === 'completed'
                            ? 'bg-emerald-50 border border-emerald-150'
                            : booking.status === 'cancelled'
                            ? 'bg-rose-50 border border-rose-150'
                            : 'bg-indigo-50 border border-indigo-150'
                        }`}>
                          <Text className={`text-[7px] font-bold uppercase ${
                            booking.timelineStatus === 'workout_completed' || booking.status === 'completed'
                              ? 'text-emerald-600'
                              : booking.status === 'cancelled'
                              ? 'text-rose-600'
                              : 'text-indigo-600'
                          }`}>
                            {booking.timelineStatus === 'workout_completed' || booking.status === 'completed'
                              ? 'Completed'
                              : booking.status === 'cancelled'
                              ? 'Cancelled'
                              : 'Confirmed'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] items-center justify-center">
                    <Text className="text-zinc-400 text-xs font-semibold text-center">
                      No sessions today
                    </Text>
                  </View>
                )}
              </View>

              {/* Priority 5: Tomorrow */}
              <View className="mb-6">
                <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest pl-1 mb-2.5">
                  Tomorrow's Schedule
                </Text>
                
                {!isTomorrowScheduleEnabled ? (
                  <View 
                    className="bg-zinc-50 border border-dashed border-zinc-300 p-5 rounded-[28px] gap-3.5"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-xl bg-zinc-200/50 justify-center items-center">
                        <Feather name="slash" size={14} color="#6B7280" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-zinc-950 text-xs font-black uppercase">Schedule is Disabled</Text>
                        <Text className="text-zinc-500 text-[9px] font-semibold mt-0.5">
                          You have no slots available for tomorrow.
                        </Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity
                      onPress={() => router.push('/bookings' as any)}
                      className="bg-indigo-600 p-3 rounded-2xl items-center justify-center flex-row gap-1.5"
                    >
                      <Feather name="calendar" size={12} color="white" />
                      <Text className="text-white text-[10px] font-black uppercase tracking-wider">Manage availability →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View 
                    className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] gap-3.5"
                    style={{
                      shadowColor: '#101828',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.02,
                      shadowRadius: 8,
                      elevation: 1,
                    }}
                  >
                    {tomorrowBookings.length > 0 ? (
                      <View className="gap-3">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-zinc-900 text-xs font-black uppercase">
                            {tomorrowBookings.length} {tomorrowBookings.length === 1 ? 'Session' : 'Sessions'} Scheduled
                          </Text>
                          <TouchableOpacity onPress={() => router.push('/bookings' as any)}>
                            <Text className="text-indigo-600 text-[9px] font-black uppercase tracking-wider">View All →</Text>
                          </TouchableOpacity>
                        </View>
                        
                        <View className="gap-2 mt-1">
                          {tomorrowBookings.map((b) => (
                            <View key={b.id} className="flex-row justify-between items-center py-2 border-b border-zinc-50 last:border-b-0">
                              <View>
                                <Text className="text-zinc-900 text-xs font-semibold">{b.workoutTitle}</Text>
                                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{b.time} • {b.clientName || 'Client'}</Text>
                              </View>
                              <Feather name="chevron-right" size={12} color="#9CA3AF" />
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                          <View className="w-8 h-8 rounded-xl bg-emerald-50 items-center justify-center border border-emerald-100">
                            <Feather name="calendar" size={14} color="#059669" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-zinc-950 text-xs font-black uppercase">No sessions booked</Text>
                            <Text className="text-zinc-500 text-[9px] font-semibold mt-0.5">
                              Your schedule is available for bookings.
                            </Text>
                          </View>
                        </View>
                        
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => router.push('/bookings' as any)}
                          className="bg-zinc-950 py-2.5 px-4 rounded-xl"
                        >
                          <Text className="text-white text-[9px] font-black uppercase tracking-wider">
                            Manage →
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </>
          )}

        </Animated.View>
      </ScrollView>
      </View>
      )}
      <AddPartnerModal
        visible={partnerModalVisible}
        bookingId={activePartnerBookingId}
        onClose={() => setPartnerModalVisible(false)}
        onSuccess={() => {
          setPartnerModalVisible(false);
          useBookingStore.getState().syncFromDB();
        }}
      />
    </SafeAreaViewWrapper>
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
