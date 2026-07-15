import React from 'react';
import { View, Text, SafeAreaView, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCoachStore } from '../store/coachStore';
import { Ionicons } from '@expo/vector-icons';

export default function CoachProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const coachId = params.id as string;

  const { coaches, setSelectedCoachId } = useCoachStore();
  const coach = coaches.find((c) => c.id === coachId) || coaches[0];

  const handleBookCoach = () => {
    setSelectedCoachId(coach.id);
    Alert.alert(
      'Coach Selected',
      `${coach.name} has been selected for your session. Returning to your booking...`,
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to the booking screen
            router.back();
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header back button */}
      <View className="h-14 flex-row items-center px-6 border-b border-zinc-100">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111111" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-primary text-base font-black tracking-tight mr-8">
          Coach Profile
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Large Profile Image */}
        <View className="w-full aspect-[16/12] relative bg-zinc-100">
          <Image
            source={{ uri: coach.photo }}
            className="w-full h-full"
            resizeMode="cover"
          />
          {coach.verifiedBadge && (
            <View className="absolute top-4 right-4 bg-orange-500 px-3.5 py-1.5 rounded-full flex-row items-center gap-1 shadow-sm">
              <Ionicons name="checkmark-circle" size={12} color="white" />
              <Text className="text-white text-[9px] font-black uppercase tracking-wider">Verified Pro</Text>
            </View>
          )}
        </View>

        <View className="p-6 gap-6">
          {/* Header Info */}
          <View className="gap-1">
            <Text className="text-primary text-2xl font-black tracking-tight">{coach.name}</Text>
            <Text className="text-zinc-500 text-sm font-semibold">{coach.specialization || coach.specialty}</Text>
            <View className="flex-row items-center gap-2 mt-2">
              <View className="bg-zinc-50 border border-zinc-100 px-3 py-1.5 rounded-xl flex-row items-center gap-1">
                <Ionicons name="star" size={12} color="#EAB308" />
                <Text className="text-primary text-xs font-black">{coach.rating}</Text>
              </View>
              <View className="bg-zinc-50 border border-zinc-100 px-3 py-1.5 rounded-xl">
                <Text className="text-primary text-xs font-black">💼 {coach.yearsExperience || coach.experience} Experience</Text>
              </View>
            </View>
          </View>

          {/* Short Bio */}
          <View className="gap-2">
            <Text className="text-primary text-base font-extrabold tracking-tight">About Coach</Text>
            <Text className="text-zinc-500 text-sm leading-relaxed font-medium">
              {coach.shortBio || 'An elite fitness professional dedicated to bringing high-end wellness and lifestyle guidance to clients in the comfort of their home.'}
            </Text>
          </View>

          {/* Workout Specialties */}
          {coach.workoutSpecialties && (
            <View className="gap-3">
              <Text className="text-primary text-base font-extrabold tracking-tight">Workout Specialties</Text>
              <View className="flex-row flex-wrap gap-2">
                {coach.workoutSpecialties.map((specialty, i) => (
                  <View key={i} className="bg-zinc-50 border border-zinc-100 px-4 py-2.5 rounded-2xl">
                    <Text className="text-zinc-700 text-xs font-bold">✨ {specialty}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Certifications */}
          {coach.certifications && (
            <View className="gap-3">
              <Text className="text-primary text-base font-extrabold tracking-tight">Certifications</Text>
              <View className="gap-2">
                {coach.certifications.map((cert, i) => (
                  <View key={i} className="flex-row items-center bg-zinc-50/50 border border-zinc-100/50 p-3.5 rounded-2xl">
                    <Ionicons name="ribbon-outline" size={16} color="#FF6B00" className="mr-3" />
                    <Text className="text-zinc-700 text-xs font-bold flex-1">{cert}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Achievements */}
          {coach.achievements && (
            <View className="gap-3">
              <Text className="text-primary text-base font-extrabold tracking-tight">Achievements</Text>
              <View className="gap-2">
                {coach.achievements.map((ach, i) => (
                  <View key={i} className="flex-row items-center bg-zinc-50/50 border border-zinc-100/50 p-3.5 rounded-2xl">
                    <Ionicons name="trophy-outline" size={16} color="#EAB308" className="mr-3" />
                    <Text className="text-zinc-700 text-xs font-bold flex-1">{ach}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Languages */}
          {coach.languages && (
            <View className="gap-2">
              <Text className="text-primary text-base font-extrabold tracking-tight">Languages</Text>
              <Text className="text-zinc-500 text-sm font-semibold">🗣️ {coach.languages.join(', ')}</Text>
            </View>
          )}

          {/* Availability */}
          {coach.availability && (
            <View className="gap-3">
              <Text className="text-primary text-base font-extrabold tracking-tight">Daily Availability</Text>
              <View className="flex-row flex-wrap gap-2">
                {coach.availability.map((time, i) => (
                  <View key={i} className="bg-zinc-50 border border-zinc-100 px-3 py-2 rounded-xl">
                    <Text className="text-zinc-600 text-xs font-bold">⏱️ {time.split(' - ')[0]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Reviews */}
          {coach.reviews && coach.reviews.length > 0 && (
            <View className="gap-3">
              <Text className="text-primary text-base font-extrabold tracking-tight">Client Reviews</Text>
              <View className="gap-3">
                {coach.reviews.map((rev, i) => (
                  <View key={i} className="bg-zinc-50 border border-zinc-100/50 p-4 rounded-2xl gap-2">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-primary text-xs font-extrabold">{rev.reviewerName}</Text>
                      <View className="flex-row items-center gap-0.5">
                        {[...Array(5)].map((_, idx) => (
                          <Ionicons
                            key={idx}
                            name="star"
                            size={10}
                            color={idx < Math.floor(rev.rating) ? '#EAB308' : '#D1D5DB'}
                          />
                        ))}
                      </View>
                    </View>
                    <Text className="text-zinc-500 text-xs font-medium leading-relaxed">
                      "{rev.comment}"
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Book This Coach Button */}
      <View className="p-6 bg-white border-t border-zinc-100">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleBookCoach}
          className="w-full py-4 bg-zinc-900 rounded-[20px] items-center justify-center shadow-sm"
        >
          <Text className="text-white text-base font-extrabold tracking-wide">
            Book This Coach (₹{coach.price || 1200}/session)
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
