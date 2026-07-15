import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useBookingStore } from '../../store/bookingStore';
import { BookingCard } from '../../components/BookingCard';
import { Heading, Subtitle } from '@/presentation/components';

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
    <View className="flex-1 bg-white px-6 pt-6">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Page Header */}
        <View className="mb-6">
          <Text className="text-orange-500 text-xs font-bold uppercase tracking-wider">My Schedule</Text>
          <Heading align="left" className="mt-1">Booked Sessions</Heading>
          <Subtitle align="left" className="mt-1">
            Track and manage all your home wellness sessions.
          </Subtitle>
        </View>

        {/* Filter Capsule Selector Tabs */}
        <View className="flex-row bg-zinc-50 border border-zinc-100 p-1.5 rounded-2xl mb-6">
          {filterOptions.map((opt) => {
            const isActive = activeFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.8}
                onPress={() => setActiveFilter(opt)}
                className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                  isActive ? 'bg-zinc-900 shadow-sm' : ''
                }`}
              >
                <Text 
                  className={`text-xs font-extrabold tracking-tight ${
                    isActive ? 'text-white' : 'text-zinc-400'
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
            <View className="bg-zinc-50 border border-zinc-100 p-6 rounded-[24px] items-center justify-center py-12">
              <Text className="text-3xl mb-2">📅</Text>
              <Text className="text-primary text-sm font-bold">
                No {getFilterLabel(activeFilter).toLowerCase()} sessions
              </Text>
              <Text className="text-zinc-400 text-xs text-center mt-1">
                {activeFilter === 'upcoming' 
                  ? 'Schedule your next home session from the home screen.'
                  : `You do not have any ${activeFilter} visits listed.`
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
