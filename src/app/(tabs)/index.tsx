/* eslint-disable react-hooks/set-state-in-effect */
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Alert, Image, Platform, Text, Pressable, View, StyleSheet, AppState, AppStateStatus, Vibration, Linking } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop, Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedAnimated, { 
  useAnimatedScrollHandler, 
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  createAnimatedComponent,
  withTiming,
  withSpring,
  Easing
} from 'react-native-reanimated';

const AnimatedCircle = createAnimatedComponent(Circle);
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
import { useAddressStore } from '../../store/addressStore';
import { Database, getCurrentServerTime, getISTDateInfo, isSessionGenuinelyActive } from '../../database/Database';
import { AddPartnerModal } from '../../components/AddPartnerModal';
import { CommunicationCenterModal } from '../../components/CommunicationCenterModal';
import { TrainerStatusModal } from '../../components/TrainerStatusModal';
import { LogMetricsModal } from '../../components/LogMetricsModal';
import { useToastStore } from '../../store/toastStore';
import { supabase } from '../../database/supabaseClient';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { ClientHomeView } from '../../components/ClientHomeView';
import { ClientLiveUpdateBanner } from '../../components/home/ClientLiveUpdateBanner';
import { NativeProgressBar } from '../../components/NativeProgressBar';
import { NativeDivider } from '../../components/NativeDivider';
import { NativeOverviewCard } from '../../components/NativeOverviewCard';
import { NativeAlertDialog } from '../../components/NativeAlertDialog';
import { resolveAvatarSource } from '../../components/AvatarImage';
import { useAIWellnessStore } from '../../store/aiWellnessStore';
import { SessionEngine } from '../../services/SessionEngine';
import { locationTrackerService } from '../../services/LocationTrackerService';
import { Booking } from '../../types';
import { normalizeDate, canonicalizeTimeRange, getBookingISTDateRange, getDisplayWorkoutTitle, formatToDDMMYYYY } from '../../utils/date';
import { AvatarImage } from '../../components/AvatarImage';
import { CoachVideoAvatar } from '../../components/CoachVideoAvatar';
import { BackgroundVideoLoop } from '../../components/BackgroundVideoLoop';
import { BUNNY_CDN_ASSETS } from '../../services/bunnyCdnService';

import { softShadow } from '../../utils/shadows';
// Bundled local assets: required once at module load so the reference is stable
// and a wrong path fails the build instead of leaving a blank frame at runtime.
const ATHLETE_HERO_IMAGE = require('../../../assets/images/athlete_hero.webp');
const SPLASH_ICON = require('../../../assets/images/splash-icon.png');
const AI_COACH_EMBLEM = require('../../../assets/images/ai-coach-emblem.png');

const WORKOUT_BG_STRENGTH = BUNNY_CDN_ASSETS.WORKOUT_BG_STRENGTH;
const WORKOUT_BG_YOGA = BUNNY_CDN_ASSETS.WORKOUT_BG_YOGA;
const WORKOUT_BG_RHYTHM = BUNNY_CDN_ASSETS.WORKOUT_BG_RHYTHM;
const WORKOUT_BG_BOXING = BUNNY_CDN_ASSETS.WORKOUT_BG_BOXING;

// Top Performing Trainer Assets (Served via ultra-fast BunnyCDN with edge caching)
const TRAINER_VIDEO_KALPESH = BUNNY_CDN_ASSETS.TRAINER_VIDEO_KALPESH;
const TRAINER_THUMB_KALPESH = BUNNY_CDN_ASSETS.TRAINER_IMAGE_KALPESH;

const TRAINER_VIDEO_PRANAY = BUNNY_CDN_ASSETS.TRAINER_VIDEO_PRANAY;
const TRAINER_THUMB_PRANAY = BUNNY_CDN_ASSETS.TRAINER_IMAGE_PRANAY;

const TRAINER_VIDEO_SHIVANI = BUNNY_CDN_ASSETS.TRAINER_VIDEO_SHIVANI;
const TRAINER_THUMB_SHIVANI = BUNNY_CDN_ASSETS.TRAINER_IMAGE_SHIVANI;

const TRAINER_VIDEO_MAYUR = BUNNY_CDN_ASSETS.TRAINER_VIDEO_MAYUR;
const TRAINER_THUMB_MAYUR = BUNNY_CDN_ASSETS.TRAINER_IMAGE_MAYUR;

const TRAINER_VIDEO_AATHARVA = BUNNY_CDN_ASSETS.TRAINER_VIDEO_ATHARVA;
const TRAINER_THUMB_AATHARVA = BUNNY_CDN_ASSETS.TRAINER_IMAGE_ATHARVA;

const TRAINER_VIDEO_PARTH = BUNNY_CDN_ASSETS.TRAINER_VIDEO_PARTH;
const TRAINER_THUMB_PARTH = BUNNY_CDN_ASSETS.TRAINER_IMAGE_PARTH;

const TRAINER_VIDEO_PANKAJ = BUNNY_CDN_ASSETS.TRAINER_VIDEO_PANKAJ;
const TRAINER_THUMB_PANKAJ = BUNNY_CDN_ASSETS.TRAINER_IMAGE_PANKAJ;

const TOP_PERFORMING_TRAINERS = [
  {
    id: 'top-kalpesh',
    name: 'Kalpesh Kherade',
    designation: 'Fitness Trainer',
    specialty: 'Strength Training',
    video: TRAINER_VIDEO_KALPESH,
    thumb: TRAINER_THUMB_KALPESH,
  },
  {
    id: 'top-pranay',
    name: 'Pranay Sardesai',
    designation: 'Fitness Trainer',
    specialty: 'Core & Conditioning',
    video: TRAINER_VIDEO_PRANAY,
    thumb: TRAINER_THUMB_PRANAY,
  },
  {
    id: 'top-shivani',
    name: 'Shivani Gupta',
    designation: 'Fitness Trainer',
    specialty: 'Mobility & Flexibility',
    video: TRAINER_VIDEO_SHIVANI,
    thumb: TRAINER_THUMB_SHIVANI,
  },
  {
    id: 'top-mayur',
    name: 'Mayur Bhosle',
    designation: 'Fitness Trainer',
    specialty: 'Functional & Strength',
    video: TRAINER_VIDEO_MAYUR,
    thumb: TRAINER_THUMB_MAYUR,
  },
  {
    id: 'top-1',
    name: 'Aatharva Tawde',
    designation: 'Fitness Trainer',
    specialty: 'Mobility & Hypertrophy',
    video: TRAINER_VIDEO_AATHARVA,
    thumb: TRAINER_THUMB_AATHARVA,
  },
  {
    id: 'top-2',
    name: 'Parth Thakur',
    designation: 'Fitness Trainer',
    specialty: 'Functional & Strength',
    video: TRAINER_VIDEO_PARTH,
    thumb: TRAINER_THUMB_PARTH,
  },
  {
    id: 'top-3',
    name: 'Pankaj Yadav',
    designation: 'Fitness Trainer',
    specialty: 'Endurance & Core',
    video: TRAINER_VIDEO_PANKAJ,
    thumb: TRAINER_THUMB_PANKAJ,
  },
];


function getClientGender(booking: Booking): string {
  if (!booking?.clientId) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[CLIENT-GENDER-TRACE] bookingId: ${booking?.id || 'N/A'}, booking.clientId: empty, resolved profile ID: N/A, resolved profile gender: N/A, final displayed gender: Not specified`);
    }
    return 'Not specified';
  }
  const profile = Database.getProfile(booking.clientId);
  const rawGender = profile?.gender || 'N/A';
  let displayGender = 'Not specified';
  if (profile && profile.gender) {
    const g = String(profile.gender).toLowerCase().trim();
    if (g === 'male') displayGender = 'Male';
    else if (g === 'female') displayGender = 'Female';
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[CLIENT-GENDER-TRACE] bookingId: ${booking.id}, booking.clientId: ${booking.clientId}, resolved profile ID: ${profile?.id || 'null'}, resolved profile gender: ${rawGender}, final displayed gender: ${displayGender}`);
  }
  return displayGender;
}

