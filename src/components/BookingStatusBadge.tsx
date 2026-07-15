import React from 'react';
import { View, Text } from 'react-native';

interface BookingStatusBadgeProps {
  status: 'upcoming' | 'completed' | 'cancelled';
  className?: string;
}

export function BookingStatusBadge({ status, className = '' }: BookingStatusBadgeProps) {
  const styles = {
    upcoming: {
      bg: 'bg-orange-50 border-green-150',
      text: 'text-orange-600',
      label: 'Upcoming',
    },
    completed: {
      bg: 'bg-zinc-50 border-zinc-200/50',
      text: 'text-zinc-500',
      label: 'Completed',
    },
    cancelled: {
      bg: 'bg-red-50 border-red-150',
      text: 'text-red-500',
      label: 'Cancelled',
    },
  }[status];

  return (
    <View className={`border px-3 py-1 rounded-full items-center justify-center ${styles.bg} ${className}`}>
      <Text className={`text-[10px] font-black uppercase tracking-wider ${styles.text}`}>
        {styles.label}
      </Text>
    </View>
  );
}
