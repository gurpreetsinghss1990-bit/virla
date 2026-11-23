import React, { useEffect } from 'react';
import { Modal, Pressable, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  ReduceMotion,
} from 'react-native-reanimated';
import type { NativeSheetProps } from './nativeSheetShared';

export type { NativeSheetProps } from './nativeSheetShared';

/**
 * iOS Crisp Native Bottom Sheet
 * 100% react-native-reanimated UI-thread driven.
 * Backdrop smoothly fades in with a gentle dim,
 * while the sheet surface springs up naturally.
 */
export function NativeSheet({ visible, onClose, backgroundColor = '#FFFFFF', fullHeight, children }: NativeSheetProps) {
  const backdropOpacity = useSharedValue(0);
  const translateY = useSharedValue(500);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, {
        duration: 220,
        reduceMotion: ReduceMotion.Never,
      });
      translateY.value = withSpring(0, {
        damping: 26,
        stiffness: 280,
        mass: 0.8,
        reduceMotion: ReduceMotion.Never,
      });
    } else {
      backdropOpacity.value = 0;
      translateY.value = 500;
    }
  }, [visible, backdropOpacity, translateY]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const handleDismiss = () => {
    backdropOpacity.value = withTiming(0, {
      duration: 180,
      reduceMotion: ReduceMotion.Never,
    });
    translateY.value = withTiming(
      500,
      {
        duration: 180,
        reduceMotion: ReduceMotion.Never,
      },
      (finished) => {
        if (finished) {
          runOnJS(onClose)();
        }
      }
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop: Soft fade-in dim overlay via react-native-reanimated */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0, 0, 0, 0.36)' },
            animatedBackdropStyle,
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        {/* Sheet: Slides up gracefully over the backdrop via react-native-reanimated */}
        <Animated.View
          style={[
            {
              backgroundColor,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              ...(fullHeight ? { maxHeight: '92%' } : {}),
              overflow: 'hidden',
            },
            animatedSheetStyle,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export default NativeSheet;
