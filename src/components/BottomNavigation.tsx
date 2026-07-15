import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function BottomNavigation({ state, descriptors, navigation }: any) {
  const getIcon = (routeName: string, isFocused: boolean) => {
    let iconName: any = 'home';
    switch (routeName) {
      case 'index':
        iconName = isFocused ? 'home' : 'home-outline';
        break;
      case 'bookings':
        iconName = isFocused ? 'calendar' : 'calendar-outline';
        break;
      case 'membership':
        iconName = isFocused ? 'card' : 'card-outline';
        break;
      case 'messages':
        iconName = isFocused ? 'chatbubbles' : 'chatbubbles-outline';
        break;
      case 'profile':
        iconName = isFocused ? 'person' : 'person-outline';
        break;
    }
    return <Ionicons name={iconName} size={20} color={isFocused ? '#111111' : '#A1A1AA'} />;
  };

  const getLabel = (routeName: string) => {
    switch (routeName) {
      case 'index':
        return 'Home';
      case 'bookings':
        return 'Bookings';
      case 'membership':
        return 'Membership';
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
      className="flex-row bg-white border-t border-zinc-100 items-center justify-around py-3 px-2 shadow-lg"
      style={{
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        height: Platform.OS === 'ios' ? 84 : 64,
      }}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

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

        return (
          <TouchableOpacity
            key={route.key}
            activeOpacity={0.7}
            onPress={onPress}
            className="items-center justify-center flex-1 py-1"
          >
            <View className="mb-1 items-center justify-center">
              {getIcon(route.name, isFocused)}
            </View>
            <Text 
              className={`text-[10px] font-bold tracking-tight ${
                isFocused ? 'text-primary' : 'text-zinc-400'
              }`}
            >
              {getLabel(route.name)}
            </Text>
            
            {/* Active Indicator dot */}
            {isFocused && (
              <View className="w-1.5 h-1.5 rounded-full bg-accent mt-0.5" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
