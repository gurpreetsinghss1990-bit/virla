import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useWorkoutStore } from '../store/workoutStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';

export function RecommendationCard() {
  const { workouts } = useWorkoutStore();
  const { bookings, addBooking } = useBookingStore();
  const { useCredit, membership } = useMembershipStore();
  const [booked, setBooked] = useState(false);

  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');
  
  // Dynamic recommendation message (Feature 9)
  let recommendationMessage = 'Based on your previous activity, today we recommend a Stretching session.';
  let recommendationWorkoutId = 'w-3';

  if (upcomingBookings.length > 0) {
    const latestWorkout = upcomingBookings[0].workoutTitle;
    if (latestWorkout === 'Strength Training') {
      recommendationMessage = 'To balance your upcoming Strength Training, we recommend a Yoga flow to restore mobility today.';
      recommendationWorkoutId = 'w-2';
    } else if (latestWorkout === 'Yoga') {
      recommendationMessage = 'After your Yoga session, we recommend a gentle Stretching routine to release remaining hamstring tightness.';
      recommendationWorkoutId = 'w-3';
    } else {
      recommendationMessage = 'You have a session scheduled. Rest up or join our Pilates core stabilization session.';
      recommendationWorkoutId = 'w-6';
    }
  }

  const handleBookNow = () => {
    // Check if already booked in current session
    if (booked) {
      Alert.alert('Already Booked', 'This recommendation is already scheduled.');
      return;
    }

    // Find recommended workout
    const targetWorkout = workouts.find((w) => w.id === recommendationWorkoutId);
    const workoutTitle = targetWorkout ? targetWorkout.title : 'Stretching';

    // Verify credits
    if (membership.availableCredits <= 0) {
      Alert.alert('Inaccessible Credits', 'You do not have enough credits remaining. Top up in the Membership tab.');
      return;
    }

    // Book session
    const success = useCredit();
    if (success) {
      addBooking({
        id: `b-auto-${Date.now()}`,
        trainerName: 'Priya Patel',
        trainerPhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
        workoutTitle,
        date: 'Tomorrow',
        time: '09:00 AM',
      });
      setBooked(true);
      Alert.alert('Session Booked', `${workoutTitle} session successfully scheduled with Priya Patel! 1 credit consumed.`);
    }
  };

  return (
    <View className="w-full bg-orange-50 border border-orange-100 p-6 rounded-[24px] shadow-sm relative overflow-hidden">
      {/* Visual indicator representing AI activity */}
      <View className="absolute w-20 h-20 rounded-full bg-orange-200/20 -top-5 -right-5" />
      
      <View className="flex-row items-center gap-1.5 mb-2.5">
        <Text className="text-orange-500 text-[10px] font-black uppercase tracking-wider">
          ★ AI Recommendation
        </Text>
      </View>
      
      <Text className="text-primary text-base font-extrabold mb-3 leading-relaxed">
        {recommendationMessage}
      </Text>
      
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleBookNow}
        disabled={booked}
        className={`py-3 px-6 rounded-2xl items-center justify-center self-start shadow-xs ${
          booked ? 'bg-zinc-200' : 'bg-primary'
        }`}
      >
        <Text className={`text-sm font-bold ${booked ? 'text-zinc-500' : 'text-white'}`}>
          {booked ? 'Booked' : 'Book Now'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
