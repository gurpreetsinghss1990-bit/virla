import React from 'react';
import { Modal, Pressable, View, useColorScheme, Platform } from 'react-native';
import type { NativeSheetProps } from './nativeSheetShared';

export type { NativeSheetProps } from './nativeSheetShared';

/**
 * Bottom sheet that sizes itself to its content (wrap-content).
 * fullHeight=true caps it at 92% for scrollable/tall sheets.
 * Background defaults to the Android M3 / iOS system surface colour.
 */
export function NativeSheet({ visible, onClose, backgroundColor, fullHeight, children }: NativeSheetProps) {
  const scheme = useColorScheme();

  // Native system surface:
  //   Android M3 light → #FEFBFF, dark → #1C1B1F
  //   iOS light → #FFFFFF, dark → #1C1C1E
  const systemSurface = backgroundColor ?? (
    Platform.OS === 'android'
      ? (scheme === 'dark' ? '#1C1B1F' : '#FEFBFF')
      : (scheme === 'dark' ? '#1C1C1E' : '#FFFFFF')
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        {/* Tap outside to dismiss */}
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: systemSurface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            // fullHeight sheets scroll their own content; wrap-content sheets size to children
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
