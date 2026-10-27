import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Database } from '../database/Database';
import { useBookingStore } from '../store/bookingStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserStore } from '../store/userStore';
import { useChatStore } from '../store/chatStore';

export function BottomNavigation({ state, descriptors, navigation }: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isTabPressingRef = useRef(false);

  const handlePlusPress = useCallback(() => {
    if (isTabPressingRef.current) return;
    isTabPressingRef.current = true;
    router.push('/booking' as any);
    setTimeout(() => {
      isTabPressingRef.current = false;
    }, 500);
  }, [router]);
  const { role } = useUserStore();
  const { unreadCount, notifications } = useNotificationStore();
  const { bookings } = useBookingStore();
  const version = useChatStore((state) => state.version);
  const { hasUnreadForKeys } = useChatStore();

  // Prevent collision with Android 3-button navigation bar (~48dp) or iOS home indicator (~34dp)
  const bottomOffset = Math.max(insets.bottom + 8, 24);

  // Filter out messages from the visible routes (keeping 4 main tabs as selected)
  const visibleRoutes = state.routes.filter((route: any) => route.name !== 'messages');
  const isTrainer = role === 'trainer';

  const hasTabUnread = (routeName: string) => {
    if (routeName === 'messages') {
      return unreadCount > 0;
    }
    return false;
  };

  const getIcon = (routeName: string, isFocused: boolean) => {
    let iconName: any = isFocused ? 'home' : 'home-outline';
    switch (routeName) {
      case 'index':
        iconName = isFocused ? 'home' : 'home-outline';
        break;
      case 'bookings':
        iconName = isFocused ? 'calendar' : 'calendar-outline';
        break;
      case 'progress':
        iconName = isFocused ? 'trending-up' : 'trending-up-outline';
        break;
      case 'messages':
        iconName = 'message-square';
        break;
      case 'profile':
        iconName = isFocused ? 'person' : 'person-outline';
        break;
    }

    return (
      <Ionicons
        name={iconName}
        size={22}
        color={isFocused ? '#E11D48' : '#1E293B'}
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

  // Visible routes indices
  const currentRouteName = state.routes[state.index]?.name;

  return (
    <View
      style={[
        styles.shadowWrapper,
        {
          bottom: bottomOffset,
        }
      ]}
    >
      {/* Soft Ambient White Rays / Halo Glow */}
      <View style={styles.outerRaysGlow} />
      <View style={styles.innerRaysGlow} />

      {/* Side-to-Side Soft White Scrim Vignette Effect */}
      <View pointerEvents="none" style={styles.sideScrimWrapper}>
        {/* Left Side Scrim */}
        <View style={styles.leftScrim}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="tabBarLeftScrim" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.5" />
                <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.18" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx={30} ry={30} fill="url(#tabBarLeftScrim)" />
          </Svg>
        </View>

        {/* Right Side Scrim */}
        <View style={styles.rightScrim}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="tabBarRightScrim" x1="100%" y1="0%" x2="0%" y2="0%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.5" />
                <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.18" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx={30} ry={30} fill="url(#tabBarRightScrim)" />
          </Svg>
        </View>
      </View>

      <View style={styles.navContainer}>
        {visibleRoutes.map((route: any, index: number) => {
          const isFocused = currentRouteName === route.name;

          const onPress = () => {
            if (isTabPressingRef.current) return;
            isTabPressingRef.current = true;
            setTimeout(() => {
              isTabPressingRef.current = false;
            }, 400);

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
              activeOpacity={0.75}
              onPress={onPress}
              className="items-center justify-center flex-1 py-1 z-10 relative"
              style={{ minHeight: 44, zIndex: 10 }}
            >
              <View className="items-center justify-center">
                {/* Icon Wrapper */}
                <View className="w-6 h-6 items-center justify-center mb-0.5 relative">
                  {getIcon(route.name, isFocused)}
                  {/* Red Dot indicator for tabs with unread messages */}
                  {hasTabUnread(route.name) && (
                    <View style={styles.redDot} />
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  className={`text-[8.5px] uppercase tracking-tight text-center ${
                    isFocused ? 'text-[#E11D48] font-black' : 'text-[#334155] font-black'
                  }`}
                >
                  {getLabel(route.name)}
                </Text>
              </View>
            </TouchableOpacity>
          );

          if (index === 2 && !isTrainer) {
            // Render central '+' slot only for non-trainer roles
            return (
              <React.Fragment key="group-center">
                <View className="items-center justify-center px-1 py-0.5 z-20 relative" style={{ minHeight: 46 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handlePlusPress}
                    className="w-10 h-10 rounded-full bg-[#E11D48] items-center justify-center"
                    style={{
                      minHeight: 40,
                      minWidth: 40,
                      shadowColor: '#E11D48',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      elevation: 4,
                    }}
                  >
                    <Feather name="plus" size={20} color="white" />
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
    left: 16,
    right: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 50,
  },
  outerRaysGlow: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    left: -6,
    right: -6,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 18,
    elevation: 6,
  },
  innerRaysGlow: {
    position: 'absolute',
    top: -2.5,
    bottom: -2.5,
    left: -2.5,
    right: -2.5,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 4,
  },
  sideScrimWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 30,
    overflow: 'hidden',
    zIndex: 1,
  },
  leftScrim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 65,
  },
  rightScrim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 65,
  },
  navContainer: {
    borderRadius: 30,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(253, 253, 254, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    position: 'relative',
  },
  redDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E11D48',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default BottomNavigation;
