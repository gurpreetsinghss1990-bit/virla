import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Alert, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Database } from '../database/Database';
import { LuxuryCard } from '../components/LuxuryCard';
import { useUserStore } from '../store/userStore';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native';
import { digitsOnly, cleanIfsc, cleanUpi, isValidIfsc, isValidUpi } from '../utils/inputSafety';

export default function PayoutSetupScreen() {
  const user = useUserStore(state => state.user);
  const insets = useSafeAreaInsets();

  const coach = Database.schema.coaches.find((c: any) => c.name === user.name || c.id === user.id) || null;

  const initialBankDetails = useMemo(() => {
    if (coach && coach.bankDetails) {
      try {
        return JSON.parse(coach.bankDetails);
      } catch (e) {}
    }
    return {};
  }, [coach]);

  const [accountHolderName, setAccountHolderName] = useState(initialBankDetails.accountName || '');
  const [bankName, setBankName] = useState(initialBankDetails.bankName || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(initialBankDetails.accountNumber || '');
  const [bankIfsc, setBankIfsc] = useState(initialBankDetails.ifsc || '');
  const [bankUpiId, setBankUpiId] = useState(initialBankDetails.upiId || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!accountHolderName || !bankName || !bankAccountNumber || !bankIfsc) {
      Alert.alert('Missing Fields', 'Please fill in Account Holder, Bank Name, Account Number, and IFSC.');
      return;
    }
    if (bankAccountNumber.length < 6) {
      Alert.alert('Invalid Account Number', 'Please enter a valid bank account number.');
      return;
    }
    if (!isValidIfsc(bankIfsc)) {
      Alert.alert('Invalid IFSC', 'IFSC code 11 characters ka hota hai, jaise HDFC0000060.');
      return;
    }
    if (bankUpiId.trim() && !isValidUpi(bankUpiId)) {
      Alert.alert('Invalid UPI ID', 'UPI ID ka format galat hai, jaise naam@okhdfc.');
      return;
    }

    setSubmitting(true);
    try {
      const trainerId = user.id || coach?.id;
      if (!trainerId) {
        throw new Error('Trainer ID not found');
      }

      await Database.updateCoach(trainerId, {
        bankDetails: JSON.stringify({
          accountName: accountHolderName,
          bankName,
          accountNumber: bankAccountNumber,
          ifsc: bankIfsc,
          upiId: bankUpiId
        })
      });

      Alert.alert('Payout Setup Completed', '✓ Your banking details have been successfully configured.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile' as any) }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save payout configuration');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FCF5F5', paddingTop: insets.top }}>
      <View className="h-16 flex-row items-center px-6 justify-between bg-white border-b border-zinc-150">
        <Pressable
          onPress={() => router.replace('/(tabs)/profile' as any)}
          className="flex-row items-center gap-1"
        >
          <Feather name="arrow-left" size={16} color="#101828" />
          <Text className="text-zinc-900 text-xs font-bold uppercase tracking-wider">Cancel</Text>
        </Pressable>
        <Text className="text-[#E11D48] text-sm font-black tracking-widest uppercase">Payout Setup</Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 100 }}
          className="flex-1 bg-[#FCF5F5]"
        >
          <View className="mb-6">
            <Text className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest">Approved Partner</Text>
            <Text className="text-[#101828] text-2xl font-black tracking-tight mt-1">Configure Banking Payout</Text>
            <Text className="text-zinc-500 text-xs mt-1.5 leading-relaxed">
              Provide your account credentials to receive session earnings. Funds are routed within 24 hours of session completion.
            </Text>
          </View>

          <LuxuryCard className="p-5 gap-4" interactive={false}>
            <Text className="text-[#101828] text-xs font-black uppercase tracking-widest border-b border-zinc-100 pb-2">Payout Destination</Text>

            <View className="gap-3.5">
              <View>
                <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Account Holder Name</Text>
                <TextInput
                  maxLength={250}
                  value={accountHolderName}
                  onChangeText={setAccountHolderName}
                  placeholder="Karan Sharma"
                  className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                />
              </View>

              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Bank Name</Text>
                  <TextInput
                    maxLength={250}
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="HDFC Bank"
                    className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">IFSC Code</Text>
                  <TextInput
                    maxLength={11}
                    autoCapitalize="characters"
                    value={bankIfsc}
                    onChangeText={(v) => setBankIfsc(cleanIfsc(v))}
                    placeholder="HDFC0000060"
                    className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                  />
                </View>
              </View>

              <View>
                <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Account Number</Text>
                <TextInput
                  maxLength={18}
                  value={bankAccountNumber}
                  onChangeText={(v) => setBankAccountNumber(digitsOnly(v, 18))}
                  keyboardType="number-pad"
                  placeholder="50100412345678"
                  className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                />
              </View>

              <View>
                <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">UPI ID (Optional)</Text>
                <TextInput
                  maxLength={60}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={bankUpiId}
                  onChangeText={(v) => setBankUpiId(cleanUpi(v))}
                  placeholder="karan@okhdfc"
                  className="bg-zinc-50 border border-zinc-150 p-3 rounded-xl text-zinc-900 text-xs font-semibold"
                />
              </View>
            </View>
          </LuxuryCard>

          <Pressable
            onPress={handleSave}
            disabled={submitting}
            className="w-full py-4 bg-[#E11D48] rounded-xl items-center justify-center mt-6 shadow-lg shadow-rose-950/20"
          >
            <Text className="text-white text-xs font-black uppercase tracking-wider">
              {submitting ? 'Saving Configuration...' : 'Confirm Details'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
