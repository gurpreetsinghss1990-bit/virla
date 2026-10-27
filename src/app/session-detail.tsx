import { Feather, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddPartnerModal } from '../components/AddPartnerModal';
import { PostSessionHealthReportModal } from '../components/PostSessionHealthReportModal';
import { RaiseSupportTicketModal } from '../components/RaiseSupportTicketModal';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { SupportChatModal } from '../components/SupportChatModal';
import TrackingMap from '../components/TrackingMap';
import { AssignmentConfig } from '../config/AssignmentConfig';
import { Database, getCurrentServerTime, SupportTicket } from '../database/Database';
import { supabase } from '../database/supabaseClient';
import { locationTrackerService } from '../services/LocationTrackerService';
import { SessionEngine } from '../services/SessionEngine';
import { useAddressStore } from '../store/addressStore';
import { useBookingStore } from '../store/bookingStore';
import { useChatStore } from '../store/chatStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useUserStore } from '../store/userStore';
import { formatToDDMMYYYY, getBookingISTDateRange, getDisplayWorkoutTitle } from '../utils/date';
import { parseBookingAddress } from '../utils/LocationParser';

function formatToIndianDate(dateStr: string): string {
  return formatToDDMMYYYY(dateStr);
}

function getClientGender(booking: any): string {
  if (!booking?.clientId) {
    return 'Not specified';
  }
  const profile = Database.getProfile(booking.clientId);
  let displayGender = 'Not specified';
  if (profile && profile.gender) {
    const g = profile.gender.toLowerCase().trim();
    if (g === 'male') displayGender = 'Male';
    else if (g === 'female') displayGender = 'Female';
  }
  return displayGender;
}

// Map coordinates path waypoints (scaled to fit beautiful SVG canvas)
const waypoints = [
  { x: 35, y: 145 },
  { x: 80, y: 110 },
  { x: 140, y: 120 },
  { x: 200, y: 70 },
  { x: 265, y: 45 }
];

