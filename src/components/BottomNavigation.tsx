import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Database } from '../database/Database';
import { useBookingStore } from '../store/bookingStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserStore } from '../store/userStore';
import { useChatStore } from '../store/chatStore';

const { width: windowWidth } = Dimensions.get('window');
const CONTAINER_MARGIN = 48; // left-6 right-6
const CONTAINER_PADDING = 12; // horizontal padding
const TAB_BAR_WIDTH = windowWidth - CONTAINER_MARGIN - CONTAINER_PADDING;

export function BottomNavigation({ state, descriptors, navigation }: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useUserStore();
  const { unreadCount, notifications } = useNotificationStore();
  const { bookings } = useBookingStore();
  const version = useChatStore((state) => state.version);
  const { hasUnreadForKeys } = useChatStore();

  // Prevent collision with Android 3-button navigation bar (~48dp) or iOS home indicator (~34dp)
  const bottomOffset = Math.max(insets.bottom + 8, 24);

  // Filter out messages from the visible routes (keeping 4 main tabs as selected)
  const visibleRoutes = state.routes.filter((route: any) => route.name !== 'messages');
  const numVisibleTabs = visibleRoutes.length; // 4
  const isTrainer = role === 'trainer';

  // For client: 5 slots (4 tabs + central '+' slot)
  // For trainer: 4 slots (4 tabs evenly distributed)
  const totalSlots = isTrainer ? numVisibleTabs : numVisibleTabs + 1;
  const tabWidth = TAB_BAR_WIDTH / totalSlots;

  // Find the index of the active route among the visible routes
  const currentRouteName = state.routes[state.index]?.name;
  const visibleActiveIndex = visibleRoutes.findIndex((r: any) => r.name === currentRouteName);

  // Animation values
  const [slideAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visibleActiveIndex === -1) {
      return;
    }
    // For client, skip slot 2 (the "+" button); for trainer, direct index mapping (0, 1, 2, 3)
    const multiplier = (!isTrainer && visibleActiveIndex >= 2) ? visibleActiveIndex + 1 : visibleActiveIndex;
    Animated.spring(slideAnim, {
      toValue: multiplier * tabWidth,
      useNativeDriver: true,
      tension: 68,
      friction: 10,
    }).start();
  }, [visibleActiveIndex, tabWidth, slideAnim, isTrainer]);

  // Check if a specific tab has unread messages or relevant notifications
  const hasTabUnread = (routeName: string) => {
    if (routeName === 'messages') {
      return unreadCount > 0;
    }

    if (routeName === 'bookings') {
      // 1. Check upcoming bookings for unread incoming messages from the other party
      const hasUnreadChat = bookings.some((b) => {
        if (b.status !== 'upcoming') return false;

        const trainerKey = (b.trainerName || b.trainerId || 'coach')
          .toLowerCase()
          .replace(/^coach\s+/i, '')
          .trim()
          .replace(/[^a-z0-9]/g, '_');
        const clientKey = (b.clientId || b.clientName || 'client')
          .toLowerCase()
          .replace(/^client\s+/i, '')
          .trim()
          .replace(/[^a-z0-9]/g, '_');
        const threadKey = isTrainer ? `chat-client-${clientKey}` : `chat-coach-${trainerKey}`;
        const relatedIds = [b.id, threadKey];

        const chatMessages = Database.getUnifiedChatMessages(relatedIds);
        return hasUnreadForKeys(relatedIds, chatMessages, role, b.id);
      });

      if (hasUnreadChat) return true;

      // 2. Check specifically for unread chat/message notifications (NOT general booking status notifications)
      const hasMessageNotification = notifications.some(
        (n) => !n.read && (
          n.title?.toLowerCase().includes('message') ||
          n.body?.toLowerCase().includes('message') ||
          n.title?.toLowerCase().includes('chat') ||
          n.body?.toLowerCase().includes('chat')
        )
      );
      if (hasMessageNotification) return true;

      return false;
    }

    return false;
  };

  const getIcon = (routeName: string, isFocused: boolean) => {
    let iconName: any = 'home';
    switch (routeName) {
      case 'index':
        iconName = 'home';
        break;
      case 'bookings':
        iconName = 'calendar';
        break;
      case 'progress':
        iconName = 'activity';
        break;
      case 'messages':
        iconName = 'message-square';
        break;
      case 'profile':
        iconName = 'user';
        break;
    }

    return (
      <Feather
        name={iconName}
        size={20}
        color={isFocused ? '#E11D48' : '#9CA3AF'}
      />
    );
  };

  const getLabel = (routeName: string) => {
    switch (routeName) {
      case 'index':
        return role === 'trainer' ? 'Dashboard' : 'Home';
      case 'bookings':
        return 'Sessions';
      case 'progress':
        return role === 'trainer' ? 'Performance' : 'Progress';
      case 'messages':
        return 'Messages';
      case 'profile':
        return 'Profile';
      default:
        return routeName;
    }
  };

  return (
    <View
      style={[
        styles.shadowWrapper,
        {
          bottom: bottomOffset,
        }
      ]}
    >
      <View style={styles.navContainer}>
        {/* Sliding Active Pill Indicator */}
        <Animated.View
          style={[
            styles.activePill,
            {
              width: tabWidth - 8,
              transform: [{ translateX: Animated.add(slideAnim, 4) }],
              opacity: visibleActiveIndex !== -1 ? 1 : 0,
            }
          ]}
        />

        {visibleRoutes.map((route: any, index: number) => {
          const isFocused = state.routes[state.index]?.name === route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const tabElement = (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.8}
              onPress={onPress}
              className="items-center justify-center flex-1 py-1 z-10 relative px-0.5"
              style={{ minHeight: 44, zIndex: 10 }} // Apple HIG touch target
            >
              {/* Icon Wrapper */}
              <View className="w-8 h-8 items-center justify-center mb-0.5 relative">
                {getIcon(route.name, isFocused)}
                {/* Red Dot indicator for tabs with unread messages */}
                {hasTabUnread(route.name) && (
                  <View style={styles.redDot} />
                )}
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                className={`text-[8.5px] font-bold uppercase tracking-tight text-center ${
                  isFocused ? 'text-[#E11D48]' : 'text-zinc-400'
                }`}
              >
                {getLabel(route.name)}
              </Text>
            </TouchableOpacity>
          );

          if (index === 2 && !isTrainer) {
            // Render central '+' slot only for non-trainer roles
            return (
              <React.Fragment key="group-center">
                <View className="items-center justify-center flex-1 py-1 z-20 relative" style={{ minHeight: 44 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => router.push('/booking' as any)}
                    className="w-12 h-12 rounded-full bg-[#E11D48] items-center justify-center"
                    style={{
                      minHeight: 48,
                      minWidth: 48,
                      shadowColor: '#E11D48',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    <Feather name="plus" size={24} color="white" />
                  </TouchableOpacity>
                </View>
                {tabElement}
              </React.Fragment>
            );
          }

          return tabElement;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    position: 'absolute',
    left: 24,
    right: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
    zIndex: 50,
  },
  navContainer: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    left: 6,
    top: 6,
    bottom: 6,
    backgroundColor: '#FFF1F2',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    zIndex: 0,
  },
  redDot: {
    position: 'absolute',
    top: 1,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E11D48',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default BottomNavigation;
