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
import Svg, { Circle } from 'react-native-svg';
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
  const activeLots = useMemo(() => {
    if (!creditLots) return [];
    return creditLots.filter((l) => l.remaining_credits > 0);
  }, [creditLots]);

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

  const [activeTab, setActiveTab] = useState<'lots' | 'transfer' | 'ledger'>('lots');
  const [dismissPriorityNotice, setDismissPriorityNotice] = useState(false);
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
      <View className="border-t border-zinc-100 pt-3.5 gap-2">
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

  const consumptionRate = useMemo(() => {
    if (!lifetimePurchased || lifetimePurchased <= 0) return '0.0';
    return ((creditsUsed / lifetimePurchased) * 100).toFixed(1);
  }, [lifetimePurchased, creditsUsed]);

  const nextRitual = useMemo(() => {
    if (!Array.isArray(bookings)) return null;
    return bookings
      .filter(b => b && b.status === 'upcoming')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null;
  }, [bookings]);

  const burningDaysLeft = useMemo(() => {
    if (!activeLots[0]) return 6;
    const diff = new Date(activeLots[0].official_expiry_date).getTime() - Date.now();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [activeLots]);

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
    <View style={{ flex: 1, backgroundColor: '#F5F7FB' }}>
      {/* Top Header */}
      <View 
        style={{ paddingTop: Math.max(insets.top, 14) }} 
        className="px-5 pb-3 bg-[#F5F7FB]"
      >
        <View className="flex-row items-center justify-between relative h-10">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/profile');
              }
            }}
            className="w-9 h-9 items-center justify-center z-10"
          >
            <Ionicons name="chevron-back" size={24} color="#101828" />
          </TouchableOpacity>

          {/* Centered Large Header Title */}
          <View pointerEvents="none" className="absolute left-0 right-0 top-0 bottom-0 items-center justify-center">
            <Text className="text-zinc-950 text-lg font-black tracking-tight">Credit Wallet</Text>
          </View>

          {/* Invoices button commented out
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/payment-history' as any)}
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-zinc-200/80 shadow-2xs z-10"
          >
            <Feather name="file-text" size={13} color="#E11D48" />
            <Text className="text-[#101828] text-xs font-bold">Invoices</Text>
          </TouchableOpacity>
          */}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-5 pt-2" contentContainerStyle={{ paddingBottom: Math.max((insets.bottom || 0) + 40, 110) }}>
        <View className="gap-4">

          {/* Dynamic Notice Banner */}
          {!dismissPriorityNotice && (
            isExpired() ? (
              <View className="bg-red-50 p-3.5 rounded-2xl flex-row items-center justify-between border border-red-100 shadow-2xs">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-9 h-9 rounded-full bg-red-100 items-center justify-center">
                    <Feather name="alert-triangle" size={16} color="#EF4444" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-red-800 text-[9px] font-black uppercase tracking-wider">Wallet Expired ⚠️</Text>
                    <Text className="text-red-700 text-xs font-medium mt-0.5">Please recharge to reactivate session check-ins.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push('/membership' as any)}
                  className="bg-[#E11D48] px-3.5 py-1.5 rounded-full shadow-2xs"
                >
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider">RECHARGE</Text>
                </TouchableOpacity>
              </View>
            ) : role !== 'trainer' && creditBalance === 0 ? (
              <View className="bg-rose-50 p-3.5 rounded-2xl flex-row items-center justify-between border border-rose-100 shadow-2xs">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-9 h-9 rounded-full bg-rose-100 items-center justify-center">
                    <Feather name="alert-circle" size={16} color="#E11D48" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-wider">You&apos;re out of credits ⚠️</Text>
                    <Text className="text-rose-700 text-xs font-medium mt-0.5">Recharge your wallet to book wellness sessions.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push('/membership' as any)}
                  className="bg-[#E11D48] px-3.5 py-1.5 rounded-full shadow-2xs"
                >
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider">RECHARGE</Text>
                </TouchableOpacity>
              </View>
            ) : role !== 'trainer' && creditBalance <= 2 ? (
              <View className="bg-amber-50 p-3.5 rounded-2xl flex-row items-center justify-between border border-amber-100 shadow-2xs">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-9 h-9 rounded-full bg-amber-100 items-center justify-center">
                    <Feather name="zap" size={16} color="#D97706" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-amber-800 text-[9px] font-black uppercase tracking-wider">Running low on credits ⚡</Text>
                    <Text className="text-amber-700 text-xs font-medium mt-0.5">Recharge your wallet to keep training.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push('/membership' as any)}
                  className="bg-[#E11D48] px-3.5 py-1.5 rounded-full shadow-2xs"
                >
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider">RECHARGE</Text>
                </TouchableOpacity>
              </View>
            ) : approachingLots.length > 0 ? (
              <View className="bg-[#EEF4FF] p-3.5 rounded-2xl flex-row items-center justify-between border border-blue-100/60 shadow-2xs">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-9 h-9 rounded-full bg-[#FFE4E6] items-center justify-center">
                    <Ionicons name="hourglass-outline" size={16} color="#E11D48" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-wider">
                      Expiring Soon ⚠️ • Lot #{activeLots[0]?.id?.slice(-3) || '1'}
                    </Text>
                    <Text className="text-zinc-800 text-xs font-bold mt-0.5" numberOfLines={1}>
                      {approachingLots.length} lot(s) expiring in {burningDaysLeft} days ({activeLots[0] ? formatToDDMMYYYY(activeLots[0].official_expiry_date) : ''})
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/membership' as any)}
                    className="bg-[#E11D48] px-3.5 py-1.5 rounded-full shadow-2xs"
                  >
                    <Text className="text-white text-[10px] font-black uppercase tracking-wider">EXTEND</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    onPress={() => setDismissPriorityNotice(true)}
                    className="p-1"
                  >
                    <Feather name="x" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          )}

          {/* Universal Session Pass Card */}
          <View className="bg-white rounded-[32px] p-6 shadow-sm border border-zinc-100/80 items-center gap-3">
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />
              <Text className="text-zinc-700 text-[10px] font-black uppercase tracking-widest">UNIVERSAL SESSION PASS</Text>
              <View className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />
            </View>

            {/* Circular Gauge */}
            <View className="relative w-[180px] h-[180px] items-center justify-center my-1">
              <Svg width={180} height={180} viewBox="0 0 180 180">
                {/* Background Ring */}
                <Circle
                  cx="90"
                  cy="90"
                  r="72"
                  stroke="#E2EDFD"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Active Crimson Arc */}
                <Circle
                  cx="90"
                  cy="90"
                  r="72"
                  stroke="#E11D48"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${0.58 * 452.4} ${452.4}`}
                  strokeLinecap="round"
                  transform="rotate(-65 90 90)"
                />
                {/* Left Indicator Dot */}
                <Circle
                  cx="18"
                  cy="90"
                  r="6.5"
                  fill="#E11D48"
                />
              </Svg>

              <View className="absolute inset-0 items-center justify-center">
                <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">AVAILABLE BALANCE</Text>
                <Text className="text-zinc-950 text-4xl font-black tracking-tight my-0.5">
                  {creditBalance}<Text className="text-[#E11D48]">.</Text>
                </Text>
                <Text className="text-zinc-700 text-[10px] font-bold uppercase tracking-wider">AVAILABLE CREDITS</Text>
              </View>
            </View>

            {/* Valid Badge & Card Holder */}
            <View className="items-center gap-1">
              <View className="bg-[#F0F4FA] border border-blue-100/60 px-3.5 py-1 rounded-full flex-row items-center gap-1.5">
                <Feather name="shield" size={12} color="#E11D48" />
                <Text className="text-zinc-800 text-xs font-bold">Valid until {membership.renewalDate || '14 Sep 2027'}</Text>
              </View>
              <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                CARD HOLDER: {userName ? userName.toUpperCase() : 'VIRAL'}
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 w-full mt-2">
              {role !== 'trainer' && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/membership' as any)}
                  className="flex-1 bg-black py-3.5 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm"
                >
                  <Feather name="plus-circle" size={16} color="white" />
                  <Text className="text-white text-xs font-black uppercase tracking-wider">Recharge Wallet</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setActiveTab('transfer')}
                className="flex-1 bg-black py-3.5 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm"
              >
                <Feather name="send" size={15} color="white" />
                <Text className="text-white text-xs font-black uppercase tracking-wider">Transfer Credits</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Stats 3-Column Card */}
          <View className="bg-white rounded-2xl p-4 shadow-xs border border-zinc-100/80 flex-row justify-between items-center">
            <View className="flex-1 items-center">
              <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">PURCHASED</Text>
              <Text className="text-zinc-950 text-2xl font-bold mt-0.5">{lifetimePurchased}</Text>
              <Text className="text-zinc-400 text-xs font-medium mt-0.5">Lifetime</Text>
            </View>

            <View className="w-[1px] h-9 bg-zinc-100" />

            <View className="flex-1 items-center">
              <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">CONSUMED</Text>
              <Text className="text-zinc-950 text-2xl font-bold mt-0.5">{creditsUsed}</Text>
              <Text className="text-[#E11D48] text-xs font-semibold mt-0.5">{consumptionRate}% Rate</Text>
            </View>

            <View className="w-[1px] h-9 bg-zinc-100" />

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleUpcomingBookingsPress}
              className="flex-1 items-center"
            >
              <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">NEXT SESSION</Text>
              <Text className="text-zinc-950 text-[13px] font-bold mt-1" numberOfLines={1}>
                {nextRitual ? formatToDDMMYYYY(nextRitual.date) : 'No Sessions'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Line Tab Switch */}
          <View className="flex-row border-b border-zinc-200 mt-3 mb-1">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveTab('lots')}
              className={`flex-1 py-3 items-center justify-center border-b-2 ${
                activeTab === 'lots' ? 'border-zinc-950 -mb-[1px]' : 'border-transparent'
              }`}
            >
              <Text 
                numberOfLines={1}
                className={`text-xs font-bold uppercase tracking-wide ${
                  activeTab === 'lots' ? 'text-zinc-950' : 'text-zinc-400'
                }`}
              >
                CREDIT LOTS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveTab('transfer')}
              className={`flex-[1.1] py-3 items-center justify-center border-b-2 ${
                activeTab === 'transfer' ? 'border-zinc-950 -mb-[1px]' : 'border-transparent'
              }`}
            >
              <Text 
                numberOfLines={1}
                className={`text-xs font-bold uppercase tracking-wide ${
                  activeTab === 'transfer' ? 'text-zinc-950' : 'text-zinc-400'
                }`}
              >
                TRANSFER CREDITS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveTab('ledger')}
              className={`flex-[1.3] py-3 items-center justify-center border-b-2 ${
                activeTab === 'ledger' ? 'border-zinc-950 -mb-[1px]' : 'border-transparent'
              }`}
            >
              <Text 
                numberOfLines={1}
                className={`text-xs font-bold uppercase tracking-wide ${
                  activeTab === 'ledger' ? 'text-zinc-950' : 'text-zinc-400'
                }`}
              >
                TRANSACTION LEDGER
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab 1: Credit Lots */}
          {activeTab === 'lots' && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-zinc-950 text-sm font-black tracking-tight">Credit Expiry Breakdown</Text>
                  <Text className="text-zinc-500 text-[11px] font-medium mt-0.5">Credits consume strictly in chronological order</Text>
                </View>
                <View className="bg-[#FEE2E2] px-2.5 py-1 rounded-full">
                  <Text className="text-[#E11D48] text-[9px] font-black uppercase tracking-wider">
                    {activeLots.length} ACTIVE LOTS
                  </Text>
                </View>
              </View>

              {/* 3-Queue Visual Card */}
              <View className="bg-white rounded-[28px] p-5 shadow-xs border border-zinc-100/80 relative">
                {/* Connecting horizontal line */}
                <View 
                  className="absolute h-[2px] bg-[#E11D48]" 
                  style={{ top: 40, left: '16.6%', width: '33.4%' }} 
                  pointerEvents="none" 
                />
                <View 
                  className="absolute h-[2px] bg-[#DBEAFE]" 
                  style={{ top: 40, left: '50%', width: '33.4%' }} 
                  pointerEvents="none" 
                />

                <View className="flex-row justify-between items-start">
                  {/* Node 1: Burning Now */}
                  <View className="items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-[#E11D48] items-center justify-center shadow-xs">
                      <Text className="text-white text-sm font-black">
                        {activeLots[0]?.remaining_credits || 0}
                      </Text>
                    </View>
                    <Text className="text-[#E11D48] text-[9px] font-black uppercase mt-2">EXPIRING SOON</Text>
                    <Text className="text-zinc-900 text-xs font-black mt-0.5">
                      Lot #{activeLots[0]?.id?.slice(-3) || '1'}
                    </Text>
                    <Text className="text-[#E11D48] text-[10px] font-black mt-0.5">{burningDaysLeft}d left</Text>
                    <Text className="text-zinc-400 text-[9px] font-medium mt-0.5">
                      Exp: {activeLots[0] ? formatToDDMMYYYY(activeLots[0].official_expiry_date) : '-'}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => router.push('/membership' as any)}
                      className="mt-2.5 bg-[#E11D48] px-3.5 py-1.5 rounded-full items-center justify-center shadow-xs"
                    >
                      <Text className="text-white text-[10px] font-black uppercase tracking-wider">EXTEND</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Node 2: Next in Line */}
                  <View className="items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-[#E0EDFD] items-center justify-center">
                      <Text className="text-[#1E293B] text-sm font-black">
                        {activeLots[1]?.remaining_credits || 0}
                      </Text>
                    </View>
                    <Text className="text-zinc-500 text-[9px] font-black uppercase mt-2">NEXT IN LINE</Text>
                    <Text className="text-zinc-900 text-xs font-black mt-0.5">
                      Lot #{activeLots[1]?.id?.slice(-3) || '2'}
                    </Text>
                    <Text className="text-zinc-700 text-[10px] font-bold mt-0.5">Safe</Text>
                    <Text className="text-zinc-400 text-[9px] font-medium mt-0.5">
                      Exp: {activeLots[1] ? formatToDDMMYYYY(activeLots[1].official_expiry_date) : '-'}
                    </Text>
                    <Text className="text-zinc-400 text-[8px] font-black uppercase mt-1.5 tracking-wider">QUEUE 02</Text>
                  </View>

                  {/* Node 3: Dormant */}
                  <View className="items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-[#E0EDFD] items-center justify-center">
                      <Text className="text-[#1E293B] text-sm font-black">
                        {activeLots[2]?.remaining_credits || 0}
                      </Text>
                    </View>
                    <Text className="text-zinc-500 text-[9px] font-black uppercase mt-2">RESERVE</Text>
                    <Text className="text-zinc-900 text-xs font-black mt-0.5">
                      Lot #{activeLots[2]?.id?.slice(-3) || '3'}
                    </Text>
                    <Text className="text-zinc-700 text-[10px] font-bold mt-0.5">Safe</Text>
                    <Text className="text-zinc-400 text-[9px] font-medium mt-0.5">
                      Exp: {activeLots[2] ? formatToDDMMYYYY(activeLots[2].official_expiry_date) : '-'}
                    </Text>
                    <Text className="text-zinc-400 text-[8px] font-black uppercase mt-1.5 tracking-wider">QUEUE 03</Text>
                  </View>
                </View>

                {/* Optional Expand Lots */}
                {activeLots.length > 3 && (
                  <View className="mt-4 pt-3 border-t border-zinc-100">
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowAllLots(!showAllLots)}
                      className="items-center justify-center"
                    >
                      <Text className="text-zinc-600 text-[11px] font-black uppercase tracking-wider">
                        {showAllLots ? 'Show Less' : `View All ${activeLots.length} Lots`}
                      </Text>
                    </TouchableOpacity>

                    {showAllLots && (
                      <View className="gap-2 mt-3">
                        {activeLots.slice(3).map((lot: any, idx: number) => (
                          <View key={lot.id || idx} className="flex-row justify-between items-center py-1">
                            <Text className="text-zinc-900 text-xs font-bold">{lot.remaining_credits} Credits</Text>
                            <Text className="text-zinc-500 text-[11px] font-medium">Expires {formatToDDMMYYYY(lot.official_expiry_date)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Contextual Benefit / Tip Card */}
              {isEliteUser && approachingLots.length > 0 ? (
                <View className="bg-[#EDF3FC] p-4 rounded-2xl flex-row items-start gap-3 border border-blue-100/60 mt-1">
                  <View className="w-9 h-9 rounded-full bg-[#FCE7F3] items-center justify-center">
                    <Ionicons name="heart-outline" size={17} color="#E11D48" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-950 text-xs font-black">A special benefit for you ❤️</Text>
                    <Text className="text-zinc-600 text-xs font-medium mt-1 leading-relaxed">
                      Your credits are approaching their expiry date. Because you&apos;re a premium Virla client, we&apos;re giving you an additional 7 days to use your remaining credits.
                    </Text>
                  </View>
                </View>
              ) : role === 'trainer' ? (
                <View className="bg-[#EDF3FC] p-4 rounded-2xl flex-row items-start gap-3 border border-blue-100/60 mt-1">
                  <View className="w-9 h-9 rounded-full bg-[#FCE7F3] items-center justify-center">
                    <Ionicons name="information-circle-outline" size={17} color="#E11D48" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-950 text-xs font-black">Transfer-Only Credits</Text>
                    <Text className="text-zinc-600 text-xs font-medium mt-1 leading-relaxed">
                      As a trainer, you can receive and transfer credits, but you cannot use credits to book sessions for yourself.
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="bg-[#EDF3FC] p-4 rounded-2xl flex-row items-start gap-3 border border-blue-100/60 mt-1">
                  <View className="w-9 h-9 rounded-full bg-[#FCE7F3] items-center justify-center">
                    <Ionicons name="bulb-outline" size={17} color="#E11D48" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-zinc-950 text-xs font-black">Session Scheduling Tip</Text>
                    <Text className="text-zinc-600 text-xs font-medium mt-1 leading-relaxed">
                      Schedule your workout sessions in advance to ensure your available credits are utilized effectively before expiration.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Tab 2: P2P Transfer */}
          {activeTab === 'transfer' && (
            <View className="gap-3">
              <View>
                <Text className="text-zinc-950 text-sm font-black tracking-tight">Peer-to-Peer Transfer</Text>
                <Text className="text-zinc-500 text-[11px] font-medium mt-0.5">
                  Instantly share booking credits with friends or family on Virla.
                </Text>
              </View>

              <View className="bg-white rounded-[28px] p-5 shadow-xs border border-zinc-100/80 gap-4">
                <View className="gap-3.5">
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-1.5">Recipient Phone Number</Text>
                    <View className="flex-row gap-2">
                      <View className="bg-zinc-100 border border-zinc-200 px-3.5 py-3 rounded-xl justify-center">
                        <Text className="text-zinc-700 text-xs font-black">+91</Text>
                      </View>
                      <TextInput
                        placeholder="Enter 10-digit mobile number"
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
                        className="flex-1 bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-xl text-zinc-900 text-xs font-bold"
                      />
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleVerifyRecipient}
                        className="bg-indigo-600 px-4 rounded-xl items-center justify-center shadow-xs"
                      >
                        <Text className="text-white text-[10px] font-black uppercase">Verify</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Recipient status confirmations */}
                    {recipientStatus === 'searching' && (
                      <View className="flex-row items-center gap-2 mt-2.5 ml-1">
                        <ActivityIndicator size="small" color="#4F46E5" />
                        <Text className="text-zinc-500 text-[10px] font-bold">Checking registered Virla users...</Text>
                      </View>
                    )}
                    {recipientStatus === 'not_found' && (
                      <View className="mt-3 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 gap-3">
                        <View className="flex-row items-center gap-2">
                          <Feather name="info" size={15} color="#D97706" />
                          <Text className="text-zinc-800 text-xs font-bold">
                            {t('wallet.recipient_not_found', "This person isn't on Virla yet.")}
                          </Text>
                        </View>
                        
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={handleInviteWhatsApp}
                            className={`flex-1 py-2.5 px-3 rounded-xl items-center justify-center flex-row gap-1.5 shadow-2xs ${
                              isInviteSent ? 'bg-[#1EBE5D]' : 'bg-[#25D366]'
                            }`}
                          >
                            <Ionicons name="logo-whatsapp" size={15} color="white" />
                            <Text className="text-white text-[11px] font-black uppercase tracking-wider">
                              {isInviteSent ? t('wallet.invited_whatsapp', 'Invited on WhatsApp ✓') : t('wallet.invite_whatsapp', 'Invite via WhatsApp')}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleShareMoreOptions}
                            className="bg-white border border-zinc-300 py-2.5 px-3 rounded-xl items-center justify-center flex-row gap-1.5 shadow-2xs"
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
                      <Text className="text-rose-600 text-[10px] font-black uppercase mt-2 ml-1">
                        You cannot transfer credits to yourself.
                      </Text>
                    )}
                    {recipientStatus === 'found' && (
                      <View className="flex-row items-center gap-1.5 mt-2.5 ml-1">
                        <Feather name="check-circle" size={13} color="#059669" />
                        <Text className="text-emerald-700 text-xs font-black uppercase tracking-wider">
                          Verified: {recipientName}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View>
                    <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-1.5">Credits Amount</Text>
                    <TextInput
                      placeholder="Number of credits to send"
                      placeholderTextColor="#9CA3AF"
                      value={transferAmount}
                      onChangeText={setTransferAmount}
                      keyboardType="numeric"
                      editable={recipientStatus === 'found'}
                      className={`bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-xl text-zinc-900 text-xs font-bold ${recipientStatus !== 'found' ? 'opacity-50' : ''}`}
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
            </View>
          )}

          {/* Tab 3: Ledger Audit */}
          {activeTab === 'ledger' && (
            <View className="gap-3.5 mt-1">
              <View className="flex-row items-center justify-between px-1">
                <View>
                  <Text className="text-zinc-950 text-base font-bold tracking-tight">Transaction Ledger Audit</Text>
                  <Text className="text-zinc-500 text-xs font-normal mt-0.5">Complete record of session debits & credit top-ups</Text>
                </View>
                <View className="bg-zinc-100 px-3 py-1 rounded-full">
                  <Text className="text-zinc-500 text-xs font-semibold">{ledger.length} Total</Text>
                </View>
              </View>

              {/* Filter Chips */}
              <View className="flex-row gap-2.5 my-2">
                {(['all', 'booking', 'purchase', 'refund'] as const).map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    activeOpacity={0.7}
                    onPress={() => setLedgerFilter(filter)}
                    className={`px-4 py-2.5 rounded-full border ${
                      ledgerFilter === filter
                        ? 'bg-zinc-900 border-zinc-900'
                        : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <Text className={`text-sm font-semibold ${
                      ledgerFilter === filter ? 'text-white' : 'text-zinc-600'
                    }`}>
                      {filter === 'all' ? 'All' : filter === 'booking' ? 'Sessions' : filter === 'purchase' ? 'Purchases' : 'Refunds'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View className="bg-white rounded-[28px] p-5 shadow-xs border border-zinc-100/80">
                {filteredLedger.length === 0 ? (
                  <View className="py-8 items-center justify-center gap-2">
                    <Feather name="inbox" size={26} color="#D1D5DB" />
                    <Text className="text-zinc-400 text-sm font-semibold uppercase">No transactions found</Text>
                  </View>
                ) : (
                  filteredLedger.map((tx) => {
                    const isAdd = tx.change >= 0;
                    const iconInfo = getLedgerIcon(tx.type);
                    return (
                      <View key={tx.id} className="flex-row justify-between items-center py-3.5 border-b border-zinc-100 last:border-0">
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View className={`w-9 h-9 rounded-xl ${iconInfo.bg} items-center justify-center`}>
                            <Feather name={iconInfo.icon as any} size={16} color={iconInfo.color} />
                          </View>
                          <View className="flex-1 gap-0.5">
                            <Text className="text-zinc-900 text-sm font-semibold leading-tight">{tx.title}</Text>
                            <Text className="text-zinc-500 text-xs font-medium mt-0.5">{formatToDDMMYYYY(tx.date)}</Text>
                          </View>
                        </View>
                        <View className="items-end gap-1.5">
                          <Text className={`text-sm font-bold ${isAdd ? 'text-emerald-600' : 'text-zinc-900'}`}>
                            {isAdd ? '+' : ''}{tx.change} {Math.abs(tx.change) === 1 ? 'Credit' : 'Credits'}
                          </Text>
                          
                          {/* Type Badge */}
                          <View className="px-2.5 py-0.5 rounded-md bg-zinc-100 border border-zinc-200">
                            <Text className="text-[10px] font-semibold uppercase text-zinc-600">
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
          )}

        </View>
      </ScrollView>

      {/* Confirmation Modal Overlay */}
      {showConfirmModal && (
        <View 
          className="absolute top-0 left-0 right-0 bottom-0 bg-black/60 items-center justify-center z-50 px-6"
          style={{ position: 'absolute', elevation: 10 }}
        >
          <View className="w-full bg-white rounded-[28px] p-6 border border-zinc-200 gap-5 shadow-2xl">
            <View className="flex-row items-center gap-2.5 border-b border-zinc-100 pb-3">
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

