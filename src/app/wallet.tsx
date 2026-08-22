// WALLET FUNCTIONALITY LOCKED
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useWalletStore } from '../store/walletStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useUserStore } from '../store/userStore';
import { Database } from '../database/Database';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { creditBalance, lifetimePurchased, creditsUsed, ledger, transferCredits, clearCreditsForTesting } = useWalletStore();
  const { bookings } = useBookingStore();
  const { membership, toggleExpiryDate, isExpired } = useMembershipStore();

  useFocusEffect(
    useCallback(() => {
      // Ensure session is restored if store is hydrated
      const storedUser = useUserStore.getState().user;
      const isLoggedIn = useUserStore.getState().isLoggedIn;
      if (isLoggedIn && storedUser && storedUser.id) {
        Database.setCurrentUserId(storedUser.id);
      }
      
      Database.load().then(() => {
        useWalletStore.getState().syncFromDB();
        useMembershipStore.getState().syncFromDB();
        useBookingStore.getState().syncFromDB();
      });
    }, [])
  );

  const [transferPhone, setTransferPhone] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const handleTransfer = async () => {
    if (!transferPhone.trim()) {
      Alert.alert('Validation Error', 'Please enter a recipient phone number.');
      return;
    }
    const amt = parseInt(transferAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid credit amount greater than 0.');
      return;
    }
    const res = await transferCredits(transferPhone.trim(), amt);
    if (res.success) {
      Alert.alert('Transfer Successful', `Successfully shared ${amt} ${amt === 1 ? 'credit' : 'credits'} with ${transferPhone}.`);
      setTransferPhone('');
      setTransferAmount('');
    } else {
      Alert.alert('Transfer Failed', res.error || 'Unable to complete transfer.');
    }
  };

  const upcomingCount = bookings.filter(b => b.status === 'upcoming').length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white">
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          }}
          className="w-8 h-8 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#101828" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-[#101828] text-sm font-black uppercase tracking-wider mr-8">
          Credit Wallet
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="gap-6">

          {/* Edge-case Warning Banners (Low or Zero Credits / Expired) */}
          {isExpired() ? (
            <View className="bg-red-50 border border-red-100 p-4.5 rounded-[24px] flex-row items-center gap-3">
              <Feather name="alert-triangle" size={16} color="#EF4444" />
              <View className="flex-1">
                <Text className="text-red-800 text-[10px] font-black uppercase tracking-wider">Wallet Expired ⚠️</Text>
                <Text className="text-red-700 text-xs font-medium mt-0.5">Please recharge to reactivate session check-ins.</Text>
              </View>
            </View>
          ) : creditBalance === 0 ? (
            <View className="bg-rose-50 border border-rose-100 p-4.5 rounded-[24px] flex-row items-center gap-3">
              <Feather name="alert-circle" size={16} color="#E11D48" />
              <View className="flex-1">
                <Text className="text-[#E11D48] text-[10px] font-black uppercase tracking-wider">You&apos;re out of credits ⚠️</Text>
                <Text className="text-rose-700 text-xs font-medium mt-0.5">Recharge your wallet to book wellness sessions.</Text>
              </View>
            </View>
          ) : creditBalance <= 2 ? (
            <View className="bg-amber-50 border border-amber-100 p-4.5 rounded-[24px] flex-row items-center gap-3">
              <Feather name="zap" size={16} color="#D97706" />
              <View className="flex-1">
                <Text className="text-amber-800 text-[10px] font-black uppercase tracking-wider">Running low on credits ⚡</Text>
                <Text className="text-amber-700 text-xs font-medium mt-0.5">Recharge your wallet to keep training.</Text>
              </View>
            </View>
          ) : null}

          {/* Apple Wallet inspired Credit Card (Feature 3) */}
          <View className="bg-zinc-950 rounded-[32px] p-6 border border-zinc-800 shadow-xl gap-6 relative overflow-hidden">
            {/* Shimmer overlay styling */}
            <View className="absolute top-0 left-0 right-0 bottom-0 bg-indigo-500/5" />

            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">★ VIRLA Wallet Card</Text>
                <Text className="text-white text-base font-black mt-1">Universal Session Pass</Text>
              </View>
              {/* Card NFC Wave indicator */}
              <Feather name="rss" size={16} color="white" />
            </View>

            <View className="my-2">
              <Text className="text-white text-3xl font-black tracking-tight">{creditBalance} Credits</Text>
              <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider mt-1">Available check-in balance</Text>
            </View>

            <View className="flex-row justify-between items-center border-t border-zinc-850 pt-4">
              <View>
                <Text className="text-zinc-650 text-[7px] font-black uppercase">Card Holder</Text>
                <Text className="text-white text-xs font-black mt-0.5">Viral</Text>
              </View>
              <View className="items-end">
                <Text className="text-zinc-650 text-[7px] font-black uppercase">Expiry Date</Text>
                <View className="flex-row items-center gap-1 mt-0.5">
                  <Text className="text-white text-xs font-black">{membership.renewalDate}</Text>
                  {isExpired() && (
                    <Text className="text-red-500 text-[8px] font-black uppercase">[Expired]</Text>
                  )}
                </View>
              </View>
            </View>

            <View className="h-[1px] bg-zinc-850 mt-2 mb-1" />

            <TouchableOpacity 
              activeOpacity={0.85}
              onPress={() => router.push('/membership' as any)}
              className="bg-[#E11D48] py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-md"
            >
              <Feather name="plus-circle" size={13} color="white" />
              <Text className="text-white text-xs font-black uppercase tracking-wider">Recharge Wallet</Text>
            </TouchableOpacity>
          </View>

          {/* Stats metrics rows */}
          <View className="flex-row justify-between gap-y-4">
            <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-1.5">
              <Text className="text-zinc-400 text-[8px] font-black uppercase">Lifetime Bought</Text>
              <Text className="text-zinc-900 text-sm font-black">{lifetimePurchased} Credits</Text>
            </View>
            <View className="w-[47%] bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-1.5">
              <Text className="text-zinc-400 text-[8px] font-black uppercase">Credits Consumed</Text>
              <Text className="text-zinc-900 text-sm font-black">{creditsUsed} Credits</Text>
            </View>
            <View className="w-full bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs flex-row justify-between items-center">
              <View className="flex-row items-center gap-3">
                <Feather name="calendar" size={14} color="#4F46E5" />
                <Text className="text-zinc-950 text-xs font-black uppercase">Upcoming Bookings</Text>
              </View>
              <Text className="text-[#4F46E5] text-xs font-black">{upcomingCount} active</Text>
            </View>
          </View>

          {/* Transfer Credits Card */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <View className="flex-row items-center gap-2 border-b border-zinc-50 pb-3">
              <Feather name="send" size={16} color="#101828" />
              <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Transfer Credits</Text>
            </View>
            
            <Text className="text-zinc-500 text-[10px] font-semibold leading-relaxed">
              Instantly share booking credits with your family or friends. Expired or insufficient credits cannot be transferred.
            </Text>

            <View className="gap-3.5">
              <View>
                <Text className="text-zinc-400 text-[8px] font-black uppercase mb-1">Recipient Phone Number</Text>
                <TextInput
                  placeholder="e.g. +91 99999 99999"
                  placeholderTextColor="#9CA3AF"
                  value={transferPhone}
                  onChangeText={setTransferPhone}
                  keyboardType="phone-pad"
                  className="bg-zinc-50 border border-zinc-200/80 px-4 py-3 rounded-xl text-zinc-900 text-xs font-bold"
                />
              </View>

              <View>
                <Text className="text-zinc-400 text-[8px] font-black uppercase mb-1">Credits Amount</Text>
                <TextInput
                  placeholder="Quantity (e.g. 5)"
                  placeholderTextColor="#9CA3AF"
                  value={transferAmount}
                  onChangeText={setTransferAmount}
                  keyboardType="numeric"
                  className="bg-zinc-50 border border-zinc-200/80 px-4 py-3 rounded-xl text-zinc-900 text-xs font-bold"
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleTransfer}
                className="w-full bg-[#E11D48] py-3.5 rounded-xl items-center justify-center mt-1"
              >
                <Text className="text-white text-xs font-black uppercase">Confirm Transfer</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* QA Development Controls */}
          {typeof __DEV__ !== 'undefined' && __DEV__ && (
            <View className="bg-red-50/50 border border-red-100 p-5 rounded-[28px] gap-4">
              <View className="flex-row items-center gap-2 border-b border-red-100 pb-3">
                <Feather name="tool" size={16} color="#B91C1C" />
                <Text className="text-red-800 text-xs font-black uppercase tracking-wider">QA Testing Panel</Text>
              </View>

              <Text className="text-red-700 text-[9px] font-semibold leading-relaxed">
                Use these tools to verify edge-case behaviors (such as memberships expiring or running out of credits) instantly.
              </Text>

              <View className="gap-2.5">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    toggleExpiryDate();
                    Alert.alert('Status Updated', `Membership expiry date toggled to: ${useMembershipStore.getState().membership.renewalDate}`);
                  }}
                  className="bg-white border border-red-200 py-3 rounded-xl items-center justify-center flex-row gap-2"
                >
                  <Feather name="clock" size={12} color="#B91C1C" />
                  <Text className="text-red-800 text-[10px] font-black uppercase">
                    {isExpired() ? 'Set Valid (Aug 15)' : 'Set Expired (Jul 15)'}
                  </Text>
                </TouchableOpacity>

                <View className="flex-row gap-2">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      clearCreditsForTesting();
                      Alert.alert('Balance Cleared', 'Your active credit balance is now 0.');
                    }}
                    className="flex-1 bg-white border border-red-200 py-3 rounded-xl items-center justify-center flex-row gap-2"
                  >
                    <Feather name="trash-2" size={12} color="#B91C1C" />
                    <Text className="text-red-800 text-[10px] font-black uppercase">Clear Credits</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      const userId = Database.getCurrentUserId();
                      if (userId) {
                        const profile = Database.getProfile(userId);
                        if (profile) {
                          profile.creditsBalance = 50;
                          Database.updateProfile(userId, { creditsBalance: 50 });
                          useWalletStore.getState().syncFromDB();
                          useMembershipStore.getState().syncFromDB();
                        }
                      }
                      Alert.alert('Balance Reset', 'Your credit balance has been reset to 50.');
                    }}
                    className="flex-1 bg-white border border-red-200 py-3 rounded-xl items-center justify-center flex-row gap-2"
                  >
                    <Feather name="refresh-cw" size={12} color="#B91C1C" />
                    <Text className="text-red-800 text-[10px] font-black uppercase">Reset to 50</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Credit ledger ledger logs transaction list (Feature 4) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Wallet transaction ledger</Text>
            
            <View className="gap-4">
              {ledger.map((tx) => {
                const isAdd = tx.change >= 0;
                return (
                  <View key={tx.id} className="flex-row justify-between items-center py-1">
                    <View className="flex-1 pr-3 gap-0.5">
                      <Text className="text-zinc-900 text-xs font-black leading-tight">{tx.title}</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{tx.date}</Text>
                    </View>
                    <View className="items-end gap-1.5">
                      <Text className={`text-xs font-black ${isAdd ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isAdd ? '+' : ''}{tx.change} {Math.abs(tx.change) === 1 ? 'Credit' : 'Credits'}
                      </Text>
                      
                      {/* Type Badge */}
                      <View className={`px-1.5 py-0.5 rounded-md ${
                        tx.type === 'purchase'
                          ? 'bg-blue-50 border border-blue-100'
                          : tx.type === 'refund'
                          ? 'bg-emerald-50 border border-emerald-100'
                          : tx.type === 'penalty'
                          ? 'bg-red-50 border border-red-100'
                          : 'bg-zinc-50 border border-zinc-150'
                      }`}>
                        <Text className={`text-[6px] font-black uppercase ${
                          tx.type === 'purchase' ? 'text-blue-600' : tx.type === 'refund' ? 'text-emerald-600' : tx.type === 'penalty' ? 'text-red-500' : 'text-zinc-500'
                        }`}>
                          {tx.type}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
