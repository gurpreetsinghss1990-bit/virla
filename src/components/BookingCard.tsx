import React from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Booking } from '../types';
import { BookingStatusBadge } from './BookingStatusBadge';
import { useBookingStore } from '../store/bookingStore';
import { useRouter } from 'expo-router';
import { LuxuryCard } from './LuxuryCard';
import { Feather } from '@expo/vector-icons';

import { useUserStore } from '../store/userStore';
import { SessionEngine } from '../services/SessionEngine';

interface BookingCardProps {
  booking: Booking;
}

export function BookingCard({ booking }: BookingCardProps) {
  const router = useRouter();
  const { cancelSession, rescheduleSession } = useBookingStore();
  const { role } = useUserStore();

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
  const isTrainer = role === 'trainer';
  const isAccepted = booking.timelineStatus !== 'booked' && booking.timelineStatus !== 'trainer_assigned';
  const isSearching = !booking.trainerId || booking.trainerId === 'searching' || booking.trainerName === 'No Trainer Available';

  return (
    <LuxuryCard className="p-5 mb-4" interactive={false}>
      {/* Top Section */}
      <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-zinc-100">
        <View className="flex-row items-center gap-3 flex-1 pr-2">
          {isTrainer ? (
            <View className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-150 items-center justify-center">
              <Text className="text-lg">👤</Text>
            </View>
          ) : (isUpcoming && isSearching) ? (
            <View className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 items-center justify-center">
              <Text className="text-lg">🧘</Text>
            </View>
          ) : (
            <Image
              source={{ uri: booking.trainerPhoto }}
              className="w-12 h-12 rounded-full border border-zinc-150"
            />
          )}
          <View className="flex-1">
            <Text className="text-[#101828] text-base font-extrabold tracking-tight">
              {isTrainer 
                ? 'Client: Viral' 
                : (isUpcoming 
                    ? (isSearching 
                        ? 'Searching for Trainer...' 
                        : `Coach ${booking.trainerName}`
                      ) 
                    : `Coach ${booking.trainerName}`
                  )}
            </Text>
            <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider mt-0.5">
              {isTrainer 
                ? `${booking.workoutTitle} • 60 mins` 
                : (isUpcoming 
                    ? (isSearching 
                        ? `${booking.workoutTitle} • Searching for Trainer` 
                        : (!isAccepted 
                            ? `${booking.workoutTitle} • Waiting for Trainer Confirmation` 
                            : `${booking.workoutTitle} • Trainer confirmed. Privacy rules apply.`
                          )
                      ) 
                    : `${booking.workoutTitle} • ₹${booking.price || 1200}`
                  )}
            </Text>
          </View>
        </View>
        <BookingStatusBadge status={booking.status} />
      </View>

      {/* Location address row for trainers */}
      {isTrainer && booking.address && (
        <View className="bg-zinc-50 px-4 py-2 rounded-xl mb-3 flex-row items-center gap-2">
          <Feather name="map-pin" size={10} color="#6B7280" />
          <Text className="text-zinc-500 text-[10px] font-semibold flex-1 leading-snug">
            {booking.address}
          </Text>
        </View>
      )}

      {/* Date & Time Row */}
      <View className="flex-row justify-between items-center bg-zinc-50 px-4 py-3 rounded-xl mb-4">
        <Text className="text-zinc-500 text-xs font-semibold">
          📅 {booking.date}
        </Text>
        <Text className="text-zinc-500 text-xs font-semibold">
          ⏱️ {booking.time}
        </Text>
      </View>

      {/* Start Session available banner for trainer */}
      {(() => {
        if (!isTrainer || !isUpcoming) return null;
        const isBeforeWindow = SessionEngine.isBeforeStartWindow(booking);
        if (!isBeforeWindow) return null;
        const sessionDate = SessionEngine.getSessionStartDate(booking);
        const startWindow = new Date(sessionDate.getTime() - 30 * 60 * 1000);
        
        const formatTimeOnly = (d: Date) => {
          let hr = d.getHours();
          const min = String(d.getMinutes()).padStart(2, '0');
          const ampm = hr >= 12 ? 'PM' : 'AM';
          hr = hr % 12;
          hr = hr ? hr : 12;
          return `${String(hr).padStart(2, '0')}:${min} ${ampm}`;
        };

        return (
          <View className="bg-amber-50 border border-amber-150 px-4 py-2.5 rounded-xl mb-3 flex-row items-center gap-2">
            <Feather name="clock" size={10} color="#D97706" />
            <Text className="text-[#D97706] text-[10px] font-bold uppercase tracking-wider">
              Start Session available from {formatTimeOnly(startWindow)}
            </Text>
          </View>
        );
      })()}

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        {isTrainer ? (
          isUpcoming ? (
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Alert.alert('Navigate', 'Opening Google Maps routing direction to Worli, Mumbai.')}
                className="flex-1 bg-zinc-50 border py-3 rounded-xl items-center justify-center flex-row gap-1.5"
                style={{ borderColor: 'rgba(228, 228, 231, 0.6)' }}
              >
                <Feather name="navigation" size={12} color="#101828" />
                <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Navigate</Text>
              </TouchableOpacity>
              {(() => {
                const isBeforeWindow = SessionEngine.isBeforeStartWindow(booking);
                const sessionDate = SessionEngine.getSessionStartDate(booking);
                const startWindow = new Date(sessionDate.getTime() - 30 * 60 * 1000);
                const formatTimeOnly = (d: Date) => {
                  let hr = d.getHours();
                  const min = String(d.getMinutes()).padStart(2, '0');
                  const ampm = hr >= 12 ? 'PM' : 'AM';
                  hr = hr % 12;
                  hr = hr ? hr : 12;
                  return `${String(hr).padStart(2, '0')}:${min} ${ampm}`;
                };

                if (isBeforeWindow) {
                  return (
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => Alert.alert('Session Locked', `This session can only be started from ${formatTimeOnly(startWindow)}.`)}
                      className="flex-1 py-3 rounded-xl items-center justify-center bg-zinc-200 border border-zinc-200"
                    >
                      <Text className="text-zinc-400 text-xs font-black uppercase tracking-wider">Start Session</Text>
                    </TouchableOpacity>
                  );
                } else {
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleViewDetails}
                      className="flex-1 py-3 rounded-xl items-center justify-center bg-[#E11D48] border border-[#E11D48]"
                    >
                      <Text className="text-white text-xs font-black uppercase tracking-wider">Start Session</Text>
                    </TouchableOpacity>
                  );
                }
              })()}
            </>
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleViewDetails}
              className="flex-1 py-3 rounded-xl items-center justify-center bg-[#101828] border border-[#101828]"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">View Summary</Text>
            </TouchableOpacity>
          )
        ) : (
          <>
            {isUpcoming && (
              <>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleReschedule}
                  className="flex-1 bg-zinc-50 border py-3 rounded-xl items-center justify-center"
                  style={{ borderColor: 'rgba(228, 228, 231, 0.6)' }}
                >
                  <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Reschedule</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleCancel}
                  className="flex-1 border py-3 rounded-xl items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(254, 242, 242, 0.5)',
                    borderColor: 'rgba(254, 226, 226, 0.5)',
                  }}
                >
                  <Text className="text-[#FF4D4F] text-xs font-black uppercase tracking-wider">Cancel</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleViewDetails}
              className={`py-3 rounded-xl items-center justify-center bg-[#101828] border border-[#101828] ${
                isUpcoming ? 'px-5' : 'flex-1'
              }`}
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">
                {isUpcoming ? 'Details' : 'View Details'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </LuxuryCard>
  );
}
