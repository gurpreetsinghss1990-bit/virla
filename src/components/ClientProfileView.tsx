import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather, Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Path, Polygon, Polyline } from 'react-native-svg';
import { AvatarImage } from './AvatarImage';
import { NativeGoalChip } from './NativeGoalChip';
import { NativePressable } from './NativePressable';
import { LuxuryCard } from './LuxuryCard';
import { formatToDDMMYYYY } from '../utils/date';

export interface ClientProfileViewProps {
  insetsTop: number;
  isHeaderCollapsed: boolean;
  setIsHeaderCollapsed: (collapsed: boolean) => void;
  handleLogout: () => void;
  openEditProfileModal: () => void;
  profile: any;
  user: any;
  isWildcardTestAccount: (user: any, mobile?: string) => boolean;
  handleRoleChange: (role: 'customer' | 'trainer' | 'admin') => void;
  triggerSparkleAnimation: () => void;
  sparkleAnim: Animated.Value;
  creditBalance: number | null;
  membership: any;
  triggerLayersAnimation: () => void;
  layer1Anim: Animated.Value;
  layer2Anim: Animated.Value;
  layer3Anim: Animated.Value;
  isLayersAnimating: boolean;
  creditLots: any[];
  navigateThrottled: (route: string) => void;
  togglePersonalInfoExpansion: (val?: boolean) => void;
  isPersonalInfoExpanded: boolean;
  setIsGoalsModalVisible: (visible: boolean) => void;
  allFitnessGoals: string[];
  hasApplied: boolean;
  userApplication: any;
}

