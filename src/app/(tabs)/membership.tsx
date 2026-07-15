import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { Heading, Subtitle, PrimaryButton } from '@/presentation/components';
import { useMembershipStore } from '../../store/membershipStore';

export default function MembershipScreen() {
  const { membership, addCredits } = useMembershipStore();

  const handleAddCredits = () => {
    addCredits(4);
    Alert.alert('Credits Added', 'Successfully purchased 4 credits! Your balance has been updated.');
  };

  return (
    <View className="flex-1 bg-white px-6 pt-6">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mb-6">
          <Text className="text-orange-500 text-xs font-bold uppercase tracking-wider">My Subscription</Text>
          <Heading align="left" className="mt-1">{membership.tier}</Heading>
          <Subtitle align="left" className="mt-1">
            Renewal Date: {membership.renewalDate}. Next bill amount: ₹4,999.
          </Subtitle>
        </View>

        {/* Credit Balance Card */}
        <View className="bg-zinc-50 border border-zinc-100 p-6 rounded-3xl mb-6">
          <Text className="text-sm font-bold text-primary mb-3">Credit Balance</Text>
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xs text-zinc-500 font-medium">Monthly credit quota</Text>
            <Text className="text-sm font-bold text-primary">{membership.totalCredits} Credits</Text>
          </View>
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xs text-zinc-500 font-medium">Used credits</Text>
            <Text className="text-sm font-bold text-primary">{membership.totalCredits - membership.availableCredits} Credits</Text>
          </View>
          <View className="h-[1px] bg-zinc-200 my-2.5" />
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-bold text-primary">Available Balance</Text>
            <Text className="text-lg font-black text-orange-500">{membership.availableCredits} Credits</Text>
          </View>
        </View>

        {/* Buy Credits Trigger */}
        <View className="mb-6">
          <PrimaryButton 
            title="Purchase 4 Credits (₹1,500)" 
            onPress={handleAddCredits} 
          />
        </View>

        {/* Plan Details Card */}
        <View className="bg-zinc-50 border border-zinc-100 p-6 rounded-3xl">
          <Text className="text-sm font-bold text-primary mb-4">Plan Benefits</Text>
          <View className="gap-3">
            <View className="flex-row items-center">
              <Text className="text-base mr-3 text-orange-500">✓</Text>
              <Text className="text-sm text-zinc-600 font-medium">Shared with up to 4 family members</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-base mr-3 text-orange-500">✓</Text>
              <Text className="text-sm text-zinc-600 font-medium">Access to all workout modalities</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-base mr-3 text-orange-500">✓</Text>
              <Text className="text-sm text-zinc-600 font-medium">Monthly AI wellness reports</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-base mr-3 text-orange-500">✓</Text>
              <Text className="text-sm text-zinc-600 font-medium">Certified home wellness coaches</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
