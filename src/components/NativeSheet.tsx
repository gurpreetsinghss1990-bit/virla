import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import type { NativeSheetProps } from './nativeSheetShared';

export type { NativeSheetProps } from './nativeSheetShared';

export function NativeSheet({ visible, onClose, backgroundColor = '#FFFFFF', fullHeight, children }: NativeSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: fullHeight ? '92%' : '85%',
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
