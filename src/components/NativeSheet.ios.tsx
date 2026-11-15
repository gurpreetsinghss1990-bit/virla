import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Host, RNHostView } from '@expo/ui/swift-ui';
import type { NativeSheetProps } from './nativeSheetShared';

export type { NativeSheetProps } from './nativeSheetShared';

export function NativeSheet({ visible, onClose, backgroundColor = '#FFFFFF', fullHeight, children }: NativeSheetProps) {
  if (!visible) return null;

  return (
    <Host style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <BottomSheet
        isPresented
        fitToContents={!fullHeight}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
      >
        <RNHostView matchContents>
          <View style={{ width: '100%', backgroundColor }}>{children}</View>
        </RNHostView>
      </BottomSheet>
    </Host>
  );
}

export default NativeSheet;
