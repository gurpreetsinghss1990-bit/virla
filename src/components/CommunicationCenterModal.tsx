import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeSheet } from './NativeSheet';

interface CommunicationCenterModalProps {
  visible: boolean;
  onClose: () => void;
  unreadCount?: number;
  onSelectNotifications: () => void;
  onSelectMessages: () => void;
}

export const CommunicationCenterModal: React.FC<CommunicationCenterModalProps> = ({
  visible,
  onClose,
  unreadCount = 0,
  onSelectNotifications,
  onSelectMessages,
}) => {
  const insets = useSafeAreaInsets();
  const safeBottomPadding = Math.max(insets.bottom, 12);

  const handleDismiss = () => onClose();

  return (
    <NativeSheet visible={visible} onClose={handleDismiss}>
      <View style={{ paddingBottom: safeBottomPadding }} className="w-full px-5 pt-3 pb-2 gap-1.5">
            {/* Modal Header */}
            <View className="pb-1 px-1">
              <Text className="text-zinc-900 text-base font-bold tracking-tight">
                Activity
              </Text>
            </View>

            {/* Options Destination List - Clean, borderless & seamless */}
            <View className="gap-1">
              {/* Notifications Center Option */}
              <Pressable
                onPress={onSelectNotifications}
                className="flex-row items-center py-3 px-2 rounded-xl active:bg-zinc-50"
              >
                <View className="w-8 h-8 items-center justify-center">
                  <Feather name="bell" size={18} color="#18181B" />
                </View>

                <View className="flex-1 ml-2.5">
                  <Text className="text-zinc-900 text-[14px] font-semibold">
                    Notifications
                  </Text>
                </View>

                {unreadCount > 0 && (
                  <View className="bg-[#E11D48] px-2 py-0.5 rounded-full mr-2">
                    <Text numberOfLines={1} className="text-white text-[10px] font-bold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}

                <Feather name="chevron-right" size={16} color="#94A3B8" />
              </Pressable>

              {/* Messages (Chats) Option */}
              <Pressable
                onPress={onSelectMessages}
                className="flex-row items-center py-3 px-2 rounded-xl active:bg-zinc-50"
              >
                <View className="w-8 h-8 items-center justify-center">
                  <Feather name="message-square" size={18} color="#18181B" />
                </View>

                <View className="flex-1 ml-2.5">
                  <Text className="text-zinc-900 text-[14px] font-semibold">
                    Messages
                  </Text>
                </View>

                <Feather name="chevron-right" size={16} color="#94A3B8" />
              </Pressable>
            </View>
      </View>
    </NativeSheet>
  );
};
