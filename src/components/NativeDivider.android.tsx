import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Host, HorizontalDivider, VerticalDivider } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, fillMaxHeight } from '@expo/ui/jetpack-compose/modifiers';
import type { NativeDividerProps } from './nativeDividerShared';

export type { NativeDividerProps } from './nativeDividerShared';

/**
 * Android Native Divider powered by Material 3 Jetpack Compose
 * (HorizontalDivider & VerticalDivider via @expo/ui/jetpack-compose)
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
      >
        {isHorizontal ? (
          <HorizontalDivider
            thickness={thickness}
            color={color}
            modifiers={[fillMaxWidth()]}
          />
        ) : (
          <VerticalDivider
            thickness={thickness}
            color={color}
            modifiers={[fillMaxHeight()]}
          />
        )}
      </Host>
    </View>
  );
});

export default NativeDivider;

