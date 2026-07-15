import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useBookingStore } from '../../store/bookingStore';
import { BookingCard } from '../../components/BookingCard';

type FilterType = 'upcoming' | 'completed' | 'cancelled';

export default function BookingsScreen() {
  const { bookings } = useBookingStore();
  const [activeFilter, setActiveFilter] = useState<FilterType>('upcoming');

  const filteredBookings = bookings.filter((b) => b.status === activeFilter);

  const getFilterLabel = (type: FilterType) => {
    switch (type) {
      case 'upcoming': return 'Upcoming';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
    }
  };

  const filterOptions: FilterType[] = ['upcoming', 'completed', 'cancelled'];

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1 bg-[#F8F9FB]"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
      >
        {/* Page Header */}
        <View className="mb-6">
          <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest">My Schedule</Text>
          <Text className="text-[#111827] text-3xl font-black tracking-tight mt-1">Booked Sessions</Text>
          <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1">
            Track and manage all your scheduled home wellness visits.
          </Text>
        </View>

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
                  isActive ? 'bg-[#111827] shadow-sm' : ''
                }`}
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
            <View className="bg-white border border-[#E5E7EB] p-6 rounded-[28px] items-center justify-center py-12 shadow-xs">
              <Text className="text-3xl mb-2">📅</Text>
              <Text className="text-[#111827] text-sm font-extrabold">
                No {getFilterLabel(activeFilter).toLowerCase()} sessions
              </Text>
              <Text className="text-[#6B7280] text-xs text-center mt-1 max-w-[80%] leading-relaxed font-semibold">
                {activeFilter === 'upcoming' 
                  ? 'Schedule your next at-home training session from the home screen.'
                  : `You do not have any ${activeFilter} visits listed.`
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return <View className="flex-1 bg-[#F8F9FB] pt-12">{children}</View>;
  }
  return <View className="flex-1 bg-[#F8F9FB]">{children}</View>;
}
