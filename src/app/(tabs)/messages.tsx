import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { Heading, Subtitle } from '@/presentation/components';

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
    <View className="flex-1 bg-white px-6 pt-6">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-orange-500 text-xs font-bold uppercase tracking-wider">Chat Logs</Text>
          <Heading align="left" className="mt-1">Messages</Heading>
          <Subtitle align="left" className="mt-1">
            Coordinate schedules and workouts directly with your coaches.
          </Subtitle>
        </View>

        {/* Chats List */}
        <View className="bg-zinc-50 border border-zinc-100 rounded-[24px] overflow-hidden">
          {mockChats.map((chat, idx) => (
            <TouchableOpacity
              key={chat.id}
              activeOpacity={0.7}
              className={`flex-row items-center p-5 ${
                idx > 0 ? 'border-t border-zinc-100/80' : ''
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
                  <Text className={`text-sm tracking-tight ${chat.unread ? 'font-black text-primary' : 'font-extrabold text-zinc-700'}`}>
                    {chat.name}
                  </Text>
                  <Text className="text-[10px] text-zinc-400 font-semibold">
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
    </View>
  );
}
