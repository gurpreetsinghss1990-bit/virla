import React from 'react';
import { View, Text } from 'react-native';

interface AppLogoProps {
  size?: 'small' | 'medium' | 'large';
}

export function AppLogo({ size = 'medium' }: AppLogoProps) {
  const sizeClasses = {
    small: 'text-xl tracking-[0.2em]',
    medium: 'text-3xl tracking-[0.25em]',
    large: 'text-5xl tracking-[0.3em]',
  };

  const dotSizes = {
    small: 'w-1 h-1 ml-0.5',
    medium: 'w-2 h-2 ml-1',
    large: 'w-3.5 h-3.5 ml-2',
  };

  return (
    <View className="flex-row items-center justify-center">
      <Text className={`font-bold text-primary ${sizeClasses[size]}`}>
        VIRLA
      </Text>
      <View className={`rounded-full bg-accent ${dotSizes[size]}`} />
    </View>
  );
}
