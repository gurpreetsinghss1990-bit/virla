import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Database, SupportTicket } from '../database/Database';
import { Booking } from '../types';
import { formatToDDMMYYYY } from '../utils/date';

interface RaiseSupportTicketModalProps {
  visible: boolean;
  booking?: Booking | null;
  userId: string;
  onClose: () => void;
  onTicketCreated: (ticket: SupportTicket) => void;
}

export function RaiseSupportTicketModal({
  visible,
  booking,
  userId,
  onClose,
  onTicketCreated,
}: RaiseSupportTicketModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isCancelled = booking?.status === 'cancelled' || booking?.status === 'client_no_show' || booking?.status === 'trainer_no_show';
  const isCompleted = booking?.status === 'completed';

  const cancellationReasons = [
    'Trainer was a No-Show / Late',
    'Session was Cancelled without Prior Notice',
    'Credit deduction / Refund discrepancy',
    'Trainer requested cancellation',
    'Emergency / Personal grounds',
    'Other session issue'
  ];

  const completedReasons = [
    'Session quality / Coach conduct issue',
    'Workout ended earlier than 60 mins',
    'Safety or inappropriate behavior',
    'Credit billing / double deduction',
    'Need follow-up workout review',
    'Other feedback'
  ];

  const reasonsList = isCompleted ? completedReasons : cancellationReasons;
  const categoryTitle = isCompleted ? 'Completed Session Feedback' : 'Cancelled Session Dispute';

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Selection Required', 'Please select the primary reason for your request.');
      return;
    }

    try {
      setIsSubmitting(true);
      const ticket = await Database.createSupportTicket({
        userId,
        bookingId: booking?.id,
        category: categoryTitle,
        reason: selectedReason,
        description: description.trim() || `Client reported: ${selectedReason}.`
      });

      setIsSubmitting(false);
      onClose();
      // Reset form
      setSelectedReason('');
      setDescription('');
      onTicketCreated(ticket);
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert('Submission Error', err.message || 'Could not register ticket. Please check connection.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
        <View className="px-5 py-3.5 border-b border-zinc-100 flex-row items-center justify-between">
          <View>
            <Text className="text-zinc-400 text-[10px] font-medium mb-0.5">
              Virla Concierge
            </Text>
            <Text className="text-zinc-900 text-base font-semibold">
              Report an issue
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
          >
            <Ionicons name="close" size={18} color="#18181B" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {booking && (
            <View className="bg-zinc-50 border border-zinc-200/70 rounded-xl px-3 py-2.5 mb-5">
              <Text className="text-zinc-800 text-[13px] font-medium" numberOfLines={1}>
                {booking.workoutTitle} · Coach {booking.trainerName || 'Assigned Trainer'}
              </Text>
              <Text className="text-zinc-500 text-[11px] mt-0.5">
                {formatToDDMMYYYY(booking.date)} · {booking.time} · {booking.status}
              </Text>
            </View>
          )}

          <Text className="text-zinc-900 text-[13px] font-semibold mb-1">
            1. What went wrong? <Text className="text-rose-500">*</Text>
          </Text>
          <Text className="text-zinc-500 text-[11px] mb-2.5">
            Select the primary reason.
          </Text>
          <View className="gap-1.5 mb-5">
            {reasonsList.map((r) => {
              const isSelected = selectedReason === r;
              return (
                <TouchableOpacity
                  key={r}
                  activeOpacity={0.7}
                  onPress={() => setSelectedReason(r)}
                  className={`px-3 py-2.5 rounded-lg border flex-row items-center justify-between ${
                    isSelected ? 'bg-zinc-100 border-zinc-900' : 'bg-white border-zinc-200'
                  }`}
                >
                  <Text className={`text-[13px] flex-1 pr-3 ${isSelected ? 'text-zinc-900 font-medium' : 'text-zinc-700'}`}>
                    {r}
                  </Text>
                  <View className={`w-4 h-4 rounded-full border items-center justify-center ${
                    isSelected ? 'border-zinc-900' : 'border-zinc-300'
                  }`}>
                    {isSelected && <View className="w-2 h-2 rounded-full bg-zinc-900" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text className="text-zinc-900 text-[13px] font-semibold mb-1">
            2. Additional notes
          </Text>
          <Text className="text-zinc-500 text-[11px] mb-2">
            Optional — anything else the team should know.
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Explain what happened..."
            placeholderTextColor="#A1A1AA"
            multiline
            textAlignVertical="top"
            className="bg-white border border-zinc-200 rounded-xl p-3 text-[13px] text-zinc-900 min-h-[84px] mb-5"
          />

          <TouchableOpacity
            disabled={isSubmitting || !selectedReason}
            activeOpacity={0.8}
            onPress={handleSubmit}
            className={`w-full py-3 rounded-xl items-center justify-center flex-row gap-2 ${
              isSubmitting || !selectedReason ? 'bg-zinc-300' : 'bg-[#101828]'
            }`}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={15} color={selectedReason ? 'white' : '#71717A'} />
                <Text className={`text-[13px] font-medium ${selectedReason ? 'text-white' : 'text-zinc-600'}`}>
                  Create ticket & open chat
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
