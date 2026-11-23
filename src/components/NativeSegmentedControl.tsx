import React, { useState, useEffect } from 'react';
import { View, Text as RNText, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedProps,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { softShadow } from '../utils/shadows';

const AnimatedPath = Animated.createAnimatedComponent(Path);

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

// SVG path total length for 'M3 8.5L6.5 12L13 4' is approximately 17 units
const CHECK_PATH_LENGTH = 18;

function AnimatedCheckmark({ isActive }: { isActive: boolean }) {
  const drawProgress = useSharedValue(isActive ? 1 : 0);
  const checkScale = useSharedValue(isActive ? 1 : 0.4);

  useEffect(() => {
    if (isActive) {
      drawProgress.value = 0;
      checkScale.value = 0.5;
      // Draw path forward smoothly
      drawProgress.value = withTiming(1, { 
        duration: 260, 
        easing: Easing.bezier(0.16, 1, 0.3, 1) 
      });
      // Micro spring bounce on appearance
      checkScale.value = withSpring(1, { 
        damping: 14, 
        stiffness: 220, 
        mass: 0.6 
      });
    } else {
      drawProgress.value = 0;
      checkScale.value = 0.4;
    }
  }, [isActive]);

  const animatedPathProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: CHECK_PATH_LENGTH * (1 - drawProgress.value),
    };
  });

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: checkScale.value }],
      opacity: drawProgress.value > 0.05 ? 1 : 0,
      marginRight: 5,
    };
  });

  return (
    <Animated.View style={animatedContainerStyle}>
      <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
        <AnimatedPath
          d="M3 8.5L6.5 12L13 4"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_PATH_LENGTH}
          animatedProps={animatedPathProps}
        />
      </Svg>
    </Animated.View>
  );
}

export function NativeSegmentedControl<T extends string>({
  items,
  activeKey,
  onChangeKey,
  marginVertical = 4,
}: NativeSegmentedControlProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = items.findIndex((i) => i.key === activeKey);
  const validIndex = activeIndex >= 0 ? activeIndex : 0;

  // Available width for segments (containerWidth minus 8px: 4px padding left + 4px padding right)
  const tabWidth = containerWidth > 0 ? (containerWidth - 8) / items.length : 0;

  // Shared value running 100% on native Reanimated UI thread
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      translateX.value = withSpring(validIndex * tabWidth, SPRING_CONFIG);
    }
  }, [validIndex, tabWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      width: tabWidth,
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
      const computedTabWidth = (width - 8) / items.length;
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
            {isActive && <AnimatedCheckmark isActive={isActive} />}
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
