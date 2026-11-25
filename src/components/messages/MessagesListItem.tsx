import React from 'react';
import { View, Text } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { NativePressable } from '../NativePressable';
import { NativeDivider } from '../NativeDivider';
import { AvatarImage } from '../AvatarImage';
import { ChatItem } from './types';

interface MessagesListItemProps {
  chat: ChatItem;
  isLast: boolean;
  onPress: (chat: ChatItem) => void;
}

export const MessagesListItem: React.FC<MessagesListItemProps> = React.memo(
  function MessagesListItem({ chat, isLast, onPress }) {
    const isConcierge = chat.type === 'concierge';

    return (
      <React.Fragment>
        <NativePressable
          rippleColor="rgba(0, 0, 0, 0.08)"
          onPress={() => onPress(chat)}
          className={`flex-row items-center px-4 py-3 ${
            isConcierge ? 'bg-rose-50/40' : 'bg-white'
          }`}
        >
          {/* Avatar */}
          <View className="relative mr-3.5">
            {isConcierge ? (
              <View
                className="rounded-full bg-rose-100 border border-rose-200 items-center justify-center overflow-hidden"
                style={{ width: 50, height: 50, borderRadius: 25 }}
              >
                <Ionicons name="sparkles" size={22} color="#E11D48" />
              </View>
            ) : (
              <View
                className="rounded-full overflow-hidden bg-zinc-100"
                style={{ width: 50, height: 50, borderRadius: 25 }}
              >
                <AvatarImage
                  uri={chat.avatar}
                  style={{ width: 50, height: 50, borderRadius: 25 }}
                />
                {chat.isOnline && (
                  <View className="absolute right-0 bottom-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                )}
              </View>
            )}
          </View>

          {/* Chat Content */}
          <View className="flex-1 flex-row items-center justify-between py-0.5">
            <View className="flex-1 pr-2">
              <View className="flex-row items-center justify-between mb-1">
                <Text
                  numberOfLines={1}
                  className={`text-[16px] flex-1 pr-2 ${
                    chat.unread ? 'font-bold text-zinc-950' : 'font-semibold text-zinc-900'
                  }`}
                >
                  {chat.name}
                </Text>
                {chat.time ? (
                  <Text className={`text-xs ${chat.unread ? 'font-bold text-[#E11D48]' : 'text-zinc-400'}`}>
                    {chat.time}
                  </Text>
                ) : null}
              </View>

              <View className="flex-row items-center justify-between">
                <Text
                  numberOfLines={1}
                  className={`text-[14px] flex-1 pr-2 ${
                    chat.unread ? 'font-semibold text-zinc-800' : 'text-zinc-500'
                  }`}
                >
                  {chat.lastMessage}
                </Text>
                {chat.unread && (
                  <View className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D48] items-center justify-center ml-2">
                    <Text className="text-[10px] font-bold text-white">1</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Right end subtle chevron icon */}
            <Feather name="chevron-right" size={17} color="#D1D5DB" />
          </View>
        </NativePressable>

        {!isLast && (
          <View className="pl-[76px] bg-white">
            <NativeDivider color="#F4F4F5" />
          </View>
        )}
      </React.Fragment>
    );
  }
);

