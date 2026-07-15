import React from 'react';
import { View, Text, ScrollView, Switch, Image, Alert, TouchableOpacity, Platform } from 'react-native';
import { useUserStore } from '../../store/userStore';
import { useMembershipStore } from '../../store/membershipStore';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { membership } = useMembershipStore();

  const handleCopyReferral = () => {
    Alert.alert('Referral Code Copied', 'Share code "VIRLA50" with friends to get 2 free credits on their first booking!');
  };

  const handleLogout = () => {
    Alert.alert('Logout requested', 'Session logout simulated successfully.');
  };

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 130 }}
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

          {/* Section 1: Active Subscription & Credits */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Subscription & Credits</Text>
            
            <View className="flex-row justify-between items-center bg-[#F8F9FB] p-4 rounded-2xl border border-zinc-100">
              <View>
                <Text className="text-[#111827] text-sm font-extrabold">{membership.tier}</Text>
                <Text className="text-[#6B7280] text-[10px] font-semibold mt-0.5">Renews on {membership.renewalDate}</Text>
              </View>
              <View className="bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-full">
                <Text className="text-[#4F46E5] text-xs font-black uppercase tracking-wider">
                  {membership.availableCredits} Credits
                </Text>
              </View>
            </View>
          </View>

          {/* Section 2: Financials & Referrals */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-[#111827] text-xs font-black uppercase tracking-wider">Billing & Sharing</Text>
            
            {/* Payment Method */}
            <View className="flex-row justify-between items-center py-2.5 border-b border-[#E5E7EB]/50">
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
            
            <View className="flex-row justify-between items-center py-2.5 border-b border-[#E5E7EB]/50">
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
