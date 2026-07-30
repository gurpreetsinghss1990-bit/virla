import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, TextInput, Alert, Animated, Platform, KeyboardAvoidingView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserStore } from '../store/userStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { SkeletonLoader } from '../components/SkeletonLoader';

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
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { 
    bookings, 
    updateTimelineStatus, 
    updateBookingRating, 
    triggerClientNoShow, 
    triggerTrainerNoShow, 
    submitQuestionnaire 
  } = useBookingStore();
  
  const { addNotification } = useNotificationStore();
  const { role } = useUserStore();
  const { syncFromDB: syncProfile } = useUserProfileStore();

  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Tracking simulator state variables
  const [journeyProgress, setJourneyProgress] = useState(0); // 0.0 to 1.0
  const [simIntervalId, setSimIntervalId] = useState<any>(null);

  // Fallback status alignment for 12-stage timeline
  const currentStatus = booking?.timelineStatus || 'booked';
  
  const isPendingDetails = (role === 'customer' || role === 'admin') && 
    (currentStatus === 'booked' || currentStatus === 'trainer_assigned');

  // Input & Questionnaire state variables
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

  // Pulse scales and animations
  const pulseScale = useMemo(() => new Animated.Value(1), []);

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
    // Stage pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();

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
  }, [currentStatus, pulseScale]);

  // Automated travel simulation
  const startTravelSimulation = () => {
    if (simIntervalId) clearInterval(simIntervalId);
    setJourneyProgress(0);
    updateTimelineStatus(booking.id, 'trainer_travelling');

    const interval = setInterval(() => {
      setJourneyProgress(prev => {
        const next = prev + 0.02;
        if (next >= 1.0) {
          clearInterval(interval);
          setSimIntervalId(null);
          // Automatically transition to Arrived
          setTimeout(() => {
            updateTimelineStatus(booking.id, 'trainer_arrived');
          }, 800);
          return 1.0;
        }
        return next;
      });
    }, 300); // Takes ~15s to complete journey simulation
    setSimIntervalId(interval);
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
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-zinc-900 px-6 py-2 rounded-full">
          <Text className="text-white font-bold text-xs">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Verification actions with double safeguards
  const handleVerifyOtp = () => {
    if (otpInput === booking.otp) {
      Alert.alert(
        'Confirm Check-In',
        'Are you sure you want to verify check-in and start the active session?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Start Session',
            onPress: () => {
              updateTimelineStatus(booking.id, 'otp_verified');
              addNotification({
                title: 'Check-in Verified 🔓',
                body: 'Secure OTP entry code check completed. Initiating workout active timer.',
                icon: 'lock'
              });
              setOtpInput('');
              
              // Automatically advance to workout started
              setTimeout(() => {
                updateTimelineStatus(booking.id, 'workout_started');
                addNotification({
                  title: 'Workout Started 🏋️‍♂️',
                  body: `Coach ${booking.trainerName} started your active session. Warmup drills underway.`,
                  icon: 'user-check'
                });
              }, 500);
            }
          }
        ]
      );
    } else {
      Alert.alert('Verification Failed', 'The security OTP code does not match the client\'s check-in pin.');
    }
  };

  // Submit report questionnaire
  const handleQuestionnaireSubmit = () => {
    if (!coachSignature.trim()) {
      Alert.alert('Signature Required', 'Please input your digital signature to authorize report closure.');
      return;
    }
    submitQuestionnaire(booking.id, {
      mobilityScore,
      workoutSummary,
      coachNotes: coachNotes.trim() || 'Client executed exercises with excellent range of motion.',
      coachSignature: coachSignature.trim(),
    });
    // Set to report submitted and advance to feedback pending
    updateTimelineStatus(booking.id, 'trainer_report_submitted');
    addNotification({
      title: 'Workout Completed 🏆',
      body: `Coach ${booking.trainerName} submitted your post-workout mobility index report.`,
      icon: 'award'
    });

    setTimeout(() => {
      updateTimelineStatus(booking.id, 'customer_review_pending');
      addNotification({
        title: 'Rate Session Experience 🌟',
        body: 'Please leave a rating and share your post-workout feedback.',
        icon: 'bell'
      });
    }, 600);

    setShowQuestionnaire(false);
  };

  // User Rating review submit
  const handleClientFeedbackSubmit = () => {
    updateBookingRating(booking.id, {
      overallRating,
      trainerRating,
      workoutRating,
      difficulty,
      energy,
      comments: comments.trim(),
    });
    updateTimelineStatus(booking.id, 'session_closed');
    addNotification({
      title: 'Session Closed successfully ✅',
      body: 'Thank you! Rating details saved and transaction invoice closed.',
      icon: 'check-circle'
    });
    syncProfile();
  };

  // Call mock simulator
  const handleCall = () => {
    Alert.alert(
      'Simulating Secure Call',
      `Connecting encrypted line to ${role === 'trainer' ? 'Client' : `Coach ${booking.trainerName}`} (+91 99999 88888)...`
    );
  };

  const handleMessage = () => {
    router.push({
      pathname: '/communication' as any,
      params: { id: booking.id }
    });
  };

  const handleShareLocation = () => {
    Alert.alert(
      'Live Location Shared',
      'Your real-time GPS coordinate route is now visible to the coach.'
    );
  };

  const handleSOS = () => {
    Alert.alert(
      '🚨 SOS Emergency Support',
      'Emergency support initiated. Dispatching local response units and alerting emergency contact (Neha Sharma: +91 98200 11223).'
    );
  };

  const handleNavigateAddress = () => {
    const query = encodeURIComponent(booking.address || 'Mumbai, Maharashtra');
    const url = Platform.select({
      ios: `maps://?q=${query}`,
      android: `geo:0,0?q=${query}`
    }) || `https://maps.google.com/?q=${query}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Navigation Error', 'Could not open map navigation services.');
    });
  };

  const remainingDistance = (3.2 * (1 - journeyProgress)).toFixed(1);
  const remainingEta = Math.max(0, Math.ceil(12 * (1 - journeyProgress)));

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FC', paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#101828" />
        </TouchableOpacity>
        <Text className="text-[#101828] text-xs font-black uppercase tracking-widest">
          {role === 'trainer' ? 'Coach Console' : 'Premium Concierge Pass'}
        </Text>
        <TouchableOpacity onPress={handleSOS} className="bg-red-50 px-3.5 py-1.5 rounded-full border border-red-100">
          <Text className="text-red-600 text-[8px] font-black uppercase tracking-wider">SOS Support</Text>
        </TouchableOpacity>
      </View>

      {/* Developer Push Simulator (Floating Top Tray) */}
      <View className="bg-zinc-950 p-3.5 border-b border-zinc-800 gap-2">
        <Text className="text-amber-500 text-[8px] font-black uppercase tracking-wider pl-2.5">Developer Push Simulator</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 pl-2">
          {currentStatus === 'trainer_assigned' && role === 'trainer' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => updateTimelineStatus(booking.id, 'trainer_accepted')}
              className="px-3.5 py-1.5 bg-indigo-600 rounded-xl"
            >
              <Text className="text-white text-[7px] font-black uppercase">Simulate Accept</Text>
            </TouchableOpacity>
          )}

          {currentStatus === 'trainer_accepted' && role === 'trainer' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => updateTimelineStatus(booking.id, 'trainer_preparing')}
              className="px-3.5 py-1.5 bg-indigo-600 rounded-xl"
            >
              <Text className="text-white text-[7px] font-black uppercase">Simulate Prep Gear</Text>
            </TouchableOpacity>
          )}

          {currentStatus === 'trainer_preparing' && role === 'trainer' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={startTravelSimulation}
              className="px-3.5 py-1.5 bg-green-600 rounded-xl"
            >
              <Text className="text-white text-[7px] font-black uppercase">Simulate Start Journey</Text>
            </TouchableOpacity>
          )}

          {currentStatus === 'trainer_travelling' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (simIntervalId) clearInterval(simIntervalId);
                setJourneyProgress(1.0);
                updateTimelineStatus(booking.id, 'trainer_arrived');
              }}
              className="px-3.5 py-1.5 bg-green-600 rounded-xl"
            >
              <Text className="text-white text-[7px] font-black uppercase">Skip to Arrived</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => triggerClientNoShow(booking.id)}
            className="px-3.5 py-1.5 bg-rose-600 rounded-xl"
          >
            <Text className="text-white text-[7px] font-black uppercase">Client No-Show</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => triggerTrainerNoShow(booking.id)}
            className="px-3.5 py-1.5 bg-rose-600 rounded-xl"
          >
            <Text className="text-white text-[7px] font-black uppercase">Trainer No-Show</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 100 }}>
          <View className="gap-5">

            {/* Stage Banner Overlay */}
            <View className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-sm flex-row items-center gap-3">
              <View className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <View className="flex-1">
                <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Active Concierge Status</Text>
                <Text className="text-[#101828] text-sm font-black mt-0.5 capitalize">{currentStatus.replace(/_/g, ' ')}</Text>
              </View>
            </View>

            {/* Module 2: Premium Animated SVG Live Map */}
            {(currentStatus === 'trainer_travelling' || currentStatus === 'trainer_arrived') && (
              <View className="bg-slate-950 border border-slate-900 rounded-[28px] overflow-hidden shadow-md">
                <View className="p-4.5 border-b border-slate-900 flex-row justify-between items-center bg-slate-900/40">
                  <View>
                    <Text className="text-slate-400 text-[8px] font-black uppercase tracking-wider">Live Tracking Feed</Text>
                    <Text className="text-white text-xs font-bold mt-0.5">
                      {currentStatus === 'trainer_travelling' ? 'Coach on the way' : 'Coach arrived at your gate'}
                    </Text>
                  </View>
                  <View className="bg-[#E11D48]/15 px-2.5 py-1 rounded-full border border-[#E11D48]/20">
                    <Text className="text-[#E11D48] text-[8px] font-black uppercase tracking-wider">LIVE GPS</Text>
                  </View>
                </View>

                {/* SVG Visual Canvas Map */}
                <View className="h-44 items-center justify-center relative bg-slate-950">
                  <Svg width="300" height="180" viewBox="0 0 300 180">
                    {/* Dark Street Layout lines */}
                    <Path d="M 0,30 L 300,30" stroke="#1E293B" strokeWidth="2.5" />
                    <Path d="M 0,90 L 300,90" stroke="#1E293B" strokeWidth="2.5" />
                    <Path d="M 0,150 L 300,150" stroke="#1E293B" strokeWidth="2.5" />
                    <Path d="M 60,0 L 60,180" stroke="#1E293B" strokeWidth="2.5" />
                    <Path d="M 150,0 L 150,180" stroke="#1E293B" strokeWidth="2.5" />
                    <Path d="M 240,0 L 240,180" stroke="#1E293B" strokeWidth="2.5" />
                    
                    {/* Landmark Details */}
                    <Circle cx="100" cy="50" r="14" fill="#0F172A" stroke="#1E293B" strokeWidth="1" />
                    <Path d="M 97,46 L 103,46 M 97,50 L 103,50 M 97,54 L 103,54" stroke="#475569" strokeWidth="1" />
                    
                    {/* Polyline Route Path */}
                    <Path 
                      d="M 35,145 L 80,110 L 140,120 L 200,70 L 265,45" 
                      stroke="#4F46E5" 
                      strokeWidth="3.5" 
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="6 4"
                    />

                    {/* Customer Home Pin */}
                    <Circle cx="265" cy="45" r="7" fill="#4F46E5" />
                    <Circle cx="265" cy="45" r="13" fill="none" stroke="#4F46E5" strokeWidth="1.5" opacity="0.45" />
                    
                    {/* Animated Trainer Vehicle Dot */}
                    <Circle cx={trainerCoords.x} cy={trainerCoords.y} r="6.5" fill="#E11D48" />
                    <Circle cx={trainerCoords.x} cy={trainerCoords.y} r="14" fill="none" stroke="#E11D48" strokeWidth="2" opacity="0.35" />
                  </Svg>
                </View>

                {/* Tracking ETA Indicators */}
                {currentStatus === 'trainer_travelling' && (
                  <View className="flex-row divide-x divide-slate-900 border-t border-slate-900 bg-slate-900/20">
                    <View className="flex-1 p-4 items-center">
                      <Text className="text-slate-500 text-[8px] font-black uppercase tracking-wider">Distance Remaining</Text>
                      <Text className="text-white text-base font-black mt-0.5">{remainingDistance} km</Text>
                    </View>
                    <View className="flex-1 p-4 items-center">
                      <Text className="text-slate-500 text-[8px] font-black uppercase tracking-wider">Estimated Arrival</Text>
                      <Text className="text-white text-base font-black mt-0.5">~{remainingEta} mins</Text>
                    </View>
                  </View>
                )}

                {/* Arrived Pin Information */}
                {currentStatus === 'trainer_arrived' && (
                  <View className="p-4 items-center justify-center bg-emerald-950/20 border-t border-emerald-900/30">
                    <Text className="text-emerald-400 text-[8px] font-black uppercase tracking-wider">📍 VENUE LOCATION</Text>
                    <Text className="text-white text-xs font-bold mt-0.5">Coach is waiting outside the gate</Text>
                  </View>
                )}
              </View>
            )}

            {/* Module 4: Premium Coach Profile Card */}
            {!isPendingDetails && (
              <View 
                className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4"
                style={{
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.02,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <View className="flex-row gap-4 items-start">
                  <Image source={{ uri: booking.trainerPhoto }} className="w-14 h-14 rounded-full border border-zinc-150" />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <Text className="text-zinc-950 text-base font-black">Coach {booking.trainerName}</Text>
                      <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex-row items-center gap-0.5">
                        <Feather name="check-circle" size={8} color="#059669" />
                        <Text className="text-emerald-700 text-[6px] font-black uppercase">Verified Pro</Text>
                      </View>
                    </View>
                    <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-wider mt-0.5">
                      {booking.trainerLevel || 'Certified'} Coach • {booking.workoutTitle} Specialist
                    </Text>
                    
                    <View className="flex-row items-center gap-1.5 mt-2 flex-wrap">
                      <Text className="text-zinc-700 text-[10px] font-semibold bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded-md">⭐ {booking.trainerRating || 4.9}</Text>
                      <Text className="text-zinc-700 text-[10px] font-semibold bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded-md">💼 {booking.trainerCompletedSessions || 154}+ sessions</Text>
                      <Text className="text-zinc-700 text-[10px] font-semibold bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded-md">🎯 6+ Years Exp</Text>
                    </View>
                  </View>
                </View>

                <View className="h-[1px] bg-zinc-100" />

                {/* More Details Layout grid */}
                <View className="flex-row flex-wrap justify-between gap-y-3.5 px-1">
                  <View className="w-[48%]">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Specialties</Text>
                    <Text className="text-zinc-800 text-[10px] font-bold mt-0.5">{booking.trainerSpeciality || 'Mobility & Core strength'}</Text>
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Languages Spoken</Text>
                    <Text className="text-zinc-800 text-[10px] font-bold mt-0.5">{(booking.trainerLanguages || ['English', 'Hindi', 'Punjabi']).join(', ')}</Text>
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Response Rate</Text>
                    <Text className="text-zinc-800 text-[10px] font-bold mt-0.5">98% (Quick responder)</Text>
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase tracking-wider">Punctuality Score</Text>
                    <Text className="text-zinc-800 text-[10px] font-bold mt-0.5">99.4% (Always on time)</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Module 5: Customer Communication controls */}
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">Concierge Controls</Text>
                {!isPendingDetails && (
                  <TouchableOpacity onPress={handleNavigateAddress} className="flex-row items-center gap-1">
                    <Feather name="navigation" size={10} color="#4F46E5" />
                    <Text className="text-[#4F46E5] text-[9px] font-bold uppercase">Navigate Address</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View className="flex-row justify-between">
                <TouchableOpacity 
                  onPress={isPendingDetails ? () => Alert.alert('Security Lock', 'Communication channel opens 5 hours prior to session.') : handleCall} 
                  className="w-[30%] bg-zinc-900 py-3.5 rounded-2xl items-center justify-center flex-row gap-1.5"
                >
                  <Feather name="phone" size={12} color="white" />
                  <Text className="text-white text-[8px] font-black uppercase">Call Coach</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={isPendingDetails ? () => Alert.alert('Security Lock', 'Communication channel opens 5 hours prior to session.') : handleMessage} 
                  className="w-[30%] bg-zinc-900 py-3.5 rounded-2xl items-center justify-center flex-row gap-1.5"
                >
                  <Feather name="message-square" size={12} color="white" />
                  <Text className="text-white text-[8px] font-black uppercase">Chat Board</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={isPendingDetails ? () => Alert.alert('Security Lock', 'Live tracking GPS details lock opens 5 hours prior.') : handleShareLocation} 
                  className="w-[30%] bg-zinc-900 py-3.5 rounded-2xl items-center justify-center flex-row gap-1.5"
                >
                  <Feather name="map-pin" size={12} color="white" />
                  <Text className="text-white text-[8px] font-black uppercase">Share GPS</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* OTP Display and Trainer Entry Verification */}
            {currentStatus === 'trainer_arrived' && (role === 'customer' || role === 'admin') && (
              <View className="bg-zinc-950 p-6 rounded-[28px] border border-zinc-800 shadow-xl items-center justify-center gap-3">
                <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Share OTP with Coach Karan</Text>
                <Text className="text-white text-4xl font-black mt-1 tracking-widest">{booking.otp || '3049'}</Text>
                <Text className="text-zinc-500 text-[8px] font-bold text-center leading-relaxed">Give this 4-digit code to the trainer to verify and start session.</Text>
              </View>
            )}

            {currentStatus === 'trainer_arrived' && role === 'trainer' && (
              <View className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-850 gap-4">
                <View>
                  <Text className="text-white text-xs font-black uppercase tracking-wider">Client check-in security OTP</Text>
                  <Text className="text-zinc-500 text-[8px] font-bold mt-0.5">Enter the 4-digit code provided by the client.</Text>
                </View>
                <TextInput
                  value={otpInput}
                  onChangeText={setOtpInput}
                  placeholder="0 0 0 0"
                  placeholderTextColor="#4B5563"
                  keyboardType="numeric"
                  maxLength={4}
                  className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center text-white text-2xl font-black tracking-widest"
                />
                <TouchableOpacity onPress={handleVerifyOtp} className="w-full bg-[#4F46E5] py-3.5 rounded-xl items-center justify-center">
                  <Text className="text-white text-xs font-black uppercase">Verify Check-In</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Active Workout timer dashboard console */}
            {currentStatus === 'workout_started' && (
              <View className="bg-zinc-950 p-6 rounded-[28px] border border-zinc-800 items-center justify-center gap-3 shadow-xl">
                <Text className="text-emerald-400 text-[8px] font-black uppercase tracking-wider">WORKOUT IN PROGRESS</Text>
                <Text className="text-white text-4xl font-black tracking-tight">
                  {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:
                  {(elapsedSeconds % 60).toString().padStart(2, '0')}
                </Text>
                <Text className="text-zinc-500 text-[9px] font-bold text-center leading-none">Activity tracker is active. Warm-up Drills logs are online.</Text>
                {role === 'trainer' && (
                  <TouchableOpacity
                    onPress={() => setShowQuestionnaire(true)}
                    className="mt-3 bg-emerald-500 px-6 py-2.5 rounded-full"
                  >
                    <Text className="text-white text-[8px] font-black uppercase tracking-wider">Complete Workout</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Questionnaire Report Panel */}
            {showQuestionnaire && (
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-lg gap-4">
                <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Finalize workout report</Text>
                
                <View className="gap-2">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase">Mobility star score</Text>
                  <View className="flex-row gap-3">
                    {[1,2,3,4,5].map(s => (
                      <TouchableOpacity key={s} onPress={() => setMobilityScore(s)}>
                        <Feather name="star" size={18} color={s <= mobilityScore ? '#F59E0B' : '#9CA3AF'} fill={s <= mobilityScore ? '#F59E0B' : 'transparent'} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase">Session Summary</Text>
                  <TextInput
                    value={workoutSummary}
                    onChangeText={setWorkoutSummary}
                    className="border border-[#E5E7EB] p-3.5 rounded-xl text-xs bg-zinc-50 font-semibold"
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase">Coach Signature</Text>
                  <TextInput
                    value={coachSignature}
                    onChangeText={setCoachSignature}
                    placeholder="Enter name to sign"
                    className="border border-[#E5E7EB] p-3.5 rounded-xl text-xs bg-zinc-50 font-black"
                  />
                </View>

                <TouchableOpacity onPress={handleQuestionnaireSubmit} className="w-full bg-[#4F46E5] py-3.5 rounded-xl items-center justify-center mt-2">
                  <Text className="text-white text-xs font-black uppercase">Authorize & Close Workout</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Module 8: Full Post-Session Customer Experience Panel */}
            {(currentStatus === 'customer_review_pending' || currentStatus === 'session_closed' || currentStatus === 'workout_completed' || currentStatus === 'trainer_report_submitted') && (role === 'customer' || role === 'admin') && (
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
                    <Text className="text-zinc-900 text-sm font-black">{booking.workoutTitle}</Text>
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

                {/* Star-ratings form if review pending */}
                {currentStatus === 'customer_review_pending' && (
                  <View className="gap-4 border-t border-zinc-100 pt-4 mt-1">
                    <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1 border-b border-zinc-50 pb-2">Rate coach Karan</Text>
                    
                    <View className="flex-row justify-around py-1">
                      {[1,2,3,4,5].map(s => (
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

            {/* 12-Stage Booking Timeline tracker */}
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
              <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">Live Tracking timeline</Text>
              
              <View className="gap-3.5 pl-2">
                {stagesList.map((item, idx) => {
                  const isActive = currentStatus === item;
                  const isCompleted = stagesList.indexOf(currentStatus) >= idx;
                  
                  return (
                    <View key={item} className="flex-row items-center gap-3.5">
                      <View className="items-center">
                        <Animated.View
                          style={{
                            transform: [{ scale: isActive ? pulseScale : 1 }]
                          }}
                          className={`w-4 h-4 rounded-full items-center justify-center border ${
                            isCompleted 
                              ? 'bg-green-500 border-green-500' 
                              : isActive 
                              ? 'bg-[#E11D48] border-[#E11D48]' 
                              : 'border-zinc-300 bg-white'
                          }`}
                        >
                          {isCompleted && <Feather name="check" size={8} color="white" />}
                        </Animated.View>
                      </View>

                      <Text className={`text-[10px] font-black capitalize ${
                        isCompleted ? 'text-zinc-950' : isActive ? 'text-[#E11D48] font-extrabold' : 'text-zinc-400'
                      }`}>
                        {item.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
