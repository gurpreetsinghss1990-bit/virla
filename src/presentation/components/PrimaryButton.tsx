import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

interface PrimaryButtonProps {
  onPress: () => void;
  title: string;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function PrimaryButton({
  onPress,
  title,
  className = '',
  loading = false,
  disabled = false,
  icon,
}: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      className={`w-full py-4 bg-primary rounded-2xl items-center justify-center flex-row shadow-sm ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <View className="flex-row items-center justify-center">
          {icon && <View className="mr-2">{icon}</View>}
          <Text className="text-white text-base font-bold tracking-wide">
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
