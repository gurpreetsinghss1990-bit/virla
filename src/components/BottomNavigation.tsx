import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

export function BottomNavigation({ state, descriptors, navigation }: any) {
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
        size={18} 
        color={isFocused ? '#4F46E5' : '#9CA3AF'} 
      />
    );
  };

  const getLabel = (routeName: string) => {
    switch (routeName) {
      case 'index':
        return 'Home';
      case 'bookings':
        return 'Sessions';
      case 'progress':
        return 'Progress';
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
      className="absolute bottom-6 left-6 right-6 bg-white/95 border border-zinc-150/80 rounded-[32px] flex-row items-center justify-around py-3 px-2 shadow-xl shadow-zinc-200/50"
      style={{
        elevation: 8,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
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
            activeOpacity={0.8}
            onPress={onPress}
            className="items-center justify-center flex-1 py-2"
          >
            <View 
              className={`w-9 h-9 rounded-2xl items-center justify-center mb-0.5 transition-all duration-300 ${
                isFocused ? 'bg-indigo-50/50' : 'bg-transparent'
              }`}
            >
              {getIcon(route.name, isFocused)}
            </View>
            <Text 
              className={`text-[9px] font-extrabold tracking-tight ${
                isFocused ? 'text-indigo-600' : 'text-zinc-400'
              }`}
            >
              {getLabel(route.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
