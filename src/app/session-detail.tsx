import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Image, ScrollView, TextInput, Alert, Animated, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserStore } from '../store/userStore';
import { useWalletStore } from '../store/walletStore';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';

export default function SessionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { bookings, updateTimelineStatus, updateBookingRating, cancelSession, acceptBooking, triggerClientNoShow, triggerTrainerNoShow, submitQuestionnaire } = useBookingStore();
  const { addNotification } = useNotificationStore();
  const { role } = useUserStore();
  const { refundCredit } = useWalletStore();

  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];

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

  // Fallback status alignment for 11-stage timeline
  const currentStatus = booking.timelineStatus || 'booked';

  // Trainer active states
  const [otpInput, setOtpInput] = useState('');
  
  // Questionnaire states
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [mobilityScore, setMobilityScore] = useState(4);
  const [workoutSummary, setWorkoutSummary] = useState('Core Strength & Conditioning');
  const [coachNotes, setCoachNotes] = useState('');
  const [coachSignature, setCoachSignature] = useState('');

  // Client feedback states
  const [overallRating, setOverallRating] = useState(5);
  const [trainerRating, setTrainerRating] = useState(5);
  const [workoutRating, setWorkoutRating] = useState(5);
  const [difficulty, setDifficulty] = useState('Moderate');
  const [energy, setEnergy] = useState('High');
  const [comments, setComments] = useState('');

  // Active timer ticks
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Animations
  const carAnim = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  const stagesList = [
    'booked',
    'trainer_assigned',
    'trainer_accepted',
    'trainer_travelling',
    'trainer_arrived',
    'otp_verified',
    'workout_started',
    'workout_completed',
    'trainer_report_submitted',
    'customer_review_pending',
    'session_closed'
  ];

  useEffect(() => {
    if (currentStatus === 'trainer_travelling') {
      carAnim.setValue(0);
      Animated.loop(
        Animated.timing(carAnim, { toValue: 1, duration: 12000, useNativeDriver: false })
      ).start();
    }
    
    // Active stage pulsing indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.25, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 1200, useNativeDriver: true })
      ])
    ).start();

    if (currentStatus === 'workout_started') {
      const timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStatus]);

  // Verify OTP Security Code
  const handleVerifyOtp = () => {
    if (otpInput === booking.otp) {
      updateTimelineStatus(booking.id, 'otp_verified');
      addNotification({
        title: 'Check-in Verified 🔓',
        body: 'Secure OTP entry code check completed. Initiating workout active timer.',
        icon: 'lock'
      });
      setOtpInput('');
      
      // Advance automatically to started
      setTimeout(() => {
        updateTimelineStatus(booking.id, 'workout_started');
        addNotification({
          title: 'Workout Started 🏋️‍♂️',
          body: `Coach ${booking.trainerName} started your active session. Warmup drills underway.`,
          icon: 'user-check'
        });
      }, 800);
    } else {
      Alert.alert('Security Verification Failed', 'The OTP code you entered does not match the client\'s pass.');
    }
  };

  // Submit Coach Questionnaire
  const handleQuestionnaireSubmit = () => {
    if (!coachSignature.trim()) {
      Alert.alert('Signature Required', 'Please sign the questionnaire to finalize and unlock earnings.');
      return;
    }
    submitQuestionnaire(booking.id, {
      mobilityScore,
      workoutSummary,
      coachNotes: coachNotes.trim() || 'Client trained with optimal form.',
      coachSignature: coachSignature.trim(),
    });
    // Set to report submitted
    updateTimelineStatus(booking.id, 'trainer_report_submitted');
    addNotification({
      title: 'Trainer Report Submitted 📝',
      body: `Coach ${booking.trainerName} has logged your post-session mobility report.`,
      icon: 'award'
    });

    // Advance automatically to review pending
    setTimeout(() => {
      updateTimelineStatus(booking.id, 'customer_review_pending');
      addNotification({
        title: 'Customer Review Pending 🌟',
        body: 'Please leave a rating for your trainer to complete the appointment pass.',
        icon: 'bell'
      });
    }, 800);
    
    setShowQuestionnaire(false);
  };

  // Client Rating Submission
  const handleClientFeedbackSubmit = () => {
    updateBookingRating(booking.id, {
      overallRating,
      trainerRating,
      workoutRating,
      difficulty,
      energy,
      comments: comments.trim(),
    });
    // Set to closed
    updateTimelineStatus(booking.id, 'session_closed');
    addNotification({
      title: 'Session Closed ✅',
      body: 'Thank you! Rating details saved and invoice receipt closed successfully.',
      icon: 'check-circle'
    });
    Alert.alert('Feedback Registered', 'Thank you! Your ratings have been saved and transaction closed.');
  };

  // Chat/Call/Share Mock Actions
  const handleCall = () => {
    Alert.alert(
      'Voice Call Simulated',
      `Connecting secure line to ${role === 'trainer' ? 'Customer Viral' : `Coach ${booking.trainerName}`} (+91 99999 88888)...`
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
      'Emergency support initiated. Dispatching local response support units and alerting emergency contact (Neha Sharma: +91 98200 11223).'
    );
  };

  // Mock Developer Push Notification Simulator (Feature 9)
  const triggerSimulatorStage = (stage: string, alertTitle: string, alertBody: string, alertIcon: string) => {
    updateTimelineStatus(booking.id, stage as any);
    addNotification({
      title: alertTitle,
      body: alertBody,
      icon: alertIcon
    });
  };

  const getLiveStatusText = () => {
    switch (currentStatus) {
      case 'booked': return 'Booking Confirmed';
      case 'trainer_assigned': return 'Trainer Assigned';
      case 'trainer_accepted': return 'Accepted Booking';
      case 'trainer_travelling': return 'Travelling';
      case 'trainer_arrived': return 'Arrived (Waiting at Venue)';
      case 'otp_verified': return 'OTP Verified';
      case 'workout_started': return 'Workout Active';
      case 'workout_completed': return 'Session Complete';
      case 'trainer_report_submitted': return 'Report Submitted';
      case 'customer_review_pending': return 'Waiting for Review';
      case 'session_closed': return 'Session Closed';
      default: return 'Active';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[#111827] text-sm font-black uppercase tracking-wider">
          {role === 'trainer' ? 'Trainer Console' : 'Concierge Pass'}
        </Text>
        <TouchableOpacity onPress={handleSOS} className="bg-red-50 px-3 py-1.5 rounded-full border border-red-150">
          <Text className="text-red-500 text-[8px] font-black uppercase">SOS Alert</Text>
        </TouchableOpacity>
      </View>

      {/* Mock Push Notification Developer Simulator Console (Feature 9) */}
      <View className="bg-zinc-950 p-3.5 border-b border-zinc-800 gap-2">
        <Text className="text-amber-400 text-[8px] font-black uppercase tracking-wider pl-2.5">Developer Push Simulator</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 pl-2">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => triggerSimulatorStage('trainer_travelling', 'Coach Travelling 🚗', `Coach ${booking.trainerName} is on the way.`, 'user-check')}
            className="px-3.5 py-1.5 bg-indigo-600 rounded-xl"
          >
            <Text className="text-white text-[7px] font-black uppercase">Simulate Travel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => triggerSimulatorStage('trainer_arrived', 'Coach Arrived 🔔', `Coach ${booking.trainerName} is at your location.`, 'lock')}
            className="px-3.5 py-1.5 bg-indigo-600 rounded-xl"
          >
            <Text className="text-white text-[7px] font-black uppercase">Simulate Arrived</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => triggerSimulatorStage('workout_started', 'Workout Active 🏋️‍♂️', 'Your home session has started.', 'user-check')}
            className="px-3.5 py-1.5 bg-indigo-600 rounded-xl"
          >
            <Text className="text-white text-[7px] font-black uppercase">Simulate Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => triggerSimulatorStage('workout_completed', 'Workout Completed 🏆', 'Trainer completed workout. Leaving review.', 'award')}
            className="px-3.5 py-1.5 bg-indigo-600 rounded-xl"
          >
            <Text className="text-white text-[7px] font-black uppercase">Simulate Complete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerClientNoShow(booking.id);
            }}
            className="px-3.5 py-1.5 bg-rose-600 rounded-xl"
          >
            <Text className="text-white text-[7px] font-black uppercase">Client No-Show</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerTrainerNoShow(booking.id);
            }}
            className="px-3.5 py-1.5 bg-rose-600 rounded-xl"
          >
            <Text className="text-white text-[7px] font-black uppercase">Trainer No-Show</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="gap-6">

          {/* Trainer Status Card (Feature 3) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm flex-row gap-4 items-center">
            <Image source={{ uri: booking.trainerPhoto }} className="w-12 h-12 rounded-full border border-zinc-100" />
            <View className="flex-1">
              <Text className="text-zinc-950 text-sm font-black">Coach {booking.trainerName}</Text>
              <Text className="text-zinc-400 text-[8px] font-bold mt-0.5">🚗 Vehicle: White Activa 5G (MH02EA4920)</Text>
              <View className="flex-row items-center gap-1.5 mt-1.5">
                <View className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  <Text className="text-[#4F46E5] text-[7px] font-black uppercase tracking-wider">{getLiveStatusText()}</Text>
                </View>
                {currentStatus === 'trainer_travelling' && (
                  <Text className="text-zinc-500 text-[9px] font-bold">📍 2 km away (ETA: 12m)</Text>
                )}
              </View>
            </View>
          </View>

          {/* Premium Chat/Location Communication controls (Feature 4) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">Communication Controls</Text>
            
            <View className="flex-row justify-between">
              <TouchableOpacity onPress={handleCall} className="w-[30%] bg-zinc-900 py-3 rounded-2xl items-center justify-center gap-1">
                <Feather name="phone" size={14} color="white" />
                <Text className="text-white text-[8px] font-black uppercase mt-1">Call</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleMessage} className="w-[30%] bg-zinc-900 py-3 rounded-2xl items-center justify-center gap-1">
                <Feather name="message-square" size={14} color="white" />
                <Text className="text-white text-[8px] font-black uppercase mt-1">Message</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleShareLocation} className="w-[30%] bg-zinc-900 py-3 rounded-2xl items-center justify-center gap-1">
                <Feather name="navigation" size={14} color="white" />
                <Text className="text-white text-[8px] font-black uppercase mt-1">Share GPS</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* OTP Entry Code display */}
          {currentStatus === 'trainer_arrived' && role === 'customer' && (
            <View className="bg-zinc-950 p-6 rounded-[28px] border border-zinc-800 shadow-xl items-center justify-center gap-2">
              <Text className="text-zinc-500 text-[8px] font-black uppercase">Coach Waiting For OTP</Text>
              <Text className="text-white text-3xl font-black mt-1 tracking-widest">{booking.otp}</Text>
            </View>
          )}

          {/* Trainer OTP Entry verification */}
          {currentStatus === 'trainer_arrived' && role === 'trainer' && (
            <View className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-850 gap-4">
              <View>
                <Text className="text-white text-xs font-black uppercase tracking-wider">Client security OTP Check-in</Text>
                <Text className="text-zinc-500 text-[8px] font-bold mt-0.5">Input the 4-digit code provided by the client.</Text>
              </View>
              <TextInput
                value={otpInput}
                onChangeText={setOtpInput}
                placeholder="0 0 0 0"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                maxLength={4}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center text-white text-xl font-black"
              />
              <TouchableOpacity onPress={handleVerifyOtp} className="w-full bg-[#4F46E5] py-3.5 rounded-xl items-center justify-center">
                <Text className="text-white text-xs font-black uppercase">Verify Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Active Workout Timer console */}
          {currentStatus === 'workout_started' && (
            <View className="bg-zinc-900 p-5 rounded-[28px] items-center justify-center gap-2">
              <Text className="text-emerald-400 text-[8px] font-black uppercase tracking-wider">Workout active</Text>
              <Text className="text-white text-4xl font-black tracking-tight mt-1">
                {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:
                {(elapsedSeconds % 60).toString().padStart(2, '0')}
              </Text>
              {role === 'trainer' && (
                <TouchableOpacity
                  onPress={() => setShowQuestionnaire(true)}
                  className="mt-3 bg-emerald-500 px-6 py-2 rounded-full"
                >
                  <Text className="text-white text-[8px] font-black uppercase">End Workout</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Questionnaire overlay sheet */}
          {showQuestionnaire && (
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-lg gap-4">
              <Text className="text-[#111827] text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Mandatory Workout Report</Text>
              
              <View className="gap-2">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Mobility star index</Text>
                <View className="flex-row gap-3">
                  {[1,2,3,4,5].map(s => (
                    <TouchableOpacity key={s} onPress={() => setMobilityScore(s)}>
                      <Feather name="star" size={18} color={s <= mobilityScore ? '#F59E0B' : '#9CA3AF'} fill={s <= mobilityScore ? '#F59E0B' : 'transparent'} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="gap-1">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Exercises summary</Text>
                <TextInput
                  value={workoutSummary}
                  onChangeText={setWorkoutSummary}
                  className="border border-[#E5E7EB] p-3 rounded-xl text-xs bg-zinc-50"
                />
              </View>

              <View className="gap-1">
                <Text className="text-zinc-500 text-[8px] font-black uppercase">Coach digital signature</Text>
                <TextInput
                  value={coachSignature}
                  onChangeText={setCoachSignature}
                  placeholder="Enter legal name"
                  className="border border-[#E5E7EB] p-3 rounded-xl text-xs bg-zinc-50 font-black"
                />
              </View>

              <TouchableOpacity onPress={handleQuestionnaireSubmit} className="w-full bg-[#4F46E5] py-3 rounded-xl items-center justify-center mt-2">
                <Text className="text-white text-xs font-black uppercase">Sign & Submit Report</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ratings review submission panel */}
          {currentStatus === 'customer_review_pending' && role === 'customer' && (
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
              <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1 border-b border-zinc-100 pb-3">Rate session experience</Text>
              
              <View className="flex-row justify-around py-1">
                {[1,2,3,4,5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setOverallRating(s)}>
                    <Text className={`text-2xl ${overallRating === s ? 'scale-125' : 'opacity-45'}`}>⭐</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                value={comments}
                onChangeText={setComments}
                placeholder="Enter feedback comments"
                className="border border-[#E5E7EB] bg-zinc-50 p-3 rounded-xl text-xs h-16"
              />

              <TouchableOpacity onPress={handleClientFeedbackSubmit} className="w-full bg-zinc-950 py-3.5 rounded-xl items-center justify-center mt-1">
                <Text className="text-white text-xs font-black uppercase">Submit review</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 11-Stage Booking Timeline tracker (Feature 2) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">Live Tracking timeline</Text>
            
            <View className="gap-3.5 pl-2">
              {stagesList.map((item, idx) => {
                const isActive = currentStatus === item;
                const isCompleted = stagesList.indexOf(currentStatus) >= idx;
                
                return (
                  <View key={item} className="flex-row items-center gap-3.5">
                    {/* Circle dot indicator */}
                    <View className="items-center">
                      <Animated.View
                        style={{
                          transform: [{ scale: isActive ? pulseScale : 1 }]
                        }}
                        className={`w-4 h-4 rounded-full items-center justify-center border ${
                          isCompleted 
                            ? 'bg-green-500 border-green-500' 
                            : isActive 
                            ? 'bg-indigo-600 border-indigo-600' 
                            : 'border-zinc-300 bg-white'
                        }`}
                      >
                        {isCompleted && <Feather name="check" size={8} color="white" />}
                      </Animated.View>
                    </View>

                    <Text className={`text-xs font-black capitalize ${
                      isCompleted ? 'text-zinc-950' : isActive ? 'text-indigo-600 font-extrabold' : 'text-zinc-400'
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
    </SafeAreaView>
  );
}
