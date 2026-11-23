import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Reanimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  withSequence, 
  Easing, 
  runOnJS,
  LinearTransition,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Path, Polygon, Polyline, Defs, LinearGradient, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import { AvatarImage } from './AvatarImage';
import { NativeGoalChip } from './NativeGoalChip';
import { NativePressable } from './NativePressable';
import { LuxuryCard } from './LuxuryCard';
import { formatToDDMMYYYY } from '../utils/date';
import { softShadow } from '../utils/shadows';

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
  creditBalance: number | null;
  membership: any;
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
  creditBalance,
  membership,
  creditLots,
  navigateThrottled,
  togglePersonalInfoExpansion,
  isPersonalInfoExpanded,
  setIsGoalsModalVisible,
  allFitnessGoals,
  hasApplied,
  userApplication,
}) => {
  // Reanimated UI-thread values for Credits stacked layers bounce
  const layer1Y = useSharedValue(0);
  const layer2Y = useSharedValue(0);
  const layer3Y = useSharedValue(0);
  const creditsScale = useSharedValue(1);
  const [isReanimatedLayersActive, setIsReanimatedLayersActive] = React.useState(false);

  // Reanimated UI-thread sparkle/rotation for VIRLA PASS badge
  const sparkleProgress = useSharedValue(0);
  const sparkleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + sparkleProgress.value * 0.35 },
      { rotate: `${sparkleProgress.value * 25}deg` },
    ],
  }));

  const handleSparklePress = React.useCallback(() => {
    sparkleProgress.value = withSequence(
      withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 10, stiffness: 180 })
    );
  }, [sparkleProgress]);

  const layer1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: layer1Y.value }],
  }));

  const layer2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: layer2Y.value }],
  }));

  const layer3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: layer3Y.value }],
  }));

  const creditsContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: creditsScale.value }],
  }));

  const playCreditsLayerBounce = React.useCallback(() => {
    // Step 1: Top layer drops and impacts
    layer1Y.value = withSequence(
      withTiming(4, { duration: 110, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      withTiming(5.5, { duration: 80 }),
      withSpring(0, { damping: 9, stiffness: 180, mass: 0.7 })
    );

    // Step 2: Middle layer receives shockwave and springs
    layer2Y.value = withSequence(
      withTiming(0, { duration: 70 }),
      withTiming(3, { duration: 110, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      withSpring(0, { damping: 10, stiffness: 170, mass: 0.7 })
    );

    // Step 3: Bottom layer absorbs
    layer3Y.value = withSequence(
      withTiming(0, { duration: 120 }),
      withTiming(1.5, { duration: 80 }),
      withSpring(0, { damping: 11, stiffness: 160, mass: 0.7 }, (finished) => {
        if (finished) {
          runOnJS(setIsReanimatedLayersActive)(false);
        }
      })
    );

    // Step 4: Gentle tactile scale on the whole credits badge
    creditsScale.value = withSequence(
      withTiming(0.95, { duration: 90 }),
      withSpring(1.04, { damping: 10, stiffness: 220 }),
      withSpring(1, { damping: 12, stiffness: 180 })
    );

    setIsReanimatedLayersActive(true);
  }, [layer1Y, layer2Y, layer3Y, creditsScale]);

  const handleCreditsPress = React.useCallback(() => {
    playCreditsLayerBounce();
  }, [playCreditsLayerBounce]);

  return (
    <Reanimated.ScrollView
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      scrollEventThrottle={16}
      decelerationRate={0.96}
      bounces={true}
      alwaysBounceVertical={true}
      onScroll={(e) => {
        const collapsed = e.nativeEvent.contentOffset.y > 60;
        if (collapsed !== isHeaderCollapsed) setIsHeaderCollapsed(collapsed);
      }}
      className="flex-1 bg-transparent"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insetsTop + 14, paddingBottom: 140 }}
    >
      {/* Top Navigation Bar from Stitch code.html */}
          <View className="flex-row items-center justify-between pb-3 pt-1 z-20">
            <View className="flex-row items-center gap-1.5">
              <Text 
                style={{ fontFamily: 'Outfit_700Bold' }} 
                className="text-xs uppercase tracking-widest text-slate-400 font-bold"
              >
                VIRLA ATHLETIC
              </Text>
              <View className="w-1.5 h-1.5 rounded-full bg-[#E11D48] mb-0.5" />
            </View>
          </View>

          {/* User Hero Section */}
          <View className="flex-row items-center gap-4 mb-5 z-10">
            <Pressable
              onPress={openEditProfileModal}
              className="relative"
            >
              <View 
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...softShadow({ color: '#F59E0B', opacity: 0.25, radius: 8, offsetY: 3 }),
                }}
              >
                <Svg width={84} height={84} style={{ position: 'absolute', top: 0, left: 0 }}>
                  <Defs>
                    <LinearGradient id="avatarBorderGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor="#FBBF24" />
                      <Stop offset="50%" stopColor="#E11D48" />
                      <Stop offset="100%" stopColor="#FCD34D" />
                    </LinearGradient>
                  </Defs>
                  <Circle cx={42} cy={42} r={40.5} stroke="url(#avatarBorderGrad)" strokeWidth={3} fill="none" />
                </Svg>
                <View style={{ width: 76, height: 76, borderRadius: 38, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#0F172A' }}>
                  <AvatarImage
                    uri={profile.avatar || user?.avatar}
                    gender={(profile.gender || (user as any)?.gender) as string}
                    style={{ width: '100%', height: '100%', borderRadius: 38 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                </View>
              </View>
              <View 
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#E11D48',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...softShadow({ color: '#E11D48', opacity: 0.4, radius: 4, offsetY: 2 }),
                }}
              >
                <Feather name="camera" size={11} color="#FFFFFF" />
              </View>
            </Pressable>

            <View className="flex-1">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text 
                  style={{ fontFamily: 'Outfit_700Bold' }} 
                  className="text-[#0F172A] text-2xl font-bold tracking-tight"
                >
                  {profile.name || user?.name || 'User'}
                </Text>
                {/* Gold Elite Member Pill Badge */}
                <View 
                  style={{
                    backgroundColor: '#FEF3C7',
                    borderWidth: 1,
                    borderColor: 'rgba(251, 191, 36, 0.8)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 9999,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <MaterialCommunityIcons name="crown" size={11} color="#B45309" />
                  <Text 
                    style={{ fontFamily: 'Outfit_700Bold' }} 
                    className="text-[#B45309] text-[9.5px] uppercase tracking-wide"
                  >
                    ELITE MEMBER
                  </Text>
                </View>
              </View>

              <Text 
                style={{ fontFamily: 'Outfit_500Medium' }} 
                className="text-[#64748B] text-xs mt-0.5"
              >
                Stronger • Healthier • Happier
              </Text>

              {/* Active Concierge Tier pill */}
              <View className="flex-row items-center gap-2 mt-2">
                <View 
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: 'rgba(226, 232, 240, 0.8)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <View className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  <Text 
                    style={{ fontFamily: 'Outfit_600SemiBold' }} 
                    className="text-[#475569] text-[10.5px]"
                  >
                    Active Concierge Tier
                  </Text>
                </View>
              </View>

              {/* Go to Trainer Mode Button for Wildcard Accounts */}
              {user?.role !== 'admin' && (user?.role === 'trainer' || isWildcardTestAccount(user, profile?.mobile)) && (
                <Pressable
                  onPress={() => handleRoleChange('trainer')}
                  className="mt-2.5 bg-[#101828] border border-zinc-800 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 self-start"
                >
                  <Feather name="repeat" size={11} color="#F5B942" />
                  <Text className="text-white text-[10px] font-black uppercase tracking-wider">
                    Go to Trainer Mode
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Luxury Virla Pass Card matching Stitch & reference image */}
          <View
            style={{
              borderRadius: 24,
              padding: 20,
              borderWidth: 2,
              borderColor: 'rgba(15, 23, 42, 0.7)',
              position: 'relative',
              overflow: 'hidden',
              marginBottom: 16,
              ...softShadow({ color: '#0F172A', opacity: 0.1, radius: 14, offsetY: 4 }),
            }}
          >
            {/* Frosted Champagne Glass Gradient Background (Translucent to let botanical background shine through) */}
            <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <Defs>
                <LinearGradient id="passCardBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FEF3C7" stopOpacity={0.55} />
                  <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0.4} />
                  <Stop offset="100%" stopColor="#F8FAFC" stopOpacity={0.48} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#passCardBg)" />
            </Svg>

            {/* Repeating Radial Wave Lines Texture from code.html (.wave-lines) */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <Svg width="100%" height="100%" viewBox="0 0 320 160" fill="none">
                {/* Concentric elliptical wave texture expanding from bottom-left */}
                {[30, 54, 78, 102, 126, 150, 174, 198, 222, 246, 270, 294, 318, 342].map((r, i) => (
                  <Circle
                    key={i}
                    cx={0}
                    cy={160}
                    r={r}
                    stroke="rgba(56, 189, 248, 0.16)"
                    strokeWidth={1}
                    fill="none"
                  />
                ))}
                {/* Flowing dashed curve splines */}
                <Path d="M 0 160 C 80 140 160 80 320 20" stroke="rgba(13, 148, 136, 0.22)" strokeWidth="1" strokeDasharray="2.5,3" />
                <Path d="M 0 130 C 100 115 190 60 320 40" stroke="rgba(13, 148, 136, 0.18)" strokeWidth="1" strokeDasharray="2.5,3" />
                <Path d="M 0 100 C 120 90 220 40 320 60" stroke="rgba(13, 148, 136, 0.14)" strokeWidth="1" strokeDasharray="2.5,3" />
              </Svg>
            </View>

            {/* Subtle Rose / Red Radial Glow Aura behind QR Code (top-right corner matching code.html bg-rose-600/10) */}
            <View pointerEvents="none" style={{ position: 'absolute', top: -35, right: -35, width: 175, height: 175 }}>
              <Svg width="100%" height="100%" viewBox="0 0 175 175">
                <Defs>
                  <RadialGradient id="passCardRoseGlow" cx="62%" cy="38%" r="62%" fx="62%" fy="38%">
                    <Stop offset="0%" stopColor="#E11D48" stopOpacity={0.24} />
                    <Stop offset="35%" stopColor="#F43F5E" stopOpacity={0.16} />
                    <Stop offset="70%" stopColor="#FDA4AF" stopOpacity={0.07} />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect width="175" height="175" fill="url(#passCardRoseGlow)" />
              </Svg>
            </View>

            {/* Header: Pass Title + QR scan trigger */}
            <View className="flex-row justify-between items-start z-10">
              <Pressable
                onPress={handleSparklePress}
              >
                <View className="flex-row items-center gap-1.5">
                  <Reanimated.View style={sparkleAnimatedStyle}>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                  </Reanimated.View>
                  <Text 
                    style={{ fontFamily: 'Outfit_700Bold' }} 
                    className="text-[#F59E0B] text-[11px] font-bold uppercase tracking-wider"
                  >
                    VIRLA PASS
                  </Text>
                </View>

                {(() => {
                  const bal = creditBalance ?? (profile as { creditsBalance?: number }).creditsBalance ?? membership.availableCredits ?? 0;
                  let passTier = 'STANDARD';
                  let passColor = '#F59E0B';

                  if (bal <= 0) {
                    passTier = 'STANDARD';
                    passColor = '#94A3B8';
                  } else if (bal >= 15) {
                    passTier = 'ELITE';
                    passColor = '#F59E0B';
                  } else if (bal >= 12) {
                    passTier = 'ACTIVE PASS';
                    passColor = '#D97706';
                  } else if (bal >= 8) {
                    passTier = 'STARTER PASS';
                    passColor = '#D97706';
                  } else {
                    const status = ((profile as { membershipStatus?: string }).membershipStatus || membership.tier || '').trim().toUpperCase();
                    passTier = (status && status !== 'STANDARD' && status !== 'NONE') ? status : 'PREMIUM';
                    passColor = '#F59E0B';
                  }

                  return (
                    <Text 
                      style={{ fontFamily: 'Outfit_800ExtraBold', color: passColor }} 
                      className="text-2xl mt-0.5 tracking-wider font-extrabold"
                    >
                      {passTier}
                    </Text>
                  );
                })()}
              </Pressable>

              {/* QR Code button matching Stitch code.html */}
              <Pressable
                onPress={() => navigateThrottled('/wallet')}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: 'rgba(226, 232, 240, 0.9)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...softShadow({ color: '#0F172A', opacity: 0.08, radius: 8, offsetY: 2 }),
                }}
              >
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={3} width={7} height={7} rx={1.8} stroke="#0F172A" strokeWidth={2.4} />
                  <Rect x={14} y={3} width={7} height={7} rx={1.8} stroke="#0F172A" strokeWidth={2.4} />
                  <Rect x={14} y={14} width={7} height={7} rx={1.8} stroke="#0F172A" strokeWidth={2.4} />
                  <Path d="M3 14h3v3H3zM7 17h3v3H7zM3 18h1v3H3zM10 14h1v1h-1zM18 10v1h1v-1z" stroke="#0F172A" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
            </View>

            {/* Hairline Divider with gradient feel from code.html */}
            <View 
              style={{
                height: 1,
                width: '100%',
                backgroundColor: 'rgba(15, 23, 42, 0.12)',
                marginVertical: 14,
              }}
            />

            {/* Bottom Credits & Validity Row */}
            <View className="flex-row justify-between items-end z-10 pt-0.5">
              <Pressable
                onPress={handleCreditsPress}
                className="flex-row items-center"
              >
                <Reanimated.View
                  style={[
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                    },
                    creditsContainerAnimatedStyle,
                  ]}
                >
                  <View 
                    style={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: 8, 
                      backgroundColor: 'rgba(255, 255, 255, 0.85)', 
                      borderWidth: 1,
                      borderColor: 'rgba(15, 23, 42, 0.08)',
                      justifyContent: 'center', 
                      alignItems: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Layer 1: Top diamond polygon */}
                    <Reanimated.View
                      style={[
                        {
                          position: 'absolute',
                          top: 5,
                          left: 5,
                        },
                        layer1Style,
                      ]}
                    >
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                        <Polygon
                          points="12 2 2 7 12 12 22 7 12 2"
                          stroke={isReanimatedLayersActive ? '#E11D48' : '#0F172A'}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </Reanimated.View>

                    {/* Layer 2: Middle chevron polyline */}
                    <Reanimated.View
                      style={[
                        {
                          position: 'absolute',
                          top: 5,
                          left: 5,
                        },
                        layer2Style,
                      ]}
                    >
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                        <Polyline
                          points="2 12 12 17 22 12"
                          stroke={isReanimatedLayersActive ? '#E11D48' : '#0F172A'}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </Reanimated.View>

                    {/* Layer 3: Bottom chevron polyline */}
                    <Reanimated.View
                      style={[
                        {
                          position: 'absolute',
                          top: 5,
                          left: 5,
                        },
                        layer3Style,
                      ]}
                    >
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                        <Polyline
                          points="2 17 12 22 22 17"
                          stroke={isReanimatedLayersActive ? '#E11D48' : '#0F172A'}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </Reanimated.View>
                  </View>

                  <View className="ml-2.5">
                    <Text 
                      style={{ 
                        fontFamily: 'Outfit_700Bold',
                        color: '#0F172A',
                      }} 
                      className="text-xl font-bold tracking-tight"
                    >
                      {creditBalance ?? (profile as { creditsBalance?: number }).creditsBalance ?? membership.availableCredits ?? 0} Credits
                    </Text>
                    <Text 
                      style={{ fontFamily: 'Outfit_500Medium' }} 
                      className="text-[#64748B] text-[10px] mt-0.5"
                    >
                      Concierge Sessions
                    </Text>
                  </View>
                </Reanimated.View>
              </Pressable>

              <View className="items-end">
                <Text 
                  style={{ fontFamily: 'Outfit_700Bold' }} 
                  className="text-slate-500 text-[10px] uppercase tracking-wider"
                >
                  VALID TILL
                </Text>
                <Text 
                  style={{ fontFamily: 'Outfit_600SemiBold' }} 
                  className="text-slate-700 text-xs font-semibold mt-0.5"
                >
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
                <Pressable
                  onPress={() => navigateThrottled('/wallet')}
                  className="flex-row items-center gap-1 mt-1"
                >
                  <Text 
                    style={{ fontFamily: 'Outfit_700Bold' }} 
                    className="text-[#E11D48] text-xs font-bold"
                  >
                    View Wallet
                  </Text>
                  <Feather name="arrow-right" size={13} color="#E11D48" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* 1. Personal Information Accordion Card */}
          <View 
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(226, 232, 240, 0.8)',
              marginBottom: 16,
              ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
            }}
          >
            <Pressable
              onPress={() => togglePersonalInfoExpansion()}
              className={`flex-row justify-between items-center ${isPersonalInfoExpanded ? 'mb-2 pb-3 border-b border-slate-100' : ''}`}
            >
              <View className="flex-row items-center gap-3.5 flex-1">
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="user" size={18} color="#64748B" />
                </View>
                <View className="flex-1">
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-sm font-bold tracking-tight">
                    Personal Information
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-400 text-xs mt-0.5">
                    {isPersonalInfoExpanded ? 'Tap to wrap / collapse' : `${profile.name || user?.name || 'User'} • Tap to view all details`}
                  </Text>
                </View>
              </View>

              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={isPersonalInfoExpanded ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" />
              </View>
            </Pressable>

            {isPersonalInfoExpanded && (
              <Reanimated.View 
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(120)}
                layout={LinearTransition.duration(200)}
                className="gap-2.5 pt-2"
              >
                {/* Sub-header inside Dropdown with Edit button */}
                <View className="flex-row justify-between items-center pb-2.5 border-b border-zinc-100">
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-500 text-xs uppercase tracking-wider">Profile Details</Text>
                  <Pressable
                    onPress={openEditProfileModal}
                    className="flex-row items-center gap-1.5 bg-zinc-900 px-3 py-1 rounded-lg"
                  >
                    <Feather name="edit-2" size={11} color="#FFFFFF" />
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-white text-xs">Edit</Text>
                  </Pressable>
                </View>
                {/* Full Name */}
                <Pressable onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="user" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Full Name</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{profile.name || user?.name || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </Pressable>

                {/* Mobile Number */}
                <Pressable onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="phone" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Mobile Number</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">
                      {profile.mobile ? profile.mobile.replace(/^\+?91\s*/, '') : (user?.phone ? user.phone.replace(/^\+?91\s*/, '') : 'Not set')}
                    </Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </Pressable>

                {/* Email address */}
                <Pressable onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="mail" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Email address</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{profile.email || user?.email || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </Pressable>

                {/* Gender */}
                <Pressable onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="male-female-outline" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Gender</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs capitalize">{profile.gender || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </Pressable>

                {/* Date of Birth */}
                <Pressable onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="calendar" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Date of Birth</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{profile.dob || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </Pressable>

                {/* Height */}
                <Pressable onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="resize-outline" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Height</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">
                      {profile.height ? (profile.height.includes('cm') ? profile.height : `${profile.height} cm`) : 'Not set'}
                    </Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </Pressable>

                {/* Weight */}
                <Pressable onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="barbell-outline" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Weight</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">
                      {profile.weight ? (profile.weight.includes('kg') ? profile.weight : `${profile.weight} kg`) : 'Not set'}
                    </Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </Pressable>

                {/* Fitness Level */}
                <Pressable onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="trending-up" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Fitness Level</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{profile.fitnessLevel || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </Pressable>

                {/* Area */}
                <Pressable onPress={openEditProfileModal} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="map-pin" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Area</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{profile.city || 'Not set'}</Text>
                    <Feather name="chevron-right" size={14} color="#A1A1AA" />
                  </View>
                </Pressable>

                {/* Member Since */}
                <View className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="clock" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Member Since</Text>
                  </View>
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs pr-2">{profile.memberSince || 'Sep 2024'}</Text>
                </View>

                {/* Total Sessions Completed */}
                <View className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="check-circle" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Completed Sessions</Text>
                  </View>
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs pr-2">{profile.totalSessions || 0} Sessions</Text>
                </View>

                {/* Total Calories Burned */}
                <View className="flex-row items-center justify-between py-2 border-b border-zinc-100">
                  <View className="flex-row items-center gap-3">
                    <Feather name="zap" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Calories Burned</Text>
                  </View>
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs pr-2">{(profile.totalCalories || 0).toLocaleString()} kcal</Text>
                </View>

                {/* Lifetime Spendings */}
                <View className="flex-row items-center justify-between py-2">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="wallet-outline" size={15} color="#71717A" />
                    <Text className="text-zinc-500 text-xs font-medium">Lifetime Spendings</Text>
                  </View>
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs pr-2">{profile.lifetimeSpend || '₹0'}</Text>
                </View>

                {/* Bottom Collapse Toggle */}
                <Pressable
                  onPress={() => togglePersonalInfoExpansion(false)}
                  className="flex-row items-center justify-center gap-1.5 py-2.5 mt-2 border-t border-zinc-100"
                >
                  <Feather name="chevron-up" size={14} color="#71717A" />
                  <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-600 text-xs">Wrap / Collapse</Text>
                </Pressable>
              </Reanimated.View>
            )}
          </View>

          {/* 2. Fitness Goals Card from Stitch */}
          <View 
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(226, 232, 240, 0.8)',
              marginBottom: 16,
              ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
            }}
          >
            <View className="flex-row justify-between items-center mb-3.5">
              <View>
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-900 text-base font-bold tracking-tight">
                  Fitness Goals
                </Text>
                <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-slate-400 text-[11px] mt-0.5">
                  Personalized workout programming
                </Text>
              </View>
              <Pressable
                onPress={() => setIsGoalsModalVisible(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: '#F1F5F9',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                }}
              >
                <Feather name="edit-2" size={11} color="#64748B" />
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-slate-700 text-xs font-semibold">
                  Edit
                </Text>
              </Pressable>
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
                <View className="flex-row flex-wrap gap-2 mb-4">
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

            {/* Highlight Inspiration Banner */}
            <Pressable
              onPress={() => setIsGoalsModalVisible(true)}
              style={{
                backgroundColor: '#ECFDF5',
                borderWidth: 1,
                borderColor: '#A7F3D0',
                borderRadius: 16,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View className="flex-row items-center gap-3 flex-1 pr-2">
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(167, 243, 208, 0.7)', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="#047857">
                    <Polygon points="12 2 14.4 9.2 22 9.2 15.9 13.7 18.2 21 12 16.4 5.8 21 8.1 13.7 2 9.2 9.6 9.2" />
                  </Svg>
                </View>
                <View className="flex-1">
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-emerald-950 text-xs font-bold">
                    Your fitness journey matters.
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-emerald-700 text-[11px] mt-0.5">
                    Let&apos;s set your goals for better results.
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#059669" />
            </Pressable>
          </View>

          {/* 3. Become a VIRLA Trainer Option */}
          {user?.role !== 'trainer' && !hasApplied && (
            <Pressable
              onPress={() => navigateThrottled('/trainer-application')}
              style={{
                backgroundColor: '#090D16',
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: '#1E293B',
                position: 'relative',
                overflow: 'hidden',
                marginBottom: 16,
                ...softShadow({ color: '#090D16', opacity: 0.45, radius: 16, offsetY: 6 }),
              }}
            >
              <View className="flex-row items-start justify-between">
                <View style={{ maxWidth: '80%' }}>
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[10px] uppercase tracking-widest text-[#E11D48]">
                    JOIN OUR TEAM
                  </Text>
                  <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-base text-white tracking-tight mt-0.5">
                    Become a VIRLA Trainer
                  </Text>
                </View>
                <View 
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#E11D48',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...softShadow({ color: '#E11D48', opacity: 0.5, radius: 8, offsetY: 3 }),
                  }}
                >
                  <Feather name="arrow-right" size={16} color="#FFFFFF" />
                </View>
              </View>
              <Text style={{ fontFamily: 'Outfit_400Regular' }} className="text-xs text-slate-400 mt-2 leading-relaxed">
                Train on your schedule. Grow your client base. Keep more of what you earn with our elite clientele.
              </Text>
            </Pressable>
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

          {/* 4. Quick Actions Navigation List from Stitch */}
          <View 
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 8,
              borderWidth: 1,
              borderColor: 'rgba(226, 232, 240, 0.8)',
              marginBottom: 16,
              ...softShadow({ color: '#0F172A', opacity: 0.04, radius: 10, offsetY: 2 }),
            }}
          >
            {/* Item 1: Workout History & Metrics */}
            <Pressable
              onPress={() => navigateThrottled('/personal-statistics')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 16,
              }}
            >
              <View className="flex-row items-center gap-3">
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="bar-chart-2" size={16} color="#475569" />
                </View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-700">
                  Workout History & Metrics
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color="#94A3B8" />
            </Pressable>

            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8 }} />

            {/* Item 2: Saved Workout Locations */}
            <Pressable
              onPress={() => navigateThrottled('/address-management')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 16,
              }}
            >
              <View className="flex-row items-center gap-3">
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="map-pin" size={16} color="#475569" />
                </View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-700">
                  Saved Workout Locations
                </Text>
              </View>
              <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[11px] text-slate-400">
                Home, Office
              </Text>
            </Pressable>

            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8 }} />

            {/* Item 3: Dedicated Concierge Support */}
            <Pressable
              onPress={() => navigateThrottled('/help-support')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 16,
              }}
            >
              <View className="flex-row items-center gap-3">
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="message-square" size={16} color="#475569" />
                </View>
                <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-xs text-slate-700">
                  Dedicated Concierge Support
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(225, 29, 72, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[10px] text-[#E11D48]">
                  24/7 Priority
                </Text>
              </View>
            </Pressable>
          </View>

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

          {/* Sign Out Button */}
          <View className="pt-2 pb-6 items-center">
            <Pressable
              onPress={handleLogout}
              className="flex-row items-center gap-1.5 px-4 py-2 rounded-full hover:bg-rose-50"
            >
              <Feather name="log-out" size={15} color="#E11D48" style={{ transform: [{ rotate: '-90deg' }] }} />
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-[#E11D48] text-xs font-bold uppercase tracking-wider">
                SIGN OUT
              </Text>
            </Pressable>
          </View>
    </Reanimated.ScrollView>
  );
});

