import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useUserStore } from '../store/userStore';
import { useNotificationStore } from '../store/notificationStore';
import { NotificationBadge } from './NotificationBadge';
import { Ionicons } from '@expo/vector-icons';

interface AppHeaderProps {
  onNotificationPress?: () => void;
  onAvatarPress?: () => void;
}

export function AppHeader({ onNotificationPress, onAvatarPress }: AppHeaderProps) {
  const { user } = useUserStore();
  const { unreadCount } = useNotificationStore();

  return (
    <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-zinc-100">
      {/* Profile Greeting Section */}
      <View className="flex-row items-center gap-3">
        <TouchableOpacity activeOpacity={0.8} onPress={onAvatarPress}>
          <Image
            source={{ uri: user.avatar }}
            className="w-12 h-12 rounded-full border-2 border-zinc-50"
          />
        </TouchableOpacity>
        <View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-zinc-500 text-xs font-semibold tracking-wide">
              Good Morning,
            </Text>
            {/* Membership Badge */}
            <View className="bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
              <Text className="text-orange-600 text-[9px] font-black tracking-wide uppercase">
                Premium
              </Text>
            </View>
          </View>
          <Text className="text-primary text-xl font-extrabold tracking-tight">
            {user.name}
          </Text>
        </View>
      </View>

      {/* Notification Icon */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onNotificationPress}
        className="w-10 h-10 rounded-full border border-zinc-100 items-center justify-center relative bg-zinc-50/50"
      >
        <Ionicons name="notifications-outline" size={20} color="#111111" />
        <NotificationBadge count={unreadCount} />
      </TouchableOpacity>
    </View>
  );
}
