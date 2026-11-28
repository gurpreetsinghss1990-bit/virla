import React from 'react';
import { View, Text, Pressable } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CoachVideoAvatar } from '../CoachVideoAvatar';
import { getTrainerMedia } from '../../services/bunnyCdnService';
import { NativeDivider } from '../NativeDivider';
import { softShadow } from '../../utils/shadows';

interface TopPerformingTrainer {
  id: string;
  name: string;
  designation: string;
  specialty: string;
  video: string;
  thumb: string;
}

interface ClientTopTrainersSectionProps {
  activeBooking: any;
  topPerformingTrainers: TopPerformingTrainer[];
  onTrainerScroll: (event: any) => void;
  navigateSafely: (target: any) => void;
  trainerPhotoSource: (id?: string | null, photo?: string | null) => any;
  getWorkoutEmoji: (title: string) => string;
  getDisplayWorkoutTitle: (title: string) => string;
}

export const ClientTopTrainersSection: React.FC<ClientTopTrainersSectionProps> = ({
  activeBooking,
  topPerformingTrainers,
  onTrainerScroll,
  navigateSafely,
  trainerPhotoSource,
  getWorkoutEmoji,
  getDisplayWorkoutTitle,
}) => {
  return (
    <View className="gap-3">
      <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#0F172A', letterSpacing: -0.3 }}>
        Our Top Performing Trainers of the month
      </Text>
      
      {activeBooking ? (() => {
        const isActiveAccepted = activeBooking.timelineStatus !== 'booked' && activeBooking.timelineStatus !== 'trainer_assigned';
        if (!isActiveAccepted) {
          return (
            <View 
              className="p-5 rounded-[22px] gap-4"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#F1E5E7',
                borderWidth: 1,
                ...softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 }),
              }}
            >
              <View className="flex-row gap-4 items-center">
                <View className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 items-center justify-center">
                  <Text className="text-2xl">{getWorkoutEmoji(activeBooking.workoutTitle)}</Text>
                </View>

                <View className="flex-1 gap-1">
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#0F172A' }}>
                    {getWorkoutEmoji(activeBooking.workoutTitle)} {getDisplayWorkoutTitle(activeBooking.workoutTitle)} Booked
                  </Text>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B' }}>
                    Your session is confirmed. Trainer details will be shared soon.
                  </Text>

                  <View className="flex-row items-center gap-1.5 mt-1">
                    <Feather name="clock" size={11} color="#FF8A00" />
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B', textTransform: 'uppercase' }}>
                      Scheduled for {activeBooking.time ? activeBooking.time.split(' - ')[0] : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }
        return (
          <View 
            className="p-4 rounded-[22px] gap-3.5"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#F1E5E7',
              borderWidth: 1,
              ...softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 }),
            }}
          >
            <View className="flex-row gap-4 items-center">
              <View className="relative">
                <CoachVideoAvatar
                  id={activeBooking.trainerId || activeBooking.coachId || activeBooking.trainerName || undefined}
                  videoUri={getTrainerMedia(activeBooking.trainerId, activeBooking.trainerName)?.video}
                  posterUri={trainerPhotoSource(activeBooking.trainerId || activeBooking.coachId, activeBooking.trainerPhoto)}
                  width={90}
                  height={90}
                  borderRadius={18}
                  scale={1.1}
                  showSunburstScrim={true}
                />
                <View 
                  className="absolute -top-1.5 -left-1.5 bg-white px-1.5 py-0.5 rounded-lg items-center justify-center flex-row border border-slate-100"
                  style={softShadow({ color: '#0F172A', opacity: 0.05, radius: 4, offsetY: 2 })}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: '#1E293B' }}>⭐ 4.9</Text>
                </View>
              </View>

              <View className="flex-1 gap-1">
                <View className="flex-row items-center justify-between">
                  <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#0F172A' }}>
                    {activeBooking.trainerName}
                  </Text>
                  <Feather name="chevron-right" size={14} color="#94A3B8" />
                </View>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#64748B' }}>
                  {activeBooking.trainerSpeciality || 'Strength & Conditioning Specialist'}
                </Text>

                <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <View className="flex-row items-center gap-1">
                    <Feather name="clock" size={11} color="#FF8A00" />
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#64748B', textTransform: 'uppercase' }}>
                      Arriving {activeBooking.time ? activeBooking.time.split(' - ')[0] : '10:30 AM'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <NativeDivider color="#F1E5E7" />

            <Pressable
              onPress={() => {
                navigateSafely({ pathname: '/session-detail', params: { id: activeBooking.id } });
              }}
              className="w-full bg-rose-50 rounded-xl items-center justify-center flex-row gap-2 py-3"
            >
              <Feather name="map-pin" size={14} color="#E11D48" />
              <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: '#E11D48', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Track Coach Live
              </Text>
            </Pressable>
          </View>
        );
      })() : (
        <View 
          className="py-3 px-2 rounded-2xl relative overflow-hidden"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#F1E5E7',
            borderWidth: 1,
            ...softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 }),
          }}
        >
          <ReanimatedAnimated.ScrollView
            horizontal
            nestedScrollEnabled={true}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={110}
            snapToAlignment="start"
            overScrollMode="always"
            bounces={true}
            alwaysBounceHorizontal={true}
            onScroll={onTrainerScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}
          >
            {topPerformingTrainers.map((trainer) => (
              <View key={trainer.id} className="items-center" style={{ width: 100 }}>
                <View className="mb-2">
                  <CoachVideoAvatar 
                    id={trainer.id}
                    videoUri={trainer.video}
                    posterUri={trainer.thumb}
                    width={66} 
                    height={66} 
                    borderRadius={33} 
                    scale={1.0} 
                    showSunburstScrim={false} 
                  />
                </View>
                <Text 
                  numberOfLines={1}
                  style={{ fontFamily: 'Outfit_700Bold', fontSize: 11, color: '#0F172A', textAlign: 'center' }}
                >
                  {trainer.name}
                </Text>
                <Text 
                  numberOfLines={1}
                  style={{ fontFamily: 'Inter_500Medium', fontSize: 9, color: '#94A3B8', textAlign: 'center', marginTop: 1 }}
                >
                  {trainer.designation}
                </Text>
                <Text 
                  numberOfLines={1}
                  style={{ fontFamily: 'Inter_500Medium', fontSize: 9, color: '#475569', textAlign: 'center' }}
                >
                  {trainer.specialty}
                </Text>
                <View className="flex-row items-center justify-center gap-0.5 mt-1">
                  <Ionicons name="star" size={9} color="#F59E0B" />
                  <Ionicons name="star" size={9} color="#F59E0B" />
                  <Ionicons name="star" size={9} color="#F59E0B" />
                  <Ionicons name="star" size={9} color="#F59E0B" />
                  <Ionicons name="star" size={9} color="#F59E0B" />
                </View>
              </View>
            ))}
          </ReanimatedAnimated.ScrollView>
        </View>
      )}
    </View>
  );
};
