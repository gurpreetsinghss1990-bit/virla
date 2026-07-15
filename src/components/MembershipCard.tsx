import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useMembershipStore } from '../store/membershipStore';
import { ProgressRing } from './ProgressRing';
import { useRouter } from 'expo-router';

export function MembershipCard() {
  const router = useRouter();
  const { membership } = useMembershipStore();
  const progress = membership.availableCredits / membership.totalCredits;

  const handlePress = () => {
    // Navigate to membership tab
    router.push('/(tabs)/membership');
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-[24px] flex-row justify-between items-center shadow-md relative overflow-hidden"
    >
      {/* Abstract premium mesh vector visual */}
      <View className="absolute w-44 h-44 rounded-full bg-green-500/10 -bottom-16 -right-16 blur-2xl" />
      
      {/* Plan Details */}
      <View className="flex-1 mr-4">
        <View className="flex-row items-center gap-1.5 mb-1">
          <Text className="text-green-400 text-[10px] font-black uppercase tracking-wider">
            Active Membership
          </Text>
        </View>
        <Text className="text-white text-xl font-extrabold tracking-tight mb-2">
          {membership.tier}
        </Text>
        <Text className="text-zinc-400 text-xs font-semibold">
          Renews: {membership.renewalDate}
        </Text>
        
        <View className="mt-4 flex-row items-center">
          <Text className="text-white text-xs font-bold underline">
            View Membership details
          </Text>
        </View>
      </View>

      {/* Credit Progress Ring */}
      <ProgressRing progress={progress} size={84} strokeWidth={8} activeColor="#22C55E" inactiveColor="#27272A">
        <View className="items-center justify-center">
          <Text className="text-white text-lg font-black tracking-tighter">
            {membership.availableCredits}
          </Text>
          <Text className="text-zinc-500 text-[8px] font-bold uppercase">
            Left
          </Text>
        </View>
      </ProgressRing>
    </TouchableOpacity>
  );
}
