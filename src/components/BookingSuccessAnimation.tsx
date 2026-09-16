import React, { useEffect, useState } from 'react';
import { View, Text, Animated, TouchableOpacity, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Database } from '../database/Database';
import { AddPartnerModal } from './AddPartnerModal';
import { normalizeDate } from '../utils/date';

interface BookingSuccessAnimationProps {
  workoutTitle: string;
  workoutDuration: number;
  selectedDate: string;
  selectedTime: string;
  locationAddress: string;
  successBookingId: string;
  onViewSession: (id: string) => void;
  onBackToHome: () => void;
  onShare?: () => void;
}

function formatToDisplayDate(dateInput: string | undefined | null): string {
  if (!dateInput) return '';
  const normalized = normalizeDate(dateInput);
  if (!normalized) return String(dateInput);
  const parts = normalized.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const mIdx = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[mIdx] || parts[1]} ${y}`;
  }
  return String(dateInput);
}

function formatCustomerTime(timeRangeStr: string | undefined | null): string {
  if (!timeRangeStr) return '';
  const normalized = timeRangeStr.replace(/–/g, '-').replace(/\s+/g, ' ').trim();
  const parts = normalized.split('-');
  if (parts.length === 2) {
    return `${parts[0].trim()} — ${parts[1].trim()}`;
  }
  return normalized;
}

export const BookingSuccessAnimation: React.FC<BookingSuccessAnimationProps> = ({
  workoutTitle,
  workoutDuration,
  selectedDate,
  selectedTime,
  locationAddress,
  successBookingId,
  onViewSession,
  onBackToHome,
}) => {
  const router = useRouter();
  const [successScaleAnim] = useState(() => new Animated.Value(0));
  const [successOpacityAnim] = useState(() => new Animated.Value(0));
  const [booking, setBooking] = useState(() => Database.schema.bookings.find(b => b.id === successBookingId));
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  useEffect(() => {
    if (successBookingId) {
      const found = Database.schema.bookings.find(b => b.id === successBookingId);
      if (found) {
        setBooking(found);
      }
    }
  }, [successBookingId]);

  useEffect(() => {
    successScaleAnim.setValue(0);
    successOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(successScaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [successScaleAnim, successOpacityAnim]);

  const openExternalMap = (address: string) => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
    }) || `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
    });
  };

  return (
    <View className="items-center gap-5 py-2 w-full">
      {/* Hero Confirmation: Concentric Mint Emerald Ripple Rings */}
      <Animated.View
        style={{
          transform: [{ scale: successScaleAnim }],
          opacity: successOpacityAnim,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          marginVertical: 8,
        }}
      >
        {/* Outer radial aura ring */}
        <View 
          className="w-20 h-20 rounded-full items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 195, 137, 0.15)' }}
        >
          {/* Inner concentric ring */}
          <View 
            className="w-16 h-16 rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 195, 137, 0.25)' }}
          >
            {/* Core checkmark circle */}
            <View 
              className="w-12 h-12 rounded-full bg-[#00C389] items-center justify-center"
              style={{
                shadowColor: '#00C389',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Feather name="check" size={24} color="white" />
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Hero Title & Subtext */}
      <View className="items-center gap-2 px-4 mb-1">
        <Text className="text-zinc-950 text-2xl font-black tracking-tight text-center">Session Confirmed!</Text>
        <Text className="text-zinc-700 text-sm font-medium text-center leading-6 max-w-[92%]">
          Your VIRLA wellness appointment is booked. Sit back while we finalize the elite coach details.
        </Text>
      </View>

      {/* Master Session Pass Card (Dark Luxury Card - No White Card Background) */}
      <View 
        className="w-full bg-zinc-900 border border-zinc-800 rounded-[24px] overflow-hidden"
        style={{
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        {/* Ticket Header */}
        <View className="bg-zinc-950" style={{ padding: 20 }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 pr-2">
              <View 
                className="w-11 h-11 rounded-xl items-center justify-center"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              >
                <Feather name="layers" size={20} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-lg font-bold tracking-tight" numberOfLines={1}>{workoutTitle}</Text>
                <Text className="text-zinc-400 text-xs font-semibold mt-0.5">Concierge Wellness Session</Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <View 
                className="px-3 py-1 rounded-full border"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
              >
                <Text className="text-emerald-300 text-xs font-bold">
                  • {booking?.sessionType === 'COUPLE' ? '2 Credits' : '1 Credit'}
                </Text>
              </View>
              <View 
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
              >
                <Text className="text-white text-xs font-bold">{workoutDuration || 60}m</Text>
              </View>
            </View>
          </View>

          {/* Sub-banner: Live Matching Status */}
          <View className="mt-3.5 pt-3 border-t border-zinc-800 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <Text className="text-zinc-200 text-xs font-semibold">Matching Best VIRLA Coach</Text>
            </View>
            <View 
              className="px-3 py-0.5 rounded-full border"
              style={{ backgroundColor: 'rgba(99, 102, 241, 0.25)', borderColor: 'rgba(129, 140, 248, 0.5)' }}
            >
              <Text className="text-indigo-200 text-xs font-black uppercase tracking-wider">Priority Queue</Text>
            </View>
          </View>
        </View>

        {/* Core Logistics Grid (Seamless Dark Background - High Contrast Legibility) */}
        <View className="bg-zinc-900 p-5 gap-4">
          <View className="flex-row justify-between items-center py-1">
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-lg bg-zinc-800 items-center justify-center">
                <Feather name="calendar" size={16} color="#D4D4D8" />
              </View>
              <Text className="text-zinc-300 text-sm font-semibold">Scheduled Date</Text>
            </View>
            <Text className="text-white text-sm font-extrabold">{formatToDisplayDate(selectedDate)}</Text>
          </View>

          <View className="flex-row justify-between items-center py-1 border-t border-zinc-800">
            <View className="flex-row items-center gap-3">
              <View 
                className="w-8 h-8 rounded-lg items-center justify-center border"
                style={{ backgroundColor: 'rgba(80, 7, 26, 0.6)', borderColor: 'rgba(136, 19, 55, 0.5)' }}
              >
                <Feather name="clock" size={16} color="#FB7185" />
              </View>
              <Text className="text-zinc-300 text-sm font-semibold">Time Slot</Text>
            </View>
            <Text className="text-rose-400 text-sm font-extrabold">{formatCustomerTime(selectedTime)}</Text>
          </View>

          <View className="py-1 border-t border-zinc-800 gap-1.5">
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-lg bg-zinc-800 items-center justify-center">
                  <Feather name="map-pin" size={16} color="#D4D4D8" />
                </View>
                <Text className="text-zinc-300 text-sm font-semibold">Venue Address</Text>
              </View>
              <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => openExternalMap(locationAddress)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg border"
                style={{ backgroundColor: 'rgba(80, 7, 26, 0.4)', borderColor: 'rgba(136, 19, 55, 0.5)' }}
              >
                <Text className="text-rose-400 text-xs font-extrabold">View Map</Text>
                <Feather name="external-link" size={12} color="#FB7185" />
              </TouchableOpacity>
            </View>
            <Text className="text-zinc-100 text-sm font-semibold leading-relaxed" style={{ paddingLeft: 44 }}>
              {locationAddress || 'Selected Location'}
            </Text>
          </View>

          <View className="flex-row justify-between items-center pt-2 border-t border-zinc-800">
            <Text className="text-zinc-300 text-sm font-semibold">Session Tier</Text>
            <View className="bg-zinc-800 border border-zinc-700 px-3.5 py-1.5 rounded-full flex-row items-center gap-2">
              <Feather name="user" size={13} color="#FFFFFF" />
              <Text className="text-white text-xs font-extrabold">
                {booking?.sessionType === 'COUPLE' ? 'Couple Session' : 'Solo Private Session'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Upsell Module: Add Workout Partner (Dark Rose Luxury Accent) */}
      {booking?.sessionType !== 'COUPLE' && (
        <View 
          className="w-full p-4 rounded-[24px] gap-3.5 border"
          style={{ backgroundColor: 'rgba(80, 7, 26, 0.4)', borderColor: 'rgba(136, 19, 55, 0.6)' }}
        >
          <View className="flex-row items-center gap-3">
            <View 
              className="w-11 h-11 rounded-full items-center justify-center"
              style={{ backgroundColor: 'rgba(136, 19, 55, 0.6)' }}
            >
              <Feather name="users" size={20} color="#FB7185" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-sm font-bold">Want a workout buddy to join?</Text>
              <Text className="text-rose-200 text-xs font-medium leading-5 mt-0.5">
                Convert this into a 2-person Couple session for 1 additional credit.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowPartnerModal(true)}
            className="self-end bg-[#E11D48] px-4 py-2.5 rounded-xl items-center justify-center"
          >
            <Text className="text-white text-xs font-extrabold">+ Add Partner</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fulfillment Stepper: What Happens Next (Dark Luxury Card - No White Background) */}
      <View 
        className="w-full bg-zinc-900 border border-zinc-800 rounded-[24px] gap-4"
        style={{
          padding: 20,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <View className="flex-row justify-between items-center">
          <Text className="text-white text-xs font-black uppercase tracking-wider">What Happens Next</Text>
          <View 
            className="px-2.5 py-1 rounded-full flex-row items-center gap-1.5 border"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
          >
            <View className="w-2 h-2 rounded-full bg-emerald-400" />
            <Text className="text-emerald-300 text-[10px] font-extrabold uppercase tracking-wide">Live Updates</Text>
          </View>
        </View>
        
        <View className="relative mt-1" style={{ gap: 20 }}>
          {/* Vertical connecting line */}
          <View className="absolute left-[11px] top-3.5 bottom-3.5 w-[1.5px] bg-zinc-700" />

          {/* Stage 1 */}
          <View className="flex-row items-start gap-3.5">
            <View className="w-6 h-6 rounded-full bg-emerald-500 items-center justify-center z-10 border-2 border-zinc-900">
              <Feather name="check" size={12} color="white" />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-sm font-bold">Booking Confirmed</Text>
                <View 
                  className="px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
                >
                  <Text className="text-emerald-300 text-[10px] font-extrabold uppercase tracking-wide">Completed</Text>
                </View>
              </View>
              <Text className="text-zinc-300 text-xs font-medium leading-5 mt-0.5">
                Your session request has been secured & reserved in our concierge engine.
              </Text>
            </View>
          </View>

          {/* Stage 2 */}
          <View className="flex-row items-start gap-3.5">
            <View className="w-6 h-6 rounded-full bg-amber-500 items-center justify-center z-10 border-2 border-zinc-900">
              <Feather name="user" size={12} color="white" />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-sm font-bold">Coach Assignment</Text>
                <View 
                  className="px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)' }}
                >
                  <Text className="text-amber-300 text-[10px] font-extrabold uppercase tracking-wide">In Progress</Text>
                </View>
              </View>
              <Text className="text-zinc-300 text-xs font-medium leading-5 mt-0.5">
                Matching you with the top-certified VIRLA coach specialized in {workoutTitle}. Expected in ~15m.
              </Text>
            </View>
          </View>

          {/* Stage 3 */}
          <View className="flex-row items-start gap-3.5">
            <View className="w-6 h-6 rounded-full bg-zinc-800 items-center justify-center z-10 border-2 border-zinc-900">
              <Feather name="lock" size={11} color="#D4D4D8" />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-zinc-200 text-sm font-bold">Coach & Equipment Details</Text>
                <View className="bg-zinc-800 px-2.5 py-0.5 rounded-full">
                  <Text className="text-zinc-400 text-[10px] font-extrabold uppercase tracking-wide">Locked</Text>
                </View>
              </View>
              <Text className="text-zinc-400 text-xs font-medium leading-5 mt-0.5">
                Coach bio, certifications, and sanitation protocol unlock 5 hours prior to the session.
              </Text>
            </View>
          </View>

          {/* Stage 4 */}
          <View className="flex-row items-start gap-3.5">
            <View className="w-6 h-6 rounded-full bg-zinc-800 items-center justify-center z-10 border-2 border-zinc-900">
              <Feather name="map-pin" size={11} color="#D4D4D8" />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-zinc-200 text-sm font-bold">Live Coach Arrival Tracking</Text>
                <View className="bg-zinc-800 px-2.5 py-0.5 rounded-full">
                  <Text className="text-zinc-400 text-[10px] font-extrabold uppercase tracking-wide">Locked</Text>
                </View>
              </View>
              <Text className="text-zinc-400 text-xs font-medium leading-5 mt-0.5">
                {"Track your coach's transit in real-time as they bring all wellness gear directly to your venue."}
              </Text>
            </View>
          </View>
        </View>

        {/* Policy Microcopy & Concierge Link */}
        <View className="mt-1 pt-3.5 border-t border-zinc-800 flex-row items-center justify-between">
          <Text className="text-zinc-400 text-xs font-medium flex-1 pr-2">
            Need to reschedule? Free changes up to 4 hrs before.
          </Text>
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => router.push('/help-support' as any)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-rose-400 text-xs font-extrabold">Contact Concierge</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Reusable Add Partner Modal overlay */}
      <AddPartnerModal
        visible={showPartnerModal}
        bookingId={successBookingId}
        onClose={() => setShowPartnerModal(false)}
        onSuccess={() => {
          setShowPartnerModal(false);
          const updated = Database.schema.bookings.find(b => b.id === successBookingId);
          setBooking(updated);
        }}
      />

      {/* Fixed Bottom CTAs */}
      <View className="w-full flex-row gap-3 mt-2">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onBackToHome}
          className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-2xl items-center justify-center"
        >
          <Text className="text-white text-xs font-black uppercase tracking-wider">Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onViewSession(successBookingId)}
          className="flex-[1.8] bg-[#E11D48] py-4 rounded-2xl items-center justify-center shadow-md"
          style={{
            shadowColor: '#E11D48',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <Text className="text-white text-xs font-black uppercase tracking-wider">View Session Details →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
