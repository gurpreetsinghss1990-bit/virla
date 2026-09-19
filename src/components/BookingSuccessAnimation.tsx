import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Database } from '../database/Database';
import { AddPartnerModal } from './AddPartnerModal';
import { normalizeDate } from '../utils/date';
import { useBookingStore } from '../store/bookingStore';

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

const PARTICLES = [
  { dx: -46, dy: -38, color: '#00C389', size: 6, shape: 'circle' as const },
  { dx: 48, dy: -34, color: '#E11D48', size: 7, shape: 'square' as const },
  { dx: -58, dy: -8, color: '#6366F1', size: 5, shape: 'circle' as const },
  { dx: 60, dy: -6, color: '#F59E0B', size: 6, shape: 'circle' as const },
  { dx: -40, dy: 36, color: '#06B6D4', size: 6, shape: 'square' as const },
  { dx: 44, dy: 38, color: '#8B5CF6', size: 5, shape: 'circle' as const },
  { dx: -20, dy: -54, color: '#EC4899', size: 5, shape: 'circle' as const },
  { dx: 24, dy: -56, color: '#10B989', size: 6, shape: 'square' as const },
];

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

  // Entrance animations
  const heroScaleAnim = useRef(new Animated.Value(0)).current;
  const heroOpacityAnim = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;

  // Staggered section entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const partnerAnim = useRef(new Animated.Value(0)).current;
  const stepperAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  // Continuous looping animations
  const haloPulseAnim = useRef(new Animated.Value(0)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;

  const storeBooking = useBookingStore(s => s.bookings.find(b => b.id === successBookingId));
  const [booking, setBooking] = useState(() => Database.schema.bookings.find(b => b.id === successBookingId) || storeBooking);
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  useEffect(() => {
    if (successBookingId) {
      const found = Database.schema.bookings.find(b => b.id === successBookingId) || storeBooking;
      if (found) {
        setBooking(found);
      }
    }
  }, [successBookingId, storeBooking]);

  const activeBooking = booking || storeBooking;
  const effectiveTitle = activeBooking?.workoutTitle || workoutTitle;
  const effectiveDuration = (activeBooking as any)?.duration || workoutDuration || 60;
  const effectiveDate = activeBooking?.date || selectedDate;
  const effectiveTime = activeBooking?.time || selectedTime;
  const effectiveAddress = activeBooking?.address || locationAddress || 'Selected Location';

  const bookingRefCode = successBookingId
    ? `VRL-${successBookingId.slice(-6).toUpperCase()}`
    : 'VRL-84920';

  useEffect(() => {
    // Reset entrance values
    heroScaleAnim.setValue(0);
    heroOpacityAnim.setValue(0);
    particleAnim.setValue(0);
    headerAnim.setValue(0);
    cardAnim.setValue(0);
    partnerAnim.setValue(0);
    stepperAnim.setValue(0);
    ctaAnim.setValue(0);

    // Run parallel + staggered entrance
    Animated.parallel([
      Animated.spring(heroScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 6.5,
        useNativeDriver: true,
      }),
      Animated.timing(heroOpacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(particleAnim, {
        toValue: 1,
        duration: 900,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.stagger(100, [
        Animated.spring(headerAnim, {
          toValue: 1,
          tension: 45,
          friction: 7.5,
          useNativeDriver: true,
        }),
        Animated.spring(cardAnim, {
          toValue: 1,
          tension: 45,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(partnerAnim, {
          toValue: 1,
          tension: 45,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(stepperAnim, {
          toValue: 1,
          tension: 45,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(ctaAnim, {
          toValue: 1,
          tension: 45,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Looping halo breathing animation
    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(haloPulseAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    haloLoop.start();

    // Looping radar pulse animation
    const radarLoop = Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    radarLoop.start();

    return () => {
      haloLoop.stop();
      radarLoop.stop();
    };
  }, []);

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

  // Interpolations for breathing halo
  const outerHaloScale = haloPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });
  const outerHaloOpacity = haloPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.28],
  });

  // Interpolations for radar pulse
  const radarScale = radarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.6],
  });
  const radarOpacity = radarAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.8, 0.4, 0],
  });

  return (
    <View className="items-center gap-5 py-2 w-full">
      {/* 1. HERO ANIMATION: Dynamic Checkmark + Breathing Aura + Celebratory Micro-Particles */}
      <View className="items-center justify-center relative my-2" style={{ width: 140, height: 110 }}>
        {/* Micro-particle celebration burst */}
        {PARTICLES.map((p, idx) => {
          const pTx = particleAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, p.dx],
          });
          const pTy = particleAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, p.dy],
          });
          const pScale = particleAnim.interpolate({
            inputRange: [0, 0.35, 0.75, 1],
            outputRange: [0, 1.3, 0.9, 0],
          });
          const pOpacity = particleAnim.interpolate({
            inputRange: [0, 0.2, 0.75, 1],
            outputRange: [0, 1, 0.85, 0],
          });
          const pRot = particleAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${(idx % 2 === 0 ? 1 : -1) * 180}deg`],
          });

          return (
            <Animated.View
              key={idx}
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                borderRadius: p.shape === 'circle' ? p.size / 2 : 2,
                backgroundColor: p.color,
                transform: [
                  { translateX: pTx },
                  { translateY: pTy },
                  { scale: pScale },
                  { rotate: pRot },
                ],
                opacity: pOpacity,
              }}
            />
          );
        })}

        {/* Breathing Outer Emerald Ring */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: '#00C389',
            opacity: outerHaloOpacity,
            transform: [{ scale: outerHaloScale }],
          }}
        />

        {/* Main Spring Pop Checkmark */}
        <Animated.View
          style={{
            transform: [{ scale: heroScaleAnim }],
            opacity: heroOpacityAnim,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Middle Concentric Ring */}
          <View
            className="w-18 h-18 rounded-full items-center justify-center"
            style={{
              width: 72,
              height: 72,
              backgroundColor: 'rgba(0, 195, 137, 0.18)',
            }}
          >
            {/* Inner Core Solid Checkmark Button */}
            <View
              className="rounded-full bg-[#00C389] items-center justify-center"
              style={{
                width: 52,
                height: 52,
                shadowColor: '#00C389',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 6,
              }}
            >
              <Feather name="check" size={28} color="white" />
            </View>
          </View>
        </Animated.View>
      </View>

      {/* 2. HERO TITLE & TYPOGRAPHY HEADER */}
      <Animated.View
        style={{
          opacity: headerAnim,
          transform: [
            {
              translateY: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
          alignItems: 'center',
          width: '100%',
          paddingHorizontal: 16,
        }}
        className="gap-2 mb-1"
      >
        <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100">
          <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <Text className="text-emerald-700 text-[10px] font-black uppercase tracking-[1.6px]">
            Reservation Confirmed
          </Text>
        </View>

        <Text className="text-slate-900 text-2xl font-black tracking-tight text-center">
          Session Confirmed!
        </Text>

        <Text className="text-slate-600 text-xs font-medium text-center leading-5 max-w-[92%]">
          Your elite wellness experience has been secured. Our concierge matching engine is assigning your coach.
        </Text>
      </Animated.View>

      {/* 3. MASTER SESSION PASS (PHYSICAL BOARDING PASS TICKET AESTHETIC) */}
      <Animated.View
        style={{
          opacity: cardAnim,
          transform: [
            {
              translateY: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
          width: '100%',
        }}
      >
        <View
          className="w-full bg-white border border-slate-200/90 rounded-[26px] overflow-hidden"
          style={{
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            elevation: 3,
          }}
        >
          {/* Boarding Pass Top Metadata Bar */}
          <View className="bg-slate-50/90 border-b border-slate-100 px-5 pt-4 pb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Feather name="shield" size={12} color="#00C389" />
              <Text className="text-slate-500 text-[10px] font-extrabold uppercase tracking-[1.8px]">
                Virla Concierge Pass
              </Text>
            </View>

            <View className="bg-slate-200/70 px-2.5 py-0.5 rounded-md border border-slate-300/60">
              <Text
                className="text-slate-800 text-[11px] font-bold"
                style={{
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                  letterSpacing: 1.2,
                }}
              >
                {bookingRefCode}
              </Text>
            </View>
          </View>

          {/* Ticket Header & Session Title */}
          <View className="px-5 pt-4 pb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                <View className="w-12 h-12 rounded-2xl items-center justify-center bg-slate-900 border border-slate-800 shadow-xs">
                  <Feather name="layers" size={22} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-900 text-lg font-black tracking-tight" numberOfLines={1}>
                    {effectiveTitle}
                  </Text>
                  <Text className="text-slate-500 text-xs font-semibold mt-0.5 tracking-tight">
                    Concierge Wellness Session
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                <View className="px-3 py-1 rounded-full border bg-emerald-50 border-emerald-200/80">
                  <Text className="text-emerald-700 text-xs font-black tracking-tight">
                    • {activeBooking?.sessionType === 'COUPLE' ? '2 Credits' : '1 Credit'}
                  </Text>
                </View>
                <View className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                  <Text className="text-slate-800 text-xs font-extrabold">{effectiveDuration}m</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Sub-banner: Live Coach Dispatch Radar */}
          <View className="bg-indigo-50/70 border-y border-indigo-100/80 px-5 py-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              {/* Animated Radar Pulse Dot */}
              <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View
                  style={{
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#6366F1',
                    transform: [{ scale: radarScale }],
                    opacity: radarOpacity,
                  }}
                />
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4F46E5' }} />
              </View>
              <Text className="text-indigo-950 text-xs font-bold tracking-tight">
                Matching Best VIRLA Coach
              </Text>
            </View>

            <View className="px-2.5 py-1 rounded-full bg-indigo-100/90 border border-indigo-200">
              <Text className="text-indigo-800 text-[10px] font-black uppercase tracking-wider">
                Priority Queue
              </Text>
            </View>
          </View>

          {/* Physical Ticket Perforation Divider with Half-Circle Cutouts */}
          <View style={{ height: 20, position: 'relative', justifyContent: 'center' }}>
            {/* Left Notch */}
            <View
              style={{
                position: 'absolute',
                left: -10,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#F7F8FC',
                borderRightWidth: 1,
                borderColor: '#CBD5E1',
                zIndex: 10,
              }}
            />
            {/* Right Notch */}
            <View
              style={{
                position: 'absolute',
                right: -10,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#F7F8FC',
                borderLeftWidth: 1,
                borderColor: '#CBD5E1',
                zIndex: 10,
              }}
            />
            {/* Dashed Perforation Line */}
            <View
              style={{
                borderTopWidth: 1.5,
                borderColor: '#E2E8F0',
                borderStyle: 'dashed',
                marginHorizontal: 16,
              }}
            />
          </View>

          {/* Core Logistics Grid */}
          <View className="p-5 pt-2 gap-4">
            {/* Scheduled Date */}
            <View className="flex-row justify-between items-center py-1">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/70 items-center justify-center">
                  <Feather name="calendar" size={15} color="#475569" />
                </View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1.5px]">
                  Scheduled Date
                </Text>
              </View>
              <Text className="text-slate-900 text-sm font-black">
                {formatToDisplayDate(effectiveDate)}
              </Text>
            </View>

            {/* Time Slot */}
            <View className="flex-row justify-between items-center py-1 border-t border-slate-100">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-lg items-center justify-center border bg-rose-50 border-rose-100">
                  <Feather name="clock" size={15} color="#E11D48" />
                </View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1.5px]">
                  Time Slot
                </Text>
              </View>
              <View className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-100">
                <Text className="text-[#E11D48] text-xs font-black">
                  {formatCustomerTime(effectiveTime)}
                </Text>
              </View>
            </View>

            {/* Venue Address */}
            <View className="py-1 border-t border-slate-100 gap-2">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/70 items-center justify-center">
                    <Feather name="map-pin" size={15} color="#475569" />
                  </View>
                  <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1.5px]">
                    Venue Address
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => openExternalMap(effectiveAddress)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-rose-50 border-rose-100"
                >
                  <Text className="text-[#E11D48] text-[11px] font-black uppercase tracking-wider">
                    View Map
                  </Text>
                  <Feather name="external-link" size={11} color="#E11D48" />
                </TouchableOpacity>
              </View>
              <Text className="text-slate-800 text-xs font-bold leading-5 pl-11">
                {effectiveAddress}
              </Text>
            </View>

            {/* Session Tier */}
            <View className="flex-row justify-between items-center pt-2 border-t border-slate-100">
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1.5px]">
                Session Tier
              </Text>
              <View className="bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-full flex-row items-center gap-2">
                <Feather name="user" size={12} color="#0F172A" />
                <Text className="text-slate-900 text-xs font-black">
                  {activeBooking?.sessionType === 'COUPLE' ? 'Couple Session' : 'Solo Private Session'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* 4. UPSELL MODULE: ADD WORKOUT PARTNER (SEAMLESS CARDLESS LAYOUT) */}
      {booking?.sessionType !== 'COUPLE' && (
        <Animated.View
          style={{
            opacity: partnerAnim,
            transform: [
              {
                translateY: partnerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
            width: '100%',
          }}
          className="px-1 py-1 gap-3.5"
        >
          <View className="flex-row items-center gap-3.5">
            <View className="w-11 h-11 rounded-2xl items-center justify-center bg-rose-100/80 border border-rose-200">
              <Feather name="users" size={20} color="#E11D48" />
            </View>
            <View className="flex-1">
              <Text className="text-slate-900 text-sm font-black">
                Want a workout buddy to join?
              </Text>
              <Text className="text-slate-500 text-xs font-medium leading-5 mt-0.5">
                Convert this into a 2-person Couple session for 1 additional credit.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowPartnerModal(true)}
            className="self-end bg-[#E11D48] px-4 py-2.5 rounded-xl items-center justify-center shadow-xs"
          >
            <Text className="text-white text-xs font-black uppercase tracking-wider">+ Add Partner</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* 5. FULFILLMENT TIMELINE STEPPER ("WHAT HAPPENS NEXT") */}
      <Animated.View
        style={{
          opacity: stepperAnim,
          transform: [
            {
              translateY: stepperAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
          width: '100%',
        }}
      >
        <View
          className="w-full bg-white border border-slate-200/90 rounded-[26px] gap-4"
          style={{
            padding: 20,
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 12,
            elevation: 2,
          }}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2">
              <Feather name="activity" size={14} color="#00C389" />
              <Text className="text-slate-900 text-xs font-black uppercase tracking-[1.5px]">
                What Happens Next
              </Text>
            </View>
            <View className="px-2.5 py-1 rounded-full flex-row items-center gap-1.5 border bg-emerald-50 border-emerald-200/80">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <Text className="text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                Live Status
              </Text>
            </View>
          </View>

          <View className="relative mt-2" style={{ gap: 20 }}>
            {/* Vertical connecting progress line */}
            <View className="absolute left-[11px] top-3.5 bottom-3.5 w-[2px] bg-slate-100" />

            {/* Stage 1: Confirmed */}
            <View className="flex-row items-start gap-3.5">
              <View className="w-6 h-6 rounded-full bg-emerald-500 items-center justify-center z-10 border-2 border-white shadow-xs">
                <Feather name="check" size={12} color="white" />
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-slate-900 text-sm font-black">Booking Confirmed</Text>
                  <View className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80">
                    <Text className="text-emerald-700 text-[9px] font-black uppercase tracking-wider">
                      Completed
                    </Text>
                  </View>
                </View>
                <Text className="text-slate-500 text-xs font-medium leading-5 mt-0.5">
                  Your session request has been secured & reserved in our concierge engine.
                </Text>
              </View>
            </View>

            {/* Stage 2: Coach Assignment (Active in progress with pulsing radar) */}
            <View className="flex-row items-start gap-3.5">
              <View className="w-6 h-6 rounded-full bg-amber-500 items-center justify-center z-10 border-2 border-white shadow-xs">
                <Feather name="user" size={12} color="white" />
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-slate-900 text-sm font-black">Coach Assignment</Text>
                    {/* Active pulse dot */}
                    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
                      <Animated.View
                        style={{
                          position: 'absolute',
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#F59E0B',
                          transform: [{ scale: radarScale }],
                          opacity: radarOpacity,
                        }}
                      />
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D97706' }} />
                    </View>
                  </View>
                  <View className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                    <Text className="text-amber-700 text-[9px] font-black uppercase tracking-wider">
                      In Progress
                    </Text>
                  </View>
                </View>
                <Text className="text-slate-500 text-xs font-medium leading-5 mt-0.5">
                  Matching you with the top-certified VIRLA coach specialized in {effectiveTitle}. Expected in ~15m.
                </Text>
              </View>
            </View>

            {/* Stage 3: Coach Dossier */}
            <View className="flex-row items-start gap-3.5">
              <View className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 items-center justify-center z-10">
                <Feather name="lock" size={11} color="#64748B" />
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-slate-700 text-sm font-black">Coach & Equipment Details</Text>
                  <View className="bg-slate-100 px-2 py-0.5 rounded-full">
                    <Text className="text-slate-500 text-[9px] font-extrabold uppercase tracking-wider">
                      Locked
                    </Text>
                  </View>
                </View>
                <Text className="text-slate-500 text-xs font-medium leading-5 mt-0.5">
                  Coach bio, certifications, and sanitation protocol unlock 5 hours prior to the session.
                </Text>
              </View>
            </View>

            {/* Stage 4: Live Arrival Tracking */}
            <View className="flex-row items-start gap-3.5">
              <View className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 items-center justify-center z-10">
                <Feather name="map-pin" size={11} color="#64748B" />
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-slate-700 text-sm font-black">Live Coach Arrival Tracking</Text>
                  <View className="bg-slate-100 px-2 py-0.5 rounded-full">
                    <Text className="text-slate-500 text-[9px] font-extrabold uppercase tracking-wider">
                      Locked
                    </Text>
                  </View>
                </View>
                <Text className="text-slate-500 text-xs font-medium leading-5 mt-0.5">
                  Track your coach's transit in real-time as they bring all wellness gear directly to your venue.
                </Text>
              </View>
            </View>
          </View>

          {/* Policy Microcopy & Concierge Link */}
          <View className="mt-1 pt-3.5 border-t border-slate-100 flex-row items-center justify-between">
            <Text className="text-slate-500 text-xs font-medium flex-1 pr-2">
              Need to reschedule? Free changes up to 4 hrs before.
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/help-support' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-[#E11D48] text-xs font-black">Contact Concierge</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

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

      {/* 6. FIXED BOTTOM CTAS */}
      <Animated.View
        style={{
          opacity: ctaAnim,
          transform: [
            {
              translateY: ctaAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
          width: '100%',
        }}
        className="flex-row gap-3 mt-2"
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onBackToHome}
          className="flex-1 bg-white border border-slate-200 py-4 rounded-2xl items-center justify-center shadow-xs"
        >
          <Text className="text-slate-900 text-xs font-black uppercase tracking-wider">Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onViewSession(successBookingId)}
          className="flex-[1.8] bg-[#E11D48] py-4 rounded-2xl items-center justify-center shadow-md"
          style={{
            shadowColor: '#E11D48',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.28,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text className="text-white text-xs font-black uppercase tracking-wider">
            View Session Details →
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};
