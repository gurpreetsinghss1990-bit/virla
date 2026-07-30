import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LuxuryCard } from '../../components/LuxuryCard';

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: boolean;
}

const mockChats: Chat[] = [
  {
    id: '1',
    name: 'Coach Karan Sharma',
    avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80',
    lastMessage: "I'll be bringing the resistance bands today. See you at 10 AM!",
    time: '20m ago',
    unread: true,
  },
  {
    id: '2',
    name: 'Coach Priya Patel',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    lastMessage: 'Great job during yesterday yoga session! Take plenty of fluids.',
    time: 'Yesterday',
    unread: false,
  },
  {
    id: '3',
    name: 'VIRLA Concierge',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    lastMessage: 'Your monthly wellness report is ready in your profile dashboard.',
    time: '2 days ago',
    unread: false,
  },
];

export default function MessagesScreen() {
  const router = useRouter();

  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1 bg-[#F7F8FC]"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
      >
        {/* Header with Back Button */}
        <View className="mb-4 flex-row items-center gap-3.5">
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.back()} 
            className="w-10 h-10 items-center justify-center bg-white rounded-full border border-zinc-200"
            style={{ minWidth: 40, minHeight: 40 }}
          >
            <Ionicons name="arrow-back" size={20} color="#101828" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-[#6B7280] text-[10px] font-extrabold uppercase tracking-widest leading-none">Chat Logs</Text>
            <Text className="text-[#101828] text-3xl font-black tracking-tight mt-1 leading-none">Messages</Text>
          </View>
        </View>

        <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mb-6">
          Coordinate schedules and workouts directly with your coaches.
        </Text>

        {/* Chats List */}
        <LuxuryCard className="overflow-hidden" interactive={false}>
          {mockChats.map((chat, idx) => (
            <TouchableOpacity
              key={chat.id}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/communication' as any, params: { id: chat.id, name: chat.name } })}
              className={`flex-row items-center p-5 ${
                idx > 0 ? 'border-t border-zinc-150' : ''
              }`}
            >
              {/* Avatar */}
              <View className="relative">
                <Image
                  source={{ uri: chat.avatar }}
                  className="w-12 h-12 rounded-full border border-zinc-200"
                />
                {chat.unread && (
                  <View className="absolute right-0 top-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                )}
              </View>

              {/* Message Details */}
              <View className="flex-1 ml-4 mr-2">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className={`text-sm tracking-tight ${chat.unread ? 'font-black text-[#101828]' : 'font-extrabold text-zinc-700'}`}>
                    {chat.name}
                  </Text>
                  <Text className="text-[10px] text-[#6B7280] font-semibold">
                    {chat.time}
                  </Text>
                </View>
                <Text
                  className={`text-xs ${chat.unread ? 'font-bold text-zinc-800' : 'text-zinc-400'}`}
                  numberOfLines={1}
                >
                  {chat.lastMessage}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </LuxuryCard>
      </ScrollView>
    </SafeAreaViewWrapper>
  );
}

function SafeAreaViewWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC', paddingTop: insets.top }}>
      {children}
    </View>
  );
}
