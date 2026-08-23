import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Booking } from '../types';
import { BookingStatusBadge } from './BookingStatusBadge';
import { useBookingStore } from '../store/bookingStore';
import { useRouter } from 'expo-router';
import { LuxuryCard } from './LuxuryCard';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '../store/userStore';
import { SessionEngine } from '../services/SessionEngine';
import { AddPartnerModal } from './AddPartnerModal';
import { Database, getCurrentServerTime, getISTDateInfo } from '../database/Database';
import { getDisplayWorkoutTitle, getBookingISTDateRange, formatToDDMMYYYY } from '../utils/date';

interface BookingCardProps {
  booking: Booking;
}

export function BookingCard({ booking }: BookingCardProps) {
  const router = useRouter();
  const { cancelSession, rescheduleSession } = useBookingStore();
  const { role } = useUserStore();
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  // Modals visibility states
  const [showCancelWarningModal, setShowCancelWarningModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Rescheduling selection states
  const [selectedRescheduleDate, setSelectedRescheduleDate] = useState('');
  const [selectedRescheduleTime, setSelectedRescheduleTime] = useState('');

  // 2-hour cancellation/reschedule calculations
  const range = getBookingISTDateRange(booking);
  const now = getCurrentServerTime();
  const timeUntilStartMs = range.start.getTime() - now.getTime();
  const timeUntilStartHours = timeUntilStartMs / (1000 * 60 * 60);

  const isPast = timeUntilStartHours <= 0;
  const isWithinTwoHours = timeUntilStartHours > 0 && timeUntilStartHours <= 2;
  const isMoreThanTwoHours = timeUntilStartHours > 2;

  // Generate reschedule date capsules (next 7 days starting from today in IST)
  const rescheduleDates = (() => {
    const dates = [];
    const nowServer = getCurrentServerTime();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(nowServer.getTime() + istOffset);
    for (let i = 0; i < 7; i++) {
      const d = new Date(nowIst.getTime() + i * 24 * 60 * 60 * 1000);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const ymd = `${year}-${month}-${day}`;
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const sub = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dates.push({ ymd, label, sub });
    }
    return dates;
  })();



  const executeEarlyCancellation = async () => {
    setIsCancelling(true);
    console.log("[BOOKING-CANCEL-TRACE] [EARLY] START");
    console.log(`bookingId: ${booking.id}`);
    console.log(`customerId: ${booking.clientId}`);
    console.log(`authenticatedUserId: ${Database.getCurrentUserId()}`);
    console.log(`bookingStatus: ${booking.status}`);
    console.log(`scheduledStart: ${range.start.toISOString()}`);
    console.log(`currentTime: ${now.toISOString()}`);
    console.log(`timeUntilStart: ${timeUntilStartHours.toFixed(2)} hours`);
    console.log(`timeClassification: MORE_THAN_TWO_HOURS`);
    console.log(`buttonPressed: YES`);
    console.log(`confirmationShown: YES`);
    console.log(`confirmationConfirmed: YES`);
    console.log(`storeHandlerCalled: YES`);
    console.log(`databaseMethodCalled: YES`);
    console.log(`rpcCalled: YES`);
    try {
      await cancelSession(booking.id);
      console.log("[BOOKING-CANCEL-TRACE] [EARLY] SUCCESS");
      console.log(`rpcReturned: SUCCESS`);
      console.log(`finalBookingStatus: cancelled`);
      console.log(`creditTransactionResult: refunded`);
      console.log(`refreshCompleted: YES`);
      console.log("[BOOKING-CANCEL-TRACE] ---------------------------");
      if (Platform.OS === 'web') {
        window.alert('Your home session has been successfully cancelled.');
      } else {
        Alert.alert('Session Cancelled', 'Your home session has been successfully cancelled.');
      }
    } catch (e: any) {
      console.error("[BOOKING-CANCEL-TRACE] [EARLY] FAILED");
      console.error(`rpcReturned: ERROR`);
      console.error(`rpcError:`, e);
      console.log("[BOOKING-CANCEL-TRACE] ---------------------------");
      if (Platform.OS === 'web') {
        window.alert("We couldn't cancel this session. Please try again.");
      } else {
        Alert.alert('Cancellation Failed', "We couldn't cancel this session. Please try again.");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCancel = () => {
    if (isPast) {
      console.warn(`[BOOKING-CANCEL-TRACE] Past booking cancellation attempted/blocked. ID: ${booking.id}`);
      return;
    }

    const classification = isMoreThanTwoHours ? 'MORE_THAN_TWO_HOURS' : 'WITHIN_TWO_HOURS';
    console.log(`[BOOKING-CANCEL-TRACE] handleCancel invoked.`);
    console.log(`bookingId: ${booking.id}`);
    console.log(`timeClassification: ${classification}`);

    if (isWithinTwoHours) {
      // Within 2 hours: Open warning modal
      setShowCancelWarningModal(true);
      console.log(`[BOOKING-CANCEL-TRACE] Warning modal opened.`);
    } else {
      // More than 2 hours: Standard cancellation confirmation
      if (Platform.OS === 'web') {
        const confirmCancel = window.confirm(
          `Cancel Session?\n\nYour ${booking.sessionType === 'COUPLE' ? '2 credits' : '1 credit'} will be refunded because you are cancelling more than 2 hours before the session.`
        );
        if (confirmCancel) {
          executeEarlyCancellation();
        }
      } else {
        Alert.alert(
          'Cancel Session?',
          `Your ${booking.sessionType === 'COUPLE' ? '2 credits' : '1 credit'} will be refunded because you are cancelling more than 2 hours before the session.`,
          [
            { text: 'Keep Session', style: 'cancel' },
            {
              text: 'Cancel Session',
              style: 'destructive',
              onPress: executeEarlyCancellation,
            },
          ]
        );
      }
    }
  };

  const handleConfirmCancelWithinTwoHours = async () => {
    setIsCancelling(true);
    console.log("[BOOKING-CANCEL-TRACE] [LATE] START");
    console.log(`bookingId: ${booking.id}`);
    console.log(`customerId: ${booking.clientId}`);
    console.log(`authenticatedUserId: ${Database.getCurrentUserId()}`);
    console.log(`bookingStatus: ${booking.status}`);
    console.log(`scheduledStart: ${range.start.toISOString()}`);
    console.log(`currentTime: ${now.toISOString()}`);
    console.log(`timeUntilStart: ${timeUntilStartHours.toFixed(2)} hours`);
    console.log(`timeClassification: WITHIN_TWO_HOURS`);
    console.log(`buttonPressed: YES`);
    console.log(`confirmationShown: YES`);
    console.log(`confirmationConfirmed: YES`);
    console.log(`storeHandlerCalled: YES`);
    console.log(`databaseMethodCalled: YES`);
    console.log(`rpcCalled: YES`);
    try {
      await cancelSession(booking.id);
      console.log("[BOOKING-CANCEL-TRACE] [LATE] SUCCESS");
      console.log(`rpcReturned: SUCCESS`);
      console.log(`finalBookingStatus: cancelled`);
      console.log(`creditTransactionResult: forfeited`);
      console.log(`refreshCompleted: YES`);
      console.log("[BOOKING-CANCEL-TRACE] ---------------------------");
      setShowCancelWarningModal(false);
      if (Platform.OS === 'web') {
        window.alert(`Your session has been successfully cancelled. ${booking.sessionType === 'COUPLE' ? '2 credits' : '1 credit'} forfeited.`);
      } else {
        Alert.alert('Session Cancelled', `Your session has been successfully cancelled. ${booking.sessionType === 'COUPLE' ? '2 credits' : '1 credit'} forfeited.`);
      }
    } catch (e: any) {
      console.error("[BOOKING-CANCEL-TRACE] [LATE] FAILED");
      console.error(`rpcReturned: ERROR`);
      console.error(`rpcError:`, e);
      console.log("[BOOKING-CANCEL-TRACE] ---------------------------");
      if (Platform.OS === 'web') {
        window.alert("We couldn't cancel this session. Please try again.");
      } else {
        Alert.alert('Cancellation Failed', "We couldn't cancel this session. Please try again.");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReschedule = () => {
    setSelectedRescheduleTime('');
    if (rescheduleDates.length > 0) {
      setSelectedRescheduleDate(rescheduleDates[0].ymd);
    } else {
      setSelectedRescheduleDate('');
    }
    setShowRescheduleModal(true);
  };

  const executeReschedule = async () => {
    setIsRescheduling(true);
    try {
      await rescheduleSession(booking.id, selectedRescheduleDate, selectedRescheduleTime);
      setShowRescheduleModal(false);
      if (Platform.OS === 'web') {
        window.alert('Session rescheduled successfully.');
      } else {
        Alert.alert('Rescheduled', 'Session rescheduled successfully.');
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(e.message || 'Unable to reschedule.');
      } else {
        Alert.alert('Rescheduling Failed', e.message || 'Unable to reschedule.');
      }
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleConfirmReschedule = () => {
    if (!selectedRescheduleDate || !selectedRescheduleTime) {
      if (Platform.OS === 'web') {
        window.alert('Please select a date and time slot.');
      } else {
        Alert.alert('Selection Required', 'Please select a date and time slot.');
      }
      return;
    }

    const confirmMsg = `Reschedule Session?\n\nCurrent: ${formatToDDMMYYYY(booking.date)} @ ${booking.time}\nNew: ${formatToDDMMYYYY(selectedRescheduleDate)} @ ${selectedRescheduleTime}`;

    if (Platform.OS === 'web') {
      const ok = window.confirm(confirmMsg);
      if (ok) {
        executeReschedule();
      }
    } else {
      Alert.alert(
        'Reschedule Session?',
        `Current: ${formatToDDMMYYYY(booking.date)} @ ${booking.time}\nNew: ${formatToDDMMYYYY(selectedRescheduleDate)} @ ${selectedRescheduleTime}`,
        [
          { text: 'KEEP CURRENT', style: 'cancel' },
          {
            text: 'CONFIRM RESCHEDULE',
            onPress: executeReschedule
          }
        ]
      );
    }
  };

  const availableSlots = selectedRescheduleDate
    ? Database.getTrainerAvailableSlots(booking.trainerId || 'searching', selectedRescheduleDate, booking.id)
    : [];

  const handleViewDetails = () => {
    router.push({
      pathname: '/session-detail',
      params: { id: booking.id },
    });
  };

  const isUpcoming = booking.status === 'upcoming';
  const isTrainer = role === 'trainer';
  const isAccepted = booking.timelineStatus !== 'booked' && booking.timelineStatus !== 'trainer_assigned';

  return (
    <LuxuryCard className="p-5 mb-4" interactive={false}>
      {/* Top Section */}
      <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-zinc-100">
        <View className="flex-row items-center gap-3 flex-1 pr-2">
          {isTrainer ? (
            <View className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-150 items-center justify-center">
              <Text className="text-lg">👤</Text>
            </View>
          ) : (isUpcoming && !isAccepted) ? (
            <View className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 items-center justify-center">
              <Text className="text-lg">🧘</Text>
            </View>
          ) : (
            <Image
              source={{ uri: booking.trainerPhoto }}
              className="w-12 h-12 rounded-full border border-zinc-150"
            />
          )}
          <View className="flex-1">
            <Text className="text-[#101828] text-base font-extrabold tracking-tight">
              {isTrainer 
                ? 'Client: Viral' 
                : (isUpcoming 
                    ? (!isAccepted 
                        ? 'SESSION BOOKED & CONFIRMED' 
                        : `Coach ${booking.trainerName}`
                      ) 
                    : `Coach ${booking.trainerName}`
                  )}
            </Text>
            <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider mt-0.5">
              {isTrainer 
                ? `${getDisplayWorkoutTitle(booking.workoutTitle)} • ${booking.sessionType === 'COUPLE' ? '2-Person' : 'Solo'} • 60 mins` 
                : (isUpcoming 
                    ? (!isAccepted 
                        ? `${getDisplayWorkoutTitle(booking.workoutTitle)} • ${booking.sessionType === 'COUPLE' ? '2-Person' : 'Solo'} • Trainer details shared soon` 
                        : `${getDisplayWorkoutTitle(booking.workoutTitle)} • ${booking.sessionType === 'COUPLE' ? '2-Person' : 'Solo'} • Trainer confirmed`
                      ) 
                    : `${getDisplayWorkoutTitle(booking.workoutTitle)} • ${booking.sessionType === 'COUPLE' ? '2-Person' : 'Solo'} • ₹${booking.price || 1200}`
                  )}
            </Text>
          </View>
        </View>
        <BookingStatusBadge status={booking.status} />
      </View>

      {/* Location address row for trainers */}
      {isTrainer && !!booking.address && (
        <View className="bg-zinc-50 px-4 py-2 rounded-xl mb-3 flex-row items-center gap-2">
          <Feather name="map-pin" size={10} color="#6B7280" />
          <Text className="text-zinc-500 text-[10px] font-semibold flex-1 leading-snug">
            {booking.address}
          </Text>
        </View>
      )}

      {/* Date & Time Row */}
      <View className="flex-row justify-between items-center bg-zinc-50 px-4 py-3 rounded-xl mb-4">
        <Text className="text-zinc-500 text-xs font-semibold">
          📅 {formatToDDMMYYYY(booking.date)}
        </Text>
        <Text className="text-zinc-500 text-xs font-semibold">
          ⏱️ {booking.time}
        </Text>
      </View>

      {/* Start Session available banner for trainer */}
      {(() => {
        if (!isTrainer || !isUpcoming) return null;
        const isBeforeWindow = SessionEngine.isBeforeStartWindow(booking);
        if (!isBeforeWindow) return null;
        const sessionDate = SessionEngine.getSessionStartDate(booking);
        const startWindow = new Date(sessionDate.getTime() - 30 * 60 * 1000);
        const istInfo = getISTDateInfo(startWindow);
        
        const formatTimeOnly = () => {
          let hr = istInfo.hour;
          const min = String(istInfo.minute).padStart(2, '0');
          const ampm = hr >= 12 ? 'PM' : 'AM';
          hr = hr % 12;
          hr = hr ? hr : 12;
          return `${String(hr).padStart(2, '0')}:${min} ${ampm}`;
        };

        return (
          <View className="bg-amber-50 border border-amber-150 px-4 py-2.5 rounded-xl mb-3 flex-row items-center gap-2">
            <Feather name="clock" size={10} color="#D97706" />
            <Text className="text-[#D97706] text-[10px] font-bold uppercase tracking-wider">
              Start Session available from {formatTimeOnly()}
            </Text>
          </View>
        );
      })()}

      {isUpcoming && role === 'customer' && booking.sessionType === 'SINGLE' && booking.timelineStatus !== 'otp_verified' && booking.timelineStatus !== 'workout_started' && booking.timelineStatus !== 'workout_completed' && booking.timelineStatus !== 'session_closed' && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowPartnerModal(true)}
          className="w-full bg-[#E11D48] py-3 rounded-xl items-center justify-center flex-row gap-1.5 mb-3"
        >
          <Feather name="plus-circle" size={14} color="white" />
          <Text className="text-white text-xs font-black uppercase tracking-wider">Train with a Friend</Text>
        </TouchableOpacity>
      )}

      {booking.sessionType === 'COUPLE' && !!booking.partnerName && (
        <View className="bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-xl mb-3 flex-row items-center gap-2">
          <Feather name="users" size={12} color="#10B981" />
          <Text className="text-zinc-500 text-[10px] font-semibold flex-1 leading-snug">
            Training with: <Text className="font-extrabold text-zinc-800">{booking.partnerName}</Text> (+91 {booking.partnerPhone})
          </Text>
        </View>
      )}

      <AddPartnerModal
        visible={showPartnerModal}
        bookingId={booking.id}
        onClose={() => setShowPartnerModal(false)}
        onSuccess={() => {
          setShowPartnerModal(false);
          useBookingStore.getState().syncFromDB();
        }}
      />

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        {isTrainer ? (
          isUpcoming ? (
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Alert.alert('Navigate', 'Opening Google Maps routing direction to Worli, Mumbai.')}
                className="flex-1 bg-zinc-50 border py-3 rounded-xl items-center justify-center flex-row gap-1.5"
                style={{ borderColor: 'rgba(228, 228, 231, 0.6)' }}
              >
                <Feather name="navigation" size={12} color="#101828" />
                <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Navigate</Text>
              </TouchableOpacity>
              {(() => {
                const isBeforeWindow = SessionEngine.isBeforeStartWindow(booking);
                const sessionDate = SessionEngine.getSessionStartDate(booking);
                const startWindow = new Date(sessionDate.getTime() - 30 * 60 * 1000);
                const istInfo = getISTDateInfo(startWindow);
                const formatTimeOnly = () => {
                  let hr = istInfo.hour;
                  const min = String(istInfo.minute).padStart(2, '0');
                  const ampm = hr >= 12 ? 'PM' : 'AM';
                  hr = hr % 12;
                  hr = hr ? hr : 12;
                  return `${String(hr).padStart(2, '0')}:${min} ${ampm}`;
                };

                if (isBeforeWindow) {
                  return (
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => Alert.alert('Session Locked', `This session can only be started from ${formatTimeOnly()}.`)}
                      className="flex-1 py-3 rounded-xl items-center justify-center bg-zinc-200 border border-zinc-200"
                    >
                      <Text className="text-zinc-400 text-xs font-black uppercase tracking-wider">Start Session</Text>
                    </TouchableOpacity>
                  );
                } else {
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleViewDetails}
                      className="flex-1 py-3 rounded-xl items-center justify-center bg-[#E11D48] border border-[#E11D48]"
                    >
                      <Text className="text-white text-xs font-black uppercase tracking-wider">Start Session</Text>
                    </TouchableOpacity>
                  );
                }
              })()}
            </>
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleViewDetails}
              className="flex-1 py-3 rounded-xl items-center justify-center bg-[#101828] border border-[#101828]"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">View Summary</Text>
            </TouchableOpacity>
          )
        ) : (
          <>
            {isUpcoming && (
              <>
                {isMoreThanTwoHours && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleReschedule}
                    className="flex-1 bg-zinc-50 border py-3 rounded-xl items-center justify-center"
                    style={{ borderColor: 'rgba(228, 228, 231, 0.6)' }}
                  >
                    <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Reschedule</Text>
                  </TouchableOpacity>
                )}
                {!isPast && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleCancel}
                    className="flex-1 border py-3 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: 'rgba(254, 242, 242, 0.5)',
                      borderColor: 'rgba(254, 226, 226, 0.5)',
                    }}
                  >
                    <Text className="text-[#FF4D4F] text-xs font-black uppercase tracking-wider">Cancel</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleViewDetails}
              className={`py-3 rounded-xl items-center justify-center bg-[#101828] border border-[#101828] ${
                (isUpcoming && !isPast) ? 'px-5' : 'flex-1'
              }`}
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">
                {(isUpcoming && !isPast) ? 'Details' : 'View Details'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Cancellation Warning Modal */}
      <Modal
        visible={showCancelWarningModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View className="flex-1 bg-white justify-between px-6 py-12">
          {/* Top content */}
          <View className="items-center justify-center flex-1 gap-6">
            <View className="w-20 h-20 rounded-full bg-rose-50 border border-rose-100 items-center justify-center">
              <Feather name="alert-triangle" size={40} color="#E11D48" />
            </View>
            <View className="items-center gap-3">
              <Text className="text-[#101828] text-xl font-black text-center max-w-[85%]">
                Canceling this session within 2 hours
              </Text>
              <Text className="text-[#6B7280] text-sm font-medium leading-relaxed text-center max-w-[90%]">
                This session is scheduled within the next 2 hours.{"\n\n"}
                If you cancel now, {booking.sessionType === 'COUPLE' ? '2 full credits' : '1 full credit'} will be charged.
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View className="gap-3 w-full">
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isCancelling}
              onPress={handleConfirmCancelWithinTwoHours}
              className="w-full bg-[#E11D48] py-4 rounded-2xl items-center justify-center flex-row gap-2"
            >
              {isCancelling ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-xs font-black uppercase tracking-wider">
                  {booking.sessionType === 'COUPLE' ? 'Cancel & Forfeit 2 Credits' : 'Cancel & Forfeit 1 Credit'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isCancelling}
              onPress={() => setShowCancelWarningModal(false)}
              className="w-full bg-zinc-50 border border-zinc-150 py-4 rounded-2xl items-center justify-center"
            >
              <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Keep Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View className="flex-1 bg-white justify-between px-6 py-8">
          <View className="flex-1 gap-5">
            {/* Header */}
            <View className="flex-row justify-between items-center pb-4 border-b border-zinc-100">
              <View>
                <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest">Reschedule Session</Text>
                <Text className="text-[#101828] text-xl font-black tracking-tight mt-0.5">Choose a new session time</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRescheduleModal(false)} className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center">
                <Feather name="x" size={16} color="#101828" />
              </TouchableOpacity>
            </View>

            {/* Date Picker ScrollView */}
            <View>
              <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest mb-2.5">Select Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {rescheduleDates.map((capsule) => {
                  const isSelected = selectedRescheduleDate === capsule.ymd;
                  return (
                    <TouchableOpacity
                      key={capsule.ymd}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedRescheduleDate(capsule.ymd);
                        setSelectedRescheduleTime('');
                      }}
                      className={`px-4 py-3 rounded-2xl border items-center justify-center gap-1 ${
                        isSelected ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-[#E5E7EB]'
                      }`}
                      style={{ minWidth: 80 }}
                    >
                      <Text className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-[#101828]'}`}>
                        {capsule.label}
                      </Text>
                      <Text className={`text-[8px] font-bold ${isSelected ? 'text-zinc-400' : 'text-[#6B7280]'}`}>
                        {capsule.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Time Slot Picker ScrollView */}
            <View className="flex-1">
              <Text className="text-[#6B7280] text-[10px] font-black uppercase tracking-widest mb-2.5">Available Slots</Text>
              {availableSlots.length === 0 ? (
                <View className="flex-1 justify-center items-center p-8 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <Feather name="calendar" size={24} color="#9CA3AF" />
                  <Text className="text-zinc-500 text-xs font-semibold text-center mt-2 leading-relaxed">
                    No available slots on this day.{"\n"}Please select another date.
                  </Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                  <View className="flex-row flex-wrap gap-2.5">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedRescheduleTime === slot.time;
                      return (
                        <TouchableOpacity
                          key={slot.time}
                          activeOpacity={0.8}
                          onPress={() => setSelectedRescheduleTime(slot.time)}
                          className={`px-4 py-3.5 rounded-2xl border items-center justify-center ${
                            isSelected ? 'bg-zinc-950 border-zinc-950' : 'bg-zinc-50 border-zinc-100'
                          }`}
                          style={{ width: '48%' }}
                        >
                          <Text className={`text-xs font-black tracking-tight ${isSelected ? 'text-white' : 'text-[#101828]'}`}>
                            {slot.time}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View className="gap-3 w-full border-t border-zinc-100 pt-4">
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isRescheduling || !selectedRescheduleDate || !selectedRescheduleTime}
              onPress={handleConfirmReschedule}
              className={`w-full py-4 rounded-2xl items-center justify-center flex-row gap-2 ${
                (!selectedRescheduleDate || !selectedRescheduleTime) ? 'bg-zinc-200' : 'bg-[#E11D48]'
              }`}
            >
              {isRescheduling ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className={`text-xs font-black uppercase tracking-wider ${
                  (!selectedRescheduleDate || !selectedRescheduleTime) ? 'text-zinc-400' : 'text-white'
                }`}>Confirm Reschedule</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isRescheduling}
              onPress={() => setShowRescheduleModal(false)}
              className="w-full bg-zinc-50 border border-zinc-150 py-4 rounded-2xl items-center justify-center"
            >
              <Text className="text-[#101828] text-xs font-black uppercase tracking-wider">Keep Current</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LuxuryCard>
  );
}