export const ClientProfileView: React.FC<ClientProfileViewProps> = React.memo(({
  insetsTop,
  isHeaderCollapsed,
  setIsHeaderCollapsed,
  handleLogout,
  openEditProfileModal,
  profile,
  user,
  isWildcardTestAccount,
  handleRoleChange,
  triggerSparkleAnimation,
  sparkleAnim,
  creditBalance,
  membership,
  triggerLayersAnimation,
  layer1Anim,
  layer2Anim,
  layer3Anim,
  isLayersAnimating,
  creditLots,
  navigateThrottled,
  togglePersonalInfoExpansion,
  isPersonalInfoExpanded,
  setIsGoalsModalVisible,
  allFitnessGoals,
  hasApplied,
  userApplication,
}) => {
  return (
    <FlashList
      data={[1]}
      keyExtractor={() => 'client-profile'}
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      scrollEventThrottle={32}
      removeClippedSubviews={false}
      onScroll={(e) => {
        const collapsed = e.nativeEvent.contentOffset.y > 60;
        if (collapsed !== isHeaderCollapsed) setIsHeaderCollapsed(collapsed);
      }}
      className="flex-1 bg-transparent"
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insetsTop + 62, paddingBottom: 140 }}
      ListFooterComponent={
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          className="bg-rose-50 border border-rose-200/70 px-8 py-3.5 rounded-full flex-row justify-center items-center self-center mt-6 mb-24 gap-2"
        >
          <Feather name="log-out" size={15} color="#E11D48" style={{ transform: [{ rotate: '-90deg' }] }} />
          <Text className="text-rose-600 text-xs font-bold uppercase tracking-wider">Sign Out</Text>
        </TouchableOpacity>
      }
      renderItem={() => (
        <>
          {/* User Hero Section */}
          <View className="flex-row items-center gap-4 mb-6 z-10">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openEditProfileModal}
              className="relative"
            >
              <View className="w-[78px] h-[78px] rounded-full p-[2.5px] border-2 border-[#F59E0B] bg-white">
                <AvatarImage
                  uri={profile.avatar || user?.avatar}
                  gender={(profile.gender || (user as any)?.gender) as string}
                  style={{ width: '100%', height: '100%', borderRadius: 999 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              </View>
              <View className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-rose-500 border-2 border-white items-center justify-center">
                <Feather name="camera" size={11} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <View className="flex-1">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-[#101828] text-2xl font-black tracking-tight">
                  {profile.name || user?.name || 'User'}
                </Text>
                <View className="bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                  <MaterialCommunityIcons name="crown" size={11} color="#D97706" />
                  <Text className="text-[#D97706] text-[9px] font-black uppercase tracking-wider">ELITE MEMBER</Text>
                </View>
              </View>
              <Text className="text-[#64748B] text-xs font-semibold mt-1">
                Stronger   •   Healthier   •   Happier
              </Text>

              {/* Go to Trainer Mode Button for Wildcard Accounts */}
              {user?.role !== 'admin' && (user?.role === 'trainer' || isWildcardTestAccount(user, profile?.mobile)) && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleRoleChange('trainer')}
                  className="mt-2.5 bg-[#101828] border border-zinc-800 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 self-start"
                >
                  <Feather name="repeat" size={11} color="#F5B942" />
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider">
                    Go to Trainer Mode
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Luxury Virla Pass Card */}
          <View
            className="bg-[#0B1528] rounded-[26px] p-5 shadow-xl relative overflow-hidden mb-5 border border-[#1E293B]"
          >
            {/* Subtle wave lines on dark card */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <Svg width="100%" height="100%" viewBox="0 0 320 160" fill="none">
                <Path d="M 110 160 C 170 120 220 60 320 40" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.18" />
                <Path d="M 130 160 C 180 125 230 70 320 55" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.14" />
                <Path d="M 150 160 C 195 130 240 80 320 70" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.10" />
                <Path d="M 170 160 C 210 135 250 90 320 85" stroke="#38BDF8" strokeWidth="0.8" strokeOpacity="0.08" />
              </Svg>
            </View>

            <View className="flex-row justify-between items-start">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={triggerSparkleAnimation}
              >
                <View className="flex-row items-center">
                  <Animated.View
                    style={{
                      transform: [
                        {
                          scale: sparkleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.35],
                          }),
                        },
                        {
                          rotate: sparkleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '25deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    <Ionicons name="sparkles" size={11} color="#2DD4BF" />
                  </Animated.View>
                  <Text className="text-[#2DD4BF] text-[9px] font-black uppercase tracking-widest ml-1">
                    VIRLA PASS
                  </Text>
                </View>
                {(() => {
                  const bal = creditBalance ?? (profile as { creditsBalance?: number }).creditsBalance ?? membership.availableCredits ?? 0;
                  let passTier = 'STANDARD';
                  let passColor = '#FFFFFF';

                  if (bal <= 0) {
                    passTier = 'STANDARD';
                    passColor = '#94A3B8';
                  } else if (bal >= 15) {
                    passTier = 'ELITE';
                    passColor = '#FACC15'; // Vibrant Bright Yellow
                  } else if (bal >= 12) {
                    passTier = 'ACTIVE PASS';
                    passColor = '#38BDF8'; // Sky Blue
                  } else if (bal >= 8) {
                    passTier = 'STARTER PASS';
                    passColor = '#A78BFA'; // Purple
                  } else {
                    const status = ((profile as { membershipStatus?: string }).membershipStatus || membership.tier || '').trim().toUpperCase();
                    passTier = (status && status !== 'STANDARD' && status !== 'NONE') ? status : 'PREMIUM';
                    passColor = '#34D399'; // Emerald
                  }

                  return (
                    <Text style={{ color: passColor }} className="text-2xl font-black mt-1 tracking-tight">
                      {passTier}
                    </Text>
                  );
                })()}
              </TouchableOpacity>
              <View className="bg-white p-1.5 rounded-xl">
                <Ionicons name="qr-code" size={32} color="#0B1528" />
              </View>
            </View>

            <View className="flex-row justify-between items-end mt-5 pt-3 border-t border-zinc-800/60">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={triggerLayersAnimation}
                className="flex-row items-center py-1"
              >
                <View style={{ width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }}>
                  {/* Layer 1 (Top diamond) */}
                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      transform: [{ translateY: layer1Anim }],
                    }}
                  >
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                      <Polygon
                        points="12 2 2 7 12 12 22 7 12 2"
                        stroke={isLayersAnimating ? '#EF4444' : '#CBD5E1'}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Animated.View>

                  {/* Layer 2 (Middle chevron) */}
                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      transform: [{ translateY: layer2Anim }],
                    }}
                  >
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                      <Polyline
                        points="2 12 12 17 22 12"
                        stroke={isLayersAnimating ? '#EF4444' : '#CBD5E1'}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Animated.View>

                  {/* Layer 3 (Bottom chevron) */}
                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      transform: [{ translateY: layer3Anim }],
                    }}
                  >
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                      <Polyline
                        points="2 17 12 22 22 17"
                        stroke={isLayersAnimating ? '#EF4444' : '#CBD5E1'}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Animated.View>
                </View>

                <Text className="text-white text-sm font-black ml-2">
                  {creditBalance ?? (profile as { creditsBalance?: number }).creditsBalance ?? membership.availableCredits ?? 0} Credits
                </Text>
              </TouchableOpacity>

              <View className="w-[1px] h-7 bg-zinc-700/60 mx-2" />

              <View className="items-end">
                <Text className="text-[#94A3B8] text-[9px] font-bold uppercase tracking-wider">
                  Valid till
                </Text>
                <Text className="text-white text-xs font-bold mt-0.5">
                  {(() => {
                    const bal = creditBalance ?? (profile as { creditsBalance?: number }).creditsBalance ?? membership.availableCredits ?? 0;
                    if (bal <= 0) return 'Not Active';
                    const activeLot = creditLots?.find((l: any) => l.remaining_credits > 0 && l.official_expiry_date);
                    if (activeLot?.official_expiry_date) {
                      return formatToDDMMYYYY(activeLot.official_expiry_date);
                    }
                    return membership.renewalDate && membership.renewalDate !== 'Not Active'
                      ? membership.renewalDate
                      : 'Active';
                  })()}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => navigateThrottled('/wallet')}
                  className="flex-row items-center gap-1 mt-1.5 py-0.5"
                >
                  <Text className="text-[#2DD4BF] text-xs font-black">View Wallet</Text>
                  <Feather name="arrow-right" size={11} color="#2DD4BF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 1. Personal Information Accordion Card */}
          <View className="bg-white border border-[#E5E7EB] rounded-[24px] p-5 mb-4">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => togglePersonalInfoExpansion()}
              className={`flex-row justify-between items-center ${isPersonalInfoExpanded ? 'mb-2 pb-2.5 border-b border-zinc-100' : ''}`}
            >
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center">
                  <Feather name="user" size={17} color="#475569" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#101828] text-sm font-black tracking-tight">Personal Information</Text>
                  <Text className="text-[#94A3B8] text-[11px] font-semibold mt-0.5">
                    {isPersonalInfoExpanded ? 'Tap to wrap / collapse' : `${profile.name || user?.name || 'User'} • Tap to view all details`}
                  </Text>
                </View>
              </View>

              <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
                <Feather name={isPersonalInfoExpanded ? "chevron-up" : "chevron-down"} size={16} color="#475569" />
              </View>
            </TouchableOpacity>

            {isPersonalInfoExpanded && (
              <View className="gap-2.5 pt-2">
                {/* Sub-header inside Dropdown with Edit button */}
                <View className="flex-row justify-between items-center pb-2.5 border-b border-zinc-100">
                  <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Profile Details</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={openEditProfileModal}
                    className="flex-row items-center gap-1.5 bg-zinc-900 px-3 py-1 rounded-lg"
                  >
                    <Feather name="edit-2" size={11} color="#FFFFFF" />
                    <Text className="text-white text-xs font-semibold">Edit</Text>
                  </TouchableOpacity>
                </View>
                {/* Full Name */}
                <TouchableOpacity activeOpacity={0.6} onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="user" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Full Name</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-zinc-900 text-xs font-semibold">{profile.name || user?.name || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </TouchableOpacity>

                {/* Mobile Number */}
                <TouchableOpacity activeOpacity={0.6} onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="phone" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Mobile Number</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-zinc-900 text-xs font-semibold">
                      {profile.mobile ? profile.mobile.replace(/^\+?91\s*/, '') : (user?.phone ? user.phone.replace(/^\+?91\s*/, '') : 'Not set')}
                    </Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </TouchableOpacity>

                {/* Email address */}
                <TouchableOpacity activeOpacity={0.6} onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="mail" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Email address</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-zinc-900 text-xs font-semibold">{profile.email || user?.email || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </TouchableOpacity>

                {/* Gender */}
                <TouchableOpacity activeOpacity={0.6} onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="male-female-outline" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Gender</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-zinc-900 text-xs font-semibold capitalize">{profile.gender || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </TouchableOpacity>

                {/* Date of Birth */}
                <TouchableOpacity activeOpacity={0.6} onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="calendar" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Date of Birth</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-zinc-900 text-xs font-semibold">{profile.dob || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </TouchableOpacity>

                {/* Height */}
                <TouchableOpacity activeOpacity={0.6} onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="resize-outline" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Height</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-zinc-900 text-xs font-semibold">
                      {profile.height ? (profile.height.includes('cm') ? profile.height : `${profile.height} cm`) : 'Not set'}
                    </Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </TouchableOpacity>

                {/* Weight */}
                <TouchableOpacity activeOpacity={0.6} onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="barbell-outline" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Weight</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-zinc-900 text-xs font-semibold">
                      {profile.weight ? (profile.weight.includes('kg') ? profile.weight : `${profile.weight} kg`) : 'Not set'}
                    </Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </TouchableOpacity>

                {/* Fitness Level */}
                <TouchableOpacity activeOpacity={0.6} onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="trending-up" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Fitness Level</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-zinc-900 text-xs font-semibold">{profile.fitnessLevel || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </TouchableOpacity>

                {/* Area */}
                <TouchableOpacity activeOpacity={0.6} onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="map-pin" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Area</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-zinc-900 text-xs font-semibold">{profile.city || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </TouchableOpacity>

                {/* Member Since */}
                <View className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="clock" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Member Since</Text>
                  </View>
                  <Text className="text-zinc-900 text-xs font-semibold pr-2">{profile.memberSince || 'Sep 2024'}</Text>
                </View>

                {/* Total Sessions Completed */}
                <View className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="check-circle" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Completed Sessions</Text>
                  </View>
                  <Text className="text-zinc-900 text-xs font-semibold pr-2">{profile.totalSessions || 0} Sessions</Text>
                </View>

                {/* Total Calories Burned */}
                <View className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="zap" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Calories Burned</Text>
                  </View>
                  <Text className="text-zinc-900 text-xs font-semibold pr-2">{(profile.totalCalories || 0).toLocaleString()} kcal</Text>
                </View>

                {/* Lifetime Spendings */}
                <View className="flex-row items-center justify-between py-2">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="wallet-outline" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Lifetime Spendings</Text>
                  </View>
                  <Text className="text-zinc-900 text-xs font-semibold pr-2">{profile.lifetimeSpend || '₹0'}</Text>
                </View>

                {/* Bottom Collapse Toggle */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => togglePersonalInfoExpansion(false)}
                  className="flex-row items-center justify-center gap-1.5 py-2.5 mt-2 border-t border-zinc-100"
                >
                  <Feather name="chevron-up" size={14} color="#71717A" />
                  <Text className="text-zinc-600 text-xs font-semibold">Wrap / Collapse</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 2. Fitness Goals Card */}
          <View className="bg-white border border-[#E5E7EB] rounded-[24px] p-5 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[#101828] text-sm font-black tracking-tight">Fitness Goals</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsGoalsModalVisible(true)}
                className="flex-row items-center gap-1.5"
              >
                <Feather name="edit-2" size={12} color="#475569" />
                <Text className="text-[#475569] text-xs font-bold">Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Goal Chips */}
            {(() => {
              const isFemale = (profile.gender || '').trim().toLowerCase() === 'female';
              const availableGoals = allFitnessGoals.filter((g) => g !== 'Post Pregnancy' || isFemale);
              const rawUserGoals = Array.isArray(profile.selectedGoals) ? profile.selectedGoals : [];
              const userSelectedGoals = rawUserGoals.filter((g: string) => availableGoals.includes(g));
              const unselectedGoals = availableGoals.filter((g) => !userSelectedGoals.includes(g));
              const displayGoals = [...userSelectedGoals, ...unselectedGoals].slice(0, 6);

              return (
                <View className="flex-row flex-wrap gap-x-2 gap-y-1.5 mb-3.5">
                  {displayGoals.map((goal, idx) => {
                    const isSelected = userSelectedGoals.includes(goal);
                    return (
                      <NativeGoalChip
                        key={`${goal}-${idx}`}
                        label={goal}
                        selected={isSelected}
                        onPress={() => setIsGoalsModalVisible(true)}
                      />
                    );
                  })}
                </View>
              );
            })()}

            {/* Motivational Banner */}
            <View className="rounded-2xl overflow-hidden bg-emerald-500/10 border border-emerald-500/20">
              <NativePressable
                rippleColor="rgba(16, 185, 129, 0.2)"
                onPress={() => setIsGoalsModalVisible(true)}
                className="p-3.5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center">
                    <Ionicons name="sparkles" size={16} color="#059669" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-emerald-950 text-xs font-black">Your fitness journey matters.</Text>
                    <Text className="text-emerald-700 text-[11px] font-medium mt-0.5">
                      Let&apos;s set your goals for better results.
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color="#059669" />
              </NativePressable>
            </View>
          </View>

          {/* Become a Trainer Option */}
          {user?.role !== 'trainer' && !hasApplied && (
            <View className="mb-4">
              <LuxuryCard
                className="p-5 bg-zinc-950 border border-zinc-800 shadow-md rounded-[24px]"
                onPress={() => navigateThrottled('/trainer-application')}
              >
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <View className="gap-0.5">
                      <Text className="text-[#E11D48] text-[8px] font-black uppercase tracking-widest">Join our team</Text>
                      <Text className="text-white text-sm font-black tracking-tight">Become a VIRLA Trainer</Text>
                    </View>
                    <View className="w-7 h-7 rounded-full bg-[#E11D48] items-center justify-center shadow-md">
                      <Feather name="arrow-right" size={12} color="white" />
                    </View>
                  </View>

                  <Text className="text-zinc-400 text-xs font-semibold leading-relaxed">
                    Train on your schedule. Grow your client base. Keep more of what you earn.
                  </Text>
                </View>
              </LuxuryCard>
            </View>
          )}

          {/* Trainer Application Tracker */}
          {user?.role !== 'trainer' && hasApplied && userApplication && (
            <View className="mb-4">
              <LuxuryCard
                className={`p-4 border rounded-[24px] ${
                  userApplication.status === 'approved' ? 'bg-emerald-50 border-emerald-200' :
                  userApplication.status === 'interview_scheduled' ? 'bg-amber-50/70 border-amber-300' :
                  userApplication.status === 'rejected' ? 'bg-rose-50 border-rose-200' :
                  userApplication.status === 'info_requested' ? 'bg-amber-50 border-amber-200' :
                  'bg-[#F7F8FC] border-zinc-200'
                }`}
                onPress={() => navigateThrottled('/trainer-application')}
              >
                <View className="flex-row items-center justify-between w-full">
                  <View className="flex-1 pr-4 gap-1">
                    <Text className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Trainer Application</Text>
                    <View className="flex-row items-center gap-1.5 mt-0.5">
                      {userApplication.status === 'interview_scheduled' && (
                        <View className="px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-full flex-row items-center gap-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          <Text className="text-amber-900 text-[8px] font-black uppercase tracking-wider">You are called for physical interview</Text>
                        </View>
                      )}
                      {userApplication.status === 'pending' && (
                        <View className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full flex-row items-center gap-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <Text className="text-emerald-800 text-[8px] font-black uppercase tracking-wider">Under Review</Text>
                        </View>
                      )}
                      {userApplication.status === 'info_requested' && (
                        <View className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full flex-row items-center gap-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <Text className="text-amber-800 text-[8px] font-black uppercase tracking-wider">Info Required</Text>
                        </View>
                      )}
                      {userApplication.status === 'rejected' && (
                        <View className="px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-full flex-row items-center gap-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <Text className="text-rose-800 text-[8px] font-black uppercase tracking-wider">Rejected</Text>
                        </View>
                      )}
                      {userApplication.status === 'approved' && (
                        <View className="gap-1 mt-0.5">
                          <View className="px-2.5 py-1 bg-emerald-100 border border-emerald-300 rounded-full flex-row items-center gap-1 self-start">
                            <View className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <Text className="text-emerald-900 text-[8px] font-black uppercase tracking-wider">Application Approved ✓</Text>
                          </View>
                          <Text className="text-emerald-800 text-[9.5px] font-black leading-tight mt-1">
                            Please sign out for new experience. You are a trainer now.
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color="#6B7280" />
                </View>
              </LuxuryCard>
            </View>
          )}
        </>
      )}
    />
  );
});

