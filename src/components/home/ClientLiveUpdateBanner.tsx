import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { softShadow } from '../../utils/shadows';

interface ClientLiveUpdateBannerProps {
  activeBooking: any;
  navigateSafely: (target: any) => void;
}

export const ClientLiveUpdateBanner: React.FC<ClientLiveUpdateBannerProps> = ({
  activeBooking,
  navigateSafely,
}) => {
  if (!activeBooking) return null;

  return (
    <Pressable
      onPress={() => navigateSafely({ pathname: '/session-detail', params: { id: activeBooking.id } })}
      className="mx-6 mt-3 mb-2 bg-zinc-950 border border-zinc-800 rounded-[22px] flex-row items-center justify-between p-4 shadow-lg"
      style={{
        backgroundColor: '#09090b',
        ...softShadow({ color: '#000000', opacity: 0.18, radius: 10, offsetY: 4 }),
      }}
    >
      <View className="flex-row items-center gap-3.5 flex-1 pr-2">
        {/* Glowing Live Radar Dot */}
        <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(225, 29, 72, 0.15)' }}>
          <View 
            className="w-3 h-3 rounded-full bg-[#E11D48]"
            style={{
              backgroundColor: '#E11D48',
              ...softShadow({ color: '#E11D48', opacity: 0.9, radius: 6, offsetY: 0 }),
            }}
          />
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">
              Live Concierge Update
            </Text>
            <View 
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
            >
              <Text className="text-emerald-300 text-[9px] font-extrabold uppercase tracking-wider">
                Active
              </Text>
            </View>
          </View>

          <Text className="text-white text-[13px] font-bold mt-1 leading-5" numberOfLines={2}>
            {activeBooking.timelineStatus === 'booked' && 'Your session is booked & confirmed. Coach details will be shared soon.'}
            {activeBooking.timelineStatus === 'trainer_assigned' && 'Your session is booked & confirmed. Coach details will be shared soon.'}
            {activeBooking.timelineStatus === 'trainer_accepted' && `Coach ${activeBooking.trainerName} accepted your booking`}
            {activeBooking.timelineStatus === 'trainer_preparing' && `Coach ${activeBooking.trainerName} is preparing your session gear`}
            {activeBooking.timelineStatus === 'trainer_travelling' && `Coach ${activeBooking.trainerName} is on the way`}
            {activeBooking.timelineStatus === 'trainer_arrived' && `Coach ${activeBooking.trainerName} has arrived at your gate!`}
            {activeBooking.timelineStatus === 'otp_verified' && 'Check-in Verified. Starting workout.'}
            {activeBooking.timelineStatus === 'workout_started' && 'Workout in progress (active session)'}
            {activeBooking.timelineStatus === 'workout_completed' && 'Workout complete! Tap to submit feedback.'}
            {activeBooking.timelineStatus === 'trainer_report_submitted' && 'Session report submitted. Rate your workout.'}
            {activeBooking.timelineStatus === 'customer_review_pending' && 'Rating review pending. Share your experience.'}
          </Text>
        </View>
      </View>

      <View 
        className="w-8 h-8 rounded-full items-center justify-center"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <Feather name="chevron-right" size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
};
