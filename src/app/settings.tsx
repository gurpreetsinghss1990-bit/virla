import React, { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Switch, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfileStore } from '../store/userProfileStore';
import { useUserStore } from '../store/userStore';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateGeneralSettings, notifications, updateNotificationPrefs } = useUserProfileStore();
  const { setRole } = useUserStore();

  const handleAction = (label: string, detail: string) => {
    Alert.alert(label, detail);
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
          System Settings
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="gap-6">
          
          <View>
            <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Settings</Text>
            <Text className="text-zinc-500 text-xs font-semibold mt-1 leading-relaxed">
              Adjust measurement units, languages, theme preferences, and alerts.
            </Text>
          </View>

          {/* 1. General Preferences */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-2">App Preferences</Text>
            
            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Theme Mode</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Toggle light or dark screens</Text>
              </View>
              <View className="flex-row bg-[#F1F3F5] p-1 rounded-xl">
                {['Light', 'Dark'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => updateGeneralSettings({ theme: t as any })}
                    className={`px-3 py-1 rounded-lg ${settings.theme === t ? 'bg-white shadow-xs' : ''}`}
                  >
                    <Text className="text-[8px] font-black uppercase text-zinc-950">{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Measurement Units</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Choose metric or imperial logs</Text>
              </View>
              <View className="flex-row bg-[#F1F3F5] p-1 rounded-xl">
                {['Metric', 'Imperial'].map((u) => (
                  <TouchableOpacity
                    key={u}
                    onPress={() => updateGeneralSettings({ units: u as any })}
                    className={`px-3 py-1 rounded-lg ${settings.units === u ? 'bg-white shadow-xs' : ''}`}
                  >
                    <Text className="text-[8px] font-black uppercase text-zinc-950">{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Distance unit</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Select km or miles formats</Text>
              </View>
              <View className="flex-row bg-[#F1F3F5] p-1 rounded-xl">
                {['km', 'miles'].map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => updateGeneralSettings({ distanceUnit: d as any })}
                    className={`px-3 py-1 rounded-lg ${settings.distanceUnit === d ? 'bg-white shadow-xs' : ''}`}
                  >
                    <Text className="text-[8px] font-black uppercase text-zinc-950">{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Time Format</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Select 12-hour or 24-hour display</Text>
              </View>
              <View className="flex-row bg-[#F1F3F5] p-1 rounded-xl">
                {['12h', '24h'].map((tf) => (
                  <TouchableOpacity
                    key={tf}
                    onPress={() => updateGeneralSettings({ timeFormat: tf as any })}
                    className={`px-3 py-1 rounded-lg ${settings.timeFormat === tf ? 'bg-white shadow-xs' : ''}`}
                  >
                    <Text className="text-[8px] font-black uppercase text-zinc-950">{tf}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* 2. Notification Settings (Feature 6) */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider border-b border-zinc-50 pb-2">Notification preferences</Text>
            
            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Booking Updates</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Get slots checks and matches alerts</Text>
              </View>
              <Switch
                value={notifications.bookingUpdates}
                onValueChange={(val) => updateNotificationPrefs({ bookingUpdates: val })}
              />
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Trainer Messages</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Real-time chat pushes from coaches</Text>
              </View>
              <Switch
                value={notifications.trainerMessages}
                onValueChange={(val) => updateNotificationPrefs({ trainerMessages: val })}
              />
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Offers & Promotions</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Receive discount codes and package campaigns</Text>
              </View>
              <Switch
                value={notifications.offers}
                onValueChange={(val) => updateNotificationPrefs({ offers: val, promotions: val })}
              />
            </View>

            <View className="flex-row justify-between items-center py-1">
              <View className="flex-1 pr-3">
                <Text className="text-zinc-900 text-xs font-black">Push Notifications</Text>
                <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">Master toggle for push alerts</Text>
              </View>
              <Switch
                value={notifications.pushNotifications}
                onValueChange={(val) => updateNotificationPrefs({ pushNotifications: val })}
              />
            </View>
          </View>

          {/* 3. Help / App details links */}
          <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
            <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">About VIRLA</Text>
            
            <TouchableOpacity
              onPress={() => handleAction('Rate VIRLA', 'Thank you! Redirecting to App Store rating page...')}
              className="bg-[#F8F9FB] border border-[#E5E7EB]/60 p-4 rounded-2xl flex-row justify-between items-center"
            >
              <Text className="text-[#111827] text-xs font-black">Rate App</Text>
              <Feather name="star" size={12} color="#6B7280" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleAction('Share App', 'App download invitation link copied: check out virla.fit!')}
              className="bg-[#F8F9FB] border border-[#E5E7EB]/60 p-4 rounded-2xl flex-row justify-between items-center"
            >
              <Text className="text-[#111827] text-xs font-black">Share App with Friends</Text>
              <Feather name="share-2" size={12} color="#6B7280" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/legal-center' as any)}
              className="bg-[#F8F9FB] border border-[#E5E7EB]/60 p-4 rounded-2xl flex-row justify-between items-center"
            >
              <Text className="text-[#111827] text-xs font-black">Legal Center & Version</Text>
              <Feather name="chevron-right" size={12} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity
            onPress={handleLogout}
            className="w-full bg-[#111827] py-4 rounded-2xl items-center justify-center shadow-xs"
          >
            <Text className="text-white text-xs font-black uppercase">Sign Out of Account</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
