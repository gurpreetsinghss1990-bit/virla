import { Loading } from '../components/Loading';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable, TextInput, Alert, Linking, Share, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated';
import { InteractionManager } from '../utils/interactionManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useWalletStore, LedgerTransaction } from '../store/walletStore';
import { useBookingStore } from '../store/bookingStore';
import { useMembershipStore } from '../store/membershipStore';
import { useUserStore } from '../store/userStore';
import { Database } from '../database/Database';
import { syncAllDomainStores } from '../store/syncAllStores';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatToDDMMYYYY } from '../utils/date';
import { supabase } from '../database/supabaseClient';
import { t } from '../utils/i18n';
import { PayPhiService } from '../services/payphiService';
import { clampInt } from '../utils/inputSafety';

import { softShadow } from '../utils/shadows';
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

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Ensure session is restored if store is hydrated
      const storedUser = useUserStore.getState().user;
      const isLoggedIn = useUserStore.getState().isLoggedIn;
      if (isLoggedIn && storedUser && storedUser.id) {
        Database.setCurrentUserId(storedUser.id);
      }
      
      // Perform sync & self-healing reconciliation after screen transition to eliminate opening delay
      const task = InteractionManager.runAfterInteractions(() => {
        // Instant sync from local store state
        useWalletStore.getState().syncFromDB();
        useMembershipStore.getState().syncFromDB();
        useBookingStore.getState().syncFromDB();

        if (!Database.getIsLoaded()) {
          Database.load().then(() => {
            syncAllDomainStores();
          }).catch((err) => {
            console.warn('[Wallet] Background database load notice:', err);
          });
        }

        // Passive Self-Healing: Check if user has any orphan pending payments in background
        const currentUid = Database.getCurrentUserId();
        if (currentUid) {
          PayPhiService.reconcileUserPendingOrders(currentUid).then((recovered) => {
            if (recovered) {
              Alert.alert('Payment Recovered 🎉', 'Your pending payment was confirmed by the payment gateway and credits have been credited to your wallet!');
            }
          }).catch((err) => {
            console.warn('[Wallet] Background reconciliation notice:', err);
          });
        }
      });

      return () => {
        task.cancel();
      };
    }, [])
  );

  const [activeTab, setActiveTab] = useState<'lots' | 'transfer' | 'ledger'>('ledger');
  const [isReady, setIsReady] = useState(false);
  const [dismissPriorityNotice, setDismissPriorityNotice] = useState(false);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => handle.cancel();
  }, []);
  const [transferPhone, setTransferPhone] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientStatus, setRecipientStatus] = useState<'idle' | 'searching' | 'not_found' | 'self' | 'found'>('idle');
  const [recipientName, setRecipientName] = useState('');
  const [isInviteSent, setIsInviteSent] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAllLots, setShowAllLots] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'booking' | 'purchase' | 'refund'>('all');
  const [visibleLedgerCount, setVisibleLedgerCount] = useState(8);

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
          <Text className="text-zinc-900 text-xs font-bold">{formatToDDMMYYYY(breakdown[0].official_expiry_date)}</Text>
        </View>
      );
    }

    return (
      <View className="border-t border-zinc-100 pt-3.5 gap-2">
        <Text className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Credit Expiry Breakdown</Text>
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

  // ponytail: ring shows remaining share of lifetime credits (display only)
  const gaugeRatio = useMemo(() => {
    if (!lifetimePurchased || lifetimePurchased <= 0) return 0.06;
    return Math.min(1, Math.max(0.06, creditBalance / lifetimePurchased));
  }, [creditBalance, lifetimePurchased]);

  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'all') return ledger;
    return ledger.filter(tx => tx.type === ledgerFilter);
  }, [ledger, ledgerFilter]);

  const getLedgerIcon = (type: LedgerTransaction['type']) => {
    switch (type) {
      case 'purchase':
        return { icon: 'credit-card', color: '#10B981', bg: '#ECFDF5', border: '#D1FAE5' };
      case 'booking':
        return { icon: 'check-circle', color: '#E11D48', bg: '#FFF1F2', border: '#FFE4E6' };
      case 'refund':
        return { icon: 'rotate-ccw', color: '#3B82F6', bg: '#EFF6FF', border: '#DBEAFE' };
      case 'penalty':
        return { icon: 'alert-triangle', color: '#EF4444', bg: '#FEF2F2', border: '#FEE2E2' };
      default:
        return { icon: 'gift', color: '#8B5CF6', bg: '#F5F3FF', border: '#EDE9FE' };
    }
  };

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const filteredLedgerLengthRef = useRef(filteredLedger.length);
  filteredLedgerLengthRef.current = filteredLedger.length;

  const scrollY = useSharedValue(0);
  const isCollapsedShared = useSharedValue(false);

  const handleHeaderCollapse = useCallback((collapsed: boolean) => {
    setIsHeaderCollapsed(collapsed);
  }, []);

  const handleLoadMoreLedger = useCallback(() => {
    if (activeTabRef.current === 'ledger') {
      setVisibleLedgerCount((prev) => Math.min(prev + 8, filteredLedgerLengthRef.current));
    }
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
      const collapsed = event.contentOffset.y > 120;
      if (collapsed !== isCollapsedShared.value) {
        isCollapsedShared.value = collapsed;
        runOnJS(handleHeaderCollapse)(collapsed);
      }

      const isCloseToBottom = event.layoutMeasurement.height + event.contentOffset.y >= event.contentSize.height - 120;
      if (isCloseToBottom) {
        runOnJS(handleLoadMoreLedger)();
      }
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFBFD' }}>
      {/* Signature Virla Heritage Top-Right Leaves Watermark */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, opacity: 0.22, zIndex: 0 }}>
        <Svg width={240} height={260} viewBox="0 0 240 260" fill="none">
          <Path d="M239.5 0C220.5 45.5 180 110 115 135C50 160 10 230 0 260C25 210 75 165 140 135C205 105 230 45 239.5 0Z" fill="#3D5A45" />
          <Path d="M190 20C170 65 130 110 70 130C10 150 0 205 0 205C20 170 65 140 120 120C175 100 185 50 190 20Z" fill="#587862" opacity={0.6} />
          <Path d="M240 85C215 115 175 145 130 160C85 175 60 215 60 215C75 190 110 170 150 155C190 140 225 115 240 85Z" fill="#7A9A84" opacity={0.4} />
        </Svg>
      </View>

      {/* Signature Virla Heritage Mid-Left Leaves Watermark */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 180, left: -40, opacity: 0.14, zIndex: 0, transform: [{ rotate: '45deg' }] }}>
        <Svg width={180} height={200} viewBox="0 0 180 200" fill="none">
          <Path d="M0 0C20 35 60 85 120 105C180 125 175 180 180 200C160 165 120 130 70 105C20 80 5 35 0 0Z" fill="#4B6A53" />
        </Svg>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-4 pt-0"
        contentContainerStyle={{ 
          paddingTop: insets.top + 58,
          paddingBottom: Math.max((insets.bottom || 0) + 40, 110) 
        }}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
      >
        <View className="gap-5 pt-1">

          {/* Dynamic Notice Banner */}
          {!dismissPriorityNotice && (
            isExpired() ? (
              <View 
                style={{
                  backgroundColor: '#FEFBF2',
                  borderColor: '#FDEBBA',
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  ...softShadow({ color: '#D97706', opacity: 0.08, radius: 8, offsetY: 2 }),
                }}
              >
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-10 h-10 rounded-xl bg-[#FDF2D0] items-center justify-center">
                    <Feather name="alert-triangle" size={17} color="#D97706" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-[13px] tracking-tight leading-tight">
                      WALLET EXPIRED ⚠️
                    </Text>
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-amber-900/80 text-[11.5px] leading-normal mt-0.5">
                      Please recharge to reactivate session check-ins.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/membership' as any)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: '#FFF1F2',
                      borderColor: '#FECDD3',
                      borderWidth: 1,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                      borderRadius: 9999,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#BE123C] text-[11px] tracking-wider uppercase">
                    RECHARGE
                  </Text>
                </Pressable>
              </View>
            ) : role !== 'trainer' && creditBalance <= 2 ? (
              <View 
                style={{
                  backgroundColor: '#FEFBF2',
                  borderColor: '#FDEBBA',
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  ...softShadow({ color: '#D97706', opacity: 0.08, radius: 8, offsetY: 2 }),
                }}
              >
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-10 h-10 rounded-xl bg-[#FDF2D0] items-center justify-center">
                    <Text className="text-lg">⚡</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1">
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-[13px] tracking-tight leading-tight">
                        RUNNING LOW ON CREDITS
                      </Text>
                      <Text className="text-amber-500 text-xs">⚡</Text>
                    </View>
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-amber-900/80 text-[11.5px] leading-normal mt-0.5">
                      Recharge your wallet to keep training.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/membership' as any)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: '#FFF1F2',
                      borderColor: '#FECDD3',
                      borderWidth: 1,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                      borderRadius: 9999,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#BE123C] text-[11px] tracking-wider uppercase">
                    RECHARGE
                  </Text>
                </Pressable>
              </View>
            ) : approachingLots.length > 0 ? (
              <View 
                style={{
                  backgroundColor: '#EEF4FF',
                  borderColor: 'rgba(191, 219, 254, 0.7)',
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  ...softShadow({ color: '#3B82F6', opacity: 0.06, radius: 8, offsetY: 2 }),
                }}
              >
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-10 h-10 rounded-xl bg-[#FFE4E6] items-center justify-center">
                    <Ionicons name="hourglass-outline" size={17} color="#E11D48" />
                  </View>
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#E11D48] text-[11px] uppercase tracking-wider">
                      Expiring Soon ⚠️ • Lot #{activeLots[0]?.id?.slice(-3) || '1'}
                    </Text>
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-800 text-xs mt-0.5" numberOfLines={1}>
                      {approachingLots.length} lot(s) expiring in {burningDaysLeft} days ({activeLots[0] ? formatToDDMMYYYY(activeLots[0].official_expiry_date) : ''})
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => router.push('/membership' as any)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: '#E11D48',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 9999,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-white text-[10px] uppercase">EXTEND</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDismissPriorityNotice(true)}
                    className="p-1"
                  >
                    <Feather name="x" size={16} color="#64748B" />
                  </Pressable>
                </View>
              </View>
            ) : null
          )}

          {/* Available Balance Gauge (Hero Section) matching Stitch code.html & Screenshot */}
          <View className="items-center justify-center pt-2 pb-1">
            {/* Circular Radial Progress Gauge */}
            <View className="relative w-56 h-56 items-center justify-center">
              <Svg width={220} height={220} viewBox="0 0 220 220" style={{ transform: [{ rotate: '-90deg' }] }}>
                {/* Background Outer Track (Soft Ice Sky Blue #E1EFFE) */}
                <Circle
                  cx="110"
                  cy="110"
                  r="86"
                  stroke="#E1EFFE"
                  strokeWidth="12"
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.85}
                />
                {/* Active Energetic Crimson Arc */}
                <Circle
                  cx="110"
                  cy="110"
                  r="86"
                  stroke="#E11D48"
                  strokeWidth="12"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray="540.35"
                  strokeDashoffset={Math.max(60, 540.35 - (gaugeRatio * 430))}
                />
              </Svg>

              {/* Inner Dial Content */}
              <View className="absolute inset-0 items-center justify-center px-4">
                <Text 
                  style={{ fontFamily: 'Outfit_600SemiBold', letterSpacing: 1.5 }}
                  className="text-[11px] text-slate-400 uppercase mb-1"
                >
                  AVAILABLE BALANCE
                </Text>
                
                {/* Bold Metric Display */}
                <View className="flex-row items-baseline justify-center">
                  <Text 
                    style={{ fontFamily: 'Outfit_800ExtraBold', letterSpacing: -2 }}
                    className="text-6xl text-slate-900 leading-none"
                  >
                    {creditBalance}
                  </Text>
                  <Text 
                    style={{ fontFamily: 'Outfit_700Bold' }}
                    className="text-[#E11D48] text-5xl leading-none font-bold"
                  >
                    .
                  </Text>
                </View>

                <Text 
                  style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 1.2 }}
                  className="text-[10.5px] text-slate-800 uppercase mt-2"
                >
                  AVAILABLE CREDITS
                </Text>
              </View>
            </View>

            {/* Validity & Cardholder Details */}
            <View className="mt-3.5 items-center gap-1.5">
              {/* Shield Validity Badge */}
              <View 
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#FFE4E6',
                  borderWidth: 1,
                  borderRadius: 9999,
                  paddingHorizontal: 12,
                  paddingVertical: 4.5,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 4, offsetY: 1 }),
                }}
              >
                <Feather name="shield" size={13} color="#E11D48" />
                <Text 
                  style={{ fontFamily: 'Outfit_500Medium' }}
                  className="text-slate-800 text-[12px]"
                >
                  Valid until {membership.renewalDate || 'May 23, 2027'}
                </Text>
              </View>

              {/* Cardholder Label */}
              <Text 
                style={{ fontFamily: 'Outfit_600SemiBold', letterSpacing: 1.1 }}
                className="text-[11px] text-slate-400 uppercase pt-0.5"
              >
                CARD HOLDER: <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-500">{userName ? userName.toUpperCase() : 'KIRTI YADAV'}</Text>
              </Text>
            </View>
          </View>

          {/* Lifetime Stats 3-Column Card matching Stitch code.html */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              borderColor: '#F1F4F9',
              borderWidth: 1,
              padding: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              ...softShadow({ color: '#0F172A', opacity: 0.05, radius: 10, offsetY: 2 }),
            }}
          >
            {/* Col 1: Purchased */}
            <View className="flex-1 items-center justify-center px-1">
              <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }} className="text-[10px] uppercase text-slate-400">
                PURCHASED
              </Text>
              <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 }} className="text-2xl text-slate-900 mt-0.5">
                {lifetimePurchased}
              </Text>
              <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[11px] text-slate-400 mt-0.5">
                Lifetime
              </Text>
            </View>

            {/* Divider */}
            <View className="h-9 w-[1px] bg-slate-100" />

            {/* Col 2: Consumed */}
            <View className="flex-1 items-center justify-center px-1">
              <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }} className="text-[10px] uppercase text-slate-400">
                CONSUMED
              </Text>
              <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 }} className="text-2xl text-slate-900 mt-0.5">
                {creditsUsed}
              </Text>
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#E11D48] text-[11px] mt-0.5">
                {consumptionRate}% Rate
              </Text>
            </View>

            {/* Divider */}
            <View className="h-9 w-[1px] bg-slate-100" />

            {/* Col 3: Next */}
            <Pressable
              onPress={handleUpcomingBookingsPress}
              className="flex-1 items-center justify-center px-1"
            >
              <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }} className="text-[10px] uppercase text-slate-400">
                NEXT
              </Text>
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-sm text-slate-900 mt-1 mb-0.5" numberOfLines={1}>
                {nextRitual ? formatToDDMMYYYY(nextRitual.date) : 'No Sessions'}
              </Text>
              <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[11px] text-slate-400">
                {upcomingCount} Upcoming
              </Text>
            </Pressable>
          </View>

          {/* Category Tabs Navigation: LEDGER | TRANSFER | LOTS */}
          <View className="flex-row border-b border-slate-200/80 mt-1">
            <Pressable
              onPress={() => setActiveTab('ledger')}
              className={`flex-1 pb-3 items-center justify-center border-b-2 ${
                activeTab === 'ledger' ? 'border-slate-900 -mb-[1px]' : 'border-transparent'
              }`}
            >
              <Text 
                numberOfLines={1}
                style={{ fontFamily: activeTab === 'ledger' ? 'Outfit_700Bold' : 'Outfit_500Medium', letterSpacing: 0.8 }}
                className={`text-xs uppercase ${
                  activeTab === 'ledger' ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                LEDGER
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('transfer')}
              className={`flex-1 pb-3 items-center justify-center border-b-2 ${
                activeTab === 'transfer' ? 'border-slate-900 -mb-[1px]' : 'border-transparent'
              }`}
            >
              <Text 
                numberOfLines={1}
                style={{ fontFamily: activeTab === 'transfer' ? 'Outfit_700Bold' : 'Outfit_500Medium', letterSpacing: 0.8 }}
                className={`text-xs uppercase ${
                  activeTab === 'transfer' ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                TRANSFER
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('lots')}
              className={`flex-1 pb-3 items-center justify-center border-b-2 ${
                activeTab === 'lots' ? 'border-slate-900 -mb-[1px]' : 'border-transparent'
              }`}
            >
              <Text 
                numberOfLines={1}
                style={{ fontFamily: activeTab === 'lots' ? 'Outfit_700Bold' : 'Outfit_500Medium', letterSpacing: 0.8 }}
                className={`text-xs uppercase ${
                  activeTab === 'lots' ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                LOTS
              </Text>
            </Pressable>
          </View>

          {/* Tab 1: Credit Lots */}
          {activeTab === 'lots' && (
            <View className="gap-3">
              <View className="px-0.5">
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-base text-slate-900 tracking-tight leading-tight">
                  Credit Expiry Breakdown
                </Text>
                <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[11px] text-slate-400 mt-0.5">
                  Oldest expiring credits are used first
                </Text>
              </View>

              {/* Clean Circle Breakdown */}
              <View 
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 20,
                  borderColor: '#F1F4F9',
                  borderWidth: 1,
                  position: 'relative',
                  ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
                }}
              >
                {activeLots.length === 0 ? (
                  <View className="py-4 items-center justify-center">
                    <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-slate-400 text-xs">
                      No active credit packs right now.
                    </Text>
                  </View>
                ) : (
                  <>
                    {activeLots.length > 1 && (
                      <View
                        className="absolute h-[2px] bg-[#E11D48]/25"
                        style={{
                          top: 42,
                          left: activeLots.length === 2 ? '25%' : '16.6%',
                          width: activeLots.length === 2 ? '50%' : '66.8%',
                        }}
                        pointerEvents="none"
                      />
                    )}

                    <View className="flex-row justify-around items-start">
                      {activeLots.slice(0, 3).map((lot: any, idx: number) => {
                        const expiryMs = new Date(lot.official_expiry_date).getTime();
                        const daysLeft = isNaN(expiryMs)
                          ? 0
                          : Math.max(0, Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24)));
                        const isFirst = idx === 0;
                        const isExpiringSoon = daysLeft <= 14;
                        const stepLabel = isFirst ? 'USE FIRST' : idx === 1 ? 'NEXT' : 'LATER';

                        return (
                          <View key={lot.id || idx} className="items-center flex-1">
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                backgroundColor: isFirst ? '#E11D48' : '#E1EFFE',
                                alignItems: 'center',
                                justifyContent: 'center',
                                ...(isFirst ? softShadow({ color: '#E11D48', opacity: 0.3, radius: 6, offsetY: 2 }) : {}),
                              }}
                            >
                              <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-sm ${isFirst ? 'text-white' : 'text-slate-800'}`}>
                                {lot.remaining_credits || 0}
                              </Text>
                            </View>
                            <Text
                              style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }}
                              className={`text-[10px] uppercase mt-2.5 ${
                                isFirst ? 'text-[#E11D48]' : 'text-slate-400'
                              }`}
                            >
                              {stepLabel}
                            </Text>
                            <Text
                              style={{ fontFamily: 'Outfit_700Bold' }}
                              className={`text-[10.5px] mt-0.5 ${
                                isExpiringSoon ? 'text-[#E11D48]' : 'text-emerald-600'
                              }`}
                            >
                              {daysLeft}d left
                            </Text>
                            <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-400 text-[10px] mt-0.5">
                              {lot.official_expiry_date ? formatToDDMMYYYY(lot.official_expiry_date) : '-'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {activeLots.length > 3 && (
                      <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: '#F1F4F9' }}>
                        <Pressable
                          onPress={() => setShowAllLots(!showAllLots)}
                          className="items-center justify-center py-1"
                          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                        >
                          <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.6 }} className="text-slate-600 text-[11px] uppercase">
                            {showAllLots ? 'Show Less' : `View All ${activeLots.length} Packs`}
                          </Text>
                        </Pressable>

                        {showAllLots && (
                          <View className="gap-2.5 mt-3">
                            {activeLots.slice(3).map((lot: any, idx: number) => (
                              <View key={lot.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-xs">{lot.remaining_credits} Credits</Text>
                                <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-400 text-[11px]">
                                  Expires {lot.official_expiry_date ? formatToDDMMYYYY(lot.official_expiry_date) : '-'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Contextual Benefit / Tip Card (Deferred until transition finishes) */}
              {isReady && (
                isEliteUser && approachingLots.length > 0 ? (
                  <View 
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#F1F4F9',
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginTop: 2,
                      ...softShadow({ color: '#0F172A', opacity: 0.03, radius: 8, offsetY: 2 }),
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="heart-outline" size={18} color="#E11D48" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-xs">
                        A special benefit for you ❤️
                      </Text>
                      <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Your credits are approaching their expiry date. Because you&apos;re a premium Virla client, we&apos;re giving you an additional 7 days to use your remaining credits.
                      </Text>
                    </View>
                  </View>
                ) : role === 'trainer' ? (
                  <View 
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#F1F4F9',
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginTop: 2,
                      ...softShadow({ color: '#0F172A', opacity: 0.03, radius: 8, offsetY: 2 }),
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-xs">
                        Transfer-Only Credits
                      </Text>
                      <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-500 text-xs mt-1 leading-relaxed">
                        As a trainer, you can receive and transfer credits, but you cannot use credits to book sessions for yourself.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View 
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#F1F4F9',
                      borderWidth: 1,
                      borderRadius: 18,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginTop: 2,
                      ...softShadow({ color: '#0F172A', opacity: 0.03, radius: 8, offsetY: 2 }),
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="bulb-outline" size={18} color="#D97706" />
                    </View>
                    <View className="flex-1">
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-xs">
                        Session Scheduling Tip
                      </Text>
                      <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Schedule your workout sessions in advance to ensure your available credits are utilized effectively before expiration.
                      </Text>
                    </View>
                  </View>
                )
              )}
            </View>
          )}

          {/* Tab 2: P2P Transfer */}
          {activeTab === 'transfer' && (
            <View className="gap-3">
              <View className="px-0.5">
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-base text-slate-900 tracking-tight leading-tight">
                  Peer-to-Peer Transfer
                </Text>
                <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[11px] text-slate-400 mt-0.5">
                  Instantly share booking credits with friends or family on Virla.
                </Text>
              </View>

              <View 
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 20,
                  borderColor: '#F1F4F9',
                  borderWidth: 1,
                  gap: 16,
                  ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
                }}
              >
                <View className="gap-3.5">
                  <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }} className="text-[10px] uppercase text-slate-400 mb-1.5">
                      Recipient Phone Number
                    </Text>
                    <View className="flex-row gap-2">
                      <View 
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderColor: '#E2E8F0',
                          borderWidth: 1,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-700 text-xs">+91</Text>
                      </View>
                      <TextInput
                        placeholder="Enter 10-digit mobile number"
                        placeholderTextColor="#94A3B8"
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
                        style={{
                          flex: 1,
                          backgroundColor: '#FAFBFD',
                          borderColor: '#E2E8F0',
                          borderWidth: 1,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 12,
                          fontFamily: 'Outfit_600SemiBold',
                          fontSize: 13,
                          color: '#0F172A',
                        }}
                      />
                      <Pressable
                        onPress={handleVerifyRecipient}
                        style={({ pressed }) => [
                          {
                            backgroundColor: '#090D16',
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.85 : 1,
                            ...softShadow({ color: '#090D16', opacity: 0.15, radius: 6, offsetY: 2 }),
                          },
                        ]}
                      >
                        <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.6 }} className="text-white text-[11px] uppercase">
                          Verify
                        </Text>
                      </Pressable>
                    </View>

                    {/* Recipient status confirmations */}
                    {recipientStatus === 'searching' && (
                      <View className="flex-row items-center gap-2 mt-2.5 ml-1">
                        <Loading size="small" color="#4F46E5" />
                        <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-400 text-[11px]">
                          Checking registered Virla users...
                        </Text>
                      </View>
                    )}
                    {recipientStatus === 'not_found' && (
                      <View 
                        style={{
                          marginTop: 12,
                          padding: 14,
                          borderRadius: 16,
                          backgroundColor: '#FEFBF2',
                          borderColor: '#FDEBBA',
                          borderWidth: 1,
                          gap: 12,
                        }}
                      >
                        <View className="flex-row items-center gap-2">
                          <Feather name="info" size={15} color="#D97706" />
                          <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-xs">
                            {t('wallet.recipient_not_found', "This person isn't on Virla yet.")}
                          </Text>
                        </View>
                        
                        <View className="flex-row gap-2">
                          <Pressable
                            onPress={handleInviteWhatsApp}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'row',
                              gap: 6,
                              backgroundColor: isInviteSent ? '#1EBE5D' : '#25D366',
                            }}
                          >
                            <Ionicons name="logo-whatsapp" size={15} color="white" />
                            <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.5 }} className="text-white text-[11px] uppercase">
                              {isInviteSent ? t('wallet.invited_whatsapp', 'Invited on WhatsApp ✓') : t('wallet.invite_whatsapp', 'Invite via WhatsApp')}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={handleShareMoreOptions}
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#E2E8F0',
                              borderWidth: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'row',
                              gap: 6,
                            }}
                          >
                            <Feather name="share-2" size={13} color="#374151" />
                            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-700 text-[11px]">
                              {t('wallet.more_options', 'More')}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                    {recipientStatus === 'self' && (
                      <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-rose-600 text-[11px] mt-2 ml-1">
                        You cannot transfer credits to yourself.
                      </Text>
                    )}
                    {recipientStatus === 'found' && (
                      <View 
                        style={{
                          marginTop: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: '#ECFDF5',
                          borderColor: '#D1FAE5',
                          borderWidth: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Feather name="check-circle" size={14} color="#059669" />
                        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-emerald-700 text-xs uppercase">
                          Verified: {recipientName}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View>
                    <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }} className="text-[10px] uppercase text-slate-400 mb-1.5">
                      Credits Amount
                    </Text>
                    <TextInput
                      maxLength={12}
                      placeholder="Number of credits to send"
                      placeholderTextColor="#94A3B8"
                      value={transferAmount}
                      onChangeText={(v) => setTransferAmount(clampInt(v, 6))}
                      keyboardType="numeric"
                      editable={recipientStatus === 'found'}
                      style={{
                        backgroundColor: '#FAFBFD',
                        borderColor: '#E2E8F0',
                        borderWidth: 1,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 12,
                        fontFamily: 'Outfit_600SemiBold',
                        fontSize: 13,
                        color: '#0F172A',
                        opacity: recipientStatus !== 'found' ? 0.5 : 1,
                      }}
                    />
                  </View>

                  <Pressable
                    onPress={handleTransfer}
                    disabled={recipientStatus !== 'found'}
                    style={({ pressed }) => [
                      {
                        width: '100%',
                        paddingVertical: 14,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 4,
                        backgroundColor: recipientStatus === 'found' ? '#090D16' : '#F1F5F9',
                        opacity: pressed && recipientStatus === 'found' ? 0.88 : 1,
                        ...(recipientStatus === 'found' ? softShadow({ color: '#090D16', opacity: 0.2, radius: 8, offsetY: 3 }) : {}),
                      },
                    ]}
                  >
                    <Text 
                      style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 }}
                      className={`text-xs uppercase ${recipientStatus === 'found' ? 'text-white' : 'text-slate-400'}`}
                    >
                      Transfer Credits
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Tab 3: Ledger Audit */}
          {activeTab === 'ledger' && (
            <View className="gap-3 mt-1">
              {/* Ledger Subheader & Total Counter */}
              <View className="flex-row items-center justify-between px-0.5">
                <View>
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-base text-slate-900 tracking-tight leading-tight">
                    Transaction Ledger
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-[11px] text-slate-400 mt-0.5">
                    Session debits & credit top-ups
                  </Text>
                </View>
                <View className="px-2.5 py-0.5 bg-slate-100 rounded-full">
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-600 text-[11px]">
                    {ledger.length} Total
                  </Text>
                </View>
              </View>

              {/* Quick Filter Horizontal Pills matching native Expo UI: Sessions, Purchases, Refunds, All */}
              <View className="flex-row items-center gap-2 py-1 mb-1">
                {(['booking', 'purchase', 'refund', 'all'] as const).map((filter) => {
                  const isActive = ledgerFilter === filter;
                  const label = filter === 'booking' ? 'Sessions' : filter === 'purchase' ? 'Purchases' : filter === 'refund' ? 'Refunds' : 'All';
                  return (
                    <Pressable
                      key={filter}
                      onPress={() => {
                        setLedgerFilter(filter);
                        setVisibleLedgerCount(8);
                      }}
                      style={({ pressed }) => [
                        {
                          backgroundColor: isActive ? '#0F172A' : '#F1F5F9',
                          borderColor: isActive ? '#0F172A' : '#E2E8F0',
                          borderWidth: 1,
                          borderRadius: 9999,
                          paddingHorizontal: 16,
                          paddingVertical: 7,
                          opacity: pressed ? 0.75 : 1,
                          ...softShadow({ color: '#0F172A', opacity: isActive ? 0.12 : 0.02, radius: 4, offsetY: 1 }),
                        },
                      ]}
                    >
                      <Text 
                        style={{ fontFamily: isActive ? 'Outfit_700Bold' : 'Outfit_600SemiBold' }}
                        className={`text-xs ${isActive ? 'text-white' : 'text-slate-600'}`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              
              {/* Transaction List Cards Container */}
              <View className="gap-3">
                {filteredLedger.length === 0 ? (
                  <View className="bg-white rounded-2xl p-8 border border-slate-100 items-center justify-center gap-2 shadow-sm">
                    <Feather name="inbox" size={26} color="#CBD5E1" />
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-400 text-sm">
                      No transactions found
                    </Text>
                  </View>
                ) : (
                  <>
                    {filteredLedger.slice(0, visibleLedgerCount).map((tx) => {
                      const isAdd = tx.change >= 0;
                      const iconInfo = getLedgerIcon(tx.type);
                      return (
                        <View 
                          key={tx.id} 
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 16,
                            padding: 16,
                            borderColor: '#F1F4F9',
                            borderWidth: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
                          }}
                        >
                          <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                            <View 
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                backgroundColor: iconInfo.bg,
                                borderColor: iconInfo.border,
                                borderWidth: 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Feather name={iconInfo.icon as any} size={18} color={iconInfo.color} />
                            </View>
                            <View className="flex-1 gap-0.5">
                              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-900 text-sm tracking-tight leading-snug">
                                {tx.title}
                              </Text>
                              <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-400 text-xs mt-0.5">
                                {formatToDDMMYYYY(tx.date)}
                              </Text>
                            </View>
                          </View>
                          <View className="items-end gap-1.5">
                            <Text 
                              style={{ fontFamily: 'Outfit_700Bold' }}
                              className={`text-sm tracking-tight leading-none ${isAdd ? 'text-emerald-600' : 'text-rose-600'}`}
                            >
                              {isAdd ? '+' : ''}{tx.change} {Math.abs(tx.change) === 1 ? 'Credit' : 'Credits'}
                            </Text>
                            
                            {/* Type Badge */}
                            <View className="px-2 py-0.5 rounded bg-slate-100">
                              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[9.5px] uppercase tracking-wider text-slate-500">
                                {tx.type === 'purchase' ? 'Purchase' : tx.type === 'booking' ? 'Booking' : tx.type === 'refund' ? 'Refund' : tx.type}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    {filteredLedger.length > visibleLedgerCount && (
                      <Pressable
                        onPress={() => setVisibleLedgerCount(prev => Math.min(prev + 8, filteredLedger.length))}
                        className="py-3 mt-2 rounded-2xl bg-white border border-slate-200/80 items-center justify-center shadow-xs"
                      >
                        <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-xs uppercase tracking-wider">
                          Load More ({filteredLedger.length - visibleLedgerCount} remaining)
                        </Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            </View>
          )}

        </View>
      </Animated.ScrollView>

      {/* Confirmation Modal Overlay */}
      {showConfirmModal && (
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
                onPress={() => setShowConfirmModal(false)}
                className="flex-1 bg-zinc-100 py-3.5 rounded-xl items-center justify-center"
              >
                <Text className="text-zinc-700 text-xs font-bold uppercase">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleTransferConfirm}
                className="flex-1 bg-[#E11D48] py-3.5 rounded-xl items-center justify-center shadow-sm"
              >
                <Text className="text-white text-xs font-bold uppercase">Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Floating Top Bar: Left Back Button & Center Dynamic Dynamic Pill */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          right: 16,
          zIndex: 40,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Localized Pill-shaped Back Button Scrim */}
        <View pointerEvents="box-none" className="relative flex-row items-center">
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -6,
              left: -8,
              right: -32,
              bottom: -6,
            }}
          >
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="walletBackBtnScrim" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#F5F7FB" stopOpacity="0.95" />
                  <Stop offset="65%" stopColor="#F5F7FB" stopOpacity="0.85" />
                  <Stop offset="85%" stopColor="#F5F7FB" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#F5F7FB" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" rx={25} ry={25} fill="url(#walletBackBtnScrim)" />
            </Svg>
          </View>

          <Pressable
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/profile');
              }
            }}
            className="w-10 h-10 rounded-full bg-white border border-slate-200/80 shadow-xs items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color="#101828" style={{ marginLeft: -1 }} />
          </Pressable>
        </View>

        {/* Center Pill Section: Lightweight, seamless pill with ultra-subtle transparent frosted backdrop */}
        <View pointerEvents="none" className="absolute left-0 right-0 items-center justify-center">
          <View 
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: 'rgba(226, 232, 240, 0.9)',
              borderWidth: 1,
              ...softShadow({ color: '#000000', opacity: 0.03, radius: 6, offsetY: 2 }),
            }}
            className="flex-row items-center px-5 py-1.5 rounded-full gap-2"
          >
            {isHeaderCollapsed ? (
              <>
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#E11D48] text-sm">
                  {creditBalance ?? 0}
                </Text>
                <Text style={{ fontFamily: 'Outfit_700Bold', letterSpacing: 0.5 }} className="text-slate-900 text-[11px] uppercase">
                  Credits
                </Text>
              </>
            ) : (
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-800 text-[13.5px] tracking-tight">
                Credit Wallet
              </Text>
            )}
          </View>
        </View>

        {/* Right dummy balancer to keep center pill centered */}
        <View style={{ width: 40 }} pointerEvents="none" />
      </View>

    </View>
  );
}

