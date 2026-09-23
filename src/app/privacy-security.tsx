import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserProfileStore } from '../store/userProfileStore';
import { useUserStore } from '../store/userStore';
import { Ionicons, Feather } from '@expo/vector-icons';
import { SignOutConfirmationModal } from '../components/SignOutConfirmationModal';
import { ScreenHeader } from '../components/ScreenHeader';

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { privacy, updatePrivacySettings } = useUserProfileStore();
  const { setRole, setLoggedIn } = useUserStore();
  const [isSignOutModalVisible, setIsSignOutModalVisible] = useState(false);

  const [devices, setDevices] = useState([
    { id: 'd-1', name: 'iPhone 15 Pro', model: 'iOS 17.4 • Mumbai, India', current: true },
    { id: 'd-2', name: 'MacBook Pro 16', model: 'macOS Sonoma • Pune, India', current: false }
  ]);

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
    setIsSignOutModalVisible(true);
  };

  const confirmLogout = () => {
    setLoggedIn(false);
    router.replace('/get-started' as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FCF5F5' }}>
      <ScreenHeader title="Privacy & Security" category="VIRLA SECURITY" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          className="flex-1 p-6" 
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 48) }}
        >
          <View className="gap-6">
            
            <View>
              <Text className="text-zinc-900 text-2xl font-bold tracking-tight">Security Center</Text>
              <Text className="text-zinc-500 text-sm font-normal mt-1 leading-relaxed">
                Manage your biometric locks, permissions access, and active devices.
              </Text>
            </View>

            {/* 1. Biometrics & Login Toggles */}
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[24px] shadow-sm gap-4">
              <Text className="text-zinc-900 text-sm font-bold tracking-tight border-b border-zinc-100 pb-2.5">
                Login Credentials
              </Text>
              
              <View className="flex-row justify-between items-center py-1">
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-[14px] font-semibold">Biometric Login</Text>
                  <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-snug">Use Face ID or fingerprint checks</Text>
                </View>
                <Switch
                  value={privacy.biometricLogin}
                  onValueChange={(val) => updatePrivacySettings({ biometricLogin: val })}
                  trackColor={{ false: '#E5E7EB', true: '#E11D48' }}
                />
              </View>

              <View className="flex-row justify-between items-center py-1">
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-[14px] font-semibold">Face ID unlock</Text>
                  <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-snug">Re-authenticate check-in lists via face</Text>
                </View>
                <Switch
                  value={privacy.faceId}
                  onValueChange={(val) => updatePrivacySettings({ faceId: val })}
                  trackColor={{ false: '#E5E7EB', true: '#E11D48' }}
                />
              </View>

              <View className="flex-row justify-between items-center py-1">
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-[14px] font-semibold">Secure PIN lock</Text>
                  <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-snug">Prompt 4-digit code on app launches</Text>
                </View>
                <Switch
                  value={privacy.pinLock}
                  onValueChange={(val) => updatePrivacySettings({ pinLock: val })}
                  trackColor={{ false: '#E5E7EB', true: '#E11D48' }}
                />
              </View>
            </View>

            {/* 2. Device Management */}
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[24px] shadow-sm gap-4">
              <Text className="text-zinc-900 text-sm font-bold tracking-tight border-b border-zinc-100 pb-2.5">
                Active Logged Devices
              </Text>
              <View className="gap-3.5">
                {devices.map(device => (
                  <View key={device.id} className="flex-row justify-between items-center py-1">
                    <View className="flex-1 pr-3 gap-0.5">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-zinc-900 text-[14px] font-semibold">
                          {device.name}
                        </Text>
                        {device.current && (
                          <View className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                            <Text className="text-indigo-600 text-[10px] font-bold uppercase">Current</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-snug">{device.model}</Text>
                    </View>
                    {!device.current && (
                      <TouchableOpacity
                        onPress={() => handleDisconnectDevice(device.id, device.name)}
                        className="bg-red-50 px-3 py-1.5 rounded-xl border border-red-100"
                      >
                        <Text className="text-red-600 text-xs font-semibold">Revoke</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* 3. Privacy Permissions */}
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[24px] shadow-sm gap-4">
              <Text className="text-zinc-900 text-sm font-bold tracking-tight border-b border-zinc-100 pb-2.5">
                System Permissions
              </Text>
              
              <View className="flex-row justify-between items-center py-1">
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-[14px] font-semibold">Location permission</Text>
                  <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-snug">Used for calculating nearest match radius</Text>
                </View>
                <Switch
                  value={privacy.locationPermission}
                  onValueChange={(val) => updatePrivacySettings({ locationPermission: val })}
                  trackColor={{ false: '#E5E7EB', true: '#E11D48' }}
                />
              </View>

              <View className="flex-row justify-between items-center py-1">
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-[14px] font-semibold">Camera permission</Text>
                  <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-snug">Used for scanning check-in QR codes</Text>
                </View>
                <Switch
                  value={privacy.cameraPermission}
                  onValueChange={(val) => updatePrivacySettings({ cameraPermission: val })}
                  trackColor={{ false: '#E5E7EB', true: '#E11D48' }}
                />
              </View>

              <View className="flex-row justify-between items-center py-1">
                <View className="flex-1 pr-3">
                  <Text className="text-zinc-900 text-[14px] font-semibold">Microphone permission</Text>
                  <Text className="text-zinc-500 text-xs font-normal mt-0.5 leading-snug">Used for voice support assistant channels</Text>
                </View>
                <Switch
                  value={privacy.microphonePermission}
                  onValueChange={(val) => updatePrivacySettings({ microphonePermission: val })}
                  trackColor={{ false: '#E5E7EB', true: '#E11D48' }}
                />
              </View>
            </View>

            {/* 4. Danger actions */}
            <View className="bg-white border border-[#E5E7EB] p-5 rounded-[24px] shadow-sm gap-3">
              <Text className="text-rose-600 text-sm font-bold tracking-tight border-b border-zinc-100 pb-2.5">
                Danger Zone
              </Text>
              
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleLogout}
                className="bg-zinc-50 border border-zinc-200 py-3.5 rounded-2xl items-center"
              >
                <Text className="text-zinc-800 text-xs font-bold uppercase tracking-wider">Sign Out of Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleDeleteAccount}
                className="bg-rose-50 border border-rose-100 py-3.5 rounded-2xl items-center mt-1"
              >
                <Text className="text-rose-600 text-xs font-bold uppercase tracking-wider">Delete Account Permanently</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SignOutConfirmationModal
        visible={isSignOutModalVisible}
        onClose={() => setIsSignOutModalVisible(false)}
        onConfirm={confirmLogout}
      />
    </View>
  );
}