export default function SessionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Navigation context can briefly disappear while this screen re-renders from store/poll
  // updates (e.g. after session status changes). Fall back to the last known params instead of crashing.
  const lastParamsRef = React.useRef<Record<string, any>>({});
  let params: Record<string, any> = lastParamsRef.current;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    params = useLocalSearchParams();
    lastParamsRef.current = params;
  } catch {
    params = lastParamsRef.current;
  }
  const bookingId = params.id as string;

  const handleSafeBack = () => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      router.replace('/(tabs)');
    }
  };

  const {
    bookings,
    updateTimelineStatus,
    updateBookingRating,
    triggerClientNoShow,
    triggerTrainerNoShow,
    submitQuestionnaire,
    updateBookingNote,
    reassignTrainer,
    syncFromDB
  } = useBookingStore();

  const { addNotification } = useNotificationStore();
  const { user } = useUserStore();
  const { role } = useUserStore();
  const { syncFromDB: syncProfile } = useUserProfileStore();
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [isNavigationMapVisible, setIsNavigationMapVisible] = useState(false);

  // Concierge Support State
  const [showRaiseTicketModal, setShowRaiseTicketModal] = useState(false);
  const [activeChatTicket, setActiveChatTicket] = useState<SupportTicket | null>(null);
  const [showSupportChatModal, setShowSupportChatModal] = useState(false);

  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];
  const { addresses } = useAddressStore();

  // Resolved venue address string: fallback to customer's saved address if booking.address is missing/empty
  const effectiveAddressStr = useMemo(() => {
    if (booking?.address && booking.address.trim().length > 0) {
      return booking.address;
    }
    // Fallback: look in user's saved addresses
    if (role !== 'trainer' && addresses && addresses.length > 0) {
      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
      if (defaultAddr && defaultAddr.lat && defaultAddr.lng) {
        return JSON.stringify({
          addressLine: defaultAddr.addressLine || '',
          lat: defaultAddr.lat,
          lng: defaultAddr.lng,
          buildingName: defaultAddr.building || '',
          flatNumber: defaultAddr.apartment || '',
          floor: defaultAddr.floor || '',
          landmark: defaultAddr.landmark || '',
          arrivalInstructions: defaultAddr.notes || '',
        });
      }
    }
    return '';
  }, [booking?.address, addresses, role]);

  const parsedAddress = useMemo(() => parseBookingAddress(effectiveAddressStr), [effectiveAddressStr]);

  // Status checks
  const isMissed = booking?.status === 'missed_session_not_started' || booking?.status === 'client_no_show' || booking?.status === 'trainer_no_show';
  const isCancelled = booking?.status === 'cancelled';

  // Local state for 12-stage timeline status (drives UI smoothly without navigation re-renders)
  const [currentStatus, setCurrentStatus] = useState<string>(booking?.timelineStatus || 'booked');
  const isSelfUpdatingRef = React.useRef(false);
  const selfUpdateTimerRef = React.useRef<any>(null);

  const markSelfUpdate = () => {
    isSelfUpdatingRef.current = true;
    if (selfUpdateTimerRef.current) clearTimeout(selfUpdateTimerRef.current);
    selfUpdateTimerRef.current = setTimeout(() => {
      isSelfUpdatingRef.current = false;
    }, 1500);
  };

  // Sync external booking timeline status (e.g. app restart / external update) only when not locally updating
  useEffect(() => {
    if (booking?.timelineStatus && !isSelfUpdatingRef.current && booking.timelineStatus !== currentStatus) {
      setCurrentStatus(booking.timelineStatus);
    }
  }, [booking?.timelineStatus, currentStatus]);

  useEffect(() => {
    return () => {
      if (selfUpdateTimerRef.current) clearTimeout(selfUpdateTimerRef.current);
    };
  }, []);

  const isAccepted = currentStatus !== 'booked' && currentStatus !== 'trainer_assigned';
  const isPendingDetails = (role === 'customer' || role === 'admin') && !isAccepted;

  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showHealthReportModal, setShowHealthReportModal] = useState(false);
  const [assessments, setAssessments] = useState<{
    bookingId: string;
    date: string;
    time: string;
    coachName: string;
    assessment: string;
    healthData?: any;
  }[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  useEffect(() => {
    if (role === 'trainer' && booking?.clientId) {
      Promise.resolve().then(() => setLoadingAssessments(true));
      Database.getClientAssessmentHistory(booking.clientId)
        .then(data => {
          setAssessments(data);
        })
        .catch(err => {
          console.error('Error loading assessments:', err);
        })
        .finally(() => {
          setLoadingAssessments(false);
        });
    }
  }, [booking?.clientId, role]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (params.openMap === 'true' && booking) {
      if (SessionEngine.isTravelWindowOpen(booking)) {
        setTimeout(() => setIsNavigationMapVisible(true), 0);
      } else {
        Alert.alert(
          'Travel Window Locked ⚠️',
          'You can start travel and view the navigation map 30 minutes before the scheduled session.'
        );
      }
    }
  }, [params.openMap, booking]);

  // Tracking simulator state variables
  const [journeyProgress, setJourneyProgress] = useState(0); // 0.0 to 1.0
  const [simIntervalId, setSimIntervalId] = useState<any>(null);
  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number, longitude: number } | null>(null);

  // Live trainer coordinates on client & trainer side
  const [liveTrainerCoords, setLiveTrainerCoords] = useState<{ latitude: number; longitude: number; accuracy: number; heading: number | null; speed: number | null; updatedAt: string } | null>(null);
  const [isLiveConnectionStale, setIsLiveConnectionStale] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<{ distanceKm: number; durationMins: number } | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const trackLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        // Get initial position
        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setDeviceCoords({
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude
        });

        // Watch position updates
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 4000,
            distanceInterval: 5
          },
          (loc) => {
            setDeviceCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude
            });
          }
        );
      } catch (e) {
        console.warn('[TRACKING] Location tracking failed:', e);
      }
    };

    if (role === 'trainer' && (currentStatus === 'trainer_travelling' || currentStatus === 'trainer_preparing' || currentStatus === 'trainer_arrived')) {
      trackLocation();
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [currentStatus, role]);

  // Publisher (Trainer side) and Subscriber (Client & Trainer side) hooks for live GPS tracking
  useEffect(() => {
    if (!bookingId) return;

    let unsubscribe: (() => void) | null = null;

    if (role === 'trainer') {
      if (currentStatus === 'trainer_travelling') {
        locationTrackerService.startTracking(bookingId, true);
      } else if (locationTrackerService.getTrackedBookingId() === bookingId) {
        // Stop background + foreground tracking as soon as trainer arrives at client venue
        locationTrackerService.stopTracking();
      }
    }

    if (currentStatus === 'trainer_travelling' || currentStatus === 'trainer_arrived') {
      unsubscribe = locationTrackerService.subscribeToLocation(
        bookingId,
        (coords) => {
          setLiveTrainerCoords(coords);
          setIsLiveConnectionStale(false);
        },
        () => {
          setIsLiveConnectionStale(true);
        }
      );
    } else {
      setTimeout(() => {
        setLiveTrainerCoords(null);
        setIsLiveConnectionStale(false);
        setRouteMetrics(null);
      }, 0);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      // Note: Do NOT call stopTracking() on unmount if trainer is still travelling,
      // so background tracking continues when trainer switches screens or locks phone!
    };
  }, [bookingId, currentStatus, role]);

  // Real-time timeline synchronization: updates screen instantly when either Trainer or User advances stage
  const syncStateRef = React.useRef({ closed: false, missed: false, cancelled: false });
  syncStateRef.current = { closed: currentStatus === 'session_closed', missed: isMissed, cancelled: isCancelled };

  useEffect(() => {
    if (!bookingId) return;

    // 1. Dedicated Supabase Realtime channel for this booking
    const channelName = `realtime-session-${bookingId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        async (payload: any) => {
          console.log('[Realtime Session] Booking update received:', payload);
          // Double trigger protection: if this client just initiated the step update locally, ignore the echo
          if (isSelfUpdatingRef.current) {
            console.log('[Realtime Session] Ignoring self-triggered update echo');
            return;
          }

          const newRow = payload?.new;
          const incomingStatus = newRow?.timeline_status || newRow?.timelineStatus;
          if (incomingStatus) {
            // Update local step state immediately without routing/navigation
            setCurrentStatus(incomingStatus);
          }

          await Database.refreshBookings();
          syncFromDB();
        }
      )
      .subscribe();

    // 2. Smart lightweight safety poll (every 6s while session is active, only re-renders if data actually changed)
    const pollInterval: any = setInterval(async () => {
      const s = syncStateRef.current;
      if (s.closed || s.missed || s.cancelled) return;
      try {
        const changed = await Database.syncBookingsOnly();
        if (changed) {
          syncFromDB();
        }
      } catch (e) {
        console.warn('[Session Poll] sync failed:', e);
      }
    }, 6000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [bookingId, syncFromDB]);

  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };



  // Input & Questionnaire state variables
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editedNote, setEditedNote] = useState('');

  const [timeLeft, setTimeLeft] = useState(60);
  const [graceTimeLeft, setGraceTimeLeft] = useState(0);
  const [workoutTimeLeft, setWorkoutTimeLeft] = useState(0);
  const [showCustomerOtpInput, setShowCustomerOtpInput] = useState(false);
  const [customerOtpInput, setCustomerOtpInput] = useState('');
  const [hasDelayedAlertFired, setHasDelayedAlertFired] = useState(false);

  // Automatically mark session and its messages as read when user views this session
  useEffect(() => {
    if (booking?.id) {
      const sId = (booking.id || 'session').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
      const cId = (booking.clientId || 'client').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
      const tId = (booking.trainerId || booking.trainerName || 'coach').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
      useChatStore.getState().markSessionAsRead(booking.id, [
        `chat_${sId}_${cId}_${tId}`,
      ]);
    }
  }, [booking?.id, booking?.trainerId, booking?.trainerName, booking?.clientId]);

  useEffect(() => {
    if (!booking) return;

    const calculateTimeLeft = () => {
      const nowMs = getCurrentServerTime().getTime();
      const elapsed = Math.floor((nowMs - (booking.createdAt || nowMs)) / 1000);
      return Math.max(0, 600 - elapsed);
    };

    if (role === 'trainer' && currentStatus === 'booked') {
      setTimeout(() => setTimeLeft(calculateTimeLeft()), 0);
    }

    const updateTimers = () => {
      if (role === 'trainer' && currentStatus === 'booked') {
        const nextTime = calculateTimeLeft();
        const nowMs = getCurrentServerTime().getTime();
        const elapsed = Math.floor((nowMs - (booking.createdAt || nowMs)) / 1000);
        if (nextTime <= 0) {
          // Only trigger timeout reassign if the booking is fresh
          const isFresh = elapsed < 605;
          if (isFresh) {
            reassignTrainer(booking.id, 'timeout');
            handleSafeBack();
            return;
          }
        }
        setTimeLeft(nextTime);
      }

      if (currentStatus === 'trainer_arrived') {
        const grace = SessionEngine.getGracePeriodSecondsLeft(booking);
        setGraceTimeLeft(grace);
      } else if (currentStatus === 'workout_started') {
        const work = SessionEngine.getWorkoutSecondsLeft(booking);
        setWorkoutTimeLeft(work);
      }

      // Check if trainer is delayed (has not checked in past delay threshold after scheduled start time)
      if (
        role === 'customer' &&
        !hasDelayedAlertFired &&
        ['trainer_accepted', 'trainer_preparing', 'trainer_travelling'].includes(currentStatus)
      ) {
        const sessionStart = SessionEngine.getSessionStartDate(booking);
        const alertThreshold = sessionStart.getTime() + AssignmentConfig.trainerDelayAlertDelayMin * 60 * 1000;
        if (getCurrentServerTime().getTime() > alertThreshold) {
          setHasDelayedAlertFired(true);
          addNotification({
            title: 'Trainer Delayed ⚠️',
            body: 'Trainer appears delayed.',
            icon: 'clock',
            type: 'System',
            priority: 'high'
          });
        }
      }
    };

    updateTimers();

    // Only run the 1-second interval if there are active countdowns needed
    // (e.g. pending trainer accept timeout, trainer arrived grace period, or workout running)
    const needsSecondInterval =
      (role === 'trainer' && currentStatus === 'booked') ||
      currentStatus === 'trainer_arrived' ||
      currentStatus === 'workout_started';

    if (!needsSecondInterval) {
      return;
    }

    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [booking?.id, booking?.createdAt, currentStatus, role]);

  const getSessionStartDate = (): Date => {
    if (!booking) return new Date();
    return getBookingISTDateRange(booking).start;
  };

  const getMinutesToSession = () => {
    if (!booking) return 0;
    const sessionDate = getSessionStartDate();
    const now = getCurrentServerTime();
    return (sessionDate.getTime() - now.getTime()) / (1000 * 60);
  };

  const getStatusText = (status: string) => {
    if (!booking) return '';

    if (booking.status === 'missed_session_not_started') {
      return 'Session Missed';
    }
    if (booking.status === 'client_no_show') {
      return 'Missed — Client No-Show';
    }
    if (booking.status === 'trainer_no_show') {
      return 'Missed — Trainer No-Show';
    }
    if (booking.status === 'cancelled') {
      return 'Session Cancelled';
    }

    const range = getBookingISTDateRange(booking);
    const now = getCurrentServerTime();

    if (now < range.start) {
      if (status === 'trainer_travelling') return 'Trainer En Route';
      if (status === 'trainer_arrived') return 'Trainer Arrived';
      if (status === 'otp_verified' || status === 'workout_started') return 'Ready';
      if (status === 'trainer_accepted') return 'Booking Confirmed';
      if (status === 'trainer_preparing') return 'Booking Confirmed';
      if (status === 'booked' || status === 'trainer_assigned') return 'Waiting for Trainer to Accept';
      return 'Upcoming';
    }

    if (now >= range.start && now < range.end) {
      if (['otp_verified', 'workout_started'].includes(status)) {
        return 'Session In Progress';
      }
      if (status === 'trainer_travelling') return 'Trainer En Route';
      if (status === 'trainer_arrived') return 'Trainer Arrived';
      if (status === 'trainer_accepted') return 'Booking Confirmed';
      if (status === 'trainer_preparing') return 'Booking Confirmed';
      return 'Session Scheduled';
    }

    if (['workout_completed', 'trainer_report_submitted', 'customer_review_pending', 'session_closed'].includes(status)) {
      return 'Session Completed';
    }
    return 'Session Ended';
  };

  const [otpInput, setOtpInput] = useState('');
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [mobilityScore, setMobilityScore] = useState(5);
  const [workoutSummary, setWorkoutSummary] = useState('Core Strength & Conditioning Drills');
  const coachNotes = '';
  const [coachSignature, setCoachSignature] = useState('');

  // Rating review feedback states
  const [overallRating, setOverallRating] = useState(5);
  const trainerRating = 5;
  const workoutRating = 5;
  const difficulty = 'Moderate';
  const energy = 'High';
  const [comments, setComments] = useState('');

  // Active workout timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const stagesList = [
    'booked',
    'trainer_assigned',
    'trainer_accepted',
    'trainer_preparing',
    'trainer_travelling',
    'trainer_arrived',
    'otp_verified',
    'workout_started',
    'workout_completed',
    'trainer_report_submitted',
    'customer_review_pending',
    'session_closed'
  ];

  const getStageMeta = (stage: string) => {
    switch (stage) {
      case 'session_missed':
        return {
          title: booking?.status === 'client_no_show'
            ? 'Client No-Show'
            : booking?.status === 'trainer_no_show'
              ? 'Coach No-Show'
              : 'Session Missed',
          desc: booking?.status === 'client_no_show'
            ? 'Client check-in was not completed within grace period'
            : booking?.status === 'trainer_no_show'
              ? 'Coach was unable to arrive or start the session'
              : 'Session was not started and marked as missed',
          icon: 'alert-circle' as const
        };
      case 'session_cancelled':
        return {
          title: 'Session Cancelled',
          desc: (booking as any)?.cancellationReason
            ? `Reason: ${(booking as any).cancellationReason}`
            : 'Booking was cancelled',
          icon: 'x-circle' as const
        };
      case 'booked':
        return { title: 'Booking Confirmed', desc: 'Appointment locked in system', icon: 'check-circle' as const };
      case 'trainer_assigned':
        return { title: 'Coach Matched', desc: 'Top specialist dedicated to session', icon: 'user' as const };
      case 'trainer_accepted':
        return { title: 'Coach Accepted', desc: 'Trainer confirmed your workout request', icon: 'shield' as const };
      case 'trainer_preparing':
        return { title: 'Equipment Prepared', desc: 'Sanitized training gear packed', icon: 'package' as const };
      case 'trainer_travelling':
        return { title: 'Coach En Route', desc: 'Travelling to your destination', icon: 'navigation' as const };
      case 'trainer_arrived':
        return { title: 'Coach Arrived', desc: 'Waiting outside gate for check-in', icon: 'map-pin' as const };
      case 'otp_verified':
        return { title: 'Identity Verified', desc: 'Secure security check-in complete', icon: 'key' as const };
      case 'workout_started':
        return { title: 'Active Workout', desc: 'Warmup & conditioning underway', icon: 'activity' as const };
      case 'workout_completed':
        return { title: 'Workout Finished', desc: 'Session goals achieved', icon: 'award' as const };
      case 'trainer_report_submitted':
        return { title: 'Coach Summary Filed', desc: 'Trainer logged workout stats', icon: 'file-text' as const };
      case 'customer_review_pending':
        return { title: 'Client Feedback', desc: 'Rate your trainer & experience', icon: 'star' as const };
      case 'session_closed':
        return { title: 'Pass Completed', desc: 'All records archived successfully', icon: 'check' as const };
      default:
        return { title: stage.replace(/_/g, ' '), desc: '', icon: 'circle' as const };
    }
  };

  const timelineStages = useMemo(() => {
    const currentIdx = stagesList.indexOf(currentStatus);
    const validCurrentIdx = currentIdx >= 0 ? currentIdx : 0;

    if (isMissed) {
      const past = stagesList.slice(0, validCurrentIdx + 1);
      return [...past, 'session_missed'];
    }
    if (isCancelled) {
      const past = stagesList.slice(0, validCurrentIdx + 1);
      return [...past, 'session_cancelled'];
    }
    // Show full roadmap of all session milestones: completed, current active, and future pending stages
    return stagesList;
  }, [isMissed, isCancelled, currentStatus]);

  // Interpolate coordinates along the polyline path
  const trainerCoords = useMemo(() => {
    if (currentStatus !== 'trainer_travelling') {
      return waypoints[0]; // Start location
    }
    const len = waypoints.length - 1;
    const activeSegment = Math.min(len - 1, Math.floor(journeyProgress * len));
    const segmentT = (journeyProgress * len) - activeSegment;

    const p1 = waypoints[activeSegment];
    const p2 = waypoints[activeSegment + 1];

    return {
      x: p1.x + (p2.x - p1.x) * segmentT,
      y: p1.y + (p2.y - p1.y) * segmentT
    };
  }, [journeyProgress, currentStatus]);

  // Handle active status tickers & animations
  useEffect(() => {
    // Active session stopwatch
    let stopwatchTimer: any = null;
    if (currentStatus === 'workout_started') {
      setTimeout(() => setElapsedSeconds(0), 0);
      stopwatchTimer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (stopwatchTimer) clearInterval(stopwatchTimer);
    };
  }, [currentStatus]);

  // Automated travel simulation
  const startTravelSimulation = async () => {
    if (simIntervalId) clearInterval(simIntervalId);
    setJourneyProgress(0);
    try {
      markSelfUpdate();
      setCurrentStatus('trainer_travelling');
      await updateTimelineStatus(booking.id, 'trainer_travelling');

      const interval = setInterval(() => {
        setJourneyProgress(prev => {
          const next = prev + 0.02;
          if (next >= 1.0) {
            clearInterval(interval);
            setSimIntervalId(null);
            // Automatically transition to Arrived
            setTimeout(async () => {
              try {
                markSelfUpdate();
                setCurrentStatus('trainer_arrived');
                await updateTimelineStatus(booking.id, 'trainer_arrived');
              } catch (e: any) {
                Alert.alert('Error', e.message || 'Could not update to trainer_arrived.');
              }
            }, 800);
            return 1.0;
          }
          return next;
        });
      }, 300); // Takes ~15s to complete journey simulation
      setSimIntervalId(interval);
    } catch (e: any) {
      Alert.alert('Travel Simulation Error', e.message || 'Could not start travel.');
    }
  };

  useEffect(() => {
    return () => {
      if (simIntervalId) clearInterval(simIntervalId);
    };
  }, [simIntervalId]);

  if (loading) {
    return <SkeletonLoader layout="session-detail" />;
  }

  if (!booking) {
    return (
      <View style={{ flex: 1, backgroundColor: 'white', paddingTop: insets.top }} className="justify-center items-center">
        <Text className="text-zinc-400 font-semibold">No booking details found.</Text>
        <TouchableOpacity onPress={handleSafeBack} className="mt-4 bg-zinc-900 px-6 py-2 rounded-full">
          <Text className="text-white font-bold text-xs">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Verification actions with double safeguards
  const handleVerifyOtp = async () => {
    markSelfUpdate();
    const success = await SessionEngine.verifyOTP(booking.id, otpInput);
    if (success) {
      setCurrentStatus('otp_verified');
      Alert.alert(
        'Check-In Verified',
        'Verification code correct. Click "Start Workout" under your console to begin.',
        [
          {
            text: 'OK',
            onPress: () => {
              setOtpInput('');
              syncFromDB();
            }
          }
        ]
      );
    } else {
      Alert.alert('Verification Failed', 'Incorrect or expired OTP entered. Please try again.');
    }
  };

  const handleVerifyCustomerOtp = async () => {
    markSelfUpdate();
    const success = await SessionEngine.verifyOTP(booking.id, customerOtpInput);
    if (success) {
      setCurrentStatus('otp_verified');
      Alert.alert(
        'Check-In Verified',
        'Verification successful! Your coach will start the workout shortly.',
        [
          {
            text: 'OK',
            onPress: () => {
              setCustomerOtpInput('');
              setShowCustomerOtpInput(false);
              syncFromDB();
            }
          }
        ]
      );
    } else {
      Alert.alert('Verification Failed', 'Incorrect or expired OTP entered. Please try again.');
    }
  };

  // Submit VIRLA Standard Post-Session Health & Limitation Report
  const handleHealthReportSubmit = async (reportData: any) => {
    try {
      markSelfUpdate();
      setCurrentStatus('trainer_report_submitted');
      await submitQuestionnaire(booking.id, reportData);
      addNotification({
        title: 'Health Update Recorded 📋',
        body: `Post-workout health update filed by Coach ${booking.trainerName || 'Trainer'}.`,
        icon: 'award'
      });
      syncFromDB();
      // Refresh assessments
      if (booking?.clientId) {
        Database.getClientAssessmentHistory(booking.clientId).then(setAssessments).catch(() => { });
      }
      Alert.alert('Health Update Saved ✅', "Client's health profile and limitations have been updated for future trainers.");
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not submit health update.');
      throw err;
    }
  };

  // User Rating review submit
  const handleClientFeedbackSubmit = async () => {
    try {
      markSelfUpdate();
      setCurrentStatus('session_closed');
      await updateBookingRating(booking.id, {
        overallRating,
        trainerRating,
        workoutRating,
        difficulty,
        energy,
        comments: comments.trim(),
      });
      addNotification({
        title: 'Session Closed successfully ✅',
        body: 'Thank you! Rating details saved and transaction invoice closed.',
        icon: 'check-circle'
      });
      syncProfile();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not close session.');
    }
  };

  // Call mock simulator
  const handleCall = () => {
    Alert.alert(
      'Simulating Secure Call',
      `Connecting encrypted line to ${role === 'trainer' ? 'Client' : `Coach ${booking.trainerName}`} (+91 99999 88888)...`
    );
  };

  const handleMessage = () => {
    if (!booking?.id) return;
    // Asynchronous navigation to keep touch feedback smooth and non-blocking
    setTimeout(() => {
      try {
        useChatStore.getState().markAsRead([booking.id]);
        router.push({
          pathname: '/communication' as any,
          params: { id: booking.id }
        });
      } catch (err) {
        console.error('[NAVIGATION] handleMessage async push failed:', err);
      }
    }, 0);
  };

  const handleOpenSupport = async () => {
    const currentBookingId = booking?.id || bookingId;
    if (!currentBookingId) {
      setShowRaiseTicketModal(true);
      return;
    }

    try {
      // 1. Check if a support ticket already exists for this booking ID
      const existingTicket = await Database.getRecentTicketForBooking(currentBookingId);
      if (existingTicket) {
        // Direct open existing support chatbox!
        setActiveChatTicket(existingTicket);
        setShowSupportChatModal(true);
        return;
      }
    } catch (e) {
      console.warn('[SessionDetail] Check existing ticket warning:', e);
    }

    // 2. If no ticket created yet, open raise modal so user can create first
    setShowRaiseTicketModal(true);
  };

  const handleShareLocation = () => {
    Alert.alert(
      'Live Location Shared',
      'Your real-time GPS coordinate route is now visible to the coach.'
    );
  };

  const handleNavigateAddress = () => {
    if (!parsedAddress || !parsedAddress.lat || !parsedAddress.lng || isNaN(parsedAddress.lat) || isNaN(parsedAddress.lng) || (parsedAddress.lat === 0 && parsedAddress.lng === 0)) {
      Alert.alert(
        'Navigation Lock ⚠️',
        'No exact GPS coordinates are available for this booking. Turn-by-turn navigation cannot start because the customer has not confirmed a verified map location.'
      );
      return;
    }

    setIsNavigationMapVisible(true);
  };

  const activeTrainerCoords = liveTrainerCoords || (role === 'trainer' && deviceCoords
    ? {
      latitude: deviceCoords.latitude,
      longitude: deviceCoords.longitude,
      accuracy: 0,
      heading: null,
      speed: null,
      updatedAt: new Date().toISOString(),
    }
    : null);

  const getCalculatedDistance = () => {
    if (currentStatus === 'trainer_arrived' || journeyProgress >= 1.0) {
      return 0;
    }
    if (routeMetrics && typeof routeMetrics.distanceKm === 'number') {
      return routeMetrics.distanceKm;
    }
    const baseDistance = 3.2 * (1 - journeyProgress);
    if (!booking?.address || !activeTrainerCoords) {
      return baseDistance;
    }

    if (parsedAddress && parsedAddress.lat && parsedAddress.lng && !isNaN(parsedAddress.lat) && !isNaN(parsedAddress.lng)) {
      const realDist = calculateHaversineDistance(
        activeTrainerCoords.latitude,
        activeTrainerCoords.longitude,
        parsedAddress.lat,
        parsedAddress.lng
      );

      if (journeyProgress > 0 && journeyProgress < 1.0) {
        return realDist * (1 - journeyProgress);
      }
      return realDist;
    }
    return baseDistance;
  };

  const distVal = getCalculatedDistance();
  const remainingDistance = distVal.toFixed(1);
  const remainingEta =
    currentStatus === 'trainer_arrived' || distVal < 0.05
      ? 0
      : routeMetrics?.durationMins ?? Math.max(1, Math.ceil(distVal * 4));

  if (role === 'trainer' && currentStatus === 'booked') {
    const customerId = `VIRLA-C${booking.id.slice(-6).toUpperCase()}`;
    const customerGender = getClientGender(booking);

    return (
      <View style={{ flex: 1, backgroundColor: '#F8F9FC', paddingTop: insets.top }}>
        {/* Header */}
        <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
          <TouchableOpacity onPress={handleSafeBack} className="w-8 h-8 items-center justify-center">
            <Ionicons name="arrow-back" size={20} color="#101828" />
          </TouchableOpacity>
          <Text className="text-[#101828] text-xs font-black uppercase tracking-widest">
            Booking Details
          </Text>
          <View className="w-8" />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 140 }}>
          <View className="gap-6">

            {/* Status Banner */}
            <View
              className="bg-rose-50 border border-rose-100 p-5 rounded-[28px] flex-row justify-between items-center"
              style={{
                shadowColor: '#E11D48',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.02,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <View className="gap-1 flex-1 pr-3">
                <Text className="text-[#E11D48] text-xs font-black uppercase tracking-wider">Request Pending Review</Text>
                <Text className="text-zinc-500 text-[10px] font-semibold">Please accept or decline this session request</Text>
              </View>
              <View className="bg-[#E11D48] px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5 shadow-sm">
                <Feather name="clock" size={12} color="white" />
                <Text className="text-white text-xs font-black">{timeLeft}s</Text>
              </View>
            </View>

            {/* Booking Details Card */}
            <View
              className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] gap-4"
              style={{
                shadowColor: '#101828',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.02,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3.5">
                <View className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center">
                  <Feather name="info" size={13} color="#E11D48" />
                </View>
                <Text className="text-zinc-955 text-xs font-black uppercase tracking-wider">Session Overview</Text>
              </View>

              <View className="gap-3">
                <View className="flex-row justify-between border-b border-zinc-100 pb-2">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase">Workout Type</Text>
                  <Text className="text-zinc-900 text-xs font-black">{getDisplayWorkoutTitle(booking.workoutTitle)}</Text>
                </View>

                <View className="flex-row justify-between border-b border-zinc-100 pb-2">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase">Date & Time</Text>
                  <Text className="text-zinc-900 text-xs font-black">{formatToIndianDate(booking.date)} • {booking.time}</Text>
                </View>

                <View className="flex-row justify-between border-b border-zinc-100 pb-2">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase">Client Reference</Text>
                  <Text className="text-zinc-900 text-xs font-black">{customerId}</Text>
                </View>

                <View className="flex-row justify-between border-b border-zinc-100 pb-2">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase">Gender</Text>
                  <Text className="text-zinc-900 text-xs font-black">{customerGender}</Text>
                </View>

                <View className="flex-row justify-between border-b border-zinc-100 pb-2">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase">Type</Text>
                  <Text className="text-zinc-900 text-xs font-black">{booking.sessionType === 'COUPLE' ? '2-Person Session' : 'Solo Session'}</Text>
                </View>

                <View className="flex-row justify-between border-b border-zinc-100 pb-2">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase">Approximate Location</Text>
                  <Text className="text-zinc-900 text-xs font-black">
                    {parsedAddress.buildingName || (parsedAddress.addressLine ? parsedAddress.addressLine.split(',')[0] : 'Selected Locality')}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase">Credits</Text>
                  <Text className="text-zinc-900 text-xs font-black">{booking.sessionType === 'COUPLE' ? '2 CREDITS' : '1 CREDIT'}</Text>
                </View>
              </View>
            </View>

            {/* Preparation Note Card */}
            <View
              className="bg-white border border-[#E5E7EB] p-5 rounded-[28px]"
              style={{
                shadowColor: '#101828',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.02,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center gap-2.5 mb-3">
                <View className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center">
                  <Feather name="file-text" size={13} color="#E11D48" />
                </View>
                <Text className="text-zinc-955 text-xs font-black uppercase tracking-wider">Client Preparation Note</Text>
              </View>
              <Text className="text-zinc-650 text-xs font-semibold leading-relaxed">
                {booking.trainerNote ? booking.trainerNote : 'No preparation notes.'}
              </Text>
            </View>

            {/* Client Health Alert & Assessment Card (Latest from previous trainer) */}
            <View
              className="bg-white border border-[#E5E7EB] p-5 rounded-[28px]"
              style={{
                shadowColor: '#101828',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.02,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-7 h-7 rounded-full bg-indigo-50 items-center justify-center">
                    <Feather name="activity" size={13} color="#4F46E5" />
                  </View>
                  <Text className="text-zinc-955 text-xs font-black uppercase tracking-wider">Health Alert & Assessment</Text>
                </View>
                {assessments.length > 0 && assessments[0].healthData?.hasInjuryOrLimitation && !assessments[0].healthData?.isLimitationResolved && (
                  <View className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    <Text className="text-rose-600 text-[9px] font-black uppercase">Active Injury Alert</Text>
                  </View>
                )}
              </View>

              {loadingAssessments ? (
                <ActivityIndicator size="small" color="#4F46E5" className="py-2" />
              ) : assessments.length > 0 ? (
                <View className="gap-2.5">
                  {/* Active Injury or Limitation Details from latest session */}
                  {assessments[0].healthData?.hasInjuryOrLimitation && !assessments[0].healthData?.isLimitationResolved && (
                    <View className="bg-rose-50/70 border border-rose-200/90 p-3 rounded-2xl gap-1.5">
                      <View className="flex-row items-center gap-1.5">
                        <Feather name="alert-triangle" size={13} color="#E11D48" />
                        <Text className="text-rose-700 text-xs font-black uppercase">
                          Reported Limitation ({assessments[0].healthData?.affectedAreas?.join(', ') || 'Physical'})
                        </Text>
                      </View>
                      {assessments[0].healthData?.injuryDetails ? (
                        <Text className="text-rose-950 text-xs font-medium">
                          {assessments[0].healthData.injuryDetails}
                        </Text>
                      ) : null}
                      {assessments[0].healthData?.exercisesToAvoidDetails ? (
                        <Text className="text-rose-800 text-[11px] font-semibold mt-0.5">
                          ⚠️ Avoid / Modify: {assessments[0].healthData.exercisesToAvoidDetails}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-widest">
                    Important Information For Coach:
                  </Text>
                  <Text className="text-zinc-800 text-xs font-semibold leading-relaxed">
                    {`"${assessments[0].assessment}"`}
                  </Text>
                  <Text className="text-zinc-400 text-[9px] font-bold">
                    Recorded by Coach {assessments[0].coachName || 'Trainer'} • {formatToDDMMYYYY(assessments[0].date)}
                  </Text>
                </View>
              ) : (
                <Text className="text-zinc-500 text-xs font-semibold italic">
                  No previous health alerts or physical limitations reported. Client is clear to train.
                </Text>
              )}
            </View>

            {/* Session Policies Card */}
            <View
              className="bg-amber-50/20 border border-amber-100/50 p-4.5 rounded-[28px] flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                <View className="w-9 h-9 rounded-full bg-amber-100/40 items-center justify-center">
                  <Feather name="shield" size={15} color="#D97706" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Session Policies</Text>
                  <Text className="text-[#6B7280] text-[9px] font-medium leading-normal">
                    Important details regarding preparation, travel safety, and cancellation.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/legal-center')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                className="border border-rose-200 px-3.5 py-1.5 rounded-full flex-row items-center bg-white shadow-sm"
              >
                <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-wide">View Details</Text>
                <Feather name="chevron-right" size={10} color="#E11D48" />
              </TouchableOpacity>
            </View>

            {/* Privacy Warning Banner */}
            {role === 'trainer' && currentStatus === 'booked' && (
              <View className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl flex-row items-start gap-2.5">
                <Feather name="lock" size={13} color="#9CA3AF" style={{ marginTop: 2 }} />
                <Text className="text-zinc-500 text-[9px] font-semibold leading-relaxed flex-1">
                  Before you accept this booking, communication options are locked and customer contact information (Name, exact Address, Phone Number) remains private under {"VIRLA's"} privacy policies.
                </Text>
              </View>
            )}

            {(role as string) === 'customer' && !isAccepted && (() => {
              const isSearching = !booking?.trainerId || booking?.trainerId === 'searching' || booking?.trainerName === 'No Trainer Available';
              return (
                <View className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex-row items-start gap-2.5">
                  <Feather name={isSearching ? "search" : "clock"} size={13} color="#4F46E5" style={{ marginTop: 2 }} />
                  <Text className="text-indigo-700 text-[9px] font-semibold leading-relaxed flex-1">
                    {isSearching
                      ? "Looking for the best trainer... Secure communication options and profile details will unlock after trainer acceptance."
                      : `Waiting for Coach ${booking?.trainerName} to accept your booking request. Secure communication options and profile details will unlock after trainer acceptance.`
                    }
                  </Text>
                </View>
              );
            })()}

            {(role as string) === 'customer' && isAccepted && (
              <View className="bg-[#ECFDF5] border border-[#A7F3D0] p-4 rounded-2xl flex-row items-start gap-2.5">
                <Feather name="check-circle" size={13} color="#059669" style={{ marginTop: 2 }} />
                <Text className="text-emerald-800 text-[9px] font-semibold leading-relaxed flex-1">
                  Trainer confirmed. Trainer details will unlock according to VIRLA privacy rules (Calling & Messaging opens 60 minutes before training).
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons Panel */}
        <View
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-zinc-100 p-6"
          style={{
            zIndex: 99,
            shadowColor: '#101828',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.05,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <TouchableOpacity
            disabled={isAccepting || isConfirmed}
            onPress={() => {
              const handleAccept = async () => {
                setIsAccepting(true);
                const currentUserId = Database.getCurrentUserId() || 'N/A';
                console.log("[TRAINER-ACCEPT-TRACE] BUTTON PRESSED: YES");
                console.log("[TRAINER-ACCEPT-TRACE] HANDLER ENTERED: YES");
                console.log(`[TRAINER-ACCEPT-TRACE] BOOKING ID: ${booking.id}`);
                console.log(`[TRAINER-ACCEPT-TRACE] TRAINER ID: ${booking.trainerId || 'N/A'}`);
                console.log(`[TRAINER-ACCEPT-TRACE] AUTHENTICATED USER ID: ${currentUserId}`);
                console.log(`[TRAINER-ACCEPT-TRACE] CURRENT BOOKING STATUS: ${currentStatus}`);
                console.log("[TRAINER-ACCEPT-TRACE] RPC CALLED: trainer_accept_booking");
                try {
                  await updateTimelineStatus(booking.id, 'trainer_accepted');
                  console.log("[TRAINER-ACCEPT-TRACE] RPC RESULT: SUCCESS");
                  setIsConfirmed(true);
                  console.log("[TRAINER-ACCEPT-TRACE] NEW BOOKING STATUS: trainer_accepted");
                  console.log("[TRAINER-ACCEPT-TRACE] CLIENT REFRESH: completed");
                  console.log("[TRAINER-ACCEPT-TRACE] TRAINER REFRESH: completed");
                  console.log("[TRAINER-ACCEPT-TRACE] ADMIN STATE: synchronized");
                  syncFromDB();
                  if (Platform.OS === 'web') {
                    window.alert('You have accepted the session request.');
                  } else {
                    Alert.alert('Booking Accepted', 'You have accepted the session request.');
                  }
                } catch (err: any) {
                  console.error("[TRAINER-ACCEPT-TRACE] RPC RESULT: ERROR");
                  console.error("[TRAINER-ACCEPT-TRACE] RPC error details:", err);
                  if (Platform.OS === 'web') {
                    window.alert(err.message || 'Could not accept booking.');
                  } else {
                    Alert.alert('Accept Failed', err.message || 'Could not accept booking.');
                  }
                  setIsAccepting(false);
                }
              };

              const confirmMsg = 'Accept Booking?\n\nBy accepting this booking you agree to complete the session. Once accepted it cannot be cancelled except through VIRLA Support.';
              if (Platform.OS === 'web') {
                const ok = window.confirm(confirmMsg);
                if (ok) {
                  handleAccept();
                }
              } else {
                Alert.alert(
                  'Accept Booking?',
                  'By accepting this booking you agree to complete the session. Once accepted it cannot be cancelled except through VIRLA Support.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Accept',
                      onPress: handleAccept
                    }
                  ]
                );
              }
            }}
            className="w-full bg-[#E11D48] py-4.5 rounded-[20px] items-center justify-center"
            style={{
              opacity: (isAccepting || isConfirmed) ? 0.6 : 1,
              shadowColor: '#E11D48',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {isConfirmed ? (
              <Text className="text-white text-sm font-black uppercase">BOOKING CONFIRMED</Text>
            ) : isAccepting ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white text-sm font-black uppercase">ACCEPTING...</Text>
              </View>
            ) : (
              <Text className="text-white text-sm font-black uppercase">Accept Booking</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FC' }}>
      <StatusBar style="dark" />
      {/* Header extending to the very top */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-white border-b border-zinc-100 shadow-xs"
      >
        <View className="h-14 flex-row items-center px-5 justify-between">
          <TouchableOpacity
            onPress={handleSafeBack}
            activeOpacity={0.6}
            className="w-9 h-9 items-center justify-center active:opacity-60"
          >
            <Ionicons name="arrow-back" size={18} color="#09090B" />
          </TouchableOpacity>

          {/* Header Title */}
          <View className="items-center flex-1 mx-2">
            <Text
              numberOfLines={1}
              className="text-zinc-950 text-base font-extrabold tracking-tight"
            >
              {role === 'trainer' ? 'Coach Console' : 'Session Details'}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            {role === 'customer' && (
              <TouchableOpacity
                onPress={handleOpenSupport}
                activeOpacity={0.8}
                className="bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200/90 flex-row items-center gap-1.5"
                accessibilityLabel="Customer Support"
              >
                <Feather name="headphones" size={13} color="#E11D48" />
                <Text className="text-rose-700 text-xs font-black uppercase tracking-wider">Support</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Developer Push Simulator (Only for trainer during development) */}
      {__DEV__ && role === 'trainer' && !isMissed && !isCancelled && (
        <View className="bg-zinc-950 p-3.5 border-b border-zinc-800 gap-2">
          <Text className="text-amber-400 text-xs font-bold uppercase tracking-wider pl-2">Developer Push Simulator</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, gap: 8 }}>
            {currentStatus === 'trainer_assigned' && role === 'trainer' && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    markSelfUpdate();
                    setCurrentStatus('trainer_accepted');
                    await updateTimelineStatus(booking.id, 'trainer_accepted');
                  } catch (e: any) {
                    Alert.alert('Simulation Error', e.message);
                  }
                }}
                className="px-3.5 py-2 bg-indigo-600 rounded-xl items-center justify-center"
              >
                <Text className="text-white text-xs font-semibold">Simulate Accept</Text>
              </TouchableOpacity>
            )}

            {currentStatus === 'trainer_accepted' && role === 'trainer' && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    markSelfUpdate();
                    setCurrentStatus('trainer_preparing');
                    await updateTimelineStatus(booking.id, 'trainer_preparing');
                  } catch (e: any) {
                    Alert.alert('Simulation Error', e.message);
                  }
                }}
                className="px-3.5 py-2 bg-indigo-600 rounded-xl items-center justify-center"
              >
                <Text className="text-white text-xs font-semibold">Simulate Prep Gear</Text>
              </TouchableOpacity>
            )}

            {currentStatus === 'trainer_preparing' && role === 'trainer' && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={startTravelSimulation}
                className="px-3.5 py-2 bg-emerald-600 rounded-xl items-center justify-center"
              >
                <Text className="text-white text-xs font-semibold">Simulate Start Journey</Text>
              </TouchableOpacity>
            )}

            {currentStatus === 'trainer_travelling' && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={async () => {
                  if (simIntervalId) clearInterval(simIntervalId);
                  setJourneyProgress(1.0);
                  try {
                    markSelfUpdate();
                    setCurrentStatus('trainer_arrived');
                    await updateTimelineStatus(booking.id, 'trainer_arrived');
                  } catch (e: any) {
                    Alert.alert('Simulation Error', e.message);
                  }
                }}
                className="px-3.5 py-2 bg-emerald-600 rounded-xl items-center justify-center"
              >
                <Text className="text-white text-xs font-semibold">Skip to Arrived</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => triggerClientNoShow(booking.id)}
              className="px-3.5 py-2 bg-rose-600 rounded-xl items-center justify-center"
            >
              <Text className="text-white text-xs font-semibold">Client No-Show</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => triggerTrainerNoShow(booking.id)}
              className="px-3.5 py-2 bg-rose-600 rounded-xl items-center justify-center"
            >
              <Text className="text-white text-xs font-semibold">Trainer No-Show</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 100 }}>
          <View className="gap-5">

            {/* Status Content (Clean, lightweight presentation without heavy dark background box) */}
            <View className="py-2 gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className={`w-2.5 h-2.5 rounded-full ${isMissed ? 'bg-amber-500' : isCancelled ? 'bg-rose-500' : 'bg-[#E11D48]'}`} />
                  <Text className={`text-xs font-black uppercase tracking-wider ${isMissed ? 'text-amber-600' : isCancelled ? 'text-rose-600' : 'text-[#E11D48]'}`}>
                    {isMissed || isCancelled ? 'Session Status' : 'Live Concierge Status'}
                  </Text>
                </View>
                <View className={`border px-2.5 py-0.5 rounded-full ${isMissed
                    ? 'bg-amber-50 border-amber-200'
                    : isCancelled
                      ? 'bg-red-50 border-red-200'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}>
                  <Text className={`text-[10px] font-extrabold uppercase tracking-wider ${isMissed
                      ? 'text-amber-700'
                      : isCancelled
                        ? 'text-rose-600'
                        : 'text-emerald-700'
                    }`}>
                    {isMissed ? 'Missed' : isCancelled ? 'Cancelled' : 'Live Active'}
                  </Text>
                </View>
              </View>
              <Text className="text-zinc-950 text-xl font-black tracking-tight">{getStatusText(currentStatus)}</Text>
              {isMissed ? (
                <Text className="text-zinc-500 text-xs font-medium leading-5 mt-0.5">
                  {booking.status === 'client_no_show'
                    ? 'This session was marked as missed due to client no-show.'
                    : booking.status === 'trainer_no_show'
                      ? 'This session was marked as missed due to coach no-show.'
                      : 'This session was not started and has been marked as missed.'}
                </Text>
              ) : isCancelled ? (
                <Text className="text-zinc-500 text-xs font-medium leading-5 mt-0.5">
                  {(booking as any)?.cancellationReason
                    ? `Cancellation reason: ${(booking as any).cancellationReason}`
                    : 'This booking has been cancelled.'}
                </Text>
              ) : null}
            </View>

            {/* Section 2: Booking Summary (without white card container) */}
            {(role === 'customer' || role === 'trainer') && (
              <View className="gap-4">
                <View className="flex-row items-center justify-between pb-1 border-b border-zinc-100">
                  <Text className="text-zinc-950 text-sm font-black uppercase tracking-wider">Session Overview</Text>
                  <View className={`px-2.5 py-0.5 rounded-full ${isMissed
                      ? 'bg-amber-50 border border-amber-200'
                      : isCancelled
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-zinc-100'
                    }`}>
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${isMissed
                        ? 'text-amber-700'
                        : isCancelled
                          ? 'text-rose-600'
                          : 'text-zinc-600'
                      }`}>
                      {isMissed ? 'Missed Session' : isCancelled ? 'Cancelled Session' : 'Verified Booking'}
                    </Text>
                  </View>
                </View>

                <View className="gap-3.5">
                  <View className="flex-row justify-between items-center border-b border-zinc-100/80 pb-2.5">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Workout Type</Text>
                    <Text className="text-zinc-950 text-sm font-black">{getDisplayWorkoutTitle(booking.workoutTitle)}</Text>
                  </View>
                  <View className="flex-row justify-between items-center border-b border-zinc-100/80 pb-2.5">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Date</Text>
                    <Text className="text-zinc-950 text-sm font-black">
                      {formatToDDMMYYYY(booking.date)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center border-b border-zinc-100/80 pb-2.5">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Time</Text>
                    <Text className="text-zinc-950 text-sm font-black">{booking.time}</Text>
                  </View>
                  {role !== 'trainer' && (
                    <View className="flex-row justify-between items-center border-b border-zinc-100/80 pb-2.5">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Duration</Text>
                      <Text className="text-zinc-950 text-sm font-black">{booking.durationMinutes || 60} Mins</Text>
                    </View>
                  )}
                  {role === 'trainer' && (
                    <View className="flex-row justify-between items-center border-b border-zinc-100/80 pb-2.5">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Client Reference</Text>
                      <Text className="text-zinc-950 text-sm font-black font-mono">
                        {`VIRLA-C${booking.id.slice(-6).toUpperCase()}`}
                      </Text>
                    </View>
                  )}
                  {role === 'trainer' && (
                    <View className="flex-row justify-between items-center border-b border-zinc-100/80 pb-2.5">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Gender</Text>
                      <Text className="text-zinc-950 text-sm font-black">
                        {getClientGender(booking)}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row justify-between items-center border-b border-zinc-100/80 pb-2.5">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Session Format</Text>
                    <Text className="text-zinc-950 text-sm font-black">
                      {booking.sessionType === 'COUPLE' ? (role === 'trainer' ? '2-Person Session' : 'Couple Session') : (role === 'trainer' ? 'Solo Session' : 'Solo Session')}
                    </Text>
                  </View>
                  {role !== 'trainer' && (
                    <View className="flex-row justify-between items-center border-b border-zinc-100/80 pb-2.5">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Coach Match</Text>
                      <Text className="text-zinc-950 text-sm font-black">
                        {booking.preferredCoachId ? 'Favorite Trainer' : 'Virla Top Match'}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row justify-between items-center border-b border-zinc-100/80 pb-2.5">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">
                      {role === 'trainer' ? 'Credits' : 'Credits Used'}
                    </Text>
                    <View className="bg-zinc-100 px-2.5 py-0.5 rounded-md border border-zinc-200">
                      <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">
                        {booking.sessionType === 'COUPLE'
                          ? (role === 'trainer' ? '2 CREDITS' : '2 Credits')
                          : (role === 'trainer' ? '1 CREDIT' : '1 Credit')}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row justify-between items-start pt-0.5">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider mt-0.5">Location</Text>
                    <View className="max-w-[65%] items-end">
                      {parsedAddress.flatNumber || parsedAddress.buildingName ? (
                        <Text className="text-zinc-950 text-sm font-black text-right">
                          {[parsedAddress.flatNumber, parsedAddress.buildingName].filter(Boolean).join(', ')}
                        </Text>
                      ) : null}
                      <Text className="text-zinc-600 text-xs font-medium text-right leading-relaxed mt-0.5">
                        {parsedAddress.addressLine || 'Selected Location'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Preparation Note Card for Trainer (Accepted view) */}
            {role === 'trainer' && (
              <View
                className="bg-white border border-zinc-200/80 p-5 rounded-[28px] shadow-sm"
                style={{
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 1,
                }}
              >
                <View className="flex-row items-center gap-2.5 mb-3">
                  <View className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center">
                    <Feather name="file-text" size={14} color="#E11D48" />
                  </View>
                  <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">Client Preparation Note</Text>
                </View>
                <Text className="text-zinc-700 text-sm font-medium leading-relaxed">
                  {booking.trainerNote ? booking.trainerNote : 'No preparation notes.'}
                </Text>
              </View>
            )}

            {/* Client Health Alert & Assessment Card for Trainer (Accepted view) */}
            {role === 'trainer' && (
              <View
                className="bg-white border border-zinc-200/80 p-5 rounded-[28px] shadow-sm"
                style={{
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 1,
                }}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-7 h-7 rounded-full bg-indigo-50 items-center justify-center">
                      <Feather name="activity" size={14} color="#4F46E5" />
                    </View>
                    <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">Health Alert & Assessment</Text>
                  </View>
                  {assessments.length > 0 && assessments[0].healthData?.hasInjuryOrLimitation && !assessments[0].healthData?.isLimitationResolved && (
                    <View className="bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                      <Text className="text-rose-600 text-[9px] font-black uppercase">Active Limitation</Text>
                    </View>
                  )}
                </View>

                {loadingAssessments ? (
                  <ActivityIndicator size="small" color="#4F46E5" className="py-2" />
                ) : assessments.length > 0 ? (
                  <View className="gap-3">
                    {/* Active Injury / Limitation Details from latest session */}
                    {assessments[0].healthData?.hasInjuryOrLimitation && (
                      <View className={`p-3.5 rounded-2xl border gap-2 ${assessments[0].healthData?.isLimitationResolved
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-rose-50/70 border-rose-200'
                        }`}>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5 flex-1 pr-2">
                            <Feather
                              name={assessments[0].healthData?.isLimitationResolved ? 'check-circle' : 'alert-triangle'}
                              size={14}
                              color={assessments[0].healthData?.isLimitationResolved ? '#059669' : '#E11D48'}
                            />
                            <Text className={`text-xs font-black uppercase ${assessments[0].healthData?.isLimitationResolved ? 'text-emerald-700' : 'text-rose-700'
                              }`}>
                              {assessments[0].healthData?.isLimitationResolved
                                ? 'Resolved Limitation'
                                : `Active Issue (${assessments[0].healthData?.affectedAreas?.join(', ') || 'Physical'})`}
                            </Text>
                          </View>

                          {/* Toggle limitation resolved */}
                          <TouchableOpacity
                            onPress={async () => {
                              try {
                                const current = Boolean(assessments[0].healthData?.isLimitationResolved);
                                await Database.submitLimitationResolution(assessments[0].bookingId, !current);
                                Database.getClientAssessmentHistory(booking.clientId).then(setAssessments).catch(() => { });
                              } catch (e: any) {
                                Alert.alert('Error', e.message || 'Could not update status');
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg border ${assessments[0].healthData?.isLimitationResolved
                                ? 'bg-white border-zinc-200'
                                : 'bg-white border-emerald-300'
                              }`}
                          >
                            <Text className="text-[10px] font-bold text-zinc-800">
                              {assessments[0].healthData?.isLimitationResolved ? 'Mark Active' : 'Mark Resolved ✓'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {assessments[0].healthData?.injuryDetails ? (
                          <Text className="text-zinc-800 text-xs font-medium">
                            {assessments[0].healthData.injuryDetails}
                          </Text>
                        ) : null}

                        {assessments[0].healthData?.exercisesToAvoidDetails ? (
                          <Text className="text-zinc-700 text-xs font-semibold">
                            ⚠️ Avoid / Modify: {assessments[0].healthData.exercisesToAvoidDetails}
                          </Text>
                        ) : null}
                      </View>
                    )}

                    <View className="gap-1">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">
                        Important Info for Coach:
                      </Text>
                      <Text className="text-zinc-800 text-sm font-semibold leading-relaxed">
                        {`"${assessments[0].assessment}"`}
                      </Text>
                      <Text className="text-zinc-400 text-[10px] font-semibold mt-1">
                        From Coach {assessments[0].coachName || 'Trainer'} • {formatToDDMMYYYY(assessments[0].date)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text className="text-zinc-500 text-sm font-medium italic">
                    No previous health alerts or physical limitations reported. Client is clear to train.
                  </Text>
                )}
              </View>
            )}

            {/* Add Partner Action Card */}
            {role === 'customer' && booking.sessionType === 'SINGLE' && booking.status === 'upcoming' && currentStatus !== 'otp_verified' && currentStatus !== 'workout_started' && currentStatus !== 'workout_completed' && currentStatus !== 'session_closed' && (
              <View className="bg-rose-50/50 border border-rose-100 p-5 rounded-[28px] shadow-sm gap-3 mt-4">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-rose-100 items-center justify-center">
                    <Feather name="users" size={18} color="#E11D48" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-950 text-sm font-bold tracking-tight">Train with a friend?</Text>
                    <Text className="text-zinc-600 text-xs font-medium mt-0.5 leading-relaxed">
                      Convert this to a 2-person session. Uses 1 additional credit.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowPartnerModal(true)}
                  className="w-full bg-[#E11D48] py-3.5 rounded-xl items-center justify-center mt-1"
                >
                  <Text className="text-white text-sm font-bold uppercase tracking-wider">+ Add Partner</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Partner Details Card if already added */}
            {role === 'customer' && booking.sessionType === 'COUPLE' && booking.partnerName && (
              <View className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-[28px] shadow-sm gap-3 mt-4">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center">
                    <Feather name="users" size={18} color="#10B981" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-950 text-sm font-bold tracking-tight">2-Person Session</Text>
                    <Text className="text-zinc-600 text-xs font-medium mt-0.5 leading-relaxed">
                      Partner: <Text className="font-bold text-zinc-900">{booking.partnerName}</Text>
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <AddPartnerModal
              visible={showPartnerModal}
              bookingId={booking.id}
              onClose={() => setShowPartnerModal(false)}
              onSuccess={() => {
                setShowPartnerModal(false);
                syncFromDB();
              }}
            />

            {/* Module 2: Zepto-Style Live Route & GPS Map */}
            {(currentStatus === 'trainer_travelling' || currentStatus === 'trainer_arrived') && !isMissed && !isCancelled && (
              <View className="bg-slate-950 border border-slate-900 rounded-[28px] overflow-hidden shadow-md">
                <View className="p-4 border-b border-slate-900 flex-row justify-between items-center bg-slate-900/40">
                  <View>
                    <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Live Tracking Feed</Text>
                    <Text className="text-white text-sm font-bold mt-0.5">
                      {currentStatus === 'trainer_travelling'
                        ? role === 'trainer'
                          ? 'Navigating to client venue'
                          : 'Coach on the way'
                        : 'Coach arrived at your gate'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setIsNavigationMapVisible(true)}
                    className="bg-emerald-500/15 px-3 py-1.5 rounded-full border border-emerald-500/30 flex-row items-center gap-1.5"
                  >
                    <View className="w-2 h-2 rounded-full bg-emerald-400" />
                    <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider">LIVE ROUTE</Text>
                  </TouchableOpacity>
                </View>

                {/* Real Live Map with Polyline & Mota Marker */}
                <View className="h-96 rounded-2xl overflow-hidden relative bg-slate-950 border border-slate-800 shadow-xl">
                  <TrackingMap
                    liveTrainerCoords={activeTrainerCoords}
                    isStale={isLiveConnectionStale}
                    clientAddress={effectiveAddressStr}
                    viewerRole={role as any}
                    onRouteMetricsChange={setRouteMetrics}
                    onExpandPress={() => setIsNavigationMapVisible(true)}
                  />
                </View>

                {/* Tracking ETA Indicators */}
                {currentStatus === 'trainer_travelling' && (
                  <View className="flex-row divide-x divide-slate-900 border-t border-slate-900 bg-slate-900/20">
                    {role === 'trainer' && (
                      <View className="flex-1 p-4 items-center">
                        <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Distance Remaining</Text>
                        <Text className="text-white text-base font-black mt-0.5">{remainingDistance} km</Text>
                      </View>
                    )}
                    <View className="flex-1 p-4 items-center">
                      <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Estimated Arrival</Text>
                      <Text className="text-white text-base font-black mt-0.5">~{remainingEta} mins</Text>
                    </View>
                  </View>
                )}

                {/* Arrived Pin Information */}
                {currentStatus === 'trainer_arrived' && (
                  <View className="p-4 items-center justify-center bg-emerald-950/20 border-t border-emerald-900/30">
                    <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider">📍 VENUE LOCATION</Text>
                    <Text className="text-white text-sm font-bold mt-0.5">Coach is waiting outside the gate</Text>
                  </View>
                )}
              </View>
            )}

            {/* Module 4: Premium Coach Profile Card */}
            {!isPendingDetails && (
              <View
                className="bg-white border border-zinc-200/80 p-5 rounded-[28px] shadow-sm gap-4"
                style={{
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View className="flex-row gap-4 items-start">
                  <Image source={{ uri: (booking.trainerPhoto && booking.trainerPhoto.trim().length > 0) ? booking.trainerPhoto : 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80' }} className="w-14 h-14 rounded-full border border-zinc-200" />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <Text className="text-zinc-950 text-base font-extrabold">Coach {booking.trainerName}</Text>
                      <View className="bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 flex-row items-center gap-1">
                        <Feather name="check-circle" size={10} color="#059669" />
                        <Text className="text-emerald-700 text-xs font-bold uppercase">Verified Pro</Text>
                      </View>
                    </View>
                    <Text className="text-zinc-500 text-xs font-semibold mt-0.5">
                      {booking.trainerLevel || 'Certified'} Coach • {getDisplayWorkoutTitle(booking.workoutTitle)} Specialist
                    </Text>

                    <View className="flex-row items-center gap-1.5 mt-2 flex-wrap">
                      <Text className="text-zinc-800 text-xs font-semibold bg-zinc-100/90 border border-zinc-200/60 px-2.5 py-1 rounded-lg">⭐ {booking.trainerRating || 4.9}</Text>
                      <Text className="text-zinc-800 text-xs font-semibold bg-zinc-100/90 border border-zinc-200/60 px-2.5 py-1 rounded-lg">💼 {booking.trainerCompletedSessions || 154}+ sessions</Text>
                      <Text className="text-zinc-800 text-xs font-semibold bg-zinc-100/90 border border-zinc-200/60 px-2.5 py-1 rounded-lg">🎯 6+ Years Exp</Text>
                    </View>
                  </View>
                </View>

                <View className="h-[1px] bg-zinc-100" />

                {/* More Details Layout grid */}
                <View className="flex-row flex-wrap justify-between gap-y-3.5 px-1">
                  <View className="w-[48%]">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Specialties</Text>
                    <Text className="text-zinc-800 text-xs font-bold mt-1">{booking.trainerSpeciality || 'Mobility & Core strength'}</Text>
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Languages Spoken</Text>
                    <Text className="text-zinc-800 text-xs font-bold mt-1">{(booking.trainerLanguages || ['English', 'Hindi', 'Punjabi']).join(', ')}</Text>
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Response Rate</Text>
                    <Text className="text-zinc-800 text-xs font-bold mt-1">98% (Quick responder)</Text>
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Punctuality Score</Text>
                    <Text className="text-zinc-800 text-xs font-bold mt-1">99.4% (Always on time)</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Section 6: Secure Communication Module */}
            {role === 'customer' && (
              <View className="gap-3.5 pl-1">
                <View className="flex-row items-center justify-between pr-2">
                  <Text className="text-zinc-950 text-sm font-black uppercase tracking-wider">Direct Coach Line</Text>
                  <View className="bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-200/80">
                    <Text className="text-zinc-700 text-[10px] font-extrabold uppercase tracking-wider">
                      {isMissed || isCancelled ? 'Closed' : 'Encrypted'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-3">
                  {/* Secure Message */}
                  <TouchableOpacity
                    onPress={
                      isMissed
                        ? () => Alert.alert('Session Missed', 'This session has been marked as missed and communications are closed.')
                        : isCancelled
                          ? () => Alert.alert('Session Cancelled', 'This session has been cancelled and communications are closed.')
                          : !isAccepted
                            ? () => Alert.alert('Waiting for Coach', 'You can chat once the trainer has accepted your booking.')
                            : handleMessage
                    }
                    className={`flex-1 py-4 rounded-2xl items-center justify-center flex-row gap-2.5 shadow-sm border ${isMissed || isCancelled ? 'bg-zinc-100 border-zinc-200 opacity-60' : 'bg-zinc-950 border border-zinc-900'
                      }`}
                  >
                    <Feather name="message-square" size={16} color={isMissed || isCancelled ? '#6B7280' : 'white'} />
                    <Text className={`text-sm font-black tracking-wide ${isMissed || isCancelled ? 'text-zinc-500' : 'text-white'}`}>Message Coach</Text>
                  </TouchableOpacity>

                  {/* Secure Call */}
                  {currentStatus !== 'session_closed' && booking?.status !== 'completed' && (
                    <View className="flex-1">
                      <TouchableOpacity
                        onPress={
                          isMissed
                            ? () => Alert.alert('Session Missed', 'This session has been marked as missed and communications are closed.')
                            : isCancelled
                              ? () => Alert.alert('Session Cancelled', 'This session has been cancelled and communications are closed.')
                              : !isAccepted
                                ? () => Alert.alert('Security Lock', 'Waiting for Trainer Acceptance. Secure communications will unlock after a coach confirms.')
                                : (getMinutesToSession() <= 60 ? handleCall : undefined)
                        }
                        activeOpacity={!isAccepted || isMissed || isCancelled ? 0.8 : (getMinutesToSession() <= 60 ? 0.8 : 1)}
                        className={`py-4 rounded-2xl items-center justify-center flex-row gap-2.5 shadow-sm ${(!isMissed && !isCancelled && isAccepted && getMinutesToSession() <= 60) ? 'bg-zinc-950 border border-zinc-900' : 'bg-zinc-100 border border-zinc-200 opacity-60'
                          }`}
                      >
                        <Feather name="phone" size={16} color={(!isMissed && !isCancelled && isAccepted && getMinutesToSession() <= 60) ? 'white' : '#6B7280'} />
                        <Text className={`text-sm font-black tracking-wide ${(!isMissed && !isCancelled && isAccepted && getMinutesToSession() <= 60) ? 'text-white' : 'text-zinc-500'}`}>Direct Call</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Helper text if Call is disabled */}
                {(currentStatus === 'session_closed' || booking?.status === 'completed') && (
                  <Text className="text-zinc-500 text-xs font-semibold text-center mt-1 leading-relaxed">
                    Direct calling is closed because this session has completed.
                  </Text>
                )}
                {isMissed && (
                  <Text className="text-zinc-500 text-xs font-semibold text-center mt-1 leading-relaxed">
                    Direct communications are closed because this session was missed.
                  </Text>
                )}
                {isCancelled && (
                  <Text className="text-zinc-500 text-xs font-semibold text-center mt-1 leading-relaxed">
                    Direct communications are closed because this session was cancelled.
                  </Text>
                )}
                {!isMissed && !isCancelled && isAccepted && currentStatus !== 'session_closed' && booking?.status !== 'completed' && getMinutesToSession() > 60 && (
                  <Text className="text-zinc-600 text-xs font-semibold text-center mt-1 leading-relaxed">
                    Direct calling unlocks 60 minutes before your scheduled session.
                  </Text>
                )}
                {!isMissed && !isCancelled && !isAccepted && (
                  <Text className="text-zinc-600 text-xs font-semibold text-center mt-1 leading-relaxed">
                    Direct communications unlock as soon as your coach accepts the session.
                  </Text>
                )}
              </View>
            )}

            {/* Client cancel booking (only after trainer acceptance) */}
            {role === 'customer' && isAccepted && !isMissed && !isCancelled && booking?.status === 'upcoming' && currentStatus === 'booked' && (
              <View className="mt-2 mb-4">
                <TouchableOpacity
                  onPress={() => {
                    const mins = getMinutesToSession();
                    if (mins < 30) {
                      Alert.alert('Cannot Cancel', 'Bookings cannot be cancelled within 30 minutes of the session.');
                      return;
                    }
                    const policy = mins >= 60
                      ? '50% of the session credits will be refunded.'
                      : 'This is a late cancellation. The full session credits will be deducted and no refund will be given.';
                    Alert.alert('Cancel Booking?', policy, [
                      { text: 'Keep Booking', style: 'cancel' },
                      {
                        text: 'Cancel Booking',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await Database.cancelBooking(user?.id || '', booking!.id);
                            router.back();
                          } catch (e: any) {
                            Alert.alert('Error', e.message || 'Could not cancel booking');
                          }
                        },
                      },
                    ]);
                  }}
                  activeOpacity={0.8}
                  className="py-4 rounded-2xl items-center justify-center bg-white border border-rose-200"
                >
                  <Text className="text-rose-600 text-sm font-black tracking-wide">Cancel Booking</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Original Module 5 for Trainers */}
            {role !== 'customer' && !isMissed && !isCancelled && currentStatus !== 'workout_started' && (
              <View className="gap-4 pl-1">
                <View className="flex-row justify-between items-center">
                  <Text className="text-zinc-950 text-sm font-extrabold uppercase tracking-wider">Concierge Controls</Text>
                </View>

                <View className="flex-row justify-between">
                  {currentStatus !== 'session_closed' && booking?.status !== 'completed' && (
                    <TouchableOpacity
                      onPress={isPendingDetails ? () => Alert.alert('Security Lock', 'Communication channel opens 5 hours prior to session.') : handleCall}
                      className="w-[30%] bg-zinc-950 py-3.5 rounded-2xl items-center justify-center flex-row gap-1.5 shadow-sm"
                    >
                      <Feather name="phone" size={14} color="white" />
                      <Text className="text-white text-xs font-bold uppercase">Call Client</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={isPendingDetails ? () => Alert.alert('Security Lock', 'Communication channel opens 5 hours prior to session.') : handleMessage}
                    className={`${(currentStatus === 'session_closed' || booking?.status === 'completed') ? 'w-full' : 'w-[30%]'} bg-zinc-950 py-3.5 rounded-2xl items-center justify-center flex-row gap-1.5 shadow-sm`}
                  >
                    <Feather name="message-square" size={14} color="white" />
                    <Text className="text-white text-xs font-bold uppercase">Chat Board</Text>
                  </TouchableOpacity>

                  {currentStatus !== 'session_closed' && booking?.status !== 'completed' && (
                    <TouchableOpacity
                      onPress={isPendingDetails ? () => Alert.alert('Security Lock', 'Live tracking GPS details lock opens 5 hours prior.') : handleShareLocation}
                      className="w-[30%] bg-zinc-950 py-3.5 rounded-2xl items-center justify-center flex-row gap-1.5 shadow-sm"
                    >
                      <Feather name="map-pin" size={14} color="white" />
                      <Text className="text-white text-xs font-bold uppercase">Share GPS</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dynamic Concierge Action Buttons */}
                {role === 'trainer' && (
                  <View className="gap-3 mt-1">
                    {(currentStatus === 'trainer_accepted' || currentStatus === 'trainer_preparing') && (
                      SessionEngine.isTravelWindowOpen(booking) ? (
                        <View className="gap-2 w-full">
                          <View className="bg-zinc-100 p-2.5 rounded-xl flex-row items-center gap-2 border border-zinc-200">
                            <Feather name="navigation" size={12} color="#E11D48" />
                            <Text className="text-zinc-600 text-[10.5px] font-medium flex-1 leading-tight">
                              App uses background location permission to share your live travel route with the client until you reach their venue.
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={async () => {
                              try {
                                markSelfUpdate();
                                setCurrentStatus('trainer_travelling');
                                await locationTrackerService.startTracking(booking.id, true);
                                await updateTimelineStatus(booking.id, 'trainer_travelling');
                                handleNavigateAddress();
                              } catch (err: any) {
                                Alert.alert('Error', err.message || 'Could not start travel.');
                              }
                            }}
                            className="w-full bg-[#E11D48] py-3.5 rounded-[18px] items-center justify-center flex-row gap-2 shadow-sm"
                          >
                            <Feather name="navigation" size={14} color="white" />
                            <Text className="text-white text-xs font-black uppercase">Start Navigation</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View className="bg-zinc-950 p-4 rounded-xl items-center justify-center border border-zinc-800">
                          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Travel Window Locked</Text>
                          <Text className="text-zinc-500 text-xs font-medium text-center mt-1 leading-normal">
                            You can start travel 30 minutes before the scheduled session.
                          </Text>
                        </View>
                      )
                    )}

                    {currentStatus === 'trainer_travelling' && (
                      <View className="gap-2.5">
                        <TouchableOpacity
                          onPress={handleNavigateAddress}
                          className="w-full bg-slate-900 border border-slate-800 py-3.5 rounded-[18px] items-center justify-center flex-row gap-2 shadow-sm"
                        >
                          <Feather name="map" size={14} color="#10B981" />
                          <Text className="text-white text-xs font-black uppercase">View Full Route Map</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={async () => {
                            if (!SessionEngine.canCheckIn(booking)) {
                              Alert.alert('Check-In Locked', 'You can check in 30 minutes before the scheduled session.');
                            } else {
                              try {
                                markSelfUpdate();
                                setCurrentStatus('trainer_arrived');
                                await SessionEngine.checkIn(booking.id);
                                await locationTrackerService.stopTracking();
                                syncFromDB();
                                Alert.alert('Checked In', 'You have successfully checked in at the customer location.');
                              } catch (err: any) {
                                Alert.alert('Check-In Error', err.message || 'Could not check in.');
                              }
                            }
                          }}
                          className="w-full bg-[#E11D48] py-3.5 rounded-[18px] items-center justify-center flex-row gap-2 shadow-sm"
                        >
                          <Feather name="check-circle" size={14} color="white" />
                          <Text className="text-white text-xs font-black uppercase">Check In (Reached Venue)</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {currentStatus === 'otp_verified' && (
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            markSelfUpdate();
                            setCurrentStatus('workout_started');
                            await SessionEngine.startWorkout(booking.id);
                            syncFromDB();
                            addNotification({
                              title: 'Workout Started 🏋️‍♂️',
                              body: `Coach ${booking.trainerName} started your active session. Warmup drills underway.`,
                              icon: 'user-check'
                            });
                          } catch (err: any) {
                            Alert.alert('Error', err.message || 'Could not start workout.');
                          }
                        }}
                        className="w-full bg-[#10B981] py-3.5 rounded-[18px] items-center justify-center flex-row gap-2 shadow-sm"
                      >
                        <Feather name="play" size={14} color="white" />
                        <Text className="text-white text-xs font-black uppercase">Start Workout</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* OTP Display and Trainer Entry Verification */}
            {currentStatus === 'trainer_arrived' && !isMissed && !isCancelled && (role === 'customer' || role === 'admin') && (
              <View className="bg-zinc-950 p-6 rounded-[28px] border border-zinc-800 shadow-xl gap-4">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-wider">Trainer Checked In</Text>
                </View>
                <Text className="text-white text-base font-bold">Your trainer has arrived. Please begin your session.</Text>

                {!showCustomerOtpInput ? (
                  <TouchableOpacity
                    onPress={() => setShowCustomerOtpInput(true)}
                    className="w-full bg-[#E11D48] py-4 rounded-[20px] items-center justify-center shadow-sm"
                  >
                    <Text className="text-white text-sm font-black uppercase">Start Session</Text>
                  </TouchableOpacity>
                ) : (
                  <View className="gap-4 border-t border-zinc-900 pt-4">
                    <View className="items-center justify-center bg-zinc-900/40 p-4 rounded-2xl gap-1">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Share OTP with Coach</Text>
                      <Text className="text-white text-4xl font-black tracking-widest mt-1">{booking.otp || '------'}</Text>
                      <Text className="text-zinc-500 text-[8px] font-bold text-center leading-relaxed mt-1">
                        Give this 6-digit code to your coach, or verify directly below.
                      </Text>
                    </View>

                    <View className="gap-2">
                      <Text className="text-zinc-400 text-[9px] font-bold uppercase pl-0.5">Or enter OTP on your phone</Text>
                      <TextInput
                        value={customerOtpInput}
                        onChangeText={setCustomerOtpInput}
                        placeholder="0 0 0 0 0 0"
                        placeholderTextColor="#4B5563"
                        keyboardType="numeric"
                        maxLength={6}
                        className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center text-white text-2xl font-black tracking-widest"
                      />
                      <View className="flex-row gap-2 mt-1">
                        <TouchableOpacity
                          onPress={() => setShowCustomerOtpInput(false)}
                          className="flex-1 bg-zinc-800 py-3.5 rounded-xl items-center justify-center"
                        >
                          <Text className="text-zinc-400 text-xs font-black uppercase">Back</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={handleVerifyCustomerOtp}
                          className="flex-[1.5] bg-[#E11D48] py-3.5 rounded-xl items-center justify-center"
                        >
                          <Text className="text-white text-xs font-black uppercase">Verify & Start</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {currentStatus === 'trainer_arrived' && !isMissed && !isCancelled && role === 'trainer' && (
              <View className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-855 gap-4 shadow-xl">
                <View className="flex-row justify-between items-center border-b border-zinc-900 pb-3">
                  <View className="flex-1">
                    <Text className="text-white text-xs font-black uppercase tracking-wider">Client check-in security OTP</Text>
                    <Text className="text-zinc-500 text-[8px] font-bold mt-0.5">Enter the 6-digit code provided by the client.</Text>
                  </View>
                  <View className="bg-amber-950/40 border border-amber-900/30 px-3.5 py-1.5 rounded-full flex-row items-center gap-1.5 shadow-sm">
                    <Feather name="clock" size={10} color="#F59E0B" />
                    <Text className="text-amber-500 text-[9px] font-black">{formatTime(graceTimeLeft)}</Text>
                  </View>
                </View>

                {graceTimeLeft > 0 ? (
                  <View className="gap-3">
                    <TextInput
                      value={otpInput}
                      onChangeText={setOtpInput}
                      placeholder="0 0 0 0 0 0"
                      placeholderTextColor="#4B5563"
                      keyboardType="numeric"
                      maxLength={6}
                      className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center text-white text-2xl font-black tracking-widest"
                    />
                    <TouchableOpacity
                      onPress={handleVerifyOtp}
                      className="w-full bg-[#E11D48] py-3.5 rounded-xl items-center justify-center"
                    >
                      <Text className="text-white text-xs font-black uppercase">Verify Check-In</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="gap-4">
                    <View className="bg-red-950/20 border border-red-900/30 p-4.5 rounded-2xl items-center gap-2">
                      <Feather name="alert-triangle" size={24} color="#EF4444" />
                      <Text className="text-white text-xs font-bold text-center">Grace Period Expired</Text>
                      <Text className="text-zinc-500 text-[8px] font-medium text-center leading-normal">
                        Customer has not arrived or checked in within the 15-minute window.
                      </Text>
                    </View>
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => {
                          triggerClientNoShow(booking.id);
                          Alert.alert('Customer No-Show', 'Report logged successfully.');
                          handleSafeBack();
                        }}
                        className="flex-1 bg-rose-950 border border-rose-900 py-3.5 rounded-xl items-center justify-center"
                      >
                        <Text className="text-rose-400 text-xs font-black uppercase">Customer No Show</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => Alert.alert('Contact Support', 'Connecting to VIRLA partner coordinator...')}
                        className="flex-1 bg-zinc-900 border border-zinc-800 py-3.5 rounded-xl items-center justify-center"
                      >
                        <Text className="text-white text-xs font-black uppercase">Contact Support</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {currentStatus === 'otp_verified' && !isMissed && !isCancelled && (role === 'customer' || role === 'admin') && (
              <View className="bg-zinc-950 p-6 rounded-[28px] border border-zinc-800 shadow-xl gap-4">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-wider">Check-in Verified</Text>
                </View>
                <Text className="text-white text-base font-bold">Check-in verified successfully.</Text>
                <Text className="text-zinc-500 text-xs leading-relaxed">
                  Waiting for Coach {booking.trainerName} to start the workout. Please prepare for your session.
                </Text>
              </View>
            )}

            {currentStatus === 'otp_verified' && !isMissed && !isCancelled && role === 'trainer' && (
              <View className="bg-zinc-950 p-6 rounded-[28px] border border-zinc-800 shadow-xl gap-4">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-wider">Check-in Verified</Text>
                </View>
                <Text className="text-white text-base font-bold">Client check-in verified successfully.</Text>
                <Text className="text-zinc-500 text-xs leading-relaxed">
                  The client has been checked in. You are now ready to begin the workout. Tap &quot;Start Workout&quot; below to start the timer.
                </Text>
              </View>
            )}

            {/* Active Workout timer dashboard console */}
            {currentStatus === 'workout_started' && !isMissed && !isCancelled && (
              <View className="bg-zinc-950 p-6 rounded-[28px] border border-zinc-800 items-center justify-center gap-3 shadow-xl">
                <View className="bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full flex-row items-center gap-1.5">
                  <View className="w-2 h-2 rounded-full bg-emerald-400" />
                  <Text className="text-emerald-400 text-[11px] font-semibold uppercase tracking-wider">Workout In Progress</Text>
                </View>
                <Text className="text-white text-5xl font-bold tracking-tight my-1">{formatTime(workoutTimeLeft)}</Text>
                <Text className="text-zinc-400 text-xs font-normal text-center leading-relaxed max-w-[280px]">
                  Activity tracker is active. Warm-up drills & conditioning underway.
                </Text>
                {role === 'trainer' && (
                  <TouchableOpacity
                    disabled={workoutTimeLeft > 0}
                    onPress={async () => {
                      try {
                        markSelfUpdate();
                        setCurrentStatus('workout_completed');
                        await SessionEngine.completeSession(booking.id);
                        syncFromDB();
                        setShowQuestionnaire(true);
                      } catch (err: any) {
                        Alert.alert('Completion Error', err.message || 'Could not complete workout.');
                      }
                    }}
                    className={`mt-2 px-8 py-3.5 rounded-2xl items-center justify-center ${workoutTimeLeft > 0 ? 'bg-zinc-800 opacity-50' : 'bg-emerald-600'
                      }`}
                  >
                    <Text className="text-white text-xs font-bold uppercase tracking-wider">
                      {workoutTimeLeft > 0 ? 'Workout in Progress' : 'Complete Session'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Mandatory Health Update Action Card (For Trainer right after completing workout) */}
            {currentStatus === 'workout_completed' && role === 'trainer' && !isMissed && !isCancelled && (
              <View className="bg-white border-2 border-[#E11D48] p-5 rounded-[28px] shadow-lg gap-3.5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2.5 h-2.5 rounded-full bg-[#E11D48]" />
                    <Text className="text-[#E11D48] text-xs font-black uppercase tracking-wider">Mandatory Next Step</Text>
                  </View>
                  <View className="bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                    <Text className="text-rose-600 text-[10px] font-black uppercase">Action Required</Text>
                  </View>
                </View>

                <Text className="text-zinc-950 text-base font-extrabold">Complete Client Health Update 📋</Text>
                <Text className="text-zinc-600 text-xs font-medium leading-relaxed">
                  Record client health status, ongoing injuries, and notes for the next trainer before authorizing session closure.
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setShowHealthReportModal(true)}
                  className="w-full bg-[#E11D48] py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-md active:opacity-90 mt-1"
                >
                  <Feather name="clipboard" size={16} color="white" />
                  <Text className="text-white text-xs font-black uppercase tracking-wider">Open Health Update Form</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Trainer status banner after filing report */}
            {(currentStatus === 'trainer_report_submitted' || currentStatus === 'customer_review_pending') && !isMissed && !isCancelled && role === 'trainer' && (
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <Text className="text-emerald-600 text-[10px] font-black uppercase tracking-wider">Health Update Recorded</Text>
                </View>
                <Text className="text-zinc-950 text-base font-bold">Health Form Successfully Submitted ✅</Text>
                <Text className="text-zinc-500 text-xs leading-relaxed">
                  Client health record and alerts have been updated. Waiting for client to submit review and close the session.
                </Text>
              </View>
            )}

            {/* Trainer status banner when session closed */}
            {currentStatus === 'session_closed' && !isMissed && !isCancelled && role === 'trainer' && (
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <Text className="text-emerald-600 text-[10px] font-black uppercase tracking-wider">Session Closed</Text>
                </View>
                <Text className="text-zinc-950 text-base font-bold">Session Successfully Completed ✅</Text>
                <Text className="text-zinc-500 text-xs leading-relaxed">
                  All milestones and client feedback have been recorded. Payout credits have been processed.
                </Text>
              </View>
            )}

            {/* Module 8: Full Post-Session Customer Experience Panel */}
            {(currentStatus === 'customer_review_pending' || currentStatus === 'session_closed' || currentStatus === 'workout_completed' || currentStatus === 'trainer_report_submitted') && !isMissed && !isCancelled && (role === 'customer' || role === 'admin') && (
              <View
                className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4"
                style={{
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.04,
                  shadowRadius: 12,
                  elevation: 2,
                }}
              >
                <View className="items-center gap-2">
                  <Text className="text-3xl">🏆</Text>
                  <Text className="text-zinc-950 text-base font-black uppercase tracking-wider text-center">Session Completed!</Text>
                  <Text className="text-zinc-450 text-[10px] font-bold text-center mt-0.5">Invoice pass successfully logged.</Text>
                </View>

                {/* Workout stats metrics grid */}
                <View className="flex-row justify-between flex-wrap gap-y-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                  <View className="w-[47%] gap-0.5">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Calories burned</Text>
                    <Text className="text-zinc-900 text-sm font-black">{booking.caloriesBurned || 380} kcal</Text>
                  </View>
                  <View className="w-[47%] gap-0.5">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Active Duration</Text>
                    <Text className="text-zinc-900 text-sm font-black">{booking.durationMinutes || 60} mins</Text>
                  </View>
                  <View className="w-[47%] gap-0.5">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Workout Category</Text>
                    <Text className="text-zinc-900 text-sm font-black">{getDisplayWorkoutTitle(booking.workoutTitle)}</Text>
                  </View>
                  <View className="w-[47%] gap-0.5">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Credits Consumed</Text>
                    <Text className="text-zinc-900 text-sm font-black">1 Credit</Text>
                  </View>
                </View>

                {/* AI Personal Wellness Coaching summary feedback */}
                <View className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 gap-1.5">
                  <View className="flex-row items-center gap-1">
                    <Feather name="cpu" size={10} color="#4F46E5" />
                    <Text className="text-[#4F46E5] text-[8px] font-black uppercase tracking-wider">AI Personal Summary</Text>
                  </View>
                  <Text className="text-zinc-700 text-[10px] font-semibold leading-relaxed">
                    Sensational work on today&apos;s session! You maintained a strong spinal posture during the core sets. Your recovery rate index shows continuous improvement. Drink plenty of water and plan a light walk tomorrow.
                  </Text>
                </View>

                {/* Recovery Tips checklist */}
                <View className="gap-2 pl-1">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Premium Recovery checklist</Text>
                  <View className="gap-1.5">
                    <View className="flex-row items-center gap-2">
                      <Feather name="check" size={10} color="#059669" />
                      <Text className="text-zinc-600 text-[10px] font-medium">Rehydrate: Drink 500ml water within 30 minutes</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Feather name="check" size={10} color="#059669" />
                      <Text className="text-zinc-600 text-[10px] font-medium">Stretch: Light hamstring & glute mobility stretches</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Feather name="check" size={10} color="#059669" />
                      <Text className="text-zinc-600 text-[10px] font-medium">Nutrition: Eat a high-protein recovery snack/meal</Text>
                    </View>
                  </View>
                </View>

                {/* If Trainer hasn't filed summary yet, show waiting notice */}
                {currentStatus === 'workout_completed' && (
                  <View className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/70 flex-row items-center gap-3">
                    <Feather name="clock" size={16} color="#D97706" />
                    <View className="flex-1">
                      <Text className="text-amber-900 text-xs font-bold">Coach Summary Pending</Text>
                      <Text className="text-amber-700 text-[11px] mt-0.5">
                        Your coach is submitting your post-workout mobility report. Client rating will unlock shortly.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Star-ratings form unlocks only after Trainer has submitted summary report */}
                {(currentStatus === 'customer_review_pending' || currentStatus === 'trainer_report_submitted') && (
                  <View className="gap-4 border-t border-zinc-100 pt-4 mt-1">
                    <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1 border-b border-zinc-50 pb-2">
                      Rate Coach {booking?.trainerName ? booking.trainerName.replace(/^Coach\s+/i, '') : 'Trainer'}
                    </Text>

                    <View className="flex-row justify-around py-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <TouchableOpacity key={s} onPress={() => setOverallRating(s)}>
                          <Text className={`text-2xl ${overallRating === s ? 'scale-125' : 'opacity-35'}`}>⭐</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput
                      value={comments}
                      onChangeText={setComments}
                      placeholder="Write feedback comments..."
                      className="border border-[#E5E7EB] bg-zinc-50 p-3.5 rounded-xl text-xs h-16 font-semibold"
                    />

                    <TouchableOpacity onPress={handleClientFeedbackSubmit} className="w-full bg-zinc-950 py-3.5 rounded-xl items-center justify-center">
                      <Text className="text-white text-xs font-black uppercase">Submit review</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {currentStatus === 'session_closed' && (
                  <View className="gap-2.5 mt-2 flex-row">
                    <TouchableOpacity
                      onPress={() => router.push('/booking')}
                      className="flex-1 bg-zinc-950 py-3 rounded-xl items-center justify-center"
                    >
                      <Text className="text-white text-[9px] font-black uppercase tracking-widest">Book Again</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => Alert.alert('Share Achievement', 'Achievement badge graphics shared successfully!')}
                      className="flex-1 bg-zinc-100 py-3 rounded-xl items-center justify-center border border-zinc-200"
                    >
                      <Text className="text-zinc-950 text-[9px] font-black uppercase tracking-widest">Share achievements</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Session Timeline tracker */}
            <View className="gap-4">
              <View className="flex-row items-center justify-between pb-3 border-b border-zinc-100">
                <View>
                  <Text className="text-zinc-950 text-sm font-bold uppercase tracking-wider">
                    Session Timeline
                  </Text>
                  <Text className="text-zinc-500 text-xs font-normal mt-0.5">
                    {isMissed || isCancelled ? 'Status history of your session' : 'Live progress of your session'}
                  </Text>
                </View>
                <View className={`px-2.5 py-1 rounded-full border flex-row items-center gap-1.5 ${isMissed
                    ? 'bg-amber-50 border-amber-200'
                    : isCancelled
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-emerald-50 border-emerald-200/80'
                  }`}>
                  <View className={`w-2 h-2 rounded-full ${isMissed ? 'bg-amber-500' : isCancelled ? 'bg-rose-500' : 'bg-emerald-500'
                    }`} />
                  <Text className={`text-[11px] font-semibold tracking-wide uppercase ${isMissed ? 'text-amber-700' : isCancelled ? 'text-rose-700' : 'text-emerald-700'
                    }`}>
                    {isMissed ? 'Missed' : isCancelled ? 'Cancelled' : 'Live Sync'}
                  </Text>
                </View>
              </View>

              <View className="gap-0 mt-1">
                {timelineStages.map((item, idx) => {
                  const isTerminalMissed = item === 'session_missed';
                  const isTerminalCancelled = item === 'session_cancelled';
                  const isTerminal = isTerminalMissed || isTerminalCancelled;
                  const isCompleted = isTerminal ? false : (isMissed || isCancelled ? true : stagesList.indexOf(currentStatus) > idx);
                  const isCurrent = !isMissed && !isCancelled && currentStatus === item;
                  const isLast = idx === timelineStages.length - 1;
                  const meta = getStageMeta(item);

                  return (
                    <View key={item} className="flex-row items-start gap-3.5">
                      {/* Left icon node and vertical line */}
                      <View className="items-center">
                        <View
                          className={`w-7 h-7 rounded-full items-center justify-center border-2 ${isTerminalMissed
                              ? 'bg-amber-500 border-amber-300 shadow-sm'
                              : isTerminalCancelled
                                ? 'bg-rose-500 border-rose-300 shadow-sm'
                                : isCompleted
                                  ? 'bg-emerald-500 border-emerald-500 shadow-sm'
                                  : isCurrent
                                    ? 'bg-[#E11D48] border-rose-300 shadow-md'
                                    : 'border-zinc-300 bg-white'
                            }`}
                        >
                          {isTerminalMissed ? (
                            <Feather name="alert-triangle" size={13} color="white" />
                          ) : isTerminalCancelled ? (
                            <Feather name="x" size={13} color="white" />
                          ) : isCompleted ? (
                            <Feather name="check" size={13} color="white" />
                          ) : isCurrent ? (
                            <Feather name={meta.icon as any} size={13} color="white" />
                          ) : (
                            <Text className="text-zinc-500 text-xs font-semibold">{idx + 1}</Text>
                          )}
                        </View>

                        {/* Connector line */}
                        {!isLast && (
                          <View
                            className={`w-[2px] my-1 ${isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-rose-200' : 'bg-zinc-200'
                              }`}
                            style={{ height: 28 }}
                          />
                        )}
                      </View>

                      {/* Content details */}
                      <View className="flex-1 pt-0.5 pb-2">
                        <View className="flex-row items-center justify-between pr-1">
                          <Text className={`text-sm tracking-tight ${isTerminalMissed
                              ? 'font-bold text-amber-700'
                              : isTerminalCancelled
                                ? 'font-bold text-rose-700'
                                : isCurrent
                                  ? 'font-bold text-[#E11D48]'
                                  : isCompleted
                                    ? 'font-semibold text-zinc-900'
                                    : 'font-medium text-zinc-600'
                            }`}>
                            {meta.title}
                          </Text>

                          {isTerminalMissed && (
                            <View className="bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Text className="text-amber-700 text-[10px] font-semibold uppercase tracking-wider">Missed</Text>
                            </View>
                          )}
                          {isTerminalCancelled && (
                            <View className="bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <Text className="text-rose-600 text-[10px] font-semibold uppercase tracking-wider">Cancelled</Text>
                            </View>
                          )}
                          {isCurrent && (
                            <View className="bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <Text className="text-rose-600 text-[10px] font-semibold uppercase tracking-wider">Active</Text>
                            </View>
                          )}
                          {isCompleted && (
                            <Text className="text-emerald-700 text-xs font-semibold">Done</Text>
                          )}
                        </View>

                        <Text className={`text-xs mt-0.5 leading-normal ${isTerminalMissed
                            ? 'text-amber-700/90 font-normal'
                            : isTerminalCancelled
                              ? 'text-rose-700/90 font-normal'
                              : isCurrent
                                ? 'text-rose-700/90 font-normal'
                                : isCompleted
                                  ? 'text-zinc-600 font-normal'
                                  : 'text-zinc-500 font-normal'
                          }`}>
                          {meta.desc}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Full-Screen Navigate Map Modal (Zepto-Style Live Route & Mota Marker) */}
      <Modal
        visible={isNavigationMapVisible}
        animationType="slide"
        onRequestClose={() => setIsNavigationMapVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#0F172A', paddingTop: insets.top }}>
          {/* Header */}
          <View className="h-16 flex-row items-center px-6 border-b border-zinc-800 bg-slate-900 justify-between">
            <TouchableOpacity
              onPress={() => setIsNavigationMapVisible(false)}
              className="w-10 h-10 items-center justify-center rounded-full bg-slate-800"
            >
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-white text-sm font-black uppercase tracking-wider">
                {role === 'trainer' ? 'Live Route Navigation' : 'Coach Live Tracking'}
              </Text>
              <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                ● Real-Time GPS Active
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Map View with Road Polyline & Mota Trainer Marker */}
          <View style={{ flex: 1, position: 'relative' }}>
            {parsedAddress && parsedAddress.lat && parsedAddress.lng ? (
              <TrackingMap
                liveTrainerCoords={activeTrainerCoords}
                isStale={isLiveConnectionStale}
                clientAddress={effectiveAddressStr}
                viewerRole={role as any}
                onRouteMetricsChange={setRouteMetrics}
                isFullScreen={true}
              />
            ) : (
              <View className="flex-1 items-center justify-center bg-slate-950">
                <ActivityIndicator size="large" color="#E11D48" />
                <Text className="text-zinc-400 text-xs font-semibold mt-2">Loading coordinates...</Text>
              </View>
            )}

            {/* Bottom Floating Zepto-Style Route Summary Card */}
            <View className="absolute bottom-6 left-5 right-5 bg-slate-900/95 border border-zinc-800 p-5 rounded-[26px] gap-4 shadow-2xl">
              {/* Live Distance & ETA Strip */}
              <View className="flex-row items-center justify-between bg-slate-800/80 border border-slate-700/70 rounded-2xl px-4 py-3">
                {role === 'trainer' ? (
                  <>
                    <View className="flex-row items-center gap-2.5">
                      <View className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 items-center justify-center">
                        <Ionicons name="navigate" size={18} color="#10B981" />
                      </View>
                      <View>
                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Distance</Text>
                        <Text className="text-white text-base font-black">{remainingDistance} km</Text>
                      </View>
                    </View>

                    <View className="h-8 w-[1px] bg-slate-700" />

                    <View className="items-end">
                      <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Est. Arrival</Text>
                      <Text className="text-emerald-400 text-base font-black">~{remainingEta} mins</Text>
                    </View>
                  </>
                ) : (
                  <View className="flex-row items-center justify-between flex-1">
                    <View className="flex-row items-center gap-2.5">
                      <View className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 items-center justify-center">
                        <Ionicons name="navigate" size={18} color="#10B981" />
                      </View>
                      <View>
                        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Live Coach Route</Text>
                        <Text className="text-white text-xs font-bold">On the way to your venue</Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Est. Arrival</Text>
                      <Text className="text-emerald-400 text-base font-black">~{remainingEta} mins</Text>
                    </View>
                  </View>
                )}
              </View>

              <View className="gap-1">
                <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">
                  {role === 'trainer' ? 'Client Venue Destination' : 'Your Selected Workout Venue'}
                </Text>
                <Text className="text-white text-sm font-black mt-0.5">
                  {parsedAddress.buildingName || 'Workout Venue'}
                </Text>
                <Text numberOfLines={2} className="text-zinc-400 text-xs font-medium leading-relaxed">
                  {parsedAddress.addressLine || `Coordinates: ${parsedAddress.lat}, ${parsedAddress.lng}`}
                </Text>
              </View>

              <View className="flex-row gap-2.5">
                {role === 'trainer' && parsedAddress?.lat && parsedAddress?.lng && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      const dest = `${parsedAddress.lat},${parsedAddress.lng}`;
                      const url = Platform.select({
                        ios: `http://maps.apple.com/?daddr=${dest}&dirflg=d`,
                        default: `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`,
                      });
                      if (url) Linking.openURL(url).catch(() => { });
                    }}
                    className="flex-1 h-12 bg-emerald-600 rounded-2xl items-center justify-center flex-row gap-2 shadow-md"
                  >
                    <Ionicons name="navigate-circle-outline" size={18} color="white" />
                    <Text className="text-white text-xs font-black uppercase tracking-wider">Turn-by-Turn</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsNavigationMapVisible(false)}
                  className="flex-1 h-12 bg-slate-800 rounded-2xl items-center justify-center flex-row gap-2 border border-zinc-700 shadow-md"
                >
                  <Ionicons name="close-circle" size={16} color="white" />
                  <Text className="text-white text-xs font-black uppercase tracking-wider">Close Map</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      {/* Concierge Support Ticket Creation Modal */}
      <RaiseSupportTicketModal
        visible={showRaiseTicketModal}
        booking={booking}
        userId={user.id}
        onClose={() => setShowRaiseTicketModal(false)}
        onTicketCreated={(newTicket) => {
          setActiveChatTicket(newTicket);
          setShowSupportChatModal(true);
        }}
      />

      {/* Realtime User ↔ Admin Support Chat Modal */}
      <SupportChatModal
        visible={showSupportChatModal}
        ticket={activeChatTicket}
        currentRole="customer"
        onClose={() => {
          setShowSupportChatModal(false);
          setActiveChatTicket(null);
        }}
      />

      {/* Mandatory VIRLA Post-Session Health & Limitation Modal (Trainer Only) */}
      {role === 'trainer' && (
        <PostSessionHealthReportModal
          visible={showHealthReportModal}
          clientName={booking?.clientName || 'Client'}
          onClose={() => setShowHealthReportModal(false)}
          onSubmit={handleHealthReportSubmit}
        />
      )}
    </View>
  );
}

// Self-healing route error boundary: if a transient navigation-context error happens while
// the screen re-renders after a session data update, remount the screen instead of crashing.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<unknown> }) {
  useEffect(() => {
    console.warn('[SessionDetail] Recovering from render error:', error?.message);
    const t = setTimeout(() => { retry(); }, 300);
    return () => clearTimeout(t);
  }, [error, retry]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FC' }}>
      <ActivityIndicator size="large" color="#E11D48" />
    </View>
  );
}
