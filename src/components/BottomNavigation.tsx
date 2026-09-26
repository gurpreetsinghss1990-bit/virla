import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
        {visibleRoutes.map((route: any, index: number) => {
          const isFocused = state.routes[state.index]?.name === route.name;

          const onPress = () => {
            if (isTabPressingRef.current) return;
            isTabPressingRef.current = true;
            setTimeout(() => {
              isTabPressingRef.current = false;
            }, 500);

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
                    activeOpacity={0.88}
                    onPress={handlePlusPress}
                    style={styles.dimensionalSphereFab}
                  >
                    <View style={styles.sphereCore}>
                      {/* Top-Left Specular highlight lens */}
                      <View style={styles.specularHighlight} />
                      <View style={styles.secondaryReflection} />
                      {/* Bottom ambient bounce refraction */}
                      <View style={styles.bottomBounceGlow} />
                      <Feather name="plus" size={24} color="#FFFFFF" style={styles.fabIcon} />
                    </View>
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 14,
    zIndex: 50,
  },
  navContainer: {
    borderRadius: 32,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderRightWidth: 1.5,
    borderBottomWidth: 3.5,
    borderRightColor: '#E2E8F0',
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    position: 'relative',
  },
  dimensionalSphereFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -20,
    backgroundColor: '#BE123C',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 2,
    borderLeftWidth: 1.5,
    borderRightWidth: 1,
    borderBottomWidth: 3,
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    borderLeftColor: 'rgba(255, 255, 255, 0.65)',
    borderRightColor: 'rgba(159, 18, 57, 0.85)',
    borderBottomColor: 'rgba(136, 19, 55, 0.98)',
  },
  sphereCore: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  specularHighlight: {
    position: 'absolute',
    top: 5,
    left: 8,
    width: 18,
    height: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    transform: [{ rotate: '-28deg' }],
  },
  secondaryReflection: {
    position: 'absolute',
    top: 6,
    left: 11,
    width: 7,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  bottomBounceGlow: {
    position: 'absolute',
    bottom: 3,
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  fabIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 2,
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
