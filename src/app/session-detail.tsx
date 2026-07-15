import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useCoachStore } from '../store/coachStore';
import { BookingStatusBadge } from '../components/BookingStatusBadge';
import { Ionicons } from '@expo/vector-icons';
import { Heading } from '@/presentation/components';

export default function SessionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { bookings, cancelSession, rescheduleSession } = useBookingStore();
  const { workouts } = useWorkoutStore();
  const { coaches } = useCoachStore();

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

  // Find related objects to open profile/workout details
  const coach = coaches.find(c => c.name === booking.trainerName);
  const workout = workouts.find(w => w.title === booking.workoutTitle);

  const handleWorkoutDetails = () => {
    if (workout) {
      router.push({
        pathname: '/workout-detail' as any,
        params: { id: workout.id }
      });
    } else {
      Alert.alert('Details Unavailable', 'Workout details cannot be loaded.');
    }
  };

  const handleCoachDetails = () => {
    if (coach) {
      router.push({
        pathname: '/coach-profile' as any,
        params: { id: coach.id }
      });
    } else {
      Alert.alert('Details Unavailable', 'Coach profile cannot be loaded.');
    }
  };

  const handleChat = () => {
    Alert.alert('Mock Chat', `Opening encrypted chat room with Coach ${booking.trainerName}...`);
  };

  const handleCall = () => {
    Alert.alert('Mock Call', `Dialing Coach ${booking.trainerName} (+91 98765 43210)...`);
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel this wellness session? Your membership credit will be refunded.',
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: () => {
            cancelSession(booking.id);
            Alert.alert('Session Cancelled', 'Your home session has been successfully cancelled.');
          },
        },
      ]
    );
  };

  const handleReschedule = () => {
    Alert.alert(
      'Reschedule Session',
      'Select a new date/time slot.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Next Monday at 10 AM',
          onPress: () => {
            rescheduleSession(booking.id, 'Jul 20, 2026', '10:00 AM');
            Alert.alert('Rescheduled', 'Session rescheduled to Jul 20, 2026, 10:00 AM.');
          },
        },
        {
          text: 'Next Friday at 5 PM',
          onPress: () => {
            rescheduleSession(booking.id, 'Jul 24, 2026', '05:00 PM');
            Alert.alert('Rescheduled', 'Session rescheduled to Jul 24, 2026, 05:00 PM.');
          },
        },
      ]
    );
  };

  const isUpcoming = booking.status === 'upcoming';

  const mockInstructions = 'Ensure a clear space of at least 6x6 feet in your living room or workout zone. Keep the room ventilated and turn on the air conditioner if preferred. Your coach will arrive with all specialized equipment.';
  const mockItemsToKeepReady = ['A clean training/yoga mat', 'Water bottle and small face towel', 'Light, stretchable athletic attire'];

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header back bar */}
      <View className="h-14 flex-row items-center px-6 border-b border-zinc-100">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111111" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-primary text-base font-black tracking-tight mr-8">
          Session Details
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="gap-6">
          
          {/* Header row: Coach details & Status */}
          <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-[24px] gap-4">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleCoachDetails}
                className="flex-row items-center gap-3 flex-1"
              >
                <Image
                  source={{ uri: booking.trainerPhoto }}
                  className="w-12 h-12 rounded-full border border-zinc-200"
                />
                <View className="flex-1">
                  <Text className="text-primary text-base font-black tracking-tight">
                    Coach {booking.trainerName}
                  </Text>
                  <Text className="text-zinc-400 text-[9px] font-bold uppercase tracking-wide">
                    View Profile Details
                  </Text>
                </View>
              </TouchableOpacity>
              <BookingStatusBadge status={booking.status} />
            </View>

            {/* Quick Contact Row */}
            {isUpcoming && (
              <View className="flex-row gap-3 pt-3 border-t border-zinc-200/50">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleChat}
                  className="flex-1 bg-white border border-zinc-200 py-2.5 rounded-xl flex-row justify-center items-center gap-2"
                >
                  <Ionicons name="chatbubble-outline" size={14} color="#111111" />
                  <Text className="text-primary text-xs font-bold">Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleCall}
                  className="flex-1 bg-white border border-zinc-200 py-2.5 rounded-xl flex-row justify-center items-center gap-2"
                >
                  <Ionicons name="call-outline" size={14} color="#111111" />
                  <Text className="text-primary text-xs font-bold">Call</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Workout details row */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleWorkoutDetails}
            className="flex-row justify-between items-center bg-zinc-50 border border-zinc-100 p-4 rounded-2xl"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-white border border-zinc-200 justify-center items-center">
                <Text className="text-lg">🏋️‍♂️</Text>
              </View>
              <View>
                <Text className="text-primary text-xs font-black uppercase tracking-wider">Workout Category</Text>
                <Text className="text-primary text-sm font-black tracking-tight">{booking.workoutTitle}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#71717A" />
          </TouchableOpacity>

          {/* Date & Time display */}
          <View className="flex-row justify-between items-center bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
            <View className="flex-row items-center gap-2">
              <Text className="text-base">📅</Text>
              <View>
                <Text className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Scheduled Date</Text>
                <Text className="text-primary text-xs font-black tracking-tight mt-0.5">{booking.date}</Text>
              </View>
            </View>
            <View className="w-[1px] h-8 bg-zinc-200" />
            <View className="flex-row items-center gap-2">
              <Text className="text-base">⏱️</Text>
              <View>
                <Text className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Session Time</Text>
                <Text className="text-primary text-xs font-black tracking-tight mt-0.5">{booking.time}</Text>
              </View>
            </View>
          </View>

          {/* Address Details */}
          <View className="gap-2">
            <Text className="text-primary text-sm font-black tracking-tight">📍 Training Venue Address</Text>
            <View className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
              <Text className="text-zinc-700 text-xs font-semibold leading-relaxed">
                {booking.address || 'Flat 402, Sea Breeze Heights, Worli Sea Face, Mumbai - 400018'}
              </Text>
            </View>
          </View>

          {/* Family Member Beneficiary */}
          {booking.familyMember && (
            <View className="gap-2">
              <Text className="text-primary text-sm font-black tracking-tight">👤 Session Attendee</Text>
              <View className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl gap-1">
                <Text className="text-primary text-xs font-black">{booking.familyMember.name} ({booking.familyMember.relation})</Text>
                <Text className="text-zinc-500 text-xs font-medium">Age: {booking.familyMember.age} • Gender: {booking.familyMember.gender}</Text>
                {booking.familyMember.notes && (
                  <Text className="text-zinc-400 text-xs font-medium italic mt-1">"Note: {booking.familyMember.notes}"</Text>
                )}
              </View>
            </View>
          )}

          {/* Expected Arrival */}
          <View className="gap-2">
            <Text className="text-primary text-sm font-black tracking-tight">🚗 Expected Arrival</Text>
            <View className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex-row items-center gap-3">
              <Text className="text-lg">⏱️</Text>
              <Text className="text-green-700 text-xs font-bold leading-normal">
                Expected Arrival: Coach will arrive 10 minutes early to set up training equipment.
              </Text>
            </View>
          </View>

          {/* Items to Keep Ready */}
          <View className="gap-2">
            <Text className="text-primary text-sm font-black tracking-tight">🧘 Items to Keep Ready</Text>
            <View className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl gap-2.5">
              {mockItemsToKeepReady.map((item, idx) => (
                <View key={idx} className="flex-row items-center gap-2">
                  <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <Text className="text-zinc-600 text-xs font-semibold">{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Preparation Instructions */}
          <View className="gap-2">
            <Text className="text-primary text-sm font-black tracking-tight">📋 Pre-Session Preparation</Text>
            <View className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
              <Text className="text-zinc-600 text-xs font-medium leading-relaxed">
                {mockInstructions}
              </Text>
            </View>
          </View>

          {/* Action Triggers */}
          {isUpcoming && (
            <View className="flex-row gap-4 mt-4">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCancel}
                className="flex-1 py-4 bg-red-50 rounded-2xl items-center justify-center border border-red-200/50"
              >
                <Text className="text-red-500 text-sm font-extrabold">Cancel Session</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleReschedule}
                className="flex-1 py-4 bg-zinc-900 rounded-2xl items-center justify-center"
              >
                <Text className="text-white text-sm font-extrabold">Reschedule</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
