import React from 'react';
import { View, Text, ScrollView, Switch, Image, Alert } from 'react-native';
import { Heading, Subtitle, PrimaryButton } from '@/presentation/components';
import { useUserStore } from '../../store/userStore';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile } = useUserStore();

  const handleUpdateLocation = () => {
    Alert.alert(
      'Update Location',
      'Choose a new simulated location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set to Bangalore, India',
          onPress: () => {
            updateProfile({ location: 'Bangalore, India' });
            Alert.alert('Profile Updated', 'Location updated to Bangalore, India.');
          },
        },
        {
          text: 'Set to Delhi NCR, India',
          onPress: () => {
            updateProfile({ location: 'Delhi NCR, India' });
            Alert.alert('Profile Updated', 'Location updated to Delhi NCR, India.');
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-white px-6 pt-6">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Avatar & Header */}
        <View className="items-center mb-8">
          <Image
            source={{ uri: user.avatar }}
            className="w-24 h-24 rounded-full border-2 border-zinc-100 mb-3"
          />
          <Heading>{user.name}</Heading>
          <Subtitle>{user.email}</Subtitle>
        </View>

        {/* Profile Details Card */}
        <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-3xl mb-6">
          <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-4">Account Details</Text>
          <View className="gap-4">
            <View className="flex-row justify-between">
              <Text className="text-sm font-medium text-zinc-500">Phone</Text>
              <Text className="text-sm font-semibold text-primary">+91 98765 43210</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm font-medium text-zinc-500">Location</Text>
              <Text className="text-sm font-semibold text-primary">{user.location}</Text>
            </View>
          </View>
        </View>

        {/* Action Triggers */}
        <View className="mb-6 gap-3">
          <PrimaryButton 
            title="Update Location" 
            onPress={handleUpdateLocation} 
          />
          <PrimaryButton 
            title="Manage Saved Addresses" 
            onPress={() => router.push('/address-management' as any)} 
          />
        </View>

        {/* App Settings */}
        <View className="bg-zinc-50 border border-zinc-100 p-5 rounded-3xl mb-8">
          <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-4">Preferences</Text>
          <View className="gap-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-medium text-zinc-500">Push Notifications</Text>
              <Switch value={true} trackColor={{ true: '#4CAF50' }} />
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-medium text-zinc-500">AI Report Sync</Text>
              <Switch value={true} trackColor={{ true: '#4CAF50' }} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
