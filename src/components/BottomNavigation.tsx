import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Animated, Dimensions, StyleSheet, Text, Pressable, View, Platform } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Line } from 'react-native-svg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Database } from '../database/Database';
import { useBookingStore } from '../store/bookingStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUserStore } from '../store/userStore';
import { useChatStore } from '../store/chatStore';

import { softShadow } from '../utils/shadows';
let useMaterialColorsSafe: any = null;
if (Platform.OS === 'android') {
  try {
    const compose = require('@expo/ui/jetpack-compose');
    useMaterialColorsSafe = compose.useMaterialColors;
  } catch {}
}

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
        iconName = isFocused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
        break;
      case 'profile':
        iconName = isFocused ? 'person' : 'person-outline';
        break;
    }

    return (
      <Ionicons
        name={iconName}
        size={22}
        color={isFocused ? '#E11D48' : '#475569'}
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

  // Height of the edge-to-edge white scrim: covers the floating bar + system nav area + fade-up zone
  const scrimHeight = bottomOffset + 56 + (isTrainer ? 50 : 40);

  // Resolve native dynamic background color for the scrim fade
  let materialColors: any = null;
  if (useMaterialColorsSafe) {
    try {
      materialColors = useMaterialColorsSafe();
    } catch {}
  }

  const dynamicScrimColor = useMemo(() => {
    if (isTrainer) {
      // Distinct, visible cool slate grey scrim for trainer mode
      return '#94A3B8';
    }
    return '#FFFFFF';
  }, [isTrainer]);

  return (
    <View pointerEvents="box-none" style={styles.screenBottomLayer}>
      {/* Twitter-style edge-to-edge scrim: transparent at top -> system dynamic color at the bottom */}
      <View pointerEvents="none" style={[styles.bottomScrim, { height: scrimHeight }]}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="bottomWhiteScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={dynamicScrimColor} stopOpacity="0" />
              <Stop offset="0.3" stopColor={dynamicScrimColor} stopOpacity={isTrainer ? "0.2" : "0.25"} />
              <Stop offset="0.65" stopColor={dynamicScrimColor} stopOpacity={isTrainer ? "0.55" : "0.5"} />
              <Stop offset="1" stopColor={dynamicScrimColor} stopOpacity={isTrainer ? "0.85" : "0.7"} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bottomWhiteScrim)" />
        </Svg>
      </View>

      <View
        style={[
          styles.shadowWrapper,
          { bottom: bottomOffset },
          isTrainer && {
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
            borderColor: 'rgba(226, 232, 240, 0.9)',
            shadowColor: '#334155',
            shadowOpacity: 0.15,
            shadowRadius: 14,
          },
        ]}
      >
      <View style={styles.navContainer}>
        {visibleRoutes.map((route: any, index: number) => {
          const isFocused = currentRouteName === route.name;

          const onPress = () => {
            if (isTabPressingRef.current) return;
            isTabPressingRef.current = true;
            setTimeout(() => {
              isTabPressingRef.current = false;
            }, 400);

            const event = navigation?.emit
              ? navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
              : { defaultPrevented: false };

            if (!isFocused && !event?.defaultPrevented) {
              if (navigation?.navigate) {
                navigation.navigate(route.name);
              } else {
                router.navigate(`/(tabs)/${route.name === 'index' ? '' : route.name}` as any);
              }
            }
          };

          const tabElement = (
            <Pressable
              key={route.key}
              onPress={onPress}
              className="items-center justify-center flex-1 py-1 z-10 relative"
              style={{ minHeight: 42, zIndex: 10 }}
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
                  className={`text-[9px] uppercase tracking-tight text-center font-black ${
                    isFocused ? 'text-[#E11D48]' : 'text-[#334155]'
                  }`}
                >
                  {getLabel(route.name)}
                </Text>
              </View>
            </Pressable>
          );

          if (index === 2 && !isTrainer) {
            // Render central '+' slot only for non-trainer roles
            return (
              <React.Fragment key="group-center">
                <View className="items-center justify-center px-1 py-0.5 z-20 relative" style={{ minHeight: 42 }}>
                  <Pressable
                    onPress={handlePlusPress}
                    className="w-10 h-10 rounded-full bg-[#E11D48] items-center justify-center"
                    style={{
                      backgroundColor: '#E11D48',
                      minHeight: 40,
                      minWidth: 40,
                      ...softShadow({ color: '#E11D48', opacity: 0.3, radius: 6, offsetY: 3 }),
                    }}
                  >
                    <Feather name="plus" size={20} color="white" />
                  </Pressable>
                </View>
                {tabElement}
              </React.Fragment>
            );
          }

          return tabElement;
        })}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenBottomLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 50,
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  shadowWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 51,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    ...softShadow({ color: '#0F172A', opacity: 0.08, radius: 12, offsetY: 4 }),
  },
  navContainer: {
    borderRadius: 26,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 0,
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
  },
});

export default BottomNavigation;
