import React from 'react';
import { View, Text } from 'react-native';

interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export function NotificationBadge({ count, className = '' }: NotificationBadgeProps) {
  if (count <= 0) return null;
  
  return (
    <View 
      className={`absolute -top-1.5 -right-1.5 bg-red-500 rounded-full h-4 min-w-[16px] px-1 items-center justify-center border border-white ${className}`}
    >
      <Text className="text-white text-[9px] font-black text-center leading-none">
        {count}
      </Text>
    </View>
  );
}
