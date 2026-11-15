import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
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
  // Ensure ample clearance above Android 3-button navigation bar (~48-56dp) or iOS indicator bar (~34dp)
  const safeBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 68 : 28) + 24;

  const handleDismiss = () => onClose();

  return (
    <NativeSheet visible={visible} onClose={handleDismiss}>
      <View style={{ paddingBottom: safeBottomPadding }} className="w-full px-5 pt-3 pb-4 gap-3">
            {/* Minimal Pull Indicator Bar */}
            <View className="w-8 h-1 rounded-full bg-zinc-200 self-center mb-1" />

            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-1 px-1">
              <Text className="text-zinc-900 text-base font-bold tracking-tight">
                Activity
              </Text>
              <TouchableOpacity
                onPress={handleDismiss}
                activeOpacity={0.6}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                className="w-9 h-9 items-center justify-center"
              >
                <Feather name="x" size={20} color="#18181B" />
              </TouchableOpacity>
            </View>

            {/* Options Destination List - Clean, borderless & seamless */}
            <View className="gap-1">
              {/* Notifications Center Option */}
              <TouchableOpacity
                activeOpacity={0.6}
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
              </TouchableOpacity>

              {/* Messages (Chats) Option */}
              <TouchableOpacity
                activeOpacity={0.6}
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
              </TouchableOpacity>
            </View>
      </View>
    </NativeSheet>
  );
};
