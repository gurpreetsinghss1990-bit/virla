import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Image as ExpoImage } from 'expo-image';
import { NativeDivider } from '../NativeDivider';
import { softShadow } from '../../utils/shadows';

interface ClientUpcomingSessionSectionProps {
  upcomingBookings: any[];
  formatToDDMMYYYY: (dateStr: string) => string;
  getDisplayWorkoutTitle: (title: string) => string;
  trainerPhotoSource: (id?: string | null, photo?: string | null) => any;
  setActivePartnerBookingId: (id: string) => void;
  setPartnerModalVisible: (visible: boolean) => void;
  navigateSafely: (target: any) => void;
}

export const ClientUpcomingSessionSection: React.FC<ClientUpcomingSessionSectionProps> = ({
  upcomingBookings,
  formatToDDMMYYYY,
  getDisplayWorkoutTitle,
  trainerPhotoSource,
  setActivePartnerBookingId,
  setPartnerModalVisible,
  navigateSafely,
}) => {
  return (
    <View className="gap-3">
      <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#0F172A', letterSpacing: -0.3 }}>
        Upcoming Session
      </Text>
      {upcomingBookings.length > 0 ? (() => {
        const bookingData = upcomingBookings[0];
        const isTravelling = bookingData.timelineStatus === 'trainer_travelling';
        const isAccepted = bookingData.timelineStatus !== 'booked' && bookingData.timelineStatus !== 'trainer_assigned';

        return (
          <View 
            className="p-5 rounded-2xl gap-3.5 bg-white border border-[#F1E5E7]"
            style={softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 })}
          >
            {/* Top: Coach avatar, title, and badge */}
            <View className="flex-row justify-between items-start">
              <View className="flex-row items-center gap-3">
                {!isAccepted ? (
                  <View className="w-13 h-13 rounded-full bg-rose-50 border border-rose-100 items-center justify-center" style={{ width: 48, height: 48, borderRadius: 24 }}>
                    <Feather name="calendar" size={18} color="#E11D48" />
                  </View>
                ) : (
                  <ExpoImage
                    source={trainerPhotoSource(bookingData.trainerId || bookingData.coachId, bookingData.trainerPhoto)}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    transition={150}
                    style={{ width: 48, height: 48, borderRadius: 24 }}
                    className="border border-zinc-150"
                  />
                )}
                <View>
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 15, color: '#0F172A' }}>
                    {getDisplayWorkoutTitle(bookingData.workoutTitle)}
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', marginTop: 1 }}>
                    {!isAccepted 
                      ? 'Trainer details will be shared soon.' 
                      : `with ${bookingData.trainerName}`
                    }
                  </Text>
                </View>
              </View>
              {isAccepted && (
                <View className="bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-full">
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#D97706', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    ★ ELITE COACH
                  </Text>
                </View>
              )}
            </View>

            <View className="h-[1px] bg-[#F1E5E7]" />

            {/* Middle: Timeline path details */}
            <View className="flex-row justify-between items-center px-1">
              <View className="flex-row items-stretch gap-3 flex-1 pr-4">
                <View className="items-center justify-between py-1">
                  <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <View className="w-[1px] flex-1 border-l border-zinc-300 border-dashed my-0.5" />
                  <View className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                </View>
                <View className="gap-2 flex-1">
                  <View>
                    <Text numberOfLines={1} style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: '#0F172A' }}>
                      {formatToDDMMYYYY(bookingData.date)}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748B', marginTop: 1 }}>
                      {bookingData.time ? bookingData.time.split(' - ')[0] : ''}
                    </Text>
                  </View>
                  <View>
                    <Text numberOfLines={1} style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: '#0F172A' }}>
                      Home
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748B', marginTop: 1 }}>
                      {bookingData.address ? bookingData.address.split(',')[0] : 'Doorstep Venue'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status pill & Map Action */}
              <View className="items-end gap-3">
                <View className="bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-xl flex-row items-center gap-1">
                  <Feather 
                    name={isTravelling ? 'truck' : 'check-circle'} 
                    size={11} 
                    color="#16C784" 
                  />
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, color: '#16C784', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    {isTravelling ? 'Coach on the way' : 'Confirmed'}
                  </Text>
                </View>

                <Pressable
                  onPress={() => navigateSafely({ pathname: '/session-detail', params: { id: bookingData.id } })}
                  className="w-10 h-10 rounded-full bg-[#16C784] items-center justify-center"
                  style={softShadow({ color: '#16C784', opacity: 0.25, radius: 10, offsetY: 4 })}
                >
                  <Feather name="navigation" size={15} color="white" />
                </Pressable>
              </View>
            </View>

            {bookingData.sessionType === 'SINGLE' && bookingData.timelineStatus !== 'otp_verified' && bookingData.timelineStatus !== 'workout_started' && bookingData.timelineStatus !== 'workout_completed' && bookingData.timelineStatus !== 'session_closed' && bookingData.status === 'upcoming' && (
              <>
                <NativeDivider color="#F1E5E7" className="mt-2 mb-1" />
                <Pressable
                  onPress={() => {
                    setActivePartnerBookingId(bookingData.id);
                    setPartnerModalVisible(true);
                  }}
                  className="flex-row items-center justify-center gap-1.5 py-1.5"
                >
                  <Feather name="plus-circle" size={13} color="#E11D48" />
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 11, color: '#E11D48', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Add Partner
                  </Text>
                </Pressable>
              </>
            )}

            {bookingData.sessionType === 'COUPLE' && bookingData.partnerName && (
              <>
                <NativeDivider color="#F1E5E7" className="mt-2 mb-1" />
                <View className="flex-row items-center justify-center gap-1.5 py-0.5">
                  <Feather name="users" size={12} color="#10B981" />
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#64748B' }}>
                    Training with <Text style={{ fontFamily: 'Outfit_700Bold', color: '#0F172A' }}>{bookingData.partnerName}</Text>
                  </Text>
                </View>
              </>
            )}
          </View>
        );
      })() : (
        <View 
          className="p-6 rounded-2xl items-center justify-center gap-3.5 bg-white border border-[#F1E5E7]"
          style={softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 })}
        >
          <View 
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: '#FFF1F2',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="calendar" size={22} color="#E11D48" />
          </View>
          <View className="items-center">
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#0F172A', letterSpacing: -0.2 }}>
              No Upcoming Sessions Scheduled
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4, maxWidth: 270, lineHeight: 16 }}>
              Schedule your next personal training session today.
            </Text>
          </View>
          <Pressable
            onPress={() => navigateSafely('/booking')}
            className="border border-rose-200 bg-rose-50/50 px-5 py-2.5 rounded-xl shadow-sm"
          >
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#E11D48' }}>
              Book Doorstep Trainer Now
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};
