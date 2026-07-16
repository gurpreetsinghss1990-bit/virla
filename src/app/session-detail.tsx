import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Image, ScrollView, TextInput, Alert, Animated, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useCoachStore } from '../store/coachStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserStore } from '../store/userStore';
import { useMembershipStore } from '../store/membershipStore';
import { BookingStatusBadge } from '../components/BookingStatusBadge';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

export default function SessionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { bookings, updateTimelineStatus, updateBookingRating, cancelSession, acceptBooking, triggerClientNoShow, triggerTrainerNoShow, submitQuestionnaire } = useBookingStore();
  const { workouts } = useWorkoutStore();
  const { coaches } = useCoachStore();
  const { addNotification } = useNotificationStore();
  const { role } = useUserStore();

  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];

  // If no booking found, return back
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

  const currentStatus = booking.timelineStatus || 'confirmed';

  // Trainer active states
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);

  // Questionnaire form states
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [mobilityScore, setMobilityScore] = useState(4);
  const [workoutSummary, setWorkoutSummary] = useState('Core Strength & Conditioning');
  const [coachNotes, setCoachNotes] = useState('');
  const [coachSignature, setCoachSignature] = useState('');

  // Client rating inputs
  const [overallRating, setOverallRating] = useState(5);
  const [trainerRating, setTrainerRating] = useState(5);
  const [workoutRating, setWorkoutRating] = useState(5);
  const [difficulty, setDifficulty] = useState('Moderate');
  const [energy, setEnergy] = useState('High');
  const [comments, setComments] = useState('');

  // Active workout timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Animations
  const carAnim = useRef(new Animated.Value(0)).current;
  const scannerAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentStatus === 'on_the_way') {
      carAnim.setValue(0);
      Animated.loop(
        Animated.timing(carAnim, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: false,
        })
      ).start();
    } else if (currentStatus === 'arrived') {
      scannerAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scannerAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
          Animated.timing(scannerAnim, { toValue: 0, duration: 2000, useNativeDriver: false })
        ])
      ).start();
    } else if (currentStatus === 'started') {
      const timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStatus]);

  // Handler for OTP inputs validation
  const handleVerifyOtp = () => {
    if (otpInput === booking.otp) {
      setOtpSuccess(true);
      setOtpError(false);
      successScale.setValue(0);
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true }).start(() => {
        setTimeout(() => {
          updateTimelineStatus(booking.id, 'started');
          addNotification({
            title: 'Session Started 🏋️‍♂️',
            body: `Security check-in matched! Coach ${booking.trainerName} has started your ${booking.workoutTitle} session.`,
          });
          setOtpSuccess(false);
          setOtpInput('');
        }, 1200);
      });
    } else {
      setOtpError(true);
      Alert.alert('Security Match Failed', 'The OTP code you entered does not match the client\'s check-in pass.');
    }
  };

  // Submit post-session report
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
    addNotification({
      title: 'Workout Completed 🏆',
      body: `Coach ${booking.trainerName} completed your post-session report. Overall mobility index logged at ${mobilityScore}/5 stars.`,
    });
    setShowQuestionnaire(false);
  };

  // Client submits review
  const handleClientFeedbackSubmit = () => {
    updateBookingRating(booking.id, {
      overallRating,
      trainerRating,
      workoutRating,
      difficulty,
      energy,
      comments: comments.trim(),
    });
    Alert.alert('Feedback Registered', 'Thank you! Your rating and comments have been saved.');
  };

  // Status simulation actions
  const handleTrainerAdvance = () => {
    if (currentStatus === 'trainer_assigned') {
      updateTimelineStatus(booking.id, 'on_the_way');
      addNotification({
        title: 'Coach Travelling 🚗',
        body: `Coach ${booking.trainerName} has started traveling. ETA: 12 minutes. Track route.`,
      });
    } else if (currentStatus === 'on_the_way') {
      updateTimelineStatus(booking.id, 'arrived');
      addNotification({
        title: 'Coach Arrived 🔔',
        body: `Coach ${booking.trainerName} has arrived at Juhu. Present check-in OTP: ${booking.otp}.`,
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header Back Button */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#111827] text-sm font-black uppercase tracking-wider mr-8">
          {role === 'trainer' ? 'Coach Console' : 'Session Concierge'}
        </Text>
      </View>

      {/* Concierge Simulator Exceptions Controls (Feature 11) */}
      <View className="bg-zinc-950 p-3 flex-row items-center justify-between border-b border-zinc-800">
        <Text className="text-amber-400 text-[8px] font-black uppercase tracking-wider pl-2">Simulator Console</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2.5 pl-4">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => triggerTrainerNoShow(booking.id)}
            className="px-3 py-1 bg-red-500 rounded-lg border border-red-600"
          >
            <Text className="text-white text-[7px] font-black uppercase">Coach No-Show</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => triggerClientNoShow(booking.id)}
            className="px-3 py-1 bg-red-950 rounded-lg border border-red-800"
          >
            <Text className="text-white text-[7px] font-black uppercase">Client No-Show</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="gap-6">

          {/* ========================================================= */}
          {/* ===================== TRAINER VIEW ===================== */}
          {/* ========================================================= */}
          {role === 'trainer' && (
            <View className="gap-6">
              
              {/* Job Acceptance & Travel Status Box */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Job Action controls</Text>
                
                {currentStatus === 'confirmed' && (
                  <View className="gap-2">
                    <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed">
                      Confirming this request reserves your schedule slot and alerts the client.
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => acceptBooking(booking.id)}
                      className="w-full bg-[#4F46E5] py-3.5 rounded-2xl items-center justify-center shadow-xs mt-2"
                    >
                      <Text className="text-white text-xs font-black uppercase">Accept Assigned Job</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {currentStatus === 'trainer_assigned' && (
                  <View className="gap-2">
                    <Text className="text-[#6B7280] text-xs font-semibold">
                      Alert the customer and start GPS directions route.
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleTrainerAdvance}
                      className="w-full bg-[#111827] py-3.5 rounded-2xl items-center justify-center mt-2"
                    >
                      <Text className="text-white text-xs font-black uppercase">Start Travelling</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {currentStatus === 'on_the_way' && (
                  <View className="gap-2">
                    <Text className="text-[#6B7280] text-xs font-semibold">
                      Notify the client that you have arrived at Bandra West venue.
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleTrainerAdvance}
                      className="w-full bg-emerald-600 py-3.5 rounded-2xl items-center justify-center mt-2"
                    >
                      <Text className="text-white text-xs font-black uppercase">I Have Arrived</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {currentStatus === 'arrived' && (
                  <View className="gap-4.5 bg-zinc-50 border border-zinc-100 p-4.5 rounded-2xl my-1">
                    <View className="gap-1">
                      <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">Client Check-in Code</Text>
                      <Text className="text-zinc-500 text-[9px] font-bold">Ask client for the 4-digit code shown on their pass.</Text>
                    </View>
                    
                    <TextInput
                      value={otpInput}
                      onChangeText={setOtpInput}
                      placeholder="Enter 4-Digit OTP"
                      placeholderTextColor="#A1A1AA"
                      keyboardType="numeric"
                      maxLength={4}
                      className="border border-[#E5E7EB] bg-white p-3.5 rounded-xl text-center text-zinc-900 text-lg font-black"
                    />

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleVerifyOtp}
                      className="w-full bg-[#111827] py-3.5 rounded-xl items-center justify-center"
                    >
                      <Text className="text-white text-xs font-black uppercase">Verify & Start Workout</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {currentStatus === 'started' && (
                  <View className="items-center py-4 bg-zinc-900 rounded-3xl gap-3">
                    <Text className="text-emerald-400 text-[8px] font-black uppercase tracking-widest">Active Workout Timer</Text>
                    <Text className="text-white text-3xl font-black tracking-tighter">
                      {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:
                      {(elapsedSeconds % 60).toString().padStart(2, '0')}
                    </Text>
                    
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setShowQuestionnaire(true)}
                      className="mt-4 bg-emerald-500 px-6 py-2.5 rounded-full"
                    >
                      <Text className="text-white text-[9px] font-black uppercase">End Workout & Report</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(currentStatus === 'completed' || currentStatus === 'feedback_pending') && (
                  <View className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl items-center justify-center">
                    <Feather name="check-circle" size={24} color="#10B981" />
                    <Text className="text-emerald-800 text-xs font-black uppercase mt-2">Visits Completed</Text>
                  </View>
                )}
              </View>

              {/* Mandatory Post-Session Questionnaire Form Modal overlay */}
              {showQuestionnaire && (
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-lg gap-4.5 animate-fade-in">
                  <Text className="text-[#111827] text-xs font-black uppercase tracking-wider border-b border-zinc-150 pb-3">Mandatory Post-Session Report</Text>
                  
                  {/* Mobility Score star rating */}
                  <View className="gap-2">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">Client Mobility Score (1-5)</Text>
                    <View className="flex-row gap-2 bg-zinc-50 border border-zinc-100 p-2.5 rounded-2xl justify-around">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setMobilityScore(star)}>
                          <Feather name="star" size={20} color={star <= mobilityScore ? '#F59E0B' : '#9CA3AF'} fill={star <= mobilityScore ? '#F59E0B' : 'transparent'} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Exercises summaries */}
                  <View className="gap-2">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">Exercises summary</Text>
                    <TextInput
                      value={workoutSummary}
                      onChangeText={setWorkoutSummary}
                      placeholder="e.g. Core Strength & Hamstring release"
                      placeholderTextColor="#A1A1AA"
                      className="border border-[#E5E7EB] p-3 rounded-xl text-xs font-bold bg-zinc-50 text-zinc-800"
                    />
                  </View>

                  {/* Coach notes */}
                  <View className="gap-2">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">Coach feedback & notes</Text>
                    <TextInput
                      value={coachNotes}
                      onChangeText={setCoachNotes}
                      placeholder="Enter physical observations and hamstrings notes"
                      placeholderTextColor="#A1A1AA"
                      multiline
                      className="border border-[#E5E7EB] p-3 rounded-xl text-xs font-semibold bg-zinc-50 h-20 text-zinc-800"
                    />
                  </View>

                  {/* Coach digital signature */}
                  <View className="gap-2">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase">Coach digital signature (Type Name)</Text>
                    <TextInput
                      value={coachSignature}
                      onChangeText={setCoachSignature}
                      placeholder="Enter full legal name to sign"
                      placeholderTextColor="#A1A1AA"
                      className="border border-[#E5E7EB] p-3 rounded-xl text-xs font-black bg-zinc-50 text-zinc-900"
                    />
                  </View>

                  <View className="flex-row gap-3 mt-2">
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setShowQuestionnaire(false)}
                      className="flex-1 py-3 bg-zinc-150 rounded-xl items-center justify-center"
                    >
                      <Text className="text-zinc-600 text-xs font-black uppercase">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleQuestionnaireSubmit}
                      className="flex-1 py-3 bg-[#4F46E5] rounded-xl items-center justify-center"
                    >
                      <Text className="text-white text-xs font-black uppercase">Sign & Submit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Client specifications receipt summary */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Client Booking Details</Text>
                <View className="gap-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[#6B7280] text-xs font-semibold">Client Name</Text>
                    <Text className="text-[#111827] text-xs font-extrabold">Viral</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[#6B7280] text-xs font-semibold">Scheduled Date</Text>
                    <Text className="text-[#111827] text-xs font-extrabold">{booking.date}</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-[#6B7280] text-xs font-semibold">Scheduled Time</Text>
                    <Text className="text-[#111827] text-xs font-extrabold">{booking.time}</Text>
                  </View>
                  <View className="flex-row justify-between items-start">
                    <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">Venue Address</Text>
                    <Text className="text-[#111827] text-xs font-extrabold flex-1 text-right max-w-[60%] leading-relaxed">
                      {booking.address || ' Worli, Mumbai, India'}
                    </Text>
                  </View>
                </View>
              </View>

            </View>
          )}

          {/* ========================================================= */}
          {/* ===================== CLIENT VIEW ===================== */}
          {/* ========================================================= */}
          {role === 'customer' && (
            <View className="gap-6">
              
              {/* Verification OTP passcode card (Feature 6 & 11) */}
              {currentStatus === 'arrived' && (
                <View className="bg-zinc-950 p-6 rounded-[28px] border border-zinc-800 shadow-xl items-center justify-center gap-2">
                  <View className="bg-amber-500/10 border border-amber-500/20 px-3 py-0.5 rounded-full">
                    <Text className="text-amber-500 text-[8px] font-black uppercase">Trainer Arrived</Text>
                  </View>
                  <Text className="text-zinc-500 text-[9px] font-black uppercase mt-1">Provide entry code to your coach</Text>
                  <Text className="text-white text-4xl font-black mt-2 tracking-[0.1em]">{booking.otp || '5829'}</Text>
                  <Text className="text-zinc-400 text-[8px] text-center leading-relaxed max-w-[80%] mt-2">
                    🔒 Verification code ensures security checks before starting.
                  </Text>
                </View>
              )}

              {/* Exception cancel details / no-show display */}
              {(booking.status === 'client_no_show' || booking.status === 'trainer_no_show' || booking.status === 'cancelled') && (
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3.5">
                  <View className="flex-row items-center gap-2 border-b border-zinc-100 pb-3">
                    <Feather name="alert-triangle" size={16} color="#EF4444" />
                    <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">Exception Event details</Text>
                  </View>
                  
                  <View className="gap-1.5 px-1">
                    <Text className="text-zinc-800 text-sm font-extrabold leading-tight">
                      {booking.status === 'cancelled' && 'Session Cancelled'}
                      {booking.status === 'client_no_show' && 'Client No-Show Logged'}
                      {booking.status === 'trainer_no_show' && 'Trainer No-Show Logged'}
                    </Text>
                    
                    <Text className="text-zinc-500 text-[10px] font-semibold leading-relaxed mt-1">
                      {booking.status === 'cancelled' && 'You cancelled this session. 1 credit was refunded to your wallet.'}
                      {booking.status === 'client_no_show' && 'A Client No-Show was recorded. 1 Credit was forfeited in line with the travel policy.'}
                      {booking.status === 'trainer_no_show' && 'The trainer failed to arrive. 1 Credit has been refunded, and we have awarded you 1 FREE bonus credit.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Timeline Indicator */}
              {(currentStatus === 'confirmed' || currentStatus === 'trainer_assigned' || currentStatus === 'on_the_way' || currentStatus === 'arrived') && (
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
                  <Text className="text-[#111827] text-xs font-black uppercase tracking-wider pl-1">Session Timeline</Text>
                  <View className="pl-2 gap-4">
                    {[
                      { id: 'confirmed', label: 'Booking Confirmed', desc: 'Reserved in system' },
                      { id: 'trainer_assigned', label: 'Trainer Assigned', desc: `Coach ${booking.trainerName} selected` },
                      { id: 'on_the_way', label: 'Trainer On The Way', desc: 'Travelling to location' },
                      { id: 'arrived', label: 'Trainer Arrived', desc: 'At venue, provide OTP code' },
                      { id: 'started', label: 'Workout Active', desc: 'Session currently training' },
                      { id: 'completed', label: 'Session Complete', desc: 'Workout done, leave review' },
                    ].map((item, idx) => {
                      const isCompleted = stagesIndex(currentStatus) >= stagesIndex(item.id as any);
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
                                stagesIndex(currentStatus) > stagesIndex(item.id as any) ? 'bg-green-500' : 'bg-zinc-200'
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
              )}

              {/* Map traveling tracker */}
              {currentStatus === 'on_the_way' && (
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-xs gap-4">
                  <View className="h-44 bg-[#E0F2FE]/45 border border-[#BAE6FD]/40 rounded-2xl relative overflow-hidden">
                    <Svg width="100%" height="100%" className="absolute">
                      <Path d="M 50 160 Q 150 90 180 150 T 320 80" fill="none" stroke="#94A3B8" strokeWidth={5} strokeLinecap="round" />
                      <Path d="M 50 160 Q 150 90 180 150 T 320 80" fill="none" stroke="#F1F5F9" strokeWidth={3} strokeLinecap="round" />
                    </Svg>
                    <View className="absolute top-[30%] left-[80%] -ml-3.5 -mt-3.5 items-center justify-center">
                      <View className="w-7 h-7 rounded-full bg-indigo-600 border-2 border-white items-center justify-center">
                        <Feather name="home" size={10} color="white" />
                      </View>
                    </View>
                    <Animated.View
                      style={{
                        position: 'absolute',
                        left: carAnim.interpolate({ inputRange: [0, 1], outputRange: ['15%', '80%'] }),
                        top: carAnim.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: ['70%', '40%', '62%', '30%'] }),
                        marginLeft: -14,
                        marginTop: -14,
                      }}
                      className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white items-center justify-center"
                    >
                      <Feather name="navigation" size={10} color="white" style={{ transform: [{ rotate: '45deg' }] }} />
                    </Animated.View>
                  </View>
                  
                  <View className="flex-row justify-between items-center bg-zinc-50 border border-zinc-100 p-3.5 rounded-xl">
                    <View className="gap-0.5">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase">Estimated Arrival</Text>
                      <Text className="text-zinc-900 text-xs font-black">⏰ ETA: 11m 45s left</Text>
                    </View>
                    <View className="w-[1px] h-6 bg-zinc-200" />
                    <View className="gap-0.5 items-end">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase">Remaining Distance</Text>
                      <Text className="text-zinc-900 text-xs font-black">📍 {booking.trainerDistance || '1.8 km'}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Workout complete success panel */}
              {currentStatus === 'completed' && (
                <View className="bg-white border border-[#E5E7EB] p-6 rounded-[32px] shadow-sm items-center justify-center gap-5">
                  <View className="w-14 h-14 bg-green-500/10 rounded-full items-center justify-center">
                    <Feather name="award" size={28} color="#10B981" />
                  </View>
                  <View className="items-center">
                    <Text className="text-zinc-900 text-base font-black text-center">Session Completed!</Text>
                    <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1 text-center max-w-[85%]">
                      Excellent training. Please rate your trainer to close the appointment invoice.
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => updateTimelineStatus(booking.id, 'feedback_pending')}
                    className="w-full bg-[#4F46E5] py-3.5 rounded-2xl items-center justify-center"
                  >
                    <Text className="text-white text-xs font-black uppercase tracking-wider">Leave Trainer Rating</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Ratings and review feedback panels */}
              {currentStatus === 'feedback_pending' && (
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-5">
                  <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Feedback & Ratings</Text>

                  {/* Emoji ratings selectors */}
                  <View className="gap-2">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase pl-1">Overall experience</Text>
                    <View className="flex-row bg-zinc-50 border border-zinc-100 p-2.5 rounded-2xl justify-between">
                      {['😡', '😕', '😐', '😊', '🤩'].map((emoji, idx) => (
                        <TouchableOpacity key={idx} onPress={() => setOverallRating(idx + 1)}>
                          <Text className={`text-2xl ${overallRating === idx + 1 ? 'scale-125 opacity-100 animate-bounce' : 'opacity-50'}`}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View className="gap-2">
                    <Text className="text-zinc-400 text-[8px] font-black uppercase pl-1">Coach performance</Text>
                    <View className="flex-row bg-zinc-50 border border-zinc-100 p-2.5 rounded-2xl justify-between">
                      {['😡', '😕', '😐', '😊', '🤩'].map((emoji, idx) => (
                        <TouchableOpacity key={idx} onPress={() => setTrainerRating(idx + 1)}>
                          <Text className={`text-2xl ${trainerRating === idx + 1 ? 'scale-125 opacity-100' : 'opacity-50'}`}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-2">
                      <Text className="text-zinc-400 text-[8px] font-black uppercase pl-1">Difficulty level</Text>
                      <View className="bg-zinc-50 border border-zinc-100 rounded-xl p-1 gap-1">
                        {['Easy', 'Moderate', 'Hard'].map(d => (
                          <TouchableOpacity key={d} onPress={() => setDifficulty(d)} className={`py-1.5 rounded-lg items-center ${difficulty === d ? 'bg-white shadow-xs border border-zinc-100' : ''}`}>
                            <Text className="text-zinc-800 text-[8px] font-bold uppercase">{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View className="flex-1 gap-2">
                      <Text className="text-zinc-400 text-[8px] font-black uppercase pl-1">Energy levels</Text>
                      <View className="bg-zinc-50 border border-zinc-100 rounded-xl p-1 gap-1">
                        {['Relaxed', 'Moderate', 'High'].map(e => (
                          <TouchableOpacity key={e} onPress={() => setEnergy(e)} className={`py-1.5 rounded-lg items-center ${energy === e ? 'bg-white shadow-xs border border-zinc-100' : ''}`}>
                            <Text className="text-zinc-800 text-[8px] font-bold uppercase">{e}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <TextInput
                    value={comments}
                    onChangeText={setComments}
                    placeholder="Enter review comments for concierge desk"
                    placeholderTextColor="#A1A1AA"
                    multiline
                    className="border border-[#E5E7EB] bg-zinc-50 p-3 rounded-2xl text-xs font-semibold h-20 text-zinc-900"
                  />

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleClientFeedbackSubmit}
                    className="w-full bg-zinc-900 py-3.5 rounded-2xl items-center justify-center mt-1"
                  >
                    <Text className="text-white text-xs font-black uppercase">Submit Ratings</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Prepatory detailed metadata cards */}
              {(currentStatus === 'confirmed' || currentStatus === 'trainer_assigned') && (
                <>
                  {/* Coach summary card */}
                  <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm flex-row gap-3.5 items-center">
                    <Image source={{ uri: booking.trainerPhoto }} className="w-12 h-12 rounded-full border border-zinc-100" />
                    <View className="flex-1">
                      <Text className="text-zinc-900 text-sm font-black">Coach {booking.trainerName}</Text>
                      <Text className="text-[#4F46E5] text-[9px] font-black uppercase tracking-wider mt-0.5">{booking.trainerLevel} Trainer • ⭐ {booking.trainerRating}</Text>
                    </View>
                  </View>

                  {/* Training venue specifications */}
                  <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3.5">
                    <View className="flex-row items-center gap-3">
                      <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center">
                        <Feather name="activity" size={16} color="#4F46E5" />
                      </View>
                      <View>
                        <Text className="text-zinc-400 text-[8px] font-black uppercase">Workout Program</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold">{booking.workoutTitle}</Text>
                      </View>
                    </View>
                    
                    <View className="h-[1px] bg-zinc-100" />

                    <View className="flex-row justify-between items-center px-1">
                      <View>
                        <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Date</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold mt-0.5">{booking.date}</Text>
                      </View>
                      <View className="w-[1px] h-6 bg-zinc-200" />
                      <View>
                        <Text className="text-[#6B7280] text-[8px] font-bold uppercase">Time Slot</Text>
                        <Text className="text-zinc-900 text-xs font-extrabold mt-0.5">{booking.time.split(' - ')[0]}</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert('Cancel Session', 'Are you sure you want to cancel this concierge session?', [
                        { text: 'Keep Session', style: 'cancel' },
                        { 
                          text: 'Cancel Session', 
                          style: 'destructive', 
                          onPress: () => {
                            cancelSession(booking.id);
                            router.back();
                          } 
                        }
                      ]);
                    }}
                    className="w-full bg-rose-50 border border-rose-100 py-4 rounded-2xl items-center justify-center mt-1"
                  >
                    <Text className="text-[#EF4444] text-xs font-extrabold uppercase">Cancel Booking</Text>
                  </TouchableOpacity>
                </>
              )}

            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const stagesIndex = (s: string) => {
  const list = ['confirmed', 'trainer_assigned', 'on_the_way', 'arrived', 'started', 'completed'];
  return list.indexOf(s);
};
