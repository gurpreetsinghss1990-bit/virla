import { Loading } from './Loading';
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Database } from '../database/Database';
import { useUserStore } from '../store/userStore';
import { useRouter } from 'expo-router';
import { NativeSheet } from './NativeSheet';
import { NativeDivider } from './NativeDivider';
import { digitsOnly, isValidPhone } from '../utils/inputSafety';

interface AddPartnerModalProps {
  visible: boolean;
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddPartnerModal: React.FC<AddPartnerModalProps> = ({
  visible,
  bookingId,
  onClose,
  onSuccess,
}) => {
  const router = useRouter();
  const { user } = useUserStore();
  const [partnerName, setPartnerName] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const profile = Database.getProfile(user.id || '');
  const creditsBalance = profile?.creditsBalance || 0;
  const hasCredits = creditsBalance >= 1;

  const handleUpgrade = async () => {
    if (!partnerName.trim()) {
      Alert.alert('Required Info ⚠️', 'Please enter your partner/friend\'s name.');
      return;
    }
    if (!isValidPhone(partnerPhone) || partnerPhone.trim().length !== 10) {
      Alert.alert('Required Info ⚠️', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSubmitting(true);
    try {
      await Database.addPartnerToBooking(bookingId, partnerName.trim(), partnerPhone.trim());
      Alert.alert('Partner Added! 🎉', `Successfully added ${partnerName.trim()} to this session.`);
      onSuccess();
    } catch (err: any) {
      Alert.alert('Upgrade Failed ⚠️', err.message || 'Unable to add partner. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <NativeSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="w-full p-6 pb-10 gap-5">
          {/* Modal Header */}
          <View className="flex-row justify-between items-center border-b border-zinc-100 pb-4">
            <View className="gap-0.5">
              <Text className="text-zinc-400 text-[8px] font-black uppercase">Train with a Friend</Text>
              <Text className="text-zinc-950 text-xl font-black mt-0.5">Add Partner to Session</Text>
            </View>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-zinc-50 items-center justify-center border border-zinc-150">
              <Feather name="x" size={14} color="#101828" />
            </Pressable>
          </View>

          {/* Pricing/Credits summary */}
          <View className="bg-zinc-50 p-4.5 rounded-2xl gap-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-zinc-500 text-xs font-semibold">Current Session (1 Person)</Text>
              <Text className="text-zinc-900 text-xs font-extrabold">1 Credit</Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-zinc-500 text-xs font-semibold">Upgraded Session (2 People)</Text>
              <Text className="text-zinc-900 text-xs font-extrabold">2 Credits</Text>
            </View>
            <NativeDivider color="#E4E4E7" className="my-0.5" />
            <View className="flex-row justify-between items-center">
              <Text className="text-zinc-950 text-xs font-black">Additional Cost</Text>
              <Text className="text-[#E11D48] text-xs font-black">1 Credit</Text>
            </View>
          </View>

          {/* Inputs Section if they have credits */}
          {hasCredits ? (
            <View className="gap-3.5 mt-1">
              <View className="gap-1.5">
                <Text className="text-zinc-500 text-[9px] font-bold uppercase pl-0.5">Partner Name</Text>
                <TextInput
                  maxLength={250}
                  value={partnerName}
                  onChangeText={setPartnerName}
                  placeholder="Enter partner's full name"
                  placeholderTextColor="#9CA3AF"
                  className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-xl text-zinc-900 text-xs font-semibold h-12"
                />
              </View>
              <View className="gap-1.5">
                <Text className="text-zinc-500 text-[9px] font-bold uppercase pl-0.5">Partner Mobile Phone</Text>
                <TextInput
                  value={partnerPhone}
                  onChangeText={(v) => setPartnerPhone(digitsOnly(v, 10))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#9CA3AF"
                  className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-xl text-zinc-900 text-xs font-semibold h-12"
                />
              </View>
            </View>
          ) : (
            /* Warning Banner if insufficient credits */
            <View className="bg-red-50 border border-red-100 p-4.5 rounded-2xl gap-3">
              <View className="flex-row items-center gap-2.5">
                <Feather name="alert-triangle" size={16} color="#EF4444" />
                <Text className="text-red-800 text-xs font-extrabold uppercase">Not Enough Credits</Text>
              </View>
              <Text className="text-red-600 text-[11px] font-semibold leading-relaxed">
                You need 1 additional credit to add a partner to this session. Your wallet has {creditsBalance} credits.
              </Text>
            </View>
          )}

          {/* Actions */}
          <View className="gap-3.5 mt-3">
            {hasCredits ? (
              <Pressable
                onPress={handleUpgrade}
                disabled={isSubmitting}
                className="w-full bg-[#E11D48] py-4 rounded-xl items-center justify-center flex-row gap-2 shadow-sm min-h-[48px]"
              >
                {isSubmitting ? (
                  <Loading size="small" color="white" />
                ) : (
                  <>
                    <Text className="text-white text-xs font-black uppercase tracking-wider">Confirm Add Partner</Text>
                    <Feather name="arrow-right" size={12} color="white" />
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/membership');
                }}
                className="w-full bg-zinc-950 py-4 rounded-xl items-center justify-center flex-row gap-2 shadow-sm min-h-[48px]"
              >
                <Feather name="shopping-bag" size={12} color="white" />
                <Text className="text-white text-xs font-black uppercase tracking-wider">Recharge Wallet</Text>
              </Pressable>
            )}
            
            <Pressable
              onPress={onClose}
              disabled={isSubmitting}
              className="w-full bg-zinc-50 border border-zinc-150 py-4 rounded-xl items-center justify-center"
            >
              <Text className="text-zinc-600 text-xs font-black uppercase tracking-wider">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </NativeSheet>
  );
};
