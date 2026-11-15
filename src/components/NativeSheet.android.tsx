import React from 'react';
import { View } from 'react-native';
import { ModalBottomSheet, RNHostView } from '@expo/ui/jetpack-compose';
import type { NativeSheetProps } from './nativeSheetShared';

export type { NativeSheetProps } from './nativeSheetShared';

export function NativeSheet({ visible, onClose, backgroundColor = '#FFFFFF', contentColor, fullHeight, children }: NativeSheetProps) {
  if (!visible) return null;

  return (
    <ModalBottomSheet
      onDismissRequest={onClose}
      containerColor={backgroundColor}
      contentColor={contentColor}
      showDragHandle
      skipPartiallyExpanded={fullHeight}
    >
      <RNHostView matchContents={{ vertical: true }}>
        <View style={{ width: '100%' }}>{children}</View>
      </RNHostView>
    </ModalBottomSheet>
  );
}

export default NativeSheet;
