import React from 'react';
import { View, Text } from 'react-native';

interface BookingStatusBadgeProps {
  status: 'upcoming' | 'completed' | 'cancelled' | 'client_no_show' | 'trainer_no_show';
  className?: string;
}

export function BookingStatusBadge({ status, className = '' }: BookingStatusBadgeProps) {
  const styles = {
    upcoming: {
      bg: 'bg-indigo-50 border-indigo-150',
      text: 'text-indigo-700',
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
    client_no_show: {
      bg: 'bg-orange-50 border-orange-150',
      text: 'text-orange-600',
      label: 'Client No-Show',
    },
    trainer_no_show: {
      bg: 'bg-red-50 border-red-150',
      text: 'text-red-600',
      label: 'Trainer No-Show',
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
