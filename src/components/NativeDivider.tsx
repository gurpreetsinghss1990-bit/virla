import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeDividerProps } from './nativeDividerShared';

export type { NativeDividerProps } from './nativeDividerShared';

/**
 * Fallback Divider for Web & Non-Native targets
 */
export const NativeDivider = React.memo(({
  orientation = 'horizontal',
  thickness = StyleSheet.hairlineWidth,
  color = '#E4E4E7',
  style,
  className,
}: NativeDividerProps) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      className={className}
      style={[
        isHorizontal
          ? {
              width: '100%',
              height: thickness,
              backgroundColor: color as string,
            }
          : {
              height: '100%',
              width: thickness,
              backgroundColor: color as string,
            },
        style,
      ]}
    />
  );
});

export default NativeDivider;

