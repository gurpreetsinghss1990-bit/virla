import React from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Booking } from '../types';
import { useBookingStore } from '../store/bookingStore';

interface SessionCardProps {
  booking: Booking;
}

export function SessionCard({ booking }: SessionCardProps) {
  const { cancelSession, rescheduleSession } = useBookingStore();

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
      'Choose a new simulated time slot for your session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set to Next Monday at 11 AM',
          onPress: () => {
            rescheduleSession(booking.id, 'Next Monday', '11:00 AM');
            Alert.alert('Rescheduled', 'Session rescheduled to Next Monday, 11:00 AM.');
          },
        },
        {
          text: 'Set to Next Friday at 4 PM',
          onPress: () => {
            rescheduleSession(booking.id, 'Next Friday', '04:00 PM');
            Alert.alert('Rescheduled', 'Session rescheduled to Next Friday, 04:00 PM.');
          },
        },
      ]
    );
  };

  return (
    <View className="bg-white border border-zinc-100 p-5 rounded-[24px] shadow-sm flex-col w-full">
      {/* Header Info */}
      <View className="flex-row items-center justify-between mb-4 border-b border-zinc-50 pb-4">
        <View className="flex-row items-center gap-3">
          <Image
            source={{ uri: booking.trainerPhoto }}
            className="w-12 h-12 rounded-full border border-zinc-50"
          />
          <View>
            <Text className="text-primary text-base font-extrabold tracking-tight">
              {booking.trainerName}
            </Text>
            <Text className="text-zinc-500 text-xs font-semibold">
              Certified Wellness Coach
            </Text>
          </View>
        </View>
        <View className="bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
          <Text className="text-indigo-700 text-[10px] font-black uppercase tracking-wider">
            {booking.workoutTitle}
          </Text>
        </View>
      </View>

      {/* Date & Time display */}
      <View className="flex-row justify-between items-center bg-zinc-50 px-4 py-3.5 rounded-2xl mb-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-base">📅</Text>
          <Text className="text-primary text-xs font-extrabold tracking-tight">
            {booking.date}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-base">⏱️</Text>
          <Text className="text-primary text-xs font-extrabold tracking-tight">
            {booking.time}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleReschedule}
          className="flex-1 bg-zinc-50 border border-zinc-100 py-3 rounded-xl items-center justify-center"
        >
          <Text className="text-primary text-xs font-bold">Reschedule</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCancel}
          className="flex-1 bg-red-50 border border-red-100 py-3 rounded-xl items-center justify-center"
        >
          <Text className="text-red-500 text-xs font-bold">Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
