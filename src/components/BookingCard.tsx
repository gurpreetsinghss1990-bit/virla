import React from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Booking } from '../types';
import { BookingStatusBadge } from './BookingStatusBadge';
import { useBookingStore } from '../store/bookingStore';
import { useRouter } from 'expo-router';

interface BookingCardProps {
  booking: Booking;
}

export function BookingCard({ booking }: BookingCardProps) {
  const router = useRouter();
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
      'Select a new time slot.',
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

  const handleViewDetails = () => {
    router.push({
      pathname: '/session-detail',
      params: { id: booking.id },
    });
  };

  const isUpcoming = booking.status === 'upcoming';

  return (
    <View className="bg-white border border-zinc-100 p-5 rounded-[24px] shadow-sm mb-4">
      {/* Top Section */}
      <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-zinc-50">
        <View className="flex-row items-center gap-3">
          <Image
            source={{ uri: booking.trainerPhoto }}
            className="w-12 h-12 rounded-full border border-zinc-150"
          />
          <View>
            <Text className="text-primary text-base font-black tracking-tight">
              {booking.trainerName.includes('Assigning') ? booking.trainerName : `Coach ${booking.trainerName}`}
            </Text>
            <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
              {booking.workoutTitle} • ₹{booking.price || 1200}
            </Text>
          </View>
        </View>
        <BookingStatusBadge status={booking.status} />
      </View>

      {/* Date & Time Row */}
      <View className="flex-row justify-between items-center bg-zinc-50 px-4 py-3 rounded-2xl mb-4">
        <Text className="text-zinc-600 text-xs font-semibold">
          📅 {booking.date}
        </Text>
        <Text className="text-zinc-600 text-xs font-semibold">
          ⏱️ {booking.time}
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        {isUpcoming && (
          <>
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
          </>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleViewDetails}
          className={`py-3 rounded-xl items-center justify-center ${
            isUpcoming ? 'px-4 bg-zinc-900 border border-zinc-900' : 'flex-1 bg-zinc-900 border border-zinc-900'
          }`}
        >
          <Text className="text-white text-xs font-bold">
            {isUpcoming ? 'Details' : 'View Details'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
