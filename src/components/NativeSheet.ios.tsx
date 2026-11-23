import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import type { NativeSheetProps } from './nativeSheetShared';

export type { NativeSheetProps } from './nativeSheetShared';

/**
 * iOS Crisp Native Bottom Sheet
 * Uses standard Modal + Backdrop + Sheet surface.
 * Eliminates @expo/ui/swift-ui RNHostView snapshot rasterization artifacts.
 */
export function NativeSheet({ visible, onClose, backgroundColor = '#FFFFFF', fullHeight, children }: NativeSheetProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'flex-end' }}>
        {/* Tap backdrop to dismiss */}
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            ...(fullHeight ? { maxHeight: '92%' } : {}),
            overflow: 'hidden',
          }}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

export default NativeSheet;
