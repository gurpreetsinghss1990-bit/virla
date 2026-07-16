import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Image, ScrollView, TextInput, Alert, Animated, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useCoachStore } from '../store/coachStore';
import { useNotificationStore } from '../store/notificationStore';
import { useMembershipStore } from '../store/membershipStore';
import { BookingStatusBadge } from '../components/BookingStatusBadge';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

export default function SessionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { bookings, updateTimelineStatus, updateBookingRating, cancelSession } = useBookingStore();
  const { workouts } = useWorkoutStore();
  const { coaches } = useCoachStore();
  const { addNotification } = useNotificationStore();
  const { membership } = useMembershipStore();

  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];

  // If no booking found, show empty state
  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-zinc-400 font-semibold">No booking details found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-zinc-900 px-6 py-2 rounded-full">
          <Text className="text-white font-bold text-xs">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Concierge simulator status list
  const stages: Array<'confirmed' | 'trainer_assigned' | 'on_the_way' | 'arrived' | 'started' | 'completed' | 'feedback_pending'> = [
    'confirmed',
    'trainer_assigned',
    'on_the_way',
    'arrived',
    'started',
    'completed',
    'feedback_pending'
  ];

  const currentStatus = booking.timelineStatus || 'confirmed';

  // Checklist state
  const [checklist, setChecklist] = useState({ towel: false, water: false, shoes: false });

  // Map DOT animated position along a custom path
  const carAnim = useRef(new Animated.Value(0)).current;

  // Scanner animation for QR code scanning border
  const scannerAnim = useRef(new Animated.Value(0)).current;
  const qrSuccessAnim = useRef(new Animated.Value(0)).current;
  const [qrScanned, setQrScanned] = useState(false);

  // Active workout duration timer state
  const [activeSeconds, setActiveSeconds] = useState(0);

  // Ratings inputs
  const [overallRating, setOverallRating] = useState(5);
  const [trainerRating, setTrainerRating] = useState(5);
  const [workoutRating, setWorkoutRating] = useState(5);
  const [difficulty, setDifficulty] = useState('Moderate');
  const [energy, setEnergy] = useState('High');
  const [comments, setComments] = useState('');

  // Start animations based on status changes
  useEffect(() => {
    if (currentStatus === 'on_the_way') {
      carAnim.setValue(0);
      Animated.loop(
        Animated.timing(carAnim, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: false,
        })
      ).start();
    } else if (currentStatus === 'arrived') {
      // Start QR scanner slide beam loop
      scannerAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scannerAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(scannerAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: false,
          })
        ])
      ).start();
    } else if (currentStatus === 'started') {
      setActiveSeconds(0);
      const timer = setInterval(() => {
        setActiveSeconds(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStatus]);

  const handleStageChange = (newStatus: typeof stages[number]) => {
    updateTimelineStatus(booking.id, newStatus);

    // Push matching notifications to notification center
    if (newStatus === 'trainer_assigned') {
      addNotification({
        title: 'Trainer Assigned ⚡',
        body: `Coach ${booking.trainerName} has been assigned to your session. Profile matches 100% of goals.`,
      });
    } else if (newStatus === 'on_the_way') {
      addNotification({
        title: 'Trainer Traveling 🚗',
        body: `Coach ${booking.trainerName} is on the way to your address. ETA: 12 minutes. Track live.`,
      });
    } else if (newStatus === 'arrived') {
      addNotification({
        title: 'Trainer Arrived 🔔',
        body: `Coach ${booking.trainerName} has arrived at your venue. Present your QR to check-in!`,
      });
    } else if (newStatus === 'completed') {
      addNotification({
        title: 'Workout Completed 🏆',
        body: `Splendid! You completed ${booking.workoutTitle}. Burned ~380 Kcal. Leave feedback!`,
      });
      
      // Auto triggers low credits alert if only 1 credit left
      if (membership.availableCredits <= 1) {
        addNotification({
          title: 'Credits Low ⚠️',
          body: `You only have ${membership.availableCredits} credit remaining. Top up to continue scheduling.`,
        });
      }
    }
  };

  const simulateQRScan = () => {
    setQrScanned(true);
    qrSuccessAnim.setValue(0);
    Animated.spring(qrSuccessAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        // Advance to started
        handleStageChange('started');
        setQrScanned(false);
      }, 1500);
    });
  };

  const handleRatingSubmit = () => {
    updateBookingRating(booking.id, {
      overallRating,
      trainerRating,
      workoutRating,
      difficulty,
      energy,
      comments,
    });
    Alert.alert('Thank You', 'Your feedback was successfully submitted to the concierge desk.');
  };

  const getStatusLabel = (s: typeof currentStatus) => {
    switch (s) {
      case 'confirmed': return 'Confirmed';
      case 'trainer_assigned': return 'Coach Assigned';
      case 'on_the_way': return 'Coach Traveling';
      case 'arrived': return 'Coach Arrived';
      case 'started': return 'Active Workout';
      case 'completed': return 'Workout Complete';
      case 'feedback_pending': return 'Feedback Required';
      default: return 'Active';
    }
  };

  // Timeline render helpers
  const renderTimeline = () => {
    return (
      <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
        <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Session Timeline</Text>
        <View className="pl-2 gap-4">
          {[
            { id: 'confirmed', label: 'Booking Confirmed', desc: 'Reserved in system' },
            { id: 'trainer_assigned', label: 'Trainer Assigned', desc: `Coach ${booking.trainerName} selected` },
            { id: 'on_the_way', label: 'Trainer On The Way', desc: 'Travelling to location' },
            { id: 'arrived', label: 'Trainer Arrived', desc: 'At venue, scan QR check-in' },
            { id: 'started', label: 'Workout Active', desc: 'Session currently training' },
            { id: 'completed', label: 'Session Complete', desc: 'Workout done, leave review' },
          ].map((item, idx) => {
            const isCompleted = stages.indexOf(currentStatus) >= stages.indexOf(item.id as any);
            const isActive = currentStatus === item.id;
            return (
              <View key={item.id} className="flex-row items-start gap-4">
                <View className="items-center">
                  <View className={`w-5 h-5 rounded-full items-center justify-center border ${
                    isCompleted 
                      ? 'bg-green-500 border-green-500' 
                      : isActive 
                      ? 'bg-indigo-600 border-indigo-600' 
                      : 'border-zinc-300 bg-white'
                  }`}>
                    {isCompleted ? (
                      <Feather name="check" size={10} color="white" />
                    ) : isActive ? (
                      <View className="w-1.5 h-1.5 rounded-full bg-white" />
                    ) : null}
                  </View>
                  {idx < 5 && (
                    <View className={`w-[2px] h-10 ${
                      stages.indexOf(currentStatus) > stages.indexOf(item.id as any)
                        ? 'bg-green-500'
                        : 'bg-zinc-200'
                    }`} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className={`text-xs font-black ${isCompleted ? 'text-zinc-800' : 'text-zinc-400'}`}>
                    {item.label}
                  </Text>
                  <Text className="text-[#6B7280] text-[9px] font-semibold mt-0.5">{item.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Map rendering & live tracking details
  const renderLiveTracking = () => {
    // Interpolated values representing traveler coordinates
    const leftVal = carAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['15%', '80%'],
    });
    const topVal = carAnim.interpolate({
      inputRange: [0, 0.4, 0.7, 1],
      outputRange: ['70%', '40%', '62%', '30%'],
    });

    return (
      <View className="gap-2.5">
        <View className="flex-row justify-between items-center px-1">
          <Text className="text-[#111827] text-sm font-black tracking-tight">🚗 Live Travel Map</Text>
          <View className="bg-red-500 px-2 py-0.5 rounded-full animate-pulse flex-row items-center gap-1">
            <View className="w-1.5 h-1.5 rounded-full bg-white" />
            <Text className="text-white text-[8px] font-black uppercase">Live Tracking</Text>
          </View>
        </View>

        <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
          {/* Custom vector map tracker */}
          <View className="h-48 bg-[#E0F2FE]/30 border border-[#BAE6FD]/40 rounded-2xl relative overflow-hidden">
            <Svg width="100%" height="100%" className="absolute">
              <Defs>
                <LinearGradient id="water-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#38BDF8" stopOpacity="0.5" />
                </LinearGradient>
              </Defs>
              {/* Lake/Water block */}
              <Path d="M0 0 C40 30, 80 10, 110 50 C120 70, 90 90, 80 120 L0 120 Z" fill="url(#water-grad)" />
              
              {/* Complex road paths */}
              <Path d="M 50 160 Q 150 90 180 150 T 320 80" fill="none" stroke="#94A3B8" strokeWidth={5} strokeLinecap="round" />
              <Path d="M 50 160 Q 150 90 180 150 T 320 80" fill="none" stroke="#F1F5F9" strokeWidth={3} strokeLinecap="round" />
              
              <Line x1="120" y1="0" x2="120" y2="200" stroke="#CBD5E1" strokeWidth={1} strokeDasharray="3 3" />
            </Svg>

            {/* Destination Pin */}
            <View className="absolute top-[30%] left-[80%] -ml-3.5 -mt-3.5 items-center justify-center z-10">
              <View className="w-7 h-7 rounded-full bg-indigo-600 border-2 border-white items-center justify-center shadow-md">
                <Feather name="home" size={10} color="white" />
              </View>
            </View>

            {/* Traveling Coach Indicator */}
            <Animated.View
              style={{
                position: 'absolute',
                left: leftVal,
                top: topVal,
                marginLeft: -14,
                marginTop: -14,
                zIndex: 20,
              }}
              className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white items-center justify-center shadow-lg"
            >
              <Feather name="navigation" size={10} color="white" style={{ transform: [{ rotate: '45deg' }] }} />
            </Animated.View>
          </View>

          {/* Travel Stats Details */}
          <View className="flex-row justify-between items-center bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
            <View className="gap-1 flex-1">
              <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Estimated Arrival</Text>
              <Text className="text-zinc-900 text-sm font-black">⏰ 11m 45s left</Text>
            </View>
            <View className="w-[1px] h-8 bg-zinc-200 mx-3" />
            <View className="gap-1 flex-1 items-end">
              <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Distance remaining</Text>
              <Text className="text-zinc-900 text-sm font-black">📍 {booking.trainerDistance || '1.8 km'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // QR Check-in overlay
  const renderQRScanner = () => {
    // Scanning beam animation
    const beamTop = scannerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['4%', '96%'],
    });

    return (
      <View className="gap-2.5">
        <Text className="text-[#111827] text-sm font-black tracking-tight">🔐 Secure Entry Check-In</Text>
        <View className="bg-white border border-[#E5E7EB] p-8 rounded-[28px] items-center justify-center shadow-xs gap-5">
          <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed text-center max-w-[80%]">
            Present this QR to your trainer once they arrive to check-in and start the session.
          </Text>

          {/* QR Container with active scanning beam */}
          <View className="w-52 h-52 bg-white border border-zinc-100 p-5 rounded-[28px] relative overflow-hidden items-center justify-center shadow-sm">
            {/* Corner brackets simulating scanner box */}
            <View className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-indigo-600" />
            <View className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-indigo-600" />
            <View className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-indigo-600" />
            <View className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-indigo-600" />

            {/* Custom Svg Mock QR code grid */}
            <Svg width={140} height={140}>
              {[
                [1, 1, 1, 1, 0, 1, 1, 1, 1, 0],
                [1, 0, 0, 1, 0, 1, 0, 0, 1, 1],
                [1, 0, 0, 1, 1, 1, 0, 0, 1, 0],
                [1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
                [0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
                [1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
                [1, 0, 0, 1, 1, 0, 1, 0, 1, 0],
                [1, 0, 0, 1, 0, 1, 0, 0, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
              ].map((row, r) =>
                row.map((v, c) => (
                  <Rect
                    key={`${r}-${c}`}
                    x={c * 14}
                    y={r * 14}
                    width={11}
                    height={11}
                    fill={v === 1 ? '#09090B' : '#FFFFFF'}
                  />
                ))
              )}
            </Svg>

            {/* Laser scanning beam line (Feature 5) */}
            {!qrScanned && (
              <Animated.View
                style={{ top: beamTop }}
                className="absolute left-[4%] right-[4%] h-[2px] bg-indigo-500 shadow-md"
              />
            )}

            {/* Check-in success scale-in checkmark animation (Feature 5) */}
            {qrScanned && (
              <Animated.View
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: qrSuccessAnim }],
                  opacity: qrSuccessAnim,
                }}
              >
                <View className="w-14 h-14 rounded-full bg-emerald-500 items-center justify-center shadow-md">
                  <Feather name="check" size={28} color="white" />
                </View>
                <Text className="text-emerald-600 text-xs font-black uppercase mt-3 tracking-widest">Entry Verified</Text>
              </Animated.View>
            )}
          </View>

          {/* Scanner action trigger */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={simulateQRScan}
            className="w-full bg-[#111827] py-3.5 rounded-2xl flex-row items-center justify-center gap-2"
          >
            <Feather name="aperture" size={14} color="white" />
            <Text className="text-white text-xs font-black uppercase tracking-wider">Verify Entry Code (Simulate)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Workout completed stats and suggested routines
  const renderWorkoutComplete = () => {
    return (
      <View className="gap-6 animate-fade-in">
        <View className="bg-white border border-[#E5E7EB] p-8 rounded-[32px] items-center justify-center shadow-sm gap-5">
          <View className="w-16 h-16 bg-green-500/10 rounded-full items-center justify-center">
            <Feather name="award" size={32} color="#10B981" />
          </View>
          <View className="items-center gap-1">
            <Text className="text-[#111827] text-xl font-black tracking-tight text-center">Session Successfully Completed!</Text>
            <Text className="text-indigo-600 text-[10px] font-black uppercase tracking-wider mt-1">Goal achieved: Zen fitness</Text>
          </View>

          {/* Completion statistics widgets */}
          <View className="flex-row justify-between gap-3 w-full border-t border-b border-zinc-100 py-5 my-2">
            <View className="flex-1 items-center gap-1">
              <Text className="text-zinc-400 text-[8px] font-bold uppercase">Calories Burned</Text>
              <Text className="text-zinc-900 text-base font-black">🔥 380 Kcal</Text>
            </View>
            <View className="w-[1px] h-8 bg-zinc-200" />
            <View className="flex-1 items-center gap-1">
              <Text className="text-zinc-400 text-[8px] font-bold uppercase">Session Duration</Text>
              <Text className="text-zinc-900 text-base font-black">⏱️ 60 Mins</Text>
            </View>
            <View className="w-[1px] h-8 bg-zinc-200" />
            <View className="flex-1 items-center gap-1">
              <Text className="text-zinc-400 text-[8px] font-bold uppercase">Credits Left</Text>
              <Text className="text-zinc-900 text-base font-black">💎 {membership.availableCredits} Left</Text>
            </View>
          </View>

          {/* Recommended follow-up */}
          <View className="w-full bg-zinc-50 border border-zinc-150 p-4 rounded-2xl gap-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-[#111827] text-[10px] font-black uppercase tracking-wider">Next Recommended Workout</Text>
              <View className="bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                <Text className="text-[#4F46E5] text-[7px] font-black uppercase">Decompress</Text>
              </View>
            </View>
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg">🧘‍♀️</Text>
                <View>
                  <Text className="text-zinc-900 text-xs font-black">Flow Motion</Text>
                  <Text className="text-zinc-500 text-[9px] font-bold">Yoga & Mobility • 60m</Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/booking' as any, params: { workoutId: 'Flow Motion' } })}
                className="bg-zinc-900 px-3.5 py-2 rounded-xl"
              >
                <Text className="text-white text-[8px] font-black uppercase">Book Again</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action options */}
          <View className="w-full gap-3 mt-2">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleStageChange('feedback_pending')}
              className="w-full bg-[#4F46E5] py-4 rounded-2xl items-center justify-center"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">Rate & Review Session</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => Alert.alert('Share Achievement', 'Achievement post shared to Apple Fitness!')}
              className="w-full bg-zinc-50 border border-zinc-150 py-4 rounded-2xl items-center justify-center flex-row gap-2"
            >
              <Feather name="share-2" size={14} color="#09090B" />
              <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">Share Achievement</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Feedback pending ratings & emoji selector
  const renderRatingsScreen = () => {
    const emojis = [
      { rating: 1, label: '😡', txt: 'Terrible' },
      { rating: 2, label: '😕', txt: 'Disappointing' },
      { rating: 3, label: '😐', txt: 'Okay' },
      { rating: 4, label: '😊', txt: 'Good' },
      { rating: 5, label: '🤩', txt: 'Awesome!' }
    ];

    return (
      <View className="gap-6 animate-fade-in">
        <View className="bg-white border border-[#E5E7EB] p-5 rounded-[32px] shadow-sm gap-5">
          <Text className="text-[#111827] text-sm font-black uppercase tracking-wider border-b border-zinc-100 pb-3">Feedback & Review</Text>

          {/* Emoji selector (Feature 7) */}
          <View className="gap-2">
            <Text className="text-zinc-400 text-[9px] font-black uppercase pl-1">Overall Experience</Text>
            <View className="flex-row justify-between bg-zinc-50 border border-zinc-100 p-2.5 rounded-2xl">
              {emojis.map((em) => {
                const isSelected = overallRating === em.rating;
                return (
                  <TouchableOpacity
                    key={em.rating}
                    activeOpacity={0.8}
                    onPress={() => setOverallRating(em.rating)}
                    className={`flex-1 items-center py-2 rounded-xl ${isSelected ? 'bg-white shadow-xs border border-zinc-100' : ''}`}
                  >
                    <Text className="text-2xl">{em.label}</Text>
                    {isSelected && (
                      <Text className="text-[#4F46E5] text-[7px] font-black uppercase mt-1 leading-none">
                        {em.txt}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Coach performance rating */}
          <View className="gap-2">
            <Text className="text-zinc-400 text-[9px] font-black uppercase pl-1">Coach Professionalism</Text>
            <View className="flex-row justify-between bg-zinc-50 border border-zinc-100 p-2.5 rounded-2xl">
              {emojis.map((em) => {
                const isSelected = trainerRating === em.rating;
                return (
                  <TouchableOpacity
                    key={em.rating}
                    activeOpacity={0.8}
                    onPress={() => setTrainerRating(em.rating)}
                    className={`flex-1 items-center py-2 rounded-xl ${isSelected ? 'bg-white shadow-xs border border-zinc-100' : ''}`}
                  >
                    <Text className="text-2xl">{em.label}</Text>
                    {isSelected && (
                      <Text className="text-[#4F46E5] text-[7px] font-black uppercase mt-1 leading-none">
                        {em.txt}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Segmented filters for energy and difficulty */}
          <View className="flex-row gap-3">
            {/* Difficulty selector */}
            <View className="flex-1 gap-2">
              <Text className="text-zinc-400 text-[9px] font-black uppercase pl-1">Workout Intensity</Text>
              <View className="bg-zinc-50 border border-zinc-100 rounded-2xl p-1">
                {['Easy', 'Moderate', 'Hard', 'Brutal'].map((diff) => {
                  const isAct = difficulty === diff;
                  return (
                    <TouchableOpacity
                      key={diff}
                      activeOpacity={0.8}
                      onPress={() => setDifficulty(diff)}
                      className={`py-2 rounded-xl items-center justify-center ${isAct ? 'bg-white border border-zinc-150 shadow-xs' : ''}`}
                    >
                      <Text className={`text-[8px] font-black uppercase ${isAct ? 'text-zinc-800' : 'text-zinc-500'}`}>{diff}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Energy selector */}
            <View className="flex-1 gap-2">
              <Text className="text-zinc-400 text-[9px] font-black uppercase pl-1">Energy levels</Text>
              <View className="bg-zinc-50 border border-zinc-100 rounded-2xl p-1">
                {['Relaxed', 'Moderate', 'High', 'Exhausted'].map((en) => {
                  const isAct = energy === en;
                  return (
                    <TouchableOpacity
                      key={en}
                      activeOpacity={0.8}
                      onPress={() => setEnergy(en)}
                      className={`py-2 rounded-xl items-center justify-center ${isAct ? 'bg-white border border-zinc-150 shadow-xs' : ''}`}
                    >
                      <Text className={`text-[8px] font-black uppercase ${isAct ? 'text-zinc-800' : 'text-zinc-500'}`}>{en}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Comments and submit */}
          <View className="gap-2.5">
            <Text className="text-zinc-400 text-[9px] font-black uppercase pl-1">Detailed comments</Text>
            <TextInput
              value={comments}
              onChangeText={setComments}
              placeholder="What did you love or how can we improve?"
              placeholderTextColor="#A1A1AA"
              multiline
              className="border border-[#E5E7EB] p-3.5 rounded-2xl text-xs font-semibold bg-zinc-50 h-20 text-[#111827]"
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleRatingSubmit}
            className="w-full bg-[#111827] py-4 rounded-2xl items-center justify-center mt-2"
          >
            <Text className="text-white text-xs font-black uppercase tracking-wider">Submit Review</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header back bar */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#111827] text-sm font-black uppercase tracking-wider mr-8">
          Session Concierge
        </Text>
      </View>

      {/* Simulator Control Bar at the top (Feature 11 developer toggle) */}
      <View className="bg-zinc-950 p-3 flex-row items-center justify-between border-b border-zinc-800 z-10">
        <Text className="text-amber-400 text-[9px] font-black uppercase tracking-wider pl-2">Concierge Simulator</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2.5 pl-4">
          {stages.map((stg) => {
            const isActive = currentStatus === stg;
            return (
              <TouchableOpacity
                key={stg}
                activeOpacity={0.8}
                onPress={() => handleStageChange(stg)}
                className={`px-3 py-1.5 rounded-lg border ${
                  isActive ? 'bg-amber-400 border-amber-400' : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text className={`text-[8px] font-black uppercase ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`}>
                  {getStatusLabel(stg)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1 p-6" 
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="gap-6">
          
          {/* Active Workout Timer widget */}
          {currentStatus === 'started' && (
            <View className="bg-zinc-900 p-6 rounded-[28px] shadow-lg items-center justify-center gap-2">
              <Text className="text-emerald-400 text-[9px] font-black uppercase tracking-widest animate-pulse">Session Live</Text>
              <Text className="text-white text-3xl font-black tracking-tighter">
                {Math.floor(activeSeconds / 60).toString().padStart(2, '0')}:
                {(activeSeconds % 60).toString().padStart(2, '0')}
              </Text>
              <Text className="text-zinc-400 text-[8px] font-bold uppercase">Estimated Kcal Burned: ~{Math.round(activeSeconds * 0.15)} kcal</Text>
              
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleStageChange('completed')}
                className="mt-4 bg-emerald-500 px-6 py-2.5 rounded-full"
              >
                <Text className="text-white text-[9px] font-black uppercase">Finish Workout</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Renders screen view based on active simulation state */}
          {currentStatus === 'on_the_way' && renderLiveTracking()}
          {currentStatus === 'arrived' && renderQRScanner()}
          {currentStatus === 'completed' && renderWorkoutComplete()}
          {currentStatus === 'feedback_pending' && renderRatingsScreen()}

          {/* Default detailed metadata (only for preparatory stages) */}
          {(currentStatus === 'confirmed' || currentStatus === 'trainer_assigned') && (
            <>
              {/* Header Info Card */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1">
                    <Image
                      source={{ uri: booking.trainerPhoto }}
                      className="w-12 h-12 rounded-full border border-zinc-150"
                    />
                    <View className="flex-1">
                      <Text className="text-[#111827] text-base font-black tracking-tight">
                        Coach {booking.trainerName}
                      </Text>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <Text className="text-[#4F46E5] text-[9px] font-black uppercase tracking-wider">
                          {booking.trainerLevel} Trainer
                        </Text>
                        <Text className="text-zinc-300 text-[9px]">•</Text>
                        <Text className="text-zinc-500 text-[9px] font-bold">
                          ⭐ {booking.trainerRating || 4.8}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <BookingStatusBadge status={booking.status} />
                </View>
              </View>

              {/* Training Specs */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-indigo-50/50 justify-center items-center">
                    <Text className="text-lg">🏋️‍♂️</Text>
                  </View>
                  <View>
                    <Text className="text-[#6B7280] text-[9px] font-black uppercase">Workout Program</Text>
                    <Text className="text-[#111827] text-sm font-extrabold">{booking.workoutTitle}</Text>
                  </View>
                </View>

                <View className="h-[1px] bg-[#E5E7EB] my-1" />

                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base">📅</Text>
                    <View>
                      <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Date</Text>
                      <Text className="text-[#111827] text-xs font-extrabold mt-0.5">{booking.date}</Text>
                    </View>
                  </View>
                  <View className="w-[1px] h-8 bg-[#E5E7EB]" />
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base">⏱️</Text>
                    <View>
                      <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Time</Text>
                      <Text className="text-[#111827] text-xs font-extrabold mt-0.5">{booking.time}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Training Address */}
              <View className="gap-2.5">
                <Text className="text-[#111827] text-sm font-black tracking-tight">📍 Training Venue</Text>
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
                  <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed">
                    {booking.address || 'Worli, Mumbai, India'}
                  </Text>
                </View>
              </View>

              {/* Preparation Checklist */}
              <View className="gap-2.5">
                <Text className="text-[#111827] text-sm font-black tracking-tight">🧘 Preparation Checklist</Text>
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-3">
                  <Text className="text-[#6B7280] text-[10px] font-bold leading-normal mb-1">
                    Keep these items ready before the coach arrives:
                  </Text>
                  
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setChecklist({ ...checklist, towel: !checklist.towel })}
                    className="flex-row items-center justify-between py-2 border-b border-[#E5E7EB]/50"
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Feather name="check" size={14} color={checklist.towel ? '#22C55E' : '#9CA3AF'} />
                      <Text className={`text-xs font-semibold ${checklist.towel ? 'text-zinc-400 line-through' : 'text-[#111827]'}`}>
                        Bring clean gym towel
                      </Text>
                    </View>
                    <View className={`w-4 h-4 rounded border items-center justify-center ${checklist.towel ? 'bg-[#22C55E] border-[#22C55E]' : 'border-zinc-300'}`}>
                      {checklist.towel && <Feather name="check" size={10} color="white" />}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setChecklist({ ...checklist, water: !checklist.water })}
                    className="flex-row items-center justify-between py-2 border-b border-[#E5E7EB]/50"
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Feather name="droplet" size={14} color={checklist.water ? '#22C55E' : '#9CA3AF'} />
                      <Text className={`text-xs font-semibold ${checklist.water ? 'text-zinc-400 line-through' : 'text-[#111827]'}`}>
                        Keep hydration water ready
                      </Text>
                    </View>
                    <View className={`w-4 h-4 rounded border items-center justify-center ${checklist.water ? 'bg-[#22C55E] border-[#22C55E]' : 'border-zinc-300'}`}>
                      {checklist.water && <Feather name="check" size={10} color="white" />}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setChecklist({ ...checklist, shoes: !checklist.shoes })}
                    className="flex-row items-center justify-between py-2"
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Feather name="heart" size={14} color={checklist.shoes ? '#22C55E' : '#9CA3AF'} />
                      <Text className={`text-xs font-semibold ${checklist.shoes ? 'text-zinc-400 line-through' : 'text-[#111827]'}`}>
                        Wear indoor training shoes
                      </Text>
                    </View>
                    <View className={`w-4 h-4 rounded border items-center justify-center ${checklist.shoes ? 'bg-[#22C55E] border-[#22C55E]' : 'border-zinc-300'}`}>
                      {checklist.shoes && <Feather name="check" size={10} color="white" />}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* Renders timeline indicator on preparatory steps */}
          {(currentStatus === 'confirmed' || currentStatus === 'trainer_assigned' || currentStatus === 'on_the_way' || currentStatus === 'arrived') && renderTimeline()}

          {/* Cancel booking option */}
          {(currentStatus === 'confirmed' || currentStatus === 'trainer_assigned') && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Alert.alert(
                  'Cancel Session',
                  'Are you sure you want to cancel this concierge session? Your membership credits will be refunded.',
                  [
                    { text: 'Keep Session', style: 'cancel' },
                    { 
                      text: 'Cancel Session', 
                      style: 'destructive',
                      onPress: () => {
                        cancelSession(booking.id);
                        router.back();
                      }
                    }
                  ]
                );
              }}
              className="w-full bg-rose-50 border border-rose-100 py-4 rounded-2xl items-center justify-center"
            >
              <Text className="text-[#EF4444] text-xs font-extrabold uppercase tracking-wider">Cancel Booking</Text>
            </TouchableOpacity>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
