import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '../store/notificationStore';

import { useUserStore } from '../store/userStore';

const { width: windowWidth } = Dimensions.get('window');
const CONTAINER_MARGIN = 48; // left-6 right-6
const CONTAINER_PADDING = 12; // horizontal padding
const TAB_BAR_WIDTH = windowWidth - CONTAINER_MARGIN - CONTAINER_PADDING;

export function BottomNavigation({ state, descriptors, navigation }: any) {
  const router = useRouter();
  const { unreadCount } = useNotificationStore();
  const { role } = useUserStore();

  // Filter out messages from the visible routes
  const visibleRoutes = state.routes.filter((route: any) => route.name !== 'messages');
  const numVisibleTabs = visibleRoutes.length;
  // Calculate width for 5 spaces (4 visible tabs + 1 custom middle button)
  const tabWidth = role === 'trainer' ? TAB_BAR_WIDTH / numVisibleTabs : TAB_BAR_WIDTH / (numVisibleTabs + 1);

  // Find the index of the active route among the visible routes
  const currentRouteName = state.routes[state.index].name;
  const visibleActiveIndex = visibleRoutes.findIndex((r: any) => r.name === currentRouteName);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visibleActiveIndex === -1) {
      return;
    }
    // Skip index 2 (the "+" button) when sliding indicator if not a trainer
    const multiplier = role !== 'trainer' && visibleActiveIndex >= 2 ? visibleActiveIndex + 1 : visibleActiveIndex;
    Animated.spring(slideAnim, {
      toValue: multiplier * tabWidth,
      useNativeDriver: true,
      tension: 68,
      friction: 10,
    }).start();
  }, [visibleActiveIndex, tabWidth, slideAnim, role]);

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
      case 'profile':
        return 'Profile';
      default:
        return routeName;
    }
  };

  return (
    <View 
      className="absolute bottom-6 left-6 right-6 bg-white/95 border border-white/80 rounded-[32px] flex-row items-center py-3.5 px-1.5 shadow-2xl"
      style={styles.navBar}
    >
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
        const isFocused = state.routes[state.index].name === route.name;

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
            className="items-center justify-center flex-1 py-1 z-10 relative"
            style={{ minHeight: 44 }} // Apple HIG touch target
          >
            {/* Icon Wrapper */}
            <View className="w-8 h-8 items-center justify-center mb-0.5 relative">
              {getIcon(route.name, isFocused)}
            </View>
            <Text 
              className={`text-[8.5px] font-bold uppercase tracking-wider ${
                isFocused ? 'text-[#E11D48]' : 'text-zinc-400'
              }`}
            >
              {getLabel(route.name)}
            </Text>
          </TouchableOpacity>
        );

        if (index === 2 && role !== 'trainer') {
          // Render central "+" button then the tab
          return (
            <React.Fragment key="group-center">
              <View className="items-center justify-center flex-1 py-1 z-20 relative" style={{ minHeight: 44 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push('/booking' as any)}
                  className="w-12 h-12 rounded-full bg-[#E11D48] items-center justify-center shadow-md shadow-rose-950/20"
                  style={{ marginTop: -18, minHeight: 48, minWidth: 48 }}
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
  );
}

const styles = StyleSheet.create({
  navBar: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  activePill: {
    position: 'absolute',
    height: 42,
    backgroundColor: 'rgba(225, 29, 72, 0.06)', // Soft rose brand tint
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.1)',
  }
});

export default BottomNavigation;
