import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Switch, Image, Alert, TouchableOpacity, Animated, Platform } from 'react-native';
import { useUserStore } from '../../store/userStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useCoachStore } from '../../store/coachStore';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, role, setRole, invoices } = useUserStore();
  const { membership, buyCredits, purchaseMembership } = useMembershipStore();
  const { totalEarnings, earningsList } = useCoachStore();

  const [showInvoices, setShowInvoices] = useState(false);
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.7, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const handleCopyReferral = () => {
    Alert.alert('Referral Link Copied', 'Copied your invitation link: virla.fit/invite/VIRLA50. Share with friends to earn 2 free credits!');
  };

  const handleBuyCredits = (credits: number, price: string) => {
    buyCredits(credits, price);
    Alert.alert('Credits Purchased', `Successfully added ${credits} credits to your wallet. Invoice generated.`);
  };

  const handleUpgradeMembership = (tier: string, credits: number, price: string) => {
    purchaseMembership(tier, credits, price);
    Alert.alert('Plan Upgraded', `You are now a ${tier} Member! ${credits} credits added, invoice logged.`);
  };

  const renderPassQRCode = () => {
    const qrMatrix = [
      [1, 1, 1, 1, 0, 1, 1, 1, 1],
      [1, 0, 0, 1, 0, 1, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 1, 0, 1, 0, 0, 1],
      [1, 1, 1, 1, 0, 1, 1, 1, 1],
    ];
    const cellSize = 8;
    return (
      <View className="bg-white p-2 rounded-2xl items-center justify-center">
        <Svg width={cellSize * 9} height={cellSize * 5}>
          {qrMatrix.map((row, rIdx) =>
            row.map((val, cIdx) => (
              <Rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx * cellSize}
                y={rIdx * cellSize}
                width={cellSize - 1.5}
                height={cellSize - 1.5}
                fill={val === 1 ? '#111827' : '#FFFFFF'}
              />
            ))
          )}
        </Svg>
      </View>
    );
  };

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 140 }}
        className="bg-[#F8F9FB] flex-1"
      >
        <View className="px-6 pt-6 gap-6">

          {/* Dual Role Switcher at the top (Feature 10 & 11) */}
          <View className="flex-row bg-[#E5E7EB]/40 border border-[#E5E7EB]/80 p-1.5 rounded-2xl">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setRole('customer')}
              className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                role === 'customer' ? 'bg-[#111827] shadow-sm' : ''
              }`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-wider ${role === 'customer' ? 'text-white' : 'text-[#6B7280]'}`}>
                Client Account
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setRole('trainer')}
              className={`flex-1 py-3.5 rounded-xl items-center justify-center ${
                role === 'trainer' ? 'bg-[#111827] shadow-sm' : ''
              }`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-wider ${role === 'trainer' ? 'text-white' : 'text-[#6B7280]'}`}>
                Trainer Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* =============================================================== */}
          {/* ======================= CLIENT PROFILE ======================== */}
          {/* =============================================================== */}
          {role === 'customer' && (
            <>
              {/* Client Profile Header */}
              <View className="items-center mb-2">
                <Image
                  source={{ uri: user.avatar }}
                  className="w-20 h-20 rounded-full border-2 border-white mb-3 shadow-md"
                />
                <Text className="text-[#111827] text-2xl font-black tracking-tight">{user.name}</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">{user.email}</Text>
              </View>

              {/* Apple Wallet Membership Credit Card */}
              <View className="gap-3">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">
                  My Membership Pass
                </Text>

                <TouchableOpacity 
                  activeOpacity={0.95}
                  onPress={() => setShowInvoices(!showInvoices)}
                  className="bg-zinc-950 rounded-[30px] p-6 shadow-xl relative overflow-hidden border border-zinc-800"
                >
                  <Animated.View style={{ opacity: shimmerAnim }} className="absolute top-0 left-0 right-0 bottom-0 bg-indigo-500/10" />

                  <View className="flex-row justify-between items-start mb-6">
                    <View>
                      <Text className="text-[#06B6D4] text-[9px] font-black uppercase tracking-widest">
                        ★ VIRLA Pass (Tap to ledger)
                      </Text>
                      <Text className="text-white text-xl font-black mt-1 tracking-tight">
                        {membership.tier}
                      </Text>
                    </View>
                    {renderPassQRCode()}
                  </View>

                  <View className="h-[1px] bg-zinc-800 my-4" />

                  <View className="flex-row justify-between items-center">
                    <View className="gap-0.5">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Credits Left</Text>
                      <Text className="text-white text-base font-black">{membership.availableCredits} Credits</Text>
                    </View>
                    <View className="w-[1px] h-8 bg-zinc-850" />
                    <View className="gap-0.5">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Freeze status</Text>
                      <Text className="text-white text-base font-black">15 Days</Text>
                    </View>
                    <View className="w-[1px] h-8 bg-zinc-850" />
                    <View className="gap-0.5 items-end">
                      <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">Expiry Date</Text>
                      <Text className="text-white text-xs font-black mt-0.5">{membership.renewalDate}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Customer Ledger: Invoices Section (Feature 11) */}
              {showInvoices && (
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                  <Text className="text-[#111827] text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Customer Invoices ledger</Text>
                  
                  <View className="gap-3.5">
                    {invoices.map((inv) => (
                      <View key={inv.id} className="flex-row justify-between items-center py-2.5 border-b border-zinc-50/50 last:border-b-0">
                        <View className="flex-1 pr-3 gap-0.5">
                          <Text className="text-zinc-900 text-xs font-black leading-tight" numberOfLines={1}>{inv.type}</Text>
                          <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{inv.date} • {inv.credits} credits</Text>
                        </View>
                        <View className="items-end gap-1">
                          <Text className="text-zinc-900 text-xs font-black">{inv.amount}</Text>
                          <View className="bg-emerald-50 px-1.5 py-0.5 rounded-md">
                            <Text className="text-emerald-600 text-[7px] font-black uppercase">Paid</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Purchase Credit Packs & Memberships (Feature 11 & 12) */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Buy Packages & Upgrades</Text>
                
                {/* Credit Pack */}
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => handleBuyCredits(5, '₹4,500')}
                  className="bg-[#F8F9FB] border border-[#E5E7EB]/60 p-4 rounded-2xl flex-row justify-between items-center"
                >
                  <View className="flex-row items-center gap-3">
                    <Feather name="plus-circle" size={16} color="#4F46E5" />
                    <View>
                      <Text className="text-[#111827] text-xs font-black">Buy 5 Credit top-up</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase">Get extra credit slots</Text>
                    </View>
                  </View>
                  <Text className="text-[#4F46E5] text-xs font-black">₹4,500</Text>
                </TouchableOpacity>

                {/* Upgrade Tier */}
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => handleUpgradeMembership('Elite Master', 10, '₹8,500')}
                  className="bg-[#F8F9FB] border border-[#E5E7EB]/60 p-4 rounded-2xl flex-row justify-between items-center"
                >
                  <View className="flex-row items-center gap-3">
                    <Feather name="trending-up" size={16} color="#10B981" />
                    <View>
                      <Text className="text-[#111827] text-xs font-black">Upgrade to Elite Master</Text>
                      <Text className="text-zinc-400 text-[8px] font-bold uppercase">Add 10 credits to balance</Text>
                    </View>
                  </View>
                  <Text className="text-emerald-600 text-xs font-black">₹8,500</Text>
                </TouchableOpacity>
              </View>

              {/* Referral Dashboard Card (Feature 10) */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Referral Rewards</Text>
                <View className="flex-row justify-between items-center py-2 bg-indigo-50/40 border border-indigo-50 p-4 rounded-2xl">
                  <View className="gap-0.5 flex-1 pr-3">
                    <Text className="text-indigo-950 text-xs font-black">Invite & Earn Credits</Text>
                    <Text className="text-indigo-900 text-[9px] font-semibold mt-0.5">Friends get ₹500 off, you earn 2 free credits.</Text>
                  </View>
                  <TouchableOpacity onPress={handleCopyReferral} className="bg-zinc-900 px-3.5 py-2.5 rounded-xl flex-row items-center gap-1.5">
                    <Text className="text-white text-[8px] font-black uppercase">VIRLA50</Text>
                    <Feather name="copy" size={10} color="white" />
                  </TouchableOpacity>
                </View>

                {/* Referral stats */}
                <View className="flex-row justify-between items-center px-1">
                  <View className="gap-0.5">
                    <Text className="text-zinc-400 text-[8px] font-bold uppercase">Friends Invited</Text>
                    <Text className="text-zinc-800 text-xs font-black">3 joined</Text>
                  </View>
                  <View className="w-[1px] h-6 bg-zinc-200" />
                  <View className="gap-0.5 items-end">
                    <Text className="text-zinc-400 text-[8px] font-bold uppercase">Free Credits Earned</Text>
                    <Text className="text-emerald-600 text-xs font-black">6 Credits</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* =============================================================== */}
          {/* ======================= TRAINER PROFILE ======================= */}
          {/* =============================================================== */}
          {role === 'trainer' && (
            <>
              {/* Trainer Profile Header */}
              <View className="items-center mb-2">
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80' }}
                  className="w-20 h-20 rounded-full border-2 border-white mb-3 shadow-md"
                />
                <Text className="text-[#111827] text-2xl font-black tracking-tight">Coach Karan Sharma</Text>
                <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">Certified Trainer • Strength & HIIT</Text>
              </View>

              {/* Trainer Ledger: Earnings List (Feature 10) */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-3">Earnings & Payout Ledger</Text>
                
                <View className="gap-3.5">
                  {earningsList.map((earn) => (
                    <View key={earn.id} className="flex-row justify-between items-center py-2.5 border-b border-zinc-50/50 last:border-b-0">
                      <View className="flex-1 pr-3 gap-0.5">
                        <Text className="text-zinc-900 text-xs font-black leading-tight">
                          {earn.type === 'session' && `Visit Payout: ${earn.clientName}`}
                          {earn.type === 'no_show_compensation' && `No-Show compensation: ${earn.clientName}`}
                          {earn.type === 'penalty' && `Cancellation Penalty`}
                        </Text>
                        <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">ID: {earn.bookingId} • {earn.date}</Text>
                      </View>
                      <Text className={`text-xs font-black ${earn.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {earn.amount >= 0 ? '+' : ''}₹{earn.amount.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Safety Rules & Travel Guidelines */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Safety Guidelines</Text>
                <View className="gap-2.5 mt-1">
                  <View className="flex-row gap-2 items-start">
                    <Feather name="check" size={12} color="#10B981" className="mt-0.5" />
                    <Text className="text-[#6B7280] text-[10px] leading-relaxed flex-1">Keep client safety OTP verify check-ins active for travel authentication.</Text>
                  </View>
                  <View className="flex-row gap-2 items-start">
                    <Feather name="check" size={12} color="#10B981" className="mt-0.5" />
                    <Text className="text-[#6B7280] text-[10px] leading-relaxed flex-1">Complete mandatory post-session reports within 2 hours to release payout funds.</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Standard preferences & logout */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">App Preferences</Text>
            <View className="flex-row justify-between items-center py-1">
              <Text className="text-[#6B7280] text-xs font-semibold">Push Notifications</Text>
              <Switch value={true} trackColor={{ true: '#4F46E5' }} />
            </View>
            <View className="flex-row justify-between items-center py-1">
              <Text className="text-[#6B7280] text-xs font-semibold">Concierge AI Reminders</Text>
              <Switch value={true} trackColor={{ true: '#4F46E5' }} />
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Alert.alert('Logout', 'Session logout simulated successfully.')}
            className="w-full bg-[#111827] py-4 rounded-2xl items-center justify-center shadow-xs mt-2"
          >
            <Text className="text-white text-xs font-extrabold uppercase tracking-widest text-center">Logout Account</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return <View className="flex-1 bg-[#F8F9FB] pt-12">{children}</View>;
  }
  return <View className="flex-1 bg-[#F8F9FB]">{children}</View>;
}
