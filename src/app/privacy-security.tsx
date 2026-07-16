import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Switch, Alert, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfileStore } from '../store/userProfileStore';
import { useUserStore } from '../store/userStore';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const { privacy, updatePrivacySettings } = useUserProfileStore();
  const { setRole } = useUserStore();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [devices, setDevices] = useState([
    { id: 'd-1', name: 'iPhone 15 Pro', model: 'iOS 17.4 • Mumbai, India', current: true },
    { id: 'd-2', name: 'MacBook Pro 16', model: 'macOS Sonoma • Pune, India', current: false }
  ]);

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword) {
      Alert.alert('Incomplete Fields', 'Please fill in both old and new passwords.');
      return;
    }
    Alert.alert('Password Changed', 'Your security password has been successfully updated.');
    setOldPassword('');
    setNewPassword('');
    setShowPasswordModal(false);
  };

  const handleDisconnectDevice = (id: string, name: string) => {
    Alert.alert(
      'Disconnect Device',
      `Are you sure you want to log out of ${name}?`,
      [
        { text: 'Keep Device', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            setDevices(prev => prev.filter(d => d.id !== id));
            Alert.alert('Device Revoked', `Successfully logged out of ${name}.`);
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Delete VIRLA Account',
      'This action is irreversible. All your purchased credits, invoices, and completed history records will be permanently erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Erasure',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Account Deleted', 'Your data has been erased. Returning to onboarding...');
            router.replace('/onboarding' as any);
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out of your session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            router.replace('/onboarding' as any);
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text className="text-[#111827] text-sm font-black uppercase tracking-wider">
          Privacy & Security
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Security Center</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Manage your biometric locks, permissions access, and active devices.
            </Text>
          </View>

          {/* 1. Biometrics & Login Toggles */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-2">Login Credentials</Text>
            
            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Biometric Login</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Use Face ID or fingerprint checks</Text>
              </View>
              <Switch
                value={privacy.biometricLogin}
                onValueChange={(val) => updatePrivacySettings({ biometricLogin: val })}
              />
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Face ID unlock</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Re-authenticate check-in lists via face</Text>
              </View>
              <Switch
                value={privacy.faceId}
                onValueChange={(val) => updatePrivacySettings({ faceId: val })}
              />
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Secure PIN lock</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Prompt 4-digit code on app launches</Text>
              </View>
              <Switch
                value={privacy.pinLock}
                onValueChange={(val) => updatePrivacySettings({ pinLock: val })}
              />
            </View>

            <TouchableOpacity
              onPress={() => setShowPasswordModal(true)}
              className="mt-2 bg-[#F8F9FB] border border-[#E5E7EB] py-3 rounded-2xl items-center"
            >
              <Text className="text-zinc-950 text-[10px] font-black uppercase">Change Account Password</Text>
            </TouchableOpacity>
          </View>

          {/* Password Modal Panel */}
          {showPasswordModal && (
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-lg gap-4">
              <Text className="text-zinc-950 text-xs font-black uppercase">Update Password</Text>
              <TextInput
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="Enter current password"
                secureTextEntry
                className="border border-[#E5E7EB] bg-[#F8F9FB] p-3 rounded-xl text-xs font-semibold text-zinc-900"
              />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                secureTextEntry
                className="border border-[#E5E7EB] bg-[#F8F9FB] p-3 rounded-xl text-xs font-semibold text-zinc-900"
              />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setShowPasswordModal(false)} className="flex-1 bg-zinc-50 border border-zinc-150 py-3 rounded-xl items-center">
                  <Text className="text-zinc-800 text-[9px] font-black uppercase">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleChangePassword} className="flex-1 bg-zinc-900 py-3 rounded-xl items-center">
                  <Text className="text-white text-[9px] font-black uppercase">Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 2. Device Management */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-2">Active Logged Devices</Text>
            <View className="gap-3.5">
              {devices.map(device => (
                <View key={device.id} className="flex-row justify-between items-center py-1">
                  <View className="flex-1 pr-3 gap-0.5">
                    <Text className="text-zinc-900 text-xs font-black">
                      {device.name} {device.current && <Text className="text-[#4F46E5] text-[9px] font-black uppercase">(Current)</Text>}
                    </Text>
                    <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{device.model}</Text>
                  </View>
                  {!device.current && (
                    <TouchableOpacity
                      onPress={() => handleDisconnectDevice(device.id, device.name)}
                      className="bg-red-50 px-3 py-1.5 rounded-xl border border-red-100"
                    >
                      <Text className="text-red-500 text-[8px] font-black uppercase">Revoke</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* 3. Privacy Permissions */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-2">System Permissions</Text>
            
            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Location permission</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Used for calculating nearest match radius</Text>
              </View>
              <Switch
                value={privacy.locationPermission}
                onValueChange={(val) => updatePrivacySettings({ locationPermission: val })}
              />
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Camera permission</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Used for scanning check-in QR codes</Text>
              </View>
              <Switch
                value={privacy.cameraPermission}
                onValueChange={(val) => updatePrivacySettings({ cameraPermission: val })}
              />
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Microphone permission</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Used for voice support assistant channels</Text>
              </View>
              <Switch
                value={privacy.microphonePermission}
                onValueChange={(val) => updatePrivacySettings({ microphonePermission: val })}
              />
            </View>
          </View>

          {/* 4. Danger actions */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
            <Text className="text-rose-600 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-2">Danger Zone</Text>
            
            <TouchableOpacity
              onPress={handleLogout}
              className="bg-zinc-50 border border-zinc-150 py-3.5 rounded-2xl items-center"
            >
              <Text className="text-zinc-800 text-[10px] font-black uppercase">Sign Out of Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDeleteAccount}
              className="bg-rose-50 border border-rose-100 py-3.5 rounded-2xl items-center mt-1"
            >
              <Text className="text-rose-600 text-[10px] font-black uppercase">Delete Account Permanently</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
