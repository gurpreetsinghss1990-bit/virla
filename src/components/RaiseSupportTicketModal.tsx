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
  const [selectedResolution, setSelectedResolution] = useState<string>('');
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

  const resolutionOptions = [
    'Refund 1 Credit to Wallet',
    'Connect Live with Senior Concierge',
    'Reassign to New Certified Coach',
    'Report Coach Disciplinary Review'
  ];

  const reasonsList = isCompleted ? completedReasons : cancellationReasons;
  const categoryTitle = isCompleted ? 'Completed Session Feedback' : 'Cancelled Session Dispute';

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Selection Required', 'Please select the primary reason for your request.');
      return;
    }
    if (!selectedResolution) {
      Alert.alert('Selection Required', 'Please select your preferred resolution.');
      return;
    }

    try {
      setIsSubmitting(true);
      const ticket = await Database.createSupportTicket({
        userId,
        bookingId: booking?.id,
        category: categoryTitle,
        reason: selectedReason,
        description: description.trim() || `Client selected ${selectedReason} with preferred resolution: ${selectedResolution}.`,
        preferredResolution: selectedResolution
      });

      setIsSubmitting(false);
      onClose();
      // Reset form
      setSelectedReason('');
      setSelectedResolution('');
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
        {/* Header */}
        <View className="px-6 py-4 border-b border-zinc-100 flex-row items-center justify-between">
          <View>
            <View className="flex-row items-center gap-1.5 mb-0.5">
              <View className="w-2 h-2 rounded-full bg-rose-500" />
              <Text className="text-rose-600 text-[10px] font-black uppercase tracking-wider">
                Virla Concierge Support
              </Text>
            </View>
            <Text className="text-zinc-900 text-lg font-black tracking-tight">
              Report Issue / Support
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 items-center justify-center"
          >
            <Ionicons name="close" size={18} color="#18181B" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Booking Context Pill */}
          {booking && (
            <View className="bg-zinc-50 border border-zinc-200/80 p-3.5 rounded-2xl mb-6">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-zinc-400 text-[9px] font-black uppercase tracking-wider">Linked Session</Text>
                <View className="bg-zinc-200/60 px-2 py-0.5 rounded-md">
                  <Text className="text-zinc-700 text-[8px] font-black uppercase">{booking.status}</Text>
                </View>
              </View>
              <Text className="text-zinc-900 text-xs font-black">
                {booking.workoutTitle} with Coach {booking.trainerName || 'Assigned Trainer'}
              </Text>
              <Text className="text-zinc-500 text-[10px] font-semibold mt-0.5">
                📅 {formatToDDMMYYYY(booking.date)} · ⏱️ {booking.time} · ID: {booking.id}
              </Text>
            </View>
          )}

          {/* Question 1: Reason Selection */}
          <View className="mb-6">
            <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider mb-1.5">
              1. What went wrong? <Text className="text-rose-500">*</Text>
            </Text>
            <Text className="text-zinc-500 text-[11px] font-semibold mb-3">
              Select the primary reason for this support inquiry.
            </Text>
            <View className="gap-2">
              {reasonsList.map((r) => {
                const isSelected = selectedReason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    activeOpacity={0.8}
                    onPress={() => setSelectedReason(r)}
                    className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
                      isSelected 
                        ? 'bg-zinc-950 border-zinc-950' 
                        : 'bg-zinc-50 border-zinc-200/70'
                    }`}
                  >
                    <Text className={`text-xs font-bold flex-1 ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                      {r}
                    </Text>
                    <View className={`w-4 h-4 rounded-full border items-center justify-center ${
                      isSelected ? 'border-white bg-white' : 'border-zinc-300'
                    }`}>
                      {isSelected && <View className="w-2 h-2 rounded-full bg-zinc-950" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Question 2: Preferred Resolution */}
          <View className="mb-6">
            <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider mb-1.5">
              2. How would you like us to resolve this? <Text className="text-rose-500">*</Text>
            </Text>
            <Text className="text-zinc-500 text-[11px] font-semibold mb-3">
              Choose your ideal outcome so concierge team can act immediately.
            </Text>
            <View className="gap-2">
              {resolutionOptions.map((res) => {
                const isSelected = selectedResolution === res;
                return (
                  <TouchableOpacity
                    key={res}
                    activeOpacity={0.8}
                    onPress={() => setSelectedResolution(res)}
                    className={`p-3.5 rounded-xl border flex-row items-center justify-between ${
                      isSelected 
                        ? 'bg-rose-500 border-rose-500' 
                        : 'bg-zinc-50 border-zinc-200/70'
                    }`}
                  >
                    <Text className={`text-xs font-bold flex-1 ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                      {res}
                    </Text>
                    <View className={`w-4 h-4 rounded-full border items-center justify-center ${
                      isSelected ? 'border-white bg-white' : 'border-zinc-300'
                    }`}>
                      {isSelected && <View className="w-2 h-2 rounded-full bg-rose-500" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Question 3: Additional Notes */}
          <View className="mb-6">
            <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider mb-1.5">
              3. Additional Notes (Optional)
            </Text>
            <Text className="text-zinc-500 text-[11px] font-semibold mb-2">
              Provide any extra details or specific requests for the admin.
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Explain what happened or any specific notes..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs font-semibold text-zinc-900 min-h-[90px]"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            disabled={isSubmitting}
            activeOpacity={0.8}
            onPress={handleSubmit}
            className="w-full bg-[#101828] py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={16} color="white" />
                <Text className="text-white text-xs font-black uppercase tracking-wider">
                  Create Support Ticket & Open Chat
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
