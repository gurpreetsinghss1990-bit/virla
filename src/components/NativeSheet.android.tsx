import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { Host, ModalBottomSheet, RNHostView } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import type { NativeSheetProps } from './nativeSheetShared';

export type { NativeSheetProps } from './nativeSheetShared';

export function NativeSheet({ visible, onClose, backgroundColor, contentColor, fullHeight, children }: NativeSheetProps) {
  const scheme = useColorScheme();

  // Android M3 system surface token colours
  // light: Surface (#FEFBFF), dark: Surface (#1C1B1F)
  const systemSurface = backgroundColor ?? (scheme === 'dark' ? '#1C1B1F' : '#FEFBFF');
  const systemOnSurface = contentColor ?? (scheme === 'dark' ? '#E6E1E5' : '#1C1B1F');

  if (!visible) return null;

  return (
    <Host style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <ModalBottomSheet
        onDismissRequest={onClose}
        containerColor={systemSurface}
        contentColor={systemOnSurface}
        showDragHandle={false}
        skipPartiallyExpanded={true}
      >
        <RNHostView matchContents={{ vertical: true }} modifiers={[fillMaxWidth()]}>
          <View style={{ width: '100%' }}>{children}</View>
        </RNHostView>
      </ModalBottomSheet>
    </Host>
  );
}

export default NativeSheet;
