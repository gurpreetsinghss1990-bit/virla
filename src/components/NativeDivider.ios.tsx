import React from 'react';
import { View } from 'react-native';
import { Host, Divider } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import type { NativeDividerProps } from './nativeDividerShared';

export type { NativeDividerProps } from './nativeDividerShared';

/**
 * iOS Native Divider powered by Apple SwiftUI Divider via @expo/ui/swift-ui.
 * In SwiftUI, Divider() automatically adapts horizontally or vertically based on layout context.
 */
export const NativeDivider = React.memo(({
  orientation = 'horizontal',
  thickness,
  color,
  style,
  className,
}: NativeDividerProps) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      className={className}
      style={[
        isHorizontal
          ? { width: '100%', height: thickness ?? 1, justifyContent: 'center' }
          : { height: '100%', width: thickness ?? 1, alignItems: 'center' },
        style,
      ]}
    >
      <Host
        style={isHorizontal ? { width: '100%' } : { height: '100%' }}
        matchContents={isHorizontal ? { vertical: true } : { horizontal: true }}
        modifiers={
          isHorizontal
            ? [frame({ maxWidth: Infinity, maxHeight: thickness })]
            : [frame({ maxHeight: Infinity, maxWidth: thickness })]
        }
      >
        <Divider />
      </Host>
    </View>
  );
});

export default NativeDivider;
