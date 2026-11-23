import React, { useState, useEffect } from 'react';
import { View, Text as RNText, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { softShadow } from '../utils/shadows';

export interface SegmentItem<T extends string> {
  key: T;
  label: string;
}

interface NativeSegmentedControlProps<T extends string> {
  items: SegmentItem<T>[];
  activeKey: T;
  onChangeKey: (key: T) => void;
  marginVertical?: number;
}

// Highly tuned physical spring for natural glide on both iOS and Android UI thread
const SPRING_CONFIG = {
  damping: 22,
  stiffness: 240,
  mass: 0.6,
};

/**
 * Pure Reanimated UI-thread Checkmark.
 * Uses Animated.View + Feather icon driven strictly by UI-thread transforms (scale + opacity).
 */
function AnimatedCheckmark() {
  const checkScale = useSharedValue(0.2);
  const checkOpacity = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.6 });
    checkOpacity.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
  }, [checkScale, checkOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
    marginRight: 5,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Feather name="check" size={13} color="#FFFFFF" />
    </Animated.View>
  );
}

export function NativeSegmentedControl<T extends string>({
  items,
  activeKey,
  onChangeKey,
  marginVertical = 4,
}: NativeSegmentedControlProps<T>) {
  const activeIndex = items.findIndex((i) => i.key === activeKey);
  const validIndex = activeIndex >= 0 ? activeIndex : 0;

  // Shared values running 100% on native Reanimated UI thread (iOS Fabric + Android)
  const tabWidthShared = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (tabWidthShared.value > 0) {
      translateX.value = withSpring(validIndex * tabWidthShared.value, SPRING_CONFIG);
    }
  }, [validIndex, translateX, tabWidthShared]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    width: tabWidthShared.value,
    transform: [{ translateX: translateX.value }],
    opacity: tabWidthShared.value > 0 ? 1 : 0,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    if (width > 0) {
      const computedTabWidth = (width - 8) / items.length;
      tabWidthShared.value = computedTabWidth;
      translateX.value = validIndex * computedTabWidth;
    }
  };

  return (
    <View
      collapsable={false}
      onLayout={onLayout}
      style={{
        width: '100%',
        marginVertical,
        backgroundColor: '#FFFFFF',
        borderRadius: 9999,
        padding: 4,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        ...softShadow({ color: '#0F172A', opacity: 0.05, radius: 8, offsetY: 2 }),
      }}
    >
      {/* 🚀 Physical Gliding Active Obsidian Pill (100% UI Thread Reanimated on iOS & Android) */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 4,
            left: 4,
            bottom: 4,
            backgroundColor: '#0D0F17',
            borderRadius: 9999,
            ...softShadow({ color: '#0D0F17', opacity: 0.28, radius: 6, offsetY: 2 }),
          },
          animatedIndicatorStyle,
        ]}
      />

      {/* Segment Buttons Row */}
      {items.map(({ key: r, label }, idx) => {
        const isActive = activeKey === r;
        return (
          <TouchableOpacity
            key={r}
            activeOpacity={0.75}
            onPress={() => {
              if (tabWidthShared.value > 0) {
                translateX.value = withSpring(idx * tabWidthShared.value, SPRING_CONFIG);
              }
              onChangeKey(r);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 4,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            {isActive && <AnimatedCheckmark key={`check-${r}-${activeKey}`} />}
            <RNText
              numberOfLines={1}
              style={{
                fontFamily: isActive ? 'Outfit_700Bold' : 'Outfit_600SemiBold',
                fontSize: 11,
                color: isActive ? '#FFFFFF' : '#64748B',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              {label}
            </RNText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
