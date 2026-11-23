import { Loading } from '../../components/Loading';
import React, { useRef, useState } from 'react';
import { Animated, Pressable, Text, View, StyleSheet } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

import { softShadow } from '../../utils/shadows';
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
  const [scaleAnim] = useState(() => new Animated.Value(1));

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
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        className={`w-full h-14 rounded-[20px] justify-center items-center overflow-hidden relative shadow-lg shadow-indigo-600/25 ${
          disabled ? 'opacity-50' : ''
        } ${className}`}
        style={{
          ...softShadow({ color: '#4F46E5', opacity: 0.25, radius: 12, offsetY: 6 }),
        }}
      >
        {/* SVG Gradient Background */}
        <View style={StyleSheet.absoluteFill} className="overflow-hidden rounded-[20px]">
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="primaryBtnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#4F46E5" />
                <Stop offset="100%" stopColor="#6D5EF7" />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="100" fill="url(#primaryBtnGrad)" />
          </Svg>
        </View>

        {loading ? (
          <Loading color="#ffffff" size="small" />
        ) : (
          <View className="flex-row items-center justify-center px-4">
            {icon && <View className="mr-2">{icon}</View>}
            <Text className="text-white text-sm font-black uppercase tracking-widest">
              {title}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
