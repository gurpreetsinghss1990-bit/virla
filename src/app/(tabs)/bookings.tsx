import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBookingStore } from '../../store/bookingStore';
import { BookingCard } from '../../components/BookingCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useUserStore } from '../../store/userStore';
import { Database } from '../../database/Database';

type FilterType = 'upcoming' | 'completed' | 'cancelled' | 'today' | 'past';

export default function BookingsScreen() {
  const { bookings } = useBookingStore();
  const { role, user } = useUserStore();
  const [prevRole, setPrevRole] = useState(role);
  const [activeFilter, setActiveFilter] = useState<FilterType>(role === 'trainer' ? 'today' : 'upcoming');
  const [loading, setLoading] = useState(true);

  const profile = Database.getProfile(user.id);
  const coach = Database.schema.coaches.find(c => c.name === user.name || c.id === user.id);

  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('=== BOOKING DEBUG LOG ===');
      bookings.forEach(b => {
        const matchesTrainer = b.trainerId === user.id || b.trainerName === user.name;
        const matchesStatus = b.status === 'upcoming';
        const isToday = b.date.includes('Today') || b.date.includes(new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }));
        console.log(`Booking ID: ${b.id} | TrainerID: ${b.trainerId} | ClientID: ${b.clientId} | Date: ${b.date} | Time: ${b.time} | Status: ${b.status} | MatchesTrainer: ${matchesTrainer} | MatchesStatus: ${matchesStatus} | isToday: ${isToday}`);
      });
    }
  }, [bookings, user.id, user.name]);

  if (role !== prevRole) {
    setPrevRole(role);
    setActiveFilter(role === 'trainer' ? 'today' : 'upcoming');
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const filteredBookings = bookings.filter((b) => {
    if (role === 'trainer') {
      const isToday = b.date.includes('Today') || b.date.includes(new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }));
      if (activeFilter === 'today') {
        return isToday && b.status === 'upcoming';
      }
      if (activeFilter === 'upcoming') {
        return b.status === 'upcoming';
      }
      if (activeFilter === 'past') {
        return b.status === 'completed' || b.status === 'cancelled';
      }
      return false;
    }
    return b.status === activeFilter;
  });

  const getFilterLabel = (type: FilterType) => {
    switch (type) {
      case 'today': return "Today's";
      case 'upcoming': return role === 'trainer' ? 'Weekly' : 'Upcoming';
      case 'past': return 'Calendar History';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
    }
  };

  const filterOptions: FilterType[] = role === 'trainer'
    ? ['today', 'upcoming', 'past']
    : ['upcoming', 'completed', 'cancelled'];

  return (
    <SafeAreaViewWrapper>
      {loading ? (
        <SkeletonLoader layout="bookings" />
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          className="flex-1 bg-[#F7F8FC]"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
        >
        {/* Page Header */}
        <View className="mb-6">
          <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest">
            {role === 'trainer' ? 'PRO CONSOLE' : 'MY SCHEDULE'}
          </Text>
          <Text className="text-[#101828] text-3xl font-black tracking-tight mt-1">
            {role === 'trainer' ? 'My Visits' : 'Booked Sessions'}
          </Text>
          <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1">
            {role === 'trainer' 
              ? 'Manage check-ins, accept client jobs, and log session summaries.'
              : 'Track and manage all your scheduled home wellness visits.'}
          </Text>
        </View>
        
        {typeof __DEV__ !== 'undefined' && __DEV__ && role === 'trainer' && (
          <View className="bg-zinc-950 border border-zinc-800 p-5 rounded-[24px] mb-6 gap-3 shadow-md">
            <Text className="text-amber-500 text-[9px] font-black uppercase tracking-widest pl-1">BOOKING DEBUG</Text>
            <View className="gap-1.5 px-1">
              <Text className="text-zinc-400 text-[10px] font-bold">Current Auth User: <Text className="text-white font-mono">{user.id || 'N/A'}</Text></Text>
              <Text className="text-zinc-400 text-[10px] font-bold">Current Profile: <Text className="text-white font-mono">{profile?.id || 'N/A'}</Text></Text>
              <Text className="text-zinc-400 text-[10px] font-bold">Current Trainer: <Text className="text-white font-mono">{coach ? `${coach.id} (${coach.name})` : 'N/A'}</Text></Text>
              <Text className="text-zinc-400 text-[10px] font-bold">Remote bookings fetched: <Text className="text-white">{bookings.length}</Text></Text>
              <Text className="text-zinc-400 text-[10px] font-bold">Bookings matching trainer: <Text className="text-white">{bookings.filter(b => b.trainerId === user.id || b.trainerName === user.name).length}</Text></Text>
              <Text className="text-zinc-400 text-[10px] font-bold">Bookings matching date: <Text className="text-white">{bookings.filter(b => b.date.includes('Today') || b.date.includes(new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }))).length}</Text></Text>
              <Text className="text-zinc-400 text-[10px] font-bold">Bookings matching status: <Text className="text-white">{bookings.filter(b => b.status === 'upcoming').length}</Text></Text>
              <Text className="text-zinc-400 text-[10px] font-bold">Final upcoming sessions: <Text className="text-white">{filteredBookings.length}</Text></Text>
            </View>
          </View>
        )}

        {/* Filter Capsule Selector Tabs */}
        <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1.5 rounded-2xl mb-6">
          {filterOptions.map((opt) => {
            const isActive = activeFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.8}
                onPress={() => setActiveFilter(opt)}
                className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                  isActive ? 'bg-[#101828]' : ''
                }`}
                style={isActive ? {
                  shadowColor: '#101828',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                } : undefined}
              >
                <Text 
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    isActive ? 'text-white' : 'text-[#6B7280]'
                  }`}
                >
                  {getFilterLabel(opt)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bookings Render List */}
        <View>
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))
          ) : (
            <EmptyState 
              type={activeFilter === 'completed' || activeFilter === 'past' ? 'no-sessions' : 'no-bookings'} 
              message={
                role === 'trainer'
                  ? `You have no ${activeFilter} visits listed in your current schedule.`
                  : activeFilter === 'upcoming' 
                    ? 'Schedule your next premium at-home training session from the home dashboard.'
                    : `You do not have any ${activeFilter} visits logged in your profile.`
              }
            />
          )}
        </View>
        </ScrollView>
      )}
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {children}
    </View>
  );
}
