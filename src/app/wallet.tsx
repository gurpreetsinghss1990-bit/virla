import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useWalletStore } from '../store/walletStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useUserStore } from '../store/userStore';
import { Database } from '../database/Database';
import { Ionicons, Feather } from '@expo/vector-icons';
import { formatToDDMMYYYY } from '../utils/date';
import { supabase } from '../database/supabaseClient';

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { creditBalance, lifetimePurchased, creditsUsed, ledger, transferCredits, creditLots } = useWalletStore();
  const { bookings } = useBookingStore();
  const { membership, isExpired } = useMembershipStore();
  const role = useUserStore((state) => state.role);

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
  const [recipientStatus, setRecipientStatus] = useState<'idle' | 'searching' | 'not_found' | 'self' | 'found'>('idle');
  const [recipientName, setRecipientName] = useState('');
  const [isInviteSent, setIsInviteSent] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleVerifyRecipient = async () => {
    if (!transferPhone || transferPhone.length < 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setRecipientStatus('searching');
    setIsInviteSent(false);
    try {
      const fullPhone = '+91' + transferPhone;
      const { data, error } = await supabase.rpc('find_recipient_by_phone', { p_phone: fullPhone });
      if (error) {
        setRecipientStatus('idle');
        Alert.alert('Verification Error', error.message);
        return;
      }
      if (!data.found) {
        setRecipientStatus('not_found');
      } else if (data.is_self) {
        setRecipientStatus('self');
        setRecipientName(data.name);
      } else {
        setRecipientStatus('found');
        setRecipientName(data.name);
      }
    } catch (err) {
      setRecipientStatus('idle');
      console.error('[VerifyRecipient] failed:', err);
    }
  };

  const handleInvite = async () => {
    const fullPhone = '+91' + transferPhone;
    const userId = Database.getCurrentUserId();
    if (!userId) return;

    try {
      const { error } = await supabase.from('invitations').insert({
        id: 'invite-' + Date.now(),
        sender_id: userId,
        phone: fullPhone
      });

      if (error && error.code !== '23505') {
        Alert.alert('Invite Error', error.message);
        return;
      }

      setIsInviteSent(true);
      Alert.alert('Invitation Logged ✉️', `Invitation to join Virla has been successfully recorded for: +91 ${transferPhone}.`);
    } catch (err) {
      console.error('[Invite] failed:', err);
    }
  };

  const calculateTransferBreakdown = () => {
    const amt = parseInt(transferAmount, 10);
    if (isNaN(amt) || amt <= 0 || !creditLots || creditLots.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedLots = [...creditLots]
      .filter(l => {
        if (l.remaining_credits <= 0) return false;
        const expDate = new Date(l.official_expiry_date);
        expDate.setHours(0, 0, 0, 0);
        return expDate >= today;
      })
      .sort((a, b) => new Date(a.official_expiry_date).getTime() - new Date(b.official_expiry_date).getTime());

    let needed = amt;
    const allocations: { amount: number; official_expiry_date: string }[] = [];

    for (const lot of sortedLots) {
      if (needed <= 0) break;
      if (lot.remaining_credits >= needed) {
        allocations.push({
          amount: needed,
          official_expiry_date: lot.official_expiry_date
        });
        needed = 0;
      } else {
        allocations.push({
          amount: lot.remaining_credits,
          official_expiry_date: lot.official_expiry_date
        });
        needed -= lot.remaining_credits;
      }
    }

    if (needed > 0) return []; // Cannot satisfy
    return allocations;
  };

  const getTransferredExpiryDate = () => {
    const breakdown = calculateTransferBreakdown();
    if (breakdown.length === 1) {
      return formatToDDMMYYYY(breakdown[0].official_expiry_date);
    }
    return 'Multi-Lot Breakdown';
  };

  const handleTransfer = async () => {
    if (recipientStatus !== 'found') {
      Alert.alert('Validation Error', 'Please verify recipient phone number first.');
      return;
    }
    const amt = parseInt(transferAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid credit amount greater than 0.');
      return;
    }
    if (amt > creditBalance) {
      Alert.alert('Validation Error', `Insufficient balance. You only have ${creditBalance} credits.`);
      return;
    }
    
    const breakdown = calculateTransferBreakdown();
    if (breakdown.length === 0) {
      Alert.alert('Validation Error', 'Insufficient unexpired credits available for transfer.');
      return;
    }

    setShowConfirmModal(true);
  };

  const renderExpirySection = () => {
    const breakdown = calculateTransferBreakdown();
    if (breakdown.length === 0) return null;

    if (breakdown.length === 1) {
      return (
        <View className="flex-row justify-between items-center py-1">
          <Text className="text-zinc-450 text-[10px] font-bold uppercase">Original Expiry</Text>
          <Text className="text-zinc-900 text-xs font-black">{formatToDDMMYYYY(breakdown[0].official_expiry_date)}</Text>
        </View>
      );
    }

    return (
      <View className="border-t border-zinc-100 pt-3.5 gap-2">
        <Text className="text-zinc-450 text-[9px] font-black uppercase tracking-wider mb-1">Credit Expiry Breakdown</Text>
        {breakdown.map((item, idx) => (
          <View key={idx} className="flex-row justify-between items-center py-0.5">
            <Text className="text-zinc-800 text-xs font-bold">{item.amount} {item.amount === 1 ? 'Credit' : 'Credits'}</Text>
            <Text className="text-zinc-550 text-[10px] font-bold">Expires {formatToDDMMYYYY(item.official_expiry_date)}</Text>
          </View>
        ))}
      </View>
    );
  };

  const handleTransferConfirm = async () => {
    setShowConfirmModal(false);
    const amt = parseInt(transferAmount, 10);
    const fullPhone = '+91' + transferPhone;
    const res = await transferCredits(fullPhone, amt);
    if (res.success) {
      Alert.alert('Transfer Successful 🎉', `${amt} ${amt === 1 ? 'credit' : 'credits'} transferred successfully to ${res.recipientName || recipientName}.\nExpiry: ${res.expiryDate || getTransferredExpiryDate()}`);
      setTransferPhone('');
      setTransferAmount('');
      setRecipientStatus('idle');
      setRecipientName('');
    } else {
      Alert.alert('Transfer Failed ⚠️', res.error || 'Unable to complete transfer.');
    }
  };

  const getLotsApproachingExpiry = () => {
    if (!creditLots || creditLots.length === 0) return [];
    const today = new Date();
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(today.getDate() + 2);

    return creditLots.filter(l => {
      const expDate = new Date(l.official_expiry_date);
      const graceExpDate = new Date(l.grace_expiry_date);
      return l.remaining_credits > 0 && expDate <= twoDaysFromNow && today <= graceExpDate;
    });
  };

  const isEliteUser = membership.renewalDate && Database.getProfile(Database.getCurrentUserId() || '')?.membershipStatus === 'Elite';
  const approachingLots = getLotsApproachingExpiry();

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

          {/* Premium Expiry Grace Warning Banner */}
          {isEliteUser && approachingLots.length > 0 && (
            <View className="bg-indigo-50 border border-indigo-100 p-5 rounded-[28px] gap-2">
              <View className="flex-row items-center gap-2">
                <Feather name="heart" size={16} color="#4F46E5" />
                <Text className="text-indigo-800 text-[10px] font-black uppercase tracking-wider">A special benefit for you ❤️</Text>
              </View>
              <Text className="text-indigo-700 text-[11px] font-semibold leading-relaxed">
                Your credits are approaching their expiry date. Because you&apos;re a premium Virla client, we don&apos;t want you to compromise on your fitness journey.
              </Text>
              <Text className="text-indigo-700 text-[11px] font-semibold leading-relaxed">
                We&apos;re giving you an additional 7 days to use your remaining credits.
              </Text>
              <View className="mt-1 flex-row justify-between items-center bg-indigo-100/50 px-3 py-2 rounded-xl">
                <Text className="text-indigo-900 text-[8px] font-black uppercase">Expiry: {formatToDDMMYYYY(approachingLots[0].official_expiry_date)}</Text>
                <Text className="text-indigo-900 text-[8px] font-black uppercase">Grace Until: {formatToDDMMYYYY(approachingLots[0].grace_expiry_date)}</Text>
              </View>
            </View>
          )}

          {role === 'trainer' && (
            <View className="bg-indigo-50 border border-indigo-100 p-5 rounded-[28px] gap-2">
              <View className="flex-row items-center gap-2">
                <Feather name="info" size={16} color="#4F46E5" />
                <Text className="text-indigo-800 text-[10px] font-black uppercase tracking-wider">TRANSFER-ONLY CREDITS</Text>
              </View>
              <Text className="text-indigo-700 text-[11px] font-semibold leading-relaxed">
                As a trainer, you can receive and transfer credits, but you cannot use credits to book sessions for yourself.
              </Text>
            </View>
          )}

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

            {role !== 'trainer' && (
              <TouchableOpacity 
                activeOpacity={0.85}
                onPress={() => router.push('/membership' as any)}
                className="bg-[#E11D48] py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-md"
              >
                <Feather name="plus-circle" size={13} color="white" />
                <Text className="text-white text-xs font-black uppercase tracking-wider">Recharge Wallet</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Credit Lot Expiry Summary */}
          {creditLots && creditLots.filter(l => l.remaining_credits > 0).length > 0 && (
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
              <View className="flex-row items-center gap-2 border-b border-zinc-50 pb-2">
                <Feather name="calendar" size={14} color="#101828" />
                <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Lot Expiry Summary</Text>
              </View>
              <View className="gap-2">
                {creditLots
                  .filter(l => l.remaining_credits > 0)
                  .sort((a, b) => new Date(a.official_expiry_date).getTime() - new Date(b.official_expiry_date).getTime())
                  .map((lot, idx) => (
                    <View key={lot.id || idx} className="flex-row justify-between items-center py-0.5">
                      <Text className="text-zinc-900 text-xs font-bold">{lot.remaining_credits} {lot.remaining_credits === 1 ? 'Credit' : 'Credits'}</Text>
                      <Text className="text-zinc-450 text-[10px] font-bold">Expires {formatToDDMMYYYY(lot.official_expiry_date)}</Text>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Stats metrics rows */}
          <View className="flex-row flex-wrap justify-between gap-y-4">
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
                <View className="flex-row gap-2">
                  <View className="bg-zinc-100 border border-zinc-200/80 px-4.5 py-3 rounded-xl justify-center">
                    <Text className="text-zinc-600 text-xs font-black">+91</Text>
                  </View>
                  <TextInput
                    placeholder="9920827270"
                    placeholderTextColor="#9CA3AF"
                    value={transferPhone}
                    onChangeText={(txt) => {
                      const cleaned = txt.replace(/\D/g, '');
                      if (cleaned.length <= 10) {
                        setTransferPhone(cleaned);
                        setRecipientStatus('idle');
                        setRecipientName('');
                        setIsInviteSent(false);
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={10}
                    className="flex-1 bg-zinc-50 border border-zinc-200/80 px-4 py-3 rounded-xl text-zinc-900 text-xs font-bold"
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleVerifyRecipient}
                    className="bg-indigo-600 px-4 rounded-xl items-center justify-center"
                  >
                    <Text className="text-white text-[10px] font-black uppercase">Verify</Text>
                  </TouchableOpacity>
                </View>

                {/* Recipient status confirmations */}
                {recipientStatus === 'searching' && (
                  <View className="flex-row items-center gap-2 mt-2 ml-1">
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <Text className="text-zinc-500 text-[9px] font-bold">Verifying recipient...</Text>
                  </View>
                )}
                {recipientStatus === 'not_found' && (
                  <View className="mt-2.5 p-3 rounded-xl bg-orange-50 border border-orange-100 flex-row justify-between items-center">
                    <Text className="text-orange-800 text-[9px] font-bold">This person isn&apos;t on Virla yet.</Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleInvite}
                      disabled={isInviteSent}
                      className={`px-3 py-1.5 rounded-lg ${isInviteSent ? 'bg-zinc-300' : 'bg-orange-600'}`}
                    >
                      <Text className="text-white text-[8px] font-black uppercase">
                        {isInviteSent ? 'Invited' : 'Invite to Virla'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {recipientStatus === 'self' && (
                  <Text className="text-red-500 text-[9px] font-bold mt-2 ml-1">
                    You can&apos;t transfer credits to yourself.
                  </Text>
                )}
                {recipientStatus === 'found' && (
                  <View className="flex-row items-center gap-1.5 mt-2.5 ml-1">
                    <Feather name="check-circle" size={11} color="#059669" />
                    <Text className="text-emerald-700 text-[9px] font-black uppercase">
                      Confirming Recipient: {recipientName}
                    </Text>
                  </View>
                )}
              </View>

              <View>
                <Text className="text-zinc-400 text-[8px] font-black uppercase mb-1">Credits Amount</Text>
                <TextInput
                  placeholder="Quantity (e.g. 5)"
                  placeholderTextColor="#9CA3AF"
                  value={transferAmount}
                  onChangeText={setTransferAmount}
                  keyboardType="numeric"
                  editable={recipientStatus === 'found'}
                  className={`bg-zinc-50 border border-zinc-200/80 px-4 py-3 rounded-xl text-zinc-900 text-xs font-bold ${recipientStatus !== 'found' ? 'opacity-50' : ''}`}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleTransfer}
                disabled={recipientStatus !== 'found'}
                className={`w-full py-3.5 rounded-xl items-center justify-center mt-1 ${recipientStatus === 'found' ? 'bg-[#E11D48]' : 'bg-zinc-300'}`}
              >
                <Text className="text-white text-xs font-black uppercase">Transfer Credits</Text>
              </TouchableOpacity>
            </View>
          </View>

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
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{formatToDDMMYYYY(tx.date)}</Text>
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

      {/* Confirmation Modal Overlay */}
      {showConfirmModal && (
        <View 
          className="absolute top-0 left-0 right-0 bottom-0 bg-black/60 items-center justify-center z-50 px-6"
          style={{ position: 'absolute', elevation: 10 }}
        >
          <View className="w-full bg-white rounded-[32px] p-6 border border-[#E5E7EB] gap-5 shadow-2xl">
            <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
              <Feather name="alert-circle" size={18} color="#4F46E5" />
              <Text className="text-[#101828] text-sm font-black uppercase tracking-wider">Transfer Credits?</Text>
            </View>

            <View className="gap-3.5">
              <View className="flex-row justify-between items-center py-1">
                <Text className="text-zinc-450 text-[10px] font-bold uppercase">Recipient</Text>
                <Text className="text-zinc-900 text-xs font-black">{recipientName}</Text>
              </View>
              <View className="flex-row justify-between items-center py-1">
                <Text className="text-zinc-450 text-[10px] font-bold uppercase">Phone Number</Text>
                <Text className="text-zinc-900 text-xs font-bold">+91 {transferPhone}</Text>
              </View>
              <View className="flex-row justify-between items-center py-1">
                <Text className="text-zinc-450 text-[10px] font-bold uppercase">Transfer Amount</Text>
                <Text className="text-[#E11D48] text-xs font-black">{transferAmount} Credits</Text>
              </View>
              <View className="flex-row justify-between items-center py-1">
                <Text className="text-zinc-450 text-[10px] font-bold uppercase">Remaining Balance</Text>
                <Text className="text-zinc-900 text-xs font-black">{creditBalance - parseInt(transferAmount, 10)} Credits</Text>
              </View>
              {renderExpirySection()}
              {isEliteUser && (
                <Text className="text-indigo-800 text-[8px] font-bold uppercase mt-1 leading-relaxed text-center">
                  *Transferred credits preserve premium 7-day grace extension after expiry.
                </Text>
              )}
            </View>

            <View className="flex-row gap-3.5 mt-2">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowConfirmModal(false)}
                className="flex-1 bg-zinc-100 py-3.5 rounded-xl items-center justify-center"
              >
                <Text className="text-zinc-700 text-xs font-black uppercase">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleTransferConfirm}
                className="flex-1 bg-indigo-600 py-3.5 rounded-xl items-center justify-center"
              >
                <Text className="text-white text-xs font-black uppercase">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </View>
  );
}
