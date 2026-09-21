import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Linking, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useWalletStore, LedgerTransaction } from '../store/walletStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useUserStore } from '../store/userStore';
import { Database } from '../database/Database';
import { Ionicons, Feather } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatToDDMMYYYY } from '../utils/date';
import { supabase } from '../database/supabaseClient';
import { t } from '../utils/i18n';

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { creditBalance, lifetimePurchased, creditsUsed, ledger, transferCredits, creditLots } = useWalletStore();
  const { bookings } = useBookingStore();
  const { membership, isExpired } = useMembershipStore();
  const role = useUserStore((state) => state.role);
  const userName = useUserStore((state) => state.user?.name);

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
  const [showAllLots, setShowAllLots] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'booking' | 'purchase' | 'refund'>('all');

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

  // Client-Side Rate Limiting (Spam Prevention: Max 10 invites in 24 hours)
  const checkRateLimit = async (userId: string): Promise<boolean> => {
    try {
      const key = `virla_invite_timestamps_${userId}`;
      const raw = await AsyncStorage.getItem(key);
      const timestamps: number[] = raw ? JSON.parse(raw) : [];
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recent = timestamps.filter(ts => ts > cutoff);
      if (recent.length >= 10) {
        return false;
      }
      recent.push(Date.now());
      await AsyncStorage.setItem(key, JSON.stringify(recent));
      return true;
    } catch {
      return true; // Fail open to avoid blocking legitimate users on storage errors
    }
  };

  // Non-Blocking Audit Logger to public.invitations
  const logInvitationAsync = (userId: string, fullPhone: string) => {
    (async () => {
      try {
        const { error } = await supabase
          .from('invitations')
          .insert({
            id: 'invite-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            sender_id: userId,
            phone: fullPhone
          });
        if (error && error.code !== '23505') {
          console.warn('[Wallet] Non-blocking invite log warning:', error.message);
        } else {
          console.log('[Wallet] Invitation logged successfully for:', fullPhone);
        }
      } catch (err) {
        console.warn('[Wallet] Non-blocking invite log failed:', err);
      }
    })();
  };

  // WhatsApp Deep-Link Launch Handler
  const handleInviteWhatsApp = async () => {
    const cleanDigits = transferPhone.replace(/\D/g, '').slice(-10);
    if (!cleanDigits || cleanDigits.length < 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    const userId = Database.getCurrentUserId() || '';
    const fullPhone = '+91' + cleanDigits;

    // 1. Client-Side Rate Limit Check (Max 10 per 24 hours)
    const allowed = await checkRateLimit(userId);
    if (!allowed) {
      Alert.alert('Limit Reached', t('wallet.rate_limit_exceeded', 'Invite limit reached. You can send up to 10 invites every 24 hours to prevent spam.'));
      return;
    }

    // 2. Non-blocking DB audit log
    logInvitationAsync(userId, fullPhone);
    setIsInviteSent(true);

    // 3. Compose personalized message with UTM & referral tracking
    const sender = userName || 'Your friend';
    const downloadUrl = `https://virla.in/download?utm_source=whatsapp_invite&utm_medium=credit_transfer&ref=${encodeURIComponent(userId)}`;
    const inviteMessage = `Hey! 🏋️\n\n${sender} ${t('wallet.invite_message_body', 'wants to send you workout & wellness session credits on Virla!')}\n\n${t('wallet.invite_message_cta', 'Download the Virla app to claim your credits:')}\n${downloadUrl}`;
    const encodedText = encodeURIComponent(inviteMessage);

    const targetPhone = `91${cleanDigits}`;
    const nativeWhatsAppUrl = `whatsapp://send?phone=${targetPhone}&text=${encodedText}`;
    const webWhatsAppUrl = `https://wa.me/${targetPhone}?text=${encodedText}`;

    // 4. Launch WhatsApp with Universal Fallback
    try {
      const canOpenNative = await Linking.canOpenURL(nativeWhatsAppUrl);
      if (canOpenNative) {
        await Linking.openURL(nativeWhatsAppUrl);
      } else {
        const canOpenWeb = await Linking.canOpenURL(webWhatsAppUrl);
        if (canOpenWeb) {
          await Linking.openURL(webWhatsAppUrl);
        } else {
          await Share.share({ message: inviteMessage });
        }
      }
    } catch (launchErr) {
      console.warn('[Wallet] WhatsApp launch failed, falling back to Share sheet:', launchErr);
      try {
        await Share.share({ message: inviteMessage });
      } catch (shareErr) {
        console.error('[Wallet] Universal share fallback failed:', shareErr);
      }
    }
  };

  // Secondary Share / More Options Handler
  const handleShareMoreOptions = async () => {
    const cleanDigits = transferPhone.replace(/\D/g, '').slice(-10);
    const userId = Database.getCurrentUserId() || '';
    const fullPhone = '+91' + cleanDigits;

    // Non-blocking log
    logInvitationAsync(userId, fullPhone);
    setIsInviteSent(true);

    const sender = userName || 'Your friend';
    const downloadUrl = `https://virla.in/download?utm_source=whatsapp_invite&utm_medium=credit_transfer&ref=${encodeURIComponent(userId)}`;
    const inviteMessage = `Hey! 🏋️\n\n${sender} ${t('wallet.invite_message_body', 'wants to send you workout & wellness session credits on Virla!')}\n\n${t('wallet.invite_message_cta', 'Download the Virla app to claim your credits:')}\n${downloadUrl}`;

    try {
      await Share.share({ message: inviteMessage });
    } catch (err) {
      console.warn('[Wallet] Share sheet failed:', err);
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
          <Text className="text-zinc-500 text-[11px] font-bold uppercase">Original Expiry</Text>
          <Text className="text-zinc-900 text-xs font-black">{formatToDDMMYYYY(breakdown[0].official_expiry_date)}</Text>
        </View>
      );
    }

    return (
      <View className="pt-3.5 gap-2">
        <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-1">Credit Expiry Breakdown</Text>
        {breakdown.map((item, idx) => (
          <View key={idx} className="flex-row justify-between items-center py-0.5">
            <Text className="text-zinc-800 text-xs font-bold">{item.amount} {item.amount === 1 ? 'Credit' : 'Credits'}</Text>
            <Text className="text-zinc-500 text-[11px] font-bold">Expires {formatToDDMMYYYY(item.official_expiry_date)}</Text>
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

  const isEliteUser = Boolean(membership.renewalDate && Database.getProfile(Database.getCurrentUserId() || '')?.membershipStatus === 'Elite');
  const approachingLots = getLotsApproachingExpiry();
  
  const upcomingCount = useMemo(() => {
    if (!Array.isArray(bookings)) return 0;
    return bookings.filter(b => b && b.status === 'upcoming').length;
  }, [bookings]);

  const handleUpcomingBookingsPress = () => {
    try {
      if (typeof router.navigate === 'function') {
        router.navigate('/(tabs)/bookings' as any);
      } else {
        router.push('/(tabs)/bookings' as any);
      }
    } catch (err) {
      console.warn('[Wallet] Navigation to bookings tab failed, trying fallback:', err);
      try {
        router.push('/bookings' as any);
      } catch (fallbackErr) {
        console.error('[Wallet] Fallback navigation failed:', fallbackErr);
      }
    }
  };

  const activeLots = useMemo(() => {
    if (!Array.isArray(creditLots)) return [];
    return creditLots
      .filter(l => l && l.remaining_credits > 0)
      .sort((a, b) => new Date(a.official_expiry_date).getTime() - new Date(b.official_expiry_date).getTime());
  }, [creditLots]);

  const sevenDaysFromNow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const visibleLots = showAllLots ? activeLots : activeLots.slice(0, 3);

  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'all') return ledger;
    return ledger.filter(tx => tx.type === ledgerFilter);
  }, [ledger, ledgerFilter]);

  const getLedgerIcon = (type: LedgerTransaction['type']) => {
    switch (type) {
      case 'purchase':
        return { icon: 'credit-card', color: '#10B981', bg: 'bg-emerald-50' };
      case 'booking':
        return { icon: 'check-circle', color: '#E11D48', bg: 'bg-rose-50' };
      case 'refund':
        return { icon: 'rotate-ccw', color: '#3B82F6', bg: 'bg-blue-50' };
      case 'penalty':
        return { icon: 'alert-triangle', color: '#EF4444', bg: 'bg-red-50' };
      default:
        return { icon: 'gift', color: '#8B5CF6', bg: 'bg-purple-50' };
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
      {/* Standardized Virla Screen Header */}
      <ScreenHeader
        title="Credit Wallet"
        category="VIRLA CONCIERGE"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/profile');
          }
        }}
        rightElement={
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/payment-history' as any)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100"
          >
            <Feather name="file-text" size={13} color="#101828" />
            <Text className="text-[#101828] text-[11px] font-black uppercase tracking-wider">Invoices</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: Math.max((insets.bottom || 0) + 40, 100) }}>
        <View className="gap-5">

          {/* Consolidated Prioritized Warning Banner */}
          {isExpired() ? (
            <View className="bg-rose-50 p-4 rounded-2xl flex-row items-center gap-3 shadow-xs">
              <View className="w-9 h-9 rounded-xl bg-rose-100 items-center justify-center">
                <Feather name="alert-triangle" size={18} color="#E11D48" />
              </View>
              <View className="flex-1">
                <Text className="text-rose-900 text-xs font-black uppercase tracking-wider">Wallet Expired</Text>
                <Text className="text-rose-700 text-xs font-medium mt-0.5">Recharge to reactivate session check-ins.</Text>
              </View>
              {role !== 'trainer' && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push('/membership' as any)}
                  className="bg-[#E11D48] px-3.5 py-2 rounded-xl"
                >
                  <Text className="text-white text-[10px] font-black uppercase">Recharge</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : role !== 'trainer' && creditBalance === 0 ? (
            <View className="bg-rose-50 p-4 rounded-2xl flex-row items-center gap-3 shadow-xs">
              <View className="w-9 h-9 rounded-xl bg-rose-100 items-center justify-center">
                <Feather name="alert-circle" size={18} color="#E11D48" />
              </View>
              <View className="flex-1">
                <Text className="text-rose-900 text-xs font-black uppercase tracking-wider">Out of Credits</Text>
                <Text className="text-rose-700 text-xs font-medium mt-0.5">Recharge your wallet to book workout sessions.</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/membership' as any)}
                className="bg-[#E11D48] px-3.5 py-2 rounded-xl shadow-xs"
              >
                <Text className="text-white text-[10px] font-black uppercase">Recharge</Text>
              </TouchableOpacity>
            </View>
          ) : role !== 'trainer' && creditBalance <= 2 ? (
            <View className="bg-amber-50 p-4 rounded-2xl flex-row items-center gap-3 shadow-xs">
              <View className="w-9 h-9 rounded-xl bg-amber-100 items-center justify-center">
                <Feather name="zap" size={18} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-amber-900 text-xs font-black uppercase tracking-wider">Running Low on Credits</Text>
                <Text className="text-amber-700 text-xs font-medium mt-0.5">{creditBalance} {creditBalance === 1 ? 'credit' : 'credits'} left. Top up to keep training.</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/membership' as any)}
                className="bg-amber-600 px-3.5 py-2 rounded-xl"
              >
                <Text className="text-white text-[10px] font-black uppercase">Top Up</Text>
              </TouchableOpacity>
            </View>
          ) : isEliteUser && approachingLots.length > 0 ? (
            <View className="bg-indigo-50 p-4 rounded-2xl gap-2 shadow-xs">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Feather name="shield" size={16} color="#4F46E5" />
                  <Text className="text-indigo-900 text-xs font-black uppercase tracking-wider">Elite Member Benefit</Text>
                </View>
                <View className="bg-indigo-100 px-2 py-0.5 rounded-md">
                  <Text className="text-indigo-800 text-[10px] font-black uppercase">+7 Days Grace</Text>
                </View>
              </View>
              <Text className="text-indigo-800 text-xs font-medium leading-relaxed">
                Your credits expiring on {formatToDDMMYYYY(approachingLots[0].official_expiry_date)} have an active 7-day grace extension until {formatToDDMMYYYY(approachingLots[0].grace_expiry_date)}.
              </Text>
            </View>
          ) : role === 'trainer' ? (
            <View className="bg-zinc-100 p-4 rounded-2xl flex-row items-center gap-3">
              <Feather name="info" size={16} color="#3F3F46" />
              <View className="flex-1">
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">Transfer-Only Wallet</Text>
                <Text className="text-zinc-600 text-xs font-medium mt-0.5">As a trainer, you can receive and transfer credits, but cannot self-book sessions.</Text>
              </View>
            </View>
          ) : null}

          {/* Luxury Apple Wallet Pass Card */}
          <View className="bg-white rounded-[28px] p-6 border border-[#E5E7EB] shadow-sm gap-5">
            <View className="flex-row justify-between items-start">
              <View>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="sparkles" size={12} color="#F43F5E" />
                  <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">VIRLA ACCESS PASS</Text>
                </View>
                <Text className="text-zinc-900 text-base font-black tracking-tight mt-1">Universal Session Pass</Text>
              </View>
              <View className="bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-full">
                <Text className="text-zinc-700 text-[10px] font-black uppercase tracking-wider">
                  {isEliteUser ? '★ ELITE' : 'ACTIVE'}
                </Text>
              </View>
            </View>

            <View className="my-1">
              <View className="flex-row items-baseline gap-2">
                <Text className="text-zinc-900 text-4xl font-black tracking-tight">{creditBalance}</Text>
                <Text className="text-zinc-400 text-base font-bold uppercase tracking-wider">Credits</Text>
              </View>
              <Text className="text-zinc-400 text-[11px] font-medium mt-1">Available for personal training & wellness sessions</Text>
            </View>

            <View className="flex-row justify-between items-center border-t border-zinc-100 pt-4">
              <View>
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">Pass Holder</Text>
                <Text className="text-zinc-900 text-xs font-black mt-0.5">{userName || 'Virla Member'}</Text>
              </View>
              <View className="items-end">
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">Plan Expiry</Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Text className="text-zinc-900 text-xs font-black">{membership.renewalDate || 'No Expiry'}</Text>
                  {isExpired() && (
                    <View className="bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                      <Text className="text-red-600 text-[9px] font-black uppercase">Expired</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons Right Below Card */}
          <View className="flex-row gap-3">
            {role !== 'trainer' && (
              <TouchableOpacity 
                activeOpacity={0.85}
                onPress={() => router.push('/membership' as any)}
                className="flex-1 bg-[#E11D48] py-3.5 px-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm"
              >
                <Feather name="plus-circle" size={15} color="white" />
                <Text className="text-white text-xs font-black uppercase tracking-wider">Recharge Wallet</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Metrics Grid */}
          <View className="gap-3">
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white p-4 rounded-2xl shadow-xs">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Lifetime Bought</Text>
                  <Feather name="arrow-up-right" size={13} color="#10B981" />
                </View>
                <Text className="text-zinc-900 text-base font-black tracking-tight">{lifetimePurchased} <Text className="text-xs font-bold text-zinc-400">Credits</Text></Text>
              </View>

              <View className="flex-1 bg-white p-4 rounded-2xl shadow-xs">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Credits Consumed</Text>
                  <Feather name="activity" size={13} color="#6366F1" />
                </View>
                <Text className="text-zinc-900 text-base font-black tracking-tight">{creditsUsed} <Text className="text-xs font-bold text-zinc-400">Credits</Text></Text>
              </View>
            </View>

            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={handleUpcomingBookingsPress}
              className="bg-white p-4 rounded-2xl shadow-xs flex-row justify-between items-center"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center">
                  <Feather name="calendar" size={16} color="#4F46E5" />
                </View>
                <View>
                  <Text className="text-zinc-900 text-xs font-black uppercase tracking-wider">Upcoming Bookings</Text>
                  <Text className="text-zinc-500 text-[11px] font-medium mt-0.5">View your scheduled sessions</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[#4F46E5] text-xs font-black">{upcomingCount} active</Text>
                <Feather name="chevron-right" size={16} color="#4F46E5" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Credit Lot Expiry Summary */}
          {activeLots.length > 0 && (
            <View className="bg-white p-5 rounded-2xl shadow-xs gap-3">
              <View className="flex-row items-center justify-between pb-3">
                <View className="flex-row items-center gap-2">
                  <Feather name="clock" size={15} color="#101828" />
                  <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Lot Expiry Breakdown</Text>
                </View>
                <Text className="text-zinc-400 text-[10px] font-black uppercase">{activeLots.length} {activeLots.length === 1 ? 'Lot' : 'Lots'}</Text>
              </View>

              <View className="gap-2.5">
                {visibleLots.map((lot, idx) => {
                  const expDate = new Date(lot.official_expiry_date);
                  const isExpiringSoon = expDate <= sevenDaysFromNow;
                  return (
                    <View key={lot.id || idx} className="flex-row justify-between items-center py-1">
                      <View className="flex-row items-center gap-2.5">
                        <View className={`w-2 h-2 rounded-full ${isExpiringSoon ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <Text className="text-zinc-900 text-xs font-bold">
                          {lot.remaining_credits} {lot.remaining_credits === 1 ? 'Credit' : 'Credits'}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className={`text-[11px] font-bold ${isExpiringSoon ? 'text-amber-700' : 'text-zinc-500'}`}>
                          Expires {formatToDDMMYYYY(lot.official_expiry_date)}
                        </Text>
                        {isExpiringSoon && (
                          <Text className="text-amber-600 text-[9px] font-black uppercase">Expiring soon</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {activeLots.length > 3 && (
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => setShowAllLots(!showAllLots)}
                  className="pt-2 items-center justify-center"
                >
                  <Text className="text-zinc-600 text-[11px] font-black uppercase tracking-wider">
                    {showAllLots ? 'Show Less' : `View All ${activeLots.length} Lots`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Transfer Credits Section */}
          <View className="bg-white p-5 rounded-2xl shadow-xs gap-4">
            <View className="flex-row items-center gap-2 pb-3">
              <Feather name="send" size={16} color="#101828" />
              <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Transfer Credits</Text>
            </View>
            
            <Text className="text-zinc-500 text-xs font-medium leading-relaxed">
              Instantly share session credits with friends or family on Virla.
            </Text>

            <View className="gap-3.5">
              <View>
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-1.5">Recipient Phone Number</Text>
                <View className="flex-row gap-2">
                  <View className="bg-zinc-100 px-3.5 py-3 rounded-xl justify-center">
                    <Text className="text-zinc-700 text-xs font-black">+91</Text>
                  </View>
                  <TextInput
                    placeholder="10-digit mobile number"
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
                    className="flex-1 bg-zinc-50 px-4 py-3 rounded-xl text-zinc-900 text-xs font-bold"
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleVerifyRecipient}
                    className="bg-zinc-900 px-4 rounded-xl items-center justify-center"
                  >
                    <Text className="text-white text-[11px] font-black uppercase tracking-wider">Verify</Text>
                  </TouchableOpacity>
                </View>

                {/* Recipient status confirmations */}
                {recipientStatus === 'searching' && (
                  <View className="flex-row items-center gap-2 mt-2.5 ml-1">
                    <ActivityIndicator size="small" color="#101828" />
                    <Text className="text-zinc-500 text-[11px] font-bold">Verifying recipient...</Text>
                  </View>
                )}
                {recipientStatus === 'not_found' && (
                  <View className="mt-3 p-3.5 rounded-2xl bg-zinc-50 gap-3">
                    <View className="flex-row items-center gap-2">
                      <Feather name="info" size={15} color="#D97706" />
                      <Text className="text-zinc-800 text-xs font-bold">
                        {t('wallet.recipient_not_found', "This person isn't on Virla yet.")}
                      </Text>
                    </View>

                    <View className="flex-row gap-2">
                      {/* Branded WhatsApp Invite Button */}
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleInviteWhatsApp}
                        className={`flex-1 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-2 shadow-xs ${
                          isInviteSent ? 'bg-emerald-700' : 'bg-[#25D366]'
                        }`}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="white" />
                        <Text className="text-white text-[11px] font-black uppercase tracking-wider">
                          {isInviteSent ? t('wallet.invited_whatsapp', 'Invited on WhatsApp ✓') : t('wallet.invite_whatsapp', 'Invite via WhatsApp')}
                        </Text>
                      </TouchableOpacity>

                      {/* Secondary More Options / Share Button */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleShareMoreOptions}
                        className="bg-white py-2.5 px-3 rounded-xl items-center justify-center flex-row gap-1.5 shadow-2xs"
                      >
                        <Feather name="share-2" size={13} color="#374151" />
                        <Text className="text-zinc-700 text-[11px] font-bold">
                          {t('wallet.more_options', 'More')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {recipientStatus === 'self' && (
                  <Text className="text-red-500 text-[11px] font-bold mt-2 ml-1">
                    You cannot transfer credits to yourself.
                  </Text>
                )}
                {recipientStatus === 'found' && (
                  <View className="flex-row items-center gap-1.5 mt-2.5 ml-1">
                    <Feather name="check-circle" size={13} color="#059669" />
                    <Text className="text-emerald-700 text-[11px] font-black uppercase">
                      Recipient Confirmed: {recipientName}
                    </Text>
                  </View>
                )}
              </View>

              <View>
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-1.5">Credits Amount</Text>
                <TextInput
                  placeholder="Number of credits to transfer"
                  placeholderTextColor="#9CA3AF"
                  value={transferAmount}
                  onChangeText={setTransferAmount}
                  keyboardType="numeric"
                  editable={recipientStatus === 'found'}
                  className={`bg-zinc-50 px-4 py-3 rounded-xl text-zinc-900 text-xs font-bold ${recipientStatus !== 'found' ? 'opacity-50' : ''}`}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleTransfer}
                disabled={recipientStatus !== 'found'}
                className={`w-full py-3.5 rounded-xl items-center justify-center mt-1 shadow-xs ${recipientStatus === 'found' ? 'bg-[#E11D48]' : 'bg-zinc-200'}`}
              >
                <Text className={`text-xs font-black uppercase tracking-wider ${recipientStatus === 'found' ? 'text-white' : 'text-zinc-400'}`}>
                  Transfer Credits
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Wallet Transaction Ledger */}
          <View className="bg-white p-5 rounded-2xl shadow-xs gap-4">
            <View className="flex-row items-center justify-between pb-3">
              <View className="flex-row items-center gap-2">
                <Feather name="list" size={15} color="#101828" />
                <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Transaction Ledger</Text>
              </View>
              <Text className="text-zinc-400 text-[10px] font-black uppercase">{ledger.length} Total</Text>
            </View>

            {/* Filter Chips */}
            <View className="flex-row gap-2">
              {(['all', 'booking', 'purchase', 'refund'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  activeOpacity={0.7}
                  onPress={() => setLedgerFilter(filter)}
                   className={`px-3 py-1.5 rounded-full ${
                    ledgerFilter === filter
                      ? 'bg-zinc-900'
                      : 'bg-zinc-50'
                  }`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${
                    ledgerFilter === filter ? 'text-white' : 'text-zinc-600'
                  }`}>
                    {filter === 'all' ? 'All' : filter === 'booking' ? 'Sessions' : filter === 'purchase' ? 'Purchases' : 'Refunds'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View className="gap-3 mt-1">
              {filteredLedger.length === 0 ? (
                <View className="py-6 items-center justify-center gap-1">
                  <Feather name="inbox" size={24} color="#D1D5DB" />
                  <Text className="text-zinc-400 text-xs font-bold uppercase mt-1">No transactions found</Text>
                </View>
              ) : (
                filteredLedger.map((tx) => {
                  const isAdd = tx.change >= 0;
                  const iconInfo = getLedgerIcon(tx.type);
                  return (
                    <View key={tx.id} className="flex-row justify-between items-center py-2">
                      <View className="flex-row items-center gap-3 flex-1 pr-3">
                        <View className={`w-8 h-8 rounded-xl ${iconInfo.bg} items-center justify-center`}>
                          <Feather name={iconInfo.icon as any} size={14} color={iconInfo.color} />
                        </View>
                        <View className="flex-1 gap-0.5">
                          <Text className="text-zinc-900 text-xs font-black leading-tight">{tx.title}</Text>
                          <Text className="text-zinc-400 text-[10px] font-bold uppercase mt-0.5">{formatToDDMMYYYY(tx.date)}</Text>
                        </View>
                      </View>
                      <View className="items-end gap-1">
                        <Text className={`text-xs font-black ${isAdd ? 'text-emerald-600' : 'text-zinc-900'}`}>
                          {isAdd ? '+' : ''}{tx.change} {Math.abs(tx.change) === 1 ? 'Credit' : 'Credits'}
                        </Text>
                        
                        {/* Type Badge */}
                        <View className="px-2 py-0.5 rounded-md bg-zinc-100">
                          <Text className="text-[8px] font-black uppercase text-zinc-600">
                            {tx.type}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
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
          <View className="w-full bg-white rounded-[28px] p-6 gap-5 shadow-2xl">
            <View className="flex-row items-center gap-2.5 pb-3">
              <Feather name="alert-circle" size={18} color="#E11D48" />
              <Text className="text-[#101828] text-sm font-black uppercase tracking-wider">Transfer Credits?</Text>
            </View>

            <View className="gap-3.5">
              <View className="flex-row justify-between items-center py-1">
                <Text className="text-zinc-500 text-[11px] font-bold uppercase">Recipient</Text>
                <Text className="text-zinc-900 text-xs font-black">{recipientName}</Text>
              </View>
              <View className="flex-row justify-between items-center py-1">
                <Text className="text-zinc-500 text-[11px] font-bold uppercase">Phone Number</Text>
                <Text className="text-zinc-900 text-xs font-bold">+91 {transferPhone}</Text>
              </View>
              <View className="flex-row justify-between items-center py-1">
                <Text className="text-zinc-500 text-[11px] font-bold uppercase">Transfer Amount</Text>
                <Text className="text-[#E11D48] text-xs font-black">{transferAmount} Credits</Text>
              </View>
              <View className="flex-row justify-between items-center py-1">
                <Text className="text-zinc-500 text-[11px] font-bold uppercase">Remaining Balance</Text>
                <Text className="text-zinc-900 text-xs font-black">{creditBalance - parseInt(transferAmount, 10)} Credits</Text>
              </View>
              {renderExpirySection()}
              {isEliteUser && (
                <Text className="text-indigo-800 text-[9px] font-bold uppercase mt-1 leading-relaxed text-center">
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
                className="flex-1 bg-[#E11D48] py-3.5 rounded-xl items-center justify-center shadow-xs"
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

