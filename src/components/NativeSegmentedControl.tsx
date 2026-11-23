import React, { useState, useEffect } from 'react';
import { View, Text as RNText, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  Easing
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

// Spring configuration for super-smooth physical sliding pill on UI Thread
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 170,
  mass: 0.8,
};

export function NativeSegmentedControl<T extends string>({
  items,
  activeKey,
  onChangeKey,
  marginVertical = 4,
}: NativeSegmentedControlProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = items.findIndex((i) => i.key === activeKey);
  const validIndex = activeIndex >= 0 ? activeIndex : 0;

  // Shared values running 100% on native Reanimated UI thread
  const translateX = useSharedValue(0);
  const checkScale = useSharedValue(1);
  const checkOpacity = useSharedValue(1);

  // Available width for segments (containerWidth minus 8px padding: 4px left + 4px right)
  const tabWidth = containerWidth > 0 ? (containerWidth - 8) / items.length : 0;

  useEffect(() => {
    if (tabWidth > 0) {
      // Smooth sliding motion on UI thread
      translateX.value = withSpring(validIndex * tabWidth, SPRING_CONFIG);

      // Micro bounce & pop-in animation for the checkmark
      checkScale.value = 0.3;
      checkOpacity.value = 0;
      checkScale.value = withSpring(1, { damping: 12, stiffness: 220 });
      checkOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
    }
  }, [validIndex, tabWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      width: tabWidth,
    };
  });

  const animatedCheckStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkScale.value }],
      opacity: checkOpacity.value,
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
      const computedTabWidth = (width - 8) / items.length;
      translateX.value = validIndex * computedTabWidth;
    }
  };

  return (
    <View 
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
      {/* 🚀 Physical Gliding Active Obsidian Pill (UI Thread Reanimated) */}
      {tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 4,
              left: 4,
              bottom: 4,
              backgroundColor: '#0F172A',
              borderRadius: 9999,
              ...softShadow({ color: '#0F172A', opacity: 0.28, radius: 6, offsetY: 2 }),
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
                checkScale.value = 0.3;
                checkOpacity.value = 0;
                checkScale.value = withSpring(1, { damping: 12, stiffness: 220 });
                checkOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
              }
              onChangeKey(r);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              zIndex: 2,
            }}
          >
            {isActive && (
              <Animated.View style={animatedCheckStyle}>
                <Feather name="check" size={13} color="#FFFFFF" />
              </Animated.View>
            )}
            <RNText
              style={{
                fontFamily: 'Outfit_700Bold',
                fontSize: 12,
                color: isActive ? '#FFFFFF' : '#64748B',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
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

