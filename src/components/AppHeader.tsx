import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore } from '../store/userStore';
import { useNotificationStore } from '../store/notificationStore';
import { NotificationBadge } from './NotificationBadge';
import { Ionicons } from '@expo/vector-icons';
import { CommunicationCenterModal } from './CommunicationCenterModal';
import { MASTER_TRAINER_AVATAR_IMAGE } from '../constants/masterTrainerAvatar';

interface AppHeaderProps {
  onNotificationPress?: () => void;
  onAvatarPress?: () => void;
}

export function AppHeader({ onNotificationPress, onAvatarPress }: AppHeaderProps) {
  const router = useRouter();
  const { user, role } = useUserStore();
  const { unreadCount } = useNotificationStore();
  const [modalVisible, setModalVisible] = useState(false);

  const handlePress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      setModalVisible(true);
    }
  };

  return (
    <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-zinc-100">
      {/* Profile Greeting Section */}
      <View className="flex-row items-center gap-3">
        <TouchableOpacity activeOpacity={0.8} onPress={onAvatarPress}>
          <Image
            source={(() => {
              const isMale = (user.gender || '').toLowerCase() === 'male' || role === 'trainer';
              const rawAvatar = user.avatar;
              if (isMale && (!rawAvatar || rawAvatar.includes('photo-1534528741775') || rawAvatar.includes('photo-1544005313') || rawAvatar.includes('selfie.jpg'))) {
                return MASTER_TRAINER_AVATAR_IMAGE;
              }
              if (rawAvatar && typeof rawAvatar === 'string' && (rawAvatar.startsWith('http') || rawAvatar.startsWith('data:')) && !rawAvatar.includes('selfie.jpg')) {
                return { uri: rawAvatar };
              }
              return isMale ? MASTER_TRAINER_AVATAR_IMAGE : { uri: rawAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80' };
            })()}
            className="w-12 h-12 rounded-full border-2 border-zinc-50"
          />
        </TouchableOpacity>
        <View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-zinc-500 text-xs font-semibold tracking-wide">
              Good Morning,
            </Text>
            {/* Membership Badge */}
            <View className="bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              <Text className="text-indigo-700 text-[9px] font-black tracking-wide uppercase">
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
        onPress={handlePress}
        className="w-10 h-10 rounded-full border border-zinc-100 items-center justify-center relative bg-zinc-50/50"
      >
        <Ionicons name="notifications-outline" size={20} color="#111111" />
        <NotificationBadge count={unreadCount} />
      </TouchableOpacity>

      <CommunicationCenterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        unreadCount={unreadCount}
        onSelectNotifications={() => {
          setModalVisible(false);
          router.push('/notifications' as any);
        }}
        onSelectMessages={() => {
          setModalVisible(false);
          router.push('/(tabs)/messages' as any);
        }}
      />
    </View>
  );
}
