import React, { useRef } from 'react';
import { Animated, TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

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
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 100,
      friction: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.0,
      useNativeDriver: true,
      tension: 100,
      friction: 6,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }} className="w-full">
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        className={`w-full h-14 bg-white border border-[#E5E7EB] rounded-[20px] justify-center items-center flex-row ${
          disabled ? 'opacity-50' : ''
        } ${className}`}
        style={{
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.03,
          shadowRadius: 4,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#101828" size="small" />
        ) : (
          <View className="flex-row items-center justify-center px-4">
            {icon && <View className="mr-2">{icon}</View>}
            <Text className="text-[#101828] text-sm font-extrabold uppercase tracking-widest">
              {title}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
