import React, { useState, useEffect, useRef } from 'react';
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
 * Pure Reanimated animated checkmark — NO SVG animatedProps.
 * Uses only useAnimatedStyle (View + Feather icon) which works
 * identically on iOS (Fabric) and Android.
 * Keyed on `instanceKey` so it always remounts fresh when the tab changes,
 * which guarantees useSharedValue starts at 0 and the entrance animation fires.
 */
function AnimatedCheckmark() {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Both run on the UI thread via Reanimated — works on iOS & Android
    scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.6 });
    opacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    marginRight: 5,
  }));

  return (
    <Animated.View style={animStyle}>
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
  // useRef for width so changes don't re-mount child components
  const containerWidthRef = useRef(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = items.findIndex((i) => i.key === activeKey);
  const validIndex = activeIndex >= 0 ? activeIndex : 0;

  const tabWidth = containerWidth > 0 ? (containerWidth - 8) / items.length : 0;

  // Shared value lives on the UI thread — spring runs at 120fps on both platforms
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      translateX.value = withSpring(validIndex * tabWidth, SPRING_CONFIG);
    }
  }, [validIndex, tabWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: tabWidth,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    if (width > 0 && width !== containerWidthRef.current) {
      containerWidthRef.current = width;
      const computedTabWidth = (width - 8) / items.length;
      // Snap pill immediately on first layout (no spring) then update state to re-render
      translateX.value = validIndex * computedTabWidth;
      setContainerWidth(width);
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
      {/* 🚀 Physical Gliding Active Obsidian Pill — 100% UI Thread on iOS & Android */}
      {tabWidth > 0 && (
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
      )}

      {/* Segment Buttons Row */}
      {items.map(({ key: r, label }, idx) => {
        const isActive = activeKey === r;
        return (
          <TouchableOpacity
            key={r}
            activeOpacity={0.75}
            onPress={() => {
              if (tabWidth > 0) {
                translateX.value = withSpring(idx * tabWidth, SPRING_CONFIG);
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
            {/*
             * Key forces remount on every activeKey change so the
             * AnimatedCheckmark's useSharedValue always starts at 0
             * and the entrance spring fires on iOS and Android alike.
             */}
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
