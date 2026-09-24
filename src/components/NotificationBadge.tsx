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
      className={`absolute -top-1.5 -right-1.5 bg-red-500 rounded-full h-[18px] min-w-[18px] px-1.5 items-center justify-center border border-white ${className}`}
    >
      <Text numberOfLines={1} className="text-white text-[9px] font-black text-center leading-none">
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}
