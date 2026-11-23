import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  Animated,
  Vibration,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { softShadow } from '../utils/shadows';
export interface ContinueButtonProps {
  onPress: () => void;
  title?: string;
  iconName?: any;
  disabled?: boolean;
}

export function ContinueButton({
  onPress,
  title = 'CONTINUE',
  iconName = 'arrow-right',
  disabled = false,
}: ContinueButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 45,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const handlePress = () => {
    try {
      Vibration.vibrate(10);
    } catch {}

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.02, friction: 3, tension: 90, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();

    onPress();
  };

  return (
    <View style={{ width: '100%', marginTop: 24, marginBottom: 8 }}>
      <Animated.View style={{ width: '100%', transform: [{ scale: scaleAnim }] }}>
        <Pressable
          disabled={disabled}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={{
            backgroundColor: '#E11D48',
            height: 56,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 10,
            ...softShadow({ color: '#E11D48', opacity: 0.3, radius: 12, offsetY: 6 }),
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: '800',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Text>
          {iconName ? <Feather name={iconName} size={17} color="#FFFFFF" /> : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}
