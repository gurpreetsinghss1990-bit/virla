import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Platform } from 'react-native';

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
    name: 'Karan Sharma',
    avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=150&q=80',
    lastMessage: "I'll be bringing the resistance bands today. See you at 10 AM!",
    time: '20m ago',
    unread: true,
  },
  {
    id: '2',
    name: 'Priya Patel',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    lastMessage: 'Great job during yesterday yoga session! Take plenty of fluids.',
    time: 'Yesterday',
    unread: false,
  },
  {
    id: '3',
    name: 'VIRLA Support',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    lastMessage: 'Your monthly wellness report is ready in your profile dashboard.',
    time: '2 days ago',
    unread: false,
  },
];

export default function MessagesScreen() {
  return (
    <SafeAreaViewWrapper>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1 bg-[#F8F9FB]"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 }}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-[#6B7280] text-xs font-extrabold uppercase tracking-widest">Chat Logs</Text>
          <Text className="text-[#111827] text-3xl font-black tracking-tight mt-1">Messages</Text>
          <Text className="text-[#6B7280] text-xs font-semibold leading-relaxed mt-1">
            Coordinate schedules and workouts directly with your coaches.
          </Text>
        </View>

        {/* Chats List */}
        <View className="bg-white border border-[#E5E7EB] rounded-[28px] overflow-hidden shadow-xs">
          {mockChats.map((chat, idx) => (
            <TouchableOpacity
              key={chat.id}
              activeOpacity={0.7}
              className={`flex-row items-center p-5 ${
                idx > 0 ? 'border-t border-[#E5E7EB]' : ''
              }`}
            >
              {/* Avatar */}
              <View className="relative">
                <Image
                  source={{ uri: chat.avatar }}
                  className="w-12 h-12 rounded-full border border-zinc-100"
                />
                {chat.unread && (
                  <View className="absolute right-0 top-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                )}
              </View>

              {/* Message Details */}
              <View className="flex-1 ml-4 mr-2">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className={`text-sm tracking-tight ${chat.unread ? 'font-black text-[#111827]' : 'font-extrabold text-zinc-700'}`}>
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
