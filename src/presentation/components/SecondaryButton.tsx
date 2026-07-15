import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

interface SecondaryButtonProps {
  onPress: () => void;
  title: string;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function SecondaryButton({
  onPress,
  title,
  className = '',
  loading = false,
  disabled = false,
  icon,
}: SecondaryButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
      className={`w-full py-4 bg-white border border-zinc-200 rounded-2xl items-center justify-center flex-row ${
        disabled ? 'opacity-50' : ''
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color="#111111" size="small" />
      ) : (
        <View className="flex-row items-center justify-center">
          {icon && <View className="mr-2">{icon}</View>}
          <Text className="text-primary text-base font-semibold tracking-wide">
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