interface RequestCardProps {
  booking: Booking;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onTimeout: (id: string) => void;
  onPress: (id: string) => void;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : '';
}

function playNotificationBeep() {
  try {
    if (typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.3); // play for 0.3s
      }
    }
  } catch (e) {
    console.warn('Failed to play synthesized notification beep:', e);
  }
}

export function RequestCard({ booking, onAccept, onDecline, onTimeout, onPress }: RequestCardProps) {
  const [countdownNum, setCountdownNum] = useState<1 | 2 | 3 | null>(1);
  const [timeLeft, setTimeLeft] = useState(600);
  const isTimeoutTriggeredRef = useRef(false);
  const lastBeepedCountdown = useRef<number | null>(null);
  // Latest-ref: the countdown effect must not restart (or lose its beep/timeout
  // bookkeeping) every time the parent re-creates the handler.
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    isTimeoutTriggeredRef.current = false;
    lastBeepedCountdown.current = null;
  }, [booking.id]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const nowMs = getCurrentServerTime().getTime();
      const totalWindowSec = 1800;
      const deadlineMs = booking.acceptanceDeadline && booking.acceptanceDeadline > 0
        ? booking.acceptanceDeadline
        : (booking.createdAt || nowMs) + totalWindowSec * 1000;
      const secsLeft = Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));
      const elapsed = totalWindowSec - secsLeft;

      let num: 1 | 2 | 3 | null = 1;
      let remaining = 600 - elapsed;

      if (secsLeft <= 0) {
        num = null;
        remaining = 0;
      } else if (secsLeft <= 600) {
        num = 3;
        remaining = secsLeft;
      } else if (secsLeft <= 1200) {
        num = 2;
        remaining = secsLeft - 600;
      }
      return { num, remaining, expired: secsLeft <= 0 };
    };

    const updateTimer = () => {
      const { num, remaining, expired } = calculateTimeLeft();
      setCountdownNum(num);
      setTimeLeft(remaining);

      if (num !== null && lastBeepedCountdown.current !== num) {
        lastBeepedCountdown.current = num;
        playNotificationBeep();
        Vibration.vibrate(500);
      }

      if (expired && !isTimeoutTriggeredRef.current) {
        isTimeoutTriggeredRef.current = true;
        onTimeoutRef.current(booking.id);
      }
    };

    updateTimer();

    const timer = setInterval(updateTimer, 1000);

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        updateTimer();
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [booking.id, booking.createdAt]);

  const formatRemainingTime = (secs: number, num: 1 | 2 | 3 | null) => {
    if (num === null) return 'Expired';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `COUNTDOWN ${num} - ${m}:${String(s).padStart(2, '0')}`;
  };

  const customerId = `VIRLA-C${booking.id.slice(-6).toUpperCase()}`;
  const customerGender = getClientGender(booking);

  return (
    <Pressable
      onPress={() => onPress(booking.id)}
      className="bg-white p-5 rounded-[28px] shadow-sm gap-4 mb-4"
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-rose-500" />
          <Text className="text-[#101828] text-xs font-black tracking-wider">{customerId}</Text>
        </View>
        
        <View className="bg-rose-50 border border-rose-100 px-3 py-1 rounded-full flex-row items-center gap-1.5">
          <Feather name="clock" size={10} color="#E11D48" />
          <Text className="text-[#E11D48] text-[10px] font-black">{formatRemainingTime(timeLeft, countdownNum)}</Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-[#101828] text-base font-black tracking-tight">{getDisplayWorkoutTitle(booking.workoutTitle)}</Text>
        <Text className="text-zinc-500 text-xs font-semibold leading-relaxed">
          {formatToDDMMYYYY(booking.date)} • {booking.time} ({booking.durationMinutes || 60} mins)
        </Text>
        
        <View className="flex-row gap-2 mt-1 flex-wrap">
          <View className="bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg">
            <Text numberOfLines={1} className="text-zinc-650 text-[9px] font-bold uppercase">{customerGender}</Text>
          </View>
          <View className="bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg">
            <Text numberOfLines={1} className="text-zinc-650 text-[9px] font-bold uppercase">Solo Session</Text>
          </View>
          <View className="bg-zinc-50 border border-zinc-150 px-2.5 py-1 rounded-lg max-w-[45%]">
            <Text numberOfLines={1} className="text-zinc-650 text-[9px] font-bold uppercase">{booking.address ? booking.address.split(',')[0] : 'Venue'}</Text>
          </View>
        </View>
      </View>

      <View className="h-[1px] bg-zinc-100 my-1" />

      <View className="flex-row">
        <Pressable
          disabled={countdownNum === null}
          onPress={(e) => {
            e.stopPropagation();
            if (countdownNum !== null) {
              onAccept(booking.id);
            }
          }}
          className={`flex-1 py-3.5 rounded-2xl items-center justify-center ${countdownNum === null ? 'bg-zinc-300' : 'bg-[#E11D48]'}`}
        >
          <Text className={`text-xs font-black uppercase ${countdownNum === null ? 'text-zinc-500' : 'text-white'}`}>
            {countdownNum === null ? 'Expired' : 'Accept Request'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

interface AcknowledgementCardProps {
  booking: Booking;
  onAcknowledge: (id: string) => void;
  onPress: (id: string) => void;
}

export function AcknowledgementCard({ booking, onAcknowledge, onPress }: AcknowledgementCardProps) {
  const customerId = `VIRLA-C${booking.id.slice(-6).toUpperCase()}`;
  const customerGender = getClientGender(booking);

  return (
    <Pressable
      onPress={() => onPress(booking.id)}
      className="bg-white border-2 border-amber-500/30 p-5 rounded-[28px] shadow-sm gap-4 mb-4"
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-amber-500" />
          <Text className="text-[#101828] text-xs font-black tracking-wider">{customerId}</Text>
        </View>
        
        <View className="bg-amber-50 border border-amber-100 px-3 py-1 rounded-full flex-row items-center gap-1.5">
          <Feather name="alert-triangle" size={10} color="#D97706" />
          <Text className="text-[#D97706] text-[10px] font-black uppercase">ACK REQUIRED</Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-[#101828] text-base font-black tracking-tight">{getDisplayWorkoutTitle(booking.workoutTitle)}</Text>
        <Text className="text-zinc-500 text-xs font-semibold leading-relaxed">
          {formatToDDMMYYYY(booking.date)} • {booking.time} ({booking.durationMinutes || 60} mins)
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

        <Text className="text-amber-700 text-[10px] font-medium bg-amber-50/50 p-2 rounded-xl mt-1 border border-amber-100/50">
          ⚠️ Auto-accepted by system because trainer did not manually respond within 30 minutes.
        </Text>
      </View>

      <View className="h-[1px] bg-zinc-100 my-1" />

      <View className="flex-row">
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onAcknowledge(booking.id);
          }}
          className="flex-1 py-3.5 rounded-2xl items-center justify-center bg-amber-500"
        >
          <Text className="text-xs font-black uppercase text-white">
            Acknowledge Request
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const getWorkoutEmoji = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('forge') || t.includes('strength')) return '🏋️';
  if (t.includes('flow') || t.includes('motion') || t.includes('aerial') || t.includes('hammock')) return '🧘‍♀️';
  if (t.includes('rhythm') || t.includes('burn') || t.includes('dance')) return '💃';
  if (t.includes('reset') || t.includes('studio') || t.includes('stretch')) return '🧘‍♂️';
  if (t.includes('combat') || t.includes('boxing')) return '🥊';
  return '🧘';
};

export default function HomeScreen() {
  const router = useRouter();
  const isNavigatingRef = useRef(false);

  // 🚀 Native Reanimated UI-thread scroll offsets for horizontal carousels
  const workoutScrollX = useSharedValue(0);
  const trainerScrollX = useSharedValue(0);
  const onWorkoutScroll = useAnimatedScrollHandler((event) => {
    workoutScrollX.value = event.contentOffset.x;
  });
  const onTrainerScroll = useAnimatedScrollHandler((event) => {
    trainerScrollX.value = event.contentOffset.x;
  });

  const navThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateSafely = useCallback((route: Href) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    router.push(route);
    if (navThrottleTimerRef.current) clearTimeout(navThrottleTimerRef.current);
    navThrottleTimerRef.current = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 700);
  }, [router]);

  useEffect(() => {
    return () => {
      if (navThrottleTimerRef.current) clearTimeout(navThrottleTimerRef.current);
    };
  }, []);

  const { bookings, acceptBooking, updateTimelineStatus, reassignTrainer } = useBookingStore();
  const { membership } = useMembershipStore();
  const { unreadCount } = useNotificationStore();
  const { user, role } = useUserStore();
  const { totalEarnings, earningsList, coaches } = useCoachStore();
  const { savedPlan } = useAIWellnessStore();
  const profile = useUserProfileStore();

  const [partnerModalVisible, setPartnerModalVisible] = useState(false);
  const [activePartnerBookingId, setActivePartnerBookingId] = useState('');
  const [communicationModalVisible, setCommunicationModalVisible] = useState(false);
  const [trainerStatusModalVisible, setTrainerStatusModalVisible] = useState(false);
  const [pendingStatusTarget, setPendingStatusTarget] = useState<'online' | 'offline'>('offline');
  const [logMetricsModalVisible, setLogMetricsModalVisible] = useState(false);
  const [logMetricsType, setLogMetricsType] = useState<'hydration' | 'calories'>('hydration');
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

  const handleHiddenAdminAccess = async () => {
    const userId = Database.getCurrentUserId();
    if (!userId) {
      Alert.alert('Access Denied', 'Please log in first.');
      return;
    }
    try {
      const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
      if (!isAliveRef.current) return;
      if (error) {
        console.error('Admin role check failed:', error.message);
        Alert.alert('Error', 'Unable to verify administrative authorization.');
        return;
      }
      if (data && data.role === 'admin') {
        navigateSafely('/admin-panel');
      } else {
        Alert.alert('Access Denied', 'You do not have administrative authorization.');
      }
    } catch (err) {
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

  const executeAcceptRequest = async (id: string) => {
    const booking = bookings.find(b => b.id === id);
    const trainerId = booking?.trainerId || 'N/A';
    const currentUserId = Database.getCurrentUserId() || 'N/A';
    const currentStatus = booking?.status || 'N/A';

    console.log("[TRAINER-ACCEPT-TRACE] BUTTON PRESSED: YES");
    console.log("[TRAINER-ACCEPT-TRACE] HANDLER ENTERED: YES");
    console.log(`[TRAINER-ACCEPT-TRACE] BOOKING ID: ${id}`);
    console.log(`[TRAINER-ACCEPT-TRACE] TRAINER ID: ${trainerId}`);
    console.log(`[TRAINER-ACCEPT-TRACE] AUTHENTICATED USER ID: ${currentUserId}`);
    console.log(`[TRAINER-ACCEPT-TRACE] CURRENT BOOKING STATUS: ${currentStatus}`);
    console.log("[TRAINER-ACCEPT-TRACE] RPC CALLED: trainer_accept_booking");

    try {
      await acceptBooking(id);
      console.log("[TRAINER-ACCEPT-TRACE] RPC RESULT: SUCCESS");
      console.log("[TRAINER-ACCEPT-TRACE] NEW BOOKING STATUS: trainer_accepted");
      console.log("[TRAINER-ACCEPT-TRACE] CLIENT REFRESH: completed");
      console.log("[TRAINER-ACCEPT-TRACE] TRAINER REFRESH: completed");
      console.log("[TRAINER-ACCEPT-TRACE] ADMIN STATE: synchronized");
      console.log("[TRAINER-ACCEPT-TRACE] ---------------------------------");
      
      setNativeAlertState({
        visible: true,
        title: 'Booking Accepted',
        message: 'You have accepted the session request.',
        confirmText: 'OK',
        onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
      });
    } catch (err) {
      console.error("[TRAINER-ACCEPT-TRACE] RPC RESULT: ERROR");
      console.error("[TRAINER-ACCEPT-TRACE] RPC error details:", err);
      console.log("[TRAINER-ACCEPT-TRACE] ---------------------------------");
      
      setNativeAlertState({
        visible: true,
        title: 'Accept Failed',
        message: errorMessage(err) || 'Could not accept booking.',
        confirmText: 'OK',
        onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
      });
    }
  };

  const handleAcceptRequest = (id: string) => {
    const confirmMsg = 'Accept Booking?\n\nBy accepting this booking you agree to complete the session. Once accepted it cannot be cancelled except through VIRLA Support.';
    setNativeAlertState({
      visible: true,
      title: 'Accept Booking?',
      message: 'By accepting this booking you agree to complete the session. Once accepted it cannot be cancelled except through VIRLA Support.',
      cancelText: 'Cancel',
      confirmText: 'Accept',
      onConfirm: () => {
        setNativeAlertState(prev => ({ ...prev, visible: false }));
        executeAcceptRequest(id);
      },
    });
  };

  const handleDeclineRequest = (id: string) => {
    reassignTrainer(id, 'declined');
    setNativeAlertState({
      visible: true,
      title: 'Request Declined',
      message: 'The request has been reassigned to another available trainer.',
      confirmText: 'OK',
      onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
    });
  };

  const handleTimeoutRequest = (id: string) => {
    reassignTrainer(id, 'timeout');
  };

  const handleAcknowledgeRequest = async (id: string) => {
    try {
      await useBookingStore.getState().acknowledgeSession(id);
      setNativeAlertState({
        visible: true,
        title: 'Success',
        message: 'You have acknowledged the auto-accepted session.',
        confirmText: 'OK',
        onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
      });
    } catch (e) {
      setNativeAlertState({
        visible: true,
        title: 'Error',
        message: errorMessage(e) || 'Acknowledgement failed.',
        confirmText: 'OK',
        onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
      });
    }
  };

  const currentCoach = coaches.find(c => c.id === user.id || c.name === user.name);

  const trainerPhotoSource = useCallback((trainerId?: string | null, snapshot?: string | null) => {
    const live = trainerId ? coaches.find(c => c.id === trainerId) : undefined;
    return resolveAvatarSource(live?.photo || snapshot || '', live?.gender);
  }, [coaches]);

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

  const sortBookingsChronologically = (list: Booking[]) => {
    return [...list].sort((a, b) => {
      const startA = getBookingISTDateRange(a).start.getTime();
      const startB = getBookingISTDateRange(b).start.getTime();
      return startA - startB;
    });
  };

  const trainerBookings = useMemo(() => bookings.filter(b =>
    (b.trainerId === user.id || b.trainerName === user.name || (currentCoach && b.trainerId === currentCoach.id))
  ), [bookings, user.id, user.name, currentCoach]);

  const confirmedBookings = useMemo(() => trainerBookings.filter(b =>
    b.status === 'upcoming' && 
    b.timelineStatus !== 'booked' &&
    b.timelineStatus !== 'trainer_assigned' &&
    b.timelineStatus !== 'session_closed'
  ), [trainerBookings]);

  const sortedConfirmed = useMemo(() => sortBookingsChronologically(confirmedBookings), [confirmedBookings]);
  const serverNow = getCurrentServerTime();
  
  const activeSession = sortedConfirmed.find(b => 
    isSessionGenuinelyActive(b, serverNow)
  );

  const nextSession = sortedConfirmed.find(b => {
    if (activeSession && b.id === activeSession.id) return false;
    if (b.timelineStatus === 'workout_completed' || b.timelineStatus === 'session_closed' || b.status === 'completed' || b.status === 'cancelled') return false;
    const range = getBookingISTDateRange(b);
    return range.end > serverNow;
  });

  let countdownText = '';
  let isNextSessionToday = false;
  if (nextSession) {
    const range = getBookingISTDateRange(nextSession);
    const start = range.start;
    isNextSessionToday = getISTDateInfo(start).dateString === getISTDateInfo(serverNow).dateString;
    
    const diffMs = start.getTime() - serverNow.getTime();
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

  const todayIstStr = getISTDateInfo(serverNow).dateString;
  const todayBookings = sortedConfirmed.filter(b => {
    const range = getBookingISTDateRange(b);
    return getISTDateInfo(range.start).dateString === todayIstStr;
  });

  // Sessions the trainer had accepted that the client later cancelled (shown on trainer home, non-interactive)
  const todayCancelledByUser = trainerBookings.filter(b => {
    if (b.status !== 'cancelled') return false;
    if (!b.trainerAcceptedAt && !b.autoAcceptedAt) return false;
    const range = getBookingISTDateRange(b);
    return getISTDateInfo(range.start).dateString === todayIstStr;
  });
  const todayDisplayBookings = [...todayBookings, ...todayCancelledByUser].sort(
    (a, b) => getBookingISTDateRange(a).start.getTime() - getBookingISTDateRange(b).start.getTime()
  );
  
  const todaySessionsCount = todayBookings.length;
  const todaySessionsHours = todayBookings.reduce((sum, b) => sum + (b.durationMinutes || 60), 0) / 60;
  const formattedTodayHours = todaySessionsHours.toFixed(1).replace('.0', '');

  const tomorrowDateStr = (() => {
    const t = new Date(serverNow.getTime() + 24 * 60 * 60 * 1000);
    return getISTDateInfo(t).dateString;
  })();

  const tomorrowBookings = sortedConfirmed.filter(b => {
    const range = getBookingISTDateRange(b);
    return getISTDateInfo(range.start).dateString === tomorrowDateStr;
  });

  const getIsTomorrowScheduleEnabled = () => {
    if (!currentCoach) return false;
    const allTomorrowSlots = generateMonthlySlots(new Date(serverNow.getTime() + 24 * 60 * 60 * 1000).getMonth(), new Date(serverNow.getTime() + 24 * 60 * 60 * 1000).getFullYear());
    const tomorrowSlotsData = allTomorrowSlots.find((d) => d.date === tomorrowDateStr)?.slots || [];
    const availabilityOverrides = currentCoach.preferences?.availabilityOverrides || [];
    const tomorrowActiveSlots = tomorrowSlotsData.filter((slot) => {
      const override = availabilityOverrides.find((o) => 
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
    const todaySlotsData = allDaysSlots.find((d) => d.date === todayDateStr)?.slots || [];
    const availabilityOverrides = currentCoach.preferences?.availabilityOverrides || [];
    const reservations = Database.schema.slot_reservations || [];
    
    let bookedSlotsToday = 0;
    let availableSlotsToday = 0;

    todaySlotsData.forEach((slot) => {
      const isBooked = bookings.some((b) => 
        b.trainerId === currentCoach.id && 
        normalizeDate(b.date) === normalizeDate(todayDateStr) && 
        canonicalizeTimeRange(b.time) === canonicalizeTimeRange(slot.time) && 
        b.status === 'upcoming'
      );
      const isReserved = reservations.some((r) =>
        r.trainer_id === currentCoach.id &&
        normalizeDate(r.slot_date) === normalizeDate(todayDateStr) &&
        canonicalizeTimeRange(r.slot_time) === canonicalizeTimeRange(slot.time) &&
        r.expires_at > Date.now()
      );
      const override = availabilityOverrides.find((o) => 
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

  const availabilityDayKey = new Date().toDateString();
  const reservationCount = (Database.schema.slot_reservations || []).length;
  const todayAvail = useMemo(
    () => getTodayAvailability(),
    [currentCoach, bookings, availabilityDayKey, reservationCount]
  );
  const formattedBookedHours = todayAvail.booked.toFixed(1).replace('.0', '');
  const formattedAvailableHours = todayAvail.available.toFixed(1).replace('.0', '');

  React.useEffect(() => {
    if (currentCoach) {
      setTrainerOnlineStatus(currentCoach.preferences?.online ? 'online' : 'offline');
    }
  }, [currentCoach]);

  const toggleOnlineStatus = () => {
    if (!currentCoach) return;
    const nextOnline = !(currentCoach.preferences?.online);
    const target = nextOnline ? 'online' : 'offline';
    setPendingStatusTarget(target);
    setTrainerStatusModalVisible(true);
  };

  const handleConfirmTrainerStatus = () => {
    if (!currentCoach) return;
    const isNextOnline = pendingStatusTarget === 'online';
    setTrainerOnlineStatus(pendingStatusTarget);

    Database.updateTrainerOnlineStatus(currentCoach.id, isNextOnline);
    useCoachStore.getState().syncFromDB();

    // Immediately revoke pending requests assigned to this coach when going offline
    if (!isNextOnline) {
      const pendingRequests = bookings.filter(b =>
        (b.trainerId === currentCoach.id || b.trainerName === currentCoach.name) && 
        b.timelineStatus === 'booked'
      );
      for (const req of pendingRequests) {
        reassignTrainer(req.id, 'timeout');
      }
    }
    setTrainerStatusModalVisible(false);
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
  const holdProgress = useSharedValue(0);
  const animatedCircleProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: 88 - (88 * holdProgress.value),
    };
  });
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAliveRef = useRef(true);

  const handlePressIn = () => {
    setIsHolding(true);
    holdProgress.value = 0;
    holdProgress.value = withTiming(1, {
      duration: 5000,
      easing: Easing.linear,
    });

    holdTimeoutRef.current = setTimeout(async () => {
      setIsHolding(false);
      holdProgress.value = 0;
      await handleHiddenAdminAccess();
    }, 5000);
  };

  const handlePressOut = () => {
    setIsHolding(false);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    holdProgress.value = 0;
  };

  useEffect(() => {
    return () => {
      isAliveRef.current = false;
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);

  const [loading, setLoading] = useState(Database.getIsLoaded() ? false : true);

  useEffect(() => {
    let isMounted = true;
    let hasSynced = false;
    const syncData = async () => {
      if (!isMounted || hasSynced) return;
      // 1. Wait for Zustand store hydration
      if (!useUserStore.persist.hasHydrated()) {
        const unsub = useUserStore.persist.onFinishHydration(() => {
          unsub();
          if (isMounted) syncData();
        });
        setTimeout(() => {
          if (isMounted) syncData();
        }, 300);
        return;
      }
      hasSynced = true;

      // 2. Set currentUserId context on Database
      const userId = useUserStore.getState().user?.id;
      if (userId) {
        Database.setCurrentUserId(userId);
      }

      try {
        if (!Database.getIsLoaded()) {
          setLoading(true);
          await Database.load();
        } else {
          // Run non-blocking background refresh without resetting isLoaded
          Database.load().catch(() => {});
        }

        useUserStore.getState().syncFromDB();
        useUserProfileStore.getState().syncFromDB();
        useBookingStore.getState().syncFromDB();
        useCoachStore.getState().syncFromDB();
        useWorkoutStore.getState().syncFromDB();
        useWalletStore.getState().syncFromDB();
        useMembershipStore.getState().syncFromDB();
        useNotificationStore.getState().syncFromDB();
        useAddressStore.getState().syncFromDB();
      } catch (e) {
        console.error('Home sync failed:', e);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    syncData();
    return () => {
      isMounted = false;
    };
  }, []);

  const upcomingBookings = bookings
    .filter((b) => b.status === 'upcoming' && (getBookingISTDateRange(b).start.getTime() > serverNow.getTime() || (b.timelineStatus && b.timelineStatus !== 'session_closed')))
    .sort((a, b) => getBookingISTDateRange(a).start.getTime() - getBookingISTDateRange(b).start.getTime());
  const pastBookings = bookings.filter((b) => b.status === 'completed');
  const activeBooking = bookings.find(b => {
    if (b.status !== 'upcoming' || !b.timelineStatus || b.timelineStatus === 'session_closed') {
      return false;
    }
    // If session has started or is actively progressing, keep it active regardless of slot end time until trainer completes it
    const activeTimelineStatuses = ['trainer_travelling', 'trainer_arrived', 'otp_verified', 'workout_started', 'workout_completed', 'trainer_report_submitted', 'customer_review_pending'];
    if (activeTimelineStatuses.includes(b.timelineStatus)) {
      return true;
    }
    const range = getBookingISTDateRange(b);
    return serverNow.getTime() <= range.end.getTime();
  });

  // Hydration & Calorie state
  const [waterMl, setWaterMl] = useState(0);
  const [caloriesToday, setCaloriesToday] = useState(0);

  // Dynamic user-personalized goals (calculated from profile metrics and AI wellness plan, no hardcoded constants)
  const weightVal = parseFloat(profile.weight) || 70;

  const waterGoal = useMemo(() => {
    if (savedPlan?.hydrationGoal) {
      const match = String(savedPlan.hydrationGoal).match(/([\d.]+)/);
      if (match) {
        const parsedLiters = parseFloat(match[1]);
        if (!isNaN(parsedLiters) && parsedLiters > 0) {
          return Math.round(parsedLiters * 1000);
        }
      }
    }
    return Math.round(weightVal * 35);
  }, [savedPlan?.hydrationGoal, weightVal]);

  const caloriesGoal = useMemo(() => {
    if (savedPlan?.dailyCalories && savedPlan.dailyCalories > 0) {
      return Math.round(savedPlan.dailyCalories * 0.28);
    }
    const goalMultiplier = (profile.targetGoal === 'Fat Loss' || profile.targetGoal === 'Weight Loss') ? 8.5 : 7.5;
    return Math.round(weightVal * goalMultiplier);
  }, [savedPlan?.dailyCalories, profile.targetGoal, weightVal]);

  const weeklyStreakGoal = useMemo(() => {
    if (savedPlan?.workoutFrequency) {
      const freq = String(savedPlan.workoutFrequency).toLowerCase();
      if (freq.includes('daily') || freq.includes('7')) return 7;
      if (freq.includes('6')) return 6;
      if (freq.includes('5')) return 5;
      if (freq.includes('4')) return 4;
      if (freq.includes('3')) return 3;
    }
    return 5;
  }, [savedPlan?.workoutFrequency]);

  // 🚀 Native Reanimated UI-thread slide animation for dashboard mount
  const dashboardSlideY = useSharedValue(10);
  const animatedDashboardStyle = useAnimatedStyle(() => {
    return {
      opacity: 1,
      transform: [{ translateY: dashboardSlideY.value }],
    };
  });

  useEffect(() => {
    dashboardSlideY.value = 10;
    dashboardSlideY.value = withTiming(0, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [role]);

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
  const { completedJobs, upcomingJobs, cancelledJobs } = useMemo(() => ({
    completedJobs: bookings.filter(b => b.status === 'completed'),
    upcomingJobs: bookings.filter(b => b.status === 'upcoming'),
    cancelledJobs: bookings.filter(b => b.status === 'cancelled'),
  }), [bookings]);
  const totalCompleted = completedJobs.length;
  const totalUpcoming = upcomingJobs.length;

  // Schema identity changes on every Database.load(), so this re-reads after a real sync.
  const dbSchema = Database.schema;
  const { trainerEarningsList, monthlyEarnings } = useMemo(() => {
    const list = user.id ? Database.getEarnings(user.id) : [];
    return {
      trainerEarningsList: list,
      monthlyEarnings: list.reduce((acc, earn) => acc + (earn.amount > 0 ? earn.amount : 0), 0),
    };
  }, [dbSchema, user.id, bookings]);

  const getRecoveryStatus = (score: number | null) => {
    if (score === null) {
      return { title: 'No Logs Today', desc: 'Log water or workouts to compute recovery index.' };
    }
    if (score >= 80) {
      return { title: 'Optimal Recovery', desc: 'Peak condition for high-intensity training today.' };
    }
    if (score >= 60) {
      return { title: 'Good Recovery', desc: 'Ready for strength and conditioning today.' };
    }
    if (score >= 40) {
      return { title: 'Moderate Recovery', desc: 'Consider active recovery or light mobility.' };
    }
    return { title: 'Rest Recommended', desc: 'Focus on rest, hydration, and gentle stretching.' };
  };

  const recoveryStatus = getRecoveryStatus(userRecovery);

  const logWaterAmount = (amount: number) => {
    if (!user.id) return;
    const dateStr = new Date().toLocaleDateString('en-CA');
    const newWater = Database.logHydration(user.id, dateStr, amount);
    setWaterMl(newWater);
    useToastStore.getState().showToast({
      title: 'Hydration Logged',
      message: `+${amount}ml recorded! Stay hydrated to optimize recovery.`,
      type: 'success',
    });
  };

  const handleLogWater = () => {
    if (!user.id) {
      useToastStore.getState().showToast({
        title: 'Authentication Required',
        message: 'Please register or log in first.',
        type: 'warning',
      });
      return;
    }
    setLogMetricsType('hydration');
    setLogMetricsModalVisible(true);
  };

  const logCaloriesAmount = (amount: number) => {
    if (!user.id) return;
    const dateStr = new Date().toLocaleDateString('en-CA');
    const newCal = Database.logCalories(user.id, dateStr, amount);
    setCaloriesToday(newCal);
    useToastStore.getState().showToast({
      title: 'Activity Logged',
      message: `+${amount} kcal added to today's active burn!`,
      type: 'success',
    });
  };

  const handleLogCalories = () => {
    if (!user.id) {
      useToastStore.getState().showToast({
        title: 'Authentication Required',
        message: 'Please register or log in first.',
        type: 'warning',
      });
      return;
    }
    setLogMetricsType('calories');
    setLogMetricsModalVisible(true);
  };

  const handleSupport = () => {
    Alert.alert('VIRLA VIP Concierge', 'Connecting to VIP wellness support line (+91 99999 88888)...');
  };

  const handleCommunicationCenter = () => {
    setCommunicationModalVisible(true);
  };


  const handleTrainerJobClick = (bookingId: string, currentTimeline: string) => {
    if (currentTimeline === 'confirmed') {
      acceptBooking(bookingId);
      Alert.alert('Job Accepted', 'You accepted this session. Ready to begin travel at the scheduled time!');
    } else {
      navigateSafely({
        pathname: '/session-detail',
        params: { id: bookingId },
      });
    }
  };

  return (
    <SafeAreaViewWrapper>
      {/* Dynamic Header */}
      <View className="h-16 flex-row items-center justify-between px-5 bg-[#FCF5F5]">
        <View className="relative flex-row items-center">
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            className="pr-3 py-1"
          >
            <View className="flex-row items-center">
              <Image
                source={SPLASH_ICON}
                style={{
                  width: 22,
                  height: 22,
                  resizeMode: 'contain',
                }}
              />
              <Text 
                style={{ 
                  fontFamily: 'Outfit_800ExtraBold',
                  letterSpacing: 1.5,
                  fontSize: 22,
                  color: '#0F172A',
                  marginLeft: 3,
                }}
              >
                {role === 'trainer' ? 'IRLA PRO' : 'IRLA'}
              </Text>
            </View>
            <Text 
              style={{ 
                fontFamily: 'Inter_600SemiBold',
                letterSpacing: 2,
                fontSize: 9,
                color: '#94A3B8',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              Wellness At Your Doorstep
            </Text>
          </Pressable>

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
                  animatedProps={animatedCircleProps}
                  strokeLinecap="round"
                  transform="rotate(-90 16 16)"
                />
              </Svg>
            </View>
          )}
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPressIn={handleCommunicationCenter}
            className="w-10 h-10 rounded-full bg-white border border-[#F1E5E7] items-center justify-center relative"
            style={softShadow({ color: '#0F172A', opacity: 0.05, radius: 4, offsetY: 1 })}
          >
            <Feather name="bell" size={17} color="#334155" />
            {unreadCount > 0 && (
              <View 
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#E11D48',
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text numberOfLines={1} style={{ fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 9, lineHeight: 11 }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigateSafely('/(tabs)/profile')}
            className="w-10 h-10 rounded-full overflow-hidden relative items-center justify-center p-[1.5px]"
            style={{
              backgroundColor: '#F59E0B',
            }}
          >
            <AvatarImage
              uri={profile?.avatar || user?.avatar}
              gender={user?.gender || profile?.gender || (role === 'trainer' ? 'male' : '')}
              style={{ width: '100%', height: '100%', borderRadius: 999 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
            {/* Small emerald active dot indicator */}
            <View 
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: '#10B981',
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }}
            />
          </Pressable>
        </View>
      </View>
      {loading ? (
        <SkeletonLoader layout="home" />
      ) : (
        <View className="flex-1 bg-[#FCF5F5]">
          {activeBooking && (role === 'customer' || role === 'admin') && (
            <ClientLiveUpdateBanner
              activeBooking={activeBooking}
              navigateSafely={navigateSafely}
            />
          )}

          <ReanimatedAnimated.ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
            className="bg-[#FCF5F5] flex-1"
            scrollEventThrottle={16}
          >
            <ReanimatedAnimated.View
              style={animatedDashboardStyle}
              className="px-5 pt-3 gap-6"
            >
          {/* ==================== CLIENT MODE DASHBOARD ==================== */}
          {(role === 'customer' || role === 'admin') && (
            <ClientHomeView
              greeting={greeting}
              user={user}
              recoveryVal={recoveryVal}
              userRecovery={userRecovery}
              recoveryStatus={recoveryStatus}
              membership={membership}
              caloriesToday={caloriesToday}
              caloriesGoal={caloriesGoal}
              waterMl={waterMl}
              waterGoal={waterGoal}
              streak={streak}
              weeklyStreakGoal={weeklyStreakGoal}
              savedPlan={savedPlan}
              upcomingBookings={upcomingBookings}
              activeBooking={activeBooking}
              topPerformingTrainers={TOP_PERFORMING_TRAINERS}
              onWorkoutScroll={onWorkoutScroll}
              onTrainerScroll={onTrainerScroll}
              handleLogCalories={handleLogCalories}
              handleLogWater={handleLogWater}
              navigateSafely={navigateSafely}
              trainerPhotoSource={trainerPhotoSource}
              getWorkoutEmoji={getWorkoutEmoji}
              getDisplayWorkoutTitle={getDisplayWorkoutTitle}
              formatToDDMMYYYY={formatToDDMMYYYY}
              setActivePartnerBookingId={setActivePartnerBookingId}
              setPartnerModalVisible={setPartnerModalVisible}
            />
          )}

                    {role === 'trainer' && (
            <>
              {/* Header Greeting */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                      {getGreeting()}
                    </Text>
                    <Text className="text-[#101828] text-2xl font-bold tracking-tight mt-1">
                      {user?.name ? String(user.name).split(' ')[0] : 'Trainer'} 👋
                    </Text>
                  </View>
                  
                  <Pressable
                    onPress={toggleOnlineStatus}
                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-sm"
                  >
                    <View className={`w-2 h-2 rounded-full ${trainerOnlineStatus === 'online' ? 'bg-[#16C784]' : 'bg-red-500'}`} />
                    <Text className={`text-[11px] font-semibold tracking-wide ${trainerOnlineStatus === 'online' ? 'text-[#16C784]' : 'text-red-500'}`}>
                      {trainerOnlineStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
                    </Text>
                  </Pressable>
                </View>
                <Text className="text-zinc-500 text-xs font-medium mt-1.5">
                  {getFormattedToday()}
                </Text>
              </View>

              {/* Priority 0: Auto-Accepted Pending Acknowledgements */}
              {(() => {
                const pendingAcks = bookings.filter(b =>
                  b.timelineStatus === 'trainer_accepted' && 
                  b.trainerAcknowledgement === 'pending' &&
                  (b.trainerId === user.id || b.trainerName === user.name || (currentCoach && b.trainerId === currentCoach.id))
                );
                if (pendingAcks.length === 0) return null;
                return (
                  <View className="gap-3 mb-6">
                    <View className="flex-row justify-between items-center pr-1">
                      <Text className="text-amber-600 text-xs font-bold uppercase tracking-wider pl-1">
                        Auto-Accepted Requests • {pendingAcks.length}
                      </Text>
                    </View>
                    {pendingAcks.map(req => (
                      <AcknowledgementCard
                        key={req.id}
                        booking={req}
                        onAcknowledge={handleAcknowledgeRequest}
                        onPress={(id) => navigateSafely({ pathname: '/session-detail', params: { id } })}
                      />
                    ))}
                  </View>
                );
              })()}

              {/* Priority 1: New Requests */}
              {(() => {
                const requests = bookings.filter(b =>
                  b.timelineStatus === 'booked' && 
                  (b.trainerId === user.id || b.trainerName === user.name || (currentCoach && b.trainerId === currentCoach.id))
                );
                if (requests.length === 0) return null;
                return (
                  <View className="gap-3 mb-6">
                    <View className="flex-row justify-between items-center pr-1">
                      <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider pl-1">
                        New Session Requests • {requests.length}
                      </Text>
                      <Pressable 
                        onPress={handleManualRefresh}
                        disabled={isRefreshing}
                        className="bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-150 flex-row items-center gap-1.5"
                      >
                        <Feather name="refresh-cw" size={10} color="#4F46E5" />
                        <Text className="text-[#4F46E5] text-xs font-semibold uppercase">
                          {isRefreshing ? 'Syncing...' : 'Sync'}
                        </Text>
                      </Pressable>
                    </View>
                    {requests.map(req => (
                      <RequestCard
                        key={req.id}
                        booking={req}
                        onAccept={handleAcceptRequest}
                        onDecline={handleDeclineRequest}
                        onTimeout={handleTimeoutRequest}
                        onPress={(id) => navigateSafely({ pathname: '/session-detail', params: { id } })}
                      />
                    ))}
                  </View>
                );
              })()}

              {/* Priority 2: Current Active Session */}
              {activeSession ? (
                <View className="mb-6">
                  <Text className="text-rose-500 text-xs font-bold uppercase tracking-wider pl-1 mb-2.5">
                    Current Session
                  </Text>
                  <View
                    className="bg-white border-2 border-rose-500/30 p-5 rounded-[28px] gap-4"
                    style={{
                      backgroundColor: '#FFFFFF',
                      ...softShadow({ color: '#F43F5E', opacity: 0.05, radius: 12, offsetY: 6 }),
                    }}
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="bg-rose-50 border border-rose-100 px-3 py-1 rounded-full flex-row items-center gap-1.5">
                        <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <Text className="text-rose-600 text-[11px] font-semibold tracking-wide uppercase">
                          {(() => {
                            const range = getBookingISTDateRange(activeSession);
                            const now = getCurrentServerTime();
                            if (now < range.start) {
                              if (activeSession.timelineStatus === 'trainer_travelling') return 'Trainer En Route';
                              if (activeSession.timelineStatus === 'trainer_arrived') return 'Trainer Arrived';
                              return 'Ready';
                            }
                            if (now >= range.start && now < range.end) {
                              return 'Session In Progress';
                            }
                            return 'Session Ended';
                          })()}
                        </Text>
                      </View>
                      <Text className="text-zinc-500 text-xs font-semibold">
                        {activeSession.time}
                      </Text>
                    </View>

                    <View className="gap-1.5">
                      {(activeSession.isFavouriteTrainer || activeSession?.ratingDetails?.isFavouriteTrainer) && (
                        <View className="flex-row items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-xl self-start mb-1">
                          <Ionicons name="star" size={13} color="#D97706" />
                          <Text className="text-amber-700 text-[11px] font-bold">
                            You are booked as a favourite trainer
                          </Text>
                        </View>
                      )}
                      <Text className="text-zinc-500 text-xs font-semibold uppercase">Workout: {getDisplayWorkoutTitle(activeSession.workoutTitle)}</Text>
                      <Text className="text-[#101828] text-base font-bold tracking-tight mt-0.5">
                        Client: {activeSession.clientName || 'Viral'}
                      </Text>
                      <Text className="text-zinc-650 text-xs font-medium leading-relaxed mt-1">
                        📍 {activeSession.address ? activeSession.address.split(',')[0] : 'Home Session'}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => navigateSafely({ pathname: '/session-detail', params: { id: activeSession.id } })}
                      className="w-full bg-rose-500 py-3.5 rounded-2xl items-center justify-center flex-row gap-2"
                      style={{
                        backgroundColor: '#F43F5E',
                        ...softShadow({ color: '#E11D48', opacity: 0.15, radius: 8, offsetY: 4 }),
                      }}
                    >
                      <Text className="text-white text-xs font-bold uppercase tracking-wider">Open Session →</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* Priority 3: Next Session */}
              <View className="mb-6">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider pl-1 mb-2.5">
                  Next Session
                </Text>
                {nextSession ? (() => {
                  const start = getBookingISTDateRange(nextSession).start;
                  const isTomorrow = getISTDateInfo(start).dateString === tomorrowDateStr;
                  const isToday = getISTDateInfo(start).dateString === todayIstStr;

                  return (
                    <View
                      className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-800 gap-4"
                      style={{
                        backgroundColor: '#09090b',
                        ...softShadow({ color: '#000000', opacity: 0.3, radius: 24, offsetY: 12 }),
                      }}
                    >
                      <View className="flex-row justify-between items-center">
                        <Text className="text-white text-sm font-bold uppercase tracking-wide">
                          {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : formatToDDMMYYYY(nextSession.date)} • {nextSessionTime}
                        </Text>
                        {isToday && countdownText ? (
                          <View className="bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-0.5 rounded-full">
                            <Text className="text-indigo-400 text-[10px] font-semibold uppercase tracking-wider">
                              {countdownText}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View className="gap-1">
                        {(nextSession.isFavouriteTrainer || nextSession?.ratingDetails?.isFavouriteTrainer) && (
                          <View className="flex-row items-center gap-1.5 bg-amber-500/15 border border-amber-500/35 px-2.5 py-1.5 rounded-xl self-start mb-1">
                            <Ionicons name="star" size={13} color="#FBBF24" />
                            <Text className="text-amber-300 text-[11px] font-bold">
                              You are booked as a favourite trainer
                            </Text>
                          </View>
                        )}
                        <Text className="text-zinc-400 text-[11px] font-semibold uppercase">Workout: {getDisplayWorkoutTitle(nextSession.workoutTitle)}</Text>
                        <Text numberOfLines={1} className="text-white text-base font-semibold mt-1 leading-tight">
                          Client: {nextSession.clientName || 'Viral'}
                        </Text>
                        <Text numberOfLines={1} className="text-zinc-300 text-xs font-normal mt-1">
                          📍 Venue: {nextSession.address ? nextSession.address.split(',')[0] : 'Home Session'}
                        </Text>
                        <Text numberOfLines={1} className="text-zinc-400 text-xs font-normal mt-0.5">
                          ⏱ {nextSession.time} ({nextSession.durationMinutes || 60} mins)
                        </Text>
                      </View>

                      {nextSession.timelineStatus !== 'workout_started' && (
                        <View className="flex-row gap-2 flex-wrap">
                          <Pressable
                            onPress={() => {
                              if (SessionEngine.isTravelWindowOpen(nextSession)) {
                                navigateSafely({ pathname: '/session-detail', params: { id: nextSession.id, openMap: 'true' } });
                              } else {
                                setNativeAlertState({
                                  visible: true,
                                  title: 'Travel Window Locked ⚠️',
                                  message: 'You can start travel and view the navigation map 30 minutes before the scheduled session.',
                                  confirmText: 'OK',
                                  onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
                                });
                              }
                            }}
                            className="flex-1 min-w-[80px] bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 px-2"
                          >
                            <Feather name="navigation" size={12} color="white" />
                            <Text numberOfLines={1} className="text-white text-[11px] font-semibold uppercase">Navigate</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => {
                              if (getMinutesToSession(nextSession) <= 60) {
                                setNativeAlertState({
                                  visible: true,
                                  title: 'Secure Call',
                                  message: 'Connecting call to customer using masked calling...',
                                  confirmText: 'OK',
                                  onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
                                });
                              } else {
                                setNativeAlertState({
                                  visible: true,
                                  title: 'Call Locked',
                                  message: 'Calling will be available 60 minutes before the session.',
                                  confirmText: 'OK',
                                  onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
                                });
                              }
                            }}
                            className="flex-1 min-w-[80px] bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 px-2"
                          >
                            <Feather name="phone" size={12} color="white" />
                            <Text numberOfLines={1} className="text-white text-[11px] font-semibold uppercase">Call Client</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => navigateSafely({ pathname: '/communication', params: { id: nextSession.id } })}
                            className="flex-1 min-w-[80px] bg-zinc-900 border border-zinc-800 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 px-2"
                          >
                            <Feather name="message-square" size={12} color="white" />
                            <Text numberOfLines={1} className="text-white text-[11px] font-semibold uppercase">Message</Text>
                          </Pressable>
                        </View>
                      )}

                      <NativeDivider color="#27272A" />

                      {nextSession.timelineStatus === 'trainer_accepted' ? (
                        <View className="gap-2 w-full">
                          <View className="bg-zinc-800/80 px-3 py-2 rounded-xl flex-row items-center gap-2 border border-zinc-700/60">
                            <Feather name="navigation" size={12} color="#818CF8" />
                            <Text className="text-zinc-300 text-[10.5px] font-medium flex-1 leading-tight">
                              App uses background location permission to track your live location until you reach the client venue.
                            </Text>
                          </View>
                          {SessionEngine.isTravelWindowOpen(nextSession) ? (
                            <Pressable
                              onPress={async () => {
                                try {
                                  const started = await locationTrackerService.startTracking(nextSession.id, true);
                                  if (!started) {
                                    // User dismissed or denied location permission disclosure
                                    return;
                                  }
                                  await updateTimelineStatus(nextSession.id, 'trainer_travelling');
                                  useNotificationStore.getState().addNotification({
                                    title: 'Coach On The Way 🚗',
                                    body: 'Coach has started travelling to your venue.',
                                    icon: 'user-check'
                                  });
                                  router.push({ pathname: '/session-detail', params: { id: nextSession.id, openMap: 'true' } });
                                } catch (err) {
                                  setNativeAlertState({
                                    visible: true,
                                    title: 'Location Permission',
                                    message: errorMessage(err) || 'Please grant location permissions to start travel.',
                                    confirmText: 'OK',
                                    onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
                                  });
                                }
                              }}
                              className="w-full bg-indigo-600 py-3.5 rounded-xl items-center justify-center"
                            >
                              <Text className="text-white text-xs font-bold uppercase tracking-wider">Start Travel</Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              onPress={() => {
                                setNativeAlertState({
                                  visible: true,
                                  title: 'Travel Window Locked ⚠️',
                                  message: 'You can start travel 30 minutes before the scheduled session.',
                                  confirmText: 'OK',
                                  onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
                                });
                              }}
                              className="w-full bg-zinc-800/70 border border-zinc-700/50 py-3.5 rounded-xl items-center justify-center"
                            >
                              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Start Travel (Unlocks 30m prior)</Text>
                            </Pressable>
                          )}
                        </View>
                      ) : nextSession.timelineStatus === 'trainer_travelling' ? (
                        <Pressable
                          onPress={async () => {
                            try {
                              await updateTimelineStatus(nextSession.id, 'trainer_arrived');
                              await locationTrackerService.stopTracking();
                              useNotificationStore.getState().addNotification({
                                title: 'Coach Arrived 🔔',
                                body: 'Coach has arrived at your location.',
                                icon: 'lock'
                              });
                            } catch (err) {
                              setNativeAlertState({
                                visible: true,
                                title: 'Error',
                                message: errorMessage(err) || 'Could not update status.',
                                confirmText: 'OK',
                                onConfirm: () => setNativeAlertState(prev => ({ ...prev, visible: false })),
                              });
                            }
                          }}
                          className="w-full bg-emerald-600 py-3.5 rounded-xl items-center justify-center"
                        >
                          <Text className="text-white text-xs font-bold uppercase tracking-wider">Reached Location</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => navigateSafely({ pathname: '/session-detail', params: { id: nextSession.id } })}
                          className="w-full bg-zinc-800 py-3.5 rounded-xl items-center justify-center"
                        >
                          <Text className="text-white text-xs font-bold uppercase tracking-wider">
                            {nextSession.timelineStatus === 'trainer_arrived' ? 'Waiting client OTP check-in' : 'Open active console'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })() : (
                  <View 
                    className="bg-white p-6 rounded-[28px] gap-2 items-center justify-center text-center"
                    style={{
                      backgroundColor: '#FFFFFF',
                      ...softShadow({ color: '#101828', opacity: 0.02, radius: 8, offsetY: 4 }),
                    }}
                  >
                    <Text className="text-3xl mt-1">👌</Text>
                    <Text className="text-zinc-900 text-base font-bold mt-1">You&apos;re all clear</Text>
                    <Text className="text-zinc-500 text-xs font-normal text-center mt-0.5 leading-relaxed max-w-[280px]">
                      No upcoming bookings scheduled. Manage availability to get bookings.
                    </Text>
                  </View>
                )}
              </View>

              {/* Priority 4: Today's Sessions */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-2.5 pl-1 pr-1">
                  <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    Today&apos;s Sessions
                  </Text>
                  {todaySessionsCount > 0 ? (
                    <Text className="text-zinc-500 text-[11px] font-semibold uppercase">
                      {todaySessionsCount} {todaySessionsCount === 1 ? 'Session' : 'Sessions'} • {formattedTodayHours} hrs
                    </Text>
                  ) : null}
                </View>

                {todayDisplayBookings.length > 0 ? (
                  <View className="gap-3">
                    {todayDisplayBookings.map((booking) => {
                      const isCancelledByUser = booking.status === 'cancelled';
                      return (
                      <Pressable 
                        key={booking.id} 
                        disabled={isCancelledByUser}
                        onPress={isCancelledByUser ? undefined : () => navigateSafely({ pathname: '/session-detail', params: { id: booking.id } })}
                        className={`bg-white border border-[#E5E7EB] p-4 rounded-2xl flex-row justify-between items-center ${isCancelledByUser ? 'opacity-70' : ''}`}
                        style={{
                          backgroundColor: '#FFFFFF',
                          ...softShadow({ color: '#101828', opacity: 0.02, radius: 6, offsetY: 3 }),
                        }}
                      >
                        <View className="flex-row items-center gap-3 flex-1">
                          <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center">
                            <Feather name="clock" size={14} color="#4F46E5" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-zinc-900 text-sm font-semibold">{getDisplayWorkoutTitle(booking.workoutTitle)}</Text>
                            <Text className="text-zinc-500 text-[11px] font-medium mt-0.5">
                              {booking.time} • Client: {booking.clientName || 'Viral'}
                            </Text>
                            {isCancelledByUser && (
                              <Text className="text-rose-600 text-[11px] font-semibold mt-0.5">
                                This session is cancelled by user.
                              </Text>
                            )}
                          </View>
                        </View>
                        <View className={`px-2.5 py-1 rounded-full ${
                          booking.timelineStatus === 'workout_completed' || booking.status === 'completed'
                            ? 'bg-emerald-50 border border-emerald-150'
                            : booking.status === 'cancelled'
                            ? 'bg-rose-50 border border-rose-150'
                            : 'bg-indigo-50 border border-indigo-150'
                        }`}>
                          <Text className={`text-[10px] font-semibold tracking-wide uppercase ${
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
                      </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View className="bg-white p-6 rounded-[28px] items-center justify-center">
                    <Text className="text-zinc-400 text-xs font-semibold text-center">
                      No sessions today
                    </Text>
                  </View>
                )}
              </View>

              {/* Priority 5: Tomorrow */}
              <View className="mb-6">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider pl-1 mb-2.5">
                  Tomorrow&apos;s Schedule
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
                        <Text className="text-zinc-950 text-sm font-bold">Schedule is Disabled</Text>
                        <Text className="text-zinc-500 text-xs font-normal mt-0.5">
                          You have no slots available for tomorrow.
                        </Text>
                      </View>
                    </View>
                    
                    <Pressable
                      onPress={() => navigateSafely('/bookings')}
                      className="bg-indigo-600 p-3 rounded-2xl items-center justify-center flex-row gap-1.5"
                    >
                      <Feather name="calendar" size={14} color="white" />
                      <Text className="text-white text-xs font-semibold uppercase tracking-wider">Manage availability →</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View 
                    className="bg-white p-5 rounded-[28px] gap-3.5"
                    style={{
                      backgroundColor: '#FFFFFF',
                      ...softShadow({ color: '#101828', opacity: 0.02, radius: 8, offsetY: 4 }),
                    }}
                  >
                    {tomorrowBookings.length > 0 ? (
                      <View className="gap-3">
                        <View className="flex-row justify-between items-center">
                          <Text className="text-zinc-900 text-xs font-bold uppercase">
                            {tomorrowBookings.length} {tomorrowBookings.length === 1 ? 'Session' : 'Sessions'} Scheduled
                          </Text>
                          <Pressable onPress={() => navigateSafely('/bookings')}>
                            <Text className="text-indigo-600 text-xs font-bold uppercase tracking-wider">View All →</Text>
                          </Pressable>
                        </View>
                        
                        <View className="gap-2 mt-1">
                          {tomorrowBookings.map((b) => (
                            <View key={b.id} className="flex-row justify-between items-center py-2 border-b border-zinc-50 last:border-b-0">
                              <View>
                                <Text className="text-zinc-900 text-sm font-semibold">{getDisplayWorkoutTitle(b.workoutTitle)}</Text>
                                <Text className="text-zinc-500 text-[11px] font-medium mt-0.5">{b.time} • {b.clientName || 'Client'}</Text>
                              </View>
                              <Feather name="chevron-right" size={14} color="#9CA3AF" />
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
                            <Text className="text-zinc-950 text-sm font-bold">No sessions booked</Text>
                            <Text className="text-zinc-500 text-xs font-normal mt-0.5">
                              Your schedule is available for bookings.
                            </Text>
                          </View>
                        </View>
                        
                        <Pressable
                          onPress={() => navigateSafely('/bookings')}
                          className="bg-zinc-950 py-2.5 px-4 rounded-xl"
                        >
                          <Text className="text-white text-xs font-semibold tracking-wide">
                            Manage →
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </>
          )}

        </ReanimatedAnimated.View>
      </ReanimatedAnimated.ScrollView>
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
      <CommunicationCenterModal
        visible={communicationModalVisible}
        onClose={() => setCommunicationModalVisible(false)}
        unreadCount={unreadCount}
        onSelectNotifications={() => {
          setCommunicationModalVisible(false);
          navigateSafely('/notifications');
        }}
        onSelectMessages={() => {
          setCommunicationModalVisible(false);
          navigateSafely('/(tabs)/messages');
        }}
      />
      <TrainerStatusModal
        visible={trainerStatusModalVisible}
        targetStatus={pendingStatusTarget}
        onClose={() => setTrainerStatusModalVisible(false)}
        onConfirm={handleConfirmTrainerStatus}
      />
      <LogMetricsModal
        visible={logMetricsModalVisible}
        type={logMetricsType}
        onClose={() => setLogMetricsModalVisible(false)}
        onSelect={(amount) => {
          if (logMetricsType === 'hydration') {
            logWaterAmount(amount);
          } else {
            logCaloriesAmount(amount);
          }
        }}
      />

      {/* Native Alert Dialog for Trainer Mode */}
      <NativeAlertDialog
        visible={nativeAlertState.visible}
        title={nativeAlertState.title}
        message={nativeAlertState.message}
        confirmText={nativeAlertState.confirmText || 'OK'}
        cancelText={nativeAlertState.cancelText}
        onConfirm={nativeAlertState.onConfirm}
        onDismiss={() => setNativeAlertState(prev => ({ ...prev, visible: false }))}
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
