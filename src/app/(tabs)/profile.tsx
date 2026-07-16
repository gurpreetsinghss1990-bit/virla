import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Switch, Image, Alert, TouchableOpacity, Animated, Platform } from 'react-native';
import { useUserStore } from '../../store/userStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { membership } = useMembershipStore();

  // Pulse/Shimmer animation for Apple Wallet pass (Feature 9)
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.7,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  const handleCopyReferral = () => {
    // Haptics trigger (Feature 12)
    console.log('[Haptics] Light vibration for Copy Referral action');
    Alert.alert('Referral Code Copied', 'Share code "VIRLA50" with friends to get 2 free credits on their first booking!');
  };

  const handleLogout = () => {
    Alert.alert('Logout requested', 'Session logout simulated successfully.');
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
        className="bg-[#F8F9FB]"
      >
        <View className="px-6 pt-8 pb-4 gap-6">
          
          {/* Avatar & Header */}
          <View className="items-center mb-2">
            <Image
              source={{ uri: user.avatar }}
              className="w-24 h-24 rounded-full border-2 border-white mb-3 shadow-md"
            />
            <Text className="text-[#111827] text-2xl font-black tracking-tight">{user.name}</Text>
            <Text className="text-[#6B7280] text-xs font-semibold mt-0.5">{user.email}</Text>
          </View>

          {/* Feature 9: Apple Wallet Membership Card */}
          <View className="gap-3">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">
              My Membership Pass
            </Text>

            <TouchableOpacity 
              activeOpacity={0.95}
              onPress={handleCopyReferral}
              className="bg-zinc-950 rounded-[30px] p-6 shadow-xl relative overflow-hidden border border-zinc-800"
            >
              {/* Apple Wallet Shimmer Overlay */}
              <Animated.View 
                style={{ opacity: shimmerAnim }}
                className="absolute top-0 left-0 right-0 bottom-0 bg-indigo-500/10"
              />

              <View className="flex-row justify-between items-start mb-6">
                <View>
                  <Text className="text-[#06B6D4] text-[9px] font-black uppercase tracking-widest">
                    ★ VIRLA Pass
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
                  <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">
                    Sessions Left
                  </Text>
                  <Text className="text-white text-base font-black">
                    {membership.availableCredits} of {membership.totalCredits}
                  </Text>
                </View>

                <View className="w-[1px] h-8 bg-zinc-850" />

                <View className="gap-0.5">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">
                    Freeze Days Left
                  </Text>
                  <Text className="text-white text-base font-black">
                    15 Days
                  </Text>
                </View>

                <View className="w-[1px] h-8 bg-zinc-850" />

                <View className="gap-0.5">
                  <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-wider">
                    Renews Date
                  </Text>
                  <Text className="text-white text-xs font-black mt-0.5">
                    {membership.renewalDate}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Section 2: Financials & Referrals */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Billing & Sharing</Text>
            
            {/* Payment Method */}
            <View className="flex-row justify-between items-center py-2.5 border-b border-zinc-100">
              <View className="flex-row items-center gap-3">
                <Feather name="credit-card" size={16} color="#6B7280" />
                <Text className="text-[#6B7280] text-xs font-semibold">Payment Method</Text>
              </View>
              <Text className="text-[#111827] text-xs font-extrabold">Visa ending 4321</Text>
            </View>

            {/* Referrals Code */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={handleCopyReferral}
              className="flex-row justify-between items-center py-2.5"
            >
              <View className="flex-row items-center gap-3">
                <Feather name="gift" size={16} color="#6B7280" />
                <Text className="text-[#6B7280] text-xs font-semibold">Referral Code</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="text-[#4F46E5] text-xs font-extrabold tracking-widest">VIRLA50</Text>
                <Feather name="copy" size={12} color="#4F46E5" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Section 3: Safety & Emergency Contacts */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Emergency Contacts</Text>
            
            <View className="flex-row justify-between items-center py-2.5 border-b border-zinc-100">
              <View className="flex-row items-center gap-3">
                <Feather name="shield" size={16} color="#6B7280" />
                <Text className="text-[#6B7280] text-xs font-semibold">Safety Concierge</Text>
              </View>
              <Text className="text-[#111827] text-xs font-extrabold">+91 99999 88888</Text>
            </View>

            <View className="flex-row justify-between items-center py-2.5">
              <View className="flex-row items-center gap-3">
                <Feather name="alert-triangle" size={16} color="#6B7280" />
                <Text className="text-[#6B7280] text-xs font-semibold">Simulated Location</Text>
              </View>
              <Text className="text-[#111827] text-xs font-extrabold">{user.location}</Text>
            </View>
          </View>

          {/* Section 4: App Preferences & Actions */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Saved Configurations</Text>

            {/* Address Management Link */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => router.push('/address-management' as any)}
              className="bg-[#F8F9FB] border border-[#E5E7EB]/60 p-4 rounded-2xl flex-row justify-between items-center"
            >
              <View className="flex-row items-center gap-3">
                <Feather name="map-pin" size={16} color="#4F46E5" />
                <Text className="text-[#111827] text-xs font-extrabold">Manage Locations</Text>
              </View>
              <Feather name="chevron-right" size={14} color="#6B7280" />
            </TouchableOpacity>

            {/* Notification Switches */}
            <View className="gap-3.5 mt-2">
              <View className="flex-row justify-between items-center">
                <Text className="text-[#6B7280] text-xs font-semibold">Push Notifications</Text>
                <Switch value={true} trackColor={{ true: '#4F46E5' }} />
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-[#6B7280] text-xs font-semibold">AI Assistant Matches</Text>
                <Switch value={true} trackColor={{ true: '#4F46E5' }} />
              </View>
            </View>
          </View>

          {/* Section 5: Logout Action */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogout}
            className="w-full bg-[#111827] py-4 rounded-2xl items-center justify-center shadow-xs mt-2"
          >
            <Text className="text-white text-xs font-extrabold uppercase tracking-widest">Logout</Text>
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
