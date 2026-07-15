import React from 'react';
import { View } from 'react-native';

interface PageIndicatorProps {
  activeIndex: number;
  total: number;
  className?: string;
}

export function PageIndicator({ activeIndex, total, className = '' }: PageIndicatorProps) {
  return (
    <View className={`flex-row justify-center items-center gap-2 ${className}`}>
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === activeIndex;
        return (
          <View
            key={index}
            className={`h-2 rounded-full ${
              isActive ? 'w-6 bg-primary' : 'w-2 bg-zinc-200'
            }`}
          />
        );
      })}
    </View>
  );
}
