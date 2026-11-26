import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface WalletTransferModalProps {
  visible: boolean;
  recipientName: string;
  transferPhone: string;
  transferAmount: string;
  creditBalance: number;
  isEliteUser: boolean;
  renderExpirySection: () => React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

export const WalletTransferModal = React.memo(function WalletTransferModal({
  visible,
  recipientName,
  transferPhone,
  transferAmount,
  creditBalance,
  isEliteUser,
  renderExpirySection,
  onCancel,
  onConfirm,
}: WalletTransferModalProps) {
  if (!visible) return null;

  return (
    <View
      className="absolute top-0 left-0 right-0 bottom-0 bg-black/60 items-center justify-center z-50 px-6"
      style={{ position: 'absolute', elevation: 10 }}
    >
      <View className="w-full bg-white rounded-3xl p-5 gap-5 shadow-2xl">
        <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
          <Feather name="alert-circle" size={18} color="#E11D48" />
          <Text className="text-[#101828] text-sm font-bold uppercase">Transfer Credits?</Text>
        </View>

        <View className="gap-3.5">
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-zinc-500 text-[11px] font-bold uppercase">Recipient</Text>
            <Text className="text-zinc-900 text-xs font-bold">{recipientName}</Text>
          </View>
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-zinc-500 text-[11px] font-bold uppercase">Phone Number</Text>
            <Text className="text-zinc-900 text-xs font-bold">+91 {transferPhone}</Text>
          </View>
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-zinc-500 text-[11px] font-bold uppercase">Transfer Amount</Text>
            <Text className="text-[#E11D48] text-xs font-bold">{transferAmount} Credits</Text>
          </View>
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-zinc-500 text-[11px] font-bold uppercase">Remaining Balance</Text>
            <Text className="text-zinc-900 text-xs font-bold">{creditBalance - parseInt(transferAmount, 10)} Credits</Text>
          </View>
          {renderExpirySection()}
          {isEliteUser && (
            <Text className="text-indigo-800 text-[10px] font-bold uppercase mt-1 leading-relaxed text-center">
              *Transferred credits preserve premium 7-day grace extension after expiry.
            </Text>
          )}
        </View>

        <View className="flex-row gap-3.5 mt-2">
          <Pressable
            onPress={onCancel}
            style={{ flex: 1, backgroundColor: '#F4F4F5', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: 'Outfit_700Bold', color: '#3F3F46', fontSize: 12 }}>CANCEL</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={{ flex: 1, backgroundColor: '#E11D48', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: 'Outfit_700Bold', color: '#FFFFFF', fontSize: 12 }}>CONFIRM</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

