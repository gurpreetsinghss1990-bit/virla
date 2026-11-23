import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, View, Animated, StyleSheet } from 'react-native';
import type { NativeSheetProps } from './nativeSheetShared';

export type { NativeSheetProps } from './nativeSheetShared';

/**
 * iOS Crisp Native Bottom Sheet
 * Backdrop smoothly fades in with a gentle dim (rgba(0,0,0,0.38)),
 * while the sheet surface slides up naturally.
 * Eliminates the jarring black block sliding up with the modal.
 */
export function NativeSheet({ visible, onClose, backgroundColor = '#FFFFFF', fullHeight, children }: NativeSheetProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 26,
          stiffness: 280,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdropOpacity, slideAnim]);

  if (!visible) return null;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 500,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop: Soft fade-in dim overlay (does NOT slide up from bottom) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(0, 0, 0, 0.36)',
              opacity: backdropOpacity,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        {/* Sheet: Slides up gracefully over the soft backdrop */}
        <Animated.View
          style={{
            transform: [{ translateY: slideAnim }],
            backgroundColor,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            ...(fullHeight ? { maxHeight: '92%' } : {}),
            overflow: 'hidden',
          }}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export default NativeSheet;
