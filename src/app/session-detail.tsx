import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBookingStore } from '../store/bookingStore';
import { BookingStatusBadge } from '../components/BookingStatusBadge';
import { Ionicons } from '@expo/vector-icons';
import { Heading, Subtitle } from '@/presentation/components';

export default function SessionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bookingId = params.id as string;

  const { bookings } = useBookingStore();
  const booking = bookings.find((b) => b.id === bookingId) || bookings[0];

  const handleSupport = () => {
    Alert.alert('Contact Support', 'Connecting you to VIRLA Wellness Concierge... (Helpline: +91 99999 88888)');
  };

  // Mock addresses based on workout
  const mockAddress = 'Flat 402, Sea Breeze Heights, Worli Sea Face, Mumbai - 400018';
  const mockInstructions = 'Ensure a clear space of at least 6x6 feet. Keep your training mat ready. Your coach will arrive with all specialized equipment and tools.';
  const mockCoachNotes = 'Please perform simple leg joint mobility warmups 5 minutes before the scheduled time. Wear light athletic clothes.';

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
          <View className="flex-row items-center justify-between bg-zinc-50 border border-zinc-100 p-5 rounded-[24px]">
            <View className="flex-row items-center gap-3">
              <Image
                source={{ uri: booking.trainerPhoto }}
                className="w-12 h-12 rounded-full border border-zinc-150"
              />
              <View>
                <Text className="text-primary text-base font-black tracking-tight">
                  Coach {booking.trainerName}
                </Text>
                <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                  {booking.workoutTitle}
                </Text>
              </View>
            </View>
            <BookingStatusBadge status={booking.status} />
          </View>

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
            <Text className="text-primary text-sm font-black tracking-tight">📍 Training Venue</Text>
            <View className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
              <Text className="text-zinc-700 text-xs font-semibold leading-relaxed">
                {mockAddress}
              </Text>
            </View>
          </View>

          {/* Preparation Instructions */}
          <View className="gap-2">
            <Text className="text-primary text-sm font-black tracking-tight">📋 Pre-Session Instructions</Text>
            <View className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
              <Text className="text-zinc-600 text-xs font-medium leading-relaxed">
                {mockInstructions}
              </Text>
            </View>
          </View>

          {/* Coach's Notes */}
          <View className="gap-2">
            <Text className="text-primary text-sm font-black tracking-tight">💬 Coach's Notes</Text>
            <View className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
              <Text className="text-zinc-600 text-xs font-medium leading-relaxed italic">
                "{mockCoachNotes}"
              </Text>
            </View>
          </View>

          {/* Safety & Emergency Contact */}
          <View className="gap-2">
            <Text className="text-primary text-sm font-black tracking-tight">🛡️ Emergency Contact</Text>
            <View className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex-row justify-between items-center">
              <Text className="text-zinc-500 text-xs font-semibold">Safety Concierge</Text>
              <Text className="text-primary text-xs font-black tracking-tight">+91 99999 88888</Text>
            </View>
          </View>

          {/* Need Help Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleSupport}
            className="w-full border border-zinc-200 bg-white py-4 rounded-2xl items-center justify-center mt-4"
          >
            <Text className="text-primary text-sm font-bold">Need Help?</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
