import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';
import { softShadow } from '../../utils/shadows';

export interface ClientPersonalInfoCardProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCollapse: () => void;
  onEditPress: () => void;
  name: string;
  mobileDisplay: string;
  email: string;
  gender: string;
  dob: string;
  heightDisplay: string;
  weightDisplay: string;
  fitnessLevel: string;
  city: string;
  memberSince: string;
  totalSessions: number;
  totalCaloriesFormatted: string;
  lifetimeSpend: string;
}

export const ClientPersonalInfoCard = React.memo(function ClientPersonalInfoCard({
  isExpanded,
  onToggleExpand,
  onCollapse,
  onEditPress,
  name,
  mobileDisplay,
  email,
  gender,
  dob,
  heightDisplay,
  weightDisplay,
  fitnessLevel,
  city,
  memberSince,
  totalSessions,
  totalCaloriesFormatted,
  lifetimeSpend,
}: ClientPersonalInfoCardProps) {
  return (
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
        onPress={onToggleExpand}
        className={`flex-row justify-between items-center ${isExpanded ? 'mb-2 pb-3 border-b border-slate-100' : ''}`}
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
              {isExpanded ? 'Tap to wrap / collapse' : `${name} • Tap to view all details`}
            </Text>
          </View>
        </View>

        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
        </View>
      </Pressable>

      {isExpanded && (
        <Reanimated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          layout={LinearTransition.duration(200)}
          className="gap-2.5 pt-2"
        >
          <View className="flex-row justify-between items-center pb-2.5 border-b border-zinc-100">
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-500 text-xs uppercase tracking-wider">
              Profile Details
            </Text>
            <Pressable onPress={onEditPress} className="flex-row items-center gap-1.5 bg-zinc-900 px-3 py-1 rounded-lg">
              <Feather name="edit-2" size={11} color="#FFFFFF" />
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-white text-xs">
                Edit
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={onEditPress} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Feather name="user" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Full Name</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{name}</Text>
              <Feather name="chevron-right" size={14} color="#A1A1AA" />
            </View>
          </Pressable>

          <Pressable onPress={onEditPress} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Feather name="phone" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Mobile Number</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{mobileDisplay}</Text>
              <Feather name="chevron-right" size={14} color="#A1A1AA" />
            </View>
          </Pressable>

          <Pressable onPress={onEditPress} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Feather name="mail" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Email address</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{email}</Text>
              <Feather name="chevron-right" size={14} color="#A1A1AA" />
            </View>
          </Pressable>

          <Pressable onPress={onEditPress} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Ionicons name="male-female-outline" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Gender</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs capitalize">{gender}</Text>
              <Feather name="chevron-right" size={14} color="#A1A1AA" />
            </View>
          </Pressable>

          <Pressable onPress={onEditPress} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Feather name="calendar" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Date of Birth</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{dob}</Text>
              <Feather name="chevron-right" size={14} color="#A1A1AA" />
            </View>
          </Pressable>

          <Pressable onPress={onEditPress} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Ionicons name="resize-outline" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Height</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{heightDisplay}</Text>
              <Feather name="chevron-right" size={14} color="#A1A1AA" />
            </View>
          </Pressable>

          <Pressable onPress={onEditPress} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Ionicons name="barbell-outline" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Weight</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{weightDisplay}</Text>
              <Feather name="chevron-right" size={14} color="#A1A1AA" />
            </View>
          </Pressable>

          <Pressable onPress={onEditPress} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Feather name="trending-up" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Fitness Level</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{fitnessLevel}</Text>
              <Feather name="chevron-right" size={14} color="#A1A1AA" />
            </View>
          </Pressable>

          <Pressable onPress={onEditPress} className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Feather name="map-pin" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Area</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs">{city}</Text>
              <Feather name="chevron-right" size={14} color="#A1A1AA" />
            </View>
          </Pressable>

          <View className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Feather name="clock" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Member Since</Text>
            </View>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs pr-2">{memberSince}</Text>
          </View>

          <View className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Feather name="check-circle" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Completed Sessions</Text>
            </View>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs pr-2">{totalSessions} Sessions</Text>
          </View>

          <View className="flex-row items-center justify-between py-2 border-b border-zinc-100">
            <View className="flex-row items-center gap-3">
              <Feather name="zap" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Calories Burned</Text>
            </View>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs pr-2">{totalCaloriesFormatted} kcal</Text>
          </View>

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center gap-3">
              <Ionicons name="wallet-outline" size={15} color="#71717A" />
              <Text className="text-zinc-500 text-xs font-medium">Lifetime Spendings</Text>
            </View>
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-900 text-xs pr-2">{lifetimeSpend}</Text>
          </View>

          <Pressable
            onPress={onCollapse}
            className="flex-row items-center justify-center gap-1.5 py-2.5 mt-2 border-t border-zinc-100"
          >
            <Feather name="chevron-up" size={14} color="#71717A" />
            <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-zinc-600 text-xs">Wrap / Collapse</Text>
          </Pressable>
        </Reanimated.View>
      )}
    </View>
  );
});
