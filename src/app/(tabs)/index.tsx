import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useBookingStore } from '../../store/bookingStore';
import { useWorkoutStore } from '../../store/workoutStore';
import { 
  AppHeader, 
  HeroBanner, 
  MembershipCard, 
  SessionCard, 
  RecommendationCard, 
  CategoryGrid, 
  CoachCard 
} from '../../components';

export default function HomeScreen() {
  const router = useRouter();
  const { bookings } = useBookingStore();
  const { coaches } = useWorkoutStore();
  const upcomingBookings = bookings.filter((b) => b.status === 'upcoming');
  const pastBookings = bookings.filter((b) => b.status === 'completed');

  return (
    <View className="flex-1 bg-white">
      {/* App Header (Fixed at the top) */}
      <AppHeader 
        onNotificationPress={() => {}} 
        onAvatarPress={() => {}} 
      />

      {/* Main Dashboard Scroll Area */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="p-6 gap-8">
          
          {/* Section 1: Hero Banner */}
          <HeroBanner />

          {/* Section 2: Membership Card */}
          <MembershipCard />

          {/* Section 3: Upcoming Session */}
          <View className="gap-3">
            <Text className="text-primary text-lg font-black tracking-tight">
              Upcoming Session
            </Text>
            {upcomingBookings.length > 0 ? (
              upcomingBookings.map((booking) => (
                <SessionCard key={booking.id} booking={booking} />
              ))
            ) : (
              <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-[20px] items-center justify-center py-8">
                <Text className="text-2xl mb-2">🧘‍♀️</Text>
                <Text className="text-primary text-sm font-bold">No sessions scheduled</Text>
                <Text className="text-zinc-400 text-xs text-center mt-1">
                  Book a session or try our AI recommendation below.
                </Text>
              </View>
            )}
          </View>

          {/* Section 4: Today's Recommendation (AI) */}
          <View className="gap-3">
            <Text className="text-primary text-lg font-black tracking-tight">
              Today's Recommendation
            </Text>
            <RecommendationCard />
          </View>

          <View className="gap-3">
            <Text className="text-primary text-lg font-black tracking-tight px-6">
              Workout Categories
            </Text>
            <CategoryGrid 
              onCategorySelect={(id) => {
                router.push({
                  pathname: '/workout-detail',
                  params: { id },
                });
              }}
            />
          </View>

          {/* Section 6: Recent Activity */}
          <View className="gap-3">
            <Text className="text-primary text-lg font-black tracking-tight">
              Recent Activity
            </Text>
            {pastBookings.length > 0 ? (
              <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-[24px] gap-4">
                {pastBookings.map((past, index) => (
                  <View 
                    key={past.id}
                    className={`flex-row items-center justify-between ${
                      index > 0 ? 'border-t border-zinc-100 pt-4' : ''
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="w-10 h-10 bg-white border border-zinc-100 rounded-xl items-center justify-center">
                        <Text className="text-lg">✅</Text>
                      </View>
                      <View>
                        <Text className="text-primary text-sm font-extrabold tracking-tight">
                          {past.workoutTitle}
                        </Text>
                        <Text className="text-zinc-400 text-xs font-semibold">
                          Coach {past.trainerName}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-primary text-xs font-bold">
                        Completed
                      </Text>
                      <Text className="text-zinc-400 text-[10px] font-semibold mt-0.5">
                        {past.date}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-[20px] items-center justify-center py-6">
                <Text className="text-zinc-400 text-xs">No recent completed sessions.</Text>
              </View>
            )}
          </View>

          {/* Section 7: Featured Coaches */}
          <View className="gap-3">
            <Text className="text-primary text-lg font-black tracking-tight px-6">
              Featured Coaches
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24 }}
            >
              {coaches.map((coach) => (
                <CoachCard key={coach.id} coach={coach} />
              ))}
            </ScrollView>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
